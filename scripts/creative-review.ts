/**
 * The Creative Director, first incarnation.
 *
 * ## Why this is a script and not an agent yet
 *
 * A creative director judges feeling, and feeling is the thing this platform
 * has no instrument for. Every measurement it owns — words, images, overflow,
 * contrast — can be perfect on a page nobody would be proud to send a client.
 * Three sessions running, the worst defects were found by a human looking at a
 * screenshot while every number read healthy.
 *
 * So before there is a Creative Director *agent* asking a model "is this
 * memorable?", there has to be a vocabulary for the question. This is that
 * vocabulary: the handful of properties that separate an art-directed page from
 * a well-organised brochure, each measured in a real browser, each with a
 * threshold taken from how premium agencies actually compose.
 *
 * When a model is eventually asked for a creative verdict, these are the
 * observations it will be given — because a critique grounded in what is
 * measurably on the page beats one hallucinated from a screenshot, and because
 * a deterministic floor is the only way to tell whether the model added
 * anything.
 *
 * ## What it deliberately does not do
 *
 * It does not score taste. Nothing here decides whether a palette is beautiful.
 * It detects the *structural* signatures of generated-looking work: uniform
 * rhythm, timid imagery, flat type hierarchy, buried calls to action. Those are
 * objective, and they are what makes a page read as templated.
 *
 *   npx tsx scripts/creative-review.ts <runId>
 */

import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const runId = process.argv[2];
if (runId === undefined) throw new Error('usage: creative-review.ts <runId>');

const indexPath = path.join(ROOT, 'output', runId, 'site', 'index.html');
if (!fs.existsSync(indexPath)) throw new Error(`no rendered site at ${indexPath}`);

interface Finding {
  readonly area: string;
  readonly verdict: 'strong' | 'adequate' | 'weak';
  readonly note: string;
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`file://${indexPath.replace(/\\/g, '/')}`);
await page.evaluate(async () => {
  for (const img of Array.from(document.images)) img.removeAttribute('loading');
  await Promise.all(Array.from(document.images).map((img) => (img.complete ? null : img.decode().catch(() => null))));
});
await page.waitForTimeout(400);

// No helper functions inside `page.evaluate`: tsx compiles named function
// expressions with an esbuild `__name` shim that does not exist in the page,
// and the call fails with a bare `ReferenceError`. Everything below is inline.
const observed = await page.evaluate(() => {
  const sections = Array.from(document.querySelectorAll('.section'));
  const h1 = document.querySelector('h1');
  const body = document.querySelector('p');
  const hero = document.querySelector('.hero');
  const heroImage = document.querySelector('.hero img');

  return {
    viewportHeight: window.innerHeight,
    // How much of the first screen the opening image actually occupies. A hero
    // photograph at a third of the fold is an illustration, not an atmosphere.
    heroHeight: hero?.getBoundingClientRect().height ?? 0,
    heroImageArea: heroImage
      ? (heroImage.getBoundingClientRect().width * heroImage.getBoundingClientRect().height) /
        (window.innerWidth * window.innerHeight)
      : 0,
    // Display-to-body ratio. Editorial work runs 4x and up; a timid page sits near 2x.
    h1Size: h1 ? Number.parseFloat(getComputedStyle(h1).fontSize) || 0 : 0,
    bodySize: body ? Number.parseFloat(getComputedStyle(body).fontSize) || 0 : 0,
    // Distinct layout signatures. Every section built the same way is the single
    // clearest tell that a page came out of a generator.
    variants: sections.map((section) => section.getAttribute('data-variant') ?? 'unknown'),
    sectionCount: sections.length,
    // Vertical rhythm: identical padding on every section reads as a stack of boxes.
    paddings: sections.map((section) => Math.round(Number.parseFloat(getComputedStyle(section).paddingTop) || 0)),
    ctas: Array.from(document.querySelectorAll('a.button')).map((cta) => ({
      text: cta.textContent?.trim() ?? '',
      top: cta.getBoundingClientRect().top + window.scrollY,
      primary: cta.className.includes('primary'),
    })),
    documentHeight: document.documentElement.scrollHeight,
    images: document.images.length,
  };
});

await browser.close();

const findings: Finding[] = [];
const add = (area: string, verdict: Finding['verdict'], note: string): void => {
  findings.push({ area, verdict, note });
};

/* Imagery at the fold ------------------------------------------------ */
const heroFoldRatio = observed.heroHeight / observed.viewportHeight;
if (observed.heroImageArea >= 0.5) {
  add('Opening image', 'strong', `the hero photograph covers ${Math.round(observed.heroImageArea * 100)}% of the first screen`);
} else if (observed.heroImageArea > 0) {
  add('Opening image', 'weak', `the hero photograph covers only ${Math.round(observed.heroImageArea * 100)}% of the first screen — it illustrates rather than immerses`);
} else {
  add('Opening image', 'weak', 'the page opens with no photograph at all');
}
if (heroFoldRatio < 0.6) {
  add('Hero presence', 'weak', `the hero is ${Math.round(heroFoldRatio * 100)}% of the fold; a premium opening holds the screen`);
}

/* Type hierarchy ------------------------------------------------------ */
const scaleRatio = observed.bodySize > 0 ? observed.h1Size / observed.bodySize : 0;
add(
  'Type hierarchy',
  scaleRatio >= 3.5 ? 'strong' : scaleRatio >= 2.5 ? 'adequate' : 'weak',
  `display type is ${scaleRatio.toFixed(1)}x body (editorial work runs 3.5x and up)`,
);

/* Rhythm -------------------------------------------------------------- */
const distinctVariants = new Set(observed.variants).size;
const variantRatio = observed.sectionCount > 0 ? distinctVariants / observed.sectionCount : 0;
add(
  'Layout rhythm',
  variantRatio >= 0.75 ? 'strong' : variantRatio >= 0.5 ? 'adequate' : 'weak',
  `${distinctVariants} distinct layouts across ${observed.sectionCount} sections (${observed.variants.join(', ')})`,
);

const distinctPadding = new Set(observed.paddings).size;
if (distinctPadding === 1 && observed.sectionCount > 2) {
  add('Vertical pacing', 'weak', 'every section has identical top padding — the page reads as a stack of equal boxes');
}

/* Call to action ------------------------------------------------------ */
const aboveFold = observed.ctas.filter((cta) => cta.top < observed.viewportHeight);
const primaries = observed.ctas.filter((cta) => cta.primary);
add(
  'CTA hierarchy',
  aboveFold.length >= 1 && primaries.length >= 1 ? 'strong' : observed.ctas.length > 0 ? 'adequate' : 'weak',
  `${observed.ctas.length} call${observed.ctas.length === 1 ? '' : 's'} to action, ${aboveFold.length} above the fold, ${primaries.length} primary`,
);
// A long page with two buttons asks the visitor to scroll back up to act.
const perScreen = observed.ctas.length / Math.max(1, observed.documentHeight / observed.viewportHeight);
if (perScreen < 0.5) {
  add('CTA coverage', 'weak', `one call to action per ${(1 / perScreen).toFixed(1)} screens of scroll`);
}

/* Verdict -------------------------------------------------------------- */
const weak = findings.filter((finding) => finding.verdict === 'weak');
const strong = findings.filter((finding) => finding.verdict === 'strong');

process.stdout.write(`\n=== Creative review — ${runId} ===\n\n`);
for (const finding of findings) {
  const mark = finding.verdict === 'strong' ? '++' : finding.verdict === 'adequate' ? ' ~' : '!!';
  process.stdout.write(`${mark} ${finding.area}: ${finding.note}\n`);
}

process.stdout.write(
  `\n${strong.length} strong · ${findings.length - strong.length - weak.length} adequate · ${weak.length} weak\n`,
);
process.stdout.write(
  weak.length === 0
    ? 'No structural tell of generated work. Judgement of taste still needs a human.\n'
    : `Would a premium agency ship this? Not yet — ${weak.length} structural weakness${weak.length === 1 ? '' : 'es'} above.\n`,
);
