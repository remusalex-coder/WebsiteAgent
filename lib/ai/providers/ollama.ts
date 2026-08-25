/**
 * Ollama adapter — a local, free, credential-free model, reached over the
 * loopback network rather than a vendor's cloud API.
 *
 * ## Live-verified, not just built from docs
 *
 * Unlike most adapters in this table (which follow the "first real call is
 * its test" doctrine, i.e. are built from published API shapes and verified
 * by their own test's live-gated case), this one was verified interactively
 * before being written: `curl http://localhost:11434/api/tags` confirmed a
 * running server with model `gemma4:26b` (2026-08-25, against the actual
 * Windows host this deployment's BusinessForge runtime executes on — see
 * `docs/WORK_QUEUE.json`'s Ollama integration task for the topology
 * reasoning), and a real `POST /api/chat` with `format: "json"` returned:
 *
 *   { model, created_at,
 *     message: { role: "assistant", content: "{...}", thinking: "..." },
 *     done: true, done_reason: "stop",
 *     total_duration, load_duration,
 *     prompt_eval_count, prompt_eval_duration, eval_count, eval_duration }
 *
 * Two things that live call settled: (1) `message.content` is the structured
 * payload — `message.thinking` is a separate reasoning trace and must never
 * be parsed as the response; (2) real latency for a trivial 200-in/12-out
 * call was ~40 seconds (`total_duration` ≈ 38s, of which 7.65s was prompt
 * evaluation alone). A second, later measurement went through this actual
 * adapter end-to-end (health() + generate(), real HTTP, no stub) rather than
 * a raw curl call: 453-in/12-out (this adapter's system prompt carries the
 * schema instruction, so the input is heavier) took ~79 seconds. Both
 * numbers agree on the order of magnitude — tens of seconds, not hundreds of
 * milliseconds — which is what actually matters for routing; treat either as
 * a rough figure, not a guaranteed one, since neither was a warm-cache best
 * case. That is why `AI_PROVIDER_NAMES` and `FREE_TIER`
 * (`lib/factory/pool.ts`) both place `ollama` last: with no live telemetry
 * yet recorded, the router's tie-break falls back to declaration order
 * (`lib/ai/router.ts`), and once telemetry accumulates its real latency will
 * keep it ranked last on merit. It belongs in a chain as a free, always-
 * available last resort, never as a fast primary.
 *
 * ## No credential, and `apiKey` is never sent
 *
 * Ollama takes no API key — it is a local, loopback-only server. The whole
 * platform's "is this provider usable" gate is `config.apiKeys[name] !== ''`
 * (`lib/ai/factory.ts`), so rather than special-case a credential-free vendor
 * through every caller of that gate, this adapter reuses it: `OLLAMA_ENABLED`
 * (any non-empty value) becomes `apiKeys.ollama`, purely as an opt-in flag —
 * an operator without a local Ollama running should not have this adapter
 * attempted by default. `ProviderOptions.apiKey` therefore holds that flag
 * value here, not a secret, and this adapter deliberately never places it in
 * a header or the request body. `OLLAMA_BASE_URL` is genuinely optional —
 * unset, `baseUrl` below falls back to the default local address.
 *
 * ## Structured output is instructed, not native
 *
 * `format: "json"` guarantees syntactically valid JSON, not schema
 * conformance — Ollama's docs describe it as "the model's output will be
 * valid JSON", nothing more specific. Per this repo's doctrine of not
 * claiming an unverified guarantee (matches deepseek.ts, openrouter.ts), the
 * schema rides in the system prompt and the response is validated locally.
 *
 * ## Effort is not mapped
 *
 * The live-tested response carried a `message.thinking` trace unprompted,
 * with no request-side control exercised. Ollama's `/api/chat` does accept a
 * `think` field for some models, but its exact semantics for the model this
 * deployment actually runs were not exercised by the live call this adapter
 * is built from — so, following the same "don't guess at an unverified
 * shape" doctrine as `visionInvoker.ts`'s unimplemented vendors, `effort` is
 * accepted (the contract requires it) and silently not translated into a
 * request parameter, rather than wired to a knob nobody has confirmed does
 * what its name suggests for this model.
 */

import { ProviderRequestError } from '../../errors.js';
import { probeEndpoint } from '../http.js';
import {
  assertComplete,
  decodeStructured,
  postJson,
  systemWithSchema,
} from '../protocol.js';

import type { HealthReport } from '../../platform/types.js';
import type {
  AIGenerateRequest,
  AIGenerateResult,
  AIProvider,
  ProviderAdapter,
  ProviderOptions,
} from '../types.js';

const NAME = 'ollama' as const;
const SOURCE = 'ai.ollama';
const VERSION = '1.0.0';

const DEFAULT_BASE_URL = 'http://localhost:11434';

const TRUNCATED = ['length'];

interface ChatResponse {
  readonly model?: unknown;
  readonly message?: { readonly content?: unknown; readonly thinking?: unknown };
  readonly done?: unknown;
  readonly done_reason?: unknown;
  readonly prompt_eval_count?: unknown;
  readonly eval_count?: unknown;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function createOllamaProvider(options: ProviderOptions): AIProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  // No `authorization` header: `options.apiKey` is the `OLLAMA_ENABLED` opt-in
  // flag, not a secret — see the file header. Only caller-supplied extra
  // headers (if any) are forwarded.
  const headers = { ...options.headers };

  return {
    name: NAME,
    version: VERSION,
    defaultModel: adapter.defaultModel,
    supportsNativeSchema: false,

    async generate(request: AIGenerateRequest): Promise<AIGenerateResult> {
      const raw = (await postJson(NAME, SOURCE, {
        url: `${baseUrl}/api/chat`,
        headers,
        timeoutMs: options.timeoutMs,
        signal: request.signal,
        body: {
          model: request.model,
          stream: false,
          format: 'json',
          options: { num_predict: request.maxTokens },
          messages: [
            // The schema rides in the system prompt; see the file header.
            { role: 'system', content: systemWithSchema(request, false) },
            { role: 'user', content: request.prompt },
          ],
        },
      })) as ChatResponse;

      const content = raw.message?.content;
      if (typeof content !== 'string') {
        throw new ProviderRequestError(NAME, 'the response carried no message content', {
          source: SOURCE,
          retryable: true,
        });
      }

      const finishReason = typeof raw.done_reason === 'string' ? raw.done_reason : null;
      assertComplete(NAME, SOURCE, finishReason, TRUNCATED, request.maxTokens);

      return {
        data: decodeStructured(NAME, SOURCE, content, request.schema),
        model: typeof raw.model === 'string' ? raw.model : request.model,
        usage: {
          inputTokens: numberOrNull(raw.prompt_eval_count),
          outputTokens: numberOrNull(raw.eval_count),
        },
        structuredOutput: 'instructed',
        finishReason,
        requestId: null,
      };
    },

    health(signal?: AbortSignal): Promise<HealthReport> {
      return probeEndpoint({
        url: `${baseUrl}/api/tags`,
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
  apiKeyVariable: 'OLLAMA_ENABLED',
  version: VERSION,
  // The model live-verified running on 2026-08-25 (`ollama list` /
  // `/api/tags`). BF_MODEL_OLLAMA overrides this the same way every other
  // vendor's default id is overridable.
  defaultModel: 'gemma4:26b',
  defaultBaseUrl: DEFAULT_BASE_URL,
  supportsNativeSchema: false,
  create: createOllamaProvider,
};
