/**
 * The agent roster.
 *
 * An agent is a *seat*: a named responsibility, the capability it consumes, how
 * many of it run at once, and what it is forbidden from touching. It is not a
 * prompt and not a class — `agents/` already holds the implementations, and the
 * ones that do not exist yet are listed here as `planned` rather than invented.
 *
 * ## Why this is TypeScript and not `agent-registry.json`
 *
 * Freeze F-16, and the registry review's largest single objection. A JSON
 * roster is a second source of truth that drifts from the code within a week,
 * cannot be typechecked against the capability vocabulary, and tempts a
 * runtime to instantiate an agent from a string. This table is checked by the
 * compiler: a seat cannot name a capability that does not exist, and
 * `test/capability/agents.test.ts` asserts every `implemented` seat points at a
 * file that is really there.
 *
 * ## The column that matters is `k`
 *
 * Running several agents is expensive and usually pointless. The rule, stated
 * once so every seat can be read against it:
 *
 *   **Run one agent when the decision is reversible or the deterministic floor
 *   already holds a strong prior. Run several only when the decision is
 *   comparative (a battle), gating (a jury), or corroborative (a contested
 *   fact). Never run several to feel thorough.**
 *
 * Every `k > 1` below cites which of the three it is.
 */

import type { CapabilityId } from './types.js';

const SOURCE = 'capability.agents';

/** Which pool a seat draws from. Pools bound concurrency; the router bounds substitution. */
export const AGENT_POOLS = [
  'research',
  'intelligence',
  'creative',
  'cabinet',
  'content',
  'implementation',
  'evaluation',
  'assurance',
  'delivery',
] as const;

export type AgentPool = (typeof AGENT_POOLS)[number];

/** Whether the seat exists in this build. */
export type AgentStatus =
  /** A module in `agents/` or `lib/` implements it today. */
  | 'implemented'
  /** The seat is real work the architecture calls for, not yet built. */
  | 'planned'
  /** The deterministic layer already performs this seat's job. */
  | 'deterministic';

export interface AgentSeat {
  readonly id: string;
  readonly name: string;
  readonly pool: AgentPool;
  readonly status: AgentStatus;
  /** The capability this seat consumes. One seat, one capability. */
  readonly capability: CapabilityId;
  /** Where the implementation lives, when there is one. */
  readonly module: string | null;
  /** How many run per invocation, and why when it is more than one. */
  readonly k: number;
  readonly kRationale: string;
  /**
   * A seat whose vendor must differ from another seat's. The judge pair and the
   * director/critic pair are the two that matter, and both exist because
   * self-enhancement bias is documented and systematic.
   */
  readonly crossVendorWith: string | null;
  /** What this seat is not allowed to produce. The sentence that keeps F-08 real. */
  readonly mayNotProduce: string;
}

/**
 * The roster.
 *
 * Ordered by where the seat sits in the pipeline, so reading top to bottom is
 * reading the pipeline.
 */
export const AGENT_SEATS: readonly AgentSeat[] = [
  {
    id: 'discovery',
    name: 'Discovery',
    pool: 'research',
    status: 'implemented',
    capability: 'evidence_research',
    module: 'agents/discoveryAgent.ts',
    k: 1,
    kRationale: 'Resolving one listing to one identity is not a comparative decision.',
    crossVendorWith: null,
    mayNotProduce: 'any fact not read off a real page',
  },
  {
    id: 'collector',
    name: 'Evidence Collector',
    pool: 'research',
    status: 'implemented',
    capability: 'evidence_collection',
    module: 'agents/collectorAgent.ts',
    k: 1,
    kRationale: 'One crawl per source; parallelism here is over sources, not over agents.',
    crossVendorWith: null,
    mayNotProduce: 'a summary — it collects verbatim strings with their URLs',
  },
  {
    id: 'researcher',
    name: 'Market Researcher',
    pool: 'research',
    status: 'planned',
    capability: 'market_research',
    module: null,
    k: 2,
    kRationale:
      'Corroborative: a contested fact about a local market is worth two independent sources before it shapes positioning.',
    crossVendorWith: null,
    mayNotProduce: 'a claim about the business itself — that is the collector’s evidence, not research',
  },
  {
    id: 'normalizer',
    name: 'Normalizer',
    pool: 'intelligence',
    status: 'implemented',
    capability: 'pii_detection',
    module: 'agents/normalizerAgent.ts',
    k: 1,
    kRationale: 'Deterministic reconciliation. No model, no variance, nothing to compare.',
    crossVendorWith: null,
    mayNotProduce: 'a value it had to guess — an underivable field stays null',
  },
  {
    id: 'business-analyst',
    name: 'Business Intelligence Analyst',
    pool: 'intelligence',
    status: 'implemented',
    capability: 'reasoning',
    module: 'agents/businessAnalystAgent.ts',
    k: 1,
    kRationale: 'Strategy is revisable downstream and the floor holds a strong prior.',
    crossVendorWith: null,
    mayNotProduce: 'prose the visitor reads — it recommends, the writer writes',
  },
  {
    id: 'brand-analyst',
    name: 'Brand & Positioning Analyst',
    pool: 'intelligence',
    status: 'deterministic',
    capability: 'reasoning',
    module: 'lib/design/character.ts',
    k: 1,
    kRationale: 'deriveCharacter reads positioning off the evidence without a model call.',
    crossVendorWith: null,
    mayNotProduce: 'a positioning claim the evidence does not support',
  },
  {
    id: 'experience-architect',
    name: 'Experience Architect',
    pool: 'creative',
    status: 'deterministic',
    capability: 'runtime_tier',
    module: 'lib/design/experience.ts',
    k: 1,
    kRationale: 'The ladder is evidence-gated and deterministic; a model would only add variance.',
    crossVendorWith: null,
    mayNotProduce: 'a runtime tier the evidence has not earned',
  },
  {
    id: 'design-director',
    name: 'Design Director',
    pool: 'creative',
    status: 'implemented',
    capability: 'creative_direction',
    module: 'agents/designDirectorAgent.ts',
    k: 1,
    kRationale:
      'One directive per candidate. Parallelism lives in the candidate count, not in duplicate directors on one candidate.',
    // Today's single-candidate path has no adversarial round; that pairing
    // belongs to the planned creative-director seat's Design Battle.
    crossVendorWith: null,
    mayNotProduce: 'markup, CSS, or copy — only a directive in the closed enum vocabulary',
  },
  {
    id: 'creative-director',
    name: 'Creative Director',
    pool: 'creative',
    status: 'planned',
    capability: 'creative_direction',
    module: null,
    k: 3,
    kRationale:
      'Comparative: three divergent territories are the design battle, and the battle is the product.',
    crossVendorWith: 'adversarial-critic',
    mayNotProduce: 'a territory that contradicts the factual dossier',
  },
  {
    id: 'art-director',
    name: 'Art Director (cabinet seat)',
    pool: 'cabinet',
    status: 'deterministic',
    capability: 'enum_direction',
    module: 'lib/design/compose.ts',
    k: 1,
    kRationale: 'One seat, one enum. Never parallel on the same seat.',
    crossVendorWith: null,
    mayNotProduce: 'anything outside its enum',
  },
  {
    id: 'motion-director',
    name: 'Motion Director (cabinet seat)',
    pool: 'cabinet',
    status: 'deterministic',
    capability: 'enum_direction',
    module: 'lib/design/interaction.ts',
    k: 1,
    kRationale: 'One seat, one enum.',
    crossVendorWith: null,
    mayNotProduce: 'motion that ignores the reduced-motion preference',
  },
  {
    id: 'asset-director',
    name: 'Visual / Asset Director (cabinet seat)',
    pool: 'cabinet',
    status: 'deterministic',
    capability: 'vision_description',
    module: 'lib/design/assets.ts',
    k: 1,
    kRationale: 'One seat, one enum.',
    crossVendorWith: null,
    mayNotProduce: 'a generated image that appears to depict the real business',
  },
  {
    id: 'copywriter',
    name: 'Copywriter',
    pool: 'content',
    status: 'implemented',
    capability: 'prose_writing',
    module: 'agents/writerAgent.ts',
    k: 1,
    kRationale:
      'The strictest grounding rules in the repository; running two would produce two ungrounded drafts to choose between.',
    crossVendorWith: null,
    mayNotProduce: 'a sentence asserting a fact no source attributed',
  },
  {
    id: 'implementer',
    name: 'Implementation',
    pool: 'implementation',
    status: 'deterministic',
    capability: 'build_artifact',
    module: 'lib/render/index.ts',
    k: 1,
    kRationale: 'The renderer authors every delivered byte. There is nothing to route (F-08).',
    crossVendorWith: null,
    mayNotProduce: 'markup a model wrote',
  },
  {
    id: 'craft-judge',
    name: 'Craft Judge',
    pool: 'evaluation',
    status: 'implemented',
    capability: 'craft_judging',
    module: 'lib/qa/jury.ts',
    k: 2,
    kRationale:
      'Gating: position and self-enhancement bias are systematic, so a verdict that blocks delivery is taken from two vendors in both orderings.',
    crossVendorWith: 'distinctness-judge',
    mayNotProduce: 'a pass when it could not see the page — that is `uncertain` (F-07)',
  },
  {
    id: 'distinctness-judge',
    name: 'Distinctness Judge',
    pool: 'evaluation',
    status: 'implemented',
    capability: 'distinctness_judging',
    module: 'lib/qa/distinctness-gate.ts',
    k: 1,
    kRationale:
      'The structural fingerprint is a strong free prior; the model is an improvement on it, not a dependency.',
    crossVendorWith: 'craft-judge',
    mayNotProduce: 'a verdict that ignores the L1 fingerprint',
  },
  {
    id: 'adversarial-critic',
    name: 'Adversarial Critic',
    pool: 'evaluation',
    status: 'planned',
    capability: 'adversarial_critique',
    module: null,
    k: 1,
    kRationale:
      'One objection, the strongest. An unbounded critic produces a wish list, and a wish list is not actionable.',
    // The adversarial round is part of the Design Battle (k=3 territories),
    // not the current single-candidate design-director path — so its partner
    // is the planned creative-director seat, not design-director.
    crossVendorWith: 'creative-director',
    mayNotProduce: 'a fix — it objects, the director revises',
  },
  {
    id: 'visual-critic',
    name: 'Visual Defect Critic',
    pool: 'assurance',
    status: 'implemented',
    capability: 'visual_defect_detection',
    module: 'lib/qa/visual-critic.ts',
    k: 1,
    kRationale: 'Advisory, not gating.',
    crossVendorWith: null,
    mayNotProduce: 'an edit to the page',
  },
  {
    id: 'accessibility-qa',
    name: 'Accessibility QA',
    pool: 'assurance',
    status: 'implemented',
    capability: 'accessibility',
    module: 'lib/qa/gates/accessibility.ts',
    k: 1,
    kRationale: 'Rules, run once, in parallel with the other three assurance seats.',
    crossVendorWith: null,
    mayNotProduce: 'an opinion — only findings with locations',
  },
  {
    id: 'performance-qa',
    name: 'Performance QA',
    pool: 'assurance',
    status: 'implemented',
    capability: 'performance',
    module: 'lib/qa/gates/performance.ts',
    k: 1,
    kRationale: 'Deterministic measurement; parallel with the other assurance seats because they are independent.',
    crossVendorWith: null,
    mayNotProduce: 'a budget it invented at run time',
  },
  {
    id: 'security-qa',
    name: 'Output Security QA',
    pool: 'assurance',
    status: 'implemented',
    capability: 'output_security',
    module: 'lib/qa/gates/technical.ts',
    k: 1,
    kRationale: 'Deterministic checks; parallel with the other assurance seats.',
    crossVendorWith: null,
    mayNotProduce: 'a waiver — a failing check fails',
  },
  {
    id: 'deployment',
    name: 'Deployment',
    pool: 'delivery',
    status: 'planned',
    capability: 'hosting',
    module: null,
    k: 1,
    kRationale: 'One publish, human-gated.',
    crossVendorWith: null,
    mayNotProduce: 'a publish without a person approving it',
  },
];

/** A seat by id, or `null`. */
export function seat(id: string): AgentSeat | null {
  return AGENT_SEATS.find((entry) => entry.id === id) ?? null;
}

/** Seats drawing on one pool. */
export function seatsInPool(pool: AgentPool): readonly AgentSeat[] {
  return AGENT_SEATS.filter((entry) => entry.pool === pool);
}

/** Seats that consume a capability. */
export function seatsForCapability(capability: CapabilityId): readonly AgentSeat[] {
  return AGENT_SEATS.filter((entry) => entry.capability === capability);
}

/**
 * The vendors a seat may not use, derived from its cross-vendor partner's
 * already-chosen vendor.
 *
 * The constraint is expressed as data here and enforced by the planner's
 * `excludeProviders`, so there is exactly one mechanism and it is the same one
 * an operator would use manually.
 */
export function crossVendorExclusions(
  seatId: string,
  chosen: Readonly<Record<string, string>>,
): readonly string[] {
  const entry = seat(seatId);
  if (entry === null || entry.crossVendorWith === null) return [];
  const partnerVendor = chosen[entry.crossVendorWith];
  return partnerVendor === undefined ? [] : [partnerVendor];
}

export const SOURCE_NAME = SOURCE;
