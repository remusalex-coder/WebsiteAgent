# 0006 — The experience is character-driven, and the page order is a narrative

_Status: accepted, 2026-08-11. Supersedes the "one enum" scope of ADR 0004 and the
"one moment" scope of ADR 0005 for the experience question specifically; both
remain accurate for what they decided at the time._

## Context

After the design-vocabulary engine (`lib/design/`) and Experience Intent V1
(ADR 0005), a review found that BusinessForge still produced a **brochure with
different styling**: every business received the same section palette, the same
industry-priority order, and distinctiveness that lived only at the *category*
level. Two businesses in the same industry — indeed a hotel and a bar — got the
same world, the same journey, the same order. The Design Director, meanwhile,
"decided" seven fields that were logged and never applied, and was blind to what
its images actually depicted (it saw `Gallery: 6`, not a dramatic crystal-ceiling
ballroom).

The gap was not depth — the deterministic system's structural reach is real — it
was that nothing read the **character** of a business's evidence, and nothing
turned that character into an **experience** or a **narrative order**.

## Decision

Insert a deterministic experience layer **above** the section engine, and make the
page order a narrative rather than a category sort. Distinctiveness becomes a
function of business character, not industry.

```
Evidence
  → BusinessCharacter        (character.ts)   visualWeight, atmosphereRange, register, breadth, narrativePotential, signatureCandidate
  → ExperienceArchitecture   (experience.ts)  mode ∈ brochure|showcase|narrative|immersive, signature moment, gallery-lead, pacing
  → AssetChoreography        (assets.ts)      hero, signature, sequence, contrast, reduce, rights
  → ConversionStrategy       (conversion.ts)  posture, CTA verb, placement, contact prominence, friction
  → InteractionStrategy      (interaction.ts) static|subtle|guided|immersive (capped at guided)
  → ExperienceScript         (script.ts)      NarrativeRole per section → narrative order (Beat[])
  → AI Director (optional)   (directive.ts)   validated closed-set overrides + image-content signals
  → composeDesign → renderer (existing, unchanged)
  → quality gate             (quality.ts)     scoreExperience + genericityReport + narrativeCoherence
```

### The rules that make it safe

1. **Deterministic floor.** Every layer runs with no model; `--compose` produces a
   business-specific experience on its own, at €0.
2. **AI is an improver, never a single point of failure.** The Director may
   override the floor only through decisions validated against closed sets
   (`applyDirective`); an invalid or absent value leaves the floor standing.
3. **Factual unknown vs creative freedom.** Every decision carries a
   `basis: 'evidence' | 'creative-default'`. The system never invents a *fact* to
   justify a richer experience; it only exercises creative freedom over *design*
   choices, and marks it.
4. **Explainable.** Every decision carries `rationale` + `evidence`, observable on
   `WebsiteDesign`.
5. **Order is a narrative.** `script.ts` assigns each section a closed-set
   `NarrativeRole` from character (a gallery is a `signature` for one business, a
   `space` for another) and orders the page along a story spine. The hero stays
   first and the closing CTA last; the middle is the narrative. Two same-industry
   businesses with different evidence produce different scripts.

### What was deliberately NOT done

- No new renderer, no scroll-as-time runtime, no motion. The script is a **data
  plan** the existing static renderer already realises. The true experience
  runtime (Bakery V2's `Scene[]` with a client playhead) is audited in
  `docs/experience-system.md` and intentionally deferred.
- No business-specific templates or hardcoded names. River Park is a benchmark,
  not a special case.

## Consequences

- **Proven divergence.** The six-business benchmark (`test/design/benchmark.test.ts`)
  shows brochure/showcase/narrative modes, divergent CTA verbs and interaction
  levels, and — critically — two hotels with different evidence producing
  different narratives. A `genericityReport` (template-smell) test fails if
  identity axes collapse; a `narrativeCoherence` test fails a badly-shaped story.
- **River Park, autonomously:** `narrative` / gallery signature / editorial-book /
  arc `emotion → reveal → signature → breadth → context → conversion`, rendered
  `hero → about → gallery(full-bleed, moment) → services → hours → contact → cta`,
  score 99/100. No manual content edits.
- **580/580 tests pass; typecheck clean; €0.**
- **New debt:** section *copy* is still generic `composeBaseline` text — the order
  is business-specific but the prose is not yet. `pacing`/`imageryStrategy` are
  validated-but-advisory. See PROJECT_STATUS.md.

## References

- `docs/experience-system.md` — the full technical reference and the runtime plan.
- `docs/experience-capability-audit.md` — the Bakery V2 vs general-pipeline audit.
- ADR 0004 (the Director's influence is one enum), ADR 0005 (experience mode is a
  directive field) — the narrower prior steps this generalises.
