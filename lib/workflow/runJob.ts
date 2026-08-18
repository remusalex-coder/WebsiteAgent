/**
 * Orchestrator — wires the existing pipeline's compose/render output into the
 * production gate loop (visual critic -> distinctness gate -> Hermes).
 *
 * Phase 1 only: this takes a runId that has already been through discovery,
 * collection and normalization (an `output/<runId>/3-profile.json` exists)
 * and drives it through build -> screenshot -> critique -> gate -> decide.
 * It does not call discovery or the collector, and it does not reimplement
 * any of `composeStandalone`, `scripts/shoot.ts`'s capture technique, or the
 * gate/critic/Hermes modules built earlier — it only sequences them and
 * persists a `JobState` after every stage.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { chromium } from 'playwright';

import { composeStandalone } from '../../main.js';
import { createCapabilityOrchestrator } from '../capability/orchestrator.js';
import { loadConfig } from '../config.js';
import { createLogger } from '../logger.js';
import { runVisualCritic, analyzeCritique, analyzeCritiqueViaCapability } from '../qa/visual-critic.js';
import { gateJob } from '../qa/distinctness-gate.js';
import { decide } from './hermes.js';
import { createJob, saveJob } from './jobState.js';
import { finalizeBest, recordCandidate } from './candidates.js';
import { composeDesign } from '../design/compose.js';
import { planNarrative } from '../design/plan.js';
import { brandSeedFor } from '../art/seed.js';
import { renderSite, writeRenderedSite } from '../render/index.js';
import { directDesign } from '../../agents/designDirectorAgent.js';
import type { DesignDirective } from '../design/directive.js';

import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { WebsiteDesign, WebsiteContent, BusinessProfile, BusinessStrategy } from '../types.js';
import type { VisualCritique } from '../qa/visual-critic.js';
import type { JobState } from './jobState.js';

const SITE_DIR_NAME = 'site';
const SHOTS_DIR_NAME = 'shots';

/** Vision endpoint credentials for the visual critic. Omitted disables it. */
export interface VisionOptions {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
}

/** `RunJobOptions.vision` resolved against `config.vision` (P3-1 / F-14). */
type ResolvedVision = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
};

function resolveVision(opts: RunJobOptions, config: AppConfig): ResolvedVision | null {
  const explicit = opts.vision;
  const configured = config.vision;
  const apiKey = explicit?.apiKey ?? configured.apiKey;
  if (apiKey === '') return null;
  return {
    apiKey,
    baseUrl: explicit?.baseUrl ?? configured.baseUrl ?? '',
    model: explicit?.model ?? configured.model,
  };
}

/**
 * Test seams for the three steps that need a browser, a model, or both.
 *
 * Production leaves this unset and the real implementations run. It exists
 * because the loop's failure branches — a build that throws, a reconcept that
 * throws — are exactly the paths that must be asserted, and they are otherwise
 * only reachable by launching Chromium and spending a model call.
 */
export interface RunJobHooks {
  readonly build?: (runId: string, config: AppConfig) => Promise<void>;
  readonly capture?: typeof captureScreenshots;
  readonly reconcept?: typeof reconceptBuild;
}

export interface RunJobOptions {
  readonly runId: string;
  readonly business: string;
  readonly maxIter?: number;
  readonly config?: AppConfig;
  readonly vision?: VisionOptions;
  readonly signal?: AbortSignal;
  readonly logger?: Logger;
  /** Injected only by tests; see `RunJobHooks`. */
  readonly hooks?: RunJobHooks;
}

/** A minimal, non-invented character read off the profile — never a guess. */
interface MinimalCharacter {
  readonly name: string;
  readonly category: string | null;
  readonly description: string | null;
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    return await readJson<T>(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/**
 * Reads `3-profile.json` and lifts a minimal character out of it, or `null`
 * when the profile is missing. Not `deriveCharacter` — that needs a
 * `CharacterContext` this stage does not have — just the facts already on
 * the profile, which is enough for the gate's equality checks.
 */
async function minimalCharacterFrom(outputDir: string): Promise<MinimalCharacter | null> {
  const profile = await readJsonIfExists<{
    name?: { value?: string };
    category?: { value?: string } | null;
    description?: { value?: string } | null;
  }>(path.join(outputDir, '3-profile.json'));
  if (profile === null) return null;

  return {
    name: profile.name?.value ?? '',
    category: profile.category?.value ?? null,
    description: profile.description?.value ?? null,
  };
}

/**
 * Loads peer designs declared in `peers.json`, when present.
 *
 * `peers.json` holds `[{ name, designPath }]`, `designPath` relative to the
 * run's own output dir. Absence is normal — most jobs have no peer set yet —
 * and is not an error.
 */
export async function loadPeerDesigns(
  outputDir: string,
): Promise<ReadonlyArray<{ readonly name: string; readonly design: WebsiteDesign }> | undefined> {
  const declarations = await readJsonIfExists<ReadonlyArray<{ name: string; designPath: string }>>(
    path.join(outputDir, 'peers.json'),
  );
  if (declarations === null) return undefined;

  const peers = await Promise.all(
    declarations.map(async (entry) => ({
      name: entry.name,
      design: await readJson<WebsiteDesign>(path.resolve(outputDir, entry.designPath)),
    })),
  );
  return peers;
}

/**
 * Screenshots the rendered site at desktop and mobile viewports.
 *
 * Same capture technique as `scripts/shoot.ts`: strip `loading="lazy"`,
 * await every image's `decode()`, then grow the viewport to the page's full
 * height instead of using `fullPage` — which re-runs lazy-loading heuristics
 * after the images already decoded and captures a blank band. See that
 * script's comments for the incident this avoids.
 */
/**
 * Puts the page into the state a full-page capture should record.
 *
 * A full-page screenshot is a composite of a page no visitor ever sees all at
 * once, so "what does it look like" has to be answered per section: each one as
 * it appears **when it is in view**. That is not the state the page is in after
 * loading, and — the trap — it is not the state it is in after scrolling
 * through either, because returning to the top makes the scroll runtime
 * recompute every off-screen section back to `--forge-vis: 0`, which drives a
 * `brightness(0.72)` dim and an 8% offset. Capturing then produces a page of
 * dark bands, which is exactly what the first version of this fix did.
 *
 * So: walk the page to fire every reveal and force any deferred loading, then
 * pin the reveal variables open and capture. Nothing here changes what is on
 * the page — only whether it is being shown.
 *
 * Passed to `evaluate` as a source string because tsx compiles named function
 * bindings through esbuild's `__name` helper, which does not exist in the page:
 * a `const frame = () => {}` inside an evaluated function fails the whole call
 * with `__name is not defined`.
 */
const SETTLE_FOR_CAPTURE = `(async () => {
  for (const img of Array.from(document.images)) img.removeAttribute('loading');
  await Promise.all(Array.from(document.images).map((i) => (i.complete ? null : i.decode().catch(() => null))));

  const step = window.innerHeight;
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));

  // Hold every section revealed for the shutter. Set last so the runtime's own
  // scroll pass cannot overwrite it.
  document.documentElement.style.setProperty('--forge-scroll', '1');
  for (const section of document.querySelectorAll('section')) {
    section.style.setProperty('--forge-vis', '1');
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
})()`;

export async function captureScreenshots(
  outputDir: string,
  logger: Logger,
): Promise<ReadonlyArray<{ readonly viewport: 'desktop' | 'mobile'; readonly path: string }>> {
  const indexPath = path.join(outputDir, SITE_DIR_NAME, 'index.html');
  const shotsDir = path.join(outputDir, SHOTS_DIR_NAME);
  await fs.mkdir(shotsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const shots: Array<{ readonly viewport: 'desktop' | 'mobile'; readonly path: string }> = [];

  try {
    for (const [viewport, width, height] of [
      ['desktop', 1440, 900],
      ['mobile', 390, 844],
    ] as const) {
      const page = await browser.newPage({ viewport: { width, height } });
      try {
        await page.goto(`file://${indexPath.replace(/\\/g, '/')}`);

        await page.evaluate(async () => {
          for (const img of Array.from(document.images)) img.removeAttribute('loading');
          await Promise.all(
            Array.from(document.images).map((img) => (img.complete ? null : img.decode().catch(() => null))),
          );
        });
        await page.waitForTimeout(600);

        /*
         * Walk the page at its real viewport size, then capture with `fullPage`.
         *
         * This used to measure `scrollHeight` and grow the viewport to it. That
         * silently produced a mostly-blank image for every site the design layer
         * gives a full-height hero: the hero is sized in `vh`, so enlarging the
         * viewport enlarges the hero by the same amount and the page always
         * outgrows the frame it was measured for. On the Sibiu bakery run the
         * page measured 4,534px at a 900px viewport and became 8,168px once the
         * viewport was set to 4,534 — so the capture held the hero and nothing
         * else, while the distinctness gate scored that image 99 and PASSED it.
         *
         * Scrolling first is what makes `fullPage` safe here, and is the reason
         * the viewport trick was reached for originally: it fires the scroll and
         * resize handlers the runtime listens on (`lib/runtime/scroll-progress.ts`)
         * and forces any remaining deferred loading, so nothing is still
         * transitioning when the shutter opens. Returning to the top leaves the
         * page in the state a visitor first sees.
         */
        await page.evaluate(SETTLE_FOR_CAPTURE);
        await page.waitForTimeout(400);

        const shotPath = path.join(shotsDir, `${viewport}.png`);
        await page.screenshot({ path: shotPath, fullPage: true });
        shots.push({ viewport, path: shotPath });
        logger.debug('screenshot captured', { viewport, shotPath });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  return shots;
}

/**
 * Rebuilds the site with a NEW creative direction, so a reconcept iteration
 * produces a DIFFERENT design rather than re-criticising the same one.
 *
 * When the AI Design Director is enabled (`config.director.enabled`), this
 * re-runs `directDesign` with the prior failure reasons fed back in — the real
 * creative reconceptualisation path. When it is disabled (the near-zero-cost
 * default), it deterministically PERTURBS the previous directive (rotates
 * experienceMode / direction / signatureMoment to a different valid value) so
 * the rebuild still changes the design observably without spending a model call.
 * Either way the result is a genuinely different `WebsiteDesign`.
 */
export async function reconceptBuild(args: {
  outputDir: string;
  config: AppConfig;
  logger: Logger;
  signal?: AbortSignal;
  previousDirective: DesignDirective | null;
  feedback: string;
  route: 'creative' | 'experience' | 'builder' | 'director';
  iteration: number;
  /**
   * The exact directive to build, when the caller already decided it.
   *
   * The diverge stage hands one of its K candidate directions here; when
   * present it bypasses both the design director and the perturbed directive,
   * so a candidate is rendered exactly as diverged — the one code path that
   * turns a directive into a site stays the only one, whether the directive
   * was authored by a model or enumerated deterministically.
   */
  readonly applyDirective?: DesignDirective;
}): Promise<{ readonly design: WebsiteDesign; readonly directive: DesignDirective }> {
  const { outputDir, config, logger, signal, previousDirective, feedback, route, iteration, applyDirective } = args;

  const profile = await readJson<BusinessProfile>(path.join(outputDir, '3-profile.json'));
  const content = await readJson<WebsiteContent>(path.join(outputDir, '5-content.json'));
  const strategy = await readJsonIfExists<BusinessStrategy>(path.join(outputDir, '4-strategy.json'));

  let directive: DesignDirective;

  if (applyDirective !== undefined) {
    directive = applyDirective;
  } else if (config.director.enabled && strategy !== null) {
    const { createPlatform } = await import('../platform/platform.js');
    const platform = await createPlatform({
      config,
      logger: logger.child('platform'),
      signal: signal ?? new AbortController().signal,
      outputDir,
    });
    const ctx = {
      runId: path.basename(outputDir),
      config,
      logger: logger.child('designDirector'),
      getBrowser: () => Promise.reject(new Error('browser not used by director')),
      platform,
      outputDir,
      signal: signal ?? new AbortController().signal,
    };
    const result = await directDesign({ profile, strategy, content }, ctx, feedback);
    directive = result.directive;
    await fs.writeFile(path.join(outputDir, '5a-directive.json'), `${JSON.stringify(directive, null, 2)}\n`, 'utf8');
    await platform.dispose();
  } else {
    directive = perturbedDirective(previousDirective, route, iteration);
    await fs.writeFile(path.join(outputDir, '5a-directive.json'), `${JSON.stringify(directive, null, 2)}\n`, 'utf8');
  }

  const seed = await brandSeedFor(profile, outputDir);
  const plan = planNarrative(profile, content, directive);
  const design = composeDesign(
    { profile, content },
    {
      photographicSeed: seed.hex,
      plan,
      directive,
      ...(directive.experienceMode !== undefined ? { experienceMode: directive.experienceMode } : {}),
      ...(directive.signatureMoment !== undefined && directive.signatureMoment !== null ? { momentSection: directive.signatureMoment } : {}),
    },
  );

  const site = renderSite(content, {
    design,
    runtime:
      plan.experience.mode === 'narrative' && plan.character.visualWeight === 'image-led'
        ? 'scroll-progress'
        : 'none',
  });
  const targetDir = path.join(outputDir, SITE_DIR_NAME);
  await writeRenderedSite(site, { sourceDir: outputDir, targetDir });
  await fs.writeFile(path.join(outputDir, '5b-design.json'), `${JSON.stringify(design, null, 2)}\n`, 'utf8');

  return { design, directive };
}

/**
 * Rotates a previous directive to a different valid value, so a reconcept
 * iteration changes the design. Pure, deterministic, no model.
 */
function perturbedDirective(
  prev: DesignDirective | null,
  route: 'creative' | 'experience' | 'builder' | 'director',
  iteration: number,
): DesignDirective {
  const modes = ['brochure', 'showcase', 'narrative', 'immersive'] as const;
  const directions = ['minimal', 'luxury', 'corporate', 'elegant', 'modern', 'editorial', 'creative', 'playful', 'bold', 'premium', 'friendly'] as const;
  const moments = ['hero', 'statement', 'about', 'services', 'gallery', 'contact', 'cta'] as const;

  const prevMode = prev?.experienceMode;
  const prevDir = prev?.direction;
  const prevMoment = prev?.signatureMoment ?? null;

  const nextMode = modes[(modes.indexOf((prevMode ?? 'brochure') as typeof modes[number]) + 1 + iteration) % modes.length];
  const nextDir = directions[(directions.indexOf((prevDir ?? 'modern') as typeof directions[number]) + 1 + iteration) % directions.length];
  const nextMoment = moments[(moments.indexOf((prevMoment ?? 'hero') as typeof moments[number]) + 1 + iteration) % moments.length];

  return {
    ...prev,
    direction: nextDir,
    experienceMode: route === 'creative' || route === 'director' ? nextMode : prevMode,
    signatureMoment: nextMoment,
    rationale: `Reconcept iteration ${iteration}: perturbed from prior direction to avoid generic collapse.`,
    confidence: 0.6,
    creativeThesis: prev?.creativeThesis
      ? `Reconceived: ${prev.creativeThesis}`
      : `Reconcept iteration ${iteration} — a different structural shape than the rejected version.`,
  };
}

/**
 * Runs one processed business through the build -> screenshot -> critique ->
 * gate -> decide loop, persisting `job.json` after every stage.
 *
 * `runId` must already have `output/<runId>/3-profile.json` on disk — this
 * function never touches discovery or the collector. The loop bound is
 * `maxIter`: Hermes escalates once `job.iteration` reaches it, so this can
 * never recurse unboundedly even with vision disabled.
 */
export async function runJob(opts: RunJobOptions): Promise<JobState> {
  const config = opts.config ?? loadConfig();
  const logger = opts.logger ?? createLogger({ level: config.logLevel, scope: 'workflow' });
  const outputDir = path.join(config.outputDir, opts.runId);
  const maxIter = opts.maxIter ?? 3;

  let job = createJob(opts.runId, opts.business, maxIter);
  job = await saveJob(outputDir, job);

  const build = opts.hooks?.build ?? (async (runId, cfg): Promise<void> => {
    await composeStandalone(runId, cfg);
    if (cfg.experienceEngine === 'signature') {
      try {
        const { runExperienceForge } = await import('../forge/orchestrator.js');
        await runExperienceForge({
          runId,
          outputDir: cfg.outputDir,
          autoOpen: false,
          maxIterations: 1,
        });
      } catch (err: unknown) {
        logger.warn('Experience Signature generation warning (fallback to template build)', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });
  const capture = opts.hooks?.capture ?? captureScreenshots;
  const reconcept = opts.hooks?.reconcept ?? reconceptBuild;

  // --- Stage: build ------------------------------------------------------
  let design: WebsiteDesign;
  let content: WebsiteContent;
  let character: MinimalCharacter | null;
  try {
    await build(opts.runId, config);
    design = await readJson<WebsiteDesign>(path.join(outputDir, '5b-design.json'));
    content = await readJson<WebsiteContent>(path.join(outputDir, '5-content.json'));
    character = await minimalCharacterFrom(outputDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('build stage failed', { runId: opts.runId, error: message });
    job = await saveJob(outputDir, {
      stage: 'build',
      implementationStatus: 'failed',
      errors: [...job.errors, `build: ${message}`],
      decision: 'escalate',
    });
    return job;
  }

  job = await saveJob(outputDir, {
    stage: 'build',
    implementationStatus: 'built',
    design,
    content,
    character,
  });

  // --- Stage: browser ------------------------------------------------------
  const screenshots = await capture(outputDir, logger.child('browser'));
  job = await saveJob(outputDir, { stage: 'browser', browserStatus: 'shot' });

  // --- Stages: visual-critic, distinctness-gate, hermes (bounded loop) -----
  /*
   * `craft_judging` — does the rendered page read as art-directed or as
   * generated — routes through the capability planner by default now,
   * against whichever of this deployment's already-credentialled vendors
   * serves vision (`gemini`, then `openai`, with failover between them),
   * rather than requiring a separate `VISION_*` credential nobody who only
   * set `AI_PROVIDER` plus that vendor's key would ever configure. An
   * explicit `VISION_*` / `opts.vision` override still wins outright — an
   * operator who deliberately pointed the critic at a specific endpoint gets
   * exactly that endpoint, not a routing decision overriding their own.
   */
  const vision = resolveVision(opts, config);
  const capabilities = vision === null
    ? await createCapabilityOrchestrator({ config, logger: logger.child('capability') })
    : null;

  const analyze: (input: Parameters<typeof analyzeCritique>[1]) => Promise<VisualCritique> =
    vision !== null
      ? (input) =>
          analyzeCritique(
            {
              apiKey: vision.apiKey,
              baseUrl: vision.baseUrl,
              model: vision.model,
              timeoutMs: 60_000,
              logger: logger.child('visual-critic'),
              ...(opts.signal ? { signal: opts.signal } : {}),
            },
            input,
          )
      : (input) =>
          analyzeCritiqueViaCapability(
            {
              orchestrator: capabilities as NonNullable<typeof capabilities>,
              aiConfig: config.ai,
              timeoutMs: 60_000,
              logger: logger.child('visual-critic'),
              ...(opts.signal ? { signal: opts.signal } : {}),
            },
            input,
          );

  const peerDesigns = await loadPeerDesigns(outputDir);

  for (;;) {
    const critic = await runVisualCritic({
      input: {
        business: opts.business,
        screenshots,
        design,
        character,
        creativeDirection: job.creativeDirection,
      },
      analyze,
    });
    job = await saveJob(outputDir, { stage: 'visual-critic', visualCritique: critic });

    const gate = gateJob({
      jobState: job,
      design,
      content,
      character,
      critic,
      ...(peerDesigns ? { peerDesigns } : {}),
    });
    job = await saveJob(outputDir, {
      stage: 'distinctness-gate',
      distinctnessScore: gate,
      qaStatus: gate.verdict === 'PASS' ? 'passed' : 'failed',
    });

    /*
     * Record this attempt before anything decides what to do about it.
     *
     * The candidate is immutable from here, so the next reconcept iteration
     * cannot destroy it — which is the whole point: a run scoring 68, then 55,
     * then 51 must escalate holding the 68.
     *
     * `distinctness` is a constant until the quality system scores it as its
     * own dimension. A constant is inert in the ordering, which is the honest
     * behaviour for a number nobody has measured yet — it is not folded into
     * `quality`, because summing the two is precisely what must never happen.
     */
    const index = await recordCandidate({
      outputDir,
      iteration: job.iteration,
      scores: {
        quality: gate.overallScore,
        distinctness: 0,
        blockingClean: job.implementationStatus === 'built',
      },
    });
    logger.info('candidate recorded', {
      candidateId: index.candidates[index.candidates.length - 1]?.candidateId,
      quality: gate.overallScore,
      bestId: index.bestId,
    });

    const hermesDecision = decide({ gate, job });
    logger.info('hermes decided', {
      action: hermesDecision.action,
      nextStage: hermesDecision.nextStage,
      iteration: hermesDecision.iteration,
      rationale: hermesDecision.rationale,
    });

    if (hermesDecision.action === 'deliver') {
      // Restore the run root from the winning candidate before reporting where
      // the site is. Without this, `finalOutput` would point at whatever the
      // last iteration happened to leave behind.
      const best = await finalizeBest(outputDir);
      job = await saveJob(outputDir, {
        stage: 'delivery',
        decision: 'deliver',
        ...(best === null ? {} : { design: await readJson<WebsiteDesign>(path.join(outputDir, '5b-design.json')) }),
        finalOutput: path.join(outputDir, SITE_DIR_NAME, 'index.html'),
      });
      return job;
    }

    if (hermesDecision.action === 'escalate') {
      // A human receiving an escalation gets the best attempt, not the last.
      const best = await finalizeBest(outputDir);
      job = await saveJob(outputDir, {
        stage: 'human',
        decision: 'escalate',
        ...(best === null ? {} : { design: await readJson<WebsiteDesign>(path.join(outputDir, '5b-design.json')) }),
        finalOutput: best === null ? job.finalOutput : path.join(outputDir, SITE_DIR_NAME, 'index.html'),
        errors: [...job.errors, hermesDecision.rationale],
      });
      return job;
    }

    // 'continue': the rejection loop. Rebuild the design with a NEW creative
    // direction so iteration N+1 is a DIFFERENT site, not the same one
    // re-criticised. The route Hermes chose tells us where to push:
    //   creative/director -> new creative concept (re-run the Design Director
    //     with the prior failure reasons fed back in, or a perturbed directive
    //     when the director is disabled)
    //   experience/builder -> re-compose with a perturbed experience plan
    // The browser + gate re-run after the rebuild, so the loop is both real
    // and bounded by `maxIter`.
    try {
      const feedback = gate.reasons.join('; ');
      const rebuilt = await reconcept({
        outputDir,
        config,
        logger: logger.child('reconcept'),
        ...(opts.signal ? { signal: opts.signal } : {}),
        previousDirective: (job.creativeDirection as DesignDirective | null) ?? null,
        feedback,
        route: hermesDecision.nextStage as 'creative' | 'experience' | 'builder' | 'director',
        iteration: hermesDecision.iteration,
      });
      design = rebuilt.design;
      job = await saveJob(outputDir, {
        stage: 'hermes',
        iteration: hermesDecision.iteration,
        creativeDirection: rebuilt.directive,
        design,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('reconcept build failed', { iteration: hermesDecision.iteration, error: message });
      /*
       * If we cannot rebuild, escalate rather than spin on the same design.
       *
       * `decision` has to be written here. Without it this returned a job whose
       * `decision` was still `'running'` while the function had in fact
       * finished — a terminated job claiming to be in flight, which is
       * indistinguishable from a crashed one to anything reading `job.json`.
       * The comment said "escalate"; the patch did not.
       */
      const best = await finalizeBest(outputDir);
      job = await saveJob(outputDir, {
        stage: 'human',
        decision: 'escalate',
        iteration: hermesDecision.iteration,
        ...(best === null ? {} : { finalOutput: path.join(outputDir, SITE_DIR_NAME, 'index.html') }),
        errors: [...job.errors, `reconcept: ${message}`],
      });
      return job;
    }

    // Re-screenshot the rebuilt site before the next critique pass.
    await capture(outputDir, logger.child('browser'));
  }
}
