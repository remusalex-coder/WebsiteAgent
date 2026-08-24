/**
 * PHASE 2 verification: proves the Hermes rejection loop now CHANGES the design
 * on reconcept (not just re-criticises the same one), without spending a model
 * call. Forces a gate FAIL by declaring River Park as its own clone peer
 * (genericityReport -> template-smell -> FAIL), then runs the job and checks
 * that a reconcept iteration produced a DIFFERENT directive + design.
 *
 *   npx tsx scripts/verify-reconcept.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { runJob } from '../lib/workflow/runJob.js';
import { loadConfig } from '../lib/config.js';
import { createLogger, createConsoleSink } from '../lib/logger.js';

const RUN = '77c15289';
const OUT = path.join('output', RUN);

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: 'info', scope: 'verify-reconcept', sink: createConsoleSink() });

  // Capture the baseline design (what composeStandalone produces).
  const baseline = JSON.parse(fs.readFileSync(path.join(OUT, '5b-design.json'), 'utf8'));

  // Force a gate FAIL cheaply: declare this business as a clone of itself.
  const peersPath = path.join(OUT, 'peers.json');
  fs.writeFileSync(peersPath, JSON.stringify([
    { name: 'RiverPark-A', designPath: '5b-design.json' },
    { name: 'RiverPark-B', designPath: '5b-design.json' },
  ]));

  try {
    const job = await runJob({ runId: RUN, business: 'River Park Events', maxIter: 2, logger });

    const finalDesign = JSON.parse(fs.readFileSync(path.join(OUT, '5b-design.json'), 'utf8'));
    const hasDirective = fs.existsSync(path.join(OUT, '5a-directive.json'));

    const modeChanged = baseline.experience?.mode !== finalDesign.experience?.mode;
    const sigChanged = (baseline.experience?.signatureMoment ?? null) !== (finalDesign.experience?.signatureMoment ?? null);
    const dirChanged = baseline.personality?.direction !== finalDesign.personality?.direction;

    console.log('=== PHASE 2 RECONCEPT VERIFY ===');
    console.log('job.iteration       =', job.iteration);
    console.log('job.decision        =', job.decision);
    console.log('gate.verdict        =', (job.distinctnessScore as any)?.verdict);
    console.log('5a-directive written =', hasDirective);
    console.log('baseline mode/sig   =', baseline.experience?.mode, '/', baseline.experience?.signatureMoment);
    console.log('final    mode/sig   =', finalDesign.experience?.mode, '/', finalDesign.experience?.signatureMoment);
    console.log('modeChanged/sigChanged =', modeChanged, '/', sigChanged);

    const ok = job.iteration >= 1 && hasDirective && (modeChanged || sigChanged || dirChanged);
    console.log(ok
      ? 'PHASE 2 OK: rejection loop produced a DIFFERENT design on reconcept.'
      : 'PHASE 2 FAIL: design did not change on reconcept.');
    process.exit(ok ? 0 : 1);
  } finally {
    fs.rmSync(peersPath, { force: true });
  }
}

main().catch((error) => {
  fs.rmSync(path.join(OUT, 'peers.json'), { force: true });
  console.error('verify-reconcept crashed:', error);
  process.exit(1);
});
