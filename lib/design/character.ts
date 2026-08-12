/**
 * Business character — what a business *is like*, derived from its evidence.
 *
 * ## Why this exists
 *
 * The design layer's distinctiveness has always been a function of `industry`.
 * Two event venues, or a hotel and a bar, both classify "atmospheric" and
 * therefore receive the same world, the same ground journey and the same
 * section palette. The category is styled; the business is not. A venue whose
 * evidence includes a dramatic room, two contrasting interiors and a repeatable
 * signature event gets exactly the same experience architecture as a venue with
 * one blurry photograph, because nothing reads the *character* of the evidence —
 * only its category.
 *
 * `BusinessCharacter` is that missing read. It is not taste and it is not a
 * category: it is a small set of axes computed from what the business actually
 * has — how much usable photography, how varied it is, how broad the offering,
 * what emotional register the words carry. `planExperience` (see
 * `experience.ts`) turns these axes into an experience architecture; this file
 * only measures.
 *
 * ## Determinism
 *
 * Pure function of `BusinessProfile` + `WebsiteContent` + the industry's own
 * ground/reliance signals. No clock, no randomness, no model, no I/O. The same
 * evidence always yields the same character, which is what lets the whole layer
 * be unit-tested and diffed.
 */

import type { BusinessProfile, SectionKind, WebsiteContent, ImageAsset } from '../types.js';

/** How much the page's argument rests on photography rather than words. */
export type VisualWeight = 'text-led' | 'balanced' | 'image-led';

/** How expressive the business's own material lets the page be. */
export type Expressiveness = 'restrained' | 'measured' | 'expressive';

/**
 * The emotional register the business's own words and category carry.
 *
 * `craft` sits beside `warm`/`romantic` rather than under `functional`: a
 * workshop whose evidence talks about precision, diagnostics and repair is not
 * emotionally neutral about its work, it simply expresses pride in *skill*
 * rather than in *atmosphere*. Treating that register as indistinguishable
 * from a business with nothing to say at all is what used to cap every trade
 * — a mechanic, an electrician, a locksmith — at a brochure regardless of how
 * much evidence it had, because the word list this file voted on was built
 * entirely from hospitality and event vocabulary.
 */
export type EmotionalRegister = 'functional' | 'warm' | 'romantic' | 'craft';

/** How much the business does — one thing, a focused set, or a broad range. */
export type OfferingBreadth = 'single' | 'focused' | 'broad';

/**
 * Whether the evidence supports a story with a peak, or only a list of facts.
 *
 * `strong` — there is a real sequence to walk and a moment worth building to.
 * `latent` — image-led or has a clear lead section, but not a full arc.
 * `none`   — a functional page; the honest answer for a plumber or a notary.
 */
export type NarrativePotential = 'none' | 'latent' | 'strong';

export interface BusinessCharacter {
  readonly visualWeight: VisualWeight;
  /** Distinct visual "movements" the imagery can sustain in a sequence. */
  readonly atmosphereRange: number;
  /** True when the imagery spans more than one framing *and* has enough of it. */
  readonly multiAtmosphere: boolean;
  readonly expressiveness: Expressiveness;
  readonly emotionalRegister: EmotionalRegister;
  readonly offeringBreadth: OfferingBreadth;
  readonly narrativePotential: NarrativePotential;
  /**
   * The one section a story would be built around, or `null` when none earns it.
   *
   * A kind, checked against the page's actual content downstream — this file
   * names the *candidate*, it does not guarantee the page has it.
   */
  readonly signatureCandidate: SectionKind | null;
  readonly rationale: string;
  readonly evidence: readonly string[];
}

/** The industry signals this analysis needs, passed in so the module stays pure. */
export interface CharacterContext {
  /** From `IndustryDefaults.ground`. */
  readonly ground: 'clean' | 'warm' | 'atmospheric';
  /** From `IndustryDefaults.imageReliance`. */
  readonly imageReliance: 'essential' | 'supporting' | 'incidental';
}

/*
 * Words that argue for an emotional register.
 *
 * Multilingual on purpose: the platform's first real businesses are Romanian,
 * and "nuntă"/"eveniment" carry the same register signal as "wedding"/"event".
 * A weak signal individually — one hit does not decide it — which is why the
 * decision below counts hits and needs a clear margin.
 */
const ROMANTIC_WORDS: readonly string[] = [
  'wedding', 'weddings', 'nunta', 'nunți', 'nunti', 'bride', 'mireasa', 'mireasă',
  'romantic', 'romance', 'celebration', 'celebrări', 'botez', 'botezuri',
  'ceremony', 'ceremonie', 'cununie', 'event', 'eveniment', 'evenimente',
  'luxury', 'boutique', 'bespoke', 'elegant', 'gala', 'anniversary',
];
const WARM_WORDS: readonly string[] = [
  'restaurant', 'bistro', 'cafe', 'café', 'coffee', 'bakery', 'patisserie',
  'kitchen', 'cuisine', 'dining', 'menu', 'meniu', 'hotel', 'spa', 'wellness',
  'artisan', 'handmade', 'craft', 'family', 'familie', 'cozy', 'hospitality',
];
/*
 * Words that argue for a *craft* register: pride in skilled, hands-on work.
 *
 * This is the trade counterpart of `WARM_WORDS` — the vocabulary a workshop,
 * a garage, an electrician or a joiner actually uses about itself, as opposed
 * to the hospitality/event vocabulary the other two lists are built from. No
 * single trade is named here (the design system must not know what a
 * "mechanic" is); the list is generic skilled-work language that applies
 * equally to a dozen trades, the same way `WARM_WORDS` applies equally to a
 * dozen kitchens.
 */
const CRAFT_WORDS: readonly string[] = [
  'workshop', 'garage', 'technician', 'engineer', 'engineering', 'diagnostic',
  'diagnostics', 'precision', 'skilled', 'craftsmanship', 'certified',
  'qualified', 'repair', 'repairs', 'restoration', 'restore', 'maintenance',
  'installation', 'fabrication', 'machinist', 'tradesman', 'apprentice',
  'atelier', 'reparatii', 'reparații', 'tehnician', 'meserie',
];

function countHits(corpus: string, words: readonly string[]): number {
  let n = 0;
  for (const word of words) {
    // Word-boundary-ish: guard against "cafe" matching inside "cafeteria" only
    // loosely — this is a register nudge, not a parser.
    if (corpus.includes(word)) n += 1;
  }
  return n;
}

/** Usable images (photography, not the shell's logo/favicon) with sizes. */
function usableImages(profile: BusinessProfile, content: WebsiteContent): readonly ImageAsset[] {
  const out: ImageAsset[] = [];
  const seen = new Set<string>();
  const push = (img: ImageAsset | null | undefined): void => {
    if (img == null) return;
    if (img.role === 'logo' || img.role === 'favicon') return;
    const key = img.localPath ?? img.url;
    if (key === null || seen.has(key)) return;
    seen.add(key);
    out.push(img);
  };
  push(profile.images.hero);
  profile.images.gallery.forEach(push);
  for (const section of content.sections) section.images.forEach(push);
  return out;
}

/** Distinct framings present: portrait, landscape, square. Diversity is a signal. */
function orientationsOf(images: readonly ImageAsset[]): Set<string> {
  const set = new Set<string>();
  for (const img of images) {
    if (img.width == null || img.height == null || img.width === 0 || img.height === 0) continue;
    const r = img.width / img.height;
    set.add(r > 1.15 ? 'landscape' : r < 0.87 ? 'portrait' : 'square');
  }
  return set;
}

/**
 * Reads a business's character off its evidence.
 *
 * The order is fixed and each axis is independent, so a change to one is a
 * readable diff. Nothing here invents a fact; it measures the facts that are
 * already present, exactly as the color seed reads a hue off real photographs
 * rather than assigning one by category.
 */
export function deriveCharacter(
  profile: BusinessProfile,
  content: WebsiteContent,
  ctx: CharacterContext,
): BusinessCharacter {
  const evidence: string[] = [];

  // --- Visual weight ---------------------------------------------------
  const images = usableImages(profile, content);
  const imageCount = images.length;
  const orientations = orientationsOf(images);
  evidence.push(`images:${imageCount}`, `orientations:${[...orientations].sort().join('+') || 'none'}`, `reliance:${ctx.imageReliance}`);

  const visualWeight: VisualWeight =
    imageCount >= 5 && ctx.imageReliance === 'essential' ? 'image-led'
      : imageCount >= 5 ? 'balanced'
        : imageCount >= 2 ? 'balanced'
          : 'text-led';

  // --- Atmosphere range ------------------------------------------------
  // How many distinct visual movements a sequence could hold: roughly one per
  // two usable photographs, lifted when the framings vary (a portrait detail
  // after a wide room reads as a new beat; two identical wides do not).
  const multiAtmosphere = imageCount >= 4 && orientations.size >= 2;
  const atmosphereRange = Math.min(
    6,
    Math.floor(imageCount / 2) + (orientations.size >= 3 ? 1 : 0),
  );

  // --- Expressiveness --------------------------------------------------
  const expressiveness: Expressiveness =
    ctx.ground === 'atmospheric' ? 'expressive'
      : ctx.ground === 'warm' ? 'measured'
        : 'restrained';
  evidence.push(`ground:${ctx.ground}`);

  /*
   * --- Emotional register ---------------------------------------------
   *
   * Read from the **business's** words, never from the page's.
   *
   * This corpus used to include every section heading, subheading and body on
   * the generated page. That was harmless while the page's prose was only ever
   * a copy of the profile's — and became a feedback loop the moment a Content
   * Director started writing headings: a page would read the adjectives the
   * platform had just written for it and conclude the business was romantic,
   * which would change the experience mode, which would change the copy. A
   * layer must not take its own output as evidence.
   *
   * So the register is now read from the description, the services, the stated
   * attributes and the business's own published pages. All four are research
   * output; none of them is anything the platform wrote. The practical effect
   * is that `deriveCharacter` returns the same character before and after the
   * copy is directed, which `test/content/director.test.ts` asserts.
   */
  const corpus = [
    profile.category?.value ?? '',
    profile.description?.value ?? '',
    content.tagline,
    ...profile.services.map((s) => `${s.name} ${s.description ?? ''}`),
    ...profile.attributes.filter((attribute) => attribute.available).map((attribute) => attribute.label),
    ...profile.pages.map((page) => page.text),
  ].join(' ').toLowerCase();

  const romantic = countHits(corpus, ROMANTIC_WORDS);
  const warm = countHits(corpus, WARM_WORDS);
  const craft = countHits(corpus, CRAFT_WORDS);
  const emotionalRegister: EmotionalRegister =
    craft >= 2 && craft >= warm && craft >= romantic ? 'craft'
      : romantic >= 2 && romantic >= warm ? 'romantic'
        : romantic + warm >= 2 ? 'warm'
          : 'functional';
  evidence.push(`register(romantic:${romantic},warm:${warm},craft:${craft})`);

  // --- Offering breadth ------------------------------------------------
  const serviceCount = profile.services.length;
  const offeringBreadth: OfferingBreadth =
    serviceCount >= 4 ? 'broad' : serviceCount >= 2 ? 'focused' : 'single';
  evidence.push(`services:${serviceCount}`);

  // --- Signature candidate --------------------------------------------
  // The section a story would be built around: the one that would be diminished
  // by equal treatment with every other. Preference is evidence-ranked, not a
  // category default — a gallery only wins when there is real photography to
  // carry it; testimonials only when the rating backs them.
  const kinds = new Set(content.sections.map((s) => s.kind));
  const rating = profile.rating?.value ?? null;
  let signatureCandidate: SectionKind | null = null;
  if (visualWeight === 'image-led' && kinds.has('gallery')) signatureCandidate = 'gallery';
  else if (kinds.has('testimonials') && rating !== null && rating >= 4.5) signatureCandidate = 'testimonials';
  else if (kinds.has('menu') && emotionalRegister !== 'functional') signatureCandidate = 'menu';
  else if (kinds.has('gallery') && imageCount >= 3) signatureCandidate = 'gallery';
  else if (kinds.has('about') && (profile.description?.value?.length ?? 0) >= 180) signatureCandidate = 'about';

  // --- Narrative potential --------------------------------------------
  const narrativePotential: NarrativePotential =
    visualWeight === 'image-led' && multiAtmosphere && emotionalRegister !== 'functional' && signatureCandidate !== null
      ? 'strong'
      : (visualWeight === 'image-led' || signatureCandidate !== null)
        ? 'latent'
        : 'none';

  const rationale =
    `${visualWeight}, ${emotionalRegister} register, ${offeringBreadth} offering; `
    + `${imageCount} usable image${imageCount === 1 ? '' : 's'} across ${orientations.size} framing${orientations.size === 1 ? '' : 's'} `
    + `give ${narrativePotential} narrative potential`
    + (signatureCandidate !== null ? ` around the ${signatureCandidate} section.` : ' with no single lead section.');

  return {
    visualWeight,
    atmosphereRange,
    multiAtmosphere,
    expressiveness,
    emotionalRegister,
    offeringBreadth,
    narrativePotential,
    signatureCandidate,
    rationale,
    evidence,
  };
}
