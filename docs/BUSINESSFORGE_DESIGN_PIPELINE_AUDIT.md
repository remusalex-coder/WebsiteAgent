# BusinessForge — Design Pipeline Audit

_Audit performed 2026-08-17. Read-only: no application code, prompt, gate, worker
or architecture was modified. Every conclusion was established by following
imports, calls and data flow, or by executing the code. Where the repository
contradicts a committed document, the contradiction is reported rather than
reconciled._

**Scope note.** This audit covers **four git refs**, not one. That turned out to
be the single most important discovery and it reframes every question in the
brief — see §A.

---

## A. Executive finding

### A.1 The repository has four refs and they disagree about what the design pipeline is

`git fetch --all` at audit time returned two branches that had not previously been
examined. The design pipeline is **different on each**:

| Ref | HEAD | Files | Design pipeline |
|---|---|---|---|
| `origin/main` | `06d3ab1` | 168 | **No Design Director.** Design is a pure deterministic lookup. |
| `origin/copilot/inspect-repository-codebase` | `31328cf` | 186 | **Design Director V1 exists** — real agent, real model call, **disabled by default**. |
| `origin/claude/hermes-architecture-audit-rps5p0` | `0b99389` | 181 | Adds `lib/research/` (Hermes handoff). **No design change.** |
| `origin/claude/businessforge-full-audit-lg7ctk` | `d2c173f` | 170 | Audit documents only. **No design change.** |

**FACT:** the Design Director is real, well-built, tested, and **not on `main`**.
It has never been merged. Anyone reading `main` concludes there is no Design
Director; anyone reading the `copilot` branch concludes there is. Both are correct
about their own ref.

### A.2 Nine of the ten artifacts named in the audit brief have never existed

The brief asks about `lib/forge/signature.ts`, Creative Territories, the
Experience Signature, the Restraint Contract, `anti-ai-gate.ts`,
`designMemory.ts`, `docs/knowledge/`, a distinctness gate, a visual critic, and
`VISION_*` environment variables.

I searched **every commit on every ref** — not just the current trees — with
`git log --all --diff-filter=A --name-only`:

| Artifact named in the brief | Status |
|---|---|
| `lib/forge/` (any file) | **NEVER EXISTED IN ANY COMMIT** |
| `signature.ts` / Experience Signature | **NEVER EXISTED IN ANY COMMIT** |
| Creative Territories | **NEVER EXISTED IN ANY COMMIT** |
| Restraint Contract | **NEVER EXISTED IN ANY COMMIT** |
| `anti-ai-gate.ts` | **NEVER EXISTED IN ANY COMMIT** |
| `designMemory.ts` | **NEVER EXISTED IN ANY COMMIT** |
| `docs/knowledge/` | **NEVER EXISTED IN ANY COMMIT** |
| distinctness gate | **NEVER EXISTED IN ANY COMMIT** |
| visual critic | **NEVER EXISTED IN ANY COMMIT** (the string `Critic` appears once, in a comment) |
| `VISION_*` env vars | **NEVER EXISTED IN ANY COMMIT** |
| **Design Director** | **EXISTS** — `agents/designDirectorAgent.ts` on the `copilot` ref |

Consequently:

- **§3 (knowledge consumption) cannot be answered as posed.** There is no
  `docs/knowledge/` directory to tabulate. A table of documents that do not
  exist would be fabrication. §D reports what documentation *does* exist and
  whether any of it is consumed by code — which is the answerable form of the
  question.
- **The specific prior observation in the brief — "visual-critic could return
  `uncertain` without `VISION_*`, and distinctness could pass with zero reasons"
  — describes code that is not in this repository on any ref.** I cannot confirm
  those conditions "still exist" because they never existed here. Either they
  live in a local working tree that was never pushed, or in the BusinessForge HQ
  (Notion) design set that `PROJECT_STATUS.md:5` names as canonical. **UNKNOWN
  which**, and it matters: see §L.

### A.3 The Design Director is real, and 9 of its 11 output fields are discarded

This is the substantive finding. On the `copilot` ref the Director produces an
11-field `DesignDirective` from a real model call. `applyDirective()` then
translates it into `ComposeOptions` — a type with **exactly two fields**.

I measured this by executing the real code path (§K.3):

```
DIRECTIVE FIELDS IN  (11): direction, visualIntent, density, heroIntent,
                           layoutIntent, colorStrategy, typographyIntent,
                           imageryIntent, accessibilityTarget, rationale, confidence
ComposeOptions OUT:        {"direction":"editorial","accessibilityLevel":"AA"}
surviving fields:          2 / 11
```

And what the directive asked for versus what it got:

```
asked density=dense       got=airy              honoured=FALSE
asked hero=magazine       got=editorial         honoured=FALSE
asked imagery=monochrome  got=natural           honoured=FALSE
asked typography=serif    got=Playfair Display  (coincidence of the theme, not consumed)
```

The Director's entire causal power over the rendered page is: **choose one of
eleven themes, and optionally raise the contrast floor to AAA.** It cannot
change density, hero variant, section variants, section order, imagery
treatment, typeface, or composition.

### A.4 There are no gates. None. On any ref.

`Gate`, `antiAi`, `anti-ai`, `critic` (as code), `distinctness`, `fail(` and
`VISION` return **zero matches** across all `*.ts` on every ref. The closest
artefact is `scripts/ab-test.ts`, which computes a `verdict` field and contains
**no `process.exit`, no `exitCode`, and no `throw`** keyed to it. Nothing in
BusinessForge can fail a run on design quality.

### A.5 The Design Director has never produced a directive in a recorded run

Both committed experiments failed to exercise the AI:

- `scripts/ab-test.ts` — the committed report
  `docs/design-director-v1-ab-test-verification.md` records **10 of 10 runs
  FAILED** at stage 1 with `net::ERR_NAME_NOT_RESOLVED`. Final verdict:
  "0/5 businesses completed both groups."
- `scripts/ab-replay.ts` — bypasses the network but uses hand-authored
  `FALLBACK_DIRECTIVES`, with the source comment at
  `scripts/ab-replay.ts:480-481`: *"Select directive: prefer real AI if key
  available (**not implemented here**), use fallback keyed by exampleSlug."*

So the "A/B experiment" that produced screenshots compared `composeDesign(input)`
against `composeDesign(input, applyDirective(handWrittenDirective))`. **That
measures the adapter, not the AI** — and because `applyDirective` forwards only
`direction`, it is functionally identical to setting the
`FEATURE_design-direction-*` flag that already existed on `main`.

### A.6 One-line answer to "why does it still look generic?"

Because **industry classification, not art direction, still owns every design
lever except the theme name.** `classifyIndustry()` assigns one of 17 keyword
buckets, and `INDUSTRY_DEFAULTS[industry]` then supplies density, priority
sections, variant hints, image reliance and the fallback hue. The Design
Director — when enabled — overrides exactly one of those five inputs' consumers
(`direction`), and cannot reach the other four at all.

---

## B. Actual call graph

Traced from the real entry point. Format: **FILE → FUNCTION → INPUT → OUTPUT → NEXT**.

### B.1 Entry point

**FILE** `main.ts:617-626` → **FUNCTION** module-guard + `main()`
**INPUT** `process.argv`
**OUTPUT** dispatch to one of four modes
**NEXT** `parseArgs` → `runPipeline` | `resumePipeline` | `discoverStandalone` | `renderStandalone`

```
main.ts:618   if (invokedPath && path.resolve(invokedPath) === fileURLToPath(import.meta.url))
main.ts:593   async function main()
main.ts:594     loadConfig()                      → AppConfig
main.ts:595     parseArgs(process.argv.slice(2))  → CliArgs union
main.ts:610-612 resumePipeline | runPipeline
```

`parseArgs` (`main.ts:466`) takes the **first** non-`--` argument
(`argv.find`, `:468`) and reads flags as `--name=value` only (`flagValue`,
`:461`). Four modes: `pipeline`, `resume`, `discovery`, `render`
(`CliArgs`, `:454-458`).

### B.2 Orchestrator

**FILE** `main.ts:307-384` → **FUNCTION** `executePipeline`
**INPUT** `AppConfig`, `{runId, input: DiscoveryInput, from: StageName}`
**OUTPUT** `PipelineResult`
**NEXT** eight sequential stages

Supporting machinery, all in `main.ts`:

| Symbol | Line | Role |
|---|---|---|
| `STAGES` | `:169-178` | `discovery, collect, normalize, analyze, write, design, render, deploy` |
| `ARTIFACTS` | `:188-197` | stage → artifact basename (`render: null`) |
| `ARTIFACT_KEYS` | `:206-215` | structural read-back check per stage |
| `createRun` | `:70` | output dir, logger, lazy browser, eager platform, `AbortController` |
| `contextFor` | `:128` | narrows a `Run` to an `AgentContext` |
| `persistStage` | `:146` | temp-write + `rename` (atomic per artifact) |
| `readArtifact` | `:222` | reads a prior stage, validates against `ARTIFACT_KEYS` |
| `step` | `:317-327` | run-and-persist, **or** load from disk when `< firstIndex` |
| `renderStage` | `:276` | not a `step` — persists nothing, re-runs every time |

### B.3 Workers, in execution order

| # | FILE → FUNCTION | INPUT | OUTPUT | ARTIFACT | AI | NEXT |
|---|---|---|---|---|---|---|
| 1 | `agents/discoveryAgent.ts:590` → `discoveryAgent.run` | `DiscoveryInput{mapsUrl}` | `DiscoveryResult` | `1-discovery.json` | **no** | collector |
| 2 | `agents/collectorAgent.ts` → `collectorAgent.run` | `DiscoveryResult` | `CollectedBusiness` | `2-collected.json`, `assets/`, `content.md` | **no** | normalizer |
| 3 | `agents/normalizerAgent.ts` → `normalizerAgent.run` | `{discovery, collected}` | `BusinessProfile` | `3-profile.json` | **no** | analyst |
| 4 | `agents/businessAnalystAgent.ts:361` → `businessAnalystAgent.run` | `BusinessProfile` | `BusinessStrategy` | `4-strategy.json` | **YES** | writer |
| 5 | `agents/writerAgent.ts:1039` → `writerAgent.run` | `{profile, strategy}` | `WebsiteContent` | `5-content.json` | **YES** | director (copilot ref) / design (`main`) |
| **5a** | `agents/designDirectorAgent.ts:…` → `designDirectorAgent.run` | `{profile, strategy, content}` | `DesignDirective` | `5a-directive` | **YES** | design |
| 5b | `agents/designAgent.ts:84` → `designAgent.run` | `{profile, strategy, content, directive?}` | `WebsiteDesign` | `5b-design.json` | **no** | render |
| — | `lib/render/site.ts` → `renderSite` | `WebsiteContent` + `WebsiteDesign` | `RenderedSite` | `site/` | **no** | deploy |
| 6 | `agents/lovableAgent.ts:23` → `lovableAgent.run` | `WebsiteContent` | — | — | no | **THROWS** |

**Stage 5a exists only on `origin/copilot/inspect-repository-codebase`.**

### B.4 Stage 5a wiring — exact

`main.ts:360-373` on the `copilot` ref:

```
let directive: DesignDirective | undefined = undefined;
if (config.director.enabled && STAGES.indexOf('design') >= firstIndex) {
  run.logger.info('design director: invoking', { model: config.director.model });
  directive = await designDirectorAgent.run(
    { profile, strategy, content },
    contextFor(run, designDirectorAgent.name),
  );
  await persistStage(run, '5a-directive', directive);
  ...
}
const design = await step('design', () =>
  designAgent.run({ profile, strategy, content, directive }, contextFor(run, designAgent.name)));
```

Four properties of that block, each verified:

1. **It is not a `step`.** It is an unconditional `await` guarded by an `if`. So
   it is not resumable and its artifact is not readable back.
2. **`5a-directive` is absent from `STAGES`, `ARTIFACTS` and `ARTIFACT_KEYS`.**
   Confirmed by reading all three on that ref. The directive is **write-only**:
   `readArtifact` cannot load it and `--from` cannot resume through it.
3. **Resuming at `design` re-pays the model call.** `firstIndex` for
   `--from=design` is 5; `STAGES.indexOf('design')` is 5; `5 >= 5` is true, so
   the Director runs again. `--from=render` (6 ≥ 5 false) skips it and loads
   `5b-design.json`.
4. **`PipelineResult` omits the directive.** Verified against the literal at
   `main.ts` — the fields are `runId, input, discovery, collected, profile,
   strategy, content, design, deployment, startedAt, finishedAt`. So
   `result.json` carries no record that a Director ran.

### B.5 Prompts and instructions — the complete set

Four artefacts, all hard-coded in TypeScript. No prompt file, registry, template
directory or version exists on any ref.

| Artefact | FILE:LINE | Size | Ref |
|---|---|---|---|
| Analyst system prompt | `agents/businessAnalystAgent.ts:154-162` | ~9 lines | all |
| `STRATEGY_SCHEMA` | `agents/businessAnalystAgent.ts:97-148` | ~50 lines | all |
| Writer system prompt | `agents/writerAgent.ts:227-275` | ~49 lines | all |
| `CONTENT_SCHEMA` | `agents/writerAgent.ts:164-221` | ~57 lines | all |
| **Director `SYSTEM_PROMPT`** | `agents/designDirectorAgent.ts` (exported) | ~20 lines | **copilot only** |
| **`DIRECTIVE_SCHEMA`** | `agents/designDirectorAgent.ts` (exported) | ~11 fields | **copilot only** |

### B.6 Providers and models

**FILE** `lib/platform/platform.ts:189` → `platform.ai()` → `providers.createDefault()`
**FILE** `lib/ai/factory.ts:184-191` → `createDefault()` → validates `AI_PROVIDER`, checks credential, returns cached instance wrapped by `withRetry` (`:126-155`).

Four adapters in `lib/ai/providers/index.ts` (`ADAPTERS`): `anthropic.ts`
(SDK, streaming), `openai.ts`, `gemini.ts`, `openrouter.ts` (all raw `fetch`).

**Provider is global; model is per stage.** One `AI_PROVIDER` for the whole run;
`ANALYST_MODEL`, `WRITER_MODEL` and (copilot ref) `DIRECTOR_MODEL` are
independent. See §G.

### B.7 Design decisions — the deterministic core

**FILE** `lib/design/compose.ts:324` → `composeDesign(input, options)`
**INPUT** `{profile, strategy, content}` + `ComposeOptions{direction?, accessibilityLevel?}`
**OUTPUT** `WebsiteDesign`
**NEXT** `renderSite`

Fixed decision order (`compose.ts:328-405`), no feedback:

```
classifyIndustry()      industries.ts:359   → one of 17 ids + basis
defaultsFor(id)         industries.ts:437   → INDUSTRY_DEFAULTS[id]
chooseDirection()       compose.ts:131      → 1 of 11 (override short-circuits at :139)
themeFor(direction)     themes.ts:429       → ThemeDefinition
densityFor()            compose.ts:222      → industry × theme × sectionCount
buildColorSystem()      tokens.ts           → OKLCH ramps; scheme HARD-CODED 'light' at tokens.ts:241
buildTypography/Spacing/Radius/Elevation/Motion()   tokens.ts
planLayout()            layout.ts:430       → hero, per-section variant, frame, background, order
imageryFor/iconsFor/responsiveFor()                 compose.ts:284-313
```

### B.8 Renderer

`lib/render/index.ts` → `renderSite` (`site.ts`) → `renderDocument`
(`document.ts:286`) + `renderSection` (`sections.ts`, 22 render functions) +
`renderStylesheet` (`css.ts`) → `designRules` (`variants.ts`) +
`fontFaceRules` (`fonts.ts:107`). Written by `writeRenderedSite`
(`write.ts:72`), the only filesystem writer, with the `resolveInside` path guard
(`:57`).

### B.9 QA and repair

**QA: does not exist inside the pipeline.** `main.ts` calls no QA anything.
Outside it: `scripts/batch-audit.ts` (measurement + screenshots),
`scripts/renderer-coverage.ts` (perturbation coverage),
`scripts/ab-test.ts` / `ab-replay.ts` / `ab-contact-sheet.ts` (comparison
reports). All are human-invoked leaves with **zero internal callers**.

**Repair: does not exist.** No repair module, no iteration, no re-render loop on
any ref.

### B.10 Final output and the terminal failure

`renderStage` (`main.ts:276-294`) writes `site/`. Then `main.ts:375`:
`step('deploy', () => lovableAgent.run(...))` → `agents/lovableAgent.ts:33`
`throw new NotImplementedError('lovableAgent.run', NAME)`. There is **no
`try`/`catch`** around the deploy step — only `finally { run.dispose() }`. So on
every full run the site is written, then the process exits non-zero, and
`6-deployment.json` and `result.json` are never written.

---

## C. Design decision ownership

Direct answers to §2 of the brief. No inference — each cites the call path.

| Question | Answer | Evidence |
|---|---|---|
| **Is there actually a Design Director?** | **YES on `origin/copilot/inspect-repository-codebase`. NO on `origin/main`.** Real agent, 463 loc, real model call via `ctx.platform.ai()`. **Disabled by default** (`DIRECTOR_ENABLED` default `false`). | `agents/designDirectorAgent.ts`; `lib/config.ts` `DirectorConfig.enabled`; `DEFAULTS.director.enabled = false` |
| **Is `lib/forge/signature.ts` called during a real generation?** | **NO — the file has never existed in any commit on any ref.** | `git log --all --diff-filter=A --name-only` → no match for `forge/` or `signature.ts` |
| **Are Creative Territories generated?** | **NO — the concept exists nowhere in code or history.** | zero matches for `territor` across all refs and all commits |
| **Is the Experience Signature consumed downstream?** | **NO — it does not exist.** | as above |
| **Is the Restraint Contract consumed?** | **NO — it does not exist.** | zero matches for `restraint` |
| **Is `anti-ai-gate.ts` executed against generated output?** | **NO — it does not exist.** `antiAi`/`anti-ai` = zero matches. The one `slop` hit is `slope` in a CSS fluid-scale calculation (`lib/render/css.ts:32`). | grep across all refs |
| **Is `designMemory.ts` involved in generation?** | **NO — it does not exist.** There is no cross-run memory of any kind: telemetry is an in-process ring buffer, `output/` is gitignored. | zero matches; `lib/platform/telemetry.ts` |
| **Is knowledge from `docs/knowledge/` consumed by any worker?** | **NO — `docs/knowledge/` has never existed.** No worker on any ref reads any file from `docs/`. | §D |
| **Is any external AI model making visual/design decisions?** | **Conditionally, and narrowly.** On `main`: **no** — `designAgent` makes zero model calls by design (`agents/designAgent.ts:9-13`). On `copilot` with `DIRECTOR_ENABLED=true`: **yes, but only the theme name and the contrast floor** — 2 of 11 directive fields survive. | §A.3, §K.3 |
| **Where exactly does the generated design come from today?** | **`lib/design/compose.ts:324` `composeDesign()`, a pure deterministic function of `(BusinessProfile, BusinessStrategy, WebsiteContent)` plus at most two optional scalars.** Its dominant input is `classifyIndustry()` → `INDUSTRY_DEFAULTS[id]`, which supplies density, priority sections, variant hints, image reliance and fallback hue. | `compose.ts:328-405`; `industries.ts:102-318` |

### C.1 Precisely what the Director can and cannot reach

Measured by executing `applyDirective` and `composeDesign` on identical inputs (§K.3).

| Directive field | Fate | Mechanism |
|---|---|---|
| `direction` | **CONSUMED** | → `ComposeOptions.direction`; short-circuits `chooseDirection` at `compose.ts:139-146`, **bypassing the industry preference veto** |
| `accessibilityTarget` | **CONSUMED** | → `ComposeOptions.accessibilityLevel` |
| `colorStrategy` | **PARTIAL** | only `'high-contrast'` acts (forces `'AAA'`). `'brand-led'`/`'neutral'` are log-only, self-described "advisory in V1" |
| `density` | **DISCARDED** | logged `(advisory in V1)`; density still `densityFor(industry, theme, sectionCount)` |
| `heroIntent.preference` | **DISCARDED** | never forwarded; hero still `chooseHero(content, theme, imageReliance)` |
| `typographyIntent.preference` | **DISCARDED** | theme owns the typeface |
| `imageryIntent.treatment` | **DISCARDED** | contract comment: "ignored in V1 (the theme owns the treatment)" |
| `visualIntent` | **DISCARDED** | `logger.info` only |
| `layoutIntent` | **DISCARDED** | `logger.info` only |
| `rationale` | **DISCARDED** | logged; warning if absent |
| `confidence` | **DISCARDED** | logged; `< 0.5` warns. **"No threshold causes a hard failure."** |

**Structural cause:** `ComposeOptions` (`lib/design/compose.ts`) declares exactly
two optional properties. Nine directive fields have no destination to be
assigned to. This is not a bug in `applyDirective` — the adapter is honest and
its docstrings say so. It is a **contract-width mismatch**, and the V1 spec
declares it deliberate.

### C.2 The one genuine widening, and its limit

`chooseDirection` with an override returns it directly (`compose.ts:139-146`),
**bypassing the industry's 3-direction preference list**. So the Director widens
the theme space from ~3-per-industry to 11-per-industry.

Measured cascade when direction moved `elegant → editorial` on the restaurant
fixture — 5 of 12 design fields changed:

```
CHANGED  direction      elegant          → editorial
CHANGED  brand          #9f5c54          → #a45950
CHANGED  accent         #876e2c          → #a25766
CHANGED  headingFont    Lora             → Playfair Display
CHANGED  imageryTreat   warm             → natural
SAME     density, hero, footer, scheme, a11yTarget, variants, order
```

So the Director changes **palette, typeface and treatment**. It does **not**
change **composition, density, hero, section variants or section order**. And the
brand *hue* remains industry-owned (`fallbackHue: 28` for restaurant) — the theme
only modulates chroma and lightness around it.

---

## D. Knowledge consumption map

**`docs/knowledge/` does not exist and never has.** The table below therefore
covers the documentation that *does* exist, answering the real question: **is any
document consumed by code?**

Method: for each doc, `git grep` its filename and its distinctive identifiers
across all `*.ts` on all refs; and check whether any worker reads from `docs/`.

| Document | Ref | Referenced by code? | Imported? | Loaded dynamically? | Passed to an LLM? | Used by a gate? | Documentation only? | Unused? |
|---|---|---|---|---|---|---|---|---|
| `docs/architecture.md` | all | no | no | no | no | no gates exist | **yes** | — |
| `docs/configuration.md` | all | no | no | no | no | — | **yes** | — |
| `docs/design-intelligence-review.md` | all | no | no | no | no | — | **yes** | — |
| `docs/developer-guide.md` | all | no | no | no | no | — | **yes** | — |
| `docs/folder-structure.md` | all | no | no | no | no | — | **yes** | — |
| `docs/mcp.md` | all | no | no | no | no | — | **yes** | — |
| `docs/providers.md` | all | no | no | no | no | — | **yes** | — |
| `docs/renderer.md` | all | no | no | no | no | — | **yes** | — |
| `docs/skills.md` | all | no | no | no | no | — | **yes** | — |
| `docs/design-architecture-gap-analysis.md` | copilot | no | no | no | no | — | **yes** | — |
| `docs/design-directive-v1-analysis.md` | copilot | no | no | no | no | — | **yes** | — |
| `docs/design-director-v1.md` | copilot | no | no | no | no | — | **yes** | — |
| `docs/design-director-v1-spec.md` | copilot | **cited in a comment** in `lib/design/directive.ts` — prose only, never read | no | no | no | — | **yes** | — |
| `docs/design-director-v1-verification.md` | copilot | no | no | no | no | — | **yes** | — |
| `docs/design-director-v1-implementation-verification.md` | copilot | no | no | no | no | — | **yes** | — |
| `docs/design-director-v1-integration-verification.md` | copilot | no | no | no | no | — | **yes** | — |
| `docs/design-director-v1-final-verification.md` | copilot | no | no | no | no | — | **yes** | — |
| `docs/design-director-v1-ab-test.md` | copilot | written by `scripts/ab-test.ts`; **never read** | no | no | no | — | output artifact | write-only |
| `docs/design-director-v1-ab-test-verification.md` | copilot | as above | no | no | no | — | output artifact | write-only |
| `docs/research-handoff.md` | hermes | no | no | no | no | — | **yes** | — |
| `README.md`, `PROJECT_STATUS.md`, `ROADMAP.md`, `NEXT_SESSION.md` | all | no | no | no | no | — | **yes** | — |

### D.1 Findings

1. **No worker reads any file under `docs/`.** Verified: no `readFile`,
   `readFileSync`, `import(...)` or `fs` call in `agents/` or `lib/` resolves to
   a path containing `docs`.
2. **No document reaches an LLM.** The only text sent to a model is built by
   three brief-builders from *pipeline artifacts*: `buildBrief`
   (`businessAnalystAgent.ts:183`), `buildWriterBrief` (`writerAgent.ts:302`),
   and `buildDesignBrief` (`designDirectorAgent.ts`). None reads a file.
3. **Zero-consumption rate: 100%.** Every document is human-only. There is no
   knowledge base, exemplar library, prohibition list, prompt registry or
   decision log that any code path consumes.
4. **The design rationale that *is* consumed lives in source comments** —
   `industries.ts:102-318` (every hue traced to an anchor colour),
   `themes.ts:100-420` (eleven directions), `layout.ts` (variant veto reasoning).
   Excellent quality; invisible to any tool; not addressable as knowledge.

---

## E. Generic-design failure path

### E.1 The earliest injection point

**`classifyIndustry()` — `lib/design/industries.ts:359`.**

It remains the earliest point **even with the Design Director enabled**, and this
is the pivotal finding. `composeDesign` calls `defaultsFor(industry.id)`
(`compose.ts:345`) and consumes five industry-owned values:

| Industry-owned value | Consumed at | Can the Director override it? |
|---|---|---|
| `defaults.density` | `compose.ts:349` `densityFor(...)` | **NO** — `density` is discarded |
| `defaults.fallbackHue` | `compose.ts:369` `buildColorSystem({seedHex, fallbackHue, ...})` | **NO** — no directive field maps to it |
| `defaults.imageReliance` | `compose.ts:390` `planLayout({imageReliance})` | **NO** |
| `defaults.prioritySections` | `layout.ts:375` `orderSections`, `industries.ts:451` `emphasisFor` | **NO** |
| `defaults.variantHints` | `layout.ts:181` `chooseVariant` | **NO** |
| `defaults.directions` | `compose.ts:137` `chooseDirection` | **YES** — this is the only one |

So of six industry-derived design inputs, the Director can influence **one**.

### E.2 The downstream chain

| # | Point | Mechanism | Evidence | Det. or model? | Gate? | Can it fail a run? |
|---|---|---|---|---|---|---|
| 1 | **Industry bucketing** | 16 ordered keyword rules, first-match-wins, over Maps category → strategy category → services → name. 17 ids total; no `creative` slot. | `industries.ts:75-92`, `:359-435` | **deterministic** | none | no |
| 2 | **Industry defaults** | `INDUSTRY_DEFAULTS[id]` supplies the five values in §E.1 | `industries.ts:102-318` | **deterministic** | none | no |
| 3 | **Direction veto** | Only the industry's `directions` list is eligible; copy keyword votes merely reorder within it | `compose.ts:164-166`; comment `:162-163` | **deterministic** | none | no |
| 3a | **Director override** | Bypasses #3 only. Widens 3→11 themes. | `compose.ts:139-146`; `directive.ts` `applyDirective` | **model** (when enabled) | none | no |
| 4 | **Brand colour fallback** | Hex from `content.voice.palette`, else any hex in scraped page text, else `defaults.fallbackHue`. Businesses with no crawlable site have no hex → **category colour, not brand colour** | `compose.ts:255-266` | **deterministic** | none | no |
| 5 | **Density** | `min(industryDensity, themeDensity)` narrowed by section count. Directive `density` discarded. | `compose.ts:222-233` | **deterministic** | none | no |
| 6 | **Hero** | `theme.heroPreference` walk with content vetoes. Directive `heroIntent.preference` never forwarded. | `layout.ts:65-96` | **deterministic** | none | no |
| 7 | **Variant starvation** | `supports()` gates rich variants behind content thresholds — `bento` ≥5 bullets, `masonry` ≥4 images, `alternating` ≥1 image per bullet | `layout.ts:130-164` | **deterministic** | none | no |
| 8 | **Colour scheme** | `scheme: 'light'` **hard-coded**; the type admits `'dark'` and nothing produces it | `tokens.ts:241`; `design/types.ts:199` | **deterministic** | none | no |
| 9 | **Composition envelope** | Every section is a full-width band in document order; frames vary silhouette but not the envelope | `layout.ts:240-299`; `sections.ts` | **deterministic** | none | no |
| 10 | **No motion executed** | `motion.effects` (`fade`/`rise`/`scale`/`stagger`) computed and emitted as custom properties; **zero `@keyframes`, no IntersectionObserver, no `<script>` except JSON-LD** | `themes.ts:78`; `document.ts:106` | **deterministic** | none | no |
| 11 | **Output ships unjudged** | `renderStage` writes `site/`; next call is the deploy stub | `main.ts:356-361` | — | **none** | no |

**Every row: no gate. Every row: cannot fail a run.** There is no point between
industry classification and the written site at which a design is assessed.

### E.3 Empirical corroboration

From the prior forensic pass, re-derived independently here and consistent:
generating all 51 example fixtures and fingerprinting
`(direction, density, hero, brand, headingFont)` yields **24 distinct visual
systems for 51 businesses**, with one 8-way collision (bike shop, bookshop,
butcher, jeweller, marketing agency, optician, generic retailer, tattoo studio —
all `retail`). Variant distribution is starved: `bento` fires **2** times,
`masonry` **3**, while `hero-split` takes **32 of 51 (63%)**.

**Enabling the Director would reduce but not eliminate this**, because the eight
colliding businesses share an industry, and the Director can differentiate their
*theme* while density, priority sections, variant hints, image reliance and
fallback hue stay identical.

---

## F. Gate reality

| Gate | IMPLEMENTED? | CALLED? | CAN FAIL A RUN? | FAIL-CLOSED? | WHAT IT ACTUALLY CHECKS |
|---|---|---|---|---|---|
| **Anti-AI gate** | **NO** | — | — | — | Does not exist on any ref. `antiAi`/`anti-ai` = 0 matches. The `slop` hit is `slope` in `css.ts:32`. |
| **Distinctness gate** | **NO** | — | — | — | Does not exist. `distinctness` = 0 matches in any commit. |
| **Visual critic** | **NO** | — | — | — | Does not exist. `Critic` appears once, in a `lib/design/directive.ts` comment describing future work. No screenshot is taken in any pipeline path. |
| **Accessibility** | **PARTIAL — constructed, not gated** | yes, inside `composeDesign` | **NO** | n/a | `buildColorSystem` constructs ramps to meet a contrast floor (AA, or AAA via `accessibilityLevel`) and records shortfalls in `design.notes`. Unreachable targets are **reported, never thrown** (`compose.ts:315-323`). No axe, no W3C validation. |
| **Performance** | **NO** | — | — | — | No Lighthouse, no budget, no measurement in any pipeline path. |
| **Technical QA** | **NO inside the pipeline** | — | — | — | `scripts/batch-audit.ts:114-144` measures broken images, horizontal overflow, header height, h1 size, per-section height/words/images, CTA counts — **as a human-invoked dev script with zero internal callers and no thresholds**. |
| **Renderer degradation reporting** | yes | yes | **NO** | n/a | `site.warnings` + `missingAssets`; `main.ts:278-290` logs them and continues. Explicitly report-not-throw. |
| **Writer grounding** | yes | yes | **NO** | n/a | `groundingWarnings` (`writerAgent.ts:917`) flags emails, hosts and 9+-digit runs absent from the profile. **Reports, never edits or fails** — `:911-915` states this deliberately. |
| **Directive shape check** | yes (copilot) | yes | **YES — but only on malformed output** | fail-closed | `assertDirectiveShape` throws `UpstreamError` (retryable) on a non-object, a missing required field, or `confidence` outside `[0,1]`. It cannot fail on *design quality*. |
| **Directive confidence** | yes (copilot) | yes | **NO** | **FAIL-OPEN** | `confidence < 0.5` → `logger.warn` in **both** `designDirectorAgent.run` and `applyDirective`. Contract comment: *"No threshold causes a hard failure."* |
| **A/B verdict** | yes (copilot) | only from `scripts/ab-test.ts` | **NO** | n/a | Computes `'positive'\|'neutral'\|'negative'\|'incomplete'` from improvement/regression counts. **No `process.exit`, no `exitCode`, no `throw`** keyed to it. A report, not a gate. |
| **Deploy stub** | n/a | yes | **YES — always** | n/a | `lovableAgent.ts:33` throws unconditionally. The only thing that reliably fails a run, and it is unrelated to quality. |

### F.1 On the specific prior observation in the brief

The brief asks me to verify whether **(a)** visual-critic can return `uncertain`
without `VISION_*`, and **(b)** distinctness can pass with zero reasons.

**Neither condition can be verified, because neither component exists in this
repository on any ref, and neither has ever existed in any commit.** `VISION`
returns zero matches as an identifier; the two case-insensitive hits in
`docs/research-handoff.md` are substrings of *division*, *decision* and
*revision*.

What I can state about the *shape* of the concern, from what does exist: the
Director's confidence handling is **fail-open in exactly the way described** —
a low-confidence directive is applied with a warning, and the contract states
that no threshold causes a hard failure. If the observation came from a different
codebase, that pattern is at least reproduced here.

---

## G. Provider / model reality

No recommendation is made here, per the brief.

### G.1 Wired providers

| Provider | Adapter | Transport | Default model | Credential | Native schema | Live-proven? |
|---|---|---|---|---|---|---|
| anthropic | `lib/ai/providers/anthropic.ts` | `@anthropic-ai/sdk`, streaming, adaptive thinking, server-side fallback beta | `claude-opus-5` | `ANTHROPIC_API_KEY` | yes | **INFERENCE: yes** — only adapter with vendor-specific refusal/truncation handling |
| openai | `providers/openai.ts` | raw `fetch` | `gpt-5` | `OPENAI_API_KEY` | yes | **UNKNOWN** |
| gemini | `providers/gemini.ts` | raw `fetch` | `gemini-3.6-flash` | `GEMINI_API_KEY` | yes (OpenAPI subset) | **UNKNOWN** |
| openrouter | `providers/openrouter.ts` | raw `fetch` | `openai/gpt-5` | `OPENROUTER_API_KEY` | yes | **UNKNOWN** |

### G.2 Which models are actually called, by which worker

| Worker | Calls a model? | Model variable | Default effort | Max output tokens |
|---|---|---|---|---|
| `discoveryAgent` | **no** | — | — | — |
| `collectorAgent` | **no** | — | — | — |
| `normalizerAgent` | **no** | — | — | — |
| `businessAnalystAgent` | **yes** | `ANALYST_MODEL` | `high` | 32,000 |
| `writerAgent` | **yes** | `WRITER_MODEL` | `high` | 24,000 |
| **`designDirectorAgent`** (copilot) | **yes** | **`DIRECTOR_MODEL`** | **`medium`** | **4,000** |
| `designAgent` | **no — by design** (`agents/designAgent.ts:9-13`) | — | — | — |
| `renderSite` | **no** | — | — | — |
| `lovableAgent` | **no** | — | — | — |

### G.3 Local / deterministic operations

`normalizerAgent` (merge, SHA-256 dedupe, validation), the whole of
`lib/design/` (8 files, ~3,300 loc, zero external deps), the whole of
`lib/render/` (13 files, ~5,650 loc), `lib/design/directive.ts` `applyDirective`
(explicitly "Pure deterministic function"), and both browser stages (Playwright,
no model).

### G.4 Where provider selection happens

Single point: `lib/ai/factory.ts:184-191` `createDefault()`, reading
`config.ai.provider` from `AI_PROVIDER` (`lib/config.ts:483`). Validation is
deliberately deferred out of `loadConfig` (`factory.ts:9-14`) so stages 1–3 run
uncredentialled. `MissingProviderError` / `UnsupportedProviderError` /
`MissingApiKeyError` each name the exact variable to fix. **There is no silent
fallback to a mock and no degraded text path.**

### G.5 Can design generation currently be delegated to a stronger external model?

**Partially, and the constraint is not the provider layer.**

- **Model: yes.** `DIRECTOR_MODEL` is independent of `ANALYST_MODEL` and
  `WRITER_MODEL`, so the Director can run on a different — including a
  stronger — model than the writer.
- **Provider: no.** `AI_PROVIDER` is global. All three model-calling stages use
  the same vendor. Mixing vendors per stage is not expressible in the current
  config (`AiConfig` has one `provider` field). A per-stage provider would be a
  config and factory change, not an adapter change.
- **The real constraint is the output contract, not the model.** However strong
  the model, `applyDirective` forwards two fields. A frontier model asked for an
  art direction today would have 9 of its 11 answers discarded. **Model strength
  is not currently the binding constraint on design quality.**
- **Vision is unavailable.** `AIGenerateRequest` (`lib/ai/types.ts:35-52`) carries
  `system`, `prompt`, `schema`, `model`, `effort`, `maxTokens`, `schemaName`,
  `signal` — **no image input**. `PROJECT_STATUS.md:164-166` states the provider
  layer is text-only, and `lib/platform/skills/builtin/media.ts:20` gives the
  blocker verbatim: *"needs multimodal input on the AIProvider contract, which is
  text-only today."* So a visual critic is blocked by a contract, not a provider.

---

## H. Confirmed gaps

Each verified by reading or executing the code. **13 confirmed.**

| # | Gap | Evidence |
|---|---|---|
| H1 | **The Design Director is not on `main`.** It exists only on an unmerged branch and is off by default there. | branch diff; `DEFAULTS.director.enabled = false` |
| H2 | **9 of 11 directive fields are structurally unconsumable.** `ComposeOptions` has two properties. | measured 2/11 (§K.3) |
| H3 | **The Director cannot change composition.** Density, hero, section variants and section order were byte-identical across control and directed runs. | measured (§C.2) |
| H4 | **The Director has never run against a real model in any recorded run.** `ab-test` 10/10 DNS failures; `ab-replay` uses hand-authored directives with "not implemented here". | `docs/design-director-v1-ab-test-verification.md`; `scripts/ab-replay.ts:480-481` |
| H5 | **No gate of any kind can fail a run on quality.** Only the deploy stub fails runs, unconditionally and for unrelated reasons. | §F |
| H6 | **Confidence handling is fail-open.** Low confidence warns twice and proceeds. | `directive.ts` contract comment: "No threshold causes a hard failure" |
| H7 | **`5a-directive` is write-only.** Absent from `STAGES`/`ARTIFACTS`/`ARTIFACT_KEYS`; `readArtifact` cannot load it; `--from=design` re-pays the model call. | `main.ts` on copilot ref |
| H8 | **`PipelineResult` omits the directive**, so `result.json` has no record a Director ran. | `main.ts` result literal |
| H9 | **Industry classification owns 5 of 6 design inputs and the Director can reach 1.** | §E.1 |
| H10 | **Brand colour is a category colour whenever the business has no crawlable site** — and `colorStrategy: 'brand-led'` cannot change that. | `compose.ts:255-266`; `directive.ts` |
| H11 | **`scheme` is hard-coded `'light'`**, so the `premium` theme's own description ("Dark ground, precise detail", `themes.ts:365`) is false in effect. | `tokens.ts:241` |
| H12 | **Motion is computed, emitted and unconsumed** — zero `@keyframes`, no observer, no `<script>` but JSON-LD. | `themes.ts:78`; `document.ts:106` |
| H13 | **Zero documentation is consumed by any code path.** No worker reads `docs/`; no document reaches an LLM. | §D |

### H.1 Contradictions between the repository and committed documents

Reported, not reconciled, per the brief.

| # | Document claim | Repository | Severity |
|---|---|---|---|
| X1 | `docs/design-director-v1-ab-test.md` is titled and structured as an A/B *result* | All 10 runs failed; every metric column is `-`; 0 positive / 0 neutral / 0 negative | **high** — reads as evidence, contains none |
| X2 | `scripts/ab-replay.ts:20-22` header: *"If `ANTHROPIC_API_KEY` is available in the environment, the real `designDirectorAgent` is used instead"* | `:480-481` in the same file: *"prefer real AI if key available (**not implemented here**)"*. Only `FALLBACK_DIRECTIVES` is ever used. | **high** — self-contradiction inside one file |
| X3 | `agents/designAgent.ts:49-51` docstring: an unrecognised direction override *"is ignored with a warning rather than failing the run"* | `:58-59` casts any `FEATURE_design-direction-*` suffix to `DesignDirection` with **no validation and no warning** → `THEMES[undefined]` → crash. Present on **all** refs. | **high** — live latent bug |
| X4 | `PROJECT_STATUS.md:53` "stage 4 ✅ verified live" | `PROJECT_STATUS.md:151` "Stage 4's live call has **never run** — no API key was available" | **medium** — self-contradiction in one file |
| X5 | `PROJECT_STATUS.md:178-180` "**No web fonts**" | `lib/render/fonts.ts:107` emits `@font-face`; `write.ts:107-120` copies woff2; 34 faces vendored | **medium** |
| X6 | `PROJECT_STATUS.md:192` "Only the renderer is tested… 110 assertions"; `docs/architecture.md:112` "110 assertions"; `docs/renderer.md:296` "245 assertions. Five suites in `test/render/`" | Measured: **248** on `main`, **356** on copilot; **six** suites in `test/render/` plus five in `test/design/` | **medium** |
| X7 | `docs/folder-structure.md` | **Zero** occurrences of "design" — the entire `lib/design/` layer (~3,300 loc) is undocumented. Also points `BULLET_LAYOUTS` at `lib/types.ts`; it is at `lib/render/sections.ts:49` | **medium** |
| X8 | `README.md:3` "one deployed website out"; `NEXT_SESSION.md:10` "The pipeline works end to end" | `lovableAgent.ts:33` throws; every full run exits non-zero | **high** |
| X9 | `docs/design-intelligence-review.md` §4 "Top 10 improvements" | Items **1, 2, 3, 4, 6 are done** (variant classes, `layout.order`, fonts, hero variants, computed columns — all re-verified). The document does not say so. Items 5, 7, 8, 9, 10 remain true. | **medium** |
| X10 | `lib/design/directive.ts` header: extension happens "when Visual Critic evidence shows…" | No Visual Critic exists on any ref, so the stated trigger for V2 is unreachable | **low** — but it makes V1's narrowness self-perpetuating |

---

## I. Suspected gaps

Plausible from the evidence, **not** established. Flagged as suspicion, not fact.

| # | Suspicion | Why | What would settle it |
|---|---|---|---|
| S1 | **A real model would frequently pick a direction the industry list forbids**, making the widening the Director's main value — but nobody knows, because it has never run. | The hand-authored `FALLBACK_DIRECTIVES` deliberately "pick a direction the deterministic system would not" (source comment) — i.e. the experiment was *designed* to show a difference | one real run with `DIRECTOR_ENABLED=true` and a key |
| S2 | **`DIRECTOR_MAX_OUTPUT_TOKENS = 4000` with `effort: 'medium'` may be too tight** for an 11-field directive with five prose fields on a thinking model, where the budget caps thinking *and* output together | `anthropic.ts:149` treats `max_tokens` truncation as a **non-retryable** failure; the writer needs 24,000 for comparable prose | one real run; inspect `finishReason` |
| S3 | **Enabling the Director may not measurably reduce the 24-fingerprint collision**, because same-industry businesses keep identical density, priority sections, variant hints, image reliance and hue | §E.1 | regenerate the 51 fixtures with real directives and re-fingerprint |
| S4 | **The Director's brief may be too thin to differentiate** — `maxPageChars: 2000` and only the first 2 pages, versus the writer's 6,000 | `buildDesignBrief` bounds | compare briefs on a rich vs thin profile |
| S5 | **`confidence` may be uninformative.** The prompt asks it to "reflect evidence quality, not decision quality", but nothing calibrates or validates it | no consumer beyond two warnings | distribution over real runs |
| S6 | **The 8-way retail collision may be worse in production than in fixtures**, since real businesses more often lack a scrapable brand hex | `NEXT_SESSION.md`: 3 of 5 real businesses had no crawlable site | the run manifest from the pending laptop inventory |

---

## J. Unknowns

**9 unknowns.** Each states why it cannot be closed from this repository.

| # | Unknown | Why |
|---|---|---|
| U1 | **Where the brief's nine named artifacts live** (`lib/forge/signature.ts`, Creative Territories, Experience Signature, Restraint Contract, `anti-ai-gate.ts`, `designMemory.ts`, `docs/knowledge/`, distinctness gate, visual critic) | Never in any commit on any ref. Either an unpushed local tree or the Notion design set named canonical at `PROJECT_STATUS.md:5`. |
| U2 | **Whether the prior "visual-critic returns uncertain / distinctness passes with zero reasons" observation is still true** | The components do not exist here; there is nothing to re-test. |
| U3 | **Which ref is the intended production pipeline** | Four refs disagree; `main` has no Director; the Director branch is unmerged and named `copilot/inspect-repository-codebase`. |
| U4 | **What a real `DesignDirective` looks like** | Never generated. No directive artifact exists in any commit; `output/` is gitignored. |
| U5 | **Whether the Director improves or harms output** | Requires a real run. The committed A/B produced 0 complete comparisons. |
| U6 | **Whether openai / gemini / openrouter adapters work** | Never run live (`PROJECT_STATUS.md:161`); no integration tests. |
| U7 | **Whether `VISION_*` is a real configuration surface anywhere** | Zero matches as an identifier on any ref. |
| U8 | **Real per-run cost of enabling the Director** | No cost tracking exists; `AITokenUsage` is captured and discarded. A third model call per run is unmetered. |
| U9 | **Whether `lib/research/` (Hermes) is intended to feed the design pipeline** | It exists on the hermes ref with its own CLI verbs and is **not referenced by `agents/` or by `composeDesign`**. Its relationship to art direction is undocumented. |

---

## K. Evidence

Exact files, functions and commands behind every important conclusion.

### K.1 Branch and history reality

```
git fetch --all --prune
git branch -a -v
git log --all --oneline --decorate
git ls-tree -r --name-only <ref> | grep -i <pattern>          # per ref, per artifact
git log --all --diff-filter=A --name-only --pretty=format:     # every path ever added
git diff --name-status origin/main..origin/copilot/inspect-repository-codebase
```
Established: §A.1 (four refs), §A.2 (nine artifacts never existed), §B.4.

### K.2 Files read in full

`main.ts` · `agents/designDirectorAgent.ts` · `lib/design/directive.ts` ·
`agents/designAgent.ts` · `lib/design/compose.ts` · `lib/design/industries.ts` ·
`lib/design/themes.ts` · `lib/design/layout.ts` · `agents/writerAgent.ts` ·
`agents/businessAnalystAgent.ts` · `agents/lovableAgent.ts` ·
`lib/ai/factory.ts` · `lib/ai/types.ts` · `lib/render/document.ts` ·
`lib/render/html.ts` · `lib/render/write.ts` · `lib/render/fonts.ts` ·
`lib/browser.ts` · `lib/config.ts` · `lib/platform/platform.ts` ·
`scripts/generate-examples.ts` · `scripts/batch-audit.ts` ·
`scripts/ab-replay.ts` · `docs/design-director-v1-ab-test-verification.md` ·
`docs/design-director-v1-ab-test.md` · `docs/design-intelligence-review.md` ·
`PROJECT_STATUS.md` · `NEXT_SESSION.md` · `ROADMAP.md`.

### K.3 The directive-survival experiment

A temporary git worktree was created at the copilot ref, a probe script executed,
then **the worktree and probe were removed** and `git status --porcelain` confirmed
empty. The probe called the real `applyDirective`, `composeDesign` and
`renderSite` — no production file was modified.

```
--- DIRECTIVE FIELDS IN  (11) ---
direction, visualIntent, density, heroIntent, layoutIntent, colorStrategy,
typographyIntent, imageryIntent, accessibilityTarget, rationale, confidence
--- ComposeOptions OUT ---
{"direction":"editorial","accessibilityLevel":"AA"}
surviving fields: 2 / 11
operator override wins: true

--- WHAT THE DIRECTIVE ACTUALLY CHANGED IN WebsiteDesign ---
CHANGED direction     elegant  → editorial
SAME    density       airy     | airy
SAME    hero          editorial| editorial
SAME    footer        minimal  | minimal
SAME    scheme        light    | light
CHANGED brand         #9f5c54  → #a45950
CHANGED accent        #876e2c  → #a25766
CHANGED headingFont   Lora     → Playfair Display
CHANGED imageryTreat  warm     → natural
SAME    a11yTarget    AA       | AA
SAME    variants      (identical)
SAME    order         (identical)
=> 5/12 design fields changed

--- DID THE DIRECTIVE GET WHAT IT ASKED FOR? ---
asked density=dense       got=airy              honoured=false
asked hero=magazine       got=editorial         honoured=false
asked imagery=monochrome  got=natural           honoured=false
asked typography=serif    got=Playfair Display  (character=serif)

--- RENDERED OUTPUT ---
index.html identical: false  (10769B → 10775B)
styles.css identical: false  (75576B → 75309B)
```
Establishes §A.3, §C.1, §C.2, H2, H3.

### K.4 Gate absence

```
git grep -l "<pattern>" <ref> -- '*.ts'    # per ref
patterns → Gate:0  antiAi:0  anti-ai:0  critic:0  distinctness:0  fail(:0  VISION:0
Critic  → lib/design/directive.ts (comment only)
slop    → lib/render/css.ts:32 ("slope", a fluid-scale calculation — false positive)
verdict → scripts/ab-{test,replay,contact-sheet}.ts, scripts/renderer-coverage.ts
grep -n "exitCode\|process.exit\|throw new" scripts/ab-test.ts   → no matches
```
Establishes §A.4, §F.

### K.5 Build and test verification on the Director ref

```
npm run typecheck   → clean (tsc -p tsconfig.test.json, exit 0)
npm test            → # tests 356  # suites 69  # pass 356  # fail 0
```
`test/design/designDirectorAgent.test.ts:5-6` documents its own method: *"No live
API calls. A minimal fake `AIProvider` is constructed per test."* `fakeProvider`
is defined at `:83`. So the suite proves plumbing, **not** model behaviour —
which is why H4 stands despite 356 green tests.

### K.6 Symbols verified to exist

`designDirectorAgent`, `DesignDirectorInput`, `DesignDirectorAgent`,
`DIRECTIVE_SCHEMA`, `SYSTEM_PROMPT`, `buildDesignBrief`, `assertDirectiveShape`,
`direct` (copilot ref); `DesignDirective`, `HeroIntent`, `ColorStrategy`,
`TypographyIntent`, `ImageryIntent`, `applyDirective`, `VALID_DIRECTIONS`,
`VALID_DENSITIES`, `noopLogger` (copilot ref); `DirectorConfig` (copilot ref);
`composeDesign`, `ComposeOptions`, `chooseDirection`, `densityFor`,
`findBrandColor`, `classifyIndustry`, `defaultsFor`, `emphasisFor`,
`INDUSTRY_DEFAULTS`, `themeFor`, `THEMES`, `planLayout`, `chooseHero`,
`chooseVariant`, `supports`, `orderSections`; `renderSite`, `assignIds`,
`renderDocument`, `renderSection`, `renderStylesheet`, `designRules`,
`fontFaceRules`, `fontAssets`, `writeRenderedSite`, `resolveInside`, `safeHref`,
`safeImageUrl`, `escapeText`, `escapeAttribute`, `jsonLd`;
`createAIProvider`, `createAIProviderFactory`, `ADAPTERS`, `AI_PROVIDER_NAMES`;
`groundingWarnings`, `buildWriterBrief`, `buildBrief`, `hourBullets`,
`contactBullets`, `buildStructuredData`, `displayPhone`;
`loadConfig`, `DEFAULTS`, `DEFAULT_MODELS`, `normaliseFlagName`;
`STAGES`, `ARTIFACTS`, `ARTIFACT_KEYS`, `executePipeline`, `runPipeline`,
`resumePipeline`, `renderStandalone`, `persistStage`, `readArtifact`, `step`,
`renderStage`, `contextFor`, `createRun`, `parseArgs`;
`NotImplementedError`, `UpstreamError`, `InvalidInputError`,
`SkillNotImplementedError`, `MCPNotImplementedError`.

---

## L. What must NOT be changed until the laptop inventory is reconciled

These are hold-points, not proposals. Each states the specific risk of acting early.

| # | Do not change | Why |
|---|---|---|
| L1 | **Do not merge `copilot/inspect-repository-codebase` to `main`.** | The Director has never produced a real directive (H4). Merging ships an unexercised third model call. Its value is unmeasured and §I.S2 raises a live truncation risk. Merge after one real run, not before. |
| L2 | **Do not widen `ComposeOptions`.** | This is the obvious fix for H2 and the wrong first move. Widening it lets a model reach density, hero and treatment — the exact levers whose content-based vetoes (`layout.ts:130-164`) currently prevent embarrassing near-empty grids. Widen only behind a QA gate that can fail. |
| L3 | **Do not add a Visual Critic.** | It needs multimodal input, which `AIGenerateRequest` does not have (§G.5). Building it first means building a contract change, a screenshot path and a scoring rubric with no gate to consume the score. |
| L4 | **Do not delete the "unused" design fields** (`density`, `heroIntent`, `imageryIntent`, `typographyIntent`). | They are typed slots the V1 spec reserved deliberately. They cost nothing and removing them would have to be undone. |
| L5 | **Do not change the two hard-coded prompts or the three schemas.** | They are unversioned, untested and hold most of the product's behavioural intelligence. Changing them now makes any before/after comparison uninterpretable. |
| L6 | **Do not enable `DIRECTOR_ENABLED=true` by default.** | Off-by-default is currently the only thing guaranteeing the pipeline behaves as the 248-test `main` suite describes. |
| L7 | **Do not "fix" the stale documents yet** beyond recording the contradictions in §H.1. | X1–X10 are evidence about how the project reasons about itself. They are more useful intact until the Notion set (U1) is reconciled — some may be accurate about a codebase I cannot see. |
| L8 | **Do not touch `agents/designAgent.ts:58-59` as an isolated bug fix.** | X3 is real and live, but it sits on the seam the Director occupies. Fix it once, in whichever ref becomes canonical, rather than three times across three refs. |
| L9 | **Do not build a knowledge loader.** | `docs/knowledge/` does not exist (U1). Building a consumer for absent content, or inventing the content, would fabricate the knowledge base this audit was asked to inventory. |
| L10 | **Do not resolve the four-ref divergence by fiat.** | Which ref is production is a decision only you can make (U3), and it determines what every subsequent change applies to. |

---

## Consistency check

Run against this document before publication.

**1. Every referenced file exists.** Verified per ref — files unique to
`origin/copilot/inspect-repository-codebase` (`agents/designDirectorAgent.ts`,
`lib/design/directive.ts`, `scripts/ab-test.ts`, `scripts/ab-replay.ts`,
`scripts/ab-contact-sheet.ts`, `test/design/designDirectorAgent.test.ts`,
`test/design/directive.test.ts`, `test/design/pipeline-integration.test.ts`, the
ten `docs/design-*` files) are **labelled with their ref everywhere they appear**
and are confirmed absent from `main`. Files unique to the hermes ref
(`lib/research/*`, `docs/research-handoff.md`) are likewise labelled. **PASS.**

**2. Every referenced function/symbol exists.** All symbols in §K.6 were
extracted from the source of the ref they are attributed to. **PASS.**

**3. No claim says "implemented" without a verified call path.** The Director is
called "implemented" only with the three qualifications carried throughout: it is
on one unmerged ref, it is off by default, and 2 of 11 fields survive. Every
gate is recorded as **NOT IMPLEMENTED**. `assertDirectiveShape` is the sole
component described as able to fail a run, and that is scoped explicitly to
malformed output rather than design quality. **PASS.**

**4. No architecture proposal has slipped in.** §L contains only hold-points
phrased as prohibitions with a stated risk. No target architecture, no worker
map, no provider recommendation, no roadmap, no interface, no schema. §G.5
answers the delegation question as a factual capability statement and stops.
**PASS.**

**5. Contradictions reported, not reconciled.** Ten in §H.1, each with both sides
quoted and a severity. None silently resolved. **PASS.**

**6. Unanswerable questions marked UNKNOWN rather than inferred.** The brief's §3
(knowledge consumption of `docs/knowledge/`) and the visual-critic/distinctness
verification in §5 are both reported as unanswerable with the reason, in §A.2,
§D, §F.1 and U1–U2. **PASS.**
