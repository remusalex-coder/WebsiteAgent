/**
 * Declared-but-unimplemented skills.
 *
 * Every built-in ships as one of these. A placeholder is not a stub that
 * pretends to work — it is a reserved id with a settled contract, a category, a
 * declared dependency list and an honest health status. That is what lets the
 * pipeline be written against `skills.get('playwright')` today and have the
 * real implementation dropped in later without an agent changing.
 *
 * Two properties make the honesty enforceable:
 *
 *   - `version` is `0.0.0`, so "unimplemented" is visible on the status board
 *     rather than buried in a description;
 *   - `execute` throws `SkillNotImplementedError`, which the manager reports as
 *     the distinct `not_implemented` code — never as a generic failure, and
 *     never as a plausible empty result.
 *
 * The last part matters most. A placeholder that returned `[]` or `null` would
 * let a caller carry on with nothing and produce output that looks complete.
 */

import { healthReport } from '../types.js';
import { SkillNotImplementedError } from './types.js';

import type { HealthReport } from '../types.js';
import type { AnySkill, SkillCategory } from './types.js';

/** The version every unimplemented skill reports. */
export const PLACEHOLDER_VERSION = '0.0.0';

export interface PlaceholderSpec {
  readonly id: string;
  readonly name: string;
  /** What this capability will do. Written as though it already works. */
  readonly description: string;
  readonly category: SkillCategory;
  /** Ids of other skills the eventual implementation will build on. */
  readonly dependencies?: readonly string[];
  /** Environment variables the eventual implementation will need. */
  readonly requiredCredentials?: readonly string[];
  /** What still has to happen. Surfaced in the error and the health detail. */
  readonly blockedOn: string;
}

export function definePlaceholderSkill(spec: PlaceholderSpec): AnySkill {
  return {
    id: spec.id,
    name: spec.name,
    description: spec.description,
    version: PLACEHOLDER_VERSION,
    category: spec.category,
    dependencies: spec.dependencies ?? [],
    requiredCredentials: spec.requiredCredentials ?? [],

    execute(): Promise<never> {
      throw new SkillNotImplementedError(spec.id, spec.blockedOn);
    },

    health(): Promise<HealthReport> {
      return Promise.resolve(healthReport('unavailable', `placeholder — ${spec.blockedOn}`));
    },
  };
}

/** Applies one category to a batch, so the category is stated once per file. */
export function definePlaceholders(
  category: SkillCategory,
  specs: readonly Omit<PlaceholderSpec, 'category'>[],
): readonly AnySkill[] {
  return specs.map((spec) => definePlaceholderSkill({ ...spec, category }));
}
