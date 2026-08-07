/**
 * OpenRouter adapter.
 *
 * OpenAI-compatible Chat Completions in front of hundreds of models from
 * dozens of vendors. That breadth is the reason this adapter is *not* a thin
 * copy of the OpenAI one:
 *
 * **Schema enforcement is instructed, not native.** OpenRouter forwards
 * `response_format` only to upstreams that implement it, and which model a
 * request lands on is a routing decision. Claiming native enforcement would
 * make the guarantee depend on today's routing table. Instead the schema is
 * supplied in the prompt and the response is validated locally, which holds for
 * every model on the platform. The object handed back is identical either way;
 * only `structuredOutput` in the result differs, and it is logged.
 */

import { ProviderRequestError } from '../../errors.js';
import { probeEndpoint } from '../http.js';
import {
  assertComplete,
  decodeStructured,
  postJson,
  systemWithSchema,
  toOpenAIEffort,
} from '../protocol.js';

import type { HealthReport } from '../../platform/types.js';
import type {
  AIGenerateRequest,
  AIGenerateResult,
  AIProvider,
  ProviderAdapter,
  ProviderOptions,
} from '../types.js';

const NAME = 'openrouter' as const;
const SOURCE = 'ai.openrouter';
const VERSION = '1.0.0';

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

const TRUNCATED = ['length'];

/* ------------------------------------------------------------------ */
/* Response shape                                                      */
/* ------------------------------------------------------------------ */

interface ChatResponse {
  readonly model?: unknown;
  readonly choices?: readonly {
    readonly finish_reason?: unknown;
    readonly native_finish_reason?: unknown;
    readonly message?: { readonly content?: unknown; readonly refusal?: unknown };
  }[];
  readonly usage?: {
    readonly prompt_tokens?: unknown;
    readonly completion_tokens?: unknown;
  };
  /** OpenRouter reports upstream failures in-band, with HTTP 200. */
  readonly error?: { readonly message?: unknown; readonly code?: unknown };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

function createOpenRouterProvider(options: ProviderOptions): AIProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  // `options.headers` carries OpenRouter's optional attribution pair
  // (`http-referer`, `x-title`) when configuration supplies them.
  const headers = { authorization: `Bearer ${options.apiKey}`, ...options.headers };

  return {
    name: NAME,
    version: VERSION,
    defaultModel: adapter.defaultModel,
    supportsNativeSchema: false,

    async generate(request: AIGenerateRequest): Promise<AIGenerateResult> {
      const raw = (await postJson(NAME, SOURCE, {
        url: `${baseUrl}/chat/completions`,
        headers,
        timeoutMs: options.timeoutMs,
        signal: request.signal,
        body: {
          model: request.model,
          max_tokens: request.maxTokens,
          reasoning: { effort: toOpenAIEffort(request.effort) },
          messages: [
            // The schema rides in the system prompt; see the file header.
            { role: 'system', content: systemWithSchema(request, false) },
            { role: 'user', content: request.prompt },
          ],
        },
      })) as ChatResponse;

      // An upstream failure comes back as HTTP 200 with an `error` member, so
      // `postJson`'s status check cannot catch it.
      if (raw.error !== undefined) {
        const message =
          typeof raw.error.message === 'string' ? raw.error.message : 'upstream model error';
        const code = numberOrNull(raw.error.code);
        throw new ProviderRequestError(NAME, message, {
          source: SOURCE,
          ...(code !== null ? { status: code } : {}),
          retryable: code === null || code === 429 || code >= 500,
        });
      }

      const choice = raw.choices?.[0];
      if (choice === undefined) {
        throw new ProviderRequestError(NAME, 'the response contained no choices', {
          source: SOURCE,
          retryable: true,
        });
      }

      if (typeof choice.message?.refusal === 'string' && choice.message.refusal !== '') {
        throw new ProviderRequestError(
          NAME,
          `the model declined this request: ${choice.message.refusal}`,
          { source: SOURCE, retryable: false },
        );
      }

      const finishReason = typeof choice.finish_reason === 'string' ? choice.finish_reason : null;
      assertComplete(NAME, SOURCE, finishReason, TRUNCATED, request.maxTokens);

      const content = choice.message?.content;
      if (typeof content !== 'string') {
        throw new ProviderRequestError(NAME, 'the response carried no text content', {
          source: SOURCE,
          retryable: true,
        });
      }

      return {
        // Local validation is the only guarantee in instructed mode, so a
        // response that drifts from the schema fails here rather than downstream.
        data: decodeStructured(NAME, SOURCE, content, request.schema),
        // Which model actually served the request is a routing outcome — always
        // prefer what the response reports over what was asked for.
        model: typeof raw.model === 'string' ? raw.model : request.model,
        usage: {
          inputTokens: numberOrNull(raw.usage?.prompt_tokens),
          outputTokens: numberOrNull(raw.usage?.completion_tokens),
        },
        structuredOutput: 'instructed',
        finishReason,
      };
    },

    health(signal?: AbortSignal): Promise<HealthReport> {
      // `/key` validates the credential itself; `/models` answers without one.
      return probeEndpoint({
        url: `${baseUrl}/key`,
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
  apiKeyVariable: 'OPENROUTER_API_KEY',
  version: VERSION,
  // Kept in step with DEFAULT_MODELS in lib/config.ts.
  defaultModel: 'openai/gpt-5',
  defaultBaseUrl: DEFAULT_BASE_URL,
  supportsNativeSchema: false,
  create: createOpenRouterProvider,
};
