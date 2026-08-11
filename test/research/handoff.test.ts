/**
 * The Claude ↔ Hermes research handoff.
 *
 * Four properties carry the whole design, and they are what these suites are
 * for:
 *
 *   - **Nothing unattributed can be stored.** The validation suite is the
 *     product promise ("never invent a fact about a customer's business")
 *     expressed as a set of things that fail.
 *   - **The merge is deterministic and idempotent.** An artifact is committed to
 *     git, so a merge that reordered its output or double-counted a re-filed
 *     answer would corrupt the record rather than a run.
 *   - **Research is incremental.** A second pass must be told what not to
 *     re-research, and that has to be derived from the artifact rather than
 *     remembered by a session.
 *   - **A later session resumes from disk.** The last suite is the success
 *     criterion of the milestone, written as a test: two calls sharing no state
 *     but a directory.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  applyAnswerFile,
  buildRequest,
  claimId,
  computeConflicts,
  createHermesClient,
  emptyArtifact,
  hermesClientFor,
  listRequests,
  loadArtifact,
  mcpTransport,
  mergeResearch,
  openRequest,
  parseArtifact,
  parseDelta,
  projectProvenance,
  requestId,
  researchBrief,
  settledFields,
  slugify,
  unwrapMcpResult,
} from '../../lib/research/index.js';

import type {
  McpCaller,
  ResearchArtifact,
  ResearchDelta,
  ResearchSubject,
} from '../../lib/research/index.js';
import type { CapabilityOutcome } from '../../lib/platform/types.js';

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const SUBJECT: ResearchSubject = {
  key: 'river-park-events',
  name: 'River Park Events',
  locality: 'Cluj-Napoca',
  homepage: null,
  mapsUrl: 'https://maps.app.goo.gl/example',
};

const T1 = '2026-08-11T09:00:00.000Z';
const T2 = '2026-08-11T11:00:00.000Z';

/** A delta as it arrives off the wire: plain JSON, no ids computed for claims. */
function rawDelta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    requestId: 'r-test',
    researcher: 'hermes',
    researchedAt: T1,
    sources: [
      {
        id: 's1',
        url: 'https://riverpark.example/about',
        kind: 'website',
        publisher: 'River Park Events',
        retrievedAt: T1,
        access: 'ok',
        note: null,
      },
    ],
    claims: [
      {
        topic: 'facilities',
        field: 'outdoor-space',
        value: 'Riverside terrace seating 120',
        sourceIds: ['s1'],
        excerpt: 'Our riverside terrace seats up to 120 guests.',
        status: 'verified',
        confidence: 'high',
        note: null,
        observedAt: T1,
      },
    ],
    assets: [],
    gaps: [],
    openQuestions: [],
    handoff: 'Terrace capacity established from the venue site.',
    retiredClaimIds: [],
    ...overrides,
  };
}

/** Applies a delta to an empty artifact and returns the result. */
function merged(delta: ResearchDelta, previous?: ResearchArtifact): ResearchArtifact {
  const base = previous ?? emptyArtifact(SUBJECT);
  return mergeResearch(base, delta, { query: 'q', fields: [], excludeFields: [] }).artifact;
}

async function tempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'bf-research-'));
}

/* ------------------------------------------------------------------ */
/* Validation — what cannot be stored                                  */
/* ------------------------------------------------------------------ */

describe('validation refuses unattributed research', () => {
  it('accepts a well-formed delta', () => {
    const delta = parseDelta(rawDelta());
    assert.equal(delta.claims.length, 1);
    assert.equal(delta.claims[0]?.status, 'verified');
  });

  it('rejects a claim with no source', () => {
    const raw = rawDelta({
      claims: [{ ...(rawDelta().claims as unknown[])[0] as object, sourceIds: [] }],
    });
    assert.throws(() => parseDelta(raw), /at least one source/);
  });

  it('rejects a claim naming a source that was not declared', () => {
    const raw = rawDelta({
      claims: [{ ...(rawDelta().claims as unknown[])[0] as object, sourceIds: ['ghost'] }],
    });
    assert.throws(() => parseDelta(raw), /not declared in sources/);
  });

  it('rejects "verified" when every source was blocked', () => {
    const raw = rawDelta({
      sources: [
        {
          id: 's1',
          url: 'https://instagram.com/riverpark',
          kind: 'social',
          publisher: null,
          retrievedAt: T1,
          access: 'blocked',
          note: 'login wall',
        },
      ],
    });
    assert.throws(() => parseDelta(raw), /none of its sources was readable/);
  });

  it('rejects "corroborated" backed by a single readable source', () => {
    const raw = rawDelta({
      claims: [
        { ...(rawDelta().claims as unknown[])[0] as object, status: 'corroborated' },
      ],
    });
    assert.throws(() => parseDelta(raw), /corroboration needs two/);
  });

  it('rejects an inference with no reasoning', () => {
    const raw = rawDelta({
      claims: [
        { ...(rawDelta().claims as unknown[])[0] as object, status: 'inferred', note: null },
      ],
    });
    assert.throws(() => parseDelta(raw), /required when status is "inferred"/);
  });

  it('rejects a blocked source that does not say why', () => {
    const raw = rawDelta({
      sources: [
        {
          id: 's1',
          url: 'https://x.example',
          kind: 'social',
          publisher: null,
          retrievedAt: T1,
          access: 'blocked',
          note: null,
        },
      ],
      claims: [],
    });
    assert.throws(() => parseDelta(raw), /required when access is "blocked"/);
  });

  it('refuses to let a researcher declare a conflict', () => {
    const raw = rawDelta({
      claims: [{ ...(rawDelta().claims as unknown[])[0] as object, status: 'conflicted' }],
    });
    assert.throws(() => parseDelta(raw), /property of a field/);
  });

  it('refuses research attributed to anyone but hermes', () => {
    assert.throws(() => parseDelta(rawDelta({ researcher: 'claude' })), /must be "hermes"/);
  });

  it('refuses an artifact written by another revision of the contract', () => {
    assert.throws(() => parseDelta(rawDelta({ schemaVersion: 99 })), /schemaVersion/);
  });

  it('rejects an asset whose source was not declared', () => {
    const raw = rawDelta({
      assets: [
        { id: 'a1', url: 'https://x.example/p.jpg', kind: 'photo', sourceId: 'ghost' },
      ],
    });
    assert.throws(() => parseDelta(raw), /not declared in sources/);
  });
});

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

describe('identity is derived from content', () => {
  it('gives the same claim the same id', () => {
    assert.equal(claimId('phone', '+40 264 123456', ['s1']), claimId('phone', '+40 264 123456', ['s1']));
  });

  it('gives a different value a different id', () => {
    assert.notEqual(claimId('phone', 'a', ['s1']), claimId('phone', 'b', ['s1']));
  });

  it('does not depend on the order sources were listed in', () => {
    assert.equal(claimId('phone', 'a', ['s2', 's1']), claimId('phone', 'a', ['s1', 's2']));
  });

  it('cannot be collided by moving text across the field/value boundary', () => {
    assert.notEqual(claimId('a', 'b|c', ['s1']), claimId('a|b', 'c', ['s1']));
  });

  it('derives the same request id from the same question', () => {
    assert.equal(
      requestId('river-park-events', 'outdoor space?', ['outdoor-space']),
      requestId('river-park-events', 'outdoor space?', ['outdoor-space']),
    );
  });

  it('ignores a claim id supplied by the producer', () => {
    const raw = rawDelta({
      claims: [{ ...(rawDelta().claims as unknown[])[0] as object, id: 'whatever-i-like' }],
    });
    const delta = parseDelta(raw);
    assert.equal(
      delta.claims[0]?.id,
      claimId('outdoor-space', 'Riverside terrace seating 120', ['s1']),
    );
  });

  it('folds diacritics rather than dropping them', () => {
    assert.equal(slugify('Café Nord'), 'cafe-nord');
    assert.equal(slugify('  River Park  Events '), 'river-park-events');
  });
});

/* ------------------------------------------------------------------ */
/* Merge                                                               */
/* ------------------------------------------------------------------ */

describe('merging one pass into the artifact', () => {
  it('records the pass and its provenance', () => {
    const artifact = merged(parseDelta(rawDelta()));
    assert.equal(artifact.revision, 1);
    assert.equal(artifact.passes.length, 1);
    assert.equal(artifact.passes[0]?.researcher, 'hermes');
    assert.equal(artifact.passes[0]?.added.claims, 1);
    assert.equal(artifact.updatedAt, T1);
  });

  it('is idempotent: the same pass filed twice changes nothing', () => {
    const delta = parseDelta(rawDelta());
    const once = merged(delta);
    const twice = mergeResearch(once, delta, { query: 'q', fields: [], excludeFields: [] });

    assert.equal(twice.applied, false);
    assert.deepEqual(twice.artifact, once);
  });

  it('serialises identically from identical inputs', () => {
    const delta = parseDelta(rawDelta());
    assert.equal(JSON.stringify(merged(delta)), JSON.stringify(merged(delta)));
  });

  it('carries no value that moves between runs', () => {
    const serialised = JSON.stringify(merged(parseDelta(rawDelta())));
    // Every timestamp in the artifact must have come from the delta.
    const stamps = serialised.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g) ?? [];
    assert.ok(stamps.length > 0);
    assert.ok(stamps.every((stamp) => stamp === T1));
  });

  it('keeps both sides when sources disagree, and picks no winner', () => {
    const first = merged(parseDelta(rawDelta()));

    const second = merged(
      parseDelta(
        rawDelta({
          requestId: 'r-two',
          researchedAt: T2,
          sources: [
            {
              id: 's2',
              url: 'https://directory.example/river-park',
              kind: 'directory',
              publisher: 'A directory',
              retrievedAt: T2,
              access: 'ok',
              note: null,
            },
          ],
          claims: [
            {
              topic: 'facilities',
              field: 'outdoor-space',
              value: 'Terrace seating 80',
              sourceIds: ['s2'],
              excerpt: 'Terrace, 80 seats.',
              status: 'verified',
              confidence: 'medium',
              note: null,
              observedAt: T2,
            },
          ],
          handoff: 'A directory disagrees about terrace capacity.',
        }),
      ),
      first,
    );

    assert.equal(second.claims.length, 2, 'both claims are kept');
    assert.equal(second.conflicts.length, 1);
    assert.equal(second.conflicts[0]?.field, 'outdoor-space');
    assert.equal(second.conflicts[0]?.claimIds.length, 2);
    // Neither claim was downgraded for being in a conflict.
    assert.ok(second.claims.every((claim) => claim.status === 'verified'));
  });

  it('drops a conflict when one side is retired', () => {
    const first = merged(parseDelta(rawDelta()));
    const target = first.claims[0]?.id ?? '';

    const second = merged(
      parseDelta(
        rawDelta({
          requestId: 'r-two',
          researchedAt: T2,
          claims: [],
          sources: [],
          retiredClaimIds: [target],
          handoff: 'The venue site was corrected; the earlier figure is withdrawn.',
        }),
      ),
      first,
    );

    assert.equal(second.claims.length, 0);
    assert.equal(second.conflicts.length, 0);
    assert.deepEqual(second.passes[1]?.retiredClaimIds, [target]);
  });

  it('drops a gap once a claim answers it', () => {
    const withGap = merged(
      parseDelta(
        rawDelta({
          claims: [],
          gaps: [{ field: 'outdoor-space', lookedFor: 'terrace capacity', why: 'not published' }],
          handoff: 'Terrace capacity is not published anywhere I could read.',
        }),
      ),
    );
    assert.equal(withGap.gaps.length, 1);

    const answered = merged(
      parseDelta(rawDelta({ requestId: 'r-two', researchedAt: T2 })),
      withGap,
    );
    assert.equal(answered.gaps.length, 0, 'an answered gap is no longer a gap');
  });

  it('lets a later pass replace what is known about a source', () => {
    const blockedFirst = merged(
      parseDelta(
        rawDelta({
          claims: [],
          sources: [
            {
              id: 's1',
              url: 'https://riverpark.example/about',
              kind: 'website',
              publisher: null,
              retrievedAt: T1,
              access: 'blocked',
              note: 'bot check',
            },
          ],
          handoff: 'Blocked by a bot check.',
        }),
      ),
    );
    assert.equal(blockedFirst.sources[0]?.access, 'blocked');

    const now = merged(parseDelta(rawDelta({ requestId: 'r-two', researchedAt: T2 })), blockedFirst);
    assert.equal(now.sources.length, 1, 'the same source is not stored twice');
    assert.equal(now.sources[0]?.access, 'ok', 'a wall that came down stops reading as blocked');
  });

  it('computes conflicts from claims alone', () => {
    const artifact = merged(parseDelta(rawDelta()));
    assert.deepEqual(computeConflicts(artifact.claims), []);
  });

  it('survives a JSON round trip', () => {
    const artifact = merged(parseDelta(rawDelta()));
    const clone = parseArtifact(JSON.parse(JSON.stringify(artifact)));
    assert.deepEqual(clone, artifact);
  });
});

/* ------------------------------------------------------------------ */
/* Incremental research                                                */
/* ------------------------------------------------------------------ */

describe('a second pass is told what not to research', () => {
  const artifact = merged(parseDelta(rawDelta()));

  it('treats an attested, uncontested field as settled', () => {
    assert.deepEqual(settledFields(artifact), ['outdoor-space']);
  });

  it('does not treat an inference as settled', () => {
    const inferred = merged(
      parseDelta(
        rawDelta({
          claims: [
            {
              topic: 'facilities',
              field: 'capacity',
              value: 'about 150',
              sourceIds: ['s1'],
              excerpt: null,
              status: 'inferred',
              confidence: 'low',
              note: 'Estimated from photographs of the room.',
              observedAt: T1,
            },
          ],
        }),
      ),
    );
    assert.deepEqual(settledFields(inferred), []);
  });

  it('excludes settled fields from the next request', () => {
    const request = buildRequest({
      subject: SUBJECT,
      query: 'Find the hotel capacity and official contact details.',
      fields: ['capacity', 'contact-email'],
      artifact,
      requestedAt: T2,
      notes: null,
    });

    assert.deepEqual(request.scope.excludeFields, ['outdoor-space']);
    assert.deepEqual(request.scope.fields, ['capacity', 'contact-email']);
  });

  it('never excludes a field the caller explicitly asked about again', () => {
    const request = buildRequest({
      subject: SUBJECT,
      query: 'Has the terrace capacity changed?',
      fields: ['outdoor-space'],
      artifact,
      requestedAt: T2,
      notes: null,
    });

    assert.deepEqual(request.scope.excludeFields, []);
    assert.equal(request.knownClaims.length, 1, 'the current value travels with the question');
    assert.equal(request.knownClaims[0]?.value, 'Riverside terrace seating 120');
  });

  it('gives two sessions asking the same question the same request id', () => {
    const options = {
      subject: SUBJECT,
      query: 'Find the capacity.',
      fields: ['capacity'],
      artifact,
      requestedAt: T2,
      notes: null,
    };
    assert.equal(
      buildRequest(options).requestId,
      buildRequest({ ...options, requestedAt: '2026-09-01T00:00:00.000Z' }).requestId,
      'the id is the question, not the moment it was asked',
    );
  });
});

/* ------------------------------------------------------------------ */
/* Projection                                                          */
/* ------------------------------------------------------------------ */

describe('projecting research into provenance', () => {
  it('resolves source ids to URLs and keeps them attached', () => {
    const provenance = projectProvenance(merged(parseDelta(rawDelta())));
    assert.equal(provenance.settled.length, 1);
    assert.deepEqual(provenance.settled[0]?.values[0]?.sourceUrls, [
      'https://riverpark.example/about',
    ]);
  });

  it('keeps a contested field out of the settled list', () => {
    const first = merged(parseDelta(rawDelta()));
    const second = merged(
      parseDelta(
        rawDelta({
          requestId: 'r-two',
          researchedAt: T2,
          sources: [
            {
              id: 's2',
              url: 'https://directory.example/rp',
              kind: 'directory',
              publisher: null,
              retrievedAt: T2,
              access: 'ok',
              note: null,
            },
          ],
          claims: [
            {
              topic: 'facilities',
              field: 'outdoor-space',
              value: 'Terrace seating 80',
              sourceIds: ['s2'],
              excerpt: null,
              status: 'verified',
              confidence: 'medium',
              note: null,
              observedAt: T2,
            },
          ],
        }),
      ),
      first,
    );

    const provenance = projectProvenance(second);
    assert.deepEqual(provenance.settled, []);
    assert.equal(provenance.contested.length, 1);
    assert.equal(provenance.contested[0]?.values.length, 2);
  });

  it('carries blocked sources through, so downstream knows what was not seen', () => {
    const artifact = merged(
      parseDelta(
        rawDelta({
          claims: [],
          sources: [
            {
              id: 's1',
              url: 'https://instagram.com/riverpark',
              kind: 'social',
              publisher: null,
              retrievedAt: T1,
              access: 'blocked',
              note: 'login wall',
            },
          ],
          handoff: 'Instagram is behind a login wall.',
        }),
      ),
    );

    const provenance = projectProvenance(artifact);
    assert.equal(provenance.blockedSources.length, 1);
    assert.equal(provenance.blockedSources[0]?.note, 'login wall');
  });

  it('is deterministic', () => {
    const artifact = merged(parseDelta(rawDelta()));
    assert.equal(
      JSON.stringify(projectProvenance(artifact)),
      JSON.stringify(projectProvenance(artifact)),
    );
  });
});

/* ------------------------------------------------------------------ */
/* The Hermes client                                                   */
/* ------------------------------------------------------------------ */

describe('asking Hermes', () => {
  const request = buildRequest({
    subject: SUBJECT,
    query: 'Find the terrace capacity.',
    fields: ['outdoor-space'],
    artifact: null,
    requestedAt: T1,
    notes: null,
  });

  /** An MCP manager stub: only the two methods the transport touches. */
  function caller(reply: CapabilityOutcome<unknown>, registered = true): McpCaller {
    return {
      has: () => registered,
      execute: async () => reply,
    };
  }

  it('reports a reason instead of throwing when nothing is configured', async () => {
    const outcome = await createHermesClient({ transport: null }).research(request);
    assert.equal(outcome.ok, false);
    if (outcome.ok) return;
    assert.equal(outcome.error.code, 'not_registered');
    assert.match(outcome.error.message, /has been filed/);
  });

  it('reports no transport when no server is registered under the id', () => {
    assert.equal(hermesClientFor(caller({ ok: true, data: {}, durationMs: 0 }, false)).transport, null);
  });

  it('never returns an empty result in place of a failure', async () => {
    const outcome = await createHermesClient({ transport: null }).research(request);
    assert.equal(outcome.ok, false);
    assert.ok(!('data' in outcome), 'a failure carries no data a caller could mistake for findings');
  });

  it('accepts a delta in structuredContent', () => {
    assert.deepEqual(
      unwrapMcpResult({ structuredContent: { schemaVersion: 1 }, content: [] }),
      { schemaVersion: 1 },
    );
  });

  it('accepts a delta as JSON in a text block', () => {
    assert.deepEqual(
      unwrapMcpResult({ content: [{ type: 'text', text: '{"schemaVersion":1}' }] }),
      { schemaVersion: 1 },
    );
  });

  it('accepts a delta returned directly', () => {
    assert.deepEqual(unwrapMcpResult({ schemaVersion: 1 }), { schemaVersion: 1 });
  });

  it('refuses to parse findings out of a tool error', () => {
    assert.throws(
      () => unwrapMcpResult({ isError: true, content: [{ type: 'text', text: 'rate limited' }] }),
      /rate limited/,
    );
  });

  it('turns a transport failure into an upstream outcome', async () => {
    const client = createHermesClient({
      transport: mcpTransport(
        caller({
          ok: false,
          error: {
            code: 'upstream',
            message: 'connection refused',
            capability: { kind: 'mcp', id: 'hermes' },
            retryable: true,
            details: {},
          },
          durationMs: 1,
        }),
      ),
    });

    const outcome = await client.research(request);
    assert.equal(outcome.ok, false);
    if (outcome.ok) return;
    assert.equal(outcome.error.code, 'upstream');
    assert.match(outcome.error.message, /connection refused/);
  });

  it('rejects an answer to a different question', async () => {
    const client = createHermesClient({
      transport: mcpTransport(
        caller({ ok: true, data: rawDelta({ requestId: 'r-something-else' }), durationMs: 1 }),
      ),
    });

    const outcome = await client.research(request);
    assert.equal(outcome.ok, false);
    if (outcome.ok) return;
    assert.match(outcome.error.message, /but "r-/);
  });

  it('returns a parsed delta when the server answers correctly', async () => {
    const client = createHermesClient({
      transport: mcpTransport(
        caller({ ok: true, data: rawDelta({ requestId: request.requestId }), durationMs: 1 }),
      ),
    });

    const outcome = await client.research(request);
    assert.equal(outcome.ok, true);
    if (!outcome.ok) return;
    assert.equal(outcome.data.claims.length, 1);
    assert.equal(outcome.data.researcher, 'hermes');
  });
});

/* ------------------------------------------------------------------ */
/* Resume — the success criterion                                      */
/* ------------------------------------------------------------------ */

describe('a later session resumes from disk', () => {
  it('files a request that outlives the session that asked', async () => {
    const root = await tempRoot();

    // Session one: identifies a gap, files it, gets no answer (no transport).
    const first = await openRequest({
      root,
      subject: SUBJECT,
      query: 'Research the outdoor space, hotel capacity and official contact details.',
      fields: ['outdoor-space', 'capacity', 'contact-email'],
      notes: null,
      now: T1,
      client: createHermesClient({ transport: null }),
    });

    assert.equal(first.answered, null);
    assert.equal(first.unanswered?.code, 'not_registered');
    assert.match(first.prompt, /Research the outdoor space/);

    // …and dies. Nothing of session one survives but the directory.
    const open = await listRequests(root);
    assert.equal(open.length, 1);
    assert.equal(open[0]?.requestId, first.request.requestId);

    await fs.rm(root, { recursive: true, force: true });
  });

  it('merges an answer filed by a different session, and reads it back', async () => {
    const root = await tempRoot();

    const asked = await openRequest({
      root,
      subject: SUBJECT,
      query: 'Research the terrace capacity.',
      fields: ['outdoor-space'],
      notes: null,
      now: T1,
      client: null,
    });

    // Session two, sharing no state: Hermes has written an answer to a file.
    const answerPath = path.join(root, 'incoming.json');
    await fs.writeFile(
      answerPath,
      JSON.stringify(rawDelta({ requestId: asked.request.requestId })),
      'utf8',
    );

    const applied = await applyAnswerFile({ root, deltaPath: answerPath });
    assert.equal(applied.applied, true);
    assert.equal(applied.artifact.revision, 1);

    // The question is closed, so a third session does not ask it again.
    assert.deepEqual(await listRequests(root), []);

    // Session three: knows only the directory and the key.
    const resumed = await loadArtifact(root, SUBJECT.key);
    assert.ok(resumed !== null);
    assert.equal(resumed.claims.length, 1);
    assert.equal(resumed.claims[0]?.value, 'Riverside terrace seating 120');
    assert.equal(resumed.passes[0]?.scope.query, 'Research the terrace capacity.');

    const brief = researchBrief(resumed);
    assert.match(brief, /River Park Events/);
    assert.match(brief, /Riverside terrace seating 120/);
    assert.match(brief, /riverpark\.example\/about/);

    // And can pick up exactly where session one left off.
    const next = buildRequest({
      subject: resumed.subject,
      query: 'Now find the capacity.',
      fields: ['capacity'],
      artifact: resumed,
      requestedAt: T2,
      notes: null,
    });
    assert.deepEqual(next.scope.excludeFields, ['outdoor-space']);

    await fs.rm(root, { recursive: true, force: true });
  });

  it('refuses an answer to a question nobody asked', async () => {
    const root = await tempRoot();
    const answerPath = path.join(root, 'orphan.json');
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(answerPath, JSON.stringify(rawDelta()), 'utf8');

    await assert.rejects(
      () => applyAnswerFile({ root, deltaPath: answerPath }),
      /no recorded question/,
    );

    await fs.rm(root, { recursive: true, force: true });
  });

  it('re-filing the same answer does not double-count it', async () => {
    const root = await tempRoot();

    const asked = await openRequest({
      root,
      subject: SUBJECT,
      query: 'Research the terrace capacity.',
      fields: ['outdoor-space'],
      notes: null,
      now: T1,
      client: null,
    });

    const answerPath = path.join(root, 'incoming.json');
    await fs.writeFile(
      answerPath,
      JSON.stringify(rawDelta({ requestId: asked.request.requestId })),
      'utf8',
    );

    const once = await applyAnswerFile({ root, deltaPath: answerPath });
    // The request is closed now, so applying again has to reopen the path a
    // crashed session would take: re-file the question, then re-apply.
    await openRequest({
      root,
      subject: SUBJECT,
      query: 'Research the terrace capacity.',
      fields: ['outdoor-space'],
      notes: null,
      now: T2,
      client: null,
    });
    const twice = await applyAnswerFile({ root, deltaPath: answerPath });

    assert.equal(twice.applied, false);
    assert.equal(twice.artifact.revision, once.artifact.revision);
    assert.equal(twice.artifact.claims.length, 1);

    await fs.rm(root, { recursive: true, force: true });
  });
});
