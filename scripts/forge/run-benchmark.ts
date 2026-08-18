/**
 * The five-business Forge benchmark (Phase 5-8 of the anti-AI-gate session).
 *
 * Runs the real production Forge pipeline — signature -> blueprint ->
 * builder -> browser -> critic -> anti-ai gate -> final verdict — against
 * five real, substantially different businesses, using each business's
 * already-collected profile (no re-scraping). Only the business evidence
 * differs between runs; the factory code is identical.
 *
 * Run with: npx tsx scripts/forge/run-benchmark.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from '../../lib/config.js';
import { runExperienceForge } from '../../lib/forge/orchestrator.js';

const BUSINESSES: readonly { readonly slug: string; readonly sourceRunId: string; readonly label: string }[] = [
  { slug: 'bench-dentist', sourceRunId: 'b4ea6038', label: 'Paradise Dental Care (Dentist / healthcare)' },
  { slug: 'bench-bakery', sourceRunId: 'd34873a5', label: 'Tartine Bakery (Bakery / food)' },
  { slug: 'bench-restaurant', sourceRunId: '9d55de50', label: 'Zuni Café (Californian restaurant / hospitality)' },
  { slug: 'bench-lawyer', sourceRunId: '09320bee', label: 'WVBR LLP (Lawyer / professional service)' },
];

async function main(): Promise<void> {
  const config = loadConfig();
  const outputDir = config.outputDir;

  for (const business of BUSINESSES) {
    console.log(`\n${'='.repeat(72)}\n${business.label}\n${'='.repeat(72)}`);

    const runDir = path.join(outputDir, business.slug);
    await fs.mkdir(runDir, { recursive: true });
    await fs.copyFile(
      path.join(outputDir, business.sourceRunId, '3-profile.json'),
      path.join(runDir, '3-profile.json'),
    );

    try {
      const result = await runExperienceForge({
        runId: business.slug,
        outputDir,
        autoOpen: false,
        maxIterations: 1,
      });
      console.log(`OK  ${business.slug}: verdict=${result.finalVerdict.verdict} craft=${result.finalCritique.score} antiAiGate=${result.antiAiGate.passed} structuralConvergence=${result.antiAiGate.structuralConvergence?.verdict}`);
    } catch (error) {
      console.error(`FAIL ${business.slug}:`, error instanceof Error ? error.message : String(error));
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
