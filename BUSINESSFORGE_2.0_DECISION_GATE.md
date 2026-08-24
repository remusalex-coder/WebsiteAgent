# BusinessForge 2.0 — Architecture Decision Gate

> **⚠ HISTORICAL PLANNING DOCUMENT (2026-08-24 note).** Part of the pre-implementation
> `BUSINESSFORGE_2.0_*.md` design corpus. Design-input history, not current status.
> Current status: `docs/MASTER_INVENTORY.json` (machine-readable) and
> `docs/BUSINESSFORGE_FINAL_ARCHITECTURE.md` (canonical).

_Read-only decision pass. Produced 2026-08-19, same session as
[BUSINESSFORGE_2.0_RESEARCH_INTEGRATION.md](BUSINESSFORGE_2.0_RESEARCH_INTEGRATION.md), against
branch `design-director-smoke`. **No source file, test, snapshot, `.env`, or dependency was
modified, installed, or deleted producing this document.** This is the gate before an
implementation session, not the implementation._

Seventh in the `BUSINESSFORGE_2.0_*` series. Where the sixth document (`RESEARCH_INTEGRATION.md`)
audited what exists and named the contradictions, this one **decides between them** — the thing
that document explicitly declined to do. Every claim below either cites a file:line verified this
pass or a prior pass's finding, marked per the legend; nothing is asserted from memory of the
series alone.

**Status vocabulary used throughout, per the brief:** **IMPLEMENTED** (in production, wired,
reachable from a command a user runs) · **PARTIAL** (implemented but with a named gap) ·
**PROPOSED** (this document's recommendation; does not exist) · **EXTERNAL** (available outside
the repo, not integrated). A module is never called "wired" on the strength of existing — every
such claim below was checked for an actual import from a production entry point
(`main.ts`, `lib/workflow/runJob.ts`, `scripts/n8n/stage.ts`, `scripts/forge/run.ts`,
`lib/forge/orchestrator.ts`) this pass or the pass fourteen turns ago in this same session.

---

## 0. What was (re)read this pass

`BUSINESSFORGE_2.0_RESEARCH_INTEGRATION.md` (own output, in context) ·
`docs/experience-architecture-v2.md` (in context, full) ·
`docs/EXPERIENCE_SIGNATURE_PIPELINE.md` (in context, full) ·
`ARCHITECTURE_FREEZE.md` (in context, full) ·
`lib/capability/registry.ts` (in context, full, 508 lines) ·
`docs/capability-orchestration.md`, `docs/architecture.md`, `docs/content-system.md`,
`docs/experience-system.md`, `docs/experience-capability-audit.md` (in context, full) ·
`docs/mcp.md`, `docs/skills.md` (in context, full) ·
`research/asset-stack/*` (18 files, indexed in context) ·
`research/auxiliary-arsenal/*` (15 files, indexed in context) ·
`docs/knowledge/*` (13 files, indexed in context) ·
`docs/antigravity/*` (7 files, indexed in context) ·
plus, **new this pass**, four targeted verification greps against the live tree (below), because
the brief specifically requires call-site proof, not file-existence proof:

```
grep -rl "docs/knowledge" lib/ agents/ scripts/ main.ts        → 3 hits, all doc-comment citations
grep -rn "platform\.mcp\.|platform\.skills\." agents/ lib/forge/ lib/capability/ main.ts
                                                                → 0 hits
grep -n "publish-run" main.ts lib/workflow/runJob.ts scripts/n8n/stage.ts
                                                                → 0 hits (only in package.json's own script + its own file)
grep -n "deploy" main.ts                                       → only lovableAgent, no gate before it
```

These four confirm, precisely, three of the ten wiring gaps in §8.

---

## 1. Contradiction register

### A — Classic pipeline vs. `lib/forge/`

| Field | Value |
|---|---|
| **Systems** | `main.ts`/`lib/design`+`content`+`render` vs. `lib/forge/orchestrator.ts` |
| **Conflict** | Two complete, independent generation pipelines with zero shared design/render code [V: grep, no import edges `lib/forge/*` → `lib/design/`, `lib/render/`, or `lib/content/`]. Neither is aware of the other in its own documentation. |
| **Why it matters** | Every future engineering decision ("add a capability", "fix a rendering bug", "extend the experience vocabulary") must currently be made twice, or made once and silently not apply to the other surface. |
| **What already works** | Both. Classic: 1160+ tests, six-business benchmark, ADR-governed. Forge: benchmarked 85–100/100 on a real vision critic, one real end-to-end proof at €0. |
| **What is lost removing Forge** | The Factual Firewall's tri-state epistemic model (§5C below), the Creative Territories/Signature divergence mechanism, the asset-intelligence layer, and the demonstrated visual ambition (scroll-driven mechanisms, genuine signature moments) that the classic renderer's Tier-2 vocabulary cannot yet deliver. |
| **What is lost removing the classic pipeline** | The entire structural safety property the series is built around, the capability router's primary consumer, the content system's evidence-grounding discipline (ADR 0007), and five days less of test coverage. |
| **Recommended resolution** | **Neither removed.** Forge's *reasoning* stages (research, grounding, signature/territories, asset strategy) become the canonical creative-direction layer feeding the classic pipeline's deterministic execution. Forge's *writing* stage (`builder.ts`) is retired in its current form. Full argument: §4. |
| **Migration risk** | Medium. Nothing forces an immediate cutover — both surfaces keep working during the transition, because the recommendation is additive to the classic pipeline, not a rewrite of Forge. Risk is schedule risk (§4/§10), not correctness risk. |
| **Priority** | **1 — blocks everything else in this register.** |

### B — Closed-vocabulary experience architecture vs. model-authored HTML/CSS/JS

| Field | Value |
|---|---|
| **Systems** | `agents/designDirectorAgent.ts` + `lib/design/directive.ts` (`additionalProperties:false`, ADR 0004) vs. `lib/forge/builder.ts` |
| **Conflict** | The architecture's own stated invariant — a model may name intent from a closed set; it may never emit CSS, JS, or markup — is violated as the *default and only* path through Forge, not an edge case [V, `RESEARCH_INTEGRATION.md` §3.1, re-confirmed]. |
| **Why it matters** | This is not a style preference. It is the single structural mechanism that makes every other safety claim in the repository true: reproducibility, no-invented-facts, security review scope, licence compliance. A generation path outside it inherits none of those for free. |
| **What already works** | Forge's two-pass split (HTML then CSS/JS) is a **real, sound fix to a real problem** — a documented `MAX_TOKENS` failure on a monolithic single-pass attempt [A: `docs/antigravity/EXPERIMENTS.md`]. The engineering judgement here is sound; only its premise (a model should be writing bytes at all) is the issue. |
| **What is lost removing model-authored generation entirely, with nothing built to replace its reach** | Every effect Forge's builder currently free-hands and the classic renderer has no capability for: bespoke scroll-driven mechanisms, per-business signature interactions, arbitrary CSS choreography. This is real lost capability, not a strawman — it is exactly the Tier-2/3 gap `experience-architecture-v2.md` already names (G2/G8). |
| **Recommended resolution** | Model output becomes exclusively the validated `ExperienceStrategy`/`ExperienceSignature` object (§6). Bytes are produced only by the renderer executing *registered* capabilities. Where a desired effect has no registered capability, that is a backlog item (build the capability, §8/§10), never a reason to let the model write it directly. |
| **Migration risk** | High if rushed (removing `builder.ts` before the runtime capabilities it currently free-hands exist would be a real regression in output quality); low if sequenced as §10 specifies. |
| **Priority** | **2 — the mechanism by which A actually gets resolved.** |

### C — `docs/experience-architecture-v2.md` vs. Forge's independently-built experience schema

| Field | Value |
|---|---|
| **Systems** | `experience-architecture-v2.md` §3 (Tier-1/Tier-2 vocabulary, ADR-linked) vs. `lib/forge/experienceStrategy.ts` (17-field independent schema) + `lib/forge/motion.ts` (4-preset motion contract) |
| **Conflict** | Two closed, validated vocabularies for the same conceptual layer, structurally similar (both follow the "model proposes, code disposes" ADR 0004 pattern) but field-incompatible, built four days apart with no cross-reference [V: `RESEARCH_INTEGRATION.md` §5.3, re-confirmed against `experienceStrategy.ts`'s field list]. |
| **Why it matters** | Whichever pipeline survives §A/§B's resolution, its experience vocabulary needs to be *the* vocabulary — not a third one invented for the merge. |
| **What already works** | Both, independently. `experience-architecture-v2.md`'s Tier-1 fields are proven to produce measurable divergence (six-business benchmark, ADR 0006). Forge's `motion.ts` contract is proven to produce a working, library-loaded runtime (the GSAP/Lenis plumbing fix, this session's own audit). |
| **What is lost by picking one wholesale** | Forge's vocabulary names fields the classic Tier-1/2 schema never needed because the classic renderer has no client runtime to configure (`cursor`, `navigationMode` beyond the classic's simpler `showNavigation`, per-scene library selection). The classic schema names fields Forge never needed because it derives *structure* deterministically (`arc`, `worldJourney`, `density` narrowed by `pacing`) rather than asking a model to propose them each time. |
| **Recommended resolution** | `experience-architecture-v2.md` §3 is canonical (per the user's explicit instruction: do not invent a competing schema). Forge's fields are mapped onto it field-by-field; fields with no counterpart become genuine Tier-2 additions to the canonical schema, not a parallel one. Full mapping: §6. |
| **Migration risk** | Low — this is a documentation/type-definition exercise (additive, per freeze precedent M-09), not a behavioural change, until the runtime host (§B) is built to consume it. |
| **Priority** | **3 — depends on A/B's direction but is cheap to do regardless.** |

### D — `ARCHITECTURE_FREEZE.md` components that exist but are not wired

| Field | Value |
|---|---|
| **Systems** | `lib/workflow/{state,ledger,resume,runner}.ts`; `lib/qa/{verdict,visual-regression}.ts`; `lib/qa/gates/{accessibility,performance,technical}.ts`; `lib/memory/designMemory.ts` |
| **Conflict** | Each is a careful, spec-matching, unit-tested implementation of a named freeze task (N-01, N-02, N-06, N-05, N-15, N-14, N-11/12/13, N-18) [A, verified per-file this session: import search shows each reachable only from its own test file]. None is imported by `main.ts`, `runJob.ts`, or `stage.ts`. |
| **Why it matters** | This is the single largest source of "the architecture already exists" claims that are false in the sense the user is explicitly guarding against in this task's constraints. Eight modules, several thousand lines, zero production effect. |
| **What already works** | The code itself — every one of these passes its own test suite in isolation. |
| **What is lost by deleting them instead of wiring them** | Real engineering time (they are correct), and — for `designMemory.ts` specifically — the only implementation in the repo of the scoped/decaying/exhaustion-rule memory the freeze's own red-team review (H1) proved is *necessary*, not optional, once a global repulsor would saturate. |
| **Recommended resolution** | Wire, not rebuild. §8 gives the exact call sites; §10 sequences the first of these. Two exceptions: `lib/workflow/ledger.ts` (weakest of the batch — no persistence, no tests at all) should be rebuilt rather than wired, since wiring it as-is would add a component that does less than the `Ledger` class it would replace inside `hermes.ts`. |
| **Migration risk** | Low, one module at a time, each independently testable before and after wiring. |
| **Priority** | **4 — high value, fully decoupled from A/B/C, can start immediately.** |

### E — Asset strategy vs. actual asset generation

| Field | Value |
|---|---|
| **Systems** | `lib/forge/assetStrategy.ts` (decision layer) vs. `lib/capability/registry.ts`'s `image_editing`/`motion_media`/`three_d_generation` rows (execution) |
| **Conflict** | `assetStrategy.ts` correctly *decides* real/vector/non-depictive/edited/animated per asset slot [A, prior session's audit] — but every path that would require an actual paid generation call resolves to `gate:'human'` (`image_editing`, `motion_media`) or `gate:'never'` (`three_d_generation`, `audio_speech`) [V: `registry.ts:220-301`, read in full]. **No autonomous run has ever generated, edited, or animated an asset.** The one real end-to-end Forge proof confirms this: it correctly fell back to non-depictive treatment for all seven referenced asset slots rather than fabricate imagery [D: `RESEARCH_INTEGRATION.md` §4.4]. |
| **Why it matters** | This is not a bug — it is the €0-by-default policy and the O-6 photo-rights freeze working exactly as designed. It is listed here because "asset strategy exists" and "asset generation exists" are different claims and the repository's own documentation sometimes reads as the latter. |
| **What already works** | The decision layer, the gate discipline, and — critically — the research (§2.1 of `RESEARCH_INTEGRATION.md`) pricing and licensing every candidate provider that would fill the gap the moment N-6 (photo rights) is settled. |
| **What is lost by "fixing" this now** | Nothing is broken to fix. The only real action available is settling N-6, which is a legal question, not an engineering one. |
| **Recommended resolution** | No architecture change. Record explicitly (done, here) that this is a policy gate holding as designed, not a missing wire. |
| **Migration risk** | None — no change proposed. |
| **Priority** | **9 — correctly gated, not urgent.** |

### F — Capability registry vs. actual provider execution

| Field | Value |
|---|---|
| **Systems** | `lib/capability/registry.ts`/`bindings.ts` (declared) vs. `lib/capability/execute.ts` + live credentials (actual) |
| **Conflict** | All 37 capabilities are declared and bound to a real, ranked provider chain [V: `registry.ts`, `bindings.ts`, read/audited this session]. All 7 AI vendor adapters are code-complete. **Only Gemini has ever been credentialed and called live in this deployment** [A, prior session's audit, `.env.example` confirms all key vars are empty placeholders]. |
| **Why it matters** | The router's cross-provider failover, cross-vendor independence rules (creative_direction ≠ adversarial_critique vendor, etc.), and the entire economic argument for a multi-vendor system are **untested against reality** — every chain has been walked exactly once, to its first (free, Gemini) member. |
| **What already works** | The chain-walking mechanism itself, the quota ledger, the cost accounting, the deterministic terminal on every chain — all exercised, all correct, all just never forced past their first candidate. |
| **What is lost by not fixing this** | Confidence that failover actually works is unearned until a credentialed second vendor is exercised — which is exactly the freeze's own P0-5 recommendation ("live-probe the fallback providers"), never executed. |
| **Recommended resolution** | Not an architecture change — an operational one: add one second credential (DeepSeek is the cheapest, per §2.1's pricing) and run the existing `capability-proof` script (`npm run capability-proof`) with Gemini's free tier deliberately exhausted or excluded, to force a real failover. |
| **Migration risk** | Very low — one env var, no code change, uses an already-built verification harness. |
| **Priority** | **7 — cheap, de-risks a real unknown, not urgent.** |

### G — Visual critic vs. generation architecture

| Field | Value |
|---|---|
| **Systems** | Classic: `lib/qa/visual-critic.ts` (judge-only, feeds `distinctness-gate.ts`) + the gated `scripts/visual-qa.ts --autofix` escape hatch. Forge: `lib/forge/critic.ts` (10-axis judge) + `lib/forge/repair.ts` (judge-driven **model rewrite** of the code) |
| **Conflict** | The classic pipeline's critic is judge-only by design, with editing walled off behind an explicit human-only flag [D, `RESEARCH_INTEGRATION.md` §3.1, re-confirming the redteam's C1 finding]. Forge's critic-then-repair loop is judge-*and-edit*, and the edit is a second model call rewriting HTML/CSS/JS from the critic's notes [A: `repair.ts`, routes through `structured_generation`]. This is internally consistent with Forge's own premise (§B) — it is not a new violation — but it means Forge has **two** model-authored-bytes mechanisms (initial generation and repair), not one. |
| **Why it matters** | If §B's resolution retires `builder.ts`'s free generation but leaves `repair.ts` untouched, the repair loop becomes the *only* remaining model-writes-bytes path — a smaller surface, but the same category of risk, and one that is easy to miss because it reads as "just QA." |
| **What already works** | Both critics score real, useful axes (13 for classic, 10 for Forge, overlapping substantially — both derive from the same Awwwards-teardown research). The 10-axis Forge critic's rubric is the more complete of the two and should be the one that survives consolidation. |
| **What is lost by removing model-driven repair** | The fast, cheap fix-forward loop that produced Forge's measured score improvements. Its deterministic replacement (adjusting a token/capability selection and re-rendering, matching the classic pipeline's `reconcept` mechanism) is slower per iteration but bounded and auditable. |
| **Recommended resolution** | Consolidate on one critic definition (Forge's 10 axes, adopted into `craft_judging`'s capability contract). Retire `repair.ts`'s code-rewrite mechanism in the same pass as `builder.ts` (§B) — a critic finding becomes a `reconcept`-style signal into the capability/token layer, never a second free-text rewrite. |
| **Migration risk** | Low if done together with §B; contradictory if done separately (retiring generation but not repair leaves an inconsistent half-fix). |
| **Priority** | **2 (tied with B — same change, same commit).** |

### H — Research/knowledge corpus vs. agents actually consuming it

| Field | Value |
|---|---|
| **Systems** | `docs/knowledge/` (13 files) vs. any runtime code path |
| **Conflict** | Verified this pass by direct grep: exactly **3 of 13** files are referenced by code at all, and every reference is a **doc-comment citation**, not a runtime load — `lib/forge/antiPatternSignals.ts` cites `ANTI_AI_SLOP.md`, `lib/forge/motion.ts` cites `MOTION_LIBRARY.md`, `lib/forge/types.ts` cites `EXPERIENCE_SIGNATURE_SYSTEM.md`. In each case, the *rules* were manually transcribed into TypeScript by a human/session; the markdown itself is never parsed or loaded at runtime. The other 10 files — `HUMAN_DESIGN_PRINCIPLES.md`, `SECURITY_KNOWLEDGE.md`, `PERFORMANCE_KNOWLEDGE.md`, `INTERACTION_LIBRARY.md`, `TRUTH_AND_EVIDENCE.md`, `WEBSITE_CAPABILITY_KNOWLEDGE.md`, `AWWARDS_RESEARCH.md`, `BUSINESSFORGE_KNOWLEDGE_ARCHITECTURE.md`, `KNOWLEDGE_INDEX.md`, `KNOWLEDGE_TAXONOMY.md` — have **zero code references of any kind.** |
| **Why it matters** | `SECURITY_KNOWLEDGE.md`'s 137 rules and `PERFORMANCE_KNOWLEDGE.md`'s numeric Core-Web-Vitals budgets are exactly the content the QA gates in §D need to be wired *with*, not just wired. Wiring the gates without consulting this research would rebuild what it already specifies. |
| **What already works** | The research itself is high quality, numerically specific, and — per `BUSINESSFORGE_KNOWLEDGE_ARCHITECTURE.md`'s own honest self-assessment — already knows it isn't wired: that document *is* the proposal for the retrieval layer that would fix this, and it is itself unbuilt. |
| **What is lost by not building the retrieval layer** | Nothing today (markdown research doesn't degrade). What's lost by *pretending* it's wired is worse: a future session assuming `SECURITY_KNOWLEDGE.md`'s rules are enforced because the file exists. |
| **Recommended resolution** | Do not build the full three-layer knowledge architecture `BUSINESSFORGE_KNOWLEDGE_ARCHITECTURE.md` proposes yet — that is itself a knowledge-*system* project, and the brief for this pass explicitly says "we do not need another giant research project." Instead: transcribe the specific, numeric rules each DISCONNECTED gate in §D needs (§9's #10) directly into that gate's TypeScript, the same pattern `antiPatternSignals.ts`/`motion.ts` already used successfully. Treat markdown-to-code transcription, not a query layer, as the near-term integration mechanism. |
| **Migration risk** | Low — this is how the only three successful integrations to date were done. |
| **Priority** | **6 — real value, mechanically simple, blocked only on which gates get wired first (§D).** |

### I — MCP/skills infrastructure vs. actual agent workflows

| Field | Value |
|---|---|
| **Systems** | `lib/platform/mcp/`, `lib/platform/skills/` vs. `agents/`, `lib/forge/`, `lib/capability/` |
| **Conflict** | Verified this pass by direct grep across every agent, every Forge module, and the capability layer itself: **zero call sites** of `platform.mcp.*` or `platform.skills.*` outside the platform's own internal code. The seam is real (manager, registry, HTTP transport, health checks) [D: `docs/mcp.md`, `docs/skills.md`] but nothing in this repository has ever asked it for anything. |
| **Why it matters** | The MCP-server and skill candidate research (§6.1/6.2 of `RESEARCH_INTEGRATION.md`) is complete and prioritized — but there is currently no evidence the seam it would plug into has ever been exercised end-to-end with a real server, only that it *would compile* if one were registered. |
| **What already works** | The contract itself is sound (structured `CapabilityOutcome`, honest placeholders, fail-loud on malformed config) and does not need redesigning. |
| **What is lost by not adopting an MCP server yet** | Nothing today — everything MCP would provide (Firecrawl-class research, Playwright automation) already has an in-repo equivalent doing the same job (`lib/sources/`, `lib/browser.ts`). MCP is additive breadth, not a current gap in capability. |
| **Recommended resolution** | Do not build a new integration layer. Register **one** server (Firecrawl or the Playwright reference MCP, both P0 in the research) as a proof, following the existing `MCP_SERVERS` config contract exactly as documented, and confirm one real call succeeds end to end — this is the same "first live call" discipline the freeze's P0-5 already established for AI providers, applied to MCP. |
| **Migration risk** | Very low — config-only, additive, the manager already fails safe on a bad entry. |
| **Priority** | **8 — genuinely optional; the repo functions completely without it today.** |

### J — QA/preflight vs. actual deployment path

| Field | Value |
|---|---|
| **Systems** | `scripts/publish-run.ts` (functional/security/a11y checks) vs. `main.ts`'s `deploy` stage vs. `agents/lovableAgent.ts` |
| **Conflict** | Verified this pass by direct grep: `publish-run.ts` is referenced **only** by `package.json`'s own `"publish"` script and by two files that transcribed *some* of its checks into gate modules (`lib/qa/gates/technical.ts`, itself DISCONNECTED per §D). It is never called from `main.ts`, `runJob.ts`, or `stage.ts`. `main.ts`'s `deploy` stage (line ~495) calls `lovableAgent.run()` directly, with **no QA gate of any kind between render and deploy** in the automated path — deployment is skipped outright when `LOVABLE_API_KEY` is unset [V: `main.ts:487-509`], and `lovableAgent.run()` itself throws `NotImplementedError` when a key *is* set [D, prior series]. |
| **Why it matters** | There is, today, no automated preflight at all standing between "the renderer produced a site" and "the site would be deployed" — only the fact that deployment itself doesn't work yet is what prevents an unvetted site from shipping. Fixing deployment (§4's roadmap item, already recommended by the series: static hosting, not Lovable) without first wiring a preflight gate would remove that accidental safety net. |
| **What already works** | The checks themselves — `publish-run.ts`'s functional/security assertions are real and (per the redteam's own account) already promoted in spirit into `lib/qa/gates/technical.ts`'s spec-matching, DISCONNECTED implementation. |
| **What is lost by wiring this** | Nothing — this is a pure addition, no existing behaviour changes. |
| **Recommended resolution** | Same fix as §D's technical/accessibility/performance gates: wire them into the one live gate path, and make deployment (whenever it is built — currently `MISSING`, per the series' own recommendation to replace Lovable with static hosting) depend on that gate passing, structurally, not by convention. |
| **Migration risk** | Low, but **sequence-dependent**: wire the gate *before* building real deployment, not after, or there will be a window where deployment works and preflight does not. |
| **Priority** | **5 — cheap, and specifically a prerequisite for ever safely shipping the deployment fix the series already recommends.** |

---

## 2. Top 10 architectural priorities

Ranked by improvement to the actual factory, not by ease — per the brief's explicit instruction.
Several are the same underlying change as a contradiction-register item; cross-referenced rather
than restated in full.

| # | Problem | Evidence | Proposed change | Dependencies | Impact on generated sites | Complexity | Risk | Priority |
|---|---|---|---|---|---|---|---|---|
| **1** | Two incompatible generation paradigms, undecided | §A | Adopt §4's resolution: Forge's reasoning stages feed the classic renderer; `builder.ts`'s free generation is retired once its reach is replaced | none — this is the decision itself | **Highest.** Every other item either depends on this or is orphaned by it | Low (a decision, not code) | Low to decide; medium to execute | **10** |
| **2** | Model-authored bytes on the primary path | §B, §G | Retire `builder.ts`/`repair.ts`'s free-text generation; route all creative output through the validated `ExperienceStrategy` contract (§6) into named renderer/runtime capabilities | #1 decided; the runtime capability set (#3) built out far enough to not regress visual quality | **Very high.** This is the property the entire series exists to protect | High (real engineering: extend the renderer's capability vocabulary) | Medium — sequencing risk if done before #3 | **10** |
| **3** | No generic Tier-2 runtime host exists | `experience-architecture-v2.md` §11 G2/G8, re-confirmed unfixed this pass | Build `lib/runtime/` (extract the bread-free core already identified: scroll playhead, `--p`/`--vis`, ground-band blend, veil, presence gate) per the roadmap's own Phase 3 | Tier-1 vocabulary widening (transition enum, G1) done first | **Very high.** This is what lets the deterministic renderer match Forge's visual ambition without #2's risk | High | Medium | **9** |
| **4** | Eight freeze modules built, zero wired | §D | Wire `state.ts`, `resume.ts`, `runner.ts`, `visual-regression.ts`, the three `qa/gates/*`, `designMemory.ts` into the live driver(s); rebuild `ledger.ts` rather than wire it as-is | none | High — this is real, tested QA/memory capability sitting idle | Low–Medium per module | Low, one module at a time | **8** |
| **5** | No automated preflight before deployment | §J | Wire `publish-run.ts`'s checks (already half-promoted into `qa/gates/technical.ts`) into the live gate path | #4 (shares the same wiring mechanism) | High once deployment exists; zero today only because deployment doesn't work yet | Low | Low | **7** |
| **6** | Two independently-built Design Battle mechanisms | roadmap §10 pattern-match: `lib/design/diverge.ts`+`fingerprint.ts` (classic, wired) vs. `lib/forge/battle.ts` (Forge, N=2, its own convergence check) | Consolidate on the classic path's `candidates.ts`/`diverge.ts`/`fingerprint.ts` (already wired, already tested) as the one battle mechanism; Forge's territory generator becomes its candidate-concept source | #1 | Medium–High — currently neither battle mechanism benefits from the other's engineering | Medium | Medium | **7** |
| **7** | The knowledge corpus's numeric rules aren't in any gate | §H | Transcribe `SECURITY_KNOWLEDGE.md`/`PERFORMANCE_KNOWLEDGE.md`'s specific thresholds into the gates being wired in #4, the same way `ANTI_AI_SLOP.md`/`MOTION_LIBRARY.md` already were | #4 | Medium — turns researched-but-inert rules into enforced ones | Low–Medium | Low | **6** |
| **8** | Two experience vocabularies, unreconciled | §C | Map `experienceStrategy.ts`'s fields onto `experience-architecture-v2.md` §3's Tier-1/2 schema explicitly (§6 below is the first pass) | #1's direction (which fields matter depends on which pipeline is canonical) | Medium — prevents the *next* extension from happening twice | Low (documentation/types) | Low | **5** |
| **9** | Provider failover never exercised past the first (free) vendor | §F | Add one second credential; run `npm run capability-proof` with the primary excluded | none | Low-to-medium — a confidence fix, not a capability fix | Very low | Very low | **4** |
| **10** | Asset generation fully gated (by design) | §E | No change — recorded as correctly gated, contingent only on N-6 (legal) | founder/legal decision on photo rights | Would be high (real generated/edited imagery) **if and only if** N-6 resolves favourably — architecturally this item is already done | N/A | N/A (legal, not technical) | **3** |

---

## 3. The recommendation — what BusinessForge should actually be

> **BusinessForge is a deterministic rendering platform with a two-diamond creative-direction
> front end. The model's job, at every stage, is to narrow a space of validated, named
> possibilities to one — never to author the artifact those possibilities describe.**

The fourteen-stage chain the brief names is the correct shape, and it already exists in pieces
across both pipelines. The recommendation is not a new chain; it is which existing module owns
each link, and one deliberate excision:

```
Research              → lib/forge/research.ts  (adopted: Playwright + capability-routed
                          synthesis is a genuine improvement over lib/sources/ alone)
Business Understanding → agents/normalizerAgent.ts + agents/businessAnalystAgent.ts, EXTENDED
                          with lib/forge/grounding.ts's tri-state epistemic model
                          (VERIFIED_FACT / INFERENCE / CREATIVE_INTERPRETATION — strictly more
                          rigorous than the classic pipeline's current binary fact/gap split)
Strategy               → agents/businessAnalystAgent.ts (unchanged; already capability-routed,
                          already IMPLEMENTED)
Creative Direction     → lib/forge/signature.ts's Creative Territories + falsification test,
                          ADOPTED as the canonical Creative Director, REPLACING
                          agents/designDirectorAgent.ts's free-text thesis fields — output
                          constrained to the §6 contract, never literal CSS/JS/GLSL
Experience Architecture→ lib/design/experience.ts + script.ts (the deterministic BACKBONE —
                          UNCHANGED, structurally load-bearing, stays canonical per §C)
Experience Signature   → the selected Territory's metaphor/mechanism/moment, mapped onto
                          §6's `narrativeDevice`/`heroTreatment`/`moment` fields — a validated
                          OVERRIDE on the backbone above, same relationship ADR 0004 already
                          defined for the current Design Director
Asset Strategy         → lib/forge/assetStrategy.ts, ADOPTED WHOLESALE, feeding
                          lib/design/assets.ts's AssetChoreography
Capability Router      → lib/capability/ (registry + bindings + plan + execute), UNCHANGED,
                          the one and only source of truth (§7)
Generation             → REDEFINED. No longer "a model writes HTML/CSS/JS." Becomes: the
                          validated Experience Strategy + Asset Strategy + Motion contract
                          resolve, deterministically, to a set of NAMED capabilities the
                          renderer/runtime already implement (variants, transitions, motion
                          presets, functional module specs). Where no capability exists yet
                          for a desired effect, that is a backlog item (§10), never
                          model-authored output.
Render                 → lib/render/ (Tier 1, static, UNCHANGED) + a NEW lib/runtime/
                          (Tier 2, PROPOSED, §10) executing the motion/scroll/veil vocabulary
                          Forge's builder currently free-hands
Visual Critic          → lib/forge/critic.ts's 10-axis rubric, ADOPTED into the classic
                          pipeline's craft_judging capability, judge-only — REPAIR VIA MODEL
                          REWRITE IS RETIRED (§1.G); a critic finding becomes a reconcept
                          signal into the token/capability layer, not a second free-text pass
Functional QA          → lib/qa/gates/{technical,accessibility,performance}.ts +
                          layout-audit.ts + lib/qa/visual-regression.ts, WIRED (§1.D) into one
                          gate path, extended with docs/knowledge/'s numeric rules (§1.H)
Production Preflight   → scripts/publish-run.ts's checks, WIRED (§1.J) into the same gate path,
                          made structurally load-bearing for deployment rather than a
                          standalone script
Deployment             → static hosting (Cloudflare Pages or equivalent), PROPOSED, replacing
                          the already-rejected `lovableAgent`/Lovable target — unchanged from
                          the series' existing recommendation, restated here because it is
                          the one link in the chain that is currently MISSING outright
```

**Why this, and not "pick one pipeline":** the classic pipeline's structural safety and Forge's
creative reach are not actually in tension — they were built to solve different halves of the same
problem (safety vs. ambition) by two different sessions that never talked to each other. The
fourteen-stage chain above is what happens when neither half is discarded: the reasoning that made
Forge's benchmark scores good (grounded facts, genuinely divergent territories, evidence-driven
asset choices) is exactly the reasoning the classic pipeline's Creative Director was always meant
to do and never fully did; the safety that makes the classic pipeline trustworthy is exactly what
Forge's builder never had. Merging them is not a compromise between two architectures — it is
completing one architecture that was built in two disconnected halves.

---

## 4. Resolving the Forge/classic question — architecturally

**Canonical production pipeline:** the classic pipeline (`main.ts` → `lib/design`/`content`/
`render`), extended per §3.

**Role of `lib/forge/`, going forward:** its reasoning modules (`research.ts`, `grounding.ts`,
`signature.ts`, `assetStrategy.ts`, `motion.ts`'s vocabulary, `functionalModules.ts`) are promoted
into the canonical pipeline as the Creative Direction / Experience Signature / Asset Strategy
stages. `lib/forge/` as a directory does not need to be deleted or moved in one motion — these
modules already have no import dependency on `builder.ts`, so they can be consumed by the classic
pipeline (or gradually relocated under `lib/design/` and `lib/content/`, matching those layers'
existing naming) independently of when `builder.ts` itself is retired.

**What must be constrained:** `builder.ts`'s two-pass free-text HTML/CSS/JS generation and
`repair.ts`'s model-driven rewrite loop. Both are retired **only once §3's `Generation` stage has
enough registered runtime capability to cover what they currently free-hand** — not before, and
not as a single flag-flip. Until then, Forge's current path may keep running as an explicitly
labelled experimental surface (matching the honesty discipline the platform already applies to
skill placeholders: say what it is, never hide the exception).

**How model creativity stays high without uncontrolled model-authored artifacts:** the creativity
that made Forge's output good was never in the CSS — it was in the Factual Firewall's fact/
inference separation, the three-territory divergence with a falsification test, and the
evidence-driven asset routing. None of that touches a byte a browser renders. The thing that must
change is narrower than it looks: a Creative Director that currently says *"here is the CSS"* says
instead *"here is the signature: metaphor X, central mechanism Y, motion intensity Z, moment at
section N"* — the same amount of creative judgement, expressed as a validated object instead of source
code. This is not a reduction in creative freedom; it is the same discipline `agents/
designDirectorAgent.ts` already applies to its eleven closed-set fields, extended to cover what
Forge's builder currently leaves free.

---

## 5. Canonical Experience Contract

**Starting point, unchanged:** `docs/experience-architecture-v2.md` §3's Tier-1/Tier-2 vocabulary.
Not re-derived; extended, field by field, against Forge's `experienceStrategy.ts` and `motion.ts`
so nothing that pipeline named gets lost in the merge.

| Contract area | Canonical field(s) | Status | Source |
|---|---|---|---|
| **Visual language** | `direction`, `colorStrategy`, `imageryIntent`, `heroTreatment` | IMPLEMENTED | `lib/design/directive.ts`, `types.ts` |
| **Layout** | `mode`, `sceneKind`, `density`, `pacing` | IMPLEMENTED (Tier 1) | `lib/design/experience.ts` |
| **Typography** | `typographyBehavior` (display-split / mono-log / per-scene-switch) | PARTIAL — the fields exist; per-scene switching is a Tier-2 delivery gap | `experience-architecture-v2.md` §3.1 Y1–Y3 |
| **Interaction** | `InteractionStrategy.level`/`ceiling` | PARTIAL — capped at `guided`; `immersive` intent recorded, never delivered | `lib/design/interaction.ts` |
| **Motion** | `transition` (needs G1's enum fix) + **NEW**: adopt Forge's `MotionIntensity` (none/subtle/expressive/immersive) as the Tier-2 `motionIntensity` field, with its duration-band/easing catalogue and library register (GSAP/Lenis/OGL, adopt/reject list) carried over unchanged | PROPOSED (merge) | `lib/forge/motion.ts` → mapped onto `experience-architecture-v2.md` §3.2 |
| **Navigation** | **NEW**: adopt Forge's `navigationMode` field — the classic schema currently only has a boolean `showNavigation` | PROPOSED (addition) | `experienceStrategy.ts` → new Tier-1 field |
| **Media** | `imageChoreography`, **extended** with `assetStrategy.ts`'s per-slot real/vector/non-depictive/edited decision | PARTIAL → PROPOSED (adopt wholesale) | `lib/design/assets.ts` + `lib/forge/assetStrategy.ts` |
| **3D** | `heroObjectState` (abstract, per-category shader) | MISSING for any category but the quarantined Bakery reference; `three_d_generation` capability `gate:'never'` (frozen F-18) | `experience-architecture-v2.md` §3.2, `lib/experience/` |
| **Responsive behaviour** | `ResponsiveSystem` (fluid + `mobileColumns`) | IMPLEMENTED | `lib/design/types.ts` |
| **Accessibility** | `AccessibilityPreferences` (AA/AAA, tap targets, landmarks, `respectReducedMotion:true` mandatory) | IMPLEMENTED as a contract; PARTIAL as an enforced gate (axe-core DISCONNECTED, §1.D) | `lib/design/types.ts:550-561` |
| **Performance constraints** | budget fields | MISSING as enforced budgets; EXTERNAL research complete (`PERFORMANCE_KNOWLEDGE.md`'s per-tier numeric budgets, §1.H) | — |
| **Functional modules** | **NEW**: adopt `functionalModules.ts`'s 7 module specs (enquiry-form, booking-request, etc.) as the canonical functional-module contract | PROPOSED (adopt wholesale) | `lib/forge/functionalModules.ts` |

**Rule preserved from both source schemas without modification:** free text is permitted only for
the Creative Director's concept fields (metaphor, positioning — capped, one sentence, never parsed
into a decision), exactly as ADR 0004 already established and exactly as `experienceStrategy.ts`
independently arrived at by the same reasoning. This is the one place the two schemas agreed
without coordinating, and it is the load-bearing rule of the whole contract.

---

## 6. Canonical Asset Contract

Integrating `research/asset-stack/16_IMPLEMENTATION_MAP.md`'s no-code integration spec (already
shaped to match `lib/capability/`'s own contract) with `assetStrategy.ts`'s live decision logic:

```
asset request (a scene needs a hero / signature / supporting image)
  │
  ▼ evidence check                    — does a real, usable photograph exist for this slot?
  │    yes → USE AS-IS                                                    (cost: €0, always)
  │    no  → does the scene need a mark/icon (structural, not depictive)?
  │           yes → vector_generation                                     (cost: €0, deterministic SVG)
  │           no  → image_nondepictive (texture/gradient/ground)          (cost: €0, worlds.ts)
  │
  ▼ TIER (only reached if a real photo exists AND the signature calls for altering it)
  │    image_editing        → gate:'human' — Higgsfield researched/priced, blocked on N-6 (rights)
  │    motion_media (i2v)   → gate:'human' — same block, plus requires a real source photo
  │
  ▼ PROVIDER (when a human-gated tier is actually invoked, per §2.1's fallback chain)
  │    image_editing:  Higgsfield → (Runway/fal.ai as alternates, per research)
  │    motion_media:   Higgsfield → Runway → Veo 3.1
  │
  ▼ FALLBACK (always available, never a dead end)
  │    any tier refused/unavailable → use the photograph as collected, or the non-depictive
  │    ground/texture the design system already ships
  │
  ▼ LICENCE                           — checked against research/asset-stack/13_LICENSE_MATRIX.md
  │    before any paid tier is reachable — free-tier generative output (Recraft/ElevenLabs/Suno)
  │    is NEVER treated as commercial-usable, structurally (a hard filter, not a rank penalty,
  │    matching lib/capability/plan.ts's existing licence-filter discipline)
  │
  ▼ COST                              — routed through lib/capability/models.ts's estimate,
  │    accounted through lib/capability/execute.ts's CostLine, same mechanism every other
  │    capability already uses — no separate asset-cost system
  │
  ▼ GENERATION                        — the gated provider call itself, when it happens
  ▼ VALIDATION                        — output_security + the visual critic's factual-fidelity
  │    axis (does the asset match what the signature claimed it would show)
  ▼ STORAGE                           — site/assets/, same allow-listed path lib/render/assets.ts
  │    already enforces (safeImageUrl)
  ▼ USAGE                             — placed by AssetChoreography, exactly as today
```

**What is genuinely new here versus what `lib/design/assets.ts` already does:** the TIER/PROVIDER/
FALLBACK/LICENCE steps. Everything from EVIDENCE and STORAGE/USAGE down is already implemented and
unchanged.

---

## 7. Canonical Capability Contract

**No parallel registry.** `lib/capability/registry.ts` (37 capabilities, the `tier`/`gate`/
`modelMayWriteOutput`/`terminal` fields, read in full this pass) is the sole source of truth,
exactly as the user's constraint requires. Three concrete reconciliations against this document's
recommendations, all **additive rows or field values, never a new table**:

1. **`creative_direction`'s existing row already has `modelMayWriteOutput:false` and `gate:'none'`**
   [V: `registry.ts:73-82`] — the recommendation in §3/§4 (Creative Director outputs a validated
   signature, never bytes) is **already the registry's stated contract for this capability.** The
   gap is not in the registry; it is that `lib/forge/builder.ts`'s `structured_generation` calls
   (Pass 1/Pass 2) route the *rendering* step through a capability whose `modelMayWriteOutput:true`
   is legitimately true for other uses (schema-shaped data) but is being used here to authorize
   literal source code. **The fix is not a new registry row — it is that Generation (§3) stops
   asking `structured_generation` to return HTML/CSS/JS at all**, and asks it only for the
   `ExperienceStrategy` object §5/§6 define, which is exactly what that capability is for.
2. **`vector_generation`, `image_nondepictive`, `image_editing`, `motion_media`** rows already
   exist with the correct gates for §6's asset contract — no change needed, only consumption by the
   canonical pipeline instead of only by Forge.
3. **No capability id needs to be added** for anything in §3's fourteen-stage chain. `reasoning`,
   `structured_generation`, `prose_writing`, `creative_direction`, `craft_judging`,
   `distinctness_judging`, `runtime_tier`, `accessibility`, `performance`, `output_security`,
   `build_artifact`, `hosting` between them already name every stage. **This confirms the registry
   was correctly scoped when it was built** — the wiring problem (§8) is a consumption gap, not a
   vocabulary gap.

---

## 8. The wiring problem — the ten places architecture exists but isn't consumed

Restated compactly from §1's register, in one place, because the brief asks for it explicitly and
because this — not new design — is the actual next engineering work:

| # | What exists | Where it should be called from | Currently called from |
|---|---|---|---|
| 1 | `lib/workflow/state.ts` (12-state machine) | `runJob.ts`, `stage.ts` | only its own test |
| 2 | `lib/workflow/resume.ts` | both drivers' resume logic | only its own test |
| 3 | `lib/workflow/runner.ts` | wherever K candidates build in parallel | only its own test |
| 4 | `lib/qa/verdict.ts`'s lexicographic combiner | `distinctness-gate.ts`'s `gateJob` | only `lib/forge/verdict.ts`/`battle.ts`, themselves disconnected |
| 5 | `lib/qa/visual-regression.ts` | the reconcept loop, to prove a rebuild differs | only its own test |
| 6 | `lib/qa/gates/{accessibility,performance,technical}.ts` | the same gate path `layout-audit.ts` already feeds | only their own tests |
| 7 | `lib/memory/designMemory.ts` | the distinctness gate, in place of/alongside the in-run-only `peers.json` | only its own test |
| 8 | `scripts/publish-run.ts`'s checks | before `main.ts`'s `deploy` stage | `npm run publish`, standalone, manual |
| 9 | `docs/knowledge/SECURITY_KNOWLEDGE.md` + `PERFORMANCE_KNOWLEDGE.md`'s numeric rules | items 6/8 above, as the actual threshold values | nowhere — zero code references |
| 10 | `lib/forge/{grounding,signature,assetStrategy}.ts` | the classic pipeline's analyst/director/asset stages | only Forge's own orchestrator |

---

## 9. Canonical BusinessForge V2 pipeline

```
Maps/Instagram/website URL
  │
  ▼ RESEARCH               lib/forge/research.ts  [ADOPT into classic]
  ▼ BUSINESS UNDERSTANDING  normalizerAgent + businessAnalystAgent, +grounding.ts's fact/
  │                         inference/interpretation split                       [EXTEND]
  ▼ STRATEGY                businessAnalystAgent (unchanged)                     [IMPLEMENTED]
  ▼ CREATIVE DIRECTION      signature.ts's territories + falsification, output constrained
  │                         to the §5 contract                                   [ADOPT, CONSTRAIN]
  ▼ EXPERIENCE ARCHITECTURE lib/design/experience.ts + script.ts (deterministic backbone)
  │                                                                               [UNCHANGED]
  ▼ EXPERIENCE SIGNATURE    the selected territory, mapped onto heroTreatment/moment/
  │                         narrativeDevice — a validated override                [ADOPT, CONSTRAIN]
  ▼ ASSET STRATEGY          assetStrategy.ts                                     [ADOPT]
  ▼ CAPABILITY ROUTER       lib/capability/ (unchanged, sole source of truth)     [UNCHANGED]
  ▼ GENERATION              resolves the signature+assets+motion contract to NAMED
  │                         renderer/runtime capabilities — NO free-text code     [REDEFINED]
  ▼ RENDER                  lib/render/ (Tier 1) + lib/runtime/ (Tier 2, NEW)     [EXTEND]
  ▼ VISUAL CRITIC           critic.ts's 10 axes, judge-only, feeds reconcept — NO
  │                         model-driven rewrite                                 [ADOPT, CONSTRAIN]
  ▼ FUNCTIONAL QA           layout-audit + the three qa/gates/* + visual-regression,
  │                         one gate surface, extended with docs/knowledge's numeric rules
  │                                                                               [WIRE]
  ▼ PRODUCTION PREFLIGHT    publish-run.ts's checks, in the same gate surface,
  │                         structurally required before deploy                  [WIRE]
  ▼ DEPLOYMENT              static hosting (Cloudflare Pages), replacing Lovable  [BUILD, MISSING]
  │
  ▼ delivered site
```

---

## 10. What we implement first

In exact order. Each is chosen to be independently valuable even if the next one is delayed, and
none requires §4's full retirement of `builder.ts` to be useful.

1. **Record this decision.** Add a one-page ADR (`docs/decisions/0008-...`) stating §3/§4's
   resolution in the repository's existing ADR format, so the next session — human or agent — does
   not re-discover the fork from scratch. Zero code risk; the highest-leverage single hour available.
2. **Wire the DISCONNECTED QA gates** (§8, items 4–7) into the one live gate path
   (`distinctness-gate.ts`/`layout-audit.ts`). No design decision required — the modules already
   match their spec; this is import-and-call work, one module at a time, each independently
   testable.
3. **Adopt `grounding.ts`'s tri-state epistemic model into the classic pipeline's normalizer/
   analyst stage.** Improves evidence quality for the canonical pipeline immediately, touches
   nothing downstream of it, and is the first concrete instance of "Forge's reasoning stages feed
   the classic pipeline" — proving the merge direction on the cheapest possible slice before
   committing to the rest.
4. **Encode §5's reconciled Experience Contract as additive fields on `lib/design/types.ts`**
   (per the freeze's own M-09 precedent: additive only, no behaviour change) — `motionIntensity`,
   `navigationMode`, the `transition` enum fix (G1). This makes the canonical vocabulary real as a
   type before anything is asked to produce or consume the new fields.
5. **Build the first slice of `lib/runtime/`**, scoped to exactly one Tier-2 capability —
   recommend the scroll-progress-driven reveal, because `lib/runtime/scroll-progress.ts` already
   exists as a narrow correct precedent to extend rather than a green field. This is the first real
   evidence that the deterministic renderer can match Forge's visual ambition without §2's model-
   authored-bytes risk, and it is the long pole in §4's timeline — starting it now, on the smallest
   possible scope, is what keeps the rest of the roadmap honest.

---

## 11. Verification

- **Files read this pass** (new, beyond what was already in this session's context): four targeted
  greps (§0), no new file reads beyond what §0 lists — this document is a synthesis pass over
  material already gathered and verified in this session, plus the four confirmatory greps the
  brief's precision requirement specifically warranted.
- **Files created:** `BUSINESSFORGE_2.0_DECISION_GATE.md` only.
- **Files modified:** none.
- **Application code touched:** none.
- **`.env` touched:** no.
- **Dependencies installed:** none.
- **Research deleted:** none.
- **git diff:** identical to the state at the end of the prior pass — one new untracked file, no
  changes to any tracked or previously-untracked path. (`git status --porcelain` count unchanged
  at 126 entries plus this new file, all pre-existing per the session's opening snapshot.)
- **Unresolved decisions, carried forward for the founder/user, not this document to settle:**
  - **N-6** — photo/social-media redistribution rights (blocks `image_editing`/`motion_media`
    regardless of anything else in this document).
  - **Whether `lib/forge/` as a directory gets physically reorganized** (its reasoning modules
    relocated under `lib/design/`/`lib/content/`) or stays in place and is simply consumed
    cross-directory — a naming/hygiene question, not an architectural one, deliberately left open
    here.
  - **The exact commit boundary for retiring `builder.ts`/`repair.ts`** — this document specifies
    the *condition* (enough Tier-2 capability built to cover their current reach) but not a
    calendar date, because that depends on how §10 item 5 and its successors actually go.
- **Exact first implementation task:** §10, item 1 — write `docs/decisions/0008-forge-reasoning-
  feeds-the-classic-renderer.md`, recording this document's §3/§4 resolution in the repository's
  own ADR format, before any other change in this list is started.

---

_End. Nothing implemented. The repository, its research corpora, and its dependency tree are
exactly as they were found._
