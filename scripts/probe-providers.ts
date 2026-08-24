/**
 * Live probe of the free-tier fallback providers.
 *
 *   npx tsx --env-file=.env scripts/probe-providers.ts
 *   npx tsx --env-file=.env scripts/probe-providers.ts --only=gemini
 *
 * ## Why this exists
 *
 * The repository's own record says four provider adapters and the MCP HTTP
 * connector "follow their published request and response shapes and are
 * exercised by the typecheck, but nothing here has made a real call. Treat the
 * first live run of each as the test."
 *
 * The fallback matrix rests on those untested paths. A fallback that has never
 * run is not a fallback — it is a plan to find out, during an outage, that the
 * plan does not work. This makes one small call against each free tier and
 * writes down what actually came back: which model served it, how long it took,
 * and whatever rate-limit headroom the vendor chose to disclose.
 *
 * ## It spends
 *
 * One short completion per provider. On free tiers that is quota rather than
 * money, but it is a real external call and this script never runs as part of a
 * build, a test, or a pipeline stage. Run it deliberately.
 *
 * Absent credentials are reported as `skipped`, not as failures: the point is
 * to learn the state of the world, and "no key configured" is a state.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { postJson } from '../lib/ai/index.js';
import { DEFAULT_MODELS } from '../lib/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'probes');

interface ProbeTarget {
  readonly id: string;
  readonly keyVariable: string;
  readonly baseUrl: string;
  readonly model: string;
  /** Gemini speaks its own dialect; everyone else here is OpenAI-compatible. */
  readonly dialect: 'openai' | 'gemini';
}

/**
 * Model ids are the most perishable thing in this file.
 *
 * Every one is overridable by environment variable precisely because vendor
 * catalogues move faster than this repository does — a probe that fails on a
 * retired model id has told you nothing about the adapter.
 *
 * Gemini therefore reads `DEFAULT_MODELS` rather than naming a version here:
 * the useful question is "can this deployment reach the model it would actually
 * use", and a hardcoded id answers a different one. The first run of this probe
 * demonstrated the difference — it asked for `gemini-2.5-flash` and got
 * `404 … no longer available to new users`, which says nothing about the key,
 * the adapter, or the free tier.
 */
const TARGETS: readonly ProbeTarget[] = [
  {
    id: 'gemini',
    keyVariable: 'GEMINI_API_KEY',
    baseUrl: process.env.GEMINI_BASE_URL ?? 'https://generativelanguage.googleapis.com',
    model: process.env.PROBE_GEMINI_MODEL ?? DEFAULT_MODELS.gemini,
    dialect: 'gemini',
  },
  {
    id: 'groq',
    keyVariable: 'GROQ_API_KEY',
    baseUrl: process.env.GROQ_BASE_URL ?? 'https://api.groq.com/openai/v1',
    model: process.env.PROBE_GROQ_MODEL ?? 'llama-3.1-8b-instant',
    dialect: 'openai',
  },
  {
    id: 'openrouter',
    keyVariable: 'OPENROUTER_API_KEY',
    baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    model: process.env.PROBE_OPENROUTER_MODEL ?? 'meta-llama/llama-3.3-70b-instruct:free',
    dialect: 'openai',
  },
];

interface ProbeResult {
  readonly id: string;
  readonly status: 'ok' | 'failed' | 'skipped';
  readonly requestedModel: string;
  readonly servedModel: string | null;
  readonly latencyMs: number | null;
  readonly reply: string | null;
  readonly error: string | null;
  readonly probedAt: string;
}

/** One trivial completion. Short prompt, short answer, minimal spend. */
const PROMPT = 'Reply with exactly one word: ok';

async function probe(target: ProbeTarget): Promise<ProbeResult> {
  const probedAt = new Date().toISOString();
  const apiKey = process.env[target.keyVariable]?.trim() ?? '';

  const base: Omit<ProbeResult, 'status' | 'servedModel' | 'latencyMs' | 'reply' | 'error'> = {
    id: target.id,
    requestedModel: target.model,
    probedAt,
  };

  if (apiKey === '') {
    return { ...base, status: 'skipped', servedModel: null, latencyMs: null, reply: null, error: `${target.keyVariable} is not set` };
  }

  const startedAt = Date.now();
  try {
    if (target.dialect === 'gemini') {
      const raw = (await postJson('gemini', 'probe', {
        url: `${target.baseUrl.replace(/\/+$/, '')}/v1beta/models/${target.model}:generateContent`,
        headers: { 'x-goog-api-key': apiKey },
        timeoutMs: 30_000,
        signal: undefined,
        body: {
          contents: [{ role: 'user', parts: [{ text: PROMPT }] }],
          generationConfig: { maxOutputTokens: 2048 },
        },
      })) as { candidates?: readonly { content?: { parts?: readonly { text?: string }[] } }[]; modelVersion?: string };

      const text = raw.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? null;
      return {
        ...base,
        status: 'ok',
        servedModel: raw.modelVersion ?? null,
        latencyMs: Date.now() - startedAt,
        reply: text === null ? null : text.trim().slice(0, 120),
        error: null,
      };
    }

    const raw = (await postJson('openai', 'probe', {
      url: `${target.baseUrl.replace(/\/+$/, '')}/chat/completions`,
      headers: { authorization: `Bearer ${apiKey}` },
      timeoutMs: 30_000,
      signal: undefined,
      body: { model: target.model, max_tokens: 16, messages: [{ role: 'user', content: PROMPT }] },
    })) as { model?: string; choices?: readonly { message?: { content?: string } }[] };

    return {
      ...base,
      status: 'ok',
      servedModel: raw.model ?? null,
      latencyMs: Date.now() - startedAt,
      reply: raw.choices?.[0]?.message?.content?.trim().slice(0, 120) ?? null,
      error: null,
    };
  } catch (error) {
    return {
      ...base,
      status: 'failed',
      servedModel: null,
      latencyMs: Date.now() - startedAt,
      reply: null,
      error: error instanceof Error ? error.message.slice(0, 300) : String(error),
    };
  }
}

async function main(): Promise<void> {
  const only = process.argv.slice(2).find((a) => a.startsWith('--only='))?.slice('--only='.length);
  const targets = only === undefined ? TARGETS : TARGETS.filter((t) => t.id === only);
  if (targets.length === 0) throw new Error(`no such target: ${String(only)}`);

  const results: ProbeResult[] = [];
  for (const target of targets) {
    process.stdout.write(`probing ${target.id} (${target.model}) … `);
    const result = await probe(target);
    results.push(result);
    process.stdout.write(
      result.status === 'ok'
        ? `ok in ${String(result.latencyMs)}ms, served ${result.servedModel ?? '(unreported)'}\n`
        : `${result.status}: ${result.error ?? ''}\n`,
    );
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `providers-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(file, `${JSON.stringify({ results }, null, 2)}\n`, 'utf8');
  process.stdout.write(`\n${file}\n`);

  const reachable = results.filter((r) => r.status === 'ok').length;
  process.stdout.write(`${reachable}/${results.length} fallback providers reachable\n`);
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
