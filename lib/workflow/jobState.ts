/**
 * Persistent job state for the BusinessForge production workflow.
 *
 * One structured object per run, persisted to `output/<runId>/job.json`.
 * Every stage reads the previous stage's artifact through this object and
 * writes its own back, so the orchestrator (and Hermes) can inspect what
 * happened without reading thousands of logs.
 *
 * This is the single source of truth for a job's lifecycle — stage order,
 * artifact references, iteration count, the gate verdict and the final
 * decision all live here. It deliberately owns no logic beyond load/save
 * and a safe default; the orchestrator and the Hermes decision node own
 * the transitions.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { STANDARD_JOB_BUDGET_CENTS } from '../cost/lease.js';

const SOURCE = 'workflow.jobState';

/** Where a job sits in its lifecycle. */
export type JobStage =
  | 'created'
  | 'research'
  | 'evidence'
  | 'character'
  | 'creative'
  | 'experience'
  | 'diverge'
  | 'content'
  | 'asset'
  | 'design'
  | 'build'
  | 'browser'
  | 'visual-critic'
  | 'distinctness-gate'
  | 'hermes'
  | 'delivery'
  | 'human';

/** Hermes's verdict on the whole job. */
export type JobDecision =
  | 'running'
  | 'deliver'
  | 'reconcept'
  | 'escalate';

/** Coarse status of a single phase, used for fast dashboard reads. */
export type PhaseStatus = 'pending' | 'built' | 'shot' | 'passed' | 'failed';

/**
 * The complete, persistent state of one website-production job.
 *
 * Artifacts are kept as `unknown` here on purpose: this module is the
 * persistence boundary, not the type authority. Each stage casts the field
 * it owns to its own contract when it reads it back.
 */
export interface JobState {
  readonly jobId: string;
  /** The business identity supplied to the system (Maps URL or name). */
  readonly business: string;

  /** Current lifecycle stage. */
  stage: JobStage;
  /** How many rejection/rebuild loops have run. */
  iteration: number;
  /** Hard ceiling on iterations before Hermes escalates to a human. */
  readonly maxIter: number;

  /** Structured outputs, one per stage. */
  research: unknown;
  evidence: unknown;
  character: unknown;
  creativeDirection: unknown;
  experienceIntent: unknown;
  experiencePlan: unknown;
  content: unknown;
  assetPlan: unknown;
  design: unknown;

  /**
   * The diverge battle: which divergent design directions were produced and
   * how the jury chose among them. Written by the diverge stage, read by the
   * board.
   */
  designDirections: unknown;

  /**
   * The Forge Design Battle (`lib/forge/battle.ts`'s `runExperienceBattle`,
   * WQ-018) — a distinct mechanism from `designDirections` above: N whole
   * Experience Signature builds, each with its own repair loop, reduced to
   * one winner by the same lexicographic comparator. Deliberately its own
   * field rather than reusing `designDirections`/`distinctnessScore` (the
   * classic diverge battle's fields, per WQ-016's `summarizeBattle`) — the
   * two battle mechanisms must never be conflated in the control surface.
   * `null` when the run did not use Forge battle mode (the default).
   */
  forgeBattle: unknown;

  /** Phase statuses for the dashboard. */
  implementationStatus: PhaseStatus;
  browserStatus: PhaseStatus;
  qaStatus: PhaseStatus;

  /** The two production gate outputs (the non-negotiable quality loop). */
  visualCritique: unknown;
  distinctnessScore: unknown;
  /**
   * What the rendered page measured — overlap, overflow, holes.
   *
   * Kept beside the critique rather than inside it because they answer
   * different questions with different authority: the critique is a model's
   * opinion of how the page looks, this is geometry, and only one of the two
   * can be wrong about whether two sections are on top of each other.
   */
  layoutAudit: unknown;
  /**
   * The production preflight verdict (Decision Gate §1.J): functional,
   * security and accessibility gates run against the site about to be
   * delivered. Kept beside `layoutAudit`/`visualCritique` for the same
   * reason — a different authority answering a different question.
   */
  preflight: unknown;

  /** Hermes's decision and the rationale behind it. */
  decision: JobDecision;
  /** Map of artifact name -> relative path under the output dir. */
  readonly artifacts: Record<string, string>;
  /** Flat list of error strings encountered, for observability. */
  readonly errors: string[];
  /** Path to the final delivered site, when delivered. */
  finalOutput: string | null;

  /** One row per worker call, for the factory's observability board. */
  readonly providerLog: WorkerCall[];
  /** The job's budget in euro cents — surfaced, never silently exceeded. */
  readonly budgetCents: number;

  readonly createdAt: string;
  updatedAt: string;
}

/**
 * One provider call a stage made: which capability, which worker, and whether
 * it answered. `provider: null` means the stage fell back to the deterministic
 * floor — the record makes that a decision, not a silence.
 */
export interface WorkerCall {
  readonly stage: string;
  readonly capability: string;
  readonly provider: string | null;
  readonly outcome: 'ok' | 'failed';
  /** Who this call was for, when a model actually answered. */
  readonly model?: string;
  readonly at: string;
  /**
   * Wall-clock time this specific attempt took, in milliseconds. Optional
   * (WQ-027): older job.json files and any call site not yet updated to
   * measure it simply omit the field rather than lying with a 0 or a guess —
   * every existing consumer already treats WorkerCall as a plain data object,
   * so an absent field is a normal, valid read, not a migration.
   */
  readonly durationMs?: number;
  /**
   * How many OTHER pool members were tried and failed before this one
   * answered (0 for a clean first-try success). Only meaningful on the 'ok'
   * call that closes out a `withPoolFailover` chain — a 'failed' entry is
   * itself one of the attempts being counted, not a chain with its own
   * retry history. Optional for the same reason as `durationMs`.
   */
  readonly retryCount?: number;
}

/** Builds a fresh job with safe defaults. */
export function createJob(jobId: string, business: string, maxIter = 3): JobState {
  const now = new Date().toISOString();
  return {
    jobId,
    business,
    stage: 'created',
    iteration: 0,
    maxIter,
    research: null,
    evidence: null,
    character: null,
    creativeDirection: null,
    experienceIntent: null,
    experiencePlan: null,
    content: null,
    assetPlan: null,
    design: null,
    designDirections: null,
    forgeBattle: null,
    implementationStatus: 'pending',
    browserStatus: 'pending',
    qaStatus: 'pending',
    visualCritique: null,
    distinctnessScore: null,
    layoutAudit: null,
    preflight: null,
    decision: 'running',
    artifacts: {},
    errors: [],
    finalOutput: null,
    providerLog: [],
    budgetCents: STANDARD_JOB_BUDGET_CENTS,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Loads the job from disk, or `null` if no `job.json` exists yet.
 *
 * A corrupt file is a real error — the orchestrator needs to know the run
 * is unrecoverable rather than silently starting over — so we let read/parse
 * failures propagate instead of returning a fresh job.
 */
export async function loadJob(outputDir: string): Promise<JobState | null> {
  const filePath = path.join(outputDir, 'job.json');
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as JobState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Persists a partial update to the job, atomically.
 *
 * Merges `patch` over the existing job (or a fresh default when none exists),
 * stamps `updatedAt`, and writes via a temp file + rename so a crash mid-write
 * never leaves a half-written `job.json` behind.
 */
export async function saveJob(outputDir: string, patch: Partial<JobState>): Promise<JobState> {
  const filePath = path.join(outputDir, 'job.json');
  const tempPath = `${filePath}.tmp`;

  const existing = await loadJob(outputDir);
  const next: JobState = {
    ...(existing ?? createJob(patch.jobId ?? 'unknown', patch.business ?? 'unknown', patch.maxIter ?? 3)),
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
  return next;
}
