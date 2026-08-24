/**
 * Entry point and orchestrator.
 *
 * This file owns everything the agents must not: configuration, the browser
 * lifecycle, logging setup, artifact persistence, and the order of the stages.
 * The agents themselves are pure transforms wired together here.
 *
 *   mapsUrl -> discovery -> collector -> writer -> lovable -> PipelineResult
 *
 * Usage: npm run dev -- "https://maps.app.goo.gl/..."
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import fs from 'node:fs/promises';

import { discoveryAgent, discoverStandalone } from './agents/discoveryAgent.js';
import { collectorAgent } from './agents/collectorAgent.js';
import { normalizerAgent } from './agents/normalizerAgent.js';
import { businessAnalystAgent } from './agents/businessAnalystAgent.js';
import { composeBaseline, writerAgent } from './agents/writerAgent.js';
import { designAgent } from './agents/designAgent.js';
import { directDesign } from './agents/designDirectorAgent.js';
import { lovableAgent } from './agents/lovableAgent.js';

import { loadConfig } from './lib/config.js';
import { createConsoleSink, createFileSink, createLogger, createMultiSink } from './lib/logger.js';
import { createBrowserSession } from './lib/browser.js';
import { createPlatform } from './lib/platform/platform.js';
import { resolveBudgetTier } from './lib/capability/budget.js';
import { shouldAttemptEnhance } from './lib/forge/decide.js';
import { writeCostReport } from './lib/cost/report.js';
import { loadJob, saveJob } from './lib/workflow/jobState.js';
import { renderSite, writeRenderedSite } from './lib/render/index.js';
import { brandSeedFor } from './lib/art/seed.js';
import { composeDesign } from './lib/design/compose.js';
import { planNarrative } from './lib/design/plan.js';
import { resolvePrimitives } from './lib/design/experienceRegistry.js';
import { directiveRuntimePrimitiveIds } from './lib/design/directive.js';
import { NEUTRAL_ARCHITECTURE } from './lib/design/experience.js';
import { directContent, auditContent } from './lib/content/index.js';
import { AgentError, InvalidInputError } from './lib/errors.js';

import type { AppConfig } from './lib/config.js';
import type { Logger } from './lib/logger.js';
import type { BrowserSession } from './lib/browser.js';
import type { Platform } from './lib/platform/platform.js';
import type {
  AgentContext,
  BusinessProfile,
  BusinessStrategy,
  DeploymentResult,
  DiscoveryInput,
  PipelineResult,
  WebsiteContent,
  WebsiteDesign,
} from './lib/types.js';
import type { NarrativePlan } from './lib/design/plan.js';
import type { ContentAudit } from './lib/content/index.js';
import type { RuntimePrimitiveId } from './lib/design/experience.js';
import type { JobStage } from './lib/workflow/jobState.js';

const SOURCE = 'main';

/* ------------------------------------------------------------------ */
/* Run scaffolding                                                     */
/* ------------------------------------------------------------------ */

interface Run {
  readonly runId: string;
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly outputDir: string;
  readonly signal: AbortSignal;
  /** Opens the browser on first use and reuses it thereafter. */
  readonly getBrowser: () => Promise<BrowserSession>;
  /** Providers, skills and MCP servers, wired from configuration. */
  readonly platform: Platform;
  /** Closes anything the run opened. Safe to call more than once. */
  readonly dispose: () => Promise<void>;
}

/**
 * Builds the per-run environment: output folder, run logger, and a lazily
 * opened browser session shared by every agent that asks for one.
 */
async function createRun(config: AppConfig, runId: string): Promise<Run> {
  const outputDir = path.join(config.outputDir, runId);
  await fs.mkdir(outputDir, { recursive: true });

  const sink = createMultiSink(
    createConsoleSink(),
    createFileSink(path.join(outputDir, 'run.log.ndjson')),
  );
  const logger = createLogger({
    level: config.logLevel,
    scope: `run.${runId}`,
    baseFields: { runId },
    sink,
  });

  const controller = new AbortController();
  const onInterrupt = (): void => controller.abort();
  process.once('SIGINT', onInterrupt);

  // Opened at most once, and only if an agent actually asks for it.
  let browser: Promise<BrowserSession> | null = null;

  // Built eagerly, unlike the browser: skill discovery has to finish before the
  // first stage runs, and it touches only the filesystem.
  const platform = await createPlatform({
    config,
    logger,
    signal: controller.signal,
    outputDir,
    capabilityPolicy: {
      ...resolveBudgetTier(config.budgetTier, config.budgetCustomCents ?? undefined),
      ...(config.allowCerebrasSpend ? { allowUnverifiedPricingFor: ['cerebras'] as const } : {}),
    },
  });

  return {
    runId,
    config,
    logger,
    outputDir,
    platform,
    signal: controller.signal,

    getBrowser() {
      browser ??= createBrowserSession({
        config: config.browser,
        logger: logger.child('browser'),
        signal: controller.signal,
      });
      return browser;
    },

    async dispose() {
      process.removeListener('SIGINT', onInterrupt);
      if (browser) await (await browser).close();
      await platform.dispose();
      sink.close?.();
    },
  };
}

/** Narrows a run to what a single agent is allowed to see. */
function contextFor(run: Run, agentName: string): AgentContext {
  return {
    runId: run.runId,
    config: run.config,
    logger: run.logger.child(agentName),
    getBrowser: run.getBrowser,
    platform: run.platform,
    outputDir: run.outputDir,
    signal: run.signal,
  };
}

/**
 * Writes a stage's output to `/output/<runId>/<step>-<stage>.json`.
 *
 * Persisting every stage is what makes the pipeline resumable and debuggable:
 * a failed deploy should never mean re-scraping.
 */
async function persistStage(run: Run, stage: string, data: unknown): Promise<void> {
  const filePath = path.join(run.outputDir, `${stage}.json`);
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await fs.rename(tempPath, filePath);
  run.logger.debug('stage persisted', { stage, filePath });
}

/* ------------------------------------------------------------------ */
/* Stages, and resuming from them                                      */
/* ------------------------------------------------------------------ */

/**
 * The stages in order, under the names `--from` accepts.
 *
 * Resuming means: read back what every earlier stage persisted, and start work
 * here. Stages 1–3 cost about forty seconds of live browsing per run — a
 * browser launch, a Maps consent interstitial, a site crawl and an image
 * download — and none of it is under development once a profile exists. Paying
 * that on every iteration of stage 4 or later is the single largest tax on
 * changing this pipeline, and it is a tax that buys nothing: the artifacts are
 * already on disk.
 */
const STAGES = [
  'discovery',
  'collect',
  'normalize',
  'analyze',
  'write',
  // 5a. The AI art director. Off unless `DIRECTOR_ENABLED`, and a no-op when
  // off — the stage still runs, produces no directive, and `design` composes
  // from inference exactly as it did before this stage existed.
  'direct',
  'design',
  'render',
  // 5c. The Experience Signature enhancement pass (`lib/forge/orchestrator.ts`).
  // Off unless `experienceEngine === 'signature' && budgetTier !== 'tier0'`
  // (`lib/forge/decide.ts:shouldAttemptEnhance`), and a no-op when off — the
  // stage still runs, records that it did not attempt, and `site/` keeps
  // exactly what `render` just wrote. When attempted, it either replaces
  // `site/` with Forge's build (verdict PASS) or leaves `render`'s
  // deterministic output in place (verdict FAIL) — always recorded, never a
  // silent overwrite.
  'enhance',
  'deploy',
] as const;

type StageName = (typeof STAGES)[number];

/**
 * Artifact base name each stage persists.
 *
 * `render` has none: it writes `site/`, which is a pure function of
 * `5-content.json` and `5b-design.json` and re-renders in milliseconds.
 */
const ARTIFACTS = {
  discovery: '1-discovery',
  collect: '2-collected',
  normalize: '3-profile',
  analyze: '4-strategy',
  write: '5-content',
  direct: '5a-directive',
  design: '5b-design',
  render: null,
  // `enhance` persists whether it ran and what shipped, but never re-derives
  // `site/` from this artifact the way `deploy` never re-derives it from
  // `render`'s (nonexistent) one — `site/` is always a side effect of
  // actually running `render` (and then, maybe, `enhance`), not something
  // resumed from JSON. `--from=enhance` re-runs `render` first for exactly
  // this reason (see the `enhance` step below).
  enhance: '5c-experience',
  deploy: '6-deployment',
} as const satisfies Record<StageName, string | null>;

/**
 * Fields that must be present when an artifact is read back off disk.
 *
 * A structural check, not a schema: enough that a truncated, half-written or
 * wrong-stage file fails here naming the file, rather than several stages later
 * as a `TypeError` on an undefined property.
 */
const ARTIFACT_KEYS = {
  discovery: ['sourceUrl', 'canonicalUrl', 'name'],
  collect: ['identity', 'pages', 'collectedAt'],
  normalize: ['name', 'pages', 'validation', 'normalizedAt'],
  analyze: ['businessName', 'category', 'pages'],
  write: ['businessName', 'tagline', 'voice', 'sections', 'seo'],
  // `directive` and `provenance` are both present even when the director is
  // off: the artifact then records a null directive and why, which is what
  // makes "the model did not choose this" legible a month later.
  direct: ['directive', 'provenance'],
  design: ['version', 'tokens', 'layout'],
  render: [],
  // `attempted`/`shipped` are both present even when the enhance stage never
  // attempted a build: the artifact then records why, the same "off is
  // legible, not ambiguous with never-existed" contract `direct`/`directive`
  // already established.
  enhance: ['attempted', 'shipped'],
  deploy: ['projectId', 'status'],
} as const satisfies Record<StageName, readonly string[]>;

/**
 * Fields added to a contract after artifacts had already been written.
 *
 * An artifact directory is a persistence format with a long life: runs from
 * weeks ago are resumed, re-rendered and used as regression fixtures. Every
 * field added to a contract therefore arrives as `undefined` from every file
 * already on disk, and the failure is a `TypeError` several stages downstream
 * rather than anything that names the cause.
 *
 * That is not hypothetical — `attributes` and `description` landed on
 * `BusinessProfile` with the listing source, and `--from=analyze` on any older
 * run crashed in the writer until this existed.
 *
 * Defaults only, and only ever the empty value. Filling a field with a *guess*
 * would put an invented fact into a profile, which is the one thing this
 * pipeline may not do. An old artifact is honestly missing what it never
 * collected; re-run from the top to actually have it.
 */
const ARTIFACT_DEFAULTS = {
  discovery: {},
  collect: {
    attributes: [],
    listingDescription: null,
    reviews: [],
    listingHours: [],
    listingRating: null,
    listingReviewCount: null,
  },
  normalize: { attributes: [], description: null, reviews: [], provenance: {}, blockedSources: [] },
  analyze: {},
  // `language` and `facts` were added to `WebsiteContent` after runs existed;
  // a saved artifact from before either is still renderable, in English.
  write: { trust: [], facts: [], language: 'en' },
  direct: { directive: null, provenance: null },
  design: {},
  render: {},
  enhance: { attempted: false, shipped: false },
  deploy: {},
} as const satisfies Record<StageName, Readonly<Record<string, unknown>>>;

function isStageName(value: string): value is StageName {
  return (STAGES as readonly string[]).includes(value);
}

/**
 * Maps this pipeline's own stage vocabulary onto `jobState.ts`'s `JobStage`.
 *
 * T03 (Consolidation Map / Master Execution Plan): a classic CLI run must
 * feed the one canonical `JobState`, not invent a second job-state model.
 * The two vocabularies do not line up one-to-one — this pipeline's nine
 * stages are the direct/local invocation path, `JobStage`'s seventeen values
 * describe the production (`scripts/n8n/stage.ts`) pipeline's finer-grained
 * loop — so this is a deliberate best-fit by what each classic stage
 * actually produces, not a renumbering. `render` has no entry because it is
 * never `step()`'d on its own (see `ARTIFACTS.render`'s doc comment above);
 * it is folded into `enhance`'s produce() and reported under `'build'`.
 */
const STAGE_TO_JOB_STAGE: Record<Exclude<StageName, 'render'>, JobStage> = {
  discovery: 'evidence',
  collect: 'evidence',
  normalize: 'evidence',
  analyze: 'character',
  write: 'content',
  direct: 'creative',
  design: 'design',
  enhance: 'build',
  deploy: 'delivery',
};

/** Reads a stage's persisted artifact back, checking it is that stage's. */
async function readArtifact<T>(outputDir: string, stage: StageName): Promise<T> {
  const base = ARTIFACTS[stage];
  if (base === null) {
    throw new InvalidInputError(`stage "${stage}" persists no artifact to resume from`, SOURCE);
  }
  const filePath = path.join(outputDir, `${base}.json`);

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new InvalidInputError(
      `${filePath} is not there, so this run cannot start after "${stage}". ` +
        'Resume from a stage the run actually reached, or re-run from the top.',
      SOURCE,
      error,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new InvalidInputError(`${filePath} is not valid JSON`, SOURCE, error);
  }

  const record = parsed as Record<string, unknown> | null;
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    throw new InvalidInputError(`${filePath} is not a JSON object`, SOURCE);
  }

  const missing = ARTIFACT_KEYS[stage].filter((key) => !(key in record));
  if (missing.length > 0) {
    throw new InvalidInputError(
      `${filePath} is missing ${missing.join(', ')}; it is not a "${stage}" artifact`,
      SOURCE,
    );
  }

  // Backfill fields the contract gained after this file was written. Spread
  // first so anything the file does carry always wins.
  return { ...ARTIFACT_DEFAULTS[stage], ...record } as T;
}

/**
 * Folder a run's rendered site is written to, beneath its artifact directory.
 */
const SITE_DIR_NAME = 'site';

/**
 * Renders the content spec into a static site next to the run's artifacts.
 *
 * Not an agent, and deliberately so: rendering needs no model, no browser and
 * no context — it is a pure function of `WebsiteContent`. Deployment calls the
 * same `renderSite`, so what ships is byte-identical to what lands here, and a
 * site can be inspected locally before anything is published.
 */
/**
 * Renders and writes the site.
 *
 * `runtimePrimitives` is the Creative Director's selection, already run
 * through `resolvePrimitives` (registry-validated, budget-capped) at the
 * call site in `executePipeline` — never trusted again here. Defaults to
 * `[]`, which is what every call before this parameter existed passed
 * implicitly: `renderSite(content, { design })` with no `runtime`/
 * `runtimePrimitives` keys at all, byte-identical output. `runtime` only
 * ever engages when the resolved list is non-empty — an empty list (director
 * off, or a directive that requested nothing) never adds `data-runtime` to
 * the page, exactly as before this parameter existed.
 */
async function renderStage(
  run: Run,
  content: WebsiteContent,
  design: WebsiteDesign,
  runtimePrimitives: readonly RuntimePrimitiveId[] = [],
  location: { readonly lat: number; readonly lng: number } | null = null,
): Promise<string> {
  const site = renderSite(content, {
    design,
    ...(runtimePrimitives.length > 0 ? { runtime: 'scroll-progress' as const, runtimePrimitives } : {}),
    ...(location !== null ? { location } : {}),
  });
  for (const warning of site.warnings) {
    run.logger.warn('renderer degraded a field', { warning });
  }

  const targetDir = path.join(run.outputDir, SITE_DIR_NAME);
  const { written, missingAssets } = await writeRenderedSite(site, {
    sourceDir: run.outputDir,
    targetDir,
  });

  if (missingAssets.length > 0) {
    run.logger.warn('assets referenced by the site were not on disk', { missingAssets });
  }
  run.logger.info('site rendered', { targetDir, files: written.length });

  return targetDir;
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

/**
 * Runs the stages from `from` onwards, reading earlier ones back off disk.
 *
 * A fresh run starts at `discovery` and loads nothing, so it behaves exactly as
 * it did before resuming existed. Note that nothing here opens a browser:
 * `getBrowser` is lazy, so resuming at `analyze` or later never launches one.
 */
async function executePipeline(
  config: AppConfig,
  options: { readonly runId: string; readonly input: DiscoveryInput; readonly from: StageName },
): Promise<PipelineResult> {
  const { runId, input, from } = options;
  const startedAt = new Date().toISOString();
  const run = await createRun(config, runId);
  const firstIndex = STAGES.indexOf(from);

  /**
   * Runs a stage and persists it, or loads what an earlier run left behind —
   * and either way, records the `JobState` this run has reached (T03). This
   * is the persisted job identity's only writer in this pipeline: whether a
   * stage actually ran or was resumed from disk, `job.json` moves forward
   * with it, so a `main.ts` run is loadable by id and shows up in job
   * history exactly like an n8n-triggered one, per the Consolidation Map.
   */
  async function step<T>(name: Exclude<StageName, 'render'>, produce: () => Promise<T>): Promise<T> {
    if (STAGES.indexOf(name) < firstIndex) {
      const loaded = await readArtifact<T>(run.outputDir, name);
      run.logger.info('stage loaded from artifacts', { stage: name });
      await saveJob(run.outputDir, { stage: STAGE_TO_JOB_STAGE[name] });
      return loaded;
    }
    const value = await produce();
    const base = ARTIFACTS[name];
    if (base !== null) await persistStage(run, base, value);
    await saveJob(run.outputDir, { stage: STAGE_TO_JOB_STAGE[name] });
    return value;
  }

  run.logger.info(from === 'discovery' ? 'pipeline started' : 'pipeline resumed', {
    runId,
    from,
    mapsUrl: input.mapsUrl,
  });

  // Ensures a persisted JobState exists (or is already there, on resume)
  // before the first stage runs. `business` is set once here from the Maps
  // URL, since it is a readonly identity field on JobState and a business
  // name is not known until `normalize` — the same "identify by input, not
  // by a fact only discovered later" pattern `createJob`'s own callers use
  // elsewhere in the codebase.
  await saveJob(run.outputDir, { jobId: runId, business: input.mapsUrl, maxIter: 3 });

  try {
    const discovery = await step('discovery', () =>
      discoveryAgent.run(input, contextFor(run, discoveryAgent.name)));

    const collected = await step('collect', () =>
      collectorAgent.run(discovery, contextFor(run, collectorAgent.name)));

    const profile = await step('normalize', () =>
      normalizerAgent.run(
        { discovery, collected, sources: collected.provenanceSources },
        contextFor(run, normalizerAgent.name),
      ));

    const strategy = await step('analyze', () =>
      businessAnalystAgent.run(profile, contextFor(run, businessAnalystAgent.name)));

    /*
     * Stage 5. The writer produces the facts and the structure; the Content
     * Director then decides what each beat of the page should actually *say*.
     *
     * Both halves are persisted as one artifact, because they are one answer to
     * one question: a `5-content.json` holding pre-direction copy would render
     * a page the pipeline never produced, and `--render` exists to reproduce
     * what shipped. See `directPageCopy`.
     */
    const content = await step('write', async () => {
      const written = await writerAgent.run({ profile, strategy }, contextFor(run, writerAgent.name));
      const { content: copy, audit } = directPageCopy(profile, written, strategy);
      for (const issue of audit.issues) {
        const log = issue.severity === 'error' ? run.logger.warn : run.logger.debug;
        log.call(run.logger, `content ${issue.severity}: ${issue.message}`, { kind: issue.kind, quote: issue.quote });
      }
      run.logger.info('content directed', { score: audit.score, specificity: audit.specificity, language: copy.language });
      return copy;
    });

    /*
     * Whether the Experience Signature enhancement pass (`lib/forge/`) will
     * be attempted for this run — decided once, up front, because both the
     * cheap Director step below and the `enhance` step near the end need to
     * agree on it. `shouldAttemptEnhance` (`lib/forge/decide.ts`) is the same
     * function `scripts/benchmark-10.ts` calls, so the benchmark harness and
     * this pipeline can never silently disagree about when Forge runs the
     * way they used to.
     */
    const attemptEnhance = shouldAttemptEnhance(config.experienceEngine, config.budgetTier);

    /*
     * Stage 5a. The only model call in the design path when the enhance
     * stage will not also run, and the only stage that is off by default.
     *
     * It runs as a `step` even when disabled, so the artifact exists either
     * way and records which it was. A run whose `5a-directive.json` says
     * `"enabled": false` is legible; a run with no file at all is ambiguous
     * between "the director was off" and "this ran before the director
     * existed".
     *
     * Skipped whenever `attemptEnhance` is true: `lib/forge/signature.ts`'s
     * territory-and-signature step is a grounded, richer superset of what
     * this single-prompt Director produces, and only one of the two designs
     * ends up shipping (`enhance` below either replaces `design`'s output
     * entirely or leaves it as the fallback) — paying for a directive that
     * gets discarded whenever the enhance pass succeeds is pure waste. If the
     * enhance pass then fails or is skipped mid-run, this run simply does not
     * get the Director's cheap enhancement either for that run; re-run with
     * `--from=direct` after disabling the enhance engine to get it.
     */
    const directed = await step('direct', async () => {
      if (!config.director.enabled || attemptEnhance) {
        run.logger.info('design director skipped', {
          reason: !config.director.enabled
            ? 'DIRECTOR_ENABLED is false'
            : 'experience enhance stage will run instead',
        });
        return { directive: null, provenance: null };
      }
      const result = await directDesign(
        { profile, strategy, content },
        contextFor(run, 'designDirectorAgent'),
      );
      return { directive: result.directive, provenance: result.provenance };
    });

    const design = await step('design', () =>
      designAgent.run(
        {
          profile,
          strategy,
          content,
          ...(directed.directive === null ? {} : { directive: directed.directive }),
        },
        contextFor(run, designAgent.name),
      ));

    /*
     * The Creative Director's runtime-primitive selection, resolved.
     *
     * `directiveRuntimePrimitiveIds` only checks shape (a non-empty string
     * id); `resolvePrimitives` is the actual authority — registered,
     * executable, within `RUNTIME_PRIMITIVE_BUDGET` — the same "declare a
     * name, the registry decides whether it is allowed" seam
     * `lib/design/experienceRegistry.ts` already proved for Lenis, GSAP
     * ScrollTrigger and the Three.js hero object. `NEUTRAL_ARCHITECTURE` is
     * `resolvePrimitives`' structurally-required first argument; it is never
     * actually read because `declared` is always supplied here explicitly,
     * even when empty (see that constant's own doc comment in
     * `lib/design/experience.ts`).
     *
     * Director off (the default) → `directed.directive` is `null` →
     * `directiveRuntimePrimitiveIds` returns `[]` → `resolvePrimitives`
     * returns `[]` → `renderStage` below takes its default `[]` in every
     * observable way — byte-identical to every run before this wiring
     * existed. Only an explicit, registry-valid Director selection ever
     * changes what ships.
     *
     * Deliberately not wired to the real `ExperienceArchitecture` this run
     * computed during content direction (`plan.experience`, discarded at the
     * "write" step above): reaching it here would mean carrying it across a
     * resume boundary that has no persisted carrier for it today. Since
     * `resolvePrimitives`'s architecture argument is inert whenever
     * `declared` is supplied (as it always is here), that gap costs nothing
     * for this pass; it would start to matter only for a future
     * mode-aware compatibility layer (e.g. rejecting three-js-hero-object
     * outright for a `brochure`-mode business even if requested) — see
     * `NEUTRAL_ARCHITECTURE`'s doc comment.
     */
    const resolvedRuntimePrimitives = resolvePrimitives(
      NEUTRAL_ARCHITECTURE,
      directiveRuntimePrimitiveIds(directed.directive ?? undefined, run.logger),
    );
    run.logger.info('runtime primitives resolved', {
      requested: (directed.directive?.runtimePrimitives ?? []).map((r) => r.id),
      resolved: resolvedRuntimePrimitives,
    });

    /*
     * Stage 5c (`render` + `enhance` combined into one `step`).
     *
     * `render` itself persists no artifact of its own (`ARTIFACTS.render` is
     * `null` — it is a pure, millisecond-cheap function of `content`/`design`,
     * documented above `renderStage`), so it is folded into `enhance`'s
     * `produce()` rather than given a separate resume gate: whenever this
     * `step('enhance', …)` call decides to produce (i.e. `firstIndex` is at
     * or before `enhance`), it re-renders the deterministic baseline first,
     * exactly the condition the old standalone `if (STAGES.indexOf('render')
     * >= firstIndex)` gate expressed. This is what makes `--from=enhance`
     * reproducible from artifacts alone: it never trusts whatever happened to
     * be sitting in `site/` from a previous attempt.
     *
     * `attemptEnhance` false (the €0 default) → `site/` holds exactly
     * `render`'s output, nothing else runs, and the artifact records why.
     *
     * `attemptEnhance` true → Forge builds into its own candidate directory
     * (never directly into the shared `site/` — see `ForgeOptions.siteDir`),
     * routed through this run's own capability orchestrator so
     * `BF_BUDGET_TIER` actually governs its spend and its cost lands in this
     * run's own cost report. `finalVerdict.verdict === 'PASS'`
     * (`shouldShipEnhancedSite`) copies the candidate over `site/`; `FAIL` —
     * or the pass throwing outright — leaves `render`'s deterministic output
     * as what ships. Either way the outcome is recorded, never inferred from
     * a log line.
     */
    await step('enhance', async () => {
      await renderStage(run, content, design, resolvedRuntimePrimitives, profile.coordinates?.value ?? null);

      if (!attemptEnhance) {
        const reason = config.experienceEngine !== 'signature' ? 'engine=template' : 'tier0 budget';
        run.logger.info('experience enhance skipped', { reason });
        return { attempted: false, shipped: false, reason };
      }

      const candidateSiteDir = path.join(run.outputDir, 'forge', 'site-candidate');
      try {
        const { runExperienceForge } = await import('./lib/forge/orchestrator.js');
        const { shouldShipEnhancedSite } = await import('./lib/forge/decide.js');
        const forgeResult = await runExperienceForge({
          runId: run.runId,
          outputDir: config.outputDir,
          profile,
          autoOpen: false,
          siteDir: candidateSiteDir,
          routing: { capabilities: run.platform.capabilities, providers: run.platform.providers },
        });

        if (shouldShipEnhancedSite(forgeResult.finalVerdict)) {
          const targetSiteDir = path.join(run.outputDir, SITE_DIR_NAME);
          await fs.cp(candidateSiteDir, targetSiteDir, { recursive: true, force: true });
          run.logger.info('experience enhance shipped', {
            territoryId: forgeResult.signature.selectedTerritoryId,
            verdict: forgeResult.finalVerdict.verdict,
            quality: forgeResult.finalVerdict.quality,
          });
          return {
            attempted: true,
            shipped: true,
            territoryId: forgeResult.signature.selectedTerritoryId,
            selectionRationale: forgeResult.signature.selectionRationale,
            verdict: forgeResult.finalVerdict.verdict,
            quality: forgeResult.finalVerdict.quality,
          };
        }

        run.logger.info('experience enhance did not pass verdict; keeping deterministic baseline', {
          verdict: forgeResult.finalVerdict.verdict,
          blockingFailure: forgeResult.finalVerdict.blockingFailure,
        });
        return {
          attempted: true,
          shipped: false,
          reason: forgeResult.finalVerdict.blockingFailure ?? forgeResult.finalVerdict.uncertain ?? 'verdict FAIL',
          verdict: forgeResult.finalVerdict.verdict,
        };
      } catch (err: unknown) {
        run.logger.warn('experience enhance failed; keeping deterministic baseline', {
          error: err instanceof Error ? err.message : String(err),
        });
        return {
          attempted: true,
          shipped: false,
          reason: err instanceof Error ? err.message : String(err),
        };
      }
    });

    /*
     * Stage 6. Skipped when nothing is configured to deploy to.
     *
     * The key is the switch, as it is for the Places source: two ways to be
     * switched off is one way too many. Without this the pipeline spends every
     * model call it needs, renders a working site, and *then* dies on a stage
     * nobody asked for — which is an expensive way to learn that
     * `LOVABLE_API_KEY` is unset.
     */
    const deployment = await step('deploy', async () => {
      // The deploy agent decides its own skip: it deploys to Netlify when
      // NETLIFY_DEPLOY_TOKEN is set, and returns `skipped` (never `failed`)
      // otherwise — so a working site is never recorded as broken just because
      // no host was configured. (The old `LOVABLE_API_KEY` gate is gone with
      // the Lovable stub; see agents/lovableAgent.ts.)
      return lovableAgent.run(content, contextFor(run, lovableAgent.name));
    });

    const result: PipelineResult = {
      runId,
      input,
      discovery,
      collected,
      profile,
      strategy,
      content,
      design,
      deployment,
      startedAt,
      finishedAt: new Date().toISOString(),
    };

    await persistStage(run, 'result', result);
    run.logger.info('pipeline finished', { liveUrl: deployment.liveUrl });

    // The terminal JobState write: `stage`/`decision`/`finalOutput` together
    // are what a resumed or externally-observed job reads to know this run
    // actually finished, not merely that its last stage happened to be
    // 'deploy'. `finalOutput` prefers the live URL, the thing a delivered
    // job is actually for; a run with no deploy target configured (Netlify
    // token unset, `deployment.status === 'skipped'`) still finishes with a
    // real, inspectable local site, so it falls back to that path rather
    // than recording nothing.
    await saveJob(run.outputDir, {
      stage: 'delivery',
      decision: 'deliver',
      finalOutput: deployment.liveUrl ?? path.join(run.outputDir, SITE_DIR_NAME, 'index.html'),
    });

    return result;
  } catch (error) {
    // A stage failure must be visible on the persisted job, not only in the
    // log file — the whole point of feeding JobState from this pipeline is
    // that a failure is observable without reading `run.log.ndjson`. Best
    // effort: if the job itself cannot be loaded/saved (a disk error on top
    // of the original failure), the original error is still what the caller
    // sees; it is never masked by a secondary failure here.
    const message = error instanceof Error ? error.message : String(error);
    try {
      const existing = await loadJob(run.outputDir);
      await saveJob(run.outputDir, { errors: [...(existing?.errors ?? []), message] });
    } catch (saveError) {
      run.logger.warn('failed to record the run error on JobState', {
        error: saveError instanceof Error ? saveError.message : String(saveError),
      });
    }
    throw error;
  } finally {
    // Written whether the run succeeded or threw — a failed run still spent
    // whatever it spent before it failed, and that is exactly when "what did
    // this cost" matters most. A report-write failure never masks the run's
    // real outcome: it is logged and swallowed, not rethrown.
    try {
      await writeCostReport(run.outputDir, run.platform.capabilities.spend());
    } catch (error) {
      run.logger.warn('cost report could not be written', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await run.dispose();
  }
}

export async function runPipeline(input: DiscoveryInput, config: AppConfig): Promise<PipelineResult> {
  return executePipeline(config, { runId: randomUUID().slice(0, 8), input, from: 'discovery' });
}

/**
 * Re-runs an existing run from `from` onwards, in place.
 *
 * In place, and deliberately: the collector's images live in
 * `output/<runId>/assets/`, and the renderer resolves every asset path against
 * the run directory. A resumed run that wrote somewhere else would render a
 * site with no pictures in it.
 *
 * The consequence is that the artifacts from `from` onwards are overwritten.
 * That is the point — they are the ones being worked on — but a strategy or a
 * spec worth keeping should be copied out of the folder before resuming over it.
 */
export async function resumePipeline(
  runId: string,
  from: StageName,
  config: AppConfig,
): Promise<PipelineResult> {
  if (from === 'discovery') {
    throw new InvalidInputError(
      'Resuming from "discovery" would re-run the whole pipeline; drop --from and pass a Maps URL.',
      SOURCE,
    );
  }

  const outputDir = path.join(config.outputDir, runId);

  // Checked before anything is read, so a mistyped run id says so instead of
  // reporting a missing stage-1 artifact — and before a log file and a platform
  // are built for a run that does not exist.
  try {
    await fs.access(outputDir);
  } catch (error) {
    throw new InvalidInputError(`No run "${runId}" in ${config.outputDir}`, SOURCE, error);
  }

  // Read for the original Maps URL, which the resumed stages never see.
  const discovery = await readArtifact<{ sourceUrl: string }>(outputDir, 'discovery');

  return executePipeline(config, { runId, input: { mapsUrl: discovery.sourceUrl }, from });
}

/**
 * Stages 1–3 only: a Maps URL becomes `3-profile.json`, and nothing else runs.
 *
 * The factory needs exactly this much of the pipeline. `build` starts from a
 * profile, so an order that has been researched into a search query needs the
 * evidence half — discovery, collection, normalisation — and none of the
 * generation half, which the production loop owns and iterates on its own terms.
 *
 * `executePipeline` cannot express it: it runs `from` a stage to the end, and
 * there is no `to`. Rather than add a bound that every existing caller would
 * have to reason about, this runs the same three agents through the same run
 * scaffolding and persists the same three artifacts — so a profile sourced by
 * the factory is byte-for-byte the kind `--from=analyze` and `--compose`
 * already accept.
 *
 * The URL may be a *search* rather than a place: `discoveryAgent` opens the
 * first result of a result feed, which is what lets an order name a trade and a
 * city instead of a business.
 */
export async function acquireProfile(
  runId: string,
  input: DiscoveryInput,
  config: AppConfig,
): Promise<{ profile: BusinessProfile; outputDir: string; sourceUrl: string }> {
  const run = await createRun(config, runId);
  try {
    run.logger.info('sourcing started', { runId, mapsUrl: input.mapsUrl });

    const discovery = await discoveryAgent.run(input, contextFor(run, discoveryAgent.name));
    await persistStage(run, ARTIFACTS.discovery, discovery);

    const collected = await collectorAgent.run(discovery, contextFor(run, collectorAgent.name));
    await persistStage(run, ARTIFACTS.collect, collected);

    const profile = await normalizerAgent.run(
      { discovery, collected, sources: collected.provenanceSources },
      contextFor(run, normalizerAgent.name),
    );
    await persistStage(run, ARTIFACTS.normalize, profile);

    run.logger.info('sourcing finished', {
      runId,
      business: profile.name.value,
      sources: profile.sources.length,
    });

    return { profile, outputDir: run.outputDir, sourceUrl: discovery.canonicalUrl };
  } finally {
    await run.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const USAGE = [
  'Usage:',
  '  website-agent <google-maps-url>              run the pipeline',
  '  website-agent --from=<stage> <runId>         re-run an existing run from a stage,',
  '                                               reading earlier stages off disk',
  '  website-agent --discovery-only <maps-url>    stage 1 only, JSON to stdout',
  '  website-agent --render [--out=<dir>] <content.json>',
  '                                               render a saved spec to a site',
  '  website-agent --compose <runId>              build a page from verified data only,',
  '                                               no model call, then render it',
  '',
  `Stages: ${STAGES.join(', ')}`,
].join('\n');

/**
 * What the CLI was asked to do.
 *
 * A union rather than a bag of booleans: the modes take different arguments,
 * and this makes it impossible to reach `runPipeline` holding a path to a JSON
 * file, or `resumePipeline` holding a Maps URL.
 */
type CliArgs =
  | { readonly mode: 'pipeline'; readonly input: DiscoveryInput }
  | { readonly mode: 'resume'; readonly runId: string; readonly from: StageName }
  | { readonly mode: 'discovery'; readonly input: DiscoveryInput }
  | { readonly mode: 'render'; readonly contentPath: string; readonly outDir: string | null }
  | { readonly mode: 'compose'; readonly runId: string };

/** Reads `--name=value`, trimmed; `undefined` when the flag is absent. */
function flagValue(flags: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return flags.find((flag) => flag.startsWith(prefix))?.slice(prefix.length).trim();
}

function parseArgs(argv: readonly string[]): CliArgs {
  const flags = argv.filter((arg) => arg.startsWith('--'));
  const positional = argv.find((arg) => !arg.startsWith('--'));

  // `--out=<dir>` rather than `--out <dir>`, so the only bare argument is
  // always the thing being operated on.
  const out = flagValue(flags, 'out');
  const from = flagValue(flags, 'from');

  if (positional === undefined || positional === '') {
    throw new InvalidInputError(USAGE, SOURCE);
  }

  if (from !== undefined) {
    if (!isStageName(from)) {
      throw new InvalidInputError(
        `Unknown stage "${from}". --from takes one of: ${STAGES.join(', ')}.`,
        SOURCE,
      );
    }
    return { mode: 'resume', runId: positional, from };
  }
  if (flags.includes('--compose')) {
    return { mode: 'compose', runId: positional };
  }
  if (flags.includes('--render')) {
    return { mode: 'render', contentPath: positional, outDir: out ? out : null };
  }
  if (flags.includes('--discovery-only')) {
    return { mode: 'discovery', input: { mapsUrl: positional } };
  }
  return { mode: 'pipeline', input: { mapsUrl: positional } };
}

/**
 * Checks that a JSON file read off disk is shaped like a `WebsiteContent`.
 *
 * A structural check, not a schema: the fields the renderer indexes into must
 * exist and have the right kind, so a truncated or wrong file fails here with a
 * sentence rather than deep inside a section renderer with a `TypeError`.
 */
function assertWebsiteContent(value: unknown, filePath: string): asserts value is WebsiteContent {
  const record = value as Record<string, unknown> | null;
  const problem =
    typeof record !== 'object' || record === null ? 'is not a JSON object'
      : typeof record.businessName !== 'string' ? 'has no string businessName'
      : typeof record.tagline !== 'string' ? 'has no string tagline'
      : typeof record.voice !== 'object' || record.voice === null ? 'has no voice'
      : !Array.isArray(record.sections) ? 'has no sections array'
      : typeof record.seo !== 'object' || record.seo === null ? 'has no seo'
      : null;

  if (problem !== null) {
    throw new InvalidInputError(`${filePath} ${problem}; expected a WebsiteContent spec`, SOURCE);
  }
}

/** Filename a run's design is persisted under. */
const DESIGN_FILE = '5b-design.json';

/**
 * Loads `5b-design.json` from a run folder, if it is there.
 *
 * Absence is the normal case for a hand-written spec and is not an error. A
 * file that is present but unreadable is: a design that exists and was silently
 * skipped would render a different site with no indication why.
 */
async function loadDesignBeside(dir: string): Promise<WebsiteDesign | null> {
  const filePath = path.join(dir, DESIGN_FILE);

  let raw: string;
  try {
    raw = await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !('tokens' in parsed)) {
      throw new Error('missing tokens');
    }
    return parsed as WebsiteDesign;
  } catch (error) {
    throw new InvalidInputError(`${filePath} is not a valid WebsiteDesign`, SOURCE, error);
  }
}

/**
 * Renders a saved `content.json` without running the pipeline.
 *
 * The fast loop for working on the renderer, and the way to re-render a run
 * after a template change without paying for discovery, collection and two
 * model calls again. Assets are resolved relative to the spec's own folder,
 * which is where the collector put them.
 */
export async function renderStandalone(
  contentPath: string,
  outDir: string | null,
): Promise<{ targetDir: string; written: readonly string[]; warnings: readonly string[] }> {
  const resolvedPath = path.resolve(contentPath);
  const raw = await fs.readFile(resolvedPath, 'utf8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new InvalidInputError(`${resolvedPath} is not valid JSON`, SOURCE, error);
  }
  assertWebsiteContent(parsed, resolvedPath);

  const sourceDir = path.dirname(resolvedPath);
  const targetDir = outDir === null ? path.join(sourceDir, SITE_DIR_NAME) : path.resolve(outDir);

  // A run persists its design beside its content. Picking it up here is what
  // makes re-rendering a saved run reproduce that run rather than a default
  // one; without it the renderer falls back to `BrandVoice`, which is still a
  // valid site and is what a hand-written spec gets.
  const design = await loadDesignBeside(sourceDir);

  const site = renderSite(parsed, design === null ? {} : { design });
  const { written, missingAssets } = await writeRenderedSite(site, { sourceDir, targetDir });

  const warnings = [
    ...site.warnings,
    ...missingAssets.map((asset) => `asset not found in ${sourceDir}: ${asset}`),
  ];
  return { targetDir, written, warnings };
}

/**
 * Runs the Content Director over a written page.
 *
 * One function, called from both paths into a page — the model writer's and the
 * composer's — so a composed page and a written one are directed identically
 * and neither can drift into being a second, quietly different pipeline. That
 * is the same reason `assembleContent` is a free function.
 *
 * The plan is derived here, from the *undirected* content, and handed to both
 * the director and the composer. See `lib/design/plan.ts` for why it is derived
 * once rather than twice.
 */
export function directPageCopy(
  profile: BusinessProfile,
  written: WebsiteContent,
  strategy?: BusinessStrategy,
): { content: WebsiteContent; plan: NarrativePlan; audit: ContentAudit } {
  const plan = planNarrative(profile, written, {
    ...(strategy === undefined
      ? {}
      : { categories: [strategy.category.primary, ...strategy.category.secondary] }),
  });
  const directed = directContent(profile, written, plan);
  const audit = auditContent({
    content: directed.content,
    evidence: directed.evidence,
    roles: plan.roles,
    conversion: plan.conversion,
  });
  return { content: directed.content, plan, audit };
}

/**
 * Composes a run's page from its profile alone, then renders it.
 *
 * No provider, no key, no network. It reads `3-profile.json`, writes the same
 * `5-content.json` the writer would have written, and renders beside it — so
 * the artifact is a first-class spec that `--render` and the design stage
 * treat identically to a model-written one.
 *
 * The point is that a business that has been collected always has a page.
 * Before this, an upstream rate limit meant no output at all rather than a
 * plainer one, and that is not a property a platform selling websites can have.
 */
export async function composeStandalone(
  runId: string,
  config: AppConfig,
): Promise<{ targetDir: string; content: WebsiteContent; warnings: readonly string[] }> {
  const outputDir = path.join(config.outputDir, runId);
  try {
    await fs.access(outputDir);
  } catch (error) {
    throw new InvalidInputError(`No run "${runId}" in ${config.outputDir}`, SOURCE, error);
  }

  const profile = await readArtifact<BusinessProfile>(outputDir, 'normalize');
  const { content, plan, audit } = directPageCopy(profile, composeBaseline(profile));

  await fs.writeFile(
    path.join(outputDir, `${ARTIFACTS.write}.json`),
    `${JSON.stringify(content, null, 2)}\n`,
    'utf8',
  );

  // Design is deterministic and needs no model, so a composed page gets the
  // same art direction a model-written one does. It was previously unreachable
  // here only because `composeDesign` demanded a whole `BusinessStrategy` for
  // the two category strings it actually reads — which is how a page came to be
  // generated with the design layer switched off and nobody noticed.
  // Always recomposed, never loaded. The design is deterministic and free, so
  // reusing a persisted one only means a change to the design layer silently
  // does not apply — which is exactly what happened the first time this ran.
  // `--render` still honours a saved design, because reproducing an old run is
  // that command's whole purpose.
  // Read once per run and cached beside the artifacts, so recomposing stays
  // instant. A business with no downloaded photographs gets `null` here and the
  // industry's colour, exactly as before.
  const seed = await brandSeedFor(profile, outputDir);

  const design = composeDesign({ profile, content }, { photographicSeed: seed.hex, plan });
  await fs.writeFile(
    path.join(outputDir, `${ARTIFACTS.design}.json`),
    `${JSON.stringify(design, null, 2)}\n`,
    'utf8',
  );

  // The runtime declaration: a closed-vocabulary name (RuntimePrimitiveId),
  // derived deterministically from the Experience Architecture already
  // computed above — never a style, a duration, or a selector. The renderer
  // (lib/render/runtime-rules.ts) owns the one implementation behind each
  // name; nothing here, and nothing upstream of it, ever writes CSS/JS.
  const runtimeEngaged = plan.experience.mode === 'narrative' && plan.character.visualWeight === 'image-led';
  const site = renderSite(content, {
    design,
    runtime: runtimeEngaged ? 'scroll-progress' : 'none',
    runtimePrimitives: runtimeEngaged ? resolvePrimitives(plan.experience) : [],
  });
  const targetDir = path.join(outputDir, SITE_DIR_NAME);
  const { missingAssets } = await writeRenderedSite(site, { sourceDir: outputDir, targetDir });

  return {
    targetDir,
    content,
    warnings: [
      ...site.warnings,
      ...missingAssets.map((asset) => `asset not found in ${outputDir}: ${asset}`),
      // Content defects are reported beside render warnings rather than thrown:
      // a page with a weak heading is still a page, and hiding the finding
      // would make the gate decorative.
      ...audit.issues.map((issue) => `content ${issue.severity} (${issue.kind}): ${issue.message}`),
    ],
  };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === 'compose') {
    const { targetDir, content, warnings } = await composeStandalone(args.runId, config);
    for (const warning of warnings) process.stderr.write(`warning: ${warning}\n`);
    process.stdout.write(
      `${content.sections.length} sections, ` +
        `${content.sections.reduce((total, section) => total + section.images.length, 0)} images, ` +
        `${content.trust.length} trust signals\n` +
        `${path.join(targetDir, 'index.html')}\n`,
    );
    return;
  }

  if (args.mode === 'render') {
    const { targetDir, warnings } = await renderStandalone(args.contentPath, args.outDir);
    for (const warning of warnings) process.stderr.write(`warning: ${warning}\n`);
    process.stdout.write(`${path.join(targetDir, 'index.html')}\n`);
    return;
  }

  if (args.mode === 'discovery') {
    const discovery = await discoverStandalone(args.input.mapsUrl, config);
    process.stdout.write(`${JSON.stringify(discovery, null, 2)}\n`);
    return;
  }

  const result = args.mode === 'resume'
    ? await resumePipeline(args.runId, args.from, config)
    : await runPipeline(args.input, config);
  process.stdout.write(`${result.deployment.liveUrl ?? '(no live url)'}\n`);
}

// Only run when invoked directly, so this module stays importable.
const invokedPath = process.argv[1];
if (invokedPath && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof AgentError
      ? `[${error.source}] ${error.message}`
      : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
