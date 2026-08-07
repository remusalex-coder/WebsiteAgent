/**
 * HTTP plumbing shared by the `fetch`-based adapters.
 *
 * Two jobs: enforce a per-request wall-clock budget without discarding the run's
 * own abort signal, and run the cheap credential probe every adapter's `health`
 * needs. Neither belongs in a vendor adapter, and both would otherwise be
 * copied four times.
 */

import { healthReport } from '../platform/types.js';

import type { HealthReport } from '../platform/types.js';

/**
 * Combines the caller's abort signal with a timeout.
 *
 * `AbortSignal.any` would do this in one line but only landed in Node 20.3, and
 * the engine floor is 20 — so the composition is explicit. `release` must be
 * called in a `finally`, or the timer keeps the event loop alive.
 */
export function withDeadline(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): { readonly signal: AbortSignal; readonly release: () => void } {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort(new Error(`timed out after ${timeoutMs}ms`));
  }, timeoutMs);
  // A pending request should not hold the process open on its own.
  timer.unref?.();

  const forward = (): void => controller.abort(signal?.reason);
  if (signal !== undefined) {
    if (signal.aborted) forward();
    else signal.addEventListener('abort', forward, { once: true });
  }

  return {
    signal: controller.signal,
    release: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', forward);
    },
  };
}

/** True when a failure came from the deadline or the run being cancelled. */
export function isAbort(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

export interface ProbeRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
  /** Shown in the report, e.g. `OPENAI_API_KEY`. */
  readonly credentialVariable: string;
}

/**
 * Checks credentials and reachability with one unauthenticated-cheap GET.
 *
 * Never throws and never generates tokens — `health` is called for a status
 * board, so a probe that could fail a run would be worse than no probe. A
 * status the caller cannot act on is reported as `degraded` rather than
 * `unavailable`: a listing endpoint that 404s says nothing about whether
 * generation works.
 */
export async function probeEndpoint(request: ProbeRequest): Promise<HealthReport> {
  const startedAt = Date.now();
  const deadline = withDeadline(request.signal, request.timeoutMs);

  try {
    const response = await fetch(request.url, {
      method: 'GET',
      headers: request.headers,
      signal: deadline.signal,
    });
    const latencyMs = Date.now() - startedAt;

    if (response.ok) return healthReport('ready', 'credentials accepted', latencyMs);

    if (response.status === 401 || response.status === 403) {
      return healthReport(
        'unavailable',
        `${request.credentialVariable} was rejected (HTTP ${response.status})`,
        latencyMs,
      );
    }
    if (response.status === 429) {
      return healthReport('degraded', 'rate limited; credentials look valid', latencyMs);
    }
    if (response.status >= 500) {
      return healthReport('degraded', `provider is failing (HTTP ${response.status})`, latencyMs);
    }
    return healthReport(
      'degraded',
      `probe returned HTTP ${response.status}; generation may still work`,
      latencyMs,
    );
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    if (isAbort(error)) {
      return healthReport('degraded', `probe timed out after ${request.timeoutMs}ms`, latencyMs);
    }
    return healthReport(
      'unavailable',
      `unreachable: ${error instanceof Error ? error.message : String(error)}`,
      latencyMs,
    );
  } finally {
    deadline.release();
  }
}
