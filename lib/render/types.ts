/**
 * The renderer's contract.
 *
 * `renderSite` is a pure function: `WebsiteContent` in, an in-memory site out.
 * It never touches the filesystem, so it is trivially testable and a caller
 * decides where the bytes go — `writeRenderedSite` for a folder on disk, or a
 * deployment stage that uploads the same array without a file ever existing.
 */

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
}

/** Options with every default applied. What the internals actually work with. */
export interface ResolvedRenderOptions {
  readonly lang: string;
  readonly assetDirName: string;
  readonly htmlFileName: string;
  readonly cssFileName: string;
}

export const RENDER_DEFAULTS: ResolvedRenderOptions = {
  lang: 'en',
  assetDirName: 'assets',
  htmlFileName: 'index.html',
  cssFileName: 'styles.css',
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

export function resolveOptions(options: RenderOptions = {}): ResolvedRenderOptions {
  return {
    lang: options.lang?.trim() || RENDER_DEFAULTS.lang,
    assetDirName: safeName(options.assetDirName ?? '', RENDER_DEFAULTS.assetDirName),
    htmlFileName: safeName(options.htmlFileName ?? '', RENDER_DEFAULTS.htmlFileName),
    cssFileName: safeName(options.cssFileName ?? '', RENDER_DEFAULTS.cssFileName),
  };
}
