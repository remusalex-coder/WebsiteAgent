/**
 * Type definitions for the BusinessForge Experience Signature Pipeline (V1).
 */

import type { BusinessProfile } from '../types.js';

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
  readonly comparisonWithBaseline?: {
    readonly structureSimilarityScore: number;
    readonly tokenSimilarityScore: number;
    readonly verdict: 'DISTINCT' | 'TOO_SIMILAR_TO_BASELINE';
  };
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
  readonly screenshots: {
    readonly desktop: string;
    readonly mobile: string;
  };
}
