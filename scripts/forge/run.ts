/**
 * CLI Runner for the BusinessForge Experience Vertical Slice.
 *
 * Usage:
 *   npx tsx scripts/forge/run.ts "https://go-sweet.ro"
 *   npm run forge -- "https://go-sweet.ro"
 */

import { runExperienceForge } from '../../lib/forge/orchestrator.js';
import { openInBrowser } from './preview.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const positional = args.find((a) => !a.startsWith('--'));

  const url = positional || 'https://go-sweet.ro';
  const autoOpen = !flags.includes('--no-open');

  const maxIterFlag = flags.find((f) => f.startsWith('--max-iter='));
  const maxIterations = maxIterFlag ? parseInt(maxIterFlag.slice('--max-iter='.length), 10) : 2;

  const result = await runExperienceForge({
    url,
    autoOpen,
    maxIterations,
  });

  if (autoOpen) openInBrowser(result.indexPath);

  process.stdout.write(`\nBUILD SUCCESSFUL!\n`);
  process.stdout.write(`Site index: ${result.indexPath}\n`);
  process.stdout.write(`Final Quality Score: ${result.finalCritique.score}/100\n`);
  process.stdout.write(`Creative Metaphor: ${result.blueprint.signature.creativeMetaphor}\n`);
}

main().catch((err) => {
  process.stderr.write(`\nError executing Experience Forge: ${err.message || err}\n`);
  if (err.stack) process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
