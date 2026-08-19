# Project Status

_Last updated: 2026-08-19_

## Experience Arsenal V2 becomes a production capability layer (2026-08-19, seventh pass)

**What this closes.** Every prior pass had declared, prompted, or documented
a piece of the Experience Arsenal; none of them had been exercised
end-to-end since the contract was wired into `builder.ts`, and one had
never had a real provider to route to. This pass: (1) adds two new AI
providers so the capability layer actually has more than four vendors to
route across, (2) fixes a genuine plumbing gap where the motion contract
never reached the pass that would need to add a library's `<script>` tag,
(3) builds the asset-intelligence layer that did not exist anywhere in the
repository before today, and (4) proves all of it against a real business
with a real, live, end-to-end forge run — not a test suite alone.

### 1. Provider layer — DeepSeek and Cerebras

`lib/ai/providers/deepseek.ts` and `lib/ai/providers/cerebras.ts`, both
following `xai.ts`'s established pattern exactly: OpenAI-compatible chat
completions, `supportsNativeSchema: false` (neither vendor's docs confirm
OpenAI's `json_schema`+`strict` contract, so both use the instructed/
locally-validated path openrouter.ts already established, rather than
claim a guarantee unverified). Wired into every touchpoint `xai.ts`
required: `AI_PROVIDER_NAMES`, the adapter table, `config.ts`'s
`apiKeys`/`baseUrls`/`DEFAULT_MODELS`, `orchestrator.ts`'s credential map,
`visionInvoker.ts`'s exhaustive switch (both throw an honest
not-implemented, same as xai's vision path), the model catalog, and
`lib/factory/pool.ts`'s legacy map. Pricing is OBSERVED live
(api-docs.deepseek.com: deepseek-v4-flash $0.22/$0.66 per million off-peak,
deepseek-v4-pro $0.66/$1.98; inference-docs.cerebras.ai: gpt-oss-120b,
131k context) — Cerebras's exact per-token price is UNKNOWN from any
static page (the bf_research corpus itself flags Cerebras as "not
deep-dived" for the same reason), so its catalog entry carries an
explicitly-labelled unverified estimate, not a fabricated precise one.

Both are added to `lib/capability/bindings.ts` as real candidates —
DeepSeek on `reasoning`, `structured_generation`, and `creative_direction`
(the last because bf_research's own Design Battle role table names
DeepSeek specifically as the cheap, divergent third generator), Cerebras
on `structured_generation` only, ranked last among paid candidates pending
a live call that confirms schema compliance. Neither has a credential in
`.env` — by design ("use the existing credentials only"): both are
code-complete and reachable the moment a key is added, and until then the
existing `credentialSet()` filter excludes them exactly the way it already
excludes any unconfigured vendor. Confirmed live: neither was ever
selected by the real Ridgeway run below, and no paid vendor was either —
the zero-budget-by-default policy did its job.

Provider/model selection was already capability-aware before this pass
(`lib/capability/bindings.ts`'s per-capability, hand-curated, cost-ranked
chains) — that architecture is extended here, not rebuilt.

### 2. The motion-library plumbing gap, found and fixed

Audited before touching anything: `builder.ts`'s CSS/JS pass (Pass 2) has
told the model to load GSAP/Lenis via a CDN `<script>` tag for
`expressive`/`immersive` intensity since the prior pass — but Pass 1 (the
HTML pass) never saw that instruction, and Pass 2 has no channel back into
`index.html` (its schema only returns `css`/`js`). So the one place a
`<script src="…gsap…">` tag could actually land never knew one was coming.
No real forge run had exercised this path at all: every file on disk
predated the motion contract's existence in the codebase.

Fixed with `lib/forge/motion.ts`'s new `motionLibraryHtmlPrompt()` — the
library-loading half of the full contract, filtered to only the intensities
that name an actual loadable library (GSAP/Lenis/OGL; CSS and the Web
Animations API need nothing external) — wired into `builder.ts`'s Pass 1
prompt and a new HTML mandate telling the model to add the tag before
`</body>`, ahead of `experience.js`. Enforcement, not just prompting:
`lib/forge/antiPatternSignals.ts`'s new `checkMotionLibraryUsage` mirrors
A-19's shape in the opposite direction — if `experience.js` calls
`gsap.`/`ScrollTrigger.`/`new Lenis(` with no matching `<script>` tag in
the HTML, that's a blocking fail (a real `ReferenceError` on load, not a
style disagreement), wired into `anti-ai-gate.ts` alongside the existing
checks. Neither change makes a library mandatory at any intensity — `none`/
`subtle` are told explicitly not to add one.

### 3. Asset intelligence — the layer that did not exist

Confirmed by audit before writing anything: `lib/render/assets.ts`'s
`AssetPlan` (the classic, non-Forge pipeline) only places already-collected
real photos on disk and sanitizes URLs — it makes no real-vs-generated
decision. Forge had no equivalent at all: `builder.ts` handed
`factualDossier.realPhotoAssets` straight into the HTML prompt as JSON,
with nothing checking whether `signature.scenes[].assetIds` actually
referenced one of those real assets or not.

New: `lib/forge/assetStrategy.ts`'s `planAssetStrategy` — pure, deterministic,
no network call, never executes a gated capability. Per asset slot: a real
photo is used as-is ($0); a real photo the signature's `mediaStrategy` calls
for altering is routed to `image_editing` (`gate: 'human'`, per the
existing O-6 freeze — never auto-invoked); a missing slot with mark/icon
language in the scene is routed to `vector_generation` (`gate: 'none'`,
deterministic inline SVG); any other missing slot falls back to
`image_nondepictive`'s non-depictive texture/gradient — never a fabricated
photorealistic stand-in, because no capability in this registry synthesizes
one on purpose. Signature-level: `requiresVideo` proposes `motion_media`
only if a real photo exists to animate (`gate: 'human'`), otherwise records
the requirement as honestly unservable; `requires3D` always resolves to
`three_d_generation`, `gate: 'never'` (frozen, F-18), noting the real
mechanism is `runtime_tier`'s procedural WebGL — a code capability, not a
generated asset. Wired into `blueprint.ts` (computed once, deterministically,
alongside the existing `conversionStrategy` derivation) and `builder.ts`'s
Pass 1 prompt via `assetStrategyPrompt()`, so the model is told explicitly
which `assetIds` are real and which are not, rather than left to assume.

### 4. The real end-to-end proof

Ran `runExperienceForge` against Ridgeway Motors's real, previously-collected
`BusinessProfile` (`output/ab-proof-mechanic/3-profile.json` — 5 real
photos, verified rating, real hours/contact), through the fully
capability-routed, asset-strategy-aware, motion-library-plumbed pipeline,
at $0 (only Gemini's free tier was ever selected; every paid candidate was
correctly filtered by the zero-budget-by-default policy, confirmed via
`capabilities.plan('reasoning', {})`'s own `excluded` list). Result:
**PASS**, quality 70, anti-AI gate passed (structural convergence DISTINCT
against 4 real peers, one warning: 27 card containers), critic verdict
`INTENTIONALLY_ART_DIRECTED` at 65/100.

What the real output showed, inspected directly (not inferred from logs):
- The signature chose `motionIntensity: "subtle"` and a genuinely
  business-specific central mechanism ("Precision Telemetry Inspection" —
  a scroll-driven diagnostic breakdown with live-feeling readouts, a
  service-tolerance filter, and a booking module), not a generic
  hero-plus-three-cards template.
- **Zero `<img>` tags anywhere in the generated HTML.** The scene
  generation invented its own `assetIds` rather than referencing the real
  photo ids in `factualDossier.realPhotoAssets` — the asset-intelligence
  layer caught the mismatch (0 real matches out of 7 referenced slots) and
  correctly fell back to non-depictive CSS treatment for all of them,
  exactly as designed, rather than emitting a broken or fabricated `<img>`.
- No GSAP/Lenis/ScrollTrigger anywhere in `experience.js` — correct,
  because `subtle` intensity recommends none; the CDN-loading fix was not
  exercised by this particular run (this business's evidence didn't
  justify `expressive`/`immersive`), which is itself the correct behaviour
  (§6: never mandatory).
- **A genuine, concrete improvement over the archived Ridgeway B result**:
  B's screenshot (`output/ab-proof-mechanic/shots-B/desktop.png`) shows raw
  alt-text bleeding into the layout — "Digital wheel alignment rig at
  Ridgeway Motors showing precise sensor array" rendered as unstyled page
  text — a broken `<img>` reference from before the asset-intelligence
  layer existed. The new run has no such defect, because it never emitted
  an `<img>` tag it couldn't back with a real asset.
- **A shared, pre-existing defect, not introduced by this pass**: both
  builds carry several thousand pixels of empty dark space below the fold
  on both desktop and mobile (confirmed identical pattern in
  `shots-B/mobile.png`, predating every change in this session). The
  critic caught it in the new build too ("excessive dark negative space");
  the repair loop's fix attempt hit a real `MAX_TOKENS` truncation and
  failed over to the `structured_generation` capability's deterministic
  floor, which surfaced a genuine, separate bug (next section) rather than
  silently succeeding.

### 5. A real bug the live run surfaced, filed rather than rushed

`grounding.ts`, `builder.ts`, `repair.ts`, and `signature.ts` each call
`capabilities.run(capabilityId, invoker, ...)` with a single
`createModelInvoker`-built invoker. Every capability's binding chain
intentionally ends in a `kind: 'deterministic'` floor
(`lib/capability/bindings.ts`'s own stated rule), but nothing wires that
floor to an actual deterministic implementation — `createModelInvoker`
correctly throws `"handed a non-model step"` when the plan falls through
to one. Found live in the repair loop above (a real `MAX_TOKENS` failure
correctly failed over to `reject-directive`, which then threw); `repair.ts`
happened to catch it and skip the iteration, so this run wasn't fatal, but
`grounding.ts` has no equivalent guard — the same failure there would crash
the whole run instead of falling through to `composeBaseline`'s real
deterministic composition, exactly the survivability `bindings.ts`
declared the floor to provide. This is a real correctness bug, not an
architecture question, and fixing it properly means threading a
deterministic-step handler through every call site — a cross-cutting
change out of scope for this pass to rush at the end. Filed as a follow-up
task rather than patched blind.

### 6. What was deliberately not rebuilt

The functional-module system (`functionalModules.ts`) and the closed-vocabulary
decision system (`experienceStrategy.ts`, validated by
`normalizeExperienceStrategy`) were spot-checked, not rewritten — both were
already real, validated, evidence-triggered implementations from the prior
pass, and the live Ridgeway run exercised both correctly (it selected
`service-selector`+`booking-request` from real evidence, not a default).
Capability/provider selection being cost-aware and capability-scoped
(`lib/capability/plan.ts`, `bindings.ts`) predates this pass entirely and
is extended, not replaced. No second routing system, no second
capability-naming convention, no parallel motion or asset system was
created — every addition in this pass is an extension of an existing file
or a new file feeding an existing pipeline stage.

### Verification

`npx tsc -p tsconfig.test.json --noEmit` clean. `npm run build` clean.
Full suite: 1160/1160 passing, 135 suites, 0 failures (33 new tests this
pass: provider registration ×12, motion-library-load enforcement ×6,
`motionLibraryHtmlPrompt` ×3, asset-strategy unit tests ×12, plus new
assertions inside the existing builder-wiring test proving the HTML pass
now actually receives both the motion-library and asset-strategy prompt
fragments). Plus the one thing tests alone cannot prove: a real,
live, end-to-end forge run against a real business, inspected directly —
screenshots viewed, HTML/CSS/JS grepped, compared side-by-side against the
archived Ridgeway B result.

## Experience Arsenal V2 reconciled against the real research corpus (2026-08-19, sixth pass)

**What this closes.** The fifth pass below (motion system, experience
strategy, functional modules, anti-pattern signals, Design Battle prep,
media-capability registry rows) was built against `docs/knowledge/` —
which turned out to be a *substitute* corpus, not the one the user meant.
The real, authoritative research lives outside this repo at
`C:\Users\40728\bf_research\` (the Nous Hermes agent's own output folder).
This pass reconciles the fifth-pass implementation against that real
corpus rather than rebuilding it, per the user's "Reîntoarce la bf
research" instruction.

**What changed, concretely.**
- `lib/forge/motion.ts` gained library guidance the fifth pass didn't
  have: CSS-only (no JS animation library) at `none`/`subtle`; GSAP +
  ScrollTrigger + Lenis at `expressive`/`immersive` (the exact stack
  observed live on cravburgers.shop via curl, not inferred); OGL — not
  Three.js — as the lightweight WebGL entry point, gated on
  `experienceStrategy.requires3D` and `immersive` only; Locomotive Scroll
  forbidden at every intensity (confirmed unmaintained, Lenis is the
  direct replacement); and the frame-rate-independent cursor lerp formula
  (`value += (target - value) * (1 - Math.exp(-k * dt))`), not a naive
  fixed-fraction one. 6 new tests in `test/forge/motion.test.ts`
  (21/21 in that file, 112/112 across `lib/forge`).
- `lib/capability/registry.ts`'s media-provider rationale text (written
  during the fifth pass without the real corpus's pricing pages) was
  corrected in two directions: filled in where the fifth pass had
  wrongly written "UNKNOWN" (Higgsfield's price — Free/$19/$47/$99-mo —
  and its VERIFIED ToS §4.4 no-commercial-restriction clause were both
  actually published; so is Runway's and Google Veo 3.1's pricing), and
  narrowed where the fifth pass had overclaimed knowledge it didn't have
  (`audio_speech`/`three_d_generation` now cite ElevenLabs's and
  Tripo/Meshy's actual tier prices instead of a generic "researched
  candidate" line). A genuine risk absent from the fifth pass was added
  to `motion_media`: Higgsfield is a US company but proxies
  Chinese-model backends (Kling/Seedance/MiniMax-class) for some camera
  presets, which carries weaker ToS clarity than Higgsfield's own terms
  and should be checked per-preset if this row is ever bound — not
  encoded as a hard block, just recorded so it isn't silently assumed
  away.
- **Scope confirmed, not touched:** `CONTROL_PLANE_AUDIT.md` /
  `CONTROL_PLANE_V2.md` are about `lib/workflow/hermes.ts` and the n8n
  control plane — a different subsystem, out of scope here.
  `CREATIVE_DIRECTION_ENGINE_SPEC.md` (and the two Aug-12 docs under it)
  is explicitly scoped by its own §22 to the classic
  `lib/design/`/`agents/designDirectorAgent.ts` pipeline, not `lib/forge`
  — read for deltas, none found that apply to this codebase.
- **Capability-naming convention: deliberately not adopted.** The real
  corpus's `01_entry_nav_cursor.md`/`02_layout_scroll_type.md` define a
  75-pattern taxonomy under a `cap.<domain>.<name>` id scheme with its
  own JSON blueprint representation. This was not adopted — it would be
  a second, parallel naming system alongside `lib/capability/registry.ts`'s
  existing closed `CAPABILITY_IDS` (snake_case) convention. Instead, the
  same ground the taxonomy covers is closed off through
  `lib/forge/experienceStrategy.ts`'s 4-value-each closed-vocabulary
  fields (`layoutGrammar`, `scrollBehavior`, `typographyBehavior`,
  `loadingModel`, etc.) — a deliberate collapse of the 75-pattern spec
  into the same "closed vocabulary, not free text" discipline the rest
  of this pipeline already uses, not an oversight.
- **Corpus-internal inconsistency, noted not resolved:** the real
  corpus's own files disagree with each other on Tripo's and Meshy's
  exact pricing tiers (three different numbers for Tripo's Pro tier
  across three files). Left unresolved in `registry.ts`'s rationale text
  because `three_d_generation` is frozen (F-18) and not being activated
  — recorded here so a future session reopening that row knows to
  re-verify pricing directly rather than trust any one file.

**Verification.** `npx tsc -p tsconfig.test.json --noEmit` clean.
Full suite: 1127/1127 passing, 135 suites, 0 failures. No production
code paths changed — this pass only corrected documentation-as-code
(rationale strings) and extended `motion.ts` with previously-missing
library guidance; no other module changed behavior.

## Experience Arsenal V2 — the research corpus is now executable (2026-08-19, fifth pass)

**What this closes.** `docs/knowledge/` (13 files, 6,463 lines, dated
2026-08-17) was a deliberately inert research artifact — every file marked
"Do NOT implement" and `KNOWLEDGE_INDEX.md` §5 stating plainly "value is
zero until at least one worker queries it." This pass is that querying,
scoped to what the existing architecture could genuinely absorb by
extension rather than by building a second system: `signature.ts`,
`anti-ai-gate.ts`, the capability layer, and `lib/qa/verdict.ts` all
already existed and are reused throughout, not duplicated.

**New, small modules, each transcribing one piece of the research into
code a prompt or a gate can actually act on:**

- `lib/forge/motion.ts` — `MOTION_LIBRARY.md`'s duration/easing/stagger
  numbers, closed into four intensity presets
  (none/subtle/expressive/immersive). Not a suggestion: a new
  `checkMotionCoherence` anti-ai-gate check flags CSS durations exceeding
  what the signature's own declared intensity permits, so "motion is a
  system, not per-component invention" is enforced, not just asked for.
- `ExperienceSignature.experienceStrategy` — 15 closed-set fields (motion
  intensity, navigation/loading/typography/cursor/scroll/layout/media
  strategy, `requires3D`/`requiresVideo` with mandatory rationale,
  `functionalModules`, mobile/accessibility/performance-tier/reduced-motion
  strategy), validated by `normalizeExperienceStrategy` with the same
  discipline ADR 0004 established for the classic pipeline: the model
  proposes from a closed vocabulary, validated code disposes, invalid
  input degrades to a named default rather than reaching the builder raw.
- `lib/forge/functionalModules.ts` — real, evidence-triggered functional
  modules (`enquiry-form`, `booking-request`, `service-selector`, etc.)
  transcribed from `WEBSITE_CAPABILITY_KNOWLEDGE.md`'s CAP-07/09/11/12,
  with concrete fields, real states (no fake progress), and a real
  submission mechanism: a `mailto:` handoff, because this pipeline renders
  static sites with no backend and a form that silently does nothing would
  be worse than no form (the doctrine of absence, same document).
- `lib/forge/anti-ai-gate.ts` extended with S-STATIC signals from
  `ANTI_AI_SLOP.md` (A-02 gradients, A-06 badges, A-07 fake statistics —
  blocking, A-08 generic copy, A-09 rounded corners, A-11 repeated CTAs,
  A-13 meaningless animation, A-16 premium language, A-19 unnecessary 3D
  cross-checked against the new `requires3D` field). **A-07's own test run
  found a live false positive** against the real, committed Ridgeway
  fixture — "32% Remaining Integrity" on a diagnostic health-bar gauge is
  a legitimate interactive-tool reading, not a marketing trust-stat — and
  the check was narrowed to require proximity to an actual trust/scale
  claim word before it fires, with that exact case now a permanent
  regression test.
- `lib/forge/battle.ts` — Design Battle's real mechanism. N independently
  formulated signatures, each routed through the real capability layer;
  divergence is measured by writing each candidate into its own
  subdirectory so the *existing*, unmodified `checkStructuralConvergence`
  peer scan sees siblings as real peers; the winner is chosen by the
  *existing*, unmodified `lib/qa/verdict.ts` lexicographic comparator.
  `candidateCount` defaults to 2, not 3, because a default that silently
  triples spend would itself be a zero-cost-safety defect.
- `lib/capability/registry.ts` — Higgsfield, ElevenLabs and Meshy recorded
  as *researched candidate providers* on the existing `motion_media`,
  `image_editing`, `audio_speech` and `three_d_generation` rows.
  `audio_speech` and `three_d_generation` remain **REJECTED**: Freeze F-18
  is a frozen policy decision, and a provider existing is not, by itself,
  a reason to reopen one without an evidence-backed change request — the
  same discipline the freeze document asks of every implementer.

**A live run found and fixed a real bug.** Running the extended pipeline
against a real business (`mechanic`, the Ridgeway Motors fixture),
`formulateExperienceSignature`'s enlarged schema was rejected by Gemini
with an HTTP 400 on `experienceStrategy`'s `performanceTier` field: Gemini's
`responseSchema` dialect documents `enum` as valid only on `type: STRING`,
and the field was declared `type: 'number'`. Fixed: `performanceTier` now
travels on the wire as a string digit (`"0".."5"`), parsed back to a
number in `normalizeExperienceStrategy` (which still accepts a raw number
too, for any caller that constructs one directly). **Full end-to-end
re-verification after the fix was blocked** by the same Gemini
daily-quota exhaustion this session's earlier work already documented —
the first live attempt got through grounding and real territory
formulation before hitting the schema bug; the retry, after the fix,
was blocked by 429 before reaching the signature call at all. Reported
honestly rather than assumed fixed: the fix is well-reasoned and matches
Gemini's documented constraint precisely, but is not yet live-proven.

**45 new tests**, all local — no live calls were needed to build or verify
any of this except the one attempted (and quota-blocked) live run above.
Full suite **1115/1115**, typecheck and build clean. Commit `af792ed`.

**Not done, and explicitly out of scope for this pass:** GSAP/Lenis/View
Transitions API are not integrated as npm dependencies — no business
evidence observed by this factory has yet justified crossing that
dependency boundary, and the motion system's token contract does not
require a specific animation library to express (the builder's vanilla-JS
+ CSS custom-properties approach already carries it). S-LAYOUT anti-pattern
signals (identical section rhythms, predictable spacing) need rendered
geometry from a live page, which would mean moving part of the gate to run
post-capture — a real architectural change, not a same-shape extension,
and correctly deferred rather than rushed into this pass.

## The entire Forge pipeline is now capability-routed (2026-08-19, fourth pass)

**The gap this closes.** The five-business benchmark two passes ago
stalled after one business on a real Gemini daily-quota exhaustion. The
reason it *stalled* rather than *failed over*: only `signature.ts` and
`critic.ts` routed through the capability layer. `research.ts`,
`grounding.ts`, `builder.ts` and `repair.ts` each called
`createAIProvider(config.ai, logger)` directly — one vendor, no failover,
invisible to the planner's quota and budget accounting. Gemini was a
single point of failure for four of Forge's six model-backed stages.

**The fix.** All four now build a request with `createModelInvoker` and
call `platform.capabilities.run(capabilityId, invoke)`, exactly like
`signature.ts` already did — reusing the existing `reasoning` capability
(research's synthesis call, grounding's factual audit) and
`structured_generation` (the builder's two passes, repair's fix pass).
No new capability ids, no second routing system, no hardcoded vendor.
`ANALYST_MODEL`/`WRITER_MODEL` pins are preserved via `modelOverrides`,
applied only to the vendor they name — a pin for Gemini has no effect once
the chain fails over to OpenAI, same as `signature.ts`'s existing pattern.

**Two provider-specific incompatibilities, fixed at the adapter boundary,
not as stage-level hacks.** Both were found live, trying to push the
stalled benchmark through on OpenAI, before this session's wiring existed:

1. OpenAI's `strict: true` structured-output mode rejects any schema
   missing `additionalProperties: false`, and separately requires every
   `properties` key to also appear in `required` — neither of which Gemini
   or Anthropic need, so no schema in the repository declared them.
   `toStrictSchema()` (`lib/ai/providers/openai.ts`) normalizes the schema
   on the way out, only for OpenAI; the original schema still governs
   response validation.
2. OpenAI's reasoning models share one `max_completion_tokens` pool
   between internal reasoning and visible output; Gemini keeps
   `maxOutputTokens` and `thinkingConfig.thinkingBudget` independent. A
   16,000-token grounding request was truncated to zero output before this
   fix. `toOpenAIReasoningReserve()` (`lib/ai/protocol.ts`) pads the
   ceiling with headroom on the same ladder as `toGeminiThinkingBudget`.

**Zero-cost safety, verified against the real planner/executor with a fake
provider factory (not a second fake routing layer):** an exhausted daily
quota excludes a vendor when paid execution isn't allowed (the default);
the *same* exhausted vendor is still tried, correctly, as a paid option
once a policy explicitly allows it (an exhausted free tier means "now
costs money," not "gone" — `lib/capability/plan.ts`'s own rule); the
default zero-budget policy never reaches a paid vendor at all, with zero
calls recorded. No live API calls were made building or verifying this —
every new test is local, against fakes.

**A third bug found live on the same benchmark run, fixed in the same
session as the gate fix (see below):** a repair-loop re-critique that lost
its vision vendor mid-run returned `critic.ts`'s honest degraded fallback
(flat `5/10`, `HYBRID_SOME_GENERIC`, a `rawNotes` explaining why), and
`computeForgeVerdict` was reading it as a genuine mediocre pass rather than
blocking-uncertain. Fixed: the `genericity` dimension now reads
`rawNotes` and reports `uncertain`.

**37 new tests**, all local: each of the six model-backed stages proven to
route through capabilities (`test/forge/capability-routing.test.ts`), real
cross-vendor failover and budget enforcement against the real planner
(`test/forge/capability-failover.test.ts`), the two OpenAI fixes
(`test/ai/openai-strict-schema.test.ts`, `test/ai/openai-reasoning-
tokens.test.ts`), and a static invariant
(`test/forge/no-direct-provider.test.ts`) that fails the suite if any file
under `lib/forge/` imports `createAIProvider` again. Full suite
**1058/1058**, typecheck and build clean. Commit `6ece4e0`.

**Not done, and deliberately deferred:** the five-business benchmark was
not re-run (2 of 5 businesses — bakery, lawyer — remain unattempted; the
directive for this session explicitly said not to spend on it yet). Creative
Director Battle, Higgsfield integration and further design effects are
still out of scope until the factory is genuinely provider-agnostic and
proven so — this session is that proof, not the next feature.

## Anti-AI gate false positive fixed; verified on 3 real businesses (2026-08-19, third pass)

**The bug.** `lib/forge/anti-ai-gate.ts`'s structural-similarity check compared
the current build's `<section id="…">` list against one hardcoded prior run
(`forge-da56c149`, the Go Sweet bakery) and failed anything over 80% overlap.
It scored Ridgeway Motors — an auto-repair shop, nothing like a bakery — "100%
identical" to it. Root cause: `signature.ts` never told the model what a scene
id was *for*, so it defaulted to `scene-1`, `scene-2`, … on every business.
Two unrelated builds' *only* shared trait was the naming convention, not the
content, and the check measured exactly that artifact.

**The fix.** `checkStructuralConvergence` replaces the single-baseline diff:
scoped to whatever real peer corpus exists under `outputDir` (never a fixed
file), compared on the signature's own identity-bearing creative fields —
central mechanism, metaphor, layout-pattern sequence, selected interaction
patterns, color palette — never a DOM id. Convergence is flagged only when
several axes agree with the *same* peer at once (four of five), so one
coincidental shared trait between two legitimately different businesses no
longer trips it. `slugifySceneIds` fixes the id generation at the source,
giving every scene a real, business-derived anchor id as a side effect. New
`lib/forge/verdict.ts` combines the structural gate with the Craft Critic into
one explainable verdict, reusing `lib/qa/verdict.ts`'s existing lexicographic
rule (F-06) rather than a second scoring formula.

**A second, related bug found live, not by inspection.** Running the real
five-business benchmark below, a repair-loop re-critique for Paradise Dental
Care lost its vision vendor mid-run (Gemini's daily free-tier quota exhausted)
and `critic.ts`'s honest `uncertainReport` fallback — flat `5/10` on every
axis, `HYBRID_SOME_GENERIC`, `rawNotes` explaining why — was being read by
`computeForgeVerdict` as a genuine, if mediocre, critique rather than as
missing evidence. Fixed: the `genericity` dimension now reads `rawNotes` and
reports `uncertain` (blocking) rather than a passing score. This is the same
principle the freeze names elsewhere (F-07: `uncertain` blocks delivery) and a
concrete instance of Phase 10's requirement that missing vision credentials
never silently become a pass.

**Verified live, three businesses, real production path** (signature →
blueprint → builder → browser → critic → gate → verdict, only the business
evidence differing): Ridgeway Motors (auto repair, UK fixture business),
Paradise Dental Care (dentist, real US business), River Park Events
Drăgășani (event venue, real Romanian business). All three scored mutually
`DISTINCT` with **zero** matched identity axes against each other — different
central mechanisms (a diagnostic-telemetry system vs. a care-coordination
system vs. an atmospheric-lighting system), different palettes, different
interaction grammars, different conversion postures matched to category
(`call` / `visit` / `reserve`), not merely different colors.

**Not completed this session:** the remaining two of the five target
businesses (a bakery, a restaurant) hit real `HTTP 429` Gemini quota
exhaustion after the dentist run — not a code defect. Per this project's zero-
budget-by-default capability policy, the run correctly refused to fail over to
the configured-but-paid OpenAI key rather than spend without authorization
(confirmed: zero paid-provider calls occurred). Five-of-five substantially
different businesses is still open.

**33 new tests**, all against real captured production artifacts (Ridgeway's
actual signature, blueprint, critique and generated HTML are committed as
fixtures — synthetic placeholder business, no real PII) rather than synthetic
mocks: the exact historical false positive is on record and asserted fixed,
alongside a synthetic near-duplicate proving the check is not merely
neutered. Full suite **1033/1033**, typecheck and production build clean.
Commit `a1b79ce`.

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
