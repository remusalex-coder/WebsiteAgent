# Design Architecture Gap Analysis

_Produced: 2026-08-09_

## Scope

This document covers only the design system:

- `agents/designAgent.ts`
- `lib/design/` (compose, color, layout, themes, tokens, industries, types, index)
- `lib/render/` (site, theme, css, document, sections, assets, fonts, write, types)
- `lib/types.ts` (pipeline contracts relevant to design stages)
- `test/design/` and `test/render/`

It compares the current implementation against the following target architecture:

```
Design Brain
→ Design Director
→ Design Agent
→ Renderer
→ Screenshot/Browser QA
→ Visual Critic
→ Autonomous Repair Loop
→ Design Memory
```

**Architectural principle:** The existing deterministic Design Agent and Renderer are not replaced. An AI Design Brain / Design Director makes higher-level decisions; the existing deterministic pipeline executes those decisions predictably.

---

## A. Current Design Architecture

The existing system is a two-layer deterministic pipeline at design/render time.

```
BusinessProfile + BusinessStrategy + WebsiteContent
  │
  ▼
composeDesign()          [lib/design/compose.ts]
  ├─ classifyIndustry()  [lib/design/industries.ts]
  ├─ chooseDirection()   (keyword-scored against a closed 11-direction enum)
  ├─ themeFor()          [lib/design/themes.ts]
  ├─ buildColorSystem()  [lib/design/tokens.ts]
  ├─ buildTypography()
  ├─ buildSpacing / buildRadius / buildElevation / buildMotion()
  └─ planLayout()        [lib/design/layout.ts]
        └─ chooseHero / chooseVariant / orderSections
  │
  ▼
WebsiteDesign            [lib/design/types.ts]
  (version:1, personality, industry, tokens, layout,
   imagery, icons, responsive, accessibility, notes)
  │
  ▼
designAgent              [agents/designAgent.ts]
  (Stage 5b: calls composeDesign; reads an optional direction
   override from a feature flag via directionOverride())
  │
  ▼
renderSite(content, { design })   [lib/render/site.ts]
  ├─ themeFromDesign()            [lib/render/theme.ts]
  ├─ renderSection()              [lib/render/sections.ts]
  ├─ renderDocument()             [lib/render/document.ts]
  └─ renderStylesheet()           [lib/render/css.ts]
  │
  ▼
RenderedSite  { files[], assets[], fonts[], warnings[] }
  │
  ▼
writeRenderedSite()               [lib/render/write.ts]
  → disk: index.html + styles.css + assets
```

### Key properties enforced today

- `composeDesign` is a pure function: no clock, no randomness, no network, no model call. Byte-identical output from identical inputs. Fully snapshot-testable.
- `designAgent.run()` is the thinnest possible wrapper: it adds logging and the feature-flag direction override, and nothing else.
- The seam for AI direction is already cut: `ComposeOptions.direction?: DesignDirection` accepts an override, and `directionOverride()` reads it from a feature flag (`design-direction-<name>`).
- `renderSite` accepts `design` as an optional argument. Without it, it falls back to the legacy `BrandVoice`-derived `resolveTheme()` path. Backward compatibility is explicit and tested.
- Test coverage: 5 files in `test/design/` (determinism, colour, compose, industries, palette) + 6 files in `test/render/`.

---

## B. Target Architecture

```
BusinessProfile + BusinessStrategy + WebsiteContent
  │
  ├─→ [AI Design Brain / Design Director]   ← NEW
  │     model call → DesignDirective        ← NEW type
  │
  ▼
composeDesign(input, directive)             ← unchanged; directive extends ComposeOptions
  → WebsiteDesign                           ← unchanged type (version stays 1)
  │
  ▼
designAgent                                 ← unchanged orchestration role
  │
  ▼
renderSite(content, { design })             ← unchanged
  → RenderedSite
  │
  ▼
writeRenderedSite(site, { targetDir })      ← unchanged
  │
  ▼
[Screenshot / Browser QA]                  ← NEW
  PageHandle → QAResult { screenshots[], a11ySnapshot, warnings[] }
  │
  ▼
[Visual Critic]                             ← NEW
  model call: WebsiteDesign + QAResult → VisualCritiqueResult
  │
  ├─ score ≥ threshold or maxIterations → exit loop
  │
  └─ else → feed critique back to Design Director → repeat
  │
  ▼
[Design Memory]                             ← NEW
  persist(industry, direction, directive, critiqueResult)
```

---

## C. Exact Gaps

### Gap 1 — AI Design Brain / Design Director

**What exists:**
- `ComposeOptions.direction?: DesignDirection` is the cut seam.
- `directionOverride()` in `designAgent.ts` reads one value from a feature flag.

**What is missing:**
- An agent (`DesignDirectorAgent`) that makes a model call and produces a structured `DesignDirective` — richer than a single direction name.
- A `DesignDirective` type that carries: chosen direction, accent hue hint, hero preference, density bias, accessibility level, and a rationale for each choice.
- `ComposeOptions` currently exposes only `direction` and `accessibilityLevel` as AI-settable knobs; other dimensions (accent colour seed, hero variant hint, density override) are not yet addressable.

**What can be reused:**
- `ComposeOptions` as the base interface; `DesignDirective` extends it.
- `directionOverride()` logic (or its replacement in the new agent).
- `DESIGN_DIRECTIONS`, `HERO_VARIANTS`, `INDUSTRIES` closed-enum exports for schema validation.
- `AIProvider.generate()` + structured output machinery already used by every other AI agent.

**What needs a new module:**
- `agents/designDirectorAgent.ts` — the model call, the prompt, the schema.
- `lib/design/directive.ts` — the `DesignDirective` type.

**Contracts that must remain unchanged:**
- `ComposeOptions` current fields (`direction`, `accessibilityLevel`).
- `composeDesign` function signature (add optional fields to `ComposeOptions`, never remove).
- `WebsiteDesign` type and `version: 1`.

**Contracts that would need extension:**
- `ComposeOptions`: add `accentHex?`, `heroHint?`, `densityBias?` (all optional).
- `designAgent.ts`: pass a `DesignDirective` through instead of only a direction string.

---

### Gap 2 — Design Director → composeDesign integration point

**What exists:**
- `ComposeOptions` is exactly the right integration surface. It is accepted by `composeDesign`, which branches deterministically on each field.
- The `override` path in `chooseDirection()` shows the pattern: an external value becomes a fixed input; everything downstream stays deterministic.

**What is missing:**
- `ComposeOptions` only exposes two knobs. The other dimensions the Director could usefully decide (colour seed, hero preference, density, imagery reliance) are internal to `composeDesign` and not yet externally settable.

**Cleanest integration point:**
`composeDesign(input, directive)` where `directive` is a superset of `ComposeOptions`. The AI Director's output flows in as a plain data object; the function's pure logic takes it from there. No agent code enters the compose layer.

---

### Gap 3 — Screenshot / Browser QA

**What exists:**
- `lib/browser.ts` already abstracts Playwright behind `PageHandle` (navigate, screenshot, text, exists, a11y). Playwright Chromium is vendored.
- `AgentContext.getBrowser()` makes the session injectable and testable.
- `RenderedSite` produces the complete file set; `writeRenderedSite` places it on disk.

**What is missing:**
- A QA module that opens the rendered `index.html` via `file://` (or a local HTTP server), captures a full-page screenshot and an accessibility tree snapshot, and packages the result.
- No `QAResult` type, no module for this stage.

**What can be reused:**
- `PageHandle.screenshot()`, `PageHandle.goto()`, the full browser abstraction.
- `AgentContext.getBrowser()` — no new browser setup needed.
- `RenderedSite.warnings[]` pattern for surfacing non-fatal issues.

**What needs a new module:**
- `lib/qa/screenshot.ts` — navigates the rendered site, captures artefacts, returns `QAResult`.
- `lib/qa/types.ts` — `QAResult { screenshots: Buffer[], a11ySnapshot: string, warnings: string[] }`.

**Contracts unchanged:** `RenderedSite`, `PageHandle`, `BrowserSession`.

---

### Gap 4 — Visual Critic

**What exists:**
- `AIProvider.generate()` with structured JSON output is fully operational.
- `WebsiteDesign.notes[]` and `RenderedSite.warnings[]` show the established pattern for non-fatal issue surfacing.
- `WebsiteDesign` is a rich, self-describing decision document (personality, tokens, layout, imagery, icons, accessibility) — exactly what a critic needs as a reference.

**What is missing:**
- `VisualCriticAgent` — the model call, the critique prompt, the response schema.
- `VisualCritiqueResult` type — structured critique: per-dimension issues, overall score, improvement hints keyed to `DesignDirective` fields.

**What can be reused:**
- Every existing AI provider + structured output pattern.
- `WebsiteDesign` as the design-intent reference (passed to the critic directly — no renderer internals cross the boundary).

**What needs a new module:**
- `agents/visualCriticAgent.ts`.
- `VisualCritiqueResult` added to `lib/qa/types.ts`.

**Decoupling the Visual Critic from renderer internals:**
The critic receives `WebsiteDesign` (the decision document) plus `QAResult.screenshots`. It evaluates visual output against design intent without importing anything from `lib/render/`. The only shared type is `WebsiteDesign`, which is already stable and versioned. The critic never sees HTML or CSS.

**Contracts unchanged:** `WebsiteDesign`, `RenderedSite`, `lib/render/*` — all untouched.

---

### Gap 5 — Autonomous Repair Loop

**What exists:** Nothing. No loop, no retry logic, no convergence check anywhere in the pipeline.

**What is missing:**
- An orchestration layer (`lib/design/repairLoop.ts`) that:
  - Calls the Design Director.
  - Runs `composeDesign` → `designAgent` → `renderSite` → `writeRenderedSite` → QA → Visual Critic.
  - Checks `VisualCritiqueResult.overallScore` against a threshold.
  - Feeds the critique back to the Design Director as additional context for the next iteration.
  - Enforces a `maxIterations` ceiling and exits with the best result seen.

**What can be reused:**
- All existing pipeline stages as-is.
- `AbortSignal` from `AgentContext` for cancellation.

**What needs a new module:**
- `lib/design/repairLoop.ts` — the loop orchestrator. It calls existing agents and modules; it adds no business logic of its own.

---

### Gap 6 — Design Memory

**What exists:** Per-run artifact files under `output/<runId>/` (JSON snapshots). No cross-run persistence for design decisions.

**What is missing:**
- A store (`lib/design/memory.ts`) keyed by `(industry, direction)` that records which `DesignDirective` + `VisualCritiqueResult` pairs have been observed.
- A recall interface so the Design Director can seed its prompt with what worked for similar businesses.

**What needs a new module:**
- `lib/design/memory.ts` — read/write interface; storage format (flat JSON file or SQLite, to be decided). No agent changes required to wire it in.

---

## D. Recommended Module Boundaries

| Module | Location | Responsibility |
|---|---|---|
| `DesignDirective` type | `lib/design/directive.ts` | Superset of `ComposeOptions`; the AI Director's output and `composeDesign`'s richer input |
| `DesignDirectorAgent` | `agents/designDirectorAgent.ts` | AI model call → `DesignDirective` |
| `QAResult` / `VisualCritiqueResult` | `lib/qa/types.ts` | Contracts for QA and critique stages |
| `ScreenshotQA` | `lib/qa/screenshot.ts` | Playwright → `QAResult` |
| `VisualCriticAgent` | `agents/visualCriticAgent.ts` | Model call: `WebsiteDesign` + `QAResult` → `VisualCritiqueResult` |
| `DesignRepairLoop` | `lib/design/repairLoop.ts` | Orchestrates Director → compose → render → QA → critic → exit/retry |
| `DesignMemory` | `lib/design/memory.ts` | Persist and recall `DesignDirective` + `VisualCritiqueResult` by key |

**Nothing in the following files needs to change to implement any of the above:**
- `lib/design/compose.ts` (except adding optional fields to `ComposeOptions`)
- `lib/design/types.ts`
- `lib/render/*`
- `agents/designAgent.ts`
- Any existing test file

---

## E. Recommended Data Flow

```
DesignInput { profile, strategy, content }
  │
  ├─→ [DesignDirectorAgent]
  │     reads: profile.category, strategy.goals, content.voice, content.sections
  │     optionally reads: DesignMemory.recall(industry, category)
  │     model.generate(prompt, DesignDirectiveSchema)
  │     → DesignDirective {
  │         direction?: DesignDirection,
  │         accentHex?: string,
  │         heroHint?: HeroVariant,
  │         densityBias?: VisualDensity,
  │         accessibilityLevel?: 'AA' | 'AAA',
  │         rationale: string
  │       }
  │
  ▼
composeDesign(input, directive)
  (deterministic; directive becomes a set of fixed inputs,
   not a running process; missing fields use existing inference)
  → WebsiteDesign  (version: 1, unchanged shape)
  │
  ▼
designAgent (unchanged wrapper: logging + ctx plumbing)
  │
  ▼
renderSite(content, { design })   (unchanged)
  → RenderedSite
  │
  ▼
writeRenderedSite(site, { targetDir })   (unchanged)
  → disk files
  │
  ▼
[ScreenshotQA]
  ctx.getBrowser() → PageHandle
  PageHandle.goto('file://.../index.html')
  → QAResult {
      screenshots: Buffer[],   // full-page, mobile + desktop
      a11ySnapshot: string,
      warnings: string[]
    }
  │
  ▼
[VisualCriticAgent]
  inputs:
    WebsiteDesign  (design intent — no renderer internals)
    QAResult.screenshots
    QAResult.warnings
  model.generate(critique prompt, VisualCritiqueResultSchema)
  → VisualCritiqueResult {
      issues: { dimension: string, description: string, severity: 'high'|'medium'|'low' }[],
      overallScore: number,       // 0–10
      improvementHints: string[]  // keyed to DesignDirective fields
    }
  │
  ├─ overallScore ≥ threshold OR iteration ≥ maxIterations → exit loop, return best result
  │
  └─ else → [DesignRepairLoop] feeds critiqueResult back to DesignDirectorAgent
               as additional context in the next iteration's prompt
  │
  ▼
[DesignMemory].record(industry, direction, directive, critiqueResult)
```

---

## F. Smallest Safe First Implementation Step

**Extend `ComposeOptions` with one AI-settable field: `accentHex`.**

### Why this is the right first step

1. The seam already exists (`ComposeOptions`, consumed by `composeDesign`). No new module boundaries are required.
2. It proves the integration point end-to-end: an AI-supplied value becomes a deterministic design input, without touching any existing agent, rendered output, or test.
3. It is fully reversible: when `accentHex` is absent, `composeDesign` behaves byte-identically to today. Every existing snapshot test continues to pass without modification.
4. It makes the Design Director a testable concept immediately: a stub that returns `{ direction: 'elegant', accentHex: '#2d6a4f' }` can be verified against a composed design before any model call is wired up.
5. No existing contract changes: `WebsiteDesign`, `RenderedSite`, `designAgent`, and `renderSite` are all unaffected for any caller that does not pass the new field.

### Concretely

- Add `readonly accentHex?: string | undefined` to `ComposeOptions` in `lib/design/compose.ts`.
- In `composeDesign`, pass `options.accentHex` to `buildColorSystem` as a seed override, falling back to `findBrandColor()` when absent.
- Add one test asserting that a supplied `accentHex` survives into `design.tokens.color.ramps.primary.seed` and that omitting it leaves the existing behaviour unchanged.

This single change is the foundation everything else plugs into. It costs no new files beyond the test, no new dependencies, and no modification of any existing agent or rendered output.

---

## Component-level Summary

| Component | Exists | Missing | Reusable | New Module | Unchanged Contracts | Extended Contracts |
|---|---|---|---|---|---|---|
| Design Director | Seam only (`direction` flag) | Agent, `DesignDirective` type, richer knobs | `AIProvider`, `DESIGN_DIRECTIONS` enums, `directionOverride` pattern | `agents/designDirectorAgent.ts`, `lib/design/directive.ts` | `ComposeOptions` existing fields, `WebsiteDesign`, `designAgent` | `ComposeOptions` + optional fields |
| Design Agent | ✅ Complete | — | — | — | `DesignInput`, `DesignAgent` interface, `composeDesign` call | None |
| Renderer | ✅ Complete | — | — | — | `renderSite`, `RenderedSite`, `writeRenderedSite`, `themeFromDesign` | None |
| Screenshot / Browser QA | Browser abstraction only | QA agent, `QAResult` type | `PageHandle`, `getBrowser()`, Playwright | `lib/qa/screenshot.ts`, `lib/qa/types.ts` | `PageHandle`, `BrowserSession`, `RenderedSite` | None |
| Visual Critic | None | Agent, `VisualCritiqueResult` type, prompt | `AIProvider.generate()`, `WebsiteDesign` as reference | `agents/visualCriticAgent.ts`, `VisualCritiqueResult` in `lib/qa/types.ts` | `WebsiteDesign`, all of `lib/render/` | None |
| Autonomous Repair Loop | None | Loop orchestrator, convergence check, context threading | All existing pipeline stages, `AbortSignal` | `lib/design/repairLoop.ts` | All existing agent/renderer contracts | None |
| Design Memory | None | Persistent store, recall interface | Per-run artifact pattern | `lib/design/memory.ts` | Nothing existing | None |
