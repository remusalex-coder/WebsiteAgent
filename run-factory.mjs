#!/usr/bin/env node
/**
 * run-factory.mjs — The 24/7 watchdog for the WebsiteAgent factory.
 *
 * This is the "it works by itself" layer. It:
 *   1. Guarantees a single instance (lockfile) so the factory never runs twice.
 *   2. Spawns `npm run autonomous` (the order loop) as a child process.
 *   3. Restarts it automatically if it exits for ANY reason (crash, OOM, error).
 *   4. Rate-limits restarts so a broken order can't spin the CPU to 100%.
 *   5. Writes a heartbeat + rotating log so you can see it's alive.
 *   6. Forwards your Ctrl-C (SIGINT) so you can stop it cleanly.
 *
 * Usage:
 *   node run-factory.mjs                 # run forever
 *   node run-factory.mjs --once          # run until the queue drains once (for testing)
 *   node run-factory.mjs --no-restart    # run the child once, exit with its code
 *
 * Environment (optional, with defaults):
 *   BF_FACTORY_INTERVAL_MS  — delay between order runs inside the loop (default 15000)
 *   BF_FACTORY_MAXITER      — QA iterations per run (default 3)
 *   BF_FACTORY_BUDGET_TIER  — tier0|tier1|tier2|tier3 (default tier1)
 *   BF_FACTORY_MAXATTEMPTS  — retries per order (default 3)
 *   BF_FACTORY_ONCE         — if "1", drains the queue once then exits
 *   BF_FACTORY_LOG          — log file path (default <repo>/logs/factory.log)
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// On Windows, `new URL(import.meta.url).pathname` yields "/C:/..." which breaks
// path.resolve. Prefer process.cwd() (set by factory-start.bat / npm run), and
// fall back to a properly-decoded __dirname if invoked from another folder.
import { fileURLToPath } from 'node:url';
function resolveRoot() {
  const cwd = process.cwd();
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    // If cwd looks like the repo (has run-factory.mjs), trust it; else use script dir.
    if (fs.existsSync(path.join(cwd, 'run-factory.mjs'))) return cwd;
    return here;
  } catch {
    return cwd;
  }
}
const REPO_ROOT = resolveRoot();
const LOCK_FILE = path.join(REPO_ROOT, '.factory.lock');
const LOG_DIR = path.join(REPO_ROOT, 'logs');
const LOG_FILE = process.env.BF_FACTORY_LOG || path.join(LOG_DIR, 'factory.log');
const PID_FILE = path.join(REPO_ROOT, '.factory.pid');

const ONCE = process.argv.includes('--once') || process.env.BF_FACTORY_ONCE === '1';
const NO_RESTART = process.argv.includes('--no-restart');

// Single-instance guard. If a stale lock is held by a dead process, we take it.
function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    const stalePid = Number(fs.readFileSync(LOCK_FILE, 'utf8').trim());
    if (stalePid && stalePid !== process.pid && isAlive(stalePid)) {
      console.error(
        `\x1b[31m[FACTORY] Another factory instance is already running (pid ${stalePid}).\x1b[0m\n` +
        `           Stop it first, or delete ${LOCK_FILE} if it is stale.`
      );
      process.exit(1);
    }
    // stale lock from a dead process — overwrite it
    fs.rmSync(LOCK_FILE, { force: true });
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8');
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function releaseLock() {
  try { if (fs.readFileSync(LOCK_FILE, 'utf8').trim() === String(process.pid)) fs.rmSync(LOCK_FILE, { force: true }); } catch {}
}

function ts() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(line) {
  const out = `[${ts()}] ${line}`;
  console.log(out);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, out + '\n', 'utf8');
  } catch {}
}

// Rotate log if it grows beyond 5 MB.
function rotateLogIfBig() {
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > 5 * 1024 * 1024) {
      const backup = LOG_FILE + '.' + Date.now();
      fs.renameSync(LOG_FILE, backup);
      log('log rotated -> ' + path.basename(backup));
    }
  } catch {}
}

let child = null;
let restarts = 0;
let startTs = Date.now();

function startChild() {
  // On Windows, `npm` is a shell script — spawn it via cmd /c, or better, call
  // node directly with the same resolved args to avoid the npm shim entirely.
  const isWin = process.platform === 'win32';
  const env = { ...process.env };
  env.BF_LOOP_INTERVAL_MS = env.BF_LOOP_INTERVAL_MS || '15000';
  env.BF_LOOP_MAXITER = env.BF_LOOP_MAXITER || '3';
  env.BF_LOOP_BUDGET_TIER = env.BF_LOOP_BUDGET_TIER || 'tier1';
  env.BF_LOOP_MAXATTEMPTS = env.BF_LOOP_MAXATTEMPTS || '3';
  if (ONCE) env.BF_LOOP_ONCE = '1';

  // Resolve the script path to autonomous-loop.ts (no extension needed for tsx ESM).
  const loopScript = path.join(REPO_ROOT, 'scripts', 'autonomous-loop.ts');
  const spawnArgs = isWin
    ? ['/c', 'node', '--import', 'tsx', '--env-file=.env', loopScript, ...(ONCE ? ['--once'] : [])]
    : ['--import', 'tsx', '--env-file=.env', loopScript, ...(ONCE ? ['--once'] : [])];
  const spawnCmd = isWin ? 'cmd' : 'node';

  child = spawn(spawnCmd, spawnArgs, {
    cwd: REPO_ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout.on('data', (b) => {
    const s = b.toString().trimEnd();
    if (s) { s.split('\n').forEach((l) => log('  ' + l)); }
  });
  child.stderr.on('data', (b) => {
    const s = b.toString().trimEnd();
    if (s) { s.split('\n').forEach((l) => log('! ' + l)); }
  });

  child.on('exit', (code, signal) => {
    child = null;
    const uptimeMin = ((Date.now() - startTs) / 60000).toFixed(1);
    log(`child exited code=${code ?? 'null'} signal=${signal ?? 'null'} (uptime ${uptimeMin}m, restarts ${restarts})`);
    if (NO_RESTART) {
      log('NO_RESTART set — factory watcher exiting.');
      releaseLock();
      process.exit(code ?? 0);
    }
    // Rate-limit: never restart more than once every 5s.
    const sinceStart = Date.now() - startTs;
    const delay = Math.max(5000 - sinceStart, 0);
    restarts += 1;
    startTs = Date.now();
    log(`restarting in ${delay}ms (attempt ${restarts})...`);
    setTimeout(startChild, delay);
  });

  log(`child spawned (pid ${child.pid})`);
}

// Heartbeat: prove the watcher itself is alive even when the queue is idle.
const heartbeat = setInterval(() => {
  const running = child ? `child pid ${child.pid}` : 'NO CHILD';
  rotateLogIfBig();
  log(`heartbeat — ${running}, restarts ${restarts}, orders in queue: ${countPending()}`);
}, 5 * 60 * 1000);

function countPending() {
  try {
    const f = path.join(REPO_ROOT, 'docs', 'orders.json');
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    return data.orders.filter((o) => o.status === 'PENDING' || o.status === 'RUNNING').length;
  } catch { return '?'; }
}

function shutdown(sig) {
  log(`received ${sig} — shutting down factory.`);
  clearInterval(heartbeat);
  if (child) {
    try { child.kill('SIGINT'); } catch {}
    // give it a grace period, then hard-kill
    setTimeout(() => { try { child && child.kill('SIGKILL'); } catch {} }, 5000);
  }
  releaseLock();
  setTimeout(() => process.exit(0), 6000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', releaseLock);

fs.mkdirSync(LOG_DIR, { recursive: true });
fs.writeFileSync(PID_FILE, String(process.pid), 'utf8');
acquireLock();
log(`=== WebsiteAgent factory watchdog starting (once=${ONCE}, noRestart=${NO_RESTART}) ===`);
log(`node ${process.version} | cwd ${REPO_ROOT}`);
startChild();
