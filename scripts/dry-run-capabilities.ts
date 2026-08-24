/**
 * Plan-only capability dry-run.
 *
 *   npx tsx --env-file=.env scripts/dry-run-capabilities.ts --dir output/bakery --tier tier0
 *   npx tsx --env-file=.env scripts/dry-run-capabilities.ts --dir output/bakery --tier tier1
 *
 * Prints, for every capability, what `orchestrator.board()` would select and
 * why — the same question `platform.capabilities.board()` already answers for
 * free, since it plans every capability without constructing a provider or
 * touching the network (`lib/capability/orchestrator.ts`'s own doc comment:
 * "It costs nothing — no provider is constructed, no network is touched").
 *
 * This script adds no planning logic of its own: it is a formatter over
 * `CapabilityBoard`. Run it against a real fixture's output directory so the
 * on-disk quota ledger reflects actual usage, at whichever `--tier` you want
 * to see the routing decision under. Never spends — `board()` cannot.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from '../lib/config.js';
import { createLogger, createConsoleSink } from '../lib/logger.js';
import { createCapabilityOrchestrator } from '../lib/capability/orchestrator.js';
import { resolveBudgetTier, isBudgetTier, BUDGET_TIERS } from '../lib/capability/budget.js';

import type { BoardRow } from '../lib/capability/orchestrator.js';
import type { BudgetTier } from '../lib/capability/budget.js';

function reasonFor(row: BoardRow): string {
  if (!row.available) {
    const first = row.exclusions[0] ?? 'no candidate survived planning';
    return `refused — ${first}`;
  }
  if (row.primary === null) {
    return 'plannable with no chain member selected (unexpected)';
  }
  if (row.estimatedCents === 0) {
    return row.chainLength > 1
      ? 'free — on allowance or zero-cost, ranked ahead of every paid option'
      : 'free — deterministic terminal, nothing else bound';
  }
  return `paid — about ${row.estimatedCents.toFixed(2)} cents, cheapest option this budget allows`;
}

function parseArgs(argv: readonly string[]): { readonly dir: string; readonly tier: BudgetTier } {
  const dirArg = argv.find((a) => a.startsWith('--dir='))?.slice('--dir='.length);
  const tierArg = argv.find((a) => a.startsWith('--tier='))?.slice('--tier='.length);

  if (dirArg === undefined) {
    throw new Error('pass --dir=<path to an existing run output directory>');
  }
  if (tierArg === undefined || !isBudgetTier(tierArg)) {
    throw new Error(`pass --tier=<${BUDGET_TIERS.join('|')}>`);
  }

  return { dir: path.resolve(dirArg), tier: tierArg };
}

async function main(): Promise<void> {
  const { dir, tier } = parseArgs(process.argv.slice(2));
  const logger = createLogger({ level: 'silent', scope: 'dry-run', sink: createConsoleSink(false) });

  const config = loadConfig({ ...process.env, OUTPUT_DIR: path.dirname(dir) });
  const orchestrator = await createCapabilityOrchestrator({
    config,
    logger,
    policy: resolveBudgetTier(tier),
  });

  const board = orchestrator.board();

  process.stdout.write(`\nDry-run — tier=${tier}, ${dir}\n`);
  process.stdout.write(`credentials present: ${board.credentialsPresent.join(', ') || '(none)'}\n\n`);

  for (const row of board.rows) {
    const selected =
      row.primary === null
        ? '(none)'
        : row.primaryModel === null
          ? row.primary
          : `${row.primary} — ${row.primaryModel}`;
    process.stdout.write(
      `Capability: ${row.capability}\n` +
        `  Selected: ${selected}\n` +
        `  Reason:   ${reasonFor(row)}\n\n`,
    );
  }

  process.stdout.write(
    `${board.available}/${board.total} capabilities plannable — ` +
      `${board.estimatedCents.toFixed(2)} cents if every one of them ran once (no call was made)\n`,
  );
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
