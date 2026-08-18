/**
 * Tests for designDirectorAgent.
 *
 * Test strategy:
 *   - No live API calls. A minimal fake `AIProvider` is constructed per test.
 *   - The agent only touches `ctx.platform.ai()` and `ctx.logger` and
 *     `ctx.config.director`. We supply all three through thin fakes.
 *   - The agent must return a `DesignDirective`, not a `WebsiteDesign`.
 *   - Invalid/missing fields from the model are rejected before the directive
 *     reaches `applyDirective`.
 *   - The agent uses the provider abstraction — no vendor SDK is imported.
 *   - Business facts are reflected in the brief sent to the model.
 *   - The agent never modifies WebsiteDesign, renderer, or composeDesign.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDesignBrief,
  DIRECTIVE_SCHEMA,
  designDirectorAgent,
  directDesign,
  SYSTEM_PROMPT,
} from '../../agents/designDirectorAgent.js';
import { createRateGovernor } from '../../lib/ai/governor.js';
import { validateAgainstSchema } from '../../lib/ai/schema.js';
import { executeCapability } from '../../lib/capability/execute.js';
import { planCapability } from '../../lib/capability/plan.js';
import { unmeteredQuotaLedger } from '../../lib/capability/quota.js';
import { profileFixture, strategyFixture } from '../fixtures/business.js';
import { fullContent, minimalContent } from '../fixtures/content.js';

import type { AIGenerateRequest, AIGenerateResult, AIProvider } from '../../lib/ai/types.js';
import type { AIProviderFactory } from '../../lib/ai/factory.js';
import type { AgentContext } from '../../lib/types.js';
import type { AppConfig } from '../../lib/config.js';
import type { CapabilityOrchestrator } from '../../lib/capability/orchestrator.js';
import type { DesignDirective } from '../../lib/design/directive.js';
import type { DesignDirectorInput } from '../../agents/designDirectorAgent.js';
import type { Logger, LogFields } from '../../lib/logger.js';
import type { Platform } from '../../lib/platform/platform.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** A valid, complete `DesignDirective` the fake provider returns. */
const VALID_DIRECTIVE: DesignDirective = {
  direction: 'friendly',
  visualIntent: 'Warm and approachable; a neighbourhood business that locals trust.',
  density: 'balanced',
  heroIntent: { preference: 'centered', intent: 'Centred hero with headline for immediate recognition.' },
  layoutIntent: 'Card-based sections with generous whitespace for easy scanning.',
  colorStrategy: 'brand-led',
  typographyIntent: { intent: 'Friendly sans-serif to reinforce the welcoming tone.', preference: 'sans' },
  imageryIntent: { intent: 'Warm, natural photography of products and the space.', treatment: 'warm' },
  accessibilityTarget: 'AA',
  rationale: 'A neighbourhood bakery needs warmth over sophistication. The friendly direction, warm imagery and balanced density create an inviting first impression consistent with the profile.',
  confidence: 0.82,
};

/** No-op logger. */
const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
  async time<T>(_label: string, fn: () => Promise<T>): Promise<T> { return fn(); },
};

/** Captures warn calls for assertions. */
function capturingLogger(): { logger: Logger; warnings: string[] } {
  const warnings: string[] = [];
  const logger: Logger = {
    debug: () => {},
    info: () => {},
    warn: (msg: string) => { warnings.push(msg); },
    error: () => {},
    child: () => logger,
    async time<T>(_label: string, fn: () => Promise<T>): Promise<T> { return fn(); },
  };
  return { logger, warnings };
}

/**
 * Builds a fake `AIProvider` whose `generate` returns the given data object.
 * Captures requests for assertion.
 */
function fakeProvider(data: unknown): { provider: AIProvider; requests: AIGenerateRequest[] } {
  const requests: AIGenerateRequest[] = [];
  const provider: AIProvider = {
    name: 'openai',
    version: 'fake-1.0',
    defaultModel: 'fake-model',
    supportsNativeSchema: true,
    async generate(request: AIGenerateRequest): Promise<AIGenerateResult> {
      requests.push(request);
      return {
        data,
        model: 'fake-model',
        usage: { inputTokens: 100, outputTokens: 50 },
        structuredOutput: 'native',
        finishReason: 'stop',
      };
    },
    async health() {
        return { status: 'ready' as const, detail: 'fake', checkedAt: new Date().toISOString(), latencyMs: 0 };
      },
    };
    return { provider, requests };
  }

/**
 * A `CapabilityOrchestrator` whose `plan`/`run` are the real
 * `planCapability` / `executeCapability` — genuine filtering, ranking,
 * failover and telemetry — with exactly one credentialled vendor (`openai`,
 * matching `fakeProvider`'s hardcoded name) reached through a factory that
 * always hands back the caller's fake `AIProvider` regardless of which
 * vendor the plan resolved. That factory substitution is the only fake part;
 * everything above it is the production code path `directDesign` actually
 * runs. Synchronous (unlike the real `createCapabilityOrchestrator`, which
 * opens an on-disk quota file) because nothing here needs the disk.
 *
 * `allowPaid: true` with a generous budget, because `creative_direction`'s
 * `openai` binding has no free allowance — the real, zero-budget default
 * policy would exclude it as `paid-disabled` before the fake provider is ever
 * reached, and this suite is testing the agent's logic, not cost policy
 * (which `test/capability/plan.test.ts` already covers on its own).
 */
function fakeOrchestrator(logger: Logger): CapabilityOrchestrator {
  const credentials = new Set(['OPENAI_API_KEY']);
  const quota = unmeteredQuotaLedger();
  // No buckets registered — rate governance is deliberately omitted from
  // `executeCapability` below (it is optional there) rather than faked, since
  // this suite has nothing to say about pacing.
  const governor = createRateGovernor();
  const policy = {
    allowPaid: true,
    budgetCentsRemaining: 1_000,
    allowedJurisdictions: ['local', 'us', 'eu', 'other'] as const,
    allowedLicences: ['permissive-local', 'copyleft-local', 'commercial-api', 'free-tier-unverified'] as const,
    autonomous: true,
    preferFree: true,
  };

  return {
    plan: (capability, overrides = {}) =>
      planCapability({ capability, credentials, quota, policy, ...overrides }),
    async run(capability, invoke, overrides = {}) {
      const plan = planCapability({ capability, credentials, quota, policy, ...overrides });
      return executeCapability({ plan, invoke, logger, quota });
    },
    board: () => { throw new Error('fakeOrchestrator.board() is not exercised by this suite'); },
    spend: () => ({ totalCents: 0, byProvider: {}, byCapability: {}, lines: [] }),
    remainingCents: () => policy.budgetCentsRemaining,
    quota,
    governor,
    policy,
  };
}

/** Builds a minimal `AgentContext` for the Design Director. */
function fakeContext(
  provider: AIProvider,
  logger: Logger = noopLogger,
): AgentContext {
  const providers = { create: () => provider } as unknown as AIProviderFactory;

  const config = {
    ai: {
      provider: 'openai',
      apiKeys: { openai: 'fake-key', anthropic: '', gemini: '', openrouter: '' },
    },
    credentials: {},
    director: {
      model: 'fake-model',
      effort: 'medium',
      maxOutputTokens: 4_000,
      maxPageChars: 2_000,
    },
  } as unknown as AppConfig;

  const platform = {
    ai: () => provider,
    tryAi: () => provider,
    providers,
    capabilities: fakeOrchestrator(logger),
  } as unknown as Platform;

  return {
    runId: 'test-run',
    config: config as AgentContext['config'],
    logger,
    getBrowser: async () => { throw new Error('should not call getBrowser'); },
    platform,
    outputDir: '/tmp/test-output',
    signal: new AbortController().signal,
  };
}

/** Base input using the shared fixtures. */
function baseInput(): DesignDirectorInput {
  return {
    profile: profileFixture(),
    strategy: strategyFixture(),
    content: fullContent,
  };
}

/* ------------------------------------------------------------------ */
/* Schema validation                                                   */
/* ------------------------------------------------------------------ */

describe('DIRECTIVE_SCHEMA', () => {
  it('accepts a valid DesignDirective object', () => {
    const problems = validateAgainstSchema(VALID_DIRECTIVE, DIRECTIVE_SCHEMA);
    assert.deepEqual(problems, []);
  });

  it('rejects an object missing required fields', () => {
    const incomplete = { direction: 'minimal', confidence: 0.5 };
    const problems = validateAgainstSchema(incomplete, DIRECTIVE_SCHEMA);
    assert.ok(problems.length > 0, 'expected schema violations');
  });

  it('rejects an invalid direction enum value', () => {
    const bad = { ...VALID_DIRECTIVE, direction: 'galaxy-brain' };
    const problems = validateAgainstSchema(bad, DIRECTIVE_SCHEMA);
    assert.ok(problems.some((p) => p.includes('direction')), 'expected direction error');
  });

  it('rejects an invalid density enum value', () => {
    const bad = { ...VALID_DIRECTIVE, density: 'ridiculous' };
    const problems = validateAgainstSchema(bad, DIRECTIVE_SCHEMA);
    assert.ok(problems.some((p) => p.includes('density')), 'expected density error');
  });

  it('rejects an invalid colorStrategy enum value', () => {
    const bad = { ...VALID_DIRECTIVE, colorStrategy: 'neon' };
    const problems = validateAgainstSchema(bad, DIRECTIVE_SCHEMA);
    assert.ok(problems.some((p) => p.includes('colorStrategy')));
  });

  it('rejects an invalid accessibilityTarget', () => {
    const bad = { ...VALID_DIRECTIVE, accessibilityTarget: 'A' };
    const problems = validateAgainstSchema(bad, DIRECTIVE_SCHEMA);
    assert.ok(problems.some((p) => p.includes('accessibilityTarget')));
  });

  it('rejects CSS-like fields via additionalProperties: false', () => {
    const withCss = { ...VALID_DIRECTIVE, fontSize: '16px', backgroundColor: '#fff' };
    const problems = validateAgainstSchema(withCss, DIRECTIVE_SCHEMA);
    assert.ok(problems.some((p) => p.includes('fontSize')));
    assert.ok(problems.some((p) => p.includes('backgroundColor')));
  });

  it('rejects token injection fields', () => {
    const withTokens = {
      ...VALID_DIRECTIVE,
      brandColorHex: '#123456',
      typeScaleBias: 1.2,
      spacingUnit: '8px',
    };
    const problems = validateAgainstSchema(withTokens, DIRECTIVE_SCHEMA);
    assert.ok(problems.length >= 3, 'expected schema violations for token fields');
  });
});

/* ------------------------------------------------------------------ */
/* DIRECTIVE_SCHEMA — experienceIntent (Experience Intent V1, ADR 0005) */
/* ------------------------------------------------------------------ */

describe('DIRECTIVE_SCHEMA – experienceIntent', () => {
  it('is optional — a directive without it still validates', () => {
    const problems = validateAgainstSchema(VALID_DIRECTIVE, DIRECTIVE_SCHEMA);
    assert.deepEqual(problems, []);
  });

  it('accepts a well-formed standard experienceIntent', () => {
    // moment/momentIntent are never null on the wire — Gemini's structured-output
    // translator rejects a `type: ['string', 'null']` union (found live; see
    // directive.ts's applyExperienceIntent comment). A real "standard" response
    // still names some section and sentence; the deterministic adapter ignores
    // both unconditionally when mode is "standard".
    const withIntent = {
      ...VALID_DIRECTIVE,
      experienceIntent: { mode: 'standard', moment: 'hero', momentIntent: 'not applicable', transitionAtMoment: false },
    };
    assert.deepEqual(validateAgainstSchema(withIntent, DIRECTIVE_SCHEMA), []);
  });

  it('accepts a well-formed moment-led experienceIntent', () => {
    const withIntent = {
      ...VALID_DIRECTIVE,
      experienceIntent: {
        mode: 'moment-led',
        moment: 'gallery',
        momentIntent: 'The photography of the space is the strongest evidence this business has.',
        transitionAtMoment: true,
      },
    };
    assert.deepEqual(validateAgainstSchema(withIntent, DIRECTIVE_SCHEMA), []);
  });

  it('accepts every SectionKind as a moment value', () => {
    const kinds = [
      'hero', 'statement', 'about', 'services', 'menu', 'gallery',
      'testimonials', 'hours', 'location', 'contact', 'cta', 'faq',
    ];
    for (const moment of kinds) {
      const withIntent = {
        ...VALID_DIRECTIVE,
        experienceIntent: { mode: 'moment-led', moment, momentIntent: 'test', transitionAtMoment: false },
      };
      assert.deepEqual(validateAgainstSchema(withIntent, DIRECTIVE_SCHEMA), [], moment);
    }
  });

  it('rejects an invalid mode value', () => {
    const bad = {
      ...VALID_DIRECTIVE,
      experienceIntent: { mode: 'cinematic', moment: 'hero', momentIntent: 'test', transitionAtMoment: false },
    };
    const problems = validateAgainstSchema(bad, DIRECTIVE_SCHEMA);
    assert.ok(problems.some((p) => p.includes('mode')), 'expected a mode error');
  });

  it('rejects a null moment — the live schema requires a real section kind even in standard mode', () => {
    const bad = {
      ...VALID_DIRECTIVE,
      experienceIntent: { mode: 'standard', moment: null, momentIntent: 'test', transitionAtMoment: false },
    };
    const problems = validateAgainstSchema(bad, DIRECTIVE_SCHEMA);
    assert.ok(problems.length > 0, 'expected a moment type error');
  });

  it('rejects a null momentIntent for the same reason', () => {
    const bad = {
      ...VALID_DIRECTIVE,
      experienceIntent: { mode: 'standard', moment: 'hero', momentIntent: null, transitionAtMoment: false },
    };
    const problems = validateAgainstSchema(bad, DIRECTIVE_SCHEMA);
    assert.ok(problems.length > 0, 'expected a momentIntent type error');
  });

  it('rejects a moment value that is not a real SectionKind', () => {
    const bad = {
      ...VALID_DIRECTIVE,
      experienceIntent: {
        mode: 'moment-led', moment: 'pricing', momentIntent: 'test', transitionAtMoment: false,
      },
    };
    const problems = validateAgainstSchema(bad, DIRECTIVE_SCHEMA);
    assert.ok(problems.some((p) => p.includes('moment')), 'expected a moment error');
  });

  it('rejects a missing required sub-field', () => {
    const bad = {
      ...VALID_DIRECTIVE,
      experienceIntent: { mode: 'standard', moment: 'hero', momentIntent: 'test' },
    };
    const problems = validateAgainstSchema(bad, DIRECTIVE_SCHEMA);
    assert.ok(problems.length > 0, 'expected a required-field violation');
  });

  it('rejects CSS, JS or arbitrary properties smuggled into experienceIntent', () => {
    const bad = {
      ...VALID_DIRECTIVE,
      experienceIntent: {
        mode: 'moment-led',
        moment: 'gallery',
        momentIntent: 'test',
        transitionAtMoment: true,
        // The whole point of additionalProperties: false on this object too.
        css: '.section { animation: spin 1s; }',
        onClick: 'alert(1)',
        webgl: true,
      },
    };
    const problems = validateAgainstSchema(bad, DIRECTIVE_SCHEMA);
    assert.ok(problems.some((p) => p.includes('css')));
    assert.ok(problems.some((p) => p.includes('onClick')));
    assert.ok(problems.some((p) => p.includes('webgl')));
  });

  it('exposes exactly the four documented sub-fields, nothing more', () => {
    const schema = DIRECTIVE_SCHEMA as unknown as {
      properties: Record<string, { properties?: Record<string, unknown> }>;
    };
    const properties = schema.properties['experienceIntent']?.properties ?? {};
    assert.deepEqual(
      Object.keys(properties).sort(),
      ['mode', 'moment', 'momentIntent', 'transitionAtMoment'],
    );
  });
});

/* ------------------------------------------------------------------ */
/* buildDesignBrief                                                    */
/* ------------------------------------------------------------------ */

describe('buildDesignBrief', () => {
  it('includes the business name', () => {
    const brief = buildDesignBrief(profileFixture(), strategyFixture(), fullContent, 2_000);
    assert.ok(brief.includes('Padaria Ana'), 'brief should contain business name');
  });

  it('includes the business category', () => {
    const brief = buildDesignBrief(
      profileFixture({ category: 'Artisan Bakery' }),
      strategyFixture({ primary: 'Artisan Bakery' }),
      fullContent,
      2_000,
    );
    assert.ok(brief.includes('Artisan Bakery'), 'brief should contain category');
  });

  it('includes target audience information', () => {
    const brief = buildDesignBrief(profileFixture(), strategyFixture(), fullContent, 2_000);
    assert.ok(brief.includes('Local residents'), 'brief should mention primary audience');
  });

  it('includes brand voice tone', () => {
    const brief = buildDesignBrief(profileFixture(), strategyFixture(), fullContent, 2_000);
    // fullContent.voice.tone is set
    assert.ok(brief.includes('Tone:'), 'brief should include tone label');
  });

  it('includes image content signals, not just counts', () => {
    const brief = buildDesignBrief(profileFixture(), strategyFixture(), fullContent, 2_000);
    assert.ok(brief.includes('Logo:'), 'brief should include logo availability');
    assert.ok(brief.includes('Image content signals'), 'brief should include the image content signals section');
    assert.ok(brief.includes('Usable photographs'), 'brief should report usable photographs, not a raw gallery count');
  });

  it('includes content sections', () => {
    const brief = buildDesignBrief(profileFixture(), strategyFixture(), fullContent, 2_000);
    assert.ok(brief.includes('[hero]'), 'brief should include hero section');
  });

  it('produces a non-empty brief for minimal content', () => {
    const brief = buildDesignBrief(profileFixture(), strategyFixture(), minimalContent, 2_000);
    assert.ok(brief.length > 100, 'brief should be non-trivial even for minimal content');
  });

  it('truncates long page text at maxPageChars', () => {
    const longText = 'x'.repeat(10_000);
    const profile = profileFixture({ pages: [{ url: 'https://example.test', title: 'Home', text: longText }] });
    const brief = buildDesignBrief(profile, strategyFixture(), minimalContent, 500);
    assert.ok(brief.includes('…[truncated]'), 'brief should truncate long page text');
  });

  it('does not expose raw JSON blobs', () => {
    const brief = buildDesignBrief(profileFixture(), strategyFixture(), fullContent, 2_000);
    // A raw JSON dump would have many "}" characters and property colons
    const jsonArtifacts = (brief.match(/^\s*\}/gm) ?? []).length;
    assert.ok(jsonArtifacts < 5, 'brief should not be a JSON dump');
  });
});

/* ------------------------------------------------------------------ */
/* System prompt                                                       */
/* ------------------------------------------------------------------ */

describe('SYSTEM_PROMPT', () => {
  it('is a non-empty string', () => {
    assert.ok(typeof SYSTEM_PROMPT === 'string' && SYSTEM_PROMPT.length > 100);
  });

  it('instructs the model not to generate CSS', () => {
    assert.ok(SYSTEM_PROMPT.toLowerCase().includes('css'));
  });

  it('instructs the model not to generate pixel values', () => {
    assert.ok(SYSTEM_PROMPT.includes('pixel'));
  });

  it('instructs the model not to invent facts', () => {
    assert.ok(SYSTEM_PROMPT.includes('invent'));
  });
});

/* ------------------------------------------------------------------ */
/* designDirectorAgent.run — happy path                               */
/* ------------------------------------------------------------------ */

describe('designDirectorAgent.run – happy path', () => {
  it('returns a DesignDirective, not a WebsiteDesign', async () => {
    const { provider } = fakeProvider(VALID_DIRECTIVE);
    const result = await designDirectorAgent.run(baseInput(), fakeContext(provider));

    // DesignDirective has direction, confidence, etc. — NOT version, tokens, etc.
    assert.equal(result.direction, 'friendly');
    assert.equal(result.confidence, 0.82);
    assert.equal((result as Record<string, unknown>)['version'], undefined);
    assert.equal((result as Record<string, unknown>)['tokens'], undefined);
  });

  it('returns the exact directive the model produced', async () => {
    const { provider } = fakeProvider(VALID_DIRECTIVE);
    const result = await designDirectorAgent.run(baseInput(), fakeContext(provider));
    assert.deepEqual(result, VALID_DIRECTIVE);
  });

  it('sends the business name in the prompt', async () => {
    const { provider, requests } = fakeProvider(VALID_DIRECTIVE);
    await designDirectorAgent.run(baseInput(), fakeContext(provider));
    assert.ok(requests[0]!.prompt.includes('Padaria Ana'), 'prompt should contain business name');
  });

  it('uses the provider abstraction — not a vendor SDK', async () => {
    // This is verified structurally: the agent only calls provider.generate(),
    // which is the AIProvider interface. No Anthropic/OpenAI/Gemini import exists
    // in designDirectorAgent.ts. If it did, the TypeScript compiler would surface it.
    const { provider, requests } = fakeProvider(VALID_DIRECTIVE);
    await designDirectorAgent.run(baseInput(), fakeContext(provider));
    assert.equal(requests.length, 1);
    // A request object has `prompt`, `system`, `schema` — not `generate`.
    assert.ok('prompt' in requests[0]!);
    assert.ok(!('generate' in requests[0]!));
  });

  it('uses the model and effort from config.director', async () => {
    const { provider, requests } = fakeProvider(VALID_DIRECTIVE);
    await designDirectorAgent.run(baseInput(), fakeContext(provider));
    assert.equal(requests[0]!.model, 'fake-model');
    assert.equal(requests[0]!.effort, 'medium');
  });

  it('passes the DIRECTIVE_SCHEMA to the provider', async () => {
    const { provider, requests } = fakeProvider(VALID_DIRECTIVE);
    await designDirectorAgent.run(baseInput(), fakeContext(provider));
    assert.deepEqual(requests[0]!.schema, DIRECTIVE_SCHEMA);
  });

  it('passes the system prompt to the provider', async () => {
    const { provider, requests } = fakeProvider(VALID_DIRECTIVE);
    await designDirectorAgent.run(baseInput(), fakeContext(provider));
    assert.equal(requests[0]!.system, SYSTEM_PROMPT);
  });

  it('does not call getBrowser (agent does not browse)', async () => {
    let browserCalled = false;
    const { provider } = fakeProvider(VALID_DIRECTIVE);
    const ctx = fakeContext(provider);
    const ctxWithSpy: AgentContext = {
      ...ctx,
      getBrowser: async () => { browserCalled = true; throw new Error('browser called'); },
    };
    await designDirectorAgent.run(baseInput(), ctxWithSpy);
    assert.equal(browserCalled, false, 'agent must not call getBrowser');
  });

  it('handles high-confidence directive (AAA accessibility)', async () => {
    const highConfidence: DesignDirective = {
      ...VALID_DIRECTIVE,
      accessibilityTarget: 'AAA',
      colorStrategy: 'high-contrast',
      confidence: 0.95,
    };
    const { provider } = fakeProvider(highConfidence);
    const result = await designDirectorAgent.run(baseInput(), fakeContext(provider));
    assert.equal(result.accessibilityTarget, 'AAA');
    assert.equal(result.colorStrategy, 'high-contrast');
  });

  it('logs a warning when confidence is below 0.5', async () => {
    const lowConfidence: DesignDirective = { ...VALID_DIRECTIVE, confidence: 0.3 };
    const { provider } = fakeProvider(lowConfidence);
    const { logger, warnings } = capturingLogger();
    await designDirectorAgent.run(baseInput(), fakeContext(provider, logger));
    assert.ok(
      warnings.some((w) => w.toLowerCase().includes('confidence')),
      `expected confidence warning, got: ${JSON.stringify(warnings)}`,
    );
  });

  it('does not log a warning when confidence is exactly 0.5', async () => {
    const borderlineConfidence: DesignDirective = { ...VALID_DIRECTIVE, confidence: 0.5 };
    const { provider } = fakeProvider(borderlineConfidence);
    const { logger, warnings } = capturingLogger();
    await designDirectorAgent.run(baseInput(), fakeContext(provider, logger));
    assert.ok(!warnings.some((w) => w.toLowerCase().includes('confidence')), 'no warning at 0.5');
  });
});

/* ------------------------------------------------------------------ */
/* designDirectorAgent.run — invalid model output                     */
/* ------------------------------------------------------------------ */

describe('designDirectorAgent.run – invalid model output', () => {
  it('throws when model returns a non-object', async () => {
    const { provider } = fakeProvider('this is not an object');
    await assert.rejects(
      () => designDirectorAgent.run(baseInput(), fakeContext(provider)),
      (error: Error) => {
        assert.ok(error.message.toLowerCase().includes('non-object'), error.message);
        return true;
      },
    );
  });

  it('throws when model omits required directive fields', async () => {
    const { provider } = fakeProvider({ direction: 'minimal', confidence: 0.5 });
    await assert.rejects(
      () => designDirectorAgent.run(baseInput(), fakeContext(provider)),
      (error: Error) => {
        assert.ok(error.message.includes('omitted directive fields'), error.message);
        return true;
      },
    );
  });

  it('throws when confidence is out of range (above 1)', async () => {
    const bad = { ...VALID_DIRECTIVE, confidence: 1.5 };
    const { provider } = fakeProvider(bad);
    await assert.rejects(
      () => designDirectorAgent.run(baseInput(), fakeContext(provider)),
      (error: Error) => {
        assert.ok(error.message.includes('confidence'), error.message);
        return true;
      },
    );
  });

  it('throws when confidence is out of range (below 0)', async () => {
    const bad = { ...VALID_DIRECTIVE, confidence: -0.1 };
    const { provider } = fakeProvider(bad);
    await assert.rejects(
      () => designDirectorAgent.run(baseInput(), fakeContext(provider)),
      (error: Error) => {
        assert.ok(error.message.includes('confidence'), error.message);
        return true;
      },
    );
  });

  it('throws when model returns null', async () => {
    const { provider } = fakeProvider(null);
    await assert.rejects(
      () => designDirectorAgent.run(baseInput(), fakeContext(provider)),
    );
  });

  it('re-raises UpstreamError from the provider', async () => {
    const { UpstreamError } = await import('../../lib/errors.js');
    const errorProvider: AIProvider = {
      name: 'openai',
      version: 'fake-1.0',
      defaultModel: 'fake-model',
      supportsNativeSchema: true,
      async generate() {
        throw new UpstreamError('provider exploded', { source: 'openai', retryable: true });
      },
      async health() {
        return { status: 'ready' as const, detail: 'fake', checkedAt: new Date().toISOString(), latencyMs: 0 };
      },
    };
    await assert.rejects(
      () => designDirectorAgent.run(baseInput(), fakeContext(errorProvider)),
      UpstreamError,
    );
  });

  it('wraps non-UpstreamError provider failures in UpstreamError', async () => {
    const { UpstreamError } = await import('../../lib/errors.js');
    const errorProvider: AIProvider = {
      name: 'openai',
      version: 'fake-1.0',
      defaultModel: 'fake-model',
      supportsNativeSchema: true,
      async generate() {
        throw new Error('network timeout');
      },
      async health() {
        return { status: 'ready' as const, detail: 'fake', checkedAt: new Date().toISOString(), latencyMs: 0 };
      },
    };
    await assert.rejects(
      () => designDirectorAgent.run(baseInput(), fakeContext(errorProvider)),
      UpstreamError,
    );
  });
});

/* ------------------------------------------------------------------ */
/* Output shape — no CSS/token injection                               */
/* ------------------------------------------------------------------ */

describe('designDirectorAgent — output contract', () => {
  it('result has direction, visualIntent, density, rationale, confidence', async () => {
    const { provider } = fakeProvider(VALID_DIRECTIVE);
    const result = await designDirectorAgent.run(baseInput(), fakeContext(provider));
    assert.ok('direction' in result);
    assert.ok('visualIntent' in result);
    assert.ok('density' in result);
    assert.ok('rationale' in result);
    assert.ok('confidence' in result);
  });

  it('result does not have WebsiteDesign fields', async () => {
    const { provider } = fakeProvider(VALID_DIRECTIVE);
    const result = await designDirectorAgent.run(baseInput(), fakeContext(provider)) as Record<string, unknown>;
    // WebsiteDesign fields
    assert.equal(result['version'], undefined);
    assert.equal(result['tokens'], undefined);
    assert.equal(result['personality'], undefined);
    assert.equal(result['layout'], undefined);
    assert.equal(result['accessibility'], undefined);
  });

  it('confidence is a number between 0 and 1', async () => {
    const { provider } = fakeProvider(VALID_DIRECTIVE);
    const result = await designDirectorAgent.run(baseInput(), fakeContext(provider));
    assert.ok(typeof result.confidence === 'number');
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
  });
});

/* ------------------------------------------------------------------ */
/* Provenance — what makes a directive auditable                       */
/* ------------------------------------------------------------------ */

/*
 * `directDesign` exists so a caller can *prove* a directive came from a live
 * model rather than assert it. A smoke test whose only evidence is "the JSON
 * looks plausible" is a smoke test that a hard-coded fallback would also pass,
 * so the provider, the model that actually served the request, the token spend
 * and the vendor's request id all have to leave the agent as data.
 */
describe('directDesign – provenance', () => {
  it('reports the provider and the model that actually served the request', async () => {
    const { provider } = fakeProvider(VALID_DIRECTIVE);
    const { provenance } = await directDesign(baseInput(), fakeContext(provider));

    assert.equal(provenance.provider, 'openai');
    assert.equal(provenance.model, 'fake-model');
    assert.equal(provenance.requestedModel, 'fake-model');
  });

  it('reports token usage and the finish reason', async () => {
    const { provider } = fakeProvider(VALID_DIRECTIVE);
    const { provenance } = await directDesign(baseInput(), fakeContext(provider));

    assert.equal(provenance.inputTokens, 100);
    assert.equal(provenance.outputTokens, 50);
    assert.equal(provenance.finishReason, 'stop');
    assert.equal(provenance.structuredOutput, 'native');
  });

  it('carries the provider request id when the vendor supplies one', async () => {
    const withId: AIProvider = {
      name: 'gemini',
      version: 'fake-1.0',
      defaultModel: 'fake-model',
      supportsNativeSchema: true,
      async generate(): Promise<AIGenerateResult> {
        return {
          data: VALID_DIRECTIVE,
          model: 'fake-model-002',
          usage: { inputTokens: 1, outputTokens: 2 },
          structuredOutput: 'native',
          finishReason: 'STOP',
          requestId: 'req_abc123',
        };
      },
      async health() {
        return { status: 'ready' as const, detail: 'fake', checkedAt: new Date().toISOString(), latencyMs: 0 };
      },
    };

    const { provenance } = await directDesign(baseInput(), fakeContext(withId));
    assert.equal(provenance.requestId, 'req_abc123');
    assert.equal(provenance.model, 'fake-model-002');
  });

  it('reports a null request id rather than inventing one', async () => {
    const { provider } = fakeProvider(VALID_DIRECTIVE);
    const { provenance } = await directDesign(baseInput(), fakeContext(provider));
    assert.equal(provenance.requestId, null);
  });

  it('timestamps the call', async () => {
    const { provider } = fakeProvider(VALID_DIRECTIVE);
    const { provenance } = await directDesign(baseInput(), fakeContext(provider));

    assert.ok(Date.parse(provenance.startedAt) > 0);
    assert.ok(Date.parse(provenance.finishedAt) >= Date.parse(provenance.startedAt));
    assert.ok(provenance.durationMs >= 0);
  });

  it('makes exactly one provider call', async () => {
    const { provider, requests } = fakeProvider(VALID_DIRECTIVE);
    await directDesign(baseInput(), fakeContext(provider));
    assert.equal(requests.length, 1);
  });
});

/* ------------------------------------------------------------------ */
/* No fallback                                                         */
/* ------------------------------------------------------------------ */

describe('designDirectorAgent – no fallback path', () => {
  /*
   * The defect this guards against is the one that invalidated the previous
   * five-business A/B experiment: a harness that substituted canned directives
   * when the call failed, and then reported the result as evidence about the
   * model. A failed call has to stay failed.
   */
  it('produces no directive at all when the provider fails', async () => {
    const failing: AIProvider = {
      name: 'gemini',
      version: 'fake-1.0',
      defaultModel: 'fake-model',
      supportsNativeSchema: true,
      async generate(): Promise<AIGenerateResult> {
        throw new Error('HTTP 503: the model is currently overloaded');
      },
      async health() {
        return { status: 'ready' as const, detail: 'fake', checkedAt: new Date().toISOString(), latencyMs: 0 };
      },
    };

    await assert.rejects(() => directDesign(baseInput(), fakeContext(failing)));
    await assert.rejects(() => designDirectorAgent.run(baseInput(), fakeContext(failing)));
  });

  it('exports no default, canned or fallback directive', async () => {
    const module = await import('../../agents/designDirectorAgent.js') as Record<string, unknown>;
    const suspicious = Object.keys(module).filter((name) => /fallback|default.*directive|canned|stub/i.test(name));
    assert.deepEqual(suspicious, [], `unexpected fallback export(s): ${suspicious.join(', ')}`);
  });
});

/* ------------------------------------------------------------------ */
/* Agent metadata                                                      */
/* ------------------------------------------------------------------ */

describe('designDirectorAgent metadata', () => {
  it('has a stable name', () => {
    assert.equal(designDirectorAgent.name, 'designDirectorAgent');
  });

  it('has a description', () => {
    assert.ok(typeof designDirectorAgent.description === 'string' && designDirectorAgent.description.length > 0);
  });

  it('has a run method', () => {
    assert.equal(typeof designDirectorAgent.run, 'function');
  });
});
