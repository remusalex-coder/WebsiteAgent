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

/* ------------------------------------------------------------------ */
/* AI provider configuration                                           */
/* ------------------------------------------------------------------ */

/**
 * `AI_PROVIDER` resolved to nothing.
 *
 * Configuration errors are separated from request failures below because they
 * are fixed in a different place: these mean the environment is wrong and no
 * amount of retrying helps, so they are never retryable.
 */
export class MissingProviderError extends InvalidInputError {
  constructor(source: string) {
    super(
      'No AI provider selected. Set AI_PROVIDER to one of: anthropic, openai, gemini, openrouter.',
      source,
    );
  }
}

/** `AI_PROVIDER` named something this build has no adapter for. */
export class UnsupportedProviderError extends InvalidInputError {
  readonly requested: string;

  constructor(requested: string, supported: readonly string[], source: string) {
    super(
      `Unsupported AI provider "${requested}". Set AI_PROVIDER to one of: ${supported.join(', ')}.`,
      source,
    );
    this.requested = requested;
  }
}

/** The selected provider has no credentials. Names the exact variable to set. */
export class MissingApiKeyError extends InvalidInputError {
  readonly provider: string;
  readonly variable: string;

  constructor(provider: string, variable: string, source: string) {
    super(
      `${variable} is not set; the "${provider}" AI provider needs it. ` +
        `Copy .env.example to .env, set ${variable}, and run with --env-file=.env ` +
        `(or export it in your shell).`,
      source,
    );
    this.provider = provider;
    this.variable = variable;
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

/**
 * An AI provider request failed: transport, HTTP status, refusal, truncation,
 * or a response that would not validate against the requested schema.
 *
 * Carries the provider so a multi-provider deployment can tell whose fault a
 * failure was, and inherits `UpstreamError`'s retryability so the caller's
 * existing retry logic keeps working unchanged.
 */
export class ProviderRequestError extends UpstreamError {
  readonly provider: string;

  constructor(
    provider: string,
    message: string,
    options: { source: string; status?: number | undefined; retryable?: boolean; cause?: unknown },
  ) {
    super(`AI provider "${provider}" request failed: ${message}`, options);
    this.provider = provider;
  }
}
