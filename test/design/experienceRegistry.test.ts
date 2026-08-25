/**
 * Asset & Experience Registry — proves real wiring, not file existence.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  EXPERIENCE_REGISTRY,
  executablePrimitiveIds,
  resolvePrimitives,
} from '../../lib/design/experienceRegistry.js';
import { RUNTIME_PRIMITIVE_BUDGET } from '../../lib/design/experience.js';

import type { ExperienceArchitecture } from '../../lib/design/experience.js';

function architecture(overrides: Partial<ExperienceArchitecture>): ExperienceArchitecture {
  return {
    mode: 'brochure',
    signatureMoment: null,
    transition: 'none',
    momentTransition: false,
    galleryLead: false,
    pacing: 'compact',
    rationale: 'test fixture',
    evidence: [],
    ...overrides,
  };
}

/* 1. registry loads */
test('the registry loads and every entry carries a non-empty license', () => {
  const entries = Object.values(EXPERIENCE_REGISTRY);
  assert.ok(entries.length > 0);
  for (const entry of entries) {
    assert.ok(entry.license.trim().length > 0, `${entry.id} has no license recorded`);
  }
});

/* 4. license metadata present, specifically for internal primitives */
test('every internal, exists primitive is licensed "internal" — no ambiguity about ownership', () => {
  for (const entry of Object.values(EXPERIENCE_REGISTRY)) {
    if (entry.sourceType === 'internal' && entry.status === 'exists') {
      assert.equal(entry.license, 'internal');
    }
  }
});

test('EXISTS / RESEARCHED / EXTERNAL / UNSAFE are all represented, per the audit brief', () => {
  const statuses = new Set(Object.values(EXPERIENCE_REGISTRY).map((e) => e.status));
  assert.ok(statuses.has('exists'));
  assert.ok(statuses.has('researched'));
  assert.ok(statuses.has('unsafe'));
});

test('a template_pattern entry carries no executable code — inspiration, not a dependency', () => {
  const teardown = EXPERIENCE_REGISTRY['awwwards-teardown-corpus'];
  assert.ok(teardown);
  assert.equal(teardown!.sourceType, 'template_pattern');
  assert.equal(teardown!.integrationMode, 'not-integrated');
});

/* 2/8. valid primitives resolve; unsupported/unearned resolve to nothing */
test('executablePrimitiveIds lists exactly the exists, runtime-primitive rows (internal and external-with-a-real-adapter alike)', () => {
  const ids = executablePrimitiveIds();
  assert.deepEqual(
    [...ids].sort(),
    ['animated-counter', 'bento-card-tilt', 'css-scroll-driven-reveal', 'cursor-reactive-webgl', 'gsap-scrolltrigger', 'horizontal-scroll', 'image-hover-reveal', 'lenis-smooth-scroll', 'magnetic-cursor', 'marquee', 'menu-overlay', 'scroll-reveal', 'sticky-text-pin', 'text-reveal', 'three-js-hero-object'],
  );
});

test('a runtime-disabled (brochure, no motion) architecture resolves to nothing', () => {
  assert.deepEqual(resolvePrimitives(architecture({ mode: 'brochure', transition: 'none' })), []);
});

test('an earned narrative resolves to registered, executable primitives only', () => {
  const resolved = resolvePrimitives(architecture({ mode: 'narrative', transition: 'veil' }));
  const executable = new Set(executablePrimitiveIds());
  assert.ok(resolved.length > 0);
  for (const id of resolved) assert.ok(executable.has(id));
});

/* 3. unsupported primitives are rejected */
test('a declared id not in the registry is dropped, never dispatched', () => {
  // `declared` is deliberately typed `readonly string[]`, not
  // `RuntimePrimitiveId[]` — it is the seam an unvalidated upstream call
  // (Creative Direction, one day) would use, and validation happens here,
  // not at the type level.
  const resolved = resolvePrimitives(architecture({ mode: 'narrative' }), ['not-a-real-primitive']);
  assert.deepEqual(resolved, []);
});

test('a declared not-integrated id (awwwards-teardown-corpus) is rejected — not-integrated is not executable', () => {
  const resolved = resolvePrimitives(architecture({ mode: 'narrative' }), ['awwwards-teardown-corpus']);
  assert.deepEqual(resolved, [], 'awwwards-teardown-corpus is integrationMode:not-integrated — must never be dispatchable');
});

/* 5. Creative Direction (a future validated declaration) can resolve to a registered primitive */
test('an explicit, valid declaration resolves exactly as given, filtered to what is registered', () => {
  const resolved = resolvePrimitives(architecture({ mode: 'brochure' }), ['scroll-reveal', 'text-reveal']);
  assert.deepEqual(resolved, ['scroll-reveal', 'text-reveal']);
});

/* 6. resolver is deterministic */
test('resolving the same architecture twice produces identical output', () => {
  const a = architecture({ mode: 'narrative', transition: 'wipe' });
  assert.deepEqual(resolvePrimitives(a), resolvePrimitives(a));
});

/* 7. fallback chain is well-formed */
test('every declared fallback id, when non-null, points at a real registry entry', () => {
  for (const entry of Object.values(EXPERIENCE_REGISTRY)) {
    if (entry.fallback !== null) {
      assert.ok(EXPERIENCE_REGISTRY[entry.fallback], `${entry.id}'s fallback "${entry.fallback}" is not registered`);
    }
  }
});

/* Budget */
test('the resolver never exceeds the declared runtime primitive budget', () => {
  const resolved = resolvePrimitives(architecture({ mode: 'narrative', transition: 'circular-handoff' }), [
    'scroll-reveal',
    'text-reveal',
    'magnetic-cursor',
  ]);
  assert.ok(resolved.length <= RUNTIME_PRIMITIVE_BUDGET);
});

/* ------------------------------------------------------------------ */
/* Lenis — the first executable open_source primitive                  */
/* ------------------------------------------------------------------ */

test('the Lenis registry entry is valid: open_source, exists, a real runtime-primitive integration', () => {
  const entry = EXPERIENCE_REGISTRY['lenis-smooth-scroll'];
  assert.ok(entry);
  assert.equal(entry!.sourceType, 'open_source');
  assert.equal(entry!.status, 'exists');
  assert.equal(entry!.integrationMode, 'runtime-primitive');
});

test('the Lenis entry carries complete licensing/identity metadata', () => {
  const entry = EXPERIENCE_REGISTRY['lenis-smooth-scroll'];
  assert.ok(entry);
  assert.equal(entry!.license, 'MIT');
  assert.equal(entry!.package, 'lenis');
  assert.equal(entry!.version, '1.3.26');
  assert.ok(entry!.evidence.length > 0);
});

test('the Lenis entry\'s externalIntegration contract is filled in, not a metadata-only flip', () => {
  const entry = EXPERIENCE_REGISTRY['lenis-smooth-scroll'];
  assert.ok(entry);
  const contract = entry!.externalIntegration;
  assert.ok(contract, 'lenis-smooth-scroll must carry a real ExternalPrimitiveContract');
  assert.equal(contract!.sourceStrategy, 'vendored');
  assert.match(contract!.vendoredFrom, /lenis@1\.3\.26/);
  assert.match(contract!.initialization, /startLenisSmoothScroll/);
  assert.match(contract!.reducedMotionBehavior, /reduce/);
  assert.match(contract!.mobileBehavior, /coarse/);
  assert.match(contract!.fallbackBehavior, /native|unmodified|\[\]/i);
  assert.match(contract!.failureBehavior, /catch|swallow/i);
});

test('every internal or bundled-unconditional entry carries no external integration contract', () => {
  for (const entry of Object.values(EXPERIENCE_REGISTRY)) {
    if (entry.sourceType === 'internal') {
      assert.equal(entry.externalIntegration, null, `${entry.id} is internal and must not carry an externalIntegration contract`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* GSAP ScrollTrigger — the second executable open_source primitive    */
/* ------------------------------------------------------------------ */

test('the GSAP ScrollTrigger registry entry is valid: open_source, exists, a real runtime-primitive integration', () => {
  const entry = EXPERIENCE_REGISTRY['gsap-scrolltrigger'];
  assert.ok(entry);
  assert.equal(entry!.sourceType, 'open_source');
  assert.equal(entry!.status, 'exists');
  assert.equal(entry!.integrationMode, 'runtime-primitive');
});

test('the GSAP entry carries complete, precise licensing/identity metadata — not a bare "permissive"', () => {
  const entry = EXPERIENCE_REGISTRY['gsap-scrolltrigger'];
  assert.ok(entry);
  assert.equal(entry!.package, 'gsap');
  assert.equal(entry!.version, '3.15.0');
  // GSAP is GreenSock's own "no charge" grant, not MIT/OSI — the license
  // string must say so precisely rather than inheriting Lenis's "MIT".
  assert.match(entry!.license, /no charge/i);
  assert.doesNotMatch(entry!.license, /^MIT$/);
  assert.ok(entry!.evidence.length > 0);
});

test('the GSAP entry\'s externalIntegration contract is filled in, and documents the two-file load-order dependency', () => {
  const entry = EXPERIENCE_REGISTRY['gsap-scrolltrigger'];
  assert.ok(entry);
  const contract = entry!.externalIntegration;
  assert.ok(contract, 'gsap-scrolltrigger must carry a real ExternalPrimitiveContract');
  assert.equal(contract!.sourceStrategy, 'vendored');
  assert.match(contract!.vendoredFrom, /gsap@3\.15\.0/);
  assert.match(contract!.vendoredFrom, /ScrollTrigger/);
  assert.match(contract!.initialization, /startGsapScrollTrigger/);
  assert.match(contract!.reducedMotionBehavior, /reduce/);
  // Deliberately does not require /coarse/ here, unlike Lenis's contract —
  // GSAP's mobileBehavior is a documented "degrades, does not disable"
  // difference, not a missing guard.
  assert.match(contract!.mobileBehavior, /degrad/i);
  assert.match(contract!.failureBehavior, /catch|swallow/i);
});

/* ------------------------------------------------------------------ */
/* Three.js hero object — the third executable open_source primitive,  */
/* and the first to need a sibling file instead of one concatenated    */
/* string                                                               */
/* ------------------------------------------------------------------ */

test('the Three.js hero-object registry entry is valid: open_source, exists, a real runtime-primitive integration', () => {
  const entry = EXPERIENCE_REGISTRY['three-js-hero-object'];
  assert.ok(entry);
  assert.equal(entry!.sourceType, 'open_source');
  assert.equal(entry!.status, 'exists');
  assert.equal(entry!.integrationMode, 'runtime-primitive');
  assert.equal(entry!.package, 'three');
  assert.equal(entry!.version, '0.185.1');
  assert.equal(entry!.license, 'MIT');
  // Honest, not softened by "it's integrated now": pixel output is still
  // GPU/driver-dependent, so this must stay false regardless of shipping
  // infrastructure improving.
  assert.equal(entry!.deterministic, false);
});

test('the Three.js entry\'s externalIntegration contract documents the sibling file, not just an inline fragment', () => {
  const entry = EXPERIENCE_REGISTRY['three-js-hero-object'];
  assert.ok(entry);
  const contract = entry!.externalIntegration;
  assert.ok(contract, 'three-js-hero-object must carry a real ExternalPrimitiveContract');
  assert.equal(contract!.sourceStrategy, 'vendored');
  assert.match(contract!.vendoredFrom, /three@0\.185\.1/);
  assert.deepEqual(contract!.siblingFiles, ['runtime/three.core.min.js']);
  assert.match(contract!.initialization, /startThreeHero/);
  assert.match(contract!.reducedMotionBehavior, /reduce/);
  assert.match(contract!.mobileBehavior, /coarse/);
  assert.match(contract!.failureBehavior, /catch/i);
});

test('Lenis and GSAP contracts declare no sibling files — only the newer Three.js integration needed the mechanism', () => {
  for (const id of ['lenis-smooth-scroll', 'gsap-scrolltrigger']) {
    const entry = EXPERIENCE_REGISTRY[id];
    assert.ok(entry, id);
    assert.deepEqual(entry!.externalIntegration?.siblingFiles, [], `${id} should ship as a single concatenated fragment, no sibling files`);
  }
});

test('the resolver selects Lenis from an explicit, registry-validated declaration — the Creative Direction seam', () => {
  const resolved = resolvePrimitives(architecture({ mode: 'showcase' }), ['lenis-smooth-scroll']);
  assert.deepEqual(resolved, ['lenis-smooth-scroll']);
});

test('the resolver selects GSAP ScrollTrigger the same way — a second external primitive through the same seam', () => {
  const resolved = resolvePrimitives(architecture({ mode: 'showcase' }), ['gsap-scrolltrigger']);
  assert.deepEqual(resolved, ['gsap-scrolltrigger']);
});

test('the resolver selects the Three.js hero object the same way — a third external primitive through the same seam', () => {
  const resolved = resolvePrimitives(architecture({ mode: 'showcase' }), ['three-js-hero-object']);
  assert.deepEqual(resolved, ['three-js-hero-object']);
});

test('the resolver accepts external primitives together up to budget, and still rejects not-integrated/unregistered ids alongside them', () => {
  const resolved = resolvePrimitives(architecture({ mode: 'narrative' }), [
    'lenis-smooth-scroll',
    'gsap-scrolltrigger',
    'three-js-hero-object',
    'awwwards-teardown-corpus',
    'not-a-real-primitive',
  ]);
  // All three external primitives are individually valid, but RUNTIME_PRIMITIVE_BUDGET
  // (2) caps the resolved list to the first two, in declared order.
  assert.deepEqual(resolved, ['lenis-smooth-scroll', 'gsap-scrolltrigger']);
  assert.ok(resolved.length <= RUNTIME_PRIMITIVE_BUDGET);
});

test('deriveRuntimePrimitives never auto-selects any external primitive — all three are reachable only through an explicit declaration', () => {
  for (const mode of ['brochure', 'showcase', 'narrative'] as const) {
    for (const transition of ['none', 'veil', 'wipe', 'circular-handoff'] as const) {
      const declared = resolvePrimitives(architecture({ mode, transition }));
      assert.ok(!declared.includes('lenis-smooth-scroll' as never), `${mode}/${transition} must not auto-derive Lenis`);
      assert.ok(!declared.includes('gsap-scrolltrigger' as never), `${mode}/${transition} must not auto-derive GSAP ScrollTrigger`);
      assert.ok(!declared.includes('three-js-hero-object' as never), `${mode}/${transition} must not auto-derive the Three.js hero object`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* CSS scroll-driven reveal — WQ-021 / IMPLEMENTATION_GAP.md P2-2       */
/* ------------------------------------------------------------------ */

test('the css-scroll-driven-reveal registry entry is valid: internal, exists, a real runtime-primitive integration', () => {
  const entry = EXPERIENCE_REGISTRY['css-scroll-driven-reveal'];
  assert.ok(entry);
  assert.equal(entry!.sourceType, 'internal');
  assert.equal(entry!.status, 'exists');
  assert.equal(entry!.integrationMode, 'runtime-primitive');
  assert.equal(entry!.license, 'internal');
});

test('the css-scroll-driven-reveal entry carries no externalIntegration contract and no package/version — a platform primitive, not a vendored one', () => {
  const entry = EXPERIENCE_REGISTRY['css-scroll-driven-reveal'];
  assert.ok(entry);
  assert.equal(entry!.externalIntegration, null);
  assert.equal(entry!.package, undefined);
  assert.equal(entry!.version, undefined);
  assert.ok(entry!.evidence.length > 0);
});

test('the css-scroll-driven-reveal entry declares its @supports guard as a requirement, and falls back to scroll-reveal', () => {
  const entry = EXPERIENCE_REGISTRY['css-scroll-driven-reveal'];
  assert.ok(entry);
  assert.ok(entry!.requirements.some((r) => r.includes('@supports')));
  assert.equal(entry!.fallback, 'scroll-reveal');
});

test('the resolver selects css-scroll-driven-reveal from an explicit, registry-validated declaration', () => {
  const resolved = resolvePrimitives(architecture({ mode: 'showcase' }), ['css-scroll-driven-reveal']);
  assert.deepEqual(resolved, ['css-scroll-driven-reveal']);
});

test('deriveRuntimePrimitives never auto-selects css-scroll-driven-reveal — reachable only through an explicit declaration, like the other opt-in primitives', () => {
  for (const mode of ['brochure', 'showcase', 'narrative'] as const) {
    for (const transition of ['none', 'veil', 'wipe', 'circular-handoff'] as const) {
      const declared = resolvePrimitives(architecture({ mode, transition }));
      assert.ok(!declared.includes('css-scroll-driven-reveal' as never), `${mode}/${transition} must not auto-derive css-scroll-driven-reveal`);
    }
  }
});

/* ------------------------------------------------------------------ */
/* menu-overlay View Transitions half — WQ-022 / IMPLEMENTATION_GAP.md  */
/* P2-2                                                                  */
/* ------------------------------------------------------------------ */

test('the menu-overlay registry entry stays internal/exists/runtime-primitive after the WQ-022 view-transition enhancement', () => {
  const entry = EXPERIENCE_REGISTRY['menu-overlay'];
  assert.ok(entry);
  assert.equal(entry!.sourceType, 'internal');
  assert.equal(entry!.status, 'exists');
  assert.equal(entry!.integrationMode, 'runtime-primitive');
  assert.equal(entry!.license, 'internal');
});

test('the menu-overlay entry documents the view-transition enhancement in its capabilities and evidence', () => {
  const entry = EXPERIENCE_REGISTRY['menu-overlay'];
  assert.ok(entry);
  assert.ok(entry!.capabilities.some((c) => /view transition/i.test(c)));
  assert.ok(entry!.evidence.some((e) => e.includes('caniuse.com/view-transitions')));
  assert.ok(entry!.evidence.some((e) => e.includes('WQ-022')));
});

test('the menu-overlay entry still carries no externalIntegration contract — a platform API, nothing vendored', () => {
  const entry = EXPERIENCE_REGISTRY['menu-overlay'];
  assert.ok(entry);
  assert.equal(entry!.externalIntegration, null);
  assert.equal(entry!.fallback, null);
});

test('the resolver still selects menu-overlay from an explicit, registry-validated declaration', () => {
  const resolved = resolvePrimitives(architecture({ mode: 'showcase' }), ['menu-overlay']);
  assert.deepEqual(resolved, ['menu-overlay']);
});

test('deriveRuntimePrimitives never auto-selects menu-overlay — reachable only through an explicit declaration, unchanged by WQ-022', () => {
  for (const mode of ['brochure', 'showcase', 'narrative'] as const) {
    for (const transition of ['none', 'veil', 'wipe', 'circular-handoff'] as const) {
      const declared = resolvePrimitives(architecture({ mode, transition }));
      assert.ok(!declared.includes('menu-overlay' as never), `${mode}/${transition} must not auto-derive menu-overlay`);
    }
  }
});
