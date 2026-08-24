/**
 * Live liveness probe for OpenRouter's `:free` model roster.
 *
 *   npx tsx --env-file=.env scripts/probe-openrouter-free.ts
 *
 * ## Why this exists (separate from `scripts/probe-providers.ts`)
 *
 * `probe-providers.ts` already makes one OpenRouter call, but against a
 * single hardcoded (env-overridable) model id that is not even read from
 * this deployment's own catalogue — it is a general "is the OpenRouter
 * adapter reachable" smoke check, not a check of what `models.ts` actually
 * configures this deployment to request.
 *
 * `models.ts`'s own comment on `google/gemma-4-26b-a4b-it:free` documents
 * why that distinction matters: "OpenRouter's free-tier roster is a pool,
 * not a stable provider — model ids are added and retired on a promotional
 * cadence, and each one carries its own upstream data-policy requirement
 * independent of the others." A `:free` id can 404 for reasons that have
 * nothing to do with credentials (missing data-policy consent, retirement,
 * promotion ending) and everything to do with silently breaking the one
 * path `lib/factory/pool.ts`'s `FREE_TIER` / `bindings.ts`'s enum chain
 * actually depends on at request time.
 *
 * This script closes that gap directly: it reads every `:free`-suffixed
 * OpenRouter id out of `MODEL_CATALOG` itself — not a copy, not a
 * hardcoded guess — and probes each one for real. A dead id is reported,
 * not silently routed around and not auto-removed from the catalogue (per
 * T06's acceptance criteria: catalogue edits are a deliberate follow-up,
 * not a side effect of running a probe).
 *
 * ## It spends
 *
 * One short completion per free model id. This is free-tier quota, not
 * money, but it is a real external call, and — like `probe-providers.ts` —
 * this script never runs as part of a build, a test, or a pipeline stage.
 * Run it deliberately.
 *
 * Absent credentials are reported as `skipped`, not `failed`: the point is
 * to learn the state of the world, and "no key configured" is a state.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { postJson } from '../lib/ai/index.js';
import { MODEL_CATALOG } from '../lib/capability/models.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'probes');

const KEY_VARIABLE = 'OPENROUTER_API_KEY';
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

/** One trivial completion. Short prompt, short answer, minimal spend. */
const PROMPT = 'Reply with exactly one word: ok';

export interface FreeModelProbeResult {
  readonly id: string;
  readonly status: 'ok' | 'failed' | 'skipped';
  readonly servedModel: string | null;
  readonly latencyMs: number | null;
  readonly reply: string | null;
  readonly error: string | null;
  readonly probedAt: string;
}

/**
 * Every OpenRouter `:free` model id this deployment's catalogue currently
 * configures. Pure and network-free — this is what the accompanying test
 * exercises without hitting the live API. Reads `MODEL_CATALOG` directly so
 * the probe never drifts from what the planner can actually select.
 */
export function freeModelIds(): readonly string[] {
  return MODEL_CATALOG.filter((record) => record.provider === 'openrouter' && record.id.endsWith(':free')).map(
    (record) => record.id,
  );
}

async function probeOne(id: string, apiKey: string, baseUrl: string): Promise<FreeModelProbeResult> {
  const probedAt = new Date().toISOString();

  if (apiKey === '') {
    return { id, status: 'skipped', servedModel: null, latencyMs: null, reply: null, error: `${KEY_VARIABLE} is not set`, probedAt };
  }

  const startedAt = Date.now();
  try {
    const raw = (await postJson('openrouter', 'probe', {
      url: `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
      headers: { authorization: `Bearer ${apiKey}` },
      timeoutMs: 30_000,
      signal: undefined,
      body: { model: id, max_tokens: 16, messages: [{ role: 'user', content: PROMPT }] },
    })) as {
      model?: string;
      choices?: readonly { message?: { content?: string } }[];
      error?: { message?: string };
    };

    // OpenRouter reports upstream failures (including "not available for
    // free" / retired-id errors) in-band with HTTP 200 — the same shape the
    // real adapter (lib/ai/providers/openrouter.ts) already handles.
    if (raw.error !== undefined) {
      return {
        id,
        status: 'failed',
        servedModel: null,
        latencyMs: Date.now() - startedAt,
        reply: null,
        error: raw.error.message ?? 'upstream model error',
        probedAt,
      };
    }

    return {
      id,
      status: 'ok',
      servedModel: raw.model ?? null,
      latencyMs: Date.now() - startedAt,
      reply: raw.choices?.[0]?.message?.content?.trim().slice(0, 120) ?? null,
      error: null,
      probedAt,
    };
  } catch (error) {
    return {
      id,
      status: 'failed',
      servedModel: null,
      latencyMs: Date.now() - startedAt,
      reply: null,
      error: error instanceof Error ? error.message.slice(0, 300) : String(error),
      probedAt,
    };
  }
}

/** Probes every id in `ids` against the live API. Exported for testability with an injected id list. */
export async function probeFreeModels(
  ids: readonly string[],
  options: { readonly apiKey?: string; readonly baseUrl?: string } = {},
): Promise<readonly FreeModelProbeResult[]> {
  const apiKey = options.apiKey ?? process.env[KEY_VARIABLE]?.trim() ?? '';
  const baseUrl = options.baseUrl ?? process.env.OPENROUTER_BASE_URL ?? DEFAULT_BASE_URL;
  const results: FreeModelProbeResult[] = [];
  for (const id of ids) {
    results.push(await probeOne(id, apiKey, baseUrl));
  }
  return results;
}

async function main(): Promise<void> {
  const ids = freeModelIds();
  if (ids.length === 0) {
    process.stdout.write('no :free OpenRouter ids in MODEL_CATALOG — nothing to probe\n');
    return;
  }

  const results: FreeModelProbeResult[] = [];
  for (const id of ids) {
    process.stdout.write(`probing openrouter free model ${id} … `);
    const result = await probeOne(id, process.env[KEY_VARIABLE]?.trim() ?? '', process.env.OPENROUTER_BASE_URL ?? DEFAULT_BASE_URL);
    results.push(result);
    process.stdout.write(
      result.status === 'ok'
        ? `ok in ${String(result.latencyMs)}ms, served ${result.servedModel ?? '(unreported)'}\n`
        : `${result.status}: ${result.error ?? ''}\n`,
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `openrouter-free-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, `${JSON.stringify({ results }, null, 2)}\n`, 'utf8');
  process.stdout.write(`\n${file}\n`);

  const dead = results.filter((r) => r.status === 'failed');
  const live = results.filter((r) => r.status === 'ok').length;
  process.stdout.write(`${live}/${results.length} free model ids reachable\n`);
  if (dead.length > 0) {
    process.stdout.write(
      `stale/dead ids (document for removal from models.ts as a follow-up, not automatically): ${dead
        .map((r) => r.id)
        .join(', ')}\n`,
    );
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
