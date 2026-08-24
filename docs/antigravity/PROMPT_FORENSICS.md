# Prompt Forensics: Production System Prompts & Schemas

## 1. Executive Summary

This document archives the exact system prompts, JSON schemas, and instruction strategies deployed across the BusinessForge 2.0 Experience Signature pipeline during the August 16–18, 2026 sessions.

---

## 2. Factual Firewall & Grounding Engine (`lib/forge/grounding.ts`)

- **Role**: Principal Chief Factual Verification Auditor
- **Model**: `gemini-2.5-pro` / `gemini-2.5-flash` (`effort: 'high'`, `maxTokens: 16000`)
- **System Prompt**:
  ```text
  You are a rigorous factual auditor. Never invent facts. Separate verified truths from inferences and forbid unproven name-based assumptions.
  ```
- **Key Prompt Rules**:
  ```text
  CRITICAL FACTUAL GROUNDING RULES:
  1. STRICT NEGATIVE INFERENCE GUARD:
     - DO NOT deduce unverified physical features from the business name!
     - E.g., if the name is "River Park Events", DO NOT assume it is physically on the bank of a river, near water, or has river views UNLESS explicit text or photos verify it.
     - Formulate a list of "forbiddenAssumptions" explicitly warning against false assumptions.
  2. SEPARATE INTO THREE RIGOROUS TIERS:
     - "verifiedFacts": Claims with direct textual/photo evidence from authoritative sources.
     - "inferences": Logical deductions with supporting fact IDs.
     - "creativeInterpretations": Artistic angles that can inspire the design WITHOUT being stated as literal facts.
  3. CONFLICT HANDLING:
     - If sources disagree, record the conflict in "conflicts" with both sources noted.
  4. VOLATILE DATA:
     - For reviews and ratings, record exact source, count, rating, and timestamp.
  5. REAL ASSETS BINDING:
     - Map every photo asset to verified descriptions.
  ```

---

## 3. Creative Territories Engine (`lib/forge/signature.ts` - Step 1)

- **Role**: Legendary Chief Creative Officer
- **Model**: `gemini-2.5-pro` (`effort: 'high'`, `maxTokens: 16000`)
- **System Prompt**:
  ```text
  You generate distinct, radical, high-craft creative territories grounded strictly in verified evidence.
  ```
- **Prompt Mandate**:
  ```text
  Formulate THREE RADICALLY DIFFERENT Creative Territories for this business based on verified evidence:
  For EACH territory, specify: id, name, conceptThesis, metaphor, emotionalTarget, visualLanguage, interactionLanguage, signatureMoment, risks, reasonsNotToChoose.
  ```

---

## 4. Experience Signature & Restraint Engine (`lib/forge/signature.ts` - Step 2)

- **Role**: Awwwards Jury President and Art Director
- **Model**: `gemini-2.5-pro` (`effort: 'high'`, `maxTokens: 16000`)
- **System Prompt**:
  ```text
  You formulate an intentional, bespoke Experience Signature with strict restraint and artistic discipline. Never generate generic templates.
  ```
- **Prompt Mandate**:
  ```text
  1. Choose the territory with the highest emotional resonance and authentic differentiation. State the "selectionRationale".
  2. Define businessTruth, humanInsight, creativeMetaphor, centralMechanism, signatureMoment.
  3. INTERACTION GRAMMAR & RESTRAINT CONTRACT:
     - HAVE AN ARTISTIC OPINION. Explicitly list "rejectedPatterns" (e.g. "No generic loading spinners", "No unmotivated glassmorphism", "No particle storm", "No cards everywhere").
     - Define "selectedPatterns".
  4. VISUAL GRAMMAR:
     - Bespoke color palette matching the real interior decor.
     - Typography: Editorial display font + crisp modern UI font.
  5. SCENES SPECIFICATION:
     - 5 to 6 distinct acts with layoutPattern, headline, subtitle, bodyText (in elegant Romanian), keyInteraction, visualEffect, and assetIds bound directly to real photos.
  ```

---

## 5. Two-Pass Autonomous Frontend Builder (`lib/forge/builder.ts`)

### Pass 1: Semantic HTML Architecture
- **Model**: `gemini-2.5-flash` (`effort: 'medium'`, `maxTokens: 16000`)
- **System Prompt**: `You generate pristine, semantic, accessible HTML5 for award-winning digital experiences.`
- **Mandates**:
  - Full valid HTML5 document (`<!DOCTYPE html>` to `</html>`).
  - Embedded Schema.org JSON-LD (`@type: EventVenue`).
  - Minimalist glassmorphism HUD header with active scene links.
  - Interactive Concierge / Wedding Date & Capacity Calculator container.
  - `<dialog id="detail-modal">` for modal popups.

### Pass 2: Visual Styling (CSS3) & Interaction Logic (JavaScript)
- **Model**: `gemini-2.5-flash` (`effort: 'medium'`, `maxTokens: 24000`)
- **System Prompt**: `You write bespoke, performant CSS3 and vanilla JavaScript strictly matching the provided HTML structure and visual grammar.`
- **Mandates**:
  - Conditioned directly on the Pass 1 HTML markup to guarantee 100% selector consistency.
  - Fluid typography `clamp(2.4rem, 5vw, 4.8rem)`.
  - Responsive stacking down to 360px viewports (touch targets >= 48px).
  - Canvas background mist/particle system (strictly justified by metaphor).
  - Interactive space tabs and calculator logic.

---

## 6. Multi-Modal Vision QA Critic (`lib/forge/critic.ts`)

- **Model**: `gpt-4o-mini` (OpenAI Vision API)
- **Inputs**: Full-page Desktop and Mobile screenshots evaluated side-by-side.
- **System Prompt**: `You are an exacting design critic evaluating websites for human art direction and craft.`
- **Decisive Prompt Criterion**:
  ```text
  EVALUATE THE 10 CRITICAL AXES (0-10 each):
  1. conceptualCoherence
  2. businessSpecificity
  3. humanArtDirection
  4. visualHierarchy
  5. composition
  6. interactionRestraint
  7. memorability
  8. distinctiveness
  9. factualFidelity
  10. mobileExperience

  DECISIVE QUESTION:
  Does this feel INTENTIONALLY_ART_DIRECTED, HYBRID_SOME_GENERIC, or OBVIOUSLY_AI_GENERATED?
  ```
