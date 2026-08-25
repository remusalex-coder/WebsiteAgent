/**
 * The renderer's contract.
 *
 * `renderSite` is a pure function: `WebsiteContent` in, an in-memory site out.
 * It never touches the filesystem, so it is trivially testable and a caller
 * decides where the bytes go — `writeRenderedSite` for a folder on disk, or a
 * deployment stage that uploads the same array without a file ever existing.
 */

import type { RuntimePrimitiveId } from '../design/experience.js';

export interface RenderedFile {
  /** Site-relative POSIX path, e.g. `index.html`. Never absolute, never `..`. */
  readonly path: string;
  readonly contents: string;
}

/**
 * A binary file the page refers to and the caller must place.
 *
 * The renderer only plans asset placement; it copies nothing, because the
 * bytes live in the run's artifact folder and moving them is the emitter's job.
 */
export interface RenderedAsset {
  /** Where the bytes are now: `ImageAsset.localPath`, relative to the run dir. */
  readonly sourcePath: string;
  /** Where the page expects them, relative to the site root. */
  readonly path: string;
}

/**
 * A typeface the stylesheet declares, to be placed beside it.
 *
 * Separate from `RenderedAsset` because the bytes come from a different place:
 * an asset's source is the run's artifact folder, and a font's is the
 * repository's own vendored set, which the renderer knows by name and the
 * writer knows by path. Collapsing the two would mean the renderer inventing a
 * path into a directory it is not allowed to know exists.
 */
export interface RenderedFont {
  /** File name inside the vendored font directory. */
  readonly file: string;
  /** Where the page expects it, relative to the site root. */
  readonly path: string;
}

export interface RenderedSite {
  /** Text files, `index.html` first. */
  readonly files: readonly RenderedFile[];
  readonly assets: readonly RenderedAsset[];
  /** Typefaces the stylesheet's `@font-face` rules point at. */
  readonly fonts: readonly RenderedFont[];
  /**
   * Everything the renderer had to work around: a colour it could not parse, a
   * link scheme it refused, an image with no usable location.
   *
   * Rendering never throws on bad content — a spec is written by a model, and
   * failing the whole site over one malformed field would be the wrong trade.
   * The problems are reported instead, so they end up in the run log rather
   * than silently in the output.
   */
  readonly warnings: readonly string[];
}

export interface RenderOptions {
  /**
   * The visual system to render under.
   *
   * When supplied, every colour, size and spacing value comes from it and the
   * renderer makes no visual decision of its own. When omitted, the renderer
   * falls back to deriving a minimal theme from `WebsiteContent.voice`, which
   * is what it did before the design layer existed — so an existing caller
   * keeps its exact output.
   */
  readonly design?: import('../design/types.js').WebsiteDesign | undefined;
  /** BCP 47 tag for `<html lang>`. Defaults to `en`. */
  readonly lang?: string | undefined;
  /** Folder assets are placed in, relative to the site root. Defaults to `assets`. */
  readonly assetDirName?: string | undefined;
  /** Defaults to `index.html`. */
  readonly htmlFileName?: string | undefined;
  /** Defaults to `styles.css`. */
  readonly cssFileName?: string | undefined;
  /**
   * Optional generic runtime. `'none'` (default) emits a fully static page —
   * the deterministic floor. `'scroll-progress'` injects the minimal, bread-free
   * runtime that exposes `--forge-scroll` (page progress 0→1) and per-section
   * `--forge-vis` via IntersectionObserver, enabling scroll-driven world
   * crossing and a pinned cinematic hero. Opted in only by character (a
   * narrative image-led business), never a default — see `composeStandalone`.
   */
  readonly runtime?: 'none' | 'scroll-progress' | undefined;
  /**
   * Named Tier-2 runtime primitives to activate, from the closed
   * `RuntimePrimitiveId` vocabulary — e.g. `['scroll-reveal']`.
   *
   * The Experience Signature *declares a name*; it never supplies CSS or JS.
   * `lib/render/runtime-rules.ts`'s `runtimePrimitiveRules` is the one
   * deterministic implementation behind each id. Meaningless (and ignored,
   * per `resolveOptions` below) unless `runtime: 'scroll-progress'` is also
   * set — a primitive that reads `--forge-vis` cannot do anything on a page
   * where nothing ever writes it. Defaults to empty, which is what keeps
   * this genuinely additive: a caller that never sets it — every existing
   * caller, today — gets not one new byte in its output.
   */
  readonly runtimePrimitives?: readonly RuntimePrimitiveId[] | undefined;
  /**
   * The site's own absolute base URL (e.g. `https://example.com`), once
   * known — never the Maps listing's `canonicalUrl` (`DiscoveryInput`, a
   * different field entirely: the source the business was found at, not the
   * destination this render will live at). A generated site has no URL of
   * its own until it is actually deployed, which is a later, separate stage
   * (`lovableAgent`) this renderer has no visibility into — so `undefined`
   * (every caller before this option existed, and any caller rendering
   * before deployment) emits none of the URL-dependent SEO files below.
   * When present, adds `<link rel="canonical">`, `sitemap.xml` and
   * `robots.txt` — all three, together, since a `robots.txt` pointing at a
   * sitemap that was never emitted (or vice versa) is a worse signal than
   * neither existing.
   */
  readonly siteUrl?: string | undefined;
  /**
   * The business's real, already-collected coordinates
   * (`BusinessProfile.coordinates`, `lib/types.ts`) — never invented, never
   * geocoded from an address string here. When present, the `location`
   * section (if the content has one) renders a real OpenStreetMap embed
   * alongside its existing address text, through the origin-allow-listed
   * iframe seam `lib/qa/gates/technical.ts`'s `APPROVED_IFRAME_ORIGINS`
   * added for exactly this. Absent (every caller before this option
   * existed) renders the location section exactly as it always has — plain
   * address text, no map, no iframe, no new bytes.
   */
  readonly location?: { readonly lat: number; readonly lng: number } | undefined;
  /**
   * Adds a real, static, submittable enquiry form (`data-netlify="true"`,
   * honeypot spam field, progressively enhanced with a small inline script,
   * degrades to a plain HTML POST with no JS at all) to the contact section,
   * alongside — not replacing — its existing `tel:`/`mailto:` links.
   *
   * Defaults to `false`: WHETHER a Netlify Drop (zip/API) deploy actually
   * triggers Netlify's form-detection post-processing the same way a
   * git-connected build does could not be confirmed against official docs
   * during research (2026-08-25) and there is no live `NETLIFY_DEPLOY_TOKEN`
   * in this environment to test it end-to-end — see `docs/WORK_QUEUE.json`
   * WQ-024. Shipping this on by default, unverified, would risk exactly the
   * "capability that only looks real" defect `lib/forge/functionalModules.ts`
   * was written to avoid: a form a visitor fills in and trusts, whose
   * submission may or may not ever reach anyone. Every caller before this
   * option existed — and every caller until WQ-024's live verification
   * lands — gets not one new byte in its output.
   */
  readonly contactForm?: boolean | undefined;
}

/** Options with every default applied. What the internals actually work with. */
export interface ResolvedRenderOptions {
  readonly lang: string;
  readonly assetDirName: string;
  readonly htmlFileName: string;
  readonly cssFileName: string;
  /** Resolved runtime mode (see `RenderOptions.runtime`). */
  readonly runtime: 'none' | 'scroll-progress';
  /** Resolved Tier-2 primitives — always empty when `runtime === 'none'`. */
  readonly runtimePrimitives: readonly RuntimePrimitiveId[];
  /** See `RenderOptions.siteUrl`. `null` when not supplied — the default, and every caller before this option existed. */
  readonly siteUrl: string | null;
  /** See `RenderOptions.location`. `null` when not supplied. */
  readonly location: { readonly lat: number; readonly lng: number } | null;
  /** See `RenderOptions.contactForm`. `false` when not supplied. */
  readonly contactForm: boolean;
}

export const RENDER_DEFAULTS: ResolvedRenderOptions = {
  lang: 'en',
  assetDirName: 'assets',
  htmlFileName: 'index.html',
  cssFileName: 'styles.css',
  runtime: 'none',
  runtimePrimitives: [],
  siteUrl: null,
  location: null,
  contactForm: false,
};

/**
 * Strips a caller-supplied name down to something that cannot escape the site
 * root. A path is a filename, never a route.
 */
function safeName(value: string, fallback: string): string {
  const cleaned = value
    .trim()
    .replace(/[\\/]+/g, '')
    .replace(/\.\.+/g, '.')
    // A leading dot is what is left of `../`, and also what hides a file.
    .replace(/^\.+/, '');
  return cleaned === '' ? fallback : cleaned;
}

/**
 * Validates and normalises a caller-supplied `siteUrl` — an absolute
 * `http`/`https` origin, trailing slash stripped so every URL built from it
 * (`{siteUrl}/`, `{siteUrl}/sitemap.xml`) joins cleanly. Anything else
 * (relative, malformed, a non-http(s) scheme) degrades to `null` — the same
 * "meaningless, so drop it rather than trust it" rule `runtimePrimitives`
 * already applies to a structurally-inconsistent caller value — never a
 * throw, since a render must never fail over an optional SEO field.
 */
function safeSiteUrl(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Validates a caller-supplied `location`: both coordinates finite and within
 * real-world range. Degrades to `null` rather than throwing or embedding a
 * map at `(NaN, NaN)` — the same "meaningless, so drop it" rule every other
 * field in this function uses.
 */
function safeLocation(
  value: { readonly lat: number; readonly lng: number } | undefined,
): { readonly lat: number; readonly lng: number } | null {
  if (value === undefined) return null;
  const { lat, lng } = value;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function resolveOptions(options: RenderOptions = {}): ResolvedRenderOptions {
  const runtime = options.runtime === 'scroll-progress' ? 'scroll-progress' : 'none';
  return {
    lang: options.lang?.trim() || RENDER_DEFAULTS.lang,
    assetDirName: safeName(options.assetDirName ?? '', RENDER_DEFAULTS.assetDirName),
    htmlFileName: safeName(options.htmlFileName ?? '', RENDER_DEFAULTS.htmlFileName),
    cssFileName: safeName(options.cssFileName ?? '', RENDER_DEFAULTS.cssFileName),
    runtime,
    // Structurally tied to `runtime`: a primitive that reads a signal the
    // base runtime never writes is not "opted out", it is meaningless, so it
    // is dropped here rather than trusted from the caller.
    runtimePrimitives: runtime === 'scroll-progress' ? [...new Set(options.runtimePrimitives ?? [])] : [],
    siteUrl: safeSiteUrl(options.siteUrl),
    location: safeLocation(options.location),
    contactForm: options.contactForm === true,
  };
}
