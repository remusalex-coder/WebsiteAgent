/**
 * Groq adapter.
 *
 * OpenAI-compatible Chat Completions at `api.groq.com/openai/v1` —
 * console.groq.com/docs/overview (fetched live, 2026-08-24) shows the OpenAI
 * SDK pointed at that base URL as the primary quick-start example, so this
 * reuses the same `postJson`/`toOpenAIEffort` transport `xai.ts`/`deepseek.ts`
 * already share rather than building a fourth copy.
 *
 * **Schema enforcement is native, but only for two models.**
 * console.groq.com/docs/structured-outputs (fetched live, 2026-08-24)
 * confirms `response_format: { type: 'json_schema', json_schema: { strict:
 * true, ... } }`, OpenAI-compatible, with the exact same "all fields
 * required, additionalProperties: false" schema shape OpenAI's strict mode
 * demands — but strict mode is documented as supported by exactly
 * `openai/gpt-oss-20b` and `openai/gpt-oss-120b`, not every model this
 * endpoint serves. `toStrictSchema` (already shared with openai.ts/xai.ts)
 * is the right normalizer for those two specifically, so `defaultModel`
 * below is pinned to one of them rather than a faster/cheaper model this
 * adapter cannot back a schema guarantee for.
 *
 * **Pricing** (ESTIMATED, not observed from a primary source): the live
 * fetch of groq.com/pricing returned no per-model rate table (client-rendered
 * page; the same shape of gap `models.ts` already documents for Cerebras).
 * Third-party aggregation (aipricing.guru, fetched 2026-08-24) puts
 * `openai/gpt-oss-120b` at roughly $0.15/$0.60 per million input/output
 * tokens — plausible and used as the catalog's routing estimate, but
 * unverified against Groq's own docs, hence `priceConfidence: 'estimated'`
 * in `models.ts`, matching this repository's own rule against promoting a
 * placeholder to a verified price without primary-source evidence.
 *
 * **The free tier is real and OBSERVED**, unlike the pricing:
 * console.groq.com/docs/rate-limits (fetched live, 2026-08-24) lists GPT-OSS
 * models at 30 requests/minute, 1,000 requests/day, 8,000 tokens/minute,
 * 200,000 tokens/day on the no-cost Developer plan — this is the free-tier
 * find the Provider Pool review flagged as worth adding, and the reason this
 * adapter exists: a second genuinely-free worker beside Gemini, addressing
 * the single-point-of-failure the Provider Pool review named.
 *
 * **Not yet live-tested** (2026-08-24) — built from Groq's published API
 * shape, following this repository's own doctrine that an adapter's first
 * real call is its test.
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
import { toStrictSchema } from './openai.js';

import type { HealthReport } from '../../platform/types.js';
import type {
  AIGenerateRequest,
  AIGenerateResult,
  AIProvider,
  ProviderAdapter,
  ProviderOptions,
} from '../types.js';

const NAME = 'groq' as const;
const SOURCE = 'ai.groq';
const VERSION = '1.0.0';

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';

const TRUNCATED = ['length'];

interface ChatResponse {
  readonly id?: unknown;
  readonly model?: unknown;
  readonly choices?: readonly {
    readonly finish_reason?: unknown;
    readonly message?: { readonly content?: unknown; readonly refusal?: unknown };
  }[];
  readonly usage?: {
    readonly prompt_tokens?: unknown;
    readonly completion_tokens?: unknown;
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function createGroqProvider(options: ProviderOptions): AIProvider {
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
          max_tokens: request.maxTokens,
          reasoning_effort: toOpenAIEffort(request.effort),
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
  apiKeyVariable: 'GROQ_API_KEY',
  version: VERSION,
  // openai/gpt-oss-120b — one of exactly two models Groq documents strict
  // json_schema support for (the other is the smaller -20b). Pinned here
  // rather than a faster model this adapter cannot back a schema guarantee
  // for. BF_MODEL_GROQ overrides this the same way every other vendor's
  // default id is overridable.
  defaultModel: 'openai/gpt-oss-120b',
  defaultBaseUrl: DEFAULT_BASE_URL,
  supportsNativeSchema: true,
  create: createGroqProvider,
};
