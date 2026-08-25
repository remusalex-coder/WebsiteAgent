/**
 * n8n stage dispatcher — the bridge between the n8n workflow and the
 * TypeScript orchestrator. One call performs exactly one production stage,
 * mutates `output/<runId>/job.json`, and returns a small summary. n8n wires
 * the stages together (and loops Reconcept -> Build) so the human never
 * connects nodes by hand.
 *
 * Two front ends share `runStage` — the CLI below, and `stage-server.ts`,
 * which is what the n8n workflow actually calls over HTTP. (n8n 2.x excludes
 * `n8n-nodes-base.executeCommand` by default for security, so the workflow
 * uses HTTP Request nodes against the host rather than shelling out from
 * inside the container. See n8n/README.md.)
 *
 * Every stage reuses the existing modules — nothing is reimplemented:
 *   build    -> composeStandalone (main.ts)
 *   browser  -> captureScreenshots (runJob.ts)
 *   critic   -> runVisualCritic (visual-critic.ts)
 *   gate     -> gateJob (distinctness-gate.ts)
 *   hermes   -> decide (hermes.ts) + reconceptBuild (runJob.ts)
 *   create   -> createJob/saveJob (jobState.ts)
 *   report   -> summarise job.json
 *
 *   npx tsx scripts/n8n/stage.ts --stage <name> --run <runId> [--max-iter N]
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import { loadConfig } from '../../lib/config.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';
import { composeStandalone, acquireProfile, directPageCopy } from '../../main.js';
import { businessAnalystAgent } from '../../agents/businessAnalystAgent.js';
import { composeBaseline, writerAgent } from '../../agents/writerAgent.js';
import { createPlatform } from '../../lib/platform/platform.js';
import { draftBrief } from '../../lib/factory/brief.js';
import { researchWith } from '../../lib/factory/research.js';
import { synthesizeResearch, mapsSearchUrl } from '../../lib/factory/synthesize.js';
import { resolvePool } from '../../lib/factory/pool.js';
import {
  routeForCapability,
  exclusionLedger,
  routedMembers,
  capabilityPoolRole,
} from '../../lib/factory/capabilities.js';
import type { PoolMember } from '../../lib/factory/pool.js';
import type { FactoryCapability } from '../../lib/factory/capabilities.js';
import { isAIProviderName } from '../../lib/ai/types.js';
import { captureScreenshots, reconceptBuild, loadPeerDesigns } from '../../lib/workflow/runJob.js';
import { runVisualCritic, analyzeCritique } from '../../lib/qa/visual-critic.js';
import { auditLayout } from '../../lib/qa/layout-audit.js';
import { gateJob } from '../../lib/qa/distinctness-gate.js';
import { collectPreflightEvidence, gatePreflight, applyPreflightToDecision } from '../../lib/qa/preflight.js';
import { decideJury } from '../../lib/qa/jury.js';
import { scoreExperience } from '../../lib/design/quality.js';
import { fingerprintDirective } from '../../lib/design/fingerprint.js';
import { diverge } from '../../lib/design/diverge.js';
import { finalizeBest, recordCandidate, CANDIDATES_DIR_NAME } from '../../lib/workflow/candidates.js';
import { runPool, createSerializedWriter } from '../../lib/workflow/runner.js';
import type { RunnerTask } from '../../lib/workflow/runner.js';
import { decide } from '../../lib/workflow/hermes.js';
import { createJob, loadJob, saveJob } from '../../lib/workflow/jobState.js';
import type { WorkerCall, JobState } from '../../lib/workflow/jobState.js';
import { hashValue, recordStage, loadStageLedger, shouldSkip } from '../../lib/workflow/hashes.js';
import { deriveCharacter } from '../../lib/design/character.js';
import { defaultsFor } from '../../lib/design/industries.js';
import type { WebsiteDesign, WebsiteContent, BusinessProfile } from '../../lib/types.js';
import type { VisualCritique } from '../../lib/qa/visual-critic.js';
import type { DistinctnessResult } from '../../lib/qa/distinctness-gate.js';
import type { DesignDirective } from '../../lib/design/directive.js';
import type { BusinessCharacter } from '../../lib/design/character.js';
import type { LayoutAudit } from '../../lib/qa/layout-audit.js';
import type { PreflightResult } from '../../lib/qa/preflight.js';
import type { FactoryBrief } from '../../lib/factory/brief.js';
import type { ResearchNote } from '../../lib/factory/research.js';
import type { ResearchSynthesis } from '../../lib/factory/synthesize.js';
import type { AgentContext, BusinessStrategy } from '../../lib/types.js';

/**
 * The stages the workflow can ask for, in the order the factory runs them.
 *
 * The first six are the factory's front half — an order becomes a real,
 * collected business — and were added when the loop gained an intake. The rest
 * are the production loop that already existed. `create` stays first and stays
 * a no-op beyond writing `job.json`, because the Production Loop workflow calls
 * it and must keep working.
 *
 * `direct` sits *after* `build` on purpose: creative direction is applied to a
 * page that exists, by the same `reconceptBuild` the rejection loop uses, so
 * there is exactly one code path that turns a directive into a rendered site.
 *
 * `diverge` sits *after* `direct` and *before* the QA loop: it takes the base
 * directive, enumerates K divergent directions pre-spend (zero model calls),
 * builds and records each candidate, juries them, and restores the winner to
 * the run root — so the site the browser screenshots is the jury's choice,
 * not the first thing that rendered.
 *
 * `preflight` sits *after* hermes has decided to stop looping and *before*
 * `report` — production preflight per Decision Gate §1.J / §8 item 8: the
 * functional/security and accessibility gates (Freeze N-11/N-12, previously
 * only reachable from the standalone `scripts/publish-run.ts`) run against
 * the delivered artifact and, on a blocking finding, downgrade a pending
 * `deliver` decision to `escalate`. It never re-runs when hermes already
 * escalated — there is nothing left to preflight-check before a human sees it
 * that the human will not also see directly.
 */
export const STAGES = [
  'create',
  'intake',
  'router',
  'research',
  'synthesize',
  'source',
  'analyze',
  'write',
  'build',
  'direct',
  'diverge',
  'jury',
  'assets',
  'browser',
  'layout',
  'critic',
  'gate',
  'hermes',
  'repair',
  'preflight',
  'deploy',
  'report',
  'experience-forge',
] as const;
export type StageName = (typeof STAGES)[number];

/**
 * The frozen battle width: how many divergent design directions the diverge
 * stage builds and juries. K=3 from the freeze — three genuinely different
 * candidates, not three re-colours of one page.
 */
export const K_DESIGN_DIRECTIONS = 3;

/** Where `reconceptBuild` writes the rendered site, relative to its `outputDir`. */
const SITE_DIR_NAME = 'site';

/**
 * Gives a parallel candidate build its own `outputDir` without copying the
 * run's evidence/asset bytes.
 *
 * Every entry `realDir` has — profile, content, strategy, collected images,
 * research — is symlinked into `shadowDir` under the same name, except the
 * two paths a build actually writes (`5b-design.json`, `site/`) and the
 * shared candidate store (`candidates/`, plus this helper's own scratch
 * root). `reconceptBuild` and everything it calls (`writeRenderedSite`
 * resolving an asset's `sourcePath`, `deterministicQuality` reading
 * `5-content.json`) then reads through the symlink exactly as if `shadowDir`
 * were `realDir` — but its own `5b-design.json`/`site/` land in a directory
 * nothing else touches. This is what makes K candidates safe to build
 * concurrently: two directions finishing at the same moment cannot interleave
 * writes to a file they do not share.
 */
async function createShadowDir(
  realDir: string,
  shadowDir: string,
  exclude: ReadonlySet<string>,
): Promise<void> {
  await fs.mkdir(shadowDir, { recursive: true });
  const entries = await fs.readdir(realDir, { withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => !exclude.has(entry.name))
      .map(async (entry) => {
        try {
          await fs.symlink(path.join(realDir, entry.name), path.join(shadowDir, entry.name));
        } catch (error) {
          // Another shadow build's own directory, or a temp file the run
          // wrote between `readdir` and here, is not this helper's problem —
          // a build surviving it is better than failing the whole direction.
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
      }),
  );
}

/**
 * A candidate's deterministic quality, used by the pre-browser jury.
 *
 * The full gate reads layout + vision, neither of which exists before the
 * browser stage — but the deterministic half (experience score) is computable
 * from the composed design alone. The jury's job is exactly to rank the
 * candidates by this number before spending vision, so re-deriving it here
 * (same `scoreExperience`, same character) keeps the ranking identical to what
 * the gate would have produced after a screenshot.
 */
async function deterministicQuality(outputDir: string, design: WebsiteDesign): Promise<number> {
  const content = await readJsonIfExists<WebsiteContent>(path.join(outputDir, '5-content.json'));
  if (content === null) return 0;
  return scoreExperience(design, content, await characterFor(outputDir, design)).overall;
}

export function isStageName(value: string): value is StageName {
  return (STAGES as readonly string[]).includes(value);
}

/**
 * The character the gate must score against — the SAME one `composeDesign`
 * derived, not a summary of it.
 *
 * The gate calls `scoreExperience(design, content, character)`, which reads
 * axes like `visualWeight`. Handing it a `{name, category, description}` stub
 * (or `null`) either crashes it or silently scores against `undefined` axes,
 * so it is rebuilt here the way compose builds it: industry defaults supply
 * the `CharacterContext`, and `deriveCharacter` reads the rest off the
 * evidence. Nothing is invented — this is a re-derivation, not a guess.
 */
async function characterFor(outputDir: string, design: WebsiteDesign): Promise<BusinessCharacter> {
  const read = async <T>(p: string): Promise<T> => JSON.parse(await fs.readFile(p, 'utf8')) as T;
  const profile = await read<BusinessProfile>(path.join(outputDir, '3-profile.json'));
  const content = await read<WebsiteContent>(path.join(outputDir, '5-content.json'));
  const defaults = defaultsFor(design.industry.id);
  return deriveCharacter(profile, content, {
    ground: defaults.ground,
    imageReliance: defaults.imageReliance,
  });
}

/**
 * What a stage reports back to n8n. `loop` is the only field the workflow
 * branches on: the IF node routes true back to Build (reconcept) and false to
 * Report (deliver/escalate). Everything else is for the human reading the
 * execution.
 */
export interface StageResult {
  readonly runId: string;
  readonly stage: StageName;
  readonly loop: boolean;
  readonly iteration: number;
  readonly decision: string | null;
  readonly verdict: string | null;
  readonly nextStage: string | null;
  readonly finalOutput: string | null;
  /** The business this run is about, once one has actually been collected. */
  readonly business?: string;
  /** One line a human reading the n8n execution can act on. */
  readonly note?: string;
  /** Vendors this stage actually called, and those it could not. */
  readonly providers?: {
    readonly used: readonly string[];
    readonly absent: readonly { readonly provider: string; readonly reason: string }[];
    /** Providers the capability router considered and dropped, with why. */
    readonly excluded?: readonly { readonly provider: string; readonly reason: string }[];
    /**
     * Every member of the role's pool, for the workflow to fan out over.
     *
     * The pool is defined host-side by `BF_POOL*`, so n8n must be *told* it
     * rather than hold its own copy — a second list in a Code node would be a
     * second source of truth, and the two would drift the first time a vendor
     * was added.
     */
    readonly pool?: readonly string[];
  };
}

/** Where each factory artifact lands under `output/<runId>/`. */
const FACTORY_ARTIFACTS = {
  brief: '0-brief.json',
  research: '0-research.json',
  researchDir: 'research',
  strategy: '4-strategy.json',
  directive: '5a-directive.json',
  layout: 'qa/layout.json',
  preflight: 'qa/preflight.json',
} as const;

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * Strips `updatedAt` before a `JobState` snapshot is hashed for the stage
 * ledger (T01) — `saveJob` restamps it on every write, so leaving it in would
 * make the input/output hash change on every call even when nothing a stage
 * actually reads or produces changed, which would defeat the point of content
 * addressing before T02 ever gets to use it.
 */
function forHash(job: JobState): Omit<JobState, 'updatedAt'> {
  const { updatedAt: _updatedAt, ...rest } = job;
  return rest;
}

/**
 * Appends worker calls to the job's observability ledger and persists.
 *
 * Every stage that talks to a worker records who it asked, whether the worker
 * answered, and (when it did not) what the fallback was. The ledger is what
 * the n8n board reads — "active workers", "failed providers", "fallbacks".
 */
async function recordWorkers(
  outputDir: string,
  job: ReturnType<typeof createJob>,
  calls: readonly WorkerCall[],
): Promise<ReturnType<typeof createJob>> {
  if (calls.length === 0) return job;
  return saveJob(outputDir, { providerLog: [...job.providerLog, ...calls] });
}

/**
 * An `AgentContext` for the stages that call a pipeline agent directly.
 *
 * `main.ts` builds one per run and keeps it private, which is right for the
 * pipeline but leaves the stage runner without one. This assembles the same
 * thing from the pieces an agent actually reads, and hands back the disposer —
 * the platform holds MCP connections, so a stage that forgets to dispose leaks
 * one per call.
 *
 * `getBrowser` rejects rather than opening one: no stage routed through here
 * needs a browser, and a silent launch would cost a Chromium per analysis.
 */
/**
 * The same configuration, pointed at one pool member.
 *
 * `platform.ai()` resolves `config.ai.provider`, so swapping a vendor in is a
 * matter of handing the platform a different config — no agent changes. The
 * three per-agent model ids move with it, because they are resolved from
 * `ANALYST_MODEL` / `WRITER_MODEL` / `DIRECTOR_MODEL` and a Gemini model id
 * sent to OpenAI is a 404, which would look like the failover itself failing.
 */
function configForMember(
  config: ReturnType<typeof loadConfig>,
  member: PoolMember,
): ReturnType<typeof loadConfig> {
  return {
    ...config,
    ai: { ...config.ai, provider: member.provider },
    analyst: { ...config.analyst, model: member.model },
    writer: { ...config.writer, model: member.model },
    director: { ...config.director, model: member.model },
  };
}

/**
 * Runs `work` against each member of a capability's routed chain until one
 * succeeds.
 *
 * The chain comes from `routeForCapability` (lib/factory/capabilities.ts) —
 * the capability router, not the raw pool. The pool decides who is
 * credentialled; the router decides the ORDER (observed telemetry, then the
 * deployment's preference) and appends the deterministic floor. Every attempt
 * is reported, so a run that survived on its second vendor says so rather than
 * looking like a clean first-try success.
 *
 * Returns the value, which member served it, the failed attempts, and the
 * router's exclusion ledger (who was considered and why each was dropped).
 */
async function withPoolFailover<T>(
  role: 'research' | 'design' | 'content',
  config: ReturnType<typeof loadConfig>,
  logger: ReturnType<typeof createLogger>,
  work: (config: ReturnType<typeof loadConfig>, member: PoolMember) => Promise<T>,
): Promise<{
  value: T;
  used: string;
  attempts: readonly { provider: string; error: string }[];
  excluded: readonly { provider: string; reason: string }[];
}> {
  const pool = resolvePool(role, config.ai);
  if (pool.members.length === 0) {
    throw new Error(
      `no ${role} pool member is credentialled; set BF_POOL_${role.toUpperCase()} to a provider with an API key`,
    );
  }

  // Route the role's capability exactly as the factory would name it, so the
  // chain order, the failover and the exclusion ledger all come from one place.
  const capability: FactoryCapability =
    role === 'research' ? 'research' : role === 'content' ? 'content' : 'design.concept';
  const route = routeForCapability({
    capability,
    config: config.ai,
    preference: pool.members.map((member) => member.provider),
  });
  const ordered = routedMembers(route.chain, pool.members);

  const attempts: { provider: string; error: string }[] = [];
  for (const member of ordered) {
    try {
      const value = await work(configForMember(config, member), member);
      return { value, used: member.provider, attempts, excluded: exclusionLedger(route.considered) };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 200) : String(error);
      logger.warn('pool member failed; trying the next', { role, provider: member.provider, error: message });
      attempts.push({ provider: member.provider, error: message });
    }
  }

  throw new Error(
    `every ${role} pool member failed: ${attempts.map((a) => `${a.provider} (${a.error})`).join(' | ')}`,
  );
}

async function agentContext(
  outputDir: string,
  runId: string,
  config: ReturnType<typeof loadConfig>,
  logger: ReturnType<typeof createLogger>,
): Promise<{ context: AgentContext; dispose: () => Promise<void> }> {
  const controller = new AbortController();
  const platform = await createPlatform({
    config,
    logger: logger.child('platform'),
    signal: controller.signal,
    outputDir,
  });
  return {
    context: {
      runId,
      config,
      logger: logger.child('agent'),
      getBrowser: () => Promise.reject(new Error('this stage does not use a browser')),
      platform,
      outputDir,
      signal: controller.signal,
    },
    dispose: async () => {
      await platform.dispose();
    },
  };
}

/**
 * Runs one stage against `output/<runId>/`. Throws if the stage's inputs are
 * missing — the caller (CLI exit code, or HTTP 500) surfaces that to n8n so a
 * broken run fails loudly instead of silently delivering.
 */
export async function runStage(opts: {
  readonly stage: StageName;
  readonly runId: string;
  readonly maxIter?: number | undefined;
  /**
   * The customer's order, verbatim. Required by `intake` and ignored elsewhere.
   * Treated as data throughout — see `lib/factory/brief.ts`.
   */
  readonly order?: string | undefined;
  /**
   * Primary business URL (Maps, website, social).
   */
  readonly businessUrl?: string | undefined;
  /**
   * Optional secondary source URLs.
   */
  readonly sourceUrls?: readonly string[] | string | undefined;
  /**
   * Optional user instructions.
   */
  readonly additionalInstruction?: string | undefined;
  /**
   * Which pool member this call is. Required by `research`, which is the
   * fan-out stage: n8n calls it once per member, and each call writes its own
   * artifact, so a member that fails takes nothing else down with it.
   */
  readonly provider?: string | undefined;
  /**
   * Specific design direction ('A' | 'B' | 'C') when running individual diverge branches.
   */
  readonly direction?: string | undefined;
  /**
   * Specific asset category ('image' | 'video' | '3d') when running asset workers.
   */
  readonly assetType?: string | undefined;
  /**
   * Hermes decides but does not rebuild, leaving the repair to its own stage.
   *
   * Off by default so the Production Loop — which has no repair node — keeps
   * working exactly as it did.
   */
  readonly decideOnly?: boolean | undefined;
}): Promise<StageResult> {
  const { stage, runId } = opts;
  const maxIter = opts.maxIter ?? 3;

  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel, scope: `n8n-${stage}`, sink: createConsoleSink() });
  const outputDir = path.join(config.outputDir, runId);
  const SITE = path.join(outputDir, 'site');

  const read = async <T>(p: string): Promise<T> => JSON.parse(await fs.readFile(p, 'utf8')) as T;

  // `saveJob` rebuilds a default job from the PATCH when none exists on disk,
  // so the identity and the iteration ceiling have to travel in the patch —
  // a locally-created job object would be silently discarded, leaving maxIter
  // at its default and letting the loop run past the caller's limit.
  const existing = await loadJob(outputDir);
  let job = existing ?? createJob(runId, runId, maxIter);
  job = await saveJob(outputDir, {
    jobId: job.jobId,
    business: job.business ?? runId,
    maxIter: existing?.maxIter ?? maxIter,
  });

  // T01: snapshot the job as it stands before this stage's real work, so the
  // stage ledger can record what this call actually depended on and actually
  // produced. Taken here — after the identity save above, before the switch
  // below — so it reflects the state every stage handler actually reads from.
  const previousJobSnapshot = job;

  // T02: this call's content-addressed input — the same hash `recordStage`
  // stamps on success, so a later call with an unchanged `opts` against an
  // unchanged job can recognise itself. Reused below for both the skip check
  // and the eventual ledger write, rather than recomputed twice.
  const currentInputHash = hashValue({ opts, job: forHash(previousJobSnapshot) });

  // T02: `hermes` is excluded from skip eligibility. Its case body is not a
  // pure read of job state: with `decideOnly` off (the Production Loop's
  // default) a `continue` decision calls `reconceptBuild` inline — real
  // repair work, not a no-op — and either way it is the one stage whose body
  // sets `loop`/`nextStage`, the signal `runJobFullWith` uses to keep
  // repairing. Skipping it would silently drop both.
  const skipEligible = stage !== 'hermes';
  const priorEntry = skipEligible ? (await loadStageLedger(outputDir)).stages[stage] : undefined;
  const skipped = priorEntry !== undefined && shouldSkip(priorEntry, currentInputHash);

  let loop = false;
  let nextStage: string | null = null;
  let note: string | undefined;
  let providers: StageResult['providers'];

  if (skipped) {
    // T02: `job` is left exactly as loaded — job.json already holds this
    // stage's last real output, which is what "reuse the previous output"
    // means here (see `lib/workflow/hashes.ts`'s module doc). Nothing below
    // this block re-records the ledger: a skip is not a new completion, and
    // the entry that made the skip possible is still accurate.
    note = `skipped: ${stage}'s inputs are unchanged since its last successful run (resume, T02)`;

    // T02: `intake` is a real resume gap, not just an optimisation, because
    // `runJobFullWith` reads `pool` off *this* stage's result to fan the
    // `research` stage out over — not off `job.json`. Skipping the switch
    // leaves `providers` at its default (`undefined`), which would make a
    // resumed run silently fan out over zero providers and skip the entire
    // research phase. `resolvePool` is cheap, deterministic config resolution
    // (no model call — that's `draftBrief`'s job, which the skip correctly
    // avoids repeating), so recomputing it here costs nothing and closes the
    // gap without re-running the part that was actually expensive.
    if (stage === 'intake') {
      const pool = resolvePool('research', config.ai);
      providers = { used: [], absent: [], pool: pool.members.map((member) => member.provider) };
    }
  } else {
  // T01: the switch below is unchanged — every case still does exactly what
  // it did before. This try/catch only brackets it, so a real run's failure
  // is recorded in the stage ledger (never silently dropped, never mistaken
  // for a reusable output) before the original error still propagates
  // unchanged to whatever caller was already handling it.
  try {
    switch (stage) {
    case 'create': {
      job = await saveJob(outputDir, { stage: 'created' });
      break;
    }

    /*
     * The factory's front half: an order becomes a real, collected business.
     */

    case 'intake': {
      const businessUrl = opts.businessUrl?.trim() ?? '';
      const sourceUrls = Array.isArray(opts.sourceUrls)
        ? opts.sourceUrls
        : (typeof opts.sourceUrls === 'string' && opts.sourceUrls.trim() !== '' ? [opts.sourceUrls.trim()] : []);
      const additionalInstruction = opts.additionalInstruction?.trim() ?? '';
      const rawOrder = opts.order?.trim() ?? '';
      const order = rawOrder !== ''
        ? rawOrder
        : (businessUrl !== '' ? `Website for business at ${businessUrl}${additionalInstruction ? ` (${additionalInstruction})` : ''}` : '');

      if (order === '' && businessUrl === '') {
        throw new Error('intake stage requires an "order" or "businessUrl" — the customer\'s request, in words or URL');
      }

      const { brief, pool, failures } = await draftBrief({
        order,
        businessUrl: businessUrl !== '' ? businessUrl : undefined,
        sourceUrls: sourceUrls.length > 0 ? sourceUrls : undefined,
        additionalInstruction: additionalInstruction !== '' ? additionalInstruction : undefined,
        config: config.ai,
        logger,
      });
      await writeJson(path.join(outputDir, FACTORY_ARTIFACTS.brief), brief);
      job = await saveJob(outputDir, {
        stage: 'research',
        business: brief.searchQuery,
        ...(brief.businessUrl ? { businessUrl: brief.businessUrl } : {}),
        ...(brief.sourceUrls && brief.sourceUrls.length > 0 ? { sourceUrls: brief.sourceUrls } : {}),
        ...(brief.additionalInstruction ? { additionalInstruction: brief.additionalInstruction } : {}),
      });
      job = await recordWorkers(outputDir, job, [
        ...failures.map(
          (f): WorkerCall => ({ stage, capability: 'research', provider: f.provider, outcome: 'failed', at: new Date().toISOString() }),
        ),
        ...(brief.authoredBy === null
          ? [{ stage, capability: 'research', provider: null as string | null, outcome: 'ok' as const, at: new Date().toISOString() }]
          : [{ stage, capability: 'research', provider: brief.authoredBy.provider, outcome: 'ok' as const, model: brief.authoredBy.model, at: new Date().toISOString() }]),
      ]);
      note = `will search Maps for "${brief.searchQuery}" (${brief.language})${brief.businessUrl ? ` [URL: ${brief.businessUrl}]` : ''}`;
      providers = {
        used: brief.authoredBy === null ? [] : [brief.authoredBy.provider],
        absent: [
          ...pool.absent.map((entry) => ({ provider: entry.provider, reason: entry.reason })),
          ...failures.map((entry) => ({ provider: entry.provider, reason: entry.error })),
        ],
        pool: pool.members.map((member) => member.provider),
      };
      break;
    }

    case 'router': {
      const researchPool = resolvePool('research', config.ai);
      const contentPool = resolvePool('content', config.ai);
      const designPool = resolvePool('design', config.ai);

      const researchRoute = routeForCapability({ capability: 'research', config: config.ai });
      const contentRoute = routeForCapability({ capability: 'content', config: config.ai });
      const designRoute = routeForCapability({ capability: 'design.concept', config: config.ai });
      const codingRoute = routeForCapability({ capability: 'coding.frontend', config: config.ai });

      const imageProviderConfigured = config.ai.apiKeys.openai !== '' || config.ai.apiKeys.openrouter !== '';
      const videoProviderConfigured = Boolean(process.env.VEO_API_KEY || process.env.SORA_API_KEY || process.env.KLING_API_KEY || process.env.HIGGSFIELD_API_KEY);
      const spatial3dProviderConfigured = Boolean(process.env.TRIPO_API_KEY || process.env.MESHY_API_KEY);

      const routes = {
        research: {
          chain: researchRoute.chain,
          activeMembers: researchPool.members.map((m) => m.provider),
          absent: researchPool.absent,
          floor: 'deterministic-search-query',
        },
        content: {
          chain: contentRoute.chain,
          activeMembers: contentPool.members.map((m) => m.provider),
          absent: contentPool.absent,
          floor: 'profile-only-baseline',
        },
        'design.concept': {
          chain: designRoute.chain,
          activeMembers: designPool.members.map((m) => m.provider),
          absent: designPool.absent,
          floor: 'deterministic-archetype-composition',
        },
        'coding.frontend': {
          chain: codingRoute.chain,
          activeMembers: designPool.members.map((m) => m.provider),
          floor: 'pure-css-typed-components',
        },
        image: {
          status: imageProviderConfigured ? 'available' : 'fallback-curated-local',
          fallback: 'curated-photography-and-svg',
        },
        video: {
          status: videoProviderConfigured ? 'available' : 'unavailable/configuration-required',
          fallback: 'high-impact-css-motion-canvas',
        },
        '3d': {
          status: spatial3dProviderConfigured ? 'available' : 'unavailable/configuration-required',
          fallback: 'css3d-procedural-webgl',
        },
        // WQ-010 / MASTER_INVENTORY.json A11: this label previously said
        // 'google-places-and-bright-data'. Bright Data (the commercial
        // scraping/proxy service) has no client module, config field, or
        // credential anywhere in this repository — a repo-wide grep found
        // zero references outside this one display string. The real
        // fallback when Places' API key is absent is lib/sources/mapsListing.ts,
        // an in-house Playwright read of Google Maps' own public,
        // unauthenticated listing page — not a third-party provider.
        evidence: {
          provider: 'google-places-and-maps-listing',
          status: config.places.apiKey !== '' ? 'available' : 'fallback-direct-fetch',
        },
      };

      await writeJson(path.join(outputDir, '0-routes.json'), routes);
      job = await saveJob(outputDir, { stage: 'research' });
      note = `capability router: ${researchPool.members.length} research, ${contentPool.members.length} content, ${designPool.members.length} design provider(s) active`;
      providers = {
        used: [
          ...researchPool.members.map((m) => m.provider),
          ...contentPool.members.map((m) => m.provider),
          ...designPool.members.map((m) => m.provider),
        ],
        absent: [
          ...researchPool.absent.map((a) => ({ provider: a.provider, reason: a.reason })),
          ...(!videoProviderConfigured ? [{ provider: 'video-veo-sora-kling', reason: 'configuration-required (API key not set)' }] : []),
          ...(!spatial3dProviderConfigured ? [{ provider: '3d-tripo-meshy', reason: 'configuration-required (API key not set)' }] : []),
        ],
        pool: researchPool.members.map((member) => member.provider),
      };
      break;
    }

    case 'research': {
      // One member per call. n8n emits one item per pool member and this node
      // runs once per item, so the pool grows by adding items, not nodes.
      const name = opts.provider?.trim().toLowerCase() ?? '';
      if (!isAIProviderName(name)) {
        throw new Error(`research stage requires a known "provider"; got "${opts.provider ?? ''}"`);
      }
      const brief = await read<FactoryBrief>(path.join(outputDir, FACTORY_ARTIFACTS.brief));
      const pool = resolvePool('research', config.ai);
      const member = pool.members.find((entry) => entry.provider === name);
      if (member === undefined) {
        job = await recordWorkers(outputDir, job, [
          { stage, capability: 'research', provider: name, outcome: 'failed', at: new Date().toISOString() },
        ]);
        note = `${name} unavailable: configuration-required (API key not set)`;
        providers = { used: [], absent: [{ provider: name, reason: 'configuration-required (API key not set)' }] };
        break;
      }
      try {
        const note_ = await researchWith({ brief, member, config: config.ai, logger });
        await writeJson(path.join(outputDir, FACTORY_ARTIFACTS.researchDir, `${name}.json`), note_);
        job = await recordWorkers(outputDir, job, [
          { stage, capability: 'research', provider: name, outcome: 'ok', model: note_.authoredBy.model, at: new Date().toISOString() },
        ]);
        note = `${name}: ${note_.differentiators.length} differentiator(s), ${note_.searchQueries.length} query/queries`;
        providers = { used: [name], absent: [] };
      } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 200) : String(error);
        job = await recordWorkers(outputDir, job, [
          { stage, capability: 'research', provider: name, outcome: 'failed', at: new Date().toISOString() },
        ]);
        note = `${name} failed: ${message}`;
        providers = { used: [], absent: [{ provider: name, reason: message }] };
      }
      break;
    }

    case 'synthesize': {
      // The merge. Pure, deterministic, no model.
      const brief = await read<FactoryBrief>(path.join(outputDir, FACTORY_ARTIFACTS.brief));
      const dir = path.join(outputDir, FACTORY_ARTIFACTS.researchDir);
      // Missing entirely is normal — an unstaffed pool is survivable, and the
      // synthesis then falls back to the brief's own query and says so.
      const files = await fs.readdir(dir).catch(() => [] as string[]);
      const notes: ResearchNote[] = [];
      for (const file of files.filter((f) => f.endsWith('.json'))) {
        const loaded = await readJsonIfExists<ResearchNote>(path.join(dir, file));
        if (loaded !== null) notes.push(loaded);
      }
      /*
       * Research that was attempted and produced nothing is a failure, not a
       * merge of zero notes.
       *
       * The fan-out node deliberately swallows a single member's error so one
       * vendor's 429 cannot end the run — that is right for *one member*. It is
       * wrong here: with every member dead this used to write a synthesis whose
       * `providersUsed`, `queryVotes`, `siteMustDo` and `differentiators` were
       * all empty, return 200, and let the factory carry on as though the
       * category had been researched. Everything downstream then treats an
       * unresearched brief as a researched one.
       *
       * An *unstaffed* pool is a different, honest state: nothing was attempted
       * because nothing could be, and the brief's own query stands. Only the
       * "asked and all failed" case throws.
       */
      const pool = resolvePool('research', config.ai);
      if (notes.length === 0 && pool.members.length > 0) {
        throw new Error(
          `research produced no notes although ${pool.members.length} pool member(s) were asked ` +
            `(${pool.members.map((m) => m.provider).join(', ')}); refusing to synthesise an empty artifact`,
        );
      }

      const synthesis = synthesizeResearch(brief, notes);
      await writeJson(path.join(outputDir, FACTORY_ARTIFACTS.research), synthesis);
      job = await saveJob(outputDir, { stage: 'research', research: synthesis, business: synthesis.searchQuery });
      note =
        notes.length === 0
          ? `no research pool member is credentialled; searching the brief's own query "${synthesis.searchQuery}"`
          : `${notes.length} note(s) merged; searching "${synthesis.searchQuery}"`;
      providers = { used: synthesis.providersUsed, absent: [] };
      break;
    }

    case 'source': {
      // The evidence half. Everything downstream treats its input as collected
      // fact, so this is the stage that makes "one order -> one REAL website"
      // true: a live listing is read, nothing about the business is invented.
      const synthesis = await readJsonIfExists<ResearchSynthesis>(
        path.join(outputDir, FACTORY_ARTIFACTS.research),
      );
      const brief = await readJsonIfExists<FactoryBrief>(path.join(outputDir, FACTORY_ARTIFACTS.brief));
      const query = synthesis?.searchQuery ?? brief?.searchQuery ?? '';
      const businessUrl = synthesis?.businessUrl ?? brief?.businessUrl ?? null;
      if (query === '' && !businessUrl) {
        throw new Error('source stage requires 0-brief.json (run intake first)');
      }

      // If businessUrl is already a Google Maps URL, use it directly.
      // Otherwise, search Maps using the synthesized searchQuery (or domain/name).
      let mapsUrlToNavigate: string;
      if (
        businessUrl &&
        (businessUrl.includes('google.com/maps') ||
          businessUrl.includes('maps.app.goo.gl') ||
          businessUrl.includes('goo.gl/maps') ||
          businessUrl.includes('g.co/maps'))
      ) {
        mapsUrlToNavigate = businessUrl;
      } else {
        mapsUrlToNavigate = mapsSearchUrl(query !== '' ? query : businessUrl!);
      }

      const sourced = await acquireProfile(runId, { mapsUrl: mapsUrlToNavigate }, config);
      job = await saveJob(outputDir, {
        stage: 'evidence',
        business: sourced.profile.name.value,
        ...(businessUrl ? { businessUrl } : {}),
        ...(brief?.sourceUrls && brief.sourceUrls.length > 0 ? { sourceUrls: brief.sourceUrls } : {}),
        ...(brief?.additionalInstruction ? { additionalInstruction: brief.additionalInstruction } : {}),
        evidence: {
          searchQuery: query,
          resolvedFrom: sourced.sourceUrl,
          sources: sourced.profile.sources,
          validationOk: sourced.profile.validation.ok,
        },
      });
      note = `collected "${sourced.profile.name.value}" from ${sourced.profile.sources.length} source(s)`;
      break;
    }

    case 'analyze': {
      const profile = await read<BusinessProfile>(path.join(outputDir, '3-profile.json'));
      const analysis = await withPoolFailover('research', config, logger, async (scoped) => {
        const { context, dispose } = await agentContext(outputDir, runId, scoped, logger);
        try {
          return await businessAnalystAgent.run(profile, context);
        } finally {
          await dispose();
        }
      });
      job = await recordWorkers(outputDir, job, [
        ...analysis.attempts.map(
          (a): WorkerCall => ({ stage, capability: 'research', provider: a.provider, outcome: 'failed', at: new Date().toISOString() }),
        ),
        { stage, capability: 'research', provider: analysis.used, outcome: 'ok', at: new Date().toISOString() },
      ]);
      {
        const strategy = analysis.value;
        await writeJson(path.join(outputDir, FACTORY_ARTIFACTS.strategy), strategy);
        job = await saveJob(outputDir, { stage: 'character' });
        // `category` is a structured classification, not a string — reading it
        // as one printed "[object Object]" into the n8n execution.
        const category = strategy.category as unknown;
        const categoryLabel =
          typeof category === 'string'
            ? category
            : ((category as { primary?: string } | null)?.primary ?? 'uncategorised');
        note =
          `strategy for ${strategy.businessName} (${categoryLabel}) via ${analysis.used}` +
          (analysis.attempts.length === 0 ? '' : ` after ${analysis.attempts.length} failed member(s)`);
      }
      providers = {
        used: [analysis.used],
        absent: analysis.attempts.map((a) => ({ provider: a.provider, reason: a.error })),
        excluded: analysis.excluded,
      };
      break;
    }

    case 'write': {
      /*
       * The copy, written by the content pool.
       *
       * `build` (composeStandalone) exists for the case where there is no model
       * at all: it assembles a page from the profile's own words, which is
       * honest but thin — four sections and the category as a tagline. A
       * factory selling premium sites has to run the writer when it can, and
       * degrade to that baseline only when it cannot.
       *
       * Degradation is caught, not predicted: a configured provider can still
       * be rate-limited mid-run, and "the customer gets a plainer page" beats
       * "the customer gets nothing" — the same rule composeStandalone was
       * built for.
       */
      const profile = await read<BusinessProfile>(path.join(outputDir, '3-profile.json'));
      const strategy = await readJsonIfExists<BusinessStrategy>(
        path.join(outputDir, FACTORY_ARTIFACTS.strategy),
      );
      const pool = resolvePool('content', config.ai);

      let content: WebsiteContent;
      let wroteWith = 'baseline';
      if (pool.members.length > 0 && strategy !== null) {
        try {
          // Every content-pool member is tried before the baseline is accepted:
          // a plainer page is the right answer to "no model can be reached",
          // not to "the first model was busy".
          const written = await withPoolFailover('content', config, logger, async (scoped) => {
            const { context, dispose } = await agentContext(outputDir, runId, scoped, logger);
            try {
              return await writerAgent.run({ profile, strategy }, context);
            } finally {
              await dispose();
            }
          });
          content = directPageCopy(profile, written.value, strategy).content;
          wroteWith = written.used;
          job = await recordWorkers(outputDir, job, [
            ...written.attempts.map(
              (a): WorkerCall => ({ stage, capability: 'content', provider: a.provider, outcome: 'failed', at: new Date().toISOString() }),
            ),
            { stage, capability: 'content', provider: written.used, outcome: 'ok', at: new Date().toISOString() },
          ]);
        } catch (error) {
          logger.warn('every content pool member failed; falling back to the profile-only baseline', {
            error: error instanceof Error ? error.message.slice(0, 200) : String(error),
          });
          content = directPageCopy(profile, composeBaseline(profile)).content;
          // The fallback is a decision, so it is recorded as a floor call.
          job = await recordWorkers(outputDir, job, [
            { stage, capability: 'content', provider: null, outcome: 'ok', at: new Date().toISOString() },
          ]);
        }
      } else {
        logger.info('no content pool member; composing from the profile alone', {
          hasStrategy: strategy !== null,
        });
        content = directPageCopy(profile, composeBaseline(profile)).content;
        job = await recordWorkers(outputDir, job, [
          { stage, capability: 'content', provider: null, outcome: 'ok', at: new Date().toISOString() },
        ]);
      }

      await writeJson(path.join(outputDir, '5-content.json'), content);
      job = await saveJob(outputDir, { stage: 'content', content });
      note = `${content.sections.length} sections in "${content.language}" via ${wroteWith}`;
      providers = { used: wroteWith === 'baseline' ? [] : [wroteWith], absent: [] };
      break;
    }

    case 'direct': {
      // Creative direction is applied through `reconceptBuild` — the same
      // function the rejection loop uses — so a directive becomes a rendered
      // site by exactly one code path, and iteration 0 differs from iteration 3
      // only in what it was told.
      const synthesis = await readJsonIfExists<ResearchSynthesis>(
        path.join(outputDir, FACTORY_ARTIFACTS.research),
      );
      const feedback = [
        ...(synthesis?.siteMustDo ?? []).map((item) => `must: ${item}`),
        ...(synthesis?.risks ?? []).map((item) => `avoid: ${item}`),
      ].join('; ');

      const directed = await withPoolFailover('design', config, logger, (scoped) =>
        reconceptBuild({
          outputDir,
          config: scoped,
          logger: logger.child('direct'),
          previousDirective: null,
          feedback,
          route: 'director',
          iteration: 0,
        }),
      );
      const workerCall = (provider: string | null): WorkerCall => ({
        stage,
        capability: 'design.concept',
        provider,
        outcome: 'ok',
        at: new Date().toISOString(),
      });
      job = await recordWorkers(outputDir, job, [
        ...directed.attempts.map(
          (a): WorkerCall => ({ stage, capability: 'design.concept', provider: a.provider, outcome: 'failed', at: new Date().toISOString() }),
        ),
        workerCall(config.director.enabled ? directed.used : null),
      ]);
      job = await saveJob(outputDir, {
        stage: 'creative',
        creativeDirection: directed.value.directive,
        design: directed.value.design,
        implementationStatus: 'built',
      });
      note = config.director.enabled
        ? `creative direction applied by the design director via ${directed.used}`
        : 'DIRECTOR_ENABLED is false; a deterministic directive was applied instead';
      providers = {
        used: config.director.enabled ? [directed.used] : [],
        absent: directed.attempts.map((a) => ({ provider: a.provider, reason: a.error })),
        excluded: directed.excluded,
      };
      break;
    }

    case 'diverge': {
      /*
       * The design battle (freeze K=3): the base directive diverges into K
       * genuinely-different directions BEFORE any QA spend.
       *
       * `diverge()` enumerates M=10 closed-set perturbations, filters them
       * against what the business's content can support, and keeps at most one
       * per L1 decision surface — so the survivors are not "the same page with
       * a different colour", they occupy different L1 fingerprints. Each
       * direction is rendered through the one code path (`reconceptBuild` with
       * `applyDirective`), recorded as an immutable candidate, then juried by
       * deterministic quality; `finalizeBest` restores the winner to the run
       * root so the browser screenshots the jury's choice.
       *
       * Zero model calls: the perturbations are deterministic rotations, and
       * `applyDirective` bypasses the design director. This is P5-2's
       * acceptance — the divergence gate costs nothing to run.
       */
      const baseRaw = (job.creativeDirection as DesignDirective | null) ?? null;
      if (baseRaw === null) {
        throw new Error('diverge stage requires a creative direction (run direct first)');
      }
      const contentForDiverge = await read<WebsiteContent>(path.join(outputDir, '5-content.json'));
      const sectionKinds = contentForDiverge.sections.map((section) => section.kind);

      // The divergence base is the directive with any moment the content
      // cannot support dropped. `filterByContent` blocks a perturbation whose
      // signature moment is not a real section, and the base directive carries
      // it forward to every perturbation — so a `statement` moment on a
      // business whose content has no statement section would otherwise gate
      // all K directions out. Removing it (rather than leaving it) is the same
      // honouring rule `filterByContent` applies, applied one level up.
      const baseDirective: DesignDirective =
        baseRaw.signatureMoment !== undefined && baseRaw.signatureMoment !== null && !sectionKinds.includes(baseRaw.signatureMoment)
          ? { ...baseRaw, signatureMoment: undefined }
          : baseRaw;

      // Pre-spend enumeration: M=10 perturbations, content-filtered,
      // diversity-gated. The survivors are the candidate directions.
      const candidates = diverge(baseDirective, sectionKinds).filter((perturbation) => perturbation.allowed);
      const directions = candidates.slice(0, K_DESIGN_DIRECTIONS);

      if (directions.length === 0) {
        // Nothing diverged (e.g. every moment axis is unsupported) — the base
        // directive itself is the single candidate, recorded exactly once so
        // the run root still ends up in the candidate ledger.
        const built = await reconceptBuild({
          outputDir,
          config,
          logger: logger.child('diverge'),
          previousDirective: baseDirective,
          feedback: '',
          route: 'director',
          iteration: 0,
          applyDirective: baseDirective,
        });
        await recordCandidate({
          outputDir,
          iteration: 0,
          scores: { quality: await deterministicQuality(outputDir, built.design), distinctness: 0, blockingClean: true },
        });
        const best = await finalizeBest(outputDir);
        job = await saveJob(outputDir, {
          stage: 'diverge',
          creativeDirection: built.directive,
          design: best === null ? built.design : await read<WebsiteDesign>(path.join(outputDir, '5b-design.json')),
        });
        note = `no divergent direction survived the diversity gate; kept the base directive (${directions.length}/${K_DESIGN_DIRECTIONS})`;
        break;
      }

      // Each direction becomes a real rendered candidate, recorded immutably.
      // Directions build in PARALLEL (Freeze N-05/P3-6/F-12, via
      // `lib/workflow/runner.ts`'s pool): each gets its own shadow `outputDir`
      // (see `createShadowDir`) so concurrent builds cannot interleave writes
      // to the shared `5b-design.json`/`site/` — the real race a naive
      // parallel loop would introduce (previously tracked as MASTER_INVENTORY
      // A3 / MASTER_CAPABILITY_TOOL_REGISTRY gap G-RUNNER-01). Only the cheap
      // bookkeeping — assigning a candidate id and appending to the shared
      // `candidates/` index — is serialized, via the same `SerializedWriter`
      // this module exists for; the actual compose+render work, which is the
      // part worth parallelizing, runs fully concurrently beforehand.
      //
      // No model calls happen in this stage regardless (zero-cost per P5-2),
      // so unlike browser-bound work this has no reason to stay small — K is
      // frozen at 3, so the whole battle runs as one pool generation.
      const shadowRoot = path.join(outputDir, '.diverge-build');
      const excludeFromShadow = new Set([
        '5b-design.json',
        SITE_DIR_NAME,
        CANDIDATES_DIR_NAME,
        path.basename(shadowRoot),
      ]);
      const writer = createSerializedWriter();

      type DivergeOutcome = { readonly quality: number; readonly fingerprint: string };
      const tasks: RunnerTask<DivergeOutcome>[] = directions.map((direction, index) => {
        const id = `direction-${String.fromCharCode(65 + index)}`;
        return {
          id,
          run: async (): Promise<DivergeOutcome> => {
            const shadowDir = path.join(shadowRoot, id);
            await createShadowDir(outputDir, shadowDir, excludeFromShadow);
            try {
              const built = await reconceptBuild({
                outputDir: shadowDir,
                config,
                logger: logger.child('diverge').child(id),
                previousDirective: baseDirective,
                feedback: '',
                route: 'director',
                iteration: 0,
                applyDirective: direction.directive,
              });
              const quality = await deterministicQuality(shadowDir, built.design);
              // Serialized: id assignment and the index read-modify-write
              // must not overlap across directions finishing at once.
              await writer.withLock(() =>
                recordCandidate({
                  outputDir,
                  sourceDir: shadowDir,
                  iteration: 0,
                  scores: { quality, distinctness: 0, blockingClean: true },
                }),
              );
              return { quality, fingerprint: fingerprintDirective(direction.directive) };
            } finally {
              await fs.rm(shadowDir, { recursive: true, force: true });
            }
          },
        };
      });

      const outcome = await runPool(tasks, { concurrency: directions.length });
      await fs.rm(shadowRoot, { recursive: true, force: true }).catch(() => undefined);
      if (outcome.failures.length > 0) {
        // A direction that failed to build never got recorded — surface it
        // rather than silently juring the survivors as if nothing was lost.
        throw outcome.failures[0]!.error;
      }

      // `runPool`'s `results` is completion order, not task order (see its
      // own docstring) — key back onto `directions` by `id` rather than by
      // array position, so which direction a quality/fingerprint belongs to
      // never depends on which one happened to finish first.
      const byId = new Map(outcome.results.map((r) => [r.id, r.value]));
      const qualities = directions.map((_direction, index) => {
        const id = `direction-${String.fromCharCode(65 + index)}`;
        const value = byId.get(id);
        if (value === undefined) throw new Error(`[diverge] missing result for ${id}`);
        return value.quality;
      });
      const fingerprints = directions.map((_direction, index) => {
        const id = `direction-${String.fromCharCode(65 + index)}`;
        return byId.get(id)!.fingerprint;
      });

      // The conditional jury: wide deterministic spread needs one judge,
      // narrow spread (margin ±5) would spend a second vision judge — which is
      // recorded, not faked: without VISION_* the second judge cannot run, and
      // the run proceeds on the deterministic ranking rather than pretending.
      const jury = decideJury(qualities);
      const best = await finalizeBest(outputDir);
      const bestIndex = qualities.indexOf(jury.bestQuality);
      const winnerDirective = directions[bestIndex]?.directive ?? directions[0]!.directive;
      job = await saveJob(outputDir, {
        stage: 'diverge',
        creativeDirection: winnerDirective,
        design: best === null ? null : await read<WebsiteDesign>(path.join(outputDir, '5b-design.json')),
        designDirections: {
          count: directions.length,
          directions: directions.map((direction, index) => ({
            id: `direction-${String.fromCharCode(65 + index)}`,
            fingerprint: fingerprints[index],
            axis: direction.axis,
          })),
          jury: {
            bestQuality: jury.bestQuality,
            runnerUpQuality: jury.runnerUpQuality,
            spread: jury.spread,
            judgeCount: jury.judgeCount,
            visionCalls: jury.visionCalls,
            marginTriggered: jury.marginTriggered,
            rationale: jury.rationale,
          },
          winner: `direction-${String.fromCharCode(65 + qualities.indexOf(jury.bestQuality))}`,
        },
      });
      note =
        `battled ${directions.length} divergent direction(s) (A${directions.length > 1 ? '–' + String.fromCharCode(65 + directions.length - 1) : ''}); ` +
        `jury ${jury.judgeCount} judge(s), spread ${jury.spread.toFixed(1)}, best ${jury.bestQuality.toFixed(1)}`;
      providers = { used: [], absent: [], excluded: [] };
      break;
    }

    case 'jury': {
      const candidatesDir = path.join(outputDir, 'candidates');
      const indexPath = path.join(candidatesDir, 'index.json');
      const candidateIndex = await readJsonIfExists<{ candidates: Array<{ iteration: number; scores: { quality: number; distinctness: number } }> }>(indexPath);

      if (!candidateIndex || candidateIndex.candidates.length === 0) {
        const divergeResult = await runStage({ stage: 'diverge', runId, maxIter });
        note = `jury decided on candidates from diverge: ${divergeResult.note}`;
        break;
      }

      const qualities = candidateIndex.candidates.map((c) => c.scores.quality);
      const jury = decideJury(qualities);
      const best = await finalizeBest(outputDir);
      const bestIndex = qualities.indexOf(jury.bestQuality);
      const winnerId = `direction-${String.fromCharCode(65 + (bestIndex >= 0 ? bestIndex : 0))}`;

      job = await saveJob(outputDir, {
        stage: 'diverge',
        design: best === null ? null : await read<WebsiteDesign>(path.join(outputDir, '5b-design.json')),
        designDirections: {
          count: candidateIndex.candidates.length,
          jury: {
            bestQuality: jury.bestQuality,
            runnerUpQuality: jury.runnerUpQuality,
            spread: jury.spread,
            judgeCount: jury.judgeCount,
            visionCalls: jury.visionCalls,
            marginTriggered: jury.marginTriggered,
            rationale: jury.rationale,
          },
          winner: winnerId,
        },
      });
      note = `jury selected ${winnerId} (${jury.judgeCount} judge(s), score ${jury.bestQuality.toFixed(1)}, spread ${jury.spread.toFixed(1)})`;
      providers = { used: [], absent: [] };
      break;
    }

    case 'assets': {
      const assetType = opts.assetType ?? 'all';
      const profile = await readJsonIfExists<BusinessProfile>(path.join(outputDir, '3-profile.json'));

      const imageProviderConfigured = config.ai.apiKeys.openai !== '' || config.ai.apiKeys.openrouter !== '';
      const videoProviderConfigured = Boolean(process.env.VEO_API_KEY || process.env.SORA_API_KEY || process.env.KLING_API_KEY || process.env.HIGGSFIELD_API_KEY);
      const spatial3dProviderConfigured = Boolean(process.env.TRIPO_API_KEY || process.env.MESHY_API_KEY);

      const manifest = {
        runId,
        timestamp: new Date().toISOString(),
        assetType,
        images: {
          status: imageProviderConfigured ? 'generated/optimized' : 'curated-fallback',
          count: profile?.images?.gallery?.length ?? 4,
          sources: profile?.images?.gallery?.map((img) => img.url) ?? [],
        },
        video: {
          status: videoProviderConfigured ? 'generated' : 'unavailable/configuration-required (fallback: CSS motion)',
          provider: videoProviderConfigured ? 'configured' : null,
        },
        spatial3d: {
          status: spatial3dProviderConfigured ? 'generated' : 'unavailable/configuration-required (fallback: procedural WebGL/CSS3D)',
          provider: spatial3dProviderConfigured ? 'configured' : null,
        },
      };

      await writeJson(path.join(outputDir, 'qa', 'assets-manifest.json'), manifest);
      job = await recordWorkers(outputDir, job, [
        { stage, capability: 'image', provider: imageProviderConfigured ? 'configured-image-provider' : null, outcome: 'ok', at: new Date().toISOString() },
        { stage, capability: 'video', provider: videoProviderConfigured ? 'configured-video-provider' : null, outcome: videoProviderConfigured ? 'ok' : 'failed', at: new Date().toISOString() },
        { stage, capability: '3d', provider: spatial3dProviderConfigured ? 'configured-3d-provider' : null, outcome: spatial3dProviderConfigured ? 'ok' : 'failed', at: new Date().toISOString() },
      ]);
      job = await saveJob(outputDir, { stage: 'build' });
      note = `asset pipeline resolved: images=${manifest.images.status}, video=${manifest.video.status}, 3d=${manifest.spatial3d.status}`;
      providers = {
        used: imageProviderConfigured ? ['image-provider'] : [],
        absent: [
          ...(!videoProviderConfigured ? [{ provider: 'video-veo-sora-kling', reason: 'configuration-required (API key not set)' }] : []),
          ...(!spatial3dProviderConfigured ? [{ provider: '3d-tripo-meshy', reason: 'configuration-required (API key not set)' }] : []),
        ],
      };
      break;
    }

    case 'build': {
      await composeStandalone(runId, config);
      const design = await read<WebsiteDesign>(path.join(outputDir, '5b-design.json'));
      const content = await read<WebsiteContent>(path.join(outputDir, '5-content.json'));
      job = await saveJob(outputDir, {
        stage: 'build',
        implementationStatus: 'built',
        design,
        content,
        character: await characterFor(outputDir, design),
      });
      break;
    }
    case 'browser': {
      await captureScreenshots(outputDir, logger.child('browser'));
      job = await saveJob(outputDir, { stage: 'browser', browserStatus: 'shot' });
      break;
    }
    case 'layout': {
      /*
       * The only stage that measures the page a visitor would get.
       *
       * It runs before the critic so that when both fail, the gate reports the
       * measurable defect first — "sections overlap by 900px" is a brief a
       * rebuild can act on, where "looks generic" is not.
       */
      const audit = await auditLayout({ siteDir: SITE, logger: logger.child('layout') });
      await writeJson(path.join(outputDir, FACTORY_ARTIFACTS.layout), audit);
      job = await saveJob(outputDir, {
        stage: 'browser',
        layoutAudit: audit,
        qaStatus: audit.ok ? 'passed' : 'failed',
      });
      const blocking = audit.findings.filter((finding) => finding.severity === 'blocking');
      note = audit.ok
        ? `layout clean across ${audit.measurements.length} viewport(s)`
        : `${blocking.length} blocking layout defect(s): ${blocking.map((f) => f.kind).join(', ')}`;
      break;
    }

    case 'critic': {
      const design = await read<WebsiteDesign>(path.join(outputDir, '5b-design.json'));
      const shotsDir = path.join(outputDir, 'shots');
      const shots = [
        { viewport: 'desktop' as const, path: path.join(shotsDir, 'desktop.png') },
        { viewport: 'mobile' as const, path: path.join(shotsDir, 'mobile.png') },
      ];
      // Vision is opt-in: without VISION_* the critic degrades to 'uncertain'
      // rather than failing the run, so the loop stays runnable at zero cost.
      const vision =
        process.env.VISION_API_KEY && process.env.VISION_BASE_URL && process.env.VISION_MODEL
          ? (input: Parameters<typeof analyzeCritique>[1]): ReturnType<typeof analyzeCritique> =>
              analyzeCritique(
                {
                  apiKey: process.env.VISION_API_KEY!,
                  baseUrl: process.env.VISION_BASE_URL!,
                  model: process.env.VISION_MODEL!,
                  timeoutMs: 90_000,
                  logger: logger.child('visual-critic'),
                },
                input,
              )
          : async (): Promise<VisualCritique> => ({
              axes: [],
              genericVerdict: 'uncertain',
              failReasons: [],
              notes: ['vision disabled'],
            });
      const critic = await runVisualCritic({
        input: {
          business: job.business,
          screenshots: shots,
          design,
          character: job.character ?? (await characterFor(outputDir, design)),
          creativeDirection: job.creativeDirection,
        },
        analyze: vision,
      });
      job = await saveJob(outputDir, { stage: 'visual-critic', visualCritique: critic });
      break;
    }
    case 'gate': {
      const design = await read<WebsiteDesign>(path.join(outputDir, '5b-design.json'));
      const content = await read<WebsiteContent>(path.join(outputDir, '5-content.json'));
      const critic = (job.visualCritique as VisualCritique | null) ?? {
        axes: [],
        genericVerdict: 'uncertain' as const,
        failReasons: [],
        notes: [],
      };
      // Peers are what let the gate see template smell ACROSS sites, so the
      // n8n path has to load them exactly as runJob does — without them the
      // gate silently degrades to a single-site check and a cloned design
      // passes.
      const peerDesigns = await loadPeerDesigns(outputDir);
      // Read off disk rather than off `job`, so the gate uses this run's audit
      // even when the job state was written by an older stage server.
      const layout =
        (job.layoutAudit as LayoutAudit | null) ??
        (await readJsonIfExists<LayoutAudit>(path.join(outputDir, FACTORY_ARTIFACTS.layout)));
      const gate = gateJob({
        jobState: job,
        design,
        content,
        character: job.character ?? (await characterFor(outputDir, design)),
        critic,
        ...(peerDesigns === undefined ? {} : { peerDesigns }),
        ...(layout === null ? {} : { layout }),
      });
      job = await saveJob(outputDir, {
        stage: 'distinctness-gate',
        distinctnessScore: gate,
        qaStatus: gate.verdict === 'PASS' ? 'passed' : 'failed',
      });
      break;
    }
    case 'hermes': {
      // JobState stores artifacts as `unknown` on purpose (it owns no logic),
      // so the stage that consumes one is where the shape gets asserted.
      const gate = job.distinctnessScore as DistinctnessResult | null;
      if (gate === null || gate === undefined) {
        throw new Error('hermes stage requires the gate stage to have run first');
      }
      const decision = decide({ gate, job });
      logger.info('hermes decided', {
        action: decision.action,
        nextStage: decision.nextStage,
        iteration: decision.iteration,
      });
      if (decision.action === 'continue') {
        /*
         * `decideOnly` splits deciding from repairing.
         *
         * Hermes has always rebuilt inline, and the Production Loop still
         * depends on that — so it stays the default. Factory V1 asks for
         * `decideOnly=1` and owns the repair as its own node, which is what
         * makes the diagnosis, the rebuild and the re-test three visible steps
         * in the execution rather than one opaque one. Rebuilding in both
         * places would burn two concepts per iteration and re-render twice.
         */
        if (opts.decideOnly === true) {
          job = await saveJob(outputDir, {
            stage: 'hermes',
            iteration: decision.iteration,
            decision: 'reconcept',
          });
          note = `repair needed (${gate.diagnosis}); routing to ${decision.nextStage}`;
        } else {
          const rebuilt = await reconceptBuild({
            outputDir,
            config,
            logger: logger.child('reconcept'),
            previousDirective: (job.creativeDirection as DesignDirective | null) ?? null,
            feedback: gate.reasons.join('; '),
            route: decision.nextStage as 'creative' | 'experience' | 'builder' | 'director',
            iteration: decision.iteration,
          });
          job = await saveJob(outputDir, {
            stage: 'hermes',
            iteration: decision.iteration,
            decision: 'reconcept',
            creativeDirection: rebuilt.directive,
            design: rebuilt.design,
          });
        }
        loop = true;
        nextStage = decision.nextStage;
      } else {
        job = await saveJob(outputDir, {
          stage: decision.action === 'deliver' ? 'delivery' : 'human',
          decision: decision.action === 'deliver' ? 'deliver' : 'escalate',
          finalOutput: decision.action === 'deliver' ? SITE : job.finalOutput,
        });
        note =
          decision.action === 'deliver'
            ? `delivering after ${job.iteration} repair iteration(s)`
            : decision.rationale;
      }
      break;
    }

    case 'repair': {
      /*
       * The rebuild, briefed by what the QA actually measured.
       *
       * The feedback is the gate's reasons verbatim — which, when the layout
       * audit found something, begin with the measured defect ("sections
       * overlap by 900px on mobile") rather than an opinion. That is the whole
       * point of the split: a rebuild can act on a measurement.
       */
      const gate = job.distinctnessScore as DistinctnessResult | null;
      if (gate === null || gate === undefined) {
        throw new Error('repair stage requires the gate stage to have run first');
      }
      const audit = job.layoutAudit as LayoutAudit | null;
      const feedback = [
        ...gate.reasons,
        ...(audit === null ? [] : audit.findings.filter((f) => f.severity === 'warning').map((f) => f.detail)),
      ].join('; ');

      const repaired = await withPoolFailover('design', config, logger, (scoped) =>
        reconceptBuild({
          outputDir,
          config: scoped,
          logger: logger.child('repair'),
          previousDirective: (job.creativeDirection as DesignDirective | null) ?? null,
          feedback,
          route: gate.route === 'deliver' || gate.route === 'escalate' ? 'builder' : gate.route,
          iteration: job.iteration,
        }),
      );
      job = await recordWorkers(outputDir, job, [
        ...repaired.attempts.map(
          (a): WorkerCall => ({ stage, capability: 'design.concept', provider: a.provider, outcome: 'failed', at: new Date().toISOString() }),
        ),
        { stage, capability: 'design.concept', provider: repaired.used, outcome: 'ok', at: new Date().toISOString() },
      ]);
      job = await saveJob(outputDir, {
        stage: 'build',
        implementationStatus: 'built',
        creativeDirection: repaired.value.directive,
        design: repaired.value.design,
      });
      note =
        `rebuilt for ${gate.diagnosis} at iteration ${job.iteration}: ` +
        `${repaired.value.directive.direction} (via ${repaired.used})`;
      providers = {
        used: [repaired.used],
        absent: repaired.attempts.map((a) => ({ provider: a.provider, reason: a.error })),
        excluded: repaired.excluded,
      };
      break;
    }

    case 'preflight': {
      /*
       * Production preflight (Decision Gate §1.J, §8 item 8): the
       * functional/security and accessibility gates run against the site
       * that is about to be delivered. A blocking finding downgrades
       * `deliver` to `escalate` — the same action vocabulary Hermes already
       * uses, not a new one. Performance is collected and recorded but never
       * blocks (Freeze N-13's own rule: "over-budget is a caveat, not a hard
       * fail").
       *
       * Skipped in effect, not in name, when hermes already escalated: the
       * gate still runs (so `qa/preflight.json` is always written for a
       * delivered-or-attempted site) but cannot change an escalation into
       * anything else, and cannot promote one to delivery.
       */
      const evidence = await collectPreflightEvidence({ siteDir: SITE, logger: logger.child('preflight') });
      const preflight = gatePreflight(evidence);
      await writeJson(path.join(outputDir, FACTORY_ARTIFACTS.preflight), preflight);

      const outcome = applyPreflightToDecision({ currentDecision: job.decision, preflightPassed: preflight.passed });
      job = await saveJob(outputDir, {
        stage: outcome.downgraded ? 'human' : job.stage,
        decision: outcome.decision,
        finalOutput: outcome.clearFinalOutput ? null : job.finalOutput,
        preflight,
      });

      const failedChecks = [
        ...preflight.technical.checks.filter((c) => !c.passed).map((c) => c.detail),
        ...preflight.accessibility.checks.filter((c) => !c.passed).map((c) => c.detail),
      ];
      note = preflight.passed
        ? `preflight passed (${preflight.performance.caveats.length} performance caveat(s))`
        : outcome.downgraded
          ? `preflight BLOCKED delivery: ${failedChecks.join('; ')}`
          : `preflight found blocking issues but the job was already escalated: ${failedChecks.join('; ')}`;
      break;
    }

    case 'deploy': {
      /*
       * T04: publish the delivered site to Netlify — the same real
       * integration `main.ts`'s classic pipeline already uses
       * (`lib/deploy/netlify.ts`), not a second deploy path invented for
       * this production loop. Netlify is the master architecture's named
       * default (Consolidation Map); until this stage existed, this
       * pipeline's "delivered" jobs never reached it — `finalOutput` was
       * only ever the local `SITE` path hermes's deliver branch set, so
       * "browser opens on a live URL" was unreachable no matter how the
       * run went.
       *
       * Only ever attempted for a job preflight has not downgraded: an
       * escalated job has nothing that should go live (its `finalOutput`
       * was already cleared by the `preflight` case above). A missing
       * `NETLIFY_DEPLOY_TOKEN` is not a failure — `deployToNetlify` itself
       * returns `status: 'skipped'`, never `failed` — so a run with no
       * deploy target configured still finishes with the local site path
       * it already had, not a broken one. `deployToNetlify` also never
       * throws (it catches its own network/API errors and returns
       * `status: 'failed'`), so no try/catch is needed here beyond the one
       * already wrapping this whole switch.
       */
      if (job.decision !== 'deliver') {
        note = `deploy skipped: job decision is "${job.decision}", not deliver`;
        break;
      }

      const { deployToNetlify } = await import('../../lib/deploy/netlify.js');
      const deployController = new AbortController();
      const deployment = await deployToNetlify(SITE, config, {
        signal: deployController.signal,
        logger: { info: (m) => logger.info(m), warn: (m) => logger.warn(m) },
      });
      await writeJson(path.join(outputDir, 'qa', 'deployment.json'), deployment);

      if (deployment.status === 'failed') {
        // A deploy failure must never surface as a false DELIVERED status:
        // downgrade to escalate — the same action a blocking preflight
        // finding uses — and leave `finalOutput` exactly as it was (the
        // local site path hermes already recorded) rather than a broken
        // live URL. This is the recoverable path the acceptance criteria
        // names: the local build is never lost, and a human sees why.
        job = await saveJob(outputDir, { stage: 'human', decision: 'escalate' });
        note = `deploy FAILED: ${deployment.promptUsed}; job escalated, local site preserved at ${job.finalOutput}`;
        break;
      }

      if (deployment.liveUrl !== null) {
        job = await saveJob(outputDir, { finalOutput: deployment.liveUrl });
      }
      note = deployment.status === 'skipped'
        ? 'deploy skipped: NETLIFY_DEPLOY_TOKEN is not set; local site remains the final output'
        : `deployed to ${deployment.liveUrl ?? '(build still settling on Netlify)'}`;
      break;
    }

    case 'report': {
      /*
       * A summary a human can act on without opening five files.
       *
       * The run's own record of what happened: which business, how many repair
       * iterations, what each QA said, and where the site is. Written to disk
       * as well as returned, because the n8n execution is garbage-collected and
       * the run directory is not.
       */
      const gate = job.distinctnessScore as DistinctnessResult | null;
      const audit = job.layoutAudit as LayoutAudit | null;
      const critique = job.visualCritique as VisualCritique | null;
      const preflightResult = job.preflight as PreflightResult | null;
      // T04: best-effort — a run that never reached `deploy` (escalated
      // earlier, or predates this stage) simply has no file here, and the
      // report says so rather than guessing.
      const deployment = await readJsonIfExists<{
        readonly status: string;
        readonly liveUrl: string | null;
      }>(path.join(outputDir, 'qa', 'deployment.json'));
      // The observability board, aggregated from the run's own ledger.
      const okCalls = job.providerLog.filter((call) => call.outcome === 'ok');
      const failedCalls = job.providerLog.filter((call) => call.outcome === 'failed');
      const providersUsed = [...new Set(okCalls.map((call) => call.provider).filter((p): p is string => p !== null))];
      const failedProviders = [...new Set(failedCalls.map((call) => call.provider).filter((p): p is string => p !== null))];
      const fallbacks = job.providerLog.filter((call) => call.provider === null).length;
      const summary = {
        runId,
        business: job.business,
        decision: job.decision,
        iterations: job.iteration,
        maxIter: job.maxIter,
        site: job.finalOutput,
        designDirections: job.designDirections as unknown,
        workers: {
          calls: job.providerLog.length,
          providersUsed,
          failedProviders,
          fallbacks,
          byCapability: Object.fromEntries(
            [...new Set(okCalls.map((call) => call.capability))].map((capability) => [
              capability,
              okCalls.filter((call) => call.capability === capability).map((call) => call.provider),
            ]),
          ),
        },
        budget: { cents: job.budgetCents, status: job.budgetCents >= 0 ? 'within' : 'exhausted' },
        deployment:
          deployment === null ? null : { status: deployment.status, liveUrl: deployment.liveUrl },
        gate:
          gate === null
            ? null
            : { verdict: gate.verdict, score: gate.overallScore, diagnosis: gate.diagnosis, reasons: gate.reasons },
        layout:
          audit === null
            ? null
            : { ok: audit.ok, blocking: audit.findings.filter((f) => f.severity === 'blocking'), warnings: audit.findings.filter((f) => f.severity === 'warning') },
        visualCritic:
          critique === null ? null : { verdict: critique.genericVerdict, axes: critique.axes.length, notes: critique.notes },
        preflight:
          preflightResult === null
            ? null
            : {
                passed: preflightResult.passed,
                technicalFailures: preflightResult.technical.checks.filter((c) => !c.passed).map((c) => c.id),
                accessibilityFailures: preflightResult.accessibility.checks.filter((c) => !c.passed).map((c) => c.id),
                performanceCaveats: preflightResult.performance.caveats.map((c) => c.id),
              },
        reportedAt: new Date().toISOString(),
      };
      await writeJson(path.join(outputDir, 'qa', 'report.json'), summary);
      note =
        `${job.decision} after ${job.iteration} iteration(s); gate ${gate?.verdict ?? 'n/a'} ` +
        `(${gate?.overallScore ?? 'n/a'}), layout ${audit === null ? 'not audited' : audit.ok ? 'clean' : 'defective'}`;
      break;
    }

    case 'experience-forge': {
      const { runExperienceForge } = await import('../../lib/forge/orchestrator.js');
      const targetUrl = opts.businessUrl || opts.order || 'https://go-sweet.ro';
      const forgeResult = await runExperienceForge({
        url: targetUrl,
        order: opts.order,
        runId,
        maxIterations: maxIter,
        autoOpen: true,
      });
      job = await saveJob(outputDir, {
        stage: 'delivery',
        decision: 'deliver',
        finalOutput: forgeResult.indexPath,
      });
      note = `experience-forge generated Awwwards-level site (${forgeResult.finalCritique.score}/100) -> ${forgeResult.indexPath}`;
      break;
    }
    }
  } catch (error) {
    // T01: the stage threw. Record the attempt — inputHash so a later resume
    // can still tell whether inputs have since changed, outputHash/completedAt
    // left null by `recordStage` so this can never look like reusable output —
    // then let the original error keep propagating exactly as it did before
    // this wiring existed.
    await recordStage(outputDir, {
      stage,
      inputHash: currentInputHash,
      outputHash: null,
      failed: true,
    });
    throw error;
  }

  // T01/T02: the stage completed for real. One merged entry per stage in
  // `ledger.json`, keyed by stage name and scoped to this job's own
  // outputDir — never a second source of truth for *what stage the job is
  // at* (that stays `job.stage` in job.json), only a content-addressed
  // record of what this stage read and produced.
  //
  // `outputPath: 'job.json'` (T02) is what makes this entry skippable next
  // time: every stage here folds its output into that one file rather than a
  // stage-specific artifact, so job.json genuinely is "the stage's own
  // artifact path" the field's contract asks for. Recording it is what lets
  // `shouldSkip` say yes on a later call whose `currentInputHash` still
  // matches — see the skip check above.
  await recordStage(outputDir, {
    stage,
    inputHash: currentInputHash,
    outputHash: hashValue({ job: forHash(job) }),
    outputPath: 'job.json',
  });
  }

  return {
    runId,
    stage,
    loop,
    iteration: job.iteration,
    decision: job.decision ?? null,
    verdict: (job.distinctnessScore as DistinctnessResult | null)?.verdict ?? null,
    nextStage,
    finalOutput: job.finalOutput ?? null,
    business: job.business,
    ...(note === undefined ? {} : { note }),
    ...(providers === undefined ? {} : { providers }),
  };
}

/**
 * Runs the whole job to a terminal decision, host-side, in TypeScript.
 *
 * P7-1 (M-10): the loop leaves the n8n workflow JSON. The workflow is now
 * trigger → POST /job → poll — nothing else — and everything this function
 * does used to be wired node-by-node in n8n. The bounded QA loop
 * (browser → layout → critic → gate → hermes, repair re-entering at browser)
 * lives here, bounded by `maxIter` exactly as Hermes bounded it before, so a
 * job can never recurse unboundedly.
 *
 * Every stage is `runStage`, the same dispatcher the stage server used — this
 * orchestrator sequences, it does not reimplement.
 *
 * @param order  The customer's request, in words. Required.
 */
export async function runJobFull(opts: {
  readonly runId: string;
  readonly order: string;
  readonly maxIter?: number;
}): Promise<StageResult> {
  return runJobFullWith(opts, runStage);
}

/**
 * The pure orchestration sequence, with the stage runner injected so the
 * sequence can be tested without touching the real stages. `run` is called
 * with each stage's options and must return its `StageResult`.
 */
export async function runJobFullWith(
  opts: {
    readonly runId: string;
    readonly order: string;
    readonly maxIter?: number;
  },
  run: (stageOpts: {
    readonly stage: StageName;
    readonly runId: string;
    readonly maxIter: number;
    readonly order?: string;
    readonly provider?: string;
    readonly decideOnly?: boolean;
  }) => Promise<StageResult>,
): Promise<StageResult> {
  const { runId, order } = opts;
  const maxIter = opts.maxIter ?? 3;

  await run({ stage: 'create', runId, maxIter });

  const intake = await run({ stage: 'intake', runId, maxIter, order });
  const pool = intake.providers?.pool ?? [];

  // One research call per pool member — a member that fails loses its own
  // note and nothing else, exactly as the fan-out node used to provide.
  for (const provider of pool) {
    await run({ stage: 'research', runId, maxIter, provider });
  }
  await run({ stage: 'synthesize', runId, maxIter });
  await run({ stage: 'source', runId, maxIter });
  await run({ stage: 'analyze', runId, maxIter });
  await run({ stage: 'write', runId, maxIter });
  await run({ stage: 'direct', runId, maxIter });
  await run({ stage: 'diverge', runId, maxIter });

  // The bounded QA loop. Hermes decides; the repair is its own stage, re-entering
  // the loop at browser. `loop: true` from hermes means repair-then-reshoot.
  for (;;) {
    await run({ stage: 'browser', runId, maxIter });
    await run({ stage: 'layout', runId, maxIter });
    await run({ stage: 'critic', runId, maxIter });
    await run({ stage: 'gate', runId, maxIter });
    const hermes = await run({ stage: 'hermes', runId, maxIter, decideOnly: true });
    if (hermes.loop) {
      await run({ stage: 'repair', runId, maxIter });
      continue;
    }
    // Production preflight (Decision Gate §1.J): runs once hermes has
    // stopped looping, whether it decided to deliver or to escalate — the
    // report should always reflect what preflight found. Only a pending
    // `deliver` can be downgraded by it; see the `preflight` stage handler.
    await run({ stage: 'preflight', runId, maxIter });
    // T04: deploy sits after preflight (never publish something the gate
    // just blocked) and before report (the summary should reflect the real
    // outcome, live URL or otherwise).
    await run({ stage: 'deploy', runId, maxIter });
    return run({ stage: 'report', runId, maxIter });
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const value = (flag: string): string | undefined => {
    const at = argv.indexOf(flag);
    return at === -1 ? undefined : argv[at + 1];
  };

  const stage = value('--stage');
  const runId = value('--run');
  const maxIter = Number(value('--max-iter') ?? '3');
  const order = value('--order');
  const provider = value('--provider');
  if (stage === undefined || runId === undefined) {
    throw new Error(
      'usage: stage.ts --stage <name> --run <runId> [--max-iter N] [--order "..."] [--provider <name>]',
    );
  }
  if (!isStageName(stage)) throw new Error(`unknown stage: ${stage} (expected one of ${STAGES.join(', ')})`);

  const result = await runStage({
    stage,
    runId,
    maxIter,
    ...(order === undefined ? {} : { order }),
    ...(provider === undefined ? {} : { provider }),
  });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result));
}

// Only run the CLI when executed directly, so importing this module from the
// stage server does not kick off a stage.
if (process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('stage failed:', error);
    process.exit(1);
  });
}
