/**
 * Candidate store — write-once candidates and a *derived* best-so-far.
 *
 * ## The problem this exists to remove
 *
 * The rejection loop used to rebuild the design in place: `reconceptBuild`
 * overwrote `5b-design.json`, and `runJob` reassigned its `design` variable. A
 * run whose three attempts scored 68, 55 and 51 therefore escalated to a human
 * holding the 51 — and the 68 was gone, because nothing had kept it.
 *
 * ## Why `best` is derived rather than assigned
 *
 * A promotion rule written as "if the new one is better, replace the pointer"
 * is one missing branch away from losing the better result again. So there is
 * no pointer to mis-assign: `selectBest` is a pure `argmax` recomputed over the
 * whole set, which makes the monotonicity of `quality(best)` a property of the
 * function rather than a discipline the caller has to maintain. Adding a worse
 * candidate cannot change the answer, in any order, by construction.
 *
 * ## Write-once
 *
 * A candidate directory is written exactly once and never modified. That is
 * what makes "the loop cannot destroy a better attempt" true rather than
 * intended — the bytes of attempt 1 are still on disk while attempt 3 runs.
 *
 * ## What this module does NOT do
 *
 * It does not score. Quality and distinctness arrive from the gate, already
 * computed. It does not decide anything — the caller asks for the best
 * candidate and decides what that means. It never writes `job.json`.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE = 'workflow.candidates';

/** Folder holding every candidate, beneath the run directory. */
export const CANDIDATES_DIR_NAME = 'candidates';

/** The append-only index, beneath `CANDIDATES_DIR_NAME`. */
const INDEX_FILE_NAME = 'index.json';

/** Artifact names inside a candidate directory — the same names the run root uses. */
const DESIGN_FILE_NAME = '5b-design.json';
const SITE_DIR_NAME = 'site';

/**
 * What a candidate scored.
 *
 * `distinctness` is carried separately from `quality` because they are
 * different dimensions that must never be summed — a strange candidate may not
 * buy its way past a good one. Until the quality system splits them for real,
 * callers may pass a constant for `distinctness`; a constant is inert in the
 * ordering, which is the honest behaviour for a number nobody has measured yet.
 */
export interface CandidateScores {
  /** 0–100. Higher is better. */
  readonly quality: number;
  /** 0–100. Higher is better. Used only to break a quality tie. */
  readonly distinctness: number;
  /**
   * Whether every blocking dimension passed for this candidate.
   *
   * A candidate that is not blocking-clean can never be delivered. It can still
   * be the *best available* one, which is what an escalation needs to hand a
   * human.
   */
  readonly blockingClean: boolean;
}

/** One recorded attempt. Immutable once written. */
export interface CandidateRecord {
  readonly candidateId: string;
  /** Append order, 0-based. Older candidates win ties, so this is the last key. */
  readonly index: number;
  /** Which reconcept iteration produced it. 0 is the first build. */
  readonly iteration: number;
  /** Directory holding this candidate, relative to the run directory. */
  readonly dir: string;
  readonly scores: CandidateScores;
  /** Spend attributed to producing this candidate, in whatever unit the caller uses. */
  readonly costUnits: number;
  readonly createdAt: string;
}

export interface CandidateIndex {
  readonly version: 1;
  readonly candidates: readonly CandidateRecord[];
  /**
   * The derived winner, persisted so a reader does not have to re-implement the
   * comparison. Recomputed on every append — never assigned by a caller.
   */
  readonly bestId: string | null;
}

const EMPTY_INDEX: CandidateIndex = { version: 1, candidates: [], bestId: null };

/* ------------------------------------------------------------------ */
/* The comparison                                                      */
/* ------------------------------------------------------------------ */

/**
 * Whether `a` is a strictly better candidate than `b`.
 *
 * Lexicographic, never weighted:
 *   1. blocking-clean beats not-clean       (a broken page is not a better page)
 *   2. higher quality
 *   3. higher distinctness                  (tie-break only — see `CandidateScores`)
 *   4. lower cost
 *   5. earlier index                        (a later attempt must *earn* the swap)
 *
 * The last key is what makes the ordering total, and therefore what makes
 * `selectBest` independent of the order candidates were appended in.
 */
export function isBetter(a: CandidateRecord, b: CandidateRecord): boolean {
  if (a.scores.blockingClean !== b.scores.blockingClean) return a.scores.blockingClean;
  if (a.scores.quality !== b.scores.quality) return a.scores.quality > b.scores.quality;
  if (a.scores.distinctness !== b.scores.distinctness) return a.scores.distinctness > b.scores.distinctness;
  if (a.costUnits !== b.costUnits) return a.costUnits < b.costUnits;
  return a.index < b.index;
}

/**
 * The best candidate in a set, or `null` when the set is empty.
 *
 * Pure, total, and order-independent: `selectBest` of any permutation of the
 * same records is the same record. That is the whole guarantee — see the module
 * comment for why it is expressed as `argmax` rather than as a promotion rule.
 */
export function selectBest(records: readonly CandidateRecord[]): CandidateRecord | null {
  let best: CandidateRecord | null = null;
  for (const record of records) {
    if (best === null || isBetter(record, best)) best = record;
  }
  return best;
}

/**
 * Whether a candidate may be delivered.
 *
 * Separate from `selectBest` on purpose: the best candidate and a deliverable
 * candidate are different questions, and conflating them is how a run delivers
 * the least-bad broken page.
 */
export function isDeliverable(record: CandidateRecord | null): boolean {
  return record !== null && record.scores.blockingClean;
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function indexPath(outputDir: string): string {
  return path.join(outputDir, CANDIDATES_DIR_NAME, INDEX_FILE_NAME);
}

export function candidateDir(outputDir: string, candidateId: string): string {
  return path.join(outputDir, CANDIDATES_DIR_NAME, candidateId);
}

/** Reads the index, or an empty one when no candidate has been recorded yet. */
export async function loadIndex(outputDir: string): Promise<CandidateIndex> {
  try {
    const raw = await fs.readFile(indexPath(outputDir), 'utf8');
    return JSON.parse(raw) as CandidateIndex;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY_INDEX;
    throw error;
  }
}

/** Writes the index atomically, so a crash mid-write never truncates it. */
async function writeIndex(outputDir: string, index: CandidateIndex): Promise<void> {
  const filePath = indexPath(outputDir);
  const tempPath = `${filePath}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export interface RecordCandidateOptions {
  readonly outputDir: string;
  readonly iteration: number;
  readonly scores: CandidateScores;
  /** Defaults to 0 — Wave 0 has no cost ledger to draw from. */
  readonly costUnits?: number;
  /**
   * Snapshot the rendered site alongside the design.
   *
   * On by default: the design alone is not the deliverable, and restoring a
   * winning design without its rendered site would hand a human a JSON file.
   */
  readonly includeSite?: boolean;
}

/**
 * Records one attempt as an immutable candidate and returns the updated index.
 *
 * Copies the run's current `5b-design.json` and `site/` into a fresh candidate
 * directory. **Refuses to overwrite**: a candidate id that already exists is a
 * caller bug, and silently replacing it would reintroduce exactly the loss this
 * module was built to prevent.
 *
 * The run root is deliberately left alone here. Restoring it mid-loop would
 * clobber the working site the next reconcept iteration is about to screenshot;
 * `finalizeBest` does it once, at the end, where it is what a reader wants.
 */
export async function recordCandidate(options: RecordCandidateOptions): Promise<CandidateIndex> {
  const { outputDir, iteration, scores } = options;
  const index = await loadIndex(outputDir);
  const position = index.candidates.length;
  const candidateId = `c${String(position).padStart(3, '0')}`;
  const dir = candidateDir(outputDir, candidateId);

  if (await exists(dir)) {
    throw new Error(`[${SOURCE}] candidate ${candidateId} already exists at ${dir}; candidates are write-once`);
  }
  await fs.mkdir(dir, { recursive: true });

  const designSource = path.join(outputDir, DESIGN_FILE_NAME);
  if (await exists(designSource)) {
    await fs.copyFile(designSource, path.join(dir, DESIGN_FILE_NAME));
  }

  if (options.includeSite !== false) {
    const siteSource = path.join(outputDir, SITE_DIR_NAME);
    if (await exists(siteSource)) {
      await fs.cp(siteSource, path.join(dir, SITE_DIR_NAME), { recursive: true });
    }
  }

  const record: CandidateRecord = {
    candidateId,
    index: position,
    iteration,
    dir: path.join(CANDIDATES_DIR_NAME, candidateId),
    scores,
    costUnits: options.costUnits ?? 0,
    createdAt: new Date().toISOString(),
  };

  const candidates = [...index.candidates, record];
  const next: CandidateIndex = {
    version: 1,
    candidates,
    // Derived, every time, over the whole set. Never assigned.
    bestId: selectBest(candidates)?.candidateId ?? null,
  };
  await writeIndex(outputDir, next);
  return next;
}

/** The current best candidate, or `null` when nothing has been recorded. */
export async function bestCandidate(outputDir: string): Promise<CandidateRecord | null> {
  const index = await loadIndex(outputDir);
  return selectBest(index.candidates);
}

/**
 * Restores the run root from the best candidate, and returns it.
 *
 * This is what keeps the run-root artifact names meaningful: `5b-design.json`
 * and `site/` are a *public interface* with many readers, so after a run they
 * must hold the result that was actually chosen rather than the last one
 * attempted. Called once, at a terminal state — never inside the loop.
 *
 * A no-op when no candidate was recorded, so a run that never got that far is
 * left exactly as it was.
 */
export async function finalizeBest(outputDir: string): Promise<CandidateRecord | null> {
  const best = await bestCandidate(outputDir);
  if (best === null) return null;

  const from = path.join(outputDir, best.dir);

  const design = path.join(from, DESIGN_FILE_NAME);
  if (await exists(design)) {
    await fs.copyFile(design, path.join(outputDir, DESIGN_FILE_NAME));
  }

  const site = path.join(from, SITE_DIR_NAME);
  if (await exists(site)) {
    await fs.rm(path.join(outputDir, SITE_DIR_NAME), { recursive: true, force: true });
    await fs.cp(site, path.join(outputDir, SITE_DIR_NAME), { recursive: true });
  }

  return best;
}
