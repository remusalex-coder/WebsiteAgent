/**
 * BusinessForge's control surface (mandate section 16 / WORK_QUEUE.json
 * WQ-014) — first real increment.
 *
 * Prints every run's actual persistent state: current job, current stage,
 * which workers were called and whether they answered, the design-battle
 * outcome, QA phase status, errors, and the final output when delivered.
 * Reads `output/<runId>/job.json` and `output/<runId>/candidates/index.json`
 * directly — the same files the production stages themselves read and
 * write — so this can never show a state the real orchestrator does not
 * also have. No provider is constructed, no network call is made.
 *
 * Usage:
 *   npm run status                    # every discoverable run
 *   npm run status -- --runId=<id>    # one run
 *   npm run status -- --json          # machine-readable (either mode)
 */

import path from 'node:path';

import { discoverJobIds, summarizeRun, type JobSummary } from '../lib/workflow/summary.js';

function outputRoot(): string {
  return process.env.OUTPUT_DIR ?? path.resolve('output');
}

function flagValue(name: string): string | null {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg === undefined ? null : arg.slice(prefix.length);
}

function printSummary(summary: JobSummary): void {
  const battleLine =
    summary.battle === null
      ? 'not reached'
      : `${summary.candidateCount} candidate(s), winner ${summary.battle.winnerId ?? '(none)'}` +
        (summary.battle.bestQuality === null ? '' : `, best quality ${summary.battle.bestQuality.toFixed(1)}`) +
        (summary.battle.judgeCount === null ? '' : `, ${summary.battle.judgeCount} judge(s)`);

  process.stdout.write(`\n${summary.business}  [${summary.jobId}]\n`);
  process.stdout.write(
    `  stage=${summary.stage}  iteration=${summary.iteration}/${summary.maxIter}  decision=${summary.decision}\n`,
  );
  process.stdout.write(
    `  phases: implementation=${summary.phases.implementation}  browser=${summary.phases.browser}  qa=${summary.phases.qa}\n`,
  );
  process.stdout.write(
    `  workers: ${summary.workers.ok} ok / ${summary.workers.failed} failed / ${summary.workers.total} total\n`,
  );
  for (const [provider, tally] of Object.entries(summary.workers.byProvider)) {
    process.stdout.write(`    ${provider}: ${tally.ok} ok, ${tally.failed} failed\n`);
  }
  if (summary.workers.recentFailures.length > 0) {
    process.stdout.write('  recent failures:\n');
    for (const call of summary.workers.recentFailures) {
      process.stdout.write(`    ${call.at}  ${call.stage}/${call.capability} -> ${call.provider ?? '(deterministic)'}\n`);
    }
  }
  process.stdout.write(`  battle: ${battleLine}\n`);
  if (summary.errors.length > 0) {
    process.stdout.write(`  errors (${summary.errors.length}):\n`);
    for (const error of summary.errors) process.stdout.write(`    - ${error}\n`);
  }
  process.stdout.write(
    `  finalOutput: ${summary.finalOutput ?? '(not delivered)'}   updated ${summary.updatedAt}\n`,
  );
}

async function main(): Promise<void> {
  const root = outputRoot();
  const asJson = process.argv.includes('--json');
  const oneRunId = flagValue('runId');

  const ids = oneRunId !== null ? [oneRunId] : await discoverJobIds(root);
  const summaries: JobSummary[] = [];
  for (const id of ids) {
    const summary = await summarizeRun(root, id);
    if (summary !== null) summaries.push(summary);
  }

  if (asJson) {
    process.stdout.write(`${JSON.stringify(summaries, null, 2)}\n`);
    return;
  }

  if (summaries.length === 0) {
    process.stdout.write(
      oneRunId !== null
        ? `No job.json found for run '${oneRunId}' under ${root}.\n`
        : `No runs with a job.json found under ${root}.\n`,
    );
    return;
  }

  process.stdout.write(`BusinessForge — ${summaries.length} run(s) under ${root}\n`);
  for (const summary of summaries) printSummary(summary);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
