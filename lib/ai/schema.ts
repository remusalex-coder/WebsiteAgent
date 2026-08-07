/**
 * Schema plumbing shared by the providers.
 *
 * Three jobs, all in service of one guarantee — the object handed back is the
 * same whichever vendor produced it:
 *
 *   1. translate a JSON Schema into a provider's dialect
 *   2. recover a JSON object from a response that may be wrapped in prose
 *   3. validate that object against the schema locally
 *
 * (3) is what makes the instructed fallback trustworthy. A provider that cannot
 * enforce a schema server-side is still held to it here, so a malformed
 * response fails in this file rather than three stages downstream.
 */

import type { JsonSchema } from './types.js';

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/* ------------------------------------------------------------------ */
/* Gemini dialect                                                      */
/* ------------------------------------------------------------------ */

/**
 * Keys Gemini's `responseSchema` accepts. It takes an OpenAPI 3.0 subset, not
 * JSON Schema — notably it rejects `additionalProperties`, which our schemas
 * set everywhere for the other providers. Anything unlisted is dropped rather
 * than passed through, because an unknown key is a 400 rather than a warning.
 */
const GEMINI_KEYS = new Set([
  'type', 'format', 'description', 'nullable', 'enum', 'items', 'properties', 'required',
  'propertyOrdering', 'minItems', 'maxItems',
]);

/**
 * Rewrites a schema for Gemini.
 *
 * `propertyOrdering` is set from declaration order: Gemini honours it, and a
 * stable key order keeps generated artifacts diffable across runs.
 */
export function toGeminiSchema(schema: JsonSchema): JsonSchema {
  const translate = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(translate);
    if (!isRecord(node)) return node;

    const output: Json = {};
    for (const [key, value] of Object.entries(node)) {
      if (!GEMINI_KEYS.has(key)) continue;

      if (key === 'properties' && isRecord(value)) {
        const properties: Json = {};
        for (const [name, child] of Object.entries(value)) properties[name] = translate(child);
        output.properties = properties;
        output.propertyOrdering = Object.keys(value);
        continue;
      }
      output[key] = translate(value);
    }
    return output;
  };

  return translate(schema) as JsonSchema;
}

/* ------------------------------------------------------------------ */
/* Instructed fallback                                                 */
/* ------------------------------------------------------------------ */

/**
 * The transport-level instruction for providers without native schema support.
 *
 * Appended to the system prompt by the provider, never by the agent — the
 * agent's prompt stays byte-identical across providers, and how a vendor has to
 * be asked for JSON stays a detail of that vendor's adapter.
 */
export function buildSchemaInstruction(schema: JsonSchema): string {
  return [
    'Return your answer as a single JSON object and nothing else. No prose before or after,',
    'no markdown code fences, no trailing commentary.',
    '',
    'The object must validate against this JSON Schema exactly: every property listed in',
    '"required" must be present, no properties outside those declared, and every "enum"',
    'value must be one of the listed options.',
    '',
    JSON.stringify(schema, null, 2),
  ].join('\n');
}

/**
 * Pulls a JSON object out of a model response.
 *
 * Tries the whole string first, then a fenced block, then the first balanced
 * `{…}` run — scanning with string- and escape-awareness so a brace inside a
 * quoted value cannot end the scan early. Deterministic: no model call, no
 * regex backtracking, same input always yields the same output.
 */
export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') throw new Error('the response was empty');

  const candidates = [trimmed];

  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced?.[1] !== undefined) candidates.push(fenced[1].trim());

  const balanced = extractBalancedObject(trimmed);
  if (balanced !== null) candidates.push(balanced);

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`no JSON object could be parsed from the response (${reason})`);
}

/** Returns the first balanced brace-delimited run, ignoring braces inside strings. */
function extractBalancedObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      // Only meaningful inside a string, but harmless outside one.
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Local validation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Checks a parsed value against the subset of JSON Schema our schemas use:
 * object/array/string/number/integer/boolean/null, `required`, `enum`, `items`,
 * and `additionalProperties: false`.
 *
 * Returns every problem rather than throwing on the first, so a bad response
 * produces one actionable error listing what was actually wrong.
 */
export function validateAgainstSchema(value: unknown, schema: JsonSchema, path = '$'): string[] {
  const problems: string[] = [];
  const expected = schema.type;

  if (typeof expected === 'string' && !matchesType(value, expected)) {
    problems.push(`${path}: expected ${expected}, got ${describe(value)}`);
    // Type is wrong, so any nested check would only add noise.
    return problems;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value as never)) {
    problems.push(`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }

  if (expected === 'object' && isRecord(value)) {
    const properties = isRecord(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required) ? (schema.required as string[]) : [];

    for (const key of required) {
      if (value[key] === undefined) problems.push(`${path}.${key}: missing`);
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (properties[key] === undefined) problems.push(`${path}.${key}: not declared in the schema`);
      }
    }
    for (const [key, child] of Object.entries(properties)) {
      if (value[key] === undefined || !isRecord(child)) continue;
      problems.push(...validateAgainstSchema(value[key], child, `${path}.${key}`));
    }
  }

  if (expected === 'array' && Array.isArray(value) && isRecord(schema.items)) {
    value.forEach((item, index) => {
      problems.push(...validateAgainstSchema(item, schema.items as JsonSchema, `${path}[${index}]`));
    });
  }

  return problems;
}

/**
 * Parse then validate, in one step, with one error message.
 *
 * Every provider funnels its raw text through this — including the ones that
 * enforce schemas server-side, where it costs a few microseconds and turns a
 * hypothetical malformed response into a clear error instead of an `undefined`
 * surfacing later. This is the single point where "the object is identical
 * across providers" is actually enforced.
 */
export function decodeAndValidate(text: string, schema: JsonSchema): unknown {
  const data = parseJsonObject(text);

  const problems = validateAgainstSchema(data, schema);
  if (problems.length > 0) {
    const shown = problems.slice(0, 5).join('; ');
    const rest = problems.length > 5 ? ` (+${problems.length - 5} more)` : '';
    throw new Error(`the response did not match the requested schema: ${shown}${rest}`);
  }
  return data;
}

function matchesType(value: unknown, expected: string): boolean {
  switch (expected) {
    case 'object': return isRecord(value);
    case 'array': return Array.isArray(value);
    case 'string': return typeof value === 'string';
    case 'integer': return typeof value === 'number' && Number.isInteger(value);
    case 'number': return typeof value === 'number' && Number.isFinite(value);
    case 'boolean': return typeof value === 'boolean';
    case 'null': return value === null;
    // An unrecognised type constraint is not something to fail a run over.
    default: return true;
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
