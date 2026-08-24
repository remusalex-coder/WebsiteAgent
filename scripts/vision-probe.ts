/**
 * One real vision call to validate the Visual Critic node sees screenshots.
 * Loads credentials from .env, calls analyzeCritique on the already-captured
 * River Park shots, and prints the 13-axis critique + generic verdict.
 *
 *   npx tsx scripts/vision-probe.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { analyzeCritique } from '../lib/qa/visual-critic.js';
import { createLogger, createConsoleSink } from '../lib/logger.js';

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync('.env', 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i > 0) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

async function main(): Promise<void> {
  const env = loadEnv();
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not found in .env');

  const shotDir = path.join('output', '77c15289', 'shots');
  const shots = [
    { viewport: 'desktop' as const, path: path.join(shotDir, 'desktop.png') },
    { viewport: 'mobile' as const, path: path.join(shotDir, 'mobile.png') },
  ];
  for (const s of shots) {
    if (!fs.existsSync(s.path)) throw new Error(`missing screenshot: ${s.path}`);
  }

  const logger = createLogger({ level: 'info', scope: 'vision-probe', sink: createConsoleSink() });

  const critique = await analyzeCritique(
    {
      apiKey,
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      timeoutMs: 90000,
      logger,
    },
    {
      business: 'River Park Events, Drăgășani — event & wedding venue',
      screenshots: shots,
      design: null,
      character: null,
      creativeDirection: null,
    },
  );

  console.log('\n=== VISUAL CRITIC (REAL VISION CALL) ===');
  console.log('genericVerdict:', critique.genericVerdict);
  console.log('axes:');
  for (const a of critique.axes) console.log(`  ${a.axis.padEnd(20)} ${a.score}/10  ${a.note}`);
  if (critique.failReasons.length) console.log('failReasons:', critique.failReasons);
  console.log('notes:', critique.notes);
}

main().catch((error) => {
  console.error('vision-probe failed:', error);
  process.exit(1);
});
