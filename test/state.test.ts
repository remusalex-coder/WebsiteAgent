/**
 * P1-1 — the one state vocabulary (F-03).
 *
 * Table-driven over all 12×12 pairs: every legal transition is asserted
 * accepted, every illegal one is asserted to throw, and the terminal states are
 * asserted to have no outgoing edges. A failure here is a contract breach of
 * the frozen state machine, not a runtime fluke — fail closed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  JOB_STATES,
  TRANSITION_TABLE,
  isTerminal,
  validateTransition,
  DECIDE_OUTCOMES,
  RETRYABLE_FROM_DECIDE,
} from '../lib/workflow/state.js';

import type { JobState, JobTransition } from '../lib/workflow/state.js';

const LEGAL: Readonly<Set<string>> = new Set(TRANSITION_TABLE.map((t) => `${t.from}→${t.to}`));

const legalPairs: readonly [JobState, JobState][] = TRANSITION_TABLE.map((t) => [t.from, t.to]);

test('JOB_STATES has exactly the 12 frozen states, in the V2 §E order', () => {
  assert.deepEqual(JOB_STATES, [
    'created',
    'evidence',
    'understanding',
    'plan',
    'diverge',
    'candidate_build',
    'verify',
    'judge',
    'decide',
    'delivered',
    'escalated',
    'aborted',
  ] as const);
});

test('the three terminal states are exactly DELIVERED, ESCALATED, ABORTED', () => {
  const terminals = JOB_STATES.filter(isTerminal);
  assert.deepEqual(terminals, ['delivered', 'escalated', 'aborted']);
});

test('no transition in the table originates from or targets a non-declared state', () => {
  const declared = new Set(JOB_STATES);
  for (const t of TRANSITION_TABLE) {
    assert.ok(declared.has(t.from), `table references undeclared state "${t.from}"`);
    assert.ok(declared.has(t.to), `table references undeclared state "${t.to}"`);
  }
});

test('terminal states have NO outgoing edges in the table', () => {
  for (const terminal of ['delivered', 'escalated', 'aborted'] as const) {
    const outgoing = TRANSITION_TABLE.filter((t) => t.from === terminal);
    assert.equal(outgoing.length, 0, `terminal "${terminal}" must not transition out`);
  }
});

test('transitions into a terminal state are legal', () => {
  for (const terminal of ['delivered', 'escalated', 'aborted'] as const) {
    const incoming = TRANSITION_TABLE.filter((t) => t.to === terminal);
    assert.ok(incoming.length > 0, `terminal "${terminal}" must be reachable`);
  }
});

test('validateTransition accepts every enumerated transition', () => {
  for (const [from, to] of legalPairs) {
    assert.doesNotThrow(
      () => validateTransition(from, to),
      `legal transition ${from}→${to} must not throw`,
    );
  }
});

test('validateTransition throws on the self-loops that are NOT allowed', () => {
  // Only EVIDENCE / UNDERSTANDING / VERIFY / CANDIDATE_BUILD permit retry self-loops.
  const allowedSelfLoops = new Set(['evidence', 'understanding', 'verify', 'candidate_build']);
  for (const state of JOB_STATES) {
    if (state === 'decide') continue; // DECIDE's self-loop handled below as illegal
    if (state === 'plan' || state === 'diverge' || state === 'judge') {
      // These have no self-loop at all — entering twice is a bug.
      assert.throws(() => validateTransition(state, state), /illegal/);
      continue;
    }
    if (allowedSelfLoops.has(state)) {
      assert.doesNotThrow(() => validateTransition(state, state));
    } else {
      // created / delivered / escalated / aborted: terminals handled below.
      assert.throws(() => validateTransition(state, state));
    }
  }
});

test('validateTransition throws on every unenrolled pair (fail closed)', () => {
  let illegalCount = 0;
  for (const from of JOB_STATES) {
    for (const to of JOB_STATES) {
      const key = `${from}→${to}`;
      if (LEGAL.has(key)) continue;
      illegalCount += 1;
      assert.throws(
        () => validateTransition(from as JobState, to as JobState),
        /illegal transition|terminal|self-loop/,
        `illegal transition ${from}→${to} must throw`,
      );
    }
  }
  // Sanity: 12 states = 144 pairs; legal pairs are few (count them explicitly).
  assert.ok(illegalCount > 100, `expected >100 illegal pairs, got ${illegalCount}`);
});

test('the DECIDE stop-condition table matches §U exactly', () => {
  // Five ordered branches out of DECIDE (ABORT is the budget-exhaustion branch,
  // which is terminal — it is in DECIDE_OUTCOMES as aborted).
  assert.deepEqual(
    DECIDE_OUTCOMES.map((o) => `${o.to}:${o.reason}`),
    ['delivered:deliver', 'escalated:escalate', 'aborted:budget-exhausted', 'candidate_build:rebuild', 'diverge:reconcept'],
  );
});

test('RETRYABLE_FROM_DECIDE enumerates exactly the four stages retry may re-enter (§U RETRY)', () => {
  assert.deepEqual(
    RETRYABLE_FROM_DECIDE.map((r) => r.to),
    ['evidence', 'understanding', 'verify', 'judge'],
  );
  // Each must actually be legal from decide (retry edge exists in the table).
  for (const { to } of RETRYABLE_FROM_DECIDE) {
    assert.ok(LEGAL.has(`decide→${to}`), `retry target "${to}" must be reachable from decide`);
  }
});

test('every transition has a reason, and the reasons are the frozen vocabulary', () => {
  const frozenReasons = new Set<JobTransition['reason']>([
    'budget-granted',
    'profile-written',
    'content-written',
    'plan-derived',
    'candidate-set-chosen',
    'batch-verified',
    'verdicts-recorded',
    'deliver',
    'escalate',
    'retry',
    'rebuild',
    'reconcept',
    'thin-evidence',
    'zero-survivors',
    'unrecoverable',
    'budget-exhausted',
    'minimum-viable-not-met',
    'bug',
  ]);
  for (const t of TRANSITION_TABLE) {
    assert.ok(frozenReasons.has(t.reason), `unknown reason "${t.reason}" on ${t.from}→${t.to}`);
  }
});

test('a reconstructed legal path reaches DELIVERED (terminating path exists)', () => {
  const path: readonly [JobState, JobState][] = [
    ['created', 'evidence'],
    ['evidence', 'understanding'],
    ['understanding', 'plan'],
    ['plan', 'diverge'],
    ['diverge', 'candidate_build'],
    ['candidate_build', 'verify'],
    ['verify', 'judge'],
    ['judge', 'decide'],
    ['decide', 'delivered'],
  ];
  for (const [from, to] of path) {
    assert.doesNotThrow(() => validateTransition(from, to), `path edge ${from}→${to} must be legal`);
  }
  assert.equal(isTerminal('delivered'), true);
});

test('the reconcept loop path returns to DIVERGE without mutating (§K, §E.4)', () => {
  // DECIDE → DIVERGE (reconcept) is legal; DECIDE must not re-enter BUILD/PLAN
  // directly without going through DIVERGE again. Retry into the four retryable
  // stages (§U RETRY) stays legal — that is a different branch, not a mutation.
  assert.doesNotThrow(() => validateTransition('decide', 'diverge'));
  assert.doesNotThrow(() => validateTransition('decide', 'understanding'));
  assert.throws(() => validateTransition('decide', 'plan'), /illegal/);
  assert.throws(() => validateTransition('decide', 'created'), /illegal/);
});
