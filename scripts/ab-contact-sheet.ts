/**
 * A/B Contact Sheet Generator
 *
 * Reads the existing screenshots from output/ab-test/ and stitches them into
 * two HTML contact sheets (desktop and mobile) for easy visual inspection.
 *
 * Does NOT re-run any experiment. Reads only:
 *   output/ab-test/control/<slug>/shots/desktop.png
 *   output/ab-test/control/<slug>/shots/mobile.png
 *   output/ab-test/director/<slug>/shots/desktop.png
 *   output/ab-test/director/<slug>/shots/mobile.png
 *   output/ab-test/ab-results.json
 *
 * Output:
 *   output/ab-test/contact-sheet-desktop.html
 *   output/ab-test/contact-sheet-mobile.html
 *
 * Usage:
 *   node --import tsx scripts/ab-contact-sheet.ts
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AB_OUT = path.join(ROOT, 'output', 'ab-test');

/* ------------------------------------------------------------------ */
/* Business order — matches the experiment order                       */
/* ------------------------------------------------------------------ */

const BUSINESSES = [
  { slug: 'restaurant', label: 'Zuni Café', industry: 'Restaurant' },
  { slug: 'dentist', label: 'Union Square Dental', industry: 'Dentist' },
  { slug: 'lawyer', label: 'Kerr & Wagstaffe LLP', industry: 'Lawyer' },
  { slug: 'hotel', label: 'Hotel Union Square', industry: 'Hotel' },
  { slug: 'salon', label: 'Salon DnA', industry: 'Hair & Beauty Salon' },
] as const;

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

interface ArtifactStatus {
  slug: string;
  label: string;
  control: {
    html: boolean;
    design: boolean;
    desktop: boolean;
    mobile: boolean;
  };
  director: {
    html: boolean;
    design: boolean;
    directive: boolean;
    desktop: boolean;
    mobile: boolean;
  };
}

function check(p: string): boolean {
  return existsSync(p);
}

function auditArtifacts(): ArtifactStatus[] {
  return BUSINESSES.map((b) => {
    const ctrl = path.join(AB_OUT, 'control', b.slug);
    const dir = path.join(AB_OUT, 'director', b.slug);
    return {
      slug: b.slug,
      label: b.label,
      control: {
        html: check(path.join(ctrl, 'index.html')),
        design: check(path.join(ctrl, 'design.json')),
        desktop: check(path.join(ctrl, 'shots', 'desktop.png')),
        mobile: check(path.join(ctrl, 'shots', 'mobile.png')),
      },
      director: {
        html: check(path.join(dir, 'index.html')),
        design: check(path.join(dir, 'design.json')),
        directive: check(path.join(dir, 'directive.json')),
        desktop: check(path.join(dir, 'shots', 'desktop.png')),
        mobile: check(path.join(dir, 'shots', 'mobile.png')),
      },
    };
  });
}

/* ------------------------------------------------------------------ */
/* Directive source detection                                          */
/* ------------------------------------------------------------------ */

interface DirectiveSourceInfo {
  slug: string;
  source: 'real-ai' | 'fallback' | 'missing';
  /** Key fields from the directive that reveal its origin */
  snippet: string;
}

async function detectDirectiveSources(): Promise<DirectiveSourceInfo[]> {
  const results: DirectiveSourceInfo[] = [];
  for (const b of BUSINESSES) {
    const p = path.join(AB_OUT, 'director', b.slug, 'directive.json');
    if (!existsSync(p)) {
      results.push({ slug: b.slug, source: 'missing', snippet: 'directive.json not found' });
      continue;
    }
    const raw = JSON.parse(await fs.readFile(p, 'utf8')) as Record<string, unknown>;

    // The real designDirectorAgent always sets confidence as a decimal from the model.
    // The fallback directives are hard-coded with specific rationale strings.
    // We can also check for the presence of fields the model typically includes.
    const rationale = String(raw.rationale ?? '');
    const confidence = raw.confidence as number | undefined;

    // Directive source is determined by matching the complete rationale strings
    // hard-coded in ab-replay.ts FALLBACK_DIRECTIVES. The phrases below are
    // exact substrings of those strings. A real AI model would produce
    // different phrasing on every run.
    //
    // The full fallback rationale strings are:
    //   restaurant: "A celebrated San Francisco restaurant demands editorial elegance..."
    //   dentist:    "A dental practice must project cleanliness, trust and approachability..."
    //   law-firm:   "A litigation firm requires gravitas and precision..."
    //   hotel:      "A boutique San Francisco hotel competes on atmosphere..."
    //   salon:      "A creative salon sells transformation..."
    const knownFallbackPhrases = [
      'celebrated San Francisco restaurant demands editorial elegance',
      'dental practice must project cleanliness, trust and approachability',
      'litigation firm requires gravitas and precision',
      'boutique San Francisco hotel competes on atmosphere',
      'creative salon sells transformation',
    ];
    const isFallback = knownFallbackPhrases.some((phrase) =>
      rationale.toLowerCase().includes(phrase.toLowerCase()),
    );

    results.push({
      slug: b.slug,
      source: isFallback ? 'fallback' : 'real-ai',
      snippet: `confidence=${confidence ?? 'n/a'} rationale="${rationale.slice(0, 80)}…"`,
    });
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* PNG → base64                                                        */
/* ------------------------------------------------------------------ */

async function toBase64(p: string): Promise<string | null> {
  if (!existsSync(p)) return null;
  const buf = await fs.readFile(p);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

/* ------------------------------------------------------------------ */
/* Contact sheet HTML                                                  */
/* ------------------------------------------------------------------ */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

interface SheetEntry {
  slug: string;
  label: string;
  industry: string;
  controlImg: string | null;
  directorImg: string | null;
  controlDir: string;
  directorDir: string;
  verdict: string;
  directionChanged: boolean;
}

function buildContactSheet(
  title: string,
  subtitle: string,
  entries: SheetEntry[],
  imageWidth: number,
): string {
  const cellWidth = imageWidth;
  const totalWidth = cellWidth * 2 + 80; // 2 columns + gap

  const rows = entries.map((entry) => {
    const leftImg = entry.controlImg
      ? `<img src="${entry.controlImg}" alt="Control — ${esc(entry.label)}" width="${cellWidth}" style="display:block;max-width:100%;border:1px solid #ddd;border-radius:4px;">`
      : `<div style="width:${cellWidth}px;height:${Math.round(cellWidth * 0.7)}px;background:#eee;display:flex;align-items:center;justify-content:center;border-radius:4px;color:#999;font-size:.875rem;">Screenshot missing</div>`;

    const rightImg = entry.directorImg
      ? `<img src="${entry.directorImg}" alt="Director — ${esc(entry.label)}" width="${cellWidth}" style="display:block;max-width:100%;border:1px solid #ddd;border-radius:4px;">`
      : `<div style="width:${cellWidth}px;height:${Math.round(cellWidth * 0.7)}px;background:#eee;display:flex;align-items:center;justify-content:center;border-radius:4px;color:#999;font-size:.875rem;">Screenshot missing</div>`;

    const badge = entry.directionChanged
      ? `<span style="background:#1a6eff;color:#fff;font-size:.75rem;padding:.15rem .5rem;border-radius:99px;margin-left:.5rem;">differentiated</span>`
      : `<span style="background:#888;color:#fff;font-size:.75rem;padding:.15rem .5rem;border-radius:99px;margin-left:.5rem;">identical</span>`;

    return `
  <section style="margin-bottom:3rem;">
    <h2 style="font-size:1.1rem;font-weight:600;margin:0 0 .25rem;color:#111;">
      ${esc(entry.label)} <span style="color:#666;font-weight:400;font-size:.9rem;">(${esc(entry.industry)})</span>${badge}
    </h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:start;">
      <div>
        <div style="font-size:.75rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#888;margin-bottom:.4rem;">
          CONTROL — deterministic design
        </div>
        ${leftImg}
        <div style="font-size:.75rem;color:#666;margin-top:.3rem;font-family:monospace;">${esc(entry.controlDir)}</div>
      </div>
      <div>
        <div style="font-size:.75rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#1a6eff;margin-bottom:.4rem;">
          DIRECTOR — AI design directive applied
        </div>
        ${rightImg}
        <div style="font-size:.75rem;color:#666;margin-top:.3rem;font-family:monospace;">${esc(entry.directorDir)}</div>
      </div>
    </div>
  </section>`;
  }).join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light; }
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, sans-serif;
    margin: 0;
    padding: 2rem 1.5rem 4rem;
    max-width: ${totalWidth + 80}px;
    margin-inline: auto;
    background: #f9f9f9;
    color: #111;
  }
  header {
    border-bottom: 2px solid #111;
    padding-bottom: 1.25rem;
    margin-bottom: 2.5rem;
  }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  .subtitle { color: #555; font-size: .9rem; margin: 0; }
  .meta { display: flex; gap: 1.5rem; margin-top: 1rem; font-size: .8125rem; color: #666; }
  .meta strong { color: #111; }
</style>
</head>
<body>
<header>
  <h1>${esc(title)}</h1>
  <p class="subtitle">${esc(subtitle)}</p>
  <div class="meta">
    <span><strong>Businesses:</strong> ${entries.length}</span>
    <span><strong>Variants:</strong> Control (deterministic) vs Director (AI directive → deterministic)</span>
    <span><strong>Directive source:</strong> hand-authored fallback (no AI provider key)</span>
    <span><strong>Same input:</strong> BusinessProfile + BusinessStrategy + WebsiteContent identical for both variants</span>
  </div>
</header>
${rows}
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  console.log('=== A/B Contact Sheet Generator ===\n');

  // 1. Audit artifacts
  const audit = auditArtifacts();
  const directiveSources = await detectDirectiveSources();

  console.log('--- Artifact Audit ---');
  let renderedSites = 0;
  let screenshots = 0;
  const missing: string[] = [];

  for (const a of audit) {
    const ctrlOk = a.control.html && a.control.desktop && a.control.mobile;
    const dirOk = a.director.html && a.director.desktop && a.director.mobile;
    if (a.control.html) renderedSites++;
    if (a.director.html) renderedSites++;
    if (a.control.desktop) screenshots++;
    if (a.control.mobile) screenshots++;
    if (a.director.desktop) screenshots++;
    if (a.director.mobile) screenshots++;

    const status = ctrlOk && dirOk ? '✓' : '✗';
    console.log(`  ${status} ${a.label.padEnd(22)} control(html=${a.control.html ? 'y' : 'N'} desk=${a.control.desktop ? 'y' : 'N'} mob=${a.control.mobile ? 'y' : 'N'})  director(html=${a.director.html ? 'y' : 'N'} desk=${a.director.desktop ? 'y' : 'N'} mob=${a.director.mobile ? 'y' : 'N'} directive=${a.director.directive ? 'y' : 'N'})`);

    if (!a.control.html) missing.push(`control/${a.slug}/index.html`);
    if (!a.control.desktop) missing.push(`control/${a.slug}/shots/desktop.png`);
    if (!a.control.mobile) missing.push(`control/${a.slug}/shots/mobile.png`);
    if (!a.director.html) missing.push(`director/${a.slug}/index.html`);
    if (!a.director.desktop) missing.push(`director/${a.slug}/shots/desktop.png`);
    if (!a.director.mobile) missing.push(`director/${a.slug}/shots/mobile.png`);
  }

  console.log(`\n  Rendered sites:  ${renderedSites} / 10`);
  console.log(`  Screenshots:     ${screenshots} / 20`);
  if (missing.length > 0) {
    console.log(`\n  MISSING (${missing.length}):`);
    for (const m of missing) console.log(`    - ${m}`);
  }

  // 2. Directive source
  console.log('\n--- Directive Source Detection ---');
  let allFallback = true;
  let anyReal = false;
  for (const d of directiveSources) {
    const mark = d.source === 'fallback' ? 'FALLBACK' : d.source === 'real-ai' ? 'REAL-AI ' : 'MISSING ';
    console.log(`  ${mark} ${d.slug.padEnd(12)} ${d.snippet}`);
    if (d.source === 'real-ai') anyReal = true;
    if (d.source !== 'fallback') allFallback = false;
  }
  const directiveSourceLabel = allFallback
    ? 'hand-authored FALLBACK_DIRECTIVES in ab-replay.ts — no real AI designDirectorAgent was called'
    : anyReal
      ? 'real designDirectorAgent (AI model call)'
      : 'mixed / unknown';
  console.log(`\n  Verdict: ${directiveSourceLabel}`);

  // 3. Read ab-results for verdict info
  const resultsPath = path.join(AB_OUT, 'ab-results.json');
  let verdictBySlug: Map<string, boolean> = new Map();
  if (existsSync(resultsPath)) {
    const results = JSON.parse(await fs.readFile(resultsPath, 'utf8')) as {
      businesses: Array<{ business: { slug: string }; directionChanged?: boolean; verdict?: string }>;
    };
    for (const b of results.businesses) {
      verdictBySlug.set(b.business.slug, b.directionChanged ?? false);
    }
  }

  // 4. Build desktop contact sheet
  console.log('\n--- Building Desktop Contact Sheet ---');
  const desktopEntries: SheetEntry[] = [];
  for (const b of BUSINESSES) {
    const ctrlDesk = path.join(AB_OUT, 'control', b.slug, 'shots', 'desktop.png');
    const dirDesk = path.join(AB_OUT, 'director', b.slug, 'shots', 'desktop.png');
    desktopEntries.push({
      slug: b.slug,
      label: b.label,
      industry: b.industry,
      controlImg: await toBase64(ctrlDesk),
      directorImg: await toBase64(dirDesk),
      controlDir: `output/ab-test/control/${b.slug}/shots/desktop.png`,
      directorDir: `output/ab-test/director/${b.slug}/shots/desktop.png`,
      verdict: 'differentiated',
      directionChanged: verdictBySlug.get(b.slug) ?? false,
    });
    console.log(`  ${b.slug}: control=${existsSync(ctrlDesk) ? 'ok' : 'MISSING'} director=${existsSync(dirDesk) ? 'ok' : 'MISSING'}`);
  }

  const desktopHtml = buildContactSheet(
    'A/B Experiment — Desktop Contact Sheet',
    '5 businesses × 2 variants — directive source: hand-authored FALLBACK_DIRECTIVES (no AI key)',
    desktopEntries,
    560,
  );
  const desktopOut = path.join(AB_OUT, 'contact-sheet-desktop.html');
  await fs.writeFile(desktopOut, desktopHtml, 'utf8');
  console.log(`  Written: ${path.relative(ROOT, desktopOut)}`);

  // 5. Build mobile contact sheet
  console.log('\n--- Building Mobile Contact Sheet ---');
  const mobileEntries: SheetEntry[] = [];
  for (const b of BUSINESSES) {
    const ctrlMob = path.join(AB_OUT, 'control', b.slug, 'shots', 'mobile.png');
    const dirMob = path.join(AB_OUT, 'director', b.slug, 'shots', 'mobile.png');
    mobileEntries.push({
      slug: b.slug,
      label: b.label,
      industry: b.industry,
      controlImg: await toBase64(ctrlMob),
      directorImg: await toBase64(dirMob),
      controlDir: `output/ab-test/control/${b.slug}/shots/mobile.png`,
      directorDir: `output/ab-test/director/${b.slug}/shots/mobile.png`,
      verdict: 'differentiated',
      directionChanged: verdictBySlug.get(b.slug) ?? false,
    });
    console.log(`  ${b.slug}: control=${existsSync(ctrlMob) ? 'ok' : 'MISSING'} director=${existsSync(dirMob) ? 'ok' : 'MISSING'}`);
  }

  const mobileHtml = buildContactSheet(
    'A/B Experiment — Mobile Contact Sheet',
    '5 businesses × 2 variants — directive source: hand-authored FALLBACK_DIRECTIVES (no AI key)',
    mobileEntries,
    300,
  );
  const mobileOut = path.join(AB_OUT, 'contact-sheet-mobile.html');
  await fs.writeFile(mobileOut, mobileHtml, 'utf8');
  console.log(`  Written: ${path.relative(ROOT, mobileOut)}`);

  // 6. Final report
  console.log('\n=== Final Report ===');
  console.log(`  Rendered sites:      ${renderedSites} / 10`);
  console.log(`  Screenshots:         ${screenshots} / 20`);
  console.log(`  Directive source:    ${directiveSourceLabel}`);
  console.log(`  Desktop sheet:       output/ab-test/contact-sheet-desktop.html`);
  console.log(`  Mobile sheet:        output/ab-test/contact-sheet-mobile.html`);
  if (missing.length > 0) {
    console.log(`  Missing artifacts:   ${missing.length}`);
    for (const m of missing) console.log(`    - ${m}`);
  } else {
    console.log(`  Missing artifacts:   none`);
  }
  console.log('');
}

await main();
