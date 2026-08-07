/**
 * Whole-file snapshots.
 *
 * The assertions in `site.test.ts` describe properties; these hold the template
 * still. A change to a class name, an attribute order or a stylesheet rule shows
 * up here as a diff a reviewer reads, which is the point — the renderer is
 * deterministic precisely so that an unintended change to its output is visible.
 *
 * Regenerate deliberately: `UPDATE_SNAPSHOTS=1 npm test`.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderSite } from '../../lib/render/index.js';
import { assertMatchesSnapshot } from '../support/snapshot.js';
import { fullContent, minimalContent } from '../fixtures/content.js';

import type { RenderedSite } from '../../lib/render/index.js';

function file(site: RenderedSite, path: string): string {
  const found = site.files.find((entry) => entry.path === path);
  assert.ok(found, `${path} was not rendered`);
  return found.contents;
}

describe('snapshots', () => {
  it('renders the full spec', () => {
    const site = renderSite(fullContent);
    assertMatchesSnapshot('full.index.html', file(site, 'index.html'));
    assertMatchesSnapshot('full.styles.css', file(site, 'styles.css'));
  });

  it('renders the minimal spec', () => {
    const site = renderSite(minimalContent);
    assertMatchesSnapshot('minimal.index.html', file(site, 'index.html'));
    assertMatchesSnapshot('minimal.styles.css', file(site, 'styles.css'));
  });
});
