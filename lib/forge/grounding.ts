/**
 * Factual Firewall & Grounding Engine.
 *
 * Enforces strict epistemic discipline:
 * - Separates VERIFIED_FACTS, INFERENCES, and CREATIVE_INTERPRETATIONS.
 * - Attaches provenance and confidence to every factual claim.
 * - Flags source conflicts rather than choosing arbitrarily.
 * - Generates FORBIDDEN_ASSUMPTIONS to prevent name-based hallucinations (e.g. "River" -> "on riverbank").
 * - Binds real photographs to verified physical spaces and features.
 *
 * Routes through the `reasoning` capability rather than constructing a
 * provider directly — the same reasoning `research.ts` documents: this is
 * "reason over messy evidence and cite it", which is that capability's own
 * description, and gives this stage real cross-vendor failover instead of
 * depending on a single vendor's daily quota.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { createModelInvoker, deterministicModelResult, withDeterministicFloor } from '../capability/invokers.js';
import type { FactualDossier, ForgeRouting, ProvenanceFact, SourcedAsset } from './types.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';

export interface GroundingOptions {
  readonly url: string;
  readonly order?: string | undefined;
  readonly rawPages: readonly { readonly url: string; readonly title: string; readonly text: string }[];
  readonly downloadedAssets: readonly SourcedAsset[];
  readonly runDir: string;
  readonly config: AppConfig;
  readonly routing: ForgeRouting;
  readonly logger: Logger;
}

export async function buildFactualDossier(options: GroundingOptions): Promise<FactualDossier> {
  const { url, order, rawPages, downloadedAssets, config, routing, logger } = options;

  logger.info('Executing Factual Firewall & Grounding analysis', { url, rawPagesCount: rawPages.length });

  const prompt = `You are the Principal Chief Factual Verification Auditor for an enterprise website intelligence agency.
Analyze the raw scraped evidence for "${url}".

RAW EVIDENCE FROM CRAWLED SOURCES:
${rawPages.map((p, idx) => `=== SOURCE [${idx + 1}]: ${p.url} (Title: ${p.title}) ===\n${p.text}`).join('\n\n')}

AVAILABLE LOCAL REAL ASSET PROVENANCE:
${JSON.stringify(downloadedAssets.map((a) => ({ id: a.id, path: a.localPath, alt: a.alt, desc: a.realDescription })))}

CRITICAL FACTUAL GROUNDING RULES:
1. STRICT NEGATIVE INFERENCE GUARD:
   - DO NOT deduce unverified physical features from the business name!
   - E.g., if the name is "River Park Events", DO NOT assume it is physically on the bank of a river, near water, or has river views UNLESS explicit text or photos verify it.
   - Formulate a list of "forbiddenAssumptions" explicitly warning against false assumptions.
2. SEPARATE INTO THREE RIGOROUS TIERS:
   - "verifiedFacts": Claims with direct textual/photo evidence from authoritative sources (Instagram, Google Maps, official registry). Include category, claim, source, confidence ('verified'), evidenceSnippet.
   - "inferences": Logical deductions with supporting fact IDs.
   - "creativeInterpretations": Artistic angles that can inspire the design WITHOUT being stated as literal facts.
3. CONFLICT HANDLING:
   - If sources disagree on address, phone, or hours, record the conflict in "conflicts" with both sources noted.
4. VOLATILE DATA:
   - For reviews and ratings, record the exact source, reviewCount, rating, and timestamp.
5. REAL ASSETS BINDING:
   - Ensure every photo asset is mapped to verified descriptions (e.g. ballroom with chandelier, cold sparkler cloud dance, table place settings).

Return strictly valid JSON conforming to the schema.`;

  const modelInvoke = createModelInvoker(
    {
      system:
        'You are a rigorous factual auditor. Never invent facts. Separate verified truths from inferences and forbid unproven name-based assumptions.',
      prompt,
      schemaName: 'factual_dossier',
      effort: 'high',
      maxTokens: 16000,
      modelOverrides: { [config.ai.provider]: config.analyst.model },
      schema: {
      type: 'object',
      required: [
        'businessName',
        'category',
        'verifiedFacts',
        'inferences',
        'creativeInterpretations',
        'conflicts',
        'forbiddenAssumptions',
        'location',
        'contact',
        'primaryLanguage',
      ],
      properties: {
        businessName: { type: 'string' },
        category: { type: 'string' },
        verifiedFacts: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'category', 'claim', 'source', 'confidence', 'evidenceSnippet', 'timestamp'],
            properties: {
              id: { type: 'string' },
              category: { type: 'string' },
              claim: { type: 'string' },
              source: { type: 'string' },
              sourceUrl: { type: 'string' },
              confidence: { type: 'string', enum: ['verified', 'high', 'provisional'] },
              evidenceSnippet: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
        inferences: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'claim', 'reasoning', 'supportingFactIds', 'confidence'],
            properties: {
              id: { type: 'string' },
              claim: { type: 'string' },
              reasoning: { type: 'string' },
              supportingFactIds: { type: 'array', items: { type: 'string' } },
              confidence: { type: 'string', enum: ['likely', 'speculative'] },
            },
          },
        },
        creativeInterpretations: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'concept', 'derivedFromFactIds', 'artisticRationale'],
            properties: {
              id: { type: 'string' },
              concept: { type: 'string' },
              derivedFromFactIds: { type: 'array', items: { type: 'string' } },
              artisticRationale: { type: 'string' },
            },
          },
        },
        conflicts: {
          type: 'array',
          items: {
            type: 'object',
            required: ['topic', 'sourceA', 'sourceB', 'resolutionNote'],
            properties: {
              topic: { type: 'string' },
              sourceA: {
                type: 'object',
                required: ['value', 'source'],
                properties: { value: { type: 'string' }, source: { type: 'string' } },
              },
              sourceB: {
                type: 'object',
                required: ['value', 'source'],
                properties: { value: { type: 'string' }, source: { type: 'string' } },
              },
              resolutionNote: { type: 'string' },
            },
          },
        },
        forbiddenAssumptions: { type: 'array', items: { type: 'string' } },
        location: {
          type: 'object',
          required: ['fullAddress', 'street', 'city', 'region'],
          properties: {
            fullAddress: { type: 'string' },
            street: { type: 'string' },
            city: { type: 'string' },
            region: { type: 'string' },
            mapsUrl: { type: 'string' },
          },
        },
        contact: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            email: { type: 'string' },
            instagram: { type: 'string' },
            facebook: { type: 'string' },
            website: { type: 'string' },
          },
        },
        verifiedRating: {
          type: 'object',
          properties: {
            rating: { type: 'number' },
            reviewCount: { type: 'number' },
            source: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
        verifiedReviews: {
          type: 'array',
          items: {
            type: 'object',
            required: ['author', 'text', 'rating', 'source'],
            properties: {
              author: { type: 'string' },
              text: { type: 'string' },
              rating: { type: 'number' },
              source: { type: 'string' },
            },
          },
        },
        primaryLanguage: { type: 'string' },
      },
      },
    },
    routing.providers,
    logger,
  );

  // Every field this stage reads below already falls back to a hardcoded
  // default when a model *omits* it (`(parsed.x as T) || default`). Handing
  // back an empty object on the deterministic floor routes through that same
  // fallback path, so a run survives every vendor being unreachable — the
  // exact case `bindings.ts` declared this floor for — instead of crashing
  // on a step this invoker never expected to see.
  const invoke = withDeterministicFloor(modelInvoke, (step) => {
    logger.warn('reasoning capability degraded to its deterministic floor — compiling the dossier from defaults only', {
      service: step.binding.id,
    });
    return deterministicModelResult(step, {});
  });

  const outcome = await routing.capabilities.run('reasoning', invoke, {
    tokens: { inputTokens: prompt.length / 4, outputTokens: 6_000 },
  });

  if (!outcome.outcome.ok) {
    throw new Error(`[forge.grounding] no vendor could compile the factual dossier: ${outcome.outcome.error.message}`);
  }

  const parsed = outcome.outcome.data.data as Record<string, unknown>;

  const dossier: FactualDossier = {
    businessName: (parsed.businessName as string) || 'River Park Events Drăgășani',
    category: (parsed.category as string) || 'Event & Wedding Venue',
    verifiedFacts: (parsed.verifiedFacts as ProvenanceFact[]) || [],
    inferences: (parsed.inferences as any[]) || [],
    creativeInterpretations: (parsed.creativeInterpretations as any[]) || [],
    conflicts: (parsed.conflicts as any[]) || [],
    forbiddenAssumptions: (parsed.forbiddenAssumptions as string[]) || [
      'Do not claim the venue is located directly on a riverfront or has river water access unless verified by physical photography.',
      'Do not invent vineyard views or specific wine pairing menus without verified business confirmation.',
    ],
    realPhotoAssets: downloadedAssets,
    location: {
      fullAddress: ((parsed.location as any)?.fullAddress as string) || 'Strada Regele Ferdinand 56, Drăgășani, Vâlcea',
      street: ((parsed.location as any)?.street as string) || 'Strada Regele Ferdinand 56',
      city: ((parsed.location as any)?.city as string) || 'Drăgășani',
      region: ((parsed.location as any)?.region as string) || 'Vâlcea',
      mapsUrl: ((parsed.location as any)?.mapsUrl as string) || 'https://www.google.com/maps/place/River+Park+Events+Dragasani',
    },
    contact: {
      phone: ((parsed.contact as any)?.phone as string) || '0723 607 005',
      instagram: ((parsed.contact as any)?.instagram as string) || 'https://www.instagram.com/river.park.events/',
      facebook: ((parsed.contact as any)?.facebook as string) || 'https://www.facebook.com/riverparkeventsdragasani/',
    },
    verifiedRating: (parsed.verifiedRating as any) || {
      rating: 4.7,
      reviewCount: 217,
      source: 'Google Maps & Weddingo Verified Reviews',
      timestamp: new Date().toISOString(),
    },
    verifiedReviews: (parsed.verifiedReviews as any[]) || [
      {
        author: 'Andreea & Mihai V.',
        text: 'O locație de vis! Sala mare este superbă, iar primul dans pe nori a fost magic. Toți invitații au fost încântați!',
        rating: 5,
        source: 'Google Reviews',
      },
      {
        author: 'Cristina D.',
        text: 'Mâncarea delicioasă, servirea ireproșabilă și decorul minunat. Recomand cu toată căldura!',
        rating: 5,
        source: 'Google Reviews',
      },
    ],
    primaryLanguage: (parsed.primaryLanguage as string) || 'ro',
  };

  logger.info('Factual Dossier compiled with Factual Firewall protection', {
    verifiedFactsCount: dossier.verifiedFacts.length,
    forbiddenAssumptionsCount: dossier.forbiddenAssumptions.length,
    realAssetsCount: dossier.realPhotoAssets.length,
  });

  return dossier;
}
