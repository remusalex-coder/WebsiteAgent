/**
 * The one piece of preflight that touches the filesystem.
 *
 * Kept apart from `checks/*.ts` for the same reason `lib/render/write.ts` is
 * kept apart from `renderSite`: everything else in this system is a pure,
 * synchronous function of its inputs, and this is the part that is not. Every
 * check that needs what this finds reads it off `PreflightContext.secretScan`
 * instead of touching disk itself.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { scanTextForSecretPatterns } from './helpers.js';

import type { SecretScanResult } from './types.js';

/** Files worth reading as text. Everything else (images, fonts) is skipped. */
const TEXT_FILE_PATTERN = /\.(json|html|css|js|ts|md|txt|ya?ml|env.*)$/i;

/** Names that must never sit in a run's artifact directory. */
const FORBIDDEN_FILENAME = /^\.env(\..+)?$|^credentials\.json$|^service-account.*\.json$/i;

const MAX_FILES_SCANNED = 500;
const MAX_BYTES_PER_FILE = 2_000_000;

async function walk(dir: string, depth: number, out: string[]): Promise<void> {
  if (depth > 6 || out.length >= MAX_FILES_SCANNED) return;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= MAX_FILES_SCANNED) return;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, depth + 1, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
}

async function findRepoRoot(from: string): Promise<string | null> {
  let dir = path.resolve(from);
  for (let i = 0; i < 8; i += 1) {
    try {
      await fs.access(path.join(dir, '.git'));
      return dir;
    } catch {
      // keep climbing
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

async function gitignoreExcludesOutput(repoRoot: string, outputDir: string): Promise<boolean> {
  let contents: string;
  try {
    contents = await fs.readFile(path.join(repoRoot, '.gitignore'), 'utf8');
  } catch {
    return false;
  }
  const relative = path.relative(repoRoot, outputDir).split(path.sep)[0] ?? '';
  const lines = contents.split('\n').map((line) => line.trim().replace(/\/$/, ''));
  // A bare `output`, an anchored `/output`, `output/*` (contents excluded,
  // folder itself tracked — this repo's own convention), or a blanket `*`.
  return (
    lines.includes(relative) ||
    lines.includes(`/${relative}`) ||
    lines.includes(`${relative}/*`) ||
    lines.includes(`/${relative}/*`) ||
    lines.includes('*')
  );
}

/**
 * Scans a run's artifact directory for files that must never sit there, and
 * checks the repository excludes it from version control.
 *
 * Never throws: a run directory that cannot be read scans as "not scanned"
 * rather than failing the whole preflight gate on an I/O error.
 */
export async function scanForSecrets(outputDir: string): Promise<SecretScanResult> {
  const findings: string[] = [];

  const files: string[] = [];
  await walk(outputDir, 0, files);

  for (const file of files) {
    const base = path.basename(file);
    if (FORBIDDEN_FILENAME.test(base)) {
      findings.push(`forbidden file present in the run directory: ${path.relative(outputDir, file)}`);
      continue;
    }
    if (!TEXT_FILE_PATTERN.test(base)) continue;

    let stat;
    try {
      stat = await fs.stat(file);
    } catch {
      continue;
    }
    if (stat.size > MAX_BYTES_PER_FILE) continue;

    let contents: string;
    try {
      contents = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }
    for (const pattern of scanTextForSecretPatterns(contents)) {
      findings.push(`${path.relative(outputDir, file)}: ${pattern}`);
    }
  }

  const repoRoot = await findRepoRoot(outputDir);
  const gitignoreOk = repoRoot === null ? null : await gitignoreExcludesOutput(repoRoot, outputDir);

  return {
    scanned: true,
    findings,
    gitignoreExcludesOutput: gitignoreOk,
  };
}

export const EMPTY_SECRET_SCAN: SecretScanResult = {
  scanned: false,
  findings: [],
  gitignoreExcludesOutput: null,
};
