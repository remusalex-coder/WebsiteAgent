# BUSINESSFORGE KNOWLEDGE ARCHITECTURE (Phases 16, 17, 18)

**Status:** Research artifact, pre-implementation. **Do NOT implement. Do NOT modify application code.**
**Author role:** Research Director / Knowledge Architect
**Date:** 2026-08-17
**Scope:** How the knowledge base is stored (Phase 16), how a worker asks it for knowledge (Phase 17), and what makes a knowledge item acceptable (Phase 18).

---

## 0. Honesty note

This document proposes an architecture. It contains **no external factual claims requiring citation**; its content is design reasoning plus verified facts about this repository. Every repository claim below was verified by reading the named file. Nothing here is implemented — the schemas are *specifications for a future implementation*, and the naming deliberately mirrors seams that already exist (`lib/factory/capabilities.ts`, `docs/skills.md`) so that an implementation would fit rather than intrude.

---

## 1. Where `docs/knowledge/` sits, and why it does not duplicate what exists

The repository already contains substantial documentation across three distinct layers, and the new folder is a fourth, distinct layer:

| Layer | Location | Nature | Audience |
|---|---|---|---|
| **Architecture & contracts** | `docs/architecture.md`, `docs/folder-structure.md`, `docs/skills.md`, `docs/renderer.md`, `docs/providers.md`, `ARCHITECTURE_FREEZE.md`, `BUSINESSFORGE_2.0_*.md` | How this system is built. Normative about *code*. | Developers |
| **Decisions** | `docs/decisions/0001…0007` | Why the system is built that way. Immutable records. | Developers |
| **Runbooks** | `docs/runbooks/*` | How to operate it. | Operators |
| **Research** | `docs/Design_Intelligence_Foundation.md`, `docs/AWWWARDS_PATTERN_LIBRARY.md`, `docs/From_Business_Evidence_to_Creative_Direction.md` | Sourced findings about the *outside world*. Prose, human-first, not addressable. | Humans, currently |
| **→ Knowledge (new)** | `docs/knowledge/*` | Decision-ready knowledge about the outside world, **structured for retrieval by a worker at decision time**. | Workers first, humans second |

**The gap being filled is not content, it is addressability.** `Design_Intelligence_Foundation.md` (685 lines) and `AWWWARDS_PATTERN_LIBRARY.md` (617 lines) already hold high-quality, sourced design knowledge — but a worker cannot ask them a question. They are read by people, in full, occasionally. Knowledge that cannot be retrieved at the moment of a decision does not influence decisions.

**Non-duplication rule.** `docs/knowledge/` **cites** the two research documents as evidence bases rather than restating them (`AWWARDS_RESEARCH.md` explicitly reuses the 25-site teardown and its `P-0xx` pattern ids). If a knowledge item's substance already exists in `docs/`, the item carries a pointer, not a copy. The knowledge layer's contribution is *structure, activation conditions, and decision shape*.

---

## 2. Phase 16 — Storage architecture

### 2.1 Requirements, in priority order

Derived from what this repository actually values (verified: `docs/runbooks/offline-verification.md` exists; the pipeline is deterministic and offline-verifiable; ADRs are immutable git-tracked records):

1. **Deterministic and offline-capable.** A run must be reproducible without network access. Any retrieval mechanism that *requires* a remote service is disqualified as the primary path.
2. **Diffable in git.** Knowledge evolves; changes must be reviewable line by line. This is how the repo already treats its ADRs.
3. **Human-authorable and human-readable.** Knowledge is written and corrected by people. An authoring format that needs tooling will rot.
4. **Worker-consumable.** A worker needs a subset, filtered by capability and context, with a token budget — not a 600-line document.
5. **Source-backed and versioned.** Every claim traceable; every change attributable.
6. **Freshness-aware.** A K3 trend item and an OWASP rule decay at wildly different rates.

### 2.2 Honest comparison of the options

| Option | Authoring | Diffable | Retrieval precision | Determinism | Verdict |
|---|---|---|---|---|---|
| **Markdown only** | Excellent | Excellent | Poor — whole-file or grep. No filtering by activation condition, worker, or confidence. | Perfect | **Necessary but insufficient.** This is what the repo has today, and the reason knowledge is unused. |
| **JSON / JSONL only** | Poor — nobody writes nuanced principles comfortably in JSON string fields; prose gets truncated to fit | Technically yes, practically noisy (one-line diffs of huge strings) | Good — filterable, cheap | Perfect | **Wrong as a source of truth.** Correct as a *derived artifact*. |
| **Knowledge graph (typed nodes + relations)** | High cost | Moderate | Excellent for relationships ("what anti-patterns conflict with this pattern?") | Good | **Justified only for the relationship layer**, not for the prose. Full-graph modelling is disproportionate at this size. |
| **Vector search / embeddings** | n/a (derived) | No — binary blobs, unreviewable | Good for fuzzy semantic queries; **poor for hard constraints** (it will happily return a K3 trend when a K1 rule was required) | Poor — model-dependent, network-dependent, non-reproducible across model versions | **Useful as a secondary recall path, never as the authority.** Cannot be trusted to enforce a gate. |
| **Hybrid** | — | — | — | — | **Recommended.** |

**Two conclusions worth stating plainly:**

- **Plain Markdown is not sufficient** — the brief's suspicion is correct, and the evidence is in this very repository: two excellent research documents exist and neither influences a single generated site.
- **Embeddings are not the answer either.** The dominant retrieval need here is *conditional* ("which principles activate for a retrieval-dominant local business with poor photography and no verified history?"), not *semantic similarity*. Conditions are filters. Filters want structured metadata, not cosine distance. Semantic search is a good *fallback* for exploratory queries and a bad *primary* for a system whose correctness depends on not missing a K1 rule.

### 2.3 The recommended hybrid

Three layers, each with one job:

**Layer 1 — Markdown source of truth, with YAML frontmatter.** Human-authored, git-tracked, one file per knowledge domain (as now), with each item carrying structured frontmatter-equivalent fields. Prose stays prose; metadata becomes machine-readable. **This layer is authoritative. If the other two disagree with it, they are wrong and get rebuilt.**

**Layer 2 — Derived JSON index.** A build step parses Layer 1 into a queryable index: item id, title, one-line principle, class, tags, activation conditions, suppression conditions, applicable workers, confidence, source count, freshness, and a pointer back to the Markdown anchor. Committed to git (so it is diffable and offline-available) but never hand-edited. This is what a worker actually queries. It is small, deterministic, and cheap to filter.

**Layer 3 — Optional embeddings sidecar.** Built from Layer 1 prose, used only for exploratory recall when a structured query returns too few results. Never committed. Never authoritative. Its absence must degrade the system to "structured queries only", not to failure — the same fail-closed discipline that `ANTI_AI_SLOP.md` R-SLOP-3 demands of gates.

**Relationships** are expressed as typed links inside item metadata (`conflictsWith`, `requires`, `refines`, `supersedes`, `evidenceIn`), not as a separate graph store. That yields graph traversal where it is needed, at near-zero cost, and stays diffable.

### 2.4 Freshness policy by knowledge class

Reusing the K1–K4 classes from `KNOWLEDGE_TAXONOMY.md`:

| Class | Examples | Re-verify every | On staleness |
|---|---|---|---|
| **K1 invariant** | WCAG criteria, OWASP rules, perception principles, spec behaviour | 12 months | Flag for review; **keep enforcing**. A stale K1 rule is still far better than none. |
| **K2 craft** | Composition, typography, restraint | 24 months | Flag; keep. |
| **K3 trend** | Current surface idioms | 12 months | **Expire by default.** A stale trend item is worse than no item — it will be applied as if current. |
| **K4 anti-knowledge** | Slop signals | 12–18 months | Flag; keep, but review calibration thresholds, since slop evolves as models change. |

**Asymmetry rule:** K1 fails *safe when stale* (keep enforcing), K3 fails *unsafe when stale* (expire). The freshness policy must therefore be per-class, not global.

### 2.5 Versioning

- Knowledge items carry a semantic-ish version and a `supersedes` link. History is git history — no in-file changelogs.
- **A knowledge item that influenced a delivered site must remain resolvable.** A run record should reference item ids *and* the commit of the index it queried, so a delivered design's reasoning can be reconstructed later. Without this, "why did the system choose that?" is unanswerable six months on.
- Deleting an item is a supersede-with-tombstone, never a silent removal, because cron jobs, gates, and run records may reference the id.

---

## 3. Phase 17 — The Worker Knowledge Contract

### 3.1 Design principles for the contract

1. **A worker asks a question; it does not browse.** No worker reads a document.
2. **The response is a decision aid, not a reading list.** Principles with activation conditions, plus the anti-patterns that would disqualify obvious answers.
3. **The contract must be able to say "I don't know."** Mirroring `TRUTH_AND_EVIDENCE.md`, a knowledge system that always returns something plausible is a slop amplifier. Insufficient coverage must be reported as such.
4. **Anti-patterns are returned unasked.** The most valuable thing the KB can do is tell a Creative Worker which five attractive options are known failures. Positive knowledge alone produces confident slop.
5. **Naming aligns with existing seams.** Capability vocabulary follows `FACTORY_CAPABILITIES` in `lib/factory/capabilities.ts` (`research`, `content`, `design.concept`, `coding.frontend`, `vision`); if implemented as a platform skill it would follow the `Skill` contract in `docs/skills.md` (stable kebab-case id, semver, `execute`, `health`) — described here, not implemented.

### 3.2 Request shape

| Field | Meaning |
|---|---|
| `worker` | Role identity (creative-director, art-director, interaction, frontend, backend, security, qa, content). Filters `applicableWorkers`. |
| `capability` | The factory capability in play, per `lib/factory/capabilities.ts`. |
| `question` | Natural-language intent — the human-readable ask. |
| `context.businessType` | Category prior only; never an answer source (`EXPERIENCE_SIGNATURE_SYSTEM.md` R-SIG-1). |
| `context.intentProfile` | `retrieval-dominant` \| `reputation-dominant` \| `transaction-dominant`. **The single highest-leverage field**, because it flips the severity of half the K4 library. |
| `context.signature` | The signature contract's `FORCES` / `FORBIDS` lists, if a signature exists. |
| `context.evidence` | Available asset and claim summary: has real photography? verified history? verified prices? — because knowledge that requires unavailable material must not be returned. |
| `context.unknowns` | Explicit prohibitions from `TRUTH_AND_EVIDENCE.md` R-UNK-1. |
| `constraints` | Performance tier, accessibility level, no-JS delivery envelope, licensing limits. |
| `classFilter` | Which K-classes are admissible. A QA gate asks for K1 only. A Creative Worker asks for K2+K4. |
| `budget` | Max items and max tokens. Forces the KB to rank rather than dump. |
| `excludeIds` | Items already applied — prevents the same three principles driving every project (a convergence guard complementing `lib/memory/designMemory.ts`). |

### 3.3 Response shape

| Field | Meaning |
|---|---|
| `principles[]` | Ranked items: id, title, principle sentence, when/when-not, class, confidence, source pointers. |
| `examples[]` | Concrete precedents, each with provenance (e.g. a teardown site from `docs/AWWWARDS_PATTERN_LIBRARY.md`) — and an explicit `doNotClone` note where the example is a specific studio's signature. |
| `constraints[]` | Hard limits that apply regardless of preference (contrast floors, motion budgets, reduced-motion obligations). |
| `technicalOptions[]` | Implementation routes with cost and feasibility, including whether it works in the current no-JS static renderer. |
| `antiPatterns[]` | K4 items that apply to this question, with their detectable signals. **Mandatory and non-empty where any apply.** |
| `sources[]` | URLs + access dates + which claim each supports. |
| `confidence` | Per item and overall. |
| `coverageGaps[]` | What the question asked that the KB cannot answer. |
| `sufficiency` | `sufficient` \| `partial` \| `insufficient`. |
| `indexVersion` | The commit of the Layer-2 index, for reproducibility. |

**R-KC-1 — `insufficient` must be actionable.** When the KB cannot answer, it returns the nearest adjacent knowledge, the specific gap, and the instruction that the worker must proceed conservatively (defaults, not invention) — never a confident-sounding synthesis of nothing.

**R-KC-2 — Anti-patterns cannot be suppressed by budget.** If the budget is tight, drop positive principles before dropping anti-patterns. Knowing what not to do is denser value per token.

**R-KC-3 — Every response is attributable.** A worker's output should be able to cite the item ids that shaped it, so a delivered site's design decisions are traceable to knowledge, exactly as content is traceable to evidence.

### 3.4 Worked example queries

**1 — Creative Director (the brief's own example).**
*Query:* "Find principles for cinematic opening sequences appropriate for a luxury wedding venue without using generic wedding clichés."
`worker: creative-director`, `capability: design.concept`, `intentProfile: transaction-dominant` (venue enquiries), `evidence: {realPhotography: true, verifiedCapacity: true, verifiedHistory: false}`, `classFilter: [K2, K4]`.
*Expected response shape:* principles on withholding and reveal, on threshold/approach sequencing, on scale as anticipation; **constraints** noting that a long opening sequence conflicts with a transaction-dominant intent profile and must be earned or compressed; **antiPatterns** returning the wedding cliché stack (soft-focus couples, script type, "your special day", rose-gold gradients) *and* `A-05`/`A-13` plus the venue-specific note that capacity and price must not be delayed by the sequence; **examples** citing typographic and threshold treatments from the teardown set with `doNotClone` flags; **coverageGaps** noting that no verified history means heritage-based openings are prohibited (`R-UNK-1`).
*This response is more useful for what it forbids than for what it offers* — which is the point of the whole design.

**2 — Art Director.** "Palette and image treatment for a bakery where the only assets are 6 phone photos of product, poorly lit." → material-derived palette principles, crop-and-treat over replace, consistent grade with varied composition; anti-patterns `A-14` (dark luxury reflex), `A-18` (stock-style uniformity); constraint: no stock substitution (`TRUTH_AND_EVIDENCE.md` F-15).

**3 — Interaction Worker.** "One signature interaction for an architecture studio portfolio, no-JS renderer." → CSS-only reveal/scroll-driven options with feasibility flags; constraints on reduced motion and keyboard operability; anti-patterns `A-20`, scroll-jacking prohibition; `coverageGaps` if the desired effect requires a JS runtime the repo does not ship.

**4 — Frontend Worker.** "Is a full-bleed hero video acceptable for a car service site?" → expected `sufficiency: sufficient` with a **negative** answer: retrieval-dominant intent + performance rules (`PERFORMANCE_KNOWLEDGE.md`) + `A-19`/`R-SLOP-4` → forbid; technicalOptions offer a poster-image alternative.

**5 — Backend Worker.** "Does this business need authentication?" → `WEBSITE_CAPABILITY_KNOWLEDGE.md` decision triggers; doctrine of absence; anti-pattern "auth on a brochure site"; SEC rule references for the case where the trigger does fire.

**6 — Security Worker.** "Rules applying to a static site with one contact form." → K1-only filter, returning the applicable `SEC-nnn` subset (injection via form handling, rate limiting, secrets, headers, privacy) and explicitly excluding the large body of rules that do not apply — **exclusion is a deliverable**, since an over-broad checklist is ignored.

**7 — QA Worker.** "What must block delivery for this build?" → K1 + K4 only, with detectable signals and thresholds, plus the fail-closed note (`R-SLOP-3`) that vision-dependent checks cannot be the sole defence.

---

## 4. Phase 18 — Knowledge quality

### 4.1 Mandatory item schema

Every item must carry all of these; an item missing any is invalid.

| Field | Rule |
|---|---|
| `id` | Stable, prefixed by domain (`HD-`, `A-`, `MO-`, `SEC-`, `CAP-`, `P-`, `F-`). Never reused. |
| `title` | Specific noun phrase. Not an adjective. |
| `principle` | **One imperative sentence** stating the decision rule. This is the field a worker acts on. |
| `explanation` | Why it holds — mechanism, not restatement. |
| `whenToUse` | Activation condition, ideally evaluable. |
| `whenNotToUse` | **Required and non-empty.** An item that always applies is either a K1 invariant (say so) or is not a real principle. |
| `example` | A concrete, real, named instance. |
| `antiPattern` | The failure mode this prevents, linked to a K4 id where one exists. |
| `technicalImplication` | What it costs and what it forces in implementation. |
| `source` | URL or in-repo path. **Required when presented as research.** |
| `sourceDate` | Access/publication date. |
| `confidence` | High / Medium / Low, with the reason. |
| `tags` | Domain, discipline, business-intent profile. |
| `applicableWorkers` | Which roles may receive it. |
| `knowledgeClass` | K1–K4. Determines authority and decay. |
| `relations` | `conflictsWith`, `requires`, `refines`, `supersedes`, `evidenceIn`. |

### 4.2 Validation rules

- **Q-01 — No unsourced research.** Any item presented as a finding about the outside world without `source` + `sourceDate` is **rejected**. Doctrine and schema items must be explicitly labelled as doctrine, not research (this document does so in §0).
- **Q-02 — No adjective principles.** The `principle` field must state a rule that can reject a candidate design. "Use a premium aesthetic" is rejected; "Set the display-to-body size ratio above 3× so the first screen has a single unambiguous focal point" is accepted.
- **Q-03 — `whenNotToUse` must be non-trivial.** "When it doesn't fit" is rejected. It must name a real condition under which applying the item is a defect.
- **Q-04 — Single-source claims cannot be K1.** Invariant status requires either a normative spec (W3C/WHATWG/WCAG/OWASP) or multiple independent sources — the same independence discipline as `TRUTH_AND_EVIDENCE.md` R-CONF-3.
- **Q-05 — Conflicts are surfaced, not averaged.** Where two sources or two principles genuinely conflict, both are recorded with a `conflictsWith` link and a note on which context favours which. Averaging destroys the information that matters.
- **Q-06 — Calibration numbers are labelled.** Any threshold that is engineering judgement rather than a cited standard is marked `[CALIBRATE]`, as done throughout `ANTI_AI_SLOP.md`.
- **Q-07 — Examples carry clone warnings.** An example that is a specific studio's signature must say so, so it is used as a mechanism and not copied.
- **Q-08 — No duplication of `docs/`.** Point, don't copy.

### 4.3 Reviewer checklist

1. Does `principle` reject something? If not, send back.
2. Is `whenNotToUse` a real condition?
3. Is every research claim sourced with a date, and did the source actually get fetched?
4. Is the class right — is a trend masquerading as an invariant?
5. Would a worker be able to act on this without reading the prose?
6. Does it duplicate an existing item or an existing `docs/` document?
7. Are thresholds marked as calibration where they are not standards?
8. Are the anti-pattern links present?

### 4.4 Should any deliverables be merged?

Assessed honestly, and the answer is **mostly no**, with one recommendation and one addition:

- **Keep separate:** `INTERACTION_LIBRARY.md` and `MOTION_LIBRARY.md`. They overlap but have different shapes — one is a catalog of *things*, the other a set of *principles*. Merging would bury the principles inside the catalog, which is exactly how motion becomes a copy-paste cookbook.
- **Keep separate:** `SECURITY_KNOWLEDGE.md` and `WEBSITE_CAPABILITY_KNOWLEDGE.md`, despite heavy cross-referencing. Different consuming workers, different decay rates, different authority (security is K1, capability selection is a K2 judgement).
- **Recommended merge — already made:** the brief's Phase 5 (Experience Signature) and Phase 11 (business-specific experience) are delivered in **one** document, `EXPERIENCE_SIGNATURE_SYSTEM.md`. Reason: separating them is precisely what turns industry priors into templates. Placing the per-industry material *inside* the signature document, after the explicit rule that category supplies questions and never answers (R-SIG-1), makes the anti-template constraint structurally unavoidable. Splitting them would produce a standalone "industry playbook" file that a future worker would inevitably use as a lookup table.
- **Addition — `KNOWLEDGE_TAXONOMY.md`** was added beyond the 12 requested deliverables to carry Phase 2, because the taxonomy's `ACTIVATES_WHEN` / `SUPPRESSED_WHEN` discipline and the K1–K4 class system are referenced by every other document and needed one canonical home.

---

## 5. Implementation-readiness note (for a future session, not for now)

If and when this is implemented, the smallest useful first step is **not** a vector database. It is:

1. Add frontmatter-equivalent metadata to the existing `docs/knowledge/*` items.
2. Add a build step producing the Layer-2 JSON index.
3. Expose it as a read-only platform skill following `docs/skills.md`, with the request/response contract in §3.
4. Wire **one** worker to it — the highest-leverage being the QA/anti-slop path, because that turns the K4 library into enforcement and makes the value measurable immediately.
5. Only then consider embeddings.

Steps 1–4 are deterministic, offline, diffable, and require no new infrastructure. That ordering also respects `ARCHITECTURE_FREEZE.md` and the one-call and provider discipline recorded in the ADRs.
