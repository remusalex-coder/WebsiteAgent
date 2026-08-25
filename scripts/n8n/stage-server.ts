/**
 * The host-side stage runner that the n8n workflow drives over HTTP.
 *
 * Why HTTP and not an Execute Command node: n8n 2.x ships
 * `nodes.exclude = ['n8n-nodes-base.executeCommand', ...]` as a SECURITY
 * DEFAULT, so a workflow built from Execute Command nodes cannot even be
 * activated ("Unrecognized node type"). Re-enabling that node would hand every
 * n8n workflow a shell. Instead n8n keeps its defaults and calls this narrow
 * endpoint, which can only run the seven known production stages.
 *
 * Running on the host is also what makes the stages work at all: the repo's
 * `node_modules` (esbuild, Playwright + its browser) is built for the host
 * platform, not for the Linux container.
 *
 *   npx tsx scripts/n8n/stage-server.ts            # 0.0.0.0:7717
 *   curl "http://localhost:7717/stage/build?runId=77c15289" -H "x-bf-token: ..."
 *
 * The listener binds 0.0.0.0 because Docker reaches the host through
 * `host.docker.internal`, which never resolves to a loopback-bound socket.
 * That puts the port on the LAN, so every request must carry a shared token
 * (`BF_STAGE_TOKEN`, else generated once into `n8n/.stage-token`).
 */

import http from 'node:http';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { runStage, runJobFull, isStageName, STAGES } from './stage.js';
import { summarizeRun, summarizeAllRuns } from '../../lib/workflow/summary.js';
import { CONTROL_SURFACE_HTML } from './controlSurfacePage.js';

const DEFAULT_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Resolved lazily so tests can redirect the server at an isolated root. */
export function repoRoot(): string {
  return process.env.BF_REPO_ROOT === undefined ? DEFAULT_REPO_ROOT : process.env.BF_REPO_ROOT;
}

function tokenFile(): string {
  return path.join(repoRoot(), 'n8n', '.stage-token');
}

/**
 * The shared secret guarding the endpoint. Resolved once and persisted so the
 * server and the workflow generator agree without the human copying anything.
 */
export function stageToken(): string {
  const fromEnv = process.env.BF_STAGE_TOKEN;
  if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
  if (fsSync.existsSync(tokenFile())) return fsSync.readFileSync(tokenFile(), 'utf8').trim();
  const generated = randomBytes(24).toString('hex');
  fsSync.mkdirSync(path.dirname(tokenFile()), { recursive: true });
  fsSync.writeFileSync(tokenFile(), `${generated}\n`, 'utf8');
  return generated;
}

export const STAGE_PORT = Number(process.env.BF_STAGE_PORT ?? '7717');

/**
 * `runId` is joined onto the output directory, so anything outside a flat
 * slug would let a caller walk the filesystem. Reject rather than sanitise.
 */
const RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** An order is one or two sentences. Anything longer is not an order. */
const ORDER_MAX_CHARS = 2_000;

/**
 * Stages mutate one shared `job.json` per run, so overlapping calls would
 * interleave writes. n8n runs them in sequence, but a stray retry must not be
 * able to corrupt state — serialise everything through one chain.
 */
let queue: Promise<unknown> = Promise.resolve();
function serialise<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => undefined);
  return next;
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

export function createStageServer(
  token: string,
  deps: {
    readonly runJob?: typeof runJobFull;
  } = {},
): http.Server {
  const runJob = deps.runJob ?? runJobFull;
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname === '/health') {
      send(res, 200, { ok: true, stages: STAGES });
      return;
    }

    /*
     * The control-surface page (WQ-016) is intentionally served BEFORE the
     * token check: it is static markup with zero job data embedded — every
     * fact it shows comes from a browser-side fetch() the page's own script
     * makes to /job, /jobs, carrying whatever token the human typed into it.
     * A browser navigating to a URL cannot set a custom header, so the page
     * itself has to be reachable without one; the data underneath it stays
     * exactly as gated as it always was.
     */
    if ((url.pathname === '/' || url.pathname === '/ui') && req.method === 'GET') {
      const payload = CONTROL_SURFACE_HTML;
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-length': Buffer.byteLength(payload) });
      res.end(payload);
      return;
    }

    if (req.headers['x-bf-token'] !== token) {
      send(res, 401, { error: 'bad or missing x-bf-token' });
      return;
    }

    /* ----------------------------------------------------------------
     * Job-level endpoints (P7-1). The n8n workflow talks to these — one
     * order in, one poll of the run, nothing else. The loop lives in
     * `runJobFull`, not in the workflow JSON.
     * ---------------------------------------------------------------- */

    if (url.pathname === '/job' && req.method === 'POST') {
      const runId = url.searchParams.get('runId') ?? '';
      if (!RUN_ID.test(runId)) {
        send(res, 400, { error: 'runId must match /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/' });
        return;
      }
      const order = url.searchParams.get('order') ?? '';
      if (order.trim() === '') {
        send(res, 400, { error: 'order is required — the customer\'s request, in words' });
        return;
      }
      if (order.length > ORDER_MAX_CHARS) {
        send(res, 400, { error: `order must be at most ${ORDER_MAX_CHARS} characters` });
        return;
      }
      const maxIterRaw = url.searchParams.get('maxIter');
      const maxIter = maxIterRaw === null ? 3 : Number(maxIterRaw);
      if (!Number.isInteger(maxIter) || maxIter < 1 || maxIter > 20) {
        send(res, 400, { error: 'maxIter must be an integer in 1..20' });
        return;
      }

      void serialise(async () => {
        const startedAt = Date.now();
        try {
          const result = await runJob({ runId, order, maxIter });
          // eslint-disable-next-line no-console
          console.log(`[job] run=${runId} finished in ${Date.now() - startedAt}ms ->`, JSON.stringify(result));
          send(res, 200, { ...result, status: 'complete' });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          // eslint-disable-next-line no-console
          console.error(`[job] run=${runId} FAILED in ${Date.now() - startedAt}ms:`, error);
          send(res, 500, { error: message, runId, status: 'failed' });
        }
      });
      return;
    }

    if (url.pathname === '/job' && req.method === 'GET') {
      // The poll endpoint. Reads the job's current state; a terminal decision
      // (deliver / escalate) is the "done" signal the workflow waits for.
      //
      // Delegates to lib/workflow/summary.ts's summarizeRun rather than
      // hand-computing "which providers failed"/"is the battle done" here a
      // second time (WQ-016) — this is the same read model scripts/status.ts
      // and the control-surface page below use. The response's field names
      // (runId, status, stage, decision, finalOutput, workers.{calls,
      // providersUsed,failedProviders,fallbacks}, budgetCents, gate) are a
      // real, tested contract the n8n workflow's poll step also reads —
      // preserved exactly, derived from the shared summary rather than
      // duplicated; the additive fields (errors, phases, candidateCount,
      // battle) are new, for the richer control surface.
      const runId = url.searchParams.get('runId') ?? '';
      if (!RUN_ID.test(runId)) {
        send(res, 400, { error: 'runId must match /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/' });
        return;
      }
      void (async () => {
        try {
          const summary = await summarizeRun(path.join(repoRoot(), 'output'), runId);
          if (summary === null) {
            send(res, 404, { error: `no such run: ${runId}`, runId });
            return;
          }
          const terminal = summary.decision === 'deliver' || summary.decision === 'escalate';
          const providersUsed = Object.entries(summary.workers.byProvider)
            .filter(([name, tally]) => name !== '(deterministic)' && tally.ok > 0)
            .map(([name]) => name);
          const failedProviders = Object.entries(summary.workers.byProvider)
            .filter(([name, tally]) => name !== '(deterministic)' && tally.failed > 0)
            .map(([name]) => name);
          const deterministicTally = summary.workers.byProvider['(deterministic)'];
          const fallbacks = deterministicTally === undefined ? 0 : deterministicTally.ok + deterministicTally.failed;

          send(res, 200, {
            runId,
            status: terminal ? 'complete' : 'running',
            stage: summary.stage,
            iteration: summary.iteration,
            maxIter: summary.maxIter,
            decision: summary.decision,
            business: summary.business,
            finalOutput: summary.finalOutput,
            workers: { calls: summary.workers.total, providersUsed, failedProviders, fallbacks },
            budgetCents: summary.budgetCents,
            gate: summary.gate,
            // Additive (WQ-016): not read by the n8n workflow, but real —
            // the same fields scripts/status.ts and the control-surface page
            // show, so a caller does not need a second endpoint for them.
            phases: summary.phases,
            candidateCount: summary.candidateCount,
            battle: summary.battle,
            errors: summary.errors,
            updatedAt: summary.updatedAt,
          });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          send(res, 500, { error: message, runId });
        }
      })();
      return;
    }

    if (url.pathname === '/jobs' && req.method === 'GET') {
      // Every discoverable run, most-recently-updated first — the
      // control-surface page's job list (WQ-016). Same read model as /job,
      // one call per run rather than a caller polling /job per id blind.
      void (async () => {
        try {
          const summaries = await summarizeAllRuns(path.join(repoRoot(), 'output'));
          const sorted = [...summaries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
          send(res, 200, { runs: sorted });
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          send(res, 500, { error: message });
        }
      })();
      return;
    }

    const match = /^\/stage\/([a-z]+)$/.exec(url.pathname);
    if (match === null) {
      send(res, 404, { error: `no such endpoint: ${url.pathname}` });
      return;
    }

    const stage = match[1]!;
    const runId = url.searchParams.get('runId') ?? '';
    const maxIterRaw = url.searchParams.get('maxIter');
    const order = url.searchParams.get('order');
    const businessUrl = url.searchParams.get('businessUrl');
    const sourceUrlsRaw = url.searchParams.get('sourceUrls');
    const additionalInstruction = url.searchParams.get('additionalInstruction');
    const provider = url.searchParams.get('provider');
    const direction = url.searchParams.get('direction');
    const assetType = url.searchParams.get('type') ?? url.searchParams.get('assetType');
    // Presence is the signal, so `?decideOnly=1` and `?decideOnly=true` agree;
    // an explicit "0"/"false" turns it back off.
    const decideOnlyRaw = url.searchParams.get('decideOnly');
    const decideOnly = decideOnlyRaw !== null && decideOnlyRaw !== '0' && decideOnlyRaw !== 'false';

    let sourceUrls: string[] | undefined;
    if (sourceUrlsRaw) {
      try {
        const parsed = JSON.parse(sourceUrlsRaw);
        if (Array.isArray(parsed)) {
          sourceUrls = parsed.map(String).map((s) => s.trim()).filter(Boolean);
        } else if (typeof parsed === 'string' && parsed.trim() !== '') {
          sourceUrls = [parsed.trim()];
        }
      } catch {
        sourceUrls = sourceUrlsRaw.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    if (!isStageName(stage)) {
      send(res, 400, { error: `unknown stage: ${stage}`, stages: STAGES });
      return;
    }
    if (!RUN_ID.test(runId)) {
      send(res, 400, { error: 'runId must match /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/' });
      return;
    }
    const maxIter = maxIterRaw === null ? 3 : Number(maxIterRaw);
    if (!Number.isInteger(maxIter) || maxIter < 1 || maxIter > 20) {
      send(res, 400, { error: 'maxIter must be an integer in 1..20' });
      return;
    }
    // The order is prose from a human and is never interpolated into a path, a
    // shell or a query — it reaches a model inside a delimited block. What it
    // must not be is unbounded: this endpoint is on the LAN, and an order is a
    // sentence, not a payload.
    if (order !== null && order.length > ORDER_MAX_CHARS) {
      send(res, 400, { error: `order must be at most ${ORDER_MAX_CHARS} characters` });
      return;
    }
    // Validated against the provider list by the stage itself; bounded here so
    // a junk value cannot become a filename.
    if (provider !== null && !/^[a-z][a-z0-9_-]{0,31}$/.test(provider)) {
      send(res, 400, { error: 'provider must match /^[a-z][a-z0-9_-]{0,31}$/' });
      return;
    }

    void serialise(async () => {
      const startedAt = Date.now();
      try {
        const result = await runStage({
          stage,
          runId,
          maxIter,
          ...(order === null ? {} : { order }),
          ...(businessUrl === null || businessUrl.trim() === '' ? {} : { businessUrl }),
          ...(sourceUrls === undefined || sourceUrls.length === 0 ? {} : { sourceUrls }),
          ...(additionalInstruction === null || additionalInstruction.trim() === '' ? {} : { additionalInstruction }),
          ...(provider === null ? {} : { provider }),
          ...(direction === null ? {} : { direction }),
          ...(assetType === null ? {} : { assetType }),
          ...(decideOnly ? { decideOnly } : {}),
        });
        // eslint-disable-next-line no-console
        console.log(`[stage] ${stage} run=${runId} ok in ${Date.now() - startedAt}ms ->`, JSON.stringify(result));
        send(res, 200, result);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.error(`[stage] ${stage} run=${runId} FAILED in ${Date.now() - startedAt}ms:`, error);
        send(res, 500, { error: message, stage, runId });
      }
    });
  });
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const token = stageToken();
  createStageServer(token).listen(STAGE_PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`[stage-server] listening on 0.0.0.0:${STAGE_PORT} (stages: ${STAGES.join(', ')})`);
    // eslint-disable-next-line no-console
    console.log(`[stage-server] token file: ${tokenFile()}`);
  });
}
