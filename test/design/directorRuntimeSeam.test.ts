/**
 * The Creative Director → registry → resolver → renderer → artifact seam.
 *
 * This is the exact sequence `main.ts`'s `executePipeline` calls at its
 * `renderStage` call site — `directiveRuntimePrimitiveIds(directive)` then
 * `resolvePrimitives(NEUTRAL_ARCHITECTURE, ids)` then `renderSite(content,
 * { runtime, runtimePrimitives })` — composed here without the surrounding
 * agent/network stages, the same way `test/render/runtimePrimitives.
 * integration.test.ts` already proves the Lenis/GSAP/Three.js seams without
 * spinning up a full pipeline. A `DesignDirective` (untrusted, provider-
 * shaped input) goes in; an inspected rendered artifact comes out.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { directiveRuntimePrimitiveIds } from '../../lib/design/directive.js';
import { NEUTRAL_ARCHITECTURE } from '../../lib/design/experience.js';
import { resolvePrimitives } from '../../lib/design/experienceRegistry.js';
import { renderSite } from '../../lib/render/index.js';
import { fullContent } from '../fixtures/content.js';

import type { DesignDirective } from '../../lib/design/directive.js';
import type { RenderedFile } from '../../lib/render/types.js';

/** The exact composition `main.ts` performs, isolated for testing. */
function resolveForDirective(directive: DesignDirective | undefined) {
  return resolvePrimitives(NEUTRAL_ARCHITECTURE, directiveRuntimePrimitiveIds(directive));
}

function cssOf(files: readonly RenderedFile[]): string {
  const file = files.find((f) => f.path === 'styles.css');
  assert.ok(file, 'styles.css was not rendered');
  return file.contents;
}

function jsOf(files: readonly RenderedFile[]): string {
  return files.find((f) => f.path === 'runtime.js')?.contents ?? '';
}

describe('Creative Director → registry → resolver → renderer → artifact', () => {
  it('a valid Director selection reaches resolvePrimitives, in order', () => {
    const directive: DesignDirective = {
      runtimePrimitives: [
        { id: 'lenis-smooth-scroll', reason: 'editorial scroll pacing for a portfolio-heavy studio' },
      ],
    };
    assert.deepEqual(resolveForDirective(directive), ['lenis-smooth-scroll']);
  });

  it('an unknown/made-up id passes shape validation but is rejected by the registry', () => {
    // RuntimePrimitiveRequest.id is deliberately typed `string`, not
    // `RuntimePrimitiveId` (see directive.ts's doc comment) — the type
    // system does not, and should not, catch this; resolvePrimitives is the
    // enforcement, which this test proves.
    const directive: DesignDirective = {
      runtimePrimitives: [{ id: 'made-up-webgl-thing', reason: 'sounds impressive' }],
    };
    assert.deepEqual(resolveForDirective(directive), []);
  });

  it('a not-integrated registry entry (real id, wrong integrationMode) is rejected the same way', () => {
    // A real EXPERIENCE_REGISTRY key (status: researched, not exists) —
    // still just a string as far as the directive's type is concerned.
    const directive: DesignDirective = {
      runtimePrimitives: [{ id: 'awwwards-teardown-corpus', reason: 'not actually dispatchable' }],
    };
    assert.deepEqual(resolveForDirective(directive), []);
  });

  it('a selection exceeding the runtime budget is capped, not rejected outright', () => {
    const directive: DesignDirective = {
      runtimePrimitives: [
        { id: 'lenis-smooth-scroll', reason: 'a' },
        { id: 'gsap-scrolltrigger', reason: 'b' },
        { id: 'three-js-hero-object', reason: 'c' },
      ],
    };
    const resolved = resolveForDirective(directive);
    assert.deepEqual(resolved, ['lenis-smooth-scroll', 'gsap-scrolltrigger']);
  });

  it('a malformed directive (garbage runtimePrimitives shape) falls back to no primitives, never throws', () => {
    // A real provider response is untrusted input, not a value the type
    // system already guarantees — `unknown` first, matching how
    // `assertDirectiveShape` in designDirectorAgent.ts treats the raw
    // response before this point in the real pipeline.
    const directive = { runtimePrimitives: 'not-an-array-at-all' } as unknown as DesignDirective;
    assert.deepEqual(resolveForDirective(directive), []);
  });

  it('no directive at all (director disabled — the default) resolves to no primitives', () => {
    assert.deepEqual(resolveForDirective(undefined), []);
  });

  it('a directive that says nothing about primitives resolves to no primitives — the common, correct answer', () => {
    const directive: DesignDirective = { direction: 'minimal', rationale: 'a plain trade site' };
    assert.deepEqual(resolveForDirective(directive), []);
  });

  it('the resolved selection reaches a real rendered artifact: a genuine Director choice ships', () => {
    const directive: DesignDirective = {
      runtimePrimitives: [{ id: 'gsap-scrolltrigger', reason: 'scroll-scrubbed reveal for an editorial studio' }],
    };
    const resolved = resolveForDirective(directive);
    const site = renderSite(fullContent, {
      ...(resolved.length > 0 ? { runtime: 'scroll-progress' as const, runtimePrimitives: resolved } : {}),
    });

    assert.ok(site.files.some((f) => f.path === 'runtime.js'), 'engaging a primitive must engage the base runtime');
    assert.ok(jsOf(site.files).includes('startGsapScrollTrigger'), 'the Director-selected primitive reached runtime.js');
    const htmlFile = site.files.find((f) => f.path === 'index.html');
    assert.ok(htmlFile?.contents.includes('data-runtime="scroll-progress"'));
  });

  it('an unselected primitive never reaches the artifact, even when others are selected', () => {
    const directive: DesignDirective = {
      runtimePrimitives: [{ id: 'lenis-smooth-scroll', reason: 'x' }],
    };
    const resolved = resolveForDirective(directive);
    const site = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: resolved });
    const js = jsOf(site.files);
    assert.ok(js.includes('globalThis.Lenis'), 'the selected primitive shipped');
    assert.ok(!js.includes('startGsapScrollTrigger'), 'GSAP was never selected and must not appear');
    assert.ok(!js.includes('startThreeHero'), 'Three.js was never selected and must not appear');
    assert.ok(!site.files.some((f) => f.path === 'runtime/three.core.min.js'), 'no unselected sibling file leaked in');
  });

  it('no selection (director off) produces an artifact byte-identical to the no-options call — real zero-regression proof', () => {
    const resolved = resolveForDirective(undefined);
    assert.deepEqual(resolved, []);

    const withExplicitEmptySelection = renderSite(fullContent, {
      ...(resolved.length > 0 ? { runtime: 'scroll-progress' as const, runtimePrimitives: resolved } : {}),
    });
    const withNoOptionsAtAll = renderSite(fullContent);

    assert.deepEqual(
      withExplicitEmptySelection.files.map((f) => f.path),
      withNoOptionsAtAll.files.map((f) => f.path),
    );
    assert.equal(cssOf(withExplicitEmptySelection.files), cssOf(withNoOptionsAtAll.files));
    assert.equal(
      withExplicitEmptySelection.files.find((f) => f.path === 'index.html')?.contents,
      withNoOptionsAtAll.files.find((f) => f.path === 'index.html')?.contents,
    );
  });

  it('different businesses (different directives) genuinely produce different artifacts', () => {
    const luxuryStudio: DesignDirective = {
      runtimePrimitives: [
        { id: 'lenis-smooth-scroll', reason: 'editorial pacing' },
        { id: 'gsap-scrolltrigger', reason: 'section reveal choreography' },
      ],
    };
    const localTrade: DesignDirective = { direction: 'minimal', rationale: 'fast, direct, phone-first' };

    const studioResolved = resolveForDirective(luxuryStudio);
    const tradeResolved = resolveForDirective(localTrade);

    assert.deepEqual(studioResolved, ['lenis-smooth-scroll', 'gsap-scrolltrigger']);
    assert.deepEqual(tradeResolved, []);
    assert.notDeepEqual(studioResolved, tradeResolved, 'the same arsenal must produce different decisions for different businesses');

    const studioSite = renderSite(fullContent, { runtime: 'scroll-progress', runtimePrimitives: studioResolved });
    const tradeSite = renderSite(fullContent, {}); // no runtime engaged — resolved to []

    assert.ok(!tradeSite.files.some((f) => f.path === 'runtime.js'), 'a business with no earned primitive ships no runtime.js at all');
    assert.ok(studioSite.files.some((f) => f.path === 'runtime.js'), 'a business with an earned selection ships one');
    assert.notEqual(jsOf(studioSite.files).length, 0);
  });
});
