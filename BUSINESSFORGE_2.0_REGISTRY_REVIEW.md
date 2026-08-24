# BusinessForge 2.0 — Registry Architecture: Independent Adversarial Review

> **⚠ HISTORICAL PLANNING DOCUMENT (2026-08-24 note).** Part of the pre-implementation
> `BUSINESSFORGE_2.0_*.md` design corpus. Design-input history, not current status.
> Current status: `docs/MASTER_INVENTORY.json` (machine-readable) and
> `docs/BUSINESSFORGE_FINAL_ARCHITECTURE.md` (canonical). The registry it reviews is
> now real and tested — see `lib/design/experienceRegistry.ts` and
> `test/design/experienceRegistry.test.ts`.

_Read-only. Produced 2026-08-14. **Nothing implemented. No source file, configuration, n8n
workflow, test, or dependency modified, installed, or removed.** The only thing written is this
document._

Third in the series, and the first written **against** the proposal rather than for it:
[MASTER_ARCHITECTURE](BUSINESSFORGE_2.0_MASTER_ARCHITECTURE.md) audits what the repository is ·
[CAPABILITY_ARSENAL](BUSINESSFORGE_2.0_CAPABILITY_ARSENAL.md) catalogues what it could call ·
this document attacks the registry design before it is built.

**Reliability marks:** `[V]` verified in the repository this pass · `[W]` web-searched
2026-08-14, approximate, re-verify at the vendor · `[K]` model knowledge, unverified · `[?]`
unknown.

---

## 0. Verdict, stated first

**The direction is right. The diagram is wrong, and one of the three registries should not
exist.**

`Capability → Provider Pool → Agent Pool → Hermes → n8n` is a correct *inventory* of the pieces
and an incorrect *topology*. Built as drawn, it produces a system where agents report upward to
Hermes and Hermes hands off to n8n — which inverts the two control relationships that already
work in the repository today. Seven structural objections follow in §1; five of them change what
the JSON files must contain.

The single most valuable correction: **`agent-registry.json` should not be a JSON file.** §3.

The question you actually asked — *how does Hermes convene a cabinet without exploding costs* —
has a concrete answer with numbers: **~€0.02–0.06 per cabinet instead of ~€0.58**, a 10–25×
reduction, from seven compounding mechanisms, none of which is "use a cheaper model". §4.

---

## 1. Seven structural objections to the proposed chain

### Objection 1 — The arrow points the wrong way at both ends

As drawn, this is a **data pipeline**: something flows from Capability through pools into Hermes
and out to n8n. The repository's actual control flow is the opposite at both ends [V]:

- **n8n is the caller, not the sink.** The workflow's HTTP Request nodes call the host stage
  server, which calls `runStage` [V: `n8n/businessforge-workflow.json`, `scripts/n8n/stage.ts`].
  n8n sits *outside* and *above*. Drawing it terminal invites someone to make an agent "return to
  n8n", which would put behaviour in a workflow node — a regression the repo already names.
- **Hermes is a supervisor, not a stage.** It reads the gate verdict and job iteration and decides
  deliver / continue / escalate [V: `lib/workflow/hermes.ts:37-73`]. Agents never report to it;
  it reads state they left behind. Drawing it downstream of the agent pool invites an agent→Hermes
  return channel that does not and should not exist.

**Corrected topology — a call hierarchy, not a pipeline:**

```
  n8n  /  scripts/run-job.ts                    ← driver (outermost loop, interchangeable) [V]
   └── Orchestrator (stage order, artifacts, resume)                                       [V]
        ├── Hermes ......................... supervisor: deliver / continue / escalate     [V]
        │     reads: gate verdict, iteration, BUDGET (new)
        │     writes: job.json                                                             [V]
        │
        └── Agent Pools .................... concurrency: N workers of one role
             └── Capability Router ......... selection: which implementation, right now
                  └── Provider Pool ........ substitution: ranked, filtered, failing over
                       └── Terminal deterministic fallback ....... always in-repo, always €0
```

Read top-down it is "who commands whom". Read bottom-up it is "what can never fail". Both
readings matter and neither is expressible in a single left-to-right arrow.

### Objection 2 — Provider Pool and Agent Pool are not siblings

They are placed side by side in the chain as if they were the same kind of container. They are
not, and giving them one config shape will produce a schema that fits neither:

| | Provider Pool | Agent Pool |
|---|---|---|
| Solves | **substitution** — this vendor is down/expensive/unlicensed | **concurrency** — one role, many jobs at once |
| Members are | interchangeable implementations of one capability | identical workers of one role |
| Scaling knob | ranking weights, licence filters | worker count, rate governor |
| Failure means | try the next candidate | the pool is slower, not wrong |
| Sizing driver | quality × cost × licence | provider RPM, CPU cores |
| Lives in | the router (§7 of the arsenal doc) | the orchestrator |

A provider pool with two members is *resilient*. An agent pool with two members is *faster*. Any
design that configures them identically will end up either failing over for throughput or
parallelising for redundancy, and both are bugs.

### Objection 3 — `agent-registry.json` is the wrong artifact (the biggest single objection)

An agent is **behaviour**: a system prompt, an output schema, a semantic validator, a consumer,
and a failure policy. Putting that in JSON gives you one of two bad outcomes:

- **The JSON contains the prompts** → they become untyped, untested, invisible to `npm test`, and
  unreviewable in a diff that means anything. The repo already rejects this reasoning for n8n:
  *"Any behaviour that lands in an n8n node instead of TypeScript is a regression — untestable,
  unversioned, invisible to `npm test`"* [V: arsenal §2.10 / `n8n/README.md` doctrine]. A JSON
  agent registry is the same mistake with a different file extension.
- **The JSON is a thin pointer to code** → it is redundant with the code, and now two files can
  disagree about what `creative-director` means.

Today's agents are TypeScript modules with a `name`, a `description`, and a typed `run`
[V: `agents/*.ts`, `Agent<I,O>` in `lib/types.ts`]. That is already a registry — a typed one that
the compiler checks.

**Recommendation:** keep agents in TypeScript. If a manifest is needed for a dashboard or for
n8n, **generate** it from the modules at build time (`agents.generated.json`), never author it.
The generated file is a view, not a source. Two of the three registries stay hand-authored;
the third becomes a build artifact.

### Objection 4 — Static cost/quality/latency in JSON is stale the day it is written

The arsenal research makes this concrete: within the last five months DeepSeek ended its off-peak
discount, Alibaba closed its free developer tier, Google stopped serving free Gemini CLI
requests, OpenAI cut Luna 80% in a single day, and Sora's API acquired a scheduled shutdown date
[all W]. A `provider-registry.json` containing `"cost": 0.15` and `"quality": 8.5` is wrong
within weeks, and worse, it is *confidently* wrong — the router will rank on it.

**Split the registry along the stable/volatile seam:**

| Static — belongs in JSON | Volatile — belongs in telemetry |
|---|---|
| capability bindings | observed p50/p95 latency |
| credential variable name | success rate over the last N calls |
| endpoint shape / adapter id | actual cost from provenance (tokens × rate) |
| **licence class** | current health probe result |
| **jurisdiction** | rate-limit headroom |
| list price *as a hint, dated, and marked unverified* | — |

The repository already collects every column on the right [V: `lib/platform/telemetry.ts`,
`DirectorProvenance` in `agents/designDirectorAgent.ts:560-574`]. **The router must rank on the
observed side and filter on the declared side.** A provider that started failing an hour ago then
sinks by itself, with no human editing a JSON file.

### Objection 5 — Nothing in the chain owns the budget

Hermes convenes a cabinet. Who says no? In the proposed chain, nobody: Hermes decides, agents run,
providers bill. The repository has no ledger at all today [V: searched; absent], so "the cabinet
explodes costs" is not a hypothetical — it is the default outcome of adding seats to a system
with no accounting.

**Missing layer:** a **Budget/Lease authority** between Hermes and the agent pools. A worker
cannot issue a capability request without a lease; Hermes issues leases from the job's budget;
an exhausted budget escalates exactly as an exhausted iteration count already does
[V: `hermes.ts:49-56`]. This is the smallest possible change that makes cost a first-class
failure mode rather than an invoice.

### Objection 6 — No content-addressed result cache, which is the largest avoidable cost

The reconcept loop re-runs the cabinet with **one field changed** — the feedback string
[V: `runJob.ts:434-445`, `buildDesignBrief(..., feedback)`]. Everything else in the brief is
byte-identical: business, category, audience, voice, image signals, sections, services. Without a
cache, iteration 2 pays full price for a question it already asked.

**Missing layer:** a cache keyed on `hash(capability, normalised-inputs, model-class,
prompt-version)`. The repo already does exactly this for the one deterministic thing that was
expensive — `brandSeedFor` is computed once and cached beside the artifacts [V: `main.ts:806-812`].
The same discipline applied to capability results turns a 3-iteration loop from 3× cabinet cost
into roughly 1.3×.

### Objection 7 — Three registries form a consistency triangle with no referee

`capability-registry` names providers · `provider-registry` names capabilities · `agent-registry`
names both. Three edges, each independently editable, each able to drift. The classic failure is
silent: an agent requests `video_generation`, no provider binds it, the router returns
"unavailable", and the job quietly ships without the thing someone thought they had configured.

The repo already knows the right answer to this shape of problem: *a malformed `MCP_SERVERS`
declaration **fails the whole load** rather than being skipped, because a typo would otherwise
show up much later as "no MCP server is registered as …", which is a far worse error to debug*
[V: `lib/config.ts:449-455`].

**Apply the same rule:** one authority per fact, plus a startup validator that fails loudly on
any dangling reference.

| Fact | Sole authority |
|---|---|
| what a capability *is* (schema, closed sets, terminal fallback, policy gates) | `capability-registry.json` |
| which providers *implement* it, and their static attributes | `provider-registry.json` |
| which capabilities an agent *may request* | the agent's TypeScript module (§3) |
| how good/fast/available a provider *is* | telemetry, at runtime |
| what a call *cost* | the ledger, from provenance |

---

## 2. What the corrected architecture looks like

```
                          ┌──────────────────────────────────────────┐
   n8n  ──or──  run-job   │  DRIVER — outermost loop, interchangeable │  [V both exist]
                          └───────────────────┬──────────────────────┘
                                              ▼
                          ┌──────────────────────────────────────────┐
                          │  ORCHESTRATOR — stage order, artifacts,  │  [V main.ts]
                          │  resume, atomic job.json                 │
                          └───────┬──────────────────────┬───────────┘
                                  ▼                      ▼
                   ┌───────────────────────┐   ┌────────────────────────┐
                   │ HERMES (supervisor)   │   │ BUDGET / LEASE (NEW)   │
                   │ deliver / continue /  │◄──┤ issues leases, refuses │
                   │ escalate              │   │ what cannot be paid    │
                   └───────────┬───────────┘   └────────────────────────┘
                               ▼ convenes
                   ┌────────────────────────────────────────────────────┐
                   │ AGENT POOLS — concurrency, one role each           │
                   │ Creative · Research · VisualJudge · Coding ·       │
                   │ Motion · Image · 3D · Security · Browser · QA      │
                   └───────────┬────────────────────────────────────────┘
                               ▼ requests a capability, never a vendor
                   ┌────────────────────────────────────────────────────┐
                   │ CAPABILITY ROUTER                                  │
                   │ filter(licence, jurisdiction, credential, budget)  │
                   │ rank(observed availability, latency, cost, quality)│
                   │ may return a SET (k>1) when the capability says so │
                   └───────────┬────────────────────────────────────────┘
                               ▼
                   ┌────────────────────────────────────────────────────┐
                   │ PROVIDER POOL — substitution + failover            │
                   └───────────┬────────────────────────────────────────┘
                               ▼
                   ┌────────────────────────────────────────────────────┐
                   │ RESULT CACHE (NEW) — content-addressed             │
                   └───────────┬────────────────────────────────────────┘
                               ▼
                   ┌────────────────────────────────────────────────────┐
                   │ TERMINAL DETERMINISTIC FALLBACK — always in-repo   │  [V composeBaseline]
                   └────────────────────────────────────────────────────┘
```

Two additions to the proposal (**Budget/Lease**, **Result Cache**), one inversion (driver and
supervisor move to the top), one demotion (`agent-registry.json` becomes generated).

---

## 3. The cabinet without the explosion — the headline question

> *How can Hermes convene a cabinet of specialised agents on different models and providers
> without costs exploding?*

### 3.1 The naive number, so the target is honest

Five seats, all frontier, three battle candidates, two reconcept iterations:

```
5 seats × ~$0.115 (Opus-class, ~8k in / 3k out)   = $0.575 per candidate
× 3 candidates                                     = $1.73 per iteration
× 2 iterations (reconcept)                         = $3.46 per delivered site
```

That is the explosion. Everything below reduces it without lowering a single quality gate.

### 3.2 Seven compounding mechanisms

**M1 — Asymmetric seating.** A cabinet is not five equal seats. One seat does conceptual work; four
select from closed sets of 2–11 values; one is a deterministic feasibility check.

| Seat | Work | Route to | Cost |
|---|---|---|---|
| Creative Director | conceptual leap, free-text thesis | frontier (Opus/GPT Sol) | ~$0.115 |
| Art / UX / Motion / Asset | pick from an enum, one sentence why | **cheap** (GPT Luna ~$0.20/$1.20, Groq free, Gemini Flash-Lite free) | ~$0.002 ea. |
| Technical Architect | feasibility lookup | **no model** | €0 |

`$0.115 + 4×$0.002 + $0 ≈ $0.123` — **4.7× cheaper than the naive cabinet, before anything else.**
Routing an enum selection to a frontier model is the single most common way to waste 20× the
money in this design.

**M2 — The deterministic floor is a free voter.** Every one of those four enum decisions is
*already computed deterministically* [V: `planExperience`, `planConversion`, `planInteraction`,
`choreographAssets`]. So the cabinet never starts from zero: it starts with a free vote in hand.

```
quorum = { deterministic_floor (€0), cheap_model (€0.002) }
  agree     → done. Cost: $0.002. This is the common case on a closed set of 3–11 values.
  disagree  → escalate that ONE seat to a frontier tiebreak (~$0.02)
```

**M3 — Cheap-first quorum with disagreement escalation.** Generalised from M2: expensive models are
convened by *disagreement*, never by schedule. If two cheap voters agree, a third expensive
opinion buys nothing measurable. Expected cost per seat = `cheap + p(disagree) × expensive`, and
`p(disagree)` on a closed enum with a strong deterministic prior is low.

**M4 — Convene on evidence of need, not on a roster.** A seat that has nothing to decide is not
convened at all:

| Seat | Convened only when |
|---|---|
| Motion Director | the floor produced `transition !== 'none'` or `interaction.level !== 'static'` [V] |
| Asset Director | ≥3 usable photographs exist after `dropUndersized`/`dedupeByIdentity` [V] |
| UX Director | conversion mode is contested — i.e. character and category disagree |
| Creative Director | always (this is the seat that produces distinctness) |
| Art Director | **first seat dropped under budget pressure** — the floor is strong here |

A plumber with a logo and no photographs convenes **two** seats, not five.

**M5 — Prompt caching on the shared prefix.** All seats share one business brief. Anthropic
caching cuts cached input by ~90% [W]; batch halves everything [W]. The cabinet has an unusually
large shared prefix and an unusually small per-seat suffix — it is close to the ideal shape for
caching. This is a property of the design, not a trick.

**M6 — Content-addressed result cache (Objection 6).** Reconcept iteration 2 changes one field.
Every seat whose inputs are unchanged is a cache hit. A 3-iteration loop costs ~1.3× one cabinet
instead of 3×.

**M7 — Budget leases with graceful degradation order.** When the budget tightens, degrade in this
fixed order, and **never** touch the gates:

```
1. N candidates      3 → 2 → 1        (1 = today's behaviour exactly) [V]
2. jury k            3 → 2 → 1        (1 = today's single critic) [V]
3. cabinet seats     5 → 3 → 2        (drop Art, then Motion/Asset)
4. Creative Director frontier → cheap
5. all seats         cheap
6. cabinet off       → pure deterministic floor, still a complete site [V composeBaseline]
```

Every rung is a valid product. The bottom rung is €0 and still ships.

### 3.3 The resulting number

| Configuration | Per candidate | ×3 candidates | ×1.3 (cached reconcept) |
|---|---|---|---|
| Naive: 5 frontier seats | $0.575 | $1.73 | $2.25 |
| **M1 asymmetric** | $0.123 | $0.369 | $0.48 |
| **+ M2/M3 quorum** | ~$0.02 | ~$0.06 | ~$0.078 |
| **+ M4 convene-on-need** (plumber) | ~$0.008 | ~$0.024 | ~$0.031 |
| **+ M5 caching** | ~$0.015 | ~$0.045 | ~$0.058 |

**~€0.02–0.06 per cabinet, against ~€0.58 naive — a 10–25× reduction, with no gate lowered and no
capability removed.**

### 3.4 The rule that makes it hold

> **A cabinet seat is convened by a disagreement or an uncertainty, never by a schedule; and it is
> routed by the size of its decision, never by the prestige of its title.**

An Art Director choosing between eleven enum values is a $0.002 decision no matter what it is
called. Design the seats so that only one of them is genuinely expensive, and the cabinet metaphor
stops being a cost metaphor.

---

## 4. Missing capabilities

Absent from both the proposal and the prior arsenal document. Ordered by how badly their absence
would show up in front of a paying customer.

| # | Missing capability | Why it matters | Path |
|---|---|---|---|
| **M-01** | **Legal / compliance content** — imprint, privacy notice, cookie posture, terms | For EU SMBs this is **legally required**, not decorative. A delivered site without it is a liability handed to a customer. The renderer emits no such section today [V]. | **CORE — BUILD** |
| **M-02** | **PII detection in evidence** | Scraped pages carry staff names, private mobile numbers, home addresses. Publishing them is a GDPR incident caused by the platform, not the customer. Nothing screens for this [V]. | **CORE — BUILD** |
| **M-03** | **Visual regression / screenshot diff** | The reconcept loop *asserts* iteration 2 differs from iteration 1 but never *measures* it — the perturbation is trusted [V: `perturbedDirective`]. `odiff`/`pixelmatch` is deterministic, free, and would prove it. | **CORE — BUILD (€0)** |
| **M-04** | **Structured-data validation** | The pipeline emits JSON-LD [V] and nothing validates it against rich-result requirements. Invalid schema is silent — it simply never earns a rich result. | **CORE — BUILD (€0)** |
| **M-05** | **Domain / DNS** | A website needs an address. Not a single provider in the proposal registers one. | **CORE — BUILD** |
| **M-06** | **Font licence verification** | Faces are vendored and inlined [V] with no licence check on the vendored file. Redistributing a font in a commercial deliverable is exactly the kind of exposure that arrives by letter. | **CORE — BUILD** |
| **M-07** | **Human-in-the-loop / approval queue** | Hermes escalates to a `human` stage [V: `jobState.ts:22-38`] with no mechanism for a human to *receive* or *answer*. The terminal state of the state machine is a dead end. | **CORE — BUILD** |
| **M-08** | **Image content safety** | A scraped Instagram photo may contain something that must not appear on a business site. One cheap check; a large downside. | **OPTIONAL** |
| **M-09** | **Post-delivery integrity monitoring** | `googleusercontent` URLs rot. A delivered site silently loses its photographs weeks later. | **OPTIONAL** |
| **M-10** | **Deploy rollback / versioned releases** | "The new version is worse" has no answer today. | **OPTIONAL** |
| **M-11** | **Contact delivery (forms → inbox)** | Only `tel:`/`mailto:` ship today [V]. The moment a form exists, this is required. | **CONDITIONAL** |
| **M-12** | **Rate-limit governor** as an explicit capability | Not a provider — a shared resource. 15 concurrent cabinet calls exceed Gemini's free tier instantly [W]. Modelling it as a capability makes it schedulable. | **CORE — BUILD (€0)** |
| **M-13** | **Translation QA** (distinct from translation) | `ro`/`en` ship today [V]; nothing verifies the Romanian is *right*, only that it is Romanian. | **OPTIONAL** |
| **M-14** | **Static site search** | Irrelevant for a one-pager; required the moment a site has 20 pages. Pagefind indexes at build for €0. | **CONDITIONAL** |
| **M-15** | **Prompt-injection screening on scraped text** | Scraped page text is embedded verbatim into model briefs [V: `designDirectorAgent.ts:479-484`]. The closed schema blunts the impact; nothing detects the attempt. | **OPTIONAL (detection); the schema is the control)** |

---

## 5. Missing providers

### 5.1 The genuinely important omissions

**Groq — CORE candidate, and the best free-tier find in this review.**

| Field | Value |
|---|---|
| Capability | LLM inference on open-weight models, at LPU speed |
| Free tier [W] | **30 RPM / 6,000–30,000 TPM / 1,000–14,400 requests per day, no credit card** |
| Cost [W] | from **$0.05/M input** (Llama 3.1 8B Instant); up to ~$3/M output (Kimi K2) |
| Latency [W] | **300–1,000 tokens/sec** — ~10× GPU-based inference |
| Rate limits [W] | **organisation-level, not per key** — five keys do not give five times the quota |
| Privacy | US infrastructure; open-weight models only — **no proprietary GPT/Claude/Gemini** |
| Unique advantage | The only provider where **k=3 quorum on enum decisions is free and finishes in under a second** |
| Verdict | **CORE for the cheap cabinet seats.** It is the mechanism that makes M2/M3 above cost approximately nothing. |

**The browser platform itself — CORE, and the most under-recognised "provider" in the design.**

| Finding [W] | Consequence |
|---|---|
| **CSS scroll-driven animations**: Chrome/Edge 115+, Firefox 132+, Safari 18+, **~84% global support mid-2026**; transform/opacity run on the **compositor thread** | A large share of what the Tier-2 JS runtime does can be expressed in pure CSS with `@supports (animation-timeline: scroll())` as the progressive-enhancement gate — **zero JS, zero bytes, zero vendor** |
| **View Transitions API**: cross-browser 2025–2026; Firefox partial, degrading to a cross-fade | The `transition` enum's `veil`/`wipe` values [V: `lib/design/experience.ts:71`] may be expressible natively |

**This materially weakens the case for GSAP and Lenis** (§7). A motion "provider" is only needed
for what the platform cannot do, and the platform's surface grew substantially in the last year.

**Local inference — CORE, and the only real cap on vendor pricing power.**

`Ollama` / `llama.cpp` / `vLLM` for text; `transformers.js` / ONNX Runtime for embeddings
**in-process, with no server at all**. The embedding side matters most: Design Fingerprint L3 runs
on a 50–500 MB local model at €0 with no network, no rate limit, no jurisdiction question, and no
provider to fail over from.

**Others worth adding:**

| Provider | Capability | Why |
|---|---|---|
| **Together AI / DeepInfra / Fireworks** | open-weight inference | A second aggregator so OpenRouter is not a single point of failure for the failover bus |
| **Cerebras** | ultra-fast inference | Same play as Groq; hold as its fallback |
| **sqlite-vec / libSQL** | vector search **without a server** | At BusinessForge's scale (thousands of fingerprints) this is the correct answer; a hosted vector DB is over-engineering [W] |
| **Pagefind** | static search index | €0, build-time, no runtime service |
| **odiff / pixelmatch** | visual regression (M-03) | €0, deterministic, fast |
| **Cloudflare Registrar** | domains (M-05) | At-cost registration inside a vendor already in CORE |
| **Resend / Postmark** | contact delivery (M-11) | Only when a form ships |
| **Grafana / Prometheus / Loki** | OTel backends | Self-hosted destination for OpenTelemetry (see §7 on why OTel is not a provider) |
| **Playwright Trace Viewer** | debugging | Already installed [V], almost certainly unused |
| **Google Rich Results Test / schema validators** | M-04 | Free |

### 5.2 On OpenTelemetry specifically — a category error worth correcting

OpenTelemetry appears in the provider list. **It is not a provider; it is a wire format.** It
belongs in the capability registry as the *interface* for `observability`, with Langfuse, Grafana,
Phoenix, or the repo's own NDJSON sink [V: `lib/logger.ts`] as interchangeable *backends*. Getting
this wrong produces a registry entry that can never fail over, because there is nothing to fail
over to — you would be listing HTTP as a provider.

Same class of error, elsewhere in the list: **SQLite** is a storage engine, not a provider;
**Three.js** and **GSAP** are libraries you vendor, not services you call. Libraries belong in the
capability registry as `implementation: 'vendored'` with a licence field and **no runtime failover
at all** — they cannot be "unavailable".

---

## 6. Providers included that do not deserve to exist

| Provider | Verdict | Reason |
|---|---|---|
| **Snyk** | **REJECT** | Free tier is 5 SCA + 1 SAST project with a 100-scan cap — a trial, not a tier [W]. Semgrep's free tier covers 10 contributors with the **full platform**, cross-file analysis, and the Pro rule library [W]. For a repository with **two runtime dependencies** [V: `package.json`], Snyk's SCA breadth is answering a question BusinessForge does not have. |
| **OWASP ZAP** | **REJECT** | A DAST scanner against a static HTML file with no server, no forms, and no scripts finds nothing. Wrong tool for the artifact. |
| **Perplexity API** | **REJECT** | Sonar ($1/$1, Pro $3/$15, **plus a per-request search fee**) [W] sells a *synthesised answer*. BusinessForge needs **citable sources**, because every fact must trace to a URL [V: the collector's verbatim-plus-URL rule]. Perplexity's unique advantage is precisely the thing that is unusable here. Exa or Tavily give retrieval you can cite for less. |
| **Bunny.net** | **REJECT until scale** | **No permanent free plan; $1/month minimum** [W]. Cloudflare R2 gives 10 GB and **zero egress** free [W]. Bunny wins only at high bandwidth in specific regions — a problem BusinessForge does not have before its first customer. |
| **Brave Search API** | **REJECT** | **No free tier any more** [W]. Tavily (1,000/mo free) and Exa cover the need. |
| **Meshy · Tripo · Spline** | **REJECT for product** | 3D *generation* has no consumer in the pipeline [V: no such field in `WebsiteDesign`]. |
| **Kling · Seedance · Veo (full price) · Runway · Higgsfield** | **REJECT for product** | The business has no footage; generated footage of a real venue is a fabricated fact. |
| **Rive** | **REJECT for autonomous use** | Requires hand-authored `.riv` files. There is **no derivation path from business evidence**, so it cannot be produced per business. A designer-in-the-loop tool inside an autonomous system. |
| **Vercel *and* Netlify as CORE** | **demote both to FALLBACK** | Redundant with Cloudflare Pages. Keep exactly one alternative host so the deploy adapter stays generic; a third is inventory. |
| **Qdrant as CORE** | **demote to CONDITIONAL** | Free tier is 0.5 vCPU / 1 GB RAM / 4 GB disk [W] — fine, but sqlite-vec handles thousands of fingerprints in-process with no service to run. Promote only past ~100k vectors. |
| **Firecrawl** | **demote to CONDITIONAL** | Playwright already crawls [V]. Free tier is 1,000 credits/mo [W]. Justified only for JS-heavy targets where the existing crawler demonstrably fails. |
| **Ideogram** | **demote to SPECIALIST** | One genuine strength (text rendered inside images). Not a general image provider for this product. |
| **Replicate** | **demote to FALLBACK** | **20–60 s cold starts on idle models, which you also pay for** [W] — disqualifying inside an interactive loop. fal.ai is 30–50% cheaper with more models [W]. |

---

## 7. Redundancies to collapse

| Redundant set | Keep | Drop / demote | Reason |
|---|---|---|---|
| OpenRouter · fal.ai · Replicate · Higgsfield · Hugging Face (5 aggregators) | **OpenRouter** (text) + **fal.ai** (image) | the other three | Two aggregators is redundancy; five is a maintenance surface. HF stays as the *registry of weights*, not as inference [W: free tier is <$0.10/mo in credits]. |
| DeepSeek · Qwen · Kimi · GLM (4 CN labs) | **one**, pending the jurisdiction decision (§12) | the other three, reachable via OpenRouter | Four providers with one shared regulatory question is one exposure, four integrations. |
| Tavily · Exa · Brave · Perplexity · Serper (5 search) | **Tavily** (1,000/mo free) + **Exa** (semantic) | Brave, Perplexity, Serper | Search is not on the critical path — evidence comes from the business, not the web. |
| Cloudflare · Vercel · Netlify · Bunny (4 hosts) | **Cloudflare** + one FALLBACK | the other two | — |
| Snyk · Semgrep (2 SAST) | **Semgrep** | Snyk | §6 |
| GSAP · Rive · Lottie · Lenis · native CSS (5 motion) | **native CSS/View Transitions first**, **GSAP conditional** | Rive, Lottie, Lenis | ~84% global support for scroll-driven animations on the compositor thread [W] removes most of the reason to ship a library |
| FLUX · Ideogram · Recraft · Firefly · Imagen (5 image) | **Recraft** (vector) + one raster **via fal.ai** | direct integrations with the rest | Firefly stays named as the *indemnified escalation*, not a default |
| Langfuse · Helicone · Phoenix (3 observability) | **Langfuse self-hosted** | the others | Helicone was acquired by Mintlify in March 2026 with an uncertain roadmap [W] |
| Claude Code · Codex · Gemini CLI · Antigravity · Cursor (5 coding agents) | **one primary + one second opinion** | the rest | These are **workshop** tools and belong in no runtime registry at all |

---

## 8. Capabilities that must be split

| Current | Split into | Why the split is load-bearing |
|---|---|---|
| **`visual_judging`** | `visual_defect_detection` · `craft_judging` · `distinctness_judging` | Three different questions with three different failure modes. Defect detection is a **repair** loop that edits CSS [V: `visual-qa.ts`]; craft judging is **absolute** against a rubric [V: `visual-critic.ts`, 13 axes]; distinctness judging is **comparative** and requires Design Memory. Merging them produces a prompt that does all three badly — and worse, lets a repair tool's opinion influence a ship/no-ship gate. |
| **`browser`** | `evidence_collection` · `qa_measurement` | **The most dangerous conflation in the proposal.** Evidence collection is tolerant, semantic, and may legitimately use a browser agent (Stagehand). QA measurement must be **deterministic and reproducible** — a model anywhere in the measurement path makes the gate non-reproducible, which is the property the whole artifact/resume design exists to guarantee [V: `main.ts:150-162`]. These must be separately typed so nothing can accidentally route a measurement through a model. |
| **`image_generation`** | `image_nondepictive` · `image_editing` · `vector_generation` | Different licence risk, different provider sets, different gates. Only `image_editing` may touch a real photograph; only `image_nondepictive` may create pixels from nothing; `vector_generation` is structural. The hard prohibition on depiction is enforceable **only** if these are separate capabilities [V: the rule this inherits, `docs/architecture.md:136-153`]. |
| **`security`** | `output_security` · `supply_chain_security` | Different subjects (what ships to the customer vs our own code), different tools, different cadence, different owner. Today's five shipped checks are output security [V: `publish-run.ts:290-299`]; Semgrep/gitleaks are supply chain. |
| **`deployment`** | `build_artifact` · `hosting` · `domain_dns` | Three vendors, three failure modes, three rollback stories. M-05 is invisible while these are one capability. |
| **`memory`** | `design_memory` · `evidence_memory` | **Radically different privacy and retention rules.** Design memory is fingerprints, retained forever, containing **no customer PII**. Evidence memory is business facts, subject to deletion requests. One capability would force one policy onto both. |
| **`research`** | `evidence_research` (about this business) · `market_research` (about its competitors) | The first is CORE and free; the second is OPTIONAL and paid. Same tools, different budgets and different consumers. |

---

## 9. Capabilities that should be merged

| Merge | Into | Why |
|---|---|---|
| `embeddings` + `vector_search` + `reranking` | **`semantic_index`** | They are never used apart. Splitting them invites a hosted vector database for a problem that `sqlite-vec` + a local ONNX model solves in-process at €0. Reranking at this scale is a sort. |
| `motion` + `3d_runtime` | **`runtime_tier`** — an ordered ladder `none → css → js → webgl` | It is one escalation ladder, not two capabilities. The repo already models it this way [V: `RenderOptions.runtime`, `InteractionStrategy.ceiling`]. Two capabilities would let a business get WebGL without CSS, which is nonsense. |
| `seo` + `structured_data` + `localization` | **`discoverability`** | One question — *can this page be found and understood* — one consumer (`lib/render/document.ts`), one gate. Localization is already inseparable from it: `WebsiteContent.language` reaches `<html lang>` [V]. |
| `performance` + `asset_optimization` | **`performance`** | Optimization exists solely to serve a performance budget. As a separate capability it becomes an end in itself and someone optimises a page that was already fast. |
| `image_to_video` + `video_generation` | **`motion_media`**, single policy-gated capability, default **off** | Keeping them apart implies one is more acceptable than the other. Both are gated on the same rule: the subject must be the business's own footage or photograph. |

**Net effect:** the registry gets **smaller and sharper** — 7 splits and 5 merges from a base of
~39 gives roughly 44 capabilities, but each with exactly one contract, one consumer, and one gate.

---

## 10. Conditional activation — by character, not by a website-type flag

This is item 7 of the brief, and it has a correct answer and a tempting wrong one.

**Wrong:** a `websiteType` field someone sets, which becomes a template selector by the back door
— the exact anti-pattern the architecture forbids.

**Right:** activation keys off `BusinessCharacter`, which is **already derived deterministically
from evidence** [V: `lib/design/character.ts:178` — `visualWeight`, `expressiveness`,
`emotionalRegister`, `offeringBreadth`, `narrativePotential`]. The archetypes below are *readings*
of that vector, not inputs to it.

| Archetype (character reading) | Activate | Suppress |
|---|---|---|
| **Emergency trade** — `text-led`, `functional`, `narrativePotential: none` | legal/compliance (M-01), schema validation (M-04), phone-first conversion | all image gen, all motion beyond `subtle`, gallery, runtime tier > `css` |
| **Hospitality / venue** — `image-led`, `warm`/`romantic`, `narrativePotential: strong` | OCR (menus — often the richest evidence that exists), image editing (upscale/outpaint), `runtime_tier: js`, ambient loop as EXPERIMENTAL | vector generation, 3D, search |
| **Retail / product** — `balanced`, `offeringBreadth: broad` | product visualization (a 24–72 frame image sequence plus a tiny player [W] — DIY at €0, no vendor), Recraft vector marks, `semantic_index` for a product list | video, 3D generation |
| **Professional services** — `text-led`, `formal` | **legal/compliance is mandatory here**, trust/credential rendering, schema validation, PII screening (M-02) | everything decorative; motion beyond `subtle` |
| **Creative / portfolio** — `image-led`, `expressive`, `narrativePotential: strong` | **the only archetype where sophisticated experience tooling earns its keep**: GSAP, scroll-driven CSS, View Transitions, `runtime_tier: js`, Tier-3 as a genuine candidate | high-intent conversion pressure |
| **Wholesale / B2B** — `text-led`, `functional`, `offeringBreadth: broad` | structured product/service lists, `discoverability` | **all** media spend |

**The architectural rule:** a capability's activation predicate is a **pure function of
`BusinessCharacter` plus the evidence inventory**, evaluated deterministically before any model is
convened. That makes activation reproducible, auditable, free, and impossible to turn into a
template menu.

---

## 11. THE TWELVE DELIVERABLES

### 11.1 COMPLETE CAPABILITY REGISTRY

Post-split, post-merge. `Tier`: **C**ORE / **CO**NDITIONAL / **S**PECIALIST / **F**ALLBACK-only /
**R**EJECT. `Gate`: does a policy gate block autonomous execution?

| id | Tier | Terminal fallback (always in-repo) | Gate |
|---|---|---|---|
| `reasoning` | C | `composeBaseline` [V] | — |
| `structured_generation` | C | reject directive, keep floor [V ADR 0004] | — |
| `prose_writing` | C | `composeBaseline` [V] | — |
| `evidence_research` | C | profile is honestly thinner [V] | — |
| `market_research` | CO | skip | — |
| `evidence_collection` (browser) | C | fail loudly | — |
| `qa_measurement` (browser) | C | **must never fail silently** | **no model, ever** |
| `evidence_extraction` (OCR/doc) | CO | skip | — |
| `vision_description` | C | deterministic `subjectOf` [V] | — |
| `image_nondepictive` | CO | solid grounds from `worlds.ts` [V] | — |
| `image_editing` | CO | use the photograph as-is | rights check |
| `vector_generation` | CO | inline SVG/CSS the renderer ships [V] | — |
| `motion_media` (video + i2v) | S | static photograph | **human approval** |
| `3d_generation` | R | — | rejected |
| `runtime_tier` (none→css→js→webgl) | C | `runtime:'none'` — static page [V] | reduced-motion |
| `product_visualization` | CO | static gallery | — |
| `craft_judging` | C | `uncertain`, never a pass [V] | — |
| `distinctness_judging` | C | L1 structural fingerprint, €0 | — |
| `visual_defect_detection` | CO | ship with warnings [V] | — |
| `visual_regression` (M-03) | C | — (deterministic, €0) | — |
| `adversarial_evaluation` | C | skip the round | — |
| `evaluation_calibration` | CO | — | — |
| `semantic_index` (embed+search+rerank) | C | L1+L2 fingerprint only, €0 | — |
| `design_memory` | C | in-run `peers.json` [V] | **no PII** |
| `evidence_memory` | CO | re-derive | deletion requests |
| `accessibility` | C | in-repo landmark/alt checks [V] | — |
| `performance` (incl. optimization) | C | report only | — |
| `output_security` | C | 5 shipped checks [V] | — |
| `supply_chain_security` | CO | `npm audit` | — |
| `pii_detection` (M-02) | C | **BUILD — no fallback exists** | — |
| `content_safety` (M-08) | CO | manual review | — |
| `legal_compliance` (M-01) | C | **BUILD — no fallback exists** | jurisdiction |
| `discoverability` (SEO+schema+l10n) | C | in-repo JSON-LD + lexicon [V] | — |
| `structured_data_validation` (M-04) | C | emit unvalidated | — |
| `build_artifact` | C | `site/` on disk [V] | — |
| `hosting` | C | `site/` on disk [V] | — |
| `domain_dns` (M-05) | C | customer's own domain | **human** |
| `contact_delivery` (M-11) | CO | `tel:`/`mailto:` [V] | — |
| `site_search` (M-14) | CO | omit | — |
| `observability` | C | NDJSON on disk [V] | — |
| `cost_ledger` | C | **BUILD** | — |
| `rate_governor` (M-12) | C | **BUILD** | — |
| `human_approval` (M-07) | C | **BUILD** | — |
| `integrity_monitoring` (M-09) | CO | — | — |
| `coding_agent` | **workshop** | — | **never in the runtime registry** |

### 11.2 COMPLETE PROVIDER REGISTRY

**CORE** — the product depends on these

| Provider | Capabilities | Free tier [W] | Licence class | Jurisdiction |
|---|---|---|---|---|
| Gemini | reasoning, structured, vision, image | **yes — 5–15 RPM, 100–1,000 RPD** | commercial API | US/global |
| **Groq** | reasoning (cheap seats) | **yes — 30 RPM, 1k–14.4k RPD, no card** | commercial, open-weight models | US |
| OpenRouter | reasoning failover | yes — 50/day, **1,000/day after one-time $10** | **inherits upstream — verify per model** | varies |
| Anthropic | prose, creative concept | no | commercial | US |
| OpenAI | second vendor, jury B, adversarial | no | commercial | US |
| Playwright + Chromium | evidence collection, qa measurement | n/a (local) | Apache-2.0 | local |
| axe-core | accessibility | n/a | MPL-2.0 | local |
| Lighthouse | performance | n/a | Apache-2.0 | local |
| Semgrep | supply chain | **10 contributors, full platform** | LGPL-2.1 CE | local/cloud |
| gitleaks | secret scanning | n/a | MIT | local |
| **local ONNX/transformers.js** | semantic_index | n/a | permissive | **local — no network** |
| **sqlite-vec / libSQL** | semantic_index storage | n/a | MIT/Apache | local |
| **odiff / pixelmatch** | visual regression | n/a | MIT | local |
| Cloudflare Pages + R2 | hosting, build artifact | **10 GB, zero egress, 500 builds/mo** | commercial | global |
| Cloudflare Registrar | domain_dns | at cost | commercial | global |
| **Native CSS + View Transitions** | runtime_tier | n/a — **the platform** | n/a | client |
| sharp + svgo | performance/optimization | n/a | Apache/MIT | local |
| Langfuse (self-hosted) | observability | **unlimited self-hosted** | MIT core | local |
| n8n (self-hosted) + `run-job.ts` | orchestration | yes | fair-code / own code | local |

**CONDITIONAL** — activated by character (§10)

Mistral OCR ($4/1k pages, $2 batch) · Docling (MIT, local, **try first**) · Recraft ($0.04 raster
/ $0.08 vector) · fal.ai ($0.003–0.15/image) · Places API (~$0.01/business) · Tavily (1,000/mo
free) · Exa ($10 credit) · GSAP (**free incl. commercial**) · Voyage (200M free tokens) ·
Firecrawl (1,000 credits/mo) · Qdrant (>100k vectors) · Pagefind · Resend/Postmark · Cloudflare
Web Analytics · DeepL.

**SPECIALIST** — one narrow strength, invoked by name

Ideogram (text inside images) · Adobe Firefly (**the only indemnified source**) · Veo 3.1 Lite
(ambient loop, human-gated) · WebPageTest (real-device truth) · IBM Equal Access (a second, and
usefully disagreeing, a11y ruleset) · Three.js (Tier-3 only, vendored) · Higgsfield (**if** video
is ever needed, adopt the aggregator, never a vendor).

**FALLBACK** — exists to be second

DeepSeek / Qwen / Kimi / GLM (one, via OpenRouter) · Cerebras (after Groq) · Together/DeepInfra/
Fireworks · Imagen 4 · Replicate · Netlify **or** GitHub Pages (one) · Helicone · Pa11y ·
Browserbase (when local contexts saturate) · Tesseract/Surya · Serper.

**REJECT** — §6, plus: Snyk · OWASP ZAP · Perplexity · Bunny · Brave · Meshy · Tripo · Spline ·
Rive · Kling · Seedance · Runway · Sora (**API discontinuation scheduled 24 Sept 2026** [W]) ·
Lovable · Google Analytics · CDN fonts · Tailwind/Bootstrap · Ahrefs/Semrush · external
observability SaaS · sandboxing in the product path.

### 11.3 AGENT POOL REGISTRY

`k` = agents run per invocation. **The single most important column is the last one.**

| Pool | Members | k=1 when | k=2–5 when | Parallelism driver |
|---|---|---|---|---|
| **CreativeDirectorPool** | Creative Director | budget ≤ T2, or `narrativePotential: none` | **k=3 for a Design Battle** — this is the pool where parallelism *is* the product | candidate count |
| **CabinetPool** | Art · UX · Motion · Asset | always k=1 per seat | **never parallel on the same seat** — instead run seats concurrently with each other | seats convened (§3, M4) |
| **ArchitectPool** | Technical Architect | always k=1 | never | deterministic, free, unbounded |
| **ResearchPool** | evidence research · market research | evidence: always k=1 | **k=2 across independent sources** when a fact is contested and must be corroborated | source count |
| **VisualJudgePool** | craft judge · distinctness judge | k=1 for a non-gating opinion | **k=2 minimum, different vendors, both orderings** whenever the verdict gates delivery — position and self-enhancement bias are documented and systematic [V: `design_evaluation_research.json` topic (d)] | pairs × orders × judges |
| **AdversarialPool** | Adversarial Critic | **always k=1** — one objection, strongest first | never; an unbounded critic produces a wish list, and a wish list is not actionable | — |
| **BrowserPool** | capture · functional · a11y · perf | k=1 per viewport | **k = viewports × candidates**, bounded by **CPU, which saturates before model quota** | local cores |
| **QAPool** | functional · a11y · security · perf | — | **all four in parallel** — they are independent and deterministic | free |
| **ImagePool** | non-depictive · editing · vector | k=1 | k=2 only to compare two treatments of the **same real photograph** | rare |
| **MotionPool** | Motion Director | k=1 | never | — |
| **3DPool** | — | **empty by design** | — | Tier-3 only, one quarantined host [V] |
| **SecurityPool** | output · supply chain | k=1 each | **both in parallel** — different subjects entirely | free |
| **CodingPool** | — | **not in the runtime registry** | — | workshop only |

**The rule that governs every row:** *run one agent when the decision is reversible or the
deterministic floor already has a strong prior; run several when the decision is **comparative**
(battle), **gating** (jury), or **corroborative** (contested fact). Never run several to feel
thorough.*

### 11.4 MODEL ROUTING MATRIX

| Task | Primary | Second | €0 path | Constraint |
|---|---|---|---|---|
| Analyst | Gemini Pro | GPT-5 | Gemini free | — |
| Writer | Claude Sonnet 5 | GPT-5.6 Terra | Gemini free | quality visible to customer |
| Creative Director | Claude Opus 5 | GPT-5.6 Sol | Gemini Pro | **≠ Adversarial vendor** |
| Cabinet enum seats | **Groq (free)** | GPT Luna | Gemini Flash-Lite | **never a frontier model** |
| Craft judge | Gemini vision | GPT vision | — | — |
| Distinctness judge | GPT vision | Claude vision | L1 fingerprint (€0) | **≠ craft judge vendor** |
| Adversarial | whichever of GPT/Gemini the Creative Director did **not** use | — | skip | **cross-vendor mandatory** |
| Vision description | Gemini Flash | local VLM | deterministic `subjectOf` [V] | — |
| Embeddings | **local ONNX** | Voyage (200M free) | — | never leaves the machine |
| OCR | **Docling (local)** | Mistral OCR | skip | — |
| Technical Architect | **no model** | — | — | deterministic by design |

### 11.5 FALLBACK MATRIX

Abbreviated — the full version is in the arsenal document §6. **The invariant: every chain ends in
something the repository already owns, so no failure produces "no website" — only a plainer one.**

| Capability | 1 | 2 | 3 | Terminal |
|---|---|---|---|---|
| reasoning | Gemini | Groq | OpenRouter free | `composeBaseline` [V] |
| prose | Claude | GPT | Gemini | `composeBaseline` [V] |
| enum seats | Groq | Luna | DeepSeek | **deterministic floor** [V] |
| craft judging | Gemini v | GPT v | Claude v | `uncertain` — never a pass [V] |
| distinctness | embeddings L3 | — | — | **L1+L2 structural, €0** |
| qa measurement | local Playwright | — | — | **fail loudly — never degrade** |
| evidence collection | Playwright | Stagehand | Browserbase | thinner profile [V] |
| runtime | native CSS | own JS runtime [V] | GSAP | **`runtime:'none'`** [V] |
| hosting | CF Pages | Netlify | GH Pages | `site/` on disk [V] |
| observability | NDJSON [V] | Langfuse | — | NDJSON [V] |
| orchestration | n8n | `run-job.ts` [V] | `main --compose` [V] | — |

### 11.6 COST MATRIX

| Configuration | Per site | Note |
|---|---|---|
| T0 deterministic floor | **€0.00** | complete, working, distinct site [V] |
| T1 analyst + writer, Gemini free | **€0.00** | RPD-limited |
| T2 + cabinet, asymmetric + quorum + Groq | **~€0.01–0.03** | §3.3 |
| T3 + battle ×3 + jury k=2 + adversarial | **~€0.06–0.12** | with caching |
| T3-premium (Opus writer + Opus creative) | **~€1.00–1.50** | per-customer decision |
| + Places API | +€0.01 | licence unresolved [?] |
| + OCR (Mistral, 4-page menu) | +€0.016 | after Docling fails |
| + Recraft vector mark | +€0.08 | rare |

**Conclusion unchanged from the arsenal document, and reinforced by Groq's free tier: model cost
is not the constraint. Rate limits, latency, and licensing are.**

### 11.7 COMMERCIAL LICENCE MATRIX

**The column that creates actual legal exposure. Every `[?]` is a blocking question.**

| Provider | Commercial output? | Trains on input? | Indemnity | Jurisdiction |
|---|---|---|---|---|
| Anthropic / OpenAI / Gemini (**paid**) | yes [K] | no (API tiers) [K] | limited/none [K] | US |
| Gemini **free tier** | **[?] verify — free-tier terms differ from paid** | **[?]** | no | US |
| OpenRouter `:free` | **[?] inherits upstream — a `:free` model may carry non-commercial weights** | **[?]** | no | varies |
| Groq | yes [W] | [?] | no | US |
| DeepSeek / Qwen / Kimi / GLM | yes [K] | **[?]** | no | **CN — the blocking question** |
| Mistral | yes [K] | no [K] | no | **EU — the answer to the above** |
| **FLUX open weights** | **NO — default open-weight path is non-commercial; commercial licences sold separately** [W] | n/a | no | DE |
| FLUX via BFL API (Pro tier) | **yes — full commercial licence** [W] | n/a | no | DE |
| **Adobe Firefly** | yes | trained on licensed/public-domain only | **yes — IP indemnification on paid plans** [W] | US |
| Recraft / Ideogram | [?] on paid API | [?] | no | US |
| **ElevenLabs free tier** | **NO — free output cannot be used in monetized work; attribution required** [W] | — | no | US |
| Places API | **[?] review storage/display terms — blocking** | n/a | no | US |
| GSAP | **yes — 100% free including commercial since April 2025** [W] | n/a | n/a | vendored |
| axe-core (MPL-2.0) · Lighthouse (Apache) · Semgrep CE (LGPL) · Playwright (Apache) · sqlite-vec (MIT) | yes | n/a | n/a | local |
| **Vendored font faces** | **[?] — M-06, unverified, and redistribution is the exposure** | n/a | n/a | — |

### 11.8 PARALLELISM POLICY

1. **Fan out on candidates, never on stages.** Stage order encodes dependency; candidate identity
   does not. Safe because `planNarrative` is derived **once** before divergence [V: `lib/design/plan.ts`].
2. **Isolate candidate artifacts** under `output/<runId>/candidates/<id>/`; merge only at the gate.
   `job.json` writes stay serialised through one chain [V: `stage-server.ts:61-66`].
3. **Rate governance is per-vendor, not global.** Three vendors at 10 RPM is 30 RPM of capacity; a
   global cap wastes two-thirds. **This is the second reason for multi-vendor — throughput, not
   just redundancy.** Note Groq and Gemini both meter at the **organisation/project** level, so
   extra API keys buy nothing [W].
4. **Deterministic work is unbounded and free**; model work runs under a lease.
5. **The browser pool saturates before the model pool** on a developer machine. Size it to cores,
   not to ambition.
6. **Round 1 (deterministic elimination) always precedes any paid call.** It is simultaneously the
   cost lever and the concurrency lever.
7. **Degrade N and k under pressure; never a threshold.** Ladder in §3.2 M7.
8. **Jury pairs are fully parallel and order-swapped**; a judge never sees another judge's answer.

### 11.9 HERMES ROUTING RULES

Preserving today's semantics exactly [V: `lib/workflow/hermes.ts:37-73`], extended for budget and
the cabinet.

```
R0  ORDER IS THE DESIGN. Evaluate in this sequence, never reorder:
R1  gate.verdict == PASS                       → DELIVER  (regardless of iteration)
R2  budget.exhausted                           → ESCALATE (new — cost is a first-class failure)
R3  job.iteration >= job.maxIter               → ESCALATE (existing) [V]
R4  gate.route ∈ {escalate, deliver} on a FAIL → ESCALATE (a FAIL may never route to deliver) [V]
R5  otherwise                                  → CONTINUE, iteration+1, at gate.route [V]

CABINET CONVOCATION (new)
R6  Convene a seat only on an uncertainty signal in that seat's domain (§3, M4).
R7  Route each seat by DECISION SIZE, never by title: enum → cheap; concept → frontier.
R8  Quorum = deterministic floor + 1 cheap model. Escalate that seat only on disagreement.
R9  Cross-vendor is mandatory: creative ≠ adversarial; judge_A ≠ judge_B.
R10 Every convocation requires a budget lease. No lease → the seat is not convened,
    the deterministic floor stands, and the omission is recorded in provenance.

DIAGNOSIS → POOL (extends today's route table) [V: distinctness-gate.ts:107-124]
    D-weak-concept       → CreativeDirectorPool, k=3   (a new battle)
    C-weak-experience    → MotionPool + CabinetPool    (experience seats only)
    A-implementation     → BrowserPool + Builder       (it is a build defect, not a taste defect)
    B-missing-capability → ArchitectPool               (deterministic; often reveals the real answer
                                                        is "this cannot be built", not "try again")
    E-thin-evidence      → ESCALATE                    (no amount of design iteration fixes thin
                                                        evidence — today's best decision, keep it) [V]

INVARIANTS
R11 Hermes is deterministic. A model deciding whether to spend more money on itself
    is a conflict of interest.
R12 Hermes never re-scores. The gate scores; Hermes decides. [V]
R13 Escalation must produce a human-readable brief (M-07), not a job.json field.
```

### 11.10 Capabilities / providers to ELIMINATE

**Providers:** Snyk · OWASP ZAP · Perplexity · Bunny · Brave Search · Meshy · Tripo · Spline ·
Rive · Kling · Seedance · Runway · Higgsfield (as a default) · Sora (**scheduled shutdown**) ·
Lovable · Replicate (demote) · Firecrawl (demote) · Qdrant (demote) · Vercel **or** Netlify (keep
one) · three of the four CN labs · three of the five aggregators · Lenis · Lottie · Google
Analytics · CDN fonts · CSS frameworks · Ahrefs/Semrush · external observability SaaS.

**Capabilities:** `3d_generation` (no consumer) · `video_generation` as a default (policy-gated
only) · `voice/tts` (an a11y liability on an SMB site) · `sandboxing` in the product path (needed
only if the no-model-emits-code invariant breaks) · `autonomous_agents` on the product path
(destroys reproducibility) · `reranking` as a standalone (merge) · standalone `vector_search`
(merge).

**Category errors to fix:** OpenTelemetry is an interface, not a provider · SQLite is an engine,
not a provider · Three.js/GSAP are vendored libraries, not services · coding agents belong to no
runtime registry.

### 11.11 Capabilities / providers that are MISSING

**Capabilities:** M-01 legal/compliance · M-02 PII detection · M-03 visual regression · M-04
structured-data validation · M-05 domain/DNS · M-06 font licence verification · M-07 human
approval · M-08 content safety · M-09 integrity monitoring · M-10 rollback · M-11 contact
delivery · M-12 rate governor · M-13 translation QA · M-14 site search · M-15 injection screening.
Plus the two missing **layers**: budget/lease and result cache.

**Providers:** **Groq** (the important one) · native CSS scroll-driven animations + View
Transitions (the platform as a provider) · local inference (Ollama/llama.cpp/vLLM) ·
transformers.js/ONNX (in-process embeddings) · sqlite-vec/libSQL · odiff/pixelmatch · Pagefind ·
Cloudflare Registrar · Resend/Postmark · Together/DeepInfra/Fireworks · Cerebras · Grafana/
Prometheus (OTel backends) · Playwright Trace Viewer · Google Rich Results Test.

### 11.12 FINAL RECOMMENDATION FOR `capability-registry.json`

**Two hand-authored files, one generated. Static facts only. Volatile facts from telemetry.**

```jsonc
// capability-registry.json — WHAT a capability is. One authority per capability.
{
  "version": 1,
  "capabilities": {
    "distinctness_judging": {
      "description": "Is this design distinct from what we have already shipped?",

      // CONTRACT — the closed shape any implementation must satisfy.
      "outputSchema": "schemas/distinctness.v1.json",   // additionalProperties:false
      "consumer": "lib/qa/distinctness-gate.ts",         // exactly one consumer

      // POLICY — evaluated before any provider is considered.
      "activation": {
        "predicate": "always",                            // pure fn of BusinessCharacter+evidence
        "requiresHumanApproval": false
      },
      "quorum": { "min": 1, "preferred": 2, "distinctVendors": true },

      // ECONOMICS — a class, never a price. Prices live with providers, dated.
      "costClass": "cheap",                               // free | cheap | standard | premium
      "latencyClass": "interactive",                      // interactive | batch | offline

      // SAFETY — non-negotiable, checked at startup.
      "licenceRequirement": "commercial",
      "jurisdictionConstraint": null,                     // e.g. "eu-only"
      "mayReceivePII": false,
      "modelForbidden": false,                            // true for qa_measurement

      // THE MOST IMPORTANT FIELD IN THE FILE.
      "terminalFallback": {
        "kind": "deterministic",
        "module": "lib/design/quality.ts#genericityReport",
        "note": "L1 structural fingerprint. Always available. Always €0."
      }
    }
  }
}
```

```jsonc
// provider-registry.json — WHO can serve it. Static facts only.
{
  "version": 1,
  "providers": {
    "groq": {
      "adapter": "lib/ai/providers/openai-compatible",   // reuse, don't add a shape
      "credentialVariable": "GROQ_API_KEY",
      "baseUrlVariable": "GROQ_BASE_URL",
      "implements": ["reasoning", "structured_generation"],
      "licenceClass": "commercial",
      "jurisdiction": "us",
      "rateLimitScope": "organisation",                   // NOT per-key — sizing depends on it
      "freeTier": true,
      "listPriceHint": { "inputPerM": 0.05, "asOf": "2026-08-14", "verified": false },
      "qualityPrior": "mid",                              // a PRIOR; telemetry overrides it
      "notes": "LPU inference, 300-1000 tok/s. Open-weight models only."
    }
  }
}
```

**`agent-registry.json` — do not author it.** Agents stay TypeScript modules implementing
`Agent<I,O>` [V: `lib/types.ts`]. Generate `agents.generated.json` at build time from the module
exports if a dashboard or n8n needs a list. A generated file cannot drift from the code.

**Seven rules the registry design must hold to:**

1. **`terminalFallback` is mandatory on every capability.** A capability without one is a single
   point of failure wearing a config file.
2. **No price is authoritative.** `listPriceHint` carries `asOf` and `verified` and is a tiebreak
   input at most. Real cost comes from provenance [V].
3. **No quality score is authoritative.** `qualityPrior` seeds ranking on day one and is
   superseded by observed success rate and latency from telemetry [V].
4. **Licence and jurisdiction are hard filters, never rank inputs.** A cheaper non-commercial
   model must be *unreachable* for a paying job, not merely disfavoured.
5. **A startup validator fails loudly on any dangling reference** — an unimplemented capability, a
   provider claiming a capability that does not exist, a missing schema file. The precedent is the
   repo's own `MCP_SERVERS` rule [V: `lib/config.ts:449-455`].
6. **`modelForbidden: true` exists and is enforced** for `qa_measurement`. Reproducibility of
   measurement is the property the whole artifact/resume design guarantees [V].
7. **Adapters are reused, not multiplied.** Groq, DeepSeek, Together, Fireworks, and most others
   speak the OpenAI shape. One adapter, many providers, is what keeps the provider registry data
   rather than code.

---

## 12. The three blocking decisions, restated because they gate purchases

1. **Jurisdiction.** Does customer evidence reach DeepSeek / Qwen / Moonshot / Zhipu? If no,
   Mistral moves to CORE and the cheap-seat floor rises. **Founder decision, not engineering.**
   Groq (US, open-weight) partially sidesteps this and is the reason it is recommended as CORE.
2. **Free-tier commercial terms.** Gemini free tier, OpenRouter `:free`, and every open-weight
   model must be confirmed to permit commercial output before a paying customer's site passes
   through them. FLUX's non-commercial default open-weight path [W] is the proof that this is a
   real trap, not a formality.
3. **Places API review storage/display licence** — unresolved across all three documents; blocks
   the testimonials feature commercially.

Plus one new one from this review: **M-06, the licence of the vendored font faces.** The
repository redistributes font binaries in every delivered site [V]. That is the single legal
exposure in this architecture that has never been examined.

---

## Sources

Searched 2026-08-14, predominantly from pricing-aggregator sites rather than vendor pages.
Re-verify before committing spend.

[Groq pricing](https://klymentiev.com/blog/groq-pricing) ·
[Groq free tier limits](https://tokenmix.ai/blog/groq-free-tier-limits-2026) ·
[Perplexity API pricing](https://www.cloudzero.com/blog/perplexity-api-pricing/) ·
[Firecrawl pricing](https://www.eesel.ai/blog/firecrawl-pricing) ·
[Qdrant pricing](https://qdrant.tech/pricing/) ·
[Qdrant Cloud free tier](https://ranksquire.com/2026/04/19/qdrant-cloud-pricing-2026/) ·
[Vector database comparison](https://www.firecrawl.dev/blog/best-vector-databases) ·
[Bunny.net pricing](https://comparetiers.com/tools/bunny-net) ·
[Bunny vs Cloudflare](https://www.kunalganglani.com/blog/bunnynet-vs-cloudflare-2026) ·
[Semgrep vs Snyk](https://appsecsanta.com/sast-tools/semgrep-vs-snyk) ·
[Snyk pricing](https://dev.to/rahulxsingh/snyk-pricing-in-2026-free-plan-team-business-and-enterprise-costs-breakdown-5e88) ·
[Semgrep pricing](https://dev.to/rahulxsingh/semgrep-pricing-in-2026-open-source-vs-team-vs-enterprise-costs-3dic) ·
[View Transitions + scroll-driven animations](https://www.frontendhorizon.com/blog/view-transitions-api-and-css-scroll-driven-animations-the-browser-wins-of-2026) ·
[CSS scroll-driven animations guide](https://cssawwwards.com/blog/css-scroll-driven-animations-guide-2026) ·
[View Transition API — MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) ·
[Lenis](https://github.com/darkroomengineering/lenis) ·
[360 product viewers](https://www.glamar.io/blog/best-360-product-viewer) ·
[360 product view guide](https://acquireconvert.com/3d-photography/360-product-view/)

Earlier-session sources (LLM, image, video, 3D, browser, audio, embeddings, sandbox, hosting
pricing) are listed in full at the end of
[BUSINESSFORGE_2.0_CAPABILITY_ARSENAL.md](BUSINESSFORGE_2.0_CAPABILITY_ARSENAL.md).

---

_End. Nothing implemented. The repository, the n8n workflow, and the dependency tree are exactly
as they were found._
