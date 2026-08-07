/**
 * The vocabulary every pluggable capability shares.
 *
 * Providers, skills and MCP servers are three very different things, but a
 * caller asks the same three questions of all of them — is it there, did it
 * work, and how fast — so those questions get one set of answers here.
 *
 * This module is a leaf: it imports the error taxonomy and nothing else. The
 * provider layer, the skill layer and the MCP layer all depend on it, and none
 * of them depend on each other.
 */

import { AgentError } from '../errors.js';

/* ------------------------------------------------------------------ */
/* Identity                                                            */
/* ------------------------------------------------------------------ */

/** Which subsystem a capability came from. Carried on every error and metric. */
export type CapabilityKind = 'provider' | 'skill' | 'mcp';

/** A capability's address within its subsystem, e.g. `skill:playwright`. */
export interface CapabilityRef {
  readonly kind: CapabilityKind;
  readonly id: string;
}

export function capabilityRef(kind: CapabilityKind, id: string): CapabilityRef {
  return { kind, id };
}

/** Stable string form, used as the telemetry key and in log fields. */
export function refKey(ref: CapabilityRef): string {
  return `${ref.kind}:${ref.id}`;
}

/* ------------------------------------------------------------------ */
/* Health                                                              */
/* ------------------------------------------------------------------ */

/**
 * `ready` — usable now. `degraded` — usable, but something is wrong (a
 * credential is missing, a dependency is soft-failing). `unavailable` — not
 * usable; a call would fail. `unknown` — never probed.
 *
 * A placeholder skill is `unavailable`, not `degraded`: nothing about it works
 * yet, and a health board that says otherwise is worse than no health board.
 */
export type HealthStatus = 'ready' | 'degraded' | 'unavailable' | 'unknown';

export interface HealthReport {
  readonly status: HealthStatus;
  /** One line a human can act on. Never empty. */
  readonly detail: string;
  readonly checkedAt: string;
  /** Round-trip of the probe itself, when the probe did any work. */
  readonly latencyMs: number | null;
}

export function healthReport(
  status: HealthStatus,
  detail: string,
  latencyMs: number | null = null,
): HealthReport {
  return { status, detail, checkedAt: new Date().toISOString(), latencyMs };
}

export const UNKNOWN_HEALTH: HealthReport = {
  status: 'unknown',
  detail: 'not probed yet',
  checkedAt: new Date(0).toISOString(),
  latencyMs: null,
};

/* ------------------------------------------------------------------ */
/* Structured errors                                                   */
/* ------------------------------------------------------------------ */

/**
 * Why a capability call did not produce a result.
 *
 * Deliberately a closed set: callers branch on these, and a code that means
 * "something else happened" (`internal`) should be rare enough to notice.
 */
export type CapabilityErrorCode =
  /** No such capability is registered in this build. */
  | 'not_registered'
  /** Registered, but switched off by configuration. */
  | 'disabled'
  /** Registered and enabled, but has no implementation bound yet. */
  | 'not_implemented'
  /** A capability it declares a dependency on is missing or unusable. */
  | 'missing_dependency'
  /** An API key or token the capability needs is not configured. */
  | 'missing_credential'
  /** The caller's input was rejected before any work was attempted. */
  | 'invalid_input'
  /** Exceeded its time budget. */
  | 'timeout'
  /** The run was aborted. */
  | 'cancelled'
  /** A remote system it depends on failed. */
  | 'upstream'
  /** It threw something we could not classify. */
  | 'internal';

/**
 * A machine-readable failure.
 *
 * Returned rather than thrown, so a caller asking for an optional capability
 * writes a branch instead of a `try`/`catch`. `details` is always present —
 * empty rather than absent — so consumers index it without a null check.
 */
export interface CapabilityError {
  readonly code: CapabilityErrorCode;
  /** Human-readable, already naming the capability. Safe to log verbatim. */
  readonly message: string;
  readonly capability: CapabilityRef;
  /** Whether the same call could sensibly be attempted again. */
  readonly retryable: boolean;
  readonly details: Record<string, unknown>;
}

/** Codes for which a retry is worth attempting, absent better information. */
const RETRYABLE: ReadonlySet<CapabilityErrorCode> = new Set(['timeout', 'upstream']);

export function capabilityError(
  capability: CapabilityRef,
  code: CapabilityErrorCode,
  message: string,
  options: { retryable?: boolean; details?: Record<string, unknown> } = {},
): CapabilityError {
  return {
    code,
    message: `[${refKey(capability)}] ${message}`,
    capability,
    retryable: options.retryable ?? RETRYABLE.has(code),
    details: options.details ?? {},
  };
}

/**
 * The throwing form, for callers that want a hard failure.
 *
 * `platform.skills.require('pdf')` throws this; `platform.skills.get('pdf')`
 * hands back a handle whose calls return the same information as data. Both
 * carry the identical `CapabilityError`, so a caller can switch styles without
 * losing detail.
 */
export class CapabilityUnavailableError extends AgentError {
  readonly detail: CapabilityError;

  constructor(detail: CapabilityError) {
    super(detail.message, {
      source: refKey(detail.capability),
      retryable: detail.retryable,
    });
    this.detail = detail;
  }
}

/* ------------------------------------------------------------------ */
/* Outcomes                                                            */
/* ------------------------------------------------------------------ */

/**
 * The result of one capability call.
 *
 * Every path through `execute` produces one of these, including the paths that
 * would otherwise throw — the managers catch, classify and wrap. `durationMs`
 * is on both arms because a failure's latency is the interesting one.
 */
export type CapabilityOutcome<T> =
  | { readonly ok: true; readonly data: T; readonly durationMs: number }
  | { readonly ok: false; readonly error: CapabilityError; readonly durationMs: number };

export function ok<T>(data: T, durationMs: number): CapabilityOutcome<T> {
  return { ok: true, data, durationMs };
}

export function failed<T>(error: CapabilityError, durationMs: number): CapabilityOutcome<T> {
  return { ok: false, error, durationMs };
}

/** Unwraps an outcome, throwing the structured error. For fail-fast callers. */
export function unwrap<T>(outcome: CapabilityOutcome<T>): T {
  if (outcome.ok) return outcome.data;
  throw new CapabilityUnavailableError(outcome.error);
}

/* ------------------------------------------------------------------ */
/* Status reporting                                                    */
/* ------------------------------------------------------------------ */

/**
 * Observed behaviour of one capability, accumulated over a run.
 *
 * `availability` is successes over attempts, so a capability that is registered
 * and healthy but fails every call reads as 0 — which is the number an operator
 * actually wants.
 */
export interface CapabilityMetrics {
  readonly calls: number;
  readonly failures: number;
  /** 0–1. Defined as 1 when nothing has been called yet. */
  readonly availability: number;
  readonly latencyMs: LatencySummary | null;
  readonly lastError: string | null;
  readonly lastCallAt: string | null;
}

export interface LatencySummary {
  readonly last: number;
  readonly avg: number;
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
  /** How many samples the summary is computed from. */
  readonly samples: number;
}

/**
 * One row of the platform's status board: what it is, whether it is on,
 * whether it is well, and how it has actually behaved.
 */
export interface CapabilityStatus {
  readonly id: string;
  readonly kind: CapabilityKind;
  readonly name: string;
  readonly version: string;
  readonly enabled: boolean;
  readonly health: HealthReport;
  readonly metrics: CapabilityMetrics;
}
