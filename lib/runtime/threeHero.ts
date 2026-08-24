/**
 * Three.js hero-object adapter — the third external, open-source Tier-2
 * runtime primitive (registry id `three-js-hero-object`), and the first to
 * need a real sibling file instead of a single concatenated string.
 *
 * ## The shipping-strategy question, resolved
 *
 * `three.core.min.js` is a genuine ES module: no `import` (verified by
 * direct inspection of the published `three@0.185.1` tarball — a single
 * `export{...}` statement at the very end, nothing else), but a module with
 * only named exports does nothing until something imports from it. That
 * import has to be a real, browser-resolved relative URL — it cannot be
 * satisfied by concatenating strings the way `lib/runtime/lenis.ts` and
 * `lib/runtime/gsapScrollTrigger.ts` do.
 *
 * The fix is smaller than it sounds: `runtime.js` already ships as
 * `<script type="module">` (`lib/render/document.ts`), so it can contain a
 * real top-level `import * as THREE from './three.core.min.js';` statement
 * exactly like any other ES module — the only missing piece was a way for a
 * primitive to say "also ship this file, at this path", which
 * `lib/render/runtimeAssets.ts` now provides generically (not a
 * Three.js-specific mechanism — any future primitive with the same shape of
 * problem uses the same table).
 *
 * ## What this primitive actually does
 *
 * A generic, deterministic-*logic* signature object: a slowly rotating
 * wireframe icosahedron, procedurally generated (`THREE.IcosahedronGeometry`
 * — no external 3D asset, no per-business configuration, nothing for a model
 * to have arbitrarily authored), layered as a transparent, `pointer-events:
 * none`, `aria-hidden` overlay on the hero section. "Deterministic-logic"
 * is doing real work in that phrase: the geometry math and rotation
 * increment are exactly reproducible, but the actual rendered pixels are
 * not (`deterministic: false` in the registry stays honest — GPU/driver
 * antialiasing and colour-space handling are not bit-reproducible, and
 * that was never something infrastructure could fix).
 *
 * ## Guard discipline — same shape as Lenis/GSAP, same reasons
 *
 * 1. reduced motion    → never create a canvas or touch the DOM.
 * 2. coarse pointer     → never create a canvas — `performanceCost: 'high'`
 *    (a continuous per-frame GPU draw call) is a real battery/thermal cost
 *    on a phone, so this primitive disables outright rather than degrading,
 *    the same choice Lenis made and GSAP ScrollTrigger deliberately did not
 *    (`mobileSupport: 'disabled'`, not `'degraded'`).
 * 3. no `.section--hero` in the page → nothing to attach to; no-op.
 * 4. `WebGLRenderer` construction throws (blocked driver, disabled WebGL,
 *    a headless/low-power context) → caught; the canvas is never attached.
 * 5. the render loop itself throws  → caught; everything created so far is
 *    torn down immediately, not left half-running.
 */
import { THREE_CORE_VENDOR_SOURCE, THREE_VENDOR_LICENSE, THREE_VENDOR_PACKAGE, THREE_VENDOR_VERSION } from './vendor/threeSource.js';

import type { RenderedFile } from '../render/types.js';

export { THREE_VENDOR_LICENSE, THREE_VENDOR_PACKAGE, THREE_VENDOR_VERSION };

/** Site-relative path the vendored core ships at — `runtime.js`'s import statement below must match this exactly. */
export const THREE_CORE_ASSET_PATH = 'runtime/three.core.min.js';

/**
 * The sibling file(s) this primitive contributes, dispatched by
 * `lib/render/runtimeAssets.ts`. One file today; the array shape is what
 * lets a future primitive (or a future Three.js addon) contribute more than
 * one without changing the mechanism.
 */
export const THREE_HERO_ASSET_FILES: readonly RenderedFile[] = [
  { path: THREE_CORE_ASSET_PATH, contents: THREE_CORE_VENDOR_SOURCE },
];

/**
 * The `runtime.js` fragment for `three-js-hero-object`: a real static
 * `import`, then the guarded init/teardown glue. Static `import` statements
 * are hoisted by the engine regardless of where they sit textually in the
 * module, so this is safe to concatenate after `RUNTIME_SOURCE` and any
 * other primitive's fragment exactly like every other entry in
 * `RUNTIME_PRIMITIVE_SOURCES` — it does not need to be first.
 *
 * `data-runtime-three="active"` is set on the hero element itself (not
 * `<html>`) only once every guard has passed and the canvas is about to be
 * attached — the one hook `THREE_HERO_STYLE_RULES` needs to position the
 * canvas, and, same as `.lenis` / `data-runtime-cursor`, a marker only this
 * script's own success path ever sets.
 */
export const THREE_HERO_INIT_SOURCE = `import * as THREE from './${THREE_CORE_ASSET_PATH}';
function startThreeHero() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return function () {};
  if (window.matchMedia('(pointer: coarse)').matches) return function () {};
  var hero = document.querySelector('.section--hero');
  if (!hero) return function () {};

  var renderer;
  var canvas = document.createElement('canvas');
  canvas.className = 'forge-three-hero';
  canvas.setAttribute('aria-hidden', 'true');
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
  } catch (err) {
    return function () {};
  }

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 6;
  var geometry = new THREE.IcosahedronGeometry(2, 1);
  var material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 });
  var mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  var resize = function () {
    var rect = hero.getBoundingClientRect();
    var width = Math.max(1, rect.width);
    var height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  var rafId = null;
  var animate = function () {
    mesh.rotation.x += 0.0015;
    mesh.rotation.y += 0.0025;
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  };

  var teardown = function () {
    if (rafId !== null) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', resize);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    canvas.remove();
    hero.removeAttribute('data-runtime-three');
  };

  try {
    hero.setAttribute('data-runtime-three', 'active');
    hero.appendChild(canvas);
    resize();
    window.addEventListener('resize', resize, { passive: true });
    animate();
  } catch (err) {
    teardown();
    return function () {};
  }

  window.addEventListener('pagehide', teardown, { once: true });
  return teardown;
}
startThreeHero();
`;

/** The full `runtime.js` fragment dispatched for this primitive — import + glue, nothing else. */
export const THREE_HERO_RUNTIME_SOURCE = THREE_HERO_INIT_SOURCE;

/**
 * The CSS half. Scoped entirely under `[data-runtime-three="active"]` /
 * `.forge-three-hero` — attributes and a class only this script's own
 * success path ever sets — so it is inert on any page or visitor the guards
 * above reject, the same "reports/marks, the stylesheet decides, nothing is
 * assumed" split every other primitive in `lib/render/runtime-rules.ts`
 * already uses. `pointer-events: none` keeps the canvas from ever
 * intercepting a click meant for the hero's own CTA.
 */
export const THREE_HERO_STYLE_RULES = `
[data-runtime-three="active"] {
  position: relative;
}
.forge-three-hero {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}
`;
