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
export type AssetRole = 'hero' | 'signature' | 'gallery' | 'detail' | 'support' | 'reference-only' | 'unused';

export interface AssetPlacement {
  readonly localPath: string | null;
  readonly url: string;
  readonly orientation: Orientation;
  readonly subject: Subject;
  readonly rights: AssetRights;
  readonly role: AssetRole;
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

  const placements: AssetPlacement[] = usedDistinct.map((i) => ({
    localPath: i.localPath,
    url: i.url,
    orientation: orientationOf(i),
    subject: subjectOf(i),
    rights: rightsOf(i),
    role: i === hero ? 'hero' : i === signature ? 'signature' : orientationOf(i) === 'portrait' ? 'detail' : 'gallery',
  }));

  const rationale = reduceImagery
    ? `Restraint: a ${character.visualWeight} ${experience.mode} page carries minimal imagery on purpose.`
    : `${gallerySequence.length}-image sequence with ${contrastPoints.length} contrast beat${contrastPoints.length === 1 ? '' : 's'}; `
      + `hero ${hero ? 'chosen' : 'absent'}, signature ${signature ? 'chosen' : 'none'}, ${referenceOnly.length} reference-only.`;

  return {
    hero, signature, gallerySequence, contrastPoints, reduceImagery,
    neverUse: neverUseAll, referenceOnly, placements, rationale, evidence, notes,
  };
}
