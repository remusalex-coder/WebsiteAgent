# Design Forensics: The Evolution from Brochure Gravity to Experience Signature

## 1. Executive Summary

This document provides a grounded, forensic analysis of the design decisions, visual transformations, and empirical differences observed across the four major design generations in BusinessForge during the August 16–18, 2026 Antigravity sessions.

---

## 2. The 4 Stages of Design Evolution

```
[Stage 0: Legacy Brochure] ──> [Stage 1: Go Sweet Prototype] ──> [Stage 2: River Park V1] ──> [Stage 3: Experience Signature V1]
  (Fixed 3-column cards,       (Sensory Pâtisserie,              (Ballroom Estate,           (Strict Factual Firewall,
   174KB static templates)       Flavor Accord Radar)              Ungrounded river claim)     3 Territories, Restraint Contract)
```

---

## 3. Detailed Forensic Breakdown by Generation

### Generation 0: The Legacy Deterministic Renderer
- **Source**: `lib/render/variants.ts`, `lib/render/sections.ts`
- **Status**: `[ALREADY_PRESENT]`
- **Design Characteristics**:
  - Fixed section types: `hero`, `services`, `gallery`, `reviews`, `contact`.
  - Static string concatenation of HTML and CSS.
  - Symmetrical 3-column card grids (`.card-grid { display: grid; grid-template-columns: repeat(3, 1fr); }`).
  - Colors picked from 5 fixed `DesignWorld` palettes (`ember`, `slate`, `sand`, `moss`, `ocean`).
- **Why it failed**: It produced brochure layouts that looked identical regardless of whether the business was an artisanal French bakery or a 400-guest wedding estate.

---

### Generation 1: The Go Sweet Vertical Slice (`forge-da56c149`)
- **Date**: 2026-08-16 22:20 UTC
- **Input**: `https://go-sweet.ro`
- **Output Path**: `output/forge-da56c149/site/`
- **Evidence Files**: `forge/0-research.json`, `forge/1-blueprint.json`, `forge/result.json`
- **Status**: `[ALREADY_PRESENT]`
- **Key Forensic Discoveries**:
  1. **Sensory Narrative**: Art direction formulated the concept *"L'Alchimie du Sucre: O reverie senzorială intimă a texturilor dulci."*
  2. **Bespoke Interaction Mechanism**: Succeeded by introducing an interactive SVG/Canvas **Flavor Accord Radar Chart** (Vanilla, Bronte Pistachio, Valrhona Chocolate, Passion Fruit balance) and a 3-step Cake Concierge selector.
  3. **Visual Grammar**: Cocoa Noir (`#0C0A09`), Whipped Cream (`#F7F4ED`), Spun Sugar Gold (`#D4AF37`), Deep Berry Accent (`#C83E4D`).
  4. **Typography**: Cormorant Garamond Display + Plus Jakarta Sans.
  5. **Score**: **85 / 100** (Vision Critic passed).

---

### Generation 2: The Initial River Park Run (`forge-d8073b04`)
- **Date**: 2026-08-16 22:42 UTC
- **Input**: `https://www.instagram.com/river.park.events/`
- **Output Path**: `output/forge-d8073b04/site/`
- **Evidence Files**: `forge/0-research.json`, `forge/1-blueprint.json`
- **Status**: `[PARTIALLY_RECONCILED]`
- **Forensic Diagnosis of Flaws**:
  1. **Epistemic Drift / Hallucination**: Because the prompt lacked a strict Factual Firewall, the AI inferred from the name "River Park" that the venue was located directly on the bank of the Olt river (*„O simfonie arhitecturală pe malul Oltului...”*), despite zero photographic evidence of riverbank water views on site.
  2. **Default Luxury Trap**: Relied on generic particle canvas mist and gold gradients without explicit justification or restraint rules.
  3. **Score**: **85 / 100** (Passed technical gates, but failed the strict factual grounding requirement).

---

### Generation 3: The Experience Signature V1 Run (`forge-e94b778a`)
- **Date**: 2026-08-16 23:28 UTC
- **Input**: `https://www.instagram.com/river.park.events/`
- **Output Path**: `output/forge-e94b778a/site/`
- **Evidence Files**: `forge/1-factual-dossier.json`, `forge/2-territories.json`, `forge/3-signature.json`, `forge/5-anti-ai-gate.json`, `forge/6-critique-iter0.json`
- **Status**: `[ALREADY_PRESENT]`
- **Key Forensic Innovations**:
  1. **Factual Firewall Enforcement**:
     - Explicitly isolated 5 verified facts (Strada Regele Ferdinand 56, Drăgășani; Sala Grand; Sala Gold; River Park Hotel 19 rooms; 4.7★ Google Rating from 217 reviews).
     - Generated 4 hard `forbiddenAssumptions` strictly forbidding any unverified claims about riverbanks, direct water access, or vineyard menus.
  2. **Divergence of 3 Creative Territories**:
     - *Territory 1 (Selected)*: **The Celestial Stage & Nocturnal Drama** (focus on low-lying cloud smoke, cold sparkler pyrotechnics, and the monumental crystal chandelier).
     - *Territory 2 (Rejected)*: **Neoclassical Precision & Archival Luxury** (rejected as too static and daytime-focused).
     - *Territory 3 (Rejected)*: **Bespoke Table & Sanctuary Hospitality** (rejected as over-emphasizing 19 hotel rooms over the grand celebration ballroom).
  3. **Restraint Contract & Anti-Patterns**:
     - NO artificial preloader delay.
     - NO generic particle blizzard (replaced by targeted low-smoke cloud mist canvas).
     - NO cloned 3-column card grids.
  4. **Empirical Results**:
     - Anti-AI-Generic Gate: **100 / 100** (0% structural similarity to Go Sweet).
     - Vision QA Critic: **89 / 100**, Verdict: **`INTENTIONALLY_ART_DIRECTED`**.

---

## 4. Cross-Generation Forensic Comparison

| Metric / Dimension | Generation 0 (Legacy) | Generation 1 (Go Sweet) | Generation 2 (River Park V1) | Generation 3 (Signature V1) |
| :--- | :--- | :--- | :--- | :--- |
| **Factual Grounding** | Naive string copy | Verified domain crawl | Ungrounded linguistic inference ("on the river") | **Rigorous Factual Firewall + Forbidden Assumptions** |
| **Creative Concept** | None (Category enum) | Sensory Pâtisserie Metaphor | Monolithic Blueprint | **3 Radical Territories + Formal Signature Selection** |
| **Frontend Architecture** | Static String Concat | Single-Pass LLM | Single-Pass LLM (Hit 32k token limit in forge-6aba5270) | **Two-Pass Builder (HTML5 Architecture -> CSS3/JS Styling)** |
| **Restraint Rules** | None | Implicit | None | **Explicit Restraint Contract with Rejected Patterns** |
| **Anti-AI Gate** | 0% (Pure template) | N/A (Baseline) | N/A | **100/100 (0% Structural Slop & Similarity)** |
| **Vision QA Verdict** | Fake 99/100 gate | 85/100 (Pass) | 85/100 (Pass) | **89/100 (`INTENTIONALLY_ART_DIRECTED`)** |
