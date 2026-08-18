/**
 * The daily request ledger.
 *
 * `lib/ai/governor.ts` already keeps a per-vendor token bucket, which stops K
 * concurrent calls from becoming K simultaneous 429s. It is a *rate* limiter
 * and it is in-memory, so it forgets everything when the process exits. Neither
 * property helps with the constraint that actually binds this deployment: a
 * free tier metered **per day**, which the twelfth run of an afternoon
 * exhausts even though every individual call was perfectly paced.
 *
 * So this is the other half. It counts requests per model per UTC day, it
 * survives a restart because it writes to disk, and the planner treats an
 * exhausted allowance as a **hard filter** — the model is removed from the
 * chain, not penalised in the ranking. A model that will return 429 is not a
 * slow option; it is not an option.
 *
 * ## Why UTC, and why the file is trivially small
 *
 * Vendors reset on their own clocks and none of them reset on ours. UTC
 * midnight is the only boundary that is the same for the ledger and for the
 * operator reading it, and being wrong by a few hours in the conservative
 * direction costs a handful of requests, not a run.
 *
 * The file holds today and yesterday, nothing else. A quota ledger is not an
 * analytics store: the run log already records every call, and keeping a
 * month's history here would only invite someone to query it.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const SOURCE = 'capability.quota';

/** The file, relative to the run's output directory. */
export const QUOTA_FILE = path.join('.bf', 'quota.json');

/** One day's counts, keyed by `provider:id`. */
type DayCounts = Record<string, number>;

/** The on-disk shape: `{ "2026-08-18": { "gemini:gemini-3.6-flash": 7 } }`. */
type QuotaFile = Record<string, DayCounts>;

/** The UTC day a timestamp falls in, as `YYYY-MM-DD`. */
export function utcDay(at: number): string {
  return new Date(at).toISOString().slice(0, 10);
}

export interface QuotaSnapshot {
  readonly day: string;
  /** Requests recorded today, by `provider:id`. */
  readonly used: Readonly<Record<string, number>>;
}

/**
 * The ledger.
 *
 * Every method is cheap: the file is read once at construction and written
 * through on each `record`. A write that fails is logged by the caller and
 * never throws into the run — losing a count is a smaller failure than losing a
 * website, and the next call simply re-reads a slightly stale file.
 */
export interface QuotaLedger {
  /** Requests already made against a model today. */
  used(key: string): number;
  /**
   * Whether one more request fits inside `allowancePerDay`.
   *
   * An allowance of `null` means the model is not metered by this ledger —
   * a paid model, typically — and always has room.
   */
  hasRoom(key: string, allowancePerDay: number | null): boolean;
  /** Requests left today, or `null` when the model is unmetered. */
  remaining(key: string, allowancePerDay: number | null): number | null;
  /** Counts one request. Persists before returning. */
  record(key: string, count?: number): Promise<void>;
  snapshot(): QuotaSnapshot;
}

export interface QuotaLedgerOptions {
  /** The run's output directory. The ledger writes `.bf/quota.json` beneath it. */
  readonly dir: string;
  /** Injectable for tests. */
  readonly now?: () => number;
}

/**
 * Opens (or creates) the ledger for a directory.
 *
 * A missing or corrupt file is not an error: an unreadable ledger means "no
 * requests recorded", which is the conservative direction only in the sense
 * that it never *blocks* a call. That is the right trade — a ledger that
 * refuses to run the pipeline because its own JSON is malformed would be a
 * worse failure than a day of over-counting.
 */
export async function openQuotaLedger(options: QuotaLedgerOptions): Promise<QuotaLedger> {
  const now = options.now ?? Date.now;
  const file = path.join(options.dir, QUOTA_FILE);

  let data: QuotaFile = {};
  try {
    data = JSON.parse(await fs.readFile(file, 'utf8')) as QuotaFile;
  } catch {
    data = {};
  }

  const countsFor = (day: string): DayCounts => {
    const existing = data[day];
    if (existing !== undefined) return existing;
    const created: DayCounts = {};
    data[day] = created;
    return created;
  };

  /** Drops everything older than yesterday. Called on every write. */
  const prune = (today: string): void => {
    const yesterday = utcDay(Date.parse(`${today}T00:00:00.000Z`) - 86_400_000);
    for (const day of Object.keys(data)) {
      if (day !== today && day !== yesterday) delete data[day];
    }
  };

  const persist = async (today: string): Promise<void> => {
    prune(today);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  };

  return {
    used(key): number {
      return countsFor(utcDay(now()))[key] ?? 0;
    },

    hasRoom(key, allowancePerDay): boolean {
      if (allowancePerDay === null) return true;
      return (countsFor(utcDay(now()))[key] ?? 0) < allowancePerDay;
    },

    remaining(key, allowancePerDay): number | null {
      if (allowancePerDay === null) return null;
      return Math.max(0, allowancePerDay - (countsFor(utcDay(now()))[key] ?? 0));
    },

    async record(key, count = 1): Promise<void> {
      const today = utcDay(now());
      const counts = countsFor(today);
      counts[key] = (counts[key] ?? 0) + count;
      await persist(today);
    },

    snapshot(): QuotaSnapshot {
      const day = utcDay(now());
      return { day, used: { ...countsFor(day) } };
    },
  };
}

/**
 * A ledger that counts nothing and always has room.
 *
 * For tests and for callers that genuinely have no daily meter to respect —
 * never as a default, because a silently unmetered planner is exactly how a
 * free tier gets burned through in one afternoon.
 */
export function unmeteredQuotaLedger(now: () => number = Date.now): QuotaLedger {
  return {
    used: () => 0,
    hasRoom: () => true,
    remaining: (_key, allowance) => allowance,
    record: async () => {},
    snapshot: () => ({ day: utcDay(now()), used: {} }),
  };
}

export const SOURCE_NAME = SOURCE;
