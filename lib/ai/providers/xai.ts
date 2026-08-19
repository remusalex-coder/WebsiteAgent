/**
 * xAI (Grok) adapter.
 *
 * OpenAI-compatible Chat Completions at `api.x.ai/v1` — xAI's own docs
 * describe the API as a drop-in replacement for the OpenAI SDK, including
 * `response_format: json_schema` with `strict: true`. This adapter reuses
 * `lib/ai/providers/openai.ts`'s `toStrictSchema` for exactly that reason:
 * the same `additionalProperties: false` / all-properties-required
 * requirement OpenAI's strict mode imposes is the one xAI's docs describe
 * too, so this is the same constraint, not a coincidentally similar one —
 * duplicating the normalizer here would be the second copy of one rule.
 *
 * No free tier: every model (`grok-4.6`, `grok-4.20`, …) is billed per
 * token. This adapter is real, working infrastructure the moment a key is
 * configured, but the capability layer's zero-budget-by-default policy
 * (`lib/capability/plan.ts`) keeps it unreachable by an autonomous run
 * unless a policy explicitly allows paid execution — the same gate every
 * other paid vendor in this repository sits behind.
 *
 * **Not yet live-tested** (2026-08-19): built from xAI's published API
 * shape, following this repository's own doctrine that an adapter's first
 * real call is its test. `max_tokens` is used rather than OpenAI's newer
 * `max_completion_tokens` — the more broadly-compatible field name across
 * OpenAI-compatible APIs that haven't adopted OpenAI's reasoning-specific
 * rename — but if Grok's reasoning models turn out to share OpenAI's
 * shared reasoning/output token pool, `maxCompletionTokensFor`'s reserve
 * (`lib/ai/protocol.ts`) is the fix to reapply here, exactly as it was
 * needed for OpenAI.
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

const NAME = 'xai' as const;
const SOURCE = 'ai.xai';
const VERSION = '1.0.0';

const DEFAULT_BASE_URL = 'https://api.x.ai/v1';

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

function createXaiProvider(options: ProviderOptions): AIProvider {
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
  apiKeyVariable: 'XAI_API_KEY',
  version: VERSION,
  // Grok 4.6 — the non-dated, broadly-available chat model per bf_research/xai_models.html.
  // BF_MODEL_XAI overrides this the same way every other vendor's default id is overridable.
  defaultModel: 'grok-4.6',
  defaultBaseUrl: DEFAULT_BASE_URL,
  supportsNativeSchema: true,
  create: createXaiProvider,
};
