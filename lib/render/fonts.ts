/**
 * Web fonts, without a web request.
 *
 * The theme library names eighteen typefaces. Until now none of them reached a
 * page: the stylesheet emitted `"Playfair Display", Georgia, serif` and every
 * visitor without Playfair installed — which is every visitor — read Georgia.
 * Eleven directions with distinct type systems rendered in two faces, and that
 * is the single largest reason two generated sites looked like one template.
 *
 * The fix keeps the property that mattered. `scripts/vendor-fonts.ts` pulls the
 * latin subset once, at author time, into `assets/fonts/`; this module emits an
 * `@font-face` per face the design actually uses, pointing at a sibling file the
 * writer copies next to the stylesheet. A rendered site is still a folder that
 * opens from disk and still makes no external request — the network call moved
 * from the visitor to the build.
 *
 * Only the faces one design needs are declared. A page on `luxury` ships
 * Cormorant Garamond and Jost and nothing else, so the cost is the two families
 * on screen rather than the library behind them.
 */

import { VENDORED_FACES } from './fontManifest.js';

import type { WebsiteDesign } from '../design/types.js';

/** A face the page needs, resolved to the file that carries it. */
export interface FontAsset {
  /** File name inside the vendored font directory. */
  readonly file: string;
  /** Where the page expects it, relative to the site root. */
  readonly path: string;
}

/**
 * `Playfair Display` → the faces vendored for it.
 *
 * Built once at module load. Lookup is by exact family name, which is what the
 * theme declares and what the vendor script slugified from — a family with no
 * vendored face simply yields nothing and the stack's fallback carries the page,
 * which is the pre-existing behaviour rather than a broken one.
 */
const BY_FAMILY = ((): ReadonlyMap<string, readonly { weight: number; file: string }[]> => {
  const map = new Map<string, { weight: number; file: string }[]>();
  for (const face of VENDORED_FACES) {
    const list = map.get(face.family) ?? [];
    list.push({ weight: face.weight, file: face.file });
    map.set(face.family, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.weight - b.weight);
  return map;
})();

/**
 * The weights a design will actually set, per family.
 *
 * `FontRole.weights` is what the theme declared, but the type scale also reaches
 * for `Math.max(...weights)` at display sizes and the stylesheet asks for
 * `--weight-heading-min`. Every declared weight is therefore shipped rather than
 * only the ones a particular step names — synthesising a missing bold is what
 * makes a heading look smeared, and the saving is one file.
 */
function familiesOf(design: WebsiteDesign): ReadonlyMap<string, ReadonlySet<number>> {
  const { heading, body, mono } = design.tokens.typography;
  const wanted = new Map<string, Set<number>>();

  for (const role of [heading, body, mono]) {
    if (role === null) continue;
    const set = wanted.get(role.family) ?? new Set<number>();
    for (const weight of role.weights) set.add(weight);
    wanted.set(role.family, set);
  }
  return wanted;
}

/**
 * The faces this design needs, as files to place beside the stylesheet.
 *
 * Sorted by file name so the asset list — and therefore the write order and any
 * snapshot of it — does not depend on the order the type system happened to
 * declare its roles in.
 */
export function fontAssets(design: WebsiteDesign, assetDirName: string): readonly FontAsset[] {
  const out: FontAsset[] = [];

  for (const [family, weights] of familiesOf(design)) {
    for (const face of BY_FAMILY.get(family) ?? []) {
      if (!weights.has(face.weight)) continue;
      out.push({ file: face.file, path: `${assetDirName}/fonts/${face.file}` });
    }
  }

  return out.sort((a, b) => a.file.localeCompare(b.file));
}

/**
 * The `@font-face` block.
 *
 * `font-display: swap` on purpose: the fallback stack is a real stack chosen for
 * the same character class, so a visitor reads the page immediately in Georgia
 * and it resolves to Cormorant a moment later. `block` would give them a blank
 * heading instead, which is a worse trade on a page whose whole job is to be
 * read at a glance.
 *
 * The family name is quoted and the file name comes from a generated manifest,
 * so neither can carry a `)` or a `;` out of this template.
 */
export function fontFaceRules(design: WebsiteDesign, assetDirName: string): string {
  const blocks: string[] = [];

  for (const asset of fontAssets(design, assetDirName)) {
    const face = VENDORED_FACES.find((entry) => entry.file === asset.file);
    if (face === undefined) continue;

    blocks.push(`@font-face {
  font-family: "${face.family}";
  font-style: normal;
  font-weight: ${face.weight};
  font-display: swap;
  src: url("${asset.path}") format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}`);
  }

  if (blocks.length === 0) return '';

  return `/* ------------------------------------------------------------------ */
/* Typefaces — vendored, latin subset, served from beside this file      */
/* ------------------------------------------------------------------ */

${blocks.join('\n\n')}
`;
}
