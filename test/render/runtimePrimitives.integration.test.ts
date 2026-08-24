/**
 * Integration test: Experience Signature → runtime declaration → renderer →
 * rendered artifact.
 *
 * This is the one test in the suite that proves the whole seam, not just one
 * link of it: an `ExperienceArchitecture` that has earned motion is run
 * through `deriveRuntimePrimitives` (the declaration) and then through
 * `renderSite` (the renderer) exactly as `main.ts` composes them, and the
 * resulting `RenderedFile[]` — the actual artifact a browser would receive —
 * is inspected for the primitive's CSS. The opt-out path is proven the same
 * way: an architecture that has earned nothing produces a `styles.css`
 * byte-identical to calling `renderSite` with no options at all.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderSite } from '../../lib/render/index.js';
import { deriveRuntimePrimitives } from '../../lib/design/experience.js';
import { resolvePrimitives } from '../../lib/design/experienceRegistry.js';
import { fullContent, minimalContent } from '../fixtures/content.js';

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

function cssOf(files: ReturnType<typeof renderSite>['files']): string {
  const file = files.find((entry) => entry.path === 'styles.css');
  assert.ok(file, 'styles.css was not rendered');
  return file.contents;
}

describe('Tier-2 runtime primitives reach the rendered artifact', () => {
  it('opt-out (no earned motion): the artifact is byte-identical to the no-options call', () => {
    const flat = architecture({ mode: 'brochure', transition: 'none' });
    const declared = deriveRuntimePrimitives(flat);
    assert.deepEqual(declared, [], 'a brochure with no earned motion declares nothing');

    const withExplicitOptions = renderSite(minimalContent, {
      runtime: 'none',
      runtimePrimitives: declared,
    });
    const withNoOptionsAtAll = renderSite(minimalContent);

    assert.equal(cssOf(withExplicitOptions.files), cssOf(withNoOptionsAtAll.files));
    assert.deepEqual(withExplicitOptions.files.map((f) => f.path), withNoOptionsAtAll.files.map((f) => f.path));
    assert.ok(!cssOf(withExplicitOptions.files).includes('.section:not(.section--hero)'), 'no reveal primitive without a declaration');
  });

  it('opt-out: declaring a primitive without engaging the base runtime is inert, not an error', () => {
    // A caller that asks for a primitive while runtime stays 'none' — the
    // structural tie in resolveOptions must drop it silently, matching the
    // "a signal nothing ever writes cannot do anything" rule.
    const site = renderSite(minimalContent, { runtime: 'none', runtimePrimitives: ['scroll-reveal'] });
    assert.ok(!cssOf(site.files).includes('[data-runtime="scroll-progress"] .section:not(.section--hero)'));
    assert.deepEqual(site.files.map((f) => f.path), ['index.html', 'styles.css'], 'no runtime.js when runtime is none, regardless of primitives');
  });

  it('opt-in: an earned narrative moment declares scroll-reveal and text-reveal, and both reach styles.css', () => {
    const earned = architecture({ mode: 'narrative', transition: 'veil', signatureMoment: null });
    const declared = deriveRuntimePrimitives(earned);
    // Budget (RUNTIME_PRIMITIVE_BUDGET=2) caps a narrative-with-transition at
    // its two highest-priority primitives; magnetic-cursor is earned too but
    // does not survive the cut here — see the registry seam test below for a
    // scenario (a craft showcase) where it does.
    assert.deepEqual(declared, ['scroll-reveal', 'text-reveal']);

    const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });

    const css = cssOf(site.files);
    assert.ok(css.includes('[data-runtime="scroll-progress"] .section:not(.section--hero)'), 'the declared primitive reached the rendered CSS');
    assert.ok(css.includes('--forge-vis'), 'reuses the existing runtime signal');

    // runtime.js and the data-runtime attribute — the base runtime — ship
    // alongside it, unchanged from before this pass.
    assert.ok(site.files.some((f) => f.path === 'runtime.js'));
    const htmlFile = site.files.find((f) => f.path === 'index.html');
    assert.ok(htmlFile?.contents.includes('data-runtime="scroll-progress"'));
  });

  it('engaging the base runtime without declaring the primitive still omits its CSS — opt-in is per primitive, not blanket', () => {
    const withoutPrimitive = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: [] });
    const withPrimitive = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: ['scroll-reveal'] });

    assert.ok(!cssOf(withoutPrimitive.files).includes('.section:not(.section--hero)'), 'scroll-reveal was not declared, so its CSS must not appear');
    assert.ok(cssOf(withPrimitive.files).includes('.section:not(.section--hero)'), 'the same runtime, with the primitive declared, does include it');
    // Both share runtime.js and the data-runtime attribute — engaging the
    // base runtime is independent of which primitives ride on top of it.
    assert.equal(withoutPrimitive.files.some((f) => f.path === 'runtime.js'), withPrimitive.files.some((f) => f.path === 'runtime.js'));
  });

  it('the model cannot smuggle arbitrary CSS through the declaration — only RuntimePrimitiveId strings are accepted by the type system', () => {
    // A structural check, not a runtime one: RenderOptions.runtimePrimitives
    // is typed `readonly RuntimePrimitiveId[]`, a closed union. This test
    // documents that guarantee by exercising the one legal value and
    // confirming nothing beyond its own named CSS block appears.
    const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: ['scroll-reveal'] });
    const css = cssOf(site.files);
    const revealBlock = css.slice(css.indexOf('.section:not(.section--hero)'));
    const declaredProperties = [...revealBlock.slice(0, revealBlock.indexOf('}') + 1).matchAll(/^\s*([a-z-]+):/gm)].map((m) => m[1]).filter((p): p is string => p !== undefined);
    for (const prop of declaredProperties) {
      assert.ok(['opacity', 'transform', 'will-change'].includes(prop));
    }
  });

  it('the full registry seam — ExperienceArchitecture → resolver → registry → renderer → artifact — for the magnetic cursor', () => {
    // A craft showcase, not a narrative: text-reveal is earned only by
    // `mode: 'narrative'`, so a showcase's two-primitive budget goes to
    // scroll-reveal + magnetic-cursor instead.
    const earned = architecture({ mode: 'showcase', transition: 'wipe' });
    const declared = resolvePrimitives(earned); // the registry-validated resolver, not the raw deriver
    assert.ok(declared.includes('magnetic-cursor'), 'a showcase with an earned transition earns the cursor');

    const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
    const css = cssOf(site.files);
    const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';

    assert.ok(css.includes('[data-runtime-cursor="magnetic"]'), 'the cursor CSS reached styles.css');
    assert.ok(css.includes('.forge-cursor'), 'the overlay element class shipped');
    assert.ok(js.includes('startMagneticCursor'), 'the cursor JS reached runtime.js');
    assert.ok(js.includes('scroll-progress') || js.includes('forge-scroll'), 'the base runtime is still present alongside it');
  });

  it('a registry-rejected declaration reaches nothing in the artifact', () => {
    const declared = resolvePrimitives(architecture({ mode: 'narrative' }), ['awwwards-teardown-corpus', 'not-real']);
    assert.deepEqual(declared, []);

    const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
    const css = cssOf(site.files);
    const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';
    assert.ok(!css.includes('.section:not(.section--hero)'));
    assert.ok(!js.includes('startMagneticCursor'));
  });

  describe('Lenis (open_source, vendored) — the first external primitive to reach a real artifact', () => {
    it('selecting lenis-smooth-scroll ships the vendored library and the init glue in runtime.js', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['lenis-smooth-scroll']);
      assert.deepEqual(declared, ['lenis-smooth-scroll']);

      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';

      // The vendored upstream build — real Lenis, not a stub. `globalThis.Lenis`
      // is the exact assignment `dist/lenis.min.js` ends on.
      assert.ok(js.includes('globalThis.Lenis'), 'the vendored Lenis library body reached runtime.js');
      // The init glue that actually constructs it.
      assert.ok(js.includes('startLenisSmoothScroll'), 'the init function reached runtime.js');
      assert.ok(js.includes('new window.Lenis'), 'the adapter actually constructs the vendored class');
      assert.ok(js.includes('autoRaf'), 'Lenis is configured to drive its own rAF loop');
      // The base runtime still ships alongside it — this is additive, not a replacement.
      assert.ok(js.includes('startScrollProgress'), 'the base scroll-progress runtime is still present');
    });

    it('selecting lenis-smooth-scroll ships the vendored stylesheet, scoped under .lenis, in styles.css', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['lenis-smooth-scroll']);
      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const css = cssOf(site.files);
      assert.ok(css.includes('.lenis'), 'the vendored Lenis CSS reached styles.css');
      assert.ok(css.includes('data-lenis-prevent'), 'the actual upstream stylesheet shipped, not a placeholder');
    });

    it('not selecting lenis-smooth-scroll ships neither its JS nor its CSS, even with other primitives engaged', () => {
      const declared = resolvePrimitives(architecture({ mode: 'narrative', transition: 'veil' })); // scroll-reveal + text-reveal, no Lenis
      assert.ok(!declared.includes('lenis-smooth-scroll' as never));

      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const css = cssOf(site.files);
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';
      assert.ok(!js.includes('globalThis.Lenis'));
      assert.ok(!js.includes('startLenisSmoothScroll'));
      assert.ok(!css.includes('data-lenis-prevent'));
    });

    it('the reduced-motion guard runs before Lenis is ever constructed — the shipped source, not just a claim', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['lenis-smooth-scroll']);
      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';

      const initStart = js.indexOf('function startLenisSmoothScroll');
      const constructIndex = js.indexOf('new window.Lenis');
      const reducedMotionGuardIndex = js.indexOf("matchMedia('(prefers-reduced-motion: reduce)')", initStart);
      assert.ok(initStart >= 0 && constructIndex > initStart && reducedMotionGuardIndex >= 0);
      assert.ok(reducedMotionGuardIndex < constructIndex, 'the reduced-motion guard must be checked before construction');
    });

    it('the mobile/coarse-pointer guard also runs before construction — touch devices keep native scrolling', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['lenis-smooth-scroll']);
      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';

      const initStart = js.indexOf('function startLenisSmoothScroll');
      const constructIndex = js.indexOf('new window.Lenis');
      const coarsePointerGuardIndex = js.indexOf("matchMedia('(pointer: coarse)')", initStart);
      assert.ok(coarsePointerGuardIndex >= 0 && coarsePointerGuardIndex < constructIndex, 'the coarse-pointer guard must be checked before construction');
    });

    it('construction is wrapped in try/catch — a throw falls back to native scrolling, never surfaces', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['lenis-smooth-scroll']);
      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';
      const initFragment = js.slice(js.indexOf('function startLenisSmoothScroll'));
      assert.ok(/try\s*\{[\s\S]*new window\.Lenis[\s\S]*?\}\s*catch/.test(initFragment), 'construction must be inside a try/catch');
    });

    it('Lenis can share the runtime-primitive budget with an internal primitive, and both reach the artifact', () => {
      // showcase + wipe earns scroll-reveal and magnetic-cursor by default (budget 2);
      // an explicit declaration can instead pair Lenis with the baseline reveal.
      const declared = resolvePrimitives(architecture({ mode: 'showcase', transition: 'wipe' }), [
        'scroll-reveal',
        'lenis-smooth-scroll',
      ]);
      assert.deepEqual(declared, ['scroll-reveal', 'lenis-smooth-scroll']);

      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const css = cssOf(site.files);
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';
      assert.ok(css.includes('.section:not(.section--hero)'), 'scroll-reveal still reaches styles.css alongside Lenis');
      assert.ok(js.includes('globalThis.Lenis'), 'Lenis still reaches runtime.js alongside scroll-reveal');
    });
  });

  describe('GSAP ScrollTrigger (open_source, vendored) — the second external primitive, proving the seam generalizes', () => {
    it('selecting gsap-scrolltrigger ships both vendored bundles, in core-then-plugin order, plus the init glue', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['gsap-scrolltrigger']);
      assert.deepEqual(declared, ['gsap-scrolltrigger']);

      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';

      assert.ok(js.includes('e.gsap=Nr'), 'the vendored GSAP core body reached runtime.js');
      assert.ok(js.includes('e.ScrollTrigger=ne'), 'the vendored ScrollTrigger plugin body reached runtime.js');
      assert.ok(
        js.indexOf('e.gsap=Nr') < js.indexOf('e.ScrollTrigger=ne'),
        'the core bundle must precede the plugin bundle — ScrollTrigger reads window.gsap at load time',
      );
      assert.ok(js.includes('startGsapScrollTrigger'), 'the init function reached runtime.js');
      assert.ok(js.includes('window.gsap.registerPlugin(window.ScrollTrigger)'), 'the adapter actually registers the plugin');
      assert.ok(js.includes('scrollTrigger:'), 'a real ScrollTrigger config is built, not a stub call');
      assert.ok(js.includes('startScrollProgress'), 'the base scroll-progress runtime is still present');
    });

    it('gsap-scrolltrigger has no CSS half — styles.css is unaffected by selecting it', () => {
      const withoutIt = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: [] });
      const withIt = renderSite(fullContent, {
        runtime: 'scroll-progress',
        runtimePrimitives: resolvePrimitives(architecture({ mode: 'showcase' }), ['gsap-scrolltrigger']),
      });
      assert.equal(cssOf(withIt.files), cssOf(withoutIt.files), 'a JS-only primitive must not change styles.css at all');
    });

    it('not selecting gsap-scrolltrigger ships neither vendored bundle', () => {
      const declared = resolvePrimitives(architecture({ mode: 'narrative', transition: 'veil' })); // scroll-reveal + text-reveal, no GSAP
      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';
      assert.ok(!js.includes('e.gsap=Nr'));
      assert.ok(!js.includes('startGsapScrollTrigger'));
    });

    it('the reduced-motion guard runs before the plugin is ever registered', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['gsap-scrolltrigger']);
      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';

      const initStart = js.indexOf('function startGsapScrollTrigger');
      const registerIndex = js.indexOf('window.gsap.registerPlugin', initStart);
      const reducedMotionGuardIndex = js.indexOf("matchMedia('(prefers-reduced-motion: reduce)')", initStart);
      assert.ok(initStart >= 0 && registerIndex > initStart && reducedMotionGuardIndex >= 0);
      assert.ok(reducedMotionGuardIndex < registerIndex, 'the reduced-motion guard must be checked before plugin registration');
    });

    it('registration and every ScrollTrigger build sit inside one try/catch — a throw falls back to the static floor', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['gsap-scrolltrigger']);
      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';
      const initFragment = js.slice(js.indexOf('function startGsapScrollTrigger'));
      assert.ok(/try\s*\{[\s\S]*registerPlugin[\s\S]*?\}\s*catch/.test(initFragment), 'registration must be inside a try/catch');
    });

    it('Lenis and GSAP ScrollTrigger can both be declared together, within budget, and both reach the artifact', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['lenis-smooth-scroll', 'gsap-scrolltrigger']);
      assert.deepEqual(declared, ['lenis-smooth-scroll', 'gsap-scrolltrigger']);

      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';
      assert.ok(js.includes('globalThis.Lenis'), 'Lenis reaches runtime.js');
      assert.ok(js.includes('startGsapScrollTrigger'), 'GSAP ScrollTrigger reaches runtime.js alongside it');
    });
  });

  describe('Three.js hero object (open_source, vendored, sibling-file) — the third external primitive, and the first to need its own file', () => {
    it('selecting three-js-hero-object ships a real runtime/three.core.min.js sibling file, not just JS in runtime.js', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['three-js-hero-object']);
      assert.deepEqual(declared, ['three-js-hero-object']);

      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const threeFile = site.files.find((f) => f.path === 'runtime/three.core.min.js');
      assert.ok(threeFile, 'the vendored Three.js core must ship as its own sibling file');
      // The vendored upstream build — real Three.js, not a stub. A single
      // trailing named-export statement is the exact shape the real
      // three.core.min.js ends on.
      assert.ok(threeFile!.contents.includes('export{'), 'the vendored file is a genuine ES module with real exports');
      assert.ok(threeFile!.contents.length > 300000, 'the vendored core is the real ~385KB build, not a placeholder');

      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';
      assert.ok(js.includes("import * as THREE from './runtime/three.core.min.js';"), 'runtime.js imports from the exact sibling path that was actually emitted');
      assert.ok(js.includes('startThreeHero'), 'the init function reached runtime.js');
      assert.ok(js.includes('new THREE.WebGLRenderer'), 'the adapter actually constructs a real Three.js renderer');
      assert.ok(js.includes('IcosahedronGeometry'), 'a real procedural geometry is built, not a stub scene');
      assert.ok(js.includes('startScrollProgress'), 'the base scroll-progress runtime is still present alongside it');
    });

    it('not selecting three-js-hero-object ships neither the sibling file nor its runtime.js glue', () => {
      const declared = resolvePrimitives(architecture({ mode: 'narrative', transition: 'veil' })); // scroll-reveal + text-reveal, no Three.js
      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      assert.ok(!site.files.some((f) => f.path === 'runtime/three.core.min.js'), 'the sibling file must not exist when the primitive was never selected');
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';
      assert.ok(!js.includes('startThreeHero'));
      assert.ok(!js.includes("from './runtime/three.core.min.js'"));
    });

    it('the sibling file only ships alongside runtime.js — with runtime:"none" nothing at all is emitted', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['three-js-hero-object']);
      const site = renderSite(fullContent, { runtime: 'none', runtimePrimitives: declared });
      assert.deepEqual(site.files.map((f) => f.path), ['index.html', 'styles.css'], 'the structural tie in resolveOptions drops the primitive, and with it the sibling file, when the base runtime is off');
    });

    it('the reduced-motion guard runs before the renderer is ever constructed', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['three-js-hero-object']);
      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';

      const initStart = js.indexOf('function startThreeHero');
      const constructIndex = js.indexOf('new THREE.WebGLRenderer');
      const reducedMotionGuardIndex = js.indexOf("matchMedia('(prefers-reduced-motion: reduce)')", initStart);
      assert.ok(initStart >= 0 && constructIndex > initStart && reducedMotionGuardIndex >= 0);
      assert.ok(reducedMotionGuardIndex < constructIndex, 'the reduced-motion guard must be checked before construction');
    });

    it('the mobile/coarse-pointer guard also runs before construction — touch devices never get the WebGL primitive', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['three-js-hero-object']);
      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';

      const initStart = js.indexOf('function startThreeHero');
      const constructIndex = js.indexOf('new THREE.WebGLRenderer');
      const coarsePointerGuardIndex = js.indexOf("matchMedia('(pointer: coarse)')", initStart);
      assert.ok(coarsePointerGuardIndex >= 0 && coarsePointerGuardIndex < constructIndex, 'the coarse-pointer guard must be checked before construction');
    });

    it('WebGLRenderer construction is wrapped in try/catch — a throw falls back to the static floor', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['three-js-hero-object']);
      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';
      const initFragment = js.slice(js.indexOf('function startThreeHero'));
      assert.ok(/try\s*\{[\s\S]*new THREE\.WebGLRenderer[\s\S]*?\}\s*catch/.test(initFragment), 'construction must be inside a try/catch');
    });

    it('ships its CSS half scoped under data-runtime-three, inert unless the JS guard path succeeded', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['three-js-hero-object']);
      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const css = cssOf(site.files);
      assert.ok(css.includes('[data-runtime-three="active"]'));
      assert.ok(css.includes('.forge-three-hero'));
      assert.ok(css.includes('pointer-events: none'), 'the canvas must never intercept a click meant for the hero CTA');
    });

    it('all three external primitives can be declared together, within budget, and the two that fit both reach the artifact', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), [
        'lenis-smooth-scroll',
        'gsap-scrolltrigger',
        'three-js-hero-object',
      ]);
      // RUNTIME_PRIMITIVE_BUDGET (2) caps this to the first two declared.
      assert.deepEqual(declared, ['lenis-smooth-scroll', 'gsap-scrolltrigger']);

      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      assert.ok(!site.files.some((f) => f.path === 'runtime/three.core.min.js'), 'a budget-cut primitive must not leak its sibling file into the artifact');
    });

    it('Three.js can itself be paired with an internal primitive within budget, and both reach the artifact', () => {
      const declared = resolvePrimitives(architecture({ mode: 'showcase' }), ['scroll-reveal', 'three-js-hero-object']);
      assert.deepEqual(declared, ['scroll-reveal', 'three-js-hero-object']);

      const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: declared });
      const css = cssOf(site.files);
      const js = site.files.find((f) => f.path === 'runtime.js')?.contents ?? '';
      assert.ok(css.includes('.section:not(.section--hero)'), 'scroll-reveal still reaches styles.css');
      assert.ok(site.files.some((f) => f.path === 'runtime/three.core.min.js'), 'Three.js sibling file still ships alongside it');
      assert.ok(js.includes('startThreeHero'));
    });
  });
});
