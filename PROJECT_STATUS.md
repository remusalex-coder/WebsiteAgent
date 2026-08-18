# Project Status

_Last updated: 2026-08-19_

## Capability orchestration wired into production (2026-08-19, second pass)

**The audit's finding, stated plainly:** the layer documented below shipped
with 69 passing tests and zero consumers. Every real model call in the
pipeline — the business analyst, the writer, the design director — still
called `ctx.platform.ai()` directly: one default provider, no failover, no
quota awareness, no cost ledger. Worse, the visual critic — the one
capability that looks at rendered pixels and judges whether a page reads as
generic — required a separate `VISION_API_KEY` nobody had configured, so
`lib/workflow/runJob.ts`'s `analyze` closure was a stub that returned
`genericVerdict: 'uncertain'` on **every single job**, silently, forever.
That is the mechanism this deployment has for detecting the exact failure
mode the product exists to avoid, and it had never once run.

**What changed.** `businessAnalystAgent`, `writerAgent` and
`designDirectorAgent` now route their one model call through
`ctx.platform.capabilities.run(capability, invoke)` instead of
`ctx.platform.ai()` — real cross-vendor failover for the first time (a
Gemini outage or an exhausted daily quota now falls over to OpenAI instead of
failing the stage), with each stage's `ANALYST_MODEL` / `WRITER_MODEL` /
`DIRECTOR_MODEL` pin preserved for its primary vendor via
`ModelInvocation.modelOverrides`. A new `lib/capability/visionInvoker.ts`
extends the layer to multimodal calls (Gemini and OpenAI-compatible; the
provider layer's `AIProvider.generate()` is text-only by design, so this
builds the request directly over the same transport every adapter uses).
`runJob.ts`'s visual critic now routes `craft_judging` through it, reachable
on whichever vision-capable vendor is already credentialled — no second
credential required — while an explicit `VISION_*` override still wins
outright when an operator sets one.

**Verified live**, not asserted: `npm run capability-proof` reuses
`output/riverpark`'s real, already-collected evidence and screenshots and
makes two real Gemini free-tier calls. The `reasoning` call produced a real
strategy (`Event & wedding venue`, 3 goals, 5 pages). The `craft_judging`
call returned `genericVerdict: 'distinct'`, `businessSpecificity: 9/10` —
the **first real verdict this capability has ever produced in this
deployment**. The distinctness gate, fed that real verdict, returned a real
`PASS` at score 93. Total spend: 0 cents. A separate check seeded the quota
ledger to simulate Gemini's daily allowance exhausted and confirmed
`prose_writing`'s plan correctly excludes it (`quota-exhausted`) rather than
merely ranking it behind a paid vendor — the safety property the planner was
built to guarantee, exercised for real.

**A real bug the audit caught in passing:** the agent seat roster
(`lib/capability/agents.ts`) had `craft-judge` pointing at `lib/qa/jury.ts` —
which decides how many judges to spend (k=1 vs k=2), not craft judgement
itself. Fixed to point at `lib/qa/visual-critic.ts`, the module that actually
makes the vision call. Recorded because it is exactly the kind of error
"the tests pass" does not catch, and the task that drove this session
explicitly warned against trusting the registry on that basis alone.

**998 tests pass** (929 carried over, 69 from the first capability-layer
session, none from this one — the change was to existing call sites and one
existing test file's fixture, not new surface). `test/design/
designDirectorAgent.test.ts`'s fake platform now builds a real
`planCapability` / `executeCapability` pipeline against a fake provider
factory, rather than faking `platform.ai()` directly — the unit tests
exercise the actual routing code now, not a bypass of it.

**What is still not wired:** `lib/forge/` — the separate "Experience
Signature" pipeline reachable only via `scripts/forge/run.ts` — calls
`createAIProviderFactory` directly in `research.ts`, `grounding.ts`,
`signature.ts`, `builder.ts` and `repair.ts`, untouched by either capability
session. It is not part of the `runJob.ts` production path (nothing in
`main.ts` or `runJob.ts` imports it), so it was out of this session's scope
rather than missed. The planned agent seats (`agents.ts`: market researcher,
Creative Director's three-territory battle, adversarial critic, deployment)
remain `planned`. Anthropic vision is declared in `craft_judging`'s bindings
but not implemented in `visionInvoker.ts` — a step that resolves to it fails
cleanly and the chain moves on, which is honest but means the cross-vendor
judge pairing this deployment can actually reach today is Gemini↔OpenAI, not
the three-way pairing the bindings describe.

## Capability orchestration layer (2026-08-19)

**The gap this closes.** Three prior modules each answered "which provider" for
one slice of the problem — `lib/ai/router.ts` (providers only), `lib/factory/
capabilities.ts` (five LLM-pool capabilities), the skill layer's eight
categories (not capabilities at all) — and nothing spanned a model, a skill, an
MCP server and an in-repo tool at once, or routed on cost rather than only on
observed latency. `lib/capability/` is that layer. Full reference:
[docs/capability-orchestration.md](docs/capability-orchestration.md).

```
Capability (37 declared, one closed vocabulary)
  → registry.ts   tier, terminal, F-08 flag, policy gate — one row per id
  → bindings.ts   what can serve it: model class, skill, MCP tool, in-repo tool, floor
  → plan.ts       filter (hard: F-08, quota, credential, budget) → rank (free, cost, observed) → chain
  → execute.ts    governs the rate, meters the quota, records telemetry, fails over, costs the ledger
  → orchestrator.ts   the stateful object platform.capabilities holds: credentials, quota, spend
```

**Wired into the platform.** `platform.capabilities` is live in
`lib/platform/platform.ts` alongside `providers`, `skills` and `mcp` — every
existing call site (`main.ts`, `runJob.ts`, `stage.ts`, `discoveryAgent.ts`,
both smoke scripts) picks it up with no change, because the new field is
additive and the constructor option that widens its policy is optional.

**Verified live against this deployment's real `.env`** (Gemini + OpenAI
credentialled, Anthropic and OpenRouter not): `npm run capability-board` plans
31 of 37 capabilities at **0 cents estimated for one full pass**. The six
unavailable are exactly the deliberate refusals — `image_editing`,
`motion_media` and `hosting` need a human; `audio_speech` and
`three_d_generation` are rejected by policy; `human_approval` is definitionally
human. Nothing failed by accident.

**929 pre-existing tests still pass**, plus 69 new ones covering the registry's
totality, the bindings' terminal-guarantee, F-08 exclusion, quota persistence
across a restart, budget-shrinks-across-calls, and the agent roster's
module-exists-on-disk check (which caught a real bug: the adversarial critic's
declared cross-vendor partner didn't point back, fixed before commit). Also
fixed in passing: `test/qa/no-agent-spawn.test.ts` was failing on this branch
before this session — `lib/forge/preview.ts` imported `node:child_process`
from under `lib/`, which the test exists specifically to catch. Moved to
`scripts/forge/preview.ts`; the orchestrator now returns a path and the CLI
script decides whether to open a window.

**What is not yet built:** the planned seats in `agents.ts` (market
researcher, Creative Director's three-territory battle, adversarial critic,
deployment) remain `planned`, not `implemented` — the roster says so rather
than pretending. `market_research`, `evidence_extraction`, `image_generation`,
`hosting` and a few others plan correctly but have no real skill bound behind
their non-deterministic bindings yet (all 38 built-in skills are still
placeholders, unchanged by this session). The daily quota ledger has not been
exercised against a real 429 from an exhausted allowance — only against a
faked one in tests.

## BusinessForge 2.0 — Experience Signature Pipeline V1 (2026-08-18)

**Breakout from Brochure Gravity.** The legacy deterministic renderer suffered from fixed schemas and predictable card grids. BusinessForge 2.0 implements the **Autonomous Experience Factory** in `lib/forge/`:

```
URL (Instagram / Web)
  → Sourcing & Evidence Harvesting       (lib/forge/research.ts)
  → Factual Firewall & Grounding         (lib/forge/grounding.ts)   [VERIFIED vs FORBIDDEN]
  → Creative Territories (x3)            (lib/forge/signature.ts)   [Radical concept divergence]
  → Experience Signature & Restraint     (lib/forge/signature.ts)   [Artistic opinion & anti-patterns]
  → Experience Blueprint Compilation     (lib/forge/blueprint.ts)   [Scene architecture]
  → Two-Pass Frontend Builder            (lib/forge/builder.ts)     [HTML5 + Bespoke CSS3/JS]
  → Anti-AI-Generic Gate                 (lib/forge/anti-ai-gate.ts)[0% structural slop]
  → Playwright Headless Settle & Snap    (lib/forge/browser.ts)     [1440x900 & 390x844]
  → Multi-Modal Vision QA Critic         (lib/forge/critic.ts)      [10 Awwwards axes]
  → Autonomous Code Repair Loop          (lib/forge/repair.ts)      [In-place polish]
  → Live Browser Preview Launch          (lib/forge/preview.ts)     [Automatic OS open]
```

**Verified Benchmarks:**
- **Go Sweet & More Sibiu** (`https://go-sweet.ro`): L'Alchimie du Sucre (Score: 85/100).
- **River Park Events Drăgășani** (`https://www.instagram.com/river.park.events/`): The Nocturnal Celestial Ballroom & Cloud Dance (Score: 89/100, Anti-AI Gate: 100/100, Vision Verdict: `INTENTIONALLY_ART_DIRECTED`).

Documentation: [docs/EXPERIENCE_SIGNATURE_PIPELINE.md](docs/EXPERIENCE_SIGNATURE_PIPELINE.md), [lib/forge/README.md](lib/forge/README.md).

---

## The content system — the page now says business-specific things (2026-08-11)

**The gap the experience system left.** ADR 0006 made River Park's *order* a
narrative and scored it 99/100 — then rendered that narrative with the words
"What we offer", "Photographs", "Opening hours" and "Visit River Park Events
Drăgășani in Drăgășani", every button reading "Call us", all of it English on a
venue whose every published word is Romanian. The structure said "this venue";
the prose said "a website".

A deterministic **Content Director** now sits between the narrative plan and the
composer. Full reference: [docs/content-system.md](docs/content-system.md);
decision: [ADR 0007](docs/decisions/0007-content-is-directed-by-narrative-role-and-written-in-the-evidence-language.md).

```
Evidence
  → planNarrative      lib/design/plan.ts        character · experience · conversion · roles (derived ONCE)
  → indexEvidence      lib/content/evidence.ts   what may be said
  → detectLanguage     lib/content/language.ts   what language to say it in (closed set: en, ro)
  → directContent      lib/content/director.ts   what each beat says
  → auditContent       lib/content/quality.ts    may it say that?
  → composeDesign(…, plan) → renderer
```

**Three bases, enforced by tests.** `quoted` (verbatim from the business),
`composed` (facts joined by a closed-set frame), `framing` (a lexicon label keyed
to the narrative role). A frame may compose facts; it may never supply them. A
`quoted` value must appear verbatim in the evidence index and a `composed` one may
contain no word that is neither evidence nor lexicon — both asserted for every
benchmark business.

**Language follows evidence.** Function-word detection with a margin, English as
the recorded default, and a `Lexicon` per language covering every string the
platform authors: role labels, CTA verbs, contact captions, weekday names, nav
labels, the section eyebrow, the skip link. `WebsiteContent.language` reaches
`<html lang>`. Evidence is never translated.

**No feedback loop.** `deriveCharacter` read the emotional register off the
*page's* prose, which with a director writing that prose would let a page talk
itself into being romantic. It now reads the business's own material only, the
plan is derived once before direction, and the benchmark asserts the plan is
identical before and after direction for all seven businesses.

**`NarrativeRole` reaches the stylesheet** as `data-role`. The signature beat is
set at display scale (River Park: 114 → **95** → 62 → 10px down the page); a
`context` beat on a cinematic page steps down; two `[data-world="ember"]` rules
written in the era of "Photographs" headings were scoped rather than deleted.

**Defects this found and fixed in passing**, each general rather than
business-specific: a source numbering Sunday `7` (ISO) made a page print "Open
seven days a week" eight lines above "Monday to Saturday" and publish a duplicate
Monday in its JSON-LD; `--color-brand-text` was tuned against `surface` and
measured 4.32:1 on a world-repainted ground; a four-image masonry left an orphan
row; the section eyebrow printed the TypeScript identifier; `EventVenue` was
missing from the schema.org table.

**Rendered result.** River Park: `Locație de evenimente în Drăgășani · Despre
River Park Events · Ce oferim · Sala mare cu candelabru floral și arcade
filigranate · Program · Contact · Rezervă la River Park Events`. Zero JavaScript,
no horizontal overflow at 390px or 1440px, every button ≥ 4.7:1 contrast, a 3px
focus outline, LCP image eager with `fetchpriority=high` and everything below the
fold lazy, all seven headings in document order with no level skipped.

## The experience system — character-driven experience + narrative order (2026-08-11)

**The biggest change since the design-vocabulary engine.** BusinessForge no longer
produces `Hero → About → Services → Gallery → Contact` with different styling. A
deterministic experience layer now sits above the section engine and makes
distinctiveness a function of **business character**, not industry. Full technical
reference: [docs/experience-system.md](docs/experience-system.md); decision:
[ADR 0006](docs/decisions/0006-experience-is-character-driven-and-order-is-a-narrative.md).

The chain, all deterministic and €0 (runs inside `--compose`, no model):

```
Evidence
  → BusinessCharacter        lib/design/character.ts
  → ExperienceArchitecture   lib/design/experience.ts   mode: brochure|showcase|narrative|immersive
  → AssetChoreography        lib/design/assets.ts        hero/signature/sequence/contrast/rights
  → ConversionStrategy       lib/design/conversion.ts    posture/CTA/placement/friction
  → InteractionStrategy      lib/design/interaction.ts   static|subtle|guided|immersive (capped at guided)
  → ExperienceScript         lib/design/script.ts        NarrativeRole per section → narrative order
  → AI Director (optional)   agents/designDirectorAgent  validated closed-set overrides + image-content signals
  → composeDesign → renderer (existing, unchanged)
  → quality gate             lib/design/quality.ts       score + template-smell + narrative-coherence
```

Everything is observable on `WebsiteDesign` (`experience`, `assets`, `conversion`,
`interaction`, `experienceScript`), every decision carries `rationale`+`evidence`
and a `basis: evidence | creative-default` (distinguishing factual-unknown from
creative-freedom). The AI Director is an **improver, not a single point of
failure**: it may override the floor only through decisions validated against
closed sets, and it now receives per-image content signals (dimensions,
orientation, subject, rights) rather than a raw count.

**Order is now a narrative.** `script.ts` assigns each section a closed-set
`NarrativeRole` (arrival/emotion/reveal/process/signature/space/breadth/proof/
trust/context/conversion/coda) from character, then orders the page along a story
spine — hero pinned first, closing CTA last, the middle carrying the narrative. A
high-intent trade puts contact just after its offering; a narrative venue opens on
emotion, builds to a signature, and converts last. **Two businesses in one industry
diverge** when their evidence differs.

**Proof (`test/design/benchmark.test.ts`, no manual edits):**

```
bakery      [showcase]  arrival → reveal → reveal → breadth → context → conversion
restaurant  [showcase]  arrival → reveal → breadth → trust → conversion
hotel       [narrative] emotion → reveal → signature → breadth → conversion
barber      [brochure]  arrival → breadth → conversion → context → conversion
mechanic    [brochure]  arrival → breadth → conversion → context → context → conversion
hotelThin   [brochure]  arrival → breadth → conversion → context → context → conversion   ← same industry as hotel, different script
eventVenue  [narrative] emotion → reveal → signature → breadth → context → conversion
```

**River Park, autonomous `--compose`:** `narrative` / gallery signature /
editorial-book / arc `emotion → reveal → signature → breadth → context →
conversion`, rendered `hero → about → gallery(full-bleed, moment) → services →
hours → contact → cta`, narrative score **99/100**, coherence clean. No manual
content edits.

**Tests: 580/580 pass, typecheck clean, €0.** The quality gate: `scoreExperience`
(explainability, business-specificity, narrative, coherence, conversion, asset
intent, accessibility), `genericityReport` (fails if identity axes collapse across
businesses), `narrativeCoherence` (fails asking-too-early, a missing signature, a
buried gallery, a fake narrative on thin evidence).

**Known limitations of this layer:** section *copy* is still `composeBaseline`'s
generic labels — the order is business-specific, the prose is not yet (the next
bottleneck: a character-aware writer). `pacing` and `imageryStrategy` are
validated-but-advisory. The scroll-as-time **runtime** (Bakery V2's `Scene[]`) is
audited but intentionally unbuilt. Two rich atmospheric businesses (hotel, venue)
produce similar arcs by design.

## AI Design Director — integrated into the production pipeline

**Done, not just proven.** Stage 5a of `main.ts` calls `designDirectorAgent`
whenever `DIRECTOR_ENABLED` is set; off (the default — see `.env.example`),
it is a no-op and `design` composes from inference exactly as it always did.
This was smoke-tested in isolation first (`npm run design-director`,
artifacts in `smoke-test/`, see `docs/runbooks/design-director-smoke.md`) and
is now wired into `executePipeline` itself, committed at `ebcb49a`.

| | smoke test | production run |
|---|---|---|
| provider / model | `gemini` / `gemini-3.6-flash` | `gemini` / `gemini-3.6-flash` |
| AI calls | 1 | 1 |
| usage | 657 in + 215 out, `STOP` | 919 in + 213 out, `STOP` |
| request id | `rbl5as-JA_6nkdUP_O_osQU` | `XcJ5apGmA93NkdUPpOG82Ag` |
| evidence | `smoke-test/` | `artifacts/77c15289/` (River Park Events) |

The Director was **not on `main`** before 2026-08-10 — it lived only on
`origin/copilot/inspect-repository-codebase`, which forked 12 commits ago and
was built against the pre-vocabulary design layer. Three self-contained pieces
were ported forward; that branch's A/B harness was deliberately left behind
because `scripts/ab-replay.ts` used `FALLBACK_DIRECTIVES`. **The five-business
A/B experiment run from it is not evidence about any model and must not be cited
as such.** `FALLBACK_DIRECTIVES` appears nowhere on `main`, and a test now fails
if a fallback export is reintroduced. See `docs/decisions/0001`.

**What the Director actually controls is one enum.** It returned eleven
considered fields; `applyDirective` mapped two — `direction` and
`accessibilityLevel` — and logged the rest as advisory. That one enum moved 140
design fields on the smoke-test business, so it is a wide lever, not a narrow
one, but the honest description is: *the Director picks one of eleven
directions and a WCAG target; the deterministic system does everything else.*
See `docs/decisions/0004`.

Fixed on the way through (both committed): **the mobile header nav overflowed
the viewport by 117px** — the scroll rail was correct but never had room to
work, since a flex item's `min-width` defaults to `auto` and for a `nowrap`
row that is the sum of every link; pre-existing at `0223a41`, affecting every
generated site on a phone. And **the services-cards/menu band contrast
defect** below — resolved, not just diagnosed.

### Previously "known, not fixed" — now fixed

The services-cards and menu band rendered text at ~1.13–1.23:1 against their
ground — well under AA — identically whether the Director ran or not, so it
was always the design layer's bug, not the Director's. **Resolved** by the
visual-worlds work (`efb84af`): every ground now carries its own full ink
family, and `lib/render/variants.ts`'s `ground()` helper rebinds the token
names components already read so a component cannot land on the wrong ink by
forgetting to ask for a new one. `compose.test.ts`'s ground-separation
assertion and all three renderer snapshots pass; `npm test` is 524/524.

## FIRST_REAL_DESIGN_DIRECTOR_PRODUCTION_RUN — River Park Events (`77c15289`)

Not regenerated this session; inspected only. This run **proves**:

- real pipeline integration — `main.ts` stage 5a called the Director, not a
  harness;
- a real provider call — `gemini-3.6-flash`, request id
  `XcJ5apGmA93NkdUPpOG82Ag`, 919 in / 213 out tokens, finish `STOP`;
- a real business input — a live Google Maps URL for a Drăgășani event venue,
  not a fixture;
- a real generated website — `artifacts/77c15289/render/index.html`;
- functional QA — 28/28 checks pass: heading, CTA, navigation, links, images,
  no horizontal overflow, a11y landmarks and alt text, and all four security
  checks (no inline handlers, no `javascript:` hrefs, no mixed content, no
  external scripts).

This run does **not** prove:

- generalized immersive capability — River Park was composed through the
  general pattern/world engine (`lib/design/`), not `lib/experience/`;
- that Bakery V2's capabilities are available to arbitrary businesses — the
  two engines are still separate code paths (see Architectural gap, below);
- final visual quality — QA checks structure and function, not taste.

**Known defect, present in this artifact.** The rendered HTML carries 18
instances of `U+E5CA`, a Material Icons Private Use Area glyph Maps embeds in
its own accessible-name strings (3 more in `content.json`) — a tofu box in
front of amenity labels. The fix (`239975e`, strips the PUA block at
`normalizeSpaces`) landed *after* this run and is not retroactive: this
specific artifact still has the defect, and future collector runs will not.

## Bakery V2 — now a committed canonical benchmark

`lib/experience/` (commit `a1c44af`) is **CANONICAL_BAKERY_V2** as of this
session. Full record, reproduction commands, and evidence review in
[docs/canonical-bakery-v2.md](docs/canonical-bakery-v2.md): Blade, Oven
Spring, Whiteout/Daybreak, the 3D→photography handoff, and the loop-closing
ending are each backed by a specific screenshot and a specific measured value
(veil opacity, clock, contrast ratio), not an eyeballed claim. Verified
locally, zero AI/API cost: 61fps desktop / 60fps mobile, 0 console errors,
0 contrast failures while scrolling (worst 6.27:1 against a 4.5:1 target),
correct reduced-motion and no-WebGL fallbacks, full keyboard reachability.

## The architectural gap this leaves

Bakery V2 is a **separate experience capability** (`lib/experience/`,
Tartine-shaped: dough, a levain, an oven), not yet generalized into the
universal pipeline. River Park — the first real Director production run —
went through the general pattern/world engine (`lib/design/`), the same path
every business takes; it never touches `lib/experience/`. The two are
disjoint on purpose (see the master-prompt guidance against forcing an
immersive style onto every business), but that also means nothing learned
building the bakery experience is currently reachable by any other business.

**That question now has an answer, and it is built.** A read-only capability
audit (2026-08-10) concluded that most of Bakery V2's individual principles
already exist in some form on the general path; what was missing was the
connective tissue that turns independent decisions into one arc. See
[docs/experience-capability-audit.md](docs/experience-capability-audit.md)
for the capability matrix, and [ADR 0005](docs/decisions/0005-experience-mode-is-a-directive-field.md)
for the corrected decision (its first draft proposed extending `worlds.ts`;
a contract gate found that ground sequencing already existed there,
committed at `efb84af`, and corrected the shape before anything was built).

## Experience Intent V1 (implemented 2026-08-10)

`DesignDirective` gained one optional nested field, `experienceIntent`,
mirroring the existing `heroIntent`/`typographyIntent`/`imageryIntent` shape:
a closed `mode` (`'standard' | 'moment-led'`), a `moment` referencing an
existing `SectionKind`, a one-sentence `momentIntent`, and a boolean
`transitionAtMoment`. `applyExperienceIntent` (`lib/design/directive.ts`) is
the deterministic adapter — same pattern as `applyDirective`, same
graceful-degradation philosophy, same "the model chooses from closed sets,
never supplies a measurement" rule from ADR 0004.

Two small, genuinely new deterministic pieces, exactly where ADR 0005 said
they belonged and nowhere else: `lib/design/layout.ts`'s `stepUpEmphasis`
raises the nominated section's emphasis by **one rung** (never straight to
`'lead'`), and `lib/render/variants.ts` gained **one** CSS-only transition
primitive (`.section--moment`, a bounded low-opacity wash on
`animation-timeline: view()`, gated behind
`@media (prefers-reduced-motion: no-preference)`, `pointer-events: none`).
`worlds.ts` was not touched.

**Verified, in order:**

- 565/565 tests pass, typecheck clean — including a schema test asserting
  `experienceIntent` exposes exactly its four documented fields and rejects
  CSS/JS/WebGL smuggled alongside them.
- A zero-AI deterministic fixture (`npm run experience-intent -- --deterministic-only`)
  proved standard vs. moment-led are **visibly** different — not just at the
  data-attribute level. The first attempt (nominating `gallery`, which was
  already at `'secondary'` emphasis) produced no visible change, because the
  renderer only has dedicated CSS for the `'lead'` and `'quiet'` tiers —
  `'secondary'`→`'primary'` crosses no rule. Nominating `testimonials`
  (baseline `'quiet'`) instead produced a real, inspectable difference: an
  "IV — TESTIMONIALS" eyebrow label appears that the quiet tier suppresses.
  Screenshots and crops in `smoke-test/experience-intent/`.
- One real Director call (**only after** every above check passed):
  `gemini-3.6-flash`, 794 in / 253 out tokens, request `IRN6aurjG7-9xN8PjsW7qA4`,
  confidence 0.9. For "Padaria Ana & Sons" it chose `moment-led` on `about`
  — "Elevate the story of milling flour and overnight baking to build trust
  and highlight artisanal quality" — a section this fixture actually has,
  referencing evidence actually in the brief. Full directive, provenance,
  design, HTML and screenshots in `smoke-test/experience-intent/director/`.
- **One real defect found only by the live call, not by review**: Gemini's
  structured-output translator rejects a nullable-union JSON Schema type
  (`type: ['string', 'null']`), which is exactly how `moment`/`momentIntent`
  were first written to satisfy "must be null when mode is standard"
  literally. Fixed by following the pattern the three pre-existing nested
  fields already used — never model `null` on the wire, always require a
  real value, let the deterministic adapter decide when to ignore it. The
  failed call happened before any model inference (`HTTP 400`), so was
  effectively free; full account in ADR 0005.

Both `standard` and `moment-led` remain byte-identical to pre-milestone
output on every field except the new, additive `momentTransition: false` —
confirmed by the same snapshot-diff-inspection discipline used earlier this
session, not merely asserted.

## Design vocabulary engine (added 2026-08-08)

`lib/design/patterns.ts` holds twenty named compositions — four hero archetypes,
three typography systems, three editorial/storytelling layouts, two marquee
patterns, two galleries, two visual breaks, two closing patterns and two motion
primitives. Thirteen are `executable`; the rest are `declared`, which records a
reviewed judgement whose component does not exist yet. `selectPatterns` filters
on status first, so a `declared` pattern cannot reach a page.

Each pattern carries intent, suitable industries and directions, composition,
typography, ground, spacing, imagery, motion, responsive and accessibility
rules, anti-patterns, sources, and a `requires` gate. The gate is the executable
half of the truthfulness rule: **a pattern may compose facts and may never
supply them.** A business that cannot fill a pattern honestly does not get it.

Four components execute it:

- **Statement band** — one sentence of the business's own prose on an inverted
  ground. A real `SectionKind`, so the sentence is *removed* from the passage it
  came from and never printed twice.
- **Facts marquee** — verified facts under the hero, built by code from the
  profile. `aria-hidden` by design, because every fact is stated elsewhere.
- **Wordmark close** — the business name at the foot of the page.
- **Motion** — scroll-driven CSS timelines, so a rendered site still needs no
  JavaScript. Where the browser has no view timeline, content is simply visible.

Typography is the first pattern to reach back into the tokens:
`type-editorial-serif` overrides the theme's heading face for craft and
hospitality categories on suitable directions.

**Benchmark.** Tartine moved from **72/150 to 101/150** against a premium
human-designed Framer reference at 127/150. The remaining gap is mostly
*content* — menu prices, testimonials, multiple locations — which the platform
may not invent.

`lib/art/` (added the same day) owns photographic relevance: a relative
served-width rule, subject tags, exclusive assignment so no photograph is used
twice, and a brand seed read from the logo or the photography via Chromium.

> **Canonical status now lives in BusinessForge HQ (Notion) → Executive
> Dashboard.** This file remains the in-repo technical reference: architecture,
> known limitations and engineering debt. For milestone, blockers and next
> action, read the Dashboard.

Autonomous website builder: one Google Maps URL in, a deployed website out.

**Validated across six real businesses in five industries** (restaurant, dentist,
law firm, hotel, salon). Industry classification correct 5/5. See
`output/review/index.html` for scorecards and the recurring-defect matrix.
Stages 1–5b and the renderer implemented and verified live; stage 6 stubbed.

## Architecture

Six single-responsibility agents communicating only through the contracts in
`lib/types.ts`. No agent imports another; each is replaceable and runnable alone.
`main.ts` owns configuration, the browser lifecycle, and artifact persistence —
agents take no ambient dependencies (no `process.env`, no `console`, no singletons),
receiving everything through `AgentContext`.

Beneath the pipeline sits a **capability platform**: AI providers, skills and MCP
servers, all pluggable by configuration. An agent asks for a capability and never
learns how it is provided, so adding a provider, implementing a skill or registering a
server touches no agent, no stage, and no JSON artifact.

Beside it sits the **renderer**: a pure `WebsiteContent → static site` function. Not an
agent, because it needs nothing an agent gets — no model, no browser, no context. It
runs after stage 5 and deployment will consume it unchanged.

Beneath the collector sits **`lib/sources`**: one contract, `ListingHarvest`, and one
implementation per place facts can be read from. The collector merges harvests and never
learns how any were obtained. The Places API was the drop-in that proved it — customer
reviews reached the page without a single change downstream of `lib/sources/`.

```
main.ts              orchestration, CLI, run lifecycle
agents/              one file per stage
lib/                 browser · config · logger · errors · types
  ai/                AIProvider contract, factory, 4 vendor adapters
  platform/          capability vocabulary, telemetry, skills, MCP
  sources/           ListingHarvest contract; Maps listing + Places API; merge policy
  render/            WebsiteContent → index.html + styles.css + assets
test/                node:test suites, fixtures, snapshots
docs/                architecture · providers · skills · mcp · renderer · config · dev guide
output/              artifacts (gitignored)
```

## Pipeline

| # | Agent | In → Out | Status |
|---|---|---|---|
| 1 | `discoveryAgent` | Maps URL → `DiscoveryResult` | ✅ verified live |
| 2 | `collectorAgent` | identity → `CollectedBusiness` | ✅ verified live |
| 3 | `normalizerAgent` | both → `BusinessProfile` | ✅ verified live |
| 4 | `businessAnalystAgent` | profile → `BusinessStrategy` | ✅ verified live |
| 5 | `writerAgent` | profile + strategy → `WebsiteContent` | ✅ verified live |
| 5b | `designAgent` | all three → `WebsiteDesign` | ✅ built and tested (no model call) |
| — | `lib/render` | content + design → `index.html`, `styles.css`, assets | ✅ built and tested |
| 6 | `lovableAgent` | content → `DeploymentResult` | ⛔ stub |

Stages 1–3 need no credentials. Stage 4 onward needs an AI provider — `AI_PROVIDER`
plus that vendor's key. Anthropic, OpenAI, Gemini and OpenRouter are all supported.
The renderer needs no credentials and makes no network call.

## Completed

**1. Discovery** — Playwright/Chromium. Name, category, address, phone, website,
coordinates, rating, hours, place id, socials. Handles short links, place URLs, and
search URLs (opens the first result). Declines the EU consent interstitial; never
accepts. Canonicalises through a bare `ftid` URL to get a clean single-pane DOM.

**2. Collection** — reads **every source available for the business**, not just its
website. Two today, neither required:

- **The website**, crawled on the shared browser session. Logo, favicon, hero, gallery,
  visible text, navigation, services, emails, phones, social links. Images found in
  `<img>` (incl. lazy `srcset`/`data-src`) **and** CSS `background-image`. The crawl now
  waits for the page to *have content* rather than for a fixed delay, so a
  client-rendered site is not read as an empty shell.
- **The Maps listing, read as content** (`lib/sources/mapsListing.ts`): the stated
  attributes from the About tab, the editorial description Google publishes, and the
  listing photography at native resolution rather than as the rendered thumbnail. This
  runs for every business — a rich profile gains from it too.

Attributes carry their availability state, because a listing states what a business
*lacks* alongside what it has and losing that turns "Pool unavailable" into a swimming
pool. Bot walls and blocks are detected and skipped, never solved. Writes `content.md`,
`collector.json`, `assets/`.

**3. Normalization** — merges both sources into one attributed profile. Every field
is `{ value, source, sourceUrl, alternatives[] }`. Dedup by meaning: phones on last
9 digits, social URLs on path, images by CDN path **and** SHA-256 of bytes, page text
by content hash. Strips tracking params. Validates required fields; reports rather
than throws. Writes `business.json`.

**4. Business analysis** — structured outputs through the provider layer. Category,
goals, audience, pages, features, backend/frontend modules, SEO priorities — each with
a `rationale` and an `evidence` list naming the profile facts behind it. Writes
`strategy.json`. Names no vendor: it asks `ctx.platform.ai()` and runs unchanged on
any of the four providers.

**Platform (infrastructure, not a stage)** — three pluggable subsystems reached through
`ctx.platform`:

- **Providers.** One `AIProvider` interface, four adapters (Anthropic via SDK; OpenAI,
  Gemini and OpenRouter over `fetch`). Selected by `AI_PROVIDER`. A fifth vendor is one
  adapter file plus two list entries. `lib/ai/providers/anthropic.ts` is the only file
  in the repository importing a vendor SDK.
- **Skills.** `SkillRegistry` / `SkillLoader` / `SkillManager` with register,
  unregister, discover, execute and health. 38 reserved capability ids across eight
  categories, plus runtime discovery of `*.skill.ts` from `SKILLS_DIR`.
- **MCP.** `MCPManager` over an `MCPConnector` contract (metadata, health, capabilities,
  execute), with capability caching and cross-server search.

Every call returns a `CapabilityOutcome` rather than throwing, and every provider,
skill and server reports health, version, latency, errors and availability.

**Renderer (a library, not a stage)** — `WebsiteContent` → `index.html`, `styles.css`
and the assets the page refers to. Semantic HTML5, one `<h1>`, named section landmarks,
a skip link, no invented `alt` text, mobile-first fluid layout, and no external request
of any kind — a rendered site opens from disk.

**Deterministic**: the same spec renders to the same bytes on any machine. No clock, no
randomness; JSON-LD keys are sorted and the copyright line carries no year. That is
what makes a rendered site diffable and the snapshots in `test/__snapshots__/` worth
having.

Every string in the spec is treated as untrusted, and escaping is enforced by the type
system rather than by discipline — `Html` is a branded string and the element builders
accept nothing else. A `javascript:` call to action renders as plain text, a palette
entry that is really a CSS fragment falls back to a default, and a `</script>` inside
the JSON-LD cannot close its own element. Nothing about bad content throws: it is
worked around and reported in `site.warnings`. See [docs/renderer.md](docs/renderer.md).

Run standalone with `npm run render -- output/<runId>/5-content.json`.

**Baseline composition (a second engine, not a stage)** — `composeBaseline` builds a
complete, truthful `WebsiteContent` from `BusinessProfile` alone: the listing's
description, the attributes it states, the services the site named, the photographs, the
hours, the contacts. Every string was already in the profile, so nothing can be wrong.
Headings are functional rather than distinctive, which is the honest limit of composing
without writing and precisely the gap the model fills.

Three reasons it exists: it is the floor the model must beat, it means an upstream rate
limit produces a plainer page rather than **no** page, and it is the shape of guided
completion — a draft plus an honest list of what the owner still needs to supply. It
shares `assembleContent` with the writer, so both engines produce identical page
furniture.

    npx tsx main.ts --compose <runId>

`--compose` also composes the **design**, which is deterministic and needs no model.
It was previously unreachable without one because `composeDesign` demanded a whole
`BusinessStrategy` for the two category strings it actually reads — so a page was
generated with the design layer switched off entirely and nobody noticed. `strategy`
is now an optional hint; absent, the profile's own category classifies the business.

## Pending

**6. Deployment** — a rendered site → a live URL. Consumes `renderSite` output
unchanged; it uploads `RenderedFile[]` rather than rendering its own. **The only
remaining stub.**

**Thin-profile strategy (PRD-007, P0).** Substantially addressed 2026-08-08 by making
the listing a content source. Measured on the benchmark hotel, which has no website:
0 → 610 characters of editorial prose, 0 → 12 stated attributes, 0 → 1 photograph.

> **Correction.** An earlier note in this file claimed 11 photographs. That was wrong,
> and visual review is what caught it: ten of the eleven were other hotels, swept in
> from the "Similar hotels nearby" rail Maps renders in the same pane. The generated
> page showed four named competitors in its gallery. Photographs are now scoped to the
> business by name and the honest count is one.

The page is now generated and reviewed — see `output/shots/`.

## Known limitations

**Google serves a reduced pane** to unauthenticated sessions, and says so in the
markup: "You're seeing a limited view of Google Maps." Measured 2026-08-08 against two
fingerprints, including a realistic user agent with `navigator.webdriver` removed, that
pane has:

- **no Reviews tab** — `div[data-review-id]` matches nothing, on any listing tried
- **no photo grid** — the overview carries what it carries
- **no review count**, **only today's opening hours**, and **no social links** unless
  the listed website is itself a profile

This is a wall, not a selector problem, and `lib/sources` deliberately does not try to
climb it: code that hunted for reviews would be a maintenance burden reporting an honest
zero every run. Reviews and the full photo set mean the **Places API**, which returns
both under a licence. The `ListingHarvest` seam existed so that would be one file, and
it was — `lib/sources/placesApi.ts`, landed 2026-08-08, nothing downstream changed.

**The Places source is unverified against the live API.** Every parser, the ftid
exchange, the credential-safety guarantee and the failure paths are covered by 15 tests
against a stubbed transport, and a live call was made — it returned
`401 UNAUTHENTICATED` because the only Google key on this machine is scoped to the
Generative Language API. That confirmed the degradation path (empty harvest, one
warning, run completes) and nothing else. **Enabling Places API (New) on a billed
project is the one step between here and reviews on a real page**; see
[the runbook](docs/runbooks/places-api-source.md).

**Selectors are Google's to rotate.** Every field degrades to `null` rather than
breaking the run, but `discoveryAgent.ts` is the file to expect maintenance in.

Also:
- **Coordinates are `null` for a bare `?ftid=` input** — that page carries none. Normal place and search URLs resolve them.
- **Search URLs are non-deterministic** — the same query returned a different business across runs. Prefer place URLs.
- **Bot-walled sites yield zero pages** (by design — we detect, we don't solve).
- **Services extraction is heuristic** — headings/list items on a services-type page, else nav entries. Verbatim, but expect false positives on unusual layouts.
- **E.164 only when derivable** — explicit `+`, or NANP length on a US/CA address. A UK number without `+` keeps `e164: null`. No country code is ever invented.
- **Address components are best-effort** on comma-separated forms; `formatted` is always verbatim.
- **Stage 4's live call has never run** — no API key was available.

**Platform limits, all deliberate and all declared:**

- **All 38 built-in skills are placeholders.** Reserved ids with settled contracts and
  nothing bound behind them. Each reports version `0.0.0`, health `unavailable`, and
  `not_implemented` from `execute` — never an empty result that would let a caller
  produce output looking complete.
- **The stdio MCP transport is not implemented.** Spawning, framing and reaping a child
  process correctly is real work; it is declared honestly rather than half-built.
- **The OpenAI, Gemini and OpenRouter adapters and the MCP HTTP connector have never
  run against a live endpoint.** They follow their published request and response
  shapes and pass the typecheck, but the first real call of each is the test.
- **The provider layer is text-only.** No multimodal input, no embeddings, no image or
  audio generation — which is what blocks the `vision`, `embeddings`,
  `image-generation` and `speech` skills specifically.

**Renderer limits, all deliberate:**

- **One page.** `WebsiteContent` describes one document — it has `sections`, not
  `pages` — so the renderer emits one. The strategy's multi-page recommendation is not
  reachable without changing a contract this milestone was told not to change.
- **No `og:image` for a local asset.** A crawler has nothing to resolve a relative path
  against, and the deployment URL is not known at render time. Emitted only when the
  logo is an absolute `http(s)` URL.
- **Bullets are flat strings**, so an `faq` section renders as a list rather than
  question/answer pairs. Splitting one would mean guessing where the question ends.
- **No web fonts.** A typeface name becomes the first entry in a system stack; if the
  visitor does not have it, they see the fallback. Fetching one would mean an external
  request, which would end the "opens from disk" property.
- **The rendered site has never been deployed** — it has been opened from disk and
  read, and it is covered by tests, but no host has served it.

## Engineering debt

- ~~**Everything after stage 3 is uncommitted.**~~ **Resolved 2026-08-07** — 158 files, 30,003 lines committed as `f078d4b` and pushed to `origin/main`.
- ~~**No `.gitattributes`**~~ **Resolved 2026-08-07** — `* text=auto eol=lf` plus binary rules, added before the first large commit so the repository never needed a renormalisation pass.
- ~~**Thin profiles produce an unsellable page (PRD-007, P0).**~~ **Largely resolved 2026-08-08** — the listing is now a content source. The rendered-page effect is unmeasured; see `NEXT_SESSION.md`.
- ~~**No trust signals rendered anywhere (PRD-008).**~~ **Resolved 2026-08-08** — `TrustSignal[]` on `WebsiteContent`, built by code from verified profile data, rendered as a trust bar under the hero's call to action. 5/5 benchmark sites now show one, no overflow at 390px.
- **The two stylesheets override each other silently (INF-007).** Twice now.
- **Premium feel is the next quality frontier (PRD-013).** The hero is now cinematic
  and the page passes every structural check in `scripts/creative-review.ts`. What is
  still missing is *taste* — one photograph, no motion, no storytelling arc, a footer
  that does nothing. The harness measures the signatures of generated work; it cannot
  tell whether a page is beautiful, and a page can pass all four checks and still not be
  one an agency would be proud to send.
- **The Creative Director is a vocabulary, not yet an agent.** `creative-review.ts`
  defines the observations a model will eventually be asked to judge. Turning it into an
  agent needs a provider.
- **The capability platform has no tests.** Its boot path, policy, structured errors and telemetry were verified by a runtime smoke run, not by anything committed. The registry, the manager's `blockingReason` ladder, and the schema translation are the pieces most worth covering.
- **Coverage is the renderer, the design layer, both content sources and their merge policy, and the writer's brief, trust engine, prose extraction and testimonial grounding.** `npm test` runs 354 assertions. The agents' own orchestration still has none.
- **The stylesheet guard is the one test that encodes a scar.** `test/render/sheet-conflicts.test.ts` fails when the variants sheet restates a property and drops a `min()`/`clamp()` or a viewport/container cap the base sheet set. Three production defects came from exactly that (colour tokens, the viewport cap, the column cap), each found by a human looking at a screenshot.
- **Artifact migrations are manual.** `ARTIFACT_DEFAULTS` in `main.ts` backfills fields a contract gained after a run was written; forgetting an entry breaks `--from=<stage>` on every older run with a `TypeError` far from the cause. A contract change and its default are two edits that must not drift.
- **Older suites still live outside the repo** — discovery parsers, normalizer primitives, merge/dedup/validation, analyst schema and analyst brief remain in a scratchpad rather than `test/`.
- **No accessibility or HTML validation in CI.** The markup is checked by assertions about the string, not by axe or the W3C validator. A real audit would be worth one pass before the first deploy.
- **No retry/backoff** on transient Maps or site failures beyond Playwright's timeouts. The platform reports `retryable` honestly on every failure, but nothing acts on it yet.
- `npm install` downloads Chromium (~150 MB) via `postinstall`.
