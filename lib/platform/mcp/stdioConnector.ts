/**
 * MCP over stdio — declared, not implemented.
 *
 * A stdio server is a child process the platform owns: it has to be spawned,
 * framed, kept alive across calls, drained on both pipes, and reaped on
 * shutdown, and getting any of that wrong leaks processes rather than failing
 * cleanly. That is a real piece of work and it is not this refactor's.
 *
 * So the transport is registered honestly instead of half-built. A configured
 * stdio server appears on the status board as `unavailable` with a reason, and
 * calls to it return the `not_implemented` code — the same treatment the
 * placeholder skills get, for the same reason: a capability that silently
 * returns nothing is worse than one that says it is not there.
 */

import { healthReport } from '../types.js';

import type { HealthReport } from '../types.js';
import type {
  MCPCall,
  MCPCapability,
  MCPConnector,
  MCPServerMetadata,
} from './types.js';

const CONNECTOR_VERSION = '0.0.0';

const UNAVAILABLE = 'the stdio transport is not implemented; use an http endpoint instead';

export interface StdioConnectorOptions {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly command: string;
  readonly args: readonly string[];
  readonly requiredCredentials: readonly string[];
}

/** Raised by an unimplemented transport. The manager maps it to `not_implemented`. */
export class MCPNotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPNotImplementedError';
  }
}

export function createStdioConnector(options: StdioConnectorOptions): MCPConnector {
  const metadata: MCPServerMetadata = {
    id: options.id,
    name: options.name,
    description: options.description,
    version: CONNECTOR_VERSION,
    transport: 'stdio',
    endpoint: null,
    command: options.command,
    args: options.args,
    requiredCredentials: options.requiredCredentials,
  };

  return {
    metadata,

    capabilities(): Promise<readonly MCPCapability[]> {
      // Empty rather than throwing: enumeration should degrade to "offers
      // nothing" so a status sweep over every server still completes.
      return Promise.resolve([]);
    },

    execute(_call: MCPCall): Promise<unknown> {
      return Promise.reject(new MCPNotImplementedError(UNAVAILABLE));
    },

    health(): Promise<HealthReport> {
      return Promise.resolve(healthReport('unavailable', UNAVAILABLE));
    },
  };
}
