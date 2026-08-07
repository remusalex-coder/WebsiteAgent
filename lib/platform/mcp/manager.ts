/**
 * The MCP manager.
 *
 * Holds many servers, routes calls to them, and gives them the same treatment
 * skills get: enable/disable policy, credential checks, telemetry, structured
 * errors, and one status row each.
 *
 * Two things it does that the skill manager does not:
 *
 *   - **capability caching.** `tools/list` is a network round trip, and a
 *     capability set does not change mid-run. It is fetched once per server.
 *   - **capability search.** With several servers registered, "who can do X?"
 *     is a real question, and answering it by hand means a caller hard-coding
 *     which server owns which tool — exactly the coupling this layer exists to
 *     prevent.
 */

import { instrument } from '../telemetry.js';
import {
  CapabilityUnavailableError,
  capabilityError,
  capabilityRef,
  failed,
  healthReport,
  ok,
} from '../types.js';
import { MCPTransportError } from './httpConnector.js';
import { MCPNotImplementedError } from './stdioConnector.js';

import type { Logger } from '../../logger.js';
import type { McpConfig } from '../../config.js';
import type { Telemetry } from '../telemetry.js';
import type {
  CapabilityError,
  CapabilityOutcome,
  CapabilityRef,
  CapabilityStatus,
  HealthReport,
} from '../types.js';
import type {
  MCPCall,
  MCPCapability,
  MCPConnector,
  MCPHandle,
  MCPServerMetadata,
} from './types.js';

export interface MCPManager {
  /** A handle for `id`, registered or not. Never throws, never returns null. */
  get(id: string): MCPHandle;
  /** As `get`, but throws `CapabilityUnavailableError` when unusable. */
  require(id: string): MCPHandle;
  has(id: string): boolean;

  register(connector: MCPConnector): void;
  unregister(id: string): Promise<boolean>;
  /** Turns a server on or off for the rest of the run. */
  setEnabled(id: string, enabled: boolean): void;

  list(): readonly MCPServerMetadata[];
  /** Every capability across every enabled server, each tagged with its server. */
  capabilities(): Promise<readonly LocatedCapability[]>;
  /** Servers offering a capability with this exact name, enabled ones only. */
  find(capabilityName: string): Promise<readonly LocatedCapability[]>;

  execute(serverId: string, call: MCPCall): Promise<CapabilityOutcome<unknown>>;
  health(id: string): Promise<HealthReport>;
  status(): Promise<readonly CapabilityStatus[]>;
  /** Disconnects every server that opened a session. */
  dispose(): Promise<void>;
}

/** A capability and the server that offers it. */
export interface LocatedCapability extends MCPCapability {
  readonly serverId: string;
}

export interface MCPManagerOptions {
  readonly config: McpConfig;
  readonly logger: Logger;
  readonly telemetry: Telemetry;
  readonly signal: AbortSignal;
  readonly credential: (name: string) => string | null;
}

export function createMCPManager(options: MCPManagerOptions): MCPManager {
  const { logger, telemetry, config } = options;

  const connectors = new Map<string, MCPConnector>();
  /** Runtime overrides of the configured enable/disable policy. */
  const overrides = new Map<string, boolean>();
  /** `tools/list` results, one entry per server, fetched at most once. */
  const capabilityCache = new Map<string, readonly MCPCapability[]>();
  const connected = new Set<string>();

  const ref = (id: string): CapabilityRef => capabilityRef('mcp', id);

  /* ---------------------------------------------------------------- */
  /* Policy                                                            */
  /* ---------------------------------------------------------------- */

  const isEnabled = (id: string): boolean => {
    const override = overrides.get(id);
    if (override !== undefined) return override;
    if (config.disabled.includes(id)) return false;
    if (config.enabled.length > 0) return config.enabled.includes(id);
    return true;
  };

  const blockingReason = (id: string): CapabilityError | null => {
    const connector = connectors.get(id);
    if (connector === undefined) {
      return capabilityError(ref(id), 'not_registered', `no MCP server is registered as "${id}"`, {
        details: { known: [...connectors.keys()] },
      });
    }
    if (!isEnabled(id)) {
      return capabilityError(ref(id), 'disabled', 'this MCP server is switched off');
    }

    const missing = connector.metadata.requiredCredentials.filter(
      (name) => options.credential(name) === null,
    );
    if (missing.length > 0) {
      return capabilityError(
        ref(id),
        'missing_credential',
        `needs ${missing.join(', ')}, which ${missing.length === 1 ? 'is' : 'are'} not configured`,
        { details: { missing } },
      );
    }
    return null;
  };

  /** Classifies whatever a connector threw into one of the structured codes. */
  const classify = (id: string, error: unknown): CapabilityError => {
    if (error instanceof MCPNotImplementedError) {
      return capabilityError(ref(id), 'not_implemented', error.message);
    }
    if (error instanceof MCPTransportError) {
      return capabilityError(ref(id), 'upstream', error.message, {
        retryable: error.retryable,
        details: error.status !== null ? { status: error.status } : {},
      });
    }
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      const cancelled = options.signal.aborted;
      return capabilityError(
        ref(id),
        cancelled ? 'cancelled' : 'timeout',
        cancelled ? 'the run was cancelled' : error.message,
      );
    }
    return capabilityError(
      ref(id),
      'internal',
      error instanceof Error ? error.message : String(error),
    );
  };

  /* ---------------------------------------------------------------- */
  /* Capability enumeration                                            */
  /* ---------------------------------------------------------------- */

  const capabilitiesOf = async (id: string): Promise<readonly MCPCapability[]> => {
    const cached = capabilityCache.get(id);
    if (cached !== undefined) return cached;

    const connector = connectors.get(id);
    if (connector === undefined) return [];

    const found = await instrument(
      telemetry,
      ref(id),
      'capabilities',
      () => connector.capabilities(options.signal),
    );
    capabilityCache.set(id, found);
    logger.debug('mcp capabilities listed', { server: id, count: found.length });
    return found;
  };

  /** Enabled servers only — a disabled one should not appear in a search. */
  const enabledIds = (): readonly string[] =>
    [...connectors.keys()].filter((id) => blockingReason(id) === null);

  /* ---------------------------------------------------------------- */
  /* Execution                                                         */
  /* ---------------------------------------------------------------- */

  const execute = async (
    serverId: string,
    call: MCPCall,
  ): Promise<CapabilityOutcome<unknown>> => {
    const startedAt = Date.now();

    const blocked = blockingReason(serverId);
    if (blocked !== null) {
      telemetry.record({
        capability: ref(serverId),
        operation: 'execute',
        ok: false,
        durationMs: 0,
        at: new Date().toISOString(),
        errorCode: blocked.code,
        errorMessage: blocked.message,
        fields: { capability: call.capability },
      });
      return failed(blocked, 0);
    }

    const connector = connectors.get(serverId) as MCPConnector;

    try {
      if (connector.connect !== undefined && !connected.has(serverId)) {
        await connector.connect(options.signal);
        connected.add(serverId);
      }

      const data = await instrument(
        telemetry,
        ref(serverId),
        'execute',
        () => connector.execute(call, options.signal),
        { capability: call.capability },
      );
      return ok(data, Date.now() - startedAt);
    } catch (error) {
      const classified = classify(serverId, error);
      logger.warn('mcp call failed', {
        server: serverId,
        capability: call.capability,
        code: classified.code,
        error: classified.message,
      });
      return failed(classified, Date.now() - startedAt);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Handles                                                           */
  /* ---------------------------------------------------------------- */

  const handleFor = (id: string): MCPHandle => {
    const connector = connectors.get(id);

    return {
      id,
      available: blockingReason(id) === null,
      metadata: connector?.metadata ?? null,

      async capabilities(): Promise<CapabilityOutcome<readonly MCPCapability[]>> {
        const startedAt = Date.now();
        const blocked = blockingReason(id);
        if (blocked !== null) return failed(blocked, 0);
        try {
          return ok(await capabilitiesOf(id), Date.now() - startedAt);
        } catch (error) {
          return failed(classify(id, error), Date.now() - startedAt);
        }
      },

      execute: (call: MCPCall) => execute(id, call),
      health: () => manager.health(id),
    };
  };

  /* ---------------------------------------------------------------- */
  /* Manager                                                           */
  /* ---------------------------------------------------------------- */

  const manager: MCPManager = {
    get: handleFor,

    require(id: string): MCPHandle {
      const blocked = blockingReason(id);
      if (blocked !== null) throw new CapabilityUnavailableError(blocked);
      return handleFor(id);
    },

    has(id: string): boolean {
      return blockingReason(id) === null;
    },

    register(connector: MCPConnector): void {
      const { id } = connector.metadata;
      // Replacement is allowed and invalidates the cache: a re-registered
      // server is a different server until it says otherwise.
      capabilityCache.delete(id);
      connected.delete(id);
      connectors.set(id, connector);
      logger.debug('mcp server registered', {
        server: id,
        transport: connector.metadata.transport,
        enabled: isEnabled(id),
      });
    },

    async unregister(id: string): Promise<boolean> {
      const connector = connectors.get(id);
      if (connector === undefined) return false;
      if (connector.disconnect !== undefined && connected.has(id)) {
        try {
          await connector.disconnect();
        } catch (error) {
          logger.warn('mcp disconnect failed', {
            server: id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      connected.delete(id);
      capabilityCache.delete(id);
      return connectors.delete(id);
    },

    setEnabled(id: string, enabled: boolean): void {
      overrides.set(id, enabled);
      logger.debug('mcp server toggled', { server: id, enabled });
    },

    list(): readonly MCPServerMetadata[] {
      return [...connectors.values()].map((connector) => connector.metadata);
    },

    async capabilities(): Promise<readonly LocatedCapability[]> {
      const perServer = await Promise.all(
        enabledIds().map(async (id) => {
          try {
            return (await capabilitiesOf(id)).map((capability) => ({
              ...capability,
              serverId: id,
            }));
          } catch (error) {
            // One unreachable server must not blank the whole catalogue.
            logger.warn('mcp capability listing failed', {
              server: id,
              error: error instanceof Error ? error.message : String(error),
            });
            return [];
          }
        }),
      );
      return perServer.flat();
    },

    async find(capabilityName: string): Promise<readonly LocatedCapability[]> {
      const all = await manager.capabilities();
      return all.filter((capability) => capability.name === capabilityName);
    },

    execute,

    async health(id: string): Promise<HealthReport> {
      const blocked = blockingReason(id);
      if (blocked !== null) return healthReport('unavailable', blocked.message);

      const connector = connectors.get(id) as MCPConnector;
      const startedAt = Date.now();
      try {
        return await connector.health(options.signal);
      } catch (error) {
        return healthReport(
          'unavailable',
          `health check threw: ${error instanceof Error ? error.message : String(error)}`,
          Date.now() - startedAt,
        );
      }
    },

    async status(): Promise<readonly CapabilityStatus[]> {
      return Promise.all(
        [...connectors.values()].map(async (connector): Promise<CapabilityStatus> => {
          const { id } = connector.metadata;
          return {
            id,
            kind: 'mcp',
            name: `${connector.metadata.name} (${connector.metadata.transport})`,
            version: connector.metadata.version,
            enabled: isEnabled(id),
            health: await manager.health(id),
            metrics: telemetry.metricsFor(ref(id)),
          };
        }),
      );
    },

    async dispose(): Promise<void> {
      for (const connector of connectors.values()) {
        const { id } = connector.metadata;
        if (connector.disconnect === undefined || !connected.has(id)) continue;
        try {
          await connector.disconnect();
        } catch (error) {
          logger.warn('mcp disconnect failed', {
            server: id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      connected.clear();
      capabilityCache.clear();
    },
  };

  return manager;
}
