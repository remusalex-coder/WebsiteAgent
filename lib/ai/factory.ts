/**
 * Provider selection.
 *
 * The factory is the only thing that knows which vendor a run is using. It
 * validates `AI_PROVIDER`, checks the matching credential is present,
 * constructs the provider once, and hands back the same instance thereafter —
 * so a client and its connection pool are not rebuilt per call.
 *
 * Validation lives here rather than in `loadConfig` on purpose: stages 1–3 need
 * no model at all, and a run that only scrapes should not be blocked by an
 * `AI_PROVIDER` typo. The failure arrives when a stage first asks for a model,
 * naming the variable to fix.
 *
 * Agents never import this module. They receive an `AIProvider` from the
 * platform, already selected and already credentialled.
 */

import {
  AgentError,
  MissingApiKeyError,
  MissingProviderError,
  UnsupportedProviderError,
} from '../errors.js';
import { NULL_SINK, createTelemetry } from '../platform/telemetry.js';
import { healthReport } from '../platform/types.js';
import { ADAPTERS } from './providers/index.js';
import { AI_PROVIDER_NAMES, isAIProviderName } from './types.js';

import type { AiConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { Telemetry } from '../platform/telemetry.js';
import type { CapabilityStatus } from '../platform/types.js';
import type { AIProvider, AIProviderName } from './types.js';

const SOURCE = 'ai.factory';

/**
 * The environment variable each provider's credential comes from.
 *
 * Derived from the adapter table rather than restated, so a new provider cannot
 * be added with its variable name missing or misspelled here.
 */
export const API_KEY_VARIABLES: Readonly<Record<AIProviderName, string>> = Object.fromEntries(
  AI_PROVIDER_NAMES.map((name) => [name, ADAPTERS[name].apiKeyVariable]),
) as Record<AIProviderName, string>;

/**
 * The one-line entry point: configuration in, selected provider out.
 *
 * For callers that want a model and nothing else — no status board, no second
 * vendor, no telemetry. The platform uses `createAIProviderFactory` instead,
 * because it needs all three.
 */
export function createAIProvider(config: AiConfig, logger: Logger): AIProvider {
  return createAIProviderFactory({ config, logger }).createDefault();
}

export interface AIProviderFactory {
  /** Every provider this build has an adapter for. */
  readonly supported: readonly AIProviderName[];
  /**
   * The provider `AI_PROVIDER` names. Throws when it is unset, unrecognised, or
   * uncredentialled — all three are environment mistakes with the same fix.
   */
  createDefault(): AIProvider;
  /** Constructs a named provider, bypassing `AI_PROVIDER`. */
  create(name: AIProviderName): AIProvider;
  /**
   * The selected provider, or `null` when it is unset, unknown or
   * uncredentialled. For callers that treat a model as optional.
   */
  tryCreateDefault(): AIProvider | null;
  /** Providers whose credential is actually configured. */
  configured(): readonly AIProviderName[];
  /** The validated selection, or `null` when `AI_PROVIDER` does not name one. */
  selected(): AIProviderName | null;
  /** Status rows for the platform health board — one per supported provider. */
  status(signal?: AbortSignal): Promise<readonly CapabilityStatus[]>;
}

export interface AIProviderFactoryOptions {
  readonly config: AiConfig;
  readonly logger: Logger;
  /** Optional so the layer can be used standalone; defaults to recording nothing. */
  readonly telemetry?: Telemetry;
}

export function createAIProviderFactory(options: AIProviderFactoryOptions): AIProviderFactory {
  const { config, logger } = options;
  const telemetry =
    options.telemetry ?? createTelemetry({ sink: NULL_SINK, sampleLimit: 1 });
  const instances = new Map<AIProviderName, AIProvider>();

  /** Validates `AI_PROVIDER` without throwing. */
  const selected = (): AIProviderName | null => {
    const raw = config.provider.trim().toLowerCase();
    return isAIProviderName(raw) ? raw : null;
  };

  /** Headers this vendor wants that are not credentials. */
  const headersFor = (name: AIProviderName): Readonly<Record<string, string>> => {
    if (name !== 'openrouter') return {};
    return {
      ...(config.openRouterReferer !== null ? { 'http-referer': config.openRouterReferer } : {}),
      ...(config.openRouterTitle !== null ? { 'x-title': config.openRouterTitle } : {}),
    };
  };

  /**
   * Retries a provider call that failed for a reason that may not repeat.
   *
   * Every adapter already classifies its failures honestly — a 429, a 5xx and a
   * transport error carry `retryable: true`; a 400, an auth failure and a
   * refusal carry `false` — and until now nothing consumed that. Two of five
   * generations in one batch died on `HTTP 503: this model is currently
   * experiencing high demand`, which is precisely the failure that costs a
   * customer their website for no reason.
   *
   * Wrapping here rather than in each adapter means one implementation for all
   * four vendors, and rather than in the orchestrator because a stage retry
   * would re-run a browser scrape to recover from a model hiccup.
   *
   * Exponential with full jitter: a spike is shared by every caller, so
   * retrying on a fixed schedule reconverges the herd onto the same instant.
   */
  const withRetry = (name: AIProviderName, provider: AIProvider): AIProvider => ({
    ...provider,
    async generate(request) {
      const scoped = logger.child(name);
      let lastError: unknown;

      for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
        try {
          return await provider.generate(request);
        } catch (error) {
          lastError = error;
          const retryable = error instanceof AgentError && error.retryable;
          const exhausted = attempt === config.maxRetries;
          // A cancelled run must not be resurrected by a retry.
          if (!retryable || exhausted || request.signal?.aborted === true) throw error;

          const ceiling = config.retryBaseDelayMs * 2 ** attempt;
          const delayMs = Math.round(Math.random() * ceiling);
          scoped.warn('provider call failed, retrying', {
            attempt: attempt + 1,
            of: config.maxRetries,
            delayMs,
            error: error instanceof Error ? error.message.slice(0, 160) : String(error),
          });
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
      throw lastError;
    },
  });

  const build = (name: AIProviderName): AIProvider => {
    const cached = instances.get(name);
    if (cached !== undefined) return cached;

    const adapter = ADAPTERS[name];
    const apiKey = config.apiKeys[name];
    if (apiKey === '') throw new MissingApiKeyError(name, adapter.apiKeyVariable, SOURCE);

    const provider = withRetry(name, adapter.create({
      apiKey,
      baseUrl: config.baseUrls[name],
      logger: logger.child(name),
      timeoutMs: config.requestTimeoutMs,
      headers: headersFor(name),
    }));

    logger.debug('ai provider constructed', {
      provider: name,
      version: adapter.version,
      nativeSchema: adapter.supportsNativeSchema,
      baseUrl: config.baseUrls[name] ?? adapter.defaultBaseUrl,
    });

    instances.set(name, provider);
    return provider;
  };

  const createDefault = (): AIProvider => {
    const raw = config.provider.trim();
    if (raw === '') throw new MissingProviderError(SOURCE);

    const name = selected();
    if (name === null) throw new UnsupportedProviderError(raw, AI_PROVIDER_NAMES, SOURCE);
    return build(name);
  };

  return {
    supported: AI_PROVIDER_NAMES,
    selected,
    create: build,
    createDefault,

    tryCreateDefault(): AIProvider | null {
      try {
        return createDefault();
      } catch {
        // The caller asked for "if available"; the reason is reported by
        // `status()` and by whichever stage requires a model.
        return null;
      }
    },

    configured(): readonly AIProviderName[] {
      return AI_PROVIDER_NAMES.filter((name) => config.apiKeys[name] !== '');
    },

    async status(signal?: AbortSignal): Promise<readonly CapabilityStatus[]> {
      const active = selected();

      return await Promise.all(
        AI_PROVIDER_NAMES.map(async (name): Promise<CapabilityStatus> => {
          const adapter = ADAPTERS[name];
          const credentialled = config.apiKeys[name] !== '';

          // Probing every credentialled provider would spend four round trips
          // to learn about three vendors nobody asked for. Only the selected
          // one is worth the latency.
          let health = healthReport('unknown', 'credentialled but not selected; not probed');
          if (!credentialled) {
            health = healthReport('unavailable', `${adapter.apiKeyVariable} is not set`);
          } else if (name === active) {
            health = await build(name).health(signal);
          }

          return {
            id: name,
            kind: 'provider',
            name: `${name} (${adapter.defaultModel})`,
            version: adapter.version,
            enabled: name === active,
            health,
            metrics: telemetry.metricsFor({ kind: 'provider', id: name }),
          };
        }),
      );
    },
  };
}
