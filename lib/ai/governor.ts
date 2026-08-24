/**
 * Rate Governor (Freeze N-10, P3-4, CP4).
 *
 * A per-vendor token bucket scoped to the *organisation*. Groq and Gemini both
 * meter per org, so extra API keys buy nothing: the bucket is one per vendor,
 * shared by every call in the process. The guarantee is that K concurrent
 * requests against a 2-RPM bucket queue rather than 429 â€” a caller waits for
 * a token instead of hammering the vendor.
 *
 * ## Token bucket semantics
 *
 * A bucket holds `capacity` tokens, refilled at `refillPerMs`. A call takes one
 * token. `acquire` returns a promise that resolves when a token is available
 * and the caller may proceed; it does not run the call itself, so the governor
 * stays a pure gate. Optional `minIntervalMs` enforces a hard spacing between
 * calls (some vendors reject two requests in the same second regardless of RPM).
 */

const SOURCE = 'ai.governor';

export interface RateGovernorOptions {
  readonly capacity: number;
  readonly refillPerMs: number;
  /** Optional hard minimum gap between two calls, in milliseconds. */
  readonly minIntervalMs?: number;
}

/** One vendor's bucket. Refills lazily on each acquire. */
interface Bucket {
  readonly capacity: number;
  readonly refillPerMs: number;
  readonly minIntervalMs: number;
  tokens: number;
  lastRefillAt: number;
  lastCallAt: number;
  waiters: Array<() => void>;
}

function createBucket(options: RateGovernorOptions, now: () => number): Bucket {
  return {
    capacity: Math.max(1, Math.floor(options.capacity)),
    refillPerMs: Math.max(0, options.refillPerMs),
    minIntervalMs: Math.max(0, options.minIntervalMs ?? 0),
    tokens: Math.max(1, Math.floor(options.capacity)),
    lastRefillAt: now(),
    lastCallAt: 0,
    waiters: [],
  };
}

function refill(bucket: Bucket, now: () => number): void {
  const t = now();
  const elapsed = t - bucket.lastRefillAt;
  if (elapsed <= 0) return;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsed * bucket.refillPerMs);
  bucket.lastRefillAt = t;
}

/**
 * A per-vendor token bucket. `acquire(vendor)` resolves when that vendor's
 * bucket grants a token; callers that hold a token are guaranteed the vendor
 * will not see more concurrent calls than the bucket allows.
 */
export interface RateGovernor {
  /** The vendor named in `acquire` must be registered first. */
  register(vendor: string, options: RateGovernorOptions): void;
  /**
   * Resolves when the vendor's bucket grants a token. Never rejects â€” the
   * caller waits, it does not fail.
   */
  acquire(vendor: string, signal?: AbortSignal): Promise<void>;
  /** Tokens currently available for a vendor, for health reporting. */
  tokensFor(vendor: string): number;
}

/**
 * Creates the org-scoped rate governor.
 *
 * `now` is injectable for tests; production leaves it unset and Date.now()
 * runs. A vendor that was never registered refuses `acquire` rather than
 * granting an ungoverned pass â€” an ungoverned vendor is exactly the kind that
 * produces a surprise 429.
 */
export function createRateGovernor(now: () => number = Date.now): RateGovernor {
  const buckets = new Map<string, Bucket>();

  const acquire = async (vendor: string, signal?: AbortSignal): Promise<void> => {
    const bucket = buckets.get(vendor);
    if (bucket === undefined) {
      throw new Error(`[${SOURCE}] no rate bucket registered for "${vendor}" â€” register it or govern it`);
    }

    for (;;) {
      refill(bucket, now);
      const nowMs = now();
      const intervalElapsed = nowMs - bucket.lastCallAt >= bucket.minIntervalMs;

      if (bucket.tokens >= 1 && intervalElapsed) {
        bucket.tokens -= 1;
        bucket.lastCallAt = nowMs;
        return;
      }

      if (signal?.aborted === true) {
        throw new DOMException('aborted', 'AbortError');
      }

      await new Promise<void>((resolve) => {
        const wake = (): void => resolve();
        bucket.waiters.push(wake);
        if (signal !== undefined) {
          signal.addEventListener('abort', wake, { once: true });
        }
        // A single short sleep bounds how long a waiter can block on a stale
        // bucket state; the loop re-checks rather than assuming.
        setTimeout(wake, 25);
      });
    }
  };

  return {
    register(vendor, options): void {
      buckets.set(vendor, createBucket(options, now));
    },
    acquire,
    tokensFor(vendor): number {
      const bucket = buckets.get(vendor);
      if (bucket === undefined) return 0;
      refill(bucket, now);
      return bucket.tokens;
    },
  };
}

export const SOURCE_NAME = SOURCE;
