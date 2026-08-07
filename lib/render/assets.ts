/**
 * URL safety and asset placement.
 *
 * Both halves exist for the same reason: every URL in a `WebsiteContent` was
 * written by a model from data scraped off the open web, so none of it is
 * trusted. A `javascript:` href in a call to action is stored XSS with extra
 * steps, and a `../../` in an asset path writes outside the site root.
 *
 * Nothing here throws. An input that cannot be made safe is dropped and
 * reported, because a missing button is a defect and a live one is a breach.
 */

import type { ImageAsset } from '../types.js';
import type { RenderedAsset } from './types.js';

/** Schemes a link may use. Everything else is refused, including `data:`. */
const ALLOWED_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/** Schemes an image may load from. No `data:` — assets are files, not blobs. */
const ALLOWED_IMAGE_SCHEMES: ReadonlySet<string> = new Set(['http:', 'https:']);

const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/**
 * Removes the characters a browser ignores when it parses a URL.
 *
 * `java\nscript:alert(1)` is a working `javascript:` URL in every browser but
 * defeats a naive prefix check, so the check runs against the stripped form —
 * and the stripped form is what gets written, so the two can never disagree.
 */
function stripIgnored(value: string): string {
  return value.replace(/[\u0000-\u0020\u007f]/g, '');
}

function checkUrl(value: string, allowed: ReadonlySet<string>): string | null {
  const candidate = stripIgnored(value);
  if (candidate === '') return null;

  const match = SCHEME.exec(candidate);
  // No scheme: a fragment, a root-relative path or a document-relative one.
  // Protocol-relative (`//host`) is rejected — it inherits a scheme we did not
  // approve, and a rendered site may well be opened over `file:`.
  if (match === null) return candidate.startsWith('//') ? null : candidate;

  return allowed.has(`${match[1]?.toLowerCase()}:`) ? candidate : null;
}

/** A link target safe to place in an `href`, or `null`. */
export function safeHref(value: string): string | null {
  return checkUrl(value, ALLOWED_SCHEMES);
}

/** An image location safe to place in a `src`, or `null`. */
export function safeImageUrl(value: string): string | null {
  return checkUrl(value, ALLOWED_IMAGE_SCHEMES);
}

export interface ResolvedImage {
  readonly src: string;
  /**
   * Never invented. An image the collector found no alt text for is marked
   * decorative with `alt=""` — which a screen reader skips — rather than
   * described by a renderer that has not seen it.
   */
  readonly alt: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface AssetPlan {
  /**
   * Maps an image onto a site-relative `src`, registering the file to copy.
   *
   * `fallbackAlt` is for the one case where alt text is a fact rather than a
   * guess: the alt of a business's logo is the business's name.
   */
  resolve(asset: ImageAsset, fallbackAlt?: string | null): ResolvedImage | null;
  /** Files to place, in the order they were first referenced. */
  assets(): readonly RenderedAsset[];
  warnings(): readonly string[];
}

/** Last path segment of a POSIX or Windows path. */
function basename(value: string): string {
  const parts = value.split(/[\\/]/);
  return parts[parts.length - 1] ?? '';
}

/** Splits `logo-a1b2.png` into `['logo-a1b2', '.png']`. */
function splitExtension(name: string): readonly [string, string] {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
}

/** Keeps a filename inside the assets folder and free of shell-hostile characters. */
function sanitiseFileName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[.-]+/, '');
  return cleaned === '' ? 'asset' : cleaned.slice(0, 96);
}

/**
 * Creates the asset plan for one render.
 *
 * Placement is by first reference, and a name collision between two different
 * sources is resolved with a counter — so the mapping depends only on the order
 * images appear in the spec, and re-rendering the same spec plans the same
 * files.
 */
export function createAssetPlan(assetDirName: string): AssetPlan {
  /** `localPath` → site-relative path. Dedupes an image used in two sections. */
  const placed = new Map<string, string>();
  /** Site-relative paths already taken, so two `logo.png` files cannot collide. */
  const taken = new Set<string>();
  const collected: RenderedAsset[] = [];
  const warnings: string[] = [];

  function place(localPath: string): string {
    const existing = placed.get(localPath);
    if (existing !== undefined) return existing;

    const name = sanitiseFileName(basename(localPath));
    const [stem, extension] = splitExtension(name);

    let candidate = `${assetDirName}/${name}`;
    for (let counter = 2; taken.has(candidate); counter += 1) {
      candidate = `${assetDirName}/${stem}-${counter}${extension}`;
    }

    placed.set(localPath, candidate);
    taken.add(candidate);
    collected.push({ sourcePath: localPath, path: candidate });
    return candidate;
  }

  return {
    resolve(asset: ImageAsset, fallbackAlt: string | null = null): ResolvedImage | null {
      const alt = asset.alt?.trim() || fallbackAlt?.trim() || '';
      const dimensions = { width: asset.width, height: asset.height };

      // A downloaded copy is always preferred: it is the only form that
      // survives the source site going down or rotating its CDN paths.
      if (asset.localPath !== null && asset.localPath.trim() !== '') {
        const localPath = asset.localPath.trim().replace(/\\/g, '/');
        if (localPath.startsWith('/') || localPath.split('/').includes('..')) {
          warnings.push(`image localPath escapes the run directory and was ignored: "${localPath}"`);
        } else {
          return { src: place(localPath), alt, ...dimensions };
        }
      }

      // Not downloaded — hot-link the original rather than lose the image.
      const remote = safeImageUrl(asset.url);
      if (remote !== null) return { src: remote, alt, ...dimensions };

      warnings.push(`image has no usable location and was omitted: "${asset.url}"`);
      return null;
    },

    assets: () => collected,
    warnings: () => warnings,
  };
}
