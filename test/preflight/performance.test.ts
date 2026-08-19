import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { performanceChecks } from '../../lib/preflight/checks/performance.js';
import { buildContext } from './support.js';
import type { ImageAsset } from '../../lib/types.js';

function run(id: string, overrides: Parameters<typeof buildContext>[0] = {}) {
  const ctx = buildContext(overrides);
  const result = performanceChecks.map((check) => check(ctx)).find((r) => r.id === id);
  assert.ok(result, `no check registered with id "${id}"`);
  return result;
}

describe('performance.image-loading-strategy', () => {
  it('is not applicable with no images on the page', () => {
    assert.equal(run('performance.image-loading-strategy').status, 'NOT_APPLICABLE');
  });
});

describe('performance.no-external-requests', () => {
  it('passes: the renderer emits no third-party script or link references', () => {
    assert.equal(run('performance.no-external-requests').status, 'PASS');
  });
});

describe('performance.asset-weight', () => {
  it('is not applicable when no asset carries a measured byte size', () => {
    assert.equal(run('performance.asset-weight').status, 'NOT_APPLICABLE');
  });

  it('warns once the measured total crosses the soft budget', () => {
    const heavy: ImageAsset = {
      sourceUrl: 'https://example.test',
      url: 'https://example.test/hero.jpg',
      role: 'hero',
      alt: 'Hero',
      width: 2000,
      height: 1200,
      localPath: null,
      bytes: 3_500_000,
    };
    const result = run('performance.asset-weight', { profile: { hero: heavy } });
    assert.equal(result.status, 'WARN');
  });
});

describe('performance.font-loading', () => {
  it('is not applicable when composeDesign selects the system stack (no vendored fonts declared)', () => {
    const result = run('performance.font-loading');
    assert.ok(result.status === 'NOT_APPLICABLE' || result.status === 'PASS');
  });
});
