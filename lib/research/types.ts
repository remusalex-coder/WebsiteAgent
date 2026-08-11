/**
 * The research handoff contract.
 *
 * Two agents share this file and nothing else. **Claude** decides what evidence
 * is missing and writes a `ResearchRequest`; **Hermes** investigates public
 * sources and returns a `ResearchDelta`; the delta is merged into the canonical
 * `ResearchArtifact`, which is the source of truth for research evidence and
 * survives the session that produced it.
 *
 *   ResearchRequest  →  (Hermes)  →  ResearchDelta  →  merge  →  ResearchArtifact
 *
 * Three properties this file exists to enforce:
 *
 *   - **Nothing is unattributable.** A claim carries `sourceIds`, and a claim
 *     whose sources are not declared fails validation rather than being stored.
 *     Hermes cannot promote a guess to a fact by asserting it confidently.
 *   - **Evidence and design stay apart.** Nothing here describes a layout, a
 *     palette, a section or a piece of copy. Research supplies facts; what the
 *     site does with them is Claude's decision and BusinessForge's contract.
 *   - **Absence is a value.** Blocked sources, gaps and open questions are
 *     fields, not omissions, so "we could not find out" is recorded rather than
 *     silently rendering as "there is nothing there".
 *
 * This module is a leaf: it imports nothing. The rest of `lib/research` depends
 * on it, and no agent, stage or existing pipeline contract depends on any of it.
 */

/**
 * Bumped when a stored artifact stops being readable by this code.
 *
 * Every artifact and every message carries it, so a file written by an older
 * revision is refused with a sentence naming the version rather than being
 * half-parsed into a shape the merge then corrupts.
 */
export const RESEARCH_SCHEMA_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Who                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Who did the research.
 *
 * A single-member union today, and deliberately a union rather than a boolean
 * or an implied default: a second researcher should be a new value here and a
 * new row in the provenance chain, never a second artifact format.
 */
export type Researcher = 'hermes';

/** Who asked. Same reasoning as `Researcher`. */
export type Requester = 'claude';

/* ------------------------------------------------------------------ */
/* Subject                                                             */
/* ------------------------------------------------------------------ */

/**
 * Just enough identity to know which business is being researched.
 *
 * Deliberately five fields. This is **not** a `BusinessProfile` and must never
 * grow into one: the profile is built by the pipeline from evidence, and a
 * research artifact that also carried hours, services and images would give the
 * project two competing business records that drift apart. What Hermes learns
 * lives in `claims`, which are attributed; what the pipeline concludes lives in
 * the profile, which is downstream of both.
 */
export interface ResearchSubject {
  /**
   * Stable slug identifying the business across sessions and revisions, e.g.
   * `river-park-events`. This is the artifact's filename and its primary key.
   */
  readonly key: string;
  /** Name as the business writes it. */
  readonly name: string;
  /** Town or city, when it is needed to disambiguate the name. */
  readonly locality: string | null;
  /** Official site, if one is known. A starting point for Hermes, not a claim. */
  readonly homepage: string | null;
  /** Google Maps listing, if one is known. Also a starting point, not a claim. */
  readonly mapsUrl: string | null;
}

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

export type SourceKind =
  | 'website'
  | 'maps'
  | 'social'
  | 'directory'
  | 'press'
  | 'review'
  | 'document'
  | 'other';

/**
 * Whether the source could actually be read.
 *
 * `blocked` is the load-bearing one. A login wall, a bot check or a robots
 * exclusion is a **fact about the research**, and recording it is what stops the
 * next session from spending another pass discovering the same wall — and stops
 * "we were blocked" from being indistinguishable from "there was nothing there".
 */
export type SourceAccess = 'ok' | 'blocked' | 'not_found' | 'unreachable';

export interface ResearchSource {
  /** Unique within the artifact. Referenced by `ResearchClaim.sourceIds`. */
  readonly id: string;
  readonly url: string;
  readonly kind: SourceKind;
  /** Who publishes it — the business itself, a directory, a newspaper. */
  readonly publisher: string | null;
  /** ISO 8601. When Hermes actually fetched it. */
  readonly retrievedAt: string;
  readonly access: SourceAccess;
  /**
   * One line a human can act on: which wall, which error, which redirect.
   * Required when `access` is anything but `ok` — see `validate.ts`.
   */
  readonly note: string | null;
}

/* ------------------------------------------------------------------ */
/* Claims                                                              */
/* ------------------------------------------------------------------ */

/**
 * How well established a claim is.
 *
 * The five canonical statuses of the BusinessForge evidence contract. They are
 * not confidence by another name: `confidence` is how sure Hermes is of its
 * reading, `status` is how many independent sources back it.
 *
 *   `verified`     — one readable source states it.
 *   `corroborated` — two or more independent readable sources agree.
 *   `inferred`     — Hermes concluded it; no source states it outright. Needs a
 *                    note explaining the inference, so a reader can reject it.
 *   `unknown`      — looked for, not established. Usually appears as a gap.
 *   `conflicted`   — **a property of a field, not of a claim.** Sources
 *                    disagreeing about a field does not make either claim less
 *                    well attested; each keeps the status its own sources earn,
 *                    and the disagreement is recorded once, in `conflicts`. So
 *                    this value never appears on a stored claim — a delta
 *                    carrying it is rejected — and it exists in the union
 *                    because it is one of the five canonical evidence statuses
 *                    a *field* can hold.
 */
export type ClaimStatus = 'verified' | 'corroborated' | 'inferred' | 'unknown' | 'conflicted';

/** How sure the researcher is of its own reading of the source. */
export type Confidence = 'high' | 'medium' | 'low';

/**
 * One attributed fact.
 *
 * `value` is a string, always. Research answers questions like "how many rooms"
 * and "is there outdoor seating"; typing those into the pipeline's shapes is the
 * pipeline's job, downstream, where the types already exist. Keeping this a
 * string is what stops the research layer from quietly becoming a second,
 * competing schema for a business.
 */
export interface ResearchClaim {
  /**
   * Content hash of the claim, from `claimId()`. Deterministic, so re-applying
   * the same finding is a no-op and a merge is idempotent.
   */
  readonly id: string;
  /** Coarse grouping for reading and for scoping a follow-up pass, e.g. `contact`. */
  readonly topic: string;
  /**
   * What this is a claim *about*, e.g. `phone`, `outdoor-space`, `room-count`.
   * Two claims sharing a field and disagreeing on value are a conflict.
   */
  readonly field: string;
  /** The finding itself, as close to the source's own words as is useful. */
  readonly value: string;
  /** At least one, and each must resolve to a declared source. */
  readonly sourceIds: readonly string[];
  /** The sentence the value was read from, when quoting one is possible. */
  readonly excerpt: string | null;
  readonly status: ClaimStatus;
  readonly confidence: Confidence;
  /** Required for `inferred`: the reasoning, so the inference can be rejected. */
  readonly note: string | null;
  /** ISO 8601. When the claim was observed. */
  readonly observedAt: string;
}

/**
 * Sources disagreeing about one field.
 *
 * Recomputed by the merge on every pass, never sent by the researcher: only
 * something holding every live claim at once can see a disagreement, and a
 * conflict that outlived the retirement of one of its sides would be a lie.
 *
 * The disagreement is kept whole — every claim stays in `claims` with its own
 * attribution — because a merge that picked a winner would destroy the evidence
 * that there was ever a question. A precedence rule may choose one downstream;
 * it chooses from an alternative that still exists.
 */
export interface ResearchConflict {
  readonly field: string;
  /** Every live claim on this field. Two or more, sorted. */
  readonly claimIds: readonly string[];
  readonly note: string;
}

/* ------------------------------------------------------------------ */
/* Assets                                                              */
/* ------------------------------------------------------------------ */

export type AssetKind = 'photo' | 'logo' | 'menu' | 'floorplan' | 'video' | 'document' | 'other';

/**
 * Something visual Hermes found, and where it found it.
 *
 * Discovery only: nothing here downloads, and nothing here decides an image is
 * usable. `usageNote` records what the source *states* about rights — it is a
 * quotation, never a legal conclusion, and an empty one means the source said
 * nothing rather than that the asset is free to use.
 */
export interface ResearchAsset {
  readonly id: string;
  readonly url: string;
  readonly kind: AssetKind;
  /** Must resolve to a declared source: an asset is evidence too. */
  readonly sourceId: string;
  /** What it depicts, in Hermes's words. Never used as `alt` text unedited. */
  readonly description: string | null;
  readonly width: number | null;
  readonly height: number | null;
  /** Photographer or rights-holder, when the source names one. */
  readonly credit: string | null;
  /** Licence or terms **as stated by the source**. Not a determination. */
  readonly usageNote: string | null;
}

/* ------------------------------------------------------------------ */
/* Absence                                                             */
/* ------------------------------------------------------------------ */

/**
 * Something looked for and not established.
 *
 * A gap is a finding. Recording it is what makes a second pass cheap — the next
 * session reads which fields were already hunted and where the hunt died,
 * instead of repeating it.
 */
export interface ResearchGap {
  readonly field: string;
  /** What Hermes actually tried to establish. */
  readonly lookedFor: string;
  /** Why it failed: absent, behind a wall, ambiguous, contradictory. */
  readonly why: string;
}

/* ------------------------------------------------------------------ */
/* Request: Claude → Hermes                                            */
/* ------------------------------------------------------------------ */

/**
 * The shape of one research pass, as asked for.
 *
 * `excludeFields` is what makes research incremental: it names what is already
 * settled so a pass costs only the unknowns. It is derived from the existing
 * artifact rather than typed by hand — see `buildRequest`.
 */
export interface ResearchScope {
  /** What Claude wants to know, in a sentence. Hermes reads this first. */
  readonly query: string;
  /** Fields the pass should establish, e.g. `['outdoor-space', 'capacity']`. */
  readonly fields: readonly string[];
  /** Fields already settled. Hermes must not spend a pass re-confirming these. */
  readonly excludeFields: readonly string[];
}

/** A fact already held, so Hermes can detect a change without re-researching it. */
export interface KnownClaim {
  readonly field: string;
  readonly value: string;
  readonly status: ClaimStatus;
}

/**
 * One request for research, persisted so it outlives the session that wrote it.
 *
 * Deliberately small. It is a question, not a briefing: everything Hermes needs
 * to answer it is the subject, the scope and what is already known.
 */
export interface ResearchRequest {
  readonly schemaVersion: number;
  /** Stable id, derived from the subject and scope. Echoed back in the delta. */
  readonly requestId: string;
  readonly subject: ResearchSubject;
  readonly scope: ResearchScope;
  readonly requestedBy: Requester;
  /** ISO 8601. */
  readonly requestedAt: string;
  /** Current holdings for the requested topics, so a change is visible as one. */
  readonly knownClaims: readonly KnownClaim[];
  /** Anything else Claude wants the researcher to know. */
  readonly notes: string | null;
}

/* ------------------------------------------------------------------ */
/* Delta: Hermes → Claude                                              */
/* ------------------------------------------------------------------ */

/**
 * What one research pass found. **New and changed findings only.**
 *
 * A delta that repeated everything already in the artifact would still merge
 * correctly — claim ids are content hashes, so a repeat is a no-op — but it
 * would waste the pass. The contract is incremental because the work is.
 */
export interface ResearchDelta {
  readonly schemaVersion: number;
  /** The request this answers. Carried into the artifact's provenance chain. */
  readonly requestId: string;
  readonly researcher: Researcher;
  /** ISO 8601. The research timestamp for this pass. */
  readonly researchedAt: string;
  /** Every source this pass touched, including the ones that refused it. */
  readonly sources: readonly ResearchSource[];
  readonly claims: readonly ResearchClaim[];
  readonly assets: readonly ResearchAsset[];
  readonly gaps: readonly ResearchGap[];
  /** What Hermes could not settle and a human or a later pass might. */
  readonly openQuestions: readonly string[];
  /**
   * A few sentences for whoever reads this next. The one free-text field in the
   * contract, and the reason a new session can start from the artifact rather
   * than from a transcript.
   */
  readonly handoff: string;
  /**
   * Claims this pass believes are now wrong — a phone number that changed, a
   * page that was corrected. Retired, not deleted: they leave `claims` and are
   * listed on the pass, so the artifact still shows what was once believed.
   */
  readonly retiredClaimIds: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Artifact: the canonical record                                      */
/* ------------------------------------------------------------------ */

/**
 * One research pass, recorded permanently.
 *
 * The provenance chain. Every claim in the artifact is traceable to the pass
 * that introduced it, the request that asked for it, and the moment it was
 * observed — which is what lets a reader six sessions later tell fresh evidence
 * from stale evidence without re-running anything.
 */
export interface ResearchPass {
  readonly requestId: string;
  readonly researcher: Researcher;
  readonly researchedAt: string;
  readonly scope: ResearchScope;
  /** Counts for this pass alone, so a pass that found nothing is visible as one. */
  readonly added: {
    readonly claims: number;
    readonly sources: number;
    readonly assets: number;
    readonly gaps: number;
  };
  readonly retiredClaimIds: readonly string[];
  readonly handoff: string;
}

/**
 * Everything known about one business from research, and where each part of it
 * came from.
 *
 * **This is the source of truth for research evidence.** A `BusinessProfile`
 * built downstream projects from it and never replaces it: the profile is one
 * reading of the evidence, and the evidence outlives any particular reading.
 *
 * Written to `research/<key>.research.json`, committed to the repository, and
 * read by whichever session opens next.
 */
export interface ResearchArtifact {
  readonly schemaVersion: number;
  readonly subject: ResearchSubject;
  readonly researcher: Researcher;
  /** Increments once per merged pass. `0` is an artifact with no research yet. */
  readonly revision: number;
  /** ISO 8601. The `researchedAt` of the most recent pass. */
  readonly updatedAt: string;
  /** Oldest first. The provenance chain. */
  readonly passes: readonly ResearchPass[];
  /** Every source ever touched, including blocked ones. Sorted by id. */
  readonly sources: readonly ResearchSource[];
  /** Live claims only — retired ones are named on their pass. Sorted by id. */
  readonly claims: readonly ResearchClaim[];
  /** Computed by the merge from `claims`. Sorted by field. */
  readonly conflicts: readonly ResearchConflict[];
  readonly assets: readonly ResearchAsset[];
  readonly gaps: readonly ResearchGap[];
  readonly openQuestions: readonly string[];
  /** The most recent pass's handoff. The first thing a new session should read. */
  readonly handoff: string;
}

/* ------------------------------------------------------------------ */
/* Projection                                                          */
/* ------------------------------------------------------------------ */

/**
 * The read-only view the pipeline is allowed to consume.
 *
 * `BusinessProfile.provenance` is a projection of this, not a copy of the
 * artifact: downstream gets settled fields plus an explicit account of what is
 * unsettled, and never the freedom to treat a research claim as its own.
 *
 * Produced by `projectProvenance`. Deterministic — no clock, no ordering by
 * insertion — so a profile built twice from one artifact is identical twice.
 */
export interface ResearchProvenance {
  readonly subjectKey: string;
  readonly researcher: Researcher;
  readonly revision: number;
  readonly updatedAt: string;
  /** Fields with exactly one live value, keyed by field. */
  readonly settled: readonly ProvenanceEntry[];
  /** Fields whose sources disagree. Downstream must not silently pick one. */
  readonly contested: readonly ProvenanceEntry[];
  /** Fields looked for and not established. */
  readonly gaps: readonly ResearchGap[];
  /** Sources that refused access, so a reader knows what was not seen. */
  readonly blockedSources: readonly ResearchSource[];
  readonly openQuestions: readonly string[];
}

/** One field, its value(s), and the URLs behind each. */
export interface ProvenanceEntry {
  readonly field: string;
  readonly values: readonly ProvenanceValue[];
}

export interface ProvenanceValue {
  readonly value: string;
  readonly status: ClaimStatus;
  readonly confidence: Confidence;
  /** Resolved source URLs, sorted. Empty is impossible: validation forbids it. */
  readonly sourceUrls: readonly string[];
  readonly observedAt: string;
}
