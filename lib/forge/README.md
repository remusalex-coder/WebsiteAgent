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
| **`anti-ai-gate.ts`** | **Anti-AI-Generic Gate**: Static and heuristic audit intercepting repetitive cards, unmotivated glassmorphism/particles, and structural cloning of previous sites. | `auditAntiAIGeneric()` |
| **`browser.ts`** | Headless Playwright engine that renders the page, allows canvas/animations to settle, and captures full-page Desktop (1440x900) and Mobile (390x844) screenshots. | `captureSite()` |
| **`critic.ts`** | **Multi-Modal Vision QA Critic**: Evaluates screenshots using Vision AI on 10 Awwwards axes and answers *"Does this feel intentionally art-directed or AI-generated?"* | `evaluateVision()` |
| **`repair.ts`** | Autonomous in-place code repair engine for resolving detected visual or typographic issues. | `repairCode()` |
| **`preview.ts`** | Auto-launches the rendered `index.html` in the user's default OS browser. | `openInBrowser()` |
| **`orchestrator.ts`** | Master pipeline coordinator that executes steps 1 through 10 sequentially. | `runExperienceForge()` |

## Integration with CLI and n8n

- **CLI Entrypoint**: `scripts/forge/run.ts` (`npm run forge -- "<url>"`)
- **n8n Stage Integration**: `scripts/n8n/stage.ts` (registered stage: `experience-forge`)
