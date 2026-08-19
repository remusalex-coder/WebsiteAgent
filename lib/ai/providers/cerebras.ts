/**
 * Cerebras adapter.
 *
 * OpenAI-compatible Chat Completions at `api.cerebras.ai/v1`, in front of
 * Cerebras's own wafer-scale inference hardware rather than a hosted vendor
 * model — the pitch is raw tokens/sec, not a new model family. Catalog
 * fetched live from inference-docs.cerebras.ai (2026-08-19) lists exactly
 * two models on the shared/free tier: `gpt-oss-120b` (OpenAI's open-weight
 * reasoning model — same family xai.ts and openai.ts already speak
 * `reasoning_effort` to) and `gemma-4-31b`.
 *
 * **Schema enforcement is instructed, not native.** Cerebras's own model
 * catalog leaves structured-output support unspecified per-model. Rather
 * than assume the `json_schema` + `strict: true` contract OpenAI/xAI
 * document explicitly, this follows openrouter.ts's/deepseek.ts's pattern:
 * schema in the system prompt, response validated locally.
 * `supportsNativeSchema: false` records that choice.
 *
 * **Pricing: UNKNOWN.** Neither cerebras.ai/pricing nor the inference docs
 * publish a per-model, per-million-token rate on a static page (checked
 * live, 2026-08-19) — the bf_research corpus itself flags Cerebras as
 * "not deep-dived" for the same reason. What IS observed: a "$5 in free
 * credits" trial and a "$10 self-serve minimum" Developer tier — a wallet
 * balance, not a `{requestsPerDay, requestsPerMinute}` free allowance, so
 * it doesn't fit `ModelRecord.freeAllowance`'s shape and isn't claimed as
 * one. The catalog entry below carries a placeholder cost figure inferred
 * from public knowledge of comparable open-weight-model hosting, explicitly
 * NOT sourced from a fetched page — treat it as a rough upper bound for
 * ranking, not a quote, and re-verify before ever enabling paid execution
 * for this vendor (the zero-budget-by-default policy in `lib/capability/
 * plan.ts` keeps it unreachable either way until a human opts in).
 *
 * **Not yet live-tested** — built from Cerebras's published API shape,
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

const NAME = 'cerebras' as const;
const SOURCE = 'ai.cerebras';
const VERSION = '1.0.0';

const DEFAULT_BASE_URL = 'https://api.cerebras.ai/v1';

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

function createCerebrasProvider(options: ProviderOptions): AIProvider {
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
  apiKeyVariable: 'CEREBRAS_API_KEY',
  version: VERSION,
  // gpt-oss-120b — the reasoning-capable model in Cerebras's own catalog, OBSERVED live 2026-08-19.
  // BF_MODEL_CEREBRAS overrides this the same way every other vendor's default id is overridable.
  defaultModel: 'gpt-oss-120b',
  defaultBaseUrl: DEFAULT_BASE_URL,
  supportsNativeSchema: false,
  create: createCerebrasProvider,
};
