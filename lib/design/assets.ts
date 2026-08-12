/**
 * Asset choreography — which photographs a page uses, where, and which it must
 * not, decided from the business's character and the rights it can prove.
 *
 * ## Why a layer above `lib/art`
 *
 * `lib/art/direction.ts` already answers the hard per-image questions —
 * deduplication, undersize, subject, gallery curation, sequence placement. What
 * it does not do is decide the *narrative* use of the set as a whole: which one
 * image carries the hero, which is the signature moment a narrative builds to,
 * where the sequence should change framing for contrast, when a page should
 * intentionally show *less*, and which assets are reference-only because their
 * rights are uncertain. That is a choreography decision, and it depends on
 * character and experience mode, not just on the pixels.
 *
 * Deterministic. Same images + same character → same choreography.
 *
 * ## Rights (acceptance criterion G)
 *
 * The system distinguishes an asset it may *use* from one it may only *reference*
 * while a licence is unconfirmed. It infers this deterministically from the host:
 * a photograph re-hosted by a directory or lifted from a social CDN is
 * `reference-only` until a human confirms the licence; it still informs layout
 * (so the prototype is real) but is flagged for replacement. Inventing a
 * photograph is never an option — a missing hero is a real answer.
 */

import {
  dedupeByIdentity,
  dropUndersized,
  subjectOf,
  curateGallery,
  arrangeSequence,
  servedWidth,
  type Subject,
} from '../art/direction.js';

import type { BusinessCharacter } from './character.js';
import type { ExperienceArchitecture } from './experience.js';
import type { ImageAsset } from '../types.js';

export type Orientation = 'portrait' | 'landscape' | 'square';
export type AssetRights = 'usable' | 'reference-only' | 'unknown';
/**
 * What an image is *for*, in the page's composition.
 *
 * `hero` and `signature` are the two anchor images (at most one each).
 * `environment`, `people`, `detail` and `process` are the roles a gallery
 * sequence image earns from what it shows and where it falls in the
 * sequence — see `roleFor` — and they exist so the renderer can give a
 * photograph of the workshop a different treatment than a photograph of a
 * hand at work, instead of pouring every image into one uniform grid cell.
 * `gallery` is the fallback when nothing more specific applies.
 */
export type AssetRole =
  | 'hero' | 'signature' | 'environment' | 'people' | 'detail' | 'process' | 'gallery'
  | 'support' | 'reference-only' | 'unused';

/**
 * The aspect ratio a role composes best at.
 *
 * Not a crop choice — `ImageStrategy.galleryCrop` still owns that as a page
 * default. This is the *deviation* a specific image's role earns from that
 * default: a hero or an environment shot wants to breathe wide, a hand at
 * work or a step in a process reads better tall, and a close-up detail wants
 * to be square. `natural` defers to the page default.
 */
export type ImageFraming = 'wide' | 'tall' | 'square' | 'natural';

export interface AssetPlacement {
  readonly localPath: string | null;
  readonly url: string;
  readonly orientation: Orientation;
  readonly subject: Subject;
  readonly rights: AssetRights;
  readonly role: AssetRole;
  readonly framing: ImageFraming;
}

export interface AssetChoreography {
  readonly hero: ImageAsset | null;
  /** The one image a narrative builds to. Distinct from the hero. */
  readonly signature: ImageAsset | null;
  readonly gallerySequence: readonly ImageAsset[];
  /** Indices in `gallerySequence` where framing changes — the visual contrast beats. */
  readonly contrastPoints: readonly number[];
  /** True when the page should intentionally carry little or no photography. */
  readonly reduceImagery: boolean;
  /** Images held back entirely (merchandise, undersized). */
  readonly neverUse: readonly ImageAsset[];
  /** Images used in the prototype but flagged: rights unconfirmed. */
  readonly referenceOnly: readonly ImageAsset[];
  readonly placements: readonly AssetPlacement[];
  readonly rationale: string;
  readonly evidence: readonly string[];
  readonly notes: readonly string[];
}

/* Hosts whose images are the business's own social/directory posts — usable as
 * prototype placeholders, but rights-unconfirmed until a human says so. */
const REFERENCE_HOSTS = [
  'facebook', 'fbcdn', 'instagram', 'cdninstagram', 'honeypot', 'restaurantguru',
  'weddingo', 'googleusercontent', 'tiktokcdn', 'ggpht', 'yelpcdn', 'tripadvisor',
];

function hostOf(u: string): string {
  try { return new URL(u).host.toLowerCase(); } catch { return ''; }
}

function rightsOf(image: ImageAsset): AssetRights {
  const host = `${hostOf(image.url)} ${hostOf(image.sourceUrl)}`;
  if (REFERENCE_HOSTS.some((h) => host.includes(h))) return 'reference-only';
  // A local path with no third-party host is treated as usable; an unknown
  // remote host stays `unknown` rather than being claimed as licensed.
  return image.localPath !== null && host.trim() === '' ? 'usable' : 'unknown';
}

function orientationOf(image: ImageAsset): Orientation {
  if (image.width == null || image.height == null || image.height === 0) return 'landscape';
  const r = image.width / image.height;
  return r > 1.15 ? 'landscape' : r < 0.87 ? 'portrait' : 'square';
}

/**
 * What one image is for, from its subject and its place in the sequence.
 *
 * Deliberately built from evidence already computed elsewhere — `subjectOf`
 * (from the image's own alt text and path) and the sequence's own contrast
 * beats — rather than from any name or category the business carries.
 * `scene` (the subject vocabulary's catch-all) resolves on shape and rhythm:
 * a portrait crop reads as a close look at one thing (`detail`); a landscape
 * frame that lands on a contrast beat reads as a change of movement — the
 * documentary "here is a step" shot (`process`); anything else is the plain
 * gallery fallback.
 */
function roleFor(
  image: ImageAsset,
  ctx: { isHero: boolean; isSignature: boolean; orientation: Orientation; position: number; contrastAt: ReadonlySet<number> },
): AssetRole {
  if (ctx.isHero) return 'hero';
  if (ctx.isSignature) return 'signature';

  const subject = subjectOf(image);
  if (subject === 'people') return 'people';
  if (subject === 'venue') return 'environment';
  if (ctx.orientation === 'portrait') return 'detail';
  if (ctx.position >= 0 && ctx.contrastAt.has(ctx.position)) return 'process';
  return 'gallery';
}

/** The aspect a role composes best at. See `ImageFraming`. */
function framingFor(role: AssetRole, orientation: Orientation): ImageFraming {
  switch (role) {
    case 'hero':
    case 'signature':
    case 'environment':
      return 'wide';
    case 'process':
      return 'tall';
    case 'detail':
      return 'square';
    case 'people':
      return orientation === 'landscape' ? 'natural' : 'tall';
    case 'gallery':
      return orientation === 'portrait' ? 'tall' : orientation === 'square' ? 'square' : 'natural';
    case 'support':
    case 'reference-only':
    case 'unused':
      return 'natural';
  }
}

function usable(profile: { images: { hero: ImageAsset | null; gallery: readonly ImageAsset[] } }): readonly ImageAsset[] {
  const all: ImageAsset[] = [];
  if (profile.images.hero) all.push(profile.images.hero);
  all.push(...profile.images.gallery);
  return all.filter((i) => i.role !== 'logo' && i.role !== 'favicon');
}

/**
 * Choreographs the asset set.
 *
 * The order mirrors the questions the master prompt asks: curate → hero →
 * signature → sequence → contrast → restraint → rights.
 */
export function choreographAssets(
  images: readonly ImageAsset[],
  character: BusinessCharacter,
  experience: ExperienceArchitecture,
): AssetChoreography {
  const notes: string[] = [];
  const evidence: string[] = [`in:${images.length}`, `mode:${experience.mode}`, `weight:${character.visualWeight}`];

  // 1) Curate: drop republished duplicates, undersized, and merchandise.
  const curation = curateGallery(images);
  notes.push(...curation.notes);
  const pool = [...curation.chosen, ...curation.rest];

  const distinct = dedupeByIdentity(images);
  const sized = dropUndersized(distinct);
  const neverUse = distinct.filter((i) => !sized.kept.includes(i));
  const merchandise = sized.kept.filter((i) => subjectOf(i) === 'merchandise');
  const neverUseAll = [...neverUse, ...merchandise];

  // 6) Reduce imagery: a text-led or functional page shows little on purpose.
  const reduceImagery = character.visualWeight === 'text-led'
    || (experience.mode === 'brochure' && pool.length < 3);
  if (reduceImagery) notes.push('Imagery intentionally reduced: the evidence is text-led or thin, so the page argues in words, not pictures.');

  // 1) Hero: the strongest non-story image that shows the business, landscape
  // preferred (a hero is a wide frame). Falls back to the best available.
  const heroPreferred = pool
    .filter((i) => subjectOf(i) !== 'merchandise')
    .sort((a, b) => (servedWidth(b) ?? 0) - (servedWidth(a) ?? 0));
  const hero = heroPreferred.find((i) => orientationOf(i) === 'landscape') ?? heroPreferred[0] ?? null;

  // 2) Signature: the moment a narrative/showcase builds to — the strongest
  // remaining image distinct from the hero. Null for a brochure.
  const signature = (experience.mode === 'narrative' || experience.mode === 'showcase')
    ? heroPreferred.find((i) => i !== hero) ?? null
    : null;

  // 3) Gallery sequence: curated + arranged so the loud cells hold the strongest.
  const gallerySequence = reduceImagery ? [] : arrangeSequence(curation.chosen);

  // 4) Contrast points: where framing changes across the sequence — the beats a
  // reader feels as a new movement rather than more of the same.
  const contrastPoints: number[] = [];
  for (let i = 1; i < gallerySequence.length; i += 1) {
    if (orientationOf(gallerySequence[i]!) !== orientationOf(gallerySequence[i - 1]!)) contrastPoints.push(i);
  }

  // 7) Rights: flag the reference-only assets that inform the prototype but need
  // a licence before production.
  const used = [...(hero ? [hero] : []), ...(signature ? [signature] : []), ...gallerySequence];
  const usedDistinct = dedupeByIdentity(used);
  const referenceOnly = usedDistinct.filter((i) => rightsOf(i) === 'reference-only');
  if (referenceOnly.length > 0) {
    notes.push(`${referenceOnly.length} image${referenceOnly.length === 1 ? '' : 's'} are reference-only (rights unconfirmed) — usable as prototype placeholders, flagged for replacement.`);
  }

  const contrastAt = new Set(contrastPoints);
  const placements: AssetPlacement[] = usedDistinct.map((i) => {
    const orientation = orientationOf(i);
    const position = gallerySequence.indexOf(i);
    const role = roleFor(i, { isHero: i === hero, isSignature: i === signature, orientation, position, contrastAt });
    return {
      localPath: i.localPath,
      url: i.url,
      orientation,
      subject: subjectOf(i),
      rights: rightsOf(i),
      role,
      framing: framingFor(role, orientation),
    };
  });

  const rationale = reduceImagery
    ? `Restraint: a ${character.visualWeight} ${experience.mode} page carries minimal imagery on purpose.`
    : `${gallerySequence.length}-image sequence with ${contrastPoints.length} contrast beat${contrastPoints.length === 1 ? '' : 's'}; `
      + `hero ${hero ? 'chosen' : 'absent'}, signature ${signature ? 'chosen' : 'none'}, ${referenceOnly.length} reference-only.`;

  return {
    hero, signature, gallerySequence, contrastPoints, reduceImagery,
    neverUse: neverUseAll, referenceOnly, placements, rationale, evidence, notes,
  };
}
