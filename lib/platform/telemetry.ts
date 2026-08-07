/**
 * Latency, error and availability accounting for every capability call.
 *
 * One recorder, three subsystems. Providers, skills and MCP servers all route
 * their calls through `instrument`, so the status board is complete by
 * construction rather than by each subsystem remembering to report.
 *
 * Bounded by design: durations live in a fixed-size ring per capability, so a
 * long run cannot grow this without limit. Everything is in-process — a real
 * deployment points `TelemetrySink` at OTLP or a log pipeline and gets the same
 * events.
 */

import type { Logger } from '../logger.js';
import type {
  CapabilityMetrics,
  CapabilityRef,
  LatencySummary,
} from './types.js';
import { refKey } from './types.js';

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

/** One completed capability call. Emitted whether it succeeded or not. */
export interface TelemetryEvent {
  readonly capability: CapabilityRef;
  /** What was invoked, e.g. `generate`, `execute`, `tools/call`. */
  readonly operation: string;
  readonly ok: boolean;
  readonly durationMs: number;
  readonly at: string;
  /** Error code when `ok` is false; `null` otherwise. */
  readonly errorCode: string | null;
  readonly errorMessage: string | null;
  /** Anything the subsystem wants attached — model id, token counts, tool name. */
  readonly fields: Record<string, unknown>;
}

/** Where events go. Swap for OTLP or a log shipper without touching callers. */
export interface TelemetrySink {
  record(event: TelemetryEvent): void;
}

/** Mirrors events into the run log at debug level. */
export function createLoggingSink(logger: Logger): TelemetrySink {
  return {
    record(event: TelemetryEvent): void {
      logger.debug('capability call', {
        capability: refKey(event.capability),
        operation: event.operation,
        ok: event.ok,
        durationMs: event.durationMs,
        ...(event.errorCode !== null ? { errorCode: event.errorCode } : {}),
        ...event.fields,
      });
    },
  };
}

export function createMultiSink(...sinks: readonly TelemetrySink[]): TelemetrySink {
  return {
    record(event: TelemetryEvent): void {
      for (const sink of sinks) sink.record(event);
    },
  };
}

/** Drops everything. Used when telemetry is switched off in configuration. */
export const NULL_SINK: TelemetrySink = { record(): void {} };

/* ------------------------------------------------------------------ */
/* Recorder                                                            */
/* ------------------------------------------------------------------ */

export interface Telemetry {
  /** Records a finished call. Never throws — telemetry must not fail a run. */
  record(event: TelemetryEvent): void;
  /** Metrics for one capability. Zeroed rather than absent for an unused one. */
  metricsFor(ref: CapabilityRef): CapabilityMetrics;
  /** Every capability that has been called, keyed by `kind:id`. */
  snapshot(): Readonly<Record<string, CapabilityMetrics>>;
  /** Forgets all accumulated samples. */
  reset(): void;
}

interface Accumulator {
  calls: number;
  failures: number;
  /** Ring buffer of the most recent durations, for the percentiles. */
  durations: number[];
  cursor: number;
  /** Kept separately: the ring's newest entry is awkward to find once it wraps. */
  lastDuration: number;
  max: number;
  total: number;
  lastError: string | null;
  lastCallAt: string | null;
}

export interface TelemetryOptions {
  readonly sink: TelemetrySink;
  /** Durations retained per capability. Older samples roll off. */
  readonly sampleLimit: number;
}

export function createTelemetry(options: TelemetryOptions): Telemetry {
  const limit = Math.max(1, options.sampleLimit);
  const byKey = new Map<string, Accumulator>();

  const accumulatorFor = (key: string): Accumulator => {
    let entry = byKey.get(key);
    if (entry === undefined) {
      entry = {
        calls: 0,
        failures: 0,
        durations: [],
        cursor: 0,
        lastDuration: 0,
        max: 0,
        total: 0,
        lastError: null,
        lastCallAt: null,
      };
      byKey.set(key, entry);
    }
    return entry;
  };

  return {
    record(event: TelemetryEvent): void {
      const entry = accumulatorFor(refKey(event.capability));

      entry.calls += 1;
      if (!event.ok) {
        entry.failures += 1;
        entry.lastError = event.errorMessage ?? event.errorCode ?? 'unknown error';
      }
      entry.lastCallAt = event.at;
      entry.total += event.durationMs;
      entry.lastDuration = event.durationMs;
      entry.max = Math.max(entry.max, event.durationMs);

      if (entry.durations.length < limit) {
        entry.durations.push(event.durationMs);
      } else {
        entry.durations[entry.cursor] = event.durationMs;
        entry.cursor = (entry.cursor + 1) % limit;
      }

      // A sink that throws must not take the run with it.
      try {
        options.sink.record(event);
      } catch {
        /* ignored deliberately */
      }
    },

    metricsFor(ref: CapabilityRef): CapabilityMetrics {
      const entry = byKey.get(refKey(ref));
      return entry === undefined ? EMPTY_METRICS : summarise(entry);
    },

    snapshot(): Readonly<Record<string, CapabilityMetrics>> {
      const out: Record<string, CapabilityMetrics> = {};
      for (const [key, entry] of byKey) out[key] = summarise(entry);
      return out;
    },

    reset(): void {
      byKey.clear();
    },
  };
}

export const EMPTY_METRICS: CapabilityMetrics = {
  calls: 0,
  failures: 0,
  availability: 1,
  latencyMs: null,
  lastError: null,
  lastCallAt: null,
};

function summarise(entry: Accumulator): CapabilityMetrics {
  return {
    calls: entry.calls,
    failures: entry.failures,
    availability: entry.calls === 0 ? 1 : (entry.calls - entry.failures) / entry.calls,
    latencyMs: latency(entry),
    lastError: entry.lastError,
    lastCallAt: entry.lastCallAt,
  };
}

function latency(entry: Accumulator): LatencySummary | null {
  if (entry.calls === 0 || entry.durations.length === 0) return null;

  const sorted = [...entry.durations].sort((a, b) => a - b);

  return {
    last: entry.lastDuration,
    avg: Math.round(entry.total / entry.calls),
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: entry.max,
    samples: sorted.length,
  };
}

/** Nearest-rank percentile over an ascending array. */
function percentile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil(fraction * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index] ?? 0;
}

/* ------------------------------------------------------------------ */
/* Instrumentation                                                     */
/* ------------------------------------------------------------------ */

/**
 * Times `fn`, records the outcome, and re-throws whatever it threw.
 *
 * Transparent on purpose: the managers own error classification, and this
 * should not quietly swallow an exception on its way past.
 */
export async function instrument<T>(
  telemetry: Telemetry,
  capability: CapabilityRef,
  operation: string,
  fn: () => Promise<T>,
  fields: Record<string, unknown> = {},
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    telemetry.record({
      capability,
      operation,
      ok: true,
      durationMs: Date.now() - startedAt,
      at: new Date().toISOString(),
      errorCode: null,
      errorMessage: null,
      fields,
    });
    return result;
  } catch (error) {
    telemetry.record({
      capability,
      operation,
      ok: false,
      durationMs: Date.now() - startedAt,
      at: new Date().toISOString(),
      errorCode: error instanceof Error ? error.name : 'unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      fields,
    });
    throw error;
  }
}
