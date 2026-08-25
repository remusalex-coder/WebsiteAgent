/**
 * Anti-pattern signals transcribed from `docs/knowledge/ANTI_AI_SLOP.md`,
 * plus motion coherence against `lib/forge/motion.ts`'s intensity contract.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { checkAntiPatternSignals, checkContentSafety, checkMotionCoherence, checkMotionLibraryUsage, checkReducedMotionSafeguard } from '../../lib/forge/antiPatternSignals.js';
import { DEFAULT_EXPERIENCE_STRATEGY } from '../../lib/forge/experienceStrategy.js';
import { planAssetStrategy } from '../../lib/forge/assetStrategy.js';

import type { ExperienceBlueprint, GeneratedCode } from '../../lib/forge/types.js';

function code(overrides: Partial<GeneratedCode> = {}): GeneratedCode {
  return { html: '<html><body></body></html>', css: '', js: '', ...overrides };
}

function blueprint(overrides: Partial<ExperienceBlueprint> = {}): ExperienceBlueprint {
  const factualDossier = {
    businessName: 'Test Co', category: 'Test', verifiedFacts: [], inferences: [], creativeInterpretations: [],
    conflicts: [], forbiddenAssumptions: [], realPhotoAssets: [],
    location: { fullAddress: '', street: '', city: '', region: '' }, contact: {}, verifiedReviews: [], primaryLanguage: 'en',
  };
  const signature = {
    selectedTerritoryId: 't1', selectionRationale: 'r', businessTruth: 'truth', humanInsight: 'insight',
    creativeMetaphor: 'metaphor', centralMechanism: 'mechanism', signatureMoment: 'moment',
    interactionGrammar: { paceAndMotion: '', openingMoment: '', scrollChoreography: '', microInteractions: [], selectedPatterns: [], rejectedPatterns: [] },
    visualGrammar: { moodWords: [], colorPalette: { primary: '#000', secondary: '#111', background: '#fff', surface: '#eee', textPrimary: '#000', textMuted: '#555', accent: '#f00' }, typography: { displayFamily: 'Serif', bodyFamily: 'Sans', styleNote: '' }, spatialComposition: '' },
    restraintContract: { forbiddenAntiPatterns: [], mandatoryDesignRules: [] },
    experienceStrategy: DEFAULT_EXPERIENCE_STRATEGY,
    scenes: [],
  };
  return {
    brandName: 'Test Co',
    factualDossier,
    signature,
    conversionStrategy: { primaryActionLabel: 'Call', primaryActionType: 'call', reassurancePoints: [] },
    assetStrategy: planAssetStrategy(factualDossier, signature),
    ...overrides,
  };
}

/* -------------------------------------------------------------------- */
/* A-02 Excessive gradients                                              */
/* -------------------------------------------------------------------- */

test('A-02: more than 3 gradient declarations is flagged', () => {
  const css = Array.from({ length: 4 }, (_, i) => `.a${i}{background:linear-gradient(45deg,#000,#fff)}`).join('\n');
  const flags = checkAntiPatternSignals(code({ css }), blueprint());
  assert.ok(flags.some((f) => f.code === 'A-02'));
});

test('A-02: 3 or fewer gradients is fine', () => {
  const css = '.a{background:linear-gradient(45deg,#000,#fff)}';
  const flags = checkAntiPatternSignals(code({ css }), blueprint());
  assert.ok(!flags.some((f) => f.code === 'A-02'));
});

/* -------------------------------------------------------------------- */
/* A-07 Fake statistics — blocking                                       */
/* -------------------------------------------------------------------- */

test('A-07: unverified stat-shaped numbers are a blocking fail', () => {
  const html = '<div>500+ Clients</div><div>98% Satisfaction</div><div>1000+ Projects</div>';
  const flags = checkAntiPatternSignals(code({ html }), blueprint());
  const flag = flags.find((f) => f.code === 'A-07');
  assert.ok(flag);
  assert.equal(flag!.severity, 'fail');
});

test('A-07: statistics that trace to a verified fact are not flagged', () => {
  const html = '<div>500+ Clients</div><div>98% Satisfaction</div><div>217+ Reviews</div>';
  const bp = blueprint({
    factualDossier: {
      ...blueprint().factualDossier,
      verifiedFacts: [
        { id: 'f1', category: 'rating', claim: '4.6 rating from 500 reviews, 98% would recommend, 217 verified', source: 'google_maps', confidence: 'verified', evidenceSnippet: '', timestamp: '' },
      ],
    },
  });
  const flags = checkAntiPatternSignals(code({ html }), bp);
  assert.ok(!flags.some((f) => f.code === 'A-07'));
});

test('A-07: fewer than 3 stat-shaped numbers is not enough to flag', () => {
  const html = '<div>500+ Clients</div>';
  const flags = checkAntiPatternSignals(code({ html }), blueprint());
  assert.ok(!flags.some((f) => f.code === 'A-07'));
});

test('A-07 REGRESSION: percentages on an interactive diagnostic gauge are not fake statistics — found live on the real Ridgeway fixture', () => {
  // "32% Remaining Integrity" / "48% Signal Fidelity" style health-bar
  // readouts are demo values inside a legitimate interactive tool, not a
  // marketing trust-stat, and must not require a matching verified fact.
  const html = `
    <strong>32% Remaining Integrity</strong>
    <div class="health-bar-fill" style="width: 32%;"></div>
    <strong>15% Remaining Integrity</strong>
    <div class="health-bar-fill" style="width: 15%;"></div>
    <strong>48% Signal Fidelity</strong>
    <div class="health-bar-fill" style="width: 48%;"></div>
  `;
  const flags = checkAntiPatternSignals(code({ html }), blueprint());
  assert.ok(!flags.some((f) => f.code === 'A-07'), `expected no A-07 flag, got ${JSON.stringify(flags)}`);
});

/* -------------------------------------------------------------------- */
/* A-08 Generic copy                                                     */
/* -------------------------------------------------------------------- */

test('A-08: two or more generic phrases are flagged', () => {
  const html = '<p>We believe in a seamless experience that will elevate your day.</p>';
  const flags = checkAntiPatternSignals(code({ html }), blueprint());
  assert.ok(flags.some((f) => f.code === 'A-08'));
});

/* -------------------------------------------------------------------- */
/* A-11 Repeated CTAs                                                    */
/* -------------------------------------------------------------------- */

test('A-11: the same CTA text repeated more than twice is flagged', () => {
  const html = Array.from({ length: 3 }, () => '<a class="btn-primary">Book Now</a>').join('');
  const flags = checkAntiPatternSignals(code({ html }), blueprint());
  assert.ok(flags.some((f) => f.code === 'A-11'));
});

test('A-11: two distinct CTAs used twice each is not flagged', () => {
  const html = '<a class="btn">Book Now</a><a class="btn">Book Now</a><a class="btn">Call Us</a><a class="btn">Call Us</a>';
  const flags = checkAntiPatternSignals(code({ html }), blueprint());
  assert.ok(!flags.some((f) => f.code === 'A-11'));
});

/* -------------------------------------------------------------------- */
/* A-16 Excessive premium language                                       */
/* -------------------------------------------------------------------- */

test('A-16: more than 5 premium/luxury words is flagged', () => {
  const html = '<p>' + 'premium luxury exceptional finest exquisite unparalleled '.repeat(1) + '</p>';
  const flags = checkAntiPatternSignals(code({ html }), blueprint());
  assert.ok(flags.some((f) => f.code === 'A-16'));
});

/* -------------------------------------------------------------------- */
/* A-19 Unnecessary 3D — cross-checked against experienceStrategy        */
/* -------------------------------------------------------------------- */

test('A-19: 3D/WebGL code present without a declared requires3D is a blocking fail', () => {
  const js = 'const scene = new THREE.Scene(); import * as three from "three.js";';
  const flags = checkAntiPatternSignals(code({ js }), blueprint());
  const flag = flags.find((f) => f.code === 'A-19');
  assert.ok(flag);
  assert.equal(flag!.severity, 'fail');
});

test('A-19: 3D code with a declared, justified requires3D is not flagged', () => {
  const js = 'const scene = new THREE.Scene();';
  const bp = blueprint({
    signature: {
      ...blueprint().signature,
      experienceStrategy: { ...DEFAULT_EXPERIENCE_STRATEGY, requires3D: true, requires3DRationale: 'the product is inherently 3D' },
    },
  });
  const flags = checkAntiPatternSignals(code({ js }), bp);
  assert.ok(!flags.some((f) => f.code === 'A-19'));
});

/* -------------------------------------------------------------------- */
/* Motion coherence                                                      */
/* -------------------------------------------------------------------- */

test('motion "none" with any declared CSS transition duration is incoherent', () => {
  const css = '.a{transition-duration:300ms}';
  const flags = checkMotionCoherence(code({ css }), { ...DEFAULT_EXPERIENCE_STRATEGY, motionIntensity: 'none' });
  assert.ok(flags.some((f) => f.code === 'MOTION_INCOHERENT' && f.severity === 'fail'));
});

test('motion "subtle" allows durations within its band (up to 400ms elementReveal)', () => {
  const css = '.a{transition-duration:250ms} .b{animation-duration:0.3s}';
  const flags = checkMotionCoherence(code({ css }), { ...DEFAULT_EXPERIENCE_STRATEGY, motionIntensity: 'subtle' });
  assert.deepEqual(flags, []);
});

test('motion "subtle" flags a duration far outside its allowed band (a pageRouteTransition-scale value)', () => {
  const css = '.a{transition-duration:2000ms}';
  const flags = checkMotionCoherence(code({ css }), { ...DEFAULT_EXPERIENCE_STRATEGY, motionIntensity: 'subtle' });
  assert.ok(flags.some((f) => f.code === 'MOTION_INCOHERENT'));
});

test('motion "immersive" permits a pageRouteTransition-scale duration (600ms)', () => {
  const css = '.a{transition-duration:600ms}';
  const flags = checkMotionCoherence(code({ css }), { ...DEFAULT_EXPERIENCE_STRATEGY, motionIntensity: 'immersive' });
  assert.deepEqual(flags, []);
});

test('no declared durations at all is never flagged, regardless of intensity', () => {
  const flags = checkMotionCoherence(code({ css: '.a{color:red}' }), { ...DEFAULT_EXPERIENCE_STRATEGY, motionIntensity: 'none' });
  assert.deepEqual(flags, []);
});

/* -------------------------------------------------------------------- */
/* Motion library load-vs-use — the plumbing bug this pass fixes         */
/* -------------------------------------------------------------------- */

test('calling gsap. with no matching CDN <script> tag is a blocking fail — this would be a real ReferenceError', () => {
  const js = 'gsap.to(".hero", { opacity: 1, duration: 0.4 });';
  const html = '<html><head></head><body><script src="experience.js"></script></body></html>';
  const flags = checkMotionLibraryUsage(code({ html, js }));
  const flag = flags.find((f) => f.code === 'MOTION_LIBRARY_UNLOADED' && f.evidence === 'GSAP');
  assert.ok(flag, `expected a GSAP flag, got ${JSON.stringify(flags)}`);
  assert.equal(flag!.severity, 'fail');
});

test('calling gsap. WITH a matching CDN <script> tag is not flagged', () => {
  const js = 'gsap.to(".hero", { opacity: 1, duration: 0.4 });';
  const html = '<html><head><script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script></head><body><script src="experience.js"></script></body></html>';
  const flags = checkMotionLibraryUsage(code({ html, js }));
  assert.ok(!flags.some((f) => f.evidence === 'GSAP'));
});

test('ScrollTrigger. usage needs its OWN script tag — loading gsap.min.js alone is not enough', () => {
  const js = 'gsap.registerPlugin(ScrollTrigger); ScrollTrigger.create({ trigger: ".hero" });';
  const html = '<html><head><script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script></head><body><script src="experience.js"></script></body></html>';
  const flags = checkMotionLibraryUsage(code({ html, js }));
  const flag = flags.find((f) => f.evidence === 'ScrollTrigger');
  assert.ok(flag, `expected a ScrollTrigger flag since only gsap.min.js was loaded, got ${JSON.stringify(flags)}`);
});

test('ScrollTrigger. usage with both gsap.min.js and ScrollTrigger.min.js loaded is not flagged', () => {
  const js = 'gsap.registerPlugin(ScrollTrigger); ScrollTrigger.create({ trigger: ".hero" });';
  const html = '<html><head>' +
    '<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>' +
    '<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/ScrollTrigger.min.js"></script>' +
    '</head><body><script src="experience.js"></script></body></html>';
  const flags = checkMotionLibraryUsage(code({ html, js }));
  assert.ok(!flags.some((f) => f.evidence === 'ScrollTrigger'));
});

test('new Lenis( with no matching script tag is flagged; with one, it is not', () => {
  const js = 'const lenis = new Lenis({ duration: 1.2 });';
  const unloaded = checkMotionLibraryUsage(code({ html: '<html></html>', js }));
  assert.ok(unloaded.some((f) => f.evidence === 'Lenis'));

  const loaded = checkMotionLibraryUsage(
    code({ html: '<html><script src="https://unpkg.com/lenis@1/dist/lenis.min.js"></script></html>', js }),
  );
  assert.ok(!loaded.some((f) => f.evidence === 'Lenis'));
});

test('plain CSS-only JS with no library calls at all is never flagged, at any intensity', () => {
  const js = 'document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));';
  const flags = checkMotionLibraryUsage(code({ html: '<html></html>', js }));
  assert.deepEqual(flags, []);
});

/* -------------------------------------------------------------------- */
/* T10: reduced-motion safeguard — registry-grade proof, not a comment   */
/* -------------------------------------------------------------------- */

test('animated CSS with no reduced-motion media query is a blocking fail', () => {
  const css = '.a{transition-duration:300ms}';
  const flags = checkReducedMotionSafeguard(code({ css }));
  const flag = flags.find((f) => f.code === 'REDUCED_MOTION_MISSING');
  assert.ok(flag, `expected a REDUCED_MOTION_MISSING flag, got ${JSON.stringify(flags)}`);
  assert.equal(flag!.severity, 'fail');
});

test('animated CSS WITH a reduced-motion media query is not flagged', () => {
  const css = '.a{transition-duration:300ms} @media (prefers-reduced-motion: reduce) { .a{transition-duration:0ms} }';
  const flags = checkReducedMotionSafeguard(code({ css }));
  assert.deepEqual(flags, []);
});

test('the reduced-motion query is matched regardless of internal whitespace', () => {
  const css = '.a{animation-duration:0.3s} @media(prefers-reduced-motion:reduce){.a{animation:none}}';
  const flags = checkReducedMotionSafeguard(code({ css }));
  assert.deepEqual(flags, []);
});

test('CSS with no declared durations at all is never flagged, regardless of motionIntensity', () => {
  // Nothing animates, so there is nothing for a reduced-motion query to
  // reduce — the same "no declared durations is never flagged" scoping
  // checkMotionCoherence already uses.
  const flags = checkReducedMotionSafeguard(code({ css: '.a{color:red}' }));
  assert.deepEqual(flags, []);
});

test('a real motionIntensity "none" build (no durations) is correctly exempt', () => {
  const flags = checkReducedMotionSafeguard(code({ css: '' }));
  assert.deepEqual(flags, []);
});

/* -------------------------------------------------------------------- */
/* WQ-017 / IMPLEMENTATION_GAP.md P2-4: content-safety gate              */
/* -------------------------------------------------------------------- */

test('a plain, safe page produces no content-safety flags', () => {
  const html = '<html><body><a href="/about">About</a><script src="experience.js"></script></body></html>';
  const flags = checkContentSafety(code({ html }));
  assert.deepEqual(flags, []);
});

test('a javascript: URL on href is caught, whatever attribute it is on', () => {
  const html = '<a href="javascript:alert(1)">click</a>';
  const flags = checkContentSafety(code({ html }));
  const flag = flags.find((f) => f.code === 'CONTENT_SAFETY_JAVASCRIPT_URL');
  assert.ok(flag, `expected CONTENT_SAFETY_JAVASCRIPT_URL, got ${JSON.stringify(flags)}`);
  assert.equal(flag!.severity, 'fail');
});

test('javascript: is also caught on src/action/formaction, not only href', () => {
  const cases = [
    '<iframe src="javascript:alert(1)"></iframe>',
    '<form action="javascript:alert(1)"></form>',
    '<button formaction="javascript:alert(1)">go</button>',
  ];
  for (const html of cases) {
    const flags = checkContentSafety(code({ html }));
    assert.ok(flags.some((f) => f.code === 'CONTENT_SAFETY_JAVASCRIPT_URL'), `expected a flag for: ${html}`);
  }
});

test('an inline onclick= (or other on*=) attribute is caught', () => {
  const html = '<button onclick="doThing()">Go</button>';
  const flags = checkContentSafety(code({ html }));
  const flag = flags.find((f) => f.code === 'CONTENT_SAFETY_INLINE_EVENT_HANDLER');
  assert.ok(flag, `expected CONTENT_SAFETY_INLINE_EVENT_HANDLER, got ${JSON.stringify(flags)}`);
  assert.equal(flag!.severity, 'fail');
  assert.match(flag!.evidence ?? '', /onclick/);
});

test('a hyphenated data attribute that merely contains "on" is not a false positive', () => {
  // data-oncomplete= must not match — the hyphen breaks the word boundary
  // the inline-handler regex requires immediately before "on".
  const html = '<div data-oncomplete="somevalue" data-section="onboarding"></div>';
  const flags = checkContentSafety(code({ html }));
  assert.equal(flags.find((f) => f.code === 'CONTENT_SAFETY_INLINE_EVENT_HANDLER'), undefined);
});

test('a real interactive page with addEventListener wiring (no inline handlers) is clean', () => {
  const html = '<button id="cta">Book now</button><script src="experience.js"></script>';
  const js = 'document.getElementById("cta").addEventListener("click", () => {});';
  const flags = checkContentSafety(code({ html, js }));
  assert.deepEqual(flags, []);
});

test('a <script src> from an allowed CDN (jsdelivr/unpkg/cdnjs) is not flagged', () => {
  const cases = [
    '<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>',
    '<script src="https://unpkg.com/lenis@1/dist/lenis.min.js"></script>',
    '<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>',
  ];
  for (const scriptTag of cases) {
    const flags = checkContentSafety(code({ html: `<html><head>${scriptTag}</head></html>` }));
    assert.deepEqual(flags, [], `expected no flags for: ${scriptTag}`);
  }
});

test('a <script src> outside the CDN allowlist is caught', () => {
  const html = '<script src="https://evil.example.com/payload.js"></script>';
  const flags = checkContentSafety(code({ html }));
  const flag = flags.find((f) => f.code === 'CONTENT_SAFETY_UNTRUSTED_SCRIPT_SRC');
  assert.ok(flag, `expected CONTENT_SAFETY_UNTRUSTED_SCRIPT_SRC, got ${JSON.stringify(flags)}`);
  assert.equal(flag!.severity, 'fail');
});

test('a look-alike domain does not sneak past the allowlist via a substring match', () => {
  const html = '<script src="https://evil-cdn.jsdelivr.net.attacker.example/payload.js"></script>';
  const flags = checkContentSafety(code({ html }));
  assert.ok(flags.some((f) => f.code === 'CONTENT_SAFETY_UNTRUSTED_SCRIPT_SRC'));
});

test('a same-document relative <script src> is never flagged as external', () => {
  const html = '<script src="experience.js"></script><script src="/vendor/local.js"></script>';
  const flags = checkContentSafety(code({ html }));
  assert.deepEqual(flags.filter((f) => f.code === 'CONTENT_SAFETY_UNTRUSTED_SCRIPT_SRC'), []);
});
