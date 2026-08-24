/**
 * The layout gate's rules, asserted without a browser.
 *
 * `classifyLayout` is pure over a measurement, which is what makes these
 * thresholds reviewable — the alternative is a number nobody can exercise
 * except by rendering a whole site and squinting at a PNG.
 *
 * The first case is the one that matters: it is a literal transcription of the
 * run that scored 99 and PASSED while rendering nothing below its hero.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { classifyLayout, blockingReasons } from '../../lib/qa/layout-audit.js';

import type { LayoutMeasurement, MeasuredBox, LayoutAudit } from '../../lib/qa/layout-audit.js';

function box(partial: Partial<MeasuredBox> & { top: number; height: number }): MeasuredBox {
  return {
    label: partial.label ?? 'section',
    left: partial.left ?? 0,
    width: partial.width ?? 1440,
    inked: partial.inked ?? true,
    top: partial.top,
    height: partial.height,
  };
}

function measurement(partial: Partial<LayoutMeasurement>): LayoutMeasurement {
  return {
    viewport: 'desktop',
    width: 1440,
    height: 900,
    scrollWidth: 1440,
    scrollHeight: 2000,
    sections: [],
    overflowing: [],
    ink: [],
    ...partial,
  };
}

test('a page that paints nothing below the hero is blocked', () => {
  // The Sibiu bakery run: a 4,534px page whose only ink was the hero.
  const findings = classifyLayout(
    measurement({
      scrollHeight: 4534,
      sections: [box({ label: 'section[emotion]', top: 0, height: 800 })],
      ink: [box({ label: 'h1', top: 100, height: 200 })],
    }),
  );

  const blank = findings.filter((finding) => finding.kind === 'blank-band');
  assert.ok(blank.length > 0, 'expected the empty region to be reported');
  assert.equal(blank[0]?.severity, 'blocking');
  assert.match(blank[0]!.detail, /nothing is painted/);
});

test('a fully painted page is clean', () => {
  const ink: MeasuredBox[] = [];
  for (let top = 0; top < 2700; top += 300) ink.push(box({ label: 'p', top, height: 120 }));

  const findings = classifyLayout(
    measurement({
      scrollHeight: 2700,
      sections: [box({ top: 0, height: 900 }), box({ top: 900, height: 1800 })],
      ink,
    }),
  );

  assert.deepEqual(findings, []);
});

test('horizontal overflow is a blocking responsive failure', () => {
  const findings = classifyLayout(
    measurement({
      viewport: 'mobile',
      width: 390,
      height: 844,
      scrollWidth: 520,
      scrollHeight: 844,
      overflowing: [box({ label: 'div.gallery', left: 0, width: 520, top: 0, height: 300 })],
      ink: [box({ top: 0, height: 800 })],
    }),
  );

  const overflow = findings.find((finding) => finding.kind === 'horizontal-overflow');
  assert.ok(overflow, 'expected the overflow to be reported');
  assert.equal(overflow.severity, 'blocking');
  assert.equal(overflow.viewport, 'mobile');
  assert.match(overflow.detail, /520px wide in a 390px viewport/);
});

test('a two-pixel rounding difference is not an overflow', () => {
  const findings = classifyLayout(
    measurement({ scrollWidth: 1442, scrollHeight: 900, ink: [box({ top: 0, height: 880 })] }),
  );
  assert.equal(findings.filter((finding) => finding.kind === 'horizontal-overflow').length, 0);
});

test('sections landing on top of each other are blocked', () => {
  const findings = classifyLayout(
    measurement({
      scrollHeight: 1600,
      sections: [
        box({ label: 'section[hero]', top: 0, height: 900 }),
        // Starts 400px before the hero ends.
        box({ label: 'section[about]', top: 500, height: 800 }),
      ],
      ink: [box({ top: 0, height: 1500 })],
    }),
  );

  const overlap = findings.find((finding) => finding.kind === 'overlap');
  assert.ok(overlap, 'expected the collision to be reported');
  assert.equal(overlap.severity, 'blocking');
  assert.match(overlap.detail, /section\[hero\] and section\[about\]/);
});

test('a section nested inside another is not a collision', () => {
  const findings = classifyLayout(
    measurement({
      scrollHeight: 1000,
      sections: [
        box({ label: 'section[outer]', top: 0, height: 1000 }),
        box({ label: 'section[inner]', top: 200, height: 300 }),
      ],
      ink: [box({ top: 0, height: 990 })],
    }),
  );
  assert.equal(findings.filter((finding) => finding.kind === 'overlap').length, 0);
});

test('sections that merely share an edge are not a collision', () => {
  const findings = classifyLayout(
    measurement({
      scrollHeight: 1800,
      sections: [box({ top: 0, height: 900 }), box({ top: 900, height: 900 })],
      ink: [box({ top: 0, height: 1790 })],
    }),
  );
  assert.equal(findings.filter((finding) => finding.kind === 'overlap').length, 0);
});

test('a section that rendered to nothing is blocked', () => {
  const findings = classifyLayout(
    measurement({
      scrollHeight: 900,
      sections: [box({ label: 'section[menu]', top: 0, height: 4 })],
      ink: [box({ top: 0, height: 880 })],
    }),
  );

  const collapsed = findings.find((finding) => finding.kind === 'collapsed-section');
  assert.ok(collapsed, 'expected the collapse to be reported');
  assert.equal(collapsed.severity, 'blocking');
  assert.match(collapsed.detail, /collapsed to 4px/);
});

test('content parked past the right edge is a warning, not a block', () => {
  const findings = classifyLayout(
    measurement({
      scrollWidth: 1440,
      scrollHeight: 900,
      overflowing: [box({ label: 'div.marquee', left: 1500, width: 300, top: 0, height: 100 })],
      ink: [box({ top: 0, height: 880 })],
    }),
  );

  const offscreen = findings.find((finding) => finding.kind === 'offscreen-content');
  assert.ok(offscreen, 'expected the offscreen element to be reported');
  assert.equal(offscreen.severity, 'warning');
});

test('blockingReasons names the viewport, so a repair knows which one broke', () => {
  const audit: LayoutAudit = {
    ok: false,
    measurements: [],
    auditedAt: new Date().toISOString(),
    findings: [
      { kind: 'overlap', severity: 'blocking', viewport: 'mobile', detail: 'sections overlap by 400px' },
      { kind: 'offscreen-content', severity: 'warning', viewport: 'desktop', detail: 'one element is offscreen' },
    ],
  };

  const reasons = blockingReasons(audit);
  assert.equal(reasons.length, 1, 'warnings must not reach the gate as blocking reasons');
  assert.equal(reasons[0], 'Layout (mobile): sections overlap by 400px');
});
