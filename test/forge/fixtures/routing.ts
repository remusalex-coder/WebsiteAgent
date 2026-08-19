/**
 * Shared test routing for `lib/forge`'s capability-routed stages.
 *
 * Mirrors `test/design/designDirectorAgent.test.ts`'s `fakeOrchestrator`
 * pattern deliberately: `plan`/`run` are the *real* `planCapability` /
 * `executeCapability` — genuine filtering, ranking, failover, quota and
 * budget enforcement — with only the provider factory substituted for a
 * fake that returns canned responses instead of making a network call.
 * That is what makes these tests prove a stage actually routes through the
 * capability layer, rather than merely calling a fake `.run()` that no
 * production code path resembles.
 */

import { createRateGovernor } from '../../../lib/ai/governor.js';
import { ProviderRequestError } from '../../../lib/errors.js';
import { executeCapability } from '../../../lib/capability/execute.js';
import { planCapability } from '../../../lib/capability/plan.js';
import { unmeteredQuotaLedger } from '../../../lib/capability/quota.js';

import type { AIGenerateRequest, AIGenerateResult, AIProvider, AIProviderName } from '../../../lib/ai/types.js';
import type { AIProviderFactory } from '../../../lib/ai/factory.js';
import type { CapabilityOrchestrator } from '../../../lib/capability/orchestrator.js';
import type { CapabilityPolicy } from '../../../lib/capability/plan.js';
import type { QuotaLedger } from '../../../lib/capability/quota.js';
import type { Logger } from '../../../lib/logger.js';

export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
  async time<T>(_label: string, fn: () => Promise<T>): Promise<T> {
    return fn();
  },
};

export interface FakeProviderCall {
  readonly provider: AIProviderName;
  readonly request: AIGenerateRequest;
}

/** Per-vendor response: real data to return, or `'unreachable'` to simulate a real vendor failure (429/500/etc). */
export type FakeProviderResponses = Readonly<Partial<Record<AIProviderName, unknown | 'unreachable'>>>;

/**
 * A provider factory whose `.create(name)` hands back a fake `AIProvider`
 * for that vendor, recording every call it actually receives — this is the
 * evidence a test uses to prove *which* vendor a plan resolved to.
 */
export function fakeProviderFactory(
  responses: FakeProviderResponses,
  calls: FakeProviderCall[] = [],
): { readonly factory: AIProviderFactory; readonly calls: readonly FakeProviderCall[] } {
  const build = (name: AIProviderName): AIProvider => ({
    name,
    version: 'fake-1.0',
    defaultModel: 'fake-model',
    supportsNativeSchema: true,
    async generate(request: AIGenerateRequest): Promise<AIGenerateResult> {
      calls.push({ provider: name, request });
      const configured = responses[name];
      if (configured === undefined || configured === 'unreachable') {
        throw new ProviderRequestError(name, `${name} is unreachable in this test`, {
          source: 'test.fakeProvider',
          retryable: true,
        });
      }
      return {
        data: configured,
        model: request.model,
        usage: { inputTokens: 10, outputTokens: 10 },
        structuredOutput: 'native',
        finishReason: 'stop',
      };
    },
    async health() {
      return { status: 'ready' as const, detail: 'fake', checkedAt: new Date().toISOString(), latencyMs: 0 };
    },
  });

  const supported = Object.keys(responses) as AIProviderName[];
  const factory: AIProviderFactory = {
    supported,
    createDefault: () => build('gemini'),
    create: (name) => build(name),
    tryCreateDefault: () => build('gemini'),
    configured: () => supported,
    selected: () => 'gemini',
    status: async () => [],
  };

  return { factory, calls };
}

export interface FakeRoutingOptions {
  readonly credentials: ReadonlySet<string>;
  readonly quota?: QuotaLedger;
  readonly policy?: Partial<CapabilityPolicy>;
}

/**
 * A `QuotaLedger` seeded with usage, for a Gemini-exhausted (or any
 * vendor-exhausted) scenario. `usage` is keyed exactly as `modelKey` does:
 * `${provider}:${modelId}`.
 */
export function seededQuotaLedger(usage: Readonly<Record<string, number>>): QuotaLedger {
  const counts: Record<string, number> = { ...usage };
  return {
    used: (key) => counts[key] ?? 0,
    hasRoom: (key, allowance) => allowance === null || (counts[key] ?? 0) < allowance,
    remaining: (key, allowance) => (allowance === null ? null : Math.max(0, allowance - (counts[key] ?? 0))),
    record: async (key, count = 1) => {
      counts[key] = (counts[key] ?? 0) + count;
    },
    snapshot: () => ({ day: 'test-day', used: { ...counts } }),
  };
}

const DEFAULT_TEST_POLICY: CapabilityPolicy = {
  allowPaid: false,
  budgetCentsRemaining: 0,
  allowedJurisdictions: ['local', 'us', 'eu', 'other'],
  allowedLicences: ['permissive-local', 'copyleft-local', 'commercial-api', 'free-tier-unverified'],
  autonomous: true,
  preferFree: true,
};

/** A `CapabilityOrchestrator` over the real planner/executor. See the module docstring for why. */
export function fakeCapabilityOrchestrator(options: FakeRoutingOptions): CapabilityOrchestrator {
  const quota = options.quota ?? unmeteredQuotaLedger();
  const governor = createRateGovernor();
  const policy: CapabilityPolicy = { ...DEFAULT_TEST_POLICY, ...options.policy };

  return {
    plan: (capability, overrides = {}) =>
      planCapability({ capability, credentials: options.credentials, quota, policy, ...overrides }),
    async run(capability, invoke, overrides = {}) {
      const plan = planCapability({ capability, credentials: options.credentials, quota, policy, ...overrides });
      return executeCapability({ plan, invoke, logger: noopLogger, quota });
    },
    board: () => {
      throw new Error('fakeCapabilityOrchestrator.board() is not exercised by this suite');
    },
    spend: () => ({ totalCents: 0, byProvider: {}, byCapability: {}, lines: [] }),
    remainingCents: () => policy.budgetCentsRemaining,
    quota,
    governor,
    policy,
  };
}
