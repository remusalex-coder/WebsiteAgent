/**
 * Builds the immersive experience for one collected business.
 *
 *   npx tsx scripts/build-experience.ts [runId]
 *
 * Reads the verified profile, composes the scene script, re-encodes the
 * photography down to something a visitor can actually load, and writes the
 * site to `output/<runId>/experience/`.
 *
 * The re-encode runs through Playwright rather than a native image library.
 * That is not the obvious choice, but Chromium is already a dependency of this
 * repo and `sharp` is not, and a 1.3MB source photograph on a full-bleed scene
 * is the difference between an experience that feels expensive and one that
 * feels slow. Decoding in the browser we already ship costs nothing extra.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { compose } from '../lib/experience/compose.js';
import { emit } from '../lib/experience/emit.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Longest edge, per crop role. Full-bleed scenes get more pixels than a reel. */
const MAX_EDGE: Record<string, number> = {
  full: 2000, landscape: 1700, portrait: 1300, square: 1300,
};

async function optimise(
  files: readonly { src: string; crop: string }[],
  fromDir: string,
  toDir: string,
): Promise<{ before: number; after: number }> {
  await fs.mkdir(toDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  let before = 0;
  let after = 0;

  for (const { src, crop } of files) {
    const file = path.basename(src);
    const source = path.join(fromDir, file);

    let stat;
    try {
      stat = await fs.stat(source);
    } catch {
      console.warn(`  ! missing source: ${file}`);
      continue;
    }
    before += stat.size;

    const bytes = await fs.readFile(source);
    const dataUri = `data:image/${
      file.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
    };base64,${bytes.toString('base64')}`;

    const encoded = await page.evaluate(
      async ([uri, maxEdge]) => {
        const img = new Image();
        img.src = uri as string;
        await img.decode();
        const max = maxEdge as number;
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * scale);
        const h = Math.round(img.naturalHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx === null) return null;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        return canvas.toDataURL('image/jpeg', 0.80).split(',')[1] ?? null;
      },
      [dataUri, MAX_EDGE[crop] ?? 1400] as const,
    );

    if (encoded === null) {
      await fs.copyFile(source, path.join(toDir, file));
      after += stat.size;
      continue;
    }

    const out = Buffer.from(encoded, 'base64');
    // Never make a file bigger in the name of optimising it.
    if (out.byteLength < stat.size) {
      await fs.writeFile(path.join(toDir, file), out);
      after += out.byteLength;
    } else {
      await fs.copyFile(source, path.join(toDir, file));
      after += stat.size;
    }
  }

  await browser.close();
  return { before, after };
}

async function main(): Promise<void> {
  const runId = process.argv[2] ?? '25e648c7';
  const runDir = path.join(ROOT, 'output', runId);
  const profile = JSON.parse(
    await fs.readFile(path.join(runDir, '3-profile.json'), 'utf8'),
  ) as Record<string, unknown>;

  const assetDir = path.join(runDir, 'assets');
  const assetFiles = await fs.readdir(assetDir);

  const experience = compose({ profile, assetFiles });
  console.log(`concept   ${experience.conceptName}`);
  console.log(`scenes    ${experience.scenes.map((s) => s.id).join(' → ')}`);

  const plates = experience.scenes.flatMap((s) => s.plates ?? []);
  const cache = path.join(runDir, '.optimised');
  const { before, after } = await optimise(plates, assetDir, cache);
  console.log(
    `images    ${plates.length} · ${(before / 1e6).toFixed(2)}MB → `
    + `${(after / 1e6).toFixed(2)}MB`,
  );

  const outDir = path.join(runDir, 'experience');
  await fs.rm(outDir, { recursive: true, force: true });

  // Logo and any un-optimised file still resolve from the original directory.
  await fs.mkdir(cache, { recursive: true });
  for (const file of assetFiles) {
    const target = path.join(cache, file);
    try {
      await fs.access(target);
    } catch {
      await fs.copyFile(path.join(assetDir, file), target);
    }
  }

  const { bytes } = await emit({
    experience, outDir, assetSourceDir: cache, repoRoot: ROOT,
  });

  console.log(`written   ${path.relative(ROOT, outDir)} · ${(bytes / 1e6).toFixed(2)}MB total`);
  console.log(`open      ${path.join(outDir, 'index.html')}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
