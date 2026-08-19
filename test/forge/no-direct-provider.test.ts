/**
 * The invariant, asserted rather than documented.
 *
 * Before this session, `research.ts`, `grounding.ts`, `builder.ts` and
 * `repair.ts` each called `createAIProvider(config.ai, logger)` directly —
 * one vendor, no failover, no quota awareness, invisible to
 * `platform.capabilities.board()`. That was the single point of failure a
 * Gemini daily-quota exhaustion turned into a stalled pipeline. Every
 * model-backed stage now routes through `lib/capability/`'s planner and
 * executor instead — `createModelInvoker` (text/structured calls) or
 * `createVisionInvoker` (vision calls) — and this file is the fence that
 * keeps a future stage, or a "quick fix" to an existing one, from quietly
 * reaching back around it.
 *
 * Matches the same discipline `test/qa/no-agent-spawn.test.ts` applies to
 * `lib/**`'s process-spawning invariant: a comment saying "route through
 * capabilities" is not a control, an import-graph walk is.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FORGE_DIR = path.join(ROOT, 'lib', 'forge');

/**
 * `lib/capability/invokers.ts` and `lib/capability/visionInvoker.ts` are
 * exempt: they are the sanctioned place a provider is constructed or
 * called directly — that is the capability layer's own job, not a bypass
 * of it. Every module *inside* `lib/forge/` is not exempt.
 */
const EXEMPT: readonly string[] = [];

function tsFilesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (entry.name.endsWith('.ts')) out.push(abs);
    }
  };
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

const rel = (p: string): string => path.relative(ROOT, p).replace(/\\/g, '/');

test('no module under lib/forge/ constructs a provider directly (createAIProvider)', () => {
  const offenders: string[] = [];
  for (const file of tsFilesUnder(FORGE_DIR)) {
    if (EXEMPT.includes(rel(file))) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (/from\s+['"]\.\.\/ai\/factory\.js['"]/.test(source) && /\bcreateAIProvider\(/.test(source)) {
      offenders.push(rel(file));
    }
  }
  assert.deepEqual(offenders, [], `found direct createAIProvider() construction in: ${offenders.join(', ')}`);
});

test('no module under lib/forge/ imports createAIProvider at all — even unused, it is the wrong seam to reach for', () => {
  const offenders: string[] = [];
  for (const file of tsFilesUnder(FORGE_DIR)) {
    if (EXEMPT.includes(rel(file))) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (/import\s*\{[^}]*\bcreateAIProvider\b[^}]*\}\s*from/.test(source)) {
      offenders.push(rel(file));
    }
  }
  assert.deepEqual(offenders, [], `found a createAIProvider import in: ${offenders.join(', ')}`);
});

test('every stage that calls a model imports createModelInvoker or createVisionInvoker from the capability layer', () => {
  // The five model-backed stages, named explicitly rather than discovered —
  // a new stage that skips this list is a gap this test cannot see, but an
  // existing one silently losing its capability import is exactly what this
  // guards against.
  const modelBackedStages = ['research.ts', 'grounding.ts', 'signature.ts', 'builder.ts', 'repair.ts'];
  const offenders: string[] = [];
  for (const name of modelBackedStages) {
    const file = path.join(FORGE_DIR, name);
    const source = fs.readFileSync(file, 'utf8');
    if (!/createModelInvoker/.test(source)) offenders.push(name);
  }
  assert.deepEqual(offenders, [], `expected createModelInvoker in each of ${modelBackedStages.join(', ')}, missing from: ${offenders.join(', ')}`);
});

test('critic.ts (the vision stage) imports createVisionInvoker from the capability layer', () => {
  const source = fs.readFileSync(path.join(FORGE_DIR, 'critic.ts'), 'utf8');
  assert.ok(/createVisionInvoker/.test(source));
});
