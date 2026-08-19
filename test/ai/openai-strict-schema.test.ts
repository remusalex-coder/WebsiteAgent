/**
 * `toStrictSchema` — the OpenAI-only schema normalizer.
 *
 * Found live on the five-business Forge benchmark (2026-08-19): OpenAI's
 * `strict: true` structured-output mode rejects any schema missing
 * `additionalProperties: false` on an object node, and requires every
 * `properties` key to also be listed in `required`. Every schema in this
 * repository was written for Gemini, which imposes neither constraint.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { toStrictSchema } from '../../lib/ai/providers/openai.js';

test('adds additionalProperties:false and required to a flat object schema', () => {
  const schema = {
    type: 'object',
    properties: { a: { type: 'string' }, b: { type: 'number' } },
  };

  const result = toStrictSchema(schema) as Record<string, unknown>;

  assert.equal(result['additionalProperties'], false);
  assert.deepEqual(result['required'], ['a', 'b']);
});

test('a schema that already lists required keeps them, but every key is still required — OpenAI has no optional-field concept', () => {
  const schema = {
    type: 'object',
    required: ['a'],
    properties: { a: { type: 'string' }, b: { type: 'string' } },
  };

  const result = toStrictSchema(schema) as Record<string, unknown>;

  assert.deepEqual(result['required'], ['a', 'b']);
});

test('recurses into nested object properties', () => {
  const schema = {
    type: 'object',
    properties: {
      outer: {
        type: 'object',
        properties: { inner: { type: 'string' } },
      },
    },
  };

  const result = toStrictSchema(schema) as any;

  assert.equal(result.additionalProperties, false);
  assert.equal(result.properties.outer.additionalProperties, false);
  assert.deepEqual(result.properties.outer.required, ['inner']);
});

test('recurses into array items — a scenes[] array of scene objects, as Forge signature.ts actually defines', () => {
  const schema = {
    type: 'object',
    properties: {
      scenes: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, title: { type: 'string' } },
        },
      },
    },
  };

  const result = toStrictSchema(schema) as any;

  assert.equal(result.properties.scenes.items.additionalProperties, false);
  assert.deepEqual(result.properties.scenes.items.required, ['id', 'title']);
});

test('leaves a non-object schema (a bare string/number field) untouched', () => {
  assert.deepEqual(toStrictSchema({ type: 'string' }), { type: 'string' });
});

test('is idempotent — running it twice produces the same result as running it once', () => {
  const schema = { type: 'object', properties: { a: { type: 'string' } } };
  const once = toStrictSchema(schema);
  const twice = toStrictSchema(once);
  assert.deepEqual(once, twice);
});
