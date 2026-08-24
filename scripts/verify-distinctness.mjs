import { genericityReport } from '../lib/design/quality.js';
import fs from 'node:fs';

const load = (d) => JSON.parse(fs.readFileSync(`output/${d}/5b-design.json`, 'utf8'));
const rp = load('77c15289');
const tz = load('25e648c7');

// Case A: two DIFFERENT real businesses -> should be 'diverse'
const a = genericityReport([
  { name: 'RiverPark', design: rp },
  { name: 'Tartine', design: tz },
]);
console.log('[diverse test] verdict =', a.verdict);
console.log('  distinct axes =', JSON.stringify(a.distinct));
console.log('  collapsed     =', a.collapsedAxes);

// Case B: same bakery duplicated as a "second bakery" -> should be 'template-smell' (FAIL)
const b = genericityReport([
  { name: 'TartineA', design: tz },
  { name: 'TartineB-copy', design: tz },
]);
console.log('[clone test]   verdict =', b.verdict);
console.log('  collapsed     =', b.collapsedAxes);

const ok = a.verdict === 'diverse' && b.verdict === 'template-smell';
console.log(ok ? 'DISTINCTNESS GATE OK: detects diversity AND clone-collapses.' : 'DISTINCTNESS GATE FAIL');
process.exit(ok ? 0 : 1);
