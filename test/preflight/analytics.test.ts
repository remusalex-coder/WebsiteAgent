import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { analyticsChecks } from '../../lib/preflight/checks/analytics.js';
import { buildContext } from './support.js';

function runOn(ctx: ReturnType<typeof buildContext>, id: string) {
  const result = analyticsChecks.map((check) => check(ctx)).find((r) => r.id === id);
  assert.ok(result, `no check registered with id "${id}"`);
  return result;
}

describe('analytics.presence', () => {
  it('warns, not fails, when no analytics vendor is present', () => {
    const result = runOn(buildContext(), 'analytics.presence');
    assert.equal(result.status, 'WARN');
    assert.equal(result.applicability, 'applicable');
  });

  it('passes when a consent-safe analytics vendor is present', () => {
    const base = buildContext();
    const ctx = { ...base, html: `<script src="https://plausible.io/js/script.js"></script>${base.html}` };
    assert.equal(runOn(ctx, 'analytics.presence').status, 'PASS');
  });

  it('fails when analytics is present but the consent gap is unresolved', () => {
    const base = buildContext();
    const ctx = { ...base, html: `<script src="https://www.googletagmanager.com/gtag/js"></script>${base.html}` };
    assert.equal(runOn(ctx, 'analytics.presence').status, 'FAIL');
  });
});
