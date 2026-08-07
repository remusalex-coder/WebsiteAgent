/**
 * What a skill is.
 *
 * A skill is one capability the platform can hand to an agent: drive a browser,
 * read a PDF, call the GitHub API, embed a document. Agents never import the
 * library behind a skill — they ask the platform for the capability by id and
 * get back a handle. That indirection is the whole point: swapping Playwright
 * for something else, or moving a skill behind an MCP server, changes one file
 * and no agents.
 *
 * Skills are written to throw. The manager catches, classifies and converts to
 * `CapabilityOutcome`, so a skill author writes ordinary code and every caller
 * still gets structured errors.
 */

import type { AppConfig } from '../../config.js';
import type { Logger } from '../../logger.js';
import type { AIProvider } from '../../ai/types.js';
import type { CapabilityOutcome, HealthReport } from '../types.js';

/**
 * Coarse grouping, for discovery and for the status board. Not a namespace —
 * ids are globally unique regardless of category.
 */
export type SkillCategory =
  | 'web'
  | 'development'
  | 'documents'
  | 'media'
  | 'data'
  | 'operations'
  | 'marketing'
  | 'productivity';

/**
 * Everything a skill is allowed to reach for.
 *
 * The same discipline the agents follow: no `process.env`, no `console`, no
 * module singletons. A skill that needs a model asks `ctx.ai`; a skill that
 * needs another skill asks `ctx.skills`, which is how `playwright` can sit on
 * top of `browser-automation` without importing it.
 */
export interface SkillContext {
  readonly logger: Logger;
  readonly config: AppConfig;
  readonly signal: AbortSignal;
  /** Absolute path this skill may write artifacts to. */
  readonly outputDir: string;
  /**
   * The run's selected AI provider, or `null` when none is configured — a
   * skill that needs one should fail with `missing_credential` rather than
   * assume it exists.
   */
  readonly ai: AIProvider | null;
  /** Resolves declared dependencies. Cycles are rejected at registration. */
  readonly skills: SkillLookup;
  /** Reads a named credential from configuration, e.g. `GITHUB_TOKEN`. */
  readonly credential: (name: string) => string | null;
}

/** The subset of the manager a skill may use to reach its dependencies. */
export interface SkillLookup {
  get<TIn = unknown, TOut = unknown>(id: string): SkillHandle<TIn, TOut>;
  has(id: string): boolean;
}

/**
 * The unit of registration.
 *
 * `dependencies` names other skill ids this one needs; the registry validates
 * them and the manager refuses to execute a skill whose dependencies are
 * missing, so a broken wiring surfaces as `missing_dependency` at the call
 * rather than as a `TypeError` inside the skill.
 */
export interface Skill<TInput = unknown, TOutput = unknown> {
  /** Globally unique, kebab-case, stable across versions. The public name. */
  readonly id: string;
  /** Human-readable, for logs and the status board. */
  readonly name: string;
  readonly description: string;
  /** Semver of the skill itself, independent of the platform's version. */
  readonly version: string;
  /** Ids of other skills this one calls. Empty for a leaf. */
  readonly dependencies: readonly string[];
  readonly category: SkillCategory;
  /**
   * Environment variables this skill needs before it can work. Reported by
   * `health` and checked before `execute`, so a missing token is a structured
   * error rather than a 401 from somewhere deep inside a vendor SDK.
   */
  readonly requiredCredentials?: readonly string[];

  /** Does the work. Throws on failure; the manager converts. */
  execute(input: TInput, ctx: SkillContext): Promise<TOutput>;

  /** Cheap readiness check. Defaults to inspecting `requiredCredentials`. */
  health?(ctx: SkillContext): Promise<HealthReport>;
  /** Called once before first use. Open connections here, not in the module body. */
  init?(ctx: SkillContext): Promise<void>;
  /** Called when the run ends, in reverse registration order. */
  dispose?(): Promise<void>;
}

/** A skill with its input and output types erased, as the registry stores it. */
export type AnySkill = Skill<never, unknown>;

/**
 * What an agent actually holds.
 *
 * Returned by `skills.get(id)` for *any* id, registered or not — an unknown
 * skill yields an unavailable handle rather than `undefined`, so calling code
 * has one shape to write against and never needs a null check or a `try`. The
 * failure arrives as data, from `execute`.
 */
export interface SkillHandle<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  /** False when the skill is unregistered, disabled, or missing a dependency. */
  readonly available: boolean;
  /** Registration metadata, or `null` when nothing is registered under this id. */
  readonly descriptor: SkillDescriptor | null;
  execute(input: TInput): Promise<CapabilityOutcome<TOutput>>;
  health(): Promise<HealthReport>;
}

/** A skill's identity, without its implementation. Safe to serialise and log. */
export interface SkillDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly category: SkillCategory;
  readonly dependencies: readonly string[];
  readonly requiredCredentials: readonly string[];
  readonly enabled: boolean;
}

/**
 * Thrown by a skill that is declared but not yet implemented.
 *
 * Distinct from every other failure: `not_implemented` means "this capability
 * is real, its contract is settled, nothing is wired behind it" — which is a
 * different conversation from a missing key or a broken dependency, and the
 * manager maps it to its own error code accordingly.
 */
export class SkillNotImplementedError extends Error {
  constructor(id: string, detail: string) {
    super(`the "${id}" skill has no implementation bound yet — ${detail}`);
    this.name = 'SkillNotImplementedError';
  }
}

export function describeSkill(skill: AnySkill, enabled: boolean): SkillDescriptor {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    version: skill.version,
    category: skill.category,
    dependencies: skill.dependencies,
    requiredCredentials: skill.requiredCredentials ?? [],
    enabled,
  };
}
