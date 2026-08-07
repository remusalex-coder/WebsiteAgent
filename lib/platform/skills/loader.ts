/**
 * Where skills come from.
 *
 * Two sources, one shape. The built-ins are compiled in and always present; a
 * discovery directory is scanned at startup and imported dynamically, so a
 * deployment can drop in a skill without this repository knowing it exists.
 *
 * The loader validates and reports; it does not register. The manager decides
 * what to do with what comes back — which is what lets a bad third-party skill
 * be logged and skipped rather than take the run down at import time.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Logger } from '../../logger.js';
import type { AnySkill } from './types.js';

/** Files treated as skill modules by directory discovery. */
const MODULE_PATTERN = /\.skill\.(?:js|mjs|ts|mts)$/;

export interface LoadedSkill {
  readonly skill: AnySkill;
  /** Where it came from: `builtin` or the module path it was imported from. */
  readonly origin: string;
}

export interface LoadFailure {
  readonly origin: string;
  readonly reason: string;
}

export interface LoadResult {
  readonly loaded: readonly LoadedSkill[];
  /** Modules that could not be imported or exported nothing skill-shaped. */
  readonly failures: readonly LoadFailure[];
}

export interface SkillLoader {
  /** The skills compiled into this build. */
  loadBuiltins(): LoadResult;
  /** Imports one module and extracts whatever skills it exports. */
  loadModule(specifier: string): Promise<LoadResult>;
  /**
   * Scans a directory for `*.skill.ts` / `*.skill.js` and imports each one.
   * A missing directory is not an error — it means no external skills.
   */
  discover(directory: string): Promise<LoadResult>;
}

export interface SkillLoaderOptions {
  readonly logger: Logger;
  /** Injected rather than imported, so the loader can be tested with none. */
  readonly builtins: readonly AnySkill[];
}

export function createSkillLoader(options: SkillLoaderOptions): SkillLoader {
  const { logger } = options;

  const collect = (module: unknown, origin: string): LoadResult => {
    const candidates = extractCandidates(module);
    if (candidates.length === 0) {
      return {
        loaded: [],
        failures: [
          {
            origin,
            reason:
              'exported nothing skill-shaped; export a skill as `default`, `skill`, or an array as `skills`',
          },
        ],
      };
    }

    const loaded: LoadedSkill[] = [];
    const failures: LoadFailure[] = [];
    for (const candidate of candidates) {
      if (isSkillShaped(candidate)) loaded.push({ skill: candidate, origin });
      else failures.push({ origin, reason: 'an export was not a valid skill object' });
    }
    return { loaded, failures };
  };

  const loadModule = async (specifier: string): Promise<LoadResult> => {
    try {
      // Absolute paths must become file URLs, or a Windows drive letter is read
      // as a protocol scheme.
      const url = path.isAbsolute(specifier) ? pathToFileURL(specifier).href : specifier;
      const module: unknown = await import(url);
      return collect(module, specifier);
    } catch (error) {
      return {
        loaded: [],
        failures: [
          { origin: specifier, reason: error instanceof Error ? error.message : String(error) },
        ],
      };
    }
  };

  return {
    loadBuiltins(): LoadResult {
      return {
        loaded: options.builtins.map((skill) => ({ skill, origin: 'builtin' })),
        failures: [],
      };
    },

    loadModule,

    async discover(directory: string): Promise<LoadResult> {
      let entries: string[];
      try {
        entries = await fs.readdir(directory);
      } catch (error) {
        const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
        if (missing) {
          logger.debug('skill discovery directory absent', { directory });
          return { loaded: [], failures: [] };
        }
        return {
          loaded: [],
          failures: [
            { origin: directory, reason: error instanceof Error ? error.message : String(error) },
          ],
        };
      }

      // Sorted so discovery order — and therefore registration order and any
      // "first one wins" behaviour — is the same on every machine.
      const modules = entries.filter((entry) => MODULE_PATTERN.test(entry)).sort();
      logger.debug('skill discovery scanned', { directory, candidates: modules.length });

      const results = await Promise.all(
        modules.map((entry) => loadModule(path.join(directory, entry))),
      );

      return {
        loaded: results.flatMap((result) => result.loaded),
        failures: results.flatMap((result) => result.failures),
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Module shape                                                        */
/* ------------------------------------------------------------------ */

/**
 * Pulls skill candidates out of an imported module.
 *
 * Three conventions are accepted, in order: a `skills` array, a `skill` export,
 * and a default export (which may itself be either). Being liberal here costs a
 * few lines and saves every skill author from looking up which one we chose.
 */
function extractCandidates(module: unknown): readonly unknown[] {
  if (typeof module !== 'object' || module === null) return [];
  const record = module as Record<string, unknown>;

  const out: unknown[] = [];
  const push = (value: unknown): void => {
    if (Array.isArray(value)) out.push(...value);
    else if (value !== undefined && value !== null) out.push(value);
  };

  push(record.skills);
  push(record.skill);
  push(record.default);

  return out;
}

/** Structural check, deliberately loose — the registry does the strict pass. */
function isSkillShaped(value: unknown): value is AnySkill {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AnySkill>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.execute === 'function' &&
    Array.isArray(candidate.dependencies)
  );
}
