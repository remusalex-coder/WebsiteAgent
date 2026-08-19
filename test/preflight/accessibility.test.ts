import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { accessibilityChecks } from '../../lib/preflight/checks/accessibility.js';
import { buildContext, section } from './support.js';
import type { ImageAsset } from '../../lib/types.js';

function run(id: string, overrides: Parameters<typeof buildContext>[0] = {}) {
  const ctx = buildContext(overrides);
  const result = accessibilityChecks.map((check) => check(ctx)).find((r) => r.id === id);
  assert.ok(result, `no check registered with id "${id}"`);
  return result;
}

const describedImage: ImageAsset = {
  sourceUrl: 'https://example.test',
  url: 'https://example.test/loaf.jpg',
  role: 'gallery',
  alt: 'Loaves cooling on a rack',
  width: 800,
  height: 600,
  localPath: null,
  bytes: null,
};

const undescribedImage: ImageAsset = { ...describedImage, alt: null };

describe('a11y.image-alt-text', () => {
  it('is not applicable when the content spec places no images', () => {
    assert.equal(run('a11y.image-alt-text').status, 'NOT_APPLICABLE');
  });

  it('fails when every placed image has no alt text', () => {
    const result = run('a11y.image-alt-text', {
      content: {
        sections: [section({ kind: 'hero', heading: 'Hi', images: [undescribedImage] })],
      },
    });
    assert.equal(result.status, 'FAIL');
  });

  it('passes when placed images carry real alt text', () => {
    const result = run('a11y.image-alt-text', {
      content: {
        sections: [section({ kind: 'hero', heading: 'Hi', images: [describedImage] })],
      },
    });
    assert.equal(result.status, 'PASS');
  });
});

describe('a11y.heading-structure', () => {
  it('passes: the renderer always emits exactly one h1', () => {
    assert.equal(run('a11y.heading-structure').status, 'PASS');
  });
});

describe('a11y.landmarks-skip-link', () => {
  it('passes for a normally rendered page', () => {
    assert.equal(run('a11y.landmarks-skip-link').status, 'PASS');
  });
});

describe('a11y.color-contrast', () => {
  it('passes: composeDesign only emits palettes that clear its own contrast target', () => {
    const result = run('a11y.color-contrast');
    assert.equal(result.status, 'PASS');
  });
});

describe('a11y.tap-targets', () => {
  it('passes: the design layer\'s minimum tap target is at least 44px', () => {
    assert.equal(run('a11y.tap-targets').status, 'PASS');
  });
});
