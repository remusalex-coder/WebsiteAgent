/**
 * Smoke test for the production gate loop (no model, no browser).
 *
 * Proves the Distinctness Gate + Hermes decision node work end-to-end on a
 * hand-built fixture: a deliberately generic design must FAIL and route to a
 * reconcept stage, and a strong one must PASS and route to delivery. Run with:
 *
 *   npx tsx scripts/smoke-gate.ts
 */

import { gateJob } from '../lib/qa/distinctness-gate.js';
import { decide } from '../lib/workflow/hermes.js';
import { createJob, saveJob } from '../lib/workflow/jobState.js';
import type { WebsiteDesign, WebsiteContent } from '../lib/types.js';
import type { VisualCritique } from '../lib/qa/visual-critic.js';

/** A minimal but structurally valid design — built to exercise both branches. */
function makeDesign(overrides: Partial<WebsiteDesign> = {}): WebsiteDesign {
  const base = {
    world: 'neutral',
    personality: { rationale: 'Calm, considered.', evidence: ['rating 4.7'] },
    experience: {
      mode: 'brochure' as const,
      signatureMoment: null,
      galleryLead: false,
      rationale: 'Default.',
      evidence: ['none'],
    },
    conversion: { mode: 'editorial' as const, ctaPlacement: 'end', primaryCta: 'Contact', conversionMoment: 'end', rationale: 'Default.', evidence: ['none'] },
    interaction: { level: 'static' as const, ceiling: 'static' as const, rationale: 'Default.', evidence: ['none'] },
    assets: { hero: null, reduceImagery: false, rationale: 'Default.', evidence: ['none'] },
    layout: {
      order: [0, 1, 2],
      sections: [
        { index: 0, kind: 'hero', variant: 'a', emphasis: 1, fullBleed: false },
        { index: 1, kind: 'about', variant: 'a', emphasis: 1, fullBleed: false },
        { index: 2, kind: 'contact', variant: 'a', emphasis: 1, fullBleed: false },
      ],
      hero: 'centered',
      rationale: 'Default.',
    },
    tokens: { typography: { heading: { family: 'sans' }, body: { family: 'sans' } } },
    accessibility: { targetLevel: 'AA' as const },
    experienceScript: { beats: [], conversionAt: 2 },
  } as unknown as WebsiteDesign;
  return { ...base, ...overrides };
}

const content = { sections: [] } as unknown as WebsiteContent;
const character = { visualWeight: 'text-led', emotionalRegister: 'functional', narrativePotential: 'none' };

function fakeCritic(generic: VisualCritique['genericVerdict']): VisualCritique {
  return {
    axes: [],
    genericVerdict: generic,
    failReasons: generic === 'generic' ? ['Looks like a template: hero + cards + contact.'] : [],
    notes: ['smoke'],
  };
}

async function main(): Promise<void> {
  // --- Case 1: generic design must FAIL and route to reconcept -----------------
  const genericDesign = makeDesign({ world: 'neutral', experience: { mode: 'brochure', signatureMoment: null, galleryLead: false, rationale: 'none', evidence: [] } });
  const job1 = await saveJob('/tmp/bf-smoke', { ...createJob('smoke-generic', 'Test Bakery A'), implementationStatus: 'built' });
  const gate1 = gateJob({
    jobState: { ...job1, creativeDirection: { rationale: '', confidence: 0.2 } },
    design: genericDesign,
    content,
    character,
    critic: fakeCritic('generic'),
  });
  const decision1 = decide({ gate: gate1, job: { ...job1, iteration: 0 } });
  console.log(`[generic] verdict=${gate1.verdict} route=${gate1.route} diagnosis=${gate1.diagnosis} hermes=${decision1.action}/${decision1.nextStage}`);

  // --- Case 2: strong, distinct design must PASS and deliver -------------------
  const strongDesign = makeDesign({
    world: 'warm-bakery',
    experience: { mode: 'narrative', signatureMoment: 'oven-spring', galleryLead: true, rationale: 'Bakery character.', evidence: ['43 photos', 'craft narrative'] },
    conversion: { mode: 'high-intent', ctaPlacement: 'early', primaryCta: 'Order', conversionMoment: 'early', rationale: 'Trade business.', evidence: ['functional register'] },
    layout: {
      order: [0, 1, 2, 3],
      sections: [
        { index: 0, kind: 'hero', variant: 'full-bleed', emphasis: 3, fullBleed: true },
        { index: 1, kind: 'gallery', variant: 'immersive', emphasis: 3, fullBleed: true },
        { index: 2, kind: 'about', variant: 'editorial', emphasis: 2, fullBleed: false },
        { index: 3, kind: 'contact', variant: 'split', emphasis: 1, fullBleed: false },
      ],
      hero: 'full-bleed',
      rationale: 'Signature-led.',
    },
  });
  const job2 = await saveJob('/tmp/bf-smoke', { ...createJob('smoke-strong', 'Test Bakery B'), implementationStatus: 'built' });
  const gate2 = gateJob({
    jobState: { ...job2, creativeDirection: { rationale: 'Workshop journey.', confidence: 0.9 } },
    design: strongDesign,
    content,
    character: { ...character, visualWeight: 'image-led', narrativePotential: 'strong' },
    critic: fakeCritic('distinct'),
    peerDesigns: [
      { name: 'A', design: genericDesign },
      { name: 'B', design: strongDesign },
    ],
  });
  const decision2 = decide({ gate: gate2, job: { ...job2, iteration: 0 } });
  console.log(`[strong ] verdict=${gate2.verdict} route=${gate2.route} diagnosis=${gate2.diagnosis} hermes=${decision2.action}/${decision2.nextStage}`);

  const ok = gate1.verdict === 'FAIL' && gate1.route !== 'deliver' && gate2.verdict === 'PASS' && decision2.action === 'deliver';
  console.log(ok ? 'SMOKE PASS: gate + hermes loop behaves correctly.' : 'SMOKE FAIL: unexpected verdicts.');
  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  console.error('smoke crashed:', error);
  process.exit(1);
});
