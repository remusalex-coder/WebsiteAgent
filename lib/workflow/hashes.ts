/**
 * Content-addressed stage outputs (P2-2, Freeze §P2-2).
 *
 * Each stage records an `inputHash` and an `outputHash` so that a stage whose
 * inputs are unchanged can be skipped and its previous output reused. That is
 * what makes "a killed job resumes with zero re-run completed stages, zero
 * model calls" true rather than aspirational.
 *
 * ## Canonical JSON
 *
 * Two objects that are semantically equal must hash equal, so hashing does not
 * go through `JSON.stringify`'s default key order. `canonicalJson` sorts object
 * keys recursively and normalises number forms, which makes a hash stable
 * across producers that build the same data in a different order.
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE = 'workflow.hashes';

/** Recursively stable serialisation: keys sorted, arrays in order. */
export function canonicalJson(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(serialize).join(',')}]`;
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      // Normalise -0, and drop float noise so 0.1+0.2 and 0.3 agree.
      if (Object.is(value, -0)) return '0';
      if (Number.isFinite(value)) return String(Number(value.toPrecision(15)));
      return 'null';
    case 'boolean':
      return value ? 'true' : 'false';
    case 'object': {
      const record = value as Record<string, unknown>;
      const keys = Object.keys(record).sort();
      return `{${keys.map((key) => `${JSON.stringify(key)}:${serialize(record[key])}`).join(',')}}`;
    }
    default:
      // undefined, functions, symbols — none of these belong in an artifact.
      return 'null';
  }
}

/** A stable sha256 hex digest of any value. Deterministic for equal values. */
export function hashValue(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

/** A short, readable digest prefix, enough to compare fingerprints by eye. */
export function shortHash(value: unknown): string {
  return hashValue(value).slice(0, 12);
}

export interface AddressedStage {
  readonly stage: string;
  readonly inputHash: string | null;
  readonly outputHash: string | null;
  /** The stage's own artifact path, relative to the run directory, if any. */
  readonly outputPath: string | null;
  readonly completedAt: string | null;
}

/**
 * Whether a stage can be skipped because nothing it depends on changed.
 *
 * A stage with no recorded hashes has never run, or ran before content
 * addressing existed — either way it must run. A stage whose recorded input
 * hash matches the current inputs has already produced exactly what would be
 * produced now, so its output is reused.
 */
export function shouldSkip(recorded: AddressedStage, currentInputHash: string): boolean {
  return recorded.inputHash === currentInputHash && recorded.outputPath !== null;
}

/* ------------------------------------------------------------------ */
/* Persisted stage ledger (T01)                                        */
/* ------------------------------------------------------------------ */

/**
 * One `ledger.json` per job, beneath the run directory — the persistence
 * `AddressedStage`/`shouldSkip` above were built for but never had. This is
 * not a second ledger concept: it is this module's own content-addressing
 * given somewhere real to live, using the same atomic-write / read-or-empty
 * pattern `lib/workflow/candidates.ts` already uses for `candidates/index.json`.
 *
 * It never decides what stage a job is *at* — `job.stage` in `jobState.ts`
 * remains the sole source of truth for that. This is an append/merge trail of
 * what each stage actually hashed to: a resume (T02) reads it to decide what
 * can be skipped, and a human escalation reads it to see exactly what ran.
 */
export interface StageLedger {
  readonly version: 1;
  readonly stages: Readonly<Record<string, AddressedStage>>;
}

const LEDGER_FILE_NAME = 'ledger.json';
const EMPTY_LEDGER: StageLedger = { version: 1, stages: {} };

function ledgerPath(outputDir: string): string {
  return path.join(outputDir, LEDGER_FILE_NAME);
}

/** Reads the ledger, or an empty one when no stage has ever been recorded. */
export async function loadStageLedger(outputDir: string): Promise<StageLedger> {
  try {
    const raw = await fs.readFile(ledgerPath(outputDir), 'utf8');
    return JSON.parse(raw) as StageLedger;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return EMPTY_LEDGER;
    throw error;
  }
}

/** Writes the ledger atomically, so a crash mid-write never truncates it. */
async function writeStageLedger(outputDir: string, ledger: StageLedger): Promise<void> {
  const filePath = ledgerPath(outputDir);
  const tempPath = `${filePath}.tmp`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
}

/**
 * Serialises concurrent read-modify-write cycles against the same job's
 * ledger, in-process — two stages of one job (e.g. the `research` fan-out,
 * one `runStage` call per pool member) can complete at nearly the same time,
 * and without this a second writer's read-before-first-writer's-write would
 * silently drop the first entry. A second OS process racing the same
 * `outputDir` is outside what an in-memory lock can prevent; the atomic
 * temp+rename write still guarantees no reader ever observes a half-written
 * file, the same property `saveJob`/`candidates.ts` already rely on.
 */
const ledgerLocks = new Map<string, Promise<unknown>>();

async function withLedgerLock<T>(outputDir: string, fn: () => Promise<T>): Promise<T> {
  const previous = ledgerLocks.get(outputDir) ?? Promise.resolve();
  const run = previous.then(fn, fn);
  ledgerLocks.set(outputDir, run.then(
    () => undefined,
    () => undefined,
  ));
  return run;
}

export interface RecordStageOptions {
  readonly stage: string;
  readonly inputHash: string | null;
  readonly outputHash: string | null;
  /** The stage's own artifact path, relative to the run directory, if the caller has one to name. */
  readonly outputPath?: string | null;
  /** True when the stage threw — recorded so the failure is visible, never silently dropped. */
  readonly failed?: boolean;
}

/**
 * Merges one stage's addressed record into the job's ledger and persists it.
 *
 * Merge, never overwrite: a failed or freshly-completed stage's entry never
 * erases another stage's already-recorded entry. A failed stage is recorded
 * with `outputHash: null` and `completedAt: null` — attempted, not completed —
 * which also means `shouldSkip` can never treat a failed attempt as reusable
 * output, since `shouldSkip` requires a non-null `outputPath` to skip and this
 * records none for a failure.
 */
export async function recordStage(outputDir: string, options: RecordStageOptions): Promise<StageLedger> {
  return withLedgerLock(outputDir, async () => {
    const current = await loadStageLedger(outputDir);
    const entry: AddressedStage = {
      stage: options.stage,
      inputHash: options.inputHash,
      outputHash: options.failed ? null : options.outputHash,
      outputPath: options.failed ? null : (options.outputPath ?? null),
      completedAt: options.failed ? null : new Date().toISOString(),
    };
    const next: StageLedger = {
      version: 1,
      stages: { ...current.stages, [options.stage]: entry },
    };
    await writeStageLedger(outputDir, next);
    return next;
  });
}

export const SOURCE_NAME = SOURCE;