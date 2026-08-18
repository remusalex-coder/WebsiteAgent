# `lib/forge` — Autonomous Experience Factory Architecture

This module implements the **BusinessForge 2.0 Autonomous Experience Signature Pipeline**.

## File Breakdown & Responsibilities

| File | Purpose | Key Function / Export |
| :--- | :--- | :--- |
| **`types.ts`** | Core TypeScript interfaces and type definitions for research, factual dossiers, creative territories, experience signatures, blueprints, generated code, and QA reports. | `FactualDossier`, `ExperienceSignature`, `ExperienceBlueprint`, `GeneratedCode`, `AntiAIGateResult`, `VisionCritiqueReport`, `ForgeResult` |
| **`research.ts`** | Intelligent multi-source web and social crawler + asset downloader. Extracts DOM, meta tags, and high-res photography. | `harvestResearch()` |
| **`grounding.ts`** | **Factual Firewall**: Separates verified facts, inferences, creative interpretations, and generates `forbiddenAssumptions` to eliminate AI hallucinations. | `buildFactualDossier()` |
| **`signature.ts`** | **Creative Territories & Signature Architect**: Formulates 3 distinct creative territories, selects the winning direction with AI justification, and defines the *Restraint Contract*, *Interaction Grammar*, and *Visual Grammar*. | `formulateExperienceSignature()` |
| **`blueprint.ts`** | Compiles the Factual Dossier and Experience Signature into an actionable, strictly grounded Experience Blueprint. | `compileBlueprint()` |
| **`builder.ts`** | **Two-Pass Autonomous Frontend Builder**: Pass 1 generates accessible semantic HTML5; Pass 2 generates matching CSS3 and bespoke JavaScript. | `buildFrontend()` |
| **`anti-ai-gate.ts`** | **Anti-AI-Generic Gate**: forbidden-assumption hallucinations, restraint-contract violations, card-grid smell, and structural template convergence — measured against the real peer corpus of prior Forge runs on identity-bearing creative axes, never a single hardcoded baseline. | `auditAntiAIGeneric()`, `checkStructuralConvergence()` |
| **`browser.ts`** | Headless Playwright engine that renders the page, allows canvas/animations to settle, and captures full-page Desktop (1440x900) and Mobile (390x844) screenshots. | `captureSite()` |
| **`critic.ts`** | **Multi-Modal Vision QA Critic**: Evaluates screenshots using Vision AI on 10 Awwwards axes and answers *"Does this feel intentionally art-directed or AI-generated?"* | `evaluateVision()` |
| **`repair.ts`** | Autonomous in-place code repair engine for resolving detected visual or typographic issues. | `repairCode()` |
| **`verdict.ts`** | Combines the structural gate and the Craft Critic into one explainable PASS/FAIL, reusing `lib/qa/verdict.ts`'s lexicographic rule (F-06) rather than a second scoring formula. | `computeForgeVerdict()` |
| **`preview.ts`** | Auto-launches the rendered `index.html` in the user's default OS browser. | `openInBrowser()` |
| **`orchestrator.ts`** | Master pipeline coordinator that executes steps 1 through 10 sequentially. | `runExperienceForge()` |

## The anti-AI-generic gate's structural check

`checkStructuralConvergence` compares the current build's Experience
Signature against every other Forge run actually present under
`outputDir` — never one hardcoded prior business — on identity-bearing
creative fields (`centralMechanism`, `creativeMetaphor`, the
`layoutPattern` sequence, the selected interaction patterns, the color
palette). It never reads a `<section id>`: ids are assigned by the
builder's own prompt compliance, not chosen by the creative-direction
call, so they carry no signal about the concept. Convergence is flagged
only when several axes agree with the *same* peer at once — one shared
axis is a coincidence two legitimately different businesses can have; four
or five agreeing simultaneously with one prior build is not. See the
module's own docstring in `anti-ai-gate.ts` for the false positive this
replaced (Ridgeway Motors scoring "100% identical" to an unrelated
bakery), and `test/forge/ridgeway-regression.test.ts` for the permanent
regression.

## Integration with CLI and n8n

- **CLI Entrypoint**: `scripts/forge/run.ts` (`npm run forge -- "<url>"`)
- **n8n Stage Integration**: `scripts/n8n/stage.ts` (registered stage: `experience-forge`)
