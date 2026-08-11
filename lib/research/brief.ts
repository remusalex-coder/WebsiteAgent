/**
 * Turning the artifact into the two pieces of prose the handoff needs.
 *
 * Both directions of the loop need one, and neither is decoration:
 *
 *   - **`buildRequest`** derives what to *not* research. Every field already
 *     settled goes into `excludeFields`, so a pass costs only the unknowns. This
 *     is the difference between "research River Park" and "research only the
 *     outdoor space, the capacity and the official contact details" — and it is
 *     derived from the artifact rather than remembered by a session, which is
 *     why it still works after the session that asked is gone.
 *
 *   - **`researchBrief`** is what a new session reads first. It has to answer
 *     "what is known, how well, what is contested, and what is still missing" in
 *     a screenful, or the resume story fails in practice even though the data is
 *     all on disk.
 *
 * Everything here is a pure function of the artifact. No clock, no I/O.
 */

import { requestId as deriveRequestId } from './identity.js';
import { RESEARCH_SCHEMA_VERSION } from './types.js';

import type {
  KnownClaim,
  ResearchArtifact,
  ResearchClaim,
  ResearchRequest,
  ResearchSubject,
} from './types.js';

/* ------------------------------------------------------------------ */
/* What is already settled                                             */
/* ------------------------------------------------------------------ */

/**
 * Fields that do not need researching again.
 *
 * Settled means: attested, not contested, and not merely inferred. An `inferred`
 * claim is Hermes's own reasoning rather than a source's statement, so it stays
 * open — asking a later pass to look for a real source for it is exactly the
 * work worth doing, and treating an inference as settled is how an inference
 * quietly becomes a fact.
 */
export function settledFields(artifact: ResearchArtifact): readonly string[] {
  const contested = new Set(artifact.conflicts.map((conflict) => conflict.field));

  const settled = new Set<string>();
  for (const claim of artifact.claims) {
    if (contested.has(claim.field)) continue;
    if (claim.status !== 'verified' && claim.status !== 'corroborated') continue;
    settled.add(claim.field);
  }

  return [...settled].sort();
}

/** The current holdings for a set of fields, so a change is visible as a change. */
function knownClaimsFor(
  artifact: ResearchArtifact,
  fields: readonly string[],
): readonly KnownClaim[] {
  const wanted = new Set(fields);
  const relevant = fields.length === 0
    ? artifact.claims
    : artifact.claims.filter((claim) => wanted.has(claim.field));

  return [...relevant]
    .map((claim): KnownClaim => ({
      field: claim.field,
      value: claim.value,
      status: claim.status,
    }))
    .sort((a, b) => (a.field < b.field ? -1 : a.field > b.field ? 1 : a.value < b.value ? -1 : a.value > b.value ? 1 : 0));
}

/* ------------------------------------------------------------------ */
/* Claude → Hermes                                                     */
/* ------------------------------------------------------------------ */

export interface BuildRequestOptions {
  readonly subject: ResearchSubject;
  /** What Claude wants to know, in a sentence. */
  readonly query: string;
  /** The fields this pass should establish. */
  readonly fields: readonly string[];
  /** Current state, or `null` for a first pass. */
  readonly artifact: ResearchArtifact | null;
  /** ISO 8601. Supplied by the caller, so this stays a pure function. */
  readonly requestedAt: string;
  readonly notes: string | null;
}

/**
 * Composes an incremental request.
 *
 * The request id is a hash of the subject, the question and the fields, so two
 * sessions that independently reach the same conclusion about what is missing
 * write the *same* file rather than two — the whole duplicate-work guard, for
 * free. A caller can check whether the question is already open by looking for
 * the id before writing it.
 */
export function buildRequest(options: BuildRequestOptions): ResearchRequest {
  const { subject, query, fields, artifact, requestedAt, notes } = options;

  const asked = [...new Set(fields)].sort();
  const settled = artifact === null ? [] : settledFields(artifact);

  // A field explicitly asked for is never excluded: asking again is how a
  // session says "I think this changed", and the exclusion list must not
  // silently overrule the question.
  const excludeFields = settled.filter((field) => !asked.includes(field));

  return {
    schemaVersion: RESEARCH_SCHEMA_VERSION,
    requestId: deriveRequestId(subject.key, query, asked),
    subject,
    scope: { query: query.trim(), fields: asked, excludeFields },
    requestedBy: 'claude',
    requestedAt,
    knownClaims: artifact === null ? [] : knownClaimsFor(artifact, asked),
    notes,
  };
}

/**
 * The request, as instructions a researcher can act on.
 *
 * Transport-independent on purpose. The same text is what an MCP call carries,
 * what a local agent reads off disk, and what a human pastes into whatever tool
 * is at hand — so the handoff does not stop working when a transport does.
 *
 * The rules are restated in every request rather than assumed, because the thing
 * reading it may have no memory of the last one.
 */
export function hermesPrompt(request: ResearchRequest): string {
  const { subject, scope } = request;

  const lines: string[] = [
    `# Research request ${request.requestId}`,
    '',
    `Business: ${subject.name}${subject.locality === null ? '' : ` (${subject.locality})`}`,
    `Key: ${subject.key}`,
  ];

  if (subject.homepage !== null) lines.push(`Known homepage: ${subject.homepage}`);
  if (subject.mapsUrl !== null) lines.push(`Known Maps listing: ${subject.mapsUrl}`);

  lines.push('', '## Question', scope.query);

  if (scope.fields.length > 0) {
    lines.push('', '## Establish these fields', ...scope.fields.map((field) => `- ${field}`));
  }

  if (scope.excludeFields.length > 0) {
    lines.push(
      '',
      '## Already settled — do not spend this pass re-confirming',
      ...scope.excludeFields.map((field) => `- ${field}`),
    );
  }

  if (request.knownClaims.length > 0) {
    lines.push(
      '',
      '## Currently held, for these fields',
      'Report a value only if it differs from what is here, or if you can raise its status.',
      ...request.knownClaims.map(
        (claim) => `- ${claim.field} = ${JSON.stringify(claim.value)} [${claim.status}]`,
      ),
    );
  }

  if (request.notes !== null) lines.push('', '## Notes from the requester', request.notes);

  lines.push(
    '',
    '## Rules',
    '- Return only new or changed findings. Repeating settled facts wastes the pass.',
    '- Every claim must name at least one source you actually read. A claim with no',
    '  source is rejected — record it as a gap or an open question instead.',
    '- Never state a fact about this business that no source states. If you reasoned',
    '  your way to it, mark it `inferred` and write the reasoning in `note`.',
    '- Record sources you could not read, with `access` and a `note` saying why.',
    '  A wall is a finding; silence about it is not.',
    '- Do not decide anything about the website: no layout, palette, section, copy or',
    '  tone. Supply evidence; what it is used for is decided elsewhere.',
    '- Answer with a ResearchDelta JSON object matching the research contract',
    `  (schemaVersion ${RESEARCH_SCHEMA_VERSION}), echoing requestId "${request.requestId}".`,
  );

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Hermes → Claude                                                     */
/* ------------------------------------------------------------------ */

function describeClaim(claim: ResearchClaim, urlFor: (id: string) => string | null): string {
  const urls = claim.sourceIds
    .map(urlFor)
    .filter((url): url is string => url !== null);

  const attribution = urls.length === 0 ? '' : ` — ${urls.join(', ')}`;
  return `- ${claim.field}: ${claim.value} [${claim.status}/${claim.confidence}]${attribution}`;
}

/**
 * What a session opening cold should read before doing anything else.
 *
 * Ordered by what changes a decision: contested first, because acting on a
 * contested field without noticing is the expensive mistake; then what is known;
 * then what is missing, which is what the next request will be about.
 */
export function researchBrief(artifact: ResearchArtifact): string {
  const { subject } = artifact;
  const urlFor = (id: string): string | null =>
    artifact.sources.find((source) => source.id === id)?.url ?? null;

  const lines: string[] = [
    `# Research: ${subject.name}`,
    '',
    `key ${subject.key} · revision ${artifact.revision} · ${artifact.passes.length} pass(es) · ` +
      `researcher ${artifact.researcher} · updated ${artifact.updatedAt}`,
    '',
    '## Handoff',
    artifact.handoff,
  ];

  if (artifact.revision === 0) {
    lines.push('', 'Nothing has been researched yet.');
    return lines.join('\n');
  }

  if (artifact.conflicts.length > 0) {
    lines.push('', '## Contested — do not pick one silently');
    for (const conflict of artifact.conflicts) {
      lines.push(`- ${conflict.field}: ${conflict.note}`);
      for (const id of conflict.claimIds) {
        const claim = artifact.claims.find((entry) => entry.id === id);
        if (claim !== undefined) lines.push(`  ${describeClaim(claim, urlFor).slice(2)}`);
      }
    }
  }

  const contested = new Set(artifact.conflicts.map((conflict) => conflict.field));
  const uncontested = artifact.claims.filter((claim) => !contested.has(claim.field));

  if (uncontested.length > 0) {
    lines.push('', `## Established (${uncontested.length})`);
    for (const claim of uncontested) lines.push(describeClaim(claim, urlFor));
  }

  if (artifact.assets.length > 0) {
    lines.push('', `## Assets found (${artifact.assets.length})`);
    for (const asset of artifact.assets) {
      const size = asset.width === null || asset.height === null
        ? ''
        : ` ${asset.width}×${asset.height}`;
      const rights = asset.usageNote === null ? '' : ` — rights: ${asset.usageNote}`;
      lines.push(`- [${asset.kind}]${size} ${asset.url}${rights}`);
    }
  }

  const blocked = artifact.sources.filter((source) => source.access !== 'ok');
  if (blocked.length > 0) {
    lines.push('', '## Sources that could not be read');
    for (const source of blocked) {
      lines.push(`- [${source.access}] ${source.url} — ${source.note ?? 'no reason recorded'}`);
    }
  }

  if (artifact.gaps.length > 0) {
    lines.push('', '## Gaps — looked for, not established');
    for (const gap of artifact.gaps) lines.push(`- ${gap.field}: ${gap.lookedFor} (${gap.why})`);
  }

  if (artifact.openQuestions.length > 0) {
    lines.push('', '## Open questions');
    for (const question of artifact.openQuestions) lines.push(`- ${question}`);
  }

  lines.push(
    '',
    '## Provenance',
    ...artifact.passes.map(
      (pass) =>
        `- ${pass.researchedAt} · ${pass.requestId} · +${pass.added.claims} claims, ` +
        `+${pass.added.sources} sources, +${pass.added.assets} assets, +${pass.added.gaps} gaps` +
        (pass.retiredClaimIds.length > 0 ? `, −${pass.retiredClaimIds.length} retired` : ''),
    ),
  );

  return lines.join('\n');
}
