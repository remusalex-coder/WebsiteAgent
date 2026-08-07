/**
 * The skill registry.
 *
 * A validated map from id to implementation, and nothing more — no execution,
 * no lifecycle, no telemetry. Those live in the manager, which is what makes
 * this testable in three lines and what keeps "is this skill known?" separate
 * from "did this skill work?".
 *
 * Validation happens at `register`, not at call time: a malformed descriptor,
 * a duplicate id, or a dependency cycle is a wiring mistake, and a wiring
 * mistake should fail at startup rather than an hour into a run.
 */

import { InvalidInputError } from '../../errors.js';

import type { AnySkill, SkillCategory, SkillDescriptor } from './types.js';
import { describeSkill } from './types.js';

const SOURCE = 'skills.registry';

/** Lower-case letters, digits and single hyphens. Ids appear in config and logs. */
const ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export interface SkillRegistry {
  /**
   * Adds a skill. Rejects a duplicate id rather than overwriting: silently
   * replacing a skill is how two subsystems end up disagreeing about what
   * `pdf` means.
   */
  register(skill: AnySkill): void;
  /** Adds a skill, replacing any existing one with the same id. */
  replace(skill: AnySkill): void;
  /** Removes a skill. Returns false when nothing was registered under that id. */
  unregister(id: string): boolean;
  get(id: string): AnySkill | null;
  has(id: string): boolean;
  /** Registration order, which is also disposal order reversed. */
  list(): readonly AnySkill[];
  listByCategory(category: SkillCategory): readonly AnySkill[];
  describe(enabled: (id: string) => boolean): readonly SkillDescriptor[];
  /**
   * Dependency ids named by registered skills that nothing provides. Empty in a
   * correctly wired build; checked once after loading rather than per call.
   */
  missingDependencies(): readonly { readonly skill: string; readonly missing: string }[];
  readonly size: number;
}

export function createSkillRegistry(): SkillRegistry {
  // Insertion-ordered by construction, which `dispose` relies on.
  const skills = new Map<string, AnySkill>();

  const add = (skill: AnySkill, allowReplace: boolean): void => {
    validate(skill);
    if (!allowReplace && skills.has(skill.id)) {
      throw new InvalidInputError(
        `A skill is already registered as "${skill.id}". Use replace() to override it deliberately.`,
        SOURCE,
      );
    }
    // Rebuild the entry so replacement keeps the newcomer's position rather
    // than inheriting the old one's.
    skills.delete(skill.id);
    skills.set(skill.id, skill);
    assertNoCycle(skills, skill.id);
  };

  return {
    register: (skill) => add(skill, false),
    replace: (skill) => add(skill, true),

    unregister(id: string): boolean {
      return skills.delete(id);
    },

    get(id: string): AnySkill | null {
      return skills.get(id) ?? null;
    },

    has(id: string): boolean {
      return skills.has(id);
    },

    list(): readonly AnySkill[] {
      return [...skills.values()];
    },

    listByCategory(category: SkillCategory): readonly AnySkill[] {
      return [...skills.values()].filter((skill) => skill.category === category);
    },

    describe(enabled: (id: string) => boolean): readonly SkillDescriptor[] {
      return [...skills.values()].map((skill) => describeSkill(skill, enabled(skill.id)));
    },

    missingDependencies(): readonly { readonly skill: string; readonly missing: string }[] {
      const problems: { skill: string; missing: string }[] = [];
      for (const skill of skills.values()) {
        for (const dependency of skill.dependencies) {
          if (!skills.has(dependency)) problems.push({ skill: skill.id, missing: dependency });
        }
      }
      return problems;
    },

    get size(): number {
      return skills.size;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function validate(skill: AnySkill): void {
  const reject = (reason: string): never => {
    throw new InvalidInputError(`Invalid skill "${skill.id ?? '(no id)'}": ${reason}`, SOURCE);
  };

  if (typeof skill.id !== 'string' || !ID_PATTERN.test(skill.id)) {
    reject('id must be kebab-case, e.g. "vector-store"');
  }
  if (typeof skill.name !== 'string' || skill.name.trim() === '') reject('name is required');
  if (typeof skill.description !== 'string' || skill.description.trim() === '') {
    reject('description is required');
  }
  if (typeof skill.version !== 'string' || skill.version.trim() === '') {
    reject('version is required');
  }
  if (!Array.isArray(skill.dependencies)) reject('dependencies must be an array of skill ids');
  if (skill.dependencies.includes(skill.id)) reject('a skill cannot depend on itself');
  if (typeof skill.execute !== 'function') reject('execute() is required');
}

/**
 * Walks the dependency graph from one skill, looking for a way back to itself.
 *
 * Run on every registration rather than once at the end: the offending
 * `register` call is the one worth naming in the error, and by the time the
 * whole set is loaded that information is gone. Unknown dependencies are
 * skipped here — order of registration should not matter, and a genuinely
 * missing one is reported by `missingDependencies`.
 */
function assertNoCycle(skills: ReadonlyMap<string, AnySkill>, startId: string): void {
  const seen = new Set<string>();

  const walk = (id: string, trail: readonly string[]): void => {
    if (trail.includes(id)) {
      throw new InvalidInputError(
        `Skill dependency cycle: ${[...trail, id].join(' -> ')}`,
        SOURCE,
      );
    }
    if (seen.has(id)) return;
    seen.add(id);

    const skill = skills.get(id);
    if (skill === undefined) return;
    for (const dependency of skill.dependencies) walk(dependency, [...trail, id]);
  };

  walk(startId, []);
}
