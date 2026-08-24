# BusinessForge Master Arsenal

> **Note (2026-08-24):** the freshest cross-referenced inventory pass is
> `docs/MASTER_INVENTORY.json` (machine-readable, generated after T01–T10). Treat this
> file as scoped to the Arsenal Integration Mission's original question (capability
> candidates: real vs. research vs. blocked) and `docs/MASTER_INVENTORY.json` as the
> current whole-system index — they should agree; if they ever diverge, the JSON wins
> as the more recent pass.

**Status as of this pass.** This document is the canonical inventory the Arsenal Integration Mission asked for. It records, per candidate, what is real (shipped in a rendered artifact and tested) versus what is research, versus what is blocked and why. Nothing here is claimed integrated on the strength of an npm install, a registry row, a doc citation, or a mocked test alone — each `INTEGRATED` row below has a real artifact you can regenerate and inspect (commands given per section).

Do not treat this file as a plan to execute blindly in one sitting. Sections marked `NOT DONE THIS PASS` are exactly that — real, scoped, but not attempted here, because attempting them without the missing prerequisite (a credential, a domain, a backend) would mean faking the result, which this document exists specifically to never do.

## 0. 10-business production benchmark (latest pass)

Ran all 10 archetypes through the real deterministic pipeline (`composeBaseline` → `directContent` → `composeDesign` → `resolvePrimitives` → `renderSite`), plus 3 through the real, live Creative Director (Gemini free tier, 6 real calls total across two runs, €0). Full artifacts in `benchmark-10/` (gitignored, not committed) — 26 real screenshots, real HTML/CSS/JS, real QA gate output.

**Three real bugs found by actually running the pipeline at scale and looking at the output — none caught by the existing unit-test suite:**
1. `gateStructuredData` rejected numeric required properties (`ratingValue: 4.9`) as "missing" — fixed, `isPresent()` now accepts any non-null/non-blank value. 2 regression tests added.
2. `runtime.js` (a `<script type="module">`) silently fails to load under `file://` navigation (CORS on cross-origin module scripts) — broke `page.no-console-errors`/`page.no-failed-requests` for every business whose experience engages the Tier-2 runtime, in both `lib/qa/preflight.ts` (real production QA, also used by `scripts/n8n/stage.ts`) and this benchmark's own screenshot capture. Fixed with a real local static HTTP server (`serveDirectory`, exported from `preflight.ts`, reused by the benchmark script) — real HTTP, not `file://`, the only thing a `type="module"` script actually needs.
3. `composeBaseline` (the deterministic writer) never emits a `'location'`-kind section — every address it writes lands in `'contact'`. The map feature (last session) was correctly built but practically unreachable from any business this pipeline generates without a live AI writer. Fixed: the map now attaches to `'contact'` sections too (keeping their real `tel:`/`mailto:` links), not only `'location'`.

All three fixed, tested (typecheck/build clean, 1351/1351), and reverified against the real artifacts that exposed them.

**Verified by direct visual inspection** (not source-reading): before the fixes, every scroll-reveal/text-reveal business screenshotted with most of its content rendered near-invisible (confirmed via `getComputedStyle` — `--forge-vis` stuck at its CSS base value of `0`); after, sections render fully, maps show real OpenStreetMap tiles for the business's real (illustrative) city, and the 10 sites are visibly, materially different from each other in colour, typography, hero structure, and content emphasis.

See the chat transcript for the full per-business table, the arsenal-usage table, and the honest answer to "does the pipeline converge" (short answer: real differentiation exists at the design-token/layout layer; a real, specific convergence point exists at the industry-classifier layer — several archetypes fall into the same generic bucket).

---

## 1. Status legend

| Status | Meaning |
|---|---|
| `INTEGRATED` | Real code, wired into `resolvePrimitives`/renderer or renderer directly, real artifact generated and inspected this session or a prior one, tests pass. |
| `VERIFIED` | The candidate's technical facts (license, dist shape, size) were checked directly against the published package — not integrated, but the research is no longer secondhand. |
| `RESEARCHED` | A research document names it; not independently re-verified this pass, not integrated. |
| `INTEGRATION-BLOCKED` | A real, named technical or architectural reason prevents integration today. The reason is stated, not hand-waved. |
| `REJECTED` | Actively unsuitable — license, safety, or fit reasons. |
| `DEPRECATED` | Superseded by something already integrated. |

---

## 2. Runtime primitive arsenal (Experience Registry) — motion, scroll, cursor, WebGL

Source of truth: `lib/design/experienceRegistry.ts`. This is the only registry; no parallel one was created.

| Category | Candidate | License | Status | Integrated | Artifact proven | Notes |
|---|---|---|---|---|---|---|
| Scroll (internal) | `scroll-reveal` | internal | EXISTS | yes | yes | CSS-only, `--forge-vis` |
| Text (internal) | `text-reveal` | internal | EXISTS | yes | yes | CSS-only stagger |
| Cursor (internal) | `magnetic-cursor` | internal | EXISTS | yes | yes | desktop-only, `pointer:fine` |
| Scroll (external) | lenis@1.3.26 | MIT | `INTEGRATED` | yes | yes | vendored IIFE, `lib/runtime/lenis.ts` |
| Scroll/transitions (external) | gsap@3.15.0 + ScrollTrigger | GreenSock "no charge" (**not MIT** — verified directly against `package.json`) | `INTEGRATED` | yes | yes | two vendored UMD files, load-ordered, `lib/runtime/gsapScrollTrigger.ts` |
| WebGL/3D (external) | three@0.185.1 core | MIT | `INTEGRATED` | yes | yes | first sibling-file primitive: real ES module shipped as `runtime/three.core.min.js`, `lib/runtime/threeHero.ts` |
| Navigation (mega menu, animated menu) | — | — | `RESEARCHED` (no candidate) | no | no | no dedicated research doc found for this sub-category; would need a fresh library search |
| Galleries/carousels | PhotoSwipe, Swiper | MIT / MIT | `RESEARCHED` | no | no | named in this mission's own text, not independently verified against published packages this pass |
| Accordion/tabs/modal/tooltip | — | — | `RESEARCHED` (no candidate) | no | no | this pipeline's own internal deterministic layout system already renders these patterns as static HTML/CSS (no JS) — an external library would only be justified for a business needing genuinely dynamic disclosure, and no such need has been evidenced yet |
| Data viz / knowledge graph (D3, Cytoscape.js, Sigma.js, React Flow) | — | — | `REJECTED` for this pipeline's current shape | no | no | React Flow requires React; this renderer emits raw HTML/JS with no framework — would need a framework decision, out of scope of "vendor a script" |
| Interactive maps (Leaflet, MapLibre) | Leaflet, MapLibre GL JS | BSD-2 / BSD-3 | `RESEARCHED` | no | no | real candidate for a future functional-module pass (see §4); not attempted this session |
| Kinetic typography (Splitting.js, Motion One, Anime.js) | Splitting.js, Motion One, Anime.js | MIT / MIT / MIT | `RESEARCHED` | no | no | plausible next Batch-2 candidate; not verified against a current release this pass |
| Page transitions (Barba) | barba.js | MIT | `INTEGRATION-BLOCKED` | no | no | Barba orchestrates client-side route swaps between distinct HTML documents; this renderer produces exactly one `index.html` per site with no client-side router and no second page to transition to — there is nothing for Barba to do until the renderer becomes multi-page |

**Verification for the three `INTEGRATED` rows** (unchanged from prior sessions, re-confirmed clean this pass):
```
npm run typecheck && npm run build && npm test
```
Full suite: **1323/1323 pass** (see §9 for the exact count history).

---

## 3. Generic external-primitive shipping mechanism

Generalized, not Three.js-specific:

- `lib/design/experienceRegistry.ts`'s `ExternalPrimitiveContract` — `sourceStrategy`, `vendoredFrom`, `siblingFiles`, `runtimeRequirements`, `browserRequirements`, `initialization`, `teardown`, `reducedMotionBehavior`, `mobileBehavior`, `fallbackBehavior`, `failureBehavior`. Every `INTEGRATED` external row above fills this in completely — none are `null`.
- `lib/render/runtimeAssets.ts` — the sibling-file dispatch table (`RuntimePrimitiveId -> RenderedFile[]`), used today only by `three-js-hero-object`, but genuinely reusable: any future primitive whose vendored build is a real ES module (not a UMD-with-global-fallback like Lenis/GSAP) uses this same table, not a new mechanism.
- Two shipping strategies proven: (a) concatenate a self-contained UMD/IIFE string into `runtime.js` (Lenis, GSAP), (b) ship a real ES module as a sibling file and `import` it from `runtime.js`, itself a `type="module"` script (Three.js).
- A third strategy, `cdn`, is named in the type but never used — deliberately: `lib/render/css.ts`'s own docstring promises a rendered site "looks the same offline," which a CDN script tag breaks.

---

## 4. Asset providers

| Candidate | Category | License/cost | Status | Blocker |
|---|---|---|---|---|
| FLUX (fal.ai / Replicate) | image generation | pay-per-image, ~$0.003–0.04 | `RESEARCHED` | requires a funded provider credential; `lib/platform/skills/builtin/media.ts` already defines the `image-generation` skill as an explicit placeholder with `blockedOn: "needs an image-model contract"` — the seam exists, the contract does not |
| Higgsfield | image/video/3D/audio | commercial ToS, credential-gated | `RESEARCHED` | registered in `lib/capability/registry.ts` (`image_editing`, `motion_media` rows, `gate: 'human'`) but no live call path from `agents/` |
| Meshy, Tripo | 3D generation | credit-based | `RESEARCHED` | same blocker class as FLUX — no image/3D-model provider contract implemented |
| ElevenLabs, Piper/Kokoro | audio/TTS | ElevenLabs free tier is explicitly non-commercial (verify before any paid tier use); Piper is local/free, MIT | `RESEARCHED` | `audio_speech` capability exists in the registry, `modelMayWriteOutput` etc. defined, but no adapter code |
| Cloudinary | image CDN/transform | freemium | `RESEARCHED` | would require a backend/account per deployed site — same class of blocker as §5 |

**Why none of these were implemented this pass:** every one requires either a paid API credential this environment does not hold, or a per-business account (Cloudinary, ElevenLabs) this pipeline has no mechanism to provision. Implementing the *adapter code* without a real credential to exercise it would produce untested code masquerading as integration — exactly what this mission's own rules forbid ("a mocked response ≠ a real provider"). The one thing genuinely safe to do without a credential — vendoring a deterministic, non-generative asset (a font, an icon set under a permissive license) — was not identified as a concrete need this pass and so was not fabricated as work.

**Real asset behavior today, unchanged:** `lib/design/assets.ts` and `lib/sources/{placesApi,mapsListing,instagramProfile}.ts` — every image in a generated site comes from the business's own collected listing/social photos. No image is ever invented. This is a deliberate floor, not a gap.

---

## 5. Functional website capabilities

| Candidate | Category | License/cost | Status | Blocker |
|---|---|---|---|---|
| Web3Forms | contact form | free, no backend, requires a per-site "access key" from a Web3Forms account | `INTEGRATION-BLOCKED` | the renderer emits static HTML with **no server of its own** (confirmed: zero `<form>` element emission anywhere in `lib/render/*.ts`); Web3Forms itself needs no backend, but embedding it still requires provisioning an access key **per generated business**, which this pipeline has no account/credential-issuance mechanism for. Implementing the `<form>` markup without a real key would ship a form that silently fails for every visitor — worse than no form. |
| Cal.com | booking | OSS, self-host or hosted free tier | `INTEGRATION-BLOCKED` | same class: embedding requires a per-business Cal.com account/username this pipeline cannot provision |
| OpenStreetMap embed (`openstreetmap.org/export/embed.html`, no library, no key) | maps | free, no account | `INTEGRATED` (this pass — the blocker below was fixed, not worked around) | `BusinessProfile.coordinates` (real, already-collected evidence) → `main.ts` → `RenderOptions.location` → `lib/render/sections.ts`'s `renderLocationBlock` (real `<iframe>` + a real, always-visible fallback link, never a hidden one) → real artifact. The security blocker was resolved architecturally: `lib/qa/gates/technical.ts`'s `SecurityEvidence.iframes` was widened from a bare `number` to `readonly string[]` (the actual `src` list), and the gate now checks every iframe's origin against `APPROVED_IFRAME_ORIGINS` (currently just `https://www.openstreetmap.org`) instead of a hard zero-tolerance count — the default posture (nothing passes unless explicitly reviewed) is unchanged; only a reviewed origin can now pass at all. `lib/qa/preflight.ts` and `scripts/publish-run.ts` both updated to collect the new shape. Live-verified end to end: a real rendered page's real iframe was detected by the live collector and correctly passed (`security.no-unapproved-iframes: true, "1 iframes, all from approved origins"`); a non-approved origin, a subdomain look-alike, and a malformed `src` were all separately tested and correctly still fail. CSS for the map is threaded through the *same* opt-in mechanism `runtimePrimitives` uses (`lib/render/runtime-rules.ts`'s new `locationRules()`) — the first attempt injected `.location-map` CSS directly into the unconditional design-rules block and broke the frozen `design.bakery.styles.css` snapshot; caught immediately by the test suite and fixed before proceeding, a real instance of exactly the mistake this codebase's own `RUNTIME_RULES` docstring warns about. |
| Supabase | backend/auth persistence | free tier 50k MAU | `INTEGRATION-BLOCKED` | requires a project per deployment; no provisioning mechanism |
| Stripe | payments | ~2.9%+€0.30/tx, requires an account | **`REJECTED` for this pipeline as it stands** | payment credential handling is explicitly prohibited to me directly (financial credentials, account creation) — any Stripe integration would need to be the *business owner's own* Stripe account, wired at their explicit direction, never something generated unattended |
| WhatsApp click-to-chat | contact | free, `https://wa.me/{number}` link, needs no SDK, no credential | `VERIFIED`, not integrated | genuinely the cheapest functional win here — a plain link, no library, no key, no backend. `BusinessProfile.phone: string | null` (`lib/types.ts:118`) already exists and is exactly what `wa.me/{number}` needs (digits-only, country code) — the blocker is not evidence, it is that this pass did not implement the link-emission code or a "this is actually a WhatsApp-reachable number, not just a phone line" distinction the business evidence would need to justify it |

**Honest summary:** every functional module researched needs either a paid/free-but-provisioned account per business (forms, booking, payments, auth) or was not verified against the actual collected profile schema this pass (WhatsApp). None were implemented. This is the correct outcome per the mission's own rule: "never claim integration without a real artifact," and a form pointed at a fabricated or missing access key is not a real artifact, it is a broken one.

---

## 6. SEO — completed this pass

| Item | Status | Evidence |
|---|---|---|
| Title, meta description/keywords, OpenGraph, Twitter card, JSON-LD | `INTEGRATED` (pre-existing) | `lib/render/document.ts:104-129`, unchanged |
| Canonical `<link>` | `INTEGRATED` (this pass) | `lib/render/document.ts`, gated on new `RenderOptions.siteUrl` |
| `sitemap.xml` | `INTEGRATED` (this pass) | `lib/render/site.ts`'s `seoFiles()` |
| `robots.txt` | `INTEGRATED` (this pass) | same function, cross-references the sitemap |
| Structured-data validation | `INTEGRATED` (this pass) | `lib/qa/gates/structuredData.ts` — real, pure, non-blocking gate: `@context`/`@type` presence, required properties per schema.org type (LocalBusiness, Restaurant, Organization, WebSite, PostalAddress, AggregateRating), blank-value detection, recursion into nested typed nodes. Wired into `lib/qa/preflight.ts` (extracts the page's real `<script type="application/ld+json">`) and `gatePreflight`. Live-verified against a real artifact: `{valid: true, issues: []}` for `fullContent`'s real JSON-LD. |

**Why `siteUrl` is opt-in, never invented:** a generated site has no URL of its own until deployment (`lovableAgent`, a separate, often-skipped stage — `LOVABLE_API_KEY` unset skips it entirely). The renderer cannot know a real domain at render time. `RenderOptions.siteUrl` defaults to `undefined` → `null`, in which case **zero new bytes** are emitted (verified: `renderSite(fullContent)` and `renderSite(fullContent, {})` are `deepEqual`). Only a caller who actually knows the eventual domain (e.g. the deploy stage, once wired, or an operator override) gets these three artifacts.

**Verify:**
```bash
node --import tsx -e "
import { renderSite } from './lib/render/index.js';
import { fullContent } from './test/fixtures/content.js';
const site = renderSite(fullContent, { siteUrl: 'https://example.com' });
console.log(site.files.map(f => f.path));
"
```
Real output this session: `index.html`, `styles.css`, `sitemap.xml`, `robots.txt` — inspected directly, canonical link and sitemap `<loc>` both read `https://example.com` exactly.

---

## 7. Accessibility, performance, security — pre-existing, re-confirmed, not extended this pass

| Capability | Current state | Missing | Next action |
|---|---|---|---|
| Accessibility | `EXISTS/WIRED` — `lib/qa/gates/accessibility.ts`, real landmark/skip-link/lang/alt/heading-order/keyboard-sweep/WCAG-AA contrast checks, wired via `lib/qa/preflight.ts` | dialogs, galleries, interactive maps, canvas/WebGL fallback coverage (mission §7 Batch 7 asks for these) — none of the primitives that would need them are integrated yet (no modal/gallery library shipped), so there is nothing to extend the gate to cover | extend the gate only once a gallery/modal library actually ships |
| Performance | `INTEGRATED` (corrected this pass — the prior entry here was imprecise) — `lib/qa/gates/performance.ts` (Freeze N-13) is a real, wired budget gate (page weight, largest image, DOM nodes, LCP, CLS), and `PerformanceEvidence.lcpMs`/`.cls` were always typed as an intentional seam ("when the browser supplied them"). `lib/qa/preflight.ts` now populates them for real: a `PerformanceObserver` for `largest-contentful-paint`/`layout-shift`, installed via `page.addInitScript` before first paint, live-measured against a real rendered `index.html`. Verified this pass against a real artifact: `lcpMs: 304, cls: 0`, well under the 2500ms/0.1 budget, `performance caveats: []`. | INP is genuinely not implementable the same way (it requires real user input events, not a static preflight page) — remains unmeasured, honestly | the freeze's own budgets are `SHOULD`, generous by design ("a small business site should sail through") — no further action needed unless a real site starts tripping them |
| Security | `EXISTS/WIRED` — `lib/qa/gates/technical.ts`, 9 real checks (inline handlers, `javascript:`/`data:` hrefs, mixed content, `target=_blank` without `noopener`, external scripts, iframes, CSP presence), wired via `preflight.ts` | extension only needed once a functional module (forms, external scripts) actually ships — nothing to extend against yet | dormant until §4/§5 produce something that needs it |

No code changed in this section this pass — re-confirmed from the prior audit, not re-implemented.

---

## 8. MCP and Agent Skills

| System | Current state | Blocker |
|---|---|---|
| MCP | `EXISTS/UNWIRED` — `lib/platform/mcp/{manager,httpConnector,stdioConnector}.ts` real, instantiated in `platform.ts`; `config.mcp.servers` empty by default | activating even one server (e.g. a Playwright MCP server) requires deciding a concrete server binary/package, its permission surface, and testing the manager against it live — a real, separate, non-trivial verification task not attempted this pass to avoid claiming "activated" on an unexercised code path |
| Agent Skills | `EXISTS/UNWIRED` — `lib/platform/skills/*` real; all 38 built-ins are explicit placeholders (`lib/capability/bindings.ts:20-24` states this directly in its own comment) | same class of blocker as asset providers (§4): most high-value skills (vision, image-generation, speech) are blocked on the same missing model-provider contracts |

Not attempted this pass — both are real, honest `EXISTS/UNWIRED`, not `INTEGRATED`, and activating either without a concrete server/contract to test against would be exactly the "claims integration without artifact" failure mode this document is built to avoid.

---

## 9. Creative Director — arsenal consumer, current real state

`DesignDirective.runtimePrimitives` → `directiveRuntimePrimitiveIds` → `resolvePrimitives` → `renderSite` → `RenderedFile[]` is real, tested, and wired into `main.ts`'s production `executePipeline` (prior session's work, re-confirmed passing this pass). It currently covers only the runtime-primitive arsenal (§2) — not assets, not functional modules, not typography/navigation selection, because those arsenals themselves are not yet real (§4, §5). Expanding the Director's schema to select from arsenals that do not exist yet would be schema for its own sake; the schema will grow exactly when §4/§5 produce something real to select.

---

## 10. Business archetype benchmark

Five archetypes generated and inspected in the prior session (premium architecture studio, artisan bakery, high-end restaurant, local plumber, technology company) — **5/5 produced genuinely distinct primitive stacks**, including one with zero runtime bytes (the plumber) and one with the full sibling-file mechanism engaged (the technology company). Not re-run this pass; no new primitive was added that would change their output. The mission's ask for 10 archetypes (adding fashion brand, hotel, creative agency, medical/dental, educational platform) was **not extended this pass** — each of those five would resolve to the same 6-primitive arsenal already benchmarked, so a new run would prove the same wiring again, not new capability. Worth doing once §2's arsenal actually grows (a gallery library, a typography library) so the new archetypes exercise something the first five could not.

---

## 11. Verification — this pass, exact numbers

SEO (§6) work:
```
npm run typecheck   → clean
npm run build       → clean
npm test             → 1323 pass / 0 fail / 144 suites
```
(Up from 1314 before this pass — 9 new tests, all in `test/render/site.test.ts`'s `siteUrl` block.)

Performance/LCP-CLS work (§7): `npm run typecheck`/`npm run build`/`npm test` re-run clean after, still **1323/1323** — no new fast unit test was added for `collectPreflightEvidence`'s browser half, matching that file's own documented convention ("exercised only by... a real run of the pipeline," not the fast suite, since it launches a real headless browser). Verified instead by a real, live, one-off run against a rendered artifact this pass — see §7's table row for the exact numbers returned (`lcpMs: 304, cls: 0`).

Structured-data validation work: 12 new tests (`test/qa/gates/structuredData.ts` block, `test/qa/preflight.test.ts`) — **1335/1335**.

Iframe allow-list generalization: 6 new/updated tests (`test/qa/gates/technical.test.ts`) — **1339/1339**.

OSM map work: 8 new tests (`test/render/site.test.ts`'s `location` block, including an explicit test that the legacy no-design path is deliberately unaffected) — **1347/1347**, final count this pass. `npm run typecheck`/`npm run build` clean throughout. One real regression caught and fixed mid-pass: the first CSS attempt broke the frozen `design.bakery.styles.css` snapshot (added rules directly to the unconditional design-rules block instead of the opt-in mechanism) — caught by the test suite immediately, fixed before proceeding, snapshot diff confirmed back to the exact pre-existing (session-start) state. Live end-to-end verification: a real rendered page's real OpenStreetMap iframe was extracted by the live Playwright collector and passed `security.no-unapproved-iframes` (`"1 iframes, all from approved origins"`); the only failing checks in that same live run were unrelated missing local asset files in the ad-hoc verification script (fonts/images not copied), confirmed by inspecting each failing check individually.

€0 spend across the entire pass.

Frozen snapshots (`test/__snapshots__/design.bakery.json`, `design.bakery.styles.css`, `design.law.json`) — diff unchanged from session start, confirmed pre-existing/unrelated (not touched this pass, checked directly via `git diff --stat`).

Real artifact generated and inspected this pass: `renderSite(fullContent, { siteUrl: 'https://...' })` written to disk, canonical link + `sitemap.xml` + `robots.txt` all grepped for exact expected content (§6).

Cost this pass: **€0** — no live/paid provider calls, no new npm dependencies installed, no credentials touched.

---

## 12. Exact remaining gaps, ranked by real leverage (updated again this pass)

Every item from the previous "remaining gaps" list that had no external blocker is now done:
- ~~Core Web Vitals~~ — done (§7).
- ~~Structured-data validation~~ — done (§6), live-verified.
- ~~`security.no-iframes` → allow-listed-origin check~~ — done (§5), and used immediately to ship a real OSM map, live-verified against the actual gate, including negative cases (unapproved origin, subdomain look-alike, malformed src).
- WhatsApp click-to-chat — still correctly not implemented; still an **evidence** gap (no signal a number is WhatsApp-reachable), not a technical one. Nothing changed this pass because nothing *could* change honestly: fabricating the evidence is exactly what this system exists to refuse to do.

What remains is genuinely, individually blocked, not merely undone:
1. **Per-business-account functional modules** (Web3Forms, Cal.com, Supabase, Clerk, Meilisearch/Algolia) — every one needs a credential or an account this pipeline has no provisioning mechanism for. Writing adapter *shapes* for nine providers with zero live verification was considered and rejected this pass: it would produce untested surface area, which is the exact failure mode ("a mocked response ≠ a real provider") this document exists to prevent. Revisit only alongside a real provisioning story, not as isolated adapter stubs.
2. **Stripe** — explicitly out of scope for autonomous implementation: payment-credential handling is not something to design or wire unattended; it needs the business owner's own account and explicit direction.
3. **Asset-generation providers** (FLUX, Higgsfield, Meshy, Tripo, ElevenLabs) — same credential class as (1); the existing skill-placeholder seam (`lib/platform/skills/builtin/media.ts`) is the correct place for a future adapter, not a new parallel one.
4. **MCP activation** — infrastructure is real and already env-driven (`MCP_SERVERS` in `lib/config.ts`); activating one for real requires a genuine server binary to connect to and verify against live, which this pass did not attempt (see §8 note below on why: doing it shallow/unverified would be worse than not doing it).
5. **10-business benchmark** — the arsenal grew meaningfully this pass (structured-data validation, LCP/CLS, a real functional module in the map) — worth re-running now, not attempted in this pass for time.

## 13. Exact next implementation step

Two credible candidates, both genuinely credential-free and both real:
- **10-business benchmark re-run** — the arsenal changed enough this pass (map, LCP/CLS, structured-data validation) that re-running the 5-archetype benchmark (extending toward the mission's 10) would show real, new differentiation for the first time since the map landed — pure verification work, no new code.
- **`APPROVED_IFRAME_ORIGINS` extension to MapLibre / a second embeddable, reviewed origin** — the allow-list mechanism built this pass is now proven and reusable; a second origin is a one-line addition plus its own render path, not a new mechanism.
