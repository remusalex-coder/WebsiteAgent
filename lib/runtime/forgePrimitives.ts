/**
 * Two new internal Tier-2 runtime primitives for the Awwwards path
 * (registry ids `horizontal-scroll` and `bento-card-tilt`), plus the
 * cursor-reactive extension of the existing Three.js hero.
 *
 * Same contract as every other primitive in this repository:
 *   - guarded by `prefers-reduced-motion: reduce` and `pointer: coarse`;
 *   - never throws into the visitor — every construction sits in try/catch
 *     and degrades to a no-op (the static floor);
 *   - reports/markers only its own success path sets, so the CSS half is
 *     inert on any rejected visitor.
 *
 * No external library is vendored: `horizontal-scroll` and `bento-card-tilt`
 * are pure CSS+DOM (the exact technique the Awwwards-build tutorials teach),
 * and `cursor-reactive-webgl` reuses the already-vendored `three.core.min.js`.
 */

import { THREE_CORE_ASSET_PATH, THREE_HERO_ASSET_FILES } from './threeHero.js';
import type { RenderedFile } from '../render/types.js';

/* ------------------------------------------------------------------ */
/* horizontal-scroll                                                  */
/* ------------------------------------------------------------------ */

export const HORIZONTAL_SCROLL_SOURCE = `function startHorizontalScroll() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return function () {};
  if (window.matchMedia('(pointer: coarse)').matches) return function () {};
  var sections = Array.from(document.querySelectorAll('[data-runtime-hscroll]'));
  if (!sections.length) return function () {};

  var cleanups = sections.map(function (section) {
    var track = section.querySelector('[data-hscroll-track]') || section.firstElementChild;
    if (!track) return function () {};
    var distance = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
    var setX = function (x) { track.style.transform = 'translate3d(' + (-x) + 'px,0,0)'; };
    var st = {
      trigger: section,
      start: 'top top',
      end: function () { return '+=' + distance(); },
      pin: true,
      scrub: 1,
      onUpdate: function (self) { setX(self.progress * distance()); }
    };
    if (window.ScrollTrigger) { window.ScrollTrigger.create(st); }
    else {
      // Fallback: map window scroll near the section to the track offset.
      var onScroll = function () {
        var rect = section.getBoundingClientRect();
        var vh = window.innerHeight;
        if (rect.top > vh || rect.bottom < 0) return;
        var p = Math.min(1, Math.max(0, (-rect.top) / (rect.height - vh || 1)));
        setX(p * distance());
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      return function () { window.removeEventListener('scroll', onScroll); };
    }
    return function () {};
  });

  return function () { cleanups.forEach(function (c) { try { c(); } catch (e) {} }); };
}
startHorizontalScroll();
`;

export const HORIZONTAL_SCROLL_RULES = `
[data-runtime-hscroll] {
  overflow: hidden;
}
[data-runtime-hscroll] [data-hscroll-track] {
  display: flex;
  flex-wrap: nowrap;
  will-change: transform;
}
`;

/* ------------------------------------------------------------------ */
/* bento-card-tilt                                                    */
/* ------------------------------------------------------------------ */

export const BENTO_CARD_TILT_SOURCE = `function startBentoCardTilt() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return function () {};
  if (window.matchMedia('(pointer: coarse)').matches) return function () {};
  var cards = Array.from(document.querySelectorAll('[data-tilt]'));
  if (!cards.length) return function () {};

  var handlers = cards.map(function (card) {
    var MAX = 10;
    var onMove = function (e) {
      var r = card.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--tilt-x', (py * -MAX).toFixed(2) + 'deg');
      card.style.setProperty('--tilt-y', (px * MAX).toFixed(2) + 'deg');
      card.style.setProperty('--tilt-glow-x', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      card.style.setProperty('--tilt-glow-y', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    };
    var onLeave = function () {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    };
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerleave', onLeave);
    return function () {
      card.removeEventListener('pointermove', onMove);
      card.removeEventListener('pointerleave', onLeave);
    };
  });

  return function () { handlers.forEach(function (h) { try { h(); } catch (e) {} }); };
}
startBentoCardTilt();
`;

export const BENTO_CARD_TILT_RULES = `
[data-tilt] {
  transform: perspective(800px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
  transition: transform 120ms ease-out;
  transform-style: preserve-3d;
}
[data-tilt]::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(220px circle at var(--tilt-glow-x, 50%) var(--tilt-glow-y, 50%), rgba(255,255,255,0.18), transparent 60%);
  opacity: 0;
  transition: opacity 120ms ease-out;
}
[data-tilt]:hover::after { opacity: 1; }
`;

/* ------------------------------------------------------------------ */
/* cursor-reactive-webgl (extends three-js-hero-object)               */
/* ------------------------------------------------------------------ */

export const CURSOR_WEBGL_ASSET_FILES: readonly RenderedFile[] = THREE_HERO_ASSET_FILES;

export const CURSOR_WEBGL_INIT_SOURCE = `import * as THREE from './${THREE_CORE_ASSET_PATH}';
function startCursorWebgl() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return function () {};
  if (window.matchMedia('(pointer: coarse)').matches) return function () {};
  var hero = document.querySelector('.section--hero') || document.querySelector('[data-runtime-cursor-webgl]');
  if (!hero) return function () {};

  var canvas = document.createElement('canvas');
  canvas.className = 'forge-cursor-webgl';
  canvas.setAttribute('aria-hidden', 'true');
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true }); }
  catch (err) { return function () {}; }

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  camera.position.z = 5;
  var COUNT = 600;
  var positions = new Float32Array(COUNT * 3);
  for (var i = 0; i < COUNT; i++) {
    positions[i*3] = (Math.random() - 0.5) * 10;
    positions[i*3+1] = (Math.random() - 0.5) * 6;
    positions[i*3+2] = (Math.random() - 0.5) * 4;
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  var mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.7 });
  var points = new THREE.Points(geo, mat);
  scene.add(points);

  var pointer = { x: 0, y: 0 };
  var onMove = function (e) {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  var resize = function () {
    var rect = hero.getBoundingClientRect();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = rect.width / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  };
  var rafId = null;
  var animate = function () {
    points.rotation.y += 0.0008;
    camera.position.x += (pointer.x * 1.5 - camera.position.x) * 0.05;
    camera.position.y += (pointer.y * 1.0 - camera.position.y) * 0.05;
    camera.lookAt(scene.position);
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(animate);
  };
  var teardown = function () {
    if (rafId !== null) cancelAnimationFrame(rafId);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('resize', resize);
    geo.dispose(); mat.dispose(); renderer.dispose();
    canvas.remove();
    hero.removeAttribute('data-runtime-cursor-webgl');
  };
  try {
    hero.setAttribute('data-runtime-cursor-webgl', 'active');
    hero.appendChild(canvas);
    resize();
    window.addEventListener('resize', resize, { passive: true });
    animate();
  } catch (err) { teardown(); return function () {}; }
  window.addEventListener('pagehide', teardown, { once: true });
  return teardown;
}
startCursorWebgl();
`;

export const CURSOR_WEBGL_RULES = `
[data-runtime-cursor-webgl] { position: relative; }
.forge-cursor-webgl {
  position: absolute; inset: 0; width: 100%; height: 100%;
  pointer-events: none; z-index: 1;
}
`;

/* ------------------------------------------------------------------ */
/* marquee — infinite scrolling banner (Awwwards standard)            */
/* ------------------------------------------------------------------ */

export const MARQUEE_SOURCE = `function startMarquee() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
}
startMarquee();
`;

export const MARQUEE_RULES = `
@media (prefers-reduced-motion: no-preference) {
  [data-runtime-marquee] {
    display: flex;
    overflow: hidden;
    user-select: none;
    gap: var(--marquee-gap, 2rem);
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  }
  [data-runtime-marquee] > .marquee__track {
    display: flex;
    flex-shrink: 0;
    gap: var(--marquee-gap, 2rem);
    min-width: 100%;
    align-items: center;
    animation: marquee-scroll var(--marquee-duration, 22s) linear infinite;
    will-change: transform;
  }
  [data-runtime-marquee]:hover > .marquee__track { animation-play-state: paused; }
  [data-runtime-marquee] .marquee__item {
    white-space: nowrap;
    font: var(--marquee-font, var(--font-display, inherit));
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  @keyframes marquee-scroll {
    from { transform: translateX(0); }
    to { transform: translateX(-100%); }
  }
}
`;

/* ------------------------------------------------------------------ */
/* image-hover-reveal — clip-path / scale reveal on hover            */
/* ------------------------------------------------------------------ */

export const IMAGE_HOVER_REVEAL_SOURCE = `function startImageHoverReveal() {
  // Pure CSS handles the reveal; nothing to observe.
}
startImageHoverReveal();
`;

export const IMAGE_HOVER_REVEAL_RULES = `
@media (prefers-reduced-motion: no-preference) {
  [data-runtime-img-reveal] {
    position: relative;
    overflow: hidden;
    display: block;
  }
  [data-runtime-img-reveal] img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.04);
    transition: transform 700ms cubic-bezier(0.16, 1, 0.3, 1), filter 700ms ease;
    filter: saturate(0.9);
  }
  [data-runtime-img-reveal]:hover img {
    transform: scale(1.12);
    filter: saturate(1.1);
  }
  [data-runtime-img-reveal]::after {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--img-reveal-tint, rgba(0,0,0,0.18));
    opacity: 0;
    transition: opacity 500ms ease;
    pointer-events: none;
  }
  [data-runtime-img-reveal]:hover::after { opacity: 1; }
}
`;

/* ------------------------------------------------------------------ */
/* animated-counter — count-up cifre la scroll (Awwwards standard)    */
/* ------------------------------------------------------------------ */

export const ANIMATED_COUNTER_SOURCE = `function startAnimatedCounters() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var els = Array.from(document.querySelectorAll('[data-count-to]'));
  if (!els.length) return;
  var run = function (el) {
    var to = parseFloat(el.getAttribute('data-count-to')) || 0;
    var dur = parseInt(el.getAttribute('data-count-dur') || '1400', 10);
    var start = performance.now();
    var tick = function (now) {
      var p = Math.min(1, (now - start) / dur);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * eased).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  if (!('IntersectionObserver' in window)) { els.forEach(run); return; }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
    });
  }, { threshold: 0.4 });
  els.forEach(function (el) { io.observe(el); });
}
startAnimatedCounters();
`;

export const ANIMATED_COUNTER_RULES = `
[data-count-to] { font-variant-numeric: tabular-nums; }
`;

/* ------------------------------------------------------------------ */
/* sticky-text-pin — text pin + progress bar la scroll               */
/* ------------------------------------------------------------------ */

export const STICKY_TEXT_PIN_SOURCE = `function startStickyTextPin() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(pointer: coarse)').matches) return;
  var pins = Array.from(document.querySelectorAll('[data-runtime-pin]'));
  if (!pins.length) return;
  var cleanups = pins.map(function (pin) {
    var bar = pin.querySelector('[data-pin-progress]');
    var set = function () {
      var rect = pin.getBoundingClientRect();
      var vh = window.innerHeight;
      var total = rect.height - vh;
      var p = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
      if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    };
    var onScroll = function () { requestAnimationFrame(set); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    set();
    return function () { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  });
  return function () { cleanups.forEach(function (c) { try { c(); } catch (e) {} }); };
}
startStickyTextPin();
`;

export const STICKY_TEXT_PIN_RULES = `
@media (prefers-reduced-motion: no-preference) and (min-width: 768px) {
  [data-runtime-pin] {
    position: sticky;
    top: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  [data-runtime-pin] [data-pin-progress] {
    transform-origin: left center;
    transform: scaleX(0);
    height: 3px;
    background: var(--color-accent, currentColor);
    width: 100%;
  }
}
`;

/* ------------------------------------------------------------------ */
/* menu-overlay — fullscreen nav animata (Awwwards standard)          */
/* ------------------------------------------------------------------ */

export const MENU_OVERLAY_SOURCE = `function startMenuOverlay() {
  var toggle = document.querySelector('[data-menu-toggle]');
  var nav = document.querySelector('[data-menu-overlay]');
  if (!toggle || !nav) return;
  var open = false;
  var setOpen = function (v) {
    open = v;
    nav.setAttribute('data-menu-open', open ? 'true' : 'false');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.documentElement.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', function () { setOpen(!open); });
  nav.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', function () { setOpen(false); });
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) setOpen(false);
  });
  return function () {};
}
startMenuOverlay();
`;

export const MENU_OVERLAY_RULES = `
[data-menu-toggle] {
  position: fixed;
  top: var(--space-md, 1.5rem);
  right: var(--space-md, 1.5rem);
  z-index: 1000;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--color-border, #ccc);
  background: var(--color-surface, #fff);
  cursor: pointer;
}
[data-menu-overlay] {
  position: fixed;
  inset: 0;
  z-index: 999;
  display: grid;
  place-content: center;
  gap: var(--space-md, 1.5rem);
  background: var(--color-bg, #111);
  color: var(--color-on-bg, #fff);
  opacity: 0;
  visibility: hidden;
  transform: translateY(-2%);
  transition: opacity 360ms ease, transform 360ms ease, visibility 0s linear 360ms;
}
[data-menu-overlay][data-menu-open='true'] {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
  transition: opacity 360ms ease, transform 360ms ease, visibility 0s;
}
[data-menu-overlay] a {
  color: inherit;
  font: var(--font-display, inherit);
  font-size: clamp(1.6rem, 5vw, 3rem);
  text-decoration: none;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
@media (prefers-reduced-motion: reduce) {
  [data-menu-overlay] { transition: opacity 200ms ease, visibility 0s; transform: none; }
}
`;
