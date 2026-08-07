/**
 * The platform.
 *
 * One object holding the three pluggable subsystems, constructed once per run
 * by the orchestrator and handed to every agent through `AgentContext`.
 *
 * This is the line the whole refactor exists to draw. Above it, an agent says
 * what it needs:
 *
 *     const model  = platform.ai();                  // whichever vendor
 *     const pdf    = platform.skills.get('pdf');     // however it is built
 *     const github = platform.mcp.get('github');     // wherever it runs
 *
 * Below it, everything is configuration: which vendor, which implementation,
 * which endpoint. Adding a provider, a skill or a server changes only what is
 * registered here — never an agent, never a stage, never a JSON artifact.
 */

import { createAIProviderFactory } from '../ai/factory.js';
import { normaliseFlagName } from '../config.js';
import { createHttpConnector } from './mcp/httpConnector.js';
import { createMCPManager } from './mcp/manager.js';
import { createStdioConnector } from './mcp/stdioConnector.js';
import { BUILTIN_SKILLS } from './skills/builtin/index.js';
import { createSkillLoader } from './skills/loader.js';
import { createSkillManager } from './skills/manager.js';
import {
  NULL_SINK,
  createLoggingSink,
  createTelemetry,
} from './telemetry.js';

import type { AIProvider, AIProviderName } from '../ai/types.js';
import type { AIProviderFactory } from '../ai/factory.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { MCPManager } from './mcp/manager.js';
import type { SkillManager } from './skills/manager.js';
import type { Telemetry } from './telemetry.js';
import type { CapabilityStatus } from './types.js';

export interface Platform {
  /**
   * The run's AI provider. Throws a configuration error naming the variable to
   * fix when `AI_PROVIDER` is unset, unknown, or uncredentialled.
   */
  ai(): AIProvider;
  /** The AI provider, or `null` when none is usable. For optional callers. */
  tryAi(): AIProvider | null;
  /** Provider construction and the per-vendor status board. */
  readonly providers: AIProviderFactory;
  readonly skills: SkillManager;
  readonly mcp: MCPManager;
  readonly telemetry: Telemetry;
  /** True when a named feature flag is on. Unknown flags are off. */
  feature(name: string): boolean;
  /** Every capability, with health and observed behaviour. */
  status(signal?: AbortSignal): Promise<readonly CapabilityStatus[]>;
  /** A credential-free summary, safe to log and to persist. */
  describe(): PlatformDescription;
  /** Releases everything the platform opened. Safe to call more than once. */
  dispose(): Promise<void>;
}

/**
 * What is wired up, without any secret values.
 *
 * `credentialsPresent` lists variable *names* that are set — never their
 * contents — so a run log can show why a skill was unavailable without
 * becoming something that must be handled carefully.
 */
export interface PlatformDescription {
  readonly provider: AIProviderName | null;
  readonly providersConfigured: readonly string[];
  readonly skills: { readonly registered: number; readonly enabled: number };
  readonly mcpServers: readonly string[];
  readonly features: Readonly<Record<string, boolean>>;
  readonly credentialsPresent: readonly string[];
}

export interface PlatformOptions {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly signal: AbortSignal;
  /** This run's artifact directory; skills write beneath it. */
  readonly outputDir: string;
}

/**
 * Builds the platform and loads everything configuration asks for.
 *
 * Asynchronous because skill discovery reads the filesystem. Nothing here
 * reaches the network: providers are constructed lazily on first use, and MCP
 * servers are registered without being contacted, so a run with no connectivity
 * still starts and fails at the point it actually needs something.
 */
export async function createPlatform(options: PlatformOptions): Promise<Platform> {
  const { config, logger, signal } = options;
  const platformLogger = logger.child('platform');

  const telemetry = createTelemetry({
    sink: config.telemetry.enabled ? createLoggingSink(platformLogger) : NULL_SINK,
    sampleLimit: config.telemetry.sampleLimit,
  });

  const credential = (name: string): string | null => config.credentials[name] ?? null;

  /* ---------------------------------------------------------------- */
  /* Providers                                                         */
  /* ---------------------------------------------------------------- */

  const providers = createAIProviderFactory({
    config: config.ai,
    logger: platformLogger.child('ai'),
    telemetry,
  });

  /* ---------------------------------------------------------------- */
  /* Skills                                                            */
  /* ---------------------------------------------------------------- */

  const skills = createSkillManager({
    config,
    skillsConfig: config.skills,
    logger: platformLogger.child('skills'),
    telemetry,
    loader: createSkillLoader({
      logger: platformLogger.child('skills'),
      builtins: BUILTIN_SKILLS,
    }),
    signal,
    outputDir: options.outputDir,
    // Lazily, and tolerantly: a skill that does not need a model must not be
    // blocked by the absence of one.
    getProvider: () => providers.tryCreateDefault(),
    credential,
  });

  await skills.discover();

  /* ---------------------------------------------------------------- */
  /* MCP                                                               */
  /* ---------------------------------------------------------------- */

  const mcp = createMCPManager({
    config: config.mcp,
    logger: platformLogger.child('mcp'),
    telemetry,
    signal,
    credential,
  });

  for (const server of config.mcp.servers) {
    if (server.transport === 'stdio') {
      mcp.register(
        createStdioConnector({
          id: server.id,
          name: server.name,
          description: server.description,
          command: server.command ?? '',
          args: server.args,
          requiredCredentials: server.requiredCredentials,
        }),
      );
      continue;
    }

    mcp.register(
      createHttpConnector({
        id: server.id,
        name: server.name,
        description: server.description,
        // Non-null by construction: `loadConfig` rejects an http server with
        // no endpoint.
        endpoint: server.endpoint ?? '',
        headers: server.headers,
        requiredCredentials: server.requiredCredentials,
        timeoutMs: config.mcp.requestTimeoutMs,
        logger: platformLogger.child('mcp'),
      }),
    );
  }

  /* ---------------------------------------------------------------- */
  /* Platform                                                          */
  /* ---------------------------------------------------------------- */

  const platform: Platform = {
    ai: () => providers.createDefault(),
    tryAi: () => providers.tryCreateDefault(),
    providers,
    skills,
    mcp,
    telemetry,

    feature(name: string): boolean {
      // Same normalisation the loader applied, so `places-api` and
      // `PLACES_API` reach the flag `FEATURE_PLACES_API` set.
      return config.features[normaliseFlagName(name)] ?? false;
    },

    async status(statusSignal?: AbortSignal): Promise<readonly CapabilityStatus[]> {
      const [providerRows, skillRows, mcpRows] = await Promise.all([
        providers.status(statusSignal),
        skills.status(),
        mcp.status(),
      ]);
      return [...providerRows, ...skillRows, ...mcpRows];
    },

    describe(): PlatformDescription {
      const registered = skills.list();
      return {
        provider: providers.selected(),
        providersConfigured: providers.configured(),
        skills: {
          registered: registered.length,
          enabled: registered.filter((skill) => skill.enabled).length,
        },
        mcpServers: mcp.list().map((server) => server.id),
        features: config.features,
        // Names only. Never values.
        credentialsPresent: Object.keys(config.credentials).sort(),
      };
    },

    async dispose(): Promise<void> {
      await skills.dispose();
      await mcp.dispose();
    },
  };

  const summary = platform.describe();
  platformLogger.info('platform ready', {
    provider: summary.provider ?? '(unset)',
    skills: `${summary.skills.enabled}/${summary.skills.registered} enabled`,
    mcpServers: summary.mcpServers.length,
    features: Object.keys(summary.features).length,
  });

  return platform;
}
