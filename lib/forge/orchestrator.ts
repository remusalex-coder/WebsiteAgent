/**
 * Master Orchestrator for the BusinessForge Experience Signature Pipeline (V1).
 *
 * Full Pipeline:
 * Sourcing / Profile Ingest → Factual Firewall Grounding →
 * Creative Territories (x3) → Signature Selection → Experience Blueprint →
 * Autonomous Frontend Builder → Browser Capture → Anti-AI-Generic Gate →
 * Multi-Modal Vision QA → Autonomous Code Repair Loop → Auto Browser Preview.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ForgeOptions, ForgeResult, FactualDossier } from './types.js';
import type { BusinessProfile } from '../types.js';
import { harvestResearch } from './research.js';
import { buildFactualDossier } from './grounding.js';
import { formulateExperienceSignature } from './signature.js';
import { compileBlueprint } from './blueprint.js';
import { buildFrontend } from './builder.js';
import { auditAntiAIGeneric } from './anti-ai-gate.js';
import { computeForgeVerdict } from './verdict.js';
import { captureSite } from './browser.js';
import { evaluateVision } from './critic.js';
import { repairCode } from './repair.js';
import { loadConfig } from '../config.js';
import { createLogger, createConsoleSink } from '../logger.js';
import { createAIProviderFactory } from '../ai/factory.js';
import { createCapabilityOrchestrator } from '../capability/orchestrator.js';

export async function runExperienceForge(options: ForgeOptions): Promise<ForgeResult> {
  const config = loadConfig();
  const runId = options.runId || `forge-${randomUUID().slice(0, 8)}`;
  const outputDir = options.outputDir || config.outputDir;
  const runDir = path.join(outputDir, runId);
  const forgeDir = path.join(runDir, 'forge');
  const siteDir = path.join(runDir, 'site');

  await fs.mkdir(forgeDir, { recursive: true });
  await fs.mkdir(siteDir, { recursive: true });

  const logger = createLogger({
    level: config.logLevel,
    scope: `forge.${runId}`,
    sink: createConsoleSink(),
  });

  /*
   * The Experience Signature pipeline's two model-backed stages — the
   * creative territories/signature call in signature.ts and the vision
   * critique in critic.ts — route through the same capability planner and
   * executor every other stage in this repository uses, rather than each
   * constructing its own single-vendor provider. One orchestrator for the
   * whole run: cost and quota accumulate across both stages, not per call.
   */
  const providers = createAIProviderFactory({ config: config.ai, logger: logger.child('ai') });
  const capabilities = await createCapabilityOrchestrator({ config, logger: logger.child('capability') });

  logger.info('========================================================================');
  logger.info('BUSINESSFORGE 2.0 — EXPERIENCE SIGNATURE AUTONOMOUS FACTORY');
  logger.info('========================================================================', {
    runId,
    url: options.url,
    hasProfile: Boolean(options.profile),
    order: options.order,
  });

  let factualDossier: FactualDossier;

  // Check if profile is provided directly or exists on disk
  let profile = options.profile;
  if (!profile) {
    try {
      const profilePath = path.join(runDir, '3-profile.json');
      const rawProfile = await fs.readFile(profilePath, 'utf8');
      profile = JSON.parse(rawProfile) as BusinessProfile;
    } catch {
      // no profile on disk
    }
  }

  if (profile) {
    const businessName = typeof profile.name === 'string' ? profile.name : (profile.name?.value || 'Business');
    const websiteUrl = profile.website ? (typeof profile.website === 'string' ? profile.website : profile.website.value) : (options.url || 'https://business.local');
    logger.info('STEP 1: Ingesting existing Business Profile into Factual Firewall...', { name: businessName });
    factualDossier = await buildFactualDossier({
      url: websiteUrl,
      order: options.order,
      rawPages: [
        {
          url: websiteUrl,
          title: businessName,
          text: JSON.stringify(profile, null, 2),
        },
      ],
      downloadedAssets: (((profile as any).photos || (profile as any).images?.gallery || []) as any[]).map((p: any, idx: number) => ({
        id: `asset-${idx + 1}`,
        role: 'gallery' as const,
        url: p.sourceUrl || p.localPath || p.url || '',
        localPath: p.localPath || p.path || '',
        alt: p.caption || p.alt || businessName,
        realDescription: p.caption || p.alt || businessName,
        provenanceSource: p.provenance || 'profile',
      })),
      runDir,
      config,
      logger: logger.child('grounding'),
    });
  } else {
    // Step 1: Raw Evidence Harvesting & Asset Downloader
    const targetUrl = options.url || 'https://go-sweet.ro';
    logger.info('STEP 1: Sourcing & Evidence Harvesting...', { url: targetUrl });
    const research = await harvestResearch({
      url: targetUrl,
      order: options.order,
      runDir,
      config,
      logger: logger.child('research'),
    });
    await fs.writeFile(path.join(forgeDir, '0-research-raw.json'), JSON.stringify(research, null, 2), 'utf8');

    // Step 2: Factual Firewall & Grounding Engine
    logger.info('STEP 2: Factual Firewall & Grounding Analysis...');
    factualDossier = await buildFactualDossier({
      url: targetUrl,
      order: options.order,
      rawPages: [
        {
          url: targetUrl,
          title: research.name,
          text: JSON.stringify(research, null, 2),
        },
      ],
      downloadedAssets: research.assets as any,
      runDir,
      config,
      logger: logger.child('grounding'),
    });
  }

  await fs.writeFile(path.join(forgeDir, '1-factual-dossier.json'), JSON.stringify(factualDossier, null, 2), 'utf8');

  // Step 3: Creative Territories & Experience Signature
  logger.info('STEP 3: Formulating 3 Creative Territories & Experience Signature...');
  const { territories, signature } = await formulateExperienceSignature(
    factualDossier,
    config,
    { capabilities, providers },
    logger.child('signature'),
  );
  await fs.writeFile(path.join(forgeDir, '2-territories.json'), JSON.stringify(territories, null, 2), 'utf8');
  await fs.writeFile(path.join(forgeDir, '3-signature.json'), JSON.stringify(signature, null, 2), 'utf8');

  // Step 4: Compile Experience Blueprint
  logger.info('STEP 4: Compiling Experience Blueprint...');
  const blueprint = compileBlueprint(factualDossier, signature, logger.child('blueprint'));
  await fs.writeFile(path.join(forgeDir, '4-blueprint.json'), JSON.stringify(blueprint, null, 2), 'utf8');

  // Step 5: Autonomous Frontend Code Generation
  logger.info('STEP 5: Coding Bespoke Frontend (HTML, CSS, JS)...');
  let code = await buildFrontend(blueprint, runDir, config, logger.child('builder'));

  // Step 6: Anti-AI-Generic Gate Audit
  logger.info('STEP 6: Anti-AI-Generic Gate & Structural Audit...');
  const antiAiResult = await auditAntiAIGeneric({
    code,
    blueprint,
    outputDir: config.outputDir,
    runId,
    logger: logger.child('anti-ai-gate'),
  });
  await fs.writeFile(path.join(forgeDir, '5-anti-ai-gate.json'), JSON.stringify(antiAiResult, null, 2), 'utf8');

  // Step 7: Playwright Headless Browser Settle & Capture
  logger.info('STEP 7: Rendering in Headless Browser & Capturing High-Res Screenshots...');
  let capture = await captureSite(siteDir, runDir, logger.child('browser'));

  // Step 8: Multi-Modal Vision QA Critic (Awwwards 10 Criteria)
  logger.info('STEP 8: Multi-Modal Vision QA Critic (Human Art Direction Evaluation)...');
  let critique = await evaluateVision({
    desktopShotPath: capture.desktop,
    mobileShotPath: capture.mobile,
    businessName: blueprint.brandName,
    signature: blueprint.signature,
    config,
    capabilities,
    logger: logger.child('critic'),
  });
  await fs.writeFile(path.join(forgeDir, '6-critique-iter0.json'), JSON.stringify(critique, null, 2), 'utf8');

  logger.info('Initial Vision Critique Verdict', {
    score: critique.score,
    verdict: critique.verdict,
    feelsArtDirectedVsAi: critique.feelsArtDirectedVsAi,
    issuesCount: critique.issues.length,
  });

  // Step 9: Autonomous Code Repair Loop (up to maxIterations)
  const maxIterations = options.maxIterations ?? 2;
  let currentIteration = 0;

  while (critique.issues.length > 0 && critique.score < 88 && currentIteration < maxIterations) {
    currentIteration++;
    logger.info(`STEP 9: Autonomous Code Repair Loop (Iteration ${currentIteration}/${maxIterations})...`);

    code = await repairCode({
      siteDir,
      blueprint,
      critique,
      iteration: currentIteration,
      config,
      logger: logger.child('repair'),
    });

    // Re-capture
    capture = await captureSite(siteDir, runDir, logger.child('browser'));

    // Re-evaluate
    critique = await evaluateVision({
      desktopShotPath: capture.desktop,
      mobileShotPath: capture.mobile,
      businessName: blueprint.brandName,
      signature: blueprint.signature,
      config,
      capabilities,
      logger: logger.child('critic'),
    });

    await fs.writeFile(
      path.join(forgeDir, `6-critique-iter${currentIteration}.json`),
      JSON.stringify(critique, null, 2),
      'utf8',
    );

    logger.info(`Iteration ${currentIteration} Verdict`, {
      score: critique.score,
      verdict: critique.verdict,
      remainingIssues: critique.issues.length,
    });
  }

  const indexPath = path.join(siteDir, 'index.html');

  // Step 10: Final combined verdict (structural gate + craft critic, F-06)
  logger.info('STEP 10: Combining structural and craft verdicts into one explainable decision...');
  const finalVerdict = computeForgeVerdict(antiAiResult, critique);
  await fs.writeFile(path.join(forgeDir, '7-final-verdict.json'), JSON.stringify(finalVerdict, null, 2), 'utf8');
  logger.info('Final verdict', {
    verdict: finalVerdict.verdict,
    blockingFailure: finalVerdict.blockingFailure,
    uncertain: finalVerdict.uncertain,
    quality: finalVerdict.quality,
  });

  const result: ForgeResult = {
    runId,
    siteDir,
    indexPath,
    factualDossier,
    territories,
    signature,
    blueprint,
    antiAiGate: antiAiResult,
    iterations: currentIteration,
    finalCritique: critique,
    finalVerdict,
    screenshots: {
      desktop: capture.desktop,
      mobile: capture.mobile,
    },
  };

  await fs.writeFile(path.join(forgeDir, 'result.json'), JSON.stringify(result, null, 2), 'utf8');

  logger.info('========================================================================');
  logger.info('EXPERIENCE SIGNATURE BUILD COMPLETE');
  logger.info('========================================================================');
  logger.info(`Live Site: ${indexPath}`);
  logger.info(`Verdict: ${critique.feelsArtDirectedVsAi} (${critique.score}/100)`);

  return result;
}
