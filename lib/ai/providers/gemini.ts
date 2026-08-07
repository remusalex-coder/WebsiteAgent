/**
 * Google Gemini adapter.
 *
 * `generateContent` over `fetch`. Two things make this vendor different from
 * the other three, and both are handled in the layers below rather than by the
 * caller:
 *
 *   - its schema dialect is an OpenAPI 3.0 subset, not JSON Schema, so the
 *     request schema is translated by `toGeminiSchema` on the way out;
 *   - reasoning depth is a token budget, not a label, so `Effort` is mapped to
 *     a `thinkingBudget` by `toGeminiThinkingBudget`.
 *
 * The response is still validated against the *original* JSON Schema, because
 * the translation drops constraints Gemini cannot express — validating against
 * the reduced copy would let those omissions through.
 */

import { ProviderRequestError } from '../../errors.js';
import { probeEndpoint } from '../http.js';
import {
  assertComplete,
  decodeStructured,
  postJson,
  systemWithSchema,
  toGeminiThinkingBudget,
} from '../protocol.js';
import { toGeminiSchema } from '../schema.js';

import type { HealthReport } from '../../platform/types.js';
import type {
  AIGenerateRequest,
  AIGenerateResult,
  AIProvider,
  ProviderAdapter,
  ProviderOptions,
} from '../types.js';

const NAME = 'gemini' as const;
const SOURCE = 'ai.gemini';
const VERSION = '1.0.0';

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const TRUNCATED = ['MAX_TOKENS'];

/** Finish reasons that mean the request was rejected on content grounds. */
const REFUSED = ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'RECITATION'];

/* ------------------------------------------------------------------ */
/* Response shape                                                      */
/* ------------------------------------------------------------------ */

interface GenerateContentResponse {
  readonly modelVersion?: unknown;
  readonly candidates?: readonly {
    readonly finishReason?: unknown;
    readonly content?: {
      readonly parts?: readonly { readonly text?: unknown }[];
    };
  }[];
  readonly promptFeedback?: { readonly blockReason?: unknown };
  readonly usageMetadata?: {
    readonly promptTokenCount?: unknown;
    readonly candidatesTokenCount?: unknown;
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

function createGeminiProvider(options: ProviderOptions): AIProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  // The key travels in a header, never in the query string.
  const headers = { 'x-goog-api-key': options.apiKey, ...options.headers };

  return {
    name: NAME,
    version: VERSION,
    defaultModel: adapter.defaultModel,
    supportsNativeSchema: true,

    async generate(request: AIGenerateRequest): Promise<AIGenerateResult> {
      const raw = (await postJson(NAME, SOURCE, {
        url: `${baseUrl}/models/${encodeURIComponent(request.model)}:generateContent`,
        headers,
        timeoutMs: options.timeoutMs,
        signal: request.signal,
        body: {
          systemInstruction: { parts: [{ text: systemWithSchema(request, true) }] },
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          generationConfig: {
            maxOutputTokens: request.maxTokens,
            responseMimeType: 'application/json',
            responseSchema: toGeminiSchema(request.schema),
            thinkingConfig: { thinkingBudget: toGeminiThinkingBudget(request.effort) },
          },
        },
      })) as GenerateContentResponse;

      // A prompt blocked before generation yields no candidates at all.
      const blockReason = raw.promptFeedback?.blockReason;
      if (typeof blockReason === 'string' && blockReason !== '') {
        throw new ProviderRequestError(NAME, `the prompt was blocked: ${blockReason}`, {
          source: SOURCE,
          retryable: false,
        });
      }

      const candidate = raw.candidates?.[0];
      if (candidate === undefined) {
        throw new ProviderRequestError(NAME, 'the response contained no candidates', {
          source: SOURCE,
          retryable: true,
        });
      }

      const finishReason =
        typeof candidate.finishReason === 'string' ? candidate.finishReason : null;

      if (finishReason !== null && REFUSED.includes(finishReason)) {
        throw new ProviderRequestError(
          NAME,
          `the model declined this request (finish reason "${finishReason}")`,
          { source: SOURCE, retryable: false },
        );
      }
      assertComplete(NAME, SOURCE, finishReason, TRUNCATED, request.maxTokens);

      // Gemini splits a long answer across parts; concatenation is the whole text.
      const text = (candidate.content?.parts ?? [])
        .map((part) => (typeof part.text === 'string' ? part.text : ''))
        .join('');

      if (text === '') {
        throw new ProviderRequestError(NAME, 'the response carried no text content', {
          source: SOURCE,
          retryable: true,
        });
      }

      return {
        // Validated against the caller's schema, not the translated one.
        data: decodeStructured(NAME, SOURCE, text, request.schema),
        model: typeof raw.modelVersion === 'string' ? raw.modelVersion : request.model,
        usage: {
          inputTokens: numberOrNull(raw.usageMetadata?.promptTokenCount),
          outputTokens: numberOrNull(raw.usageMetadata?.candidatesTokenCount),
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
  apiKeyVariable: 'GEMINI_API_KEY',
  version: VERSION,
  defaultModel: 'gemini-2.5-pro',
  defaultBaseUrl: DEFAULT_BASE_URL,
  supportsNativeSchema: true,
  create: createGeminiProvider,
};
