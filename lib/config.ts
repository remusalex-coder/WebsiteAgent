/**
 * Typed configuration. The only module permitted to read `process.env`.
 *
 * Everything else receives an `AppConfig` through `AgentContext`, so an agent
 * can be run against any configuration without touching the environment.
 */

import path from 'node:path';

import { InvalidInputError } from './errors.js';

const SOURCE = 'config';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error', 'silent'];

export interface BrowserConfig {
  readonly headless: boolean;
  /** Per-navigation and per-selector timeout, in milliseconds. */
  readonly timeoutMs: number;
  readonly locale: string;
  readonly userAgent: string | null;
  /** Optional proxy for geo-sensitive Maps results. */
  readonly proxyUrl: string | null;
}

export interface CollectorConfig {
  /** Upper bound on pages crawled per site, homepage included. */
  readonly maxPages: number;
  /** Upper bound on images downloaded per run. */
  readonly maxImages: number;
  /** Below this, a file is a tracking pixel or spacer rather than content. */
  readonly minAssetBytes: number;
  readonly maxAssetBytes: number;
  /** Folder under `outputDir` that downloaded images are written to. */
  readonly assetDirName: string;
}

export interface WriterConfig {
  /** Empty until the writer stage is implemented; asserted at point of use. */
  readonly apiKey: string;
  readonly model: string;
  readonly maxOutputTokens: number;
  readonly temperature: number;
}

export interface LovableConfig {
  readonly apiKey: string;
  readonly baseUrl: string;
  /** Reuse an existing project instead of creating one per run. */
  readonly projectId: string | null;
  /** How long to wait for a build to reach `live` before giving up. */
  readonly deployTimeoutMs: number;
}

export interface AppConfig {
  readonly logLevel: LogLevel;
  /** Absolute path to the artifact root. Per-run subfolders live beneath it. */
  readonly outputDir: string;
  readonly browser: BrowserConfig;
  readonly collector: CollectorConfig;
  readonly writer: WriterConfig;
  readonly lovable: LovableConfig;
}

/** Applied wherever the environment leaves a value unset. */
export const DEFAULTS = {
  logLevel: 'info',
  outputDir: './output',
  browser: {
    headless: true,
    timeoutMs: 30_000,
    locale: 'en-US',
  },
  collector: {
    maxPages: 6,
    maxImages: 40,
    minAssetBytes: 1_024,
    maxAssetBytes: 8_000_000,
    assetDirName: 'assets',
  },
  writer: {
    model: 'claude-opus-5',
    maxOutputTokens: 8_000,
    temperature: 0.7,
  },
  lovable: {
    baseUrl: 'https://api.lovable.dev',
    deployTimeoutMs: 300_000,
  },
} as const;

/* ------------------------------------------------------------------ */
/* Parsing helpers                                                     */
/* ------------------------------------------------------------------ */

function str(env: NodeJS.ProcessEnv, key: string, fallback: string): string {
  const raw = env[key]?.trim();
  return raw ? raw : fallback;
}

/** Optional values collapse empty strings to `null` so callers test one thing. */
function optional(env: NodeJS.ProcessEnv, key: string): string | null {
  const raw = env[key]?.trim();
  return raw ? raw : null;
}

function bool(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = env[key]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
  if (['0', 'false', 'no', 'off'].includes(raw)) return false;
  throw new InvalidInputError(`${key} must be a boolean, got "${raw}"`, SOURCE);
}

function int(env: NodeJS.ProcessEnv, key: string, fallback: number, min = 1): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new InvalidInputError(`${key} must be a number >= ${min}, got "${raw}"`, SOURCE);
  }
  return Math.floor(parsed);
}

function num(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new InvalidInputError(`${key} must be a number, got "${raw}"`, SOURCE);
  }
  return parsed;
}

function logLevel(env: NodeJS.ProcessEnv): LogLevel {
  const raw = str(env, 'LOG_LEVEL', DEFAULTS.logLevel).toLowerCase();
  const match = LOG_LEVELS.find((level) => level === raw);
  if (!match) {
    throw new InvalidInputError(
      `LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}, got "${raw}"`,
      SOURCE,
    );
  }
  return match;
}

/**
 * Reads and validates the environment into an `AppConfig`.
 *
 * Malformed values fail here, at startup. Missing API keys do not: they
 * default to empty and are asserted by the stage that needs them, so the
 * discovery stage runs with no credentials configured at all.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    logLevel: logLevel(env),
    outputDir: path.resolve(str(env, 'OUTPUT_DIR', DEFAULTS.outputDir)),
    browser: {
      headless: bool(env, 'BROWSER_HEADLESS', DEFAULTS.browser.headless),
      timeoutMs: int(env, 'BROWSER_TIMEOUT_MS', DEFAULTS.browser.timeoutMs),
      locale: str(env, 'BROWSER_LOCALE', DEFAULTS.browser.locale),
      userAgent: optional(env, 'BROWSER_USER_AGENT'),
      proxyUrl: optional(env, 'BROWSER_PROXY_URL'),
    },
    collector: {
      maxPages: int(env, 'COLLECTOR_MAX_PAGES', DEFAULTS.collector.maxPages),
      maxImages: int(env, 'COLLECTOR_MAX_IMAGES', DEFAULTS.collector.maxImages),
      minAssetBytes: int(env, 'COLLECTOR_MIN_ASSET_BYTES', DEFAULTS.collector.minAssetBytes, 0),
      maxAssetBytes: int(env, 'COLLECTOR_MAX_ASSET_BYTES', DEFAULTS.collector.maxAssetBytes),
      assetDirName: str(env, 'COLLECTOR_ASSET_DIR', DEFAULTS.collector.assetDirName),
    },
    writer: {
      apiKey: str(env, 'ANTHROPIC_API_KEY', ''),
      model: str(env, 'WRITER_MODEL', DEFAULTS.writer.model),
      maxOutputTokens: int(env, 'WRITER_MAX_OUTPUT_TOKENS', DEFAULTS.writer.maxOutputTokens),
      temperature: num(env, 'WRITER_TEMPERATURE', DEFAULTS.writer.temperature),
    },
    lovable: {
      apiKey: str(env, 'LOVABLE_API_KEY', ''),
      baseUrl: str(env, 'LOVABLE_BASE_URL', DEFAULTS.lovable.baseUrl),
      projectId: optional(env, 'LOVABLE_PROJECT_ID'),
      deployTimeoutMs: int(env, 'LOVABLE_DEPLOY_TIMEOUT_MS', DEFAULTS.lovable.deployTimeoutMs),
    },
  };
}
