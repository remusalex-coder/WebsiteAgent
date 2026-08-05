/**
 * Error taxonomy shared by every agent and library module.
 *
 * Agents should throw these rather than bare `Error` so the orchestrator in
 * `main.ts` can decide what is retryable, what is fatal, and what should be
 * reported back to the caller as a partial result.
 */

/** Base class for every error this system raises deliberately. */
export class AgentError extends Error {
  /** Name of the agent or module that raised the error, e.g. `discoveryAgent`. */
  readonly source: string;
  /** Whether a caller may sensibly retry the same operation. */
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { source: string; retryable?: boolean; cause?: unknown },
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.source = options.source;
    this.retryable = options.retryable ?? false;
  }
}

/** Placeholder thrown by every stub in this scaffold. */
export class NotImplementedError extends AgentError {
  constructor(what: string, source = 'unknown') {
    super(`Not implemented: ${what}`, { source, retryable: false });
  }
}

/** The supplied input failed validation before any work was attempted. */
export class InvalidInputError extends AgentError {
  constructor(message: string, source: string, cause?: unknown) {
    super(message, { source, retryable: false, cause });
  }
}

/** A remote source (Maps, an LLM API, Lovable) failed or was unreachable. */
export class UpstreamError extends AgentError {
  /** HTTP status when the failure came from an HTTP call. */
  readonly status?: number | undefined;

  constructor(
    message: string,
    options: { source: string; status?: number | undefined; retryable?: boolean; cause?: unknown },
  ) {
    super(message, {
      source: options.source,
      retryable: options.retryable ?? true,
      ...(options.cause !== undefined ? { cause: options.cause } : {}),
    });
    this.status = options.status;
  }
}
