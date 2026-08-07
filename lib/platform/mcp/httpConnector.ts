/**
 * MCP over Streamable HTTP.
 *
 * JSON-RPC 2.0 in a POST body, with the server free to answer either as JSON or
 * as an SSE stream — both are handled here, because which one arrives is the
 * server's choice and not something a caller should have to care about.
 *
 * No SDK: the subset needed to list and call tools is four methods, and a
 * dependency-free connector is one fewer package to keep current. Sessions are
 * honoured (`mcp-session-id`) so a server that wants one gets one.
 *
 * **Unverified against a live server.** The shape follows the specification and
 * the types are exercised by the typecheck, but nothing in this repository has
 * connected to a real MCP endpoint yet. Treat the first integration as the test.
 */

import { isAbort, withDeadline } from '../../ai/http.js';
import { healthReport } from '../types.js';

import type { JsonSchema } from '../../ai/types.js';
import type { Logger } from '../../logger.js';
import type { HealthReport } from '../types.js';
import type {
  MCPCall,
  MCPCapability,
  MCPConnector,
  MCPServerMetadata,
} from './types.js';

const PROTOCOL_VERSION = '2025-06-18';

const CONNECTOR_VERSION = '1.0.0';

export interface HttpConnectorOptions {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly endpoint: string;
  /** Sent on every request. Use for bearer tokens. */
  readonly headers: Readonly<Record<string, string>>;
  readonly requiredCredentials: readonly string[];
  readonly timeoutMs: number;
  readonly logger: Logger;
}

/* ------------------------------------------------------------------ */
/* JSON-RPC                                                            */
/* ------------------------------------------------------------------ */

interface RpcError {
  readonly code?: unknown;
  readonly message?: unknown;
  readonly data?: unknown;
}

interface RpcResponse {
  readonly id?: unknown;
  readonly result?: unknown;
  readonly error?: RpcError;
}

/** Raised by the connector; the manager classifies it. */
export class MCPTransportError extends Error {
  readonly retryable: boolean;
  readonly status: number | null;

  constructor(message: string, options: { retryable: boolean; status?: number | null; cause?: unknown }) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'MCPTransportError';
    this.retryable = options.retryable;
    this.status = options.status ?? null;
  }
}

export function createHttpConnector(options: HttpConnectorOptions): MCPConnector {
  const metadata: MCPServerMetadata = {
    id: options.id,
    name: options.name,
    description: options.description,
    version: CONNECTOR_VERSION,
    transport: 'http',
    endpoint: options.endpoint,
    command: null,
    args: [],
    requiredCredentials: options.requiredCredentials,
  };

  // Assigned by the server on `initialize`, echoed on every later request.
  let sessionId: string | null = null;
  let initialised = false;
  let nextId = 1;

  const rpc = async (
    method: string,
    params: Record<string, unknown> | undefined,
    signal: AbortSignal | undefined,
  ): Promise<unknown> => {
    const id = nextId++;
    const deadline = withDeadline(signal, options.timeoutMs);

    let response: Response;
    try {
      response = await fetch(options.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          // Either is acceptable to us; the server picks.
          accept: 'application/json, text/event-stream',
          'mcp-protocol-version': PROTOCOL_VERSION,
          ...(sessionId !== null ? { 'mcp-session-id': sessionId } : {}),
          ...options.headers,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id,
          method,
          ...(params !== undefined ? { params } : {}),
        }),
        signal: deadline.signal,
      });
    } catch (error) {
      if (isAbort(error)) {
        const cancelled = signal?.aborted === true;
        throw new MCPTransportError(
          cancelled ? 'the run was cancelled' : `no response within ${options.timeoutMs}ms`,
          { retryable: !cancelled, cause: error },
        );
      }
      throw new MCPTransportError(`could not reach ${options.endpoint}`, {
        retryable: true,
        cause: error,
      });
    } finally {
      deadline.release();
    }

    const assigned = response.headers.get('mcp-session-id');
    if (assigned !== null && assigned !== '') sessionId = assigned;

    const body = await response.text();

    if (!response.ok) {
      // A 404 on a session-bearing request means the server dropped it; the
      // next call should re-initialize rather than keep presenting a dead id.
      if (response.status === 404 && sessionId !== null) {
        sessionId = null;
        initialised = false;
      }
      throw new MCPTransportError(`HTTP ${response.status}: ${excerpt(body)}`, {
        retryable: response.status === 429 || response.status >= 500,
        status: response.status,
      });
    }

    const message = decode(body, response.headers.get('content-type'), id);
    if (message.error !== undefined) {
      const code = typeof message.error.code === 'number' ? message.error.code : null;
      throw new MCPTransportError(
        typeof message.error.message === 'string'
          ? message.error.message
          : 'the server returned an error with no message',
        // JSON-RPC's reserved range is caller error; anything else may be transient.
        { retryable: code === null || code < -32000, status: code },
      );
    }
    return message.result;
  };

  /** `initialize` once per session, before anything else is allowed. */
  const ensureInitialised = async (signal: AbortSignal | undefined): Promise<void> => {
    if (initialised) return;

    await rpc(
      'initialize',
      {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'BusinessForge', version: CONNECTOR_VERSION },
      },
      signal,
    );
    initialised = true;
    options.logger.debug('mcp session initialised', { server: options.id, sessionId });
  };

  return {
    metadata,

    async connect(signal?: AbortSignal): Promise<void> {
      await ensureInitialised(signal);
    },

    async capabilities(signal?: AbortSignal): Promise<readonly MCPCapability[]> {
      await ensureInitialised(signal);

      // Tools, resources and prompts are three separate listings; a server may
      // implement any subset, so a method it does not support is not a failure.
      const [tools, resources, prompts] = await Promise.all([
        listSafely(() => rpc('tools/list', undefined, signal)),
        listSafely(() => rpc('resources/list', undefined, signal)),
        listSafely(() => rpc('prompts/list', undefined, signal)),
      ]);

      return [
        ...toCapabilities(tools, 'tool'),
        ...toCapabilities(resources, 'resource'),
        ...toCapabilities(prompts, 'prompt'),
      ];
    },

    async execute(call: MCPCall, signal?: AbortSignal): Promise<unknown> {
      await ensureInitialised(signal);
      return rpc('tools/call', { name: call.capability, arguments: call.arguments }, signal);
    },

    async health(signal?: AbortSignal): Promise<HealthReport> {
      const startedAt = Date.now();
      try {
        await ensureInitialised(signal);
        const tools = await listSafely(() => rpc('tools/list', undefined, signal));
        return healthReport(
          'ready',
          `reachable; ${tools.length} tool${tools.length === 1 ? '' : 's'} advertised`,
          Date.now() - startedAt,
        );
      } catch (error) {
        return healthReport(
          'unavailable',
          error instanceof Error ? error.message : String(error),
          Date.now() - startedAt,
        );
      }
    },

    async disconnect(): Promise<void> {
      if (sessionId === null) return;
      try {
        // Best-effort: a server that does not implement DELETE is not a problem.
        await fetch(options.endpoint, {
          method: 'DELETE',
          headers: { 'mcp-session-id': sessionId, ...options.headers },
        });
      } catch {
        /* the session will expire on its own */
      }
      sessionId = null;
      initialised = false;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Decoding                                                            */
/* ------------------------------------------------------------------ */

/**
 * Reads one JSON-RPC response out of a body that may be plain JSON or SSE.
 *
 * In the SSE case the server may send progress notifications before the answer,
 * so the frames are scanned for the one carrying our request id rather than the
 * first one being assumed to be it.
 */
function decode(body: string, contentType: string | null, expectedId: number): RpcResponse {
  const frames = (contentType ?? '').includes('text/event-stream')
    ? sseData(body)
    : [body];

  let lastParsed: RpcResponse | null = null;
  for (const frame of frames) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(frame);
    } catch {
      continue;
    }
    if (typeof parsed !== 'object' || parsed === null) continue;

    const message = parsed as RpcResponse;
    // Notifications carry no id; they are not the response we are waiting for.
    if (message.id === expectedId) return message;
    if (message.id !== undefined) lastParsed = message;
  }

  if (lastParsed !== null) return lastParsed;
  throw new MCPTransportError(`no JSON-RPC response found in the body: ${excerpt(body)}`, {
    retryable: true,
  });
}

/** Pulls the `data:` payloads out of an SSE body, one per event. */
function sseData(body: string): readonly string[] {
  const events: string[] = [];
  for (const block of body.split(/\r?\n\r?\n/)) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (data !== '') events.push(data);
  }
  return events;
}

/**
 * Runs a listing call, treating a failure as "this server offers none".
 *
 * A server that implements tools but not prompts answers `prompts/list` with a
 * method-not-found error, and that is a normal, complete answer — not something
 * to fail a capability enumeration over.
 */
async function listSafely(call: () => Promise<unknown>): Promise<readonly unknown[]> {
  try {
    return asArray(await call());
  } catch {
    return [];
  }
}

function asArray(result: unknown): readonly unknown[] {
  return typeof result === 'object' && result !== null ? collectionOf(result) : [];
}

/** MCP wraps listings as `{ tools: [...] }`, `{ resources: [...] }`, etc. */
function collectionOf(result: object): readonly unknown[] {
  for (const key of ['tools', 'resources', 'prompts']) {
    const value = (result as Record<string, unknown>)[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function toCapabilities(
  entries: readonly unknown[],
  kind: MCPCapability['kind'],
): readonly MCPCapability[] {
  const out: MCPCapability[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    // Resources are addressed by uri, tools and prompts by name.
    const name =
      typeof record.name === 'string'
        ? record.name
        : typeof record.uri === 'string'
          ? record.uri
          : null;
    if (name === null) continue;

    out.push({
      name,
      description: typeof record.description === 'string' ? record.description : '',
      kind,
      inputSchema:
        typeof record.inputSchema === 'object' && record.inputSchema !== null
          ? (record.inputSchema as JsonSchema)
          : null,
    });
  }
  return out;
}

function excerpt(text: string, limit = 200): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length <= limit ? collapsed : `${collapsed.slice(0, limit)}…`;
}
