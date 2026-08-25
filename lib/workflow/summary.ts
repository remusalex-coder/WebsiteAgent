/**
 * The read model behind BusinessForge's control surface (mandate section 16
 * / WORK_QUEUE.json WQ-014).
 *
 * `job.json` (`jobState.ts`) is already the single source of truth for one
 * run's lifecycle. This module does not add a second one — it is a pure
 * projection of that real, persisted state into a shape worth showing a
 * human: current stage, phase statuses, which workers were actually called
 * and whether they answered, the design-battle outcome, and what is still
 * wrong. Nothing here is invented or estimated; a field is `null`/empty
 * exactly when the job has not reached the point that would populate it.
 *
 * Kept separate from every presentation that reads it — `scripts/status.ts`
 * (CLI) and `scripts/n8n/stage-server.ts`'s `GET /job`/`GET /jobs`/`GET /`
 * control-surface page all call into this module rather than each computing
 * their own notion of "which providers failed" or "is the battle done" —
 * so the read model itself is what gets tested, not a script's stdout
 * formatting or an HTTP handler's inline JSON-shaping.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { loadJob } from './jobState.js';
import { loadIndex } from './candidates.js';
import { abstractStageOf } from './stageMapping.js';

import type { JobDecision, JobStage, JobState, PhaseStatus, WorkerCall } from './jobState.js';
import type { JobState as AbstractJobState } from './state.js';

const SOURCE = 'workflow.summary';

/** How many of a job's most recent failed worker calls to surface — enough to see a pattern, not a full log dump. */
const RECENT_FAILURES_LIMIT = 5;

export interface WorkerTally {
  readonly ok: number;
  readonly failed: number;
}

export interface WorkerSummary {
  readonly total: number;
  readonly ok: number;
  readonly failed: number;
  /** Per-provider tally, `null` provider (deterministic-floor calls) keyed as `'(deterministic)'`. */
  readonly byProvider: Readonly<Record<string, WorkerTally>>;
  /** The most recent failed calls, oldest of the kept set first — enough to see whether one vendor is flapping. */
  readonly recentFailures: readonly WorkerCall[];
}

/** The diverge-stage design battle, when the job reached it — see `scripts/n8n/stage.ts`'s `diverge` case for the writer. */
export interface BattleSummary {
  readonly count: number;
  readonly winnerId: string | null;
  readonly bestQuality: number | null;
  readonly judgeCount: number | null;
}

/**
 * The Forge Design Battle (`lib/forge/battle.ts`'s `runExperienceBattle`,
 * WQ-018), when the run used battle mode — a distinct mechanism from
 * `BattleSummary` above (the classic diverge battle); see `JobState.forgeBattle`'s
 * own doc comment for why the two are never conflated.
 */
export interface ForgeBattleSummary {
  readonly count: number;
  readonly winnerId: string | null;
  readonly allCandidatesWeak: boolean;
  readonly convergenceWarning: string | null;
  readonly candidates: readonly ForgeBattleCandidateSummary[];
}

export interface ForgeBattleCandidateSummary {
  readonly id: string;
  readonly verdict: string;
  readonly quality: number;
  readonly repairIterations: number;
}

/** The distinctness gate's verdict, when the job has reached it — see `scripts/n8n/stage.ts`'s `distinctness-gate` case. */
export interface GateSummary {
  readonly verdict: string;
  readonly score: number;
}

export interface JobSummary {
  readonly jobId: string;
  readonly business: string;
  readonly stage: JobStage;
  /**
   * `stage` projected onto `lib/workflow/state.ts`'s twelve-state abstract
   * vocabulary (WQ-019 step 1 — see `stageMapping.ts`). `null` only for a
   * `stage` value that predates today's `JobStage` type and cannot be
   * placed on the abstract vocabulary; every current `JobStage` maps to a
   * real abstract state. Additive: `stage` above is unchanged and remains
   * the field every existing reader (the control surface above all) uses.
   */
  readonly abstractStage: AbstractJobState | null;
  readonly iteration: number;
  readonly maxIter: number;
  readonly decision: JobDecision;
  readonly phases: {
    readonly implementation: PhaseStatus;
    readonly browser: PhaseStatus;
    readonly qa: PhaseStatus;
  };
  readonly workers: WorkerSummary;
  /** `null` when the job never reached the diverge stage — not the same as a battle that produced zero candidates. */
  readonly battle: BattleSummary | null;
  /** `null` when the run did not use Forge battle mode (the default) — see `ForgeBattleSummary`'s own doc comment. */
  readonly forgeBattle: ForgeBattleSummary | null;
  /** How many immutable candidates were actually recorded on disk, when the candidate store exists. */
  readonly candidateCount: number;
  /** `null` until the distinctness-gate stage has actually run. */
  readonly gate: GateSummary | null;
  /** The job's spend ceiling, euro cents — surfaced so a control surface never shows spend with no ceiling to compare it to. */
  readonly budgetCents: number;
  readonly errors: readonly string[];
  readonly finalOutput: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Projects a loaded `JobState` into the shape a control surface shows.
 *
 * Pure — takes no filesystem argument, so it is trivially unit-testable
 * against a hand-built `JobState` without touching disk. `candidateCount`
 * is the one field that needs the on-disk candidate index rather than
 * `job.json` alone (`designDirections` records the battle's *result*, not
 * how many candidates the store actually holds), so it is threaded in as a
 * plain number by the caller rather than read here.
 *
 * Defensive against a partial/hand-written `job.json` (a fixture, a crash
 * mid-write before every field lands, or a future producer): `providerLog`/
 * `errors` default to `[]` rather than assuming the real `createJob` shape,
 * so a caller building `JobState`-shaped test data or reading a legacy file
 * gets a degraded-but-correct summary instead of a thrown `TypeError`.
 */
export function summarizeJob(job: JobState, candidateCount = 0): JobSummary {
  const workers = summarizeWorkers(job.providerLog);
  const battle = summarizeBattle(job.designDirections);
  const forgeBattle = summarizeForgeBattle(job.forgeBattle);
  const gate = summarizeGate(job.distinctnessScore);

  return {
    jobId: job.jobId,
    business: job.business,
    stage: job.stage,
    abstractStage: abstractStageOf(job.stage),
    iteration: job.iteration,
    maxIter: job.maxIter,
    decision: job.decision,
    phases: {
      implementation: job.implementationStatus,
      browser: job.browserStatus,
      qa: job.qaStatus,
    },
    workers,
    battle,
    forgeBattle,
    candidateCount,
    gate,
    budgetCents: job.budgetCents ?? 0,
    errors: job.errors ?? [],
    finalOutput: job.finalOutput,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function summarizeWorkers(calls: readonly WorkerCall[] | null | undefined): WorkerSummary {
  const safeCalls = Array.isArray(calls) ? calls : [];
  const byProvider: Record<string, { ok: number; failed: number }> = {};
  let ok = 0;
  let failed = 0;

  for (const call of safeCalls) {
    const key = call.provider ?? '(deterministic)';
    const tally = byProvider[key] ?? { ok: 0, failed: 0 };
    if (call.outcome === 'ok') {
      tally.ok += 1;
      ok += 1;
    } else {
      tally.failed += 1;
      failed += 1;
    }
    byProvider[key] = tally;
  }

  const recentFailures = safeCalls.filter((c) => c.outcome === 'failed').slice(-RECENT_FAILURES_LIMIT);

  return { total: safeCalls.length, ok, failed, byProvider, recentFailures };
}

/**
 * `distinctnessScore` is stored as `unknown` on `JobState`, same reasoning as
 * `designDirections` below — its real writer (`scripts/n8n/stage.ts`'s
 * `distinctness-gate` case) always writes `{ verdict, overallScore }`, but
 * this reads it defensively rather than casting.
 */
function summarizeGate(distinctnessScore: unknown): GateSummary | null {
  if (distinctnessScore === null || distinctnessScore === undefined || typeof distinctnessScore !== 'object') {
    return null;
  }
  const record = distinctnessScore as Record<string, unknown>;
  if (typeof record.verdict !== 'string' || typeof record.overallScore !== 'number') return null;
  return { verdict: record.verdict, score: record.overallScore };
}

/**
 * `designDirections` is stored as `unknown` on `JobState` (the persistence
 * boundary owns no type authority over stage-specific artifacts — see that
 * interface's own doc comment) but its real writer, `scripts/n8n/stage.ts`'s
 * `diverge` case, always writes the same shape when it writes anything at
 * all. Reads defensively rather than casting, so a job whose artifact
 * predates this shape (or was written by a future, different shape) reports
 * as "no battle data" instead of throwing.
 */
function summarizeBattle(designDirections: unknown): BattleSummary | null {
  if (designDirections === null || designDirections === undefined || typeof designDirections !== 'object') {
    return null;
  }
  const record = designDirections as Record<string, unknown>;
  const count = typeof record.count === 'number' ? record.count : 0;
  const winner = typeof record.winner === 'string' ? record.winner : null;
  const jury = typeof record.jury === 'object' && record.jury !== null ? (record.jury as Record<string, unknown>) : null;
  const bestQuality = jury !== null && typeof jury.bestQuality === 'number' ? jury.bestQuality : null;
  const judgeCount = jury !== null && typeof jury.judgeCount === 'number' ? jury.judgeCount : null;

  return { count, winnerId: winner, bestQuality, judgeCount };
}

/**
 * `forgeBattle` is stored as `unknown` on `JobState`, same reasoning as
 * `designDirections` above. Its real writer, `runJob.ts`'s default build
 * hook (when `config.forgeBattleMode` is on), always writes the same shape
 * when it writes anything at all. Reads defensively rather than casting —
 * including against a `job.json` written before this field existed, where
 * the key is simply absent (`undefined`, not `null`) — so an old or
 * malformed record reports as "no Forge battle data" instead of throwing.
 */
function summarizeForgeBattle(forgeBattle: unknown): ForgeBattleSummary | null {
  if (forgeBattle === null || forgeBattle === undefined || typeof forgeBattle !== 'object') {
    return null;
  }
  const record = forgeBattle as Record<string, unknown>;
  const count = typeof record.count === 'number' ? record.count : 0;
  const winnerId = typeof record.winnerId === 'string' ? record.winnerId : null;
  const allCandidatesWeak = record.allCandidatesWeak === true;
  const convergenceWarning = typeof record.convergenceWarning === 'string' ? record.convergenceWarning : null;
  const rawCandidates = Array.isArray(record.candidates) ? record.candidates : [];
  const candidates: ForgeBattleCandidateSummary[] = rawCandidates
    .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
    .map((c) => ({
      id: typeof c.id === 'string' ? c.id : 'unknown',
      verdict: typeof c.verdict === 'string' ? c.verdict : 'unknown',
      quality: typeof c.quality === 'number' ? c.quality : 0,
      repairIterations: typeof c.repairIterations === 'number' ? c.repairIterations : 0,
    }));

  return { count, winnerId, allCandidatesWeak, convergenceWarning, candidates };
}

/* ------------------------------------------------------------------ */
/* Discovery — the only I/O in this module                             */
/* ------------------------------------------------------------------ */

/**
 * Every run directory under `outputRoot` that actually has a `job.json` —
 * a directory holding only partial artifacts (a crashed run before the
 * first `saveJob`) is not a job the control surface can summarize, so it is
 * silently excluded rather than reported as broken.
 */
export async function discoverJobIds(outputRoot: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = (await fs.readdir(outputRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const withJob: string[] = [];
  for (const id of entries) {
    try {
      await fs.access(path.join(outputRoot, id, 'job.json'));
      withJob.push(id);
    } catch {
      // No job.json — not a run this surface can summarize.
    }
  }
  return withJob;
}

/** Loads and summarizes one run by id, or `null` when it has no `job.json`. */
export async function summarizeRun(outputRoot: string, runId: string): Promise<JobSummary | null> {
  const outputDir = path.join(outputRoot, runId);
  const job = await loadJob(outputDir);
  if (job === null) return null;

  const index = await loadIndex(outputDir);
  return summarizeJob(job, index.candidates.length);
}

/** Loads and summarizes every discoverable run under `outputRoot`. */
export async function summarizeAllRuns(outputRoot: string): Promise<readonly JobSummary[]> {
  const ids = await discoverJobIds(outputRoot);
  const summaries: JobSummary[] = [];
  for (const id of ids) {
    const summary = await summarizeRun(outputRoot, id);
    if (summary !== null) summaries.push(summary);
  }
  return summaries;
}

export const SOURCE_NAME = SOURCE;
