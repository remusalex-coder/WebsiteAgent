/**
 * The request/response conventions the adapters share, above raw transport.
 *
 * `http.ts` moves bytes and enforces deadlines. This module knows what those
 * bytes mean: how to POST a JSON body and classify the failure, how to turn
 * generated text back into a validated object, and how our `Effort` ladder maps
 * onto each vendor's spelling of the same idea.
 *
 * Still nothing here knows what a prompt is *for*. Agents supply meaning;
 * this supplies protocol.
 */

import { ProviderRequestError } from '../errors.js';
import { isAbort, withDeadline } from './http.js';
import {
  buildSchemaInstruction,
  parseJsonObject,
  validateAgainstSchema,
} from './schema.js';

import type { Effort } from '../config.js';
import type { AIGenerateRequest, AIProviderName, JsonSchema } from './types.js';

/* ------------------------------------------------------------------ */
/* Requests                                                            */
/* ------------------------------------------------------------------ */

export interface JsonRequest {
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly timeoutMs: number;
  /** The run's abort signal, when one was supplied. */
  readonly signal: AbortSignal | undefined;
}

/**
 * POSTs JSON and returns the decoded response.
 *
 * Every failure leaves as a `ProviderRequestError` carrying the vendor's name
 * and an honest `retryable`: a 429 or 5xx is worth another attempt, a 400 is
 * not, and a cancelled run is not either — retrying an abort would defeat the
 * cancellation.
 */
export async function postJson(
  provider: AIProviderName,
  source: string,
  request: JsonRequest,
): Promise<unknown> {
  const deadline = withDeadline(request.signal, request.timeoutMs);

  let response: Response;
  try {
    response = await fetch(request.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...request.headers },
      body: JSON.stringify(request.body),
      signal: deadline.signal,
    });
  } catch (error) {
    if (isAbort(error)) {
      // The run being cancelled and the budget expiring look the same to
      // `fetch`; only the caller's signal tells them apart.
      const cancelled = request.signal?.aborted === true;
      throw new ProviderRequestError(
        provider,
        cancelled ? 'the run was cancelled' : `no response within ${request.timeoutMs}ms`,
        { source, retryable: !cancelled, cause: error },
      );
    }
    throw new ProviderRequestError(provider, `could not reach ${hostOf(request.url)}`, {
      source,
      retryable: true,
      cause: error,
    });
  } finally {
    deadline.release();
  }

  const text = await response.text();

  if (!response.ok) {
    throw new ProviderRequestError(provider, `HTTP ${response.status}: ${excerpt(text)}`, {
      source,
      status: response.status,
      // 4xx other than rate limiting will fail again unchanged.
      retryable: response.status === 429 || response.status >= 500,
    });
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new ProviderRequestError(provider, `response was not JSON: ${excerpt(text)}`, {
      source,
      status: response.status,
      retryable: true,
      cause: error,
    });
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function excerpt(text: string, limit = 300): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length <= limit ? collapsed : `${collapsed.slice(0, limit)}…`;
}

/* ------------------------------------------------------------------ */
/* Response decoding                                                   */
/* ------------------------------------------------------------------ */

/**
 * Turns generated text into the validated object the caller asked for.
 *
 * Both structured-output modes end here. Native mode is already guaranteed by
 * the vendor, but the validation runs anyway: it costs microseconds, and a
 * vendor whose schema enforcement regresses should fail in this file rather
 * than as an `undefined` two stages downstream.
 */
export function decodeStructured(
  provider: AIProviderName,
  source: string,
  text: string,
  schema: JsonSchema,
): unknown {
  let parsed: unknown;
  try {
    parsed = parseJsonObject(text);
  } catch (error) {
    throw new ProviderRequestError(
      provider,
      error instanceof Error ? error.message : String(error),
      { source, retryable: true, cause: error },
    );
  }

  const problems = validateAgainstSchema(parsed, schema);
  if (problems.length > 0) {
    const shown = problems.slice(0, 5).join('; ');
    const rest = problems.length > 5 ? ` (and ${problems.length - 5} more)` : '';
    throw new ProviderRequestError(
      provider,
      `the response did not match the requested schema: ${shown}${rest}`,
      { source, retryable: true },
    );
  }
  return parsed;
}

/**
 * Fails a request that stopped early.
 *
 * A truncated response is not a smaller answer, it is an unparseable one — and
 * the error should name the knob that fixes it rather than leaving the caller
 * to infer that from a JSON syntax error.
 */
export function assertComplete(
  provider: AIProviderName,
  source: string,
  finishReason: string | null,
  truncationReasons: readonly string[],
  maxTokens: number,
): void {
  if (finishReason !== null && truncationReasons.includes(finishReason)) {
    throw new ProviderRequestError(
      provider,
      `generation was cut off at ${maxTokens} tokens (finish reason "${finishReason}"); ` +
        "raise the stage's max output tokens or lower its effort",
      { source, retryable: false },
    );
  }
}

/**
 * Composes the system prompt for a vendor that cannot enforce a schema.
 *
 * The agent's prompt is never touched: the instruction is appended here, so the
 * same agent produces byte-identical prompts on every provider and only the
 * transport differs.
 */
export function systemWithSchema(request: AIGenerateRequest, native: boolean): string {
  return native
    ? request.system
    : `${request.system}\n\n${buildSchemaInstruction(request.schema)}`;
}

/* ------------------------------------------------------------------ */
/* Effort                                                              */
/* ------------------------------------------------------------------ */

/**
 * Our five effort levels onto the four OpenAI accepts.
 *
 * `xhigh` and `max` both collapse to `high` — OpenAI has no deeper setting, and
 * sending an unrecognised value is a 400 rather than a warning. The collapse is
 * documented rather than hidden, so a run's configured effort can be reconciled
 * with what was actually requested.
 */
export function toOpenAIEffort(effort: Effort): 'minimal' | 'low' | 'medium' | 'high' {
  switch (effort) {
    case 'low': return 'low';
    case 'medium': return 'medium';
    case 'high':
    case 'xhigh':
    case 'max': return 'high';
    default: return 'medium';
  }
}

/**
 * Effort as a Gemini thinking budget, in tokens.
 *
 * Gemini takes a number rather than a label, so the ladder is ours. `-1` hands
 * the decision back to the model, which is what `max` means here.
 */
export function toGeminiThinkingBudget(effort: Effort): number {
  switch (effort) {
    case 'low': return 1_024;
    case 'medium': return 4_096;
    case 'high': return 12_288;
    case 'xhigh': return 24_576;
    case 'max': return -1;
    default: return 4_096;
  }
}
