# BusinessForge — Experience / Design Intelligence (Final)

This document exists because "Awwwards-level" is not a style to hardcode — it's an outcome of a business getting the *right* experience for what it actually is, evidenced by real facts about it, never a template with the color swapped. This is the single highest-risk area for BusinessForge to get wrong, because "wrong" here doesn't throw an error — it silently ships a competent-looking brochure site that fails the actual product goal.

## 1. What "premium" means, operationally

Premium is not decoration. Operationally, a BusinessForge output is premium when four things are simultaneously true, each independently checkable by the existing QA subsystem rather than by taste:

1. **Every claim on the page is evidence-backed** (`basis: quoted|composed|framing` tagging, `lib/content/evidence.ts`) — a premium site that lies about a rating or invents a review is not premium, it's a liability. This is already enforced.
2. **The experience is distinct from the last N sites BusinessForge produced** — checked mechanically by `lib/design/fingerprint.ts` + `lib/qa/distinctness-gate.ts`, not by a human's gut feeling that it "looks different."
3. **Every motion/3D/interaction primitive used is real and executes**, never a primitive that exists only in a Director's suggestion — enforced by `lib/design/experienceRegistry.ts`'s registry gate (a primitive not in the registry, or over budget, is simply dropped before render).
4. **It passes the QA jury's blocking dimensions before quality/distinctness are even considered** (`lib/qa/verdict.ts`'s lexicographic ordering — blocking dims first, never averaged away by a high style score).

None of these four is a style adjective. This is deliberate: "premium" was made falsifiable so it can gate a pipeline, not just describe a taste.

## 2. How an experience opportunity is identified

The Design Director (`agents/designDirectorAgent.ts`) does not start from a blank canvas or a fixed template list. It starts from the **Business Character** derived upstream from Evidence Intelligence — the same evidence pipeline that already refuses to invent facts refuses to invent character too: a restaurant with three verified 5-star reviews praising "romantic," "candlelit," "date night" gets a different character read than one whose evidence emphasizes "fast," "family," "kid menu," even though both are restaurants. The opportunity for a signature experience is identified where the evidence signal is *strong and specific*, not generic — a business with thin, generic evidence (a handful of unremarkable facts) gets a more conservative directive, because there is nothing distinctive in the evidence to express; inventing distinctiveness the evidence doesn't support would violate the evidence-first principle that governs the rest of the pipeline.

## 3. The decision mechanism: closed sets, not free-form generation

This is the load-bearing architectural choice (ADR 0004) and the reason BusinessForge does not need to hardcode a style: the Director never outputs raw numbers, raw CSS, or free-form creative prose describing a vibe. It outputs choices from **closed sets** — named layout archetypes, named motion intensities, named interaction patterns, named narrative structures — the same discipline the evidence layer applies to facts, applied to design decisions. A closed set is auditable (you can enumerate every possible output and check each one renders), a free-form generation is not.

Concretely, the categories the Director chooses between (each a closed enum, not a free text field):

- **Layout archetype** — the section-ordering and structural skeleton (e.g. hero-led narrative vs. grid-led catalog vs. single-scroll story) drawn from what the business's evidence supports narratively.
- **Motion intensity** — from none/subtle/expressive, gated against the runtime primitive budget so an "expressive" choice for a business with a rich evidence story doesn't silently degrade to nothing on a low-primitive-budget render.
- **3D usage** — only requested when the registry has a real, executable primitive available (`three-js-hero-object` today) and the business character justifies spatial/object presence (a product-forward or craft-forward business reads differently than a service consultancy).
- **Interaction pattern** — how the visitor is invited to explore (scroll-driven reveal, direct navigation, progressive disclosure) chosen against the evidence's own structure (a restaurant with a rich menu benefits from progressive disclosure; a lawyer's evidence is usually flatter and better served by direct, trust-forward structure).
- **Imagery treatment** — how real vs. evidenced imagery is framed, never inventing imagery beyond what `lib/forge/assetStrategy.ts` classifies as real-vs-generated-appropriate.
- **Typography pairing** and **narrative structure** — closed pairings tied to the same character read, not independently randomized (a pairing is chosen as a unit so the result is coherent, not a grab-bag of independently "premium" choices that don't cohere with each other).

Only one of these — `runtimePrimitives` — currently reaches the render mechanically rather than staying advisory: the Director requests primitive ids, `directiveRuntimePrimitiveIds()` extracts them (shape-only: dedup, drop malformed, defensive cap), and `resolvePrimitives()` in the registry is the sole authority that decides which of those requests are real, executable, and within budget (this session's fix removed a duplicate, out-of-place validation that had crept into the extraction step — the two-stage seam is intentional and is what `test/design/directorRuntimeSeam.test.ts` proves). The other fields stay advisory inputs to the deterministic renderer rather than being mechanically enforced the same way — this is why ADR 0004's "stay narrow" reasoning is still sound: mechanically enforcing more fields at once, before each one has its own registry-equivalent grounding, would risk the same "field exists in an object but nothing checks it's real" gap that `runtimePrimitives` itself once had.

## 4. Why a restaurant, a bakery, a clinic, a hotel, a lawyer, and an auto shop don't converge

They don't converge because the input to the Director is not "business category," it's the specific evidence gathered for *this* business — reviews, verified facts, the trade/town signal, ownership credentials, opening hours, the actual language customers used. Two restaurants can and should diverge from each other more than a restaurant and a hotel might, if their evidence diverges more. Category is a weak prior at best; evidence is the actual signal. The distinctness gate (`lib/qa/distinctness-gate.ts`, backed by `fingerprint.ts`) is the mechanical backstop for this: it doesn't just hope evidence-driven variation is enough, it measures the fingerprint of a new candidate against prior outputs and blocks convergence directly. This is the second-line defense; evidence-driven closed-set selection is the first line.

## 5. Avoiding template repetition, mechanically

Three independent mechanisms, not one:

1. **Evidence variance** (section 4) — different inputs naturally produce different closed-set selections when the Director is doing its job.
2. **Design Battle / divergence** (`lib/design/diverge.ts`, wired into `stage.ts`'s `diverge` stage) — generates more than one candidate directive per job and lets the candidate-selection/QA-jury pipeline pick the one that best serves this business, rather than committing to the Director's first output unconditionally.
3. **Distinctness gate** (`lib/qa/distinctness-gate.ts`) — a hard, blocking, fingerprint-based check against the project's own output history, independent of how confident the Director was.

## 6. How the Capability Registry is used by Design Intelligence

The Director's own reasoning calls are capability-routed exactly like every other AI call in the system (`lib/capability/orchestrator.ts`) — the Director is not hardwired to one model. This matters for the same reason the Provider Pool document exists: a design decision made by whichever vendor is live today should not become a permanent architectural dependency on that vendor. Downstream, once the Director's closed-set choices exist, the runtime-primitive requests they produce are checked against `lib/design/experienceRegistry.ts`, which is also where Forge's own registry gate (`lib/forge/registryGate.ts`) reads from — one registry, shared, so a primitive doesn't need two separate integrations depending on whether the classic pipeline or Forge is the one requesting it.

## 7. Bakery V2's role, precisely

Bakery V2 (`lib/experience/`) is a specimen: a hand-built, deliberately quarantined proof that a full bespoke experience (raw WebGL2, not the vendored Three.js path) is achievable end-to-end. It is not, and must not become, a template. Concretely this means: no code path may read Bakery V2's markup, copy, or bread-specific vocabulary as a fallback or a seed for a new business's directive. Its only legitimate uses are (a) a regression fixture proving the deterministic renderer can host a genuinely bespoke build without breaking, and (b) a qualitative reference for what "distinct" can look like at the extreme end — never a source of generalizable structure. This boundary is already correctly enforced in code (one build script, one test import, zero edges into the general pipeline) — this document's job is to make sure that boundary is never "helpfully" relaxed later by someone looking for a shortcut.

## 8. What Experience Intelligence still cannot do (honest gap, not fixed here)

The Director's closed sets today are the ones ADR 0004 narrowed to deliberately — this is correct caution, not a missing feature to rush. The real gap, tracked in `docs/IMPLEMENTATION_GAP.md`, is that only `runtimePrimitives` has a registry-grade mechanical grounding; extending that same grounding to layout archetype and motion intensity (so an advisory field can't silently be ignored by the renderer the way an unenforced field always risks) is P1 work, not done yet, and should be done one field at a time, each with its own registry-equivalent proof, exactly the way `runtimePrimitives` was done — not all at once.
