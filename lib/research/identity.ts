/**
 * Deterministic identifiers for research.
 *
 * Every id in the research layer is derived from content rather than generated,
 * and that single decision is what makes the handoff safe to repeat:
 *
 *   - **Merging is idempotent.** Applying the same delta twice produces the same
 *     artifact, because the second application's claims already exist under the
 *     same ids. A session that cannot remember whether it already filed
 *     Hermes's answer can simply file it again.
 *   - **A claim's identity is its content.** Two passes that independently find
 *     the same value from the same source produce one claim, not two. A pass
 *     that finds a *different* value produces a different claim, which is what
 *     surfaces the change as a conflict instead of silently overwriting.
 *   - **Nothing moves between runs.** No clock, no counter, no random suffix, so
 *     an artifact regenerated from the same inputs is byte-identical — the same
 *     property the renderer and the design composer are built around.
 *
 * A leaf module: `node:crypto` and nothing else.
 */

import { createHash } from 'node:crypto';

/** Length of a derived id, in hex characters. */
const ID_LENGTH = 12;

/**
 * NUL between the joined parts.
 *
 * A separator that cannot occur inside any of the parts, so `field="a"`,
 * `value="b|c"` and `field="a|b"`, `value="c"` cannot hash to the same id.
 */
const SEP = '\u0000';

function digest(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join(SEP)).digest('hex').slice(0, ID_LENGTH);
}

/**
 * The identity of one claim: what it is about, what it says, and who says so.
 *
 * Source ids are sorted before hashing, so the same finding attributed to the
 * same two sources is one claim regardless of the order they were listed in.
 */
export function claimId(
  field: string,
  value: string,
  sourceIds: readonly string[],
): string {
  return `c-${digest([field, value, [...sourceIds].sort().join(',')])}`;
}

/**
 * The identity of one request: the subject and exactly what was asked.
 *
 * Two sessions that independently decide the same evidence is missing produce
 * the same request id and therefore the same filename — so the second one finds
 * the first one's request already open instead of asking Hermes twice. That is
 * the whole duplicate-work guard, and it costs nothing.
 */
export function requestId(
  subjectKey: string,
  query: string,
  fields: readonly string[],
): string {
  return `r-${digest([subjectKey, query.trim(), [...fields].sort().join(',')])}`;
}

/**
 * A business name reduced to an artifact key.
 *
 * Lower-case, alphanumerics and single hyphens, no leading or trailing hyphen —
 * the shape `parseSubject` enforces, so a key built here always validates.
 * Diacritics are folded rather than dropped, because the businesses this project
 * serves are largely not English-speaking and `Café Nord` should not become
 * `caf-nord`.
 */
export function slugify(name: string): string {
  const folded = name
    .normalize('NFKD')
    // Combining marks left behind by the decomposition: `é` is now `e` + U+0301.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const slug = folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug === '' ? 'business' : slug;
}
