/**
 * What can serve what.
 *
 * The registry says a capability exists and what happens when it fails. This
 * says who could do it: a model class on a vendor, a skill the platform
 * manager owns, an MCP tool, an in-repo tool with a real dependency, or the
 * deterministic floor.
 *
 * ## The rule that keeps this table honest
 *
 * **Every capability whose descriptor declares a terminal ends its list with a
 * `deterministic` binding.** Not as documentation — as the last row of the
 * chain, so the planner's output is a chain that cannot be empty and the
 * executor always has somewhere to go. `test/capability/bindings.test.ts`
 * asserts it, because a terminal that exists only in prose is a terminal that
 * will be missing the day it matters.
 *
 * ## Declared, not connected
 *
 * A binding for a skill that is a placeholder today (all thirty-eight built-in
 * skills currently are) still belongs here. The planner will exclude it with
 * `not-implemented` and the board will show the gap, which is strictly better
 * than the capability appearing to have one fewer option than it eventually
 * will. Implementing the skill then changes nothing in this file.
 *
 * ## Cross-vendor pairs
 *
 * `craft_judging` and `distinctness_judging` declare the same vendors in
 * *opposite* order, and `creative_direction` and `adversarial_critique` do the
 * same. That is not decoration: combined with the planner's `excludeProviders`,
 * it means the natural first choice for each half of a pair is already a
 * different vendor, so the cross-vendor constraint usually costs nothing.
 */

import { CAPABILITY_IDS } from './types.js';

import type { CapabilityId, ServiceBinding } from './types.js';

const SOURCE = 'capability.bindings';

/** Shorthand for the common case: a model class on a vendor. */
function model(
  capability: CapabilityId,
  provider: ServiceBinding['provider'],
  modelClass: NonNullable<ServiceBinding['modelClass']>,
  order: number,
  detail: string,
  credential: string,
): ServiceBinding {
  return {
    id: `${provider}.${modelClass}`,
    capability,
    kind: 'model',
    provider,
    modelClass,
    licence:
      provider === 'ollama'
        ? 'permissive-local'
        : provider === 'gemini' || provider === 'groq'
          ? 'free-tier-unverified'
          : 'commercial-api',
    jurisdiction: provider === 'ollama' ? 'local' : provider === 'openrouter' ? 'other' : 'us',
    order,
    detail,
    fixedCents: 0,
    requiredCredentials: [credential],
    priceConfidence: 'observed',
  };
}

const GEMINI_KEY = 'GEMINI_API_KEY';
const OPENAI_KEY = 'OPENAI_API_KEY';
const ANTHROPIC_KEY = 'ANTHROPIC_API_KEY';
const OPENROUTER_KEY = 'OPENROUTER_API_KEY';
const DEEPSEEK_KEY = 'DEEPSEEK_API_KEY';
const CEREBRAS_KEY = 'CEREBRAS_API_KEY';
const GROQ_KEY = 'GROQ_API_KEY';
const XAI_KEY = 'XAI_API_KEY';
const OLLAMA_KEY = 'OLLAMA_ENABLED';

/** Shorthand for in-repo code with a real dependency. */
function tool(
  capability: CapabilityId,
  id: string,
  order: number,
  detail: string,
  licence: ServiceBinding['licence'] = 'permissive-local',
): ServiceBinding {
  return {
    id,
    capability,
    kind: 'tool',
    provider: null,
    modelClass: null,
    licence,
    jurisdiction: 'local',
    order,
    detail,
    fixedCents: 0,
    requiredCredentials: [],
    priceConfidence: 'observed',
  };
}

/** Shorthand for a capability the platform's skill manager owns. */
function skill(
  capability: CapabilityId,
  id: string,
  order: number,
  detail: string,
  requiredCredentials: readonly string[] = [],
): ServiceBinding {
  return {
    id,
    capability,
    kind: 'skill',
    provider: null,
    modelClass: null,
    licence: 'permissive-local',
    jurisdiction: 'local',
    order,
    detail,
    fixedCents: 0,
    requiredCredentials,
    priceConfidence: 'observed',
  };
}

/** Shorthand for the terminal: in-repo, free, always available. */
function floor(capability: CapabilityId, id: string, order: number, detail: string): ServiceBinding {
  return {
    id,
    capability,
    kind: 'deterministic',
    provider: null,
    modelClass: null,
    licence: 'permissive-local',
    jurisdiction: 'local',
    order,
    detail,
    fixedCents: 0,
    requiredCredentials: [],
    priceConfidence: 'observed',
  };
}

/**
 * The bindings, by capability.
 *
 * Order within a list is the repository's *declared preference*, which the
 * planner uses only to break a tie that cost and observed behaviour left equal.
 */
export const SERVICE_BINDINGS: Readonly<Record<CapabilityId, readonly ServiceBinding[]>> = {
  /* ---------------- Language ---------------- */

  reasoning: [
    model('reasoning', 'gemini', 'frontier', 0, 'Gemini frontier — free allowance first', GEMINI_KEY),
    // T05: a second genuinely-free worker, not a paid fallback — console.groq.com/docs/rate-limits
    // (OBSERVED live, 2026-08-24) confirms a real no-cost allowance for GPT-OSS models. Ranked
    // right after Gemini specifically to address the Provider Pool review's "Gemini is the only
    // vendor confirmed live" single-point-of-failure flag: a quota-exhausted or unreachable
    // Gemini now fails over to another free seat before any paid vendor is ever asked.
    model('reasoning', 'groq', 'workhorse', 1, 'Groq gpt-oss-120b — free tier, fast inference', GROQ_KEY),
    model('reasoning', 'openai', 'frontier', 2, 'GPT frontier', OPENAI_KEY),
    model('reasoning', 'openrouter', 'workhorse', 3, 'OpenRouter workhorse', OPENROUTER_KEY),
    // Cheapest paid reasoning seat in the catalogue (bf_research, OBSERVED $0.22/$0.66 per
    // million) — ranks below the free/already-cheap options above on cost alone, never on a
    // hardcoded preference.
    model('reasoning', 'deepseek', 'workhorse', 4, 'DeepSeek workhorse — cheapest paid seat', DEEPSEEK_KEY),
    // Last-resort reachable provider: Cerebras (gpt-oss-120b) is the only
    // vendor verified reachable from this environment when the higher-rank
    // seats are quota-blocked or network-unreachable. Placed immediately before
    // the deterministic floor so it is used only when every preferred seat fails.
    model('reasoning', 'cerebras', 'workhorse', 5, 'Cerebras workhorse — reachable fallback', CEREBRAS_KEY),
    // Local, free ($0, `priceConfidence: 'observed'` — models.ts), credential-
    // free (opt-in via OLLAMA_ENABLED). This planner ranks free before paid
    // on cost alone (see this file's own header doctrine), so a genuinely-
    // $0 local call sorts WITH the free tier, ahead of every paid vendor,
    // despite being the slowest member of that group (~40s/call,
    // lib/ai/providers/ollama.ts) — this router optimizes spend, not
    // latency; `order: 6` only breaks the tie against gemini/groq, placing
    // it third within the free group, never ahead of them.
    model('reasoning', 'ollama', 'workhorse', 6, 'Local Ollama — $0, free tier by cost, slow by latency', OLLAMA_KEY),
    floor('reasoning', 'compose-baseline', 7, 'composeBaseline — strategy derived from the profile'),
  ],

  structured_generation: [
    model('structured_generation', 'gemini', 'workhorse', 0, 'Native schema enforcement', GEMINI_KEY),
    model('structured_generation', 'openai', 'workhorse', 1, 'Native schema enforcement', OPENAI_KEY),
    // T05: console.groq.com/docs/structured-outputs (OBSERVED live, 2026-08-24) confirms strict
    // json_schema support specifically for openai/gpt-oss-120b — genuinely native, not
    // schema-in-prompt, and free — so it ranks with the native-schema group above, ahead of the
    // instructed-mode vendors below.
    model('structured_generation', 'groq', 'workhorse', 2, 'Native schema enforcement (strict json_schema) — free tier', GROQ_KEY),
    // WQ-005 (gap G-XAI-01): xai carries the same native `json_schema, strict: true`
    // enforcement as the three seats above it (lib/ai/providers/xai.ts reuses OpenAI's
    // toStrictSchema for exactly that documented reason), so it belongs in the native-schema
    // group, not the instructed-mode one below — this is the concrete capability the adapter's
    // cost was paid for but never used (the gap that got it built and then left unbound).
    // Ranked after the free-tier native seats: grok-4.6 has no free allowance at all
    // (centsPerMillionInput/Output 200/600, lib/capability/models.ts, OBSERVED
    // bf_research/05_provider_matrix.md 2026-08-19). Ranked ahead of Anthropic specifically —
    // not a hardcoded preference but the same OBSERVED numbers: Anthropic's workhorse seat is
    // 276/1380 (both axes pricier than xai's 200/600) and only 'instructed', not native, schema
    // enforcement. Text-only (no vision modelClass exists for xai), so this is its one real fit.
    model('structured_generation', 'xai', 'workhorse', 3, 'Native schema enforcement — no free tier, cheaper than Anthropic on both axes', XAI_KEY),
    model('structured_generation', 'anthropic', 'workhorse', 4, 'Schema supplied in-prompt, validated locally', ANTHROPIC_KEY),
    model('structured_generation', 'openrouter', 'workhorse', 5, 'Schema supplied in-prompt', OPENROUTER_KEY),
    model('structured_generation', 'deepseek', 'workhorse', 6, 'Schema supplied in-prompt, validated locally — cheapest paid seat', DEEPSEEK_KEY),
    // Speed-focused, not cost- or quality-focused: Cerebras's own catalog leaves per-model
    // pricing and structured-output support unpublished (bf_research flags it "not
    // deep-dived"). Placed last among paid candidates on purpose, pending a live call that
    // actually confirms schema compliance under instructed mode.
    model('structured_generation', 'cerebras', 'workhorse', 7, 'Unverified pricing/schema compliance — last resort', CEREBRAS_KEY),
    // Same reasoning as the 'reasoning' capability above: genuinely $0, so
    // this cost-ranked planner places it with the free tier despite being
    // the slowest member of it — see that binding's comment for the full
    // reasoning. `order: 8` is a tie-break number, not a "ranks 8th" claim.
    model('structured_generation', 'ollama', 'workhorse', 8, 'Local Ollama — $0, schema supplied in-prompt, validated locally', OLLAMA_KEY),
    floor('structured_generation', 'reject-directive', 9, 'Discard the response and keep the deterministic value'),
  ],

  prose_writing: [
    model('prose_writing', 'anthropic', 'workhorse', 0, 'Claude workhorse — prose a customer reads', ANTHROPIC_KEY),
    model('prose_writing', 'openai', 'workhorse', 1, 'GPT workhorse', OPENAI_KEY),
    model('prose_writing', 'gemini', 'workhorse', 2, 'Gemini workhorse — free allowance', GEMINI_KEY),
    // T05: a second free-tier fallback beside Gemini, before the paid/unverified seats below.
    model('prose_writing', 'groq', 'workhorse', 3, 'Groq workhorse — free tier, fast inference', GROQ_KEY),
    // Last-resort reachable provider: Cerebras is the only vendor verified
    // reachable here when the preferred prose seats are down.
    model('prose_writing', 'cerebras', 'workhorse', 4, 'Cerebras workhorse — reachable fallback', CEREBRAS_KEY),
    floor('prose_writing', 'compose-baseline', 5, 'Evidence-derived copy, no invented facts'),
  ],

  creative_direction: [
    model('creative_direction', 'anthropic', 'frontier', 0, 'Claude frontier — the conceptual leap', ANTHROPIC_KEY),
    model('creative_direction', 'openai', 'frontier', 1, 'GPT frontier', OPENAI_KEY),
    model('creative_direction', 'gemini', 'frontier', 2, 'Gemini frontier — free allowance', GEMINI_KEY),
    // bf_research's own Design Battle role table (BUSINESSFORGE_2.0_ARSENAL.md) names DeepSeek
    // V4 specifically as the cheap, divergent third territory generator — a different vendor
    // family from the three above, which is exactly what Design Battle needs.
    model('creative_direction', 'deepseek', 'frontier', 3, 'DeepSeek frontier — cheap, divergent battle seat', DEEPSEEK_KEY),
    // Groq has no `frontier`-class entry in models.ts either (gpt-oss-120b is catalogued as
    // `workhorse`, same as Cerebras) — ranked ahead of Cerebras specifically because it carries
    // a real, OBSERVED free allowance where Cerebras carries none.
    model('creative_direction', 'groq', 'workhorse', 4, 'Groq workhorse — free tier, fast inference fallback', GROQ_KEY),
    // Cerebras has no `frontier`-class entry in models.ts (gpt-oss-120b is
    // catalogued as `workhorse`); wired in at the bottom of the paid tier
    // rather than left out of this capability entirely.
    model('creative_direction', 'cerebras', 'workhorse', 5, 'Cerebras workhorse — fast inference, unverified pricing', CEREBRAS_KEY),
    floor('creative_direction', 'derive-character', 6, 'deriveCharacter plus worlds.ts — a directive from the profile'),
  ],

  enum_direction: [
    model('enum_direction', 'gemini', 'enum', 0, 'Flash-Lite — never a frontier model for an enum', GEMINI_KEY),
    model('enum_direction', 'openrouter', 'enum', 1, 'Free open-weight seat', OPENROUTER_KEY),
    model('enum_direction', 'openai', 'enum', 2, 'GPT mini', OPENAI_KEY),
    floor('enum_direction', 'enum-default', 3, 'The value the deterministic layer already computed'),
  ],

  adversarial_critique: [
    // Deliberately the mirror of creative_direction's order.
    model('adversarial_critique', 'gemini', 'frontier', 0, 'Gemini frontier — free allowance', GEMINI_KEY),
    model('adversarial_critique', 'openai', 'frontier', 1, 'GPT frontier', OPENAI_KEY),
    model('adversarial_critique', 'anthropic', 'frontier', 2, 'Claude frontier', ANTHROPIC_KEY),
    floor('adversarial_critique', 'skip-round', 3, 'Skip the objection round entirely'),
  ],

  /* ---------------- Evidence ---------------- */

  evidence_collection: [
    tool('evidence_collection', 'playwright-collector', 0, 'Chromium via Playwright — agents/collectorAgent.ts'),
    skill('evidence_collection', 'firecrawl', 1, 'Hosted crawl, when a site defeats the local browser', ['FIRECRAWL_API_KEY']),
    // No terminal: the descriptor declares none. Failing loudly is the contract.
  ],

  evidence_research: [
    tool('evidence_research', 'maps-listing', 0, 'lib/sources — the Maps listing read as content'),
    tool('evidence_research', 'places-api', 1, 'Google Places, when the licence question is settled'),
    skill('evidence_research', 'web-search', 2, 'Web search for the sources worth collecting', ['SEARCH_API_KEY']),
    floor('evidence_research', 'listing-only', 3, 'The Maps listing alone — a thinner but honest profile'),
  ],

  market_research: [
    skill('market_research', 'web-search', 0, 'Search for local and category context', ['SEARCH_API_KEY']),
    model('market_research', 'gemini', 'workhorse', 1, 'Synthesise the collected context', GEMINI_KEY),
    floor('market_research', 'skip', 2, 'Build from the business alone'),
  ],

  evidence_extraction: [
    skill('evidence_extraction', 'ocr', 0, 'Local document conversion — no network, no cost'),
    model('evidence_extraction', 'gemini', 'vision', 1, 'Vision model reading a photographed menu', GEMINI_KEY),
    floor('evidence_extraction', 'skip', 2, 'The document contributes nothing'),
  ],

  pii_detection: [
    tool('pii_detection', 'pii-screen', 0, 'lib/sources/piiScreen.ts — deterministic, pre-model'),
  ],

  /* ---------------- Vision and media ---------------- */

  vision_description: [
    model('vision_description', 'gemini', 'vision', 0, 'Gemini vision — free allowance', GEMINI_KEY),
    model('vision_description', 'openai', 'vision', 1, 'GPT vision', OPENAI_KEY),
    floor('vision_description', 'subject-of', 2, 'subjectOf — the deterministic subject, coarse but never wrong'),
  ],

  craft_judging: [
    model('craft_judging', 'gemini', 'vision', 0, 'Gemini vision judge', GEMINI_KEY),
    model('craft_judging', 'openai', 'vision', 1, 'GPT vision judge', OPENAI_KEY),
    model('craft_judging', 'anthropic', 'vision', 2, 'Claude vision judge', ANTHROPIC_KEY),
    floor('craft_judging', 'uncertain', 3, "Return 'uncertain', which blocks delivery (F-07)"),
  ],

  distinctness_judging: [
    // The mirror of craft_judging, so the pair naturally lands cross-vendor.
    tool('distinctness_judging', 'fingerprint-l1l2', 0, 'lib/design/fingerprint.ts — structural, free, deterministic'),
    model('distinctness_judging', 'openai', 'vision', 1, 'GPT vision judge', OPENAI_KEY),
    model('distinctness_judging', 'gemini', 'vision', 2, 'Gemini vision judge', GEMINI_KEY),
    floor('distinctness_judging', 'fingerprint-terminal', 3, 'L1 and L2 fingerprint comparison alone'),
  ],

  visual_defect_detection: [
    tool('visual_defect_detection', 'layout-audit', 0, 'lib/qa/layout-audit.ts — geometric defects, in the browser'),
    model('visual_defect_detection', 'gemini', 'vision', 1, 'Vision pass for defects only a reader notices', GEMINI_KEY),
    floor('visual_defect_detection', 'warn-only', 2, 'Ship with the deterministic audit warnings attached'),
  ],

  image_nondepictive: [
    skill('image_nondepictive', 'image-generation', 0, 'Texture and grain that depicts nothing real', ['IMAGE_API_KEY']),
    floor('image_nondepictive', 'worlds-grounds', 1, 'The solid and gradient grounds worlds.ts ships'),
  ],

  image_editing: [
    skill('image_editing', 'image-generation', 0, "Crop and relight the business's own photograph", ['IMAGE_API_KEY']),
    floor('image_editing', 'as-collected', 1, 'Use the photograph exactly as collected'),
  ],

  vector_generation: [
    skill('vector_generation', 'image-generation', 0, 'Vector mark generation', ['IMAGE_API_KEY']),
    floor('vector_generation', 'inline-svg', 1, 'The inline SVG and CSS the renderer already ships'),
  ],

  motion_media: [
    skill('motion_media', 'video-generation', 0, 'Ambient loop generation — human-gated', ['VIDEO_API_KEY']),
    floor('motion_media', 'static-photograph', 1, 'A still photograph'),
  ],

  audio_speech: [floor('audio_speech', 'omit', 0, 'Omitted by decision (F-18)')],

  three_d_generation: [
    floor('three_d_generation', 'procedural-webgl', 0, 'Procedural shader geometry the renderer authors'),
  ],

  /* ---------------- Semantic ---------------- */

  semantic_index: [
    tool('semantic_index', 'local-embeddings', 0, 'Local ONNX embedding model — evidence never leaves the machine'),
    model('semantic_index', 'openai', 'embedding', 1, 'Hosted embeddings', OPENAI_KEY),
    floor('semantic_index', 'fingerprint-l1l2', 2, 'L1 and L2 structural fingerprints alone'),
  ],

  design_memory: [
    tool('design_memory', 'design-memory', 0, 'lib/memory/designMemory.ts — scoped, decaying, append-only'),
    floor('design_memory', 'in-run-peers', 1, "This run's own candidates as the only peers"),
  ],

  /* ---------------- Measurement ---------------- */

  qa_measurement: [
    tool('qa_measurement', 'playwright-capture', 0, 'Chromium via Playwright — the one screenshot implementation'),
  ],

  visual_regression: [
    tool('visual_regression', 'visual-regression', 0, 'lib/qa/visual-regression.ts — pixel diffing'),
  ],

  accessibility: [
    tool('accessibility', 'axe-core', 0, 'axe-core in the page', 'copyleft-local'),
    floor('accessibility', 'in-repo-a11y', 1, 'lib/qa/gates/accessibility.ts — landmarks, alt text, contrast'),
  ],

  performance: [
    tool('performance', 'lighthouse', 0, 'Lighthouse against the built site'),
    floor('performance', 'in-repo-budgets', 1, 'lib/qa/gates/performance.ts — byte and request budgets'),
  ],

  output_security: [
    floor('output_security', 'in-repo-security', 0, 'lib/qa/gates/technical.ts — the five shipped checks'),
  ],

  structured_data_validation: [
    tool('structured_data_validation', 'jsonld-validate', 0, 'Validate the emitted JSON-LD'),
    floor('structured_data_validation', 'emit-unvalidated', 1, 'Emit the structured data as composed'),
  ],

  /* ---------------- Delivery and operations ---------------- */

  runtime_tier: [
    floor('runtime_tier', 'experience-ladder', 0, 'lib/capability/experience.ts — the evidence-gated ladder'),
  ],

  build_artifact: [floor('build_artifact', 'render-site', 0, 'lib/render — the deterministic renderer')],

  hosting: [
    skill('hosting', 'deployment', 0, 'Static host upload', ['DEPLOY_TOKEN']),
    floor('hosting', 'local-dir', 1, 'The site directory on disk'),
  ],

  discoverability: [
    floor('discoverability', 'in-repo-seo', 0, 'The JSON-LD, metadata and lexicon the renderer emits'),
  ],

  observability: [floor('observability', 'ndjson-log', 0, 'The NDJSON run log on disk')],

  cost_ledger: [tool('cost_ledger', 'cost-ledger', 0, 'lib/cost — provenance-derived accounting')],

  rate_governor: [tool('rate_governor', 'rate-governor', 0, 'lib/ai/governor.ts plus lib/capability/quota.ts')],

  human_approval: [
    skill('human_approval', 'notifications', 0, 'Ask a person and wait', ['NOTIFY_WEBHOOK']),
  ],
};

/** The bindings for one capability, in declared order. */
export function bindingsFor(capability: CapabilityId): readonly ServiceBinding[] {
  return SERVICE_BINDINGS[capability];
}

/** Every binding in the table, flattened. For the board and for tests. */
export const ALL_BINDINGS: readonly ServiceBinding[] = CAPABILITY_IDS.flatMap(
  (id) => SERVICE_BINDINGS[id],
);

export const SOURCE_NAME = SOURCE;
