/**
 * URL safety and asset placement.
 *
 * The href tests are the security ones: everything a `WebsiteContent` carries
 * was written by a model from scraped data, so a `javascript:` URL reaching an
 * `href` is stored XSS in a site the business will publish.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createAssetPlan, safeHref, safeImageUrl } from '../../lib/render/assets.js';

import type { ImageAsset } from '../../lib/types.js';

function asset(overrides: Partial<ImageAsset> = {}): ImageAsset {
  return {
    sourceUrl: 'https://example.test',
    url: 'https://example.test/a.png',
    role: 'gallery',
    alt: null,
    width: null,
    height: null,
    localPath: null,
    bytes: null,
    ...overrides,
  };
}

describe('safeHref', () => {
  it('allows the schemes a business site needs', () => {
    for (const value of ['https://a.test/x', 'http://a.test', 'mailto:a@b.test', 'tel:+351210000000']) {
      assert.equal(safeHref(value), value);
    }
  });

  it('allows fragments and relative paths', () => {
    for (const value of ['#contact', '/about', './menu.html']) {
      assert.equal(safeHref(value), value);
    }
  });

  it('refuses script-bearing schemes', () => {
    for (const value of ['javascript:alert(1)', 'JavaScript:alert(1)', 'vbscript:msgbox', 'data:text/html,<script>']) {
      assert.equal(safeHref(value), null, value);
    }
  });

  it('refuses a scheme hidden behind characters the browser ignores', () => {
    assert.equal(safeHref('java\nscript:alert(1)'), null);
    assert.equal(safeHref('  javascript:alert(1)'), null);
    assert.equal(safeHref('java\tscript:alert(1)'), null);
  });

  it('refuses protocol-relative URLs, which inherit an unapproved scheme', () => {
    assert.equal(safeHref('//evil.test/x'), null);
  });

  it('refuses an empty target', () => {
    assert.equal(safeHref('   '), null);
  });
});

describe('safeImageUrl', () => {
  it('allows http and https only', () => {
    assert.equal(safeImageUrl('https://a.test/x.png'), 'https://a.test/x.png');
    assert.equal(safeImageUrl('mailto:a@b.test'), null);
    assert.equal(safeImageUrl('data:image/png;base64,AAAA'), null);
  });
});

describe('createAssetPlan', () => {
  it('places a downloaded image under the asset folder and registers the copy', () => {
    const plan = createAssetPlan('assets');
    const resolved = plan.resolve(asset({ localPath: 'assets/logo-a1b2.png', width: 240, height: 80 }));

    assert.deepEqual(resolved, { src: 'assets/logo-a1b2.png', alt: '', width: 240, height: 80 });
    assert.deepEqual(plan.assets(), [{ sourcePath: 'assets/logo-a1b2.png', path: 'assets/logo-a1b2.png' }]);
  });

  it('registers an image used twice only once', () => {
    const plan = createAssetPlan('assets');
    plan.resolve(asset({ localPath: 'assets/x.png' }));
    plan.resolve(asset({ localPath: 'assets/x.png' }));
    assert.equal(plan.assets().length, 1);
  });

  it('renames a colliding basename rather than overwriting it', () => {
    const plan = createAssetPlan('assets');
    const first = plan.resolve(asset({ localPath: 'a/logo.png' }));
    const second = plan.resolve(asset({ localPath: 'b/logo.png' }));

    assert.equal(first?.src, 'assets/logo.png');
    assert.equal(second?.src, 'assets/logo-2.png');
  });

  it('hot-links an image that was never downloaded', () => {
    const plan = createAssetPlan('assets');
    const resolved = plan.resolve(asset({ url: 'https://cdn.test/hero.jpg' }));

    assert.equal(resolved?.src, 'https://cdn.test/hero.jpg');
    assert.deepEqual(plan.assets(), []);
  });

  it('drops an image with no usable location and says so', () => {
    const plan = createAssetPlan('assets');
    assert.equal(plan.resolve(asset({ url: 'javascript:alert(1)' })), null);
    assert.equal(plan.warnings().length, 1);
  });

  it('refuses a localPath that climbs out of the run directory', () => {
    const plan = createAssetPlan('assets');
    const resolved = plan.resolve(asset({ localPath: '../../etc/passwd', url: 'https://a.test/x.png' }));

    assert.equal(resolved?.src, 'https://a.test/x.png');
    assert.deepEqual(plan.assets(), []);
    assert.match(plan.warnings()[0] ?? '', /escapes the run directory/);
  });

  it('uses the fallback alt only when the asset has none', () => {
    const plan = createAssetPlan('assets');
    assert.equal(plan.resolve(asset({ localPath: 'a.png' }), 'Corner Shop')?.alt, 'Corner Shop');
    assert.equal(plan.resolve(asset({ localPath: 'b.png', alt: 'Real alt' }), 'Corner Shop')?.alt, 'Real alt');
  });

  it('leaves alt empty rather than inventing a description', () => {
    const plan = createAssetPlan('assets');
    assert.equal(plan.resolve(asset({ localPath: 'c.png' }))?.alt, '');
  });
});
