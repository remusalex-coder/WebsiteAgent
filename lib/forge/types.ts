/**
 * Type definitions for the BusinessForge Experience Signature Pipeline (V1).
 */

import type { BusinessProfile } from '../types.js';
import type { CombinedVerdict } from '../qa/verdict.js';
import type { AIProviderFactory } from '../ai/factory.js';
import type { CapabilityOrchestrator } from '../capability/orchestrator.js';

/**
 * What every Forge stage that makes a text/structured model call needs to
 * route through the capability layer instead of constructing a provider
 * itself: the orchestrator that plans/executes/meters the call, and the
 * provider factory `createModelInvoker` turns a resolved plan step into a
 * real `AIProvider.generate()` call with. One shared shape rather than five
 * near-identical ad hoc interfaces (research, grounding, signature, builder,
 * repair all need exactly this and nothing more).
 */
export interface ForgeRouting {
  readonly capabilities: CapabilityOrchestrator;
  readonly providers: AIProviderFactory;
}

export interface ProvenanceFact {
  readonly id: string;
  readonly category: 'identity' | 'location' | 'contact' | 'rating' | 'space' | 'service' | 'feature';
  readonly claim: string;
  readonly source: 'instagram' | 'google_maps' | 'official_website' | 'wedding_registry' | 'user_input';
  readonly sourceUrl?: string;
  readonly confidence: 'verified' | 'high' | 'provisional';
  readonly evidenceSnippet: string;
  readonly timestamp: string;
}

export interface FactualInference {
  readonly id: string;
  readonly claim: string;
  readonly reasoning: string;
  readonly supportingFactIds: readonly string[];
  readonly confidence: 'likely' | 'speculative';
}

export interface CreativeInterpretation {
  readonly id: string;
  readonly concept: string;
  readonly derivedFromFactIds: readonly string[];
  readonly artisticRationale: string;
}

export interface SourcedAsset {
  readonly id: string;
  readonly role: 'hero' | 'grand_hall' | 'warm_hall' | 'table_detail' | 'ceremony_garden' | 'gallery' | 'product' | 'interior' | 'exterior';
  readonly url: string;
  readonly localPath: string;
  readonly alt: string;
  readonly realDescription: string;
  readonly provenanceSource: string;
  readonly width?: number;
  readonly height?: number;
}

export interface BusinessResearch {
  readonly name: string;
  readonly taglines: readonly string[];
  readonly category: string;
  readonly description: string;
  readonly storyAndPhilosophy: string;
  readonly productsOrServices: readonly {
    readonly name: string;
    readonly category?: string;
    readonly description: string;
    readonly highlight?: string;
    readonly price?: string;
  }[];
  readonly differentiators: readonly string[];
  readonly location: {
    readonly address: string;
    readonly city: string;
    readonly coordinates?: { readonly lat: number; readonly lng: number };
  };
  readonly contact: {
    readonly phone?: string;
    readonly email?: string;
    readonly website?: string;
    readonly instagram?: string;
    readonly facebook?: string;
  };
  readonly hours: readonly {
    readonly day: string;
    readonly range: string;
  }[];
  readonly reviews: readonly {
    readonly author: string;
    readonly text: string;
    readonly rating: number;
  }[];
  readonly ratingSummary?: {
    readonly rating: number;
    readonly count: number;
  };
  readonly assets: readonly SourcedAsset[];
  readonly primaryLanguage: string;
}

export interface FactualDossier {
  readonly businessName: string;
  readonly category: string;
  readonly verifiedFacts: readonly ProvenanceFact[];
  readonly inferences: readonly FactualInference[];
  readonly creativeInterpretations: readonly CreativeInterpretation[];
  readonly conflicts: readonly {
    readonly topic: string;
    readonly sourceA: { readonly value: string; readonly source: string };
    readonly sourceB: { readonly value: string; readonly source: string };
    readonly resolutionNote: string;
  }[];
  readonly forbiddenAssumptions: readonly string[];
  readonly realPhotoAssets: readonly SourcedAsset[];
  readonly location: {
    readonly fullAddress: string;
    readonly street: string;
    readonly city: string;
    readonly region: string;
    readonly coordinates?: { readonly lat: number; readonly lng: number };
    readonly mapsUrl?: string;
  };
  readonly contact: {
    readonly phone?: string;
    readonly email?: string;
    readonly instagram?: string;
    readonly facebook?: string;
    readonly website?: string;
  };
  readonly verifiedRating?: {
    readonly rating: number;
    readonly reviewCount: number;
    readonly source: string;
    readonly timestamp: string;
  };
  readonly verifiedReviews: readonly {
    readonly author: string;
    readonly text: string;
    readonly rating: number;
    readonly source: string;
  }[];
  readonly primaryLanguage: string;
}

export interface CreativeTerritory {
  readonly id: string;
  readonly name: string;
  readonly conceptThesis: string;
  readonly metaphor: string;
  readonly emotionalTarget: string;
  readonly visualLanguage: string;
  readonly interactionLanguage: string;
  readonly signatureMoment: string;
  readonly risks: readonly string[];
  readonly reasonsNotToChoose: string;
}

/**
 * The Experience Strategy — closed-set decisions the signature is required
 * to make explicitly, rather than leaving them implicit in free-text prose
 * fields the deterministic layers downstream cannot act on.
 *
 * Each field is a closed enum (never a free string the model could invent),
 * matching the discipline `docs/decisions/0004-the-directors-influence-is-one-enum.md`
 * already established for the classic pipeline: the model picks from a
 * vocabulary, deterministic code executes it. `normalizeExperienceStrategy`
 * in `signature.ts` validates every field against its closed set and
 * degrades to a safe default on anything invalid — the model proposes,
 * validated code disposes.
 *
 * Sourced from `docs/knowledge/EXPERIENCE_SIGNATURE_SYSTEM.md`'s
 * propagation contract (§6, 11 disciplines a valid signature must answer)
 * and `MOTION_LIBRARY.md`/`ANTI_AI_SLOP.md`/`WEBSITE_CAPABILITY_KNOWLEDGE.md`
 * for the specific vocabularies (motion intensity, functional modules).
 */
export interface ExperienceStrategy {
  readonly motionIntensity: 'none' | 'subtle' | 'expressive' | 'immersive';
  readonly navigationModel: 'inline' | 'sticky-minimal' | 'full-screen-menu' | 'morphing';
  readonly loadingModel: 'none' | 'skeleton' | 'progressive-reveal' | 'asset-aware-preloader';
  readonly typographyBehavior: 'static' | 'kinetic-headlines' | 'split-text-reveals' | 'typography-led-navigation';
  readonly cursorBehavior: 'default' | 'minimal-custom' | 'magnetic' | 'contextual';
  readonly scrollBehavior: 'native' | 'smooth-native' | 'pinned-storytelling' | 'horizontal-section';
  readonly layoutGrammar: 'grid-regular' | 'asymmetric-editorial' | 'overlapping-layers' | 'horizontal-narrative';
  readonly mediaStrategy: 'photography-only' | 'photography-plus-texture' | 'ai-generated-imagery' | 'video-background' | 'cinematic-hero-media';
  readonly requires3D: boolean;
  readonly requires3DRationale: string;
  readonly requiresVideo: boolean;
  readonly requiresVideoRationale: string;
  readonly functionalModules: readonly FunctionalModuleId[];
  readonly mobileBehavior: 'mirrors-desktop' | 'simplified' | 'reordered-priority';
  readonly accessibilityStrategy: 'wcag-aa-floor' | 'wcag-aa-enhanced';
  /** 0 (semantic/static) through 5 (AI-generated heavy media) — see `lib/forge/performance.ts`. */
  readonly performanceTier: 0 | 1 | 2 | 3 | 4 | 5;
  readonly reducedMotionStrategy: 'instant-state-only' | 'preserve-essential-feedback';
  /** Why these choices, tied to evidence — the discipline `EXPERIENCE_SIGNATURE_SYSTEM.md` §11 calls RESTS ON. */
  readonly rationale: string;
}

/**
 * Closed vocabulary of functional modules, derived from
 * `WEBSITE_CAPABILITY_KNOWLEDGE.md`'s CAP-07 (booking), CAP-11 (search),
 * CAP-12 (filters), and CAP-09 (enquiry/mailto). `product-configurator` and
 * `calculator` are this repository's own fill for a gap the source document
 * names explicitly (no CAP-nn entry for either), modelled on CAP-12's
 * evidence-trigger shape per that document's own recommendation.
 *
 * `'none'` must remain selectable and is the correct default — the doctrine
 * of absence (`WEBSITE_CAPABILITY_KNOWLEDGE.md` §5): a capability is opt-in
 * on evidence, never opt-out on caution.
 */
export type FunctionalModuleId =
  | 'none'
  | 'enquiry-form'
  | 'booking-request'
  | 'service-selector'
  | 'product-configurator'
  | 'search-filter'
  | 'comparison-tool'
  | 'calculator';

export interface ExperienceSignature {
  readonly selectedTerritoryId: string;
  readonly selectionRationale: string;
  readonly businessTruth: string;
  readonly humanInsight: string;
  readonly creativeMetaphor: string;
  readonly centralMechanism: string;
  readonly signatureMoment: string;
  readonly interactionGrammar: {
    readonly paceAndMotion: string;
    readonly openingMoment: string;
    readonly scrollChoreography: string;
    readonly microInteractions: readonly string[];
    readonly selectedPatterns: readonly string[];
    readonly rejectedPatterns: readonly string[];
  };
  readonly visualGrammar: {
    readonly moodWords: readonly string[];
    readonly colorPalette: {
      readonly primary: string;
      readonly secondary: string;
      readonly background: string;
      readonly surface: string;
      readonly textPrimary: string;
      readonly textMuted: string;
      readonly accent: string;
    };
    readonly typography: {
      readonly displayFamily: string;
      readonly bodyFamily: string;
      readonly styleNote: string;
    };
    readonly spatialComposition: string;
  };
  readonly restraintContract: {
    readonly forbiddenAntiPatterns: readonly string[];
    readonly mandatoryDesignRules: readonly string[];
  };
  readonly experienceStrategy: ExperienceStrategy;
  readonly scenes: readonly {
    readonly id: string;
    readonly actName: string;
    readonly purpose: string;
    readonly title: string;
    readonly subtitle?: string;
    readonly bodyText: string;
    readonly layoutPattern: string;
    readonly keyInteraction: string;
    readonly visualEffect?: string;
    readonly assetIds: readonly string[];
  }[];
}

export interface ExperienceBlueprint {
  readonly brandName: string;
  readonly factualDossier: FactualDossier;
  readonly signature: ExperienceSignature;
  readonly conversionStrategy: {
    readonly primaryActionLabel: string;
    readonly primaryActionType: 'order' | 'call' | 'visit' | 'book' | 'reserve';
    readonly secondaryActionLabel?: string;
    readonly reassurancePoints: readonly string[];
  };
}

export interface GeneratedCode {
  readonly html: string;
  readonly css: string;
  readonly js: string;
}

export interface AntiAIGateResult {
  readonly passed: boolean;
  readonly score: number; // 0-100
  readonly flags: readonly {
    readonly code: string;
    readonly severity: 'fail' | 'warning' | 'info';
    readonly message: string;
    readonly evidence?: string;
  }[];
  /**
   * Structural template-convergence check against the real peer corpus of
   * prior Forge runs (never a single hardcoded baseline — see
   * `anti-ai-gate.ts`'s `checkStructuralConvergence`). `null` when fewer
   * than one real peer exists to compare against, which is a fact about the
   * corpus, not a pass.
   */
  readonly structuralConvergence: {
    readonly peersCompared: number;
    readonly closestPeer: string | null;
    readonly matchedAxes: readonly string[];
    readonly verdict: 'DISTINCT' | 'NO_PEERS' | 'TEMPLATE_CONVERGENCE';
  } | null;
}

export interface VisionIssue {
  readonly area: string;
  readonly severity: 'critical' | 'enhancement' | 'polish';
  readonly description: string;
  readonly fixInstruction: string;
}

export interface VisionCritiqueReport {
  readonly score: number; // 0-100
  readonly verdict: 'EXCEPTIONAL' | 'POLISH_NEEDED' | 'REPAIR_REQUIRED';
  readonly feelsArtDirectedVsAi: 'INTENTIONALLY_ART_DIRECTED' | 'HYBRID_SOME_GENERIC' | 'OBVIOUSLY_AI_GENERATED';
  readonly criteriaScores: {
    readonly conceptualCoherence: number; // 0-10
    readonly businessSpecificity: number; // 0-10
    readonly humanArtDirection: number; // 0-10
    readonly visualHierarchy: number; // 0-10
    readonly composition: number; // 0-10
    readonly interactionRestraint: number; // 0-10
    readonly memorability: number; // 0-10
    readonly distinctiveness: number; // 0-10
    readonly factualFidelity: number; // 0-10
    readonly mobileExperience: number; // 0-10
  };
  readonly positiveHighlights: readonly string[];
  readonly issues: readonly VisionIssue[];
  readonly rawNotes?: string;
}

export interface ForgeOptions {
  readonly url?: string | undefined;
  readonly profile?: BusinessProfile | undefined;
  readonly order?: string | undefined;
  readonly runId?: string | undefined;
  readonly outputDir?: string | undefined;
  readonly maxIterations?: number | undefined;
  readonly autoOpen?: boolean | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface ForgeResult {
  readonly runId: string;
  readonly siteDir: string;
  readonly indexPath: string;
  readonly factualDossier: FactualDossier;
  readonly territories: readonly CreativeTerritory[];
  readonly signature: ExperienceSignature;
  readonly blueprint: ExperienceBlueprint;
  readonly antiAiGate: AntiAIGateResult;
  readonly iterations: number;
  readonly finalCritique: VisionCritiqueReport;
  /**
   * The one explainable PASS/FAIL decision for this run, combining the
   * pre-vision structural/factual gate with the post-vision critic verdict
   * via `lib/qa/verdict.ts`'s lexicographic rule (F-06) — reused, not
   * re-derived. See `orchestrator.ts` step 9.
   */
  readonly finalVerdict: CombinedVerdict;
  readonly screenshots: {
    readonly desktop: string;
    readonly mobile: string;
  };
}
