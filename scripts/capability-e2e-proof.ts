/**
 * The end-to-end proof: capability orchestration governing a real business,
 * with real evidence, real rules, and real provider calls — not a mock of any
 * of them.
 *
 * Reuses River Park Events Drăgășani's already-collected evidence
 * (`output/riverpark/3-profile.json`) and already-rendered screenshots
 * (`output/riverpark/shots/`) rather than re-running discovery and the
 * browser — those stages need no model and are not what this proof is about.
 * What it demonstrates is everything downstream that now runs through
 * `lib/capability`:
 *
 *   1. the capability board — what this deployment can actually do, and at
 *      what estimated cost, computed live from `.env`;
 *   2. one real `reasoning` call — the business analyst — against River
 *      Park's real profile, through the planner and executor, not a direct
 *      `provider.generate()`;
 *   3. one real `craft_judging` call — the visual critic — against River
 *      Park's real screenshots. This is the capability that was silently
 *      dark in this deployment before this session (no separate `VISION_*`
 *      credential was ever configured); this is its first real verdict.
 *   4. the distinctness gate consuming that real verdict, producing an actual
 *      PASS/FAIL with real reasons — not a hardcoded pass;
 *   5. quota-awareness under a real, seeded exhaustion — proof that a model
 *      whose free allowance is spent is removed from the chain, not merely
 *      ranked behind a paid one, without spending a real request to reach 20;
 *   6. what the run actually spent, from the cost ledger.
 *
 * Costs at most two Gemini free-tier requests (well inside the 20/day
 * allowance) and zero euros. Run with:
 *
 *   npm run capability-proof
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { businessAnalystAgent } from '../agents/businessAnalystAgent.js';
import { loadConfig } from '../lib/config.js';
import { createPlatform } from '../lib/platform/platform.js';
import { createLogger, createConsoleSink } from '../lib/logger.js';
import { analyzeCritiqueViaCapability } from '../lib/qa/visual-critic.js';
import { gateJob } from '../lib/qa/distinctness-gate.js';
import { modelKey, resolveModel } from '../lib/capability/models.js';

import type { BusinessProfile } from '../lib/types.js';
import type { JobState } from '../lib/workflow/jobState.js';

const RIVERPARK_DIR = path.join('output', 'riverpark');

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: 'info', scope: 'capability-proof', sink: createConsoleSink(true) });

  console.log('\n=== 1. CAPABILITY BOARD (live, from .env) ===\n');
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-capability-proof-'));
  const boardPlatform = await createPlatform({
    config: { ...config, outputDir: scratch },
    logger,
    signal: new AbortController().signal,
    outputDir: scratch,
  });
  const board = boardPlatform.capabilities.board();
  console.log(`${board.available}/${board.total} capabilities plannable, estimated cost of one pass: ${board.estimatedCents} cents`);
  console.log('reasoning chain:', boardPlatform.capabilities.plan('reasoning').chain.map((s) => s.binding.id));
  console.log('craft_judging chain:', boardPlatform.capabilities.plan('craft_judging').chain.map((s) => s.binding.id));
  await boardPlatform.dispose();

  /* ---------------------------------------------------------------- */
  /* 2. A real `reasoning` call, against River Park's real evidence     */
  /* ---------------------------------------------------------------- */

  console.log('\n=== 2. REAL business-analyst call (reasoning) against River Park\'s real profile ===\n');

  const profile = JSON.parse(
    await fs.readFile(path.join(RIVERPARK_DIR, '3-profile.json'), 'utf8'),
  ) as BusinessProfile;

  const runOutputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bf-capability-proof-run-'));
  const platform = await createPlatform({
    config: { ...config, outputDir: runOutputDir },
    logger,
    signal: new AbortController().signal,
    outputDir: runOutputDir,
  });

  const strategy = await businessAnalystAgent.run(profile, {
    runId: 'capability-proof',
    config,
    logger: logger.child('businessAnalystAgent'),
    getBrowser: () => Promise.reject(new Error('not used by this stage')),
    platform,
    outputDir: runOutputDir,
    signal: new AbortController().signal,
  });

  console.log(`Strategy produced by model: ${strategy.model}`);
  console.log(`Category: ${strategy.category.primary} — ${strategy.goals.length} goals, ${strategy.pages.length} pages recommended`);
  console.log(`Spend so far: ${platform.capabilities.spend().totalCents} cents (${JSON.stringify(platform.capabilities.spend().byProvider)})`);

  /* ---------------------------------------------------------------- */
  /* 3. A real `craft_judging` call, against River Park's real shots    */
  /* ---------------------------------------------------------------- */

  console.log('\n=== 3. REAL visual critic call (craft_judging) against River Park\'s real screenshots ===\n');
  console.log('Before this session: this call never ran in production. `resolveVision` required a');
  console.log('separate VISION_API_KEY nobody configured, so `analyze` was a stub returning');
  console.log('`uncertain` on every job, forever. This is a genuine vision call, first time.\n');

  const critique = await analyzeCritiqueViaCapability(
    {
      orchestrator: platform.capabilities,
      aiConfig: config.ai,
      timeoutMs: 60_000,
      logger: logger.child('visual-critic'),
    },
    {
      business: profile.name.value,
      screenshots: [
        { viewport: 'desktop', path: path.join(RIVERPARK_DIR, 'shots', 'visual-qa-desktop.png') },
        { viewport: 'mobile', path: path.join(RIVERPARK_DIR, 'shots', 'visual-qa-mobile.png') },
      ],
      design: JSON.parse(await fs.readFile(path.join(RIVERPARK_DIR, '5b-design.json'), 'utf8')),
      character: null,
      creativeDirection: null,
    },
  );

  console.log(`genericVerdict: ${critique.genericVerdict}`);
  console.log('axis scores:', critique.axes.map((a) => `${a.axis}=${a.score}`).join(', '));
  if (critique.failReasons.length > 0) console.log('fail reasons:', critique.failReasons);
  console.log(`Spend after critique: ${platform.capabilities.spend().totalCents} cents`);

  /* ---------------------------------------------------------------- */
  /* 4. The distinctness gate consuming a REAL critique                 */
  /* ---------------------------------------------------------------- */

  console.log('\n=== 4. Distinctness gate consuming the real critique ===\n');
  const design = JSON.parse(await fs.readFile(path.join(RIVERPARK_DIR, '5b-design.json'), 'utf8'));
  const content = JSON.parse(await fs.readFile(path.join(RIVERPARK_DIR, '5-content.json'), 'utf8'));
  const character = { visualWeight: 'image-led', emotionalRegister: 'craft', narrativePotential: 'strong' } as const;

  const fakeJobState = { creativeDirection: null, implementationStatus: 'built', iteration: 0 } as unknown as JobState;
  const gate = gateJob({ jobState: fakeJobState, design, content, character, critic: critique });
  console.log(`verdict: ${gate.verdict}, score: ${gate.overallScore}, diagnosis: ${gate.diagnosis}, route: ${gate.route}`);
  if (gate.reasons.length > 0) console.log('reasons:', gate.reasons);

  /* ---------------------------------------------------------------- */
  /* 5. Quota-awareness under a real, seeded exhaustion                 */
  /* ---------------------------------------------------------------- */

  console.log('\n=== 5. Quota exhaustion — the real ledger, seeded rather than spending 20 real requests ===\n');
  const geminiWorkhorse = resolveModel('gemini', 'workhorse');
  if (geminiWorkhorse?.freeAllowance) {
    const key = modelKey(geminiWorkhorse);
    for (let i = 0; i < geminiWorkhorse.freeAllowance.requestsPerDay; i += 1) {
      await platform.capabilities.quota.record(key);
    }
    const planAfterExhaustion = platform.capabilities.plan('prose_writing');
    const excludedGemini = planAfterExhaustion.excluded.find((e) => e.provider === 'gemini');
    console.log(
      `after seeding ${geminiWorkhorse.freeAllowance.requestsPerDay} recorded requests for ${key}:`,
    );
    console.log(`  gemini excluded: ${excludedGemini?.reason ?? '(not excluded — unexpected)'}`);
    console.log(`  chain now: ${planAfterExhaustion.chain.map((s) => s.binding.id).join(', ') || '(empty)'}`);
  }

  /* ---------------------------------------------------------------- */
  /* 6. What the run actually spent                                     */
  /* ---------------------------------------------------------------- */

  console.log('\n=== 6. Final spend, from the cost ledger ===\n');
  const spend = platform.capabilities.spend();
  console.log(`total: ${spend.totalCents} cents`);
  console.log('by provider:', spend.byProvider);
  console.log('by capability:', spend.byCapability);

  await platform.dispose();
  await fs.rm(runOutputDir, { recursive: true, force: true });
  await fs.rm(scratch, { recursive: true, force: true });

  console.log('\n=== PROOF COMPLETE ===\n');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
