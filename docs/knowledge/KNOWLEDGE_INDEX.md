# KNOWLEDGE INDEX — BusinessForge Knowledge Base

**Status:** Research artifact, pre-implementation. **Do NOT implement. Do NOT modify application code.**
**Author role:** Research Director / Knowledge Architect
**Date:** 2026-08-17
**Purpose:** The entry point. What exists, who consumes it, what it governs, and where its authority comes from.

---

## 0. What this knowledge base is for

BusinessForge already contains a large amount of design knowledge (`docs/Design_Intelligence_Foundation.md`, `docs/AWWWARDS_PATTERN_LIBRARY.md`) and a substantial amount of implemented creative machinery (`lib/forge/signature.ts`, `lib/forge/anti-ai-gate.ts`, `lib/design/*`, `lib/memory/designMemory.ts`, `lib/qa/*`). Verified by reading, the gap is **not ignorance**:

> The knowledge is not addressable by a worker at the moment of a decision, and most of it is not conditioned on *when it should not be used*.

`docs/knowledge/` exists to close that gap. Every document here is written to be queried, not read — structured so that a worker can ask a question and receive principles, constraints, anti-patterns, and sources scoped to one business.

---

## 1. The twelve documents

| # | Document | Phases | Class | Owns | Primary consumers |
|---|---|---|---|---|---|
| 0 | `KNOWLEDGE_TAXONOMY.md` | 2 | doctrine | Domain map D01–D40, the K1–K4 class system, `ACTIVATES_WHEN` / `SUPPRESSED_WHEN` discipline, activation dependency graph | All — this is the shared vocabulary |
| 1 | `BUSINESSFORGE_KNOWLEDGE_ARCHITECTURE.md` | 16, 17, 18 | doctrine | Storage architecture (hybrid Markdown + derived JSON + optional embeddings), Worker Knowledge Contract, item schema and quality gates | Platform, all workers |
| 2 | `TRUTH_AND_EVIDENCE.md` | 12 | K1 | Six epistemic states, source hierarchy T1–T6, confidence, 33 forbidden inference patterns, conflict resolution, UNKNOWN handling | Research, Content, Creative, QA |
| 3 | `HUMAN_DESIGN_PRINCIPLES.md` | 3, 7, 10 | K1+K2 | 48 principle blocks; four-tier comparison (AI / template / agency / award-winning); restraint rules; visual psychology | Creative Director, Art Director, Frontend |
| 4 | `EXPERIENCE_SIGNATURE_SYSTEM.md` | 5, 11 | K2 | Signature definition, discovery procedure, quality rubric, falsification test, propagation contract, 16 industry priors | Creative Director, Content, Experience |
| 5 | `ANTI_AI_SLOP.md` | 6 | K4 | 20 anti-patterns with detectable signals (S-STATIC / S-LAYOUT / S-VISION), category-conditional severity | QA, Creative, Frontend, gate authors |
| 6 | `AWWARDS_RESEARCH.md` | 4 | K2+K3 | 36 award-winning mechanisms as decisions; what must not be cloned; pattern-to-business allow/conditional/forbid matrix | Creative Director, Interaction, Art Director |
| 7 | `INTERACTION_LIBRARY.md` | 8 | K1+K2 | 59 interaction entries across 20 categories, with no-JS feasibility and degradation ladders | Interaction, Frontend, QA |
| 8 | `MOTION_LIBRARY.md` | 9 | K2 | 31 motion principles, duration budgets, easing catalog, stagger math, choreography, reduced-motion policy, anti-motion | Interaction, Frontend, Art Director |
| 9 | `PERFORMANCE_KNOWLEDGE.md` | 15 | K1 floor + K2 | Core Web Vitals, budgets per site tier, effect-cost matrix, when an effect is worth its cost, graceful degradation | Frontend, QA, Interaction |
| 10 | `SECURITY_KNOWLEDGE.md` | 14 | K1 | 137 `SEC-nnn` rules incl. a dedicated AI-generated-code section, with mechanical verification checks | Security, Backend, QA |
| 11 | `WEBSITE_CAPABILITY_KNOWLEDGE.md` | 13 | K2 with K1 obligations | 29 `CAP-nn` capability entries with evidence-based decision triggers, business-type matrix, minimum viable site, escalation ladder, doctrine of absence | Business Analyst, Backend, Product |

**Requested deliverable mapping.** All twelve deliverables named in the brief are present. Two deviations, both explained in `BUSINESSFORGE_KNOWLEDGE_ARCHITECTURE.md` §4.4:

- **Phase 11 (business-specific experience) was merged into `EXPERIENCE_SIGNATURE_SYSTEM.md`** rather than given its own file. Reason: a standalone industry playbook would inevitably be used as a lookup table, which is the exact anti-goal. Placing industry priors *after* the rule that "category supplies questions, never answers" (R-SIG-1) makes the constraint structural rather than advisory.
- **`KNOWLEDGE_TAXONOMY.md` was added** (a 13th file) to carry Phase 2, because the K1–K4 classes and activation discipline are referenced by every other document and needed one canonical home.

---

## 2. Authority order

When two documents appear to conflict, resolve in this order. This is the single most important operational rule in the knowledge base.

1. **`TRUTH_AND_EVIDENCE.md`** — nothing may be asserted that is not evidenced. A beautiful design resting on an invented fact is a failed delivery.
2. **K1 obligations** — `SECURITY_KNOWLEDGE.md`, accessibility floors, `PERFORMANCE_KNOWLEDGE.md` thresholds, legal/GDPR. Gates, not preferences.
3. **`ANTI_AI_SLOP.md`** — prohibitions outrank positive preferences. Knowing what not to do is denser value than knowing what to do.
4. **`EXPERIENCE_SIGNATURE_SYSTEM.md`** — the signature decides among remaining legal options.
5. **`HUMAN_DESIGN_PRINCIPLES.md`**, `MOTION_LIBRARY.md`, `INTERACTION_LIBRARY.md`, `AWWARDS_RESEARCH.md` (K2 craft) — how the signature is executed.
6. **K3 trend material** — decoration only. Never an organizing principle. A site with zero trend content can be excellent; a site organized *around* a trend cannot.

**Corollary:** a K3 item may never override a K1 gate, and a signature may never override truth. Most catastrophic autonomous-generation failures are inversions of this order.

---

## 3. How the pipeline consumes it

```
URL
 → Research ................ TRUTH_AND_EVIDENCE (states, tiers, F-01..F-33)
 → Business Understanding .. TRUTH_AND_EVIDENCE + WEBSITE_CAPABILITY (triggers)
 → Creative Concept ........ EXPERIENCE_SIGNATURE (discovery, falsification)
                             + HUMAN_DESIGN_PRINCIPLES + ANTI_AI_SLOP
 → Experience Architecture . EXPERIENCE_SIGNATURE (propagation) + HUMAN_DESIGN
 → Art Direction ........... HUMAN_DESIGN_PRINCIPLES + AWWARDS_RESEARCH
                             + ANTI_AI_SLOP (A-14, A-18)
 → Interaction Design ...... INTERACTION_LIBRARY + MOTION_LIBRARY
                             + PERFORMANCE (cost gate)
 → Frontend ................ INTERACTION + MOTION + PERFORMANCE + SECURITY
 → Backend ................. WEBSITE_CAPABILITY + SECURITY
 → Assets .................. TRUTH_AND_EVIDENCE (real assets only) + PERFORMANCE
 → QA ...................... ALL K1 gates + ANTI_AI_SLOP detectable signals
 → Repair .................. the failing document's own "what to do instead"
 → Delivery ................ SECURITY (deployment) + WEBSITE_CAPABILITY (legal)
```

**Three ordering rules from `KNOWLEDGE_TAXONOMY.md` §5 that must not be violated:**

1. No art direction before a verified asset inventory — otherwise the direction is fiction.
2. No signature-level motion or interaction before a signature survives falsification — otherwise motion is decoration by construction.
3. No capability before an evidence trigger fires — otherwise the factory builds features nobody asked for.

---

## 4. Relationship to existing repository documentation

| This KB references | Which is | Relationship |
|---|---|---|
| `docs/Design_Intelligence_Foundation.md` | 685-line sourced principle registry (NN/g heuristics, premium/trend/low-value buckets, source registry §18) | **Evidence base.** Cited, not duplicated. |
| `docs/AWWWARDS_PATTERN_LIBRARY.md` | 617-line teardown of 25 real Awwwards winners with DOM/CSS evidence | **Evidence base** for `AWWARDS_RESEARCH.md` and the agency/award columns of the four-tier table. |
| `docs/From_Business_Evidence_to_Creative_Direction.md` | Existing bridge research | Referenced by the signature system. |
| `docs/decisions/0001…0007` | Immutable ADRs | Constraints. ADR 0007 (evidence-language content) is load-bearing for `TRUTH_AND_EVIDENCE.md`. |
| `docs/skills.md` | The `Skill` contract | The shape a future knowledge-retrieval skill would follow. |
| `ARCHITECTURE_FREEZE.md`, `BUSINESSFORGE_2.0_*.md` | Architecture records | Not contradicted anywhere in this KB. |

**Code seams named (read, never modified):** `lib/forge/signature.ts`, `lib/forge/anti-ai-gate.ts`, `lib/forge/grounding.ts`, `lib/content/{evidence,director,language,quality}.ts`, `lib/design/{tokens,fingerprint,interaction,worlds,character}.ts`, `lib/memory/designMemory.ts`, `lib/qa/{visual-critic,distinctness-gate,layout-audit}.ts`, `lib/qa/gates/*`, `lib/factory/capabilities.ts`, `lib/render/*`, `lib/experience/*`.

---

## 5. Known limitations of this knowledge base

Stated plainly, because a knowledge base that hides its gaps is worse than one that admits them.

1. **It is not wired to anything.** Every document is currently inert. Value is zero until at least one worker queries it (`BUSINESSFORGE_KNOWLEDGE_ARCHITECTURE.md` §5 gives the minimal wiring order — start with the QA/anti-slop path, because that is measurable immediately).
2. **Detection thresholds are uncalibrated.** Every number marked `[CALIBRATE]` is engineering judgement, not a validated threshold. They require measurement against real generated output before becoming gates.
3. **Vision-dependent signals are unreliable today.** `lib/qa/visual-critic.ts` returns `uncertain` with no reasons when `VISION_*` is unset, and `lib/qa/distinctness-gate.ts` treats zero reasons as a pass — so vision-based checks currently fail *open*. Any gate built from `ANTI_AI_SLOP.md` must lean on S-STATIC/S-LAYOUT signals.
4. **Industry priors are 16 categories deep, not exhaustive**, and are deliberately shallow — they are question sets, and treating them as answers would reintroduce templating.
5. **Trend material decays fastest.** K3 content should be assumed stale after 12 months and expired by default.
6. **No document here has been validated against a delivered site.** These are principles awaiting empirical test.

---

## 6. The final question

> **What must BusinessForge learn to move from "AI-generated good-looking websites" to "bespoke digital experiences that feel intentionally designed by a highly skilled human studio"?**

Technically and operationally, eight things — in dependency order, because each depends on the one before it.

**1 — Learn to be constrained by reality before it is creative.**
A human studio starts with a shoot, a brand, a copy deck, a client who says no. The factory starts with nothing and therefore fills space with the plausible. Operationally: the `FactualDossier` must be **complete before creative work starts**, and every unknown must arrive at the Creative Director as an explicit prohibition, not as silence. Silence gets filled with invention; prohibitions get designed around. This is `TRUTH_AND_EVIDENCE.md` R-UNK-1, and it is the cheapest structural change with the largest effect on perceived bespokeness — because specificity, not taste, is what makes a site look made-to-measure.

**2 — Learn to produce hierarchy, not uniformity.**
The single most reliable tell of machine authorship is that everything is equally weighted: equal padding, equal section heights, equal card sizes, a display-to-body type ratio under 3× where award-winning sites run 7×. Human design is asymmetric because human attention is asymmetric. Operationally: make hierarchy **measurable and gated** — scale ratio, section-height variance, spacing coefficient of variation, focal-point count per screen. A page whose measured hierarchy is flat should fail before a human ever sees it.

**3 — Learn to justify every element, and to record the justification.**
The difference between a studio's dark palette and a model's dark palette is not the palette. It is that one was chosen for a reason that can be stated and the other was the default. Operationally: every non-obvious decision carries a link to the signature contract's `FORCES` list; anything unjustified is deleted at build time. This makes `ANTI_AI_SLOP.md` R-SLOP-2 enforceable: **the same pixel is craft when justified and slop when reflexive, and the recorded reason is the only observable difference.**

**4 — Learn to omit, and to report what it omitted.**
Human studios ship less than they consider. The factory ships everything it can generate, because generating is free and deleting requires a criterion. Operationally: the restraint contract must produce a **`FORBIDS` list that is non-empty and enforced**, and the run record must report what was refused. A delivery with nothing omitted is a delivery where no decision was made.

**5 — Learn that ambition is category-conditional.**
The teardown evidence is unambiguous: nearly all award-winning sites belong to agencies, studios, brands and artists — businesses whose site *is* the product. Their patterns (loading sequences, scroll choreography, WebGL, custom cursors) are actively harmful on a bakery or a car service, where the visitor has a retrieval task. Operationally: gate every ambitious pattern on `intentProfile`, and route ambition on retrieval-dominant sites into **craft** (composition, type, image treatment, restraint, speed) rather than **duration or spectacle**. A 400ms site with perfect typography and one real photograph is a higher achievement than a 6MB WebGL scene, and much harder.

**6 — Learn to close its gates.**
Today the visual critic and distinctness gate pass silently when vision credentials are absent, so a run can deliver with no visual QA at all. A gate whose failure mode is "pass" is decoration. Operationally: every quality check needs a deterministic, offline, S-STATIC/S-LAYOUT primary path, with vision as **corroboration, never as the sole evidence**. Fail closed. This is the difference between having quality criteria and enforcing them.

**7 — Learn to diverge across runs, not just within a run.**
Generating three creative territories per project does not prevent every bakery in the region from converging on fermentation. `lib/memory/designMemory.ts` already scopes distinctness by industry ∧ 50 km ∧ 18 months at three fingerprint layers — that mechanism must be extended to **rejected signature axes**, not only delivered fingerprints, or the system will keep rediscovering the same "best" idea and rejecting it at the wrong stage.

**8 — Learn to say "I don't know" and still deliver something excellent.**
The mark of a skilled studio with thin material is not invention; it is a beautifully restrained artifact built from the little that is true — one real photograph, one true sentence, disciplined type, generous space. Operationally: `EXPERIENCE_SIGNATURE_SYSTEM.md` §8's fallback ladder must be a **first-class successful outcome**, not an error path. A system that can deliver honest excellence from thin evidence will beat one that fabricates richness, because the fabrication is always visible to the one reader who matters — the owner.

**In one sentence.**
The transition is not from *worse* aesthetics to *better* aesthetics. It is from **unconstrained plausible generation** to **evidence-constrained, hierarchy-forced, justification-recorded, omission-reporting, category-conditional, fail-closed decision-making** — and every one of those six properties is measurable, gateable, and therefore buildable. The knowledge in this folder is the specification; the enforcement is the work that remains.
