/**
 * Phase 0 A/B — the deterministic floor against the Design Director path.
 *
 *   npx tsx scripts/ab-floor-vs-director.ts prepare <runId...>
 *   npx tsx scripts/ab-floor-vs-director.ts sheet
 *   npx tsx scripts/ab-floor-vs-director.ts score <label> <a|b>
 *   npx tsx scripts/ab-floor-vs-director.ts result
 *
 * ## The question
 *
 * Does the model-augmented path produce a *better* website than the
 * deterministic floor? Nothing in this repository has ever measured that. Every
 * instrument it owns measures internal consistency (`scoreExperience`,
 * `narrativeCoherence`) or difference between sites (`genericityReport`) —
 * neither of which is quality. The whole escalation apparatus could be an
 * expensive way to produce *different* sites and nothing would notice.
 *
 * ## Why Arm B is the existing director, not a cabinet
 *
 * The A/B has to run before the thing it would validate is built, so Arm B is
 * the model path that already exists: `DIRECTOR_ENABLED=true`, one frontier
 * call, threaded into `composeDesign` through `applyDirective`. If a single
 * director cannot beat the floor, a five-seat cabinet will not either — and the
 * test costs one model call per business instead of fifteen.
 *
 * ## Blinding
 *
 * A judge is shown two folders named `left` and `right`. Which arm produced
 * which is recorded only in `ab/manifest.json`, which is never served. The
 * served trees carry no arm identifier in any filename or byte — asserted by
 * `test/ab/blinding.test.ts`, because a blinding scheme nobody checks is a
 * blinding scheme that leaks.
 *
 * Nothing here modifies the pipeline. `prepare` runs the two existing entry
 * points and copies their output.
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AB_ROOT = path.resolve(process.env.AB_DIR ?? path.join(ROOT, 'ab'));
const OUTPUT_ROOT = path.resolve(process.env.OUTPUT_DIR ?? path.join(ROOT, 'output'));
const MANIFEST = path.join(AB_ROOT, 'manifest.json');

/** Which side of the pair a judge sees. Deliberately meaningless. */
export type Side = 'left' | 'right';
/** Which arm produced it. Never written into a served tree. */
export type Arm = 'a' | 'b';

export interface PairRecord {
  /** Opaque id shown to the judge. Carries no information about the arms. */
  readonly label: string;
  readonly runId: string;
  /** Hidden mapping. This is the only place it exists. */
  readonly sides: Readonly<Record<Side, Arm>>;
  readonly preparedAt: string;
}

export interface Verdict {
  readonly label: string;
  /** The side the judge preferred. */
  readonly chose: Side;
  readonly judge: string;
  readonly note: string;
}

export interface Manifest {
  readonly version: 1;
  readonly pairs: readonly PairRecord[];
  readonly verdicts: readonly Verdict[];
}

const EMPTY: Manifest = { version: 1, pairs: [], verdicts: [] };

/* ------------------------------------------------------------------ */
/* Manifest                                                            */
/* ------------------------------------------------------------------ */

export function loadManifest(): Manifest {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Manifest;
  } catch {
    return EMPTY;
  }
}

function saveManifest(manifest: Manifest): void {
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

/**
 * A label that cannot be reversed into an arm.
 *
 * Random, not derived from the runId or the arm — a hash of either would be
 * stable across a re-prepare and would leak the assignment to anyone who could
 * recompute it.
 */
function opaqueLabel(): string {
  return crypto.randomBytes(4).toString('hex');
}

/* ------------------------------------------------------------------ */
/* Preparation                                                         */
/* ------------------------------------------------------------------ */

/**
 * Files a judge is allowed to see. Everything else in a run directory is
 * provenance — `5a-directive.json` names the director outright.
 */
const SERVED = new Set(['index.html', 'styles.css', 'runtime.js']);

function copySite(from: string, to: string): void {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // `assets/` travels wholesale; it holds images and fonts, no provenance.
      if (entry.name === 'assets') fs.cpSync(path.join(from, entry.name), path.join(to, entry.name), { recursive: true });
      continue;
    }
    if (SERVED.has(entry.name)) fs.copyFileSync(path.join(from, entry.name), path.join(to, entry.name));
  }
}

/**
 * Words that would tell a judge which arm they are looking at.
 *
 * `compose` and `director` are the two entry points; `floor` and `arm` are how
 * this experiment talks about itself. None of them has any business appearing
 * in a rendered site, so any occurrence is a leak rather than a false positive.
 */
const LEAK_PATTERN = /\barm[-_ ]?[ab]\b|--compose|director_enabled|director-enabled|deterministic[-_ ]floor|\bfloor-vs\b/i;

/**
 * Filenames and bytes under `pairDir` that would reveal the assignment.
 *
 * Run before a pair is published, so a blinding failure is caught while it is
 * still a bug rather than after seven people have scored it. A blinding scheme
 * nobody checks is a blinding scheme that leaks.
 */
export function blindingLeaks(pairDir: string): string[] {
  const leaks: string[] = [];

  const walk = (dir: string, rel: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      const here = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (LEAK_PATTERN.test(entry.name)) leaks.push(`filename: ${here}`);
      if (entry.isDirectory()) {
        walk(abs, here);
        continue;
      }
      // Only text is readable; images cannot carry a word a judge would notice.
      if (!/\.(html|css|js|json|txt|svg)$/i.test(entry.name)) continue;
      const text = fs.readFileSync(abs, 'utf8');
      if (LEAK_PATTERN.test(text)) leaks.push(`content: ${here}`);
    }
  };

  if (fs.existsSync(pairDir)) walk(pairDir, '');
  return leaks;
}

function run(command: string, args: readonly string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited ${String(result.status)}`);
  }
}

/**
 * Builds both arms for one run and copies them into a blinded pair.
 *
 * Arm A is `--compose`: the deterministic floor, no model, no key.
 * Arm B is `--from=direct` with `DIRECTOR_ENABLED=true`: the existing director
 * stage, then the same deterministic design and render beneath it.
 *
 * Both write into the run's own directory, so the second overwrites the first —
 * hence the copy after each, before the next runs.
 */
function prepareRun(runId: string): PairRecord {
  const runDir = path.join(OUTPUT_ROOT, runId);
  if (!fs.existsSync(path.join(runDir, '3-profile.json'))) {
    throw new Error(`run ${runId} has no 3-profile.json; the A/B starts from an already-collected business`);
  }

  const label = opaqueLabel();
  const staging = path.join(AB_ROOT, '.staging', label);
  fs.rmSync(staging, { recursive: true, force: true });

  // --- Arm A: deterministic floor -----------------------------------------
  run('npx', ['tsx', 'main.ts', '--compose', runId], { DIRECTOR_ENABLED: 'false' });
  copySite(path.join(runDir, 'site'), path.join(staging, 'a'));

  // --- Arm B: the existing Design Director path ---------------------------
  run('npx', ['tsx', 'main.ts', `--from=direct`, runId], { DIRECTOR_ENABLED: 'true' });
  copySite(path.join(runDir, 'site'), path.join(staging, 'b'));

  // --- Blind: randomise which arm is `left` -------------------------------
  const aIsLeft = crypto.randomInt(2) === 0;
  const sides: Record<Side, Arm> = aIsLeft ? { left: 'a', right: 'b' } : { left: 'b', right: 'a' };

  const pairDir = path.join(AB_ROOT, 'pairs', label);
  fs.rmSync(pairDir, { recursive: true, force: true });
  fs.mkdirSync(pairDir, { recursive: true });
  for (const side of ['left', 'right'] as const) {
    fs.cpSync(path.join(staging, sides[side]), path.join(pairDir, side), { recursive: true });
  }
  fs.rmSync(staging, { recursive: true, force: true });

  const leaks = blindingLeaks(pairDir);
  if (leaks.length > 0) {
    throw new Error(`pair ${label} would reveal its arms and was not published:\n  ${leaks.join('\n  ')}`);
  }

  return { label, runId, sides, preparedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------------ */
/* Scoring sheet and result                                            */
/* ------------------------------------------------------------------ */

function writeSheet(manifest: Manifest): string {
  const lines = [
    'BusinessForge A/B — scoring sheet',
    '',
    'For each pair, open both folders and answer ONE question:',
    '  "Which of these would you rather have as your business\'s website?"',
    '',
    'Record left or right. Add one line of reasoning. Do not discuss with other judges.',
    '',
    ...manifest.pairs.map((p) => `  ${p.label}   left [ ]   right [ ]   reason: ______________________`),
    '',
    `pairs: ${manifest.pairs.length}`,
  ];
  const sheetPath = path.join(AB_ROOT, 'scoring-sheet.txt');
  fs.writeFileSync(sheetPath, `${lines.join('\n')}\n`, 'utf8');
  return sheetPath;
}

/** Wilson score interval — honest at the sample sizes this experiment has. */
export function wilson(wins: number, total: number): { low: number; high: number } {
  if (total === 0) return { low: 0, high: 1 };
  const z = 1.96;
  const p = wins / total;
  const denom = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return { low: (centre - spread) / denom, high: (centre + spread) / denom };
}

export interface AbResult {
  readonly verdicts: number;
  readonly armBWins: number;
  readonly armBWinRate: number;
  readonly ci95: { readonly low: number; readonly high: number };
  readonly decision: 'build-p4-p8' | 'ship-the-floor' | 'investigate-degradation' | 'insufficient-data';
  readonly byRun: Readonly<Record<string, { a: number; b: number }>>;
}

/**
 * Applies the decision rule frozen in ARCHITECTURE_FREEZE §5 P0-1.
 *
 * The rule is applied to the point estimate, and the interval is reported
 * beside it so a 60% result on twelve verdicts is not mistaken for a finding.
 */
export function decide(manifest: Manifest): AbResult {
  const byLabel = new Map(manifest.pairs.map((p) => [p.label, p]));
  const byRun: Record<string, { a: number; b: number }> = {};
  let armBWins = 0;
  let counted = 0;

  for (const verdict of manifest.verdicts) {
    const pair = byLabel.get(verdict.label);
    if (pair === undefined) continue;
    const arm = pair.sides[verdict.chose];
    counted += 1;
    if (arm === 'b') armBWins += 1;
    const tally = (byRun[pair.runId] ??= { a: 0, b: 0 });
    tally[arm] += 1;
  }

  const rate = counted === 0 ? 0 : armBWins / counted;
  const decision: AbResult['decision'] =
    counted < 7 ? 'insufficient-data'
      : rate >= 0.65 ? 'build-p4-p8'
        : rate >= 0.45 ? 'ship-the-floor'
          : 'investigate-degradation';

  return { verdicts: counted, armBWins, armBWinRate: rate, ci95: wilson(armBWins, counted), decision, byRun };
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function main(argv: readonly string[]): void {
  const [command, ...rest] = argv;

  if (command === 'prepare') {
    if (rest.length === 0) throw new Error('usage: prepare <runId...>');
    const manifest = loadManifest();
    const pairs = [...manifest.pairs];
    for (const runId of rest) {
      process.stdout.write(`\n=== preparing ${runId} ===\n`);
      pairs.push(prepareRun(runId));
    }
    saveManifest({ ...manifest, pairs });
    process.stdout.write(`\n${pairs.length} pairs in ${path.join(AB_ROOT, 'pairs')}\n`);
    process.stdout.write(`manifest (DO NOT SHOW A JUDGE): ${MANIFEST}\n`);
    return;
  }

  if (command === 'sheet') {
    const sheet = writeSheet(loadManifest());
    process.stdout.write(`${sheet}\n`);
    return;
  }

  if (command === 'score') {
    const [label, side, judge, ...note] = rest;
    if (label === undefined || (side !== 'left' && side !== 'right')) {
      throw new Error('usage: score <label> <left|right> <judge> [note...]');
    }
    const manifest = loadManifest();
    saveManifest({
      ...manifest,
      verdicts: [...manifest.verdicts, { label, chose: side, judge: judge ?? 'anonymous', note: note.join(' ') }],
    });
    process.stdout.write('recorded\n');
    return;
  }

  if (command === 'result') {
    const result = decide(loadManifest());
    fs.mkdirSync(AB_ROOT, { recursive: true });
    fs.writeFileSync(path.join(AB_ROOT, 'result.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.decision === 'insufficient-data') {
      process.stdout.write('\nfewer than 7 verdicts: not a result yet.\n');
    }
    return;
  }

  throw new Error('usage: ab-floor-vs-director.ts <prepare|sheet|score|result> …');
}

const invokedDirectly =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main(process.argv.slice(2));
}
