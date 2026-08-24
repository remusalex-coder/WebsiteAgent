/**
 * The invariant, asserted rather than documented.
 *
 * `scripts/visual-qa.ts --autofix` spawns Claude Code with `Read,Edit,Write`
 * inside the rendered site directory and lets it rewrite `index.html` and
 * `styles.css`. Those are bytes a customer receives, which the deterministic
 * renderer is supposed to own alone.
 *
 * The path is kept — a human repairing a run by hand is legitimate — but it is
 * fenced off from everything automated. This file is the fence:
 *
 *   1. no module under `lib/**` spawns a process at all;
 *   2. no autonomous entry point can reach the patcher, transitively;
 *   3. the patcher is gated on an interactive terminal, not on a flag or an
 *      environment variable that a spawned stage would inherit.
 *
 * A comment saying "do not wire this in" is not a control. An import-graph walk
 * is.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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

/* ------------------------------------------------------------------ */
/* 1. lib/** never spawns a process                                    */
/* ------------------------------------------------------------------ */

test('no module under lib/ spawns a process', () => {
  const offenders: string[] = [];
  for (const file of tsFilesUnder(path.join(ROOT, 'lib'))) {
    const source = fs.readFileSync(file, 'utf8');
    if (/from\s+['"]node:child_process['"]|require\(['"]child_process['"]\)/.test(source)) {
      offenders.push(rel(file));
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `lib/ must stay process-free; a model driven from the library layer is reachable from every stage:\n  ${offenders.join('\n  ')}`,
  );
});

/* ------------------------------------------------------------------ */
/* 2. No autonomous entry point reaches the patcher                    */
/* ------------------------------------------------------------------ */

/** Resolves a relative import specifier to a file on disk, or null. */
function resolveImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  // The codebase writes `.js` in specifiers and ships `.ts` on disk.
  for (const candidate of [base.replace(/\.js$/, '.ts'), `${base}.ts`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function importsOf(file: string): string[] {
  const source = fs.readFileSync(file, 'utf8');
  const specifiers: string[] = [];
  const pattern = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const specifier = match[1];
    if (specifier !== undefined) specifiers.push(specifier);
  }
  return specifiers;
}

/** Every file transitively reachable from `entry` by a relative import. */
function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    for (const specifier of importsOf(current)) {
      const resolved = resolveImport(current, specifier);
      if (resolved !== null && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

/**
 * The entry points that run without a human present.
 *
 * `main.ts` is the pipeline, `runJob.ts` the in-process loop, and the n8n pair
 * is what the workflow calls over HTTP. If the patcher is reachable from any of
 * them, an orchestrator can reach it too.
 */
const AUTONOMOUS_ENTRIES = [
  'main.ts',
  'lib/workflow/runJob.ts',
  'scripts/n8n/stage.ts',
  'scripts/n8n/stage-server.ts',
];

const PATCHER = path.join(ROOT, 'scripts', 'visual-qa.ts');

test('no autonomous entry point can reach the model patcher', () => {
  for (const entry of AUTONOMOUS_ENTRIES) {
    const abs = path.join(ROOT, entry);
    if (!fs.existsSync(abs)) continue;
    const reachable = reachableFrom(abs);
    assert.ok(
      !reachable.has(PATCHER),
      `${entry} can reach scripts/visual-qa.ts, which spawns a coding agent with write access to the delivered site`,
    );
  }
});

test('the import walker actually finds things (guards against a vacuous pass)', () => {
  // If `reachableFrom` silently resolved nothing, the test above would pass for
  // the wrong reason. runJob must reach the gate it demonstrably imports.
  const reachable = reachableFrom(path.join(ROOT, 'lib', 'workflow', 'runJob.ts'));
  assert.ok(reachable.has(path.join(ROOT, 'lib', 'qa', 'distinctness-gate.ts')));
  assert.ok(reachable.has(path.join(ROOT, 'lib', 'workflow', 'candidates.ts')));
  assert.ok(reachable.size > 20, `expected a real graph, got ${reachable.size} files`);
});

/* ------------------------------------------------------------------ */
/* 3. The gate is interactive, not a flag or an env var                */
/* ------------------------------------------------------------------ */

test('autofix is gated on an interactive terminal and a typed phrase', () => {
  const source = fs.readFileSync(PATCHER, 'utf8');

  assert.match(source, /process\.stdin\.isTTY/, 'the gate must require a real terminal');
  assert.match(source, /process\.stdout\.isTTY/, 'the gate must require a real terminal');
  assert.match(source, /AUTOFIX_CONFIRMATION/, 'the gate must require a typed confirmation phrase');

  // The patcher must be selected through the gate, never straight off the flag.
  assert.doesNotMatch(
    source,
    /patchSite:\s*autofix\s*\?/,
    'patchSite must not be chosen by the --autofix flag alone',
  );
  assert.match(source, /patchSite:\s*patchingAllowed\s*\?/);

  // An environment variable would be inherited by any spawned stage.
  assert.doesNotMatch(
    source,
    /process\.env\.[A-Z_]*AUTOFIX/,
    'autofix must not be reachable through the environment',
  );
});
