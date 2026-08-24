/**
 * Structured-data (JSON-LD) validation gate.
 *
 * `lib/capability/registry.ts`'s `structured_data_validation` entry named its
 * own terminal honestly: `"emit the structured data unvalidated"` — this
 * module is what turns that admitted no-op into a real, if deliberately
 * shallow, check. Non-blocking, same as `gates/performance.ts` (N-13):
 * malformed or thin structured data is a missed enhancement, not a broken
 * page, and `lib/render/document.ts` already warns rather than fails when
 * `seo.structuredData` is empty — this gate extends that same tolerance to
 * "present but incomplete" rather than introducing a new failure mode.
 *
 * Deliberately not a full schema.org/JSON-LD conformance checker (there is
 * no vocabulary of thousands of types to validate against here) — it checks
 * the handful of things a real crawler / rich-results eligibility check
 * actually cares about: a `@context` that names schema.org, a non-empty
 * `@type`, and — for the handful of business-relevant types this pipeline
 * could plausibly emit — the couple of properties Google's own rich-results
 * documentation lists as required for that type to be eligible at all.
 */

const SOURCE = 'qa.gates.structuredData';

export interface StructuredDataResult {
  /** True when nothing exceeds its budget. This gate never hard-fails — see module doc. */
  readonly valid: boolean;
  readonly issues: readonly string[];
}

/**
 * Schema.org types this pipeline plausibly emits, and the properties
 * Google's rich-results documentation treats as required for each — not an
 * exhaustive schema.org vocabulary, just the business-relevant subset. A
 * type not listed here is checked only for the generic rules (§ below), not
 * type-specific required properties — an unlisted type is not an error, it
 * is simply outside this gate's shallow, business-site-scoped knowledge.
 */
const REQUIRED_PROPERTIES_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  LocalBusiness: ['name', 'address'],
  Restaurant: ['name', 'address'],
  Organization: ['name'],
  WebSite: ['name', 'url'],
  PostalAddress: ['streetAddress', 'addressLocality'],
  AggregateRating: ['ratingValue'],
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * A required property counts as present if it carries any real value — a
 * number (including `0`), a boolean (including `false`), a non-blank
 * string, or an object/array. Only `undefined`, `null`, and a blank string
 * count as absent. The original version of this check only accepted
 * strings and objects, which meant a genuinely correct `ratingValue: 4.9`
 * (a number, the schema.org-correct type for it) was flagged as "missing"
 * — caught by running this gate against a real rendered artifact, not by
 * a unit test, since every unit test fixture happened to use string values.
 */
function isPresent(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

/** `@type` is either a single string or an array of strings, per the JSON-LD spec. */
function typesOf(value: unknown): readonly string[] {
  if (isNonEmptyString(value)) return [value];
  if (Array.isArray(value)) return value.filter(isNonEmptyString);
  return [];
}

/**
 * Validates one JSON-LD node — recursing into nested objects that
 * themselves declare a `@type` (e.g. a `LocalBusiness`'s nested `address`),
 * since those are exactly as checkable as the top-level node. `path` is
 * carried through purely for readable issue messages.
 */
function validateNode(node: Record<string, unknown>, path: string, issues: string[]): void {
  const context = node['@context'];
  if (path === '$') {
    if (!isNonEmptyString(context) || !context.toLowerCase().includes('schema.org')) {
      issues.push(`${path}: "@context" is missing or does not reference schema.org`);
    }
  }

  const types = typesOf(node['@type']);
  if (types.length === 0) {
    issues.push(`${path}: "@type" is missing or empty`);
  }

  for (const type of types) {
    const required = REQUIRED_PROPERTIES_BY_TYPE[type];
    if (required === undefined) continue;
    for (const prop of required) {
      if (!isPresent(node[prop])) {
        issues.push(`${path} (${type}): missing required property "${prop}"`);
      }
    }
  }

  // A present key with a blank string is worse than an absent one — it is a
  // field a rich-results consumer will read and reject, not skip.
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@')) continue;
    if (typeof value === 'string' && value.trim() === '') {
      issues.push(`${path}.${key}: present but blank`);
    }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nested = value as Record<string, unknown>;
      if (isNonEmptyString(nested['@type'])) {
        validateNode(nested, `${path}.${key}`, issues);
      }
    }
  }
}

/**
 * Validates a rendered page's JSON-LD. `data` is exactly
 * `WebsiteContent.seo.structuredData` — an empty object is valid (nothing to
 * check; `renderHead` already warns separately when nothing was emitted at
 * all), never itself an issue this gate reports.
 */
export function gateStructuredData(data: Record<string, unknown>): StructuredDataResult {
  if (Object.keys(data).length === 0) return { valid: true, issues: [] };

  const issues: string[] = [];
  validateNode(data, '$', issues);
  return { valid: issues.length === 0, issues };
}

export const SOURCE_NAME = SOURCE;
