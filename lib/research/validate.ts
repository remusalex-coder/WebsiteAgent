/**
 * Parsing untrusted research into the contract, and refusing it when it does not
 * fit.
 *
 * Everything Hermes returns arrives as `unknown` — over MCP, off disk, or pasted
 * into a file by hand — so this module is the one boundary where a research
 * message becomes typed. It exists to make one class of failure impossible:
 *
 *   **A claim with no source is a validation error, not a low-confidence fact.**
 *
 * That is the difference between a research layer and a second opinion. A
 * researcher can be wrong about what a page said; it cannot assert something no
 * page said and have it stored. The rules below are the mechanical form of the
 * project's rule that nothing about a customer's business may be invented:
 *
 *   - every claim names at least one source, and every named source is declared;
 *   - `verified` needs a source that was actually readable;
 *   - `corroborated` needs two independent readable sources;
 *   - `inferred` needs a note, so the reasoning can be rejected by a reader;
 *   - `conflicted` is not sendable — the merge decides that, not the researcher;
 *   - a source that was not readable must say why.
 *
 * Failures throw `InvalidInputError` naming the exact path, because a malformed
 * research message is a bug in the producer and a silent partial parse would put
 * unattributed values into the canonical artifact.
 */

import { InvalidInputError } from '../errors.js';
import { claimId } from './identity.js';
import { RESEARCH_SCHEMA_VERSION } from './types.js';

import type {
  AssetKind,
  ClaimStatus,
  Confidence,
  KnownClaim,
  ResearchArtifact,
  ResearchAsset,
  ResearchClaim,
  ResearchConflict,
  ResearchDelta,
  ResearchGap,
  ResearchPass,
  ResearchRequest,
  ResearchScope,
  ResearchSource,
  ResearchSubject,
  SourceAccess,
  SourceKind,
} from './types.js';

const SOURCE = 'research';

const SOURCE_KINDS: readonly SourceKind[] = [
  'website', 'maps', 'social', 'directory', 'press', 'review', 'document', 'other',
];
const SOURCE_ACCESS: readonly SourceAccess[] = ['ok', 'blocked', 'not_found', 'unreachable'];
const CLAIM_STATUSES: readonly ClaimStatus[] = [
  'verified', 'corroborated', 'inferred', 'unknown', 'conflicted',
];
const CONFIDENCES: readonly Confidence[] = ['high', 'medium', 'low'];
const ASSET_KINDS: readonly AssetKind[] = [
  'photo', 'logo', 'menu', 'floorplan', 'video', 'document', 'other',
];

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

function fail(where: string, problem: string): never {
  throw new InvalidInputError(`${where} ${problem}`, SOURCE);
}

function record(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(where, 'must be a JSON object');
  }
  return value as Record<string, unknown>;
}

function str(from: Record<string, unknown>, key: string, where: string): string {
  const value = from[key];
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${where}.${key}`, 'must be a non-empty string');
  }
  return value.trim();
}

/** Optional string. Absent, null and empty all collapse to `null`. */
function optionalStr(from: Record<string, unknown>, key: string): string | null {
  const value = from[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function optionalInt(from: Record<string, unknown>, key: string, where: string): number | null {
  const value = from[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail(`${where}.${key}`, 'must be a non-negative number when present');
  }
  return Math.floor(value);
}

function strArray(from: Record<string, unknown>, key: string, where: string): readonly string[] {
  const value = from[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(`${where}.${key}`, 'must be an array of strings');
  return value.map((entry, index) => {
    if (typeof entry !== 'string' || entry.trim() === '') {
      fail(`${where}.${key}[${index}]`, 'must be a non-empty string');
    }
    return entry.trim();
  });
}

function array(from: Record<string, unknown>, key: string, where: string): readonly unknown[] {
  const value = from[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(`${where}.${key}`, 'must be an array');
  return value;
}

function oneOf<T extends string>(
  from: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  where: string,
): T {
  const value = from[key];
  const match = allowed.find((entry) => entry === value);
  if (match === undefined) {
    fail(`${where}.${key}`, `must be one of ${allowed.join(', ')}, got ${JSON.stringify(value)}`);
  }
  return match;
}

/**
 * An ISO 8601 instant, checked by round trip.
 *
 * Timestamps are the field a hand-written delta gets wrong most often, and a
 * bad one is invisible until an artifact sorts strangely months later.
 */
function timestamp(from: Record<string, unknown>, key: string, where: string): string {
  const value = str(from, key, where);
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) fail(`${where}.${key}`, `must be an ISO 8601 timestamp, got "${value}"`);
  return value;
}

function schemaVersion(from: Record<string, unknown>, where: string): number {
  const value = from.schemaVersion;
  if (value !== RESEARCH_SCHEMA_VERSION) {
    fail(
      `${where}.schemaVersion`,
      `must be ${RESEARCH_SCHEMA_VERSION}, got ${JSON.stringify(value)}. ` +
        'This file was written by a different revision of the research contract.',
    );
  }
  return RESEARCH_SCHEMA_VERSION;
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

export function parseSubject(value: unknown, where = 'subject'): ResearchSubject {
  const from = record(value, where);
  const key = str(from, 'key', where);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(key)) {
    fail(`${where}.key`, `must be a lower-case slug (a-z, 0-9, hyphen), got "${key}"`);
  }
  return {
    key,
    name: str(from, 'name', where),
    locality: optionalStr(from, 'locality'),
    homepage: optionalStr(from, 'homepage'),
    mapsUrl: optionalStr(from, 'mapsUrl'),
  };
}

function parseSource(value: unknown, where: string): ResearchSource {
  const from = record(value, where);
  const access = oneOf(from, 'access', SOURCE_ACCESS, where);
  const note = optionalStr(from, 'note');

  // An unreadable source that does not say why is the failure this catches:
  // "blocked" with no reason is indistinguishable from "we did not try".
  if (access !== 'ok' && note === null) {
    fail(`${where}.note`, `is required when access is "${access}" — record which wall or error`);
  }

  return {
    id: str(from, 'id', where),
    url: str(from, 'url', where),
    kind: oneOf(from, 'kind', SOURCE_KINDS, where),
    publisher: optionalStr(from, 'publisher'),
    retrievedAt: timestamp(from, 'retrievedAt', where),
    access,
    note,
  };
}

function parseClaim(value: unknown, where: string): ResearchClaim {
  const from = record(value, where);
  const status = oneOf(from, 'status', CLAIM_STATUSES, where);
  const note = optionalStr(from, 'note');

  if (status === 'inferred' && note === null) {
    fail(
      `${where}.note`,
      'is required when status is "inferred" — state the reasoning so a reader can reject it',
    );
  }

  const sourceIds = strArray(from, 'sourceIds', where);
  if (sourceIds.length === 0) {
    fail(
      `${where}.sourceIds`,
      'must name at least one source. A claim with no source cannot be stored: ' +
        'record it as a gap or an open question instead.',
    );
  }

  const sorted = [...sourceIds].sort();
  const field = str(from, 'field', where);
  const claimed = str(from, 'value', where);

  return {
    // Derived, never read from the message. A producer cannot choose a claim's
    // identity, so re-applying the same finding is always a no-op and the merge
    // is idempotent whatever wrote the delta.
    id: claimId(field, claimed, sorted),
    topic: str(from, 'topic', where),
    field,
    value: claimed,
    sourceIds: sorted,
    excerpt: optionalStr(from, 'excerpt'),
    status,
    confidence: oneOf(from, 'confidence', CONFIDENCES, where),
    note,
    observedAt: timestamp(from, 'observedAt', where),
  };
}

function parseAsset(value: unknown, where: string): ResearchAsset {
  const from = record(value, where);
  return {
    id: str(from, 'id', where),
    url: str(from, 'url', where),
    kind: oneOf(from, 'kind', ASSET_KINDS, where),
    sourceId: str(from, 'sourceId', where),
    description: optionalStr(from, 'description'),
    width: optionalInt(from, 'width', where),
    height: optionalInt(from, 'height', where),
    credit: optionalStr(from, 'credit'),
    usageNote: optionalStr(from, 'usageNote'),
  };
}

function parseGap(value: unknown, where: string): ResearchGap {
  const from = record(value, where);
  return {
    field: str(from, 'field', where),
    lookedFor: str(from, 'lookedFor', where),
    why: str(from, 'why', where),
  };
}

function parseScope(value: unknown, where: string): ResearchScope {
  const from = record(value, where);
  return {
    query: str(from, 'query', where),
    fields: strArray(from, 'fields', where),
    excludeFields: strArray(from, 'excludeFields', where),
  };
}

function parseKnownClaim(value: unknown, where: string): KnownClaim {
  const from = record(value, where);
  return {
    field: str(from, 'field', where),
    value: str(from, 'value', where),
    status: oneOf(from, 'status', CLAIM_STATUSES, where),
  };
}

/* ------------------------------------------------------------------ */
/* Cross-field rules                                                   */
/* ------------------------------------------------------------------ */

/**
 * The rules that need the whole message to check.
 *
 * Shared by the delta and the artifact so a file cannot be made valid by writing
 * it straight to disk instead of merging it — the artifact reader applies the
 * identical invariants to whatever it loads.
 */
/**
 * Collapses claims that are the same claim.
 *
 * Since ids are derived, two entries with the same field, value and sources are
 * one finding stated twice — a repeat rather than an error, and one a researcher
 * that re-sends its whole state makes constantly. First occurrence wins.
 */
function dedupeClaims(claims: readonly ResearchClaim[]): readonly ResearchClaim[] {
  const seen = new Set<string>();
  return claims.filter((claim) => {
    if (seen.has(claim.id)) return false;
    seen.add(claim.id);
    return true;
  });
}

/**
 * `conflicted` describes a field, not a claim.
 *
 * Two sources disagreeing does not make either claim less well attested — each
 * keeps the status its own sources earn — so the disagreement is recorded once,
 * in `conflicts`, by the merge. Applied to stored artifacts as well as to
 * incoming deltas, so an artifact edited by hand is held to what the merge would
 * have written.
 */
function rejectConflictedClaims(where: string, claims: readonly ResearchClaim[]): void {
  for (const [index, claim] of claims.entries()) {
    if (claim.status === 'conflicted') {
      fail(
        `${where}.claims[${index}].status`,
        'must not be "conflicted" on a claim: that is a property of a field, recorded ' +
          'in "conflicts" by the merge. Give this claim the status its own sources earn.',
      );
    }
  }
}

function checkReferences(
  where: string,
  sources: readonly ResearchSource[],
  claims: readonly ResearchClaim[],
  assets: readonly ResearchAsset[],
): void {
  const byId = new Map(sources.map((source) => [source.id, source]));
  if (byId.size !== sources.length) {
    const seen = new Set<string>();
    const duplicate = sources.find((source) => !seen.add(source.id));
    fail(`${where}.sources`, `contains two sources with id "${duplicate?.id ?? '?'}"`);
  }

  for (const [index, claim] of claims.entries()) {
    const at = `${where}.claims[${index}]`;

    const resolved = claim.sourceIds.map((id) => {
      const source = byId.get(id);
      if (source === undefined) {
        fail(`${at}.sourceIds`, `names "${id}", which is not declared in sources`);
      }
      return source;
    });

    const readable = resolved.filter((source) => source.access === 'ok');

    if (claim.status === 'verified' && readable.length === 0) {
      fail(
        `${at}.status`,
        'is "verified" but none of its sources was readable (access "ok"). ' +
          'A claim can only be verified by a source that could actually be read.',
      );
    }
    if (claim.status === 'corroborated' && readable.length < 2) {
      fail(
        `${at}.status`,
        `is "corroborated" but only ${readable.length} of its sources was readable; ` +
          'corroboration needs two independent readable sources.',
      );
    }
  }

  const assetIds = new Set<string>();
  for (const [index, asset] of assets.entries()) {
    const at = `${where}.assets[${index}]`;
    if (!assetIds.add(asset.id)) fail(at, `repeats asset id "${asset.id}"`);
    if (!byId.has(asset.sourceId)) {
      fail(`${at}.sourceId`, `names "${asset.sourceId}", which is not declared in sources`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export function parseRequest(value: unknown, where = 'request'): ResearchRequest {
  const from = record(value, where);
  const requestedBy = from.requestedBy;
  if (requestedBy !== 'claude') {
    fail(`${where}.requestedBy`, `must be "claude", got ${JSON.stringify(requestedBy)}`);
  }

  return {
    schemaVersion: schemaVersion(from, where),
    requestId: str(from, 'requestId', where),
    subject: parseSubject(from.subject, `${where}.subject`),
    scope: parseScope(from.scope, `${where}.scope`),
    requestedBy: 'claude',
    requestedAt: timestamp(from, 'requestedAt', where),
    knownClaims: array(from, 'knownClaims', where).map((entry, index) =>
      parseKnownClaim(entry, `${where}.knownClaims[${index}]`)),
    notes: optionalStr(from, 'notes'),
  };
}

/**
 * Parses one research pass's findings.
 *
 * `conflicted` is rejected here rather than accepted and ignored: a researcher
 * that could send it would be making a merge decision, and the merge is the only
 * thing positioned to see every claim on a field at once.
 */
export function parseDelta(value: unknown, where = 'delta'): ResearchDelta {
  const from = record(value, where);

  const researcher = from.researcher;
  if (researcher !== 'hermes') {
    fail(
      `${where}.researcher`,
      `must be "hermes", got ${JSON.stringify(researcher)}. ` +
        'Research entering the artifact is attributed to the agent that did it.',
    );
  }

  const sources = array(from, 'sources', where).map((entry, index) =>
    parseSource(entry, `${where}.sources[${index}]`));
  const claims = dedupeClaims(array(from, 'claims', where).map((entry, index) =>
    parseClaim(entry, `${where}.claims[${index}]`)));
  const assets = array(from, 'assets', where).map((entry, index) =>
    parseAsset(entry, `${where}.assets[${index}]`));

  rejectConflictedClaims(where, claims);
  checkReferences(where, sources, claims, assets);

  return {
    schemaVersion: schemaVersion(from, where),
    requestId: str(from, 'requestId', where),
    researcher: 'hermes',
    researchedAt: timestamp(from, 'researchedAt', where),
    sources,
    claims,
    assets,
    gaps: array(from, 'gaps', where).map((entry, index) =>
      parseGap(entry, `${where}.gaps[${index}]`)),
    openQuestions: strArray(from, 'openQuestions', where),
    handoff: str(from, 'handoff', where),
    retiredClaimIds: strArray(from, 'retiredClaimIds', where),
  };
}

function parsePass(value: unknown, where: string): ResearchPass {
  const from = record(value, where);
  const added = record(from.added, `${where}.added`);
  const count = (key: string): number => {
    const raw = added[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
      fail(`${where}.added.${key}`, 'must be a non-negative number');
    }
    return Math.floor(raw);
  };

  const researcher = from.researcher;
  if (researcher !== 'hermes') {
    fail(`${where}.researcher`, `must be "hermes", got ${JSON.stringify(researcher)}`);
  }

  return {
    requestId: str(from, 'requestId', where),
    researcher: 'hermes',
    researchedAt: timestamp(from, 'researchedAt', where),
    scope: parseScope(from.scope, `${where}.scope`),
    added: {
      claims: count('claims'),
      sources: count('sources'),
      assets: count('assets'),
      gaps: count('gaps'),
    },
    retiredClaimIds: strArray(from, 'retiredClaimIds', where),
    handoff: str(from, 'handoff', where),
  };
}

function parseConflict(value: unknown, where: string): ResearchConflict {
  const from = record(value, where);
  const claimIds = strArray(from, 'claimIds', where);
  if (claimIds.length < 2) fail(`${where}.claimIds`, 'must name at least two claims');
  return { field: str(from, 'field', where), claimIds, note: str(from, 'note', where) };
}

/**
 * Parses a stored artifact.
 *
 * Applies the same reference and status rules as `parseDelta`, so an artifact
 * edited by hand is held to what the merge would have produced. The one relaxed
 * rule is `conflicted`, which is exactly what the merge is allowed to write.
 */
export function parseArtifact(value: unknown, where = 'artifact'): ResearchArtifact {
  const from = record(value, where);

  const researcher = from.researcher;
  if (researcher !== 'hermes') {
    fail(`${where}.researcher`, `must be "hermes", got ${JSON.stringify(researcher)}`);
  }

  const revision = from.revision;
  if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) {
    fail(`${where}.revision`, 'must be a non-negative integer');
  }

  const sources = array(from, 'sources', where).map((entry, index) =>
    parseSource(entry, `${where}.sources[${index}]`));
  const claims = dedupeClaims(array(from, 'claims', where).map((entry, index) =>
    parseClaim(entry, `${where}.claims[${index}]`)));
  const assets = array(from, 'assets', where).map((entry, index) =>
    parseAsset(entry, `${where}.assets[${index}]`));

  rejectConflictedClaims(where, claims);
  checkReferences(where, sources, claims, assets);

  const known = new Set(claims.map((claim) => claim.id));
  const conflicts = array(from, 'conflicts', where).map((entry, index) =>
    parseConflict(entry, `${where}.conflicts[${index}]`));
  for (const [index, conflict] of conflicts.entries()) {
    for (const id of conflict.claimIds) {
      if (!known.has(id)) {
        fail(`${where}.conflicts[${index}].claimIds`, `names "${id}", which is not a live claim`);
      }
    }
  }

  return {
    schemaVersion: schemaVersion(from, where),
    subject: parseSubject(from.subject, `${where}.subject`),
    researcher: 'hermes',
    revision,
    updatedAt: timestamp(from, 'updatedAt', where),
    passes: array(from, 'passes', where).map((entry, index) =>
      parsePass(entry, `${where}.passes[${index}]`)),
    sources,
    claims,
    conflicts,
    assets,
    gaps: array(from, 'gaps', where).map((entry, index) =>
      parseGap(entry, `${where}.gaps[${index}]`)),
    openQuestions: strArray(from, 'openQuestions', where),
    handoff: str(from, 'handoff', where),
  };
}
