/**
 * What an MCP server looks like from inside this platform.
 *
 * A connector is one server: its identity, what it can do, whether it is well,
 * and how to call it. The manager holds many and routes between them.
 *
 * The distinction from a skill is worth stating, because the two overlap:
 *
 *   - a **skill** is a capability this repository implements;
 *   - an **MCP server** is a capability someone else implements, reached over
 *     a protocol, discovered at runtime rather than declared at build time.
 *
 * The consequence is that a skill's inputs are typed at compile time and an MCP
 * tool's are not — they arrive as a JSON Schema from the server. So MCP calls
 * are `unknown` in and `unknown` out, and a caller that wants types puts a skill
 * in front of the server. That is the intended way to use this layer.
 */

import type { JsonSchema } from '../../ai/types.js';
import type { CapabilityOutcome, HealthReport } from '../types.js';

/** How a connector reaches its server. */
export type MCPTransport =
  /** Long-lived child process speaking JSON-RPC over stdio. */
  | 'stdio'
  /** MCP Streamable HTTP: JSON-RPC over POST. */
  | 'http'
  /** In-process, for tests and for wrapping local code as a server. */
  | 'inproc';

export interface MCPServerMetadata {
  /** Unique within the manager. Appears in configuration and in logs. */
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** The connector adapter's version, not the remote server's. */
  readonly version: string;
  readonly transport: MCPTransport;
  /** Endpoint for `http`; `null` for the transports that have none. */
  readonly endpoint: string | null;
  /** Command and arguments for `stdio`; empty otherwise. */
  readonly command: string | null;
  readonly args: readonly string[];
  /** Environment variables the server needs before it can be started. */
  readonly requiredCredentials: readonly string[];
}

/** One thing a server offers. Names and schemas come from the server itself. */
export interface MCPCapability {
  readonly name: string;
  readonly description: string;
  readonly kind: 'tool' | 'resource' | 'prompt';
  /** The server's declared input schema, verbatim. Not translated. */
  readonly inputSchema: JsonSchema | null;
}

/** One invocation. `arguments` is passed through as the server declared it. */
export interface MCPCall {
  readonly capability: string;
  readonly arguments: Record<string, unknown>;
}

/**
 * One MCP server, behind the four questions every capability answers.
 *
 * `connect` and `disconnect` are optional because an HTTP server needs no
 * session and a stdio one does. The manager calls them when present.
 */
export interface MCPConnector {
  readonly metadata: MCPServerMetadata;
  /** What the server offers. Cached by the manager; call is not free. */
  capabilities(signal?: AbortSignal): Promise<readonly MCPCapability[]>;
  health(signal?: AbortSignal): Promise<HealthReport>;
  /** Invokes one capability. Throws; the manager converts to an outcome. */
  execute(call: MCPCall, signal?: AbortSignal): Promise<unknown>;
  connect?(signal?: AbortSignal): Promise<void>;
  disconnect?(): Promise<void>;
}

/**
 * What a caller holds for one server. Mirrors `SkillHandle` on purpose: an
 * agent should not have to hold two mental models for "a capability I can call
 * that might not be there".
 */
export interface MCPHandle {
  readonly id: string;
  readonly available: boolean;
  readonly metadata: MCPServerMetadata | null;
  capabilities(): Promise<CapabilityOutcome<readonly MCPCapability[]>>;
  execute(call: MCPCall): Promise<CapabilityOutcome<unknown>>;
  health(): Promise<HealthReport>;
}
