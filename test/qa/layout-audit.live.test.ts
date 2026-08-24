/**
 * The layout audit against a real browser, on a page built to be broken.
 *
 * `layout-audit.test.ts` proves the *rules* against literal measurements. This
 * proves the other half — that the in-page reader actually finds those defects
 * in Chromium — because a classifier that never receives correct geometry is
 * a gate that passes everything, which is the exact failure this whole module
 * was written to remove.
 *
 * Two fixtures, and the pair is the point: one page is deliberately broken and
 * must be blocked, the other is ordinary and must come back clean. A detector
 * that only ever fires is no more useful than one that never does.
 *
 * Launches Chromium, so it is slower than the rest of the suite. It is still a
 * unit test: no network, no model, no pipeline.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { auditLayout } from '../../lib/qa/layout-audit.js';
import { createLogger, createConsoleSink } from '../../lib/logger.js';

const logger = createLogger({ level: 'error', scope: 'layout-live', sink: createConsoleSink() });

/** Writes `html` into a throwaway site directory and returns its path. */
async function siteWith(html: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-layout-'));
  await fs.writeFile(path.join(dir, 'index.html'), html, 'utf8');
  return dir;
}

const BROKEN = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin: 0; font: 16px/1.5 system-ui; }
  section { position: relative; }
  /* Sits 300px back into its predecessor. */
  .collides { margin-top: -300px; background: #eee; }
  /* Fixed pixel width no phone can contain. */
  .wide { width: 1200px; background: #ddd; }
</style></head>
<body>
  <section class="a" style="height:600px"><h1>First</h1><p>Some real copy here.</p></section>
  <section class="collides" style="height:600px"><h2>Second</h2><p>More copy.</p></section>
  <section class="wide" style="height:400px"><h2>Third</h2><p>A very wide block.</p></section>
</body></html>`;

const SOUND = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin: 0; font: 16px/1.5 system-ui; }
  section { padding: 24px; box-sizing: border-box; }
</style></head>
<body>
  <section style="height:600px"><h1>First</h1><p>Some real copy here.</p></section>
  <section style="height:600px"><h2>Second</h2><p>More copy, on its own.</p></section>
  <section style="height:600px"><h2>Third</h2><p>And a third block of copy.</p></section>
</body></html>`;

test('a broken page is blocked, naming the overlap and the overflow', async () => {
  const dir = await siteWith(BROKEN);
  const audit = await auditLayout({ siteDir: dir, logger });

  assert.equal(audit.ok, false, 'a page that overlaps and overflows must not pass');

  const kinds = new Set(audit.findings.filter((f) => f.severity === 'blocking').map((f) => f.kind));
  assert.ok(kinds.has('overlap'), `expected an overlap finding, got ${[...kinds].join(', ')}`);
  assert.ok(
    kinds.has('horizontal-overflow'),
    `expected a horizontal overflow finding, got ${[...kinds].join(', ')}`,
  );

  // The overflow is a phone problem specifically: 1200px fits 1440 but not 390.
  const overflow = audit.findings.filter((f) => f.kind === 'horizontal-overflow');
  assert.ok(
    overflow.some((f) => f.viewport === 'mobile'),
    'the 1200px block must be reported against the mobile viewport',
  );

  await fs.rm(dir, { recursive: true, force: true });
});

test('an ordinary page passes', async () => {
  const dir = await siteWith(SOUND);
  const audit = await auditLayout({ siteDir: dir, logger });

  assert.equal(
    audit.ok,
    true,
    `expected a clean audit, got: ${audit.findings.map((f) => `${f.kind}/${f.viewport}: ${f.detail}`).join(' | ')}`,
  );

  await fs.rm(dir, { recursive: true, force: true });
});
