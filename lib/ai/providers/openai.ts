/**
 * OpenAI adapter.
 *
 * Chat Completions over `fetch` — no SDK. The surface this needs (one POST,
 * `response_format: json_schema`, `reasoning_effort`) is small and stable, and
 * a dependency-free adapter is one fewer package to keep current.
 *
 * Schema enforcement is native: `strict: true` makes OpenAI reject its own
 * output rather than return something off-shape.
 *
 * ## `strict: true` has two structural requirements no other vendor imposes
 *
 * Found live (2026-08-19, `lib/forge`'s benchmark run): OpenAI's strict
 * structured-output mode rejects any schema that doesn't declare
 * `additionalProperties: false` on every object node, and separately
 * requires every key in `properties` to also appear in `required` (Gemini
 * and Anthropic impose neither constraint, so every schema in this
 * repository was written without them). Rather than editing every call
 * site's schema literal — grounding, the two-pass builder, repair, and
 * whatever is added later — `toStrictSchema` normalizes the schema at this
 * one boundary, on the way out, only for OpenAI. Nothing else changes: the
 * original schema (with its real optional fields) still governs
 * `decodeStructured`'s validation of the response, and every other
 * provider still receives the schema exactly as its call site wrote it.
 *
 * ## `max_completion_tokens` is one shared pool for reasoning and output
 *
 * Also found live: a reasoning-effort request sized for Gemini's
 * `maxTokens` alone can be entirely consumed by internal reasoning tokens
 * before any visible output is written, truncating with zero result.
 * `toOpenAIReasoningReserve` adds headroom on top of the caller's requested
 * output size — see its own docstring for why Gemini never has this
 * problem. The caller's `maxTokens` still means "visible output tokens
 * needed"; this adapter is the one place that knows OpenAI needs more than
 * that number in the ceiling it sends.
 */

import { ProviderRequestError } from '../../errors.js';
import { probeEndpoint } from '../http.js';
import {
  assertComplete,
  decodeStructured,
  postJson,
  systemWithSchema,
  toOpenAIEffort,
  toOpenAIReasoningReserve,
} from '../protocol.js';

import type { HealthReport } from '../../platform/types.js';
import type {
  AIGenerateRequest,
  AIGenerateResult,
  AIProvider,
  ProviderAdapter,
  ProviderOptions,
} from '../types.js';

const NAME = 'openai' as const;
const SOURCE = 'ai.openai';
const VERSION = '1.0.0';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/** Finish reasons that mean the object is incomplete rather than merely odd. */
const TRUNCATED = ['length'];

/* ------------------------------------------------------------------ */
/* Response shape                                                      */
/* ------------------------------------------------------------------ */

interface ChatResponse {
  readonly id?: unknown;
  readonly model?: unknown;
  readonly choices?: readonly {
    readonly finish_reason?: unknown;
    readonly message?: {
      readonly content?: unknown;
      readonly refusal?: unknown;
    };
  }[];
  readonly usage?: {
    readonly prompt_tokens?: unknown;
    readonly completion_tokens?: unknown;
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** The `max_completion_tokens` ceiling to send: the caller's requested output, plus reasoning headroom. */
export function maxCompletionTokensFor(request: Pick<AIGenerateRequest, 'maxTokens' | 'effort'>): number {
  return request.maxTokens + toOpenAIReasoningReserve(request.effort);
}

/**
 * OpenAI only accepts `reasoning_effort` on reasoning models (o1/o3/o4 and
 * their variants). Sending it to a non-reasoning model (gpt-4o, gpt-4o-mini,
 * gpt-5 family) returns HTTP 400 "Unrecognized request argument supplied:
 * reasoning_effort", which silently breaks every OpenAI call on this
 * deployment. Gate the field on a model-name prefix whitelist so the adapter
 * works for both model classes.
 */
const REASONING_MODEL_PREFIXES = ['o1', 'o3', 'o4', 'o1-', 'o3-', 'o4-'];
function modelSupportsReasoningEffort(model: string): boolean {
  const m = model.toLowerCase();
  return REASONING_MODEL_PREFIXES.some((p) => m.startsWith(p));
}

/**
 * Normalizes a JSON Schema for OpenAI's `strict: true` mode: every object
 * node gets `additionalProperties: false`, and every key in `properties`
 * is added to `required` (OpenAI's strict mode has no notion of an
 * optional property — a field that should be skippable has to be typed to
 * accept it, not omitted from `required`; this normalizer does not attempt
 * that rewrite, so a genuinely-optional field becomes an always-present one
 * the model may answer with an empty value, which is what every schema in
 * this repository already tolerates).
 *
 * Recurses into `properties`, array `items`, and the schema-combinators
 * (`anyOf`/`oneOf`/`allOf`) so a nested object anywhere in the tree is
 * covered, not just the top level.
 */
export function toStrictSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toStrictSchema);
  if (schema === null || typeof schema !== 'object') return schema;

  const input = schema as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = toStrictSchema(value);
  }

  const properties = output['properties'];
  if (properties !== null && typeof properties === 'object' && !Array.isArray(properties)) {
    output['additionalProperties'] = false;
    output['required'] = Object.keys(properties as Record<string, unknown>);
  }

  return output;
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

function createOpenAIProvider(options: ProviderOptions): AIProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const headers = { authorization: `Bearer ${options.apiKey}`, ...options.headers };

  return {
    name: NAME,
    version: VERSION,
    defaultModel: adapter.defaultModel,
    supportsNativeSchema: true,

    async generate(request: AIGenerateRequest): Promise<AIGenerateResult> {
      const raw = (await postJson(NAME, SOURCE, {
        url: `${baseUrl}/chat/completions`,
        headers,
        timeoutMs: options.timeoutMs,
        signal: request.signal,
        body: {
          model: request.model,
          max_completion_tokens: maxCompletionTokensFor(request),
          ...(modelSupportsReasoningEffort(request.model)
            ? { reasoning_effort: toOpenAIEffort(request.effort) }
            : {}),
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: request.schemaName ?? 'result',
              strict: true,
              schema: toStrictSchema(request.schema),
            },
          },
          messages: [
            { role: 'system', content: systemWithSchema(request, true) },
            { role: 'user', content: request.prompt },
          ],
        },
      })) as ChatResponse;

      const choice = raw.choices?.[0];
      if (choice === undefined) {
        throw new ProviderRequestError(NAME, 'the response contained no choices', {
          source: SOURCE,
          retryable: true,
        });
      }

      // A refusal is a first-class field here rather than a stop reason, and it
      // arrives with `content` empty — so it has to be checked before parsing.
      if (typeof choice.message?.refusal === 'string' && choice.message.refusal !== '') {
        throw new ProviderRequestError(
          NAME,
          `the model declined this request: ${choice.message.refusal}`,
          { source: SOURCE, retryable: false },
        );
      }

      const finishReason = typeof choice.finish_reason === 'string' ? choice.finish_reason : null;
      assertComplete(NAME, SOURCE, finishReason, TRUNCATED, maxCompletionTokensFor(request));

      const content = choice.message?.content;
      if (typeof content !== 'string') {
        throw new ProviderRequestError(NAME, 'the response carried no text content', {
          source: SOURCE,
          retryable: true,
        });
      }

      return {
        data: decodeStructured(NAME, SOURCE, content, request.schema),
        model: typeof raw.model === 'string' ? raw.model : request.model,
        usage: {
          inputTokens: numberOrNull(raw.usage?.prompt_tokens),
          outputTokens: numberOrNull(raw.usage?.completion_tokens),
        },
        structuredOutput: 'native',
        finishReason,
        requestId: typeof raw.id === 'string' ? raw.id : null,
      };
    },

    health(signal?: AbortSignal): Promise<HealthReport> {
      return probeEndpoint({
        url: `${baseUrl}/models`,
        headers,
        timeoutMs: options.timeoutMs,
        credentialVariable: adapter.apiKeyVariable,
        ...(signal !== undefined ? { signal } : {}),
      });
    },
  };
}

export const adapter: ProviderAdapter = {
  name: NAME,
  apiKeyVariable: 'OPENAI_API_KEY',
  version: VERSION,
  // Kept in step with DEFAULT_MODELS in lib/config.ts, which is what the stages
  // actually default to; this one labels the provider on the status board.
  defaultModel: 'gpt-5',
  defaultBaseUrl: DEFAULT_BASE_URL,
  supportsNativeSchema: true,
  create: createOpenAIProvider,
};
