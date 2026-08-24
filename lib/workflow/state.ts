/**
 * The ONE state vocabulary for the BusinessForge production job lifecycle.
 *
 * `ARCHITECTURE_FREEZE.md` (F-03) collapses the three incompatible stage
 * vocabularies that existed previously — `main.ts` STAGES (9), `JobStage` in
 * `jobState.ts` (16), `scripts/n8n/stage.ts` STAGES (16) — into a single
 * twelve-state machine. This module is that vocabulary, plus the legal
 * transition table that owns it.
 *
 * ## What belongs here and what does not
 *
 * This is the *names and structure* of the states. It owns no logic beyond
 * validating a transition. `JobStage` (main.ts), `JobStage` (jobState.ts), and
 * `STAGES` (stage.ts) remain untouched for now — the other P1 tasks migrate
 * their callers onto this vocabulary. Counters (`retry`/`rebuild`/`reconcept`),
 * the ledger, and Hermes's decision logic are P1-2/P1-3/P1-4.
 *
 * ## The twelve states (F-03, V2 §E)
 *
 * The nine pipeline stages in `main.ts` are *stage identifiers inside*
 * `EVIDENCE`/`UNDERSTANDING`/`BUILD` — they are pipeline steps, not job states,
 * and conflating the two is CP2. Each entry below is drawn verbatim from the
 * state table in V2 §E.
 */

/**
 * The twelve states a production job may occupy.
 *
 * Terminal states have no outgoing transitions; `validateTransition` rejects
 * every pair starting from a terminal.
 */
export const JOB_STATES = [
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
] as const;

export type JobState = (typeof JOB_STATES)[number];

/** True for the three states that absorb a job with no further action. */
export function isTerminal(state: JobState): boolean {
  return state === 'delivered' || state === 'escalated' || state === 'aborted';
}

/**
 * The reason a transition was taken, drawn from the stop-conditions / routing
 * table so a ledger row is interpretable without cross-referencing prose.
 *
 * The three counters (`retry`/`rebuild`/`reconcept`) surface here as *actions*
 * out of `decide`; the counters themselves live in the ledger (P1-4).
 */
export type TransitionReason =
  | 'budget-granted'
  | 'profile-written'
  | 'content-written'
  | 'plan-derived'
  | 'candidate-set-chosen'
  | 'batch-verified'
  | 'verdicts-recorded'
  | 'deliver'
  | 'escalate'
  | 'retry'
  | 'rebuild'
  | 'reconcept'
  | 'thin-evidence'
  | 'zero-survivors'
  | 'unrecoverable'
  | 'budget-exhausted'
  | 'minimum-viable-not-met'
  | 'bug';

export interface JobTransition {
  readonly from: JobState;
  readonly to: JobState;
  readonly reason: TransitionReason;
}

/**
 * The legal transition graph.
 *
 * Enumerated explicitly, fail-closed: `validateTransition` accepts exactly the
 * pairs listed here and throws on anything else (Freeze §U: "order is the
 * design"; §U.5: "Do NOT enter a state twice without incrementing iteration" —
 * the table encodes the only legal ways to move).
 *
 * Retry self-loops are present only for the stages that transiently fail and
 * re-enter themselves with the same inputs (§U RETRY: "same stage, same
 * inputs, possibly a different provider"). They are not a general "retry
 * anything" escape hatch — Hermes (P1-3) is the only thing that may pick a
 * retry target, and it may only pick one of these.
 *
 * Notes keyed to V2 §E "On failure → Next" and §U:
 *  - EVIDENCE: thin profile → ESCALATED; retries stay in EVIDENCE; total
 *    failure → ABORTED.
 *  - UNDERSTANDING: thin evidence → ESCALATED; retries stay in UNDERSTANDING;
 *    upstream fail → deterministic floor is *re-entered* at PLAN (model
 *    failure does not abort — the floor always works), so UNDERSTANDING never
 *    routes back to EVIDENCE on a model hiccup.
 *  - PLAN: a compose bug is REJECTED (ABORTED), a missing input is a fixable
 *    failure (re-enter EVIDENCE/UNDERSTANDING, not here).
 *  - DIVERGE: 0 survivors → ESCALATED (a gate that relaxes under pressure is
 *    decoration); never lowers its own threshold.
 *  - CANDIDATE_BUILD: an agent conflict is an unrecoverable invariant breach
 *    (ABORTED); a single candidate failing is marked failed but keeps the batch
 *    going (still progresses to VERIFY — no state change).
 *  - VERIFY → JUDGE unconditionally: the four deterministic QA disciplines
 *    either pass or disqualify a candidate; disqualification is recorded, not a
 *    state.
 *  - JUDGE → DECIDE unconditionally: verdicts are produced, then DECIDE applies
 *    them. `uncertain` blocks delivery — but that is a DECIDE outcome
 *    (uncertain → ESCALATE(no-visual-evidence)), not a JUDGE transition.
 *  - DECIDE emits the six stop conditions (§U, in order): ABORT, ESCALATE,
 *    DELIVER, RETRY (same stage), REBUILD (→ CANDIDATE_BUILD), RECONCEPT
 *    (→ DIVERGE). The ordering is what makes the machine terminating.
 *  - DELIVERED/ESCALATED/ABORTED are terminal. ESCALATED resumes only on
 *    `HumanResponded`, which is a P2/resume concern, not a state transition.
 */
export const TRANSITION_TABLE: readonly JobTransition[] = [
  // CREATED
  { from: 'created', to: 'evidence', reason: 'budget-granted' },
  { from: 'created', to: 'aborted', reason: 'minimum-viable-not-met' },

  // EVIDENCE (retry self-loop; thin → ESCALATED; total → ABORTED)
  { from: 'evidence', to: 'evidence', reason: 'retry' },
  { from: 'evidence', to: 'understanding', reason: 'profile-written' },
  { from: 'evidence', to: 'escalated', reason: 'thin-evidence' },
  { from: 'evidence', to: 'aborted', reason: 'unrecoverable' },

  // UNDERSTANDING (retry self-loop; thin → ESCALATED)
  { from: 'understanding', to: 'understanding', reason: 'retry' },
  { from: 'understanding', to: 'plan', reason: 'content-written' },
  { from: 'understanding', to: 'escalated', reason: 'thin-evidence' },
  { from: 'understanding', to: 'aborted', reason: 'unrecoverable' },

  // PLAN
  { from: 'plan', to: 'diverge', reason: 'plan-derived' },
  { from: 'plan', to: 'aborted', reason: 'bug' },

  // DIVERGE
  { from: 'diverge', to: 'candidate_build', reason: 'candidate-set-chosen' },
  { from: 'diverge', to: 'escalated', reason: 'zero-survivors' },

  // CANDIDATE_BUILD
  { from: 'candidate_build', to: 'candidate_build', reason: 'retry' },
  { from: 'candidate_build', to: 'verify', reason: 'candidate-set-chosen' },
  { from: 'candidate_build', to: 'aborted', reason: 'unrecoverable' },

  // VERIFY (batch completes → JUDGE; a disqualified candidate does not change state)
  { from: 'verify', to: 'verify', reason: 'retry' },
  { from: 'verify', to: 'judge', reason: 'batch-verified' },

  // JUDGE → DECIDE (verdicts produced; uncertain is handled at DECIDE)
  { from: 'judge', to: 'decide', reason: 'verdicts-recorded' },

  // DECIDE — the six stop conditions (§U), evaluated in order. Each outgoing
  // edge is one terminal branch or one loop/rebuild/reconcept.
  { from: 'decide', to: 'delivered', reason: 'deliver' },
  { from: 'decide', to: 'escalated', reason: 'escalate' },
  { from: 'decide', to: 'aborted', reason: 'budget-exhausted' },
  // RETRY re-enters the failing stage with the same inputs:
  { from: 'decide', to: 'evidence', reason: 'retry' },
  { from: 'decide', to: 'understanding', reason: 'retry' },
  { from: 'decide', to: 'verify', reason: 'retry' },
  { from: 'decide', to: 'judge', reason: 'retry' },
  // REBUILD: same concept, re-execute the build.
  { from: 'decide', to: 'candidate_build', reason: 'rebuild' },
  // RECONCEPT: a new concept — append new candidates, never mutate.
  { from: 'decide', to: 'diverge', reason: 'reconcept' },

  // Terminal states have NO outgoing edges.
] as const;

/**
 * A pair (from, to) that the caller asserts is legal.
 */
type LegalPair = readonly [JobState, JobState];

const LEGAL: Readonly<Set<string>> = new Set(
  TRANSITION_TABLE.map((t) => `${t.from}→${t.to}`),
);

/**
 * The reverse lookup Hermes (P1-3) and the Runner (P1) need: for a given
 * "continue" decision, which `from` state was the job actually in when it failed?
 * Kept here because it is a property of the state graph, not of Hermes's budget.
 */
export const RETRYABLE_FROM_DECIDE: readonly { to: JobState; label: string }[] = [
  { to: 'evidence', label: 'retry evidence (browser/identity transient)' },
  { to: 'understanding', label: 'retry understanding (model transient)' },
  { to: 'verify', label: 'retry verify (deterministic qa transient)' },
  { to: 'judge', label: 'retry judge (vision transient)' },
];

/**
 * Validates that `from → to` is an explicitly legal transition.
 *
 * Fails closed: anything not enumerated above throws. The error carries both
 * states and the reason "none", because a caller that hits this path has a bug
 * in its own transition logic — silence here would mask that bug as a job that
 * silently never terminates.
 *
 * @throws Error when the transition is not in `TRANSITION_TABLE`.
 */
export function validateTransition(from: JobState, to: JobState): void {
  if (from === to) {
    if (LEGAL.has(`${from}→${to}`)) return;
    throw new Error(
      `state.ts: illegal self-transition on "${from}" — self-loops are permitted only for retry at EVIDENCE/UNDERSTANDING/VERIFY/CANDIDATE_BUILD`,
    );
  }
  if (isTerminal(from)) {
    throw new Error(
      `state.ts: transition out of terminal state "${from}" is forbidden (to="${to}") — terminal states absorb without re-entry`,
    );
  }
  if (isTerminal(to) && LEGAL.has(`${from}→${to}`)) return;
  if (LEGAL.has(`${from}→${to}`)) return;
  throw new Error(
    `state.ts: illegal transition ${from}→${to} — not in the frozen transition table (Freeze F-03, V2 §E/§U)`,
  );
}

/**
 * The ordered list of stop-condition branches out of DECIDE, as the machine
 * evaluates them (§U "order is the design"). Exposed so Hermes (P1-3) and its
 * tests can assert it without re-declaring it.
 */
export const DECIDE_OUTCOMES: readonly { to: JobState; reason: Exclude<TransitionReason, 'retry'> }[] = [
  { to: 'delivered', reason: 'deliver' },
  { to: 'escalated', reason: 'escalate' },
  { to: 'aborted', reason: 'budget-exhausted' },
  { to: 'candidate_build', reason: 'rebuild' },
  { to: 'diverge', reason: 'reconcept' },
] as const;
