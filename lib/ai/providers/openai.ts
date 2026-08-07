/**
 * OpenAI adapter.
 *
 * Chat Completions over `fetch` — no SDK. The surface this needs (one POST,
 * `response_format: json_schema`, `reasoning_effort`) is small and stable, and
 * a dependency-free adapter is one fewer package to keep current.
 *
 * Schema enforcement is native: `strict: true` makes OpenAI reject its own
 * output rather than return something off-shape.
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
          max_completion_tokens: request.maxTokens,
          reasoning_effort: toOpenAIEffort(request.effort),
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: request.schemaName ?? 'result',
              strict: true,
              schema: request.schema,
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
      assertComplete(NAME, SOURCE, finishReason, TRUNCATED, request.maxTokens);

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
