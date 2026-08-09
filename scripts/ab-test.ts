/**
 * Design Director V1 A/B Experiment
 *
 * Runs the full pipeline for all five businesses from batch-audit.ts under two
 * experimental conditions and produces a structured comparison report.
 *
 * CONTROL A:   DIRECTOR_ENABLED=false  (deterministic design only)
 * DIRECTOR B:  DIRECTOR_ENABLED=true   (AI Design Director → deterministic design)
 *
 * Usage:
 *   node --import tsx --env-file=.env scripts/ab-test.ts
 *   node --import tsx --env-file=.env scripts/ab-test.ts --measure
 *
 * Output:
 *   output/ab-test/control/<runId>/   — per-business control run artifacts
 *   output/ab-test/director/<runId>/  — per-business director run artifacts
 *   output/ab-test/ab-results.json   — machine-readable comparison
 *   docs/design-director-v1-ab-test.md
 *   docs/design-director-v1-ab-test-verification.md
 *
 * The script does NOT modify any production design logic. It only controls the
 * DIRECTOR_ENABLED and OUTPUT_DIR environment variables passed to main.ts.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { chromium } from 'playwright';

import { BUSINESSES } from './batch-audit.js';
import type { BatchBusiness } from './batch-audit.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const AB_OUTPUT = path.join(ROOT, 'output', 'ab-test');
const CONTROL_OUTPUT = path.join(AB_OUTPUT, 'control');
const DIRECTOR_OUTPUT = path.join(AB_OUTPUT, 'director');
const RESULTS_FILE = path.join(AB_OUTPUT, 'ab-results.json');
const DOCS_DIR = path.join(ROOT, 'docs');

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface GroupRecord {
  slug: string;
  label: string;
  industry: string;
  group: 'control' | 'director';
  runId: string | null;
  error: string | null;
}

interface DesignMeasurement {
  /** Raw values from the DOM measurement script */
  headerHeight: number | null;
  navLabels: string[];
  h1Size: number | null;
  h1Font: string | null;
  bodyFont: string | null;
  totalImgs: number;
  brokenImgs: number;
  mediaFills: number;
  ctas: number;
  externalCtas: number;
  pageHeight: number;
  horizontalOverflow: boolean;
  sections: Array<{
    kind: string;
    variant: string | null;
    frame: string | null;
    emphasis: string | null;
    height: number;
    imgs: number;
    words: number;
  }>;
}

interface MobileMeasurement {
  headerHeight: number | null;
  overflow: boolean;
  h1: number | null;
  pageHeight: number;
}

interface DesignArtifact {
  industry?: { id?: string; basis?: string };
  personality?: { direction?: string };
  layout?: { hero?: string; density?: string; sections?: unknown[] };
  notes?: string;
  tokens?: { typography?: { headingFont?: string; bodyFont?: string }; accessibility?: { level?: string } };
}

interface ContentArtifact {
  businessName?: string;
  tagline?: string;
  seo?: { title?: string; description?: string; keywords?: string[] };
  unresolvedGaps?: string[];
  sections?: Array<{ kind: string }>;
  voice?: { wordCount?: number };
}

interface DirectiveArtifact {
  direction?: string;
  visualIntent?: string;
  density?: string;
  heroIntent?: { preference?: string | null; intent?: string };
  layoutIntent?: string;
  colorStrategy?: string;
  typographyIntent?: { intent?: string; preference?: string | null };
  imageryIntent?: { intent?: string; treatment?: string | null };
  accessibilityTarget?: string;
  rationale?: string;
  confidence?: number;
}

interface BusinessResult {
  business: { name: string; slug: string; industry: string };
  control: GroupMeasured | null;
  director: GroupMeasured | null;
  differences: Record<string, { control: unknown; director: unknown }>;
  improvements: string[];
  regressions: string[];
  directorAnalysis: DirectiveAnalysis | null;
  verdict: 'positive' | 'neutral' | 'negative' | 'incomplete';
}

interface GroupMeasured {
  runId: string;
  completed: boolean;
  design: {
    direction?: string;
    industryId?: string;
    industryBasis?: string;
    heroVariant?: string;
    density?: string;
    sectionCount?: number;
    sectionVariants?: string[];
    sectionFrames?: string[];
    sectionEmphasis?: string[];
    designNotes?: string;
    accessibilityLevel?: string;
  };
  typography: { headingFont?: string; bodyFont?: string | null; h1SizePx?: number | null };
  imagery: { totalImages?: number; brokenImages?: number; imageTreatment?: string | null; mediaFillCount?: number };
  layout: { pageHeight?: number; headerHeight?: number | null; horizontalOverflow?: boolean };
  mobile: { h1SizePx?: number | null; pageHeight?: number; overflow?: boolean };
  conversion: { ctaCount?: number; externalCtaCount?: number; navLabels?: string[] };
  content: { sectionKinds?: string[]; unresolvedGaps?: string[] };
  seo: { title?: string; description?: string; keywords?: string[] };
  directive: DirectiveArtifact | 'disabled';
}

interface DirectiveAnalysis {
  direction?: string;
  visualIntent?: string;
  density?: string;
  heroIntent?: string;
  layoutIntent?: string;
  colorStrategy?: string;
  typographyIntent?: string;
  imageryIntent?: string;
  accessibilityTarget?: string;
  rationale?: string;
  confidence?: number;
  qualityFlags: string[];
  coherent: boolean;
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

function existingRunDirs(baseDir: string): Set<string> {
  if (!fs.existsSync(baseDir)) return new Set();
  return new Set(
    fs
      .readdirSync(baseDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^[0-9a-f]{8}$/.test(entry.name))
      .map((entry) => entry.name),
  );
}

/** Runs main.ts for one business with the given environment variables. */
function generate(
  business: BatchBusiness,
  group: 'control' | 'director',
  outputDir: string,
): GroupRecord {
  const before = existingRunDirs(outputDir);
  process.stdout.write(
    `\n=== [${group.toUpperCase()}] ${business.label} (${business.industry}) ===\n`,
  );

  const extraEnv: NodeJS.ProcessEnv = {
    ...process.env,
    OUTPUT_DIR: outputDir,
    DIRECTOR_ENABLED: group === 'director' ? 'true' : 'false',
  };

  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--env-file=.env', 'main.ts', business.mapsUrl],
    { cwd: ROOT, env: extraEnv, encoding: 'utf8', timeout: 8 * 60_000 },
  );

  const after = existingRunDirs(outputDir);
  const created = [...after].filter((dir) => !before.has(dir));
  const runId = created[0] ?? null;

  const log = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  for (const line of log.split('\n')) {
    if (
      /analysis finished|writing finished|design composed|site rendered|director|error|Error/.test(
        line,
      )
    ) {
      process.stdout.write(`${line.slice(0, 240)}\n`);
    }
  }

  if (runId === null) {
    return { ...business, group, runId: null, error: 'no run directory was created' };
  }

  const hasSite = fs.existsSync(path.join(outputDir, runId, 'site', 'index.html'));
  return {
    ...business,
    group,
    runId,
    error: hasSite ? null : 'pipeline produced no site',
  };
}

/* ------------------------------------------------------------------ */
/* Measurement                                                         */
/* ------------------------------------------------------------------ */

/**
 * Strips lazy loading before screenshot capture.
 * See the warning in batch-audit.ts for rationale.
 */
const FORCE_LOAD = `(async () => {
  const imgs = Array.from(document.querySelectorAll('img'));
  for (const img of imgs) { img.loading = 'eager'; img.setAttribute('fetchpriority', 'high'); }
  await Promise.all(imgs.map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
})()`;

const MEASURE = `(() => {
  var header = document.querySelector('header');
  var h1 = document.querySelector('h1');
  var nav = document.querySelector('nav');
  var imgs = document.querySelectorAll('img');
  var broken = 0;
  for (var i = 0; i < imgs.length; i++) { if (!imgs[i].naturalWidth) broken++; }
  var links = [];
  if (nav) { var as = nav.querySelectorAll('a'); for (var k = 0; k < as.length; k++) links.push((as[k].textContent||'').trim()); }
  var secs = [];
  var all = document.querySelectorAll('section');
  for (var j = 0; j < all.length; j++) {
    var s = all[j];
    var m = s.className.match(/section--([a-z]+)/);
    secs.push({ kind: m ? m[1] : '?', variant: s.getAttribute('data-variant'), frame: s.getAttribute('data-frame'),
      emphasis: s.getAttribute('data-emphasis'), height: Math.round(s.getBoundingClientRect().height),
      imgs: s.querySelectorAll('img').length, words: (s.textContent||'').trim().split(/\\s+/).length });
  }
  return {
    headerHeight: header ? Math.round(header.getBoundingClientRect().height) : null,
    navLabels: links,
    h1Size: h1 ? Math.round(parseFloat(getComputedStyle(h1).fontSize)) : null,
    h1Font: h1 ? getComputedStyle(h1).fontFamily.split(',')[0].replace(/"/g,'') : null,
    bodyFont: getComputedStyle(document.body).fontFamily.split(',')[0].replace(/"/g,''),
    totalImgs: imgs.length, brokenImgs: broken,
    mediaFills: document.querySelectorAll('.media-fill').length,
    ctas: document.querySelectorAll('.button').length,
    externalCtas: Array.from(document.querySelectorAll('.button')).filter(function(a){ return (a.getAttribute('href')||'').startsWith('http'); }).length,
    pageHeight: Math.round(document.body.scrollHeight),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    sections: secs
  };
})()`;

async function measure(record: GroupRecord, outputDir: string): Promise<GroupMeasured | null> {
  if (record.runId === null) return null;

  const dir = path.join(outputDir, record.runId);
  const siteIndex = path.join(dir, 'site', 'index.html');
  if (!fs.existsSync(siteIndex)) return null;

  const url = `file:///${siteIndex.replace(/\\/g, '/')}`;
  const shots = path.join(dir, 'shots');
  fs.mkdirSync(shots, { recursive: true });

  const browser = await chromium.launch();
  let desktopFacts: DesignMeasurement;
  let mobileFacts: MobileMeasurement;

  try {
    // Desktop
    const desktopCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const desktop = await desktopCtx.newPage();
    await desktop.goto(url, { waitUntil: 'networkidle' });
    await desktop.evaluate(FORCE_LOAD);
    await desktop.waitForTimeout(300);
    await desktop.screenshot({ path: path.join(shots, 'desktop.png'), fullPage: true });
    await desktop.screenshot({ path: path.join(shots, 'desktop-fold.png') });
    desktopFacts = (await desktop.evaluate(MEASURE)) as DesignMeasurement;

    // Mobile
    const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobile = await mobileCtx.newPage();
    await mobile.goto(url, { waitUntil: 'networkidle' });
    await mobile.evaluate(FORCE_LOAD);
    await mobile.waitForTimeout(300);
    await mobile.screenshot({ path: path.join(shots, 'mobile.png'), fullPage: true });
    mobileFacts = (await mobile.evaluate(
      `({ headerHeight: document.querySelector('header') ? Math.round(document.querySelector('header').getBoundingClientRect().height) : null,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
          h1: document.querySelector('h1') ? Math.round(parseFloat(getComputedStyle(document.querySelector('h1')).fontSize)) : null,
          pageHeight: Math.round(document.body.scrollHeight) })`,
    )) as MobileMeasurement;
  } finally {
    await browser.close();
  }

  // Read artifacts
  const contentPath = path.join(dir, '5-content.json');
  const designPath = path.join(dir, '5b-design.json');
  const directivePath = path.join(dir, '5a-directive.json');

  const content: ContentArtifact = fs.existsSync(contentPath)
    ? (JSON.parse(fs.readFileSync(contentPath, 'utf8')) as ContentArtifact)
    : {};
  const design: DesignArtifact = fs.existsSync(designPath)
    ? (JSON.parse(fs.readFileSync(designPath, 'utf8')) as DesignArtifact)
    : {};

  const rawDirective: DirectiveArtifact | 'disabled' =
    record.group === 'director' && fs.existsSync(directivePath)
      ? (JSON.parse(fs.readFileSync(directivePath, 'utf8')) as DirectiveArtifact)
      : 'disabled';

  const sections = desktopFacts.sections ?? [];

  return {
    runId: record.runId,
    completed: true,
    design: {
      direction: design.personality?.direction,
      industryId: design.industry?.id,
      industryBasis: design.industry?.basis,
      heroVariant: design.layout?.hero,
      density: design.layout?.density,
      sectionCount: (design.layout?.sections as unknown[] | undefined)?.length ?? sections.length,
      sectionVariants: sections.map((s) => s.variant ?? '').filter(Boolean),
      sectionFrames: sections.map((s) => s.frame ?? '').filter(Boolean),
      sectionEmphasis: sections.map((s) => s.emphasis ?? '').filter(Boolean),
      designNotes: design.notes,
      accessibilityLevel: design.tokens?.accessibility?.level,
    },
    typography: {
      headingFont: design.tokens?.typography?.headingFont ?? desktopFacts.h1Font ?? undefined,
      bodyFont: desktopFacts.bodyFont,
      h1SizePx: desktopFacts.h1Size,
    },
    imagery: {
      totalImages: desktopFacts.totalImgs,
      brokenImages: desktopFacts.brokenImgs,
      imageTreatment: null,
      mediaFillCount: desktopFacts.mediaFills,
    },
    layout: {
      pageHeight: desktopFacts.pageHeight,
      headerHeight: desktopFacts.headerHeight,
      horizontalOverflow: desktopFacts.horizontalOverflow,
    },
    mobile: {
      h1SizePx: mobileFacts.h1,
      pageHeight: mobileFacts.pageHeight,
      overflow: mobileFacts.overflow,
    },
    conversion: {
      ctaCount: desktopFacts.ctas,
      externalCtaCount: desktopFacts.externalCtas,
      navLabels: desktopFacts.navLabels,
    },
    content: {
      sectionKinds: content.sections?.map((s) => s.kind),
      unresolvedGaps: content.unresolvedGaps,
    },
    seo: {
      title: content.seo?.title,
      description: content.seo?.description,
      keywords: content.seo?.keywords,
    },
    directive: rawDirective,
  };
}

/* ------------------------------------------------------------------ */
/* Directive analysis                                                  */
/* ------------------------------------------------------------------ */

/**
 * Generic quality flag patterns that indicate non-specific reasoning.
 */
const GENERIC_PHRASES = [
  /modern and professional/i,
  /clean and engaging/i,
  /visually appealing/i,
  /strong user experience/i,
  /professional appearance/i,
  /clean design/i,
  /user-friendly/i,
];

function analyseDirective(directive: DirectiveArtifact | 'disabled'): DirectiveAnalysis | null {
  if (directive === 'disabled') return null;

  const flags: string[] = [];

  // Confidence check
  if (directive.confidence === undefined) {
    flags.push('confidence missing');
  } else if (directive.confidence < 0.5) {
    flags.push(`confidence low (${directive.confidence.toFixed(2)})`);
  }

  // Rationale quality check
  const rationale = directive.rationale ?? '';
  if (!rationale.trim()) {
    flags.push('rationale absent — decision trail incomplete');
  } else {
    for (const pattern of GENERIC_PHRASES) {
      if (pattern.test(rationale)) {
        flags.push(`generic phrase in rationale: "${rationale.match(pattern)?.[0]}"`);
      }
    }
  }

  // visualIntent specificity check
  const visualIntent = directive.visualIntent ?? '';
  if (!visualIntent.trim()) {
    flags.push('visualIntent absent');
  } else {
    for (const pattern of GENERIC_PHRASES) {
      if (pattern.test(visualIntent)) {
        flags.push(`generic phrase in visualIntent: "${visualIntent.match(pattern)?.[0]}"`);
      }
    }
  }

  // direction check
  const VALID_DIRECTIONS = new Set([
    'minimal', 'luxury', 'corporate', 'elegant', 'modern', 'editorial',
    'creative', 'playful', 'bold', 'premium', 'friendly',
  ]);
  if (directive.direction && !VALID_DIRECTIONS.has(directive.direction)) {
    flags.push(`direction "${directive.direction}" is not a valid DesignDirection`);
  }

  const coherent = flags.length === 0;

  return {
    direction: directive.direction,
    visualIntent: directive.visualIntent,
    density: directive.density,
    heroIntent: directive.heroIntent
      ? `${directive.heroIntent.preference ?? 'no-preference'}: ${directive.heroIntent.intent ?? ''}`
      : undefined,
    layoutIntent: directive.layoutIntent,
    colorStrategy: directive.colorStrategy,
    typographyIntent: directive.typographyIntent?.intent,
    imageryIntent: directive.imageryIntent?.intent,
    accessibilityTarget: directive.accessibilityTarget,
    rationale: directive.rationale,
    confidence: directive.confidence,
    qualityFlags: flags,
    coherent,
  };
}

/* ------------------------------------------------------------------ */
/* Comparison                                                          */
/* ------------------------------------------------------------------ */

const REGRESSION_RULES: Array<{
  key: string;
  check: (a: GroupMeasured, b: GroupMeasured) => string | null;
}> = [
  {
    key: 'broken_images',
    check: (a, b) =>
      (b.imagery.brokenImages ?? 0) > (a.imagery.brokenImages ?? 0)
        ? `director has more broken images (${b.imagery.brokenImages} vs control ${a.imagery.brokenImages})`
        : null,
  },
  {
    key: 'horizontal_overflow',
    check: (a, b) =>
      b.layout.horizontalOverflow && !a.layout.horizontalOverflow
        ? 'director introduced horizontal overflow'
        : null,
  },
  {
    key: 'cta_count',
    check: (a, b) =>
      (b.conversion.ctaCount ?? 0) === 0 && (a.conversion.ctaCount ?? 0) > 0
        ? 'director produced no CTAs (control had CTAs)'
        : null,
  },
  {
    key: 'mobile_overflow',
    check: (a, b) =>
      b.mobile.overflow && !a.mobile.overflow
        ? 'director introduced mobile horizontal overflow'
        : null,
  },
];

function compareGroups(
  slug: string,
  label: string,
  industry: string,
  controlMeasured: GroupMeasured | null,
  directorMeasured: GroupMeasured | null,
): BusinessResult {
  if (!controlMeasured || !directorMeasured) {
    return {
      business: { name: label, slug, industry },
      control: controlMeasured,
      director: directorMeasured,
      differences: {},
      improvements: [],
      regressions: ['incomplete — one or both groups failed to produce a site'],
      directorAnalysis: directorMeasured
        ? analyseDirective(directorMeasured.directive)
        : null,
      verdict: 'incomplete',
    };
  }

  const differences: Record<string, { control: unknown; director: unknown }> = {};

  function diff<T>(key: string, a: T, b: T): void {
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      differences[key] = { control: a, director: b };
    }
  }

  diff('direction', controlMeasured.design.direction, directorMeasured.design.direction);
  diff('heroVariant', controlMeasured.design.heroVariant, directorMeasured.design.heroVariant);
  diff('density', controlMeasured.design.density, directorMeasured.design.density);
  diff('sectionCount', controlMeasured.design.sectionCount, directorMeasured.design.sectionCount);
  diff('headingFont', controlMeasured.typography.headingFont, directorMeasured.typography.headingFont);
  diff('h1SizePx', controlMeasured.typography.h1SizePx, directorMeasured.typography.h1SizePx);
  diff('totalImages', controlMeasured.imagery.totalImages, directorMeasured.imagery.totalImages);
  diff('brokenImages', controlMeasured.imagery.brokenImages, directorMeasured.imagery.brokenImages);
  diff('pageHeight', controlMeasured.layout.pageHeight, directorMeasured.layout.pageHeight);
  diff('horizontalOverflow', controlMeasured.layout.horizontalOverflow, directorMeasured.layout.horizontalOverflow);
  diff('ctaCount', controlMeasured.conversion.ctaCount, directorMeasured.conversion.ctaCount);
  diff('accessibilityLevel', controlMeasured.design.accessibilityLevel, directorMeasured.design.accessibilityLevel);
  diff('mobilePageHeight', controlMeasured.mobile.pageHeight, directorMeasured.mobile.pageHeight);
  diff('mobileH1SizePx', controlMeasured.mobile.h1SizePx, directorMeasured.mobile.h1SizePx);

  const regressions: string[] = [];
  for (const rule of REGRESSION_RULES) {
    const r = rule.check(controlMeasured, directorMeasured);
    if (r) regressions.push(r);
  }

  // Improvements: mechanical only — visual improvements require human review.
  const improvements: string[] = [];
  if (
    (controlMeasured.imagery.brokenImages ?? 0) > 0 &&
    (directorMeasured.imagery.brokenImages ?? 0) === 0
  ) {
    improvements.push('director resolved broken images from control');
  }
  if (
    controlMeasured.layout.horizontalOverflow &&
    !directorMeasured.layout.horizontalOverflow
  ) {
    improvements.push('director resolved horizontal overflow from control');
  }
  if (
    (controlMeasured.conversion.ctaCount ?? 0) === 0 &&
    (directorMeasured.conversion.ctaCount ?? 0) > 0
  ) {
    improvements.push('director added CTAs where control had none');
  }

  const directorAnalysis = analyseDirective(directorMeasured.directive);

  let verdict: BusinessResult['verdict'];
  if (regressions.length > 0 && improvements.length === 0) {
    verdict = 'negative';
  } else if (improvements.length > regressions.length) {
    verdict = 'positive';
  } else {
    verdict = 'neutral';
  }

  return {
    business: { name: label, slug, industry },
    control: controlMeasured,
    director: directorMeasured,
    differences,
    improvements,
    regressions,
    directorAnalysis,
    verdict,
  };
}

/* ------------------------------------------------------------------ */
/* Report generation                                                   */
/* ------------------------------------------------------------------ */

function formatMeasured(m: GroupMeasured | null, group: string): string {
  if (!m) return `**${group}**: ⚠️ pipeline did not produce a site\n`;

  const directive =
    group === 'Control A'
      ? '`disabled`'
      : m.directive === 'disabled'
        ? '`disabled` (5a-directive.json not produced)'
        : '`5a-directive.json` present';

  return `
**${group}** (runId: \`${m.runId}\`)

| Metric | Value |
|---|---|
| Direction | \`${m.design.direction ?? '-'}\` |
| Industry | \`${m.design.industryId ?? '-'}\` |
| Hero Variant | \`${m.design.heroVariant ?? '-'}\` |
| Density | \`${m.design.density ?? '-'}\` |
| Section Count | ${m.design.sectionCount ?? '-'} |
| Heading Font | ${m.typography.headingFont ?? '-'} |
| Body Font | ${m.typography.bodyFont ?? '-'} |
| H1 Size (desktop) | ${m.typography.h1SizePx ?? '-'}px |
| Total Images | ${m.imagery.totalImages ?? 0} |
| Broken Images | ${m.imagery.brokenImages ?? 0} |
| Media Fills | ${m.imagery.mediaFillCount ?? 0} |
| Page Height | ${m.layout.pageHeight ?? '-'}px |
| Header Height | ${m.layout.headerHeight ?? '-'}px |
| Horizontal Overflow | ${m.layout.horizontalOverflow ? '⚠️ YES' : 'No'} |
| Mobile H1 | ${m.mobile.h1SizePx ?? '-'}px |
| Mobile Page Height | ${m.mobile.pageHeight ?? '-'}px |
| Mobile Overflow | ${m.mobile.overflow ? '⚠️ YES' : 'No'} |
| CTA Count | ${m.conversion.ctaCount ?? 0} |
| External CTAs | ${m.conversion.externalCtaCount ?? 0} |
| Nav Labels | ${(m.conversion.navLabels ?? []).join(', ') || '-'} |
| Section Kinds | ${(m.content.sectionKinds ?? []).join(', ') || '-'} |
| Unresolved Gaps | ${(m.content.unresolvedGaps ?? []).length} |
| SEO Title | ${m.seo.title ?? '-'} |
| Accessibility Level | ${m.design.accessibilityLevel ?? '-'} |
| Director | ${directive} |
`.trim();
}

function formatDirectiveAnalysis(analysis: DirectiveAnalysis | null, slug: string): string {
  if (!analysis) return '> Director was disabled for Control A. No directive to analyse.';

  const lines: string[] = [
    `| Field | Value |`,
    `|---|---|`,
    `| Direction | \`${analysis.direction ?? '-'}\` |`,
    `| Visual Intent | ${analysis.visualIntent ?? '-'} |`,
    `| Density | \`${analysis.density ?? '-'}\` |`,
    `| Hero Intent | ${analysis.heroIntent ?? '-'} |`,
    `| Layout Intent | ${analysis.layoutIntent ?? '-'} |`,
    `| Color Strategy | \`${analysis.colorStrategy ?? '-'}\` |`,
    `| Typography Intent | ${analysis.typographyIntent ?? '-'} |`,
    `| Imagery Intent | ${analysis.imageryIntent ?? '-'} |`,
    `| Accessibility Target | \`${analysis.accessibilityTarget ?? '-'}\` |`,
    `| Confidence | ${analysis.confidence !== undefined ? analysis.confidence.toFixed(2) : '-'} |`,
    `| Coherent | ${analysis.coherent ? '✅ Yes' : '⚠️ No'} |`,
  ];

  const table = lines.join('\n');

  const rationaleLine = analysis.rationale
    ? `\n**Rationale**: ${analysis.rationale}`
    : '\n**Rationale**: _(absent)_';

  const flagLines =
    analysis.qualityFlags.length > 0
      ? `\n**Quality flags**:\n${analysis.qualityFlags.map((f) => `- ⚠️ ${f}`).join('\n')}`
      : '\n**Quality flags**: none';

  return `${table}${rationaleLine}${flagLines}`;
}

function generateReport(results: BusinessResult[], runAt: string): string {
  const totalBusinesses = results.length;
  const completed = results.filter((r) => r.control && r.director).length;
  const positiveCount = results.filter((r) => r.verdict === 'positive').length;
  const negativeCount = results.filter((r) => r.verdict === 'negative').length;
  const neutralCount = results.filter((r) => r.verdict === 'neutral').length;

  let overallVerdict: string;
  if (completed < totalBusinesses) {
    overallVerdict = '⚠️ INCOMPLETE — not all businesses completed both groups';
  } else if (negativeCount > positiveCount && negativeCount > neutralCount) {
    overallVerdict = '❌ NEGATIVE — Director B introduced more regressions than improvements';
  } else if (positiveCount > negativeCount && positiveCount > neutralCount) {
    overallVerdict = '✅ POSITIVE — Director B demonstrated meaningful improvement';
  } else {
    overallVerdict = '➡️ NEUTRAL — Director B changed decisions without demonstrating improvement';
  }

  const businessSections = results
    .map((r) => {
      const ctrl = formatMeasured(r.control, 'Control A');
      const dir = formatMeasured(r.director, 'Director B');

      const diffs =
        Object.keys(r.differences).length > 0
          ? Object.entries(r.differences)
              .map(
                ([k, v]) =>
                  `- **${k}**: control=\`${JSON.stringify(v.control)}\` → director=\`${JSON.stringify(v.director)}\``,
              )
              .join('\n')
          : '_No mechanical differences detected._';

      const regressionText =
        r.regressions.length > 0
          ? r.regressions.map((reg) => `- ⚠️ ${reg}`).join('\n')
          : '_None detected._';

      const improvementText =
        r.improvements.length > 0
          ? r.improvements.map((imp) => `- ✅ ${imp}`).join('\n')
          : '_None detected mechanically (visual improvements require human review)._';

      const verdictEmoji =
        r.verdict === 'positive'
          ? '✅ POSITIVE'
          : r.verdict === 'negative'
            ? '❌ NEGATIVE'
            : r.verdict === 'incomplete'
              ? '⚠️ INCOMPLETE'
              : '➡️ NEUTRAL';

      const directiveSection =
        r.directorAnalysis
          ? formatDirectiveAnalysis(r.directorAnalysis, r.business.slug)
          : '> Director was disabled — no directive produced.';

      return `
### ${r.business.name} (${r.business.industry})

${ctrl}

---

${dir}

#### Differences (A vs B)

${diffs}

#### Regressions (AUTOMATED)

${regressionText}

#### Improvements (AUTOMATED)

${improvementText}

#### Director Directive Analysis (Director B only)

${directiveSection}

#### Verdict: ${verdictEmoji}

> 🖼️ **VISUAL/HUMAN REVIEW REQUIRED**
> Screenshots are located at:
> - Control:  \`output/ab-test/control/${r.control?.runId ?? '<runId>'}/shots/\`
> - Director: \`output/ab-test/director/${r.director?.runId ?? '<runId>'}/shots/\`
>
> Human reviewers must assess: visual hierarchy, hero suitability, brand/industry fit,
> information density, imagery usage, typography, CTA prominence, mobile composition,
> accessibility, and overall coherence.
> Do NOT infer a visual winner from automated metrics alone.
`.trim();
    })
    .join('\n\n---\n\n');

  return `# Design Director V1 — A/B Experiment Report

Generated: ${runAt}

## 1. Experiment Objective

Compare the existing deterministic design pipeline (Control A, \`DIRECTOR_ENABLED=false\`)
against the same pipeline guided by the AI Design Director (Director B, \`DIRECTOR_ENABLED=true\`).

The goal is to measure whether the Design Director produces **meaningfully better** outcomes,
not merely different ones.

## 2. Corpus

Five real businesses, as defined in \`scripts/batch-audit.ts\` (unchanged):

| # | Business | Industry | Maps URL |
|---|---|---|---|
| 1 | Zuni Café | Restaurant | Google Maps search |
| 2 | Union Square Dental | Dentist | Google Maps search |
| 3 | Kerr & Wagstaffe LLP | Lawyer | Google Maps search |
| 4 | Hotel Union Square | Hotel | Google Maps search |
| 5 | Salon DnA | Hair & Beauty Salon | Google Maps search |

## 3. Control Configuration (Group A)

- \`DIRECTOR_ENABLED=false\`
- \`OUTPUT_DIR=./output/ab-test/control\`
- All other settings: default / same as Director B

## 4. Director Configuration (Group B)

- \`DIRECTOR_ENABLED=true\`
- \`OUTPUT_DIR=./output/ab-test/director\`
- All other settings: default / same as Control A

## 5. Methodology

Pipeline for both groups:

\`\`\`
business → discovery → collection → normalization → analysis → writer → [Director B only: Design Director] → deterministic design → render
\`\`\`

Each business is run as a separate subprocess via \`main.ts\`.
The \`OUTPUT_DIR\` env var directs artifacts to group-specific directories.
Both groups process the same Maps URLs. Pipeline stages are non-deterministic for
discovery/collection (Google Maps is live), so inputs are not byte-identical between A and B.
This is a documented limitation — see Section 5.1.

### 5.1 Input Non-Determinism

Discovery and collection stages hit live Google Maps URLs. Content may differ between
Control A and Director B runs if Google serves different results. This is inherent to
the pipeline and cannot be avoided without caching stage 1–3 artifacts and replaying them.
The experiment documents this limitation rather than silently masking it.

## 6. Per-Business Comparison

${businessSections}

## 7. Mechanical Metrics Summary

| Business | Group | Direction | Hero | Sections | Broken Imgs | H-Overflow | CTAs |
|---|---|---|---|---|---|---|---|
${results
  .flatMap((r) => [
    `| ${r.business.name} | Control A | ${r.control?.design.direction ?? '-'} | ${r.control?.design.heroVariant ?? '-'} | ${r.control?.design.sectionCount ?? '-'} | ${r.control?.imagery.brokenImages ?? '-'} | ${r.control?.layout.horizontalOverflow ? '⚠️' : 'No'} | ${r.control?.conversion.ctaCount ?? '-'} |`,
    `| ${r.business.name} | Director B | ${r.director?.design.direction ?? '-'} | ${r.director?.design.heroVariant ?? '-'} | ${r.director?.design.sectionCount ?? '-'} | ${r.director?.imagery.brokenImages ?? '-'} | ${r.director?.layout.horizontalOverflow ? '⚠️' : 'No'} | ${r.director?.conversion.ctaCount ?? '-'} |`,
  ])
  .join('\n')}

## 8. Director Directive Quality

For each Director B run, the directive was analysed for:
- Presence of generic reasoning (flags flagged, not automatically failed)
- Confidence level
- Rationale completeness
- Direction validity

See per-business sections above for per-business analysis.

## 9. Regressions

${results.flatMap((r) => r.regressions.map((reg) => `- **${r.business.name}**: ${reg}`)).join('\n') || '_No regressions detected across all businesses._'}

## 10. Improvements (Mechanical)

${results.flatMap((r) => r.improvements.map((imp) => `- **${r.business.name}**: ${imp}`)).join('\n') || '_No mechanical improvements detected._'}

> ⚠️ Visual improvements require human review of screenshots. See per-business sections.

## 11. Neutral Changes

Changes in direction, color, or hero variant are **differences**, not improvements or regressions.
They require human review to assess quality.

${results.flatMap((r) => Object.keys(r.differences)).length > 0 ? 'Direction and hero variant changes were observed across businesses. See per-business tables for detail.' : 'No significant neutral changes detected mechanically.'}

## 12. Overall Result

**${overallVerdict}**

- Businesses compared: ${completed}/${totalBusinesses}
- Positive verdicts: ${positiveCount}
- Neutral verdicts: ${neutralCount}
- Negative verdicts: ${negativeCount}

> ⚠️ Automated metrics measure mechanical correctness, not visual quality.
> A complete verdict requires human review of screenshots in \`output/ab-test/\`.

## 13. Recommendation

${
  completed < totalBusinesses
    ? 'The experiment is **INCOMPLETE**. Re-run with valid API credentials for all five businesses before drawing conclusions.'
    : negativeCount > positiveCount
      ? 'The Design Director introduced regressions. Investigate directive quality and applyDirective logic before enabling in production.'
      : positiveCount > negativeCount
        ? 'The Design Director shows positive mechanical signals. Proceed with human screenshot review before declaring success.'
        : 'The Design Director produced neutral changes. Directive quality analysis and human screenshot review are needed to determine whether the changes represent real improvement.'
}
`;
}

function generateVerification(
  testsBefore: string,
  testsAfter: string,
  typecheckResult: string,
  results: BusinessResult[],
  runAt: string,
  commands: string[],
): string {
  const controlRunIds = results.map((r) => `${r.business.slug}: ${r.control?.runId ?? 'FAILED'}`);
  const directorRunIds = results.map(
    (r) => `${r.business.slug}: ${r.director?.runId ?? 'FAILED'}`,
  );

  return `# Design Director V1 — A/B Experiment Verification

Generated: ${runAt}

## Commands Executed

\`\`\`
${commands.join('\n')}
\`\`\`

## Test Results

**Before experiment:**
\`\`\`
${testsBefore}
\`\`\`

**After experiment:**
\`\`\`
${testsAfter}
\`\`\`

## Typecheck Result

\`\`\`
${typecheckResult}
\`\`\`

## Businesses Tested

${results.map((r) => `- ${r.business.name} (${r.business.industry})`).join('\n')}

## Control Run IDs (Group A)

${controlRunIds.map((id) => `- ${id}`).join('\n')}

## Director Run IDs (Group B)

${directorRunIds.map((id) => `- ${id}`).join('\n')}

## Output Locations

- Control artifacts: \`output/ab-test/control/\`
- Director artifacts: \`output/ab-test/director/\`
- Machine-readable results: \`output/ab-test/ab-results.json\`
- Report: \`docs/design-director-v1-ab-test.md\`
- This file: \`docs/design-director-v1-ab-test-verification.md\`

## Files Created

- \`scripts/ab-test.ts\` — experiment runner (new file, no production logic modified)
- \`output/ab-test/ab-results.json\`
- \`docs/design-director-v1-ab-test.md\`
- \`docs/design-director-v1-ab-test-verification.md\`

## Source Files Modified

- \`scripts/batch-audit.ts\` — **NOT modified**. \`BUSINESSES\` and \`BatchBusiness\` are re-imported.
- Production design logic (\`lib/design/\`, \`lib/render/\`, \`lib/types.ts\`) — **NOT modified**.
- \`main.ts\` — **NOT modified**.

## Production Design Logic Modified

**No.** The experiment controls only \`DIRECTOR_ENABLED\` and \`OUTPUT_DIR\` environment
variables passed to the existing \`main.ts\` entry point via \`spawnSync\`.

## Final Experiment Verdict

${results.filter((r) => r.control && r.director).length}/${results.length} businesses completed both groups.

Verdicts by business:
${results.map((r) => `- ${r.business.name}: ${r.verdict.toUpperCase()}`).join('\n')}
`;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  const measureOnly = process.argv.includes('--measure');
  const runAt = new Date().toISOString();
  const commands: string[] = [];

  fs.mkdirSync(CONTROL_OUTPUT, { recursive: true });
  fs.mkdirSync(DIRECTOR_OUTPUT, { recursive: true });
  fs.mkdirSync(DOCS_DIR, { recursive: true });

  // --- Pre-experiment test run ---
  process.stdout.write('\n=== Running tests before experiment ===\n');
  commands.push('npm test (before)');
  const preTestResult = spawnSync('npm', ['test'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  const testsBefore = (preTestResult.stdout ?? '') + (preTestResult.stderr ?? '');
  const testBeforeSummary = testsBefore.split('\n').filter((l) => /^# (tests|pass|fail)/.test(l)).join('\n');
  process.stdout.write(`${testBeforeSummary || '(see full output for details)'}\n`);

  // --- Typecheck ---
  process.stdout.write('\n=== Typecheck ===\n');
  commands.push('npm run typecheck');
  const typecheckResult = spawnSync('npm', ['run', 'typecheck'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  const typecheckOutput =
    (typecheckResult.stdout ?? '') + (typecheckResult.stderr ?? '') || 'no output (clean)';
  process.stdout.write(`${typecheckOutput.trim().slice(0, 500)}\n`);

  // --- Generate / load records ---
  const registryPath = path.join(AB_OUTPUT, 'registry.json');

  let controlRecords: GroupRecord[];
  let directorRecords: GroupRecord[];

  if (measureOnly && fs.existsSync(registryPath)) {
    const stored = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as {
      control: GroupRecord[];
      director: GroupRecord[];
    };
    controlRecords = stored.control;
    directorRecords = stored.director;
    process.stdout.write('\n=== Re-measuring existing runs ===\n');
  } else {
    process.stdout.write('\n=== Running CONTROL A (DIRECTOR_ENABLED=false) ===\n');
    commands.push('main.ts × 5 with DIRECTOR_ENABLED=false OUTPUT_DIR=output/ab-test/control');
    controlRecords = BUSINESSES.map((b) => generate(b, 'control', CONTROL_OUTPUT));

    process.stdout.write('\n=== Running DIRECTOR B (DIRECTOR_ENABLED=true) ===\n');
    commands.push('main.ts × 5 with DIRECTOR_ENABLED=true OUTPUT_DIR=output/ab-test/director');
    directorRecords = BUSINESSES.map((b) => generate(b, 'director', DIRECTOR_OUTPUT));

    fs.writeFileSync(
      registryPath,
      `${JSON.stringify({ control: controlRecords, director: directorRecords }, null, 2)}\n`,
      'utf8',
    );
  }

  // --- Measure ---
  process.stdout.write('\n=== Measuring sites ===\n');

  const businessResults: BusinessResult[] = [];

  for (let i = 0; i < BUSINESSES.length; i++) {
    const biz = BUSINESSES[i];
    const controlRecord = controlRecords[i];
    const directorRecord = directorRecords[i];

    process.stdout.write(`\n--- Measuring ${biz.label} ---\n`);

    let controlMeasured: GroupMeasured | null = null;
    let directorMeasured: GroupMeasured | null = null;

    try {
      controlMeasured = await measure(controlRecord, CONTROL_OUTPUT);
    } catch (err) {
      process.stdout.write(
        `Control measure failed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }

    try {
      directorMeasured = await measure(directorRecord, DIRECTOR_OUTPUT);
    } catch (err) {
      process.stdout.write(
        `Director measure failed: ${err instanceof Error ? err.message : String(err)}\n`,
      );
    }

    businessResults.push(
      compareGroups(
        biz.slug,
        biz.label,
        biz.industry,
        controlMeasured,
        directorMeasured,
      ),
    );
  }

  // --- Post-experiment test run ---
  process.stdout.write('\n=== Running tests after experiment ===\n');
  commands.push('npm test (after)');
  const postTestResult = spawnSync('npm', ['test'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
  });
  const testsAfter = (postTestResult.stdout ?? '') + (postTestResult.stderr ?? '');
  const testAfterSummary = testsAfter.split('\n').filter((l) => /^# (tests|pass|fail)/.test(l)).join('\n');
  process.stdout.write(`${testAfterSummary || '(see full output for details)'}\n`);

  // --- Write outputs ---
  const overallVerdicts = businessResults.map((r) => r.verdict);
  const positiveCount = overallVerdicts.filter((v) => v === 'positive').length;
  const negativeCount = overallVerdicts.filter((v) => v === 'negative').length;

  let overallVerdict: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'INCOMPLETE';
  const completedCount = businessResults.filter((r) => r.control && r.director).length;
  if (completedCount < BUSINESSES.length) {
    overallVerdict = 'INCOMPLETE';
  } else if (negativeCount > positiveCount) {
    overallVerdict = 'NEGATIVE';
  } else if (positiveCount > negativeCount) {
    overallVerdict = 'POSITIVE';
  } else {
    overallVerdict = 'NEUTRAL';
  }

  const abResults = {
    experiment: 'Design Director V1 A/B Test',
    runAt,
    overallVerdict,
    completedBusinesses: completedCount,
    totalBusinesses: BUSINESSES.length,
    businesses: businessResults,
  };

  fs.writeFileSync(RESULTS_FILE, `${JSON.stringify(abResults, null, 2)}\n`, 'utf8');
  process.stdout.write(`\nResults written to: ${RESULTS_FILE}\n`);

  const report = generateReport(businessResults, runAt);
  const reportPath = path.join(DOCS_DIR, 'design-director-v1-ab-test.md');
  fs.writeFileSync(reportPath, report, 'utf8');
  process.stdout.write(`Report written to: ${reportPath}\n`);

  const verification = generateVerification(
    testBeforeSummary || testsBefore.slice(-500),
    testAfterSummary || testsAfter.slice(-500),
    typecheckOutput.trim(),
    businessResults,
    runAt,
    commands,
  );
  const verificationPath = path.join(DOCS_DIR, 'design-director-v1-ab-test-verification.md');
  fs.writeFileSync(verificationPath, verification, 'utf8');
  process.stdout.write(`Verification written to: ${verificationPath}\n`);

  process.stdout.write(`\n=== EXPERIMENT COMPLETE ===\n`);
  process.stdout.write(`Overall verdict: ${overallVerdict}\n`);
  process.stdout.write(`Businesses compared: ${completedCount}/${BUSINESSES.length}\n`);
  process.stdout.write(`Report: ${reportPath}\n`);
  process.stdout.write(`Verification: ${verificationPath}\n`);
}

void main();
