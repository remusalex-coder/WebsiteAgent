import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { scanForSecrets } from '../../lib/preflight/scan.js';

describe('scanForSecrets', () => {
  let root = '';

  before(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'businessforge-preflight-'));
  });

  after(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('reports clean on an ordinary run directory with no secrets', async () => {
    const dir = path.join(root, 'clean-run');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'content.json'), '{"businessName":"Padaria Ana"}\n', 'utf8');

    const result = await scanForSecrets(dir);
    assert.equal(result.scanned, true);
    assert.deepEqual(result.findings, []);
  });

  it('flags a forbidden .env file sitting in the run directory (required: secrets in git)', async () => {
    const dir = path.join(root, 'leaky-env');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, '.env'), 'ANTHROPIC_API_KEY=sk-ant-should-not-be-here\n', 'utf8');

    const result = await scanForSecrets(dir);
    assert.equal(result.findings.length > 0, true);
    assert.match(result.findings.join(' '), /forbidden file present/);
  });

  it('flags a secret-shaped string inside a text artifact', async () => {
    const dir = path.join(root, 'leaky-content');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'content.json'),
      '{"note":"AKIAABCDEFGHIJKLMNOP"}\n',
      'utf8',
    );

    const result = await scanForSecrets(dir);
    assert.match(result.findings.join(' '), /AWS access key/);
  });

  it('does not scan binary/image files by extension', async () => {
    const dir = path.join(root, 'has-image');
    await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
    // A file whose bytes happen to contain a secret-shaped run, but whose
    // extension marks it as an asset rather than text — must not be read.
    await fs.writeFile(path.join(dir, 'assets', 'hero.jpg'), 'AKIAABCDEFGHIJKLMNOP', 'utf8');

    const result = await scanForSecrets(dir);
    assert.deepEqual(result.findings, []);
  });

  it('recognises an "<dir>/*" gitignore pattern (this repository\'s own convention) as excluding the output directory', async () => {
    const repo = path.join(root, 'repo-with-star-pattern');
    const outputDir = path.join(repo, 'output', 'run-1');
    await fs.mkdir(path.join(repo, '.git'), { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(repo, '.gitignore'), 'node_modules/\noutput/*\n!output/.gitkeep\n', 'utf8');

    const result = await scanForSecrets(outputDir);
    assert.equal(result.gitignoreExcludesOutput, true);
  });

  it('resolves gitignoreExcludesOutput to null when no repository root is found', async () => {
    const dir = path.join(root, 'no-repo-here');
    await fs.mkdir(dir, { recursive: true });
    const result = await scanForSecrets(dir);
    assert.equal(result.gitignoreExcludesOutput, null);
  });

  it('never throws for a directory that does not exist', async () => {
    const result = await scanForSecrets(path.join(root, 'does-not-exist'));
    assert.equal(result.scanned, true);
    assert.deepEqual(result.findings, []);
  });
});
