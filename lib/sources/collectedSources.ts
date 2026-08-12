/**
 * Internal carrier for the collected research of one business.
 *
 * This is NOT a replacement for `ListingHarvest` and NOT a second research system.
 * It is the minimal wrapper that lets richer provenance travel alongside the
 * deterministic, lossy-by-design `mergeHarvests` output without changing the
 * harvest contract or `mergeHarvests` itself.
 *
 * The harvest is merged by `mergeHarvests` exactly as before. Provenance is
 * assembled separately from the *pre-merge candidates* (where conflict / alternatives
 * / multi-source information is still observable) and rides here to the normalizer.
 */

import type {
  BlockedSource,
  ListingHarvest,
  ProvenanceNote,
} from './types.js';
import { authorityRank, type FieldKind } from './authority.js';

/** Everything the collector gathers, carried together to the normalizer. */
export interface CollectedSources {
  /** The merged harvest, produced by `mergeHarvests` (unchanged behavior). */
  readonly harvest: ListingHarvest;
  /** Per-field provenance, keyed by the BusinessProfile field name it annotates. */
  readonly provenance: Readonly<Record<string, ProvenanceNote>>;
  /** Sources attempted but blocked/inaccessible, preserved for audit and re-run. */
  readonly blockedSources: readonly BlockedSource[];
}

/**
 * One source's contribution to the provenance map, before folding.
 *
 * Each harvester (Maps, Places, Instagram, Hermes) emits its own partial map.
 * The keys are the BusinessProfile field names it informed. `sourceClass` is the
 * authority class used by `FIELD_AUTHORITY` (e.g. 'maps', 'places', 'hermes').
 */
export interface SourceProvenance {
  readonly sourceClass: string;
  readonly sourceUrl: string;
  readonly fields: Record<string, Omit<ProvenanceNote, 'sources'>>;
}

/** A single candidate observation for one field, used by `foldProvenance`. */
interface Candidate {
  readonly field: string;
  readonly fieldKind: FieldKind | null;
  readonly sourceClass: string;
  readonly sourceUrl: string;
  readonly confidence: ProvenanceNote['confidence'];
  readonly status: ProvenanceStatus;
  readonly note?: string | undefined;
  readonly researchedAt?: string | undefined;
  readonly researcher?: string | undefined;
}

import type { ProvenanceStatus } from './types.js';

function fieldKindFor(field: string): FieldKind | null {
  // Map BusinessProfile field names to FieldKind where a dedicated ranking exists.
  switch (field) {
    case 'name':
    case 'category':
      return 'identity';
    case 'phone':
    case 'email':
      return 'contact';
    case 'address':
      return 'address';
    case 'hours':
      return 'hours';
    case 'rating':
      return 'rating';
    case 'reviewCount':
      return 'reviewCount';
    case 'attributes':
      return 'attributes';
    case 'description':
      return 'description';
    case 'socialProfiles':
      return 'socials';
    case 'images':
      return 'photos';
    case 'services':
      return 'services';
    default:
      return null;
  }
}

/**
 * Folds per-source provenance contributions into one canonical map.
 *
 * This runs on PRE-MERGE candidates, so it can see conflicts that `mergeHarvests`
 * discards. It does NOT select harvest values — `mergeHarvests` owns that. It only
 * interprets the candidates to produce:
 *   - `status`: agreed | conflicting | partial | absent-checked | blocked | unchecked
 *   - `confidence`: from the most-authoritative candidate that reported the field
 *   - `sources`: every URL that contributed
 *   - `note`: the most-authoritative explanation, especially the conflict text
 *
 * `FIELD_AUTHORITY` is used purely to *rank candidates for interpretation* (which
 * note wins, which confidence is reported). It never feeds back into the harvest.
 */
export function foldProvenance(parts: readonly SourceProvenance[]): Record<string, ProvenanceNote> {
  const byField = new Map<string, Candidate[]>();

  for (const part of parts) {
    for (const [field, note] of Object.entries(part.fields)) {
      const list = byField.get(field) ?? [];
      list.push({
        field,
        fieldKind: fieldKindFor(field),
        sourceClass: part.sourceClass,
        sourceUrl: part.sourceUrl,
        confidence: note.confidence,
        status: note.status,
        note: note.note,
        researchedAt: note.researchedAt,
        researcher: note.researcher,
      });
      byField.set(field, list);
    }
  }

  const out: Record<string, ProvenanceNote> = {};

  for (const [field, candidates] of byField) {
    if (candidates.length === 0) continue;

    const kind = candidates[0]!.fieldKind;

    // Rank candidates by field authority (most authoritative first); unknown
    // source classes sort last. Ties kept stable by input order.
    const ranked = [...candidates].sort((a, b) => {
      const ra = kind ? authorityRank(kind, a.sourceClass) : 0;
      const rb = kind ? authorityRank(kind, b.sourceClass) : 0;
      return ra - rb;
    });

    const sources = [...new Set(candidates.map((c) => c.sourceUrl))];

    // Status resolution across candidates for this field.
    const hasValue = candidates.some((c) => c.status !== 'absent-checked' && c.status !== 'blocked');
    const hasAbsent = candidates.some((c) => c.status === 'absent-checked');
    const hasBlocked = candidates.some((c) => c.status === 'blocked');
    const distinctNonAbsent = new Set(
      candidates.filter((c) => c.status !== 'absent-checked' && c.status !== 'blocked').map((c) => c.note ?? c.sourceClass),
    );

    let status: ProvenanceStatus;
    if (!hasValue && hasAbsent && !hasBlocked) status = 'absent-checked';
    else if (!hasValue && hasBlocked) status = 'blocked';
    // Disagreement among reporting candidates is the only conflict signal the
    // folder can observe — silent sources contribute no candidate, so they cannot
    // make a field `partial` here. Two sources stating the *same* value is
    // `agreed` (with `multi-source` confidence), not `partial`.
    else if (distinctNonAbsent.size > 1) status = 'conflicting';
    else status = 'agreed';

    // Confidence = most-authoritative candidate's confidence, upgraded to
    // `multi-source` when two or more independent sources reported the field
    // (a corroborated fact is stronger than a single report). A `confirmed`
    // official record keeps its tier — more reporters don't downgrade it.
    const winner = ranked[0]!;
    const reportingCount = candidates.filter(
      (c) => c.status !== 'absent-checked' && c.status !== 'blocked',
    ).length;
    const confidence: ProvenanceNote['confidence'] =
      reportingCount >= 2 && winner.confidence !== 'confirmed'
        ? 'multi-source'
        : winner.confidence;

    // Note = most-authoritative candidate's note, but prefer a conflict explanation
    // when status is conflicting so the disagreement is recorded.
    const note =
      status === 'conflicting'
        ? ranked.find((c) => c.note)?.note ?? winner.note
        : winner.note;

    out[field] = {
      confidence,
      status,
      sources,
      note,
      researchedAt: winner.researchedAt,
      researcher: winner.researcher,
    };
  }

  return out;
}

/** Empty carrier — used when no provenance was gathered (e.g. legacy runs). */
export const EMPTY_COLLECTED_SOURCES: CollectedSources = {
  harvest: {
    attributes: [],
    description: null,
    photos: [],
    reviews: [],
    hours: [],
    rating: null,
    reviewCount: null,
    sources: [],
  },
  provenance: {},
  blockedSources: [],
};
