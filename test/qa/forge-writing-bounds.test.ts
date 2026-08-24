/**
 * The invariant, asserted rather than documented: Forge's writing modules
 * (`builder.ts`, `repair.ts`, and everything else under `lib/forge/`) cannot
 * write bytes to a customer artifact outside the fenced, gated path.
 *
 * `lib/forge/` is the one place in this codebase where an AI model's raw
 * output — whole-document HTML, CSS, and JavaScript, not a field slotted
 * into a template — is written to disk verbatim. `anti-ai-gate.ts` audits
 * that output's *content* (forbidden claims, restraint-contract violations,
 * structural convergence); it says nothing about where the bytes land. This
 * file is the other half: a static proof that every filesystem write this
 * subsystem performs targets a fixed, code-controlled location, never a
 * path built from anything the model, a scraped web page, or a business
 * name could influence.
 *
 * ## Method
 *
 * Same technique as `test/qa/no-agent-spawn.test.ts`: a source scan, not a
 * runtime trace. Every `fs.writeFile`/`fs.copyFile`/`fs.rm`/`fs.unlink`/
 * `fs.rename` call site under `lib/forge/` is enumerated and checked against
 * an explicit allowlist of shapes this test's author read and verified by
 * hand (see the comment above each pattern for the specific call site it
 * covers and why it's safe). A call site that doesn't match any allowed
 * shape fails the test by name — a new dynamic-path write cannot land
 * silently; it has to widen this allowlist, which means a human reads it.
 *
 * `fs.mkdir` is checked separately (it creates directories, not artifacts,
 * but an attacker-controlled `mkdir` path is the same class of problem) with
 * a looser rule: its target must still resolve under a `path.join` call
 * whose components are code-controlled, never a bare model-derived string.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FORGE_DIR = path.join(ROOT, 'lib', 'forge');

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

/** Extracts `fn(...)` call sites for a given `fs.<method>` name, argument text only. */
function callSitesOf(source: string, method: string): string[] {
  const calls: string[] = [];
  const needle = `fs.${method}(`;
  let searchFrom = 0;
  for (;;) {
    const start = source.indexOf(needle, searchFrom);
    if (start === -1) break;
    const argsStart = start + needle.length;
    let depth = 1;
    let i = argsStart;
    while (i < source.length && depth > 0) {
      if (source[i] === '(') depth++;
      else if (source[i] === ')') depth--;
      i++;
    }
    calls.push(source.slice(argsStart, i - 1).replace(/\s+/g, ' ').trim());
    searchFrom = i;
  }
  return calls;
}

/**
 * A filename literal that structurally cannot carry a path separator or a
 * traversal segment: only letters, digits, `.`, `_`, `-`, and every `.`
 * bounded by a non-empty run of those characters on both sides — which makes
 * `..` impossible to construct (it would require an empty segment).
 */
const SAFE_LITERAL = /^'[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*'$/;

/** One dynamic segment this codebase actually uses: a small integer counter, never model text. */
const SAFE_TEMPLATE_DYNAMIC_SEGMENTS = [
  // orchestrator.ts's repair-iteration file names — `currentIteration` is a
  // loop counter bounded by `maxIterations` (a caller-supplied number), never
  // derived from generated content.
  /^`5-anti-ai-gate-iter\$\{currentIteration\}\.json`$/,
  /^`6-critique-iter\$\{currentIteration\}\.json`$/,
  // research.ts's downloaded-image filename — `downloadedAssets.length + 1`
  // is this function's own counter and `ext` is chosen from a 3-way literal
  // ternary (`.png`/`.webp`/`.jpg`) on the URL's suffix, never the URL text
  // itself copied into a path.
  /^`web_img_\$\{downloadedAssets\.length \+ 1\}\$\{ext\}`$/,
];

/**
 * Finds `const <name> = <rhs>;` in `source` and returns the trimmed RHS, or
 * null. Handles the single-line `const x = path.join(...)` declarations this
 * codebase actually uses — not a general parser.
 */
function findConstDeclaration(source: string, name: string): string | null {
  const pattern = new RegExp(`const\\s+${name}\\s*=\\s*([^;]+);`);
  const match = pattern.exec(source);
  return match?.[1] !== undefined ? match[1].trim() : null;
}

/**
 * Whether a single path-component argument is provably safe: a literal, a
 * known-safe dynamic template, the one verified readdir-entry identifier, or
 * (recursively, up to a small fixed depth) a variable whose own declaration
 * resolves to one of those.
 */
function isSafePathArg(arg: string, source: string, depth: number): boolean {
  if (SAFE_LITERAL.test(arg)) return true;
  if (SAFE_TEMPLATE_DYNAMIC_SEGMENTS.some((pattern) => pattern.test(arg))) return true;
  // builder.ts's asset copy: `f` is bound to `for (const f of assetFiles)`,
  // where `assetFiles = await fs.readdir(runAssetsDir)` — a real directory
  // entry name, never text the model or a scrape produced.
  if (arg === 'f') return true;

  if (depth > 0 && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(arg)) {
    const rhs = findConstDeclaration(source, arg);
    if (rhs === null) return false;
    // The declaration's RHS may itself be a further `path.join(...)` call
    // (recurse structurally) or a literal/template/identifier (recurse as a
    // plain value) — `fileName`'s own declaration in research.ts is the
    // latter case: a template literal, not a nested path.join.
    return rhs.startsWith('path.join(')
      ? isSafePathExpr(rhs, source, depth - 1)
      : isSafePathArg(rhs, source, depth - 1);
  }
  return false;
}

/** `path.join(base, ...)` calls whose filename arguments are all provably safe. */
function isSafePathExpr(expr: string, source: string, depth: number): boolean {
  const match = /^path\.join\(([^]*)\)$/.exec(expr);
  if (match?.[1] === undefined) return false;
  const inner = match[1];

  // Split on top-level commas only (none of these call sites nest a further
  // function call inside an argument, so a straight split is exact here).
  const args = inner.split(',').map((a) => a.trim());
  if (args.length < 2) return false;

  // Every argument after the first (the base directory) must resolve to a
  // provably-safe path component.
  return args.slice(1).every((arg) => isSafePathArg(arg, source, depth));
}

/* ------------------------------------------------------------------ */
/* 1. Every byte-writing call targets a provably-safe path              */
/* ------------------------------------------------------------------ */

test('every fs write/copy in lib/forge/ targets a fixed, code-controlled path', () => {
  const offenders: string[] = [];

  for (const file of tsFilesUnder(FORGE_DIR)) {
    const source = fs.readFileSync(file, 'utf8');

    for (const method of ['writeFile', 'copyFile'] as const) {
      for (const call of callSitesOf(source, method)) {
        // `fs.writeFile(path, data, encoding?)` / `fs.copyFile(src, dest)` —
        // the first one or two positional arguments denote a filesystem
        // path; a trailing `'utf8'` (writeFile's third argument) is not a
        // path. Each candidate is either an inline `path.join(...)` or a
        // bare identifier declared earlier in the file as one (resolved by
        // `isSafePathArg`'s recursion) — `htmlPath`/`localFile` and similar.
        const args = call.split(/,(?![^(]*\))/).map((a) => a.trim());
        const candidates = method === 'copyFile' ? args.slice(0, 2) : args.slice(0, 1);

        for (const candidate of candidates) {
          const isPathLike = candidate.startsWith('path.join(') || /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(candidate);
          if (!isPathLike) {
            offenders.push(`${rel(file)}: fs.${method}(${call}) — argument "${candidate}" is neither a path.join() call nor a resolvable identifier`);
            continue;
          }

          const safe = candidate.startsWith('path.join(')
            ? isSafePathExpr(candidate, source, 2)
            : isSafePathArg(candidate, source, 2);

          if (!safe) {
            offenders.push(`${rel(file)}: fs.${method}(${call}) — unrecognized/unsafe path shape: ${candidate}`);
          }
        }
      }
    }

    // No forge module deletes or renames anything today. If one starts to,
    // it must be added to this proof deliberately — an unreviewed delete
    // path is strictly worse than an unreviewed write.
    for (const method of ['rm', 'unlink', 'rename'] as const) {
      for (const call of callSitesOf(source, method)) {
        offenders.push(`${rel(file)}: fs.${method}(${call}) — no forge module should delete/rename; new call site needs review`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `lib/forge/ must only write to fixed, code-controlled paths:\n  ${offenders.join('\n  ')}`,
  );
});

/* ------------------------------------------------------------------ */
/* 2. Generated content is never used to build a path                  */
/* ------------------------------------------------------------------ */

test('builder.ts and repair.ts never use generated code as a path segment', () => {
  // The variables holding the model's own output — the exact thing an
  // untrusted writer would need to control to escape the fence.
  const GENERATED_CONTENT_IDENTIFIERS = [
    'generatedHtml',
    'generatedCss',
    'generatedJs',
    'code.html',
    'code.css',
    'code.js',
    'repaired.html',
    'repaired.css',
    'repaired.js',
    'currentHtml',
    'currentCss',
    'currentJs',
  ];

  const offenders: string[] = [];
  for (const relPath of ['builder.ts', 'repair.ts']) {
    const file = path.join(FORGE_DIR, relPath);
    const source = fs.readFileSync(file, 'utf8');

    // Every path.join(...) / path.resolve(...) call site in the file — none
    // of them may mention a generated-content identifier as an argument.
    const pattern = /path\.(join|resolve)\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const args = match[2] ?? '';
      for (const id of GENERATED_CONTENT_IDENTIFIERS) {
        if (args.includes(id)) {
          offenders.push(`${relPath}: path.${match[1]}(${args}) references generated content "${id}"`);
        }
      }
    }
  }

  assert.deepEqual(offenders, []);
});

/* ------------------------------------------------------------------ */
/* 3. The gate actually runs on Forge's generated code                 */
/* ------------------------------------------------------------------ */

test('auditAntiAIGeneric is actually wired into the orchestrator (guards against a vacuous proof)', () => {
  // Proving nothing escapes the fence is worthless if the gate that reads
  // the model's output is never called. `orchestrator.ts` must both import
  // and invoke it against the code the builder just produced.
  const source = fs.readFileSync(path.join(FORGE_DIR, 'orchestrator.ts'), 'utf8');
  assert.match(source, /import\s*\{\s*auditAntiAIGeneric\s*\}\s*from\s*['"]\.\/anti-ai-gate\.js['"]/);
  assert.match(source, /await\s+auditAntiAIGeneric\(/);
});

/* ------------------------------------------------------------------ */
/* 4. The proof itself finds real call sites (guards against a no-op)  */
/* ------------------------------------------------------------------ */

test('the write-call scanner actually finds real call sites in this codebase', () => {
  const builderSource = fs.readFileSync(path.join(FORGE_DIR, 'builder.ts'), 'utf8');
  const writeCalls = callSitesOf(builderSource, 'writeFile');
  assert.ok(writeCalls.length >= 3, `expected builder.ts to write at least 3 files, found ${writeCalls.length}`);

  const copyCalls = callSitesOf(builderSource, 'copyFile');
  assert.equal(copyCalls.length, 1, 'expected exactly one asset-copy call in builder.ts');
});
