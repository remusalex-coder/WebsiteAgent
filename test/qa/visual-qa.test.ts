/**
 * Visual QA loop — unit tests.
 *
 * These exercise the decision logic and the patcher without a model and without
 * a browser. The analyzer and the patcher are injected, so the loop's behaviour
 * — stop on clean, keep fixing while defects remain, refuse ambiguous edits,
 * gate on mechanical checks — is asserted in isolation. The real vision call
 * and the Claude Code patcher are integration paths covered by `scripts/visual-qa.ts`.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createConsoleSink, createLogger } from '../../lib/logger.js';
import {
  applyPatches,
  runVisualQa,
  type FilePatch,
  type PatchOutcome,
  type VisionAnalysis,
  type VisualDefect,
} from '../../lib/qa/visual-qa.js';

function logger(): ReturnType<typeof createLogger> {
  return createLogger({ level: 'silent', scope: 'test', sink: createConsoleSink() });
}

function defect(over: Partial<VisualDefect> = {}): VisualDefect {
  return {
    id: 'd1',
    viewport: 'desktop',
    category: 'spacing',
    severity: 'major',
    description: 'Hero heading touches the top edge',
    location: 'header h1',
    suggestedFix: 'add padding-block to .hero',
    ...over,
  };
}

function noScreenshots(): Promise<readonly { viewport: 'desktop' | 'mobile'; path: string }[]> {
  // A bogus path is fine: `analyze` is injected in tests and ignores the bytes.
  // The loop only needs `shots.length > 0` to proceed past the capture guard.
  return Promise.resolve([{ viewport: 'desktop', path: '/tmp/visual-qa-bogus.png' }]);
}

function writeSite(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const indexPath = path.join(dir, 'index.html');
  fs.writeFileSync(indexPath, '<!doctype html><html lang="en"><head><title>T</title></head><body><h1>Hi</h1><img src="a.png" alt="A"></body></html>');
  return indexPath;
}

/* ------------------------------------------------------------------ */
/* applyPatches                                                        */
/* ------------------------------------------------------------------ */

test('applyPatches applies an unambiguous edit', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vqa-'));
  const css = path.join(dir, 'styles.css');
  fs.writeFileSync(css, '.hero { padding: 0; }');

  const outcomes = await applyPatches(css, [{ file: css, find: 'padding: 0;', replace: 'padding: 2rem;' }]);
  assert.equal(outcomes.length, 1);
  const first = outcomes[0];
  assert.ok(first !== undefined);
  assert.equal(first.applied, true);
  assert.match(fs.readFileSync(css, 'utf8'), /padding: 2rem;/);
});

test('applyPatches refuses a pattern that matches more than once', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vqa-'));
  const css = path.join(dir, 'styles.css');
  fs.writeFileSync(css, '.a { x: 1; }\n.b { x: 1; }');

  const outcomes = await applyPatches(css, [{ file: css, find: 'x: 1;', replace: 'x: 2;' }]);
  const first = outcomes[0];
  assert.ok(first !== undefined);
  assert.equal(first.applied, false);
  assert.match(first.reason ?? '', /more than once/);
  // File untouched.
  assert.equal(fs.readFileSync(css, 'utf8'), '.a { x: 1; }\n.b { x: 1; }');
});

test('applyPatches reports when the pattern is absent', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vqa-'));
  const css = path.join(dir, 'styles.css');
  fs.writeFileSync(css, '.a { color: red; }');

  const outcomes = await applyPatches(css, [{ file: css, find: 'nope', replace: 'yes' }]);
  const first = outcomes[0];
  assert.ok(first !== undefined);
  assert.equal(first.applied, false);
  assert.match(first.reason ?? '', /not found/);
});

/* ------------------------------------------------------------------ */
/* runVisualQa — decision logic                                       */
/* ------------------------------------------------------------------ */

test('loop stops immediately when the first analysis reports no defects', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vqa-'));
  writeSite(dir);
  let analyzes = 0;
  const result = await runVisualQa({
    siteDir: dir,
    visionApiKey: 'k',
    visionBaseUrl: 'x',
    visionModel: 'm',
    timeoutMs: 1,
    maxAttempts: 3,
    logger: logger(),
    capture: noScreenshots,
    analyze: async () => {
      analyzes += 1;
      return { defects: [], notes: [] };
    },
    patchSite: async () => [],
  });

  assert.equal(analyzes, 1);
  assert.equal(result.verdict, 'fixed');
  assert.equal(result.attempts, 1);
  assert.equal(result.remainingDefects.length, 0);
});

test('loop keeps fixing while defects remain and stops at the attempt ceiling', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vqa-'));
  writeSite(dir);
  let calls = 0;
  const result = await runVisualQa({
    siteDir: dir,
    visionApiKey: 'k',
    visionBaseUrl: 'x',
    visionModel: 'm',
    timeoutMs: 1,
    maxAttempts: 2,
    logger: logger(),
    capture: noScreenshots,
    analyze: async (): Promise<VisionAnalysis> => ({ defects: [defect()], notes: [] }),
    patchSite: async (): Promise<readonly PatchOutcome[]> => [],
  });
  calls = result.attempts;

  assert.equal(calls, 2);
  assert.equal(result.verdict, 'unfixed');
  assert.equal(result.remainingDefects.length, 1);
});

test('loop reports partial when some fixes applied but defects remain', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vqa-'));
  writeSite(dir);
  const result = await runVisualQa({
    siteDir: dir,
    visionApiKey: 'k',
    visionBaseUrl: 'x',
    visionModel: 'm',
    timeoutMs: 1,
    maxAttempts: 2,
    logger: logger(),
    capture: noScreenshots,
    analyze: async (): Promise<VisionAnalysis> => ({ defects: [defect()], notes: [] }),
    patchSite: async (): Promise<readonly PatchOutcome[]> => [
      { applied: true, patch: { file: 'styles.css', find: 'a', replace: 'b' } as FilePatch },
    ],
  });

  assert.equal(result.verdict, 'partial');
  assert.ok(result.resolved.length >= 1);
});

test('loop treats a vision outage as non-fatal and stops', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vqa-'));
  writeSite(dir);
  const result = await runVisualQa({
    siteDir: dir,
    visionApiKey: 'k',
    visionBaseUrl: 'x',
    visionModel: 'm',
    timeoutMs: 1,
    maxAttempts: 3,
    logger: logger(),
    capture: noScreenshots,
    analyze: async (): Promise<VisionAnalysis> => {
      throw new Error('vision 503');
    },
    patchSite: async (): Promise<readonly PatchOutcome[]> => [],
  });

  assert.equal(result.attempts, 1);
  // No defect was ever confirmed resolved; the page is left as-is.
  assert.equal(result.verdict, 'unfixed');
});

test('loop refuses to run when capture yields no screenshots', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vqa-'));
  writeSite(dir);
  let analyzeCalls = 0;
  const result = await runVisualQa({
    siteDir: dir,
    visionApiKey: 'k',
    visionBaseUrl: 'x',
    visionModel: 'm',
    timeoutMs: 1,
    maxAttempts: 3,
    logger: logger(),
    capture: async () => [],
    analyze: async (): Promise<VisionAnalysis> => {
      analyzeCalls += 1;
      return { defects: [], notes: [] };
    },
    patchSite: async () => [],
  });

  assert.equal(analyzeCalls, 0);
});

test('mechanical gate still passes on a clean static site after a no-op run', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vqa-'));
  writeSite(dir);
  const result = await runVisualQa({
    siteDir: dir,
    visionApiKey: 'k',
    visionBaseUrl: 'x',
    visionModel: 'm',
    timeoutMs: 1,
    maxAttempts: 1,
    logger: logger(),
    capture: noScreenshots,
    analyze: async (): Promise<VisionAnalysis> => ({ defects: [], notes: [] }),
    patchSite: async () => [],
  });

  assert.ok(result.finalChecks.every((c) => c.passed), 'all mechanical checks should pass on a valid page');
});
