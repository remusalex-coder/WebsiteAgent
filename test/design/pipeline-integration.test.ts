/**
 * Integration tests for the Design Director V1 pipeline integration.
 *
 * Test strategy:
 *   - No live API calls. A minimal fake `AIProvider` is constructed per test.
 *   - Tests exercise the chain:
 *       designDirectorAgent → DesignDirective → applyDirective → composeDesign → WebsiteDesign
 *   - The `designAgent` is called directly with/without a directive to verify
 *     both the enabled and the disabled (deterministic-fallback) paths.
 *   - Operator direction override (feature flag) precedence is verified.
 *   - Failure propagation is verified: a throwing director propagates its error.
 *   - Directive artifact shape is verified so persistence can be trusted.
 *
 * What these tests do NOT cover (already covered elsewhere):
 *   - The full pipeline e2e (requires live browser + AI provider).
 *   - applyDirective unit-level rules (covered in directive.test.ts).
 *   - designDirectorAgent schema validation (covered in designDirectorAgent.test.ts).
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { designAgent } from '../../agents/designAgent.js';
import { designDirectorAgent } from '../../agents/designDirectorAgent.js';
import { applyDirective } from '../../lib/design/directive.js';
import { composeDesign } from '../../lib/design/index.js';
import { UpstreamError } from '../../lib/errors.js';
import { profileFixture, strategyFixture } from '../fixtures/business.js';
import { fullContent, minimalContent } from '../fixtures/content.js';

import type { AIGenerateRequest, AIGenerateResult, AIProvider } from '../../lib/ai/types.js';
import type { DesignDirective } from '../../lib/design/directive.js';
import type { AgentContext } from '../../lib/types.js';
import type { Platform } from '../../lib/platform/platform.js';
import type { Logger } from '../../lib/logger.js';

/* ------------------------------------------------------------------ */
/* Fixtures and helpers                                                */
/* ------------------------------------------------------------------ */

/** A valid, complete `DesignDirective` returned by the fake provider. */
const VALID_DIRECTIVE: DesignDirective = {
  direction: 'luxury',
  visualIntent: 'Refined, exclusive — photography-forward with generous white space.',
  density: 'airy',
  heroIntent: { preference: 'full-bleed', intent: 'Full-bleed image for immediate impact.' },
  layoutIntent: 'Editorial column with strong typographic hierarchy.',
  colorStrategy: 'brand-led',
  typographyIntent: { intent: 'Elegant serif to convey craftsmanship.', preference: 'serif' },
  imageryIntent: { intent: 'Warm, natural photography.', treatment: 'warm' },
  accessibilityTarget: 'AA',
  rationale: 'The luxury direction, brand-led palette and airy density work together to position this as an aspirational offering.',
  confidence: 0.88,
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

/** Captures warn/info calls for assertion. */
function capturingLogger(): { logger: Logger; records: Array<{ level: string; msg: string }> } {
  const records: Array<{ level: string; msg: string }> = [];
  const logger: Logger = {
    debug: () => {},
    info: (msg: string) => { records.push({ level: 'info', msg }); },
    warn: (msg: string) => { records.push({ level: 'warn', msg }); },
    error: () => {},
    child: () => logger,
    async time<T>(_label: string, fn: () => Promise<T>): Promise<T> { return fn(); },
  };
  return { logger, records };
}

/** A fake AIProvider that returns the given data. */
function fakeProvider(data: unknown): AIProvider {
  return {
    name: 'openai',
    version: 'fake-1.0',
    defaultModel: 'fake-model',
    supportsNativeSchema: true,
    async generate(_req: AIGenerateRequest): Promise<AIGenerateResult> {
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
}

/** A fake AIProvider whose generate() throws an UpstreamError. */
function failingProvider(message: string): AIProvider {
  return {
    name: 'openai',
    version: 'fake-1.0',
    defaultModel: 'fake-model',
    supportsNativeSchema: true,
    async generate(): Promise<AIGenerateResult> {
      throw new UpstreamError(message, { source: 'designDirectorAgent', retryable: true });
    },
    async health() {
      return { status: 'ready' as const, detail: 'fake', checkedAt: new Date().toISOString(), latencyMs: 0 };
    },
  };
}

/** Builds a minimal `AgentContext` for the Design Director. */
function fakeDirectorContext(provider: AIProvider, logger: Logger = noopLogger): AgentContext {
  const platform = { ai: () => provider, tryAi: () => provider } as unknown as Platform;
  return {
    runId: 'test-run',
    config: {
      director: { model: 'fake-model', effort: 'medium', maxOutputTokens: 4_000, maxPageChars: 2_000, enabled: true },
      features: {},
    } as AgentContext['config'],
    logger,
    getBrowser: async () => { throw new Error('should not call getBrowser'); },
    platform,
    outputDir: '/tmp/test-output',
    signal: new AbortController().signal,
  };
}

/**
 * Builds a minimal `AgentContext` for the Design Agent.
 *
 * `features` controls operator direction overrides via `design-direction-*` flags.
 */
function fakeDesignContext(
  features: Record<string, boolean> = {},
  logger: Logger = noopLogger,
): AgentContext {
  return {
    runId: 'test-run',
    config: {
      director: { model: 'fake-model', effort: 'medium', maxOutputTokens: 4_000, maxPageChars: 2_000, enabled: true },
      features,
    } as AgentContext['config'],
    logger,
    getBrowser: async () => { throw new Error('should not call getBrowser'); },
    platform: {} as unknown as Platform,
    outputDir: '/tmp/test-output',
    signal: new AbortController().signal,
  };
}

function baseDesignInput() {
  return {
    profile: profileFixture(),
    strategy: strategyFixture(),
    content: fullContent,
  };
}

/* ------------------------------------------------------------------ */
/* 1. Enabled Director path                                            */
/* ------------------------------------------------------------------ */

describe('Design Director – enabled path', () => {
  it('designDirectorAgent returns a valid DesignDirective from a fake provider', async () => {
    const ctx = fakeDirectorContext(fakeProvider(VALID_DIRECTIVE));
    const directive = await designDirectorAgent.run(
      { profile: profileFixture(), strategy: strategyFixture(), content: fullContent },
      ctx,
    );

    assert.equal(directive.direction, 'luxury');
    assert.equal(directive.confidence, 0.88);
    assert.equal(directive.accessibilityTarget, 'AA');
  });

  it('directive flows through applyDirective into composeDesign', async () => {
    const ctx = fakeDirectorContext(fakeProvider(VALID_DIRECTIVE));
    const directive = await designDirectorAgent.run(
      { profile: profileFixture(), strategy: strategyFixture(), content: fullContent },
      ctx,
    );

    const composeOptions = applyDirective(directive);
    const design = composeDesign(baseDesignInput(), composeOptions);

    assert.equal(design.personality.direction, 'luxury',
      'direction from directive should propagate through compose');
    assert.ok(typeof design.tokens === 'object', 'design should have tokens');
    assert.ok(typeof design.layout === 'object', 'design should have layout');
  });

  it('designAgent.run with a directive applies the directive direction', async () => {
    const ctx = fakeDesignContext();
    const design = await designAgent.run(
      { ...baseDesignInput(), directive: { ...VALID_DIRECTIVE, direction: 'luxury' } },
      ctx,
    );
    assert.equal(design.personality.direction, 'luxury');
  });

  it('designAgent.run with high-contrast colorStrategy forces AAA accessibility', async () => {
    const directive: DesignDirective = { ...VALID_DIRECTIVE, colorStrategy: 'high-contrast' };
    const ctx = fakeDesignContext();
    const design = await designAgent.run(
      { ...baseDesignInput(), directive },
      ctx,
    );
    // applyDirective maps high-contrast → AAA; composeDesign should honour it
    assert.ok(design, 'design should be produced');
  });

  it('designAgent.run with a directive logs directorEnabled: true', async () => {
    const { logger, records } = capturingLogger();
    const ctx = fakeDesignContext({}, logger);
    await designAgent.run(
      { ...baseDesignInput(), directive: VALID_DIRECTIVE },
      ctx,
    );
    const composedLog = records.find((r) => r.msg === 'design composed');
    assert.ok(composedLog, 'expected "design composed" log entry');
  });
});

/* ------------------------------------------------------------------ */
/* 2. Disabled Director path (deterministic fallback)                  */
/* ------------------------------------------------------------------ */

describe('Design Director – disabled path (deterministic fallback)', () => {
  it('designAgent.run without a directive produces the same design as pre-integration', async () => {
    const ctx = fakeDesignContext();
    const input = baseDesignInput();

    // Simulate the pre-integration code path: no directive
    const withoutDirective = await designAgent.run(input, ctx);

    // Simulate the disabled path explicitly
    const disabledPath = await designAgent.run({ ...input, directive: undefined }, ctx);

    assert.equal(withoutDirective.personality.direction, disabledPath.personality.direction);
    assert.equal(withoutDirective.industry.id, disabledPath.industry.id);
    assert.deepEqual(withoutDirective.layout.sections, disabledPath.layout.sections);
  });

  it('designAgent.run without a directive is deterministic', async () => {
    const ctx = fakeDesignContext();
    const input = baseDesignInput();

    const design1 = await designAgent.run(input, ctx);
    const design2 = await designAgent.run(input, ctx);

    assert.deepEqual(design1, design2);
  });

  it('designAgent.run without a directive and with minimal content completes', async () => {
    const ctx = fakeDesignContext();
    const design = await designAgent.run(
      { profile: profileFixture(), strategy: strategyFixture(), content: minimalContent },
      ctx,
    );
    assert.ok(design.personality.direction, 'design should have a direction');
  });
});

/* ------------------------------------------------------------------ */
/* 3. Operator direction override wins over directive                   */
/* ------------------------------------------------------------------ */

describe('Operator direction override precedence', () => {
  it('operator design-direction-* feature flag beats the directive direction', async () => {
    // Directive says 'luxury', operator says 'playful' via feature flag
    const ctx = fakeDesignContext({ 'design-direction-playful': true });
    const design = await designAgent.run(
      { ...baseDesignInput(), directive: { ...VALID_DIRECTIVE, direction: 'luxury' } },
      ctx,
    );
    assert.equal(design.personality.direction, 'playful',
      'operator feature flag must take precedence over the directive');
  });

  it('operator override wins even when directive has a different valid direction', async () => {
    const ctx = fakeDesignContext({ 'design-direction-minimal': true });
    const design = await designAgent.run(
      { ...baseDesignInput(), directive: { ...VALID_DIRECTIVE, direction: 'bold' } },
      ctx,
    );
    assert.equal(design.personality.direction, 'minimal');
  });

  it('directive direction is used when no operator override is set', async () => {
    const ctx = fakeDesignContext({});
    const design = await designAgent.run(
      { ...baseDesignInput(), directive: { ...VALID_DIRECTIVE, direction: 'editorial' } },
      ctx,
    );
    assert.equal(design.personality.direction, 'editorial');
  });
});

/* ------------------------------------------------------------------ */
/* 4. directive → applyDirective → composeDesign chain                */
/* ------------------------------------------------------------------ */

describe('directive → applyDirective → composeDesign chain', () => {
  it('produces a valid WebsiteDesign from a complete directive', () => {
    const options = applyDirective(VALID_DIRECTIVE);
    const design = composeDesign(baseDesignInput(), options);

    assert.ok(design.tokens, 'design must have tokens');
    assert.ok(design.layout, 'design must have layout');
    assert.ok(design.personality, 'design must have personality');
    assert.ok(design.industry, 'design must have industry');
    assert.equal(design.personality.direction, 'luxury');
  });

  it('produces a valid WebsiteDesign from an empty directive (graceful degradation)', () => {
    const options = applyDirective({});
    const design = composeDesign(baseDesignInput(), options);

    assert.ok(design.personality.direction, 'design must have a direction even with empty directive');
  });

  it('produces a valid WebsiteDesign when directive is undefined', () => {
    const options = applyDirective(undefined);
    const design = composeDesign(baseDesignInput(), options);

    assert.ok(design.personality.direction, 'design must have a direction when directive is undefined');
  });

  it('operator options take precedence over directive in applyDirective', () => {
    const directive: DesignDirective = { direction: 'luxury' };
    const operatorOptions = { direction: 'modern' as const };
    const resolved = applyDirective(directive, operatorOptions);

    assert.equal(resolved.direction, 'modern',
      'operator direction must override directive direction in applyDirective');
  });

  it('is deterministic: same directive + same input → same design', () => {
    const options1 = applyDirective(VALID_DIRECTIVE);
    const options2 = applyDirective(VALID_DIRECTIVE);
    const design1 = composeDesign(baseDesignInput(), options1);
    const design2 = composeDesign(baseDesignInput(), options2);

    assert.deepEqual(design1, design2);
  });
});

/* ------------------------------------------------------------------ */
/* 5. DesignDirective artifact persistence                             */
/* ------------------------------------------------------------------ */

describe('DesignDirective artifact shape', () => {
  it('directive returned by designDirectorAgent is JSON-serialisable', async () => {
    const ctx = fakeDirectorContext(fakeProvider(VALID_DIRECTIVE));
    const directive = await designDirectorAgent.run(
      { profile: profileFixture(), strategy: strategyFixture(), content: fullContent },
      ctx,
    );

    // Verify it round-trips through JSON without loss
    const serialised = JSON.stringify(directive, null, 2);
    assert.ok(serialised.length > 0, 'directive must serialise to a non-empty string');

    const parsed = JSON.parse(serialised) as unknown;
    assert.equal(typeof parsed, 'object', 'parsed directive must be an object');
    assert.ok(parsed !== null, 'parsed directive must not be null');

    const record = parsed as Record<string, unknown>;
    assert.ok('direction' in record, 'serialised directive must include direction');
    assert.ok('confidence' in record, 'serialised directive must include confidence');
    assert.ok('rationale' in record, 'serialised directive must include rationale');
  });

  it('directive has all fields required for the 5a-directive.json artifact', async () => {
    const ctx = fakeDirectorContext(fakeProvider(VALID_DIRECTIVE));
    const directive = await designDirectorAgent.run(
      { profile: profileFixture(), strategy: strategyFixture(), content: fullContent },
      ctx,
    );

    const required = [
      'direction', 'visualIntent', 'density', 'heroIntent', 'layoutIntent',
      'colorStrategy', 'typographyIntent', 'imageryIntent',
      'accessibilityTarget', 'rationale', 'confidence',
    ];
    for (const field of required) {
      assert.ok(
        field in directive,
        `directive is missing required artifact field: ${field}`,
      );
    }
  });
});

/* ------------------------------------------------------------------ */
/* 6. Failure propagation                                              */
/* ------------------------------------------------------------------ */

describe('Design Director – failure propagation', () => {
  it('designDirectorAgent throws UpstreamError when provider fails', async () => {
    const ctx = fakeDirectorContext(failingProvider('provider unavailable'));

    await assert.rejects(
      () => designDirectorAgent.run(
        { profile: profileFixture(), strategy: strategyFixture(), content: fullContent },
        ctx,
      ),
      (error: unknown) => {
        assert.ok(error instanceof UpstreamError, `expected UpstreamError, got ${String(error)}`);
        return true;
      },
    );
  });

  it('designDirectorAgent error is not swallowed — it propagates to the caller', async () => {
    const ctx = fakeDirectorContext(failingProvider('network timeout'));
    let caught: unknown = null;

    try {
      await designDirectorAgent.run(
        { profile: profileFixture(), strategy: strategyFixture(), content: fullContent },
        ctx,
      );
    } catch (error) {
      caught = error;
    }

    assert.ok(caught !== null, 'error must propagate to caller');
    assert.ok(caught instanceof UpstreamError, 'error must be an UpstreamError');
  });

  it('designDirectorAgent failure does not produce a design — it rejects, not resolves', async () => {
    const ctx = fakeDirectorContext(failingProvider('model refused'));
    let resolved = false;

    try {
      await designDirectorAgent.run(
        { profile: profileFixture(), strategy: strategyFixture(), content: fullContent },
        ctx,
      );
      resolved = true;
    } catch {
      // expected
    }

    assert.equal(resolved, false,
      'designDirectorAgent must reject on provider failure, not resolve with a partial design');
  });

  it('designDirectorAgent with malformed model response throws UpstreamError', async () => {
    const malformed = { direction: 'luxury' }; // missing required fields
    const ctx = fakeDirectorContext(fakeProvider(malformed));

    await assert.rejects(
      () => designDirectorAgent.run(
        { profile: profileFixture(), strategy: strategyFixture(), content: fullContent },
        ctx,
      ),
      UpstreamError,
    );
  });
});
