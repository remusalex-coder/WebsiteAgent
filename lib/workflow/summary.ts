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
 * Kept separate from any particular presentation (CLI today, `scripts/
 * status.ts`; a web view or `stage-server.ts` endpoint later, if ever
 * justified) so the read model itself is what gets tested, not a script's
 * stdout formatting.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { loadJob } from './jobState.js';
import { loadIndex } from './candidates.js';

import type { JobDecision, JobStage, JobState, PhaseStatus, WorkerCall } from './jobState.js';

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

export interface JobSummary {
  readonly jobId: string;
  readonly business: string;
  readonly stage: JobStage;
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
  /** How many immutable candidates were actually recorded on disk, when the candidate store exists. */
  readonly candidateCount: number;
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
 */
export function summarizeJob(job: JobState, candidateCount = 0): JobSummary {
  const workers = summarizeWorkers(job.providerLog);
  const battle = summarizeBattle(job.designDirections);

  return {
    jobId: job.jobId,
    business: job.business,
    stage: job.stage,
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
    candidateCount,
    errors: job.errors,
    finalOutput: job.finalOutput,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function summarizeWorkers(calls: readonly WorkerCall[]): WorkerSummary {
  const byProvider: Record<string, { ok: number; failed: number }> = {};
  let ok = 0;
  let failed = 0;

  for (const call of calls) {
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

  const recentFailures = calls.filter((c) => c.outcome === 'failed').slice(-RECENT_FAILURES_LIMIT);

  return { total: calls.length, ok, failed, byProvider, recentFailures };
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
