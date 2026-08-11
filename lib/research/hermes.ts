/**
 * Asking Hermes for research.
 *
 * Two things happen when Claude needs evidence, and keeping them separate is the
 * whole design:
 *
 *   1. **The request is filed.** Always, unconditionally, to a tracked file. It
 *      is a durable question that outlives the session that asked it.
 *   2. **A transport may answer it now.** Only if one is configured and
 *      reachable. This leg is optional, and the loop does not depend on it.
 *
 * That ordering is why the handoff keeps working when Hermes does not. A session
 * that gets an answer merges it immediately; a session that does not leaves a
 * question on disk that the next session — or Hermes reading the repository, or
 * a human with the prompt in hand — can answer later. Nothing is lost either
 * way, and no state lives only in a conversation.
 *
 * The client speaks the platform's vocabulary — `CapabilityOutcome`, the closed
 * set of error codes — so a caller branches on a research failure exactly as it
 * branches on a missing skill or an unreachable MCP server, and never wraps this
 * in a `try`/`catch` that could turn "we could not research it" into "we
 * researched it and found nothing".
 */

import { capabilityError, capabilityRef, failed, ok } from '../platform/types.js';
import { parseDelta } from './validate.js';

import type { CapabilityError, CapabilityOutcome, CapabilityRef } from '../platform/types.js';
import type { ResearchDelta, ResearchRequest } from './types.js';

/**
 * The capability name a Hermes server is expected to advertise.
 *
 * One tool, one argument object, one JSON answer. Nothing about this requires
 * the server to be Hermes specifically — anything that advertises this name and
 * returns a valid delta satisfies the contract, which is what keeps the
 * researcher replaceable.
 */
export const RESEARCH_CAPABILITY = 'research';

/** Capability id used in errors and telemetry: `research:hermes`. */
export const HERMES_REF: CapabilityRef = capabilityRef('mcp', 'hermes');

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

/**
 * A way of putting a request in front of a researcher and getting a delta back
 * within one call.
 *
 * Deliberately tiny, and deliberately not the only path: the persisted request
 * is the reliable channel, and this is the optimisation that closes the loop
 * inside a single session when the environment happens to support it.
 */
export interface HermesTransport {
  /** Short id for logs, e.g. `mcp:hermes`. */
  readonly id: string;
  /** One line naming what this actually talks to. Shown when it fails. */
  readonly describe: string;
  research(request: ResearchRequest, signal?: AbortSignal): Promise<ResearchDelta>;
}

/**
 * The slice of `MCPManager` this needs.
 *
 * Structural rather than an import of the manager, so `lib/research` stays
 * independent of the platform's assembly: the real `MCPManager` satisfies it,
 * and so does a stub in a test.
 */
export interface McpCaller {
  has(id: string): boolean;
  execute(
    serverId: string,
    call: { readonly capability: string; readonly arguments: Record<string, unknown> },
  ): Promise<CapabilityOutcome<unknown>>;
}

/**
 * Finds the delta inside whatever an MCP `tools/call` returned.
 *
 * The protocol allows three shapes and servers differ: `structuredContent` when
 * the server declares an output schema, a JSON string in the first text block
 * otherwise, and — for a server that returns its result directly — the object
 * itself. All three are accepted, because which one arrives is the server's
 * choice and not something worth failing a research pass over.
 *
 * `isError` is honoured first: a tool-level error carrying a plausible-looking
 * body must not be parsed into findings.
 */
export function unwrapMcpResult(result: unknown): unknown {
  if (typeof result !== 'object' || result === null) return result;
  const record = result as Record<string, unknown>;

  if (record.isError === true) {
    const text = firstText(record.content);
    throw new Error(text ?? 'the research server reported a tool error');
  }

  if (record.structuredContent !== undefined) return record.structuredContent;

  const text = firstText(record.content);
  if (text !== null) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error('the research server returned text that is not JSON');
    }
  }

  return result;
}

function firstText(content: unknown): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (typeof block !== 'object' || block === null) continue;
    const text = (block as Record<string, unknown>).text;
    if (typeof text === 'string' && text.trim() !== '') return text;
  }
  return null;
}

/**
 * Talks to a Hermes server registered as an MCP server.
 *
 * This is the whole of the "direct request/response" leg, and it needs no new
 * dependency and no new configuration mechanism: a Hermes endpoint is declared
 * in `MCP_SERVERS` like any other server, and the existing manager supplies
 * policy, credential checks, timeouts, telemetry and structured errors.
 *
 * > **Never exercised against a live Hermes server.** No such endpoint exists in
 * > this environment. The call shape follows the MCP specification and the
 * > response handling is covered by tests against recorded shapes, but the first
 * > real call is the test — the same honesty the HTTP connector is documented
 * > with, for the same reason.
 */
export function mcpTransport(
  mcp: McpCaller,
  serverId = 'hermes',
  capability = RESEARCH_CAPABILITY,
): HermesTransport {
  return {
    id: `mcp:${serverId}`,
    describe: `MCP server "${serverId}", capability "${capability}"`,

    async research(request: ResearchRequest): Promise<ResearchDelta> {
      const outcome = await mcp.execute(serverId, {
        capability,
        arguments: { request: request as unknown as Record<string, unknown> },
      });

      if (!outcome.ok) throw new Error(outcome.error.message);

      const delta = parseDelta(unwrapMcpResult(outcome.data), `${serverId}.${capability}`);

      // A researcher answering a different question is a wiring bug, and one
      // that would otherwise merge cleanly and attach the wrong provenance to
      // real claims.
      if (delta.requestId !== request.requestId) {
        throw new Error(
          `answered request "${delta.requestId}" but "${request.requestId}" was asked`,
        );
      }
      return delta;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Client                                                              */
/* ------------------------------------------------------------------ */

export interface HermesClient {
  /** `null` when nothing can answer a request inside this session. */
  readonly transport: HermesTransport | null;
  /**
   * Attempts one research pass.
   *
   * Never throws: a caller that cannot reach Hermes gets a reason as data and
   * carries on with the request it has already persisted.
   */
  research(request: ResearchRequest, signal?: AbortSignal): Promise<CapabilityOutcome<ResearchDelta>>;
}

/**
 * The reason returned when no transport is configured.
 *
 * `not_registered` rather than `not_implemented`: the mechanism is built and
 * works, and what is missing is a server to point it at. The message says what
 * to do next, because "unavailable" with no instruction is how a capability gap
 * becomes a dead end.
 */
export function noTransportError(): CapabilityError {
  return capabilityError(
    HERMES_REF,
    'not_registered',
    'no Hermes transport is configured, so nothing can answer this request inside ' +
      'this session. The request has been filed and stays valid: point MCP_SERVERS at ' +
      'a Hermes endpoint advertising a "research" tool, or have Hermes read ' +
      'research/requests/ and write the answer back to the repository.',
  );
}

export function createHermesClient(options: { transport: HermesTransport | null }): HermesClient {
  const { transport } = options;

  return {
    transport,

    async research(
      request: ResearchRequest,
      signal?: AbortSignal,
    ): Promise<CapabilityOutcome<ResearchDelta>> {
      if (transport === null) return failed(noTransportError(), 0);

      const startedAt = Date.now();
      try {
        const delta = await transport.research(request, signal);
        return ok(delta, Date.now() - startedAt);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return failed(
          capabilityError(HERMES_REF, 'upstream', `${transport.describe}: ${message}`, {
            details: { transport: transport.id, requestId: request.requestId },
          }),
          Date.now() - startedAt,
        );
      }
    },
  };
}

/**
 * Builds the client the CLI uses.
 *
 * Returns a transport-less client when no server is registered under `serverId`,
 * rather than a client that fails at call time with a confusing message —
 * `client.transport === null` is a question a caller can ask before it commits
 * to a plan.
 */
export function hermesClientFor(
  mcp: McpCaller | null,
  serverId = 'hermes',
): HermesClient {
  if (mcp === null || !mcp.has(serverId)) return createHermesClient({ transport: null });
  return createHermesClient({ transport: mcpTransport(mcp, serverId) });
}
