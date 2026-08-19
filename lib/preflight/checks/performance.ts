/**
 * Performance: what the rendered bytes and the asset plan imply about load
 * time, independent of any host — this is a static site, so almost
 * everything measurable here is measurable before deployment exists.
 */

import { check, countMatches } from '../helpers.js';
import type { CheckFn } from '../types.js';

const imageLoadingStrategy: CheckFn = (ctx) => {
  const c = check('performance.image-loading-strategy', 'performance', 'Lazy-loaded, prioritised images', 'medium');
  const totalImages = countMatches(ctx.html, /<img[\s>]/g);
  if (totalImages === 0) return c.na('the rendered page has no <img> elements');

  const lazy = countMatches(ctx.html, /<img[^>]*loading="lazy"/g);
  const eager = countMatches(ctx.html, /<img[^>]*loading="eager"/g);

  if (eager === 0) {
    return c.warn(
      [`${totalImages} <img> elements, none loaded eagerly`],
      'The lead image (hero) should load eagerly with fetchpriority="high" so it is not delayed behind lazy-loaded images.',
    );
  }
  return c.pass([`${totalImages} <img> elements: ${eager} eager (lead image), ${lazy} lazy`]);
};

/** Hosts a static, deterministic render is allowed to reference. */
const ALLOWED_HOSTS_PATTERN = /^(https?:)?\/\//i;

const noExternalRequests: CheckFn = (ctx) => {
  const c = check('performance.no-external-requests', 'performance', 'No third-party requests', 'high');
  const problems: string[] = [];

  for (const match of ctx.html.matchAll(/<(script|link)\b[^>]*\b(src|href)="([^"]+)"/g)) {
    const [, tag, , url] = match;
    if (tag === 'link' && url === undefined) continue;
    if (ALLOWED_HOSTS_PATTERN.test(url ?? '')) problems.push(`<${tag}> references external URL: ${url}`);
  }
  for (const match of ctx.css.matchAll(/@import\s+url\(([^)]+)\)/g)) {
    problems.push(`stylesheet @import: ${match[1]}`);
  }
  for (const match of ctx.css.matchAll(/url\((['"]?)(https?:)?\/\/([^'")]+)\1\)/g)) {
    if (match[2] !== undefined) problems.push(`stylesheet url() references external host: ${match[3]}`);
  }

  if (problems.length > 0) {
    return c.fail(problems, 'Remove third-party requests — every asset a rendered site needs must ship with it, not be fetched at view time.');
  }
  return c.pass(['no external <script>/<link> references and no external url()/@import in the stylesheet']);
};

const ASSET_BUDGET_WARN_BYTES = 3_000_000;
const ASSET_BUDGET_FAIL_BYTES = 8_000_000;

const assetWeight: CheckFn = (ctx) => {
  const c = check('performance.asset-weight', 'performance', 'Total page asset weight', 'low');
  const known = [
    ctx.profile.images.logo,
    ctx.profile.images.hero,
    ctx.profile.images.favicon,
    ...ctx.profile.images.gallery,
  ].filter((image): image is NonNullable<typeof image> => image !== null && image.bytes !== null);

  if (known.length === 0) {
    return c.na('no asset carries a known byte size (the collector did not measure any, or none are placed)');
  }

  const total = known.reduce((sum, image) => sum + (image.bytes ?? 0), 0);
  const mb = (total / 1_000_000).toFixed(2);

  if (total >= ASSET_BUDGET_FAIL_BYTES) {
    return c.fail([`${known.length} measured assets total ${mb}MB`], 'Compress or drop the heaviest images; a page over 8MB of images will feel broken on mobile networks.');
  }
  if (total >= ASSET_BUDGET_WARN_BYTES) {
    return c.warn([`${known.length} measured assets total ${mb}MB`], 'Consider compressing the largest images; the page is trending heavy.');
  }
  return c.pass([`${known.length} measured assets total ${mb}MB`]);
};

const FONT_FILE_WARN_COUNT = 6;

const fontLoading: CheckFn = (ctx) => {
  const c = check('performance.font-loading', 'performance', 'Font weight budget', 'low');
  if (ctx.site.fonts.length === 0) return c.na('no vendored fonts are declared (system font stack, or no design was applied)');
  if (ctx.site.fonts.length > FONT_FILE_WARN_COUNT) {
    return c.warn(
      [`${ctx.site.fonts.length} font files declared: ${ctx.site.fonts.map((f) => f.file).join(', ')}`],
      `Trim to the weights actually used in the type scale; ${ctx.site.fonts.length} font files is a heavy download for a marketing page.`,
    );
  }
  return c.pass([`${ctx.site.fonts.length} font file(s) declared`]);
};

export const performanceChecks: readonly CheckFn[] = [
  imageLoadingStrategy,
  noExternalRequests,
  assetWeight,
  fontLoading,
];
