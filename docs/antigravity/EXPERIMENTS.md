# Experiments Log: Empirical Trials & Benchmark Runs

## 1. Executive Summary

This document records the four empirical benchmark experiments conducted during the development of BusinessForge 2.0. It documents inputs, parameters, token metrics, success/failure modes, and concrete architectural takeaways.

---

## 2. Experiment 1: Go Sweet Vertical Slice (`forge-da56c149`)

- **Date**: 2026-08-16 22:20 UTC
- **Target URL**: `https://go-sweet.ro` (Haute-Pâtisserie, Sibiu)
- **Primary Model**: `gemini-2.5-flash` / `gemini-2.5-pro`
- **Vision Model**: `gpt-4o-mini`
- **Output Files**: `output/forge-da56c149/site/index.html` (18.6 KB), `styles.css` (19.4 KB), `experience.js` (8.8 KB)
- **What Worked**:
  - Successfully moved away from brochure cards to a sensory French pâtisserie narrative (*„L'Alchimie du Sucre”*).
  - Generated an interactive SVG/Canvas **Flavor Accord Radar Chart** and 3-step Cake Concierge.
  - Initial Vision Critic score: **85 / 100**.
  - Auto-launched in browser.
- **What Failed / Lessons Learned**:
  - Relied on single-pass generation which risked token exhaustion on larger sites.
  - Lacked an explicit Factual Firewall separating verified facts from creative deductions.

---

## 3. Experiment 2: River Park Events Production V1 (`forge-d8073b04`)

- **Date**: 2026-08-16 22:42 UTC
- **Target URL**: `https://www.instagram.com/river.park.events/`
- **Primary Model**: `gemini-2.5-pro`
- **Output Files**: `output/forge-d8073b04/site/index.html` (32.4 KB), `styles.css` (24.1 KB), `experience.js` (14.3 KB), `shots/desktop.png` (598 KB)
- **What Worked**:
  - Bound 13 authentic high-res venue photos into the DOM.
  - Captured dramatic nocturnal atmosphere and crystal chandeliers.
  - Final Vision Critic score: **85 / 100**.
- **What Failed / Lessons Learned**:
  - **Factual Hallucination**: Without negative guardrails, the LLM deduced from "River Park" that the venue was on the Olt riverbank (*„pe malul Oltului”*), an unverified claim.
  - **Generic Luxury Trap**: Reused gold gradients and particle canvas without conceptual restraint.

---

## 4. Experiment 3: River Park Single-Pass Failure Mode (`forge-6aba5270`)

- **Date**: 2026-08-16 23:24 UTC
- **Target URL**: `https://www.instagram.com/river.park.events/`
- **Failure Cause**: `generation was cut off at 32000 tokens (finish reason "MAX_TOKENS")`
- **Forensic Diagnosis**:
  - `lib/forge/builder.ts` attempted to generate HTML, CSS, and JS simultaneously with `effort: 'high'`.
  - Gemini's internal thinking budget consumed ~16,000 tokens, causing the JSON payload to exceed the 32,000 token limit.
- **Key Takeaway**: A monolithic single-pass builder is brittle. The frontend generator must be split into a **Two-Pass Engine** (Pass 1 HTML5 markup -> Pass 2 CSS3/JS styling).

---

## 5. Experiment 4: River Park Experience Signature V1 (`forge-e94b778a`)

- **Date**: 2026-08-16 23:28 UTC
- **Target URL**: `https://www.instagram.com/river.park.events/`
- **Architecture**: Factual Firewall + 3 Creative Territories + Two-Pass Builder + Anti-AI Gate + Multi-Modal Vision QA Critic
- **Output Files**: `output/forge-e94b778a/site/index.html` (30.5 KB), `styles.css` (7.6 KB), `experience.js` (12.3 KB), `shots/`
- **Empirical Results**:
  - **Factual Grounding**: 5 verified facts, 4 strict `forbiddenAssumptions` (zero false river claims).
  - **Winning Territory**: *The Celestial Stage & Nocturnal Drama* (`theatrical-nocturnal-grandeur`).
  - **Two-Pass Generation**: Succeeded flawlessly with zero token truncation (Pass 1: 30.5KB HTML, Pass 2: 7.6KB CSS + 12.3KB JS).
  - **Anti-AI-Generic Gate**: **100 / 100** (0% structural slop, 0% similarity to Go Sweet).
  - **Vision QA Critic**: **89 / 100**, Verdict: **`INTENTIONALLY_ART_DIRECTED`**.
  - **Auto Preview**: Launched automatically in the default browser.

---

## 6. What to Keep vs. What to Avoid (Guidelines for Future Pipelines)

| What to Keep (Codified Best Practices) | What to Avoid (Anti-Patterns) |
| :--- | :--- |
| **Factual Firewall**: Explicitly separate verified facts from inferences and enforce `forbiddenAssumptions`. | **Name-Based Hallucinations**: Never assume physical features from words in the business name (e.g. "River" -> "riverfront"). |
| **Creative Territory Divergence**: Formulate 3 distinct conceptual directions before choosing one. | **Monolithic Single-Pass Builder**: Never ask for HTML+CSS+JS in a single high-effort prompt (causes 32K token cutoff). |
| **Two-Pass Frontend Generation**: Pass 1 defines DOM structure; Pass 2 styles those exact selectors. | **Generic Luxury Tropes**: Forbid unmotivated particles, generic preloaders, and uniform 3-column card grids. |
| **Multi-Modal Vision QA with Decisive Verdict**: Evaluate real desktop & mobile screenshots for intentional art direction. | **Fake Text-Only QA Gates**: Never score quality solely on whether HTML strings are non-empty. |
