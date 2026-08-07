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
import { writerAgent } from './agents/writerAgent.js';
import { designAgent } from './agents/designAgent.js';
import { lovableAgent } from './agents/lovableAgent.js';

import { loadConfig } from './lib/config.js';
import { createConsoleSink, createFileSink, createLogger, createMultiSink } from './lib/logger.js';
import { createBrowserSession } from './lib/browser.js';
import { createPlatform } from './lib/platform/platform.js';
import { renderSite, writeRenderedSite } from './lib/render/index.js';
import { AgentError, InvalidInputError } from './lib/errors.js';

import type { AppConfig } from './lib/config.js';
import type { Logger } from './lib/logger.js';
import type { BrowserSession } from './lib/browser.js';
import type { Platform } from './lib/platform/platform.js';
import type {
  AgentContext,
  DiscoveryInput,
  PipelineResult,
  WebsiteContent,
  WebsiteDesign,
} from './lib/types.js';

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
  design: ['version', 'tokens', 'layout'],
  render: [],
  deploy: ['projectId', 'status'],
} as const satisfies Record<StageName, readonly string[]>;

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
  return record as T;
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
      normalizerAgent.run({ discovery, collected }, contextFor(run, normalizerAgent.name)));

    const strategy = await step('analyze', () =>
      businessAnalystAgent.run(profile, contextFor(run, businessAnalystAgent.name)));

    const content = await step('write', () =>
      writerAgent.run({ profile, strategy }, contextFor(run, writerAgent.name)));

    const design = await step('design', () =>
      designAgent.run({ profile, strategy, content }, contextFor(run, designAgent.name)));

    // Not a `step`: it persists no artifact, so there is nothing to load. It is
    // cheap and deterministic, so it re-runs whenever it is not being skipped.
    if (STAGES.indexOf('render') >= firstIndex) {
      await renderStage(run, content, design);
    }

    const deployment = await step('deploy', () =>
      lovableAgent.run(content, contextFor(run, lovableAgent.name)));

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
  | { readonly mode: 'render'; readonly contentPath: string; readonly outDir: string | null };

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

async function main(): Promise<void> {
  const config = loadConfig();
  const args = parseArgs(process.argv.slice(2));

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
