# Design Director V1 Integration — Verification

## Overview

This document records the integration of the Design Director V1 AI layer into
the existing pipeline and serves as the acceptance record for the integration.

---

## Files Changed

| File | Type | Summary |
|------|------|---------|
| `lib/config.ts` | Modified | Added `enabled: boolean` to `DirectorConfig` interface and `DEFAULTS.director`; reads from `DIRECTOR_ENABLED` env var |
| `agents/designAgent.ts` | Modified | Added optional `directive?: DesignDirective` to `DesignInput`; applies it via `applyDirective()` before `composeDesign()` |
| `main.ts` | Modified | Added `designDirectorAgent` import and invocation before the design step; persists `5a-directive.json` when enabled |
| `test/design/pipeline-integration.test.ts` | New | Integration tests for the enabled path, disabled path, applyDirective chain, operator precedence, artifact shape, and failure propagation |

No other files were modified. The renderer, `WebsiteDesign`, `composeDesign`, and
all existing stages are unchanged.

---

## Pipeline Insertion Point

The Design Director runs **between the `write` and `design` stages**, inside
`executePipeline` in `main.ts`.

```
write stage → WebsiteContent
                    ↓
     [if config.director.enabled]
                    ↓
     designDirectorAgent.run(profile, strategy, content)
                    ↓
          DesignDirective  →  persist 5a-directive.json
                    ↓
     designAgent.run({ ..., directive })
          → applyDirective(directive, operatorOptions, logger)
          → composeDesign(input, composeOptions)
                    ↓
           WebsiteDesign  →  persist 5b-design.json
                    ↓
              Renderer
```

The directive is not a new resumable stage. It is an intermediate artifact
produced within the design step and persisted separately for inspection.

---

## Enabled Behaviour (`DIRECTOR_ENABLED=true`)

1. After the `write` stage completes, `designDirectorAgent.run` is called with
   `{ profile, strategy, content }`.
2. The agent builds a concise design brief, sends it to the configured AI
   provider, validates the response, and returns a `DesignDirective`.
3. The directive is persisted to `<outputDir>/5a-directive.json` via the
   existing `persistStage` helper (atomic write through a temp file).
4. The orchestrator logs `design director: directive persisted` with `model`,
   `direction`, and `confidence` fields using the run's main logger.
5. `designAgent.run` receives the directive as `input.directive`.
6. Inside `designAgent`, `applyDirective(directive, operatorOptions, logger)`
   translates the directive to `ComposeOptions` — respecting operator precedence
   — before passing them to `composeDesign`.
7. A failure in step 2 throws an `UpstreamError` (or wraps a non-`AgentError`
   as one). The error propagates to the pipeline's top-level `try/finally`,
   which calls `run.dispose()` and re-throws. The design stage is never reached;
   no design is silently produced.

---

## Disabled Behaviour (`DIRECTOR_ENABLED` unset or `false`, the default)

The `if (config.director.enabled && ...)` guard evaluates to `false`. The
director is never called. `directive` remains `undefined`.

`designAgent.run` is called with `directive: undefined`. Inside the agent,
`applyDirective(undefined, operatorOptions, logger)` returns a shallow copy of
`operatorOptions` — which is exactly the `ComposeOptions` object the pre-
integration code built directly. `composeDesign` sees the same options as
before.

**The pipeline behaves byte-identically to its pre-integration state when the
director is disabled.**

---

## Artifact Location and Name

| Artifact | Path | Description |
|----------|------|-------------|
| Design Directive | `output/<runId>/5a-directive.json` | Full `DesignDirective` as returned by the AI; present only when `DIRECTOR_ENABLED=true` |
| Design | `output/<runId>/5b-design.json` | Existing `WebsiteDesign` artifact; produced by the deterministic agent from the (optionally director-guided) `ComposeOptions` |

The `5a-directive` file is not a resumable stage artifact (it is not in the
`STAGES` or `ARTIFACTS` maps). It is an inspection artifact written alongside
the design stage output.

---

## Operator Direction Override Precedence

Precedence order (highest wins):

1. **Operator feature flag** — `FEATURE_design-direction-<name>=true` (or via
   `FEATURE_FLAGS=design-direction-<name>`). Read by `directionOverride()` in
   `designAgent` and placed in `operatorOptions.direction`.
2. **Director directive** — `directive.direction` from `designDirectorAgent`.
   Applied by `applyDirective` only when `operatorOptions.direction` is absent.
3. **Deterministic inference** — `composeDesign` infers direction from industry
   and profile when no direction is supplied.

`applyDirective` enforces rules 1 and 2: it merges `operatorOptions` last, so
any `direction` set by the operator is never overwritten by the directive.

---

## Configuration

All director settings use the existing config architecture (`lib/config.ts`).
No new environment-variable system was introduced.

| Environment variable | Type | Default | Description |
|----------------------|------|---------|-------------|
| `DIRECTOR_ENABLED` | boolean | `false` | Enable the AI Design Director |
| `DIRECTOR_MODEL` | string | provider default | Model name for the director |
| `DIRECTOR_EFFORT` | effort level | `medium` | Reasoning depth |
| `DIRECTOR_MAX_OUTPUT_TOKENS` | integer | `4000` | Max tokens in the response |
| `DIRECTOR_MAX_PAGE_CHARS` | integer | `2000` | Per-page excerpt limit in the brief |

---

## Test Count

| Suite | Tests added | Outcome |
|-------|-------------|---------|
| `pipeline-integration.test.ts` (new) | 22 | ✅ all pass |
| **Full suite** | 356 total | ✅ 356 pass, 0 fail |

Pre-integration count: 334 tests.  
Post-integration count: 356 tests (+22 integration tests).

---

## Typecheck Result

```
0 errors
```

Checked with `npm run typecheck` (`tsc -p tsconfig.test.json`) after all
changes.

---

## Issues Discovered

None. The integration was clean:

- `applyDirective` already handled `undefined` directive gracefully, so the
  disabled path required no special-casing beyond the guard in `main.ts`.
- `DesignInput` accepted the new optional field without breaking existing callers
  (all call sites in `main.ts` that pass no directive continue to work).
- The `tsx` devDependency was absent from `node_modules` in the sandbox
  environment; it was installed to make the test runner work. No production
  dependencies were added or changed.
