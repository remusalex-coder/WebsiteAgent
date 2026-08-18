/**
 * The A/B proof: one real business, the same evidence, the same content —
 * the only thing that differs is whether the Experience Signature engine
 * (this session's "Design Director": `lib/forge/signature.ts`, now routed
 * through `creative_direction`) ran afterward.
 *
 * A = `composeStandalone` alone. Deterministic content + deterministic
 *     `lib/design`/`lib/render` output. Zero model calls.
 * B = the same `composeStandalone` output, then `runExperienceForge`
 *     overlaid on top — real `creative_direction` calls formulate three
 *     territories and select an Experience Signature, a real `craft_judging`
 *     call critiques the result, and the frontend builder writes bespoke
 *     HTML/CSS/JS grounded in that signature.
 *
 * Real business: Ridgeway Motors, an auto repair shop (`output/mechanic`),
 * copied into a fresh run directory so the original is untouched. Chosen
 * specifically because it is NOT River Park Events — the business whose
 * conversion copy was hardcoded into every blueprint before this session's
 * fix to `compileBlueprint` — so this run also proves that fix generalises.
 *
 * Run with: npx tsx scripts/design-director-ab-proof.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { composeStandalone } from '../main.js';
import { loadConfig } from '../lib/config.js';
import { createLogger, createConsoleSink } from '../lib/logger.js';
import { captureScreenshots } from '../lib/workflow/runJob.js';
import { createPlatform } from '../lib/platform/platform.js';
import { analyzeCritiqueViaCapability, runVisualCritic } from '../lib/qa/visual-critic.js';
import { runExperienceForge } from '../lib/forge/orchestrator.js';

import type { VisualCriticInput } from '../lib/qa/visual-critic.js';
import type { CapabilityOrchestrator } from '../lib/capability/orchestrator.js';
import type { AiConfig } from '../lib/config.js';
import type { Logger } from '../lib/logger.js';

/**
 * The same safety net `runJob.ts` puts around every critic call in
 * production: a vendor hiccup (a malformed JSON response, a transient 5xx)
 * degrades to `uncertain` rather than throwing into the caller. Calling
 * `analyzeCritiqueViaCapability` directly, as an earlier version of this
 * script did, crashed mid-proof on exactly this kind of transient failure —
 * which production never does, because `runJob.ts` never calls it unwrapped.
 */
async function critique(
  orchestrator: CapabilityOrchestrator,
  aiConfig: AiConfig,
  logger: Logger,
  input: VisualCriticInput,
) {
  return runVisualCritic({
    input,
    analyze: (i) => analyzeCritiqueViaCapability({ orchestrator, aiConfig, timeoutMs: 60_000, logger }, i),
  });
}

const RUN_ID = 'ab-proof-mechanic';

async function copyDir(src: string, dest: string): Promise<void> {
  await fs.rm(dest, { recursive: true, force: true });
  await fs.cp(src, dest, { recursive: true });
}

async function main(): Promise<void> {
  const config = loadConfig();
  const outputDir = config.outputDir;
  const runDir = path.join(outputDir, RUN_ID);
  const logger = createLogger({ level: 'info', scope: 'ab-proof', sink: createConsoleSink(true) });

  console.log('\n=== A: composeStandalone alone (deterministic, zero model calls) ===\n');
  await composeStandalone(RUN_ID, config);
  await copyDir(path.join(runDir, 'site'), path.join(runDir, 'site-A'));
  const shotsA = await captureScreenshots(runDir, logger.child('capture-A'));
  await copyDir(path.join(runDir, 'shots'), path.join(runDir, 'shots-A'));
  const designA = JSON.parse(await fs.readFile(path.join(runDir, '5b-design.json'), 'utf8'));
  const htmlA = await fs.readFile(path.join(runDir, 'site-A', 'index.html'), 'utf8');
  console.log(`A rendered: ${htmlA.length} bytes, experience mode: ${designA.experience?.mode}, sections: ${designA.layout?.order?.length}`);

  console.log('\n=== B: + Experience Signature engine (real creative_direction + craft_judging calls) ===\n');
  const forgeResult = await runExperienceForge({
    runId: RUN_ID,
    outputDir,
    autoOpen: false,
    maxIterations: 1,
  });
  await copyDir(path.join(runDir, 'site'), path.join(runDir, 'site-B'));
  const shotsB = await captureScreenshots(runDir, logger.child('capture-B'));
  await copyDir(path.join(runDir, 'shots'), path.join(runDir, 'shots-B'));
  const htmlB = await fs.readFile(path.join(runDir, 'site-B', 'index.html'), 'utf8');
  console.log(`B rendered: ${htmlB.length} bytes, territories considered: ${forgeResult.territories.length}, scenes: ${forgeResult.signature.scenes.length}`);
  console.log(`B creative metaphor: "${forgeResult.signature.creativeMetaphor}"`);
  console.log(`B central mechanism: "${forgeResult.signature.centralMechanism}"`);
  console.log(`B conversion action: "${forgeResult.blueprint.conversionStrategy.primaryActionLabel}" (${forgeResult.blueprint.conversionStrategy.primaryActionType})`);

  /* ---------------------------------------------------------------- */
  /* Structural comparison (Phase 7)                                    */
  /* ---------------------------------------------------------------- */

  console.log('\n=== STRUCTURAL COMPARISON ===\n');

  const sectionCountA = (htmlA.match(/<section/g) ?? []).length;
  const sectionCountB = (htmlB.match(/<section/g) ?? []).length;
  const headingsA = [...htmlA.matchAll(/<h[12][^>]*>([^<]{3,80})/g)].map((m) => m[1]?.trim());
  const headingsB = [...htmlB.matchAll(/<h[12][^>]*>([^<]{3,80})/g)].map((m) => m[1]?.trim());

  console.log(`1. STRUCTURE      A: ${sectionCountA} <section> elements  |  B: ${sectionCountB} <section> elements`);
  console.log(`2. COMPOSITION    A: layout order [${designA.layout?.order?.join(',')}] (fixed section-kind grid)`);
  console.log(`                  B: scene sequence [${forgeResult.signature.scenes.map((s) => s.layoutPattern).join(', ')}] (model-authored per business)`);
  console.log(`3. HIERARCHY      A top headings: ${JSON.stringify(headingsA.slice(0, 3))}`);
  console.log(`                  B top headings: ${JSON.stringify(headingsB.slice(0, 3))}`);
  console.log(`4. VISUAL GRAMMAR A: fixed design-token palette from lib/design/themes.ts`);
  console.log(`                  B: ${JSON.stringify(forgeResult.signature.visualGrammar.colorPalette)}`);
  console.log(`5. INTERACTION    A: interaction level "${designA.interaction?.level}" (closed enum, deterministic)`);
  console.log(`                  B selected patterns: ${forgeResult.signature.interactionGrammar.selectedPatterns.join('; ')}`);
  console.log(`                  B rejected patterns: ${forgeResult.signature.interactionGrammar.rejectedPatterns.join('; ')}`);
  console.log(`6. MOTION         A: CSS-only reveal (see lib/experience/runtime.ts)`);
  console.log(`                  B pace/motion: "${forgeResult.signature.interactionGrammar.paceAndMotion}"`);
  console.log(`7. ASSET TREATMENT A hero: ${designA.assets?.hero ?? '(none)'}`);
  console.log(`                  B scenes bind assetIds directly: ${forgeResult.signature.scenes.map((s) => s.assetIds.length).join(',')} per scene`);
  console.log(`8. SIGNATURE MECHANISM A: signature moment "${designA.experience?.signatureMoment ?? 'none'}"`);
  console.log(`                  B central mechanism: "${forgeResult.signature.centralMechanism}"`);
  console.log(`9. ANTI-AI GATE   B structural score: ${forgeResult.antiAiGate.score}/100, passed: ${forgeResult.antiAiGate.passed}`);
  console.log(`                  B flags: ${forgeResult.antiAiGate.flags.map((f) => f.code).join(', ') || '(none)'}`);

  /* ---------------------------------------------------------------- */
  /* Real vision critique, both versions (Phase 8) — reusing the         */
  /* already-connected capability-routed critic, per instruction         */
  /* ---------------------------------------------------------------- */

  console.log('\n=== VISION CRITIC (real, capability-routed, both versions) ===\n');

  const platform = await createPlatform({
    config,
    logger,
    signal: new AbortController().signal,
    outputDir: runDir,
  });

  const critiqueA = await critique(platform.capabilities, config.ai, logger.child('critic-A'), {
    business: 'Ridgeway Motors',
    screenshots: [
      { viewport: 'desktop', path: path.join(runDir, 'shots-A', 'desktop.png') },
      { viewport: 'mobile', path: path.join(runDir, 'shots-A', 'mobile.png') },
    ],
    design: designA,
    character: null,
    creativeDirection: null,
  });
  console.log(`A: genericVerdict=${critiqueA.genericVerdict}  axes: ${critiqueA.axes.map((a) => `${a.axis}=${a.score}`).join(', ')}`);
  if (critiqueA.genericVerdict === 'uncertain') console.log(`  (degraded: ${critiqueA.notes.join('; ')})`);

  const critiqueB = await critique(platform.capabilities, config.ai, logger.child('critic-B'), {
    business: 'Ridgeway Motors',
    screenshots: [
      { viewport: 'desktop', path: path.join(runDir, 'shots-B', 'desktop.png') },
      { viewport: 'mobile', path: path.join(runDir, 'shots-B', 'mobile.png') },
    ],
    design: forgeResult.blueprint.signature,
    character: null,
    creativeDirection: forgeResult.blueprint.signature.creativeMetaphor,
  });
  if (critiqueB.genericVerdict === 'uncertain') console.log(`  (degraded: ${critiqueB.notes.join('; ')})`);
  console.log(`B: genericVerdict=${critiqueB.genericVerdict}  axes: ${critiqueB.axes.map((a) => `${a.axis}=${a.score}`).join(', ')}`);

  console.log(`\nForge's own internal critic verdict (craft_judging-routed, forge's 10-axis schema):`);
  console.log(`  score=${forgeResult.finalCritique.score}/100  verdict=${forgeResult.finalCritique.verdict}  feelsArtDirectedVsAi=${forgeResult.finalCritique.feelsArtDirectedVsAi}`);
  console.log(`  businessSpecificity=${forgeResult.finalCritique.criteriaScores.businessSpecificity}/10  distinctiveness=${forgeResult.finalCritique.criteriaScores.distinctiveness}/10`);

  /* ---------------------------------------------------------------- */
  /* Cost                                                                */
  /* ---------------------------------------------------------------- */

  console.log('\n=== SPEND ===\n');
  const spend = platform.capabilities.spend();
  console.log(`total: ${spend.totalCents} cents; by provider: ${JSON.stringify(spend.byProvider)}`);

  await platform.dispose();

  console.log('\n=== A/B PROOF COMPLETE ===');
  console.log(`A: ${path.join(runDir, 'site-A')}`);
  console.log(`B: ${path.join(runDir, 'site-B')}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
