/**
 * The narrative plan — derived once, read twice.
 *
 * ## Why this exists
 *
 * `composeDesign` used to derive character, experience, conversion and the
 * narrative order inline. That was fine while content was the *input* to design
 * and nothing else read those decisions. It stopped being fine the moment the
 * Content Director needed them too: the director has to know a beat's narrative
 * role before it can write for it, and the design has to be composed against
 * the words the director produced.
 *
 * Deriving them twice would be worse than duplication — it would be a feedback
 * loop. `deriveCharacter` reads the register of the page's own prose, so a
 * design composed from *directed* content would be reading the platform's own
 * adjectives back as evidence about the business, and a page could talk itself
 * into being romantic. Deriving once and handing the same plan to both closes
 * that: the character is read from the business's evidence, exactly as before,
 * and the copy the system writes can never change it.
 *
 * Pure and deterministic, like everything else in this directory.
 */

import { classifyIndustry, defaultsFor } from './industries.js';
import { deriveCharacter } from './character.js';
import { planExperience } from './experience.js';
import { planConversion } from './conversion.js';
import { planNarrativeOrder } from './script.js';

import type { BusinessCharacter } from './character.js';
import type { ExperienceArchitecture, ExperienceMode } from './experience.js';
import type { ConversionMode, ConversionStrategy } from './conversion.js';
import type { NarrativeRole } from './script.js';
import type { IndustryDefaults } from './industries.js';
import type { Industry, IndustryClassification } from './types.js';
import type { BusinessProfile, WebsiteContent } from '../types.js';

export interface NarrativePlan {
  readonly industry: IndustryClassification;
  readonly defaults: IndustryDefaults;
  readonly character: BusinessCharacter;
  readonly experience: ExperienceArchitecture;
  readonly conversion: ConversionStrategy;
  /** Render order, as indices into `content.sections`. */
  readonly order: readonly number[];
  readonly roles: ReadonlyMap<number, NarrativeRole>;
}

export interface PlanOptions {
  /** Validated Director overrides; the deterministic floor stands without them. */
  readonly experienceMode?: ExperienceMode | undefined;
  readonly conversionMode?: ConversionMode | undefined;
  /** Category words from a strategy, when one was produced. */
  readonly categories?: readonly string[] | undefined;
}

/**
 * Derives the whole narrative plan from evidence.
 *
 * The order is fixed and each step narrows the next: what kind of business this
 * is → what its evidence makes it *like* → what arc that supports → what it
 * should ask for → what order the beats go in.
 */
export function planNarrative(
  profile: BusinessProfile,
  content: WebsiteContent,
  options: PlanOptions = {},
): NarrativePlan {
  const classification = classifyIndustry({
    listingCategory: profile.category?.value ?? null,
    strategyCategories: options.categories ?? (profile.category?.value === undefined ? [] : [profile.category.value]),
    services: profile.services.map((service) => service.name),
    name: profile.name.value,
  });

  const industry: IndustryClassification = {
    id: classification.id,
    basis: classification.basis,
    matchedOn: classification.matchedOn,
    rationale: classification.rationale,
  };

  const defaults = defaultsFor(industry.id as Industry);
  const character = deriveCharacter(profile, content, {
    ground: defaults.ground,
    imageReliance: defaults.imageReliance,
  });
  const experience = planExperience(character, content, { mode: options.experienceMode });
  const conversion = planConversion(character, experience, profile, content, { mode: options.conversionMode });
  const { order, roles } = planNarrativeOrder(content, character, experience, conversion);

  return { industry, defaults, character, experience, conversion, order, roles };
}
