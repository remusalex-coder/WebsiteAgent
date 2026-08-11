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
import {
  applyAnswerFile,
  createHermesClient,
  emptyArtifact,
  hermesClientFor,
  listRequests,
  listSubjects,
  loadArtifact,
  openRequest,
  researchBrief,
  slugify,
} from './lib/research/index.js';
import { AgentError, InvalidInputError } from './lib/errors.js';

import type { AppConfig } from './lib/config.js';
import type { Logger } from './lib/logger.js';
import type { BrowserSession } from './lib/browser.js';
import type { Platform } from './lib/platform/platform.js';
import type { HermesClient, ResearchSubject } from './lib/research/index.js';
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
  'Research handoff (Claude ↔ Hermes):',
  '  website-agent --research <key>               print the research brief — start here',
  '  website-agent --research --ask="…" [--fields=a,b] [--notes="…"]',
  '                [--name="…"] [--locality=…] [--homepage=…] [--maps=…] <key>',
  '                                               file a request; answer it if Hermes is reachable',
  '  website-agent --research-apply <delta.json>  merge an answer that arrived out of band',
  '  website-agent --research-list                subjects on disk and questions still open',
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
  | ResearchAskArgs
  | { readonly mode: 'research-show'; readonly key: string }
  | { readonly mode: 'research-apply'; readonly deltaPath: string }
  | { readonly mode: 'research-list' };

/**
 * Asking for research.
 *
 * `flags` is carried through rather than being unpacked here because the subject
 * fields are only needed when no artifact exists yet, and that is a question
 * only the filesystem can answer.
 */
interface ResearchAskArgs {
  readonly mode: 'research-ask';
  readonly key: string;
  readonly ask: string;
  readonly fields: readonly string[];
  readonly notes: string | null;
  readonly flags: readonly string[];
}

/** Reads `--name=value`, trimmed; `undefined` when the flag is absent. */
function flagValue(flags: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return flags.find((flag) => flag.startsWith(prefix))?.slice(prefix.length).trim();
}

/** Reads `--name=a,b,c` into a trimmed list. Absent or empty gives `[]`. */
function flagList(flags: readonly string[], name: string): readonly string[] {
  const raw = flagValue(flags, name);
  if (raw === undefined || raw === '') return [];
  return raw.split(',').map((entry) => entry.trim()).filter((entry) => entry !== '');
}

function parseArgs(argv: readonly string[]): CliArgs {
  const flags = argv.filter((arg) => arg.startsWith('--'));
  const positional = argv.find((arg) => !arg.startsWith('--'));

  // `--out=<dir>` rather than `--out <dir>`, so the only bare argument is
  // always the thing being operated on.
  const out = flagValue(flags, 'out');
  const from = flagValue(flags, 'from');

  // The one mode that operates on nothing in particular, so it is settled
  // before the positional argument is required.
  if (flags.includes('--research-list')) return { mode: 'research-list' };

  if (positional === undefined || positional === '') {
    throw new InvalidInputError(USAGE, SOURCE);
  }

  if (flags.includes('--research-apply')) {
    return { mode: 'research-apply', deltaPath: positional };
  }

  if (flags.includes('--research')) {
    // The key is a slug, and a caller who typed a business name rather than one
    // should get the artifact they meant instead of a second identity for the
    // same business under a key that will never match again.
    const key = slugify(positional);
    const ask = flagValue(flags, 'ask');

    if (ask === undefined || ask === '') return { mode: 'research-show', key };

    return {
      mode: 'research-ask',
      key,
      ask,
      fields: flagList(flags, 'fields'),
      notes: flagValue(flags, 'notes') ?? null,
      flags,
    };
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

/* ------------------------------------------------------------------ */
/* Research handoff                                                    */
/* ------------------------------------------------------------------ */

/**
 * Builds the client that may answer a research request inside this session.
 *
 * The platform is built **only** when a Hermes server is actually declared in
 * `MCP_SERVERS`. Booting it to discover that nothing is registered would cost a
 * skill-discovery pass to learn what configuration already says, and the
 * transport-less client is not a degraded stand-in — it is the correct answer
 * when there is nothing to talk to.
 */
async function researchClient(
  config: AppConfig,
  signal: AbortSignal,
): Promise<{ client: HermesClient; dispose: () => Promise<void> }> {
  const declared = config.mcp.servers.some((server) => server.id === config.research.serverId);
  if (!declared) {
    return { client: createHermesClient({ transport: null }), dispose: async () => {} };
  }

  const logger = createLogger({
    level: config.logLevel,
    scope: 'research',
    sink: createConsoleSink(),
  });
  const platform = await createPlatform({
    config,
    logger,
    signal,
    outputDir: config.outputDir,
  });

  return {
    client: hermesClientFor(platform.mcp, config.research.serverId),
    dispose: () => platform.dispose(),
  };
}

/**
 * Resolves the subject a request is about.
 *
 * An existing artifact settles it: the subject is part of the record and must
 * not drift between passes, or two revisions of one business end up under two
 * identities. A first request has to be told the name, because deriving one from
 * a slug would guess at a customer's own spelling.
 */
async function subjectFor(
  config: AppConfig,
  key: string,
  flags: readonly string[],
): Promise<ResearchSubject> {
  const existing = await loadArtifact(config.research.dir, key);
  if (existing !== null) return existing.subject;

  const name = flagValue(flags, 'name');
  if (name === undefined || name === '') {
    throw new InvalidInputError(
      `No research artifact for "${key}" yet, so this is a first request and needs the ` +
        'business name: add --name="…" (and optionally --locality, --homepage, --maps).',
      SOURCE,
    );
  }

  return {
    key,
    name,
    locality: flagValue(flags, 'locality') ?? null,
    homepage: flagValue(flags, 'homepage') ?? null,
    mapsUrl: flagValue(flags, 'maps') ?? null,
  };
}

/**
 * Files a research request, and reports exactly what happened to it.
 *
 * The output distinguishes three outcomes that a single "done" would blur:
 * answered now, filed and waiting because nothing could answer it, and filed
 * again because the same question was already open. Only the first means
 * evidence changed.
 */
async function researchAsk(config: AppConfig, args: ResearchAskArgs): Promise<void> {
  const controller = new AbortController();
  const { client, dispose } = await researchClient(config, controller.signal);

  try {
    const result = await openRequest({
      root: config.research.dir,
      subject: await subjectFor(config, args.key, args.flags),
      query: args.ask,
      fields: args.fields,
      notes: args.notes,
      now: new Date().toISOString(),
      client,
      signal: controller.signal,
    });

    const out = process.stdout;
    out.write(`request ${result.request.requestId}\n`);
    out.write(`filed    ${result.requestPath}\n`);
    if (result.alreadyOpen) out.write('note     this question was already open; re-filed, not duplicated\n');

    if (result.answered !== null) {
      const { delta, answerPath, artifactPath, applied } = result.answered;
      out.write(`answered ${delta.researchedAt} by ${delta.researcher}\n`);
      out.write(`receipt  ${answerPath}\n`);
      out.write(
        applied
          ? `artifact ${artifactPath} (revision ${result.artifact.revision})\n`
          : `artifact unchanged — this pass was already recorded\n`,
      );
      out.write(`\n${delta.handoff}\n`);
      return;
    }

    if (result.unanswered !== null) {
      process.stderr.write(`unanswered: ${result.unanswered.message}\n`);
    }

    // Printed rather than merely stored: this is what a human or an out-of-band
    // Hermes needs, and making them open a file to find it is friction the
    // handoff does not need.
    out.write(`\n${result.prompt}\n`);
  } finally {
    await dispose();
  }
}

/** Prints what a session opening cold should read before doing anything else. */
async function researchShow(config: AppConfig, key: string): Promise<void> {
  const artifact = await loadArtifact(config.research.dir, key);
  if (artifact === null) {
    const known = await listSubjects(config.research.dir);
    throw new InvalidInputError(
      `No research artifact for "${key}" in ${config.research.dir}. ` +
        (known.length === 0 ? 'None exist yet.' : `Known subjects: ${known.join(', ')}.`),
      SOURCE,
    );
  }
  process.stdout.write(`${researchBrief(artifact)}\n`);
}

/** Subjects on disk and questions still waiting for an answer. */
async function researchList(config: AppConfig): Promise<void> {
  const [subjects, requests] = await Promise.all([
    listSubjects(config.research.dir),
    listRequests(config.research.dir),
  ]);

  const out = process.stdout;
  out.write(`research root: ${config.research.dir}\n\n`);

  out.write(`subjects (${subjects.length})\n`);
  for (const key of subjects) {
    const artifact = (await loadArtifact(config.research.dir, key)) ?? emptyArtifact({
      key, name: key, locality: null, homepage: null, mapsUrl: null,
    });
    out.write(
      `  ${key} — revision ${artifact.revision}, ${artifact.claims.length} claims, ` +
        `${artifact.conflicts.length} conflicts, ${artifact.gaps.length} gaps\n`,
    );
  }

  out.write(`\nopen requests (${requests.length})\n`);
  for (const request of requests) {
    out.write(
      `  ${request.requestId} — ${request.subject.key} — ${request.scope.query}\n`,
    );
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === 'research-ask') return researchAsk(config, args);
  if (args.mode === 'research-show') return researchShow(config, args.key);
  if (args.mode === 'research-list') return researchList(config);

  if (args.mode === 'research-apply') {
    const result = await applyAnswerFile({ root: config.research.dir, deltaPath: args.deltaPath });
    process.stdout.write(
      result.applied
        ? `${result.artifactPath} — revision ${result.artifact.revision}, ` +
          `${result.artifact.claims.length} claims, ${result.artifact.conflicts.length} conflicts\n`
        : `${result.artifactPath} unchanged — this pass was already recorded\n`,
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
