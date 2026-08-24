/**
 * P5-4 — Conditional jury: k=1 unless the deterministic spread is under the
 * ±5 margin. Wide spread → zero vision calls.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { decideJury, wantsSecondJudge, JURY_MARGIN_POINTS, QUALITY_FLOOR } from '../../lib/qa/jury.js';

test('wide spread → k=1, zero vision calls', () => {
  const decision = decideJury([88, 70]);
  assert.equal(decision.judgeCount, 1);
  assert.equal(decision.visionCalls, 0);
  assert.equal(decision.spread, 18);
  assert.equal(decision.marginTriggered, false);
});

test('narrow spread → k=2, one vision call', () => {
  const decision = decideJury([84, 81]);
  assert.equal(decision.judgeCount, 2);
  assert.equal(decision.visionCalls, 1);
  assert.equal(decision.spread, 3);
  assert.equal(decision.marginTriggered, true);
});

test('spread exactly at the margin → one judge, no vision call', () => {
  const decision = decideJury([80, 75]);
  assert.equal(decision.spread, JURY_MARGIN_POINTS);
  assert.equal(decision.judgeCount, 1);
  assert.equal(decision.visionCalls, 0);
});

test('best below the quality floor → escalation, no judge spend', () => {
  const decision = decideJury([40, 38]);
  assert.equal(decision.belowFloor, true);
  assert.equal(decision.judgeCount, 1);
  assert.equal(decision.visionCalls, 0);
  assert.match(decision.rationale, /floor/);
});

test('a single candidate never triggers a second judge', () => {
  const decision = decideJury([75]);
  assert.equal(decision.judgeCount, 1);
  assert.equal(decision.visionCalls, 0);
  assert.equal(decision.runnerUpQuality, decision.bestQuality);
});

test('wantsSecondJudge mirrors the decision', () => {
  assert.equal(wantsSecondJudge(decideJury([84, 81])), true);
  assert.equal(wantsSecondJudge(decideJury([88, 70])), false);
});

test('quality floor constant is the frozen 70', () => {
  assert.equal(QUALITY_FLOOR, 70);
});