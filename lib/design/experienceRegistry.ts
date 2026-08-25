/**
 * Asset & Experience Registry — the first executable bridge between the
 * research arsenal (`research/asset-stack/`, `research/auxiliary-arsenal/`,
 * `docs/knowledge/`) and the generation pipeline.
 *
 * Answers, per primitive: is this callable by production code today, or only
 * documented? If callable, under what licence, at what cost, with what
 * fallback? Nothing here duplicates the research — every non-`exists` row
 * cites the document it came from rather than re-deriving a conclusion.
 *
 * ## The rule this registry exists to enforce
 *
 * A `RuntimePrimitiveId` (`lib/design/experience.ts`) may only ever resolve
 * to an entry whose `status` is `'exists'` and whose `integrationMode` is
 * `'runtime-primitive'`. A `'researched'` row — however well-documented,
 * however permissive its licence — is a candidate for a *future* integration
 * pass, never something `resolvePrimitives` below can select today. This is
 * the same "declare it, do not silently reach for it" discipline
 * `lib/capability/registry.ts` already applies to `three_d_generation`/
 * `audio_speech` (`gate: 'never'`), extended to the experience-primitive
 * layer.
 *
 * Until the Lenis integration, that boundary happened to line up exactly
 * with `sourceType === 'internal'` — every executable row was hand-written
 * by this repository, and every `'open_source'` row was a citation, not
 * code. That coincidence is gone now: `lenis-smooth-scroll`,
 * `gsap-scrolltrigger`, and `three-js-hero-object` are all
 * `sourceType: 'open_source'` *and* `status: 'exists'` *and*
 * `integrationMode: 'runtime-primitive'`, because each has a real adapter
 * (`lib/runtime/lenis.ts`, `lib/runtime/gsapScrollTrigger.ts`,
 * `lib/runtime/threeHero.ts`) that vendors the actual published library and
 * ships it in the artifact — see each entry's `externalIntegration` field
 * for the full contract. `sourceType` alone was never the safety property;
 * having *earned* `status: 'exists'` through a real, evidenced adapter is.
 * `three-js-hero-object` in particular needed one more piece the first two
 * did not: its vendored build is a genuine ES module, reachable only by a
 * real `import` statement, not by string concatenation — see
 * `lib/render/runtimeAssets.ts` for the generic "a primitive can ship extra
 * sibling files" mechanism that unblocked it.
 */

import { deriveRuntimePrimitives, RUNTIME_PRIMITIVE_BUDGET } from './experience.js';

import type { ExperienceArchitecture, RuntimePrimitiveId } from './experience.js';

export type PrimitiveCategory =
  | 'cursor' | 'scroll' | 'text' | 'navigation' | 'transition' | 'hover'
  | 'reveal' | 'gallery' | 'webgl' | '3d' | 'particles' | 'media'
  | 'typography' | 'ui';

/** Phase 3 — the five source classes; a template/pattern is never code. */
export type PrimitiveSourceType =
  | 'internal' | 'open_source' | 'asset_provider' | 'mcp_tool' | 'template_pattern';

/** EXISTS / RESEARCHED / EXTERNAL / UNSAFE / UNKNOWN, per the audit brief. */
export type PrimitiveStatus = 'exists' | 'researched' | 'external' | 'unsafe' | 'unknown';

export type IntegrationMode =
  /** Ships as a named primitive through `RuntimePrimitiveId`, opt-in, additive (this session's seam). */
  | 'runtime-primitive'
  /** Ships unconditionally today — a pre-existing, un-gated `RUNTIME_RULES` behaviour (documented, not changed). */
  | 'bundled-unconditional'
  /** Not wired to any renderer output. */
  | 'not-integrated';

/**
 * Phase 3 — the reusable integration contract for an executable *external*
 * primitive: one that answers "how does someone else's code safely reach a
 * generated artifact with no bundler in this pipeline?" `null` for every
 * internal primitive (the question does not apply — there is no upstream to
 * vendor from) and for every external row still only `researched`
 * (`gsap-scrolltrigger`, `three-js-hero-object`) — only a primitive with a
 * real, shipped adapter has earned answers to these questions instead of
 * plans for them.
 *
 * Deliberately flat strings, not a second typed sub-schema per field: this is
 * an audit record a human reads (PHASE 3's own list — initialization,
 * configuration, teardown, reduced-motion behaviour, mobile behaviour,
 * fallback, failure behaviour), not a second execution path, so it stays a
 * `PrimitiveDescriptor`-shaped fact sheet rather than growing into a plugin
 * framework. A future GSAP/Three.js adapter fills in one more row of this
 * exact shape instead of inventing a new one — see `lib/runtime/lenis.ts`'s
 * "Reusability" note for what would and would not carry over unchanged.
 */
export interface ExternalPrimitiveContract {
  /**
   * How the code physically reaches the artifact. `'vendored'` is the only
   * strategy this pipeline supports today: PHASE 1 of the Lenis integration
   * confirmed there is no bundler (`package.json` has no build tool beyond
   * `tsc`) and a CDN `<script src>` would break the "a rendered site looks
   * the same offline" guarantee `lib/render/css.ts` documents for every other
   * asset. `'cdn'` and `'npm-bundled'` are named here so a future adapter
   * that genuinely needs one states it explicitly rather than silently doing
   * something this pipeline has never done before.
   */
  readonly sourceStrategy: 'vendored' | 'cdn' | 'npm-bundled';
  /** Exactly what was vendored from where, precise enough to re-fetch and diff against upstream. */
  readonly vendoredFrom: string;
  /**
   * Extra sibling files this primitive contributes to the rendered site,
   * beyond the inline JS/CSS strings folded into `runtime.js`/`styles.css`
   * (site-relative paths, e.g. `['runtime/three.core.min.js']`). Empty for
   * every primitive whose vendored body is small and self-contained enough
   * to concatenate as a plain script (Lenis, GSAP) — `lib/render/
   * runtimeAssets.ts` is the generic dispatch this field documents, first
   * needed because Three.js's core build is a real ES module that can only
   * be reached by another file's real `import` statement, not by
   * concatenation.
   */
  readonly siblingFiles: readonly string[];
  /** Browser APIs the adapter calls beyond baseline DOM (e.g. `requestAnimationFrame`, `matchMedia`). */
  readonly runtimeRequirements: readonly string[];
  /** Language/engine features the vendored build itself requires (e.g. ES2017 class syntax). */
  readonly browserRequirements: readonly string[];
  /** What actually constructs/starts the library, and where that code lives. */
  readonly initialization: string;
  /** What tears it down, and when — or a stated "n/a" if the primitive has no lifecycle to end. */
  readonly teardown: string;
  /** What happens under `prefers-reduced-motion: reduce`. Must describe skipping construction entirely, never a degraded-but-still-running mode. */
  readonly reducedMotionBehavior: string;
  /** What happens on a touch/coarse-pointer device. */
  readonly mobileBehavior: string;
  /** What the visitor gets when the primitive does not run at all — must always be "native/unmodified", never a second custom behaviour. */
  readonly fallbackBehavior: string;
  /** What happens if construction throws or a runtime requirement is missing. */
  readonly failureBehavior: string;
}

export interface PrimitiveDescriptor {
  readonly id: string;
  readonly category: PrimitiveCategory;
  readonly sourceType: PrimitiveSourceType;
  /** npm package or repository name. Only set for `open_source`/`asset_provider`. */
  readonly package?: string;
  readonly version?: string;
  /** SPDX id, or `'internal'` for BusinessForge's own code. Never blank. */
  readonly license: string;
  readonly capabilities: readonly string[];
  /** CSS media features / runtime conditions this primitive needs to do anything. */
  readonly requirements: readonly string[];
  readonly performanceCost: 'none' | 'low' | 'medium' | 'high';
  readonly accessibilityRisk: 'none' | 'low' | 'medium' | 'high';
  readonly mobileSupport: 'full' | 'degraded' | 'disabled';
  readonly deterministic: boolean;
  readonly configurable: boolean;
  readonly integrationMode: IntegrationMode;
  /** Free-form JSON-shaped config a resolved primitive accepts. `null` when it takes none. */
  readonly configurationSchema: Readonly<Record<string, string>> | null;
  /** File or research-document paths this entry's claims are grounded in. */
  readonly evidence: readonly string[];
  readonly status: PrimitiveStatus;
  /** Registry id of the internal primitive to fall back to, or `null` for "no enhancement, static floor". */
  readonly fallback: string | null;
  /** See `ExternalPrimitiveContract`. `null` unless this row is an external primitive with a real, shipped adapter. */
  readonly externalIntegration: ExternalPrimitiveContract | null;
}

/**
 * The registry. Every `RuntimePrimitiveId` has exactly one `exists` row here
 * (asserted by `test/design/experienceRegistry.test.ts`); rows with other ids
 * are `researched`/`external` candidates, kept for the audit trail, never
 * dispatchable.
 */
export const EXPERIENCE_REGISTRY: Readonly<Record<string, PrimitiveDescriptor>> = {
  /* ---------------- EXISTS — internal, executable today ---------------- */

  'scroll-reveal': {
    id: 'scroll-reveal',
    category: 'reveal',
    sourceType: 'internal',
    license: 'internal',
    capabilities: ['per-section fade/rise on scroll'],
    requirements: ['prefers-reduced-motion:no-preference', 'data-runtime:scroll-progress'],
    performanceCost: 'low',
    accessibilityRisk: 'low',
    mobileSupport: 'full',
    deterministic: true,
    configurable: false,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: ['lib/render/runtime-rules.ts', 'lib/runtime/scroll-progress.ts', 'ADR 0008'],
    status: 'exists',
    fallback: null,
    externalIntegration: null,
  },

  // WQ-021 / docs/IMPLEMENTATION_GAP.md P2-2: the native-CSS alternative to
  // scroll-reveal's JS-computed --forge-vis. `sourceType: 'internal'` because
  // there is no package to vendor — `animation-timeline: view()` is a
  // platform primitive; the "external integration" here is the browser
  // itself, not a library. Support verified live: caniuse.com,
  // OBSERVED 2026-08-25, 85.43% global (Chrome 115+, Firefox 157+,
  // Safari 26.0+) — real, current majority support, not "researched only".
  'css-scroll-driven-reveal': {
    id: 'css-scroll-driven-reveal',
    category: 'reveal',
    sourceType: 'internal',
    license: 'internal',
    capabilities: ['per-section fade/rise on scroll, driven by the native animation-timeline: view() compositor timeline — zero JS'],
    requirements: [
      'prefers-reduced-motion:no-preference',
      'data-runtime:scroll-progress',
      '@supports (animation-timeline: view()) — a browser without support renders the unmodified static floor, never a broken animation',
    ],
    performanceCost: 'none',
    accessibilityRisk: 'low',
    mobileSupport: 'full',
    deterministic: true,
    configurable: false,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: [
      'lib/render/runtime-rules.ts (CSS_SCROLL_DRIVEN_REVEAL_RULES)',
      'lib/runtime/scroll-progress.ts (RUNTIME_PRIMITIVE_SOURCES — empty string, no JS)',
      'caniuse.com/mdn-css_properties_animation-timeline_scroll (OBSERVED 2026-08-25, 85.43% global support)',
      'webkit.org/blog/17101 (Safari scroll-driven animations, Safari 26 — OBSERVED 2026-08-25)',
      'developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations',
      'test/design/experienceRegistry.test.ts, test/render/runtimePrimitives.integration.test.ts (css-scroll-driven-reveal cases)',
      'docs/IMPLEMENTATION_GAP.md P2-2, WORK_QUEUE.json WQ-021',
    ],
    status: 'exists',
    // Explicit, not "no enhancement": a browser this old is old enough that
    // the JS-driven scroll-reveal is the more defensible choice if Forge
    // ever needs a guaranteed-everywhere reveal rather than a
    // progressively-enhanced one.
    fallback: 'scroll-reveal',
    externalIntegration: null,
  },

  'text-reveal': {
    id: 'text-reveal',
    category: 'text',
    sourceType: 'internal',
    license: 'internal',
    capabilities: ['staggered per-element settle on scroll, CSS-only, no text-splitting'],
    requirements: ['prefers-reduced-motion:no-preference', 'data-runtime:scroll-progress'],
    performanceCost: 'low',
    accessibilityRisk: 'low',
    mobileSupport: 'full',
    deterministic: true,
    configurable: false,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: ['lib/render/runtime-rules.ts', 'docs/knowledge/MOTION_LIBRARY.md (MO-004 stagger math)'],
    status: 'exists',
    fallback: 'scroll-reveal',
    externalIntegration: null,
  },

  'magnetic-cursor': {
    id: 'magnetic-cursor',
    category: 'cursor',
    sourceType: 'internal',
    license: 'internal',
    capabilities: ['pointer-follower snapping toward interactive elements'],
    requirements: [
      'prefers-reduced-motion:no-preference',
      'hover:hover',
      'pointer:fine',
      'min-width:768px',
    ],
    performanceCost: 'low',
    accessibilityRisk: 'medium',
    mobileSupport: 'disabled',
    deterministic: true,
    configurable: false,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: [
      'lib/runtime/scroll-progress.ts (startMagneticCursor / MAGNETIC_CURSOR_SOURCE)',
      'lib/render/runtime-rules.ts (MAGNETIC_CURSOR_RULES)',
      'docs/knowledge/INTERACTION_LIBRARY.md (custom cursor is CSS-cursor:none + JS-required)',
    ],
    status: 'exists',
    // Native cursor is always the underlying reality — CSS never removes it
    // outside the primitive's own guard, so the true fallback is "nothing":
    // a visitor who does not qualify for the primitive simply keeps the
    // native pointer, never a degraded synthetic one.
    fallback: null,
    externalIntegration: null,
  },

  /* ---------------- EXISTS — internal, bundled unconditionally --------- */
  /* Pre-existing behaviour, registered for completeness of the audit, NOT  */
  /* moved to `runtime-primitive` mode this pass (see ADR 0008 / the note   */
  /* at the top of lib/render/runtime-rules.ts — doing so would move the    */
  /* frozen design.bakery.styles.css snapshot, a deliberate, human-owned    */
  /* decision, not a side effect of a registry pass).                      */

  'pinned-cinematic-hero': {
    id: 'pinned-cinematic-hero',
    category: 'transition',
    sourceType: 'internal',
    license: 'internal',
    capabilities: ['hero pins while the next section scrolls over it; bounded parallax on hero media'],
    requirements: ['prefers-reduced-motion:no-preference', 'hover:hover', 'pointer:fine', 'min-width:768px'],
    performanceCost: 'low',
    accessibilityRisk: 'low',
    mobileSupport: 'disabled',
    deterministic: true,
    configurable: false,
    integrationMode: 'bundled-unconditional',
    configurationSchema: null,
    evidence: ['lib/render/runtime-rules.ts (RUNTIME_RULES, behaviour B)'],
    status: 'exists',
    fallback: null,
    externalIntegration: null,
  },

  'world-crossing': {
    id: 'world-crossing',
    category: 'transition',
    sourceType: 'internal',
    license: 'internal',
    capabilities: ['continuous brightness/dawn-overlay blend between grounds as the page scrolls'],
    requirements: ['prefers-reduced-motion:no-preference', 'data-world:ember'],
    performanceCost: 'low',
    accessibilityRisk: 'none',
    mobileSupport: 'full',
    deterministic: true,
    configurable: false,
    integrationMode: 'bundled-unconditional',
    configurationSchema: null,
    evidence: ['lib/render/runtime-rules.ts (RUNTIME_RULES, behaviour D)', 'lib/design/worlds.ts'],
    status: 'exists',
    fallback: null,
    externalIntegration: null,
  },

  /* ---------------- RESEARCHED / EXTERNAL — not integrated -------------- */
  /* Cited, not re-researched. Candidates for a future, separately-scoped  */
  /* integration pass; this registry records the audit finding, not a plan.*/

  'gsap-scrolltrigger': {
    id: 'gsap-scrolltrigger',
    category: 'scroll',
    sourceType: 'open_source',
    package: 'gsap',
    version: '3.15.0',
    // Precise, not "permissive"/"MIT": GreenSock's own package.json states
    // `"license": "Standard 'no charge' license: https://gsap.com/standard-license."`
    // — a proprietary grant (free to bundle into an end product, which is
    // this pipeline's actual use), not an OSI/MIT instrument. See
    // `lib/runtime/vendor/gsapSource.ts`'s header for the full account this
    // integration verified directly against the published package, not just
    // the pre-existing research note.
    license: 'GreenSock Standard "No Charge" License (proprietary, free to bundle into an end product, not OSI/MIT) — https://gsap.com/standard-license',
    capabilities: ['scroll-scrubbed per-section reveal via ScrollTrigger (continuous, not threshold-gated like scroll-reveal)'],
    requirements: ['browser JS execution', 'prefers-reduced-motion:no-preference'],
    performanceCost: 'medium',
    accessibilityRisk: 'medium',
    // Unchanged from the pre-existing research row: ScrollTrigger's own touch
    // handling degrades acceptably rather than needing to be switched off —
    // a genuine behavioural difference from lenis-smooth-scroll's `disabled`,
    // not an oversight. See `mobileBehavior` below.
    mobileSupport: 'degraded',
    deterministic: true,
    configurable: true,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: [
      'research/auxiliary-arsenal/05_MOTION_INTERACTION.md',
      'BUSINESSFORGE_2.0_CAPABILITY_ARSENAL.md §2.6',
      'lib/runtime/vendor/gsapSource.ts (vendored dist/gsap.min.js + dist/ScrollTrigger.min.js, npm gsap@3.15.0)',
      'lib/runtime/gsapScrollTrigger.ts (init/teardown adapter, GSAP_RUNTIME_SOURCE)',
      'lib/render/runtime-rules.ts (RUNTIME_PRIMITIVE_RULES dispatch — empty, JS-only primitive)',
      'lib/runtime/scroll-progress.ts (RUNTIME_PRIMITIVE_SOURCES dispatch)',
      'test/design/experienceRegistry.test.ts, test/render/runtimePrimitives.integration.test.ts (GSAP ScrollTrigger cases)',
    ],
    status: 'exists',
    fallback: 'scroll-reveal',
    externalIntegration: {
      sourceStrategy: 'vendored',
      vendoredFrom: 'npm:gsap@3.15.0 — dist/gsap.min.js (core engine) + dist/ScrollTrigger.min.js (plugin), byte-for-byte, concatenated core-then-plugin',
      // Both files are UMD with a browser-global fallback, small enough to
      // concatenate straight into runtime.js — no sibling file needed
      // (contrast three-js-hero-object, whose core build is real ESM).
      siblingFiles: [],
      runtimeRequirements: ['requestAnimationFrame (GSAP’s own ticker)', 'matchMedia', 'IntersectionObserver is not required — ScrollTrigger measures via scroll position'],
      browserRequirements: ['ES2015+ (the vendored build targets evergreen browsers, unchanged from upstream)'],
      initialization: 'startGsapScrollTrigger() (lib/runtime/gsapScrollTrigger.ts’s GSAP_INIT_SOURCE) calls window.gsap.registerPlugin(window.ScrollTrigger), then builds one gsap.fromTo(...) + scrollTrigger per non-hero section, once every guard below has passed.',
      teardown: 'startGsapScrollTrigger() returns a teardown closure that kills every created ScrollTrigger instance and removes data-runtime-scroll-gsap, invoked once on the pagehide event.',
      reducedMotionBehavior: "matchMedia('(prefers-reduced-motion: reduce)') is checked before anything else; when it matches, the plugin is never registered and no ScrollTrigger is ever created — the page is the unmodified static floor.",
      mobileBehavior: 'No coarse-pointer guard, unlike Lenis: ScrollTrigger’s scrub-based reveal is driven by scroll position, which touch devices report natively, so the primitive runs on mobile with acceptably degraded (not disabled) behaviour — the honest reading of the pre-existing degraded rating, now backed by a real adapter instead of a research note.',
      fallbackBehavior: 'If window.gsap/window.ScrollTrigger are missing, or reduced motion is requested, or any construction throws: no plugin registration happens, no section is touched, and every section keeps its natural, unanimated opacity/position — identical to runtime primitives set to [].',
      failureBehavior: 'registerPlugin and every gsap.fromTo call sit inside one try/catch; a throw is swallowed and treated identically to fallbackBehavior — never surfaced to the visitor, never left half-registered.',
    },
  },

  /* ---------------- EXISTS — open_source, real vendored adapter --------- */
  /* Together with `gsap-scrolltrigger` above and `three-js-hero-object`     */
  /* below, the three primitives whose implementation is not hand-written   */
  /* by this repository. Each earns `status: 'exists'` / `integrationMode:  */
  /* 'runtime-primitive'` on the strength of a real, shipped adapter        */
  /* (`lib/runtime/lenis.ts`, `lib/runtime/gsapScrollTrigger.ts`,           */
  /* `lib/runtime/threeHero.ts`) that vendors the actual published library  */
  /* — see each entry's `externalIntegration` field and its adapter file's  */
  /* own doc comment for the full account. Not a metadata-only flip:        */
  /* `resolvePrimitives` below will genuinely dispatch these ids to real    */
  /* JS/CSS/sibling-files in a rendered artifact.                           */

  'lenis-smooth-scroll': {
    id: 'lenis-smooth-scroll',
    category: 'scroll',
    sourceType: 'open_source',
    package: 'lenis',
    version: '1.3.26',
    license: 'MIT',
    capabilities: ['inertial smooth-scroll'],
    requirements: ['browser JS execution', 'prefers-reduced-motion:no-preference', 'pointer:fine'],
    performanceCost: 'low',
    accessibilityRisk: 'medium',
    // Disabled outright on any coarse pointer (the adapter's own guard, not a
    // documented aspiration) — a phone visitor always gets native momentum
    // scrolling, never a degraded Lenis. See `mobileBehavior` below.
    mobileSupport: 'disabled',
    deterministic: true,
    configurable: true,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: [
      'research/auxiliary-arsenal/05_MOTION_INTERACTION.md',
      'lib/runtime/vendor/lenisSource.ts (vendored dist/lenis.min.js + dist/lenis.css, npm lenis@1.3.26)',
      'lib/runtime/lenis.ts (init/teardown adapter, LENIS_RUNTIME_SOURCE / LENIS_STYLE_RULES)',
      'lib/render/runtime-rules.ts (RUNTIME_PRIMITIVE_RULES dispatch)',
      'lib/runtime/scroll-progress.ts (RUNTIME_PRIMITIVE_SOURCES dispatch)',
      'test/design/experienceRegistry.test.ts, test/render/runtimePrimitives.integration.test.ts (Lenis cases)',
    ],
    status: 'exists',
    // No named internal fallback — Lenis's own fallback *is* the static
    // floor (native scrolling), which is what "no enhancement" already means
    // for this field.
    fallback: null,
    externalIntegration: {
      sourceStrategy: 'vendored',
      vendoredFrom: 'npm:lenis@1.3.26 — dist/lenis.min.js (core IIFE build, no framework/plugin code) + dist/lenis.css, byte-for-byte',
      // A self-contained IIFE, small enough to concatenate straight into
      // runtime.js — no sibling file needed.
      siblingFiles: [],
      runtimeRequirements: ['requestAnimationFrame', 'matchMedia', 'ResizeObserver'],
      browserRequirements: ['ES2017 class syntax (the vendored build is not transpiled further)'],
      initialization: "startLenisSmoothScroll() (lib/runtime/lenis.ts's LENIS_INIT_SOURCE) constructs `new window.Lenis({ autoRaf: true })` once every guard below has passed; window.Lenis is defined by the vendored IIFE that ships immediately before this glue in the same runtime.js fragment.",
      teardown: 'startLenisSmoothScroll() returns a teardown closure (lenis.destroy() + removes data-runtime-scroll), invoked once on the pagehide event — the same lifecycle shape startMagneticCursor already uses.',
      reducedMotionBehavior: "matchMedia('(prefers-reduced-motion: reduce)') is checked before anything else; when it matches, Lenis is never constructed and the page is the unmodified static floor. (Lenis's own respectReducedMotion option, default true, is left in place as a second, upstream-owned layer, not relied on as the only guard.)",
      mobileBehavior: "matchMedia('(pointer: coarse)') is checked immediately after reduced motion; when it matches, Lenis is never constructed — a touch visitor always gets native momentum scrolling, never a degraded Lenis instance.",
      fallbackBehavior: 'Identical on every rejection path (reduced motion, coarse pointer, missing window.Lenis, a construction throw): nothing is disabled, nothing is attached — the page behaves exactly as it would with runtime primitives set to [].',
      failureBehavior: 'new window.Lenis(...) is wrapped in try/catch; a throw is swallowed and treated identically to fallbackBehavior — never surfaced to the visitor, never left half-initialized.',
    },
  },

  /*
   * ---------------------------------------------------------------------
   * The shipping-strategy boundary this entry carried until this pass is
   * resolved, not worked around. `three.core.min.js` is real ESM (a single
   * `export{...}` at the very end, no `import` — verified by direct
   * inspection of the published `three@0.185.1` tarball) and only does
   * anything once another file `import`s from it at a real relative URL —
   * concatenation into `runtime.js` (Lenis/GSAP's mechanism) cannot satisfy
   * that. `runtime.js` already ships as `type="module"`
   * (`lib/render/document.ts`), so it can carry a genuine
   * `import * as THREE from './runtime/three.core.min.js'` statement — the
   * only missing piece was a way for a primitive to ship an extra sibling
   * file at a stable path. `lib/render/runtimeAssets.ts` adds exactly that,
   * generically (a third dispatch table alongside the existing JS/CSS ones,
   * not a Three.js-specific special case — see that file's own doc comment),
   * and `lib/runtime/threeHero.ts` uses it.
   *
   * The second, independent concern — a hero object needs a real 3D scene,
   * not just a constructed library instance — is resolved the same way
   * Lenis/GSAP's glue resolves "what does the primitive actually do":
   * one small, hand-written, fully generic scene (a procedurally generated
   * rotating wireframe icosahedron — no per-business asset, nothing for a
   * model to have arbitrarily authored), never touched by Creative
   * Direction, which only ever declares the primitive id. `deterministic:
   * false` stays exactly as it was — the geometry math is reproducible, the
   * actual GPU-rendered pixels are not, and no amount of shipping
   * infrastructure changes that.
   * ---------------------------------------------------------------------
   */

  'three-js-hero-object': {
    id: 'three-js-hero-object',
    category: 'webgl',
    sourceType: 'open_source',
    package: 'three',
    version: '0.185.1',
    license: 'MIT',
    capabilities: ['procedural rotating wireframe hero object, layered as a transparent, pointer-events:none overlay on the hero section'],
    requirements: ['WebGL2', 'browser JS execution', 'prefers-reduced-motion:no-preference', 'pointer:fine', 'significant device GPU/CPU budget'],
    performanceCost: 'high',
    accessibilityRisk: 'medium',
    // Disabled outright on any coarse pointer (the adapter's own guard) — a
    // continuous per-frame WebGL draw call is a real battery/thermal cost on
    // a phone, the same conservative choice lenis-smooth-scroll made and
    // gsap-scrolltrigger deliberately did not. See mobileBehavior below.
    mobileSupport: 'disabled',
    deterministic: false,
    configurable: true,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: [
      'lib/experience/ (Bakery V2 — the one hand-authored reference host, quarantined, not generalized; this primitive stays deliberately generic instead of replicating it)',
      'research/auxiliary-arsenal/09_3D_ASSETS.md',
      'docs/experience-architecture-v2.md §2.8 (H1/H2 — "unconditionally specialized")',
      'npm three@0.185.1 tarball, build/ directory, inspected directly: three.core.min.js has no import, a single export{...} at the end, self-contained enough to vendor verbatim as a real ES module',
      'lib/runtime/vendor/threeSource.ts (vendored build/three.core.min.js, byte-for-byte, npm three@0.185.1)',
      'lib/runtime/threeHero.ts (init/teardown adapter, THREE_HERO_RUNTIME_SOURCE / THREE_HERO_STYLE_RULES / THREE_HERO_ASSET_FILES)',
      'lib/render/runtimeAssets.ts (the generic primitive-contributed-sibling-file dispatch this integration required)',
      'lib/render/site.ts (files assembly now splices runtimePrimitiveAssetFiles(...) in)',
      'test/design/experienceRegistry.test.ts, test/render/runtimePrimitives.integration.test.ts (Three.js hero cases)',
    ],
    status: 'exists',
    fallback: null,
    externalIntegration: {
      sourceStrategy: 'vendored',
      vendoredFrom: 'npm:three@0.185.1 — build/three.core.min.js, byte-for-byte, shipped as a real sibling ES module rather than concatenated',
      siblingFiles: ['runtime/three.core.min.js'],
      runtimeRequirements: ['requestAnimationFrame', 'matchMedia', 'WebGL2 context (WebGLRenderingContext/WebGL2RenderingContext)', 'ResizeObserver is not required — resize is handled on the window resize event'],
      browserRequirements: ['native ES module import support (the vendored build is a genuine ES module, not a UMD/global fallback)', 'WebGL2'],
      initialization: "startThreeHero() (lib/runtime/threeHero.ts's THREE_HERO_INIT_SOURCE) is preceded by a real `import * as THREE from './runtime/three.core.min.js'` statement in the same runtime.js module; once every guard passes it constructs a WebGLRenderer, a procedurally generated IcosahedronGeometry mesh, and starts a requestAnimationFrame render loop.",
      teardown: 'startThreeHero() returns a teardown closure (cancels the rAF loop, disposes geometry/material/renderer, removes the canvas and the data-runtime-three attribute), invoked once on the pagehide event — the same lifecycle shape every other adapter in this repository uses.',
      reducedMotionBehavior: "matchMedia('(prefers-reduced-motion: reduce)') is checked before anything else; when it matches, no canvas or WebGL context is ever created — the page is the unmodified static floor.",
      mobileBehavior: "matchMedia('(pointer: coarse)') is checked immediately after reduced motion; when it matches, the primitive never runs — performanceCost:'high' (a continuous per-frame GPU draw call) is not an acceptable unconditional cost on a phone.",
      fallbackBehavior: 'Identical on every rejection path (reduced motion, coarse pointer, no .section--hero present, WebGLRenderer construction throws): no canvas is created, no attribute is set — the hero section renders exactly as it would with runtime primitives set to [].',
      failureBehavior: 'WebGLRenderer construction is wrapped in try/catch (a blocked/disabled WebGL driver throws there); attaching the canvas and starting the render loop are wrapped in a second try/catch that tears down anything already created rather than leaving a half-attached canvas.',
    },
  },

  /* ---------------- EXISTS — internal, new Awwwards primitives ----------- */
  /* Added for the Awwwards path (research/awwwards-research/). Each is an    */
  /* internal, hand-written adapter in `lib/runtime/forgePrimitives.ts`,     */
  /* dispatched through the same closed tables as the rest. No new external  */
  /* library is vendored: horizontal-scroll / bento-card-tilt are pure       */
  /* CSS+DOM (the exact technique the Awwwards-build tutorials teach), and    */
  /* cursor-reactive-webgl reuses the already-vendored three.core.min.js.     */

  'horizontal-scroll': {
    id: 'horizontal-scroll',
    category: 'scroll',
    sourceType: 'internal',
    license: 'internal',
    capabilities: ['pin a section and translate a horizontal track on scroll (ScrollTrigger when present, window-scroll fallback otherwise)'],
    requirements: ['prefers-reduced-motion:no-preference', 'pointer:fine', 'min-width:768px', 'data-runtime-hscroll'],
    performanceCost: 'low',
    accessibilityRisk: 'low',
    mobileSupport: 'disabled',
    deterministic: true,
    configurable: false,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: ['lib/runtime/forgePrimitives.ts (HORIZONTAL_SCROLL_SOURCE)', 'lib/render/runtime-rules.ts (HORIZONTAL_SCROLL_RULES)', 'research/awwwards-research/ (S6WNo2GDHxI, z_9fvGuOyBc tutorials)'],
    status: 'exists',
    fallback: null,
    externalIntegration: null,
  },

  'bento-card-tilt': {
    id: 'bento-card-tilt',
    category: 'hover',
    sourceType: 'internal',
    license: 'internal',
    capabilities: ['pointer-follow 3D tilt + radial glow on [data-tilt] cards'],
    requirements: ['prefers-reduced-motion:no-preference', 'hover:hover', 'pointer:fine', 'min-width:768px'],
    performanceCost: 'low',
    accessibilityRisk: 'low',
    mobileSupport: 'disabled',
    deterministic: true,
    configurable: false,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: ['lib/runtime/forgePrimitives.ts (BENTO_CARD_TILT_SOURCE)', 'lib/render/runtime-rules.ts (BENTO_CARD_TILT_RULES)', 'research/awwwards-research/ (zA9r5zTllx4 Zentry clone — bento grid + card tilt)'],
    status: 'exists',
    fallback: null,
    externalIntegration: null,
  },

  'cursor-reactive-webgl': {
    id: 'cursor-reactive-webgl',
    category: 'webgl',
    sourceType: 'open_source',
    package: 'three',
    version: '0.185.1',
    license: 'MIT',
    capabilities: ['pointer-reactive particle field over the hero, layered as a transparent pointer-events:none overlay'],
    requirements: ['WebGL2', 'browser JS execution', 'prefers-reduced-motion:no-preference', 'pointer:fine', 'significant device GPU/CPU budget'],
    performanceCost: 'high',
    accessibilityRisk: 'medium',
    mobileSupport: 'disabled',
    deterministic: false,
    configurable: true,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: [
      'lib/runtime/forgePrimitives.ts (CURSOR_WEBGL_INIT_SOURCE / CURSOR_WEBGL_RULES)',
      'lib/runtime/threeHero.ts (reuses vendored three.core.min.js)',
      'lib/render/runtimeAssets.ts (CURSOR_WEBGL_ASSET_FILES reuses THREE_HERO_ASSET_FILES)',
      'research/awwwards-research/ (7/8 probed winners ship a WebGL canvas)',
    ],
    status: 'exists',
    fallback: null,
    externalIntegration: {
      sourceStrategy: 'vendored',
      vendoredFrom: 'npm:three@0.185.1 — build/three.core.min.js (reused from three-js-hero-object)',
      siblingFiles: ['runtime/three.core.min.js'],
      runtimeRequirements: ['requestAnimationFrame', 'matchMedia', 'WebGL2 context', 'pointermove listener'],
      browserRequirements: ['native ES module import support', 'WebGL2'],
      initialization: "startCursorWebgl() (lib/runtime/forgePrimitives.ts) imports the same vendored three.core.min.js, builds a 600-point BufferGeometry field, and eases the camera toward the pointer each frame.",
      teardown: 'cancels the rAF loop, removes listeners, disposes geometry/material/renderer, removes the canvas — same lifecycle as three-js-hero-object.',
      reducedMotionBehavior: "matchMedia('(prefers-reduced-motion: reduce)') is checked before anything else; when it matches, no canvas is created.",
      mobileBehavior: "matchMedia('(pointer: coarse)') is checked immediately after reduced motion; never runs on touch (performanceCost:'high').",
      fallbackBehavior: 'Identical on every rejection path: no canvas, no attribute — the hero renders as with runtime primitives set to [].',
      failureBehavior: 'WebGLRenderer construction and the render loop are wrapped in try/catch; a throw tears down whatever was created.',
    },
  },

  /* ---------------- EXISTS — internal, new Awwwards primitives (set 2) ------ */
  /* Added for the Awwwards path (research/awwwards-research/). Each is an      */
  /* internal, hand-written adapter in `lib/runtime/forgePrimitives.ts`,       */
  /* dispatched through the same closed tables as the rest. No external library */
  /* is vendored: every one is pure CSS+DOM, gated by reduced-motion, never     */
  /* throws into the visitor. Declared-only (reachable via an explicit          */
  /* `declared` list from Creative Direction / the Experience Signature), like  */
  /* lenis-smooth-scroll and gsap-scrolltrigger — they never auto-select, so    */
  /* they change nothing for a caller that does not opt in.                     */

  'marquee': {
    id: 'marquee',
    category: 'text',
    sourceType: 'internal',
    license: 'internal',
    capabilities: ['infinite scrolling banner / ticker, pause-on-hover, CSS-driven'],
    requirements: ['prefers-reduced-motion:no-preference', 'data-runtime-marquee'],
    performanceCost: 'low',
    accessibilityRisk: 'low',
    mobileSupport: 'full',
    deterministic: true,
    configurable: false,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: ['lib/runtime/forgePrimitives.ts (MARQUEE_SOURCE / MARQUEE_RULES)', 'research/awwwards-research/ (ticker/marquee present on 6/8 probed winners)'],
    status: 'exists',
    fallback: null,
    externalIntegration: null,
  },

  'image-hover-reveal': {
    id: 'image-hover-reveal',
    category: 'hover',
    sourceType: 'internal',
    license: 'internal',
    capabilities: ['scale + saturation + tint reveal on [data-runtime-img-reveal] images at hover'],
    requirements: ['prefers-reduced-motion:no-preference', 'hover:hover', 'pointer:fine', 'data-runtime-img-reveal'],
    performanceCost: 'low',
    accessibilityRisk: 'low',
    mobileSupport: 'disabled',
    deterministic: true,
    configurable: false,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: ['lib/runtime/forgePrimitives.ts (IMAGE_HOVER_REVEAL_SOURCE / IMAGE_HOVER_REVEAL_RULES)'],
    status: 'exists',
    fallback: null,
    externalIntegration: null,
  },

  'animated-counter': {
    id: 'animated-counter',
    category: 'reveal',
    sourceType: 'internal',
    license: 'internal',
    capabilities: ['count-up number animation when [data-count-to] enters the viewport'],
    requirements: ['prefers-reduced-motion:no-preference', 'data-count-to'],
    performanceCost: 'low',
    accessibilityRisk: 'low',
    mobileSupport: 'full',
    deterministic: true,
    configurable: false,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: ['lib/runtime/forgePrimitives.ts (ANIMATED_COUNTER_SOURCE / ANIMATED_COUNTER_RULES)'],
    status: 'exists',
    fallback: null,
    externalIntegration: null,
  },

  'sticky-text-pin': {
    id: 'sticky-text-pin',
    category: 'scroll',
    sourceType: 'internal',
    license: 'internal',
    capabilities: ['pins a section while its copy is read, with a scroll-driven progress bar'],
    requirements: ['prefers-reduced-motion:no-preference', 'pointer:fine', 'min-width:768px', 'data-runtime-pin'],
    performanceCost: 'low',
    accessibilityRisk: 'low',
    mobileSupport: 'disabled',
    deterministic: true,
    configurable: false,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: ['lib/runtime/forgePrimitives.ts (STICKY_TEXT_PIN_SOURCE / STICKY_TEXT_PIN_RULES)'],
    status: 'exists',
    fallback: null,
    externalIntegration: null,
  },

  'menu-overlay': {
    id: 'menu-overlay',
    category: 'navigation',
    sourceType: 'internal',
    license: 'internal',
    capabilities: ['fullscreen overlay navigation, toggle button + Escape-to-close, reduced-motion safe'],
    requirements: ['data-menu-toggle', 'data-menu-overlay'],
    performanceCost: 'low',
    accessibilityRisk: 'low',
    mobileSupport: 'full',
    deterministic: true,
    configurable: false,
    integrationMode: 'runtime-primitive',
    configurationSchema: null,
    evidence: ['lib/runtime/forgePrimitives.ts (MENU_OVERLAY_SOURCE / MENU_OVERLAY_RULES)'],
    status: 'exists',
    fallback: null,
    externalIntegration: null,
  },

  'screenshot-to-code-pattern': {
    id: 'screenshot-to-code-pattern',
    category: 'ui',
    sourceType: 'template_pattern',
    license: 'MIT (upstream repo) — pattern only, code never imported',
    capabilities: ['screenshot-to-DOM-tree architecture pattern; not a runnable primitive'],
    requirements: [],
    performanceCost: 'none',
    accessibilityRisk: 'none',
    mobileSupport: 'full',
    deterministic: false,
    configurable: false,
    integrationMode: 'not-integrated',
    configurationSchema: null,
    evidence: ['research/auxiliary-arsenal/02_VISUAL_INTELLIGENCE.md'],
    status: 'researched',
    fallback: null,
    externalIntegration: null,
  },

  'awwwards-teardown-corpus': {
    id: 'awwwards-teardown-corpus',
    category: 'ui',
    sourceType: 'template_pattern',
    license: 'n/a — reference/inspiration only, no code or asset reused',
    capabilities: ['25-site teardown of premium-site mechanisms, vocabulary for Creative Direction, never a code source'],
    requirements: [],
    performanceCost: 'none',
    accessibilityRisk: 'none',
    mobileSupport: 'full',
    deterministic: false,
    configurable: false,
    integrationMode: 'not-integrated',
    configurationSchema: null,
    evidence: ['docs/AWWWARDS_PATTERN_LIBRARY.md', 'docs/knowledge/AWWARDS_RESEARCH.md'],
    status: 'researched',
    fallback: null,
    externalIntegration: null,
  },

  'higgsfield-media': {
    id: 'higgsfield-media',
    category: 'media',
    sourceType: 'asset_provider',
    license: 'commercial ToS — no ownership claim on outputs, commercial use unrestricted (§4.4, OBSERVED)',
    capabilities: ['image/video/audio/3D generation and editing, one API'],
    requirements: ['network call', 'account credential', 'human gate (image_editing/motion_media)'],
    performanceCost: 'none',
    accessibilityRisk: 'none',
    mobileSupport: 'full',
    deterministic: false,
    configurable: true,
    integrationMode: 'not-integrated',
    configurationSchema: null,
    evidence: [
      'lib/capability/registry.ts (image_editing, motion_media rows — gate: human)',
      'research/asset-stack/04_PROVIDER_MATRIX.md',
    ],
    status: 'researched',
    fallback: null,
    externalIntegration: null,
  },

  /* ---------------- UNSAFE — explicitly not to be used ------------------ */

  'midjourney-image-gen': {
    id: 'midjourney-image-gen',
    category: 'media',
    sourceType: 'asset_provider',
    license: 'no public API — web-only subscription',
    capabilities: [],
    requirements: [],
    performanceCost: 'none',
    accessibilityRisk: 'none',
    mobileSupport: 'full',
    deterministic: false,
    configurable: false,
    integrationMode: 'not-integrated',
    configurationSchema: null,
    evidence: ['research/asset-stack/06_VIDEO_IMAGE_AI.md'],
    status: 'unsafe',
    fallback: null,
    externalIntegration: null,
  },
};

/**
 * The executable subset — every `exists` + `runtime-primitive` row,
 * regardless of `sourceType`, which is exactly the set `RuntimePrimitiveId`
 * may ever name. `sourceType` alone is not the gate (see the top-of-file
 * note on `lenis-smooth-scroll`); `status: 'exists'` earned through a real
 * adapter is. Used to assert the registry and the type stay in lockstep.
 */
export function executablePrimitiveIds(): readonly string[] {
  return Object.values(EXPERIENCE_REGISTRY)
    .filter((entry) => entry.status === 'exists' && entry.integrationMode === 'runtime-primitive')
    .map((entry) => entry.id);
}

/**
 * Phase 5 — the deterministic resolver: Experience Architecture in,
 * registered, budgeted `RuntimePrimitiveId[]` out.
 *
 * This *is* the "Creative Direction / Experience Signature selects a name,
 * never code" seam the registry brief asks for. Today's only producer of the
 * declaration is `deriveRuntimePrimitives` (deterministic, evidence-derived);
 * an explicit `declared` override is accepted for the day a validated
 * Creative Director/Experience Signature call exists to supply one — every
 * value in it is checked against the registry and dropped, never trusted,
 * exactly like every other model-facing surface in this repository
 * (ADR 0004's rule, applied here).
 */
export function resolvePrimitives(
  architecture: ExperienceArchitecture,
  declared?: readonly string[],
): readonly RuntimePrimitiveId[] {
  const candidates = declared ?? deriveRuntimePrimitives(architecture);
  const executable = new Set(executablePrimitiveIds());
  const valid = candidates.filter((id): id is RuntimePrimitiveId => executable.has(id));
  return valid.slice(0, RUNTIME_PRIMITIVE_BUDGET);
}
