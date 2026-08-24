/**
 * P3-1 / F-14 — `lib/config.ts` is the only `process.env` reader.
 *
 * The freeze names this a static test: grep for `process.env` outside
 * `config.ts` returns only the allowed line. Two forms of allowed read exist:
 *
 * 1. Inside `lib/`, only `lib/config.ts` may read the environment, and only in
 *    `loadConfig`'s default argument — the injectable seam every stage uses.
 *    Everything else receives an `AppConfig` or an explicit env object.
 * 2. The two pipeline scripts that the freeze's P3-1 names (`run-job.ts`,
 *    `visual-qa.ts`) must resolve `VISION_*` through `config.vision`, not by
 *    reading the environment themselves.
 *
 * This test is intentionally broad and mechanical: F-14 exists because a
 * `process.env` read at the point of use is a read nobody has to explain.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';

import { loadConfig } from '../../lib/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

function readLines(file: string): string[] {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/);
}

test('lib/ contains no direct process.env value reads outside config.ts', () => {
  const violations: string[] = [];
  for (const file of walk(path.join(ROOT, 'lib'))) {
    readLines(file).forEach((line, index) => {
      // A direct value read is `process.env.<KEY>` or `process.env[<expr>]`.
      // The allowed form is an injectable default (`env = process.env`) on a
      // parameter callers override — that is the test seam F-14 sanctions.
      const code = line.replace(/^\s*\*.*$/, '').trim();
      if (code === '') return;
      if (!/process\.env(?:\.[A-Z_][A-Z0-9_]*|\[)/.test(code)) return;
      violations.push(`${path.relative(ROOT, file)}:${index + 1}: ${code}`);
    });
  }
  assert.deepEqual(violations, [], 'direct process.env value reads outside config.ts');
});

test('run-job.ts resolves vision through config, not the environment', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'run-job.ts'), 'utf8');
  assert.equal(source.includes('process.env.VISION_'), false, 'run-job.ts must not read VISION_* from the environment');
  assert.equal(source.includes('config.vision'), true, 'run-job.ts must read vision through config');
});

test('visual-qa.ts resolves vision through config, not the environment', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'visual-qa.ts'), 'utf8');
  assert.equal(source.includes('process.env.VISION_'), false, 'visual-qa.ts must not read VISION_* from the environment');
  assert.equal(source.includes('config.vision'), true, 'visual-qa.ts must read vision through config');
});

test('loadConfig parses VISION_* into config.vision', () => {
  const config = loadConfig({
    VISION_API_KEY: 'key-1',
    VISION_BASE_URL: 'https://vision.example/v1',
    VISION_MODEL: 'vision-model-x',
  } as NodeJS.ProcessEnv);
  assert.equal(config.vision.apiKey, 'key-1');
  assert.equal(config.vision.baseUrl, 'https://vision.example/v1');
  assert.equal(config.vision.model, 'vision-model-x');
});

test('vision defaults to disabled when no key is present', () => {
  const config = loadConfig({} as NodeJS.ProcessEnv);
  assert.equal(config.vision.apiKey, '');
  assert.equal(config.vision.baseUrl, null);
  assert.notEqual(config.vision.model, '');
});