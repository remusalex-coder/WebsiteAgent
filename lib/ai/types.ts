/**
 * The provider-agnostic AI contract.
 *
 * One interface, four implementations. An agent that needs a model asks for a
 * JSON object matching a schema and gets one back; which vendor served it, how
 * that vendor spells "reasoning effort", and whether it enforces schemas
 * natively or has to be talked into it are all below this line.
 *
 * Nothing here is specific to a stage. `businessAnalystAgent` supplies the
 * prompt and the schema; the provider supplies the transport.
 */

import type { Effort } from '../config.js';
import type { Logger } from '../logger.js';
import type { HealthReport } from '../platform/types.js';

/** A JSON Schema document. Kept loose — each provider narrows it to its own dialect. */
export type JsonSchema = Record<string, unknown>;

export const AI_PROVIDER_NAMES = ['anthropic', 'openai', 'gemini', 'openrouter'] as const;

export type AIProviderName = (typeof AI_PROVIDER_NAMES)[number];

export function isAIProviderName(value: string): value is AIProviderName {
  return (AI_PROVIDER_NAMES as readonly string[]).includes(value);
}

/**
 * One structured generation.
 *
 * `schema` is the whole point: every provider must return an object that
 * validates against it, so a caller can swap vendors without touching the
 * shape it parses.
 */
export interface AIGenerateRequest {
  /** System prompt. Passed through verbatim wherever the provider supports one. */
  readonly system: string;
  /** The user turn. */
  readonly prompt: string;
  /** Shape the response must take. */
  readonly schema: JsonSchema;
  /** Provider-specific model id. Resolved by config, never guessed here. */
  readonly model: string;
  /** Reasoning depth. Mapped per provider; see each implementation. */
  readonly effort: Effort;
  /** Upper bound on generated tokens. On thinking models this caps thinking too. */
  readonly maxTokens: number;
  /** Schema name, where the provider requires one. Defaults to `result`. */
  readonly schemaName?: string;
  /** Cancels an in-flight request when the run is aborted. */
  readonly signal?: AbortSignal;
}

export interface AITokenUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

/**
 * How the provider got the response to obey the schema.
 *
 * `native` — the API enforced it. `instructed` — the API cannot, so the schema
 * was supplied in the prompt and validated locally on the way out. Logged so a
 * run's provenance is legible; the returned `data` is identical either way.
 */
export type StructuredOutputMode = 'native' | 'instructed';

export interface AIGenerateResult {
  /** Parsed JSON, already validated against `schema`. */
  readonly data: unknown;
  /** Model that actually served the request — may differ from the one asked for. */
  readonly model: string;
  readonly usage: AITokenUsage;
  readonly structuredOutput: StructuredOutputMode;
  /** Provider's own completion reason, normalised to a string for logging. */
  readonly finishReason: string | null;
}

/**
 * What every provider exposes. Agents depend on this and nothing else.
 *
 * `health` is a credential and reachability check, not a generation: it must be
 * cheap enough to call on every run without costing tokens, so adapters probe a
 * listing endpoint where one exists and fall back to inspecting configuration
 * where one does not.
 */
export interface AIProvider {
  readonly name: AIProviderName;
  /** Adapter version, reported on the platform status board. */
  readonly version: string;
  /** Model used when a caller does not name one. */
  readonly defaultModel: string;
  /** False when the provider falls back to prompt-supplied schemas. */
  readonly supportsNativeSchema: boolean;
  generate(request: AIGenerateRequest): Promise<AIGenerateResult>;
  health(signal?: AbortSignal): Promise<HealthReport>;
}

/* ------------------------------------------------------------------ */
/* Adapter contract                                                    */
/* ------------------------------------------------------------------ */

/**
 * Everything an adapter is handed. Adapters read no environment of their own —
 * the factory resolves credentials and endpoints from config and passes them in,
 * so a provider can be constructed against a mock in a test.
 */
export interface ProviderOptions {
  readonly apiKey: string;
  /** Overrides the adapter's default endpoint; `null` means "use the default". */
  readonly baseUrl: string | null;
  readonly logger: Logger;
  /** Wall-clock budget for one request, enforced by the adapter. */
  readonly timeoutMs: number;
  /**
   * Extra headers merged into every request.
   *
   * Exists so vendor-specific niceties — OpenRouter's attribution headers, an
   * Azure deployment's routing header — are supplied by configuration rather
   * than hard-coded in an adapter.
   */
  readonly headers: Readonly<Record<string, string>>;
}

/**
 * One vendor, one adapter, one entry in the factory's table.
 *
 * This is the whole extension surface: supporting a new vendor means writing a
 * file that exports one of these and adding it to `ADAPTERS`. Nothing above
 * this line — no agent, no skill, no config consumer — changes.
 */
export interface ProviderAdapter {
  readonly name: AIProviderName;
  /** Environment variable holding this vendor's credential, for error messages. */
  readonly apiKeyVariable: string;
  readonly version: string;
  readonly defaultModel: string;
  readonly defaultBaseUrl: string;
  readonly supportsNativeSchema: boolean;
  create(options: ProviderOptions): AIProvider;
}
