# BusinessForge 2.0 — Master Architecture

> **⚠ HISTORICAL PLANNING DOCUMENT (2026-08-24 note).** Part of the pre-implementation
> `BUSINESSFORGE_2.0_*.md` design corpus. Design-input history, not current status —
> despite the "Master Architecture" title, this is a target/proposal doc, not the
> canonical current-state doc. Current status: `docs/MASTER_INVENTORY.json`
> (machine-readable) and `docs/BUSINESSFORGE_FINAL_ARCHITECTURE.md` (canonical).

_Read-only architectural audit and target architecture. Produced 2026-08-14 against branch
`design-director-smoke` (working tree with 21 modified and 20 untracked paths). **No source
file, test, snapshot, n8n workflow, or dependency was modified, installed, or deleted in
producing this document.** Nothing here was implemented._

---

## 0. How to read this document

Every structural claim carries a verification mark:

| Mark | Meaning |
|---|---|
| **[V]** | **Verified** — read in the repository's source this pass; the file path is given. |
| **[D]** | **Documented only** — asserted by a repo document, not independently confirmed in code this pass. |
| **[X]** | **Absent** — searched for and not present in the repository. |
| **[?]** | **Unknown** — cannot be settled from the repository; requires a live run or a founder decision. |

Every component carries a disposition, defined once here:

| Disposition | Meaning |
|---|---|
| **KEEP** | Exists, works, is correctly placed. 2.0 builds on it unchanged. |
| **MODIFY** | Exists, but its contract, placement, or scope must change for 2.0. |
| **BUILD** | Does not exist. 2.0 requires it. |
| **OPTIONAL** | Valuable but not on the critical path; ship only when a specific business or budget earns it. |
| **REJECT** | Must not be built, or must be removed/quarantined. The reason is always given. |

The complete disposition ledger is §21. Sections §1–§20 justify it.

The document is written in English because every other document in `docs/` is, and because the
next implementation session reads this file alongside them.

---

## 1. Executive summary

### 1.1 What BusinessForge is today (verified)

A **nine-stage deterministic pipeline** that turns one Google Maps URL into a rendered static
website, plus a **bounded rejection loop** that screenshots the result, judges it, and rebuilds
it with a different creative concept until it passes or escalates to a human.

```
maps URL
  → discovery → collect → normalize → analyze → write → direct → design → render → deploy
                                                                             │
                                                                             ▼
                                   build → browser → visual-critic → distinctness-gate → hermes
                                     ▲                                                     │
                                     └──────────────── reconcept (bounded by maxIter) ◄─────┘
```

Two model calls are on the default product path (analyst, writer). Two more are optional and
off by default (Design Director, Visual Critic). The entire design layer, the entire content
layer, and the entire renderer are **model-free and deterministic** [V: `lib/design/`,
`lib/content/`, `lib/render/`; `agents/designAgent.ts` header states "makes no model call"].

### 1.2 What 2.0 adds, in one paragraph

2.0 does **not** add a second pipeline. It adds (a) a **director cabinet** — Creative, Art, UX,
Motion, Asset directors and a Technical Architect — that replaces today's single
`designDirectorAgent` with role-scoped, closed-set decisions; (b) a **Design Battle**: N
candidate directions generated per job and judged against each other rather than one candidate
judged against a threshold; (c) **Design Memory + Design Fingerprint**: a persistent index of
every design this platform has ever shipped, so "distinct" means *distinct from what we have
already built*, not merely "not obviously a template"; (d) a **Visual Jury** and an
**Adversarial Critic** replacing the single uncalibrated vision call; (e) **four QA
disciplines** (functional, accessibility, performance, security) promoted from a publish script
into gates; and (f) **cost control, model routing, and observability** as first-class
subsystems rather than environment variables.

### 1.3 The single invariant that 2.0 must not break

> **The model decides INTENT from a closed vocabulary. Deterministic code executes intent
> through validated capabilities.**

Enforced structurally today by `additionalProperties: false` on every model schema, closed
enums, and `applyDirective`'s validate-or-ignore rule [V: `agents/designDirectorAgent.ts:84-295`,
`lib/design/directive.ts:376+`]. Every 2.0 component below is designed so that adding it cannot
open a path for a model to emit CSS, JS, GLSL, hex codes, durations, or business facts.

### 1.4 The three findings that most shape 2.0

1. **The deterministic floor already produces distinct sites at €0.** A composed page
   (`--compose`) runs the full character → experience → script → content → design → render
   chain with no model call and no API key [V: `main.ts:777-840`]. 2.0 must treat every model
   as an *improver over a working floor*, never as a dependency.
2. **The rejection loop exists but cannot actually see.** `runJob` loops build → shoot →
   critique → gate → decide → reconcept [V: `lib/workflow/runJob.ts:307-467`], but with no
   `VISION_*` credentials the critic returns `genericVerdict: 'uncertain'` with zero axes
   [V: `lib/workflow/runJob.ts:363-368`, `scripts/n8n/stage.ts:156-176`]. The loop therefore
   currently rebuilds only on the deterministic score. **This is the highest-value gap in the
   system.**
3. **Reconcept is rotation, not reconception.** When the Director is off, the "new creative
   concept" is a deterministic index rotation over `experienceMode`, `direction`, and
   `signatureMoment` [V: `lib/workflow/runJob.ts:268-296`, `perturbedDirective`]. It changes
   the design observably; it does not *reason* about why the last one failed. Design Battle
   (§10) is the answer.

---

## 2. Method and scope of this audit

**Read this pass [V]:** `main.ts` (888 lines), all 8 files in `agents/`, all 101 `.ts` files in
`lib/` by export surface with 24 read in full, `n8n/businessforge-workflow.json` (10 nodes)
parsed, `n8n/README.md`, `scripts/n8n/{stage,stage-server}.ts`, 9 further scripts,
`.env.example` (193 lines), `package.json`, `docs/architecture.md`,
`docs/businessforge-experience-engine-master-plan.md` (815 lines),
`design_evaluation_research.json`, `PROJECT_STATUS.md` (head), git status and diffstat.

**Repository scale [V]:** 101 TypeScript modules under `lib/` totalling 31,469 lines; 37 test
files containing 130 `test()` calls; 35 scripts; 24 documents under `docs/` plus 7 ADRs.

**Deliberately not done:** no test run (snapshot tests can write files), no build, no network
call, no n8n interaction, no dependency installation. Read-only means read-only.

**Prior art consumed, not repeated:** `docs/businessforge-experience-engine-master-plan.md`
already establishes the layer doctrine, the Bakery V2 generalize/do-not-generalize split, the
capability vocabulary table, and 17 architectural decisions. This document **supersedes its
capability table where the code has moved** (§3.5) and extends it into the areas it does not
cover at all: agents as a cabinet, external-tool economics, model routing, Design Battle/Memory/
Fingerprint, the four QA disciplines, cost, security, and observability.

---

## 3. Repository ground truth — the complete component inventory

### 3.1 Orchestration and entry points

| Component | Path | Lines | What it owns | Verified |
|---|---|---|---|---|
| Pipeline orchestrator | `main.ts` | 888 | 9 stages, artifact persistence, resume, `--render`, `--compose`, CLI | [V] |
| Typed configuration | `lib/config.ts` | 645 | the **only** module permitted to read `process.env` | [V] |
| Structured logger | `lib/logger.ts` | — | console + NDJSON file sink per run, child scopes, `logger.time` | [V] |
| Error taxonomy | `lib/errors.ts` | — | `AgentError` with `source` + `retryable`; 10 closed capability codes | [V] |
| Browser session | `lib/browser.ts` | — | one Playwright/Chromium session per run, opened lazily | [V] |
| Shared types | `lib/types.ts` | 671 | `BusinessProfile`, `WebsiteContent`, `WebsiteDesign`, `AgentContext` | [V] |

**Stage order and artifacts [V: `main.ts:179-234`]:**

| # | Stage | Artifact | Model? | Browser? |
|---|---|---|---|---|
| 1 | `discovery` | `1-discovery.json` | no | yes |
| 2 | `collect` | `2-collected.json` | no | yes |
| 3 | `normalize` | `3-profile.json` | no | no |
| 4 | `analyze` | `4-strategy.json` | **yes** | no |
| 5 | `write` | `5-content.json` | **yes** | no |
| 5a | `direct` | `5a-directive.json` | optional | no |
| 5b | `design` | `5b-design.json` | no | no |
| 6 | `render` | `site/` (none) | no | no |
| 7 | `deploy` | `6-deployment.json` | no | no |

Resume semantics: `--from=<stage>` reads every earlier artifact off disk and re-runs from there,
**in place** [V: `main.ts:536-563`]. `ARTIFACT_DEFAULTS` backfills fields added to a contract
after old artifacts were written — **only ever with the empty value, never a guess**
[V: `main.ts:254-273`]. This is a genuinely well-designed persistence boundary and 2.0 keeps it.

### 3.2 The platform layer (capability abstraction)

| Component | Path | Status | Verified |
|---|---|---|---|
| Platform assembly | `lib/platform/platform.ts` | working | [V] |
| Telemetry | `lib/platform/telemetry.ts` | working — latency samples, availability, error accounting | [V] |
| Capability vocabulary | `lib/platform/types.ts` | working — `CapabilityOutcome`, `HealthReport` | [V] |
| Skill registry/loader/manager | `lib/platform/skills/` | working | [V] |
| **38 built-in skills** | `lib/platform/skills/builtin/` | **all placeholders**, version `0.0.0`, `execute()` throws `not_implemented` | [V] |
| MCP manager | `lib/platform/mcp/manager.ts` | working | [V] |
| MCP HTTP transport | `lib/platform/mcp/httpConnector.ts` | implemented — JSON-RPC `initialize`/`tools/list`/`tools/call`, session id echo | [V] |
| MCP stdio transport | `lib/platform/mcp/stdioConnector.ts` | **declared, not implemented** — returns `not_implemented` | [V] |

The **honesty rule** is the platform's best property and must survive into 2.0: a placeholder
never returns `[]` or `null`, because a caller would carry on with nothing and produce output
that looks complete [V: `lib/platform/skills/placeholder.ts:1-20`].

The 38 reserved ids across 8 categories [V: counted in `lib/platform/skills/builtin/`]:

- **web (6)** `browser-automation`, `playwright`, `firecrawl`, `google-maps`, `web-search`, `lovable`
- **development (7)** `github`, `git`, `filesystem`, `api-testing`, `performance-testing`, `security-scanning`, `accessibility-testing`
- **documents (4)** `pdf`, `word`, `excel`, `powerpoint`
- **media (5)** `vision`, `ocr`, `image-generation`, `speech`, `translation`
- **data (3)** `embeddings`, `vector-store`, `database`
- **operations (7)** `deployment`, `authentication`, `payments`, `monitoring`, `logging`, `notifications`, `scheduling`
- **marketing (4)** `seo`, `analytics`, `cms`, `social-media`
- **productivity (2)** `email`, `calendar`

Three of these ids are the **exact slots 2.0 needs**: `embeddings` and `vector-store` for Design
Memory (§11), `accessibility-testing`/`performance-testing`/`security-scanning` for the QA
quartet (§17), and `vision` for the Visual Jury (§15). They are already contracted; they need
implementations, not new architecture.

### 3.3 Evidence layer (sources)

| Source | Path | Network | Cost | Verified |
|---|---|---|---|---|
| Maps listing (scrape) | `lib/sources/mapsListing.ts` | Playwright | €0 | [V] |
| Places API (New) | `lib/sources/placesApi.ts` | HTTPS | **paid** | [V] |
| Instagram public profile | `lib/sources/instagramProfile.ts` | Playwright | €0 | [V] |
| Own-website crawl | inside `agents/collectorAgent.ts` | Playwright | €0 | [V] |
| Merge policy | `lib/sources/merge.ts` + `authority.ts` | — | — | [V] |
| Provenance folding | `lib/sources/collectedSources.ts` | — | — | [V] |

**Merging is policy and it is per-field, not per-source** [V: `lib/sources/merge.ts`,
`authority.ts:37` `FIELD_AUTHORITY`]. A source that answered first about accessibility must not
cost the amenity list only the other source carries. Hours resolve day-by-day, attributes
label-by-label. This is correct and 2.0 must not "simplify" it.

**Established negative result:** a signed-out Maps session serves no Reviews tab and no photo
grid — verified against two browser fingerprints including a realistic user agent with the
automation flag removed [D: `docs/architecture.md:113-118`, corroborated by the persistent
memory note `businessforge-maps-limited-view`]. **Do not re-attempt review scraping.** Reviews
come from the Places API under licence, or not at all.

### 3.4 Design intelligence layer (deterministic, model-free)

Twenty modules, 8,000+ lines, no model call anywhere in the chain [V: `lib/design/`]:

| Module | Question it answers | Verified |
|---|---|---|
| `character.ts` | what *kind* of business is this? (`visualWeight`, `expressiveness`, `emotionalRegister`, `offeringBreadth`, `narrativePotential`) | [V:178 `deriveCharacter`] |
| `experience.ts` | what shape is the page? (`brochure`/`showcase`/`narrative`/`immersive`, `pacing`, `signatureMoment`, **`transition`**) | [V:41,71,124] |
| `script.ts` | what is the ordered story? (`Beat[]` with `NarrativeRole`, `VisualIntensity`) | [V:157,208] |
| `conversion.ts` | how and when do we ask? (`ConversionMode`, `CtaPlacement`, `ContactProminence`) | [V:94] |
| `interaction.ts` | how much does the page move? (`static`→`immersive` + a `ceiling`) | [V:63] |
| `assets.ts` | which photograph goes where? (`AssetChoreography`, `AssetRights`) | [V:186] |
| `worlds.ts` | the colour journey (`ember`/`bone`/`paper`, `assignJourney`) | [V:182,220] |
| `layout.ts` | variant × frame × emphasis × order per section | [V:634] |
| `patterns.ts` | 40+ named design patterns with eligibility rules | [V:151,758] |
| `industries.ts` | industry classification and defaults | [V:410] |
| `themes.ts` | 11 directions → typeface/mood definitions | [V:100] |
| `tokens.ts` | colour system, type scale, spacing, radius, elevation, motion | [V:92,373] |
| `color.ts` | OKLCH conversion, gamut clamping, WCAG contrast, ramps | [V:125,187] |
| `directive.ts` | the AI director's validated override surface | [V:376,562] |
| `plan.ts` | derives the narrative plan **once** and hands it to both content and design | [V:64] |
| `quality.ts` | `scoreExperience`, `narrativeCoherence`, `genericityReport` | [V:55,142,226] |
| `compose.ts` | assembles the whole `WebsiteDesign` | [V:446] |

**Finding that supersedes the prior master plan:** the `transition` enum proposed there as
extension **E1** is now **implemented** — `ExperienceTransition = 'none'|'veil'|'wipe'|
'circular-handoff'` exists on the type, is chosen by `planExperience` (narrative+signature →
`veil`, craft showcase → `wipe`), and reaches `WebsiteDesign` [V: `lib/design/experience.ts:71,
84,221-224`; `lib/design/types.ts:499`]. Treat E1 as **done**, not proposed.

### 3.5 Content layer (deterministic, model-free)

`lib/content/` decides what each beat of the page *says*, in the language the evidence is
written in [V: `director.ts:336`, `language.ts:79`, `evidence.ts`, `quality.ts:152`].

Three copy bases, enforced by tests: `quoted` (verbatim from evidence), `composed` (facts joined
by a closed-set frame), `framing` (a lexicon label keyed to narrative role). **A frame may
compose facts; it may never supply them** [V: `lib/content/director.ts:84-101`,
`docs/decisions/0007`]. Languages are a closed set: `en`, `ro` [V: `language.ts:36-38`].

### 3.6 Render layer

| Module | Role | Verified |
|---|---|---|
| `site.ts` | `renderSite(content, options) → RenderedSite` — the whole pure function | [V:159] |
| `variants.ts` | **3,692 lines** of design rules — the largest module in the repo | [V:147] |
| `sections.ts` | 1,276 lines — per-section markup | [V:1183] |
| `css.ts` | 886 lines — stylesheet assembly | [V:172] |
| `document.ts` | 486 lines — the HTML document, nav, JSON-LD, skip link | [V:400] |
| `html.ts` | branded `Html` type — escaping is structural, not a convention | [V:18-26] |
| `fonts.ts` + `fontManifest.ts` | `@font-face` from **locally vendored** faces — no network font fetch | [V:82,107,16] |
| `theme.ts` | fallback theme when no `WebsiteDesign` is supplied | [V:219,278] |
| `assets.ts` | `safeHref`/`safeImageUrl` allow-lists | [V:50,55] |
| `write.ts` | writes the site to disk, reports missing assets | [V:72] |
| `runtime-rules.ts` | **new** — the CSS half of the generic runtime | [V] |

### 3.7 Runtime layer — Tier 2 now exists

The prior master plan recorded `lib/runtime/` as **absent** (gap G2/G8). It is now **present**:

- `lib/runtime/scroll-progress.ts` [V] exposes `--forge-scroll` (page progress 0→1) and
  per-section `--forge-vis` via `IntersectionObserver`. It **never authors a colour or a
  transform** — it only reports position.
- `lib/render/runtime-rules.ts` [V] holds the CSS half, gated on both
  `[data-runtime="scroll-progress"]` **and** `prefers-reduced-motion: no-preference`, plus a
  `(min-width:768px) and (hover:hover) and (pointer:fine)` guard for the pinned hero.
- Wiring: `RenderOptions.runtime: 'none' | 'scroll-progress'` (default `'none'`)
  [V: `lib/render/types.ts`], emitted as `runtime.js` + `data-runtime` attribute
  [V: `lib/render/site.ts:251-260`, `document.ts:436-447`].
- Opt-in policy: engaged only when `plan.experience.mode === 'narrative' &&
  plan.character.visualWeight === 'image-led'` [V: `main.ts:820-823`].

This is **exactly the bread-free Tier 2 the plan specified**, and it is correctly gated.
Disposition: **KEEP**.

### 3.8 Bakery V2 — the specialized host

`lib/experience/` (6 modules: `types`, `compose`, `emit`, `runtime`, `shader`, `styles` —
~2,600 lines including GLSL) is a **parallel renderer** reachable only through
`scripts/build-experience.ts` [V: import graph — no edges into `main.ts`, `lib/design/`, or
`lib/render/`]. It contains bread vocabulary (`DoughState`, SDF loaf, oven spring) that must
never be generalized [D: `docs/bakery-v2-technical-reference.md`].

Disposition: **OPTIONAL / quarantined** — keep as the reference proof that Tier 3 is reachable;
do not merge, do not generalize, do not let a second one be built before a business earns it.

### 3.9 QA layer

| Module | What it asks | Model? | Verified |
|---|---|---|---|
| `lib/design/quality.ts` | is this design explainable, business-specific, coherent, diverse? | no | [V] |
| `lib/content/quality.ts` | may the page say this? (12 issue kinds) | no | [V] |
| `lib/qa/visual-qa.ts` | what is *broken* on this page? → patches CSS, re-checks | **yes (vision)** | [V:289,473] |
| `lib/qa/visual-critic.ts` | does this *look* generic? (13 axes, no repair) | **yes (vision)** | [V:31-45,160] |
| `lib/qa/distinctness-gate.ts` | PASS/FAIL + diagnosis + route | no | [V:76] |
| `scripts/publish-run.ts` | does it actually **work** in a browser? | no | [V:254-302] |
| `scripts/creative-review.ts` | structural signatures of generated-looking work | no | [V] |

### 3.10 Workflow layer

| Module | Role | Verified |
|---|---|---|
| `lib/workflow/jobState.ts` | one `job.json` per run; atomic temp+rename write; 16 lifecycle stages | [V:22-38,159] |
| `lib/workflow/hermes.ts` | deliver / escalate / continue — the only decision above the gate | [V:37-73] |
| `lib/workflow/runJob.ts` | the whole loop, in-process | [V:307-467] |
| `scripts/n8n/stage.ts` | one HTTP-callable stage, 7 stage names | [V:45,96] |
| `scripts/n8n/stage-server.ts` | host-side server on `0.0.0.0:7717`, shared-token auth | [V:74-140] |
| `n8n/businessforge-workflow.json` | 10 nodes, one IF-loop back to Build | [V: parsed] |

---

## 4. The agent roster — 1.0 actual and 2.0 target

### 4.1 The eight agents that exist today [V: `agents/`]

| Agent | Stage | Model | Browser | Single responsibility | Disposition |
|---|---|---|---|---|---|
| `discoveryAgent` | 1 | no | yes | Maps URL → resolved business identity. Ordered strategies, degrades to `null`, never throws except on total resolution failure. | **KEEP** |
| `collectorAgent` | 2 | no | yes | Gather raw facts from every available source. Every string is verbatim and carries its URL. | **KEEP** |
| `normalizerAgent` | 3 | no | no | Reconcile sources into one `BusinessProfile`. Nothing invented, nothing silently dropped — losers kept as alternatives. | **KEEP** |
| `businessAnalystAgent` | 4 | **yes** | no | Understand the business: category, audience, goals, pages, modules — each with evidence. | **KEEP** |
| `writerAgent` | 5 | **yes** | no | The only agent that produces prose. Facts are assembled by code *after* the model answers. | **KEEP** |
| `designDirectorAgent` | 5a | optional | no | AI Art Director — closed-set visual intent + open creative concept. | **MODIFY** → split into the cabinet (§4.2) |
| `designAgent` | 5b | **no** | no | Deterministic `WebsiteDesign` from profile + content + optional directive. | **KEEP** |
| `lovableAgent` | 6 | no | no | Deploy. **`run()` throws `NotImplementedError`** [V: `agents/lovableAgent.ts:23-34`]. | **MODIFY or REJECT** (§6.11) |

**The structural anti-hallucination rule, verified [V: `agents/writerAgent.ts:11-31`,
`docs/architecture.md:136-153`]:** hours, contact rows, JSON-LD, the trust bar and testimonials
are built from the profile by code *after* the model answers. The writer's schema has **no
field** for any of them. A model never asked for a certification cannot invent one.
`groundTestimonials` keeps the model's *position and heading* and replaces its bullets unread
with quotations that came from a source; with no verified review the section is removed
entirely. **This rule is the most valuable thing in the codebase. 2.0 extends it to every new
agent below.**

### 4.2 The 2.0 director cabinet

Today one agent answers eleven questions at once. That is why its output has both a closed-set
half (validated) and a free-text half (`creativeThesis`, `visualMetaphor`, `emotionalJourney`,
`spatialStrategy`, `compositionStrategy`, `whatToAvoid` — currently **advisory, largely
unconsumed by the renderer**) [V: `agents/designDirectorAgent.ts:270-293`; consumption not found
in `lib/design/compose.ts`]. The cabinet fixes this by giving each role one question and one
consumer.

| Director | Question it alone answers | Output contract (all closed-set unless noted) | Consumed by | Model | Disposition |
|---|---|---|---|---|---|
| **Creative Director** | What *is* this website, as an idea? | `creativeThesis`, `visualMetaphor`, `emotionalJourney`, `whatToAvoid` (free text, ≤1 sentence each) + `experienceMode`, `signatureMoment`, `pacing` (closed) | Design Battle scoring, Adversarial Critic, `planExperience` override | yes | **BUILD** (extract from `designDirectorAgent`) |
| **Art Director** | What does it look like? | `direction` (11), `density` (3), `colorStrategy` (3), `typographyIntent.preference` (2), `imageryIntent.treatment` (5), `accessibilityTarget` (2) | `applyDirective` → `composeDesign` | yes | **MODIFY** (this is today's agent, narrowed) |
| **UX Director** | How does a visitor get what they came for? | `conversionStrategy` (4), `ctaPlacement` (4), `contactProminence` (4), `navigationMode` (closed, **new**), `informationDensity` (3) | `planConversion`, `document.ts` nav | yes | **BUILD** |
| **Motion Director** | What moves, and why? | `interactionStrategy` (4), `transition` (4), `runtimeTier` (`none`/`scroll-progress`/`host`), `respectReducedMotion` (always true) | `planInteraction`, `RenderOptions.runtime` | yes | **BUILD** |
| **Asset Director** | Which photograph earns which position? | `heroAsset` (index into the profile's assets), `signatureAsset`, `reduceImagery` (bool), `rightsPosture` (`usable`/`reference-only`) | `choreographAssets` | yes | **BUILD** |
| **Technical Architect** | Can this be executed, and at what cost? | `capabilityPlan[]` (names of validated renderer/runtime capabilities), `budgetEstimate`, `rejectedCapabilities[]` with reasons | Builder, cost ledger | **no** (deterministic) | **BUILD** |

**Non-negotiable constraints on every director:**

1. Schema `additionalProperties: false`, every decision field a closed enum.
2. Free text is permitted **only** for the Creative Director's four concept fields, is capped at
   one sentence each, and **is never parsed into a decision** — it is scored by the jury and
   stored in provenance.
3. An invalid value leaves the deterministic floor standing and logs a warning; it never fails
   the run [V: today's rule, `lib/design/directive.ts:376+`; ADR 0004].
4. No director may name a section kind, an asset, or a fact that is not present in its brief
   [V: today's rule, `agents/designDirectorAgent.ts:321`].
5. The **Technical Architect is deterministic** — it is a feasibility checker, not a model. It
   maps every requested capability to a registered implementation and rejects the rest with a
   reason. This is what prevents the cabinet from promising an experience the renderer cannot
   build.

### 4.3 Execution agents

| Agent | Role | Exists? | Disposition |
|---|---|---|---|
| **Builder** | Turn the approved plan into `site/`. Today this is `composeStandalone` + `renderSite` called directly [V: `lib/workflow/runJob.ts:321`, `scripts/n8n/stage.ts:132`]. The gate already routes to a `'builder'` stage name [V: `distinctness-gate.ts:32,117`]. | as a function, not an agent | **MODIFY** — promote to a named agent with a contract, so the `builder` route has a real destination |
| **Browser** | Drive Chromium: screenshots, interaction proof, measurement. Today split across `captureScreenshots` [V: `runJob.ts:134-179`], `publish-run.ts`, `creative-review.ts`, `shoot*.mjs` — **four capture implementations with the same hard-won lazy-loading fix copy-pasted between them** [V: comments in `runJob.ts:126-133` and `publish-run.ts:115-117`]. | duplicated | **MODIFY** — one Browser agent, one capture technique, every QA discipline calls it |

**The lazy-loading incident must be preserved in whatever consolidation happens** [V]: strip
`loading="lazy"`, `await` every `image.decode()`, then **grow the viewport to the page's full
height** — never `fullPage: true`, which re-runs lazy heuristics after decode and captures a
blank band that looks exactly like broken CSS.

---

## 5. External tools — the complete register

Format per the brief: capability · role · API · cost · alternative · fallback · latency ·
limitations · when to use · when NOT to use. Latency marked **(cfg)** is a configured timeout,
**(obs)** is documented observed behaviour, **[?]** is unmeasured.

### 5.1 Playwright + Chromium — **KEEP**

| Field | Value |
|---|---|
| **Capability** | Headless browser automation: navigation, DOM evaluation, screenshots, viewport control, network interception |
| **Role** | The only way the platform sees anything: discovery, collection, Instagram, all screenshots, all browser QA |
| **API** | `playwright@^1.49.1` npm; `chromium.launch({headless:true})`; installed by `postinstall: playwright install chromium` [V: `package.json:26,30`] |
| **Cost** | €0 (local compute + bandwidth) |
| **Alternative** | Puppeteer (fewer capture guarantees), Bright Data Scraping Browser (paid, unblocks harder targets), plain `fetch` + Cheerio (no JS execution — fails on Maps) |
| **Fallback** | None. Discovery cannot degrade below "a browser". A run without it fails at stage 1. |
| **Latency** | 30,000 ms per navigation/selector **(cfg** `BROWSER_TIMEOUT_MS`**)**; stages 1–3 cost "about forty seconds of live browsing per run" **(obs** `main.ts:170-178`**)** |
| **Limitations** | Node modules are **host-platform-specific** — this is precisely why n8n calls the host over HTTP instead of running stages in its Linux container [V: `n8n/README.md:33-36`]. Chromium binary ~150 MB. Headless is detectable. |
| **Use when** | Any page must be rendered, measured, or photographed |
| **Do NOT use when** | A licensed API returns the same fact (use Places API for reviews); to re-attempt Maps review scraping (proven absent); to fetch a static JSON endpoint |

### 5.2 Google Maps (signed-out scrape) — **KEEP**

| Field | Value |
|---|---|
| **Capability** | Business identity, address, phone, category, hours labels, attribute labels, listing photos |
| **Role** | Stage 1 identity resolution; stage 2 listing-as-content |
| **API** | None — DOM scraping through Playwright [V: `lib/sources/mapsListing.ts`] |
| **Cost** | €0 |
| **Alternative** | Places API (licensed, richer, paid) |
| **Fallback** | Fields degrade to `null` individually; only total failure to resolve a listing is fatal [V: `agents/discoveryAgent.ts:6-12`] |
| **Latency** | Within the 30 s browser budget; includes a consent interstitial **(obs)** |
| **Limitations** | **No Reviews tab and no photo grid when signed out — proven against two fingerprints** [D: `docs/architecture.md:113-118`]. Obfuscated class names rotate, so every field is read through an ordered strategy list. Maps URLs carry an `ftid` (`0x…:0x…`), **not** a `ChIJ…` place id [V: `docs/architecture.md:126-132`] |
| **Use when** | Establishing identity; harvesting listing content at €0 |
| **Do NOT use when** | You want reviews or the full photo set. **Do not retry this. It has been proven twice.** |

### 5.3 Google Places API (New) — **OPTIONAL (paid; needs founder exception)**

| Field | Value |
|---|---|
| **Capability** | Customer reviews, review count, aggregate rating, structured weekly hours, accessibility booleans, full photo set, editorial summary |
| **Role** | The **only** source of testimonials and of the review count `schema.org/aggregateRating` requires |
| **API** | Places API (New) REST; key via `PLACES_API_KEY`; `ftid → ChIJ…` exchange implemented [V: `lib/sources/placesApi.ts:389,446`] |
| **Cost** | ≈ **1 cent per business** — reviews and rating fall in the Enterprise + Atmosphere tier [D: `.env.example:150-152`]. **Non-zero, therefore a founder exception under the €0 policy.** |
| **Alternative** | None at parity. Third-party review aggregators are licence-risky and lower fidelity. |
| **Fallback** | Absent key → source skipped, pipeline behaves exactly as before it existed. A key scoped to the wrong API returns 401 → logged, degrades to an empty harvest; **a run never fails on it** [V: `.env.example:145-148`] |
| **Latency** | 15,000 ms **(cfg** `PLACES_TIMEOUT_MS`**)** — deliberately short: "a slow answer is worth less than a fast empty one" [V: `lib/config.ts:283-286`] |
| **Limitations** | Licence terms constrain storage and display of reviews **[?]** — unresolved and **must be settled before any commercial run**. Requires billing on the Google Cloud project. |
| **Use when** | The business has reviews worth showing and a paying customer is on the other end |
| **Do NOT use when** | Running the €0 baseline, benchmarks, or regression runs. **Never put the key in a photo URL** — the media endpoint takes it as a query parameter, so the source resolves each photo to its plain `googleusercontent` URL first, because an artifact directory is committed and a live key would outlive the run [V: `docs/architecture.md:120-125`] |

### 5.4 Instagram public profile — **OPTIONAL**

| Field | Value |
|---|---|
| **Capability** | Bio, external link, post images from a public profile |
| **Role** | Supplementary evidence for businesses whose only web presence is social |
| **API** | None — Playwright scrape [V: `lib/sources/instagramProfile.ts:189`] |
| **Cost** | €0 |
| **Alternative** | Instagram Graph API (needs app review + business account linkage); Bright Data social feeds (paid) |
| **Fallback** | Returns an empty `ListingHarvest`; blocked source recorded in provenance [V: `toListingHarvest`, `BlockedSource`] |
| **Latency** | Within the browser budget **[?]** |
| **Limitations** | Aggressive anti-bot; login walls appear without warning. Images are tagged **`reference-only(rights?)`** by the host heuristic [V: `agents/designDirectorAgent.ts:345,371-374`] |
| **Use when** | The listing has an Instagram URL and no website |
| **Do NOT use when** | Rights-clean imagery is required for a paying deliverable — flag for replacement instead |

### 5.5–5.8 LLM providers — **KEEP (all four)**

One adapter contract, four vendors, selected by `AI_PROVIDER` [V: `lib/ai/factory.ts`,
`lib/ai/providers/`]. Common properties: constructed lazily and cached per run; wrapped in
exponential backoff with **full jitter** (`AI_MAX_RETRIES=3`, base 1,000 ms) because "a spike is
shared by every caller, so retrying on a fixed schedule reconverges the herd onto the same
instant" [V: `lib/ai/factory.ts:126-155`]; a cancelled run is never resurrected by a retry.

| | Anthropic | OpenAI | Gemini | OpenRouter |
|---|---|---|---|---|
| **Key var** | `ANTHROPIC_API_KEY` | `OPENAI_API_KEY` | `GEMINI_API_KEY` | `OPENROUTER_API_KEY` |
| **Default model (config)** | `claude-opus-5` | `gpt-5` | `gemini-3.6-flash` | `openai/gpt-5` |
| **Default model (adapter)** | `claude-opus-5` | `gpt-5` | **`gemini-2.5-pro`** ⚠ | `openai/gpt-5` |
| **Native JSON schema** | **yes** | **yes** | **yes** | **no** |
| **Effort mapping** | verbatim `output_config.effort` | `reasoning_effort`, `xhigh`/`max`→`high` | `thinkingConfig.thinkingBudget` | `reasoning.effort` |
| **Cost** | paid | paid | **free tier available** | paid, pass-through |
| **Disposition** | KEEP (quality ceiling) | KEEP | **KEEP — the €0 default** | KEEP (breadth/failover) |

⚠ **Discrepancy [V]:** `lib/config.ts:331` declares the Gemini default `gemini-3.6-flash` with a
comment that the 2.5 family "is no longer served to accounts created after mid-2026", while
`lib/ai/providers/gemini.ts:178` still declares `defaultModel: 'gemini-2.5-pro'`. Stage models
resolve through `config`, so runs are unaffected; the **status board and health probe report the
stale id**. Record as a defect; do not fix in this read-only pass.

**Per-vendor notes:**
- **Anthropic** — treats `max_tokens` truncation as a *failed run*, not a short answer
  [V: `anthropic.ts:152`]. This is correct and is why the writer's budget is 24,000 tokens.
- **Gemini** — **counts thinking against `maxOutputTokens`**, so a budget at or below
  `toGeminiThinkingBudget(effort)` (4,096 at `medium`, 24,576 at `xhigh`) spends the whole
  allowance thinking and returns `MAX_TOKENS` with **no JSON at all** [V: `lib/config.ts:180-186`].
  This is the single most expensive footgun in the model layer.
- **OpenRouter** — `supportsNativeSchema: false`, so schema conformance is enforced by
  `decodeAndValidate` after the fact [V: `openrouter.ts:82`]. Use only for failover or breadth.
- **Base-URL override** exists per provider — the seam for Azure, a local Ollama, or a gateway,
  with **no adapter change** [V: `lib/config.ts:63-68`].

**When NOT to use any of them:** for anything the deterministic layer already decides (design,
layout, colour, order, hours, contact, JSON-LD, testimonials). Every one of those is a
regression, not a feature.

### 5.9 Vision endpoint (OpenAI-compatible chat/completions with images) — **MODIFY**

| Field | Value |
|---|---|
| **Capability** | Judge rendered screenshots: 13-axis critique + generic/distinct verdict; and separately, defect detection with targeted CSS patches |
| **Role** | The **only** place a model looks at pixels [V: `lib/qa/visual-critic.ts`, `lib/qa/visual-qa.ts`] |
| **API** | `POST {baseUrl}/chat/completions`, `response_format:{type:'json_object'}`, images as `data:image/png;base64` with `detail:'high'` [V: `visual-critic.ts:176-187`] |
| **Config** | `VISION_API_KEY`, `VISION_BASE_URL`, `VISION_MODEL` — **three separate variables from the main provider config**, read via `process.env` in scripts [V: `scripts/n8n/stage.ts:159-166`, `scripts/run-job.ts:25-27`]; `scripts/visual-qa.ts` instead reads `OPENAI_API_KEY` + `VISION_BASE_URL` + `VISION_MODEL` defaulting to `gpt-4o` [V:238-240] |
| **Cost** | paid per image; two images (desktop+mobile) at `detail:'high'` per iteration, ×`maxIter` |
| **Alternative** | Any OpenAI-compatible vision endpoint; a local VLM via `VISION_BASE_URL`; the deterministic `creative-review.ts` structural proxy at €0 |
| **Fallback** | **Degrades to `genericVerdict:'uncertain'` with empty axes — treated by the gate as "cannot vouch for this", never as a pass** [V: `visual-critic.ts:214-244`]. A vision outage never stalls the loop. |
| **Latency** | 60,000 ms **(cfg** `runJob`**)** / 90,000 ms **(cfg** n8n stage**)** |
| **Limitations** | **This is the weakest link in the current quality story.** Research in the repo establishes: LLM-as-judge carries position/verbosity/self-enhancement bias and needs pairwise calibration; VLMs have clear ceilings on layout reasoning; a judge must never be the sole gate [V: `design_evaluation_research.json`, topic (d)]. Today it is a **single uncalibrated call**. |
| **Use when** | Judging distinctness and craft on a rendered page |
| **Do NOT use when** | Deciding a business fact; producing CSS from scratch; as the only judge (see Visual Jury, §15) |
| **Two variables problem** | The critic bypasses `lib/config.ts` — the module explicitly documented as *the only one permitted to read `process.env`* [V: `lib/config.ts:2-5`]. **This is an architectural violation to fix in 2.0**: vision belongs in `AppConfig` as a stage config beside `analyst`/`writer`/`director`. |

### 5.10 n8n — **KEEP (as sequencer only)**

| Field | Value |
|---|---|
| **Capability** | Visual workflow orchestration: triggers, HTTP calls, IF branching, execution history |
| **Role** | Sequences the production loop and closes the reconcept branch. **Owns no behaviour** — every stage is a call into the TypeScript orchestrator [V: `n8n/README.md:4-6`] |
| **API** | Docker container on `:5678`; REST `/api/v1/workflows/<id>/activate` with `X-N8N-API-KEY`; webhook `GET /webhook/bf-loop?runId=&maxIter=` [V: `n8n/README.md:66-75`] |
| **Cost** | €0 self-hosted |
| **Alternative** | Temporal, Prefect, GitHub Actions, or plain `scripts/run-job.ts` |
| **Fallback** | **`scripts/run-job.ts` runs the identical loop in-process** [V: `n8n/README.md:5`]. This is the correct design: n8n is never a single point of failure. |
| **Latency** | Adds one HTTP round trip per stage over `host.docker.internal` **[?]** |
| **Limitations** | (1) n8n 2.x **excludes `executeCommand` as a security default**, so a shell-based workflow cannot even be activated; clearing `NODES_EXCLUDE` would hand *every* workflow on the instance a shell, so the repo does not do it [V: `n8n/README.md:19-32`]. (2) **Node `typeVersion` is a silent failure surface** — `assignments` is hidden on Set v3/3.1/3.2, so a stale pin passes input straight through, which is how an empty `runId` reached the stage server [V: `n8n/README.md:92-104`]. Pinned: Set `3.5`, If `2.3`, HTTP Request `4.5`, Webhook `2.1`. |
| **Use when** | A human wants to watch the loop, retry a stage, or wire an approval step |
| **Do NOT use when** | Implementing logic. **Any behaviour that lands in an n8n node instead of TypeScript is a regression** — it is untestable, unversioned in the repo's own history, and invisible to `npm test`. |

### 5.11 Stage server (`:7717`) — **KEEP with hardening**

Host-side HTTP bridge; the only thing n8n can reach. Security posture [V:
`scripts/n8n/stage-server.ts`]:

- Binds `0.0.0.0` **necessarily** — `host.docker.internal` never resolves to a loopback socket.
  That puts the port on the LAN, so **every request must carry `x-bf-token`** (from
  `BF_STAGE_TOKEN`, else generated once into the gitignored `n8n/.stage-token`) [V:54-46,83].
- `runId` is validated against `/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/` and **rejected rather than
  sanitised**, because it is joined onto the output directory [V:54].
- `maxIter` bounded to 1..20 [V:107].
- All stage calls **serialised through one promise chain**, because stages mutate one shared
  `job.json` and a stray retry must not interleave writes [V:61-66].
- Only the seven known stage names are dispatchable [V:88-100].

**Residual risks for 2.0:** `/health` is unauthenticated and enumerates stage names; the token is
compared with `!==` (not constant-time); there is no rate limit; there is no TLS. Acceptable on
a trusted LAN, **not acceptable if the host is ever on an untrusted network**.

### 5.12 Lovable (deploy) — **REJECT as currently specified**

| Field | Value |
|---|---|
| **Capability** | Build and host a website from a prompt |
| **Role** | Stage 6 target |
| **API** | `LOVABLE_API_KEY`, `LOVABLE_BASE_URL=https://api.lovable.dev`, `LOVABLE_DEPLOY_TIMEOUT_MS=300000` [V: `lib/config.ts:192-199`] |
| **Cost** | paid subscription |
| **Status** | **`lovableAgent.run()` throws `NotImplementedError`** [V: `agents/lovableAgent.ts:23-34`] |
| **Fallback** | Absent key → deploy stage returns `status:'skipped'` and the rendered site *is* the output [V: `main.ts:480-495`] |
| **Why REJECT** | The renderer already emits complete, self-contained static HTML+CSS with vendored fonts and no external scripts. Handing that to a **prompt-driven site builder** re-introduces every property this architecture spent 31,000 lines eliminating: non-determinism, model-authored markup, and an unverifiable relationship between the approved design and what ships. |
| **Replace with** | Static hosting: Cloudflare Pages / Netlify / S3+CloudFront / plain rsync. `git push` to a Pages branch is €0 and byte-exact. **Keep the `deployment` skill id and the `DeploymentResult` contract; change the target.** |

### 5.13 MCP servers — **OPTIONAL**

| Field | Value |
|---|---|
| **Capability** | Any tool a Model Context Protocol server exposes |
| **Role** | The extension seam for third-party capability without touching an agent |
| **API** | HTTP transport implemented (JSON-RPC `initialize` → `tools/list` → `tools/call`, session id echoed) [V: `httpConnector.ts:114,169-220`]; stdio **declared, not implemented** [V: `stdioConnector.ts:70`] |
| **Config** | `MCP_SERVERS` JSON array; a malformed entry **fails startup** rather than being skipped, because "no MCP server is registered as …" is a far worse error to debug [V: `lib/config.ts:449-455`] |
| **Cost** | depends on the server |
| **Fallback** | `mcp.get(id)` returns a handle for **any** id; unavailable ones return the reason as data [V: `docs/architecture.md:155-178`] |
| **Latency** | 60,000 ms **(cfg** `MCP_REQUEST_TIMEOUT_MS`**)** |
| **Limitations** | Headers are sent **verbatim — nothing expands `${VAR}`**, so a literal token ends up in the environment string [V: `.env.example:120-123`]. Never run against a live server in this repo's history [D: `docs/architecture.md:193-206`] |
| **Use when** | A capability genuinely lives outside the repo (a CMS, a CRM, a ticketing system) |
| **Do NOT use when** | The capability is a pure function of data already on disk |

### 5.14 The 38 skill placeholders — **KEEP the contract, BUILD five**

All 38 are honest placeholders. Five are on the 2.0 critical path and should be implemented in
this order:

| Skill id | Why 2.0 needs it | Backing tool | Cost |
|---|---|---|---|
| `embeddings` | Design Fingerprint vectors (§12) | local sentence/CLIP model, or a hosted embeddings API | €0 local / low hosted |
| `vector-store` | Design Memory index (§11) | SQLite + `sqlite-vec`, or a flat JSONL + brute force at this scale | €0 |
| `accessibility-testing` | A11y gate (§17.2) | `axe-core` injected via Playwright | €0 |
| `performance-testing` | Performance gate (§17.3) | Lighthouse / CDP traces via the existing Chromium | €0 |
| `security-scanning` | Security gate (§17.4) | the checks already written in `publish-run.ts:290-299` | €0 |

The remaining 33 stay placeholders. **Do not implement a skill because it is listed.** The
honesty rule means an unimplemented skill costs nothing and lies about nothing.

### 5.15 Tools explicitly NOT to adopt — **REJECT**

| Tool | Why not |
|---|---|
| **Google Fonts / any CDN font** | Faces are **vendored locally and inlined** [V: `lib/render/fontManifest.ts`, `fonts.ts`]. A network font is a third-party request, a privacy leak, a CLS risk, and a `security.no-external-scripts` failure. |
| **Any third-party analytics/tag manager** | `security.no-external-scripts` is a shipped gate [V: `publish-run.ts:298`]. Breaking it to add tracking is a deliberate downgrade. |
| **A CSS framework (Tailwind/Bootstrap)** | 3,692 lines of `variants.ts` exist precisely so the design system owns every value. A utility framework re-introduces the "template with the name swapped in" failure the distinctness gate exists to catch. |
| **A second WebGL host before a business earns one** | Anti-pattern #7 of the prior plan; `lib/experience/` is the one reference host. |
| **An AI code generator in the render path** | Violates the single invariant (§1.3). |
| **Paid scraping infrastructure (Bright Data et al.)** | Only if a specific target proves unscrapeable *and* a founder exception is granted. Not needed for Maps/Instagram today. |

---

## 6. Capability matrix

Legend: ✅ present · 🟡 partial · ❌ absent · — not applicable.
Columns: **Contract** (a type models it) · **AI** (a director may nominate it) · **Static** (the
Tier-1 renderer executes it) · **Runtime** (Tier-2 `scroll-progress`) · **Host** (Tier-3 Bakery) ·
**QA** (a gate checks it).

| Capability | Contract | AI | Static | Runtime | Host | QA | Disposition |
|---|---|---|---|---|---|---|---|
| Experience mode (brochure/showcase/narrative/immersive) | ✅ `ExperienceArchitecture.mode` | ✅ capped at `narrative` | ✅ | — | — | ✅ `scoreExperience` | KEEP |
| Narrative arc / order | ✅ `ExperienceScript.beats` | ❌ derived | ✅ `data-role` + order | — | — | ✅ `narrativeCoherence` | KEEP |
| Pacing | ✅ `pacing` | ❌ | 🟡 density only | 🟡 possible | ✅ | ❌ | MODIFY |
| **Transition** (none/veil/wipe/circular-handoff) | ✅ **now an enum** | 🟡 boolean intent | 🟡 one CSS wash | 🟡 | ✅ | ❌ | MODIFY — wire `wipe`/`circular-handoff` to CSS |
| World journey (ground sequence) | ✅ `assignJourney` | ❌ | ✅ | ✅ continuous blend | — | ✅ contrast/ground | KEEP |
| Signature moment | ✅ `signatureMoment` + `Beat.isSignature` | ✅ | ✅ `section--moment` | — | — | ✅ | KEEP |
| Density | ✅ `VisualDensity` | ❌ narrowed by pacing | ✅ tokens | — | — | ✅ | KEEP |
| CTA behaviour | ✅ `ConversionStrategy` | ✅ | ✅ | — | — | ✅ functional | KEEP |
| Image choreography | ✅ `AssetChoreography` | ❌ derived | 🟡 hero/signature/reduce | — | ✅ | 🟡 rights flag | MODIFY (Asset Director) |
| Typography behaviour | 🟡 `FontRole` + scale | ❌ | 🟡 display/hero variant | — | ✅ | ✅ contrast | MODIFY |
| Interaction level | ✅ `level` + `ceiling` | ✅ capped | 🟡 to `guided` | ✅ | ✅ | 🟡 reduced-motion | KEEP |
| Composition (variant × frame) | ✅ 16×7×5 | ❌ | ✅ | — | ✅ | ✅ `renderer-coverage` | KEEP |
| **Scroll progress `--forge-scroll`/`--forge-vis`** | ✅ | 🟡 via `runtime` | ❌ by design | ✅ **built** | ✅ | ❌ | KEEP; **BUILD** its QA |
| Pinned cinematic hero | ✅ | 🟡 | ❌ | ✅ guarded | ✅ | ❌ | KEEP; BUILD QA |
| Specialized host registry | ❌ | selects class only | — | — | ✅ one host | 🟡 bakery-only | BUILD (or defer) |
| Content by narrative role | ✅ | ❌ deterministic | ✅ | — | — | ✅ `auditContent` | KEEP |
| Language of evidence (en/ro) | ✅ | ❌ | ✅ `<html lang>` | — | — | ✅ | KEEP |
| **Design Battle** | ❌ | — | — | — | — | — | **BUILD** |
| **Design Memory** | 🟡 `peers.json` | — | — | — | — | 🟡 `genericityReport` | **BUILD** |
| **Design Fingerprint** | 🟡 9 genericity axes | — | — | — | — | 🟡 collapse test only | **BUILD** |
| **Visual Jury** | ❌ single critic | — | — | — | — | 🟡 | **BUILD** |
| **Adversarial Critic** | ❌ | — | — | — | — | ❌ | **BUILD** |
| **Functional QA** | 🟡 in `publish-run.ts` | — | — | — | — | 🟡 script only | **MODIFY → gate** |
| **A11y QA** | 🟡 landmarks/alt/lang | — | — | — | — | 🟡 script only | **MODIFY + axe-core** |
| **Performance QA** | 🟡 loadMs/DOM nodes | — | — | — | — | 🟡 script only | **BUILD budgets** |
| **Security QA** | ✅ 5 checks | — | — | — | — | 🟡 script only | **MODIFY → gate** |
| **Cost ledger** | ❌ | — | — | — | — | ❌ | **BUILD** |
| **Model router** | 🟡 per-stage env | — | — | — | — | ❌ | **BUILD** |

---

## 7. Model routing

### 7.1 What exists [V: `lib/config.ts:140-190`, `.env.example:63-105`]

Routing today is **per-stage static configuration**: each model-using stage carries its own
`model`, `effort`, `maxOutputTokens`, `maxPageChars`, defaulting to the selected provider's
default model.

| Stage | Env prefix | Default effort | Default max output | Page chars | Enabled by default |
|---|---|---|---|---|---|
| Analyst (4) | `ANALYST_*` | `high` | 32,000 | 4,000 | **yes** |
| Writer (5) | `WRITER_*` | `high` | 24,000 | 6,000 | **yes** |
| Design Director (5a) | `DIRECTOR_*` | `medium` | 12,000 | 2,000 | **no** (`DIRECTOR_ENABLED=false`) |
| Visual Critic | `VISION_*` | — | 2,048 | — | **no** (absent key ⇒ `uncertain`) |
| Visual QA | `VISION_*`/`OPENAI_API_KEY` | — | — | — | script-invoked only |

Effort is a **provider-neutral five-level scale** (`low`…`max`) that each adapter maps onto its
own vocabulary [V: `lib/config.ts:42-49`]. That is the right abstraction and 2.0 keeps it.

### 7.2 What 2.0 needs — **BUILD: `lib/ai/router.ts`**

The cabinet turns 2 model calls into up to 5 director calls + N battle candidates + a jury.
Static per-stage env vars cannot express that. The router is a **deterministic policy function**,
not a model:

```
route(task, context) → { provider, model, effort, maxTokens, timeoutMs, budgetClass }
```

**Routing policy (proposed, all deterministic):**

| Task class | Wants | Route to | Rationale |
|---|---|---|---|
| Analyst | reasoning over messy evidence | mid-tier reasoning model, `effort:high` | one call, sets everything downstream |
| Writer | long-form prose in the evidence's language | **highest-quality available**, `effort:high` | the only prose on the page; a bad writer is visible to the customer |
| Creative Director | conceptual leaps | highest-quality, `effort:high`, **temperature diversity across battle candidates** | this is where distinctness is born |
| Art/UX/Motion/Asset Directors | closed-set selection with a rationale | **cheap fast model**, `effort:medium` | picking from 4–11 enum values does not need a frontier model |
| Visual Jury | vision + calibrated comparison | vision model, **pairwise**, ≥2 distinct judges | research: single uncalibrated judge is biased |
| Adversarial Critic | find the strongest objection | **a different vendor from the Creative Director** | a model is a poor critic of its own output (self-enhancement bias) |
| Technical Architect | feasibility | **no model** | deterministic capability lookup |

**Hard rules the router must enforce:**
1. **Never route the same job's Creative Director and Adversarial Critic to the same model.**
   Cross-vendor is preferred; same-vendor different-model is the minimum.
2. **Degrade, never fail.** No credential for the preferred model ⇒ fall back down the ladder
   ⇒ ultimately to the deterministic floor. A job must always produce a site.
3. **The router is the only place a model id appears.** No agent names a vendor — today's rule
   [V: `docs/architecture.md:34-47`] extended to the cabinet.
4. Every route decision is written to provenance with the reason, so "why did this job cost
   €0.42" is answerable from artifacts.

### 7.3 Provenance already carries what the router needs [V: `agents/designDirectorAgent.ts:560-574`]

`DirectorProvenance` records provider, **the model that actually served the request** (which may
differ from the ask), requested model, input/output tokens, structured-output mode, finish
reason, the provider's own request id, and duration. **Every 2.0 agent emits this same shape.**
It is already sufficient for a cost ledger — nothing new needs inventing, only aggregating.

---

## 8. Asset routing

### 8.1 The pipeline that exists [V]

```
collectorAgent          download, bound by maxImages(40) / min 1KB / max 8MB
   ↓
lib/art/decode.ts       decode to pixels (isDecodable, decodeImages)
   ↓
lib/art/palette.ts      quantize → Swatch[] → seedFrom() → brand hex
lib/art/seed.ts         brandSeedFor(profile, outputDir) — cached beside artifacts
   ↓
lib/art/direction.ts    servedWidth · dropUndersized · photoIdentity · dedupeByIdentity
                        subjectOf → 'merchandise'|'venue'|'people'|'scene'
                        chooseForSection · curateGallery (GALLERY_BUDGET = 6) · arrangeSequence
   ↓
lib/design/assets.ts    choreographAssets → AssetPlacement[] with role, framing, rights
   ↓
lib/render/assets.ts    safeImageUrl allow-list → AssetPlan → copied into site/assets/
```

**Three properties worth preserving:**

1. **Rights are tracked, not assumed.** `AssetRights = 'usable'|'reference-only'|'unknown'`
   [V: `lib/design/assets.ts:43`]; the host heuristic marks Facebook/Instagram/Google-hosted
   images `reference-only(rights?)` and the director's brief says so explicitly [V:
   `agents/designDirectorAgent.ts:345,387`].
2. **Colour comes from the photographs, not from the industry.** `brandSeedFor` quantizes the
   business's own images into a seed hex; a business with no photographs falls back to the
   industry colour [V: `main.ts:806-812`].
3. **Subject classification is deterministic** — dimensions, orientation, filename/alt signals —
   with **no vision model required**, and the contract is shaped so a vision-derived
   `visual category / atmosphere / brightness / quality` can be appended later **without changing
   the Director's schema** [V: `agents/designDirectorAgent.ts:349-354`].

### 8.2 Font routing [V]

`VENDORED_FACES` → `fontAssets()` → `@font-face` rules pointing at files copied into
`site/assets/`. **No network font request, ever.** A design that names an unavailable face falls
back through `FALLBACK_STACKS` (serif/sans/mono).

**[?] Unresolved:** whether the vendored font binaries physically exist on disk for every face a
design can name. The prior plan flagged this too and it remains unconfirmed. **Verify before any
commercial run** — a missing binary degrades silently to a fallback stack, which is exactly the
"nine typefaces render as two" failure the design-intelligence review once found.

### 8.3 What 2.0 adds

| Addition | Why | Disposition |
|---|---|---|
| **Asset Director** (§4.2) nominates hero/signature by *index*, never by URL | a model naming a URL could invent one; an index cannot escape the profile | **BUILD** |
| Vision-derived asset attributes appended to `subjectOf` | quality/atmosphere/brightness improve choreography; the contract already anticipates it | **OPTIONAL** |
| **Rights gate**: a `reference-only` image may not be the hero of a *paying* deliverable | today it is only flagged | **BUILD** |
| Generated imagery (`image-generation` skill) | fills gaps for businesses with no photographs | **REJECT for now** — an invented photograph of a real business is the image equivalent of a fabricated testimonial. Only ever as an obvious abstract/texture, never as depiction. |

---

## 9. Design Battle — **BUILD**

### 9.1 The problem it solves

Today: **one** candidate, judged against a threshold; on failure, the directive is *rotated*
by array index and the same page is rebuilt [V: `lib/workflow/runJob.ts:268-296`]. Rotation is
change without judgement — iteration 2 is not chosen because it is better, only because it is
next.

Research in the repo says the fix directly: novelty is a **point metric** (distance to a
reference set) and diversity is a **set metric** (dispersion across a batch); generators
collapse toward low diversity without explicit pressure; judges must be **pairwise-calibrated**
[V: `design_evaluation_research.json`, topics (c) and (d)].

### 9.2 The mechanism

```
                    ┌── Creative Director ×N (N=3 default, distinct concepts) ──┐
Business Character ─┤   each → full deterministic build → screenshots           │
                    └───────────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────▼───────────────────────────┐
                    │ ROUND 1 — deterministic elimination (€0, no model)  │
                    │  scoreExperience ≥ 70 · narrativeCoherence.ok       │
                    │  fingerprint distance vs Design Memory ≥ threshold  │
                    │  intra-batch diversity: ≥2 identity axes differ     │
                    └─────────────────────────┬───────────────────────────┘
                                              │ survivors (0..N)
                    ┌─────────────────────────▼───────────────────────────┐
                    │ ROUND 2 — Visual Jury, PAIRWISE (paid, bounded)     │
                    │  each pair judged twice with positions swapped      │
                    │  ≥2 judges from different vendors                   │
                    └─────────────────────────┬───────────────────────────┘
                                              │ winner
                    ┌─────────────────────────▼───────────────────────────┐
                    │ ROUND 3 — Adversarial Critic on the winner only     │
                    │  strongest objection → one targeted revision        │
                    └─────────────────────────┬───────────────────────────┘
                                              ▼
                                    QA quartet → deliver
```

### 9.3 Rules

1. **Round 1 is free and eliminates first.** Never spend a vision call on a candidate the
   deterministic gates already reject. This alone bounds battle cost to *survivors*, not N.
2. **Zero survivors ⇒ escalate, do not lower the threshold.** A gate that relaxes under pressure
   is decoration.
3. **Position bias is neutralised structurally** — every pair judged in both orders; a judge that
   flips its answer under swap contributes a tie, not a winner.
4. **N is budget-derived, not fixed.** `N = min(3, remaining_budget / cost_per_candidate)`.
   `N=1` is a legal degradation and reduces to today's behaviour.
5. **Losers are not discarded** — every candidate's fingerprint enters Design Memory. Knowing
   what we *rejected* is as valuable as knowing what we shipped.
6. **The winner's provenance records why it won**, including the losing candidates' scores.

### 9.4 What already exists to build on

`perturbedDirective` [V: `runJob.ts:268`] is a working deterministic **candidate generator** —
it becomes the €0 battle mode when no model budget exists. `gateJob` is Round 1. `runVisualCritic`
is one judge. The loop, the job state, and the artifact discipline are all in place. **Design
Battle is a re-composition of existing parts plus a pairwise judging harness — not a new
subsystem.**

---

## 10. Design Memory — **BUILD**

### 10.1 What exists [V]

- `loadPeerDesigns(outputDir)` reads an optional `peers.json` of `{name, designPath}` and hands
  the designs to the gate [V: `runJob.ts:108-123`].
- `genericityReport(entries)` measures collapse across a **set** of designs [V:
  `lib/design/quality.ts:226`].
- The n8n path loads peers too, with an explicit comment that **without them the gate silently
  degrades to a single-site check and a cloned design passes** [V: `scripts/n8n/stage.ts:199-203`].

So the platform can already answer *"are these N designs different from each other?"* — but only
for a hand-curated `peers.json`, only for designs someone remembered to list, and only within one
run directory.

### 10.2 What 2.0 needs

**Design Memory is the persistent, automatic, cross-run version of `peers.json`.**

| Property | Specification |
|---|---|
| **Storage** | `memory/designs.jsonl` (append-only) + an index. At current scale a flat file with brute-force comparison is correct; `vector-store` skill only when the corpus outgrows it. |
| **One record** | `{ fingerprint, businessId, industry, character, verdict, shippedAt, runId, designPath, criticScores, battleRank }` |
| **Write policy** | **Every** candidate — shipped, rejected, and escalated. Append-only; never rewritten. |
| **Read policy** | On every battle Round 1, and on every gate evaluation. |
| **Retention** | Unbounded. The whole point is long memory. Fingerprints are small. |
| **Privacy** | Fingerprints and design decisions only — **never customer content, never contact data, never photographs**. A design memory that accumulates business PII is a liability, not an asset. |
| **Scoping** | Novelty is measured **within industry** and **globally**. Two bakeries must differ from each other *and* from every previous bakery; a bakery need not differ from a law firm on colour. |

### 10.3 The three questions Design Memory answers

1. **"Have we built this before?"** — nearest-neighbour distance from the candidate fingerprint
   to the whole corpus. Below threshold ⇒ reject as self-plagiarism.
2. **"Are we collapsing?"** — rolling distinct-k over the last 20 shipped designs. A falling
   distinct-k is the early warning that the deterministic layer has a bias, and it is measurable
   *before* a customer notices.
3. **"What did we learn?"** — which characters produce which verdicts. This is the dataset that
   eventually calibrates the jury against human judgement, which the research names as the
   necessary step to trust a model judge [V: `design_evaluation_research.json`, topic (d)].

### 10.4 What Design Memory must NOT become — **REJECT**

- **Not a template library.** Retrieving a past design to reuse it is exactly the failure mode
  the whole architecture exists to prevent. Memory is a **repulsor**, never an attractor.
- **Not training data for a model that generates designs.** The invariant (§1.3) holds.
- **Not a cache.** A returning business gets a fresh derivation from fresh evidence.

---

## 11. Design Fingerprint — **BUILD**

### 11.1 The seed that exists [V: `lib/design/quality.ts:204-253`]

`genericityReport` already extracts **nine structural axes** from a `WebsiteDesign`:

| # | Axis | Extraction |
|---|---|---|
| 1 | `experienceMode` | `design.experience.mode` |
| 2 | `hero` | `design.layout.hero` |
| 3 | `galleryStructure` | `variant/emphasis/fullBleed` of the gallery section |
| 4 | `ctaPlacement` | `design.conversion.ctaPlacement` |
| 5 | `typography` | `heading.family/body.family` |
| 6 | `narrativeOrder` | section kinds joined by `>` in render order |
| 7 | `conversionMode` | `design.conversion.mode` |
| 8 | `interaction` | `design.interaction.level` |
| 9 | `world` | `design.world` |

Six are **identity-bearing** (1–6); **two or more collapsed identity axes ⇒ `template-smell`**.

This is a real fingerprint already — it is just used only as a boolean collapse test, and only
across a hand-supplied peer set.

### 11.2 The 2.0 fingerprint

**Structure: three layers, computed independently, never averaged into one opaque number.**

| Layer | Content | Computed from | Model? |
|---|---|---|---|
| **L1 — Structural** | the 9 axes above, plus `pacing`, `transition`, `signatureMoment`, `density`, beat-role sequence, section count, variant multiset | `WebsiteDesign` | no |
| **L2 — Perceptual** | dominant palette (OKLCH, ≤3 hues), type-scale ratio, whitespace ratio, image-area ratio, largest-element scale, vertical rhythm entropy | rendered CSS + a Playwright measurement pass | no |
| **L3 — Semantic** | an embedding of the creative thesis + narrative arc | `embeddings` skill | optional |

**Distance:**

```
d(A,B) = w1·hamming(L1_A, L1_B)/|L1|          // structural disagreement, 0..1
       + w2·euclidean(L2_A, L2_B)             // perceptual distance, normalised
       + w3·(1 - cosine(L3_A, L3_B))          // conceptual distance, when L3 exists
```

with `w1 = 0.5, w2 = 0.35, w3 = 0.15` as the starting point — **L1 dominant on purpose**,
because structural sameness is what makes a site read as a template, and because L1 costs €0 and
is fully deterministic. Weights are configuration, and the calibration set is the shipped corpus.

**Thresholds (initial, to be calibrated against the Design Memory corpus, not guessed forever):**

| Check | Rule |
|---|---|
| Self-plagiarism | `min d(candidate, memory) ≥ 0.35` |
| Same-industry distinctness | `min d(candidate, same-industry memory) ≥ 0.45` |
| Intra-battle diversity | `mean pairwise d ≥ 0.30` across candidates |
| Collapse alarm | rolling distinct-k over last 20 < 12 ⇒ alert (not a job failure) |

**Properties the fingerprint must have:**

1. **Deterministic and cheap at L1+L2.** A €0 run must still get a fingerprint.
2. **Explainable.** A rejection says *which axes* matched, never "distance 0.31". A gate whose
   verdict cannot be explained cannot be argued with, and will be disabled by the first person it
   inconveniences.
3. **Versioned.** `fingerprintVersion` on every record; changing the extraction invalidates
   comparisons, and a silent change would make old memory quietly wrong.
4. **Never a model's output.** L3 uses an embedding, not a judgement.

---

## 12. Creative Director — **BUILD (extract)**

**Question owned:** *What is this website, as an idea?*

**Inputs:** `BusinessCharacter`, evidence summary, image content signals, prior critique feedback
(on a reconcept), and — new in 2.0 — **the fingerprints of the N most similar designs in Design
Memory**, presented as *"these already exist; be different from them."*

**Output:** four free-text concept fields (≤1 sentence each: `creativeThesis`, `visualMetaphor`,
`emotionalJourney`, `whatToAvoid`) + three closed-set fields (`experienceMode`,
`signatureMoment`, `pacing`).

**Why extraction rather than a new agent:** the prompt already exists and is good [V:
`agents/designDirectorAgent.ts:327-334`]: *"Two businesses in the same industry must be allowed
to receive completely different creative concepts."* What it lacks is (a) a consumer for the free
text, (b) N candidates, and (c) memory of what has already been built.

**Constraints:** may not name a section kind absent from the brief; may not name a colour, font,
duration, or pixel value; on a reconcept must produce a **materially different** thesis — the
existing brief already instructs *"Do NOT merely change colours or fonts"* [V:
`designDirectorAgent.ts:496-500`].

**Failure mode to guard:** the concept fields are currently **written but largely unread** by the
deterministic layer. Extracting the Creative Director without giving the concept a consumer
(Design Battle scoring + Adversarial Critic) reproduces that. **Do not ship the extraction
without the battle.**

---

## 13. Art Director — **MODIFY**

**Question owned:** *What does it look like?* This is today's `designDirectorAgent`, narrowed to
its visual half.

**Output (all closed sets, all already validated) [V: `agents/designDirectorAgent.ts:100-179`]:**
`direction` (11 values), `density` (3), `colorStrategy` (3), `typographyIntent.preference` (2),
`imageryIntent.treatment` (5), `heroIntent.preference` (7), `accessibilityTarget` (2), plus one
sentence of intent per decision.

**Consumption rules that already work and must not change [V: `lib/design/directive.ts:376+`]:**
operator options always win; `colorStrategy: 'high-contrast'` forces AAA; `density` is
**advisory in V1** — the deterministic system still controls it from direction × industry ×
section count; an invalid value logs and falls back to inference.

**The one change:** `direction`, `density`, and `colorStrategy` are the *only* fields where a
model can meaningfully outperform the deterministic floor, and even there the floor is strong.
The Art Director should therefore be routed to a **cheap fast model** (§7.2) and should be the
**first** director dropped when budget is tight.

---

## 14. UX Director, Motion Director, Asset Director, Technical Architect — **BUILD**

### 14.1 UX Director

**Question:** *How does a visitor get what they came for?*
**Output:** `conversionStrategy` (direct/editorial/balanced/high-intent), `ctaPlacement`
(hero-and-close/persistent/close-led/sectioned), `contactProminence`
(immediate/prominent/standard/deferred), `informationDensity`, and a **new** `navigationMode`.
**Consumer:** `planConversion` [V: `lib/design/conversion.ts:94`] + `document.ts` nav.
**Hard invariant it may not violate [V: `docs/…master-plan.md` §10, `narrativeCoherence`]:**
persistent header nav is the **default**; a guided or immersive path may only **add** a skip
link, never remove nav. Conversion may never be moved off-page and a `contact` beat may never be
deleted. `narrativeCoherence` already fails "conversion before enough discovery for a
non-high-intent business" [V: `lib/design/quality.ts:151-157`].

### 14.2 Motion Director

**Question:** *What moves, and why?*
**Output:** `interactionStrategy` (static/subtle/guided/immersive), `transition`
(none/veil/wipe/circular-handoff), `runtimeTier` (none/scroll-progress/host).
**Consumer:** `planInteraction` [V: `lib/design/interaction.ts:63`], `RenderOptions.runtime`.
**Rules:** `immersive` is capped to `narrative`/`guided` unless a registered host exists [V:
`lib/design/experience.ts:163-169`]; **every motion decision is dominated by
`prefers-reduced-motion`**, already enforced in the runtime CSS [V: `runtime-rules.ts:34`];
motion without narrative purpose is an anti-pattern, not a feature.

### 14.3 Asset Director

**Question:** *Which photograph earns which position?*
**Output:** `heroAsset` / `signatureAsset` as **indices into the profile's asset list**,
`reduceImagery`, `rightsPosture`.
**Consumer:** `choreographAssets` [V: `lib/design/assets.ts:186`].
**Rule:** indices, never URLs — a model that cannot name a URL cannot invent an image. A
`reference-only` asset may not be nominated as hero for a paying deliverable.

### 14.4 Technical Architect — **deterministic, no model**

**Question:** *Can this be executed, and at what cost?*
**Input:** the union of every director's requested capabilities.
**Output:** `capabilityPlan[]` (only names that resolve to a registered implementation),
`rejectedCapabilities[]` **with a reason each**, `budgetEstimate`, `runtimeTier`.
**Why it must not be a model:** it is a lookup against a registry. A model here could "approve" a
capability that does not exist, and the failure would surface as a broken page rather than a
clear rejection. This agent is what makes the whole cabinet safe to expand: any director may ask
for anything, and exactly one deterministic component decides what is buildable.

---

## 15. Visual Jury and Adversarial Critic — **BUILD**

### 15.1 Visual Jury

**Replaces:** the single `analyzeCritique` call [V: `lib/qa/visual-critic.ts:160`].

**Keeps unchanged:** the 13 axes (`conceptClarity`, `distinctiveness`, `composition`,
`narrative`, `pacing`, `imagery`, `typography`, `interaction`, `transitions`, `conversion`,
`responsive`, `premiumQuality`, `businessSpecificity`) [V:31-45]; the strict closed schema with
`additionalProperties:false` and `required` on every field the loop reads, because "a critique
this module cannot trust is worse than no critique" [V:80-110]; the safe-default degradation to
`uncertain` [V:214-244].

**Changes:**

| Change | Reason (from the repo's own research) |
|---|---|
| **≥2 judges from different vendors** | MLLM-Bench / LLM-as-a-Judge: a single judge's biases are systematic, not noise |
| **Pairwise, not absolute, scoring** | absolute scores are uncalibrated across models and drift between versions |
| **Both orderings of every pair** | neutralises documented position bias |
| **Disagreement is an output, not an error** | the Appsthetics finding: aesthetics is a *distribution*; consensus is a signal about the design, not only about the judges |
| **A judge never sees another judge's answer** | prevents anchoring |
| **Jury verdict cannot override a deterministic gate failure** | the model is a screening critic, never the sole judge |

**Cost control:** the jury runs on **Round-1 survivors only**, and pairwise cost is
`C(k,2)×2×judges` — so `k` must be small (3 is the design point: 3 pairs × 2 orders × 2 judges =
12 vision calls worst case, and typically far fewer because Round 1 eliminates).

### 15.2 Adversarial Critic

**Distinct from the jury: the jury ranks; the critic attacks.**

**Prompt posture:** *"This design has been approved. Find the single strongest reason a demanding
client would reject it. Name the axis, cite what is visible, and propose the smallest change that
would fix it."*

**Rules:**
1. **Different vendor from whichever model produced the concept** — self-enhancement bias is
   documented and this is the cheapest structural defence.
2. **Exactly one objection**, ranked strongest-first. An unbounded critic produces a wish list,
   and a wish list is not actionable.
3. **The objection must map to a closed-set change** (a directive field, a capability, an asset
   index) — a critique that cannot be executed by the deterministic layer is discarded.
4. **One revision cycle only**, then deliver or escalate. This is the last stop before the QA
   quartet, not a second battle.
5. **The critic may never touch facts.** Same rule as every other model in the system.

---

## 16. QA — four disciplines, promoted from script to gate

The checks below **already exist and pass** inside `scripts/publish-run.ts` [V:254-302]. Their
problem is placement: a publish script runs after the decision, so a failing check informs a
human rather than blocking a delivery.

### 16.1 Functional QA — **MODIFY (script → gate)**

Verified checks in place [V]: `page.loads` (no uncaught errors), `page.no-console-errors`,
`page.no-failed-requests` (including any HTTP ≥ 400), per-viewport `heading` (exactly one `h1`,
non-empty), `primary-cta` (≥1 primary CTA **with a resolving target**), `navigation` (**a nav
link is actually clicked and the target verified in-viewport** — not merely present),
`links-resolve` (dead in-page anchors, correctly exempting `#` and `#top` per the HTML fragment
algorithm), `images-load` (`naturalWidth !== 0`), `no-horizontal-overflow` (≤1 px),
`content-rendered` (≥50 words), `screenshot` (>5 KB).

**The navigation check is the best test in the repository** — it proves behaviour by using it,
and it correctly avoids the skip link, which is positioned off-viewport until focused and would
otherwise hang Playwright until the run times out [V:168-174].

### 16.2 Accessibility QA — **MODIFY + BUILD**

Exists [V]: `a11y-landmarks` (`<main>` present, `lang` non-empty, skip link reported),
`a11y-image-alt` (zero images without `alt`), token-level WCAG contrast in the design layer
[V: `lib/design/color.ts:187-221`], `respectReducedMotion` in tokens and runtime CSS.

**Missing (BUILD):** axe-core injection for the full ruleset; keyboard traversal (an 8-stop tab
sweep with a visible focus ring at each stop); focus-order sanity; tap-target size at 390 px;
contrast measured **on the rendered page against the world's repainted ground**, not only in
tokens — the repo has already been bitten by exactly this (`--color-brand-text` measured 4.32:1
on a world-repainted ground) [D: `PROJECT_STATUS.md`].

### 16.3 Performance QA — **BUILD budgets**

Exists [V]: `loadMs`, `domNodes`, image count, stylesheet count.

**Missing (BUILD):** explicit budgets that **fail**, not merely report. Proposed, all measurable
with the Chromium already running: total page weight, largest image bytes, DOM node ceiling, LCP
proxy, CLS proxy, and — for a `scroll-progress` page — a frame-time sweep. The Bakery harness
already proves the technique (a 220-position sweep, 61 fps) [D:
`docs/canonical-bakery-v2.md`]; **porting that sweep to the product is gap G15 and is now
tractable because Tier 2 exists.**

### 16.4 Security QA — **MODIFY (script → gate)**

Exists and is genuinely strong for a static deliverable [V:290-299]:
`security.no-inline-handlers` (zero `on*` attributes), `security.no-javascript-urls`,
`security.no-mixed-content` (zero `http://` subresources), `security.external-links-noopener`,
`security.no-external-scripts` (zero third-party scripts). Also collected but not yet asserted:
`dataUrls`, `iframes`, `formsWithoutAction`.

**Add (BUILD):** assert the three collected-but-unchecked fields; a Content-Security-Policy meta
assertion; and a **secret sweep over the artifact directory** — the Places key incident
[V: `docs/architecture.md:120-125`] proves that a credential reaching a committed artifact is a
realistic failure, and a grep for key-shaped strings in `output/**` is cheap insurance.

### 16.5 The gate order (all four must pass before delivery)

```
deterministic gates (€0)  →  battle + jury (paid)  →  adversarial (paid)
                                                          │
                    ┌─────────────────────────────────────┘
                    ▼
  functional → accessibility → security → performance → DELIVER
      │              │             │            │
      └──────────────┴─────────────┴────────────┴──→ any failure ⇒ Hermes
```

Functional first because a broken page makes every other measurement meaningless. Performance
last because it is the only one where a *degraded* pass (over budget but working) is a legitimate
human decision.

---

## 17. Hermes — the decision node

### 17.1 What it is [V: `lib/workflow/hermes.ts:37-73`]

Hermes owns exactly one decision: **deliver, continue, or escalate.** It does not re-score and
does not invent a diagnosis — the gate has already computed both.

```
if gate.verdict === 'PASS'                    → deliver
if job.iteration >= job.maxIter               → escalate  ("hit max iterations")
if gate.route is 'escalate' or 'deliver'      → escalate  (a FAIL cannot route to deliver)
otherwise                                     → continue, iteration + 1, nextStage = gate.route
```

**The order of these checks is the whole design.** A passing gate delivers regardless of
iteration count; an exhausted budget escalates even when the gate would loop; only then does the
gate's own route decide which stage re-runs. This is correct and 2.0 keeps it verbatim.

### 17.2 The diagnosis → route table [V: `lib/qa/distinctness-gate.ts:107-124`]

| Diagnosis | Condition | Route |
|---|---|---|
| `D-weak-concept` | critic says generic **and** creative direction is weak (no rationale, or confidence < 0.5) | `creative` |
| `C-weak-experience` | narrative coherence fails, or the coherence axis < 1 | `experience` |
| `A-implementation` | `implementationStatus === 'failed'` | `builder` |
| `E-thin-evidence` | explainability axis < 0.5 | `escalate` |
| `B-missing-capability` | everything else | `director` |

`E-thin-evidence → escalate` is the most important row in the table: **when the evidence is too
thin, no amount of design iteration fixes it, so the system stops and asks a human rather than
burning budget.** That is a mature decision and it must survive 2.0.

### 17.3 What 2.0 changes

| Change | Reason | Disposition |
|---|---|---|
| Hermes reads a **cost ledger** and may escalate on budget exhaustion, not only iteration count | today a job can hit `maxIter` after spending far more than intended | **BUILD** |
| Hermes chooses **which director** re-runs, per diagnosis (concept → Creative; execution → Art/Motion) | today `creative` and `director` both re-run the one Design Director | **MODIFY** |
| Escalation writes a **human-readable brief**, not a `job.json` field | a human receiving an escalation needs the reasons, the screenshots, and the candidates | **BUILD** |
| Hermes may decide **"deliver with caveats"** | a page that passes functional/a11y/security but misses a performance budget is a business decision | **BUILD** |
| Hermes stays **deterministic** | a model deciding whether to spend more money on itself is a conflict of interest | **KEEP** |

---

## 18. The complete state machine

### 18.1 States [V: `lib/workflow/jobState.ts:22-45`]

`JobStage` (16): `created`, `research`, `evidence`, `character`, `creative`, `experience`,
`content`, `asset`, `design`, `build`, `browser`, `visual-critic`, `distinctness-gate`, `hermes`,
`delivery`, `human`.

`JobDecision` (4): `running`, `deliver`, `reconcept`, `escalate`.
`PhaseStatus` (5): `pending`, `built`, `shot`, `passed`, `failed`.

**Note [V]:** six of these stages (`research`, `evidence`, `character`, `creative`, `experience`,
`asset`) are **declared but never entered** by the current orchestrator, which starts at `build`
from an already-processed run. They are the reserved slots for exactly the 2.0 cabinet described
above — the state vocabulary was designed for it before the agents existed.

### 18.2 The 2.0 machine, complete

```
                                   ┌──────────┐
                                   │ created  │
                                   └────┬─────┘
                                        ▼
  ┌───────────────── EVIDENCE PHASE (deterministic, browser, €0) ─────────────────┐
  │  discovery ──► collect ──► normalize                                          │
  │   [browser]    [browser]   [pure]                                             │
  │      │             │           │                                              │
  │      └── fail ─────┴───────────┴──► escalate:no-business                      │
  └───────────────────────────────────┬───────────────────────────────────────────┘
                                      ▼  3-profile.json
  ┌───────────────── UNDERSTANDING PHASE (2 model calls) ─────────────────────────┐
  │  analyze ──► write ──► directContent ──► auditContent                         │
  │   [model]    [model]   [pure]            [pure gate]                          │
  │      │          │                             │                               │
  │      └─ upstream fail ─► retry×3 ─► compose-baseline (€0 floor, always works)  │
  └───────────────────────────────────┬───────────────────────────────────────────┘
                                      ▼  5-content.json
  ┌───────────────── CHARACTER PHASE (deterministic, €0) ─────────────────────────┐
  │  deriveCharacter ─► planExperience ─► planConversion ─► planInteraction        │
  │                  ─► planNarrativeOrder ─► buildScript ─► choreographAssets     │
  └───────────────────────────────────┬───────────────────────────────────────────┘
                                      ▼  NarrativePlan  (derived ONCE)
  ┌───────────────── DESIGN BATTLE (N candidates) ────────────────────────────────┐
  │  for i in 1..N:                                                               │
  │    Creative Director ─► Art ─► UX ─► Motion ─► Asset ─► Technical Architect    │
  │                                                        (deterministic veto)   │
  │    ─► composeDesign ─► renderSite ─► Browser: shoot(desktop, mobile)           │
  │                                                                               │
  │  ROUND 1 (€0): scoreExperience ≥70 · coherence.ok · fingerprint vs Memory      │
  │           ├── 0 survivors ──────────────────────────► escalate:no-candidate    │
  │           └── survivors ──► ROUND 2                                            │
  │  ROUND 2 (paid): Visual Jury, pairwise, both orders, ≥2 vendors ──► winner     │
  │  ROUND 3 (paid): Adversarial Critic ──► one targeted revision                  │
  └───────────────────────────────────┬───────────────────────────────────────────┘
                                      ▼  winner
  ┌───────────────── QA QUARTET (deterministic, browser, €0) ─────────────────────┐
  │  functional ─► accessibility ─► security ─► performance                       │
  └───────────────────────────────────┬───────────────────────────────────────────┘
                                      ▼
                            ┌─────────────────────┐
                            │  distinctness-gate  │  PASS/FAIL + diagnosis + route
                            └──────────┬──────────┘
                                       ▼
                            ┌─────────────────────┐
                            │       hermes        │
                            └──┬─────────┬────────┘
                  deliver ◄────┘         └────► continue ──┐
                     │                                     │  route ∈ {creative, experience,
                     ▼                                     │          builder, director}
              ┌────────────┐                               │
              │  delivery  │                               │  iteration < maxIter
              └────────────┘                               │  AND budget remaining
                     ▲                                     ▼
                     │                        ┌──────────────────────────┐
                     │                        │  reconcept: re-enter the │
                     │                        │  battle at the diagnosed │
                     │                        │  stage, feedback carried │
                     │                        └────────────┬─────────────┘
                     │                                     │
                     │        escalate ◄───────────────────┘ (maxIter | budget | E-thin-evidence)
                     │           │
                     │           ▼
                     │     ┌───────────┐
                     └─────│   human   │  brief + candidates + screenshots + reasons
                           └───────────┘
```

### 18.3 Transition invariants

1. **Every transition persists `job.json` atomically** (temp file + rename) before the next
   stage begins [V: `jobState.ts:159-174`]. A crash mid-write never leaves half a state.
2. **A corrupt `job.json` is a hard error, not a silent restart** [V: `jobState.ts:134-150`] —
   the orchestrator must know the run is unrecoverable rather than quietly starting over.
3. **`maxIter` must travel in the first `saveJob` patch**, because `saveJob` rebuilds a default
   job from the patch when none exists on disk — a locally-constructed job object is silently
   discarded and the loop runs past the caller's limit [V: `scripts/n8n/stage.ts:111-121`;
   documented as a real incident in `n8n/README.md:114`].
4. **Stages are serialised** — one shared `job.json` per run, one promise chain
   [V: `stage-server.ts:61-66`].
5. **No state may be entered twice without incrementing `iteration`.** This is what makes the
   machine provably terminating.

### 18.4 Termination proof

The machine terminates because: (a) `iteration` strictly increases on every `continue`
[V: `hermes.ts:70`]; (b) `iteration >= maxIter` forces `escalate` before the route is consulted
[V: `hermes.ts:49-56`]; (c) `maxIter` is bounded to 1..20 at the HTTP boundary
[V: `stage-server.ts:107`]; (d) a reconcept build failure returns immediately rather than
looping [V: `runJob.ts:453-463`]. **No path loops without incrementing.**

---

## 19. Cost control — **BUILD**

### 19.1 What exists

Cost discipline is **structural but implicit** [V]: the design layer, content layer, and
renderer make zero model calls; the Director is off by default; the vision critic degrades to
`uncertain` without a key; the Places source is switched by the presence of its key; `--compose`
produces a complete site with no provider at all. Per the standing policy [memory:
`businessforge-spend-governance`], **€0 is the baseline and any paid API needs a founder
exception raised as a proposed decision, never assumed.**

**What does not exist [X]:** any ledger, budget, or accounting. Nothing sums tokens across a run;
nothing stops a job from spending; nothing reports what a delivered site cost.

### 19.2 The 2.0 cost model

| Tier | Contents | Cost/site |
|---|---|---|
| **T0 — Free floor** | discovery, collect, normalize, `composeBaseline`, content director, design, render, all deterministic QA, `perturbedDirective` battle | **€0** |
| **T1 — Standard** | T0 + analyst + writer (2 model calls) | 2 calls |
| **T2 — Directed** | T1 + the director cabinet (up to 5 calls, 4 of them cheap-model) | 2 + 5 |
| **T3 — Battle** | T2 × N candidates + jury (pairwise, survivors only) + adversarial | scales with survivors |
| **T4 — Licensed evidence** | any tier + Places API (~€0.01/business) | + €0.01 |

### 19.3 Controls to build

1. **`lib/cost/ledger.ts`** — append token counts and provider request ids from the existing
   `DirectorProvenance` shape [V] into `job.json`. **The data already exists; only aggregation is
   missing.**
2. **Per-job budget** — `maxCostUnits` beside `maxIter`, checked by Hermes before every paid
   stage. Exceeded ⇒ escalate, never silently continue.
3. **Round 1 is free and eliminates first** (§9.3) — the single largest cost lever in the design.
4. **Cheap models for closed-set decisions** (§7.2) — picking from 11 enum values does not need a
   frontier model.
5. **Cache what is deterministic.** `brandSeedFor` already caches beside artifacts [V:
   `main.ts:806-812`]. Nothing deterministic should ever be recomputed at a price.
6. **`--compose` remains a first-class product path**, not a debug mode. "A business that has
   been collected always has a page" [V: `main.ts:774-776`] is a business guarantee, and it is
   free.
7. **Report cost per delivered site in the run summary.** An unmeasured cost becomes an
   unmanaged one.

### 19.4 The anti-goal — **REJECT**

Do not build a "cost optimizer" that swaps to a weaker model based on a quality prediction. The
router's fallback ladder is deterministic and legible (§7.2); an adaptive optimizer would make
output quality a function of load, which is unexplainable to a customer.

---

## 20. Security

### 20.1 Verified posture

| Surface | Control | Verified |
|---|---|---|
| Credentials | one module reads `process.env`; `platform.describe()` reports credential **names only, never values** | [V: `lib/config.ts:2-5,236-241`; `platform.ts:222-224`] |
| Credential detection | suffix pattern `_(API_KEY\|KEY\|TOKEN\|SECRET\|PASSWORD\|CREDENTIALS)$` plus `DATABASE_URL` | [V: `lib/config.ts:437`] |
| Keys in artifacts | Places photo URLs resolved to plain `googleusercontent` URLs **before persistence**, because artifacts are committed and a live key would outlive the run | [V: `docs/architecture.md:120-125`] |
| Path traversal | `runId` rejected (not sanitised) unless it matches a flat slug | [V: `stage-server.ts:54,102-105`] |
| Filename traversal | render filenames stripped of separators and leading dots | [V: `lib/render/types.ts` `safeName`] |
| HTML injection | `Html` is a **branded type**; element builders accept nothing else; text and attributes escaped at the boundary | [V: `lib/render/html.ts:17-26,50-64`] |
| URL injection | `safeHref`/`safeImageUrl` allow-lists | [V: `lib/render/assets.ts:50-55`] |
| Output security | 5 shipped checks: no inline handlers, no `javascript:` URLs, no mixed content, `rel=noopener`, **no third-party scripts** | [V: `publish-run.ts:290-299`] |
| n8n | `executeCommand` stays excluded; a narrow token-guarded endpoint that can run **only seven known stages** | [V: `n8n/README.md:19-32`, `stage-server.ts:88-100`] |
| Secrets in git | `n8n/.stage-token` gitignored | [V: `.gitignore` modified] |
| Concurrency | all stage calls serialised through one chain | [V: `stage-server.ts:61-66`] |

**This is a better security posture than most production web codebases.** The branded-`Html`
type and the "no third-party scripts" gate in particular are structural, not procedural.

### 20.2 Open risks — **BUILD**

| Risk | Detail | Fix |
|---|---|---|
| **Stage server on the LAN** | binds `0.0.0.0` by necessity; token compared with `!==` (not constant-time); no rate limit; no TLS; `/health` unauthenticated and enumerates stages | constant-time compare, rate limit, bind to the Docker bridge interface only, authenticate `/health` |
| **MCP headers are literal** | `${VAR}` is not expanded, so tokens live verbatim in `MCP_SERVERS` | expand credentials by name from `config.credentials` at connector construction |
| **Vision config bypasses `lib/config.ts`** | `VISION_*` read directly via `process.env` in scripts | move into `AppConfig` |
| **No secret sweep on artifacts** | the Places incident proves the failure is real | grep `output/**` for key-shaped strings in the security gate |
| **Prompt injection from scraped content** | scraped page text is embedded verbatim in analyst/writer/director briefs [V: `designDirectorAgent.ts:479-484`] and a malicious page could carry instructions | the closed schema + `additionalProperties:false` + post-hoc grounding checks already blunt this structurally; **add an explicit rule that scraped text is data, never instruction**, and never widen a schema to free-form output |
| **No CSP** | the rendered page has no Content-Security-Policy | emit a strict meta CSP; the page has no external scripts, so it can be near-maximally strict |

### 20.3 Data protection

- **Never store customer PII in Design Memory** (§10.2) — fingerprints and decisions only.
- Artifact directories contain business data and downloaded photographs; they are **already
  gitignored** for `output/` **[?]** — confirm before any repository is made public.
- The Places API licence constrains review storage and display **[?]** — unresolved, blocking for
  commercial use.

---

## 21. Observability

### 21.1 What exists [V]

| Mechanism | Detail |
|---|---|
| **Structured logging** | NDJSON to `output/<runId>/run.log.ndjson` + console, child scopes per agent, `logger.time()` around expensive calls |
| **Telemetry** | latency samples (default 100 retained), availability, error accounting, per-capability metrics; `TELEMETRY_ENABLED` toggles the sink but calls are still timed |
| **Status board** | `platform.status()` returns one row per provider, skill, and MCP server with health, version, enabled flag, and metrics |
| **Per-stage artifacts** | nine JSON files per run — the run is fully reconstructible from disk |
| **Provenance** | `DirectorProvenance` (provider, served model, requested model, tokens, finish reason, **provider request id**, duration) and `SourceProvenance`/`ProvenanceNote` per evidence field |
| **Job state** | `job.json` — stage, iteration, verdict, decision, error list, artifact map |
| **n8n execution history** | every stage call visible in the n8n UI |
| **Honest degradation reporting** | renderer warnings, missing assets, and content-audit issues are surfaced, never swallowed [V: `main.ts:828-838`] |

**One design decision worth naming:** providers are probed for health **only when selected** —
probing every credentialled provider "would spend four round trips to learn about three vendors
nobody asked for" [V: `lib/ai/factory.ts:220-224`]. Observability that costs more than it informs
is a tax.

### 21.2 What 2.0 needs — **BUILD**

| Addition | Why |
|---|---|
| **Cost ledger in `job.json`** | §19.3 — the data exists, the aggregation does not |
| **Fingerprint + distinctness history** | the collapse alarm (§10.3) is only meaningful as a time series |
| **Battle record** | every candidate, its scores, its rank, and why the winner won — an artifact, not a log line |
| **Jury disagreement metric** | consensus is a signal about the design; discarding it wastes the jury's most interesting output |
| **Gate pass-rate dashboard** | which diagnosis fires most tells you which layer is actually weak |
| **Escalation brief** | a human receiving an escalation needs reasons + screenshots + candidates in one file, not a `job.json` field |
| **Run summary line** | one line per run: business, tier, cost, iterations, verdict, distinctness, QA results |

**Anti-goal — REJECT:** an external observability SaaS. `security.no-external-scripts` and the €0
policy both point the same way; NDJSON on disk plus a small reader is sufficient at this scale.

---

## 22. Disposition ledger — every component

### 22.1 KEEP (works, correctly placed, 2.0 builds on it unchanged)

| Component | Path |
|---|---|
| Pipeline orchestrator, 9 stages, resume, artifact discipline | `main.ts` |
| Typed configuration, single `process.env` reader | `lib/config.ts` |
| Structured logger + NDJSON sink | `lib/logger.ts` |
| Error taxonomy with `retryable` | `lib/errors.ts` |
| Browser session lifecycle | `lib/browser.ts` |
| Platform + capability outcomes + honesty rule | `lib/platform/platform.ts`, `types.ts` |
| Telemetry | `lib/platform/telemetry.ts` |
| Skill registry/loader/manager (the **contract**) | `lib/platform/skills/` |
| MCP manager + HTTP transport | `lib/platform/mcp/` |
| All four provider adapters + factory + retry-with-jitter | `lib/ai/` |
| Source layer, per-field merge policy, provenance | `lib/sources/` |
| **The entire deterministic design layer** (20 modules) | `lib/design/` |
| **The entire content layer** | `lib/content/` |
| **The entire renderer** | `lib/render/` |
| **Tier-2 generic runtime + its CSS, correctly gated** | `lib/runtime/`, `lib/render/runtime-rules.ts` |
| Asset pipeline: decode, palette, seed, direction | `lib/art/` |
| `discoveryAgent`, `collectorAgent`, `normalizerAgent`, `businessAnalystAgent`, `writerAgent`, `designAgent` | `agents/` |
| Job state machine + atomic persistence | `lib/workflow/jobState.ts` |
| Hermes decision node and its check order | `lib/workflow/hermes.ts` |
| Distinctness gate: diagnosis + route | `lib/qa/distinctness-gate.ts` |
| Visual critic's 13 axes, closed schema, safe degradation | `lib/qa/visual-critic.ts` |
| `scoreExperience` / `narrativeCoherence` / `genericityReport` | `lib/design/quality.ts` |
| n8n as a **sequencer that owns no behaviour**, with the in-process fallback | `n8n/`, `scripts/run-job.ts` |
| Stage server's runId rejection, serialisation, token gate | `scripts/n8n/stage-server.ts` |
| Vendored fonts, no network font fetch | `lib/render/fontManifest.ts` |
| **The no-invented-facts rule and its structural enforcement** | `agents/writerAgent.ts`, `docs/architecture.md` |

### 22.2 MODIFY (exists; contract, placement, or scope must change)

| Component | Change required |
|---|---|
| `designDirectorAgent` | Split into Creative + Art directors; give the concept fields a consumer |
| Builder (currently a function call) | Promote to a named agent so the gate's `builder` route has a destination |
| Browser capture (**4 duplicate implementations**) | Consolidate into one Browser agent; preserve the lazy-load/full-height technique verbatim |
| `visual-critic` invocation | Single judge → Visual Jury: ≥2 vendors, pairwise, both orderings |
| `VISION_*` configuration | Move out of `process.env` in scripts and into `AppConfig` |
| Functional / a11y / security checks in `publish-run.ts` | Promote from a publish script to blocking gates |
| `reconceptBuild` / `perturbedDirective` | Keep as the €0 candidate generator; stop treating rotation as reconception |
| `transition` enum | Now typed and chosen; wire `wipe` and `circular-handoff` to real CSS primitives |
| `lovableAgent` | Retarget to static hosting; keep `DeploymentResult` |
| Gemini adapter default model | Stale `gemini-2.5-pro` vs config's `gemini-3.6-flash`; the status board reports the stale id |
| Pacing | Realised only as density; scroll-distance realisation is now possible with Tier 2 |
| `peers.json` peer loading | Superseded by Design Memory; keep the interface, change the source |

### 22.3 BUILD (does not exist; 2.0 requires it)

| Component | Section | Priority |
|---|---|---|
| **Visual Jury** (multi-judge, pairwise, calibrated) | §15.1 | **1 — the loop cannot see today** |
| **Design Fingerprint** (L1 structural, L2 perceptual, L3 semantic) | §11 | **2 — free at L1, unlocks everything** |
| **Design Memory** (persistent, cross-run, append-only) | §10 | **3** |
| **Design Battle** (N candidates, 3 rounds) | §9 | **4** |
| **Cost ledger + per-job budget** | §19.3 | **5 — before, not after, the battle multiplies spend** |
| **Model router** (`lib/ai/router.ts`) | §7.2 | 6 |
| **Adversarial Critic** | §15.2 | 7 |
| **UX Director** | §14.1 | 8 |
| **Motion Director** | §14.2 | 9 |
| **Asset Director** | §14.3 | 10 |
| **Technical Architect** (deterministic feasibility veto) | §14.4 | 11 |
| **Creative Director** (extracted, memory-aware) | §12 | 12 |
| A11y gate: axe-core, keyboard sweep, rendered-page contrast | §16.2 | 13 |
| Performance budgets that fail | §16.3 | 14 |
| Security: CSP, artifact secret sweep, assert collected fields | §16.4, §20.2 | 15 |
| Escalation brief for humans | §17.3 | 16 |
| Observability: battle record, distinctness history, run summary | §21.2 | 17 |
| Skills: `embeddings`, `vector-store`, `accessibility-testing`, `performance-testing`, `security-scanning` | §5.14 | as needed |
| Stage-server hardening (constant-time token, rate limit, TLS/interface bind) | §20.2 | before any untrusted network |

### 22.4 OPTIONAL (valuable; not on the critical path)

| Component | Condition to build |
|---|---|
| Places API source | a paying customer whose reviews matter — **founder exception required** |
| Instagram source | the business has no website |
| MCP servers | a capability genuinely lives outside the repo |
| Bakery V2 / `lib/experience/` | keep as a quarantined reference host; do not extend |
| Specialized host registry (Tier 3) | a second business genuinely earns an immersive host |
| L3 semantic fingerprint (embeddings) | when L1+L2 stop separating candidates |
| Vision-derived asset attributes | when choreography demonstrably misplaces images |
| The 33 remaining skill placeholders | when a real caller needs one |
| Bakery's 220-position contrast sweep, ported | when a Tier-2 page ships to a customer |

### 22.5 REJECT (must not be built, or must be quarantined)

| Item | Reason |
|---|---|
| **Lovable as the deploy target** | Re-introduces model-authored markup and non-determinism into a pipeline built to eliminate both. Replace with static hosting. |
| **Design Memory as a template library** | Memory is a repulsor, never an attractor. Retrieval-for-reuse is the exact failure the platform exists to prevent. |
| **Any model emitting CSS, JS, GLSL, hex, durations, or DOM** | The single invariant (§1.3). |
| **Any model asked for a business fact** | Certifications, testimonials, hours, prices, phone numbers. The schema must have no field for them. |
| **Generated photographs of a real business** | The image equivalent of a fabricated testimonial. |
| **Re-attempting Maps review/photo scraping** | Proven absent against two fingerprints. Twice. |
| **A CSS framework** | Re-creates the template signature the distinctness gate exists to catch. |
| **CDN fonts, third-party analytics, any external script** | Breaks a shipped security gate deliberately. |
| **Clearing n8n's `NODES_EXCLUDE`** | Hands every workflow on the instance a shell. |
| **Business logic inside n8n nodes** | Untestable, unversioned, invisible to `npm test`. |
| **A second WebGL host before evidence earns it** | Anti-pattern; one reference host is the proof, not the product. |
| **Adaptive cost optimizer** | Makes output quality a function of load; unexplainable to a customer. |
| **External observability SaaS** | Violates the €0 policy and the no-external-scripts posture. |
| **Generalizing Bakery vocabulary** (`DoughState`, loaf SDF, the Tartine script, filename casting) | Bread is not a universal concept. |

---

## 23. Contradictions, defects, and unknowns found in this audit

### 23.1 Contradictions between documents and code

1. **`lib/runtime/` "does not exist"** — the prior master plan lists gaps G2/G5/G6/G8 as open.
   **It now exists, is wired, and is gated** (§3.7). Those gaps are closed.
2. **`transition` "is a boolean"** — extension E1 in the prior plan. **It is now a four-value enum
   on the type and chosen by `planExperience`** (§3.4). E1 is done.
3. **Gemini default model** — `lib/config.ts:331` says `gemini-3.6-flash`, `lib/ai/providers/
   gemini.ts:178` says `gemini-2.5-pro` (§5.5). Runs are unaffected; the status board is wrong.
4. **`docs/architecture.md` describes "six agents"** and a `mapsUrl → discovery → collector →
   writer → lovable` flow; the pipeline is nine stages and eight agents. The doc predates the
   design/director/content stages.

### 23.2 Defects observed (recorded, not fixed — this pass is read-only)

| # | Defect | Location |
|---|---|---|
| D1 | Four independent screenshot implementations share one hand-copied lazy-loading fix | `runJob.ts`, `publish-run.ts`, `creative-review.ts`, `shoot*.mjs` |
| D2 | `VISION_*` read via `process.env` in scripts, bypassing the module documented as the only `process.env` reader | `scripts/n8n/stage.ts`, `scripts/run-job.ts`, `scripts/visual-qa.ts` |
| D3 | `scripts/visual-qa.ts` reads `OPENAI_API_KEY` where the rest of the vision path reads `VISION_API_KEY` — two different credentials for one capability | `scripts/visual-qa.ts:238` |
| D4 | Gemini adapter's stale default model | `lib/ai/providers/gemini.ts:178` |
| D5 | Director's six free-text concept fields are written to the artifact but not consumed by the deterministic layer | `designDirectorAgent.ts:270-293` |
| D6 | `lovableAgent.run()` throws; the deploy stage is only reachable in its skipped form | `agents/lovableAgent.ts:23` |
| D7 | `/health` on the stage server is unauthenticated and enumerates stage names | `stage-server.ts:78-81` |
| D8 | `dataUrls`, `iframes`, `formsWithoutAction` are collected by the security pass but never asserted | `publish-run.ts:207,220,221` |

Per the standing rule that a "document only" scope survives a visible defect [memory:
`readonly-scope-holds`], these are recorded here and **not** repaired.

### 23.3 Unknowns — require a live run or a founder decision

| # | Unknown | Blocks |
|---|---|---|
| U1 | Whether the vendored font binaries exist on disk for every face a design can name | any commercial delivery |
| U2 | Places API licence terms for storing and displaying reviews | any commercial use of the Places source |
| U3 | Real cost per delivered site at T1/T2/T3 — never measured, because no ledger exists | budget setting |
| U4 | Whether the Visual Critic's verdicts correlate with human judgement — never run against a live key | trusting the jury |
| U5 | Tier-2 runtime performance on low-end mobile (Bakery's 61 fps is measured only for the bakery fixture) | shipping a `scroll-progress` page |
| U6 | Whether `genericityReport`'s `narrativeOrder` axis actually catches convergence in practice | fingerprint weight calibration |
| U7 | Whether the MCP HTTP connector works against a real server — never run against one | any MCP adoption |
| U8 | Whether `output/` is gitignored (business data + downloaded photographs) | making the repository public |

---

## 24. Recommended build order (dependency-correct, no code written here)

| Phase | Deliverable | Why this order | Cost impact |
|---|---|---|---|
| **0** | Fix D2/D3/D4 (config unification, stale model id); confirm U1 and U8 | trivial, and every later phase depends on one vision configuration | €0 |
| **1** | **Design Fingerprint L1** (the 9 axes already extracted, promoted to a versioned record) | free, deterministic, unlocks Memory and Battle | €0 |
| **2** | **Design Memory** (append-only JSONL, novelty + distinct-k) | needs L1 only | €0 |
| **3** | **Cost ledger + per-job budget** | must exist *before* the battle multiplies spend | €0 |
| **4** | **Visual Jury** (≥2 vendors, pairwise, both orderings) | the loop currently cannot see; this is the highest-value single change | paid, bounded |
| **5** | **Design Battle** (N candidates, Round 1 free elimination) | needs 1–4 | paid, bounded by survivors |
| **6** | **QA quartet promoted to gates** + axe-core + budgets + CSP | independent of 1–5; can run in parallel | €0 |
| **7** | **Director cabinet** (Technical Architect first — it is the veto; then UX, Motion, Asset; Creative last) | the cabinet is only safe once the Architect can reject the unbuildable | paid, cheap models |
| **8** | **Adversarial Critic** | needs the battle to have a winner to attack | paid |
| **9** | Fingerprint L2 (perceptual), escalation brief, observability | refinement | €0 |
| **10** | Tier-3 host registry | only when a business earns it | — |

**Phases 0–3 and 6 are entirely free and entirely deterministic.** They can ship under the €0
policy with no founder exception. Phases 4, 5, 7, 8 require a model budget and therefore a
proposed spend decision.

---

## 25. What this document does not claim

- It does **not** implement anything. Every code reference is descriptive.
- It does **not** modify source, tests, snapshots, n8n, or dependencies. Nothing was installed or
  deleted.
- It does **not** re-prove the design-intelligence research; that is
  `docs/Design_Intelligence_Foundation.md`, `docs/AWWWARDS_PATTERN_LIBRARY.md`, and
  `docs/From_Business_Evidence_to_Creative_Direction.md`, all read this pass.
- Where the repository cannot demonstrate a capability, the cell reads ❌ or **[?]**. Nothing was
  marked present on the strength of a document alone.
- Costs are expressed as **call counts and tiers**, not as invented per-token prices. The one
  currency figure (Places ≈ €0.01/business) is quoted from the repository's own documentation and
  should be re-verified against Google's current pricing before it is relied on.
- Latencies marked **(cfg)** are configured timeouts, not measurements. Only two figures in this
  document are observed, and both are labelled.

---

_End. The next session may begin at Phase 0 without re-deriving any of this — every structural
claim is cited to a file in the repository as it stood on 2026-08-14._
