/**
 * Builds `output/review/index.html` — the cross-industry review dashboard.
 *
 * Reads `output/batch.json` (measured facts) and `output/scores.json` (the
 * qualitative scorecard), and emits one card per generated site plus a
 * comparison matrix and the recurring-defect list.
 *
 *   node --import tsx scripts/build-review.ts
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUTPUT = path.join(ROOT, 'output');
const REVIEW = path.join(OUTPUT, 'review');

interface Scores {
  design: number; ux: number; copy: number; seo: number;
  trust: number; conversion: number; accessibility: number; mobile: number;
  note: string;
}

interface Defect {
  id: string; title: string; scope: string; sites: string[]; status: string; detail: string;
}

const CATEGORIES: readonly (keyof Omit<Scores, 'note'>)[] = [
  'design', 'ux', 'copy', 'seo', 'trust', 'conversion', 'accessibility', 'mobile',
];

const LABELS: Record<string, string> = {
  design: 'Design', ux: 'UX', copy: 'Copy', seo: 'SEO',
  trust: 'Trust', conversion: 'Conversion', accessibility: 'Accessibility', mobile: 'Mobile',
};

const escape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const overall = (s: Scores): number =>
  Math.round((CATEGORIES.reduce((sum, key) => sum + s[key], 0) / CATEGORIES.length) * 10) / 10;

/** Green above 7, amber 5–7, red below 5. */
const band = (n: number): string => (n >= 7 ? 'good' : n >= 5 ? 'mid' : 'bad');

function main(): void {
  const batch = JSON.parse(fs.readFileSync(path.join(OUTPUT, 'batch.json'), 'utf8')) as Record<string, unknown>[];
  const scores = JSON.parse(fs.readFileSync(path.join(OUTPUT, 'scores.json'), 'utf8')) as {
    sites: Record<string, Scores>;
    defects: Defect[];
  };

  fs.mkdirSync(REVIEW, { recursive: true });

  const rows = batch
    .filter((row) => row.runId !== null)
    .map((row) => {
      const slug = String(row.slug);
      const s = scores.sites[slug];
      if (s === undefined) throw new Error(`no scores for ${slug}`);
      return { row, slug, s, total: overall(s) };
    })
    .sort((a, b) => b.total - a.total);

  const cards = rows
    .map(({ row, slug, s, total }) => {
      const runId = String(row.runId);
      const d = (row.desktop ?? {}) as Record<string, unknown>;
      const m = (row.mobile ?? {}) as Record<string, unknown>;
      const base = `../${runId}`;
      const gaps = (row.unresolvedGaps as string[] | undefined) ?? [];

      const scoreCells = CATEGORIES.map(
        (key) => `<div class="s"><span>${LABELS[key]}</span><b class="${band(s[key])}">${s[key]}</b></div>`,
      ).join('');

      return `
<article class="card" data-slug="${slug}" data-total="${total}">
  <header class="card__head">
    <div>
      <h2>${escape(String(row.businessName ?? row.label))}</h2>
      <p class="meta">${escape(String(row.industry))} · detected <code>${escape(String(row.detectedIndustry))}</code>
        · <code>${escape(String(row.direction))}</code> · hero <code>${escape(String(row.heroVariant))}</code></p>
    </div>
    <div class="overall ${band(total)}"><b>${total}</b><span>overall</span></div>
  </header>

  <p class="tagline">${escape(String(row.tagline ?? ''))}</p>

  <div class="shots">
    <a href="${base}/shots/desktop.png" target="_blank" class="shot shot--desktop">
      <img src="${base}/shots/desktop.png" alt="Desktop screenshot" loading="lazy"><span>desktop</span></a>
    <a href="${base}/shots/mobile.png" target="_blank" class="shot shot--mobile">
      <img src="${base}/shots/mobile.png" alt="Mobile screenshot" loading="lazy"><span>390px</span></a>
  </div>

  <div class="scores">${scoreCells}</div>
  <p class="note">${escape(s.note)}</p>

  <dl class="facts">
    <div><dt>sections</dt><dd>${(row.sectionKinds as string[] ?? []).length}</dd></div>
    <div><dt>words</dt><dd>${((d.sections as { words: number }[] ?? []).reduce((a, x) => a + x.words, 0))}</dd></div>
    <div><dt>images</dt><dd>${String(d.totalImgs ?? 0)}</dd></div>
    <div><dt>CTAs</dt><dd>${String(d.ctas ?? 0)}</dd></div>
    <div><dt>page</dt><dd>${String(d.pageHeight ?? 0)}px</dd></div>
    <div><dt>mob. header</dt><dd>${String(m.headerHeight ?? 0)}px</dd></div>
    <div><dt>overflow</dt><dd class="${m.overflow === true ? 'bad' : 'good'}">${m.overflow === true ? 'yes' : 'no'}</dd></div>
    <div><dt>open gaps</dt><dd>${gaps.length}</dd></div>
  </dl>

  <details class="gaps"><summary>${gaps.length} unresolved gaps the owner must confirm</summary>
    <ul>${gaps.map((g) => `<li>${escape(g)}</li>`).join('')}</ul></details>

  <nav class="actions">
    <a class="btn btn--primary" href="${base}/site/index.html" target="_blank">Open Website</a>
    <a class="btn" href="${base}/" target="_blank">Output Folder</a>
    <a class="btn" href="${base}/shots/" target="_blank">Screenshots</a>
    <a class="btn" href="${base}/site/" target="_blank">Artifacts</a>
    <a class="btn btn--ghost" href="${base}/4-strategy.json" target="_blank">Strategy JSON</a>
    <a class="btn btn--ghost" href="${base}/5-content.json" target="_blank">Content JSON</a>
    <a class="btn btn--ghost" href="${base}/5b-design.json" target="_blank">Design JSON</a>
  </nav>
</article>`;
    })
    .join('\n');

  const matrixHead = rows.map(({ row }) => `<th>${escape(String(row.industry))}</th>`).join('');
  const matrixRows = CATEGORIES.map((key) => {
    const cells = rows.map(({ s }) => `<td class="${band(s[key])}">${s[key]}</td>`).join('');
    return `<tr><th>${LABELS[key]}</th>${cells}</tr>`;
  }).join('');
  const totalsRow = `<tr class="totals"><th>Overall</th>${rows
    .map(({ total }) => `<td class="${band(total)}">${total}</td>`)
    .join('')}</tr>`;

  const defectRows = scores.defects
    .map(
      (defect) => `<tr>
    <td><code>${escape(defect.id)}</code></td>
    <td>${escape(defect.title)}<div class="detail">${escape(defect.detail)}</div></td>
    <td><span class="scope scope--${defect.scope.replace(/\s+/g, '-').toLowerCase()}">${escape(defect.scope)}</span></td>
    <td>${defect.sites.map((x) => `<span class="pill">${escape(x)}</span>`).join(' ')}</td>
    <td><span class="status status--${defect.status.toLowerCase()}">${escape(defect.status)}</span></td>
  </tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BusinessForge — Cross-Industry Review</title>
<style>
  :root{--bg:#0e0f11;--panel:#17191d;--line:#262a30;--ink:#e8eaed;--dim:#9aa2ad;
        --good:#3fb27f;--mid:#d0a13a;--bad:#d4574e;--accent:#6f8fd4;}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
       font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;}
  header.top{padding:28px 32px 18px;border-bottom:1px solid var(--line);}
  h1{margin:0 0 6px;font-size:22px;letter-spacing:-.01em}
  .sub{color:var(--dim);margin:0;font-size:14px}
  main{padding:24px 32px 64px;max-width:1600px;margin:0 auto}
  h2.section{font-size:15px;text-transform:uppercase;letter-spacing:.09em;color:var(--dim);
             margin:36px 0 14px;font-weight:600}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(430px,1fr));gap:18px;align-items:start}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:18px}
  .card__head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
  .card h2{margin:0;font-size:18px}
  .meta{margin:4px 0 0;color:var(--dim);font-size:12.5px}
  .meta code,.facts code{background:#22262c;border-radius:4px;padding:1px 5px;font-size:11.5px}
  .overall{text-align:center;min-width:64px;border-radius:9px;padding:7px 4px;background:#22262c}
  .overall b{display:block;font-size:23px;line-height:1}
  .overall span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim)}
  .tagline{color:var(--dim);font-size:13.5px;font-style:italic;margin:10px 0 12px}
  .shots{display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:14px}
  .shot{position:relative;display:block;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:#fff}
  .shot img{width:100%;display:block;max-height:290px;object-fit:cover;object-position:top}
  .shot span{position:absolute;left:6px;bottom:6px;background:rgba(0,0,0,.7);color:#fff;
             font-size:10px;padding:2px 6px;border-radius:4px;letter-spacing:.05em}
  .scores{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px}
  .s{background:#1d2025;border-radius:7px;padding:7px 6px;text-align:center}
  .s span{display:block;font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.05em}
  .s b{font-size:16px}
  .good{color:var(--good)} .mid{color:var(--mid)} .bad{color:var(--bad)}
  td.good{background:rgba(63,178,127,.14)} td.mid{background:rgba(208,161,58,.14)} td.bad{background:rgba(212,87,78,.16)}
  .note{font-size:13px;color:var(--dim);margin:0 0 12px;border-left:2px solid var(--accent);padding-left:10px}
  .facts{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:0 0 12px}
  .facts div{background:#1d2025;border-radius:6px;padding:6px}
  .facts dt{font-size:10px;color:var(--dim);text-transform:uppercase;letter-spacing:.04em}
  .facts dd{margin:2px 0 0;font-size:13px;font-variant-numeric:tabular-nums}
  .gaps{margin-bottom:12px}
  .gaps summary{cursor:pointer;font-size:12.5px;color:var(--dim)}
  .gaps ul{margin:8px 0 0;padding-left:18px;font-size:12.5px;color:var(--dim)}
  .actions{display:flex;flex-wrap:wrap;gap:6px}
  .btn{display:inline-block;padding:6px 11px;border-radius:6px;border:1px solid var(--line);
       background:#22262c;color:var(--ink);text-decoration:none;font-size:12px}
  .btn:hover{border-color:var(--accent)}
  .btn--primary{background:var(--accent);border-color:var(--accent);color:#0e0f11;font-weight:600}
  .btn--ghost{background:transparent;color:var(--dim)}
  table{width:100%;border-collapse:collapse;background:var(--panel);
        border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:13.5px}
  th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--line)}
  thead th{background:#1d2025;font-size:11.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--dim)}
  tbody th{color:var(--dim);font-weight:500}
  td{text-align:center;font-variant-numeric:tabular-nums}
  table.defects td{text-align:left}
  tr.totals td,tr.totals th{font-weight:700;border-top:2px solid var(--line)}
  .detail{color:var(--dim);font-size:12px;margin-top:3px}
  .pill{display:inline-block;background:#22262c;border-radius:4px;padding:1px 6px;font-size:11px;color:var(--dim)}
  .scope{font-size:11px;padding:2px 8px;border-radius:99px;white-space:nowrap}
  .scope--platform-wide{background:rgba(212,87,78,.18);color:#e88b84}
  .scope--industry-specific{background:rgba(208,161,58,.18);color:#e0bc6a}
  .scope--business-specific{background:rgba(154,162,173,.18);color:var(--dim)}
  .status{font-size:11px;padding:2px 8px;border-radius:99px;white-space:nowrap}
  .status--fixed{background:rgba(63,178,127,.18);color:#6fd3a6}
  .status--open{background:rgba(212,87,78,.18);color:#e88b84}
  .status--upstream{background:rgba(111,143,212,.18);color:#9db4e8}
  .compare .card{padding:12px}
  .compare .grid{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
  .compare .shot img{max-height:520px;object-fit:cover}
</style></head>
<body>
<header class="top">
  <h1>BusinessForge — Cross-Industry Review</h1>
  <p class="sub">${rows.length} businesses · full pipeline from one Google Maps URL each · generated ${new Date().toISOString().slice(0, 10)} · sorted best to worst</p>
</header>
<main>
  <h2 class="section">Scorecards</h2>
  <div class="grid">${cards}</div>

  <h2 class="section">Comparison matrix</h2>
  <table><thead><tr><th>Category</th>${matrixHead}</tr></thead>
  <tbody>${matrixRows}${totalsRow}</tbody></table>

  <h2 class="section">Recurring defects — only issues seen on more than one site count as platform defects</h2>
  <table class="defects"><thead><tr><th>ID</th><th>Defect</th><th>Scope</th><th>Sites</th><th>Status</th></tr></thead>
  <tbody>${defectRows}</tbody></table>

  <h2 class="section">Side-by-side — full pages at the same scale</h2>
  <section class="compare"><div class="grid">
  ${rows
    .map(
      ({ row, slug }) => `<article class="card"><h2 style="font-size:14px;margin:0 0 8px">${escape(String(row.industry))}</h2>
    <a class="shot" href="../${String(row.runId)}/site/index.html" target="_blank">
      <img src="../${String(row.runId)}/shots/desktop.png" alt="${escape(slug)} full page" loading="lazy"></a></article>`,
    )
    .join('')}
  </div></section>
</main>
</body></html>`;

  const target = path.join(REVIEW, 'index.html');
  fs.writeFileSync(target, html, 'utf8');
  process.stdout.write(`${target}\n`);
}

main();
