/**
 * The design stage, with and without a director.
 *
 * The property that matters is not "a directive changes the design" — that is
 * `applyDirective`'s job and is tested there. It is that **the stage behaves
 * exactly as it always did when no directive is supplied**, because that is the
 * path every run takes with `DIRECTOR_ENABLED` off, and a regression in it would
 * silently change every generated site.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { designAgent } from '../../agents/designAgent.js';
import { composeDesign } from '../../lib/design/index.js';
import { profileFixture, strategyFixture } from '../fixtures/business.js';
import { fullContent } from '../fixtures/content.js';

import type { AgentContext } from '../../lib/types.js';
import type { DesignDirective } from '../../lib/design/directive.js';
import type { Logger } from '../../lib/logger.js';
import type { Platform } from '../../lib/platform/platform.js';

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
  async time<T>(_label: string, fn: () => Promise<T>): Promise<T> { return fn(); },
};

/** A context with no model, no browser and no features — the design stage needs none. */
function ctx(features: Readonly<Record<string, boolean>> = {}): AgentContext {
  return {
    runId: 'test-run',
    config: { features } as AgentContext['config'],
    logger: noopLogger,
    getBrowser: async () => { throw new Error('the design stage must not open a browser'); },
    platform: {
      ai: () => { throw new Error('the design stage must not call a model'); },
    } as unknown as Platform,
    outputDir: '/tmp/test-output',
    signal: new AbortController().signal,
  };
}

function input() {
  return { profile: profileFixture(), strategy: strategyFixture(), content: fullContent };
}

describe('design stage – no directive', () => {
  it('is identical to composeDesign with no options', async () => {
    const design = await designAgent.run(input(), ctx());
    assert.deepEqual(design, composeDesign(input()));
  });

  it('makes no model call', async () => {
    // `ctx().platform.ai()` throws. Reaching the end proves it was never called.
    await designAgent.run(input(), ctx());
  });

  it('opens no browser', async () => {
    await designAgent.run(input(), ctx());
  });
});

describe('design stage – with a directive', () => {
  const directive: DesignDirective = {
    direction: 'luxury',
    rationale: 'The listing and copy read as a high-end venue.',
    confidence: 0.9,
  };

  it('composes in the direction the director chose', async () => {
    const design = await designAgent.run({ ...input(), directive }, ctx());
    assert.equal(design.personality.direction, 'luxury');
  });

  it('differs from the undirected design', async () => {
    const directed = await designAgent.run({ ...input(), directive }, ctx());
    const inferred = await designAgent.run(input(), ctx());
    assert.notDeepEqual(directed, inferred);
  });

  it('stays deterministic — the same directive twice is the same design', async () => {
    const a = await designAgent.run({ ...input(), directive }, ctx());
    const b = await designAgent.run({ ...input(), directive }, ctx());
    assert.deepEqual(a, b);
  });

  /*
   * The precedence rule, end to end through the stage rather than through the
   * adapter alone. An operator who forces a direction has overridden the
   * model, and a release that quietly inverted this would be very hard to
   * notice from the output.
   */
  it('lets an operator override beat the director', async () => {
    const design = await designAgent.run(
      { ...input(), directive },
      ctx({ 'design-direction-playful': true }),
    );
    assert.equal(design.personality.direction, 'playful');
  });

  it('ignores a direction outside the closed set, falling back to inference', async () => {
    const design = await designAgent.run(
      { ...input(), directive: { direction: 'galaxy-brain' as DesignDirective['direction'] } },
      ctx(),
    );
    assert.equal(design.personality.direction, composeDesign(input()).personality.direction);
  });

  it('raises the contrast floor when the director asks for AAA', async () => {
    const design = await designAgent.run(
      { ...input(), directive: { accessibilityTarget: 'AAA' } },
      ctx(),
    );
    assert.equal(design.accessibility.targetLevel, 'AAA');
  });
});
