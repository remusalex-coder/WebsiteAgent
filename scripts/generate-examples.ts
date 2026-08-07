/**
 * Renders the twenty example sites and a comparison of what the design layer
 * decided for each.
 *
 *   npx tsx scripts/generate-examples.ts
 *
 * Output lands in `output/examples/`: one folder per business, plus an
 * `index.html` that links them and a `comparison.md` that tabulates every
 * decision side by side. The table is the point — a set of sites that look
 * different one at a time but share a hero variant, a density and a section
 * order are not actually different, and that is only visible in aggregate.
 *
 * Uses the same `composeDesign` → `renderSite` path the pipeline uses. Nothing
 * here renders anything of its own.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';

import { composeDesign } from '../lib/design/index.js';
import { renderSite, writeRenderedSite } from '../lib/render/index.js';
import { EXAMPLES, build } from './example-businesses.js';

import type { WebsiteDesign } from '../lib/design/index.js';
import type { Example } from './example-businesses.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'output', 'examples');

function escape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * A stand-in for a photograph, drawn from the site's own ramp.
 *
 * Not decoration: without a file at each `localPath` every page under review
 * would show broken-image icons, and a broken image reads as a layout fault
 * even when the layout is fine. Neutral bands rather than anything pictorial —
 * the review is of the composition around the image, and a placeholder with
 * character of its own would flatter or damage that unfairly.
 */
function placeholderSvg(design: WebsiteDesign, index: number, width: number, height: number): string {
  const ramp = design.tokens.color.ramps.neutral.steps;
  const brand = design.tokens.color.ramps.primary.steps;
  const at = (steps: readonly string[], i: number): string => steps[i] ?? '#cccccc';

  const base = at(ramp, 3 + (index % 3));
  const band = at(ramp, 5 + (index % 3));
  const mark = at(brand, 7);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="presentation">`
    + `<rect width="${width}" height="${height}" fill="${base}"/>`
    + `<rect y="${Math.round(height * 0.58)}" width="${width}" height="${Math.round(height * 0.42)}" fill="${band}"/>`
    + `<circle cx="${Math.round(width * (0.22 + 0.12 * (index % 4)))}" cy="${Math.round(height * 0.4)}" r="${Math.round(height * 0.14)}" fill="${mark}" opacity="0.55"/>`
    + '</svg>\n';
}

/** Writes one file per `localPath` the render asked for, so nothing 404s. */
async function writePlaceholders(dir: string, design: WebsiteDesign, paths: readonly string[]): Promise<void> {
  await fs.mkdir(path.join(dir, 'assets'), { recursive: true });
  await Promise.all(paths.map(async (localPath, index) => {
    const hero = localPath.includes('hero');
    await fs.writeFile(
      path.join(dir, localPath),
      placeholderSvg(design, index, hero ? 1600 : 1200, hero ? 900 : 900),
      'utf8',
    );
  }));
}

/** One row of the comparison, flattened out of the design. */
interface Row {
  readonly slug: string;
  readonly label: string;
  readonly name: string;
  readonly industry: string;
  readonly direction: string;
  readonly density: string;
  readonly hero: string;
  readonly footer: string;
  readonly brand: string;
  readonly accent: string;
  readonly canvas: string;
  readonly heading: string;
  readonly body: string;
  readonly typeRatio: number;
  readonly displayRem: number;
  readonly sectionMaxRem: number;
  readonly containerRem: number;
  readonly radius: string;
  readonly elevation: string;
  readonly motion: string;
  readonly order: string;
  readonly variants: string;
  readonly contrast: number;
  readonly notes: readonly string[];
}

function row(example: Example, design: WebsiteDesign): Row {
  const { tokens, layout } = design;
  return {
    slug: example.spec.slug,
    label: example.spec.label,
    name: example.spec.name,
    industry: design.industry.id,
    direction: design.personality.direction,
    density: design.personality.density,
    hero: layout.hero,
    footer: layout.footer,
    brand: tokens.color.semantic.brand,
    accent: tokens.color.semantic.accent,
    canvas: tokens.color.semantic.canvas,
    heading: tokens.typography.heading.family,
    body: tokens.typography.body.family,
    typeRatio: tokens.typography.ratio,
    displayRem: tokens.typography.scale.display.maxRem,
    sectionMaxRem: tokens.spacing.sectionMaxRem,
    containerRem: design.responsive.containerMaxRem,
    radius: tokens.radius.style,
    elevation: tokens.elevation.style,
    motion: tokens.motion.level,
    order: layout.sections.map((section) => section.kind).join(' → '),
    variants: layout.sections.map((section) => `${section.kind}:${section.variant}`).join(', '),
    contrast: tokens.color.contrast.textOnCanvas,
    notes: design.notes,
  };
}

/** A gallery page, so twenty sites can be opened from one place. */
function indexPage(rows: readonly Row[]): string {
  const cards = rows.map((entry) => `
    <a class="card" href="./${entry.slug}/index.html">
      <span class="swatches">
        <span style="background:${entry.brand}"></span>
        <span style="background:${entry.accent}"></span>
        <span style="background:${entry.canvas}"></span>
      </span>
      <strong>${escape(entry.name)}</strong>
      <span class="meta">${escape(entry.label)} · ${escape(entry.industry)}</span>
      <span class="meta">${escape(entry.direction)} · ${escape(entry.density)} · ${escape(entry.hero)} hero</span>
      <span class="meta">${escape(entry.heading)} / ${escape(entry.body)}</span>
    </a>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Design intelligence — twenty examples</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.5 system-ui, sans-serif; margin: 0; padding: 3rem 1.5rem; max-width: 76rem; margin-inline: auto; }
  h1 { font-size: 1.75rem; margin: 0 0 .25rem; }
  p.lede { color: #666; margin: 0 0 2.5rem; }
  .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr)); }
  .card { display: grid; gap: .25rem; padding: 1rem; border: 1px solid #ddd; border-radius: .5rem; text-decoration: none; color: inherit; }
  .card:hover { border-color: #888; }
  .swatches { display: flex; height: 2.5rem; border-radius: .25rem; overflow: hidden; margin-bottom: .5rem; }
  .swatches span { flex: 1; }
  .meta { font-size: .8125rem; color: #666; }
  @media (prefers-color-scheme: dark) { body { background: #111; color: #eee; } .card { border-color: #333; } p.lede, .meta { color: #999; } }
</style>
</head>
<body>
<h1>Twenty examples</h1>
<p class="lede">Every one composed from a profile with no brand colour, so the industry fallback palette is what you are looking at.</p>
<div class="grid">${cards}
</div>
</body>
</html>
`;
}

/** The side-by-side table. Markdown, because the interesting reading is a diff. */
function comparison(rows: readonly Row[]): string {
  const head = (title: string, columns: readonly string[], cells: (entry: Row) => readonly string[]): string => {
    const lines = [
      `### ${title}`,
      '',
      `| Business | ${columns.join(' | ')} |`,
      `| --- | ${columns.map(() => '---').join(' | ')} |`,
      ...rows.map((entry) => `| ${entry.label} | ${cells(entry).join(' | ')} |`),
      '',
    ];
    return lines.join('\n');
  };

  const unique = <T,>(values: readonly T[]): number => new Set(values).size;

  return [
    '# Twenty industries, side by side',
    '',
    `Generated by \`scripts/generate-examples.ts\` from ${rows.length} hand-written business profiles,`,
    'none of which supplies a brand colour — so every palette below is the industry',
    'fallback, which is what this pass was calibrating.',
    '',
    '## Spread',
    '',
    '| Decision | Distinct values across 20 sites |',
    '| --- | --- |',
    `| Industry classified | ${unique(rows.map((r) => r.industry))} |`,
    `| Direction | ${unique(rows.map((r) => r.direction))} |`,
    `| Density | ${unique(rows.map((r) => r.density))} |`,
    `| Hero variant | ${unique(rows.map((r) => r.hero))} |`,
    `| Footer variant | ${unique(rows.map((r) => r.footer))} |`,
    `| Heading typeface | ${unique(rows.map((r) => r.heading))} |`,
    `| Brand colour | ${unique(rows.map((r) => r.brand))} |`,
    `| Section order | ${unique(rows.map((r) => r.order))} |`,
    `| Full variant assignment | ${unique(rows.map((r) => r.variants))} |`,
    '',
    head('Identity', ['Industry', 'Direction', 'Density', 'Brand', 'Accent'],
      (r) => [r.industry, r.direction, r.density, `\`${r.brand}\``, `\`${r.accent}\``]),
    head('Typography', ['Heading', 'Body', 'Ratio', 'Display rem', 'Measure'],
      (r) => [r.heading, r.body, String(r.typeRatio), String(r.displayRem), `${r.containerRem}rem`]),
    head('Form and rhythm', ['Hero', 'Footer', 'Radius', 'Elevation', 'Motion', 'Section max'],
      (r) => [r.hero, r.footer, r.radius, r.elevation, r.motion, `${r.sectionMaxRem}rem`]),
    head('Section order', ['Order'], (r) => [r.order]),
    head('Variants', ['Assignment'], (r) => [r.variants]),
    '## Notes emitted per site',
    '',
    ...rows.flatMap((entry) => [
      `**${entry.label}** — ${entry.notes.length === 0 ? '_none_' : ''}`,
      ...entry.notes.map((note) => `- ${note}`),
      '',
    ]),
  ].join('\n');
}

async function main(): Promise<void> {
  // Clear the generated sites but leave `_shots` alone — screenshots are the
  // expensive artifact here, and wiping a before-set on a regenerate makes the
  // comparison they exist for impossible to finish.
  await fs.mkdir(OUT, { recursive: true });
  for (const entry of await fs.readdir(OUT)) {
    if (entry === '_shots') continue;
    await fs.rm(path.join(OUT, entry), { recursive: true, force: true });
  }

  const rows: Row[] = [];
  const warnings: string[] = [];

  for (const spec of EXAMPLES) {
    const example = build(spec);
    const design = composeDesign({
      profile: example.profile,
      strategy: example.strategy,
      content: example.content,
    });
    const site = renderSite(example.content, { design });

    const target = path.join(OUT, spec.slug);
    // Placeholders are written into the site folder itself and then copied
    // over themselves, which is a no-op the writer tolerates — it keeps the
    // example generator from needing a second staging directory.
    await writePlaceholders(target, design, site.assets.map((asset) => asset.sourcePath));
    await writeRenderedSite(site, { sourceDir: target, targetDir: target });
    await fs.writeFile(
      path.join(target, 'design.json'),
      `${JSON.stringify(design, null, 2)}\n`,
      'utf8',
    );

    rows.push(row(example, design));
    for (const warning of site.warnings) warnings.push(`${spec.slug}: ${warning}`);
  }

  await fs.writeFile(path.join(OUT, 'index.html'), indexPage(rows), 'utf8');
  await fs.writeFile(path.join(OUT, 'comparison.md'), comparison(rows), 'utf8');

  console.log(`${rows.length} sites written to output/examples/`);
  if (warnings.length > 0) console.log(`\nRenderer warnings:\n${warnings.map((w) => `  ${w}`).join('\n')}`);
}

await main();
