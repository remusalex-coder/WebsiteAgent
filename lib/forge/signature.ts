/**
 * Experience Signature & Creative Territories Engine.
 *
 * Implements the conceptual creative pipeline:
 * BUSINESS TRUTH → HUMAN INSIGHT → CREATIVE TERRITORIES (x3) →
 * SIGNATURE SELECTION → INTERACTION & VISUAL GRAMMAR → RESTRAINT CONTRACT.
 *
 * This is the Experience Signature pipeline's Design Director: the one place
 * a model makes the creative leap from verified facts to a controlling idea.
 * It used to call `createAIProvider(config.ai, logger)` directly — one
 * vendor, no failover, no quota awareness, no cost ledger, invisible to
 * `platform.capabilities.board()`. Both calls now route through the
 * `creative_direction` capability, the same one `agents/designDirectorAgent.ts`
 * uses for the classic pipeline: filtered on credential/quota/budget, ranked
 * free-before-paid, and failed over across vendors rather than failing the
 * stage outright.
 */

import { createModelInvoker } from '../capability/invokers.js';
import { EXPERIENCE_STRATEGY_PROMPT, EXPERIENCE_STRATEGY_SCHEMA, normalizeExperienceStrategy } from './experienceStrategy.js';

import type { CreativeTerritory, ExperienceSignature, FactualDossier, ForgeRouting } from './types.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';

export interface SignatureResult {
  readonly territories: readonly CreativeTerritory[];
  readonly signature: ExperienceSignature;
}

/** What `formulateExperienceSignature` needs beyond the dossier itself. */
export type SignatureRouting = ForgeRouting;

const TERRITORY_SCHEMA = {
  type: 'object',
  required: ['territories'],
  properties: {
    territories: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'name',
          'conceptThesis',
          'metaphor',
          'emotionalTarget',
          'visualLanguage',
          'interactionLanguage',
          'signatureMoment',
          'risks',
          'reasonsNotToChoose',
        ],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          conceptThesis: { type: 'string' },
          metaphor: { type: 'string' },
          emotionalTarget: { type: 'string' },
          visualLanguage: { type: 'string' },
          interactionLanguage: { type: 'string' },
          signatureMoment: { type: 'string' },
          risks: { type: 'array', items: { type: 'string' } },
          reasonsNotToChoose: { type: 'string' },
        },
      },
    },
  },
} as const;

const SIGNATURE_SCHEMA = {
  type: 'object',
  required: [
    'selectedTerritoryId',
    'selectionRationale',
    'businessTruth',
    'humanInsight',
    'creativeMetaphor',
    'centralMechanism',
    'signatureMoment',
    'interactionGrammar',
    'visualGrammar',
    'restraintContract',
    'experienceStrategy',
    'scenes',
  ],
  properties: {
    selectedTerritoryId: { type: 'string' },
    selectionRationale: { type: 'string' },
    businessTruth: { type: 'string' },
    humanInsight: { type: 'string' },
    creativeMetaphor: { type: 'string' },
    centralMechanism: { type: 'string' },
    signatureMoment: { type: 'string' },
    interactionGrammar: {
      type: 'object',
      required: [
        'paceAndMotion',
        'openingMoment',
        'scrollChoreography',
        'microInteractions',
        'selectedPatterns',
        'rejectedPatterns',
      ],
      properties: {
        paceAndMotion: { type: 'string' },
        openingMoment: { type: 'string' },
        scrollChoreography: { type: 'string' },
        microInteractions: { type: 'array', items: { type: 'string' } },
        selectedPatterns: { type: 'array', items: { type: 'string' } },
        rejectedPatterns: { type: 'array', items: { type: 'string' } },
      },
    },
    visualGrammar: {
      type: 'object',
      required: ['moodWords', 'colorPalette', 'typography', 'spatialComposition'],
      properties: {
        moodWords: { type: 'array', items: { type: 'string' } },
        colorPalette: {
          type: 'object',
          required: ['primary', 'secondary', 'background', 'surface', 'textPrimary', 'textMuted', 'accent'],
          properties: {
            primary: { type: 'string' },
            secondary: { type: 'string' },
            background: { type: 'string' },
            surface: { type: 'string' },
            textPrimary: { type: 'string' },
            textMuted: { type: 'string' },
            accent: { type: 'string' },
          },
        },
        typography: {
          type: 'object',
          required: ['displayFamily', 'bodyFamily', 'styleNote'],
          properties: {
            displayFamily: { type: 'string' },
            bodyFamily: { type: 'string' },
            styleNote: { type: 'string' },
          },
        },
        spatialComposition: { type: 'string' },
      },
    },
    restraintContract: {
      type: 'object',
      required: ['forbiddenAntiPatterns', 'mandatoryDesignRules'],
      properties: {
        forbiddenAntiPatterns: { type: 'array', items: { type: 'string' } },
        mandatoryDesignRules: { type: 'array', items: { type: 'string' } },
      },
    },
    experienceStrategy: EXPERIENCE_STRATEGY_SCHEMA,
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'actName', 'purpose', 'title', 'bodyText', 'layoutPattern', 'keyInteraction', 'assetIds'],
        properties: {
          id: { type: 'string' },
          actName: { type: 'string' },
          purpose: { type: 'string' },
          title: { type: 'string' },
          subtitle: { type: 'string' },
          bodyText: { type: 'string' },
          layoutPattern: { type: 'string' },
          keyInteraction: { type: 'string' },
          visualEffect: { type: 'string' },
          assetIds: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
} as const;

/**
 * Replaces the model's scene ids with content-derived slugs.
 *
 * Nothing in `SIGNATURE_SCHEMA` tells the model what a scene id is *for*,
 * so it defaults to the boilerplate every model reaches for when a field
 * asks for "an id" with no other guidance: `scene-1`, `scene-2`, … This is
 * cosmetically harmless on its own, but it was also the reason
 * `anti-ai-gate.ts`'s old baseline check scored an auto-repair shop "100%
 * identical" to a bakery built weeks earlier — the two builds' *only*
 * genuinely shared trait was that both used the same sequential-id
 * convention every business gets. Deriving the id from the scene's own
 * `actName`/`title` instead — the fields the model actually authors with
 * business-specific content — removes that false signal at the source and
 * gives the rendered page real, distinct anchor ids as a side effect.
 */
export function slugifySceneIds(signature: ExperienceSignature): ExperienceSignature {
  const seen = new Map<string, number>();
  const scenes = signature.scenes.map((scene) => {
    const base = slugify(scene.actName || scene.title || scene.purpose) || 'scene';
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    const id = count === 0 ? base : `${base}-${count + 1}`;
    return { ...scene, id };
  });
  return { ...signature, scenes };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/^act\s+[ivx]+\s*[—\-:]*\s*/i, '') // strip an "ACT I — " / "ACT II: " prefix
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function formulateExperienceSignature(
  dossier: FactualDossier,
  config: AppConfig,
  routing: SignatureRouting,
  logger: Logger,
): Promise<SignatureResult> {
  logger.info('Formulating Creative Territories and Experience Signature', {
    businessName: dossier.businessName,
    verifiedFactsCount: dossier.verifiedFacts.length,
  });

  // Step 1: Generate 3 Radical Creative Territories
  const territoryPrompt = `You are a legendary Chief Creative Officer at an award-winning design studio.
Formulate THREE RADICALLY DIFFERENT Creative Territories for this business based on verified evidence:

BUSINESS: "${dossier.businessName}"
CATEGORY: "${dossier.category}"
LOCATION: "${dossier.location.fullAddress}"
VERIFIED FACTS:
${dossier.verifiedFacts.map((f) => `- [${f.category}]: ${f.claim} (Evidence: ${f.evidenceSnippet})`).join('\n')}

FORBIDDEN ASSUMPTIONS (DO NOT VIOLATE):
${dossier.forbiddenAssumptions.map((a) => `- ${a}`).join('\n')}

REAL PHOTO ASSETS AVAILABLE:
${JSON.stringify(dossier.realPhotoAssets.map((a) => ({ path: a.localPath, desc: a.realDescription })))}

Each territory must explore a distinctly different emotional, visual, and interaction direction, grounded in what makes THIS business specifically different from others in its category — never a generic template feel.

For EACH territory, specify: id, name, conceptThesis, metaphor, emotionalTarget, visualLanguage, interactionLanguage, signatureMoment, risks, reasonsNotToChoose.

Return strictly valid JSON containing an array of 3 territories under "territories".`;

  const territoryInvoke = createModelInvoker(
    {
      system: 'You generate distinct, radical, high-craft creative territories grounded strictly in verified evidence.',
      prompt: territoryPrompt,
      schema: TERRITORY_SCHEMA,
      schemaName: 'creative_territories',
      maxTokens: 16_000,
      effort: 'high',
      modelOverrides: { [config.ai.provider]: config.director.model || config.analyst.model },
    },
    routing.providers,
    logger,
  );

  const territoryOutcome = await routing.capabilities.run('creative_direction', territoryInvoke, {
    tokens: { inputTokens: territoryPrompt.length / 4, outputTokens: 4_000 },
  });

  if (!territoryOutcome.outcome.ok) {
    throw new Error(
      `[forge.signature] no vendor could formulate creative territories: ${territoryOutcome.outcome.error.message}`,
    );
  }

  const territories = (territoryOutcome.outcome.data.data as { territories: CreativeTerritory[] }).territories;

  logger.info('3 Creative Territories formulated', {
    names: territories.map((t) => t.name),
    servedBy: territoryOutcome.record.servedBy,
  });

  // Step 2: Select the winning territory and build the full Experience Signature
  const signaturePrompt = `You are an Awwwards Jury President and Art Director.
Evaluate the 3 Creative Territories and formulate the definitive EXPERIENCE SIGNATURE for "${dossier.businessName}".

TERRITORIES GENERATED:
${JSON.stringify(territories, null, 2)}

VERIFIED EVIDENCE:
${dossier.verifiedFacts.map((f) => `- ${f.claim}`).join('\n')}

FORBIDDEN ASSUMPTIONS:
${dossier.forbiddenAssumptions.map((a) => `- ${a}`).join('\n')}

REAL ASSETS:
${JSON.stringify(dossier.realPhotoAssets.map((a) => ({ path: a.localPath, desc: a.realDescription })))}

MANDATES FOR EXPERIENCE SIGNATURE:
1. Choose the territory with the highest emotional resonance and authentic differentiation. State the "selectionRationale".
2. Define:
   - "businessTruth": The single most undeniable, verified truth about this business.
   - "humanInsight": Why this business's customers choose it (the psychological and emotional need).
   - "creativeMetaphor": The overarching poetic metaphor.
   - "centralMechanism": The primary interaction concept that governs the site.
   - "signatureMoment": The standout climax beat of the experience.
3. INTERACTION GRAMMAR & RESTRAINT CONTRACT:
   - HAVE AN ARTISTIC OPINION. Explicitly list "rejectedPatterns" (e.g. "No generic loading spinners", "No unmotivated glassmorphism", "No particle storm", "No cards everywhere").
   - Define "selectedPatterns" that follow directly from this business's own evidence, not a category default.
4. VISUAL GRAMMAR:
   - Bespoke color palette matching the real evidence (photography, decor, branding already on record) — never a default palette.
   - Typography: a display family and a body family that reinforce the creative metaphor.
5. SCENES SPECIFICATION:
   - 5 to 6 distinct acts, with layoutPattern, headline, subtitle, bodyText (in ${dossier.primaryLanguage}), keyInteraction, visualEffect, and assetIds bound directly to real photos.
6. ${EXPERIENCE_STRATEGY_PROMPT}

Return strictly valid JSON conforming to the ExperienceSignature schema.`;

  const signatureInvoke = createModelInvoker(
    {
      system:
        'You formulate an intentional, bespoke Experience Signature with strict restraint and artistic discipline. Never generate generic templates.',
      prompt: signaturePrompt,
      schema: SIGNATURE_SCHEMA,
      schemaName: 'experience_signature',
      maxTokens: 16_000,
      effort: 'high',
      modelOverrides: { [config.ai.provider]: config.director.model || config.analyst.model },
    },
    routing.providers,
    logger,
  );

  const signatureOutcome = await routing.capabilities.run('creative_direction', signatureInvoke, {
    tokens: { inputTokens: signaturePrompt.length / 4, outputTokens: 6_000 },
  });

  if (!signatureOutcome.outcome.ok) {
    throw new Error(
      `[forge.signature] no vendor could formulate the experience signature: ${signatureOutcome.outcome.error.message}`,
    );
  }

  const rawSignature = signatureOutcome.outcome.data.data as unknown as ExperienceSignature;
  const signature = slugifySceneIds({
    ...rawSignature,
    experienceStrategy: normalizeExperienceStrategy(
      (rawSignature as unknown as Record<string, unknown>)['experienceStrategy'],
      dossier,
      logger,
    ),
  });

  logger.info('Experience Signature established', {
    selectedTerritory: signature.selectedTerritoryId,
    metaphor: signature.creativeMetaphor,
    centralMechanism: signature.centralMechanism,
    rejectedPatternsCount: signature.interactionGrammar.rejectedPatterns.length,
    experienceStrategy: signature.experienceStrategy,
    servedBy: signatureOutcome.record.servedBy,
  });

  return { territories, signature };
}
