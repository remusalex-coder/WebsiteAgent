/**
 * Prints this deployment's capability board: every capability BusinessForge
 * can need, what would serve it first, what it would cost, and why every
 * excluded candidate was dropped.
 *
 * Contacts nothing — no provider is constructed, no network call is made.
 * `board()` is pure over configuration, credentials and the on-disk quota
 * ledger, which is what makes it safe to run on every deploy and to persist
 * alongside a run's own artifacts.
 *
 * Usage:
 *   npm run capability-board
 *   npm run capability-board -- --json
 */

import { loadConfig } from '../lib/config.js';
import { createLogger, createConsoleSink } from '../lib/logger.js';
import { createCapabilityOrchestrator } from '../lib/capability/orchestrator.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: config.logLevel, scope: 'capability-board', sink: createConsoleSink() });

  const orchestrator = await createCapabilityOrchestrator({ config, logger });
  const board = orchestrator.board();

  if (process.argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(board, null, 2)}\n`);
    return;
  }

  process.stdout.write(
    `\nCapability board — ${board.available}/${board.total} plannable, credentials present: ${board.credentialsPresent.join(', ') || '(none)'}\n\n`,
  );

  const width = Math.max(...board.rows.map((r) => r.capability.length));
  for (const row of board.rows) {
    const flag = row.available ? '✓' : '✗';
    const primary = row.primaryModel ?? row.primary ?? '(none)';
    process.stdout.write(
      `${flag} ${row.capability.padEnd(width)}  [${row.tier.padEnd(11)}]  chain=${row.chainLength}  ` +
        `first=${primary}${row.estimatedCents > 0 ? ` (~${row.estimatedCents}c)` : ''}\n`,
    );
    if (!row.available) {
      for (const reason of row.exclusions) process.stdout.write(`    - ${reason}\n`);
    }
  }

  process.stdout.write(
    `\nToday's quota usage (${board.quota.day}): ${JSON.stringify(board.quota.used)}\n`,
  );
  process.stdout.write(`Estimated cost of one pass over every available capability: ${board.estimatedCents} cents\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
