/**
 * The capability registry.
 *
 * One table, one row per capability, answering the four questions the planner
 * needs before it looks at a single vendor: how much does the product depend on
 * this, what happens when it fails, may a model author its output, and is there
 * a policy gate.
 *
 * ## Why this is a TypeScript table and not JSON
 *
 * Freeze F-16 rejected `agent-registry.json`, and the same reasoning applies
 * here. A JSON registry is stale the day it is written, cannot be typechecked,
 * and duplicates knowledge that already lives in code. A `const` table with a
 * closed key type is checked by the compiler on every build: a capability
 * cannot be added to the vocabulary without a row here, and a row cannot name a
 * capability that does not exist.
 *
 * ## The rejected rows earn their place
 *
 * `three_d_generation` and `motion_media` are in the table with tier
 * `rejected` / `specialist`, not absent from it. An audit that asks "why does
 * BusinessForge not do 3D" gets an answer with a reason attached, and the
 * planner refuses the capability by policy rather than by the accident of
 * nobody having wired it up.
 */

import { CAPABILITY_IDS } from './types.js';

import type { CapabilityDescriptor, CapabilityId } from './types.js';

const SOURCE = 'capability.registry';

/**
 * The registry. Every id in `CAPABILITY_IDS` has exactly one row, enforced by
 * the `Record` type and asserted by `test/capability/registry.test.ts`.
 */
export const CAPABILITY_REGISTRY: Readonly<Record<CapabilityId, CapabilityDescriptor>> = {
  /* ---------------- Language ---------------- */

  reasoning: {
    id: 'reasoning',
    tier: 'core',
    summary: 'Reason over messy evidence and cite it.',
    terminal: 'composeBaseline — the deterministic composition, from evidence alone',
    modelMayWriteOutput: true,
    gate: 'none',
    rationale:
      'The analyst stage. Its output is a strategy object the renderer consumes, never bytes a visitor reads.',
  },

  structured_generation: {
    id: 'structured_generation',
    tier: 'core',
    summary: 'Return an object that validates against a closed schema.',
    terminal: 'reject the directive and keep the deterministic floor (ADR 0004)',
    modelMayWriteOutput: true,
    gate: 'none',
    rationale:
      'Every model call in the repository is a structured one; a response that fails its schema is discarded rather than repaired.',
  },

  prose_writing: {
    id: 'prose_writing',
    tier: 'core',
    summary: 'Write the words a customer will read, in the language of the evidence.',
    terminal: 'composeBaseline — evidence-derived copy with no invented facts',
    modelMayWriteOutput: true,
    gate: 'none',
    rationale:
      'The one stage whose output a visitor reads verbatim, which is why its grounding rules are the strictest in the repository.',
  },

  creative_direction: {
    id: 'creative_direction',
    tier: 'core',
    summary: 'Make the conceptual leap: what should this business feel like.',
    terminal: 'deriveCharacter plus worlds.ts — a directive computed from the profile',
    modelMayWriteOutput: false,
    gate: 'none',
    rationale:
      'The director returns a directive in a closed enum vocabulary; the renderer executes it. No byte the model produced reaches the page (F-08).',
  },

  enum_direction: {
    id: 'enum_direction',
    tier: 'conditional',
    summary: 'Pick one value from a closed list and say why in a sentence.',
    terminal: 'the enum default the deterministic layer already computes',
    modelMayWriteOutput: false,
    gate: 'none',
    rationale:
      'The cheapest work in the pipeline. Routed to the enum model class and never promoted, because selecting from eleven values does not need a frontier model.',
  },

  adversarial_critique: {
    id: 'adversarial_critique',
    tier: 'conditional',
    summary: 'State the strongest objection to a candidate, once.',
    terminal: 'skip the round — the candidate stands on the jury verdict alone',
    modelMayWriteOutput: false,
    gate: 'none',
    rationale:
      'Must resolve to a different vendor than creative_direction: self-enhancement bias is documented and systematic, and cross-vendor is the cheapest structural defence.',
  },

  /* ---------------- Evidence ---------------- */

  evidence_collection: {
    id: 'evidence_collection',
    tier: 'core',
    summary: "Crawl the business's own sources and keep every fact attributed.",
    terminal: null,
    modelMayWriteOutput: false,
    gate: 'no-model',
    rationale:
      'A model that "collects" evidence invents it. This is Playwright reading real pages, and when it fails the profile is honestly thinner or the run stops.',
  },

  evidence_research: {
    id: 'evidence_research',
    tier: 'core',
    summary: 'Find the sources worth collecting from.',
    terminal: 'the Maps listing alone — a thinner but honest profile',
    modelMayWriteOutput: false,
    gate: 'none',
    rationale:
      'Discovery of URLs, not assertion of facts. The facts still have to be read off a page by the collector.',
  },

  market_research: {
    id: 'market_research',
    tier: 'conditional',
    summary: 'Understand the competitive and local context around the business.',
    terminal: 'skip — the site is built from the business alone',
    modelMayWriteOutput: false,
    gate: 'none',
    rationale:
      'Improves positioning when it is available and costs nothing to omit, which is exactly the profile of a conditional capability.',
  },

  evidence_extraction: {
    id: 'evidence_extraction',
    tier: 'conditional',
    summary: 'Read text out of a menu photograph, a price list, a scanned document.',
    terminal: 'skip — the document contributes nothing rather than something invented',
    modelMayWriteOutput: false,
    gate: 'none',
    rationale:
      'OCR output is evidence and is treated as such: attributed to the image it came from, never paraphrased into a claim.',
  },

  pii_detection: {
    id: 'pii_detection',
    tier: 'core',
    summary: 'Find personal data in collected evidence before a model ever sees it.',
    terminal: null,
    modelMayWriteOutput: false,
    gate: 'no-model',
    rationale:
      'Sending evidence to a model to ask whether it contains personal data is the exact disclosure the screen exists to prevent. Deterministic, in-repo, pre-model.',
  },

  /* ---------------- Vision and media ---------------- */

  vision_description: {
    id: 'vision_description',
    tier: 'core',
    summary: "Describe what is actually in the business's own photographs.",
    terminal: 'subjectOf — the deterministic subject read off the filename and context',
    modelMayWriteOutput: false,
    gate: 'none',
    rationale:
      'Drives alt text and photograph selection. The terminal is coarse but never wrong, which is the right failure mode for an accessibility surface.',
  },

  craft_judging: {
    id: 'craft_judging',
    tier: 'core',
    summary: 'Judge whether a rendered page reads as art-directed or as generated.',
    terminal: "the verdict 'uncertain', which blocks delivery and never passes it (F-07)",
    modelMayWriteOutput: false,
    gate: 'none',
    rationale:
      'A gating judgement. Its terminal must be a block, because a gate that passes when it cannot see is not a gate.',
  },

  distinctness_judging: {
    id: 'distinctness_judging',
    tier: 'core',
    summary: 'Judge whether this page could be mistaken for the last one we built.',
    terminal: 'the L1 and L2 structural fingerprint, computed in-repo at zero cost',
    modelMayWriteOutput: false,
    gate: 'none',
    rationale:
      'Must resolve to a different vendor than craft_judging. The deterministic fingerprint is a genuinely good terminal here, which is why the model path is an improvement rather than a dependency.',
  },

  visual_defect_detection: {
    id: 'visual_defect_detection',
    tier: 'conditional',
    summary: 'Spot overlap, clipping, invisible text and broken layout in a screenshot.',
    terminal: 'ship with the deterministic layout audit warnings attached',
    modelMayWriteOutput: false,
    gate: 'none',
    rationale:
      'The in-repo layout audit catches the geometric defects; a vision model catches the ones only a reader notices.',
  },

  image_nondepictive: {
    id: 'image_nondepictive',
    tier: 'conditional',
    summary: 'Generate texture, grain and ground that depicts nothing real.',
    terminal: 'the solid and gradient grounds worlds.ts already ships',
    modelMayWriteOutput: true,
    gate: 'none',
    rationale:
      'Non-depictive by rule: a generated image that appears to show the business is a fabricated fact. Texture is not a claim.',
  },

  image_editing: {
    id: 'image_editing',
    tier: 'conditional',
    summary: "Crop, relight or extend the business's own photograph.",
    terminal: 'use the photograph exactly as collected',
    modelMayWriteOutput: true,
    gate: 'human',
    rationale:
      'Freeze O-6: the right to redistribute a business’s own social photographs is unresolved, and editing one compounds the question. Human-gated until it is settled. ' +
      'Researched candidate provider (2026-08-19, C:\\Users\\40728\\bf_research — live curl evidence, not secondhand): Higgsfield, whose docs.higgsfield.ai publishes ' +
      'a real API index and an `/docs/llms.txt` full-doc dump (OBSERVED). OBSERVED pricing: Free / Starter $19mo / Plus $47mo (1,200 credits) / Ultra $99mo (~9,000 ' +
      'credits), annual billing. VERIFIED commercial rights (ToS §4.4): "Company does not claim ownership of any of your Inputs or Outputs, nor does it restrict your ' +
      'commercial use of Outputs," rights survive cancellation, sublicensable to clients. Watermark visibility on exported files remains UNKNOWN (§6.4 permits but ' +
      'does not warrant persistent watermarking). Not bound, not credentialed, not live-tested; binding it is still blocked on the O-6 rights question this row ' +
      'already names, not on price, license or provider availability, which are now resolved.',
  },

  vector_generation: {
    id: 'vector_generation',
    tier: 'conditional',
    summary: 'Produce a mark, icon or ornament as vector geometry.',
    terminal: 'the inline SVG and CSS the renderer already ships',
    modelMayWriteOutput: true,
    gate: 'none',
    rationale:
      'Vector output is inspectable before it ships, which is what makes generated geometry acceptable where generated photography is not.',
  },

  motion_media: {
    id: 'motion_media',
    tier: 'specialist',
    summary: 'Generate an ambient video loop or transform a still into motion (image-to-video).',
    terminal: 'a static photograph',
    modelMayWriteOutput: true,
    gate: 'human',
    rationale:
      'Expensive, slow, and rarely better than a still. Declared so the answer to "can we?" is "yes, with a person approving it", not silence. ' +
      'Researched candidate providers (2026-08-19, C:\\Users\\40728\\bf_research, live curl evidence): Higgsfield (director/camera-controlled image-to-video, OBSERVED API + ' +
      'MCP server + CLI, OBSERVED pricing Free/$19/$47/$99-per-mo, VERIFIED no-commercial-restriction ToS §4.4 — the strongest programmatic-generation signal of the ' +
      'category) as primary; Runway (OBSERVED: Free $0/125 credits, Standard $12mo, Pro $28mo, Unlimited $76mo, commercial use + no watermark on paid) and Google Veo ' +
      '3.1 (OBSERVED: $0.40/clip at 720-1080p, $0.60 at 4K, Fast $0.10-0.12, Lite $0.05-0.08, first 5,000 units free via Vertex trial, commercial rights via Google ' +
      'ToS) as alternates. Watermark policy on Runway\'s free tier and Higgsfield\'s exported files remains UNKNOWN. Caution carried over from the research, not yet ' +
      'encoded as a hard block: Higgsfield is a US company but proxies Chinese-model backends (Kling/Seedance/MiniMax-class) for some camera presets — data-residency ' +
      'and ToS clarity on those specific presets is weaker than Higgsfield\'s own terms and should be checked per-preset before this row is ever bound, not assumed ' +
      'from the vendor-level review above. Not bound, not credentialed, no live call made — this row activating requires, in order: a business whose evidence ' +
      'actually justifies motion media (ExperienceSignature.experienceStrategy.requiresVideo with a real rationale, not a default), the remaining watermark/preset ' +
      'caveats above resolved, and the human gate above. None of that has happened yet, so this remains declared infrastructure, not a working path — the same ' +
      'distinction the freeze draws everywhere else in this table. Explicitly rejected by the research itself: applying video generation to every site by default ' +
      '— it is gated on business evidence (a hero, lookbook, or walkthrough that specifically benefits from motion), never a template add-on.',
  },

  audio_speech: {
    id: 'audio_speech',
    tier: 'rejected',
    summary: 'Speech synthesis or transcription.',
    terminal: 'omit',
    modelMayWriteOutput: false,
    gate: 'never',
    rationale:
      'Freeze F-18. No stage of the website pipeline consumes audio; declaring it keeps the answer recorded instead of rediscovered. ' +
      'Researched candidate provider (2026-08-19, C:\\Users\\40728\\bf_research, live pricing-page evidence): ElevenLabs, for a future voice/narration ' +
      'capability. OBSERVED pricing: $0 free tier, then Commercial License at $6/mo, scaling through $11/$22/$99/$299/$990-per-month tiers by usage volume. ' +
      'Not activated: F-18 is a frozen decision, not an availability or pricing gap, and no business evidence observed by this factory has ever justified voice ' +
      '— reopening this row is a change request against the freeze, not a provider-binding exercise. Recorded here so the next session that considers it starts ' +
      'from "already researched, priced, still rejected on purpose".',
  },

  three_d_generation: {
    id: 'three_d_generation',
    tier: 'rejected',
    summary: 'Generate 3D geometry for the page.',
    terminal: 'the WebGL runtime tier renders procedural geometry the renderer authors',
    modelMayWriteOutput: false,
    gate: 'never',
    rationale:
      'Freeze F-18 and the registry review. Generated meshes are heavy, generic and unverifiable; procedural shader work under runtime_tier delivers the same intent at a fraction of the weight. ' +
      'Researched candidate providers (2026-08-19, C:\\Users\\40728\\bf_research, live pricing-page evidence): Tripo — $0 free tier at 200 credits, non-commercial ' +
      'only, then paid tiers at $19/$54/$89/$1000/mo; and Meshy — $0/$10/$20/$40/$70/$100/$240/mo tiers, OBSERVED "you own the generated assets, commercial use OK ' +
      'on any paid plan". Not activated, same reasoning as audio_speech above — this is a frozen policy decision to leave unreopened without an evidence-backed ' +
      'change request, not a missing integration or a pricing unknown. `ExperienceSignature.experienceStrategy.requires3D` exists precisely so a future change ' +
      'request has a concrete trigger to point at, rather than reopening this row speculatively.',
  },

  /* ---------------- Semantic ---------------- */

  semantic_index: {
    id: 'semantic_index',
    tier: 'core',
    summary: 'Embed and compare designs and evidence semantically.',
    terminal: 'the L1 and L2 structural fingerprints, at zero cost',
    modelMayWriteOutput: false,
    gate: 'none',
    rationale:
      'Runs locally when a local embedding model is available, so customer evidence never leaves the machine to be compared.',
  },

  design_memory: {
    id: 'design_memory',
    tier: 'core',
    summary: 'Remember what we built nearby, recently, in this trade.',
    terminal: "the in-run peers file — this run's own candidates",
    modelMayWriteOutput: false,
    gate: 'none',
    rationale:
      'Deterministic and in-repo. Scoped by industry, distance and age, and never a global structural repulsor (F-11).',
  },

  /* ---------------- Measurement ---------------- */

  qa_measurement: {
    id: 'qa_measurement',
    tier: 'core',
    summary: 'Load the built page in a real browser and measure what it does.',
    terminal: null,
    modelMayWriteOutput: false,
    gate: 'no-model',
    rationale:
      'The one capability that must fail loudly. A measurement that degrades to a guess is worse than no measurement, because the gate above it would pass on it.',
  },

  visual_regression: {
    id: 'visual_regression',
    tier: 'core',
    summary: 'Diff two renderings pixel by pixel.',
    terminal: null,
    modelMayWriteOutput: false,
    gate: 'no-model',
    rationale: 'Deterministic, local and free. There is nothing to route and nothing to spend.',
  },

  accessibility: {
    id: 'accessibility',
    tier: 'core',
    summary: 'Check the delivered page against accessibility rules.',
    terminal: 'the in-repo landmark, alt-text and contrast checks',
    modelMayWriteOutput: false,
    gate: 'no-model',
    rationale:
      'Rules, not opinions. A model asked whether a page is accessible produces plausible prose and no findings.',
  },

  performance: {
    id: 'performance',
    tier: 'core',
    summary: 'Measure weight, requests and rendering cost against budgets that fail.',
    terminal: 'the in-repo byte and request budgets, reported rather than enforced',
    modelMayWriteOutput: false,
    gate: 'no-model',
    rationale: 'Numbers off a real load. Nothing here is a judgement call.',
  },

  output_security: {
    id: 'output_security',
    tier: 'core',
    summary: 'Check what ships to the customer for injected script, leaks and unsafe links.',
    terminal: 'the five shipped in-repo checks',
    modelMayWriteOutput: false,
    gate: 'no-model',
    rationale:
      'A security check whose verdict a model could talk itself out of is not a security check.',
  },

  structured_data_validation: {
    id: 'structured_data_validation',
    tier: 'core',
    summary: 'Validate the JSON-LD the page emits.',
    terminal: 'emit the structured data unvalidated',
    modelMayWriteOutput: false,
    gate: 'no-model',
    rationale: 'Schema validation is deterministic; the only question is whether a validator is present.',
  },

  /* ---------------- Delivery and operations ---------------- */

  runtime_tier: {
    id: 'runtime_tier',
    tier: 'core',
    summary: 'Decide how much client-side runtime the page earns: none, CSS, JS, or WebGL.',
    terminal: "runtime 'none' — a static page that works everywhere",
    modelMayWriteOutput: false,
    gate: 'none',
    rationale:
      'Decided from evidence by experience.ts, executed by the renderer. The ladder only climbs when the business gives it a reason to.',
  },

  build_artifact: {
    id: 'build_artifact',
    tier: 'core',
    summary: 'Produce the deliverable site directory.',
    terminal: 'the site directory on disk',
    modelMayWriteOutput: false,
    gate: 'no-model',
    rationale: 'The renderer owns every byte. This capability exists so the board can say so.',
  },

  hosting: {
    id: 'hosting',
    tier: 'core',
    summary: 'Put the built site somewhere a visitor can reach it.',
    terminal: 'the site directory on disk, served locally',
    modelMayWriteOutput: false,
    gate: 'human',
    rationale:
      'Publishing is outward-facing and irreversible in the way that matters to a customer, so it does not happen without a person.',
  },

  discoverability: {
    id: 'discoverability',
    tier: 'core',
    summary: 'Metadata, structured data and localisation that let the page be found.',
    terminal: 'the in-repo JSON-LD and lexicon the renderer already emits',
    modelMayWriteOutput: false,
    gate: 'none',
    rationale: 'Deterministic and already shipping; a model can only make it worse or more generic.',
  },

  observability: {
    id: 'observability',
    tier: 'core',
    summary: 'Record what the run did, in a form that can be read back.',
    terminal: 'the NDJSON run log on disk',
    modelMayWriteOutput: false,
    gate: 'no-model',
    rationale: 'Already implemented, already free, already sufficient.',
  },

  cost_ledger: {
    id: 'cost_ledger',
    tier: 'core',
    summary: 'Account for what the run actually spent, from provenance.',
    terminal: null,
    modelMayWriteOutput: false,
    gate: 'no-model',
    rationale:
      'Fails loudly by design: a run that cannot account for its spend must not be allowed to keep spending.',
  },

  rate_governor: {
    id: 'rate_governor',
    tier: 'core',
    summary: 'Keep concurrent calls inside a vendor’s published rate limits.',
    terminal: null,
    modelMayWriteOutput: false,
    gate: 'no-model',
    rationale:
      'An ungoverned vendor is the one that produces a surprise 429 halfway through a paid batch.',
  },

  human_approval: {
    id: 'human_approval',
    tier: 'core',
    summary: 'Ask a person, and wait.',
    terminal: null,
    modelMayWriteOutput: false,
    gate: 'human',
    rationale:
      'The escape hatch every gated capability routes to. It has no automated terminal on purpose.',
  },
};

/** Every descriptor, in declaration order. */
export const CAPABILITY_DESCRIPTORS: readonly CapabilityDescriptor[] = CAPABILITY_IDS.map(
  (id) => CAPABILITY_REGISTRY[id],
);

/** The descriptor for a capability. Total, because the key type is closed. */
export function describeCapability(id: CapabilityId): CapabilityDescriptor {
  return CAPABILITY_REGISTRY[id];
}

/** Capabilities at a given tier, for the board and for reporting. */
export function capabilitiesAtTier(
  tier: CapabilityDescriptor['tier'],
): readonly CapabilityDescriptor[] {
  return CAPABILITY_DESCRIPTORS.filter((entry) => entry.tier === tier);
}

/**
 * Whether an autonomous run may plan this capability at all.
 *
 * `rejected` and `human`-gated capabilities are refused here rather than
 * ranked-to-nothing later, so the exclusion reads as a decision in the plan
 * instead of as an empty chain.
 */
export function autonomouslyPlannable(descriptor: CapabilityDescriptor): boolean {
  return descriptor.tier !== 'rejected' && descriptor.gate !== 'never' && descriptor.gate !== 'human';
}

export const SOURCE_NAME = SOURCE;
