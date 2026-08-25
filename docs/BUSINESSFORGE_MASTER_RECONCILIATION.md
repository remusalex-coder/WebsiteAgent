# BusinessForge — Master Reconciliation

_Canonical as of 2026-08-17T21:30Z. Read-only: no code was modified, nothing was
deleted, no architecture was changed. Supersedes nothing — it reconciles
`BUSINESSFORGE_FULL_AUDIT.md`, `BUSINESSFORGE_TOTAL_FORENSIC_INVENTORY.md` and
`docs/BUSINESSFORGE_DESIGN_PIPELINE_AUDIT.md` into one register and records where
they disagree with each other or with the repository._

**Confidence scale used on every finding:**

| Level | Meaning |
|---|---|
| **VERIFIED** | Executed in this session, or the exact lines read this session |
| **HIGH** | Read directly from source; unambiguous |
| **MEDIUM** | Strong inference from code, not directly observed |
| **LOW** | Weak inference; stated as such |
| **UNKNOWN** | Cannot be established from available sources |

---

## 0. Reconciliation boundary — what this document could and could not cover

You asked me to use `bf-inventory.txt` as the laptop source and to analyse the
Antigravity session that produced yesterday's sites. **Neither input reached
me.** Both are recorded here as absent rather than guessed at.

| Requested source | Status | Evidence | Confidence |
|---|---|---|---|
| `bf-inventory.txt` (laptop) | **NOT RECEIVED** | `find / -name "bf-inventory.txt"` → no result in this container. The script was never on your disk either — you confirmed the only match was a 478-byte `.txt`, which is the PowerShell error from the failed redirect. | **VERIFIED** |
| Repository, all refs | **RECONCILED** | 4 refs fetched, 202 distinct paths compared | **VERIFIED** |
| Output run artifacts | **NONE EXIST** | `find output -name '1-discovery.json'` → **0**. `output/` holds `.gitkeep` plus 53 example folders **I generated myself** this session. `.gitignore:11` excludes `output/*`, so no run has ever been committed. | **VERIFIED** |
| Claude worktrees / artifacts | **CONTAINER ONLY** | This container's `~/.claude` has 2 skills, **0** plugins, **0** agents, **0** commands, **0** hooks. Created fresh 2026-08-11. Says nothing about your laptop. | **VERIFIED** |
| `.gemini` / Antigravity / brain | **DO NOT EXIST IN REPO** | §9 | **VERIFIED** |
| Hermes | **RECONCILED** | `lib/research/` on one ref, 10 files, 2,527 loc | **VERIFIED** |
| n8n / Docker | **DO NOT EXIST IN REPO** | zero matches, all refs, all commits | **VERIFIED** |
| MCP / tool configuration | **PARTIALLY RECONCILED** | repo side complete; laptop side unknown | **VERIFIED / UNKNOWN** |
| `docs/knowledge` | **HAS NEVER EXISTED** | `git log --all --diff-filter=A` → never added on any ref | **VERIFIED** |
| Antigravity session that produced yesterday's sites | **CANNOT BE ANALYSED** | §9 | **VERIFIED (absence)** |

**Consequence.** Sections 1–8 and 10 are a complete, evidence-backed
reconciliation. Section 9 reports what I could not reconcile and exactly what
would close it. I have not inferred a single mechanism I could not observe.

---

## 1. The single most important structural fact

**BusinessForge is not one codebase. It is four refs, three of which contain
work that has never been merged, and two of which will conflict with each other
on merge.**

| Ref | HEAD | Files | Tests | Typecheck | Unique files | What it adds |
|---|---|---|---|---|---|---|
| `origin/main` | `06d3ab1` | 168 | **248 pass** | clean | 0 | the released pipeline |
| `origin/copilot/inspect-repository-codebase` | `31328cf` | 186 | **356 pass** | clean | **18** (8 `.ts`, 10 `.md`) | **Design Director V1** |
| `origin/claude/hermes-architecture-audit-rps5p0` | `0b99389` | 181 | **299 pass** | clean | **13** (11 `.ts`, 2 `.md`) | **Hermes research/evidence layer** |
| `origin/claude/businessforge-full-audit-lg7ctk` | `e06c320` | 170 | 248 pass | clean | **3** (0 `.ts`, 3 `.md`) | the three audit documents |

All four verified by execution this session (`npm test`, `npm run typecheck` in
disposable worktrees, all removed afterwards). **Confidence: VERIFIED.**

`main` has **zero unique files** — every other ref is a strict superset of it.
Nothing has been lost; three bodies of work are simply parked.

---

## 2. Complete asset register

Status vocabulary: **PROVEN** (demonstrated working by execution) · **REAL**
(implemented, not demonstrated end-to-end) · **EXPERIMENTAL** (built to test a
hypothesis) · **ORPHANED** (implemented, nothing calls it) · **DUPLICATE**
(second implementation of an existing capability) · **STUB** (throws) ·
**DEAD** (unreachable) · **ABSENT**.

### 2.1 Pipeline agents

| Component | Location | Ref | What it does | Consumed by | Status | Confidence |
|---|---|---|---|---|---|---|
| `discoveryAgent` | `agents/discoveryAgent.ts` (774) | all | Maps URL → identity, Playwright, consent declined never accepted | `main.ts:336` | **REAL** — never executed live here (no DNS/creds) | HIGH |
| `collectorAgent` | `agents/collectorAgent.ts` (789) | all | crawls ≤6 pages, images from `<img>`+`srcset`+CSS backgrounds, bot-wall detect-and-skip | `main.ts:339` | **REAL** | HIGH |
| `normalizerAgent` | `agents/normalizerAgent.ts` (681) | all | merge + dedupe (phones last-9, images CDN path **and** SHA-256) + validate | `main.ts:342` | **REAL** | HIGH |
| `businessAnalystAgent` | `agents/businessAnalystAgent.ts` (423) | all | LLM #1 → `BusinessStrategy` with per-item evidence | `main.ts:345` | **REAL** | HIGH |
| `writerAgent` | `agents/writerAgent.ts` (1185) | all | LLM #2 → `WebsiteContent`; facts re-injected after generation | `main.ts:348` | **REAL** | HIGH |
| `designDirectorAgent` | `agents/designDirectorAgent.ts` (463) | **copilot** | LLM #3 → `DesignDirective` (11 fields) | `main.ts:363` **when `DIRECTOR_ENABLED=true`** | **EXPERIMENTAL** — never run against a real model | **VERIFIED** |
| `designAgent` | `agents/designAgent.ts` (92/116) | all | wraps `composeDesign`; on copilot also `applyDirective` | `main.ts:351` | **PROVEN** | **VERIFIED** |
| `lovableAgent` | `agents/lovableAgent.ts` (35) | all | — | `main.ts:360` | **STUB — throws `NotImplementedError:33`** | **VERIFIED** |

### 2.2 Deterministic design + render core

| Component | Location | Ref | Status | Evidence | Confidence |
|---|---|---|---|---|---|
| `lib/design/` (8 files, 3,291 loc) | `compose · industries · themes · layout · tokens · color · types · index` | all | **PROVEN** | 51 sites generated and rendered this session; 98.1% of design fields reach the page (`renderer-coverage`, measured) | **VERIFIED** |
| `lib/render/` (13 files, 5,650 loc) | `site · document · sections · variants · css · theme · html · assets · fonts · write · types · fontManifest · index` | all | **PROVEN** | rendered 51 sites + CLI `--render` path executed | **VERIFIED** |
| Font vendoring | `assets/fonts/` 34 woff2 + `lib/render/fonts.ts` | all | **PROVEN** | hotel site ships 5 `@font-face` + 5 woff2 | **VERIFIED** |
| Colour system (OKLCH) | `lib/design/color.ts`, `tokens.ts` | all | **PROVEN** | 17 industry hues, each traced to an anchor colour in source comments | **VERIFIED** |
| Dark colour scheme | `ColorSystem.scheme` type | all | **DEAD** | `tokens.ts:241` hard-codes `'light'`; 51/51 sites light; no CSS reads `[data-scheme]` | **VERIFIED** |
| Motion tokens | `themes.ts:78` `motionEffects` | all | **ORPHANED** | computed, emitted as CSS custom properties, **0 `@keyframes`**, no observer, no `<script>` but JSON-LD | **VERIFIED** |

### 2.3 Design Director V1 (copilot ref only)

| Component | Location | What it does | Consumed by | Status | Confidence |
|---|---|---|---|---|---|
| `DesignDirective` contract | `lib/design/directive.ts` (367) | 11-field closed-vocabulary art-direction contract | `applyDirective` | **REAL** | **VERIFIED** |
| `applyDirective()` | same file | translates directive → `ComposeOptions` | `designAgent.ts` | **REAL but lossy — 2 of 11 fields survive** | **VERIFIED** |
| `DIRECTIVE_SCHEMA` | `agents/designDirectorAgent.ts` | JSON Schema, `additionalProperties:false` | provider | **REAL** | HIGH |
| Director `SYSTEM_PROMPT` | same file | ~20-line art-director brief | provider | **REAL** | HIGH |
| `DirectorConfig` | `lib/config.ts` | `DIRECTOR_ENABLED/MODEL/EFFORT/MAX_OUTPUT_TOKENS/MAX_PAGE_CHARS` | `main.ts` | **REAL — default `enabled:false`** | **VERIFIED** |
| `5a-directive` artifact | written at `main.ts:367` | persisted directive | **nothing** | **ORPHANED** — absent from `STAGES`/`ARTIFACTS`/`ARTIFACT_KEYS`; write-only; `PipelineResult` omits it | **VERIFIED** |
| `scripts/ab-test.ts` (1180) | experiment runner | spawns `main.ts` ×10 | human | **EXPERIMENTAL — all 10 runs failed on DNS** | **VERIFIED** |
| `scripts/ab-replay.ts` (548) | offline replay | uses **hand-authored** `FALLBACK_DIRECTIVES` | human | **EXPERIMENTAL — did not exercise the AI** (`:480-481` "not implemented here") | **VERIFIED** |
| `scripts/ab-contact-sheet.ts` (420) | contact sheets | screenshots | human | **EXPERIMENTAL** | HIGH |
| 10 × `docs/design-director-v1-*.md` | — | spec + 6 verification docs | human | **DOCUMENTATION** — none consumed by code | **VERIFIED** |

**Measured this session** by executing `applyDirective` + `composeDesign` +
`renderSite` on identical inputs:

```
11 directive fields in  →  ComposeOptions out: {"direction":"editorial","accessibilityLevel":"AA"}
surviving: 2 / 11
asked density=dense       got airy         NOT honoured
asked hero=magazine       got editorial    NOT honoured
asked imagery=monochrome  got natural      NOT honoured
design fields changed: 5/12 (direction, brand, accent, headingFont, imageryTreatment)
unchanged: density, hero, footer, scheme, a11y, variants, order
```
**Confidence: VERIFIED.**

### 2.4 Hermes research layer (hermes ref only)

10 files, 2,527 loc. This is a **complete parallel evidence system** that the
earlier audits had not examined in depth.

| File | LOC | What it does | Confidence |
|---|---|---|---|
| `lib/research/types.ts` | 450 | the research handoff contract | HIGH |
| `lib/research/validate.ts` | 555 | "Parsing untrusted research into the contract, and refusing it when…" | HIGH |
| `lib/research/merge.ts` | 276 | folds one research pass into the canonical artifact | HIGH |
| `lib/research/brief.ts` | 295 | artifact → the two pieces of prose the handoff needs | HIGH |
| `lib/research/hermes.ts` | 248 | files the request unconditionally; a transport **may** answer it | HIGH |
| `lib/research/store.ts` | 217 | the only code that writes research to disk | HIGH |
| `lib/research/session.ts` | 211 | the two operations a session performs | HIGH |
| `lib/research/projection.ts` | 103 | **one-way door**: `ResearchArtifact → ResearchProvenance → BusinessProfile` | **VERIFIED** |
| `lib/research/identity.ts` | 90 | deterministic identifiers | HIGH |
| `lib/research/index.ts` | 82 | public surface | HIGH |

**Consumption — verified:** imported by `main.ts` (CLI verbs `--research`,
`--research-apply`, `--research-list`) and `test/research/handoff.test.ts`.
**Not imported by any file in `agents/`, `lib/design/` or `lib/render/`.**

`projection.ts:12-14` states the isolation deliberately: *"Research never edits
the pipeline. Nothing in `lib/research` imports `lib/types.ts`, so a research
pass cannot change a profile, a strategy, a design or a rendered site."*

**Status: REAL, ISOLATED BY DESIGN, NOT WIRED INTO GENERATION.** Confidence: **VERIFIED.**

### 2.5 Platform layer (all refs)

| Component | Location | Status | Confidence |
|---|---|---|---|
| AI provider layer, 4 adapters | `lib/ai/` (11 files) | **REAL** — anthropic proven by inference; openai/gemini/openrouter **never run live** | HIGH / UNKNOWN |
| MCP client (JSON-RPC over HTTP) | `lib/platform/mcp/` (864 loc) | **ORPHANED** — real `initialize`/`tools/list`/`tools/call`; `MCP_SERVERS` commented out at `.env.example:108`; no agent references `platform.mcp` | **VERIFIED** |
| MCP stdio transport | `stdioConnector.ts:70` | **STUB — throws** | **VERIFIED** |
| Skill subsystem machinery | `lib/platform/skills/` (1,063 loc) | **ORPHANED** — `SKILLS_DIR` commented out at `.env.example:98`; no agent references `platform.skills` | **VERIFIED** |
| 38 built-in skills | `skills/builtin/` (8 files) | **STUB ×38** — all throw `SkillNotImplementedError` | **VERIFIED** |
| Telemetry | `lib/platform/telemetry.ts` | **REAL but volatile** — in-process ring buffer, discarded at exit | HIGH |
| Cost tracking | — | **ABSENT** — `AITokenUsage` captured then discarded; no price table, no cap | **VERIFIED** |

### 2.6 Gates, QA, memory

| Capability | Status | Evidence | Confidence |
|---|---|---|---|
| Anti-AI gate | **ABSENT** | 0 matches, all refs, all commits | **VERIFIED** |
| Distinctness gate | **ABSENT** | 0 matches | **VERIFIED** |
| Visual critic | **ABSENT** | `Critic` appears once, in a comment | **VERIFIED** |
| Repair loop | **ABSENT** | 0 matches | **VERIFIED** |
| Any gate that can fail a run on quality | **ABSENT** | `ab-test.ts` computes a verdict with no `process.exit`/`throw` | **VERIFIED** |
| QA measurement | **EXISTS, OUTSIDE PIPELINE** | `scripts/batch-audit.ts:114-144`; zero internal callers; no thresholds | **VERIFIED** |
| `output/scores.json` | **MISSING PRODUCER** | read by `build-review.ts:4`, written by nothing → hand-authored | **VERIFIED** |
| Cross-run memory / designMemory | **ABSENT** | no such module; `output/` gitignored | **VERIFIED** |
| Deployment | **ABSENT** | the stub | **VERIFIED** |

---

## 3. Three parallel systems that do not know about each other

This is the reconciliation's central finding and it is new — no previous
document states it, because each examined one ref.

```
origin/main  ──────────────────────────────────────────────  the released pipeline
   │
   ├── origin/copilot/…      DESIGN INTELLIGENCE
   │     designDirectorAgent + DesignDirective + applyDirective
   │     touches: main.ts, lib/config.ts, agents/designAgent.ts
   │     answers: "what should this site look like?"
   │
   └── origin/claude/hermes…  EVIDENCE / TRUTH
         lib/research/ (10 files) + CLI verbs
         touches: main.ts, lib/config.ts
         answers: "what do we actually know about this business?"
```

**Neither branch references the other. Neither is merged. Both modify the same
two files.**

| Fact | Evidence | Confidence |
|---|---|---|
| Both branch off the same base | `git merge-base` → `06d3ab1` (= `main`) | **VERIFIED** |
| Both modify `main.ts` and `lib/config.ts` | `comm -12` on their diff file lists | **VERIFIED** |
| **`lib/config.ts` is predicted to CONFLICT** | `git merge-tree 06d3ab1 <copilot> <hermes>` reports `changed in both` for `lib/config.ts` | **VERIFIED** |
| Divergent `main.ts` growth | copilot +26 lines; hermes **+264** lines | **VERIFIED** |
| Neither mentions the other | `designDirectorAgent`/`directive` = 0 matches on hermes ref; `research`/`hermes` = 0 matches on copilot ref | **VERIFIED** |

**Implication (MEDIUM confidence, stated as inference):** merging these in
either order requires a manual `lib/config.ts` resolution, and very likely a
`main.ts` one, because both insert into the same config interface, the same
`loadConfig` return object, and the same pipeline region. The longer both sit
unmerged, the more expensive that becomes. This is a scheduling fact, not a
defect in either branch.

---

## 4. Duplication register

| # | Capability | Implementation A | Implementation B | Verdict | Confidence |
|---|---|---|---|---|---|
| D1 | **Evidence / provenance** | `writerAgent` structural anti-invention + `groundingWarnings` (`:917`) + `Attributed<T>` in `lib/types.ts:221` — **on all refs** | `lib/research/` `ResearchArtifact` → `projection.ts` → `ResearchProvenance` — **hermes ref only** | **TWO INDEPENDENT ANSWERS TO THE SAME PROBLEM.** Different vocabularies (`{value,source,sourceUrl,alternatives}` vs `verified/corroborated/inferred/unknown/conflicted`), neither aware of the other. Reconciling them is a real design decision that has not been made. | **VERIFIED** |
| D2 | Browser automation | `lib/browser.ts` (real Playwright) | `playwright` + `browser-automation` placeholder skills | placeholder skills are naming hazards over working code | **VERIFIED** |
| D3 | Deployment | `lovableAgent` stub | `deployment` + `lovable` placeholder skills | three names, zero implementations | **VERIFIED** |
| D4 | SEO | writer produces SEO metadata + JSON-LD | `seo` placeholder skill | duplicate id over working code | **VERIFIED** |
| D5 | Stage artifacts | each agent writes its own (`discovery.json`, `collector.json`, `business.json`, `strategy.json`, `content.json`) | `main.ts` writes numbered copies (`1-discovery.json`…) | **every stage writes twice; only the numbered copy is read** by `readArtifact` | **VERIFIED** |
| D6 | Design Director naming | `designDirectorAgent` | "Design Brain" in `docs/design-architecture-gap-analysis.md` | **same thing, two names.** "Brain" is not a separate subsystem — 8 occurrences, all in copilot docs/tests describing the Director | **VERIFIED** |
| D7 | Screenshot capability | `PageHandle.screenshot` (`browser.ts:240`) | `scripts/batch-audit.ts`, `ab-replay.ts`, `ab-contact-sheet.ts`, `screenshot-examples.ts` each drive Chromium themselves | the abstraction exists and **no product code calls it**; four scripts reimplement around it | **VERIFIED** |

---

## 5. Orphan register — built, working, connected to nothing

| # | Asset | Location | Why orphaned | Confidence |
|---|---|---|---|---|
| O1 | MCP client, 864 loc | `lib/platform/mcp/` | `MCP_SERVERS` commented out; no agent calls `platform.mcp` | **VERIFIED** |
| O2 | Skill manager, 1,063 loc | `lib/platform/skills/` | `SKILLS_DIR` commented out; no agent calls `platform.skills`; all 38 entries throw | **VERIFIED** |
| O3 | `lib/ai/index.ts` | 24 loc barrel | **zero importers**; its docstring claims "Agents import from here" — they import `ai/types.js` type-only | **VERIFIED** |
| O4 | `PageHandle.screenshot` | `browser.ts:240` | no product code calls it | **VERIFIED** |
| O5 | Motion tokens | `themes.ts:78` | emitted to CSS, nothing consumes them | **VERIFIED** |
| O6 | Analyst capability recommendations | `backendModules`, `frontendModules`, `pages`, `features` | produced with rationale + evidence by a paid model call; only `features[].title` reaches a prose line | **VERIFIED** |
| O7 | `5a-directive` artifact | `main.ts:367` | write-only; not in `STAGES`/`ARTIFACTS`; not in `PipelineResult` | **VERIFIED** |
| O8 | `LovableConfig` (4 vars) | `lib/config.ts:552-557` | parsed, never read | **VERIFIED** |
| O9 | `lib/research/` | hermes ref | reachable only via CLI verbs; not wired into generation | **VERIFIED** |
| O10 | Token usage | `AITokenUsage` | captured by every adapter, logged at debug, discarded | **VERIFIED** |
| O11 | `Attributed<T>` provenance | `lib/types.ts:221` | flattened to prose in `buildWriterBrief`; `WebsiteSection` is 6 plain strings | **VERIFIED** |
| O12 | 10 credentials in `.env.example` | `GOOGLE_MAPS_API_KEY`, `FIRECRAWL_API_KEY`, `CMS/EMAIL/PAYMENTS/CALENDAR/SOCIAL/SEARCH_API_KEY`, `DATABASE_URL`, `GITHUB_TOKEN` | every capability they credential is a stub | **VERIFIED** |

---

## 6. What has demonstrated it works

Only these. Everything else is implemented-but-undemonstrated, or absent.

| # | Capability | How demonstrated | Confidence |
|---|---|---|---|
| P1 | Deterministic design composition | 51 fixtures → 51 `WebsiteDesign` objects, this session | **VERIFIED** |
| P2 | Rendering to a static site | 51 sites written; `index.html` + `styles.css` + assets + fonts | **VERIFIED** |
| P3 | Render CLI path | `npm run render -- <content.json>` produced `site/index.html` | **VERIFIED** |
| P4 | Design-token reach | `renderer-coverage`: 132 visual fields, 127 used, 5 partial, **0 ignored = 98.1%** | **VERIFIED** |
| P5 | Variants are real markup | DOM tag-skeletons differ per variant (`feature-grid` `ul>li>span+h3` vs `quotes` `ul>li>figure>blockquote`) | **VERIFIED** |
| P6 | Layout plan reaches the DOM | design plan order == DOM order; `data-frame`/`data-emphasis`/`data-variant` all emitted | **VERIFIED** |
| P7 | Font vendoring | 5 `@font-face` + 5 woff2 per site, no external request | **VERIFIED** |
| P8 | Test suites | main 248 · hermes 299 · copilot 356; all pass, typecheck clean | **VERIFIED** |
| P9 | Screenshot capture | Chromium rendered generated sites at 1440×1000 | **VERIFIED** |
| P10 | `applyDirective` adapter | executed; deterministic; operator override wins | **VERIFIED** |
| P11 | Deploy stage fails | `lovableAgent.run` executed → `NotImplementedError` | **VERIFIED** |

**Never demonstrated:** live discovery/collection (no DNS or creds here), any
live model call, the Design Director end-to-end, deployment, and the
openai/gemini/openrouter adapters.

---

## 7. Design pipeline — reconciled

Definitive answer to where design comes from, across all refs.

| Ref | Design decided by | External model involved? | Confidence |
|---|---|---|---|
| `main` | `composeDesign()` — pure function of `(profile, strategy, content)` | **No.** `designAgent.ts:9-13` states it makes no model call by design | **VERIFIED** |
| `copilot`, `DIRECTOR_ENABLED=false` (default) | identical to `main` | **No** | **VERIFIED** |
| `copilot`, `DIRECTOR_ENABLED=true` | `composeDesign()` with `direction` + `accessibilityLevel` supplied by a model | **Yes, for 2 of 11 fields** | **VERIFIED** |

**Industry classification owns five of six design inputs on every ref:**

| Industry-derived input | Consumed at | Director can override? |
|---|---|---|
| `density` | `compose.ts:349` | **NO** |
| `fallbackHue` | `compose.ts:369` | **NO** |
| `imageReliance` | `compose.ts:390` | **NO** |
| `prioritySections` | `layout.ts:375`, `industries.ts:451` | **NO** |
| `variantHints` | `layout.ts:181` | **NO** |
| `directions` | `compose.ts:137` | **YES** — the only one |

**Earliest generic-design injection point: `classifyIndustry()`,
`lib/design/industries.ts:359`** — unchanged by the Director. Confidence: **VERIFIED.**

Measured collision (51 synthetic fixtures): **24 distinct visual systems**, one
8-way tie across `retail`. Variant distribution starved — `bento` fires **2**,
`masonry` **3**, `hero-split` **32 of 51 (63%)**. Confidence: **VERIFIED** for
fixtures; **UNKNOWN** for real businesses (no run artifacts exist).

---

## 8. Knowledge, n8n, Docker, MCP — final status

| Subject | Status | Evidence | Confidence |
|---|---|---|---|
| `docs/knowledge/` | **NEVER EXISTED** | `git log --all --diff-filter=A --name-only` | **VERIFIED** |
| Documents consumed by code | **ZERO of 21** | no `readFile`/`import` in `agents/` or `lib/` resolves under `docs/` | **VERIFIED** |
| Documents reaching an LLM | **ZERO** | the three brief-builders read pipeline artifacts, never files | **VERIFIED** |
| n8n | **ABSENT from repo** | 0 matches, all refs, all commits | **VERIFIED** |
| Docker | **ABSENT from repo** | 0 matches; no Dockerfile/compose | **VERIFIED** |
| MCP servers configured | **ZERO** | `.env.example:108` `MCP_SERVERS` commented out | **VERIFIED** |
| MCP client capability | **REAL, unused** | O1 | **VERIFIED** |
| n8n/Docker on the laptop | **UNKNOWN** | requires `bf-inventory.txt` | **UNKNOWN** |

---

## 9. Antigravity — cannot be reconciled

You asked me to analyse the Antigravity session that produced yesterday's sites
and identify process differences explaining the design-quality change. **I have
no access to any Antigravity artifact and will not construct an explanation
without one.**

### 9.1 What I searched

| Search | Result | Confidence |
|---|---|---|
| `antigravity` in tracked filenames, all 4 refs | **0** | **VERIFIED** |
| `antigravity` in file **content**, all refs | **0** | **VERIFIED** |
| Any path ever added matching `antigrav`, full history | **0** | **VERIFIED** |
| `brain` | 8 hits, **all** in copilot docs/tests as "Design Brain" = the Director | **VERIFIED** |
| `.gemini` directory | **0** | **VERIFIED** |
| `gemini` | only `lib/ai/providers/gemini.ts` (the AI adapter) | **VERIFIED** |
| Run artifacts in `output/` | **0** `1-discovery.json` | **VERIFIED** |
| Session logs / transcripts in repo | **0** | **VERIFIED** |

### 9.2 What this rules out and what it does not

**Rules out (VERIFIED):** that Antigravity's output was produced *by this
repository's committed pipeline*, or that any Antigravity configuration,
prompt, output or session record is committed anywhere.

**Does not rule out (UNKNOWN):** that Antigravity ran on your laptop against a
local working tree, or entirely outside this codebase. I cannot distinguish
these, and the distinction matters enormously — it decides whether "yesterday's
sites" are evidence about BusinessForge at all.

### 9.3 One thing I can say without the artifacts

If yesterday's sites were materially better and were produced by *this*
codebase, then given §7 the only levers that could have changed the design are:

1. `direction` — via `FEATURE_design-direction-*` or a directive, and
2. `accessibilityLevel`.

**Everything else in `WebsiteDesign` is a pure function of the inputs.** So
either the design levers were not the cause (the *content* was better — richer
profile, more images, better copy, which unlocks the starved rich variants in
§7), or the sites were not produced by this codebase.

Confidence: **MEDIUM**, and it is an elimination argument from verified
determinism, not an observation. **I am not asserting which.**

### 9.4 What would close this

Any one of: a run directory with `5b-design.json`; the generated `index.html` +
`styles.css`; the Antigravity session transcript or prompt; or simply the URL /
folder of the two sites. With a `5b-design.json` I can state in one pass whether
this pipeline produced it, and which ref.

---

## 10. Contradiction register

Carried forward and re-verified. Reported, not reconciled.

| # | Claim | Reality | Confidence |
|---|---|---|---|
| X1 | `README.md:3` "one deployed website out"; `NEXT_SESSION.md:10` "works end to end" | deploy throws; every full run exits non-zero | **VERIFIED** |
| X2 | `PROJECT_STATUS.md:53` "stage 4 ✅ verified live" | `:151` "Stage 4's live call has **never run**" — same file | **VERIFIED** |
| X3 | `PROJECT_STATUS.md:178-180` "No web fonts" | 34 woff2 vendored, `@font-face` emitted | **VERIFIED** |
| X4 | `PROJECT_STATUS.md:192` / `architecture.md:112` "110 assertions" | 248 / 299 / 356 by ref | **VERIFIED** |
| X5 | `docs/renderer.md:296` "Five suites in `test/render/`" | six | **VERIFIED** |
| X6 | `docs/folder-structure.md` | **zero** mentions of `lib/design` (3,291 loc); `BULLET_LAYOUTS` pointed at wrong file | **VERIFIED** |
| X7 | `ab-replay.ts:20-22` "the real `designDirectorAgent` is used instead" | `:480-481` "not implemented here" — same file | **VERIFIED** |
| X8 | `docs/design-director-v1-ab-test.md` presented as results | 10/10 runs failed; all metrics `-`; 0/0/0 verdicts | **VERIFIED** |
| X9 | `designAgent.ts:49-51` promises an unrecognised direction "is ignored with a warning" | `:58-59` casts unvalidated → `THEMES[undefined]` crash. **All refs.** | **VERIFIED** |
| X10 | `docs/design-intelligence-review.md` "Top 10 improvements" | items 1, 2, 3, 4, 6 are **done**; document doesn't say so | **VERIFIED** |
| X11 | `lib/ai/index.ts` "Agents import from here" | zero importers | **VERIFIED** |
| X12 | `vendor-fonts.ts:7` "base64-inlines" | copies files, references by URL | **VERIFIED** |

---

## 11. What is still missing

Ordered by how much each unblocks.

| # | Missing | Blocks | How to obtain |
|---|---|---|---|
| M1 | **`bf-inventory.txt`** | all 13 laptop unknowns: OS, tooling, Docker, n8n, MCP config, Claude/Gemini/Antigravity config, ports, services, `.env` contents, other projects | run the attached `bf-inventory.ps1`; paste the output |
| M2 | **Any real run directory** | whether real businesses collide like the 51 fixtures; which ref produced them; whether a `5a-directive.json` has ever existed | `output/<runId>/` from the laptop |
| M3 | **Antigravity artifacts** | §9 entirely | session transcript, or the two sites, or a `5b-design.json` |
| M4 | **Which ref is production** | every prioritisation decision | your call |
| M5 | **One live Director run** | whether the Director helps or harms; whether 4,000 tokens suffice | `DIRECTOR_ENABLED=true` + a key, one business |
| M6 | **BusinessForge HQ (Notion) contents** | where `signature.ts`, Creative Territories, Restraint Contract, anti-ai-gate, designMemory live — named in your briefs, absent from all refs | Notion access, or export |
| M7 | **Live openai/gemini/openrouter calls** | 3 of 4 adapters unproven | one call each |
| M8 | **axe / Lighthouse numbers** | real accessibility and performance state | run against `output/examples/hotel/index.html` |

---

## Consistency check

| Check | Result |
|---|---|
| Every referenced file exists on the ref claimed | **PASS** — verified per ref; ref labels carried on every non-`main` path |
| Every referenced symbol exists | **PASS** — verified in prior audit and unchanged |
| No claim of "works" without execution | **PASS** — §6 lists only executed demonstrations; everything else is REAL/EXPERIMENTAL/UNKNOWN |
| No mechanism asserted that could not be verified | **PASS** — §9.3 is explicitly labelled an elimination argument at MEDIUM confidence |
| No architecture proposal | **PASS** — no target architecture, worker map, roadmap, interface or schema is proposed |
| Nothing deleted, no code modified | **PASS** — `git status --porcelain` empty apart from this new file; both temporary worktrees removed |
| Contradictions reported not reconciled | **PASS** — §10, twelve entries |
| Absent inputs recorded as absent | **PASS** — §0 and §9 |
