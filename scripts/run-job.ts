/**
 * CLI entrypoint for the production gate loop.
 *
 *   npx tsx scripts/run-job.ts --run <runId> [--max-iter 3] [--vision]
 *
 * `--vision` reads VISION_API_KEY / VISION_BASE_URL / VISION_MODEL from the
 * environment; without it the visual critic degrades to `uncertain` and the
 * loop converges on the deterministic gate alone.
 */

import { runJob } from '../lib/workflow/runJob.js';
import { loadConfig } from '../lib/config.js';

function flag(name: string, fallback: string): string {
  const flags = process.argv.slice(2);
  const index = flags.indexOf(`--${name}`);
  return index >= 0 && flags[index + 1] !== undefined ? flags[index + 1]! : fallback;
}

const runId = flag('run', '77c15289');
const maxIter = Number(flag('max-iter', '3'));
const useVision = process.argv.includes('--vision');

const config = loadConfig();
const vision = useVision && config.vision.apiKey !== ''
  ? {
      apiKey: config.vision.apiKey,
      baseUrl: config.vision.baseUrl ?? '',
      model: config.vision.model,
    }
  : undefined;

const job = await runJob({
  runId,
  business: runId,
  maxIter,
  ...(vision ? { vision } : {}),
});

const verdict = (job.distinctnessScore as { verdict?: string } | null)?.verdict ?? 'n/a';
process.stdout.write(
  `job=${job.jobId} iteration=${job.iteration} verdict=${verdict} decision=${job.decision} finalOutput=${job.finalOutput ?? '(none)'}\n`,
);
