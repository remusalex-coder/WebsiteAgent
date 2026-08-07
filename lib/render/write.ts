/**
 * Putting a rendered site on disk.
 *
 * Split from `renderSite` on purpose. Rendering is pure and testable without a
 * temporary directory; this is the only part that touches the filesystem, and a
 * deployment target that uploads bytes straight from `RenderedSite` can ignore
 * it entirely.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { RenderedSite } from './types.js';

/**
 * Where the vendored typefaces live.
 *
 * Resolved from this module rather than from `process.cwd()`, so the writer
 * works the same whether it is called from the CLI, from a test, or from a
 * deployment stage that never sets a working directory. `basename` is taken off
 * every file name before it is joined, so nothing from a manifest can walk out.
 */
const VENDORED_FONT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'assets',
  'fonts',
);

export interface WriteOptions {
  /** Where `ImageAsset.localPath` is relative to — the run's artifact folder. */
  readonly sourceDir: string;
  /** Where the site is written. Created if it does not exist. */
  readonly targetDir: string;
}

export interface WriteResult {
  /** Site-relative paths actually written, files first, then assets. */
  readonly written: readonly string[];
  /**
   * Assets the plan referenced but the source folder did not have.
   *
   * A missing asset is reported rather than thrown: the page still renders, and
   * one absent image should not fail a deploy that is otherwise complete.
   */
  readonly missingAssets: readonly string[];
}

/**
 * Refuses a path that would land outside the target directory.
 *
 * The names come from a rendered spec, and everything upstream sanitises them —
 * this is the check that does not depend on the ones before it holding.
 */
function resolveInside(root: string, relative: string): string | null {
  const full = path.resolve(root, relative);
  const prefix = path.resolve(root) + path.sep;
  return full === path.resolve(root) || full.startsWith(prefix) ? full : null;
}

/**
 * Writes the site's text files and copies its assets.
 *
 * Not atomic across the whole site — a half-written folder is possible if the
 * process dies mid-copy. That is acceptable here because the folder is a build
 * artifact regenerated from `content.json` in milliseconds, and buying atomicity
 * would mean rendering to a temporary directory and renaming, which the
 * deployment stage would then have to undo.
 */
export async function writeRenderedSite(
  site: RenderedSite,
  options: WriteOptions,
): Promise<WriteResult> {
  const written: string[] = [];
  const missingAssets: string[] = [];

  await fs.mkdir(options.targetDir, { recursive: true });

  for (const file of site.files) {
    const target = resolveInside(options.targetDir, file.path);
    if (target === null) continue;

    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.contents, 'utf8');
    written.push(file.path);
  }

  for (const asset of site.assets) {
    const source = resolveInside(options.sourceDir, asset.sourcePath);
    const target = resolveInside(options.targetDir, asset.path);
    if (source === null || target === null) {
      missingAssets.push(asset.sourcePath);
      continue;
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    try {
      await fs.copyFile(source, target);
      written.push(asset.path);
    } catch {
      missingAssets.push(asset.sourcePath);
    }
  }

  for (const font of site.fonts) {
    const target = resolveInside(options.targetDir, font.path);
    if (target === null) continue;

    await fs.mkdir(path.dirname(target), { recursive: true });
    try {
      await fs.copyFile(path.join(VENDORED_FONT_DIR, path.basename(font.file)), target);
      written.push(font.path);
    } catch {
      // The stylesheet's fallback stack carries the page. A missing face is a
      // typeface regression, not a broken site, so it is reported like one.
      missingAssets.push(`fonts/${font.file}`);
    }
  }

  return { written, missingAssets };
}
