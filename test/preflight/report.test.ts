/**
 * End-to-end report assembly: the full battery run through
 * `runProductionPreflight`, and the production gate it computes.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CHECK_CATEGORIES } from '../../lib/preflight/types.js';
import { buildReport, section } from './support.js';

describe('runProductionPreflight — report shape', () => {
  it('returns a structured result for every check, covering every category', async () => {
    const report = await buildReport();
    assert.ok(report.results.length > 30, 'expected a substantial check battery');

    for (const result of report.results) {
      assert.equal(typeof result.id, 'string');
      assert.ok(CHECK_CATEGORIES.includes(result.category), `unknown category "${result.category}"`);
      assert.ok(['applicable', 'not_applicable'].includes(result.applicability));
      assert.ok(['PASS', 'FAIL', 'WARN', 'NOT_APPLICABLE', 'BLOCKED'].includes(result.status));
      assert.ok(['critical', 'high', 'medium', 'low', 'info'].includes(result.severity));
      assert.ok(Array.isArray(result.evidence) && result.evidence.length > 0, `${result.id} has no evidence`);
      assert.equal(
        result.status === 'FAIL' || result.status === 'WARN' || result.status === 'BLOCKED',
        result.remediation !== null,
        `${result.id}: remediation presence should match a non-passing status`,
      );
      assert.equal(
        result.applicability === 'not_applicable',
        result.status === 'NOT_APPLICABLE',
        `${result.id}: NOT_APPLICABLE and not_applicable should always agree`,
      );
    }
  });

  it('tallies every result exactly once, in the summary and by category', async () => {
    const report = await buildReport();
    const bySummary = report.summary.pass + report.summary.fail + report.summary.warn + report.summary.notApplicable + report.summary.blocked;
    assert.equal(bySummary, report.results.length);
    assert.equal(report.summary.total, report.results.length);

    const byCategoryTotal = Object.values(report.summary.byCategory).reduce(
      (sum, tally) => sum + tally.pass + tally.fail + tally.warn + tally.notApplicable + tally.blocked,
      0,
    );
    assert.equal(byCategoryTotal, report.results.length);
  });

  it('applies to a thin, minimal business: most business-specific checks land on NOT_APPLICABLE, not a false PASS', async () => {
    const report = await buildReport({
      profile: { address: null, phones: [], category: null },
      content: {
        sections: [section({ kind: 'hero', heading: 'Corner Shop' })],
      },
    });
    const businessResults = report.results.filter((r) => r.category === 'business-specific');
    const applicable = businessResults.filter((r) => r.applicability === 'applicable');
    // With no address, no phone, and a single bare section, almost everything
    // business-specific genuinely does not apply — this is the behaviour under
    // test, not an incidental fact about the fixture.
    assert.ok(applicable.length <= 2, `expected almost every business-specific check to be N/A, got ${applicable.length} applicable: ${applicable.map((r) => r.id).join(', ')}`);
  });
});

describe('production gate (required: critical production blockers)', () => {
  it('does not block a clean, well-formed run', async () => {
    const report = await buildReport();
    assert.equal(report.productionGate.blocksProduction, false);
    assert.deepEqual(report.productionGate.blockingChecks, []);
  });

  it('blocks production on a critical security failure (an embedded secret)', async () => {
    const report = await buildReport({
      content: {
        sections: [section({ kind: 'about', heading: 'About', body: 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789' })],
      },
    });
    assert.equal(report.productionGate.blocksProduction, true);
    assert.ok(report.productionGate.blockingChecks.some((c) => c.id === 'security.no-embedded-secrets'));
  });

  it('blocks production on fabricated reviews, the one non-security critical rule', async () => {
    const report = await buildReport({
      content: {
        sections: [
          section({ kind: 'hero', heading: 'Hi' }),
          section({ kind: 'testimonials', heading: 'Reviews', bullets: ['"Absolutely life-changing, ten stars." — a fan'] }),
        ],
      },
    });
    assert.equal(report.productionGate.blocksProduction, true);
    assert.ok(report.productionGate.blockingChecks.some((c) => c.id === 'business.real-reviews'));
  });

  it('never treats a BLOCKED status (e.g. HTTPS pending deployment) as a production blocker', async () => {
    const report = await buildReport();
    const https = report.results.find((r) => r.id === 'security.https');
    assert.equal(https?.status, 'BLOCKED');
    assert.ok(!report.productionGate.blockingChecks.some((c) => c.id === 'security.https'));
  });

  it('a WARN never blocks production, only a critical FAIL does', async () => {
    const report = await buildReport();
    const warnings = report.results.filter((r) => r.status === 'WARN');
    for (const warning of warnings) {
      assert.ok(!report.productionGate.blockingChecks.some((c) => c.id === warning.id));
    }
  });
});

describe('scan skipped (no outputDir)', () => {
  it('reports the git/secrets check as BLOCKED rather than guessing clean', async () => {
    const report = await buildReport({}, null);
    const result = report.results.find((r) => r.id === 'security.no-secrets-in-git');
    assert.equal(result?.status, 'BLOCKED');
  });
});
