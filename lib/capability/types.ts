/**
 * The one capability vocabulary.
 *
 * Before this module the repository named its capabilities three different
 * ways: `RouterCapability` had three values (`generate`, `vision`,
 * `deterministic-floor`), `FactoryCapability` had five, and the skill layer had
 * eight *categories* that were not capabilities at all. Nothing spanned
 * providers, skills, MCP servers and in-repo tools, so "which of everything we
 * have should serve this job" had no place to be answered.
 *
 * This is that place. A capability is a **need**, stated in the language of the
 * work — "judge whether this page looks art-directed", "read a menu photograph"
 * — never in the language of a vendor. What serves it is a separate question,
 * answered by `bindings.ts` and decided by `plan.ts`.
 *
 * ## Three properties do most of the work
 *
 * `terminal` — what happens when every service fails. A capability whose
 * terminal is `null` fails loudly; one with a terminal degrades to something
 * this repository already owns, at zero cost. That is the invariant behind "no
 * failure produces *no website*, only a plainer one".
 *
 * `modelMayWriteOutput` — Freeze F-08. When false, no model-backed service is
 * eligible at all: the planner removes them before ranking, so a bug in the
 * ranking cannot let a model author bytes a customer receives.
 *
 * `gate` — a policy stop that no amount of budget clears. `human` means an
 * autonomous run may not take this path; `never` means the capability is
 * declared so the system can say "we deliberately do not do this".
 */

import type { AIProviderName } from '../ai/types.js';
import type { CapabilityKind, CapabilityRef } from '../platform/types.js';

/* ------------------------------------------------------------------ */
/* The vocabulary                                                      */
/* ------------------------------------------------------------------ */

/**
 * Every capability BusinessForge can need, whether or not this build can serve
 * it. Declaring one it cannot serve is deliberate: the board then reports the
 * gap instead of hiding it.
 */
export const CAPABILITY_IDS = [
  // Language
  'reasoning',
  'structured_generation',
  'prose_writing',
  'creative_direction',
  'enum_direction',
  'adversarial_critique',
  // Evidence
  'evidence_collection',
  'evidence_research',
  'market_research',
  'evidence_extraction',
  'pii_detection',
  // Vision and media
  'vision_description',
  'craft_judging',
  'distinctness_judging',
  'visual_defect_detection',
  'image_nondepictive',
  'image_editing',
  'vector_generation',
  'motion_media',
  'audio_speech',
  'three_d_generation',
  // Semantic
  'semantic_index',
  'design_memory',
  // Measurement — never a model
  'qa_measurement',
  'visual_regression',
  'accessibility',
  'performance',
  'output_security',
  'structured_data_validation',
  // Delivery and operations
  'runtime_tier',
  'build_artifact',
  'hosting',
  'discoverability',
  'observability',
  'cost_ledger',
  'rate_governor',
  'human_approval',
] as const;

export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export function isCapabilityId(value: string): value is CapabilityId {
  return (CAPABILITY_IDS as readonly string[]).includes(value);
}

/**
 * How much the product depends on a capability.
 *
 * `core` — the pipeline cannot deliver without it (though it may degrade to the
 * terminal). `conditional` — activated by the evidence, not by a flag.
 * `specialist` — one narrow strength, invoked by name. `rejected` — declared so
 * the decision is recorded, never planned.
 */
export type CapabilityTier = 'core' | 'conditional' | 'specialist' | 'rejected';

/** A policy stop that budget does not clear. */
export type CapabilityGate =
  /** No gate. */
  | 'none'
  /** An autonomous run may not take this path; a person must approve it. */
  | 'human'
  /** No model-backed service is eligible, ever (F-08). */
  | 'no-model'
  /** Declared and deliberately not built. */
  | 'never';

export interface CapabilityDescriptor {
  readonly id: CapabilityId;
  readonly tier: CapabilityTier;
  /** One line, in the language of the work. Shown on the board. */
  readonly summary: string;
  /**
   * What this repository falls back to when every service fails, or `null`
   * when the honest answer is to fail loudly. Prose, because the terminal is
   * usually an existing module rather than another routable service.
   */
  readonly terminal: string | null;
  /** Freeze F-08. False removes every model-backed service before ranking. */
  readonly modelMayWriteOutput: boolean;
  readonly gate: CapabilityGate;
  /** Why the tier is what it is — the sentence a reviewer would ask for. */
  readonly rationale: string;
}

/* ------------------------------------------------------------------ */
/* Services — the things that can serve a capability                   */
/* ------------------------------------------------------------------ */

/**
 * What kind of thing serves a capability.
 *
 * Wider than the platform's `CapabilityKind` (`provider | skill | mcp`) on
 * purpose: a Playwright measurement and a deterministic composition are neither
 * providers nor MCP servers, and calling them "skills" when nothing is
 * registered in the skill manager would make the board lie.
 */
export type ServiceKind =
  /** A model call through an `AIProvider`. */
  | 'model'
  /** A capability the platform's skill manager owns. */
  | 'skill'
  /** A capability reached over MCP. */
  | 'mcp'
  /** In-repo code with a real dependency — Playwright, axe, sharp. */
  | 'tool'
  /** In-repo code with no dependency and no cost. The floor. */
  | 'deterministic';

/** Commercial terms under which a service's output may be used. */
export type LicenceClass =
  /** A commercial API whose terms permit customer-facing output. */
  | 'commercial-api'
  /** Free tier whose commercial-use terms are not settled (Freeze O-3). */
  | 'free-tier-unverified'
  /** Permissive open source, running locally. */
  | 'permissive-local'
  /** Copyleft, running locally and not redistributed. */
  | 'copyleft-local';

/** Where a service's data goes. `local` never leaves the machine. */
export type Jurisdiction = 'local' | 'us' | 'eu' | 'other';

/**
 * One thing that can serve one capability.
 *
 * A binding is a *declaration*, not a connection: nothing here is contacted
 * until the planner selects it and the executor calls it. `order` is the
 * repository's stated preference, used only to break a tie that cost and
 * observed behaviour could not.
 */
export interface ServiceBinding {
  /** Unique within a capability. Appears in logs, plans and the board. */
  readonly id: string;
  readonly capability: CapabilityId;
  readonly kind: ServiceKind;
  /** The vendor, for `model`. `null` for everything local. */
  readonly provider: AIProviderName | null;
  /**
   * The model class this binding asks for, resolved to an id at plan time.
   * `null` for non-model services.
   */
  readonly modelClass: ModelClassName | null;
  readonly licence: LicenceClass;
  readonly jurisdiction: Jurisdiction;
  /** Declared preference order within the capability. Lower is preferred. */
  readonly order: number;
  /** One line: what this binding actually is. */
  readonly detail: string;
  /**
   * Estimated cost of one call, in euro cents, for services whose price is not
   * derived from a model's token rates. Zero for everything local.
   */
  readonly fixedCents: number;
  /** Credential variable names this binding needs. Empty for local services. */
  readonly requiredCredentials: readonly string[];
  /**
   * Whether `fixedCents` is a real, sourced number or a rough placeholder.
   *
   * `'observed'` — fetched from a live pricing page or a vendor's published
   * rate. `'estimated'` — a number this repository is not confident in yet.
   * Every non-free binding declares one of these explicitly; the planner
   * treats `'estimated'` as a hard filter under a hard budget unless the
   * policy opts in, so a placeholder number can never silently spend real
   * money (mirrors `ModelRecord.priceConfidence` below).
   */
  readonly priceConfidence: 'observed' | 'estimated';
}

/* ------------------------------------------------------------------ */
/* Models                                                              */
/* ------------------------------------------------------------------ */

/**
 * Model *classes*, not ids. Ids churn monthly; the class is the job.
 *
 * The distinction matters most at `enum`: picking one value from a closed list
 * is the cheapest work in the pipeline and the easiest place to spend twenty
 * times what it is worth, so it has its own class and the planner never
 * promotes it to a frontier model.
 */
export const MODEL_CLASSES = [
  /** Deepest reasoning, conceptual leaps, N diverse candidates. */
  'frontier',
  /** Prose and analysis a customer will read. */
  'workhorse',
  /** Enum selection and one-sentence rationales. */
  'enum',
  /** Screenshot and photograph understanding. */
  'vision',
  /** Text to vector. */
  'embedding',
] as const;

export type ModelClassName = (typeof MODEL_CLASSES)[number];

export function isModelClassName(value: string): value is ModelClassName {
  return (MODEL_CLASSES as readonly string[]).includes(value);
}

export type Modality =
  | 'text-in'
  | 'text-out'
  | 'vision-in'
  | 'image-out'
  | 'audio-in'
  | 'audio-out'
  | 'embedding-out';

/** A vendor's free allowance, which is a *rate* limit and therefore routing input. */
export interface FreeAllowance {
  readonly requestsPerDay: number;
  readonly requestsPerMinute: number;
}

/**
 * One concrete model this build knows how to ask for.
 *
 * ## On the prices
 *
 * `centsPerMillionInput` and `centsPerMillionOutput` are **routing estimates in
 * euro cents**, not quoted rates. They exist so the planner can order
 * candidates by what they would plausibly cost, and they are deliberately
 * coarse. Nothing bills from them; the cost ledger records what actually
 * happened, from provenance. A caller with better numbers passes
 * `priceOverrides` to the planner.
 */
export interface ModelRecord {
  readonly id: string;
  readonly provider: AIProviderName;
  readonly modelClass: ModelClassName;
  readonly modalities: readonly Modality[];
  /** Whether the vendor enforces a response schema, or has to be asked nicely. */
  readonly structuredOutput: 'native' | 'instructed';
  readonly contextTokens: number;
  readonly centsPerMillionInput: number;
  readonly centsPerMillionOutput: number;
  /** The free allowance, when the vendor offers one this build relies on. */
  readonly freeAllowance: FreeAllowance | null;
  readonly licence: LicenceClass;
  readonly jurisdiction: Jurisdiction;
  /**
   * Whether the price above is sourced from a live, fetched rate
   * (`'observed'`) or a rough, explicitly-unverified placeholder
   * (`'estimated'`, e.g. a vendor that has not published per-model pricing).
   * The planner drops an `'estimated'` model under a hard budget unless the
   * policy explicitly allows unverified pricing — see `plan.ts`.
   */
  readonly priceConfidence: 'observed' | 'estimated';
}

/* ------------------------------------------------------------------ */
/* Telemetry bridge                                                    */
/* ------------------------------------------------------------------ */

/**
 * Maps a service onto the platform's three-kind telemetry namespace.
 *
 * `tool` and `deterministic` have no platform kind of their own, so they are
 * recorded as skills with their kind kept in the id — a board row that reads
 * `skill:tool:lighthouse` is unambiguous, and no existing consumer of
 * `CapabilityKind` has to change to accommodate a fourth value.
 */
export function serviceRef(binding: ServiceBinding): CapabilityRef {
  const kind: CapabilityKind =
    binding.kind === 'model' ? 'provider' : binding.kind === 'mcp' ? 'mcp' : 'skill';
  const id =
    binding.kind === 'model' ? (binding.provider ?? binding.id) : `${binding.kind}:${binding.id}`;
  return { kind, id };
}
