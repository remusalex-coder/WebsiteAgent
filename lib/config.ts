/**
 * Typed configuration. The only module permitted to read `process.env`.
 *
 * Everything else receives an `AppConfig` through `AgentContext`, so an agent
 * can be run against any configuration without touching the environment.
 */

import path from 'node:path';

import { BUDGET_TIERS } from './capability/budget.js';
import { InvalidInputError } from './errors.js';

import type { AIProviderName } from './ai/types.js';
import type { BudgetTier } from './capability/budget.js';

const SOURCE = 'config';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];

export interface BrowserConfig {
  readonly headless: boolean;
  /** Per-navigation and per-selector timeout, in milliseconds. */
  readonly timeoutMs: number;
  readonly locale: string;
  readonly userAgent: string | null;
  /** Optional proxy for geo-sensitive Maps results. */
  readonly proxyUrl: string | null;
}

export interface CollectorConfig {
  /** Upper bound on pages crawled per site, homepage included. */
  readonly maxPages: number;
  /** Upper bound on images downloaded per run. */
  readonly maxImages: number;
  /** Below this, a file is a tracking pixel or spacer rather than content. */
  readonly minAssetBytes: number;
  readonly maxAssetBytes: number;
  /** Folder under `outputDir` that downloaded images are written to. */
  readonly assetDirName: string;
}

/**
 * Effort controls how deeply the model reasons.
 *
 * Provider-neutral by design: each adapter maps these five levels onto its own
 * vocabulary (Anthropic takes them verbatim; OpenAI and OpenRouter clamp
 * `xhigh`/`max` to `high`; Gemini does not map them at all).
 */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/**
 * Which vendor serves the LLM stages, and the credentials for each.
 *
 * All four keys are read unconditionally so switching `AI_PROVIDER` needs no
 * other change. `provider` stays an unvalidated string here: `createAIProvider`
 * validates it at point of use, which keeps stages 1–3 runnable with the AI
 * environment unset or wrong.
 */
export interface AiConfig {
  /** Raw `AI_PROVIDER` value. Validated by `createAIProvider`, not here. */
  readonly provider: string;
  readonly apiKeys: Readonly<Record<AIProviderName, string>>;
  /**
   * Per-provider endpoint overrides. `null` means "use the adapter's default".
   * This is the seam an Azure deployment, a local Ollama, or a proxy goes
   * through — no adapter changes, one environment variable.
   */
  readonly baseUrls: Readonly<Record<AIProviderName, string | null>>;
  /** Wall-clock budget for one provider request. */
  readonly requestTimeoutMs: number;
  /** Retries for a provider call that failed retryably. `0` disables them. */
  readonly maxRetries: number;
  /** First backoff ceiling; doubles per attempt, with full jitter. */
  readonly retryBaseDelayMs: number;
  /** OpenRouter app attribution; both optional. */
  readonly openRouterReferer: string | null;
  readonly openRouterTitle: string | null;
}

/* ------------------------------------------------------------------ */
/* Platform: skills, MCP, telemetry, feature flags                     */
/* ------------------------------------------------------------------ */

/**
 * Which skills are available, and where new ones come from.
 *
 * `disabled` always beats `enabled`, so an operator can allow a broad set and
 * carve one entry back out without the two lists contradicting each other.
 */
export interface SkillsConfig {
  /** Allow-list. Empty means "every registered skill", which is the default. */
  readonly enabled: readonly string[];
  /** Deny-list, applied last. */
  readonly disabled: readonly string[];
  /** Directories scanned for `*.skill.ts` / `*.skill.js` at startup. */
  readonly discoveryDirs: readonly string[];
  /** Per-call budget. `0` disables the timeout. */
  readonly timeoutMs: number;
}

/** One MCP server, as declared in `MCP_SERVERS`. */
export interface McpServerConfig {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly transport: 'http' | 'stdio';
  /** Required for `http`, ignored for `stdio`. */
  readonly endpoint: string | null;
  /** Required for `stdio`, ignored for `http`. */
  readonly command: string | null;
  readonly args: readonly string[];
  /** Sent on every HTTP request. Where a bearer token goes. */
  readonly headers: Readonly<Record<string, string>>;
  /** Environment variables that must be set before this server is usable. */
  readonly requiredCredentials: readonly string[];
}

export interface McpConfig {
  readonly servers: readonly McpServerConfig[];
  readonly enabled: readonly string[];
  readonly disabled: readonly string[];
  readonly requestTimeoutMs: number;
}

export interface TelemetryConfig {
  /** When false, calls are still timed but nothing is emitted to a sink. */
  readonly enabled: boolean;
  /** Latency samples retained per capability, for the percentiles. */
  readonly sampleLimit: number;
}

/**
 * Named booleans, from `FEATURE_FLAGS` and from any `FEATURE_<NAME>` variable.
 *
 * Deliberately untyped: a flag exists to be added and removed without a code
 * change, and requiring one to be declared here first would defeat that.
 */
export type FeatureFlags = Readonly<Record<string, boolean>>;

export interface AnalystConfig {
  /** Resolved from `ANALYST_MODEL`, else the selected provider's default. */
  readonly model: string;
  readonly effort: Effort;
  /** Caps thinking *and* response text together — leave the model room. */
  readonly maxOutputTokens: number;
  /** Per-page cap when excerpting site text into the model's brief. */
  readonly maxPageChars: number;
}

export interface WriterConfig {
  readonly model: string;
  readonly effort: Effort;
  readonly maxOutputTokens: number;
  /** Per-page cap when excerpting site text into the writer's brief. */
  readonly maxPageChars: number;
}

/**
 * The visual critic's vision model — stage `visual-critic`.
 *
 * A stage config beside analyst/writer/director (P3-1 / F-14): the critic is
 * a model call like any other, so its endpoint and model belong in config,
 * not in a `VISION_*` read at the point of use. `apiKey` empty means vision is
 * disabled and the critic returns its deterministic no-vision critique.
 */
export interface VisionConfig {
  /** `VISION_API_KEY`. Empty disables the visual critic. */
  readonly apiKey: string;
  /** `VISION_BASE_URL`, when the endpoint is not a provider default. */
  readonly baseUrl: string | null;
  /** `VISION_MODEL`, else the selected provider's default. */
  readonly model: string;
}

/**
 * The AI Design Director — stage 5a, the only model call in the design path.
 *
 * `enabled` defaults to false, so a pipeline that has never heard of the
 * director behaves exactly as it did before it existed. The smoke harness sets
 * it explicitly; nothing else turns it on implicitly.
 */
export interface DirectorConfig {
  /**
   * Whether the Design Director AI agent is active in the pipeline.
   *
   * `false` (default) — the deterministic design agent runs with no directive.
   * `true` — the director runs between the writer and design stages and its
   * `DesignDirective` is threaded into composition through `applyDirective()`.
   */
  readonly enabled: boolean;
  /** Resolved from `DIRECTOR_MODEL`, else the selected provider's default. */
  readonly model: string;
  readonly effort: Effort;
  /**
   * Caps thinking *and* response text together on a reasoning model.
   *
   * The directive itself is under a thousand tokens, so this number is almost
   * entirely a thinking budget. It has to stay comfortably above the reasoning
   * allowance `Effort` maps to — Gemini counts thinking against
   * `maxOutputTokens`, so a budget at or below `toGeminiThinkingBudget(effort)`
   * spends the whole allowance thinking and returns `MAX_TOKENS` with no JSON
   * at all. At `medium` that ceiling is 4,096; at `xhigh` it is 24,576.
   */
  readonly maxOutputTokens: number;
  /** Per-page cap when excerpting site text into the director's brief. */
  readonly maxPageChars: number;
}

/**
 * The deploy target that replaced the Lovable stub.
 *
 * Netlify's "Drop" deploy: a site is created (or an existing `siteId` reused)
 * and its `dist/` zip is uploaded via the Deploy API. No Lovable account,
 * no JSX prompt round-trip — the rendered `RenderedFile[]` is uploaded
 * verbatim, so what ships is exactly what `renderSite` produced. The key is
 * the switch: empty `NETLIFY_DEPLOY_TOKEN` means deploy is skipped, the same
 * "key present = run, absent = skip" discipline `PlacesConfig` already uses.
 */
export interface NetlifyConfig {
  /** `NETLIFY_DEPLOY_TOKEN`. Empty disables deploy. */
  readonly apiKey: string;
  /** Reuse an existing site instead of creating one. `NETLIFY_SITE_ID`. */
  readonly siteId: string | null;
  readonly deployTimeoutMs: number;
}

/**
 * The Google Places API, used as a content source.
 *
 * **The key is the switch.** There is no separate enable flag, deliberately:
 * two ways to be switched off is one way too many, and "I set the key and
 * nothing happened" is a worse first hour than any flag is worth. A key present
 * means the source runs; absent means it is skipped and the pipeline behaves
 * exactly as it did before the source existed.
 *
 * This is the platform's first paid dependency, and it stays optional for that
 * reason — the $0.00 baseline has to remain runnable, because it is what a
 * contributor with no billing account gets.
 */
export interface PlacesConfig {
  /** `PLACES_API_KEY`. Empty disables the source. */
  readonly apiKey: string;
  /** Language for the editorial summary and review text, e.g. `en`, `fr`. */
  readonly languageCode: string;
  readonly requestTimeoutMs: number;
}

export interface AppConfig {
  readonly logLevel: LogLevel;
  /** Absolute path to the artifact root. Per-run subfolders live beneath it. */
  readonly outputDir: string;
  readonly browser: BrowserConfig;
  readonly collector: CollectorConfig;
  readonly ai: AiConfig;
  readonly skills: SkillsConfig;
  readonly mcp: McpConfig;
  readonly telemetry: TelemetryConfig;
  readonly features: FeatureFlags;
  /**
   * Credentials skills and MCP servers declare by name, e.g. `GITHUB_TOKEN`.
   *
   * Collected here rather than read at point of use so this stays the only
   * module touching `process.env`. Never logged, and never serialised into an
   * artifact — `platform.describe()` reports which names are *present*, never
   * their values.
   */
  readonly credentials: Readonly<Record<string, string>>;
  readonly places: PlacesConfig;
  readonly analyst: AnalystConfig;
  readonly writer: WriterConfig;
  readonly director: DirectorConfig;
  readonly vision: VisionConfig;
  /**
   * Deploy target that replaced the Lovable stub (Netlify Drop API).
   * `config.lovable`/`LovableConfig` (and the `LOVABLE_*` env vars other than
   * `LOVABLE_API_KEY`, which the `lovable` platform-skill placeholder in
   * `lib/platform/skills/builtin/web.ts` still names) were removed 2026-08-25
   * (WQ-011/A10): zero live readers remained once `agents/lovableAgent.ts`
   * became a real Netlify deploy rather than a Lovable stub.
   */
  readonly netlify: NetlifyConfig;
  readonly experienceEngine: 'signature' | 'template';
  /** `BF_BUDGET_TIER`. Governs whether — and how much — a run may spend. */
  readonly budgetTier: BudgetTier;
  /** `BF_BUDGET_CENTS`. Only meaningful for `budgetTier: 'tier3'`. */
  readonly budgetCustomCents: number | null;
  /**
   * `BF_ALLOW_CEREBRAS_SPEND`. Cerebras's catalog pricing is unverified
   * (`priceConfidence: 'estimated'`), so it is excluded from every chain by
   * default regardless of budget tier. This flag is the explicit, scoped
   * "someone said so" that lets Cerebras spend anyway — it authorizes only
   * Cerebras, never any other unverified-price provider.
   */
  readonly allowCerebrasSpend: boolean;
  /**
   * `FORGE_BATTLE_MODE`. Opt-in, default off. When on, `runJob.ts`'s default
   * build hook calls `runExperienceBattle` (N independent Experience
   * Signature builds, each repaired and re-verdicted, reduced to one
   * winner) instead of `runExperienceForge`'s single build — see
   * `WORK_QUEUE.json` WQ-018. Off by default because it multiplies a run's
   * real cost by `forgeBattleCandidateCount`; a caller must choose it.
   */
  readonly forgeBattleMode: boolean;
  /** `FORGE_BATTLE_CANDIDATES`. Only meaningful when `forgeBattleMode` is on. Minimum 2 — a "battle" of one is not a battle. */
  readonly forgeBattleCandidateCount: number;
}

/** Applied wherever the environment leaves a value unset. */
export const DEFAULTS = {
  experienceEngine: 'signature' as const,
  logLevel: 'info',
  outputDir: './output',
  browser: {
    headless: true,
    timeoutMs: 30_000,
    locale: 'en-US',
  },
  collector: {
    maxPages: 6,
    maxImages: 40,
    minAssetBytes: 1_024,
    maxAssetBytes: 8_000_000,
    assetDirName: 'assets',
  },
  ai: {
    provider: 'anthropic',
    requestTimeoutMs: 300_000,
    maxRetries: 3,
    retryBaseDelayMs: 1_000,
  },
  skills: {
    timeoutMs: 120_000,
  },
  mcp: {
    requestTimeoutMs: 60_000,
  },
  telemetry: {
    enabled: true,
    sampleLimit: 100,
  },
  places: {
    languageCode: 'en',
    // Deliberately short. Places is a bonus source on the critical path of a
    // run that already spent a browser session getting here — a slow answer is
    // worth less than a fast empty one.
    requestTimeoutMs: 15_000,
  },
  analyst: {
    effort: 'high',
    maxOutputTokens: 32_000,
    maxPageChars: 4_000,
  },
  writer: {
    effort: 'high',
    // A whole site's copy, and on a thinking model this caps thinking with it —
    // the adapter treats `max_tokens` truncation as a failed run, so the budget
    // has to hold nine sections of prose *and* the reasoning behind them.
    maxOutputTokens: 24_000,
    maxPageChars: 6_000,
  },
  director: {
    enabled: false,
    effort: 'medium',
    // Three times the `medium` thinking budget. The directive is small; this
    // number exists to leave the model room to reason and still have tokens
    // left to answer with. See `DirectorConfig.maxOutputTokens`.
    maxOutputTokens: 12_000,
    maxPageChars: 2_000,
  },
  vision: {
    apiKey: '',
    baseUrl: null,
    model: '',
  },
  netlify: {
    deployTimeoutMs: 300_000,
  },
  budgetTier: 'tier0' as const,
  allowCerebrasSpend: false,
  forgeBattleMode: false,
  forgeBattleCandidateCount: 2,
} as const;

/**
 * Model used when a stage's `*_MODEL` variable is unset.
 *
 * Per-provider, because a model id is meaningless outside its vendor. These are
 * starting points, not recommendations — verify against the provider's current
 * catalogue. OpenRouter ids are `vendor/model` slugs and are the most likely to
 * need setting explicitly.
 */
export const DEFAULT_MODELS: Readonly<Record<AIProviderName, string>> = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-4o',
  // Not `gemini-2.5-pro`: the 2.5 family is no longer served to accounts
  // created after mid-2026 (404 "no longer available to new users"), and Pro
  // lost its free tier in April 2026. A flash model on the free tier is the
  // honest default for a project whose cost target is zero.
  gemini: 'gemini-3.6-flash',
  openrouter: 'openai/gpt-5',
  // No free tier (bf_research/xai_models.html, 2026-08-19); grok-4.6 is the
  // non-dated, broadly-available chat model. Never selected under the
  // zero-budget-by-default capability policy without an explicit override.
  xai: 'grok-4.6',
  // No free tier (bf_research, api-docs.deepseek.com, OBSERVED 2026-08-19);
  // deepseek-v4-flash is the cheap/fast tier. Never selected under the
  // zero-budget-by-default capability policy without an explicit override.
  deepseek: 'deepseek-v4-flash',
  // Pricing UNKNOWN (bf_research flags Cerebras as "not deep-dived");
  // gpt-oss-120b is the reasoning-capable model Cerebras's own catalog lists
  // (inference-docs.cerebras.ai, OBSERVED 2026-08-19). Never selected under
  // the zero-budget-by-default capability policy without an explicit override.
  cerebras: 'gpt-oss-120b',
  // Real free tier (console.groq.com/docs/rate-limits, OBSERVED 2026-08-24:
  // 30 req/min, 1,000 req/day, 200,000 tokens/day for GPT-OSS models on the
  // no-cost Developer plan). openai/gpt-oss-120b is one of exactly two
  // models Groq documents strict json_schema support for — see
  // lib/ai/providers/groq.ts.
  groq: 'openai/gpt-oss-120b',
};

/**
 * Best-effort default model for a provider name that has not been validated yet.
 *
 * Falls back to the Anthropic default for an unrecognised provider: the value is
 * never used, because `createAIProvider` rejects that provider before any
 * request is built.
 */
function defaultModelFor(provider: string): string {
  const name = provider.trim().toLowerCase() as AIProviderName;
  return DEFAULT_MODELS[name] ?? DEFAULT_MODELS.anthropic;
}

/* ------------------------------------------------------------------ */
/* Parsing helpers                                                     */
/* ------------------------------------------------------------------ */

function str(env: NodeJS.ProcessEnv, key: string, fallback: string): string {
  const raw = env[key]?.trim();
  return raw ? raw : fallback;
}

/** Optional values collapse empty strings to `null` so callers test one thing. */
function optional(env: NodeJS.ProcessEnv, key: string): string | null {
  const raw = env[key]?.trim();
  return raw ? raw : null;
}

function bool(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  throw new InvalidInputError(`${key} must be a boolean, got "${raw}"`, SOURCE);
}

function int(env: NodeJS.ProcessEnv, key: string, fallback: number, min = 1): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new InvalidInputError(`${key} must be a number >= ${min}, got "${raw}"`, SOURCE);
  }
  return Math.floor(parsed);
}

/** Like `int`, but `null` when unset rather than a required fallback. */
function optionalInt(env: NodeJS.ProcessEnv, key: string, min = 1): number | null {
  const raw = env[key]?.trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new InvalidInputError(`${key} must be a number >= ${min}, got "${raw}"`, SOURCE);
  }
  return Math.floor(parsed);
}

/** Comma-separated list. Blanks are dropped, so `a,,b` is two entries. */
function list(env: NodeJS.ProcessEnv, key: string): readonly string[] {
  const raw = env[key]?.trim();
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/**
 * Canonical form of a feature-flag name: lower-case, hyphen-separated.
 *
 * The two sources below spell the same flag differently — an environment
 * variable cannot contain a hyphen, so `FEATURE_PLACES_API` and a
 * `FEATURE_FLAGS` entry of `places-api` have to converge on one key or a
 * lookup silently misses. Callers go through the same function, so
 * `feature('places-api')` and `feature('PLACES_API')` are the same question.
 */
export function normaliseFlagName(name: string): string {
  return name.trim().toLowerCase().replace(/_/g, '-');
}

/**
 * Feature flags, from two sources that compose.
 *
 * `FEATURE_FLAGS=a,!b` is the terse form (a leading `!` turns one off), and
 * `FEATURE_<NAME>=true|false` is the explicit one. The explicit form wins,
 * because it is the one a deployment sets deliberately.
 */
function featureFlags(env: NodeJS.ProcessEnv): FeatureFlags {
  const flags: Record<string, boolean> = {};

  for (const entry of list(env, 'FEATURE_FLAGS')) {
    const off = entry.startsWith('!');
    const name = normaliseFlagName(off ? entry.slice(1) : entry);
    if (name !== '') flags[name] = !off;
  }

  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('FEATURE_') || key === 'FEATURE_FLAGS') continue;
    const raw = value?.trim().toLowerCase();
    if (raw === undefined || raw === '') continue;
    flags[normaliseFlagName(key.slice('FEATURE_'.length))] = ['1', 'true', 'yes', 'on'].includes(raw);
  }

  return flags;
}

/**
 * Environment variables a skill or MCP server may ask for by name.
 *
 * Matched by suffix rather than an allow-list, so a third-party skill can
 * declare `NOTION_TOKEN` and have it resolve without this file learning about
 * Notion. `DATABASE_URL` is named explicitly because it is a credential whose
 * name does not look like one.
 */
const CREDENTIAL_PATTERN = /_(API_KEY|KEY|TOKEN|SECRET|PASSWORD|CREDENTIALS)$/;

function credentials(env: NodeJS.ProcessEnv): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    const trimmed = value?.trim();
    if (trimmed === undefined || trimmed === '') continue;
    if (CREDENTIAL_PATTERN.test(key) || key === 'DATABASE_URL') out[key] = trimmed;
  }
  return out;
}

/**
 * Parses `MCP_SERVERS`, a JSON array of server declarations.
 *
 * A malformed declaration fails the whole load rather than being skipped: a
 * typo in a server id would otherwise show up much later as "no MCP server is
 * registered as …", which is a far worse error to debug.
 */
function mcpServers(env: NodeJS.ProcessEnv): readonly McpServerConfig[] {
  const raw = env.MCP_SERVERS?.trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new InvalidInputError('MCP_SERVERS must be a JSON array', SOURCE, error);
  }
  if (!Array.isArray(parsed)) {
    throw new InvalidInputError('MCP_SERVERS must be a JSON array', SOURCE);
  }

  return parsed.map((entry, index) => {
    const where = `MCP_SERVERS[${index}]`;
    if (typeof entry !== 'object' || entry === null) {
      throw new InvalidInputError(`${where} must be an object`, SOURCE);
    }
    const record = entry as Record<string, unknown>;

    const id = typeof record.id === 'string' ? record.id.trim() : '';
    if (id === '') throw new InvalidInputError(`${where}.id is required`, SOURCE);

    const transport = record.transport === 'stdio' ? 'stdio' : 'http';
    const endpoint = typeof record.endpoint === 'string' ? record.endpoint : null;
    const command = typeof record.command === 'string' ? record.command : null;

    if (transport === 'http' && endpoint === null) {
      throw new InvalidInputError(`${where}.endpoint is required for the http transport`, SOURCE);
    }
    if (transport === 'stdio' && command === null) {
      throw new InvalidInputError(`${where}.command is required for the stdio transport`, SOURCE);
    }

    return {
      id,
      name: typeof record.name === 'string' ? record.name : id,
      description: typeof record.description === 'string' ? record.description : '',
      transport,
      endpoint,
      command,
      args: stringArray(record.args),
      headers: stringRecord(record.headers),
      requiredCredentials: stringArray(record.requiredCredentials),
    };
  });
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function stringRecord(value: unknown): Readonly<Record<string, string>> {
  if (typeof value !== 'object' || value === null) return {};
  const out: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') out[key] = entry;
  }
  return out;
}

const EFFORT_LEVELS: readonly Effort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

function effort(env: NodeJS.ProcessEnv, key: string, fallback: Effort): Effort {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return fallback;

  const match = EFFORT_LEVELS.find((level) => level === raw);
  if (!match) {
    throw new InvalidInputError(
      `${key} must be one of ${EFFORT_LEVELS.join(', ')}, got "${raw}"`,
      SOURCE,
    );
  }
  return match;
}

function budgetTier(env: NodeJS.ProcessEnv, key: string, fallback: BudgetTier): BudgetTier {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return fallback;

  const match = BUDGET_TIERS.find((tier) => tier === raw);
  if (!match) {
    throw new InvalidInputError(
      `${key} must be one of ${BUDGET_TIERS.join(', ')}, got "${raw}"`,
      SOURCE,
    );
  }
  return match;
}

function logLevel(env: NodeJS.ProcessEnv): LogLevel {
  const raw = str(env, 'LOG_LEVEL', DEFAULTS.logLevel).toLowerCase();
  const match = LOG_LEVELS.find((level) => level === raw);
  if (!match) {
    throw new InvalidInputError(
      `LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}, got "${raw}"`,
      SOURCE,
    );
  }
  return match;
}

/**
 * Reads and validates the environment into an `AppConfig`.
 *
 * Malformed values fail here, at startup. Missing API keys do not: they
 * default to empty and are asserted by the stage that needs them, so the
 * discovery stage runs with no credentials configured at all.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Read once: the stage model defaults depend on it, and reading it twice
  // invites the two from drifting apart.
  const providerName = str(env, 'AI_PROVIDER', DEFAULTS.ai.provider);

  return {
    logLevel: logLevel(env),
    outputDir: path.resolve(str(env, 'OUTPUT_DIR', DEFAULTS.outputDir)),
    browser: {
      headless: bool(env, 'BROWSER_HEADLESS', DEFAULTS.browser.headless),
      timeoutMs: int(env, 'BROWSER_TIMEOUT_MS', DEFAULTS.browser.timeoutMs),
      locale: str(env, 'BROWSER_LOCALE', DEFAULTS.browser.locale),
      userAgent: optional(env, 'BROWSER_USER_AGENT'),
      proxyUrl: optional(env, 'BROWSER_PROXY_URL'),
    },
    collector: {
      maxPages: int(env, 'COLLECTOR_MAX_PAGES', DEFAULTS.collector.maxPages),
      maxImages: int(env, 'COLLECTOR_MAX_IMAGES', DEFAULTS.collector.maxImages),
      minAssetBytes: int(env, 'COLLECTOR_MIN_ASSET_BYTES', DEFAULTS.collector.minAssetBytes, 0),
      maxAssetBytes: int(env, 'COLLECTOR_MAX_ASSET_BYTES', DEFAULTS.collector.maxAssetBytes),
      assetDirName: str(env, 'COLLECTOR_ASSET_DIR', DEFAULTS.collector.assetDirName),
    },
    ai: {
      provider: providerName,
      apiKeys: {
        anthropic: str(env, 'ANTHROPIC_API_KEY', ''),
        openai: str(env, 'OPENAI_API_KEY', ''),
        gemini: str(env, 'GEMINI_API_KEY', ''),
        openrouter: str(env, 'OPENROUTER_API_KEY', ''),
        xai: str(env, 'XAI_API_KEY', ''),
        deepseek: str(env, 'DEEPSEEK_API_KEY', ''),
        cerebras: str(env, 'CEREBRAS_API_KEY', ''),
        groq: str(env, 'GROQ_API_KEY', ''),
      },
      baseUrls: {
        anthropic: optional(env, 'ANTHROPIC_BASE_URL'),
        openai: optional(env, 'OPENAI_BASE_URL'),
        gemini: optional(env, 'GEMINI_BASE_URL'),
        openrouter: optional(env, 'OPENROUTER_BASE_URL'),
        xai: optional(env, 'XAI_BASE_URL'),
        deepseek: optional(env, 'DEEPSEEK_BASE_URL'),
        cerebras: optional(env, 'CEREBRAS_BASE_URL'),
        groq: optional(env, 'GROQ_BASE_URL'),
      },
      requestTimeoutMs: int(env, 'AI_REQUEST_TIMEOUT_MS', DEFAULTS.ai.requestTimeoutMs),
      maxRetries: int(env, 'AI_MAX_RETRIES', DEFAULTS.ai.maxRetries, 0),
      retryBaseDelayMs: int(env, 'AI_RETRY_BASE_DELAY_MS', DEFAULTS.ai.retryBaseDelayMs, 0),
      openRouterReferer: optional(env, 'OPENROUTER_REFERER'),
      openRouterTitle: optional(env, 'OPENROUTER_TITLE'),
    },
    skills: {
      enabled: list(env, 'SKILLS_ENABLED'),
      disabled: list(env, 'SKILLS_DISABLED'),
      discoveryDirs: list(env, 'SKILLS_DIR').map((entry) => path.resolve(entry)),
      timeoutMs: int(env, 'SKILL_TIMEOUT_MS', DEFAULTS.skills.timeoutMs, 0),
    },
    mcp: {
      servers: mcpServers(env),
      enabled: list(env, 'MCP_ENABLED'),
      disabled: list(env, 'MCP_DISABLED'),
      requestTimeoutMs: int(env, 'MCP_REQUEST_TIMEOUT_MS', DEFAULTS.mcp.requestTimeoutMs),
    },
    telemetry: {
      enabled: bool(env, 'TELEMETRY_ENABLED', DEFAULTS.telemetry.enabled),
      sampleLimit: int(env, 'TELEMETRY_SAMPLE_LIMIT', DEFAULTS.telemetry.sampleLimit),
    },
    features: featureFlags(env),
    credentials: credentials(env),
    places: {
      apiKey: str(env, 'PLACES_API_KEY', ''),
      languageCode: str(env, 'PLACES_LANGUAGE', DEFAULTS.places.languageCode),
      requestTimeoutMs: int(env, 'PLACES_TIMEOUT_MS', DEFAULTS.places.requestTimeoutMs),
    },
    analyst: {
      model: str(env, 'ANALYST_MODEL', defaultModelFor(providerName)),
      effort: effort(env, 'ANALYST_EFFORT', DEFAULTS.analyst.effort),
      maxOutputTokens: int(env, 'ANALYST_MAX_OUTPUT_TOKENS', DEFAULTS.analyst.maxOutputTokens),
      maxPageChars: int(env, 'ANALYST_MAX_PAGE_CHARS', DEFAULTS.analyst.maxPageChars),
    },
    writer: {
      model: str(env, 'WRITER_MODEL', defaultModelFor(providerName)),
      effort: effort(env, 'WRITER_EFFORT', DEFAULTS.writer.effort),
      maxOutputTokens: int(env, 'WRITER_MAX_OUTPUT_TOKENS', DEFAULTS.writer.maxOutputTokens),
      maxPageChars: int(env, 'WRITER_MAX_PAGE_CHARS', DEFAULTS.writer.maxPageChars),
    },
    director: {
      enabled: bool(env, 'DIRECTOR_ENABLED', DEFAULTS.director.enabled),
      model: str(env, 'DIRECTOR_MODEL', defaultModelFor(providerName)),
      effort: effort(env, 'DIRECTOR_EFFORT', DEFAULTS.director.effort),
      maxOutputTokens: int(env, 'DIRECTOR_MAX_OUTPUT_TOKENS', DEFAULTS.director.maxOutputTokens),
      maxPageChars: int(env, 'DIRECTOR_MAX_PAGE_CHARS', DEFAULTS.director.maxPageChars),
    },
    vision: {
      apiKey: str(env, 'VISION_API_KEY', ''),
      baseUrl: optional(env, 'VISION_BASE_URL'),
      model: str(env, 'VISION_MODEL', defaultModelFor(providerName)),
    },
    netlify: {
      apiKey: str(env, 'NETLIFY_DEPLOY_TOKEN', ''),
      siteId: optional(env, 'NETLIFY_SITE_ID'),
      deployTimeoutMs: int(env, 'NETLIFY_DEPLOY_TIMEOUT_MS', DEFAULTS.netlify.deployTimeoutMs),
    },
    experienceEngine: str(env, 'EXPERIENCE_ENGINE', DEFAULTS.experienceEngine) === 'template' ? 'template' : 'signature',
    budgetTier: budgetTier(env, 'BF_BUDGET_TIER', DEFAULTS.budgetTier),
    budgetCustomCents: optionalInt(env, 'BF_BUDGET_CENTS', 1),
    allowCerebrasSpend: bool(env, 'BF_ALLOW_CEREBRAS_SPEND', DEFAULTS.allowCerebrasSpend),
    forgeBattleMode: bool(env, 'FORGE_BATTLE_MODE', DEFAULTS.forgeBattleMode),
    forgeBattleCandidateCount: int(env, 'FORGE_BATTLE_CANDIDATES', DEFAULTS.forgeBattleCandidateCount, 2),
  };
}
