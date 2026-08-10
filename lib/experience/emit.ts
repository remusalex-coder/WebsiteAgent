/**
 * Writes the experience to disk as a folder that opens from a file:// URL.
 *
 * No bundler, no CDN, no runtime dependency: one HTML file, one stylesheet, one
 * script, the woff2 faces the page actually sets, and the photographs. The
 * WebGL is a hundred lines of GLSL in a string rather than a megabyte of
 * library, which is the whole reason the page still loads fast enough to feel
 * expensive.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { FRAGMENT_SHADER, VERTEX_SHADER } from './shader.js';
import { RUNTIME_JS } from './runtime.js';
import { STYLES } from './styles.js';
import { VENDORED_FACES } from '../render/fontManifest.js';

import type { Experience, Plate, Scene } from './types.js';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Typographic polish the copy deserves and a keyboard cannot type. */
const smart = (s: string): string =>
  s.replace(/(\w)'(\w)/g, '$1’$2').replace(/ - /g, ' — ');

const ARROW =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
  + 'aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function plateHtml(p: Plate, eager: boolean): string {
  const decorative = p.alt === '';
  return `<figure class="plate ${p.crop}">`
    + `<img src="${esc(p.src)}" alt="${esc(p.alt)}"`
    + `${decorative ? ' role="presentation"' : ''}`
    + ` loading="${eager ? 'eager' : 'lazy'}" decoding="async"`
    + `${eager ? ' fetchpriority="high"' : ''}>`
    + `</figure>`;
}

function copyHtml(scene: Scene): string {
  let out = '';
  if (scene.kicker !== undefined) {
    out += `<p class="kicker">${esc(smart(scene.kicker))}</p>`;
  }
  if (scene.display !== undefined) {
    out += `<h2 class="display" data-split>${esc(scene.display)}</h2>`;
  }
  if (scene.body !== undefined && scene.body.length > 0) {
    out += `<div class="body-copy">`
      + scene.body.map((p) => `<p>${esc(smart(p))}</p>`).join('')
      + `</div>`;
  }
  return out;
}

function logHtml(scene: Scene): string {
  if (scene.log === undefined || scene.log.length === 0) return '';
  return `<ul class="log">`
    + scene.log.map((l) =>
      `<li><span class="k">${esc(l.key)}</span><span>${esc(smart(l.value))}</span></li>`).join('')
    + `</ul>`;
}

function thresholdCard(x: Experience): string {
  const p = x.practical;
  const rows: string[] = [];

  rows.push(`<dt>Where</dt><dd>${esc(p.street)}<br>${esc(p.city)}</dd>`);

  if (p.hours.length > 0) {
    rows.push(`<dt>Hours</dt><dd>`
      + p.hours.map((h) => `${esc(h.day)} &nbsp;${esc(h.range)}`).join('<br>')
      + `</dd>`);
  }
  if (p.phoneDisplay !== '') {
    rows.push(`<dt>Call</dt><dd><a href="${esc(p.phoneHref)}">${esc(p.phoneDisplay)}</a></dd>`);
  }
  if (p.email !== '') {
    rows.push(`<dt>Write</dt><dd><a href="mailto:${esc(p.email)}">${esc(p.email)}</a></dd>`);
  }
  if (p.rating !== null) {
    rows.push(`<dt>Rated</dt><dd>${p.rating.toFixed(1)} on Google</dd>`);
  }

  const plate = (x.scenes.find((s) => s.kind === 'threshold')?.plates ?? [])[0];

  return `<div class="card">`
    + (plate !== undefined ? plateHtml(plate, false) : '')
    + `<dl>${rows.join('')}</dl>`
    + (p.hoursCaveat !== null ? `<p class="caveat">${esc(p.hoursCaveat)}</p>` : '')
    + `<div class="actions">`
    + `<a class="action primary" data-magnet href="${esc(p.mapHref)}" `
    + `target="_blank" rel="noopener">Get directions ${ARROW}</a>`
    + (p.website !== ''
      ? `<a class="action" data-magnet href="${esc(p.website)}" target="_blank" `
        + `rel="noopener">Order &amp; full hours ${ARROW}</a>`
      : '')
    + `</div>`
    + `</div>`;
}

function sceneHtml(scene: Scene, x: Experience, index: number): string {
  const plates = scene.plates ?? [];
  const eager = index === 0;
  let inner = '';

  switch (scene.kind) {
    case 'immersion':
      if (scene.id === 'oven') {
        inner = `<div class="col">${
          scene.kicker !== undefined ? `<p class="kicker">${esc(smart(scene.kicker))}</p>` : ''
        }<h2 class="display" data-split>${esc(scene.display ?? '')}</h2>`
          + `<div class="lower">`
          + (scene.body !== undefined
            ? `<div class="body-copy">${scene.body.map((p) => `<p>${esc(smart(p))}</p>`).join('')}</div>`
            : '')
          + logHtml(scene)
          + `</div></div>`;
      } else {
        inner = `<div class="col">${copyHtml(scene)}</div>`;
      }
      break;

    case 'triptych': {
      const lead = plates[0];
      inner = `<div class="col">${copyHtml(scene)}${logHtml(scene)}</div>`
        + (lead !== undefined
          ? `<div class="aside">${plateHtml(lead, eager)}</div>` : '');
      break;
    }

    case 'sustain':
      inner = `<div class="col">${copyHtml(scene)}</div>`
        + `<div class="aside">${logHtml(scene)}</div>`;
      break;

    case 'plate': {
      const lead = plates[0];
      inner = (lead !== undefined ? plateHtml(lead, false) : '')
        + `<div class="col">${copyHtml(scene)}</div>`;
      break;
    }

    case 'reel':
      inner = `<div class="col">${copyHtml(scene)}</div>`
        + `<div class="reel-wrap"><div class="reel" data-reel>`
        + plates.map((p) => plateHtml(p, false)).join('')
        + `</div></div>`;
      break;

    case 'daybreak':
      inner = `<div class="col">${copyHtml(scene)}${logHtml(scene)}</div>`
        + `<div class="aside">${plates.map((p) => plateHtml(p, false)).join('')}</div>`;
      break;

    case 'threshold':
      inner = `<div class="col">${copyHtml(scene)}</div>`
        + `<div class="aside">${thresholdCard(x)}</div>`;
      break;

    case 'coda': {
      const p = x.practical;
      const links = [
        ...p.social.map((s) => `<a href="${esc(s.href)}" target="_blank" rel="noopener">${esc(s.label)}</a>`),
        p.website !== '' ? `<a href="${esc(p.website)}" target="_blank" rel="noopener">Official site</a>` : '',
      ].filter(Boolean).join(' &nbsp;/&nbsp; ');
      inner = `<div class="col">${copyHtml(scene)}</div>`
        + `<div class="colophon">`
        + `<p class="mark">Rise each day.<br>Warm every table.</p>`
        + `<p class="fine">${esc(p.name)} &nbsp;·&nbsp; ${esc(p.street)}, ${esc(p.city)}<br>`
        + `${links}</p>`
        + `</div>`;
      break;
    }

    case 'silence':
      inner = `<div class="col">${copyHtml(scene)}${logHtml(scene)}</div>`;
      break;
  }

  return `<section class="scene k-${scene.kind}" id="scene-${scene.id}" `
    + `style="min-height:${scene.beats * 100}svh">`
    + `<div class="stage">${inner}</div></section>`;
}

/** Only the faces the page sets — three families, four files. */
function fontCss(x: Experience): { css: string; files: string[] } {
  const wanted = new Set(x.fontFamilies);
  const faces = VENDORED_FACES.filter((f) => wanted.has(f.family))
    .filter((f) =>
      (f.family === 'Cormorant Garamond' && f.weight === 300)
      || (f.family === 'Archivo' && (f.weight === 400 || f.weight === 900))
      || (f.family === 'IBM Plex Mono' && f.weight === 400));

  const css = faces.map((f) =>
    `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};`
    + `font-display:swap;src:url('assets/fonts/${f.file}') format('woff2');}`).join('\n');

  return { css, files: faces.map((f) => f.file) };
}

function jsonLd(x: Experience): string {
  const p = x.practical;
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    name: p.name,
    address: {
      '@type': 'PostalAddress',
      streetAddress: p.street,
      addressLocality: p.city.split(',')[0]?.trim(),
      addressRegion: p.city.split(',')[1]?.trim(),
    },
    url: p.website,
  };
  if (p.phoneDisplay !== '') data['telephone'] = p.phoneHref.replace('tel:', '');
  if (p.email !== '') data['email'] = p.email;
  if (p.rating !== null) {
    data['aggregateRating'] = {
      '@type': 'AggregateRating', ratingValue: p.rating, bestRating: 5,
    };
  }
  if (p.social.length > 0) data['sameAs'] = p.social.map((s) => s.href);
  return JSON.stringify(data);
}

export interface EmitOptions {
  readonly experience: Experience;
  /** Directory the site is written to. Created if absent. */
  readonly outDir: string;
  /** Directory holding the already-downloaded photographs. */
  readonly assetSourceDir: string;
  /** Repository root, for the vendored fonts. */
  readonly repoRoot: string;
}

export async function emit(options: EmitOptions): Promise<{ bytes: number }> {
  const { experience: x, outDir, assetSourceDir, repoRoot } = options;

  await fs.mkdir(path.join(outDir, 'assets', 'fonts'), { recursive: true });

  // Photographs.
  for (const rel of x.assets) {
    const file = path.basename(rel);
    const from = path.join(assetSourceDir, file);
    try {
      await fs.copyFile(from, path.join(outDir, 'assets', file));
    } catch {
      // A missing photograph is survivable — the scene composes without it —
      // but it must not be silent.
      console.warn(`  ! missing asset: ${file}`);
    }
  }

  const { css: faceCss, files: faceFiles } = fontCss(x);
  for (const file of faceFiles) {
    await fs.copyFile(
      path.join(repoRoot, 'assets', 'fonts', file),
      path.join(outDir, 'assets', 'fonts', file),
    );
  }

  // The runtime only needs the parts of each scene that drive the timeline.
  const timeline = x.scenes.map((s) => ({
    id: s.id, clock: s.clock, marker: s.marker, ground: s.ground, dough: s.dough,
    veil: s.veil ?? null,
  }));

  const p = x.practical;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(x.title)}</title>
<meta name="description" content="${esc(x.metaDescription)}">
<meta name="theme-color" content="#080A10">
<meta property="og:title" content="${esc(x.title)}">
<meta property="og:description" content="${esc(x.metaDescription)}">
<meta property="og:type" content="website">
<link rel="preload" href="assets/fonts/${faceFiles[0] ?? ''}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="styles.css">
<script type="application/ld+json">${jsonLd(x)}</script>
</head>
<body>
<a class="skip" href="#scene-threshold">Skip to visitor information</a>

<div id="curtain">
  <div>
    <p class="curtain-mark">Proof</p>
    <p class="curtain-sub">${esc(p.name)} &nbsp;·&nbsp; ${esc(p.street)}</p>
    <div class="curtain-bar"><i></i></div>
  </div>
</div>

<canvas id="proof-gl" aria-hidden="true"></canvas>
<div class="gl-fallback" aria-hidden="true"></div>
<div id="veil" aria-hidden="true"></div>

<header class="hud hud-brand">
  ${x.logoSrc !== null
    ? `<img src="${esc(x.logoSrc)}" alt="${esc(p.name)}" width="133" height="20">`
    : `<span>${esc(p.name)}</span>`}
</header>

<div class="hud hud-clock" aria-hidden="true">
  <b data-clock>22:00</b><span data-marker>levain</span>
</div>
<div class="hud hud-rail" aria-hidden="true"><i></i></div>
<div class="hud hud-scroll" aria-hidden="true">Scroll — the night begins</div>

<main>
<h1 class="sr-only">${esc(p.name)} — ${esc(p.street)}, ${esc(p.city)}. One night of baking.</h1>
${x.scenes.map((s, i) => sceneHtml(s, x, i)).join('\n')}
</main>

<script>
window.__PROOF__ = {
  scenes: ${JSON.stringify(timeline)},
  vs: ${JSON.stringify(VERTEX_SHADER)},
  fs: ${JSON.stringify(FRAGMENT_SHADER)}
};
</script>
<script src="proof.js" defer></script>
</body>
</html>
`;

  await fs.writeFile(path.join(outDir, 'index.html'), html, 'utf8');
  await fs.writeFile(path.join(outDir, 'styles.css'), faceCss + '\n' + STYLES, 'utf8');
  await fs.writeFile(path.join(outDir, 'proof.js'), RUNTIME_JS, 'utf8');

  let bytes = 0;
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else bytes += (await fs.stat(full)).size;
    }
  };
  await walk(outDir);

  return { bytes };
}
