/**
 * Conversion strategy — how the page turns a visitor into an action, decided
 * separately from how it looks.
 *
 * ## Why separate from visual design
 *
 * A page can be beautiful and convert nothing, and the two failures have
 * different causes. Visual design is `personality` + `world` + `layout`;
 * conversion is *what the page asks for, how hard, and when*. A mechanic and an
 * event venue can share a world and still need opposite conversion shapes — the
 * mechanic wants the phone pressed in the first screen, the venue wants a
 * visitor to fall for the room first and enquire at the end. This module owns
 * that second decision, derived from character and evidence, never from the
 * business's name.
 *
 * Deterministic and closed-set. The AI Director may override it later through a
 * validated `conversionStrategy` decision; absent that, this is the floor.
 *
 * ## Factual unknown vs creative freedom (acceptance criterion G)
 *
 * `basis` records which kind of decision this is. `evidence` means the choice is
 * forced by what the business has (a phone number present, a menu section,
 * high-intent functional copy). `creative-default` means the evidence is thin
 * and the system chose an intentional, safe shape rather than inventing a fact —
 * the CTA verb is a design choice, not a claim about the business.
 */

import type { BusinessCharacter } from './character.js';
import type { ExperienceArchitecture } from './experience.js';
import type { BusinessProfile, SectionKind, WebsiteContent } from '../types.js';

/** The verb the primary action uses. A closed set — never free text. */
export type CtaIntent = 'call' | 'book' | 'reserve' | 'order' | 'visit' | 'enquire' | 'quote';

/** The overall conversion posture. */
export type ConversionMode = 'direct' | 'balanced' | 'editorial' | 'high-intent';

export type CtaPlacement = 'hero-and-close' | 'persistent' | 'close-led' | 'sectioned';
export type ContactProminence = 'immediate' | 'prominent' | 'standard' | 'deferred';
export type InformationDensity = 'compact' | 'balanced' | 'spacious';
export type TrustPlacement = 'early' | 'distributed' | 'late';
export type FrictionLevel = 'low' | 'moderate' | 'considered';

export interface ConversionStrategy {
  readonly mode: ConversionMode;
  readonly primaryCta: CtaIntent;
  readonly secondaryCta: CtaIntent | null;
  readonly ctaPlacement: CtaPlacement;
  readonly contactProminence: ContactProminence;
  readonly informationDensity: InformationDensity;
  readonly trustPlacement: TrustPlacement;
  /** The section the strongest push is anchored to, checked against content. */
  readonly conversionMoment: SectionKind;
  readonly frictionLevel: FrictionLevel;
  readonly basis: 'evidence' | 'creative-default';
  readonly rationale: string;
  readonly evidence: readonly string[];
}

/* Weak keyword signals for the action verb — matched against category and
 * service words only, never the business name. Multilingual for the same reason
 * character.ts is. */
const BOOK_WORDS = ['hotel', 'room', 'cazare', 'stay', 'resort', 'accommodation', 'spa', 'booking'];
const RESERVE_WORDS = ['restaurant', 'reservation', 'rezervare', 'table', 'dining', 'bistro', 'trattoria'];
const ORDER_WORDS = ['bakery', 'order', 'comanda', 'comandă', 'cake', 'tort', 'patisserie', 'cofetarie', 'cofetărie', 'boulangerie'];
const APPOINTMENT_WORDS = ['barber', 'salon', 'hair', 'frizerie', 'coafor', 'appointment', 'programare', 'nails', 'beauty'];

function corpusOf(profile: BusinessProfile, content: WebsiteContent): string {
  return [
    profile.category?.value ?? '',
    ...profile.services.map((s) => `${s.name} ${s.description ?? ''}`),
    content.tagline,
  ].join(' ').toLowerCase();
}

function hits(corpus: string, words: readonly string[]): boolean {
  return words.some((w) => corpus.includes(w));
}

/**
 * Plans the conversion strategy.
 *
 * The action verb comes from evidence where the evidence is unambiguous (a
 * phone present for a functional trade → `call`; hotel words → `book`), and
 * from a safe creative default otherwise. The posture (`mode`) comes from
 * character × experience, which is the same signal the visual system reads, so
 * a page's look and its ask stay coherent.
 */
/** A validated Director override for the conversion posture. */
export interface ConversionOverride {
  readonly mode?: ConversionMode | undefined;
}

export function planConversion(
  character: BusinessCharacter,
  experience: ExperienceArchitecture,
  profile: BusinessProfile,
  content: WebsiteContent,
  override?: ConversionOverride,
): ConversionStrategy {
  const corpus = corpusOf(profile, content);
  const hasPhone = profile.phones.length > 0;
  const kinds = new Set(content.sections.map((s) => s.kind));
  const evidence: string[] = [
    `register:${character.emotionalRegister}`,
    `mode:${experience.mode}`,
    `phone:${hasPhone}`,
  ];

  // --- Mode ------------------------------------------------------------
  let mode: ConversionMode =
    character.emotionalRegister === 'functional' ? 'high-intent'
      : experience.mode === 'narrative' ? 'editorial'
        : experience.mode === 'showcase' ? 'balanced'
          : 'direct';
  if (override?.mode !== undefined && override.mode !== mode) {
    evidence.push(`override:mode=${override.mode}`);
    mode = override.mode;
  }

  // --- Primary action --------------------------------------------------
  // Evidence-forced verbs first; a discovery-appropriate default otherwise.
  let primaryCta: CtaIntent;
  let basis: 'evidence' | 'creative-default' = 'evidence';
  if (hits(corpus, BOOK_WORDS)) primaryCta = 'book';
  else if (hits(corpus, RESERVE_WORDS)) primaryCta = 'reserve';
  else if (hits(corpus, ORDER_WORDS)) primaryCta = 'order';
  else if (hits(corpus, APPOINTMENT_WORDS)) primaryCta = 'book';
  else if (character.emotionalRegister === 'functional' && hasPhone) primaryCta = 'call';
  else if (character.emotionalRegister === 'romantic') primaryCta = 'enquire';
  else {
    // Thin evidence: choose an intentional, safe ask rather than invent one.
    primaryCta = hasPhone ? 'call' : 'visit';
    basis = 'creative-default';
  }

  // --- Secondary action ------------------------------------------------
  const secondaryCta: CtaIntent | null =
    mode === 'high-intent' ? null
      : primaryCta !== 'call' && hasPhone ? 'call'
        : primaryCta !== 'visit' && kinds.has('location') ? 'visit'
          : null;

  // --- Placement, prominence, density, friction ------------------------
  const ctaPlacement: CtaPlacement =
    mode === 'high-intent' ? 'persistent'
      : mode === 'editorial' ? 'close-led'
        : 'hero-and-close';

  const contactProminence: ContactProminence =
    mode === 'high-intent' ? 'immediate'
      : character.emotionalRegister === 'romantic' ? 'prominent'
        : mode === 'editorial' ? 'deferred'
          : 'standard';

  const informationDensity: InformationDensity =
    experience.pacing === 'cinematic' ? 'spacious'
      : mode === 'high-intent' ? 'compact'
        : 'balanced';

  const trustPlacement: TrustPlacement =
    mode === 'high-intent' ? 'early'
      : mode === 'editorial' ? 'distributed'
        : 'distributed';

  const frictionLevel: FrictionLevel =
    mode === 'high-intent' ? 'low'
      : mode === 'editorial' ? 'considered'
        : 'moderate';

  // --- Conversion moment ----------------------------------------------
  // Where the strongest push lands: the close for an editorial discovery page,
  // the hero for a high-intent one, otherwise the last practical section.
  const conversionMoment: SectionKind =
    kinds.has('cta') ? 'cta'
      : mode === 'high-intent' && kinds.has('contact') ? 'contact'
        : kinds.has('contact') ? 'contact'
          : 'hero';

  const rationale =
    `${mode} conversion: a ${character.emotionalRegister} ${experience.mode} business `
    + `leads with "${primaryCta}"${secondaryCta ? ` and offers "${secondaryCta}"` : ''}, `
    + `contact ${contactProminence}, friction ${frictionLevel}.`;

  return {
    mode, primaryCta, secondaryCta, ctaPlacement, contactProminence,
    informationDensity, trustPlacement, conversionMoment, frictionLevel,
    basis, rationale, evidence,
  };
}
