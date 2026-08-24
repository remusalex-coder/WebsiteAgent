# 02 — VISUAL INTELLIGENCE (Visual Archaeology)

> screenshot → analysis → tokens → components → code-gen study. Goal: extract reusable
> patterns, NOT clone branding. VERIFIED = fetched 2026-08-19.

## A. screenshot-to-code (deep study)
- Repo: github.com/abi/screenshot-to-code — **74.2k★, 9.1k forks, MIT, 1,455 commits** (VERIFIED).
- **Architecture:** React/Vite frontend + FastAPI backend. Takes screenshot / mockup /
  Figma / **screen recording** → functional code. Supported stacks: HTML+Tailwind, HTML+CSS,
  React+Tailwind, Vue+Tailwind, Bootstrap, Ionic+Tailwind.
- **Models:** Gemini 3 Flash/3.1 Pro (asset extraction — reuses real logos/images from
  screenshot; required for video mode), GPT-5.5/5.4 Mini, Claude Opus 4.6/4.8, z-image-turbo
  (Replicate) for image gen. **Replicate** powers image editing / background removal / gen.
- **Iteration:** generates variant, can render own output in headless Chromium
  (Playwright) and visually self-check (screenshot preview tool).
- **Self-host:** Docker (`docker-compose up`), needs OPENAI/ANTHROPIC/GEMINI + REPLICATE keys.
- **Licence:** MIT → safe to study, fork, reuse patterns. (VERIFIED LICENSE = MIT)

### What BusinessForge should REUSE
- The **prompt/architecture pattern**: screenshot → multimodal LLM → structured component
  tree → code, with a render-and-judge loop (mirrors our critic/repair loop).
- **Asset extraction** idea: pull real logos/images from a reference screenshot via Gemini
  rather than regenerating (relevant to `image_editing` gate — but respect O-6 rights).
- **Video/screen-recording → prototype** for capturing motion/interaction patterns.

### What BusinessForge should NOT reuse
- Do NOT generate client site code from screenshot-to-code directly — it would bypass our
  deterministic `experienceStrategy`/anti-generic pipeline and produce generic output.
- Do NOT copy a competitor's visual identity (brand/IP risk). Use only as *pattern*
  inspiration fed into the Design Director.

**Recommendation: STUDY (P2).** Fork-read for the judge loop; do not pipe into production.

## B. Figma → code systems
- **Figma REST API** (official) — extract nodes, styles, components. 
- **Tokens Studio** (Figma plugin) → design tokens → Style Dictionary. See 03.
- **Anima / Locofy** — Figma→code SaaS. VERIFIED exist; **REJECT** for factory (defeats
  determinism, paid, black-box). Study patterns only.

## C. Screenshot analyzers / visual AI
- **Gemini / Claude vision** (existing providers) — layout/typography/component analysis
  via `vision_description` capability (EXISTS in registry). No new vendor.
- **Playwright screenshot + multimodal judge** — our visual QA loop (EXISTS: `lib/forge/
  critic.ts`, `craft_judging`, `distinctness_judging`). Extend, don't replace.

## D. Visual comparison / regression
- **Playwright** pixel diff (EXISTS: `visual_regression` capability, core).
- **SSIM / perceptual** libs (OSS) — optional enhancement to the regression gate.

## E. Design extraction → Experience Blueprint
Flow: reference screenshot → vision LLM → layout fingerprint + component list + typography
hints → merged with business evidence → `experience blueprint` (EXISTS). The archaeology
step enriches, never overrides, the evidence-driven strategy.
