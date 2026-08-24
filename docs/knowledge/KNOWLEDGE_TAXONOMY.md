# BusinessForge — Knowledge Taxonomy (Phase 2)

**Status:** Research artifact, pre-implementation. **Do NOT implement. Do NOT modify application code.**
**Author role:** Research Director / Knowledge Architect
**Date:** 2026-08-17
**Scope:** Defines *what BusinessForge must know*, how that knowledge is partitioned into domains, and — critically — the **activation rules** that decide when a domain is irrelevant to a given project.

---

## 0. Honesty note

This document is **structure and doctrine**, not sourced research. It contains no factual claims about the external world that require citation. Every *substantive* claim inside a domain lives in that domain's own document (see `KNOWLEDGE_INDEX.md`), where the source requirements of `BUSINESSFORGE_KNOWLEDGE_ARCHITECTURE.md` §Phase-18 apply. Claims here about the **repository** were verified by reading the files cited.

---

## 1. Why a taxonomy, and why activation matters more than coverage

A naive knowledge base answers *"what do we know about motion design?"*. That produces slop: every site gets motion, because motion knowledge exists and an eager worker will use it.

The failure mode of an autonomous factory is **not ignorance, it is indiscriminate application**. Therefore each domain in this taxonomy carries three things:

| Field | Purpose |
|---|---|
| `KNOWS` | The substance — principles, patterns, constraints. |
| `ACTIVATES_WHEN` | The evidence condition that makes the domain relevant to *this* business. |
| `SUPPRESSED_WHEN` | The condition under which using this domain is a defect, even if executed well. |

`SUPPRESSED_WHEN` is the load-bearing field. A knowledge base without it is a slop generator with citations.

---

## 2. The four knowledge classes (orthogonal to domain)

Every knowledge item is tagged with exactly one class. Class determines **authority**, **decay rate**, and **who may override it**.

| Class | Definition | Authority | Decay | Overridable by |
|---|---|---|---|---|
| **K1 — Invariant** | Perception, cognition, accessibility law, protocol/spec behaviour, security fundamentals. | Non-negotiable. Gate, not suggestion. | Decades. Re-verify annually. | Nobody. A violation is a build failure. |
| **K2 — Craft** | How skilled studios compose, pace, type-set, restrain. Stable but taste-sensitive. | Strong default. | 5–10 years. | Creative Director *with a recorded reason*. |
| **K3 — Trend** | Current surface patterns (2025/2026 idioms). | Decoration only. Never organizing principle. | 12–24 months. Stale by default. | Freely. Absence is never a defect. |
| **K4 — Anti-knowledge** | Things that look like quality and are not. Detectable slop signals. | Prohibitive. | 2–5 years (slop evolves). | Only with explicit, evidence-backed intent. |

**Doctrine:** a project may ship with **zero K3** items and still be excellent. A project that violates **one K1** item is a failure regardless of how it looks. This ordering is the spine of the whole factory.

This aligns with the existing four-bucket split already recorded in `docs/Design_Intelligence_Foundation.md` §0 (timeless UX / premium visual / current trends / fashionable-but-low-value); K1–K4 generalise it beyond design to security, performance, and capability decisions.

---

## 3. Domain map

Domains are grouped into six **families**. Family determines which worker consumes them and at which pipeline stage, per the target pipeline:

```
URL → Research → Business Understanding → Creative Concept → Experience Architecture
→ Art Direction → Interaction Design → Frontend → Backend → Assets → QA → Repair → Delivery
```

| Family | Domains | Primary consuming stage |
|---|---|---|
| **F1 Understanding** | Business Strategy, Product Design, Conversion, Branding, Content, Storytelling | Research → Business Understanding → Creative Concept |
| **F2 Concept & Form** | Design, Art Direction, Experience Design, Composition, Typography, Color, Photography, Video, 3D | Creative Concept → Experience Architecture → Art Direction |
| **F3 Behaviour** | Interaction Design, Motion Design, WebGL, Canvas, UX, UI | Interaction Design → Frontend |
| **F4 Engineering** | Backend, Database, Authentication, Payments, Email, Booking, CMS, Deployment, Analytics | Backend → Delivery |
| **F5 Obligation** | Accessibility, Performance, Security, SEO, GDPR, Legal | Every stage; enforced at QA |
| **F6 Meta** | Truth & Evidence, Knowledge Quality, Restraint | Every stage; enforced before Creative Concept |

**F6 is not optional and not last.** Truth & Evidence (`TRUTH_AND_EVIDENCE.md`) runs *before* creative work, because a signature derived from an unverified claim is unrecoverable downstream — repair cannot fix a concept whose premise is invented.

---

## 4. Domain register

Each entry: `KNOWS` / `ACTIVATES_WHEN` / `SUPPRESSED_WHEN` / class mix / owning document.

### F1 — Understanding

**D01 BUSINESS STRATEGY** — *K2*, doc: `EXPERIENCE_SIGNATURE_SYSTEM.md`
- KNOWS: what the business sells, to whom, at what price tier, against whom; where revenue actually comes from; what the site's single job is.
- ACTIVATES_WHEN: always. This is the root of the dependency graph.
- SUPPRESSED_WHEN: never suppressed. But it must not be *inferred from category* — a bakery may live on wholesale contracts, not walk-ins, and the site's job changes completely.

**D02 PRODUCT DESIGN** — *K2*, doc: `WEBSITE_CAPABILITY_KNOWLEDGE.md`
- KNOWS: how to shape a flow (booking, enquiry, purchase, application) around a real user task.
- ACTIVATES_WHEN: the site must accomplish a transaction or state change, not just inform.
- SUPPRESSED_WHEN: the business's real conversion happens off-site (phone, walk-in, WhatsApp, broker). Then designing an on-site flow *reduces* conversion by adding a step.

**D03 CONVERSION** — *K2*, doc: `HUMAN_DESIGN_PRINCIPLES.md`, `WEBSITE_CAPABILITY_KNOWLEDGE.md`
- KNOWS: friction reduction, proof placement, single-primary-action discipline, form economics.
- ACTIVATES_WHEN: a measurable action exists and matters.
- SUPPRESSED_WHEN: the site is a reputation/portfolio artifact where the "conversion" is *being remembered*. Conversion tactics (repeated CTAs, urgency, sticky bars) actively damage those. See `ANTI_AI_SLOP.md` (repeated CTAs).

**D04 BRANDING** — *K2*
- KNOWS: how an existing brand constrains palette, type, voice, and how to work when no brand system exists.
- ACTIVATES_WHEN: brand assets exist and were verified (logo, colors, wordmark, tone in owned copy).
- SUPPRESSED_WHEN: no verified brand evidence — then the factory **invents an art direction, not a brand**, and must not present invented brand elements as the client's identity.

**D05 CONTENT** — *K1 (truthfulness) + K2 (craft)*, doc: `TRUTH_AND_EVIDENCE.md`
- KNOWS: how to write from evidence, in the business's language and register; what must never be asserted.
- ACTIVATES_WHEN: always.
- SUPPRESSED_WHEN: never. Note the repo already enforces evidence-language content (`docs/decisions/0007-content-is-directed-by-narrative-role-and-written-in-the-evidence-language.md`, `lib/content/language.ts`).

**D06 STORYTELLING** — *K2*
- KNOWS: sequence, tension, revelation, payoff as spatial/scroll structure.
- ACTIVATES_WHEN: the business has a *process, transformation, or history* worth traversing (fermentation, restoration, construction, craft).
- SUPPRESSED_WHEN: user intent is retrieval ("where, when, how much, book"). A narrative scroll placed in front of a hungry user's opening hours is a hostile design.

### F2 — Concept & Form

**D07 DESIGN (system-level)** — *K1+K2*
- KNOWS: token systems, one spacing scale, one type scale, grid discipline, consistency.
- ACTIVATES_WHEN: always.
- SUPPRESSED_WHEN: never. Repo has this: `lib/design/tokens.ts`, `layout.ts`, `compose.ts`.

**D08 ART DIRECTION** — *K2*, doc: `HUMAN_DESIGN_PRINCIPLES.md`
- KNOWS: subject choice, crop, treatment, palette derivation from real material, light logic.
- ACTIVATES_WHEN: real imagery or real material references exist.
- SUPPRESSED_WHEN: only generic stock is available — then reduce to typographic/editorial direction rather than art-directing lies. (Repo signal: `realPhotoAssets` in `lib/forge/types.ts`; `lib/art/*`.)

**D09 EXPERIENCE DESIGN** — *K2*, doc: `EXPERIENCE_SIGNATURE_SYSTEM.md`
- KNOWS: how a signature becomes an architecture of screens, rhythms, and moments.
- ACTIVATES_WHEN: always, at low intensity; at high intensity when a defensible signature survives falsification.
- SUPPRESSED_WHEN: the signature is unfalsifiable or cliché — then fall back to disciplined editorial clarity, which is never a failure.

**D10 COMPOSITION** — *K2*, **D11 TYPOGRAPHY** — *K1(legibility)+K2(voice)*, **D12 COLOR** — *K1(contrast)+K2(palette)*
- KNOWS: hierarchy, asymmetry, tension, optical alignment / type scale, pairing, measure, tracking / contrast ratios, semantic vs decorative color.
- ACTIVATES_WHEN: always.
- SUPPRESSED_WHEN: never — but note the K1 floor (WCAG contrast, minimum sizes, line length) is a gate; the K2 layer above it is directorial.

**D13 PHOTOGRAPHY**, **D14 VIDEO**, **D15 3D**
- KNOWS: treatment grammar, motion-as-medium, spatial representation, asset budgets.
- ACTIVATES_WHEN: verified real assets exist (photography); the subject is *temporal or spatial* and cannot be shown statically (video/3D).
- SUPPRESSED_WHEN: the asset would be decorative rather than informative; when the business's real photos are poor (then crop/treat rather than replace with fiction); when 3D adds weight without conveying anything a photo could not. See `ANTI_AI_SLOP.md` (unnecessary 3D).

### F3 — Behaviour

**D16 INTERACTION DESIGN** — *K1(affordance/a11y)+K2(craft)*, doc: `INTERACTION_LIBRARY.md`
- ACTIVATES_WHEN: always for affordances; selectively for signature interactions.
- SUPPRESSED_WHEN: the interaction has no user purpose. "Interaction without purpose" is an explicit anti-pattern.

**D17 MOTION DESIGN** — *K2*, doc: `MOTION_LIBRARY.md`
- ACTIVATES_WHEN: motion carries continuity, causality, or feedback.
- SUPPRESSED_WHEN: `prefers-reduced-motion` (K1 override), low-power/slow-network contexts, or when motion merely announces that motion exists.

**D18 WEBGL**, **D19 CANVAS**
- ACTIVATES_WHEN: the effect is impossible in CSS/SVG *and* central to the signature.
- SUPPRESSED_WHEN: it can be done with CSS/SVG at a fraction of cost; on conversion-critical first paint; on content sites where LCP is the whole game. Cost rules in `PERFORMANCE_KNOWLEDGE.md`.

**D20 UX**, **D21 UI** — *K1*
- ACTIVATES_WHEN: always. Navigability, status visibility, error recovery, consistency.
- SUPPRESSED_WHEN: never. Novelty navigation must pass the UX floor before it is allowed to be novel.

### F4 — Engineering

**D22 BACKEND**, **D23 DATABASE**, **D24 AUTHENTICATION**, **D25 AUTHORIZATION**, **D26 PAYMENTS**, **D27 EMAIL**, **D28 BOOKING**, **D29 CMS**, **D30 DEPLOYMENT**, **D31 ANALYTICS** — doc: `WEBSITE_CAPABILITY_KNOWLEDGE.md`
- ACTIVATES_WHEN: each has an explicit evidence-based decision trigger (see that document's decision table). Example: *booking* activates only when the business demonstrably schedules time-slotted service AND has capacity constraints AND no adequate existing booking system.
- SUPPRESSED_WHEN: no trigger fires. **Default is absence.** Every capability added is attack surface, maintenance, and cost. A brochure site with an unused auth system is a defect, not generosity.
- Doctrine: *capability is opt-in on evidence, never opt-out on caution.*

### F5 — Obligation

**D32 ACCESSIBILITY** — *K1*, **D33 PERFORMANCE** — *K1 floor + K2 tradeoff*, **D34 SECURITY** — *K1*, **D35 SEO** — *K1 floor + K2*, **D36 GDPR** — *K1*, **D37 LEGAL** — *K1*
- ACTIVATES_WHEN: always (floors). Escalated intensity when the site collects data, takes payment, targets EU users, or serves a regulated profession (clinic, law firm).
- SUPPRESSED_WHEN: **never suppressed.** These are gates. The only tunable is *depth*, never *presence*. Cookie banners are the one inversion: a site with no tracking must **not** ship a consent banner — adding one is both a legal misstatement and a UX defect.
- Repo already has partial enforcement: `lib/qa/gates/{accessibility,performance,technical}.ts`.

### F6 — Meta

**D38 TRUTH & EVIDENCE** — *K1*, doc: `TRUTH_AND_EVIDENCE.md`
- ACTIVATES_WHEN: before any creative decision that references reality.
- SUPPRESSED_WHEN: never. Preference for `UNKNOWN` over invention is absolute.

**D39 RESTRAINT** — *K2 with K4 teeth*, doc: `HUMAN_DESIGN_PRINCIPLES.md` §Restraint
- KNOWS: when to add, remove, simplify; that a single photograph and a single sentence can outperform a full experience.
- ACTIVATES_WHEN: at every add decision.
- SUPPRESSED_WHEN: never — but restraint is not minimalism-as-style. Removing until nothing is communicated is a different failure.

**D40 KNOWLEDGE QUALITY** — *K1 for the KB itself*, doc: `BUSINESSFORGE_KNOWLEDGE_ARCHITECTURE.md`
- KNOWS: item schema, source requirements, confidence, freshness, review.
- ACTIVATES_WHEN: any knowledge item is written or retrieved.

---

## 5. Activation is a graph, not a checklist

Domains have dependencies. Activating a downstream domain without its prerequisite is a known slop route.

```
D38 Truth&Evidence
   └─> D01 Business Strategy
          ├─> D09 Experience Design ──> D08 Art Direction ──> D10/11/12 Composition/Type/Color
          │        └─> D06 Storytelling (only if process/history verified)
          ├─> D16 Interaction ──> D17 Motion ──> D18/19 WebGL/Canvas (cost-gated by D33)
          └─> D02/D03 Product/Conversion ──> F4 capabilities (trigger-gated)

F5 obligations wrap ALL of the above as gates, not as steps.
D39 Restraint is consulted at every ADD edge.
```

**Three hard ordering rules:**
1. No art direction before a verified asset inventory. Otherwise the direction is fiction.
2. No signature-level interaction or motion before a signature exists that survived falsification. Otherwise motion is decoration by construction.
3. No F4 capability before a trigger fires from evidence. Otherwise the factory builds features nobody asked for.

---

## 6. What the repository already covers (verified by reading)

Recording this so the knowledge base does not re-describe implemented behaviour as if it were missing.

| Taxonomy area | Already present in repo | File |
|---|---|---|
| Experience Signature + 3 creative territories + restraint contract | Yes, implemented | `lib/forge/signature.ts` |
| Anti-generic / anti-hallucination audit | Yes, deterministic + heuristic | `lib/forge/anti-ai-gate.ts` |
| Scoped design distinctness memory (industry ∧ 50 km ∧ 18 mo, 3 fingerprint layers) | Yes | `lib/memory/designMemory.ts`, `lib/design/fingerprint.ts` |
| Design system primitives (tokens, layout, color, character, worlds, interaction, patterns, quality, divergence) | Yes, 21 modules | `lib/design/` |
| Experience runtime + shader/styles emission | Yes | `lib/experience/` |
| QA gates: accessibility / performance / technical, visual critic, distinctness gate, layout audit, jury, verdict | Yes | `lib/qa/` |
| Evidence + grounding + content direction + language | Yes | `lib/content/`, `lib/forge/grounding.ts` |
| Capability routing vocabulary | Yes | `lib/factory/capabilities.ts` |
| Awwwards visual evidence (25 sites, DOM-level) | Yes, research artifact | `docs/AWWWARDS_PATTERN_LIBRARY.md` |
| Sourced UX/premium/trend principle registry | Yes, research artifact | `docs/Design_Intelligence_Foundation.md` |
| **Knowledge storage/retrieval layer, worker knowledge contract** | **No** | — proposed in `BUSINESSFORGE_KNOWLEDGE_ARCHITECTURE.md` |

The gap is therefore **not design knowledge** — a large amount exists. The gap is that knowledge is **not addressable by a worker at decision time**, and much of it is **not activation-conditioned**. That is what this knowledge base exists to fix.
