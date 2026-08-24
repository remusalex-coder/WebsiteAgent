# Workflow Forensics: Agent Execution, Tool Orchestration & Two-Pass Architecture

## 1. Executive Summary

This document analyses the technical execution workflows, agent coordination patterns, and tool orchestration strategies developed during the Antigravity sessions.

---

## 2. Master Execution Sequence (10-Stage Pipeline)

```
[1. Evidence Harvesting]      (lib/forge/research.ts)    ── Web & Instagram Crawl + Photo Ingest
          ↓
[2. Factual Firewall]         (lib/forge/grounding.ts)   ── VERIFIED_FACTS vs INFERENCES vs FORBIDDEN_ASSUMPTIONS
          ↓
[3. Creative Territories]     (lib/forge/signature.ts)   ── Generates 3 Radical Conceptual Directions
          ↓
[4. Signature Selection]      (lib/forge/signature.ts)   ── AI Justification + Restraint Contract
          ↓
[5. Blueprint Compilation]    (lib/forge/blueprint.ts)   ── Scene Storyboards & Real Photo Bindings
          ↓
[6. Two-Pass Builder]         (lib/forge/builder.ts)     ── Pass 1: HTML5 Markup → Pass 2: Matching CSS3 & JS
          ↓
[7. Anti-AI-Generic Gate]     (lib/forge/anti-ai-gate.ts)── Slop Interceptor & 0% Baseline Similarity Check
          ↓
[8. Playwright Settle & Snap] (lib/forge/browser.ts)     ── Desktop (1440x900) & Mobile (390x844) High-Res PNGs
          ↓
[9. Multi-Modal Vision QA]    (lib/forge/critic.ts)      ── 10 Awwwards Axes & Art-Directed vs AI Verdict
          ↓
[10. Code Repair & Launch]    (lib/forge/repair.ts)      ── In-Place Repair Loop + Automatic OS Browser Preview
```

---

## 3. The Two-Pass Builder Breakthrough

### The Single-Pass Failure Mode (`task-343` / `forge-6aba5270`)
- **Forensic Evidence**: `task-343.log` recorded:
  ```
  AI provider "gemini" request failed: generation was cut off at 32000 tokens (finish reason "MAX_TOKENS")
  ```
- **Root Cause Analysis**:
  1. When requesting HTML, CSS, and JS simultaneously in a single prompt with `effort: 'high'`, Gemini allocated ~16,000 tokens to internal chain-of-thought reasoning.
  2. The remaining token budget was insufficient to emit 30KB of HTML + 20KB of CSS + 15KB of JS inside a single JSON string without hitting the 32,000 token limit.

### The Two-Pass Solution (`lib/forge/builder.ts`)
- **Pass 1 (HTML Architecture)**:
  - Generates pristine semantic HTML5 with Schema.org JSON-LD, accessibility tags, and container IDs.
  - Dedicated budget: `maxTokens: 16000`, `effort: 'medium'`.
- **Pass 2 (Visual Styling & Interaction Logic)**:
  - Takes the *exact* HTML string emitted in Pass 1 as input and writes matching CSS3 and vanilla JavaScript targeting those precise selectors.
  - Dedicated budget: `maxTokens: 24000`, `effort: 'medium'`.
- **Key Advantages**:
  1. **Zero Token Cutoff**: Output comfortably fits within separate token windows.
  2. **100% Selector Synchronization**: CSS and JS never reference missing or hallucinated DOM IDs because they are conditioned directly on the Pass 1 HTML markup.

---

## 4. Headless Browser Settle & Capture Protocol (`lib/forge/browser.ts`)

- **Browser Engine**: Playwright Chromium in headless mode.
- **Settle Timing**:
  1. `page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 })`
  2. `page.waitForTimeout(2500)` — Mandatory 2.5-second settle period allowing Google Fonts to render, CSS `@keyframes` to stabilize, and Canvas WebGL contexts to initialize.
- **Resolution Matrix**:
  - **Desktop Viewport**: 1440 × 900 (Device Scale Factor: 1.0, Full-Page Screenshot).
  - **Mobile Viewport**: 390 × 844 (iPhone 13/14/15 standard, Mobile User Agent, Touch Enabled, Full-Page Screenshot).

---

## 5. Vision QA Feedback & Autonomous Code Repair Loop

- **Critic Model**: Multi-modal Vision AI (`gpt-4o-mini` via OpenAI API, with graceful fallback).
- **Inspection Inputs**: Base64-encoded full-page Desktop and Mobile screenshots evaluated side-by-side.
- **Repair Trigger**: If `critique.issues.length > 0` and `critique.score < 88`:
  - `lib/forge/repair.ts` applies surgical fixes directly to `index.html`, `styles.css`, or `experience.js`.
  - Playwright re-renders and re-captures fresh screenshots.
  - Critic re-evaluates (up to 2 iterations) before final acceptance.
