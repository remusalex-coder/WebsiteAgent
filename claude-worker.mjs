#!/usr/bin/env node
/**
 * claude-worker.mjs — Claude Code as a REAL autonomous worker in the factory.
 *
 * This connects Anthropic's Claude Code CLI to the BusinessForge worker
 * network (closing the "Claude is not part of a unified worker network"
 * gap). It is the SAFE, official CLI path — no web automation, no token
 * sent anywhere but to the locally-installed `claude` binary, which uses
 * the user's own authenticated session / ANTHROPIC_API_KEY.
 *
 * The `claude` CLI is already installed (claude --version works). This
 * script is the thin worker wrapper: give it a task, it delegates to the
 * CLI and returns the result. It can be driven by the factory's
 * orchestrator the same way chat-worker.mjs drives API workers.
 *
 * Usage:
 *   node claude-worker.mjs "Write a 3-paragraph About page for a vegan bakery in Cluj"
 *   node claude-worker.mjs --model claude-opus-4 "..."   # pick a model
 *   node claude-worker.mjs --json "..."                  # emit raw JSON
 *   node claude-worker.mjs --check                       # is the CLI reachable?
 *
 * Environment:
 *   CLAUDE_BIN       path to the claude binary (default: claude)
 *   CLAUDE_MODEL     default model if --model not given
 *   CLAUDE_TIMEOUT_MS per-task wall-clock (default 300000)
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO = process.cwd();
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';
const TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS || '300000');

const IS_WIN = process.platform === 'win32';

// On Windows `claude` is `claude.cmd`; Node's spawn won't run a .cmd directly
// without a shell, so route through `cmd /c`. On POSIX the bare name is fine.
function claudeBin() {
  return IS_WIN ? 'cmd' : CLAUDE_BIN;
}
function claudeArgs(extra) {
  if (IS_WIN) return ['/c', CLAUDE_BIN, ...extra];
  return extra;
}

async function checkCli() {
  return new Promise((resolve) => {
    const p = spawn(claudeBin(), claudeArgs(['--version']), { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', (b) => (out += b.toString()));
    p.on('close', (code) => resolve({ ok: code === 0, version: out.trim() }));
    p.on('error', () => resolve({ ok: false, version: '' }));
  });
}

/**
 * Runs one task through the Claude Code CLI and returns its stdout.
 * Uses `-p` (print mode / non-interactive) with `--model` and `--output-stream`.
 */
function runTask(prompt, model, timeoutMs) {
  return new Promise((resolve, reject) => {
    const args = claudeArgs(['-p', '--model', model, prompt]);
    const p = spawn(claudeBin(), args, {
      cwd: REPO,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      p.kill('SIGKILL');
      reject(new Error(`claude-worker timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    p.stdout.on('data', (b) => (out += b.toString()));
    p.stderr.on('data', (b) => (err += b.toString()));
    p.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out.trim());
      else reject(new Error(`claude exited ${code}: ${err.slice(0, 300)}`));
    });
    p.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--check')) {
    const r = await checkCli();
    console.log(r.ok ? `Claude worker READY: ${r.version}` : 'Claude worker UNAVAILABLE (claude CLI not found)');
    process.exit(r.ok ? 0 : 1);
  }
  const jsonMode = args.includes('--json');
  const mIdx = args.indexOf('--model');
  const model = mIdx >= 0 ? args[mIdx + 1] : DEFAULT_MODEL;
  const prompt = args.filter((a) => !a.startsWith('--') && a !== model).join(' ').trim();
  if (!prompt) {
    console.error('Usage: node claude-worker.mjs "task" [--model X] [--json] [--check]');
    process.exit(1);
  }
  try {
    const result = await runTask(prompt, model, TIMEOUT_MS);
    if (jsonMode) console.log(JSON.stringify({ worker: 'claude', model, text: result }));
    else console.log(result);
  } catch (e) {
    console.error('claude-worker error:', e.message);
    process.exit(1);
  }
}

main();
