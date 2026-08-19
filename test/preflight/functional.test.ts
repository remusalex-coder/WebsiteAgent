import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { functionalChecks } from '../../lib/preflight/checks/functional.js';
import { buildContext, section } from './support.js';

function run(id: string, overrides: Parameters<typeof buildContext>[0] = {}) {
  const ctx = buildContext(overrides);
  const result = functionalChecks.map((check) => check(ctx)).find((r) => r.id === id);
  assert.ok(result, `no check registered with id "${id}"`);
  return result;
}

describe('functional.custom-404', () => {
  it('fails when the renderer emits no 404.html', () => {
    const result = run('functional.custom-404');
    assert.equal(result.status, 'FAIL');
    assert.equal(result.applicability, 'applicable');
    assert.ok(result.remediation);
  });
});

describe('functional.primary-cta', () => {
  it('passes when a section carries a call to action', () => {
    assert.equal(run('functional.primary-cta').status, 'PASS');
  });

  it('fails when no section has a call to action', () => {
    const result = run('functional.primary-cta', {
      content: { sections: [section({ kind: 'hero', heading: 'Hi' }), section({ kind: 'about' })] },
    });
    assert.equal(result.status, 'FAIL');
  });
});

describe('functional.mobile-cta (required: missing mobile CTA when required)', () => {
  it('is not applicable when the business has no published phone number', () => {
    const result = run('functional.mobile-cta', { profile: { phones: [] } });
    assert.equal(result.status, 'NOT_APPLICABLE');
    assert.equal(result.applicability, 'not_applicable');
  });

  it('passes when a tel: CTA is reachable in the hero', () => {
    // The default fixture's hero already links tel:+351210000000.
    assert.equal(run('functional.mobile-cta').status, 'PASS');
  });

  it('fails when a phone number exists but no section links to it', () => {
    const result = run('functional.mobile-cta', {
      content: {
        sections: [
          section({ kind: 'hero', heading: 'Hi', callToAction: null }),
          section({ kind: 'about' }),
        ],
      },
    });
    assert.equal(result.status, 'FAIL');
    assert.match(result.evidence.join(' '), /profile lists a phone number/);
  });

  it('warns when the only tel: CTA sits outside the reachable sections', () => {
    const result = run('functional.mobile-cta', {
      content: {
        sections: [
          section({ kind: 'hero', heading: 'Hi', callToAction: null }),
          section({ kind: 'about' }),
          section({ kind: 'services', heading: 'Services', callToAction: { label: 'Call', href: 'tel:+351210000000' } }),
        ],
      },
    });
    assert.equal(result.status, 'WARN');
  });
});

describe('functional.internal-linking', () => {
  it('is not applicable with fewer than two linkable sections', () => {
    const result = run('functional.internal-linking', {
      content: { sections: [section({ kind: 'hero', heading: 'Hi' })] },
    });
    assert.equal(result.status, 'NOT_APPLICABLE');
  });

  it('is applicable (not NOT_APPLICABLE) once two or more sections are linkable', () => {
    const result = run('functional.internal-linking');
    assert.equal(result.applicability, 'applicable');
    assert.ok(result.status === 'PASS' || result.status === 'WARN');
  });
});

describe('functional.thank-you-state', () => {
  it('is not applicable for a page with no form', () => {
    assert.equal(run('functional.thank-you-state').status, 'NOT_APPLICABLE');
  });
});

describe('functional.breadcrumbs', () => {
  it('is not applicable for the single-document renderer', () => {
    const result = run('functional.breadcrumbs');
    assert.equal(result.status, 'NOT_APPLICABLE');
    assert.equal(result.applicability, 'not_applicable');
  });
});

describe('functional.loading-error-success-states', () => {
  it('is not applicable with no interactive submission control', () => {
    assert.equal(run('functional.loading-error-success-states').status, 'NOT_APPLICABLE');
  });
});

describe('functional.mobile-behavior', () => {
  it('passes given the renderer\'s viewport meta and fluid design tokens', () => {
    assert.equal(run('functional.mobile-behavior').status, 'PASS');
  });
});
