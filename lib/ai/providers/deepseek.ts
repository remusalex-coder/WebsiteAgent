/**
 * DeepSeek adapter.
 *
 * OpenAI-compatible Chat Completions at `api.deepseek.com` — DeepSeek's own
 * quick-start docs (fetched live, 2026-08-19) confirm the OpenAI SDK works
 * against this base URL unmodified, and that `reasoning_effort` is accepted
 * directly, so `toOpenAIEffort` (already shared with openai.ts/xai.ts) is
 * the right translation here too, not a new one.
 *
 * **Schema enforcement is instructed, not native.** DeepSeek's docs list a
 * "JSON Output" feature but do not document OpenAI's `json_schema` +
 * `strict: true` contract specifically — only that JSON mode exists. Rather
 * than assume an unverified guarantee, this follows openrouter.ts's pattern:
 * the schema rides in the system prompt and the response is validated
 * locally (`decodeStructured`). `supportsNativeSchema: false` records that
 * choice so callers don't rely on a strictness this adapter cannot back up.
 *
 * **Pricing** (OBSERVED, fetched live from api-docs.deepseek.com/quick_start/pricing,
 * 2026-08-19): off-peak, cache-miss rates — deepseek-v4-flash $0.22/$0.66 per
 * million (in/out), deepseek-v4-pro $0.66/$1.98. No free tier. Peak-hour
 * (01:00-04:00, 06:00-10:00 UTC) rates roughly double; the catalog entry
 * below uses the off-peak figure as the routing estimate, matching this
 * repo's existing doctrine that these numbers are for ranking, not billing.
 *
 * **Not yet live-tested** — built from DeepSeek's published API shape,
 * following this repository's own doctrine that an adapter's first real
 * call is its test.
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

const NAME = 'deepseek' as const;
const SOURCE = 'ai.deepseek';
const VERSION = '1.0.0';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';

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

function createDeepseekProvider(options: ProviderOptions): AIProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
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
          reasoning_effort: toOpenAIEffort(request.effort),
          messages: [
            // The schema rides in the system prompt; see the file header.
            { role: 'system', content: systemWithSchema(request, false) },
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
        structuredOutput: 'instructed',
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
  apiKeyVariable: 'DEEPSEEK_API_KEY',
  version: VERSION,
  // deepseek-v4-flash — the cheap/fast tier per api-docs.deepseek.com, OBSERVED live 2026-08-19.
  // BF_MODEL_DEEPSEEK overrides this the same way every other vendor's default id is overridable.
  defaultModel: 'deepseek-v4-flash',
  defaultBaseUrl: DEFAULT_BASE_URL,
  supportsNativeSchema: false,
  create: createDeepseekProvider,
};
