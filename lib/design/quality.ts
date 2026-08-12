/**
 * Experience quality gate — a machine-readable score, and a template-smell check.
 *
 * Two different jobs live here, because "is this a good page?" and "is this the
 * same page as every other business's?" are different failures.
 *
 * ## `scoreExperience` — per-site
 *
 * Scores one design on axes that can be read from the artifact deterministically:
 * whether every major decision is explainable from evidence, whether the
 * experience reflects the business's character rather than a default, whether the
 * conversion is clear, whether imagery is used with intent. It is not a taste
 * oracle — it cannot see the rendered pixels — but it catches the structural
 * failures a screenshot hides: a page whose decisions have no evidence, a page
 * that ignored its own character.
 *
 * ## `genericityReport` — across sites
 *
 * The template-smell test. Given several businesses' designs, it measures how
 * many decision axes *collapsed* to a single value across all of them — the same
 * hero, the same gallery structure, the same CTA placement, the same type, the
 * same narrative order. A platform that styles a template fails this; a platform
 * that reads each business passes it. This is the check that would have caught
 * the brochure problem the whole experience system exists to fix.
 */

import type { WebsiteDesign } from './types.js';
import type { BusinessCharacter } from './character.js';
import type { WebsiteContent } from '../types.js';

export interface ExperienceScore {
  /** Each axis 0–1. */
  readonly axes: Readonly<Record<string, number>>;
  /** Weighted overall, 0–100. */
  readonly overall: number;
  /** Human-readable weaknesses. */
  readonly flags: readonly string[];
}

function frac(n: number, d: number): number {
  return d === 0 ? 1 : Math.max(0, Math.min(1, n / d));
}

/** Whether a decision carries a real rationale and at least one evidence item. */
function explained(rationale: string | undefined, evidence: readonly string[] | undefined): boolean {
  return (rationale ?? '').trim().length > 0 && (evidence?.length ?? 0) > 0;
}

/**
 * Scores one design.
 *
 * `character` is passed so `businessSpecificity` can check the design against
 * what the business actually is, not just against itself.
 */
export function scoreExperience(
  design: WebsiteDesign,
  content: WebsiteContent,
  character: BusinessCharacter,
): ExperienceScore {
  const flags: string[] = [];

  // --- Explainability: every major decision cites evidence ---------------
  const decisions = [
    explained(design.personality.rationale, design.personality.evidence),
    explained(design.experience.rationale, design.experience.evidence),
    explained(design.conversion.rationale, design.conversion.evidence),
    explained(design.interaction.rationale, design.interaction.evidence),
    explained(design.assets.rationale, design.assets.evidence),
    (design.layout.rationale ?? '').trim().length > 0,
  ];
  const explainability = frac(decisions.filter(Boolean).length, decisions.length);
  if (explainability < 1) flags.push('Some major decisions lack an evidence trail.');

  // --- Business specificity: did the design track the character? ---------
  let specific = 0; let specificMax = 0;
  const add = (ok: boolean) => { specificMax += 1; if (ok) specific += 1; };
  // image-led businesses must not be brochures
  add(!(character.visualWeight === 'image-led' && design.experience.mode === 'brochure'));
  // functional and craft (trade) businesses should be high-intent, not editorial
  add(!((character.emotionalRegister === 'functional' || character.emotionalRegister === 'craft') && design.conversion.mode === 'editorial'));
  // a narrative must carry a signature moment
  add(!(design.experience.mode === 'narrative' && design.experience.signatureMoment === null));
  // a text-led business should reduce imagery, not force a gallery lead
  add(!(character.visualWeight === 'text-led' && design.experience.galleryLead));
  const businessSpecificity = frac(specific, specificMax);
  if (businessSpecificity < 1) flags.push('A design decision contradicts the business character.');

  // --- Narrative strength ------------------------------------------------
  const narrative =
    design.experience.mode === 'narrative' ? 1
      : design.experience.mode === 'showcase' ? 0.66
        : design.experience.galleryLead ? 0.5
          : character.narrativePotential === 'none' ? 0.6 /* honest brochure is fine */
            : 0.3;

  // --- Conversion clarity ------------------------------------------------
  const conversionClarity = design.conversion.primaryCta && design.conversion.conversionMoment ? 1 : 0.5;

  // --- Asset intent ------------------------------------------------------
  const assetIntent = design.assets.reduceImagery
    ? 1 /* deliberate restraint */
    : design.assets.hero !== null ? 1 : 0.4;
  if (!design.assets.reduceImagery && design.assets.hero === null) {
    flags.push('Page leads with imagery but no hero image was chosen.');
  }

  // --- Accessibility -----------------------------------------------------
  const accessibility = design.accessibility.targetLevel === 'AAA' ? 1 : 0.85;

  // --- Narrative coherence ----------------------------------------------
  const coherenceReport = narrativeCoherence(design, character);
  const coherence = coherenceReport.ok ? 1 : Math.max(0, 1 - coherenceReport.violations.length * 0.34);
  if (!coherenceReport.ok) flags.push(...coherenceReport.violations);

  const axes = { explainability, businessSpecificity, narrative, coherence, conversionClarity, assetIntent, accessibility };
  const weights = { explainability: 0.2, businessSpecificity: 0.25, narrative: 0.15, coherence: 0.15, conversionClarity: 0.1, assetIntent: 0.07, accessibility: 0.08 };
  const overall = Math.round(
    100 * (Object.keys(axes) as (keyof typeof axes)[]).reduce((sum, k) => sum + axes[k] * weights[k], 0),
  );

  return { axes, overall, flags };
}

/* ------------------------------------------------------------------ */
/* Narrative coherence                                                 */
/* ------------------------------------------------------------------ */

export interface CoherenceReport {
  readonly ok: boolean;
  readonly violations: readonly string[];
}

/**
 * Checks that the narrative order tells an honest, well-shaped story.
 *
 * These are the failures a good art director would catch by eye: asking for the
 * sale before the visitor has seen anything, hiding the strongest imagery at the
 * bottom, claiming a signature moment there is no evidence for, or claiming a
 * narrative on a business that has none. A high-intent trade is exempt from the
 * "earn it first" rules — a plumber *should* put the phone up front.
 */
export function narrativeCoherence(
  design: WebsiteDesign,
  character: BusinessCharacter,
): CoherenceReport {
  const v: string[] = [];
  const script = design.experienceScript;
  const beats = script.beats;
  const highIntent = design.conversion.mode === 'high-intent';

  // Conversion before sufficient discovery (unless high-intent).
  if (!highIntent) {
    const before = beats.slice(0, script.conversionAt);
    const discovery = before.filter((b) => !['arrival', 'emotion', 'conversion'].includes(b.role)).length;
    if (script.conversionAt < beats.length && discovery < 2) {
      v.push('Conversion is reached before enough discovery for a non-high-intent business.');
    }
  }

  // Signature absent when the evidence supports one.
  if (character.narrativePotential === 'strong' && design.experience.signatureMoment === null) {
    v.push('Strong signature evidence exists but no signature moment was placed.');
  }
  if (design.experience.signatureMoment !== null && !beats.some((b) => b.isSignature)) {
    v.push('A signature moment was nominated but no beat carries it.');
  }

  // A gallery-led business burying its imagery.
  if (design.experience.galleryLead) {
    const pos = beats.findIndex((b) => b.kind === 'gallery');
    if (pos !== -1 && pos > Math.ceil((beats.length - 1) * 0.66)) {
      v.push('A gallery-led business buries its gallery in the final third of the page.');
    }
  }

  // High-intent business that walks the visitor too far before the ask.
  if (highIntent && script.conversionAt > Math.ceil(beats.length / 2)) {
    v.push('A high-intent business spends too long before its first conversion beat.');
  }

  // A narrative claimed on thin evidence.
  if (design.experience.mode === 'narrative' && character.narrativePotential === 'none') {
    v.push('A narrative arc is claimed for a business whose evidence supports none.');
  }

  return { ok: v.length === 0, violations: v };
}

/* ------------------------------------------------------------------ */
/* Template smell                                                      */
/* ------------------------------------------------------------------ */

export interface GenericityReport {
  /** Axes that took the same value across every business. */
  readonly collapsedAxes: readonly string[];
  /** Distinct-value counts per axis. */
  readonly distinct: Readonly<Record<string, number>>;
  readonly businessCount: number;
  /** `template-smell` when too many axes collapsed; else `diverse`. */
  readonly verdict: 'diverse' | 'template-smell';
  readonly rationale: string;
}

/** The order of section kinds a design renders — its narrative order. */
function narrativeOrder(design: WebsiteDesign): string {
  return design.layout.order
    .map((i) => design.layout.sections.find((s) => s.index === i)?.kind ?? '?')
    .join('>');
}

/** The gallery's structural signature: variant + emphasis + full-bleed. */
function galleryShape(design: WebsiteDesign): string {
  const g = design.layout.sections.find((s) => s.kind === 'gallery');
  return g ? `${g.variant}/${g.emphasis}/${g.fullBleed}` : 'none';
}

/**
 * Measures how template-like a set of designs is.
 *
 * The axes are exactly the failures the master prompt names: same hero, same
 * gallery structure, same CTA placement, same typography, same narrative order,
 * same experience mode. An axis "collapsed" when every business shares its
 * value. Two or more collapses is a template smell — for a diverse set of
 * businesses, the platform should be varying most of these.
 */
export function genericityReport(
  entries: readonly { readonly name: string; readonly design: WebsiteDesign }[],
): GenericityReport {
  const axes: Readonly<Record<string, (d: WebsiteDesign) => string>> = {
    experienceMode: (d) => d.experience.mode,
    hero: (d) => d.layout.hero,
    galleryStructure: galleryShape,
    ctaPlacement: (d) => d.conversion.ctaPlacement,
    typography: (d) => `${d.tokens.typography.heading.family}/${d.tokens.typography.body.family}`,
    narrativeOrder,
    conversionMode: (d) => d.conversion.mode,
    interaction: (d) => d.interaction.level,
    world: (d) => d.world,
  };

  const distinct: Record<string, number> = {};
  const collapsedAxes: string[] = [];
  for (const [name, fn] of Object.entries(axes)) {
    const values = new Set(entries.map((e) => fn(e.design)));
    distinct[name] = values.size;
    if (entries.length > 1 && values.size === 1) collapsedAxes.push(name);
  }

  // Some collapse is fine (six businesses might all be AA); the smell is when
  // the *identity-bearing* axes collapse. Weight those.
  const identityAxes = ['experienceMode', 'hero', 'galleryStructure', 'ctaPlacement', 'typography', 'narrativeOrder'];
  const identityCollapses = collapsedAxes.filter((a) => identityAxes.includes(a)).length;
  const verdict: GenericityReport['verdict'] = identityCollapses >= 2 ? 'template-smell' : 'diverse';

  return {
    collapsedAxes,
    distinct,
    businessCount: entries.length,
    verdict,
    rationale: verdict === 'diverse'
      ? `Diverse: ${identityAxes.length - identityCollapses}/${identityAxes.length} identity axes vary across ${entries.length} businesses.`
      : `Template smell: ${identityCollapses} identity axes collapsed to one value (${collapsedAxes.join(', ')}).`,
  };
}
