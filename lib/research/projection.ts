/**
 * The one-way door between research and the pipeline.
 *
 * The artifact is the source of truth for research evidence. `BusinessProfile`
 * is downstream of it, and the relationship is a **projection**, not a copy:
 *
 *   ResearchArtifact  ──project──▶  ResearchProvenance  ──▶  BusinessProfile
 *        (truth)                       (a reading)              (a product)
 *
 * Three things the direction of that arrow buys:
 *
 *   - **Research never edits the pipeline.** Nothing in `lib/research` imports
 *     `lib/types.ts`, so a research pass cannot change a profile, a strategy, a
 *     design or a rendered site. It can only make evidence available.
 *   - **A profile can be rebuilt.** Because the projection is a pure function of
 *     the artifact, a profile derived from research is reproducible from the
 *     committed artifact alone — no re-research, no session transcript.
 *   - **Uncertainty survives the trip.** `contested`, `gaps`, `blockedSources`
 *     and `openQuestions` are part of the projection, so a consumer that wants
 *     only the settled values has to *discard* the doubt deliberately rather
 *     than never having been offered it.
 *
 * What this module deliberately does **not** do is choose between conflicting
 * values. A precedence rule is a product decision and belongs where product
 * decisions are made; this returns the disagreement intact.
 */

import type {
  ProvenanceEntry,
  ProvenanceValue,
  ResearchArtifact,
  ResearchClaim,
  ResearchProvenance,
} from './types.js';

/** Sorted, so a projection of an artifact is byte-identical every time. */
function byString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toValue(claim: ResearchClaim, urlFor: (id: string) => string | null): ProvenanceValue {
  return {
    value: claim.value,
    status: claim.status,
    confidence: claim.confidence,
    sourceUrls: claim.sourceIds
      .map(urlFor)
      .filter((url): url is string => url !== null)
      .sort(byString),
    observedAt: claim.observedAt,
  };
}

/**
 * Projects an artifact into the view the pipeline is allowed to consume.
 *
 * Fields split two ways. A field whose live claims all agree is `settled` — one
 * entry, one or more values that happen to be identical in content but differ in
 * attribution. A field the merge recorded a conflict for is `contested`, and its
 * entry carries every competing value with its own sources attached.
 *
 * A consumer that treats `contested` as if it were `settled` will pick a value
 * arbitrarily, which is why they are separate lists rather than one list with a
 * flag: the wrong behaviour has to be written on purpose.
 */
export function projectProvenance(artifact: ResearchArtifact): ResearchProvenance {
  const urlFor = (id: string): string | null =>
    artifact.sources.find((source) => source.id === id)?.url ?? null;

  const contestedFields = new Set(artifact.conflicts.map((conflict) => conflict.field));

  const grouped = new Map<string, ResearchClaim[]>();
  for (const claim of artifact.claims) {
    const bucket = grouped.get(claim.field);
    if (bucket === undefined) grouped.set(claim.field, [claim]);
    else bucket.push(claim);
  }

  const settled: ProvenanceEntry[] = [];
  const contested: ProvenanceEntry[] = [];

  for (const [field, claims] of grouped) {
    const entry: ProvenanceEntry = {
      field,
      values: [...claims]
        .map((claim) => toValue(claim, urlFor))
        .sort((a, b) => byString(a.value, b.value)),
    };
    (contestedFields.has(field) ? contested : settled).push(entry);
  }

  return {
    subjectKey: artifact.subject.key,
    researcher: artifact.researcher,
    revision: artifact.revision,
    updatedAt: artifact.updatedAt,
    settled: settled.sort((a, b) => byString(a.field, b.field)),
    contested: contested.sort((a, b) => byString(a.field, b.field)),
    gaps: artifact.gaps,
    blockedSources: artifact.sources.filter((source) => source.access !== 'ok'),
    openQuestions: artifact.openQuestions,
  };
}
