/**
 * `renderSite` — the renderer's entry point.
 *
 * A pure function. No clock, no randomness, no filesystem, no network: the same
 * `WebsiteContent` renders to the same bytes on any machine, which is what
 * makes a rendered site diffable and the snapshot tests worth having.
 *
 * The two things that could break that are handled explicitly — the copyright
 * line carries no year, and JSON-LD keys are sorted before serialisation.
 *
 * With a `WebsiteDesign` in hand this function stops deciding anything about
 * the page's shape. `LayoutPlan.order` is the render sequence, each
 * `SectionDesign` is the section's treatment, and `stickyHeader` and
 * `showNavigation` decide the shell. Without one it behaves exactly as it did
 * before the design layer existed.
 */

import { renderDocument } from './document.js';
import { renderSection } from './sections.js';
import { renderStylesheet } from './css.js';
import { resolveTheme, themeFromDesign } from './theme.js';
import { createAssetPlan } from './assets.js';
import { fontAssets } from './fonts.js';
import { slug } from './html.js';
import { resolveOptions } from './types.js';

import type { Html } from './html.js';
import type { NavItem } from './document.js';
import type { SectionKind, WebsiteContent, WebsiteSection } from '../types.js';
import type { LayoutPlan, SectionDesign } from '../design/types.js';
import type { RenderOptions, RenderedFile, RenderedSite } from './types.js';

/**
 * Sections that are not navigation targets.
 *
 * The hero is where the page already starts, and a CTA banner is a destination
 * for a click rather than a place in the outline. Everything else earns an entry.
 */
const UNLISTED: ReadonlySet<SectionKind> = new Set(['hero', 'cta']);

/**
 * Fragment ids for every section, deduplicated.
 *
 * Derived from the heading so a link reads as `#opening-hours` rather than
 * `#section-4`, and falls back to the kind, then to the position — a heading in
 * a script with no ASCII produces an empty slug, and an empty fragment is a
 * broken link rather than an ugly one.
 *
 * Ids are assigned in *written* order, not render order, so reordering a page
 * never renames its anchors.
 *
 * Exported because the writer has to produce in-page links before this file
 * ever sees the spec, and a second implementation of the same rule would drift
 * into links that resolve to nothing.
 */
export function assignIds(sections: readonly WebsiteSection[]): readonly string[] {
  const taken = new Set<string>();

  return sections.map((section, index) => {
    const base = slug(section.heading) || slug(section.kind) || `section-${index + 1}`;

    let id = base;
    for (let counter = 2; taken.has(id); counter += 1) {
      id = `${base}-${counter}`;
    }
    taken.add(id);
    return id;
  });
}

/**
 * The render sequence.
 *
 * `LayoutPlan.order` is authoritative, but it is data that arrived from another
 * layer, so it is validated rather than trusted: an index out of range or
 * repeated is dropped, and any section the plan forgot is appended in written
 * order. A design that omits a section must not delete the writer's copy.
 */
function renderOrder(plan: LayoutPlan | null, count: number): readonly number[] {
  const natural = Array.from({ length: count }, (_unused, index) => index);
  if (plan === null) return natural;

  const seen = new Set<number>();
  const order: number[] = [];

  for (const index of plan.order) {
    if (!Number.isInteger(index) || index < 0 || index >= count || seen.has(index)) continue;
    seen.add(index);
    order.push(index);
  }
  for (const index of natural) {
    if (!seen.has(index)) order.push(index);
  }
  return order;
}

/** Header navigation, in render order. A section with no heading is skipped. */
function buildNav(
  sections: readonly WebsiteSection[],
  ids: readonly string[],
  order: readonly number[],
): readonly NavItem[] {
  const items: NavItem[] = [];

  for (const index of order) {
    const section = sections[index];
    const fragment = ids[index];
    if (section === undefined || fragment === undefined) continue;

    const label = section.heading.trim();
    if (label === '' || UNLISTED.has(section.kind)) continue;
    items.push({ label, fragment });
  }

  return items;
}

/**
 * Renders a spec into an in-memory site.
 *
 * Never throws on content: a malformed colour, a refused link scheme or an
 * image with nowhere to load from all end up in `warnings` with the section
 * rendered around them. The only way to get an exception out of here is to pass
 * something that is not a `WebsiteContent`.
 */
export function renderSite(content: WebsiteContent, options: RenderOptions = {}): RenderedSite {
  const resolved = resolveOptions(options);
  const warnings: string[] = [];
  const warn = (message: string): void => {
    warnings.push(message);
  };

  // A design supersedes `BrandVoice` entirely. Without one the renderer falls
  // back to sanitising the voice, which is what it did before the design layer
  // existed — so an existing caller's output is unchanged to the byte.
  const design = options.design;
  const theme = design === undefined
    ? (() => {
        const resolvedTheme = resolveTheme(content.voice);
        warnings.push(...resolvedTheme.warnings);
        return resolvedTheme.theme;
      })()
    : themeFromDesign(design);

  const assets = createAssetPlan(resolved.assetDirName);
  const ids = assignIds(content.sections);
  const plan = design?.layout ?? null;
  const order = renderOrder(plan, content.sections.length);

  // Plans are keyed by their index into `content.sections`, which is the only
  // stable handle the two layers share — `SectionDesign.index`, not its
  // position in `plan.sections`.
  const plans = new Map<number, SectionDesign>();
  for (const section of plan?.sections ?? []) {
    const target = content.sections[section.index];
    if (target === undefined) continue;
    if (target.kind !== section.kind) {
      warn(`design for section ${section.index} expects a "${section.kind}" but the content has a "${target.kind}"; the design was applied anyway`);
    }
    plans.set(section.index, section);
  }

  // `alternate` counts rendered sections rather than using the raw index, so a
  // hero — which paints its own background — does not consume a stripe and
  // leave the first two content sections looking identical. Only the no-design
  // path uses it; a design says what each section sits on.
  let stripe = 0;
  const rendered: Html[] = order.map((index, position) => {
    const section = content.sections[index];
    if (section === undefined) return '' as Html;

    const alternate = stripe % 2 === 1;
    if (section.kind !== 'hero' && section.kind !== 'cta') stripe += 1;

    return renderSection(section, {
      index: position,
      id: ids[index] ?? `section-${index + 1}`,
      headingId: `${ids[index] ?? `section-${index + 1}`}-heading`,
      alternate,
      tagline: position === 0 && section.kind === 'hero' ? content.tagline : null,
      assets,
      warn,
      plan: plans.get(index) ?? null,
      hero: plan?.hero ?? null,
      design: design ?? null,
    });
  });

  const nav = buildNav(content.sections, ids, order);

  const html = renderDocument({
    content,
    sections: rendered,
    // A design that suppresses navigation suppresses it in the markup, not with
    // `display: none` — a hidden list is still read out and still tabbed into.
    nav: plan !== null && !plan.showNavigation ? [] : nav,
    options: resolved,
    assets,
    themeColor: theme.colors.primary,
    design: design ?? null,
    warn,
  });

  const files: readonly RenderedFile[] = [
    { path: resolved.htmlFileName, contents: html },
    { path: resolved.cssFileName, contents: renderStylesheet(theme, resolved.assetDirName) },
  ];

  return {
    files,
    assets: assets.assets(),
    fonts: design === undefined ? [] : fontAssets(design, resolved.assetDirName),
    // Asset warnings are collected last: the plan only knows what it was asked
    // for once every section and the shell have been rendered.
    warnings: [...warnings, ...assets.warnings()],
  };
}
