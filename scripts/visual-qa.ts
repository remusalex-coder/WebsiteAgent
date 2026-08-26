/**
 * Visual QA driver.
 *
 *   npm run visual-qa -- --site=<dir> [--autofix] [--attempts=N]
 *   npm run visual-qa -- <runId> [--autofix]
 *
 * Captures desktop and mobile screenshots of an already-rendered site, asks a
 * vision model what is wrong, and — when `--autofix` is set AND a human
 * confirms it at a terminal — has Claude Code apply targeted CSS/HTML fixes.
 * Then it re-captures and re-analyses until the defects clear or the attempt
 * budget runs out.
 *
 * **Autofix is human-only, by construction.** It lets a model write bytes that
 * a customer receives, which the deterministic renderer would otherwise own
 * alone, so it requires a real TTY and a typed phrase — see `autofixAllowed`.
 * No automated caller in this repository can satisfy those conditions, and an
 * unattended run degrades to report-only rather than hanging or failing.
 *
 * It does NOT render and does NOT deploy. The site it works on is the rendered
 * deliverable (the same `site/` tree `publish-run.ts` assembles), so fixes land
 * on the artifact a customer would receive — consistent with the rest of the
 * pipeline, where `render/` is the thing that ships.
 *
 * Capture uses the grow-the-viewport technique from `scripts/shoot.ts`:
 * `fullPage` re-runs lazy heuristics and captures galleries as white bands, so
 * the viewport is grown to the document height instead and images are decoded
 * before the shutter.
 *
 * The vision call reuses `lib/ai`'s `postJson` transport. No new framework, no
 * paid service beyond the OpenAI-compatible vision key you already configure.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';

import { chromium } from 'playwright';

import { createConsoleSink, createLogger } from '../lib/logger.js';
import { loadConfig } from '../lib/config.js';
import {
  analyzeScreenshots,
  runVisualQa,
  type FilePatch,
  type PatchOutcome,
  type VisualDefect,
} from '../lib/qa/visual-qa.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'visual-qa.driver';

/* ------------------------------------------------------------------ */
/* Args                                                                */
/* ------------------------------------------------------------------ */

function flag(name: string, argv: readonly string[]): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((a) => a.startsWith(prefix))?.slice(prefix.length).trim();
}

const args = process.argv.slice(2);
const autofix = args.includes('--autofix');
const attempts = Number.parseInt(flag('attempts', args) ?? '3', 10) || 3;

const siteFlag = flag('site', args);
const positional = args.find((a) => !a.startsWith('--') && !a.startsWith('--site'));

let siteDir: string;
if (siteFlag !== undefined) {
  siteDir = path.resolve(siteFlag);
} else if (positional !== undefined) {
  siteDir = path.join(ROOT, 'output', positional, 'site');
} else {
  throw new Error('usage: visual-qa --site=<dir> [<runId>] [--autofix] [--attempts=N]');
}

/* ------------------------------------------------------------------ */
/* Capture                                                             */
/* ------------------------------------------------------------------ */

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

const shotDir = path.join(path.dirname(siteDir), 'shots');

async function capture(attempt: number): Promise<readonly { viewport: 'desktop' | 'mobile'; path: string }[]> {
  fs.mkdirSync(shotDir, { recursive: true });
  const indexPath = path.join(siteDir, 'index.html');
  if (!fs.existsSync(indexPath)) throw new Error(`no index.html at ${indexPath}`);

  const browser = await chromium.launch({ headless: true });
  const taken: { viewport: 'desktop' | 'mobile'; path: string }[] = [];

  try {
    for (const { name, width, height } of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(`file://${indexPath.replace(/\\/g, '/')}`);

      // Force every image to load before the viewport is resized for capture.
      await page.evaluate(async () => {
        for (const img of Array.from(document.images)) img.removeAttribute('loading');
        await Promise.all(
          Array.from(document.images).map((img) => (img.complete ? null : img.decode().catch(() => null))),
        );
      });
      await page.waitForTimeout(600);

      // Grow the viewport rather than use fullPage — see module header.
      const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.setViewportSize({ width, height: Math.min(fullHeight, 20_000) });
      await page.waitForTimeout(400);

      const shot = path.join(shotDir, `visual-qa-${name}.png`);
      await page.screenshot({ path: shot });
      taken.push({ viewport: name, path: shot });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  return taken;
}

/* ------------------------------------------------------------------ */
/* Claude Code patcher                                                 */
/* ------------------------------------------------------------------ */

/**
 * Asks Claude Code to apply the defects' fixes to the rendered site.
 *
 * The model edits `index.html` / `styles.css` directly under `siteDir`. The
 * screenshot re-check is the real verification — this returns a best-effort
 * outcome so the loop can report what happened, and the next capture proves it.
 *
 * Hard constraints are written into the prompt: only the site dir, only CSS/HTML,
 * never change copy or add external resources. `--max-turns` bounds the session.
 */
async function patchWithClaude(defects: readonly VisualDefect[], attempt: number): Promise<readonly PatchOutcome[]> {
  const fileList = ['index.html', 'styles.css']
    .filter((f) => fs.existsSync(path.join(siteDir, f)))
    .map((f) => path.join(siteDir, f));

  const defectsBlock = defects
    .map(
      (d) =>
        `- [${d.severity}] ${d.category} (${d.viewport}): ${d.description}\n    where: ${d.location}\n    fix: ${d.suggestedFix}`,
    )
    .join('\n');

  const prompt =
    `You are fixing a static business website for visual QA. Edit ONLY these files:\n` +
    fileList.map((f) => `  ${f}`).join('\n') +
    `\nApply targeted CSS/HTML fixes for the following defects. Rules:\n` +
    `1. Fix ONLY what is listed. Do not change any visible text, copy, headings, or business facts.\n` +
    `2. Do not add external resources, scripts, fonts, or images. Only edit existing CSS/HTML.\n` +
    `3. Prefer minimal, local CSS changes. One fix per defect; do not restyle the whole page.\n` +
    `4. If a defect is not actually visible in the files, skip it and say so.\n` +
    `5. When done, report which defects you fixed and which you skipped, in one short paragraph.\n\n` +
    `Defects:\n${defectsBlock}\n`;

  // Resolve the Claude Code CLI. On Windows the npm shim `claude` is a symlink
  // that `spawn` cannot execute without a shell, so we prefer the `.cmd`
  // launcher (which `where` also surfaces) and run via the shell.
  let claudeBin = 'claude';
  const candidates =
    process.platform === 'win32'
      ? ['claude.cmd', 'claude.exe', 'claude']
      : ['claude'];
  for (const candidate of candidates) {
    try {
      const resolved = execFileSync('where', [candidate], { windowsHide: true })
        .toString()
        .trim()
        .split(/\r?\n/)[0];
      if (resolved && resolved.length > 0) {
        claudeBin = resolved;
        break;
      }
    } catch {
      // Not on PATH; try the next candidate.
    }
  }

  const before = snapshotSite(siteDir);

  const result = await new Promise<{ code: number | null; out: string }>((resolve) => {
    const child = spawn(
      claudeBin,
      ['-p', '--allowedTools', 'Read,Edit,Write', '--max-turns', '18', '--model', 'sonnet', '--output-format', 'text'],
      { cwd: siteDir, env: process.env, windowsHide: true, shell: process.platform === 'win32' },
    );
    // The prompt is long and contains quotes/newlines; passing it as a CLI arg
    // is fragile under `shell: true` on Windows, so we pipe it via stdin.
    child.stdin?.end(prompt);
    let out = '';
    child.stdout.on('data', (b) => (out += b.toString()));
    child.stderr.on('data', (b) => (out += b.toString()));
    child.on('close', (code) => resolve({ code, out }));
    child.on('error', (err) => resolve({ code: null, out: `spawn error: ${err.message}` }));
  });

  // Honest verdict: a "fix" only counts if the site files actually changed.
  // Claude Code may decide (correctly) that a defect is not reproducible and
  // make no edit — that must NOT be reported as a partial fix.
  const after = snapshotSite(siteDir);
  const reallyChanged = fileList.some((f) => before.get(f) !== after.get(f));

  const applied = result.code === 0 && reallyChanged;
  process.stdout.write(`\n[claude patch attempt ${attempt}] code=${result.code} changed=${reallyChanged}\n${result.out.slice(0, 600)}\n`);
  // One synthetic outcome representing the whole session; the screenshot recheck
  // is the authority on whether the fix worked.
  const synthetic: FilePatch = { file: siteDir, find: `<defects attempt ${attempt}>`, replace: defectsBlock };
  return [{ applied, reason: applied ? undefined : result.out.slice(0, 200), patch: synthetic }];
}

/** Cheap content hash of the editable site files, for change detection. */
function snapshotSite(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const name of ['index.html', 'styles.css']) {
    const full = path.join(dir, name);
    try {
      map.set(full, fs.readFileSync(full, 'utf8'));
    } catch {
      /* absent */
    }
  }
  return map;
}

/* ------------------------------------------------------------------ */
/* No-op patcher (capture/analyse only)                                */
/* ------------------------------------------------------------------ */

async function noPatch(_defects: readonly VisualDefect[], attempt: number): Promise<readonly PatchOutcome[]> {
  process.stdout.write(`\n[attempt ${attempt}] --autofix not set; defects reported above were NOT applied.\n`);
  return [];
}

/* ------------------------------------------------------------------ */
/* Autofix gate — human-only, by construction                          */
/* ------------------------------------------------------------------ */

/**
 * The phrase a human has to type to let a model edit the deliverable.
 *
 * ## Why this gate exists
 *
 * `patchWithClaude` spawns Claude Code with `Read,Edit,Write` inside the
 * rendered site directory and lets it rewrite `index.html` and `styles.css`.
 * That is a model authoring bytes that a customer receives, which is the one
 * thing the architecture's central invariant forbids — the deterministic
 * renderer owns every byte that ships.
 *
 * The path is kept because a human repairing a run by hand is a legitimate use.
 * It is fenced so that nothing *automated* can reach it: a flag alone was not
 * enough, because a flag is exactly what an orchestrator would pass.
 *
 * ## Why not an environment variable
 *
 * Because the n8n stage server would inherit it. Every automated caller in this
 * repository is a spawned process with an inherited environment and no
 * terminal, so the gate is a real TTY plus a typed phrase — two things a
 * spawned stage cannot produce and would not survive.
 *
 * With no terminal the script does not hang and does not fail; it degrades to
 * report-only, which is the correct behaviour for an unattended run.
 */
const AUTOFIX_CONFIRMATION = 'edit delivered bytes';

async function confirmAutofix(): Promise<boolean> {
  process.stdout.write(
    '\n' +
      '─────────────────────────────────────────────────────────────────────\n' +
      '  --autofix lets a MODEL EDIT THE DELIVERED SITE.\n' +
      '\n' +
      '  Claude Code will be given Read/Edit/Write inside:\n' +
      `    ${siteDir}\n` +
      '  and may rewrite index.html and styles.css. Those bytes are what a\n' +
      '  customer receives. The deterministic renderer will NOT have produced\n' +
      '  them, and re-rendering the run will not reproduce them.\n' +
      '\n' +
      `  Type exactly: ${AUTOFIX_CONFIRMATION}\n` +
      '  Anything else runs in report-only mode.\n' +
      '─────────────────────────────────────────────────────────────────────\n' +
      '> ',
  );

  const answer = await new Promise<string>((resolve) => {
    const onData = (chunk: Buffer | string): void => {
      process.stdin.off('data', onData);
      process.stdin.pause();
      resolve(String(chunk).trim());
    };
    process.stdin.resume();
    process.stdin.once('data', onData);
  });

  return answer === AUTOFIX_CONFIRMATION;
}

/**
 * Resolves whether the model patcher may run.
 *
 * Three conditions, all required: the flag, an interactive terminal on both
 * stdin and stdout, and the typed phrase. Any of them missing leaves the run in
 * report-only mode with the reason printed.
 */
async function autofixAllowed(): Promise<boolean> {
  if (!autofix) return false;

  if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
    process.stderr.write(
      'refusing --autofix: no interactive terminal.\n' +
        '  A model may only edit delivered bytes when a human confirms it at a TTY.\n' +
        '  Continuing in report-only mode.\n',
    );
    return false;
  }

  const confirmed = await confirmAutofix();
  if (!confirmed) {
    process.stdout.write('\nnot confirmed; continuing in report-only mode.\n');
  }
  return confirmed;
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

const config = loadConfig();
const vision = config.vision;
const apiKey = vision.apiKey !== '' ? vision.apiKey : (config.ai.apiKeys.openai ?? '');
const baseUrl = vision.baseUrl ?? 'https://api.openai.com/v1';
const model = vision.model !== '' ? vision.model : 'gpt-4o';

if (apiKey === '') {
  process.stderr.write('warning: OPENAI_API_KEY is not set — vision analysis will fail. Set it to run the loop; capture + mechanical checks still run.\n');
}

const logger = createLogger({
  level: 'info',
  scope: 'visual-qa',
  sink: createConsoleSink(),
});

const analysis = await (async () => {
  // Construct the analyzer closure the loop will call each iteration.
  return async (shots: readonly { viewport: 'desktop' | 'mobile'; path: string }[]) => {
    if (apiKey === '') throw new Error('OPENAI_API_KEY not set');
    return analyzeScreenshots({
      apiKey,
      baseUrl,
      model,
      timeoutMs: 120_000,
      screenshots: shots,
      business: '',
      logger,
    });
  };
})();

const patchingAllowed = await autofixAllowed();

const result = await runVisualQa({
  siteDir,
  visionApiKey: apiKey,
  visionBaseUrl: baseUrl,
  visionModel: model,
  timeoutMs: 120_000,
  maxAttempts: attempts,
  logger,
  capture,
  analyze: analysis,
  patchSite: patchingAllowed ? patchWithClaude : noPatch,
});

process.stdout.write(`\n=== Visual QA: ${result.verdict} ===\n`);
process.stdout.write(`attempts: ${result.attempts}\n`);
process.stdout.write(`remaining defects: ${result.remainingDefects.length}\n`);
for (const d of result.remainingDefects) {
  process.stdout.write(`  - [${d.severity}] ${d.category} (${d.viewport}): ${d.description}\n`);
}
process.stdout.write(`mechanical checks: ${result.finalChecks.filter((c) => c.passed).length}/${result.finalChecks.length} passing\n`);
for (const c of result.finalChecks) {
  if (!c.passed) process.stdout.write(`  FAIL ${c.id}: ${c.detail}\n`);
}
process.stdout.write(`screenshots: ${shotDir}\n`);
