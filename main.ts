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
import { writerAgent } from './agents/writerAgent.js';
import { lovableAgent } from './agents/lovableAgent.js';

import { loadConfig } from './lib/config.js';
import { createConsoleSink, createFileSink, createLogger, createMultiSink } from './lib/logger.js';
import { createBrowserSession } from './lib/browser.js';
import { AgentError, InvalidInputError } from './lib/errors.js';

import type { AppConfig } from './lib/config.js';
import type { Logger } from './lib/logger.js';
import type { BrowserSession } from './lib/browser.js';
import type { AgentContext, DiscoveryInput, PipelineResult } from './lib/types.js';

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

  return {
    runId,
    config,
    logger,
    outputDir,
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
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

export async function runPipeline(input: DiscoveryInput, config: AppConfig): Promise<PipelineResult> {
  const runId = randomUUID().slice(0, 8);
  const startedAt = new Date().toISOString();
  const run = await createRun(config, runId);

  run.logger.info('pipeline started', { runId, mapsUrl: input.mapsUrl });

  try {
    const discovery = await discoveryAgent.run(input, contextFor(run, discoveryAgent.name));
    await persistStage(run, '1-discovery', discovery);

    const collected = await collectorAgent.run(discovery, contextFor(run, collectorAgent.name));
    await persistStage(run, '2-collected', collected);

    const profile = await normalizerAgent.run(
      { discovery, collected },
      contextFor(run, normalizerAgent.name),
    );
    await persistStage(run, '3-profile', profile);

    const content = await writerAgent.run(profile, contextFor(run, writerAgent.name));
    await persistStage(run, '4-content', content);

    const deployment = await lovableAgent.run(content, contextFor(run, lovableAgent.name));
    await persistStage(run, '5-deployment', deployment);

    const result: PipelineResult = {
      runId,
      input,
      discovery,
      collected,
      profile,
      content,
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

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

interface CliArgs {
  readonly input: DiscoveryInput;
  /** Runs stage 1 and stops — the only stage implemented so far. */
  readonly discoveryOnly: boolean;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const flags = argv.filter((arg) => arg.startsWith('--'));
  const mapsUrl = argv.find((arg) => !arg.startsWith('--'));

  if (!mapsUrl) {
    throw new InvalidInputError(
      'Usage: website-agent [--discovery-only] <google-maps-url>',
      SOURCE,
    );
  }
  return { input: { mapsUrl }, discoveryOnly: flags.includes('--discovery-only') };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const { input, discoveryOnly } = parseArgs(process.argv.slice(2));

  if (discoveryOnly) {
    const discovery = await discoverStandalone(input.mapsUrl, config);
    process.stdout.write(`${JSON.stringify(discovery, null, 2)}\n`);
    return;
  }

  const result = await runPipeline(input, config);
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
