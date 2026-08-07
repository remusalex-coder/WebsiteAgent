/**
 * Putting a rendered site on disk.
 *
 * The renderer plans asset placement; this is the half that moves bytes, and
 * the cases worth testing are the ones where the plan and the filesystem
 * disagree.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { renderSite, writeRenderedSite } from '../../lib/render/index.js';
import { fullContent } from '../fixtures/content.js';

describe('writeRenderedSite', () => {
  let sourceDir = '';
  let targetDir = '';

  before(async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'businessforge-render-'));
    sourceDir = path.join(root, 'run');
    targetDir = path.join(root, 'site');

    // Two of the three assets the spec refers to exist; the third does not.
    await fs.mkdir(path.join(sourceDir, 'assets'), { recursive: true });
    await fs.writeFile(path.join(sourceDir, 'assets', 'logo-a1b2.png'), 'logo-bytes');
    await fs.writeFile(path.join(sourceDir, 'assets', 'hero-e5f6.jpg'), 'hero-bytes');
  });

  after(async () => {
    await fs.rm(path.dirname(sourceDir), { recursive: true, force: true });
  });

  it('writes the files and copies the assets it can find', async () => {
    const site = renderSite(fullContent);
    const result = await writeRenderedSite(site, { sourceDir, targetDir });

    assert.deepEqual(result.written, [
      'index.html',
      'styles.css',
      'assets/hero-e5f6.jpg',
      'assets/logo-a1b2.png',
    ]);
    assert.deepEqual(result.missingAssets, ['assets/favicon-c3d4.ico']);
  });

  it('produces a site whose bytes match the render', async () => {
    const site = renderSite(fullContent);
    await writeRenderedSite(site, { sourceDir, targetDir });

    const written = await fs.readFile(path.join(targetDir, 'index.html'), 'utf8');
    assert.equal(written, site.files[0]?.contents);
    assert.equal(await fs.readFile(path.join(targetDir, 'assets', 'hero-e5f6.jpg'), 'utf8'), 'hero-bytes');
  });

  it('is repeatable — a second write leaves the same tree', async () => {
    const site = renderSite(fullContent);
    const first = await writeRenderedSite(site, { sourceDir, targetDir });
    const second = await writeRenderedSite(site, { sourceDir, targetDir });
    assert.deepEqual(first, second);
  });
});
