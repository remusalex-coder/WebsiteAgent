/**
 * Structured logging.
 *
 * Agents never call `console` directly — they receive a scoped `Logger` on
 * their context, so a run's output can be redirected, filtered, or captured
 * in tests without changing agent code.
 *
 * All log output goes to stderr, leaving stdout clean for the CLI's result.
 */

import fs from 'node:fs';

import type { LogLevel } from './config.js';

/** Arbitrary structured fields attached to a log line. */
export type LogFields = Record<string, unknown>;

export type WritableLevel = Exclude<LogLevel, 'silent'>;

export interface LogRecord {
  readonly level: WritableLevel;
  /** Dotted scope path, e.g. `run.a1b2.discoveryAgent`. */
  readonly scope: string;
  readonly message: string;
  readonly fields: LogFields;
  readonly timestamp: string;
}

/** Where records go. Swap for a file or transport sink without touching callers. */
export interface LogSink {
  write(record: LogRecord): void;
  /** Flushes and releases resources. Sinks that hold none may omit it. */
  close?(): void;
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /** Derives a nested logger, e.g. `log.child('collectorAgent')`. */
  child(scope: string, fields?: LogFields): Logger;
  /** Times an operation and logs its duration and outcome. */
  time<T>(label: string, fn: () => Promise<T>): Promise<T>;
}

export interface LoggerOptions {
  readonly level: LogLevel;
  readonly scope: string;
  /** Merged into every record this logger emits. */
  readonly baseFields?: LogFields;
  /** Defaults to a console sink. */
  readonly sink?: LogSink;
}

const SEVERITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

/* ------------------------------------------------------------------ */
/* Sinks                                                               */
/* ------------------------------------------------------------------ */

function formatValue(value: unknown): string {
  if (typeof value === 'string') return /\s/.test(value) ? JSON.stringify(value) : value;
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
  if (value === undefined) return 'undefined';
  if (value instanceof Error) return JSON.stringify(value.message);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return '[unserialisable]';
  }
}

function formatFields(fields: LogFields): string {
  const entries = Object.entries(fields);
  if (entries.length === 0) return '';
  return ` ${entries.map(([key, value]) => `${key}=${formatValue(value)}`).join(' ')}`;
}

/**
 * Human-readable sink for terminal output; NDJSON when stderr is not a TTY,
 * so piping a run into a file yields machine-readable logs for free.
 */
export function createConsoleSink(pretty: boolean = process.stderr.isTTY === true): LogSink {
  return {
    write(record: LogRecord): void {
      if (!pretty) {
        process.stderr.write(`${JSON.stringify(record)}\n`);
        return;
      }
      const time = record.timestamp.slice(11, 19);
      const level = record.level.toUpperCase().padEnd(5);
      process.stderr.write(
        `${time} ${level} ${record.scope} ${record.message}${formatFields(record.fields)}\n`,
      );
    },
  };
}

/** Newline-delimited JSON sink, for persisting a run log under `/output`. */
export function createFileSink(filePath: string): LogSink {
  const stream = fs.createWriteStream(filePath, { flags: 'a' });
  return {
    write(record: LogRecord): void {
      stream.write(`${JSON.stringify(record)}\n`);
    },
    close(): void {
      stream.end();
    },
  };
}

/** Fans records out to several sinks. Closing it closes all of them. */
export function createMultiSink(...sinks: readonly LogSink[]): LogSink {
  return {
    write(record: LogRecord): void {
      for (const sink of sinks) sink.write(record);
    },
    close(): void {
      for (const sink of sinks) sink.close?.();
    },
  };
}

/* ------------------------------------------------------------------ */
/* Logger                                                              */
/* ------------------------------------------------------------------ */

export function createLogger(options: LoggerOptions): Logger {
  const sink = options.sink ?? createConsoleSink();
  const baseFields = options.baseFields ?? {};
  const threshold = SEVERITY[options.level];

  const emit = (level: WritableLevel, message: string, fields?: LogFields): void => {
    if (SEVERITY[level] < threshold) return;
    sink.write({
      level,
      scope: options.scope,
      message,
      fields: { ...baseFields, ...fields },
      timestamp: new Date().toISOString(),
    });
  };

  return {
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields),

    child(scope, fields) {
      return createLogger({
        level: options.level,
        scope: `${options.scope}.${scope}`,
        baseFields: { ...baseFields, ...fields },
        sink,
      });
    },

    async time(label, fn) {
      const startedAt = Date.now();
      emit('debug', `${label} started`);
      try {
        const result = await fn();
        emit('debug', `${label} finished`, { durationMs: Date.now() - startedAt });
        return result;
      } catch (error) {
        emit('error', `${label} failed`, {
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}
