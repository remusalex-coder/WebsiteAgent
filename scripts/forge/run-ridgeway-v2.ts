/**
 * Scratch runner — re-runs Ridgeway Motors through the NOW fully
 * capability-routed, asset-strategy-aware, motion-library-plumbed pipeline,
 * reusing the real, already-collected BusinessProfile from
 * output/ab-proof-mechanic/3-profile.json rather than re-scraping. Compares
 * the new run against the archived Ridgeway B result. Delete after use.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { runExperienceForge } from '../../lib/forge/orchestrator.js';

async function main(): Promise<void> {
  const profileRaw = await fs.readFile(path.resolve('output/ab-proof-mechanic/3-profile.json'), 'utf8');
  const profile = JSON.parse(profileRaw);

  const result = await runExperienceForge({
    profile,
    runId: 'ridgeway-v2-arsenal',
    maxIterations: 1,
    autoOpen: false,
  });

  process.stdout.write(`\nBUILD SUCCESSFUL\n`);
  process.stdout.write(`Site index: ${result.indexPath}\n`);
  process.stdout.write(`Final Quality Score: ${result.finalCritique.score}/100\n`);
  process.stdout.write(`Verdict: ${result.finalVerdict.verdict}\n`);
  process.stdout.write(`Anti-AI gate passed: ${result.antiAiGate.passed}\n`);
  process.stdout.write(`Creative Metaphor: ${result.blueprint.signature.creativeMetaphor}\n`);
  process.stdout.write(`Motion intensity: ${result.blueprint.signature.experienceStrategy.motionIntensity}\n`);
  process.stdout.write(`Asset strategy summary: ${result.blueprint.assetStrategy.summary}\n`);
}

main().catch((err) => {
  process.stderr.write(`\nError: ${err.message || err}\n`);
  if (err.stack) process.stderr.write(`${err.stack}\n`);
  process.exit(1);
});
