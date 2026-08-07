/**
 * The renderer's public surface.
 *
 * `WebsiteContent` in, a complete static site out — semantic HTML5, one
 * stylesheet, and a list of assets to place. Deterministic: the same spec
 * always produces the same bytes.
 *
 * Callers import from here and nothing deeper, so the module split below stays
 * an implementation detail that can change without a consumer noticing.
 *
 *   const site = renderSite(content);
 *   await writeRenderedSite(site, { sourceDir: runDir, targetDir: siteDir });
 */

export { renderSite } from './site.js';
export { writeRenderedSite } from './write.js';
export { renderStylesheet } from './css.js';
export { resolveTheme, themeFromDesign } from './theme.js';
export { RENDER_DEFAULTS, resolveOptions } from './types.js';
export { safeHref, safeImageUrl } from './assets.js';

export type { WriteOptions, WriteResult } from './write.js';
export type { Theme, ThemeColors, ThemeFonts, ThemeResult } from './theme.js';
export type {
  RenderOptions,
  RenderedAsset,
  RenderedFile,
  RenderedSite,
  ResolvedRenderOptions,
} from './types.js';
