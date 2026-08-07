/**
 * Anthropic adapter.
 *
 * The only adapter that uses a vendor SDK rather than raw HTTP, because the
 * features this pipeline depends on — adaptive thinking, server-side fallbacks,
 * `output_config.effort`, native JSON-schema enforcement — live behind beta
 * headers that are not worth hand-rolling.
 *
 * This is also the only file in the repository permitted to import
 * `@anthropic-ai/sdk`. Agents ask the platform for a provider; which vendor
 * answers, and what its SDK is called, stops here.
 */

import Anthropic from '@anthropic-ai/sdk';

import { ProviderRequestError } from '../../errors.js';
import { healthReport } from '../../platform/types.js';
import { decodeStructured } from '../protocol.js';

import type { HealthReport } from '../../platform/types.js';
import type {
  AIGenerateRequest,
  AIGenerateResult,
  AIProvider,
  ProviderAdapter,
  ProviderOptions,
} from '../types.js';

const NAME = 'anthropic' as const;
const SOURCE = 'ai.anthropic';
const VERSION = '1.0.0';

/**
 * Opt into server-side fallbacks.
 *
 * Claude Opus 5's safety classifiers can decline a request; `"default"` re-runs
 * the declined request on Anthropic's recommended substitute rather than
 * handing back a refusal. Business analysis is benign, but a listing can carry
 * arbitrary third-party text, so the cost of being wrong here is a failed run.
 */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

/* ------------------------------------------------------------------ */
/* Error mapping                                                       */
/* ------------------------------------------------------------------ */

/** Turns SDK errors into the pipeline's own taxonomy, preserving retryability. */
function toProviderError(error: unknown): ProviderRequestError {
  if (error instanceof ProviderRequestError) return error;

  if (error instanceof Anthropic.RateLimitError) {
    return new ProviderRequestError(NAME, 'rate limited', {
      source: SOURCE,
      status: error.status,
      retryable: true,
      cause: error,
    });
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new ProviderRequestError(NAME, 'ANTHROPIC_API_KEY was rejected', {
      source: SOURCE,
      status: error.status,
      retryable: false,
      cause: error,
    });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ProviderRequestError(NAME, 'could not reach the Claude API', {
      source: SOURCE,
      retryable: true,
      cause: error,
    });
  }
  if (error instanceof Anthropic.APIError) {
    return new ProviderRequestError(NAME, error.message, {
      source: SOURCE,
      status: error.status,
      // 4xx other than 429 will fail again unchanged.
      retryable: error.status === undefined || error.status >= 500,
      cause: error,
    });
  }
  return new ProviderRequestError(NAME, error instanceof Error ? error.message : String(error), {
    source: SOURCE,
    retryable: false,
    cause: error,
  });
}

function textOf(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

function createAnthropicProvider(options: ProviderOptions): AIProvider {
  const client = new Anthropic({
    apiKey: options.apiKey,
    timeout: options.timeoutMs,
    ...(options.baseUrl !== null ? { baseURL: options.baseUrl } : {}),
  });

  return {
    name: NAME,
    version: VERSION,
    defaultModel: adapter.defaultModel,
    supportsNativeSchema: true,

    async generate(request: AIGenerateRequest): Promise<AIGenerateResult> {
      let message: Anthropic.Beta.BetaMessage;
      try {
        // Streaming because max_tokens is large: on Claude Opus 5 it caps
        // thinking and response text together, and a non-streaming request that
        // size risks an HTTP timeout.
        const stream = client.beta.messages.stream(
          {
            model: request.model,
            max_tokens: request.maxTokens,
            betas: [FALLBACK_BETA],
            fallbacks: 'default',
            thinking: { type: 'adaptive' },
            output_config: {
              effort: request.effort,
              format: { type: 'json_schema', schema: request.schema },
            },
            system: request.system,
            messages: [{ role: 'user', content: request.prompt }],
          },
          request.signal !== undefined ? { signal: request.signal } : {},
        );
        message = await stream.finalMessage();
      } catch (error) {
        throw toProviderError(error);
      }

      // Check why generation stopped before reading content: a refusal carries
      // no usable text, and a truncated response parses as broken JSON.
      if (message.stop_reason === 'refusal') {
        throw new ProviderRequestError(NAME, 'the model declined this request', {
          source: SOURCE,
          retryable: false,
        });
      }
      if (message.stop_reason === 'max_tokens') {
        throw new ProviderRequestError(
          NAME,
          `generation was cut off at ${request.maxTokens} tokens; raise the stage's max output tokens or lower its effort`,
          { source: SOURCE, retryable: false },
        );
      }

      return {
        data: decodeStructured(NAME, SOURCE, textOf(message), request.schema),
        // `message.model` rather than the requested id: a fallback may have served it.
        model: message.model,
        usage: {
          inputTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
        structuredOutput: 'native',
        finishReason: message.stop_reason,
      };
    },

    async health(signal?: AbortSignal): Promise<HealthReport> {
      const startedAt = Date.now();
      try {
        // Listing models costs no tokens and exercises the credential.
        await client.models.list(
          { limit: 1 },
          signal !== undefined ? { signal } : {},
        );
        return healthReport('ready', 'Claude API reachable, credential accepted', Date.now() - startedAt);
      } catch (error) {
        const mapped = toProviderError(error);
        return healthReport(
          'unavailable',
          mapped.message,
          Date.now() - startedAt,
        );
      }
    },
  };
}

export const adapter: ProviderAdapter = {
  name: NAME,
  apiKeyVariable: 'ANTHROPIC_API_KEY',
  version: VERSION,
  defaultModel: 'claude-opus-5',
  defaultBaseUrl: 'https://api.anthropic.com',
  supportsNativeSchema: true,
  create: createAnthropicProvider,
};
