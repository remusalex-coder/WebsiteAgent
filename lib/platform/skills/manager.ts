/**
 * The skill manager.
 *
 * This is the object agents hold. It owns everything the registry and loader
 * deliberately do not: enable/disable policy, dependency checking, credential
 * checking, timeouts, telemetry, lifecycle, and the conversion of thrown
 * exceptions into `CapabilityOutcome`.
 *
 * The contract agents rely on:
 *
 *   const pdf = skills.get('pdf');
 *   const result = await pdf.execute({ … });
 *   if (!result.ok) { … }            // never throws, always structured
 *
 * `get` returns a handle for any id at all. An unknown, disabled or broken
 * skill yields a handle whose `available` is false and whose `execute` returns
 * the reason — so an agent that wants an optional capability writes a branch
 * rather than a `try`, and an agent that requires one calls `require` and gets
 * a throw with the identical detail attached.
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
import { createSkillRegistry } from './registry.js';
import { describeSkill, SkillNotImplementedError } from './types.js';

import type { AppConfig, SkillsConfig } from '../../config.js';
import type { Logger } from '../../logger.js';
import type { AIProvider } from '../../ai/types.js';
import type { Telemetry } from '../telemetry.js';
import type {
  CapabilityError,
  CapabilityOutcome,
  CapabilityRef,
  CapabilityStatus,
  HealthReport,
} from '../types.js';
import type { LoadResult, SkillLoader } from './loader.js';
import type { SkillRegistry } from './registry.js';
import type {
  AnySkill,
  Skill,
  SkillCategory,
  SkillContext,
  SkillDescriptor,
  SkillHandle,
} from './types.js';

export interface SkillManager {
  /**
   * A handle for `id`, registered or not. Never returns null and never throws:
   * the failure, if any, arrives from `execute` as a structured error.
   */
  get<TIn = unknown, TOut = unknown>(id: string): SkillHandle<TIn, TOut>;
  /** As `get`, but throws `CapabilityUnavailableError` when unusable. */
  require<TIn = unknown, TOut = unknown>(id: string): SkillHandle<TIn, TOut>;
  /** True only when the skill is registered, enabled, and its deps resolve. */
  has(id: string): boolean;

  register(skill: AnySkill): void;
  unregister(id: string): boolean;
  /** Loads built-ins and scans the configured discovery directories. */
  discover(): Promise<SkillDiscoveryReport>;

  /** One call, structured either way. Equivalent to `get(id).execute(input)`. */
  execute<TIn = unknown, TOut = unknown>(
    id: string,
    input: TIn,
  ): Promise<CapabilityOutcome<TOut>>;

  list(): readonly SkillDescriptor[];
  listByCategory(category: SkillCategory): readonly SkillDescriptor[];
  /** Health of one skill, or of every enabled skill when `id` is omitted. */
  health(id: string): Promise<HealthReport>;
  status(): Promise<readonly CapabilityStatus[]>;
  /** Runs every registered `dispose`, in reverse registration order. */
  dispose(): Promise<void>;
}

export interface SkillDiscoveryReport {
  readonly registered: number;
  readonly skipped: readonly { readonly origin: string; readonly reason: string }[];
  readonly missingDependencies: readonly { readonly skill: string; readonly missing: string }[];
}

export interface SkillManagerOptions {
  readonly config: AppConfig;
  readonly skillsConfig: SkillsConfig;
  readonly logger: Logger;
  readonly telemetry: Telemetry;
  readonly loader: SkillLoader;
  readonly signal: AbortSignal;
  readonly outputDir: string;
  /** Resolved lazily: the provider may be unconfigured, which is not fatal. */
  readonly getProvider: () => AIProvider | null;
  /** Reads a named credential out of configuration. */
  readonly credential: (name: string) => string | null;
}

export function createSkillManager(options: SkillManagerOptions): SkillManager {
  const { logger, telemetry, skillsConfig } = options;
  const registry: SkillRegistry = createSkillRegistry();
  const initialised = new Set<string>();

  /* ---------------------------------------------------------------- */
  /* Policy                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Enabled unless configuration says otherwise.
   *
   * `disabled` always wins over `enabled`, so an operator can allow a whole
   * category and carve one skill back out without the two lists fighting.
   */
  const isEnabled = (id: string): boolean => {
    if (skillsConfig.disabled.includes(id)) return false;
    if (skillsConfig.enabled.length > 0) return skillsConfig.enabled.includes(id);
    return true;
  };

  const ref = (id: string): CapabilityRef => capabilityRef('skill', id);

  /**
   * Why `id` cannot be called, or `null` when it can.
   *
   * Ordered from most to least fundamental, so the message names the root
   * cause: an unregistered skill is not reported as missing a credential.
   */
  const blockingReason = (id: string): CapabilityError | null => {
    const skill = registry.get(id);
    if (skill === null) {
      return capabilityError(ref(id), 'not_registered', `no skill is registered as "${id}"`, {
        details: { known: registry.list().map((entry) => entry.id) },
      });
    }
    if (!isEnabled(id)) {
      return capabilityError(
        ref(id),
        'disabled',
        'this skill is switched off; remove it from SKILLS_DISABLED or add it to SKILLS_ENABLED',
      );
    }

    for (const dependency of skill.dependencies) {
      if (!registry.has(dependency)) {
        return capabilityError(
          ref(id),
          'missing_dependency',
          `depends on "${dependency}", which is not registered`,
          { details: { dependency } },
        );
      }
      if (!isEnabled(dependency)) {
        return capabilityError(
          ref(id),
          'missing_dependency',
          `depends on "${dependency}", which is disabled`,
          { details: { dependency } },
        );
      }
    }

    const missing = (skill.requiredCredentials ?? []).filter(
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

  /* ---------------------------------------------------------------- */
  /* Execution                                                         */
  /* ---------------------------------------------------------------- */

  const contextFor = (skill: AnySkill): SkillContext => ({
    logger: logger.child(skill.id),
    config: options.config,
    signal: options.signal,
    outputDir: options.outputDir,
    ai: options.getProvider(),
    credential: options.credential,
    skills: {
      get: (id) => manager.get(id),
      has: (id) => manager.has(id),
    },
  });

  /** Classifies whatever a skill threw into one of the structured codes. */
  const classify = (id: string, error: unknown): CapabilityError => {
    if (error instanceof CapabilityUnavailableError) {
      // A dependency's failure, surfacing through its caller. Keep the inner
      // code but re-address it, so the caller sees which skill it asked for.
      return capabilityError(ref(id), error.detail.code, error.detail.message, {
        retryable: error.detail.retryable,
        details: { ...error.detail.details, via: error.detail.capability.id },
      });
    }
    if (error instanceof SkillNotImplementedError) {
      return capabilityError(ref(id), 'not_implemented', error.message);
    }
    if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
      const timedOut = !options.signal.aborted;
      return capabilityError(
        ref(id),
        timedOut ? 'timeout' : 'cancelled',
        timedOut
          ? `exceeded its ${skillsConfig.timeoutMs}ms budget`
          : 'the run was cancelled',
      );
    }
    return capabilityError(
      ref(id),
      'internal',
      error instanceof Error ? error.message : String(error),
      { details: { type: error instanceof Error ? error.name : typeof error } },
    );
  };

  const execute = async <TIn, TOut>(
    id: string,
    input: TIn,
  ): Promise<CapabilityOutcome<TOut>> => {
    const startedAt = Date.now();

    const blocked = blockingReason(id);
    if (blocked !== null) {
      // Still recorded: an agent repeatedly asking for a skill that is not
      // there is exactly the kind of thing a status board should show.
      telemetry.record({
        capability: ref(id),
        operation: 'execute',
        ok: false,
        durationMs: 0,
        at: new Date().toISOString(),
        errorCode: blocked.code,
        errorMessage: blocked.message,
        fields: {},
      });
      return failed(blocked, 0);
    }

    // Non-null: `blockingReason` returned null, so the skill is registered.
    const skill = registry.get(id) as AnySkill;
    const ctx = contextFor(skill);

    try {
      if (skill.init !== undefined && !initialised.has(id)) {
        await skill.init(ctx);
        initialised.add(id);
      }

      const data = await instrument(
        telemetry,
        ref(id),
        'execute',
        () => withTimeout(skill, input, ctx, skillsConfig.timeoutMs, options.signal),
        { version: skill.version },
      );
      return ok(data as TOut, Date.now() - startedAt);
    } catch (error) {
      const classified = classify(id, error);
      logger.warn('skill call failed', {
        skill: id,
        code: classified.code,
        error: classified.message,
      });
      return failed(classified, Date.now() - startedAt);
    }
  };

  /* ---------------------------------------------------------------- */
  /* Handles                                                           */
  /* ---------------------------------------------------------------- */

  const handleFor = <TIn, TOut>(id: string): SkillHandle<TIn, TOut> => {
    const skill = registry.get(id);
    const blocked = blockingReason(id);

    return {
      id,
      available: blocked === null,
      descriptor: skill === null ? null : describeSkill(skill, isEnabled(id)),
      execute: (input: TIn) => execute<TIn, TOut>(id, input),
      health: () => manager.health(id),
    };
  };

  /* ---------------------------------------------------------------- */
  /* Manager                                                           */
  /* ---------------------------------------------------------------- */

  const manager: SkillManager = {
    get<TIn = unknown, TOut = unknown>(id: string): SkillHandle<TIn, TOut> {
      return handleFor<TIn, TOut>(id);
    },

    require<TIn = unknown, TOut = unknown>(id: string): SkillHandle<TIn, TOut> {
      const blocked = blockingReason(id);
      if (blocked !== null) throw new CapabilityUnavailableError(blocked);
      return handleFor<TIn, TOut>(id);
    },

    has(id: string): boolean {
      return blockingReason(id) === null;
    },

    register(skill: AnySkill): void {
      registry.register(skill);
      logger.debug('skill registered', {
        skill: skill.id,
        version: skill.version,
        category: skill.category,
      });
    },

    unregister(id: string): boolean {
      initialised.delete(id);
      return registry.unregister(id);
    },

    async discover(): Promise<SkillDiscoveryReport> {
      const results: LoadResult[] = [options.loader.loadBuiltins()];
      for (const directory of skillsConfig.discoveryDirs) {
        results.push(await options.loader.discover(directory));
      }

      const skipped = results.flatMap((result) => result.failures).map((failure) => ({
        origin: failure.origin,
        reason: failure.reason,
      }));

      let registered = 0;
      for (const { skill, origin } of results.flatMap((result) => result.loaded)) {
        try {
          // Discovered skills may deliberately shadow a built-in — that is how
          // a real Playwright implementation replaces its placeholder.
          registry.replace(skill);
          registered += 1;
        } catch (error) {
          skipped.push({
            origin,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const missingDependencies = registry.missingDependencies();
      if (skipped.length > 0) logger.warn('skills skipped during discovery', { skipped });
      if (missingDependencies.length > 0) {
        logger.warn('skills declare dependencies nothing provides', { missingDependencies });
      }
      logger.info('skills loaded', {
        registered,
        enabled: registry.list().filter((skill) => isEnabled(skill.id)).length,
        skipped: skipped.length,
      });

      return { registered, skipped, missingDependencies };
    },

    execute,

    list(): readonly SkillDescriptor[] {
      return registry.describe(isEnabled);
    },

    listByCategory(category: SkillCategory): readonly SkillDescriptor[] {
      return registry
        .listByCategory(category)
        .map((skill) => describeSkill(skill, isEnabled(skill.id)));
    },

    async health(id: string): Promise<HealthReport> {
      const blocked = blockingReason(id);
      if (blocked !== null) return healthReport('unavailable', blocked.message);

      const skill = registry.get(id) as AnySkill;
      if (skill.health === undefined) {
        // Nothing declared a probe, and the blocking checks above already
        // confirmed registration, policy, dependencies and credentials.
        return healthReport('ready', 'registered, enabled, dependencies and credentials satisfied');
      }

      const startedAt = Date.now();
      try {
        return await skill.health(contextFor(skill));
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
        registry.list().map(async (skill): Promise<CapabilityStatus> => ({
          id: skill.id,
          kind: 'skill',
          name: skill.name,
          version: skill.version,
          enabled: isEnabled(skill.id),
          health: await manager.health(skill.id),
          metrics: telemetry.metricsFor(ref(skill.id)),
        })),
      );
    },

    async dispose(): Promise<void> {
      // Reverse registration order: a skill that depends on another should shut
      // down before the thing it depends on does.
      for (const skill of [...registry.list()].reverse()) {
        if (skill.dispose === undefined || !initialised.has(skill.id)) continue;
        try {
          await skill.dispose();
        } catch (error) {
          logger.warn('skill dispose failed', {
            skill: skill.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      initialised.clear();
    },
  };

  return manager;
}

/* ------------------------------------------------------------------ */
/* Timeouts                                                            */
/* ------------------------------------------------------------------ */

/**
 * Races a skill against its budget.
 *
 * A cooperative skill watches `ctx.signal` and stops; an uncooperative one
 * keeps running and its result is discarded. Both cases return to the caller
 * on time, which is the property that matters — a skill cannot hang a pipeline
 * stage.
 */
async function withTimeout<TIn, TOut>(
  skill: Skill<never, unknown>,
  input: TIn,
  ctx: SkillContext,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<TOut> {
  if (timeoutMs <= 0) return (await skill.execute(input as never, ctx)) as TOut;

  let timer: NodeJS.Timeout | undefined;
  const budget = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error(`timed out after ${timeoutMs}ms`);
      error.name = signal.aborted ? 'AbortError' : 'TimeoutError';
      reject(error);
    }, timeoutMs);
    timer.unref?.();
  });

  try {
    return (await Promise.race([skill.execute(input as never, ctx), budget])) as TOut;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
