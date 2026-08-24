# BusinessForge 2.0 — Experience Signature Pipeline (V1)

## Executive Summary

The **Experience Signature Pipeline** is BusinessForge's autonomous end-to-end factory that transforms raw digital business signals (Instagram, Google Maps, websites, registries) into bespoke, award-winning digital experiences.

Unlike legacy brochure builders that suffered from "Brochure Gravity" (rigid schemas, identical 3-column card layouts, generic luxury gradients, unmotivated animations), BusinessForge 2.0 enforces a strict conceptual and epistemic discipline:

```
BUSINESS TRUTH (Factual Firewall)
      ↓
EVIDENCE CONFIDENCE & FORBIDDEN ASSUMPTIONS
      ↓
HUMAN INSIGHT (Psychological & Emotional Need)
      ↓
CREATIVE TERRITORIES (3 Radical Directions)
      ↓
EXPERIENCE SIGNATURE & RESTRAINT CONTRACT
      ↓
EXPERIENCE BLUEPRINT (Scene Choreography & Real Asset Bindings)
      ↓
AUTONOMOUS FRONTEND BUILDER (Two-Pass: HTML5 + Bespoke CSS3/JS)
      ↓
ANTI-AI-GENERIC GATE (Static & Structural Slop Audit)
      ↓
PLAYWRIGHT HEADLESS BROWSER SETTLE & CAPTURE (1440x900 & 390x844)
      ↓
MULTI-MODAL VISION QA CRITIC (10 Awwwards Axes & Art Direction Verdict)
      ↓
AUTONOMOUS CODE REPAIR LOOP (In-Place Fixes)
      ↓
AUTO LIVE BROWSER PREVIEW LAUNCH
```

---

## 1. Core Architectural Pillars

### 1.1 Factual Firewall (`lib/forge/grounding.ts`)
- **Epistemic Separation**: Separates `VERIFIED_FACTS`, `INFERENCES`, and `CREATIVE_INTERPRETATIONS`.
- **Negative Guardrails (`forbiddenAssumptions`)**: Explicitly blocks name-based deducing (e.g. if the name contains "River", forbids claiming a riverfront location unless confirmed by photography).
- **Asset Provenance Binding**: Associates each photo file with its verified physical feature (e.g. grand chandelier, first dance on clouds, table place settings).
- **Conflict Handling**: Disagreements between sources are noted rather than arbitrarily resolved.

### 1.2 Creative Territories & Signature Engine (`lib/forge/signature.ts`)
- **3 Radical Territories**: Formulates three radically distinct creative directions (metaphor, emotional target, visual language, interaction language, signature moment, risks, reasons not to choose).
- **AI Territory Selector**: Evaluates against verified evidence and selects the winning territory with explicit rationale.
- **Restraint Contract**: Mandates an artistic opinion by forbidding unmotivated anti-patterns (no generic preloaders, no unmotivated glassmorphism, no particle blizzard, no card cloning).

### 1.3 Two-Pass Autonomous Frontend Builder (`lib/forge/builder.ts`)
- **Pass 1 (HTML Architecture)**: Generates semantic HTML5 with Schema.org JSON-LD (`@type: EventVenue` or `@type: Bakery`), accessibility attributes, and scene containers.
- **Pass 2 (Visual Styling & Interactions)**: Generates matching modern CSS3 and vanilla JavaScript targeting the exact DOM classes and IDs from Pass 1.
- **Token Efficiency**: Decoupling avoids output token exhaustion (`MAX_TOKENS`) while providing 100% selector consistency.

### 1.4 Anti-AI-Generic Gate (`lib/forge/anti-ai-gate.ts`)
- **Structural Slop Interceptor**: Scans HTML/CSS/JS for generic smells (excessive cards, unmotivated glassmorphism, unmotivated particles).
- **Baseline Comparison**: Compares against baseline builds (e.g. Go Sweet) to ensure 0% structural cloning.

### 1.5 Multi-Modal Vision QA Critic (`lib/forge/critic.ts`)
- Evaluates real Playwright screenshots (Desktop 1440x900 and Mobile 390x844) on 10 Awwwards criteria:
  1. Conceptual Coherence
  2. Business Specificity
  3. Human Art Direction
  4. Visual Hierarchy
  5. Composition & Whitespace
  6. Interaction Restraint
  7. Memorability
  8. Distinctiveness
  9. Factual Fidelity
  10. Mobile Experience
- **Decisive Human Design Question**: *"Does this feel intentionally art-directed by a human designer or AI-generated?"*

---

## 2. Benchmark Verification Runs

### Run 1: Go Sweet & More Sibiu
- **Target**: `https://go-sweet.ro` (Haute-Pâtisserie, Sibiu)
- **Run ID**: `forge-da56c149`
- **Creative Metaphor**: *"L'Alchimie du Sucre: An intimate sensory reverie through culinary textures."*
- **Central Mechanism**: Interactive Flavor Accord Radar Chart + 3-Step Cake Concierge.
- **Visual Grammar**: Cocoa Noir (`#0C0A09`), Whipped Cream (`#F7F4ED`), Spun Sugar Gold (`#D4AF37`).
- **Typography**: Cormorant Garamond + Plus Jakarta Sans.
- **Score**: 85/100 (Pass).

### Run 2: River Park Events Drăgășani
- **Target**: `https://www.instagram.com/river.park.events/` (Ballroom Venue & Hotel, Drăgășani)
- **Run ID**: `forge-e94b778a`
- **Creative Metaphor**: *"A nocturnal theater of light and haze, where monumental architecture cradles celestial celebrations."*
- **Central Mechanism**: Atmospheric Light & Cloud State Switcher + Dual-Hall Spatial Explorer.
- **Signature Moment**: "Dans pe Nori" Cloud Reveal & Cold Sparkler Simulation.
- **Visual Grammar**: Obsidian Noir (`#05070C` / `#070B12`), Imperial Gold (`#D4AF37`), Moonlight Mist Text (`#F5F7FA`).
- **Typography**: Cinzel Monumental Display + Plus Jakarta Sans.
- **Anti-AI Gate Score**: 100/100 (0% structural similarity to Go Sweet).
- **Vision QA Score**: 89/100 (`INTENTIONALLY_ART_DIRECTED`).

---

## 3. CLI Usage

To run the complete Autonomous Experience Factory on any business URL:

```bash
# Run on Instagram URL or Website
npm run forge -- "https://www.instagram.com/river.park.events/"

# Run with custom output directory or disabled auto-preview
node --import tsx --env-file=.env scripts/forge/run.ts "https://go-sweet.ro" --no-open
```
