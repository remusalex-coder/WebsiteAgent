/**
 * P7-1 — the whole-job orchestration (`runJobFull`) keeps the loop host-side:
 * the sequence is create → intake → research (per pool member) → synthesize →
 * source → analyze → write → direct → bounded QA loop; `loop: true` from
 * hermes re-enters at browser, otherwise report ends the job.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { runJobFullWith } from '../../scripts/n8n/stage.js';
import type { StageResult } from '../../scripts/n8n/stage.js';

interface Call {
  readonly stage: string;
  readonly runId: string;
  readonly maxIter?: number;
  readonly provider?: string;
  readonly decideOnly?: boolean;
}

function stubRunner(calls: Call[], hermesLoopCount: number): {
  run: (opts: Parameters<typeof runJobFullWith>[1] extends (a: infer A) => unknown ? A : never) => Promise<StageResult>;
} {
  let hermesRuns = 0;
  return {
    run: async (opts) => {
      calls.push({
        stage: opts.stage,
        runId: opts.runId,
        ...(opts.maxIter === undefined ? {} : { maxIter: opts.maxIter }),
        ...(opts.provider === undefined ? {} : { provider: opts.provider }),
        ...(opts.decideOnly === undefined ? {} : { decideOnly: opts.decideOnly }),
      });
      if (opts.stage === 'intake') {
        return { runId: opts.runId, stage: 'intake', loop: false, iteration: 0, decision: null, verdict: null, nextStage: null, finalOutput: null, providers: { used: [], absent: [], pool: ['groq', 'deepseek'] } };
      }
      if (opts.stage === 'hermes') {
        hermesRuns += 1;
        const loop = hermesRuns <= hermesLoopCount;
        return { runId: opts.runId, stage: 'hermes', loop, iteration: hermesRuns - 1, decision: loop ? 'reconcept' : 'deliver', verdict: null, nextStage: loop ? 'builder' : null, finalOutput: loop ? null : '/site', business: 'Mara' };
      }
      if (opts.stage === 'report') {
        return { runId: opts.runId, stage: 'report', loop: false, iteration: 1, decision: 'deliver', verdict: 'PASS', nextStage: null, finalOutput: '/site', business: 'Mara' };
      }
      return { runId: opts.runId, stage: opts.stage, loop: false, iteration: 0, decision: null, verdict: null, nextStage: null, finalOutput: null };
    },
  };
}

test('runJobFull sequences the front half in order and fans out over the pool', async () => {
  const calls: Call[] = [];
  const { run } = stubRunner(calls, 0);
  await runJobFullWith({ runId: 'r1', order: 'build a bakery site', maxIter: 3 }, run);

  const front = calls.slice(0, 10).map((c) => c.stage);
  assert.deepEqual(front, ['create', 'intake', 'research', 'research', 'synthesize', 'source', 'analyze', 'write', 'direct', 'diverge']);
  assert.deepEqual(calls.filter((c) => c.stage === 'research').map((c) => c.provider), ['groq', 'deepseek']);
});

test('a clean hermes decision runs one QA pass, preflights, and reports', async () => {
  const calls: Call[] = [];
  const { run } = stubRunner(calls, 0);
  const result = await runJobFullWith({ runId: 'r1', order: 'o', maxIter: 3 }, run);

  const afterDirect = calls.slice(10);
  // T04: deploy sits after preflight (never publish something the gate just
  // blocked) and before report (the summary should reflect the real deploy
  // outcome).
  assert.deepEqual(afterDirect.map((c) => c.stage), ['browser', 'layout', 'critic', 'gate', 'hermes', 'preflight', 'deploy', 'report']);
  assert.equal(result.stage, 'report');
  assert.equal(result.decision, 'deliver');
});

test('a loop from hermes re-enters at browser, not at build, and preflight runs exactly once at the end', async () => {
  const calls: Call[] = [];
  const { run } = stubRunner(calls, 2);
  await runJobFullWith({ runId: 'r1', order: 'o', maxIter: 3 }, run);

  const loop = calls.slice(10);
  assert.deepEqual(
    loop.map((c) => c.stage),
    [
      'browser', 'layout', 'critic', 'gate', 'hermes', 'repair',
      'browser', 'layout', 'critic', 'gate', 'hermes', 'repair',
      'browser', 'layout', 'critic', 'gate', 'hermes', 'preflight', 'deploy', 'report',
    ],
  );
  // The loop re-enters at browser — never at build, or the reconcept would be thrown away.
  assert.equal(loop[5]!.stage, 'repair');
  assert.equal(loop[6]!.stage, 'browser');
  assert.equal(loop[11]!.stage, 'repair');
  assert.equal(loop[12]!.stage, 'browser');
  // Call-site proof: preflight — Decision Gate §1.J's wiring — runs exactly
  // once, only after hermes stops looping, never on every iteration.
  assert.equal(loop.filter((c) => c.stage === 'preflight').length, 1);
});

test('preflight still runs when hermes escalates — the report must reflect what preflight found either way', async () => {
  const calls: Call[] = [];
  let hermesRuns = 0;
  const run: Parameters<typeof runJobFullWith>[1] = async (opts) => {
    calls.push({ stage: opts.stage, runId: opts.runId });
    if (opts.stage === 'intake') {
      return { runId: opts.runId, stage: 'intake', loop: false, iteration: 0, decision: null, verdict: null, nextStage: null, finalOutput: null, providers: { used: [], absent: [], pool: [] } };
    }
    if (opts.stage === 'hermes') {
      hermesRuns += 1;
      // Escalate immediately — a thin-evidence business, never delivering.
      return { runId: opts.runId, stage: 'hermes', loop: false, iteration: hermesRuns, decision: 'escalate', verdict: null, nextStage: null, finalOutput: null };
    }
    return { runId: opts.runId, stage: opts.stage, loop: false, iteration: 0, decision: null, verdict: null, nextStage: null, finalOutput: null };
  };
  await runJobFullWith({ runId: 'r1', order: 'o', maxIter: 3 }, run);
  const stages = calls.map((c) => c.stage);
  assert.ok(stages.includes('preflight'), 'preflight ran even though hermes escalated');
  assert.ok(stages.indexOf('preflight') > stages.indexOf('hermes'));
  assert.ok(stages.indexOf('preflight') < stages.indexOf('report'));
});

test('hermes is always called decideOnly so repair is a visible separate stage', async () => {
  const calls: Call[] = [];
  const { run } = stubRunner(calls, 0);
  await runJobFullWith({ runId: 'r1', order: 'o', maxIter: 3 }, run);
  const hermesCall = calls.find((c) => c.stage === 'hermes');
  assert.equal(hermesCall?.decideOnly, true);
});

test('runJobFull passes a bounded maxIter into every stage', async () => {
  const calls: Call[] = [];
  const { run } = stubRunner(calls, 0);
  await runJobFullWith({ runId: 'r1', order: 'o', maxIter: 5 }, run);
  const maxIters = new Set(calls.map((c) => c.maxIter as number));
  assert.deepEqual([...maxIters], [5]);
});