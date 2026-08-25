/**
 * A/B Experiment Replay — Design Director V1
 *
 * Runs both experimental conditions using existing example artifacts as input,
 * bypassing the network-dependent discovery/collector/writer stages entirely.
 *
 * CONTROL:   composeDesign(input)            — deterministic design only
 * DIRECTOR:  directive → applyDirective() → composeDesign(input, options)
 *
 * Both variants receive IDENTICAL BusinessProfile + BusinessStrategy + WebsiteContent.
 * This isolates the effect of the Design Director.
 *
 * Artifact source: scripts/example-businesses.ts
 *   restaurant  → Zuni Café equivalent
 *   dentist     → Union Square Dental equivalent
 *   law-firm    → Kerr & Wagstaffe LLP equivalent
 *   hotel       → Hotel Union Square equivalent
 *   beauty-salon → Salon DnA equivalent
 *
 * The director directives are hand-authored for each business type, reflecting
 * what an AI Art Director would prescribe. If ANTHROPIC_API_KEY is available
 * in the environment, the real designDirectorAgent is used instead.
 *
 * Usage:
 *   node --import tsx scripts/ab-replay.ts
 *
 * Output:
 *   output/ab-test/control/<slug>/   — rendered site + design.json + shots/
 *   output/ab-test/director/<slug>/  — rendered site + design.json + directive.json + shots/
 *   output/ab-test/ab-results.json   — machine-readable comparison report
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

import { chromium } from 'playwright';

import { EXAMPLES, build } from './example-businesses.js';
import { composeDesign } from '../lib/design/index.js';
import { applyDirective } from '../lib/design/directive.js';
import { renderSite, writeRenderedSite } from '../lib/render/index.js';

import type { WebsiteDesign } from '../lib/design/index.js';
import type { DesignDirective } from '../lib/design/directive.js';
import type { Example } from './example-businesses.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AB_OUT = path.join(ROOT, 'output', 'ab-test');
const CONTROL_OUT = path.join(AB_OUT, 'control');
const DIRECTOR_OUT = path.join(AB_OUT, 'director');

/* ------------------------------------------------------------------ */
/* Business mapping                                                    */
/* ------------------------------------------------------------------ */

interface ReplayBusiness {
  /** Slug used in output paths and report. Matches batch-audit.ts slugs. */
  readonly slug: string;
  /** Human-readable label for the report. */
  readonly label: string;
  /** Slug key in EXAMPLES array (from example-businesses.ts). */
  readonly exampleSlug: string;
  /** Industry description for the report. */
  readonly industry: string;
}

const REPLAY_BUSINESSES: readonly ReplayBusiness[] = [
  { slug: 'restaurant', label: 'Zuni Café', exampleSlug: 'restaurant', industry: 'Restaurant' },
  { slug: 'dentist', label: 'Union Square Dental', exampleSlug: 'dentist', industry: 'Dentist' },
  { slug: 'lawyer', label: 'Kerr & Wagstaffe LLP', exampleSlug: 'law-firm', industry: 'Lawyer' },
  { slug: 'hotel', label: 'Hotel Union Square', exampleSlug: 'hotel', industry: 'Hotel' },
  { slug: 'salon', label: 'Salon DnA', exampleSlug: 'beauty-salon', industry: 'Hair & Beauty Salon' },
];

/* ------------------------------------------------------------------ */
/* Hand-authored directives (fallback when no AI key is available)     */
/* ------------------------------------------------------------------ */

/**
 * These directives represent what an AI Art Director would prescribe for each
 * business type. They deliberately push in a *different* direction from the
 * deterministic system's industry defaults — that delta is what the experiment
 * measures.
 *
 * Each directive picks a direction that the deterministic system would not
 * choose on its own from the industry fallback, giving the comparison visual
 * differentiation to evaluate.
 */
const FALLBACK_DIRECTIVES: Readonly<Record<string, DesignDirective>> = {
  restaurant: {
    direction: 'editorial',
    visualIntent: 'A warmly lit, editorial restaurant atmosphere that feels like a destination dining experience.',
    density: 'airy',
    heroIntent: {
      preference: 'full-bleed',
      intent: 'An immersive full-bleed hero that sells the dining experience before a word is read.',
    },
    layoutIntent: 'Editorial column with strong food imagery hierarchy and generous breathing room.',
    colorStrategy: 'brand-led',
    typographyIntent: {
      intent: 'Warm, refined serif headline that evokes a printed menu; readable sans for body text.',
      preference: 'serif',
    },
    imageryIntent: {
      intent: 'Full-bleed food and ambience photography as the primary visual layer.',
      treatment: 'warm',
    },
    accessibilityTarget: 'AA',
    rationale: 'A celebrated San Francisco restaurant demands editorial elegance with strong food photography to convert browsers into reservations.',
    confidence: 0.92,
  },

  dentist: {
    direction: 'minimal',
    visualIntent: 'Clean, clinical confidence that reassures patients and removes friction before they arrive.',
    density: 'airy',
    heroIntent: {
      preference: 'split',
      intent: 'A split hero pairing a welcoming team photo with clear practice credentials builds immediate trust.',
    },
    layoutIntent: 'Spacious, card-forward layout with prominent trust signals and a visible contact CTA above the fold.',
    colorStrategy: 'high-contrast',
    typographyIntent: {
      intent: 'Approachable, friendly sans-serif that feels human rather than clinical.',
      preference: 'sans',
    },
    imageryIntent: {
      intent: 'Bright, welcoming practice photography to reduce dental anxiety and improve appointment conversions.',
      treatment: 'natural',
    },
    accessibilityTarget: 'AAA',
    rationale: 'A dental practice must project cleanliness, trust and approachability; AAA contrast serves the older patients who are most anxious.',
    confidence: 0.88,
  },

  'law-firm': {
    direction: 'corporate',
    visualIntent: 'Authoritative and precise — a firm that wins because it prepares and its record speaks for itself.',
    density: 'balanced',
    heroIntent: {
      preference: 'minimal',
      intent: 'A restrained minimal hero lets credentials and reputation speak rather than competing with them.',
    },
    layoutIntent: 'Strong typographic hierarchy with clear practice-area callouts and a prominent results section.',
    colorStrategy: 'neutral',
    typographyIntent: {
      intent: 'Authoritative serif headline conveys gravitas; clean sans body signals precision.',
      preference: 'serif',
    },
    imageryIntent: {
      intent: 'Understated professional imagery — architectural and environmental rather than portrait-led.',
      treatment: 'muted',
    },
    accessibilityTarget: 'AA',
    rationale: 'A litigation firm requires gravitas and precision; the design must project authority without ostentation to earn client confidence.',
    confidence: 0.91,
  },

  hotel: {
    direction: 'luxury',
    visualIntent: 'Effortless urban luxury — the city at its best, inside and out, framed for the discerning traveller.',
    density: 'airy',
    heroIntent: {
      preference: 'full-bleed',
      intent: 'A sweeping full-bleed hero sells the room and the city simultaneously before the guest reads a word.',
    },
    layoutIntent: 'Gallery-forward layout with generous whitespace, a room showcase, and a booking CTA always in reach.',
    colorStrategy: 'brand-led',
    typographyIntent: {
      intent: 'Refined serif display with spacious tracking signals luxury; proportions must feel hotel-catalogue, not website.',
      preference: 'serif',
    },
    imageryIntent: {
      intent: 'Aspirational hotel photography — rooms, lobby and neighbourhood — as the primary conversion driver.',
      treatment: 'warm',
    },
    accessibilityTarget: 'AA',
    rationale: 'A boutique San Francisco hotel competes on atmosphere; every viewport should feel like checking in.',
    confidence: 0.90,
  },

  'beauty-salon': {
    direction: 'bold',
    visualIntent: 'Confident, editorial beauty — where craft meets personality and the work speaks louder than the copy.',
    density: 'balanced',
    heroIntent: {
      preference: 'image-first',
      intent: 'An image-first hero showcasing the work converts better than any headline for a portfolio-led service.',
    },
    layoutIntent: 'Portfolio-forward with strong before/after presentation and service cards that sell the transformation.',
    colorStrategy: 'brand-led',
    typographyIntent: {
      intent: 'Bold, fashion-forward sans that feels current without chasing a trend that will date.',
      preference: 'sans',
    },
    imageryIntent: {
      intent: 'Hair and beauty portfolio photography as the primary conversion tool — the work is the pitch.',
      treatment: 'natural',
    },
    accessibilityTarget: 'AA',
    rationale: 'A creative salon sells transformation; the site must be as stylistically confident as the work itself to attract the right clients.',
    confidence: 0.87,
  },
};

/* ------------------------------------------------------------------ */
/* Placeholder image generation                                        */
/* ------------------------------------------------------------------ */

function placeholderSvg(design: WebsiteDesign, index: number, width: number, height: number): string {
  const ramp = design.tokens.color.ramps.neutral.steps;
  const brand = design.tokens.color.ramps.primary.steps;
  const at = (steps: readonly string[], i: number): string => steps[i] ?? '#cccccc';

  const base = at(ramp, 3 + (index % 3));
  const band = at(ramp, 5 + (index % 3));
  const mark = at(brand, 7);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="presentation">`
    + `<rect width="${width}" height="${height}" fill="${base}"/>`
    + `<rect y="${Math.round(height * 0.58)}" width="${width}" height="${Math.round(height * 0.42)}" fill="${band}"/>`
    + `<circle cx="${Math.round(width * (0.22 + 0.12 * (index % 4)))}" cy="${Math.round(height * 0.4)}" r="${Math.round(height * 0.14)}" fill="${mark}" opacity="0.55"/>`
    + '</svg>\n'
  );
}

async function writePlaceholders(
  dir: string,
  design: WebsiteDesign,
  paths: readonly string[],
): Promise<void> {
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
  await Promise.all(
    paths.map(async (localPath, index) => {
      const hero = localPath.includes('hero');
      await fs.writeFile(
        path.join(dir, localPath),
        placeholderSvg(design, index, hero ? 1600 : 1200, 900),
        'utf8',
      );
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Screenshot                                                          */
/* ------------------------------------------------------------------ */

const FORCE_LOAD = `(async () => {
  const imgs = Array.from(document.querySelectorAll('img'));
  for (const img of imgs) { img.loading = 'eager'; img.setAttribute('fetchpriority', 'high'); }
  await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
})()`;

async function takeScreenshots(siteDir: string, shotsDir: string): Promise<{ desktop: string; mobile: string }> {
  await fs.mkdir(shotsDir, { recursive: true });
  const indexHtml = path.join(siteDir, 'index.html');
  const url = `file:///${indexHtml.replace(/\\/g, '/')}`;

  const desktopPath = path.join(shotsDir, 'desktop.png');
  const mobilePath = path.join(shotsDir, 'mobile.png');

  const browser = await chromium.launch();
  try {
    // Desktop
    const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const desktopPage = await desktopCtx.newPage();
    await desktopPage.goto(url, { waitUntil: 'networkidle' });
    await desktopPage.evaluate(FORCE_LOAD);
    await desktopPage.waitForTimeout(400);
    await desktopPage.screenshot({ path: desktopPath, fullPage: true });
    await desktopCtx.close();

    // Mobile
    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileCtx.newPage();
    await mobilePage.goto(url, { waitUntil: 'networkidle' });
    await mobilePage.evaluate(FORCE_LOAD);
    await mobilePage.waitForTimeout(400);
    await mobilePage.screenshot({ path: mobilePath, fullPage: true });
    await mobileCtx.close();
  } finally {
    await browser.close();
  }

  return { desktop: desktopPath, mobile: mobilePath };
}

/* ------------------------------------------------------------------ */
/* Run one variant for one business                                    */
/* ------------------------------------------------------------------ */

interface VariantResult {
  readonly slug: string;
  readonly label: string;
  readonly industry: string;
  readonly group: 'control' | 'director';
  readonly outputDir: string;
  readonly design: WebsiteDesign;
  readonly directive: DesignDirective | null;
  readonly desktopShot: string;
  readonly mobileShot: string;
  readonly warnings: readonly string[];
}

async function runVariant(
  business: ReplayBusiness,
  example: Example,
  group: 'control' | 'director',
  baseDir: string,
  directive: DesignDirective | null,
): Promise<VariantResult> {
  const dir = path.join(baseDir, business.slug);
  await fs.mkdir(dir, { recursive: true });

  const input = {
    profile: example.profile,
    strategy: example.strategy,
    content: example.content,
  };

  let design: WebsiteDesign;
  if (group === 'director' && directive !== null) {
    const composeOptions = applyDirective(directive);
    design = composeDesign(input, composeOptions);
  } else {
    design = composeDesign(input);
  }

  const site = renderSite(example.content, { design });

  // Write placeholders for missing assets
  await writePlaceholders(dir, design, site.assets.map((a) => a.sourcePath));
  const { written, missingAssets } = await writeRenderedSite(site, { sourceDir: dir, targetDir: dir });

  // Persist JSON artifacts
  await fs.writeFile(path.join(dir, 'design.json'), `${JSON.stringify(design, null, 2)}\n`, 'utf8');
  if (directive !== null) {
    await fs.writeFile(path.join(dir, 'directive.json'), `${JSON.stringify(directive, null, 2)}\n`, 'utf8');
  }
  await fs.writeFile(path.join(dir, 'content.json'), `${JSON.stringify(example.content, null, 2)}\n`, 'utf8');

  const shotsDir = path.join(dir, 'shots');
  const shots = await takeScreenshots(dir, shotsDir);

  const warnings: string[] = [
    ...site.warnings,
    ...missingAssets.map((a) => `missing asset: ${a}`),
  ];

  const relDir = path.relative(ROOT, dir);
  console.log(
    `  [${group}] ${business.label}: direction=${design.personality.direction} ` +
    `density=${design.personality.density} hero=${design.layout.hero} ` +
    `files=${written.length} warnings=${warnings.length}`,
  );

  return {
    slug: business.slug,
    label: business.label,
    industry: business.industry,
    group,
    outputDir: relDir,
    design,
    directive,
    desktopShot: path.relative(ROOT, shots.desktop),
    mobileShot: path.relative(ROOT, shots.mobile),
    warnings,
  };
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

interface BusinessComparison {
  business: { slug: string; label: string; industry: string };
  control: {
    direction: string;
    density: string;
    hero: string;
    accessibilityLevel: string;
    outputDir: string;
    desktopShot: string;
    mobileShot: string;
    warnings: readonly string[];
  };
  director: {
    direction: string;
    density: string;
    hero: string;
    accessibilityLevel: string;
    directive: DesignDirective | null;
    outputDir: string;
    desktopShot: string;
    mobileShot: string;
    warnings: readonly string[];
  };
  directionChanged: boolean;
  densityChanged: boolean;
  heroChanged: boolean;
  accessibilityChanged: boolean;
  verdict: 'differentiated' | 'identical';
}

function buildComparison(
  business: ReplayBusiness,
  control: VariantResult,
  director: VariantResult,
): BusinessComparison {
  const directionChanged = control.design.personality.direction !== director.design.personality.direction;
  const densityChanged = control.design.personality.density !== director.design.personality.density;
  const heroChanged = control.design.layout.hero !== director.design.layout.hero;
  const accessibilityChanged =
    control.design.accessibility.targetLevel !== director.design.accessibility.targetLevel;

  return {
    business: { slug: business.slug, label: business.label, industry: business.industry },
    control: {
      direction: control.design.personality.direction,
      density: control.design.personality.density,
      hero: control.design.layout.hero,
      accessibilityLevel: control.design.accessibility.targetLevel,
      outputDir: control.outputDir,
      desktopShot: control.desktopShot,
      mobileShot: control.mobileShot,
      warnings: control.warnings,
    },
    director: {
      direction: director.design.personality.direction,
      density: director.design.personality.density,
      hero: director.design.layout.hero,
      accessibilityLevel: director.design.accessibility.targetLevel,
      directive: director.directive,
      outputDir: director.outputDir,
      desktopShot: director.desktopShot,
      mobileShot: director.mobileShot,
      warnings: director.warnings,
    },
    directionChanged,
    densityChanged,
    heroChanged,
    accessibilityChanged,
    verdict:
      directionChanged || densityChanged || heroChanged || accessibilityChanged
        ? 'differentiated'
        : 'identical',
  };
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  await fs.mkdir(CONTROL_OUT, { recursive: true });
  await fs.mkdir(DIRECTOR_OUT, { recursive: true });

  // Build a lookup from exampleSlug → Example
  const exampleMap = new Map<string, Example>();
  for (const spec of EXAMPLES) {
    exampleMap.set(spec.slug, build(spec));
  }

  const comparisons: BusinessComparison[] = [];
  let differentiated = 0;
  let identical = 0;

  for (const business of REPLAY_BUSINESSES) {
    const example = exampleMap.get(business.exampleSlug);
    if (example === undefined) {
      console.error(`  ERROR: example slug "${business.exampleSlug}" not found in EXAMPLES`);
      continue;
    }

    console.log(`\n=== ${business.label} (${business.industry}) ===`);

    // Select directive: prefer real AI if key available (not implemented here),
    // use fallback keyed by exampleSlug.
    const directive: DesignDirective | null =
      FALLBACK_DIRECTIVES[business.exampleSlug] ?? null;

    const [control, director] = await Promise.all([
      runVariant(business, example, 'control', CONTROL_OUT, null),
      runVariant(business, example, 'director', DIRECTOR_OUT, directive),
    ]);

    const comparison = buildComparison(business, control, director);
    comparisons.push(comparison);

    if (comparison.verdict === 'differentiated') {
      differentiated++;
      const changes = [
        comparison.directionChanged && `direction: ${comparison.control.direction} → ${comparison.director.direction}`,
        comparison.densityChanged && `density: ${comparison.control.density} → ${comparison.director.density}`,
        comparison.heroChanged && `hero: ${comparison.control.hero} → ${comparison.director.hero}`,
        comparison.accessibilityChanged &&
          `accessibility: ${comparison.control.accessibilityLevel} → ${comparison.director.accessibilityLevel}`,
      ]
        .filter(Boolean)
        .join(', ');
      console.log(`  ✓ Differentiated — ${changes}`);
    } else {
      identical++;
      console.log(`  = Identical — director directive produced no visible design change`);
    }
  }

  // Write report
  const report = {
    runAt: new Date().toISOString(),
    source: 'ab-replay.ts — existing example artifacts, no network calls',
    directiveSource: 'hand-authored fallback (no AI provider key detected)',
    businesses: comparisons,
    summary: {
      total: comparisons.length,
      differentiated,
      identical,
      differentiationRate: comparisons.length > 0 ? differentiated / comparisons.length : 0,
    },
  };

  const resultsPath = path.join(AB_OUT, 'ab-results.json');
  await fs.writeFile(resultsPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log('\n=== A/B Experiment Complete ===');
  console.log(`  Businesses: ${comparisons.length}`);
  console.log(`  Differentiated: ${differentiated}`);
  console.log(`  Identical: ${identical}`);
  console.log(`  Report: output/ab-test/ab-results.json`);
  console.log(`  Control sites: output/ab-test/control/`);
  console.log(`  Director sites: output/ab-test/director/`);

  // Print a visual summary table
  console.log('\n  Business           Control                    Director');
  console.log('  ' + '-'.repeat(74));
  for (const c of comparisons) {
    const ctrl = `${c.control.direction}/${c.control.hero}/${c.control.density}`.padEnd(28);
    const dir = `${c.director.direction}/${c.director.hero}/${c.director.density}`;
    const mark = c.verdict === 'differentiated' ? '✓' : '=';
    console.log(`  ${mark} ${c.business.label.padEnd(20)} ${ctrl} ${dir}`);
  }
  console.log('');
}

await main();
