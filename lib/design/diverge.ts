/**
 * Divergence + diversity gate, pre-spend (Freeze N-17, P5-2, F-09).
 *
 * The battle's budget is the whole point: K candidates diverge *before* any
 * build, *before* any model call. This module enumerates M perturbations of a
 * base directive, filters them against what the business's content can
 * support, and then runs the diversity gate — at most one candidate per L1
 * decision surface proceeds to spend a build.
 *
 * P5-2's acceptance is a call-count test: **zero model calls** through the
 * diversity gate. Nothing here imports a provider; the perturbations are
 * deterministic closed-set rotations, the same technique the reconcept loop
 * already uses, and the gate compares L1 fingerprints.
 */

import { fingerprintDirective, sameDecisionSurface } from './fingerprint.js';
import type { DesignDirective } from './directive.js';
import type { SectionKind } from '../types.js';
import type { ExperienceMode } from './experience.js';
import type { ConversionMode } from './conversion.js';
import type { InteractionLevel } from './interaction.js';

const SOURCE = 'design.diverge';

/** The frozen constant from V2: M = 10 perturbations. */
export const M_PERTURBATIONS = 10;

/** The dimensions a perturbation may rotate. */
export type PerturbationAxis = 'direction' | 'experienceMode' | 'conversion' | 'interaction' | 'moment';

/** One enumerated variation of the base directive. */
export interface Perturbation {
  readonly axis: PerturbationAxis;
  /** 0-based index into the axis's rotation order. */
  readonly step: number;
  readonly directive: DesignDirective;
  /** Whether this perturbation is allowed to build. `false` = pre-filtered. */
  readonly allowed: boolean;
  /** Why it was filtered out, when it was. */
  readonly blocked?: string;
}

const DIRECTIONS = ['minimal', 'luxury', 'corporate', 'elegant', 'modern', 'editorial', 'creative', 'playful', 'bold', 'premium', 'friendly'] as const;
const EXPERIENCE_MODES = ['brochure', 'showcase', 'narrative', 'immersive'] as const;
const CONVERSIONS = ['direct', 'editorial', 'balanced', 'high-intent'] as const;
const INTERACTIONS = ['static', 'subtle', 'guided', 'immersive'] as const;
const MOMENTS: readonly SectionKind[] = ['hero', 'statement', 'about', 'services', 'menu', 'gallery', 'testimonials', 'hours', 'location', 'contact', 'cta', 'faq'];

function rotated<T extends readonly string[]>(set: T, current: string | undefined, step: number): string {
  const index = set.indexOf(current as (typeof set)[number]);
  const base = index === -1 ? 0 : index;
  // Skip the current value: a perturbation must genuinely change the axis.
  const offset = (base + step) % set.length;
  const value = set[offset] ?? set[0]!;
  return value === current && set.length > 1 ? set[(offset + 1) % set.length]! : value;
}

/**
 * Enumerates the M perturbations of a base directive, rotating one axis at a
 * time so each variant is a genuinely different decision surface.
 *
 * Pure, deterministic, no I/O, no model calls. The caller's job is to pass a
 * base directive derived from the business evidence; this module's job is the
 * closed-set enumeration.
 */
export function enumeratePerturbations(base: DesignDirective): Perturbation[] {
  const perturbations: Perturbation[] = [];

  for (let step = 1; step <= M_PERTURBATIONS; step += 1) {
    const axis = AXIS_ORDER[(step - 1) % AXIS_ORDER.length]!;
    const directive: DesignDirective = { ...base };
    const variation: DesignDirective = (() => {
      switch (axis) {
        case 'direction':
          return { ...directive, direction: rotated(DIRECTIONS, base.direction, step) as DesignDirective['direction'] };
        case 'experienceMode':
          return { ...directive, experienceMode: rotated(EXPERIENCE_MODES, base.experienceMode, step) as ExperienceMode };
        case 'conversion':
          return { ...directive, conversionStrategy: rotated(CONVERSIONS, base.conversionStrategy, step) as ConversionMode };
        case 'interaction':
          return { ...directive, interactionStrategy: rotated(INTERACTIONS, base.interactionStrategy, step) as InteractionLevel };
        case 'moment': {
          const index = MOMENTS.indexOf(base.signatureMoment ?? 'hero');
          const next = MOMENTS[(index === -1 ? 0 : index) + step] ?? MOMENTS[(index === -1 ? 0 : index + step) % MOMENTS.length] ?? 'hero';
          return { ...directive, signatureMoment: next };
        }
      }
    })();
    perturbations.push({ axis, step, directive: variation, allowed: true });
  }
  return perturbations;
}

const AXIS_ORDER: readonly PerturbationAxis[] = ['direction', 'experienceMode', 'conversion', 'interaction', 'moment'];

/**
 * Pre-filters a perturbation against what the business's content can support.
 *
 * A signature moment the content does not have is a directive that cannot be
 * honoured — it would build a page emphasising a section that does not exist.
 * `sectionKinds` is the set of `SectionKind` values the business's content
 * actually has. When absent, the moment axis is trusted (the caller did not
 * supply the evidence), matching the advisory contract the directive itself
 * uses.
 */
export function filterByContent(
  perturbations: readonly Perturbation[],
  sectionKinds: readonly SectionKind[] | undefined,
): Perturbation[] {
  if (sectionKinds === undefined || sectionKinds.length === 0) return [...perturbations];
  const supported = new Set(sectionKinds);
  return perturbations.map((p) => {
    const moment = p.directive.signatureMoment ?? p.directive.experienceIntent?.moment ?? null;
    if (moment !== null && !supported.has(moment)) {
      return { ...p, allowed: false, blocked: `content has no ${moment} section` };
    }
    return p;
  });
}

/**
 * The diversity gate: at most one perturbation per L1 decision surface may
 * proceed. This is what keeps the battle's K candidates genuinely different —
 * two perturbations sharing an L1 hash would render into the same page, and
 * building both would be paying twice for one design.
 *
 * Preserves first occurrence order. Zero model calls (P5-2).
 */
export function diversityGate(perturbations: readonly Perturbation[]): Perturbation[] {
  const kept: Perturbation[] = [];
  const seen = new Set<string>();
  for (const p of perturbations) {
    if (!p.allowed) {
      kept.push(p);
      continue;
    }
    const id = fingerprintDirective(p.directive);
    if (seen.has(id)) {
      kept.push({ ...p, allowed: false, blocked: 'shares an L1 decision surface with an earlier perturbation' });
      continue;
    }
    seen.add(id);
    kept.push(p);
  }
  return kept;
}

/**
 * The full pre-spend pipeline: enumerate → filter → gate. Returns the
 * perturbations that are allowed to build, in order. `null` for `sectionKinds`
 * means the caller supplied no content evidence, so the moment axis is trusted.
 */
export function diverge(
  base: DesignDirective,
  sectionKinds: readonly SectionKind[] | undefined,
): Perturbation[] {
  const enumerated = enumeratePerturbations(base);
  const filtered = filterByContent(enumerated, sectionKinds);
  return diversityGate(filtered);
}

/**
 * Whether two candidate directives are genuinely different enough to both
 * build — the L1 test, exported for the battle's K-selection.
 */
export function isDiverseEnough(a: DesignDirective, b: DesignDirective): boolean {
  return !sameDecisionSurface(a, b);
}

export const SOURCE_NAME = SOURCE;