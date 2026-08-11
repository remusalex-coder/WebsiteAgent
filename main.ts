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
import { renderSite, writeRenderedSite } from './lib/render/index.js';
import { brandSeedFor } from './lib/art/seed.js';
import { composeDesign } from './lib/design/compose.js';
import { planNarrative } from './lib/design/plan.js';
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
  deploy: {},
} as const satisfies Record<StageName, Readonly<Record<string, unknown>>>;

function isStageName(value: string): value is StageName {
  return (STAGES as readonly string[]).includes(value);
}

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
async function renderStage(run: Run, content: WebsiteContent, design: WebsiteDesign): Promise<string> {
  const site = renderSite(content, { design });
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

  /** Runs a stage and persists it, or loads what an earlier run left behind. */
  async function step<T>(name: StageName, produce: () => Promise<T>): Promise<T> {
    if (STAGES.indexOf(name) < firstIndex) {
      const loaded = await readArtifact<T>(run.outputDir, name);
      run.logger.info('stage loaded from artifacts', { stage: name });
      return loaded;
    }
    const value = await produce();
    const base = ARTIFACTS[name];
    if (base !== null) await persistStage(run, base, value);
    return value;
  }

  run.logger.info(from === 'discovery' ? 'pipeline started' : 'pipeline resumed', {
    runId,
    from,
    mapsUrl: input.mapsUrl,
  });

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
     * Stage 5a. The only model call in the design path, and the only stage
     * that is off by default.
     *
     * It runs as a `step` even when disabled, so the artifact exists either
     * way and records which it was. A run whose `5a-directive.json` says
     * `"enabled": false` is legible; a run with no file at all is ambiguous
     * between "the director was off" and "this ran before the director
     * existed".
     */
    const directed = await step('direct', async () => {
      if (!config.director.enabled) {
        run.logger.info('design director skipped', { reason: 'DIRECTOR_ENABLED is false' });
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

    // Not a `step`: it persists no artifact, so there is nothing to load. It is
    // cheap and deterministic, so it re-runs whenever it is not being skipped.
    if (STAGES.indexOf('render') >= firstIndex) {
      await renderStage(run, content, design);
    }

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
      if (config.lovable.apiKey === '') {
        run.logger.warn('deployment skipped', {
          reason: 'LOVABLE_API_KEY is not set; the rendered site is the run output',
        });
        return {
          projectId: '',
          liveUrl: null,
          editorUrl: null,
          status: 'skipped',
          promptUsed: 'LOVABLE_API_KEY is not set, so no deployment was attempted.',
          deployedAt: new Date().toISOString(),
        } satisfies DeploymentResult;
      }
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

    return result;
  } finally {
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

  const site = renderSite(content, { design });
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
