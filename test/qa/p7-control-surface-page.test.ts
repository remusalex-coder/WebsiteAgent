/**
 * P7 — static content coverage for `scripts/n8n/controlSurfacePage.ts`.
 *
 * `CONTROL_SURFACE_HTML` is a single inline-browser-JS page (no build step,
 * no framework, no module loader — see that file's own top doc comment), so
 * there is no function to unit-test and nothing here executes the embedded
 * script; these are structural/content assertions on the generated string,
 * the same discipline `test/qa/p7-n8n.test.ts` already uses for the
 * generated n8n workflow JSON.
 *
 * This file did not exist before WQ-023: `CONTROL_SURFACE_HTML` had zero
 * test coverage despite being served live by `stage-server.ts` at `GET /`
 * and `GET /ui`. It covers two things: that the pre-existing STAGE_LABELS/
 * STAGE_ORDER (17/16 entries respectively, one per `JobStage`) are present
 * and unchanged, and that the new ABSTRACT_STAGE_LABELS (WQ-023, additive —
 * one per `AbstractJobState`, `lib/workflow/state.ts`'s `JOB_STATES`) exists
 * with all 12 expected keys and is used only alongside, never instead of,
 * the existing stage line.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONTROL_SURFACE_HTML } from '../../scripts/n8n/controlSurfacePage.js';

const EXISTING_STAGE_LABEL_KEYS = [
  'created', 'research', 'evidence', 'character', 'creative', 'experience', 'diverge',
  'content', 'asset', 'design', 'build', 'browser', 'visual-critic', 'distinctness-gate',
  'hermes', 'delivery', 'human',
];

const ABSTRACT_STAGE_LABEL_KEYS = [
  'created', 'evidence', 'understanding', 'plan', 'diverge', 'candidate_build',
  'verify', 'judge', 'decide', 'delivered', 'escalated', 'aborted',
];

test('the page exists and embeds the client-side script', () => {
  assert.ok(CONTROL_SURFACE_HTML.startsWith('<!doctype html>'));
  assert.ok(CONTROL_SURFACE_HTML.includes('<script>'));
});

test('the pre-existing STAGE_LABELS (one per JobStage) are all still present, unchanged', () => {
  assert.ok(CONTROL_SURFACE_HTML.includes('var STAGE_LABELS = {'));
  for (const key of EXISTING_STAGE_LABEL_KEYS) {
    assert.ok(
      CONTROL_SURFACE_HTML.includes(`${key}:`) || CONTROL_SURFACE_HTML.includes(`'${key}':`),
      `STAGE_LABELS still has a "${key}" entry`,
    );
  }
  // STAGE_ORDER deliberately omits 'human' (a terminal escalation, not a
  // forward-progress step) — 16 of the 17 stage names, in pipeline order.
  assert.ok(CONTROL_SURFACE_HTML.includes(
    "var STAGE_ORDER = ['created','research','evidence','character','creative','experience','diverge',",
  ));
});

test('WQ-023: ABSTRACT_STAGE_LABELS exists with all 12 AbstractJobState keys, additive to STAGE_LABELS', () => {
  assert.ok(CONTROL_SURFACE_HTML.includes('var ABSTRACT_STAGE_LABELS = {'));
  for (const key of ABSTRACT_STAGE_LABEL_KEYS) {
    assert.ok(
      CONTROL_SURFACE_HTML.includes(`${key}:`),
      `ABSTRACT_STAGE_LABELS has a "${key}" entry`,
    );
  }
});

test('WQ-023: the abstract-stage label is rendered alongside the concrete stage label, not in place of it', () => {
  const scriptStart = CONTROL_SURFACE_HTML.indexOf('<script>');
  assert.ok(scriptStart >= 0);
  const script = CONTROL_SURFACE_HTML.slice(scriptStart);
  assert.ok(script.includes('summary.abstractStage'), 'reads the new GET /job field');
  assert.ok(script.includes('STAGE_LABELS[summary.stage]'), 'the concrete stage label is still the primary text');
  assert.ok(
    script.includes("abstractLabel ? ' (' + abstractLabel + ')' : ''"),
    'the abstract label is appended in parentheses, only when present',
  );
});
