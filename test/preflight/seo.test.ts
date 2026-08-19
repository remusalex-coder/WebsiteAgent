import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { seoChecks } from '../../lib/preflight/checks/seo.js';
import { buildContext } from './support.js';

function run(id: string, overrides: Parameters<typeof buildContext>[0] = {}) {
  const ctx = buildContext(overrides);
  const result = seoChecks.map((check) => check(ctx)).find((r) => r.id === id);
  assert.ok(result, `no check registered with id "${id}"`);
  return result;
}

describe('seo.robots-txt', () => {
  it('fails when no robots.txt is rendered', () => {
    assert.equal(run('seo.robots-txt').status, 'FAIL');
  });
});

describe('seo.unique-title (required: missing metadata)', () => {
  it('passes with a reasonable title', () => {
    assert.equal(run('seo.unique-title').status, 'PASS');
  });

  it('fails when seo.title is empty', () => {
    const result = run('seo.unique-title', { content: { title: '   ' } });
    assert.equal(result.status, 'FAIL');
    assert.match(result.evidence.join(' '), /seo\.title is empty/);
  });
});

describe('seo.meta-description (required: missing metadata)', () => {
  it('passes with a description in range', () => {
    assert.equal(run('seo.meta-description').status, 'PASS');
  });

  it('fails when seo.description is empty', () => {
    const result = run('seo.meta-description', { content: { description: '' } });
    assert.equal(result.status, 'FAIL');
  });

  it('warns when the description is far outside the recommended length', () => {
    const result = run('seo.meta-description', { content: { description: 'Too short.' } });
    assert.equal(result.status, 'WARN');
  });
});

describe('seo.social-share-image', () => {
  it('warns when no og:image is emitted', () => {
    const result = run('seo.social-share-image');
    assert.equal(result.status, 'WARN');
  });
});

describe('seo.structured-data (required: business-specific schema groundwork)', () => {
  it('passes when structuredData carries a real @type', () => {
    const result = run('seo.structured-data');
    assert.equal(result.status, 'PASS');
    assert.match(result.evidence.join(' '), /@type is "Bakery"/);
  });

  it('fails when structuredData is empty', () => {
    const result = run('seo.structured-data', { content: { structuredData: {} } });
    assert.equal(result.status, 'FAIL');
  });
});
