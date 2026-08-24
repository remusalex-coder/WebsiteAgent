# BusinessForge 2.0 — Complete Capability & Provider Arsenal

> **⚠ HISTORICAL PLANNING DOCUMENT (2026-08-24 note).** Part of the pre-implementation
> `BUSINESSFORGE_2.0_*.md` design corpus. Design-input history, not current status.
> Current status: `docs/MASTER_INVENTORY.json` (machine-readable) and
> `docs/BUSINESSFORGE_FINAL_ARCHITECTURE.md` (canonical).

_Read-only research. Produced 2026-08-14. **No source file, configuration, n8n workflow, test,
snapshot, or dependency was modified, installed, or removed.** Nothing here was implemented. The
only thing written is this document._

Companion to [BUSINESSFORGE_2.0_MASTER_ARCHITECTURE.md](BUSINESSFORGE_2.0_MASTER_ARCHITECTURE.md),
which audits what the repository *is*. This document catalogues what it could *call*.

---

## 0. How to read this document

### 0.1 Price and availability reliability — read this before quoting a number

Every price below was gathered on **2026-08-14** through web search. The majority came from
**pricing-aggregator and SEO content sites, not from vendor pricing pages fetched directly**.
Those sites are frequently stale, occasionally wrong, and always secondary. Model catalogues in
this market change monthly — DeepSeek's off-peak discount ended, Alibaba's free developer tier
ended April 2026, Google stopped serving free Gemini CLI requests in June 2026, and Sora's API is
scheduled for discontinuation in September 2026, all within the last few months.

| Mark | Meaning |
|---|---|
| **[W]** | Web-searched this pass. Approximate. **Re-verify at the vendor before committing spend.** |
| **[K]** | From model knowledge, not verified this pass. Treat as a direction, not a number. |
| **[V]** | Verified in the BusinessForge repository this pass (file path given). |
| **[?]** | Unknown / could not be established. |

**No number in this document is a commitment. Every one is a starting point for a procurement
check.** Licensing terms in particular — the field that actually creates legal exposure — were
verified for only a handful of providers and are marked accordingly.

### 0.2 The two arsenals — a distinction the brief's provider list conflates

The requested list mixes two fundamentally different categories that must never share a budget,
a router, or a security posture:

| | **Workshop arsenal** | **Runtime arsenal** |
|---|---|---|
| **What it is** | Tools that *build and maintain BusinessForge* | Tools BusinessForge *calls per customer job* |
| **Who invokes it** | A human developer, or a coding agent under human supervision | The pipeline, autonomously, thousands of times |
| **Examples** | Claude Code, Codex, Gemini CLI, Antigravity, Cursor, E2B | Gemini API, FLUX, Playwright, axe-core, Cloudflare Pages |
| **Cost model** | Flat monthly seat | Per-job marginal cost — **this is the one that scales into a business risk** |
| **Failure impact** | A developer is slowed | A customer's website is wrong or absent |
| **Needs a router?** | No | **Yes — §7** |
| **Needs vendor redundancy?** | Nice to have | **Structural requirement** |

Roughly half the named providers (Claude Code, Codex, Gemini CLI, Antigravity) are **workshop
tools only**. They are catalogued (§2.9) and then excluded from the router, the cost matrix, and
the fallback matrix, because a coding agent is not a capability the product calls.

### 0.3 The four rules that decide every inclusion

Inherited from the architecture audit and non-negotiable here:

1. **A model names INTENT from a closed vocabulary; deterministic code executes it.** No provider
   that would have a model emit CSS, JS, GLSL, markup, or a business fact enters the runtime
   arsenal.
2. **No invented facts, and no invented depiction.** A generated photograph of a real business is
   the image equivalent of a fabricated testimonial. This single rule eliminates most of the
   image and nearly all of the video arsenal from the product path (§10.2).
3. **The deterministic floor always ships.** Every capability degrades to a €0 path that still
   produces a complete, working website. A provider with no degradation story is not adoptable.
4. **€0 before the first customer.** Paid capability is escalation, not baseline
   [memory: spend governance — a paid API needs a founder exception raised as a *proposed*
   decision, never assumed].

---

## 1. COMPLETE_CAPABILITY_MAP

Thirty-nine capabilities. **"In repo"** cites the existing seam — most are already reserved as
skill ids [V: `lib/platform/skills/builtin/`, 38 ids across 8 categories], which is why this
arsenal plugs in rather than bolts on.

| # | Capability | What it buys BusinessForge | In repo today | Path |
|---|---|---|---|---|
| C01 | **LLM / reasoning** | analyst, writer, director cabinet | ✅ 4 adapters [V: `lib/ai/providers/`] | CORE |
| C02 | **Structured generation** | closed-set directives that cannot drift | ✅ schema + `decodeAndValidate` [V: `lib/ai/schema.ts`] | CORE |
| C03 | **Coding agents** | building BusinessForge itself | — workshop only | WORKSHOP |
| C04 | **Autonomous agents** | multi-step research/repair without a human | ❌ | REJECT (§15) |
| C05 | **Research / web search** | competitor set, category conventions | 🟡 `web-search` placeholder | OPTIONAL |
| C06 | **Browser agents** | drive a page semantically, not by selector | ❌ | OPTIONAL |
| C07 | **Browser automation** | discovery, collection, screenshots, all QA | ✅ Playwright [V: `lib/browser.ts`] | CORE |
| C08 | **Image generation** | textures, patterns, abstract grounds — **never depiction** | 🟡 `image-generation` placeholder | OPTIONAL, constrained |
| C09 | **Image editing** | upscale, background removal, safe extension of the *business's own* photos | ❌ | CORE (2.0) |
| C10 | **Vector generation** | icons, marks, dividers at any scale, tiny bytes | ❌ | OPTIONAL — best value in the visual arsenal |
| C11 | **Video generation** | — | ❌ | REJECT for product (§15) |
| C12 | **Image-to-video** | a 3–5 s ambient hero loop from the business's own photo | ❌ | EXPERIMENTAL |
| C13 | **Video-to-video** | — | ❌ | REJECT |
| C14 | **3D generation** | — | ❌ | REJECT for product |
| C15 | **3D runtime** | Tier-3 immersive hosts | 🟡 one reference host [V: `lib/experience/`] | OPTIONAL, quarantined |
| C16 | **Motion / animation** | scroll choreography, transitions, micro-interaction | ✅ Tier-2 runtime [V: `lib/runtime/scroll-progress.ts`] | CORE |
| C17 | **Audio** | — | ❌ | REJECT |
| C18 | **Voice / TTS** | — (see §15 for why not on a small-business site) | 🟡 `speech` placeholder | REJECT for product |
| C19 | **OCR** | menu/price-list PDFs and photographed signage into evidence | 🟡 `ocr` placeholder | OPTIONAL — high evidence value |
| C20 | **Embeddings** | Design Fingerprint L3, evidence dedup | 🟡 `embeddings` placeholder | CORE (2.0) |
| C21 | **Reranking** | ordering evidence and competitor findings | ❌ | OPTIONAL |
| C22 | **Vision (descriptive)** | what is actually *in* the business's photographs | 🟡 `vision` placeholder | CORE (2.0) |
| C23 | **Visual judging** | is this distinct, is it premium | ✅ single critic [V: `lib/qa/visual-critic.ts`] | CORE |
| C24 | **Adversarial testing** | the strongest objection to an approved design | ❌ | CORE (2.0) |
| C25 | **Evaluation** | does the jury agree with humans | ❌ | CORE (2.0) |
| C26 | **UX testing** | does a visitor reach the phone number | 🟡 nav/CTA proof [V: `scripts/publish-run.ts`] | CORE |
| C27 | **Accessibility** | WCAG conformance, keyboard, contrast | 🟡 partial | CORE |
| C28 | **Performance** | Core Web Vitals budgets that fail the build | 🟡 loadMs only | CORE |
| C29 | **Security** | no inline handlers, no third-party scripts, no leaked keys | ✅ 5 shipped checks | CORE |
| C30 | **Sandboxing** | running untrusted code | ❌ — **and must stay ❌** | REJECT (§15) |
| C31 | **Storage / CDN** | serving the built site and its assets | ❌ | CORE (2.0) |
| C32 | **Deployment** | getting the site live | ❌ (`lovableAgent` throws) [V] | CORE (2.0) |
| C33 | **Observability** | traces, cost, latency, verdict history | ✅ NDJSON + telemetry [V: `lib/platform/telemetry.ts`] | CORE |
| C34 | **Model routing** | pick the right model per task, fall back | 🟡 static per-stage env | CORE (2.0) |
| C35 | **Agent routing** | pick the right *agent*, run several in parallel | 🟡 fixed stage order | CORE (2.0) |
| C36 | **Workflow orchestration** | sequence stages, close the loop, survive restarts | ✅ n8n + in-process fallback [V] | CORE |
| C37 | **Memory** | what have we already built, and how different is this | 🟡 `peers.json` only | CORE (2.0) |
| C38 | **Design intelligence** | the reference corpus that calibrates taste | ✅ 3 research docs [V: `docs/`] | CORE |
| C39 | **Competitor research / analytics / SEO / localization / asset optimization** | positioning, discoverability, weight | 🟡 partial (`ro`/`en` shipped) | OPTIONAL |

---

## 2. PROVIDER_CATALOG

Classification per the brief: **CORE** (product depends on it) · **OPTIONAL** (earns its place
for specific jobs) · **FALLBACK** (exists to be second) · **EXPERIMENTAL** (evaluate, do not
depend) · **REJECT** (do not adopt, with reason).

### 2.1 C01/C02 — LLM and structured generation

#### Google Gemini — **CORE (the €0 default)**

| Field | Value |
|---|---|
| Capability | reasoning, structured output, long context, vision, image gen |
| Product / API | Gemini Developer API (`generativelanguage.googleapis.com`); adapter exists [V: `lib/ai/providers/gemini.ts`] |
| Docs | `ai.google.dev/gemini-api/docs` |
| Availability | GA; free tier confirmed live in 2026 [W] |
| Free tier | **Yes — the only frontier-class free tier.** ~5 RPM / 100 req-day (Pro), 10 RPM / 250 (Flash), 15 RPM / 1,000 (Flash-Lite), 250k TPM shared [W] |
| Cost | ~$1.25 / $10 per M (2.5 Pro); Flash ~$0.15 in [W] |
| Quality | frontier-adjacent on reasoning; strong at long context |
| Latency | Flash-class sub-second TTFT; Pro seconds [K] |
| Rate limits | per **Cloud project**, not per key [W] — matters for parallelism (§9) |
| Licensing | standard commercial API terms; free-tier data-use terms differ from paid — **[?] verify before customer data flows through the free tier** |
| API | yes, native JSON schema [V] |
| Automation | excellent |
| Self-hosted alt | Gemma family locally |
| Fallback | DeepSeek → OpenRouter free pool → deterministic floor |
| Strengths | genuinely free at useful volume; native schema; huge context |
| Weaknesses | **thinking counts against `maxOutputTokens`** — a budget at or below the thinking budget returns `MAX_TOKENS` with no JSON at all [V: `lib/config.ts:180-186`]; free-tier RPD is small; catalogue churn (the repo's adapter still declares a stale `gemini-2.5-pro` default) [V: `lib/ai/providers/gemini.ts:178`] |
| **BF suitability** | **The default for every closed-set director call and for the €0 baseline.** Already wired. |

#### Anthropic Claude — **CORE (quality escalation)**

| Field | Value |
|---|---|
| Product / API | Messages API; adapter exists [V: `lib/ai/providers/anthropic.ts`] |
| Free tier | **No** |
| Cost [W] | Opus 5 ~$5/$25 per M; Sonnet 5 ~$2/$10; Haiku 4.5 ~$1/$5; Fable 5 ~$10/$50. Batch halves; prompt caching cuts cached input ~90% |
| Quality | top tier for long-form prose and instruction adherence |
| Rate limits | tier-based on spend [K] |
| Licensing | commercial API terms; customer owns outputs [K] |
| Self-hosted alt | none |
| Fallback | GPT-5.x → Gemini Pro → DeepSeek |
| Strengths | the writer stage is the one place model quality is visible to the paying customer; caching fits BusinessForge's repeated system prompts exactly |
| Weaknesses | no free tier; treats `max_tokens` truncation as a **failed run** [V: `anthropic.ts:152`] — correct, but it means budgets must be generous |
| **BF suitability** | **Writer + Creative Director when a customer is paying.** Not for enum selection — wasteful. |

#### OpenAI — **CORE (second opinion / cross-vendor jury)**

| Field | Value |
|---|---|
| Product / API | Chat Completions + Responses; adapter exists [V] |
| Free tier | no |
| Cost [W] | GPT-5 ~$1.25/$10; GPT-5.6 Terra ~$2/$12; Luna ~$0.20/$1.20 (cut 80% on 30 July 2026); Sol ~$5/$30, rising to ~$10/$45 on long context |
| Quality | frontier; strong structured output |
| Licensing | commercial; customer owns outputs [K] |
| Fallback | Anthropic → Gemini |
| Strengths | **Luna's price after the July cut makes it a serious cheap-enum-selector**; the vision endpoint the repo already speaks is OpenAI-shaped [V: `lib/qa/visual-critic.ts:176`] |
| Weaknesses | long-context surcharge is a silent cost multiplier; catalogue moves fast |
| **BF suitability** | **The second vendor.** The Adversarial Critic must not share a vendor with the Creative Director (§8.4); this is the natural counterpart to Anthropic. |

#### DeepSeek — **CORE (cost floor for volume reasoning)**

| Field | Value |
|---|---|
| Cost [W] | V4-Flash ~$0.14 in / $0.28 out per M; **cache hit ~$0.0028** (~98% off); V4-Pro ~$0.435/$0.87 |
| Free tier | no (off-peak discount **ended Sept 2025**; a 2× *peak surcharge* policy is announced without an effective date) [W] |
| Quality | strong reasoning per dollar; open weights lineage |
| Licensing | commercial API; **data residency is China — a real consideration for EU SMB customer data [?]** |
| Self-hosted alt | yes, open weights |
| Fallback | Qwen → GLM → OpenRouter free |
| Strengths | order-of-magnitude cheaper than frontier for equal-enough enum work; cache pricing suits a repeated system prompt |
| Weaknesses | jurisdiction; latency variance; announced peak surcharge |
| **BF suitability** | **CORE for the director cabinet's cheap calls, subject to a data-residency decision.** Never for anything containing customer PII until §12.4 is settled. |

#### OpenRouter — **CORE (the anti-lock-in layer)**

| Field | Value |
|---|---|
| Product | one OpenAI-compatible endpoint over hundreds of models; adapter exists [V] |
| Free tier | **yes** — 28+ `:free` model ids; 50 req/day at <$10 lifetime credit, **1,000/day once $10 has ever been purchased**; 20 RPM on free variants [W] |
| Cost | pass-through + margin |
| Quality | equals the underlying model |
| Licensing | inherits the upstream model's terms — **this is the trap: a `:free` model may carry non-commercial weights** [?] |
| Weaknesses | `supportsNativeSchema: false` [V: `openrouter.ts:82`] so schema is enforced post-hoc; free lineup is a moving target; an extra hop of latency |
| **BF suitability** | **The failover bus and the free-tier stacking layer.** The $10 one-time purchase unlocking 1,000 free req/day is the single highest-leverage €10 in this entire document. |

#### Qwen / Alibaba — **FALLBACK**

Cost [W]: Qwen3.7 Flash ~$0.03 in / $0.13 out per M — among the cheapest credible models
anywhere. Free tier: **1M tokens per model, 90 days, Singapore endpoint only**; the old free
developer tier ended 15 April 2026 [W]. Open weights available for self-hosting. Same
jurisdiction consideration as DeepSeek. **Use as the third cheap-reasoning option and as a
self-hosted target.**

#### Moonshot Kimi — **FALLBACK**

Cost [W]: K2.6 ~$0.95/$4.00; K2.5 ~$0.60/$3.00; K3 (July 2026) ~$3/$15. Long-context and agentic
strengths. **Adopt only if a specific task beats Gemini/DeepSeek on a measured benchmark** —
otherwise it is a fourth option for a slot that needs two.

#### Zhipu GLM — **FALLBACK**

Cost [W]: GLM-5.2 ~$1.40/$4.40; GLM-4.5-Air ~$0.27 combined. Open weights on several models.
Coding-plan subscriptions ~$10–80/mo. **Same verdict as Kimi: a credible fourth, not a third.**

#### Mistral — **OPTIONAL (EU jurisdiction)**

The **only** frontier-adjacent lab in this list with an EU home. For a platform selling to
Romanian and other EU small businesses, **jurisdiction is a feature, not a footnote** — it is
the answer to "where does my customer's data go" without a transfer-mechanism argument. Also
ships the best-value OCR (§2.6). **Adopt when the first customer asks the GDPR question.**

#### Meta Llama — **OPTIONAL (self-hosting target)**

Open weights, permissive-ish community licence (**[?] verify the current version's terms and the
monthly-active-user threshold**). Not an API vendor — a *deployment option*. Its role is to make
"we could run this ourselves" true, which is what actually caps a vendor's pricing power.

#### xAI Grok — **EXPERIMENTAL**

No property BusinessForge needs that three other vendors lack. Real-time-feed strengths are
irrelevant to a bakery's website. **Do not adopt without a specific measured win.**

#### Hugging Face — **OPTIONAL (models and weights, not inference)**

Free tier is now **<$0.10/month in inference credits**; PRO ($9/mo) gets ~$2/month [W]. As an
*inference* provider it is not competitive. As the **registry of open weights, datasets, and
evaluation harnesses** it is unmatched and free. **Use it for what it is: where you get models,
not where you run them.**

---

### 2.2 C05/C06 — research, search, browser agents

| Provider | Class | Free tier [W] | Cost [W] | Notes for BF |
|---|---|---|---|---|
| **Tavily** | OPTIONAL | 1,000 req/mo | ~$5–8 / 1k | Agent-shaped results; being acquired by Nebius [W] — continuity risk |
| **Exa** | OPTIONAL | $10 credit | ~$7/1k + $1/1k contents | Semantic/neural search — best fit for "find businesses whose site feels like X" |
| **Serper** | FALLBACK | 2,500 one-time | ~$1/1k → $0.30/1k | Cheapest raw SERP at volume |
| **Brave Search API** | FALLBACK | **no free tier anymore** [W] | — | Independent index; the free tier's disappearance is exactly why the router must not hard-code a vendor |
| **Firecrawl** | OPTIONAL | credit-based [K] | per page [K] | Already a reserved skill id [V]; crawl-to-markdown |
| **Bright Data** | REJECT (for now) | no | paid | Only if a target proves genuinely unscrapeable. Playwright handles Maps and Instagram today. |
| **Browserbase** | FALLBACK | 3 concurrent / 1 browser-hour [W] | $20/mo dev (25 concurrent, 100 hrs), $99 startup; overage $0.10–0.12/hr [W] | **The parallelism escape hatch** (§9.4): when 3 battle candidates × 2 viewports exceed local CPU |
| **Stagehand** | OPTIONAL | open source | free | `act`/`extract`/`observe` over Playwright. Genuinely useful for *evidence collection* on unknown sites — a semantic "find the menu" beats a selector that rotates. **Never for QA measurement**, which must stay deterministic. |

**Position:** search is **not** on the critical path. BusinessForge's evidence comes from the
business itself, not from the web at large. Search earns its place only for competitor research
(§2.13), and 1,000 free Tavily calls per month covers early volume entirely.

---

### 2.3 C07 — browser automation

#### Playwright — **CORE, and effectively irreplaceable**

Already the platform's eyes: discovery, collection, Instagram, every screenshot, every browser QA
check [V: `lib/browser.ts`, `package.json`]. Free, open source, local, deterministic. Its one real
constraint is that `node_modules` is **host-platform-specific**, which is precisely why n8n calls
the host over HTTP rather than running stages in its Linux container [V: `n8n/README.md:33-36`].

**Fallback:** none, and none is needed — a headless Chromium is not a vendor. Puppeteer is a
lateral move; Selenium is a downgrade.

**The capture technique is a hard-won asset, not a detail** [V]: strip `loading="lazy"`, await
every `image.decode()`, then grow the viewport to full height — never `fullPage: true`, which
re-runs lazy heuristics after decode and captures a blank band that looks exactly like broken
CSS. It is currently copy-pasted across four files (defect D1 in the architecture audit).

---

### 2.4 C08/C09/C10 — image generation, editing, vector

**The governing constraint, restated because it eliminates most of this category:** BusinessForge
sells websites for *real* businesses. A generated photograph of a bakery that is not that bakery
is a fabricated fact wearing a picture. The no-invented-facts rule that governs testimonials
[V: `docs/architecture.md:136-153`] governs imagery identically.

**Therefore three permitted uses, and only three:**

- **(A) Non-depictive assets** — textures, grain, gradients, abstract grounds, patterns. Nothing
  that asserts anything about the business.
- **(B) Editing the business's own photographs** — upscale, denoise, background removal,
  crop-safe outpainting for a full-bleed hero. The subject remains real.
- **(C) Vector marks** — icons, dividers, a placeholder wordmark. Structural, not depictive.

| Provider | Class | Cost/image [W] | Licensing | BF fit |
|---|---|---|---|---|
| **Recraft** | **OPTIONAL — best value here** | $0.04 raster / **$0.08 vector**; Recraft 20B $0.022/$0.044; vectorization $0.01; erase region $0.002; crisp upscale $0.004 | commercial on paid API [?] | **True SVG output** is unique and exactly right for a site that ships tiny, scalable, theme-recolourable marks. Use (C), and its cheap erase/upscale for (B). |
| **FLUX (Black Forest Labs)** | **OPTIONAL** | FLUX.2: Klein ~$0.014–0.015, Pro ~$0.03, Flex ~$0.05, Max ~$0.07 | **Pro tier via BFL API carries a full commercial licence; the default open-weight path is NON-commercial, with separate commercial open-weight licences available** [W] — a genuine trap for anyone self-hosting `-dev` weights | Use (A) textures. **If self-hosting FLUX weights, the licence must be checked before a single customer site ships.** |
| **Adobe Firefly** | **OPTIONAL — the indemnified option** | Premium from ~$4.99/mo; API priced on call volume + generative credits [W] | **Trained on licensed/public-domain content; Adobe offers IP indemnification on paid plans; free tier has limited commercial use** [W] | The **only** provider here that answers "what if we get sued" with a contract. If depictive generation ever becomes necessary despite rule 2, this is the only defensible source. |
| **Google Imagen / Nano Banana** | **FALLBACK** | Imagen 4 Fast $0.02 / Standard $0.04 / Ultra $0.06; Nano Banana Pro ~$0.13–0.24; 3.1 Flash Image ~$0.045–0.15 [W] | standard Google terms [?] | Already inside the CORE vendor; cheapest flat per-image price. Good (A) fallback with zero new vendor. |
| **Ideogram** | FALLBACK | Turbo $0.03 / Default $0.06 / Quality $0.10 [W] | [?] | Best-in-class **text rendering inside images** — narrow but real if a signage mock is ever needed |
| **Stability AI** | EXPERIMENTAL | [?] | membership/self-host terms have shifted repeatedly [?] | Self-hostable, but licence churn is a liability for a commercial pipeline |
| **fal.ai** | **OPTIONAL — aggregator** | $0.003–0.15/image; GPU-second option (H100 ~$1.89/hr) [W] | inherits model terms | **600+ models behind one API** — the anti-lock-in layer for images, exactly as OpenRouter is for text. 30–50% cheaper than Replicate [W] |
| **Replicate** | FALLBACK — aggregator | $0.003–0.12/image [W] | inherits model terms | Bigger docs, **20–60 s cold starts on idle models that you also pay for** [W] — disqualifying for an interactive loop, acceptable for batch |

**Verdict for the arsenal:** one aggregator (**fal.ai**) + one vector specialist (**Recraft**) +
the image models already inside Gemini. That is three relationships covering all three permitted
uses, with FLUX and Firefly held as named escalations.

---

### 2.5 C11–C14 — video and 3D generation

Researched in full because the brief asked. **Verdict: REJECT for the product path.** The
reasoning is a business argument, not a technical one, and it applies to every provider in the
category:

1. **The business has no footage.** Generated video of a real venue is rule 2's violation at 24
   frames per second.
2. **Video is a Core Web Vitals liability.** A hero video is the single heaviest thing a small
   business site can ship, on a page whose visitors are frequently on mobile data looking for a
   phone number.
3. **Cost per second, forever.** At $0.03–0.40/sec [W], a 6-second loop costs $0.18–2.40 *per
   regeneration*, and the reconcept loop regenerates.
4. **Nothing in the deterministic design layer consumes video.** There is no `video` capability in
   `WebsiteDesign` [V] and adding one buys a section kind that a photograph already serves.

| Provider | Class | Price [W] | Note |
|---|---|---|---|
| Google **Veo 3.1** | EXPERIMENTAL | $0.40/s std, $0.15/s fast, Lite $0.03–0.05/s | Only model shipping **native audio**; already inside a CORE vendor |
| **Kling 3.0** | REJECT | ~$0.029–0.112/s | Best price/quality, still rule 2 |
| **Seedance 2.0** | REJECT | ~$0.09–0.14/s | — |
| **Runway Gen-4.5** | REJECT | ~$0.15–0.20/s | Strongest editing/vid-to-vid; irrelevant here |
| **Sora** | **REJECT — discontinuing** | — | Consumer app retired April 2026; **API discontinuation scheduled 24 Sept 2026** [W]. A textbook argument for the router: any single-provider dependency can be switched off by its vendor. |
| **Luma / Pika** | REJECT | — | API available; no differentiator for this product |
| **Higgsfield** | EXPERIMENTAL | subscription aggregator | Shipped an MCP server April 2026 exposing 30+ image/video models through one endpoint [W]. **If video is ever needed, adopt the aggregator, never a single video vendor.** |
| **Meshy / Tripo** | REJECT for product | ~$0.01/credit, 2,000 free credits; Meshy Pro $20/mo [W] | 3D *generation* has no consumer in the pipeline. A generated 3D loaf is `lib/experience/`'s hand-authored SDF, which the architecture explicitly refuses to generalize [V] |
| **Spline** | EXPERIMENTAL | — | Design-tool-to-web-3D. Only relevant if Tier 3 is ever productised |

**The one exception worth keeping alive:** C12 image-to-video, applied to **the business's own
photograph**, producing a 3-second ambient loop (steam, light drift, no motion of people). That
is (B)-class editing, not fabrication. **EXPERIMENTAL**, gated behind a measured CWV budget and
`prefers-reduced-motion`, and only after a customer asks.

---

### 2.6 C16 — motion and animation runtime

| Provider | Class | Licence | Cost | BF fit |
|---|---|---|---|---|
| **CSS + the in-repo runtime** | **CORE** | own code | €0 | `lib/runtime/scroll-progress.ts` + `runtime-rules.ts` [V] already deliver scroll progress, per-section visibility, a pinned cinematic hero, and continuous world crossing — gated on `prefers-reduced-motion` and pointer type. **This is the floor and it is already built.** |
| **GSAP** | **OPTIONAL — strong** | **100% free including commercial use, all former Club plugins included, since Webflow's April 2025 change** [W] | €0 | The licensing objection that historically blocked GSAP is **gone**. ScrollTrigger and SplitText map directly onto capabilities the design layer already names (`transition`, per-beat typography). ~$0 cost, ~50 KB weight — the trade is bytes, not money. |
| **Motion / Framer Motion** | OPTIONAL | MIT | €0 | Only if a React runtime ever exists. The renderer emits static HTML [V] — it does not. |
| **Rive** | EXPERIMENTAL | free tier + paid plans [?] | — | Real interactive state-machine animation, tiny runtime. Requires **authored** `.riv` files — there is no derivation path from business evidence, so it cannot be generated per business. A designer-in-the-loop product, not an autonomous one. |
| **Lottie** | OPTIONAL | open source (lottie-web MIT) | €0 | Same authoring problem as Rive, but a small library of *generic* platform animations (loading, check, arrow) is derivable and reusable. Low value, low risk. |
| **Three.js / React Three Fiber** | OPTIONAL (Tier 3 only) | MIT | €0 | The runtime for a specialized host. `lib/experience/` proves it works [V]. **Do not generalize** — anti-pattern per the architecture. R3F additionally requires React, which the renderer does not use. |

**Verdict:** CSS + own runtime is CORE. **GSAP is the one genuinely tempting addition** — free,
commercially clear, and directly aligned with named capabilities. Adopt only when a `transition`
value exists that CSS demonstrably cannot express.

---

### 2.7 C17/C18 — audio and voice

**ElevenLabs — REJECT for the product path, catalogued for completeness.**

Free tier 10k credits/mo (~10 min TTS) but **audio generated on the free plan cannot be used in
monetized or commercial work and requires attribution**; commercial licence begins at Starter
$6/mo; API ~$0.05–0.12 per 1k characters [W]. Technically excellent.

**Why reject:** a local business website with audio is a usability defect, not a feature.
Autoplay is an accessibility violation and a browser-blocked behaviour; a play button nobody
presses is dead weight. There is no beat in any `ExperienceScript` [V] that audio serves.

**The one non-product use — OPTIONAL:** narrated walkthroughs of a delivered site as a *sales*
artifact. That is marketing spend, not runtime capability, and belongs to a different budget.

---

### 2.8 C19–C22 — OCR, embeddings, reranking, vision

| Provider | Capability | Class | Cost [W] | BF fit |
|---|---|---|---|---|
| **Mistral OCR** | C19 | **OPTIONAL — high value** | OCR 4 ~$4/1k pages ($2 batch); OCR 3 ~$2/1k ($1 batch); 170 languages, bounding boxes, confidence, markdown out | A restaurant's PDF menu is often **the richest evidence that exists** about what it sells. At ~$0.002–0.004 per page, one menu costs a fraction of a cent and can double a page's specificity. |
| **Docling** | C19 | **OPTIONAL — the €0 path** | MIT, local | PDF/DOCX/PPTX/XLSX/HTML/images with a pluggable OCR engine [W]. **Try this first; it is free and local.** |
| **Tesseract / Surya** | C19 | FALLBACK | free, local | Lower quality on layout; fine for signage snippets |
| **Google Document AI** | C19 | REJECT | ~$5/1k pages [W] | More expensive than Mistral with GCP operational overhead |
| **Local embeddings (BGE / E5 / MiniLM via ONNX)** | C20 | **CORE** | €0, local | Design Fingerprint L3 runs on ~50–500 MB of local model. **No vendor needed.** |
| **Google embeddings** | C20 | FALLBACK | ~$0.006/M or free-tier [W] | Zero new vendor |
| **OpenAI `text-embedding-3-small`** | C20 | FALLBACK | $0.02/M ($0.01 batch) [W] | — |
| **Voyage** | C20 | OPTIONAL | $0.06/M (v4), $0.12 (large); **200M free tokens for new accounts** [W] | Best-in-class retrieval quality; the free grant covers far more than BusinessForge will ever embed |
| **Jina v3** | C20 | FALLBACK | $0.02/M, 32× longer docs [W] | — |
| **Cohere Rerank** | C21 | OPTIONAL | ~$2.00/1k searches; embed $0.02–0.10/M; **1,000 free trial calls/mo** [W] | Reranking matters only if evidence volume grows past what a plain sort handles. Not yet. |
| **Vision (descriptive) via Gemini/Claude/GPT** | C22 | **CORE** | per-token with images | Feeds `subjectOf` the attributes the contract already anticipates — the Director's schema was **deliberately shaped so vision-derived `visual category / atmosphere / brightness / quality` can be appended without changing it** [V: `agents/designDirectorAgent.ts:349-354`] |
| **Local VLM (Qwen-VL / Llava class)** | C22 | OPTIONAL | €0, local | The €0 path for image attributes; slower, weaker, sufficient for coarse tags |

---

### 2.9 C03 — coding agents (WORKSHOP ONLY, excluded from the router)

| Tool | Class | Cost [W] | Note |
|---|---|---|---|
| **Claude Code** | **WORKSHOP — CORE** | **no free tier**; Pro $20/mo minimum, Max $100–200 | The tool this repository is being built with. Terminal-native, subagents, strong on large refactors. |
| **OpenAI Codex** | WORKSHOP — OPTIONAL | Free/Go $8/Plus $20/Pro $100–200; moved from per-message limits to **credits tracking API tokens** in April 2026 | A credible second opinion on the same codebase |
| **Gemini CLI** | WORKSHOP — FALLBACK | **Google stopped serving free CLI requests 18 June 2026**; now Antigravity on a smaller quota, or pay via API key | The free-CLI era ended; plan accordingly |
| **Google Antigravity** | WORKSHOP — EXPERIMENTAL | free tier with **weekly agent-request limits**, multiple frontier models incl. Gemini and Claude; Pro $19.99, Ultra $99.99+ | Quota "tightened repeatedly since launch" [W] — usable, not dependable |
| **Cursor / Windsurf / Cline / Aider** | WORKSHOP — OPTIONAL | ~$20/mo anchor; Aider is free/OSS | Editor-centric alternatives; Aider is the €0 option |
| **Devin and autonomous SWE agents** | **REJECT** | — | §15 |

**Architectural note:** none of these appears in §4–§7. A coding agent is not a capability the
product calls, and mixing them into the runtime cost model would make a €20 seat look like a
per-job cost.

---

### 2.10 C26–C29 — UX, accessibility, performance, security tooling

| Tool | Capability | Class | Cost | Note |
|---|---|---|---|---|
| **Playwright assertions** | C26 | **CORE** | €0 | Already proves navigation *by clicking it* and CTA targets resolve [V: `publish-run.ts:168-193`] |
| **axe-core** | C27 | **CORE** | €0, MPL-2.0 | The industry-standard rule engine; injects into the Chromium already running. **The single highest-value free addition in this document.** |
| **Pa11y** | C27 | FALLBACK | €0 | CLI wrapper, HTML CodeSniffer ruleset |
| **IBM Equal Access** | C27 | OPTIONAL | €0 | Different ruleset — useful precisely because it disagrees with axe sometimes |
| **Lighthouse** | C28 | **CORE** | €0 | Perf/a11y/SEO/best-practices in one pass, drivable via the existing CDP session |
| **Unlighthouse** | C28 | OPTIONAL | €0 | Site-wide Lighthouse; irrelevant for single-page output |
| **WebPageTest** | C28 | OPTIONAL | free tier + paid | Real-device/network truth. Worth one manual run per template class, not per job. |
| **Semgrep** | C29 | OPTIONAL | free OSS tier | Static analysis of BusinessForge's *own* code — workshop, not runtime |
| **gitleaks / trufflehog** | C29 | **CORE (workshop + gate)** | €0 | Directly answers the Places-key-in-artifact failure class [V: `docs/architecture.md:120-125`] |
| **OSV-Scanner / Trivy** | C29 | OPTIONAL | €0 | Dependency CVEs — the repo has only 2 runtime dependencies [V: `package.json`], so the surface is genuinely small |
| **OWASP ZAP** | C29 | REJECT | €0 | A DAST scanner against a static HTML file with no server, no forms, and no scripts finds nothing. Wrong tool for this artifact. |

---

### 2.11 C30 — sandboxing

**E2B** (Hobby free, one-time $100 credit, 20 concurrent, ~$0.0504/vCPU-hr) · **Daytona** (free
tier, $200 compute credit, per-second) · **Modal** (~$0.00003942/core/s, only one with GPU-in-
sandbox) · **Vercel Sandbox** [W].

**Class: REJECT for the product path — and this is a positive architectural statement.**

Sandboxing exists to run code you do not trust. BusinessForge's entire invariant is that
**no model ever emits executable code** [V]. If a sandbox becomes necessary, it means the
invariant has been broken, and the correct response is to restore the invariant, not to contain
the blast radius.

**OPTIONAL for the workshop only:** running a coding agent's tests in isolation. E2B's free tier
covers that entirely.

---

### 2.12 C31/C32 — storage, CDN, deployment

| Provider | Class | Free tier [W] | Note |
|---|---|---|---|
| **Cloudflare Pages** | **CORE** | 500 builds/mo; **effectively unlimited bandwidth for normal web assets** (ToS forbids hosting video/large files; 512 MB per-file cache limit) | The natural replacement for the rejected Lovable target. Git push → live, byte-identical to what QA approved. |
| **Cloudflare R2** | **CORE (assets)** | 10 GB storage, 1M Class-A ops, 10M Class-B ops/mo, **zero egress fees** | Zero egress is the property that matters — image-heavy sites are egress-heavy |
| **Cloudflare Images** | OPTIONAL | **no free tier**; 5,000 free transformations, then ~$0.50/1k; storage ~$5/100k/mo, delivery ~$1/100k/mo | Only if on-the-fly variants beat build-time `sharp`. They probably do not — see §10.4 |
| **Netlify / Vercel** | FALLBACK | free tiers with bandwidth caps [K] | Second and third hosts. **Keep the deploy adapter generic** so the host is one config value. |
| **GitHub Pages** | FALLBACK | free for public repos | Zero-dependency emergency host |
| **S3 + CloudFront** | OPTIONAL | 12-mo free tier | Only at enterprise scale; egress pricing is the reason not to start here |
| **Lovable** | **REJECT** | — | Already rejected in the architecture audit: a prompt-driven site builder re-introduces model-authored markup into a pipeline built to eliminate it. `lovableAgent.run()` throws today [V]. |

---

### 2.13 C38/C39 — design intelligence, competitor research, analytics, SEO, localization, optimization

| Source / tool | Capability | Class | Cost | Note |
|---|---|---|---|---|
| **The three in-repo research documents** | C38 | **CORE** | €0 | `Design_Intelligence_Foundation.md`, `AWWWARDS_PATTERN_LIBRARY.md` (25 teardowns, patterns P-001…P-018), `From_Business_Evidence_to_Creative_Direction.md` [V]. **This is the calibration set. It is already owned, already read, and already doctrine.** |
| **Awwwards / Godly / Land-book / Mobbin** | C38 | OPTIONAL | free browse | Reference corpus refresh. **Patterns are vocabulary, never templates** — the anti-clone rules are already codified [V] |
| **HTTP Archive / CrUX** | C38 | OPTIONAL | free, BigQuery | Real-world distributions of page weight and CWV by category — the honest baseline for a performance budget |
| **SimilarWeb / BuiltWith / Wappalyzer** | C39 competitor | OPTIONAL | free tiers → paid | Wappalyzer-class tech detection runs locally off the HTML the collector already has. **Build, do not buy.** |
| **DataForSEO / Serper** | C39 SEO | OPTIONAL | ~$1/1k and down | Only when a customer buys ranking, not a website |
| **Ahrefs / Semrush** | C39 SEO | REJECT | $100+/mo | Enterprise SEO suites for a platform that does not sell SEO |
| **Plausible / Umami / Cloudflare Web Analytics** | C39 analytics | **OPTIONAL — Cloudflare version is CORE-adjacent** | Umami self-host €0; CF Web Analytics free | **Cloudflare Web Analytics is the only one that does not violate `security.no-external-scripts`** [V: `publish-run.ts:298`] — it is server-side and cookieless. Any JS tag breaks a shipped gate. |
| **Google Analytics** | C39 | **REJECT** | free | Third-party script + consent banner + GDPR exposure, on a site whose selling point is that it is clean and fast |
| **DeepL** | C39 localization | OPTIONAL | free tier ~500k chars/mo [K] | Best MT quality for EU languages |
| **In-repo lexicon** | C39 localization | **CORE** | €0 | `en`/`ro` closed set, **evidence is never translated** [V: `lib/content/language.ts`]. The rule is right: translating a business's own words invents a voice it does not have. |
| **sharp** | C39 optimization | **CORE** | €0, libvips | AVIF/WebP, responsive sets, at build time. Non-negotiable for image-heavy pages. |
| **ffmpeg** | C39 | OPTIONAL | €0 | Only if C12 is ever adopted |
| **gltf-transform + Draco/Meshopt** | C39 | OPTIONAL | €0 | Tier-3 only |
| **svgo** | C39 | **CORE** | €0 | Pairs with Recraft vector output |

---

## 3. MODEL_CATALOG

Model **classes**, not fixed ids — ids churn monthly and the router (§7) resolves them at call
time from a config table.

| Task class | What it must do | Primary [W] | Second | Third / €0 | Effort |
|---|---|---|---|---|---|
| **T1 Analyst** | reason over messy evidence, cite it | Gemini 2.5/3.x Pro | GPT-5 | DeepSeek V4-Pro | high |
| **T2 Writer** | prose a customer will read, in `ro` or `en` | Claude Sonnet 5 / Opus 5 | GPT-5.6 Terra | Gemini Pro (free tier) | high |
| **T3 Creative Director** | conceptual leap, N diverse candidates | Claude Opus 5 | GPT-5.6 Sol | Gemini Pro | high + diversity |
| **T4 Enum directors** (Art/UX/Motion/Asset) | pick from 2–11 values, one sentence why | **GPT-5.6 Luna (~$0.20/$1.20)** | Gemini Flash-Lite (free) | DeepSeek V4-Flash | medium |
| **T5 Visual Jury A** | pairwise screenshot comparison | Gemini vision | — | — | medium |
| **T6 Visual Jury B** | same, **different vendor** | GPT vision | Claude vision | — | medium |
| **T7 Adversarial Critic** | strongest objection; **must differ from T3's vendor** | whichever of GPT/Gemini T3 did not use | — | — | high |
| **T8 Vision attributes** | describe the business's own photos | Gemini Flash | local VLM | — | low |
| **T9 Embeddings** | fingerprint L3 | **local BGE/E5** | Voyage (200M free) | Google | — |
| **T10 OCR** | menu/price list → markdown | **Docling (local, €0)** | Mistral OCR 3/4 | Tesseract | — |
| **T11 Technical Architect** | feasibility | **no model — deterministic** | — | — | — |

**Selection rules encoded in the router:**
- **Cross-vendor constraint:** T3 and T7 must never resolve to the same vendor; T5 and T6 must
  never resolve to the same vendor. Self-enhancement and position bias are documented, systematic,
  and cheapest to defeat structurally [V: `design_evaluation_research.json`, topic (d)].
- **Never route T4 to a frontier model.** Selecting from an enum is the cheapest work in the
  system and the easiest place to waste 20× the money.
- **Effort ceiling on Gemini:** `maxOutputTokens` must stay well above the thinking budget
  (4,096 at `medium`, 24,576 at `xhigh`) or the call returns no JSON at all [V].

---

## 4. COST_MATRIX

Per **one delivered website**, at listed rates [W], excluding retries. Token estimates derive
from the repo's configured budgets [V: `lib/config.ts:249-314`]: analyst 32k max out / 4k page
chars, writer 24k / 6k, director 12k / 2k.

### 4.1 Text stages

| Stage | ~In | ~Out | Gemini free | DeepSeek Flash | GPT Luna | Claude Sonnet 5 | Claude Opus 5 |
|---|---|---|---|---|---|---|---|
| Analyst | 15k | 6k | **€0** | ~$0.004 | ~$0.010 | ~$0.090 | ~$0.225 |
| Writer | 20k | 12k | **€0** | ~$0.006 | ~$0.018 | ~$0.160 | ~$0.400 |
| Creative Director ×3 | 3×8k | 3×3k | **€0** | ~$0.006 | ~$0.016 | ~$0.138 | ~$0.345 |
| 4 enum directors | 4×6k | 4×1k | **€0** | ~$0.005 | ~$0.010 | — | — |
| **Text subtotal** | | | **€0** | **~$0.02** | **~$0.054** | ~$0.39+ | ~$0.97+ |

### 4.2 Vision stages

| Stage | Calls | Note | Est. [W] |
|---|---|---|---|
| Visual Jury, 3 candidates | 3 pairs × 2 orders × 2 judges = **12 max** | Round-1 elimination typically leaves 2 survivors → **4 calls** | ~$0.02–0.12 |
| Adversarial Critic | 1 (winner only) | 2 images | ~$0.01–0.03 |
| Vision attributes | 1 per business | batched images | ~$0.005 |

### 4.3 Non-model per-site costs

| Item | Cost | When |
|---|---|---|
| Playwright / all QA | **€0** | always |
| Fingerprint L1 + L2 | **€0** | always |
| Local embeddings (L3) | **€0** | always |
| Hosting (Cloudflare Pages + R2) | **€0** within free tier | always |
| Places API | ~**$0.01/business** [V: `.env.example:150-152`] | only when reviews are bought |
| OCR (Docling) | **€0** | menus |
| OCR (Mistral) | ~$0.002–0.004/page | only if Docling fails |
| Vector marks (Recraft) | ~$0.08/vector | rarely |
| Texture (Imagen 4 Fast) | ~$0.02/image | rarely |

### 4.4 Total per site, by tier

| Tier | Composition | Marginal cost |
|---|---|---|
| **T0 Free floor** | fully deterministic: compose → design → render → QA | **€0.00** |
| **T1 Standard** | + analyst + writer on Gemini free tier | **€0.00** (RPD-limited) |
| **T1-paid** | analyst + writer on DeepSeek | **~$0.01** |
| **T2 Directed** | + cabinet on cheap models | **~$0.02–0.06** |
| **T3 Battle** | + 3 candidates + jury + adversarial | **~$0.08–0.20** |
| **T3-premium** | writer + Creative Director on Claude Opus | **~$1.00–1.50** |
| **T4 Licensed** | any + Places | **+$0.01** |

**The number that matters:** a full Design Battle with a jury lands around **€0.10–0.20 per
website**, and a premium build around **€1.00–1.50**. Against any plausible price for a small
business website, model cost is not the constraint. **Rate limits and latency are.** That is why
§9 is about parallelism, not about money.

---

## 5. FREE / LOW-COST MATRIX

Everything BusinessForge can do **before the first customer, at €0**:

| Capability | €0 path | Ceiling |
|---|---|---|
| LLM reasoning | Gemini free tier | ~100–1,000 req/day by model [W] |
| LLM overflow | OpenRouter `:free` — 50/day, **1,000/day after a one-time $10** [W] | model availability churns |
| Structured output | native schema on Gemini | — |
| Browser automation | Playwright local | local CPU |
| Screenshots / QA | Playwright local | local CPU |
| Accessibility | axe-core | none |
| Performance | Lighthouse | none |
| Security | in-repo checks + gitleaks | none |
| Embeddings | local BGE/E5 via ONNX | local CPU |
| Fingerprint L1+L2 | own code | none |
| Design Memory | append-only JSONL | disk |
| OCR | Docling | quality on hard scans |
| Vision attributes | deterministic `subjectOf` [V] + local VLM | coarse |
| Hosting | Cloudflare Pages | 500 builds/mo |
| Asset storage | R2 free tier | 10 GB, zero egress |
| Analytics | Cloudflare Web Analytics | — |
| Observability | Langfuse self-hosted (MIT) or the repo's own NDJSON [V] | disk |
| Motion | own runtime + GSAP (**free incl. commercial** [W]) | bytes |
| Image optimization | sharp + svgo | CPU |
| Orchestration | n8n self-host + in-process fallback [V] | — |
| Sandboxing | not needed by design | — |
| Design intelligence | the three in-repo research docs [V] | — |

**Standing free credits worth claiming once (not recurring):** Voyage 200M embedding tokens ·
E2B $100 · Daytona $200 compute · Exa $10 · Serper 2,500 queries · Tavily 1,000/mo · Cohere 1,000
trial calls/mo · Meshy/Tripo 2,000 credits · Browserbase 1 browser-hour [all W].

**The €10 recommendation:** buying $10 of OpenRouter credit once raises the free-model allowance
from 50 to 1,000 requests/day permanently [W]. Nothing else in this document changes the €0
ceiling by 20× for €10.

---

## 6. FALLBACK MATRIX

Every capability has ≥2 providers and terminates in a €0 or deterministic path. **This table is
the anti-lock-in guarantee.**

| Capability | 1st | 2nd | 3rd | Terminal fallback (always available) |
|---|---|---|---|---|
| LLM reasoning | Gemini | DeepSeek | OpenRouter free | **`composeBaseline` — a complete site with no model** [V: `main.ts:777`] |
| Writer prose | Claude | GPT | Gemini | `composeBaseline` |
| Enum directors | GPT Luna | Gemini Flash-Lite | DeepSeek | **deterministic floor: `planExperience` etc.** [V] |
| Structured output | native schema | `decodeAndValidate` post-hoc [V] | — | reject directive, keep floor [V: ADR 0004] |
| Vision judging | Gemini vision | GPT vision | Claude vision | **`genericVerdict:'uncertain'` — never a pass** [V: `visual-critic.ts:214`] |
| Fingerprint | local embeddings | Voyage | Google | **L1+L2 structural only, €0** |
| Browser | local Playwright | Browserbase | — | fail the stage loudly |
| Semantic browsing | Stagehand | manual selectors [V] | — | selectors |
| Image texture | fal.ai | Imagen 4 | FLUX/BFL | **no texture — the design system has solid grounds** [V: `worlds.ts`] |
| Image editing | fal.ai | Recraft | local sharp | **use the photograph as-is** |
| Vector marks | Recraft | local SVG primitives | — | **CSS/inline SVG the renderer already ships** |
| OCR | Docling | Mistral OCR | Tesseract | **skip — profile is honestly thinner** [V: ARTIFACT_DEFAULTS rule] |
| Search | Tavily | Exa | Serper | **skip competitor research** |
| Reviews | Places API | — | — | **no testimonials section** [V: `groundTestimonials`] |
| Hosting | CF Pages | Netlify | GH Pages | **`site/` on disk is the deliverable** [V: `main.ts:485-491`] |
| Asset CDN | R2 | Pages assets | — | inline in `site/assets/` |
| Observability | Langfuse self-host | Helicone | — | **NDJSON on disk** [V: `lib/logger.ts`] |
| Orchestration | n8n | **`scripts/run-job.ts`** [V] | — | `main.ts --compose` |
| Motion | own runtime | GSAP | — | **static page, zero JS** [V: `runtime:'none'` default] |

**Two structural properties visible in this table:**
1. **Every row ends in something the repository already owns.** No capability's failure produces
   "no website" — the worst case is a plainer website. That is the property `composeBaseline` was
   built for [V: `main.ts:774-776`].
2. **No provider appears as 1st in more than two rows.** Gemini's concentration (reasoning +
   vision + images) is the largest single-vendor exposure and is deliberately paired with a
   non-Google 2nd in every one of those rows.

---

## 7. CAPABILITY_ROUTER

### 7.1 The core idea — the router is not new architecture, it is an existing seam widened

The repository already has capability abstraction. `platform.skills.get(id)` returns a handle for
**any** id, and an unavailable capability returns its reason as data rather than throwing
[V: `docs/architecture.md:155-178`]. Providers are already selected by name behind a factory that
caches instances and wraps them in retry-with-jitter [V: `lib/ai/factory.ts`].

> **The Capability Router is what `skills.get(id)` becomes when an id has more than one
> implementation.**

Today `get('vision')` resolves to one placeholder. In 2.0 it resolves to a **ranked, filtered,
budget-aware selection over registered implementations**, returning the same `CapabilityOutcome`
the platform already defines. Every caller upstream is unchanged. That is the whole design.

### 7.2 Contract

```
CapabilityRequest {
  capability: CapabilityId            // 'video_generation', 'vision_judging', …
  task:       TaskDescriptor          // shape/size/urgency of this specific call
  constraints: {
    maxCostUnits, maxLatencyMs, minQuality,
    licence: 'commercial-required' | 'any',
    jurisdiction?: 'eu-only',
    excludeVendors?: VendorId[]       // cross-vendor enforcement (§3)
  }
  budget: BudgetHandle                // decremented on success, from the job ledger
}
      ↓
CapabilityOutcome<T>                  // the EXISTING type [V: lib/platform/types.ts]
  | { ok: true,  data, durationMs, provenance }
  | { ok: false, error: CapabilityError, durationMs }
```

### 7.3 The selection pipeline

```
1. CANDIDATES   registry[capability] → all registered implementations
2. FILTER       drop: credential absent · health unavailable · licence incompatible
                    · jurisdiction mismatch · vendor excluded · est. cost > remaining budget
3. RANK         score = wQ·quality + wC·costScore + wL·latencyScore + wA·availability
                weights are PER-CAPABILITY, not global:
                  writer          → wQ 0.70  wC 0.10  wL 0.05  wA 0.15
                  enum director   → wQ 0.20  wC 0.55  wL 0.10  wA 0.15
                  vision judging  → wQ 0.55  wC 0.20  wL 0.10  wA 0.15
                  fingerprint     → wQ 0.30  wC 0.50  wL 0.05  wA 0.15
4. SELECT       highest score; ties broken by observed availability from telemetry [V]
5. EXECUTE      via the adapter, inside the existing retry-with-jitter wrapper [V]
6. ON FAILURE   classify with the EXISTING taxonomy [V: lib/errors.ts]:
                  retryable (429/5xx/transport) → retry same provider (already built)
                  non-retryable                 → next candidate, log the demotion
                  candidates exhausted          → TERMINAL FALLBACK (§6) — never an exception
7. RECORD       provenance + cost + latency → job ledger + telemetry
```

### 7.4 The five rules that make it a router and not a config file

1. **Availability is observed, not declared.** Rank uses the *measured* success rate and latency
   percentiles the telemetry layer already collects [V: `lib/platform/telemetry.ts`], not a
   static quality number. A provider that started failing an hour ago sinks automatically.
2. **The terminal fallback is never a provider.** Every capability's last entry is a deterministic
   in-repo path (§6). **The router cannot return "nothing happened".**
3. **Licence is a hard filter, never a rank input.** A cheaper non-commercial model must be
   *unreachable* for a paying job, not merely disfavoured. This is what makes the FLUX
   open-weight trap [W] structurally unable to reach a customer site.
4. **The router is the only place a vendor name appears.** Today's rule — no agent names
   Anthropic, Playwright, or an endpoint [V: `docs/architecture.md:34-47`] — extended to every
   capability.
5. **Multiple providers may serve one capability *simultaneously* when the capability says so.**
   `vision_judging` requests **k=2 distinct vendors**; the router returns a *set*, and the caller
   receives two independent critiques with a disagreement measure. This is the mechanism behind
   the Visual Jury, and it is why the router returns a selection, not a singleton.

### 7.5 Worked example — `VIDEO_GENERATION`, exactly as the brief posed it

```
request: VIDEO_GENERATION, licence: commercial-required, maxCostUnits: 0.25, urgency: batch

1. CANDIDATES  veo-3.1-lite, veo-3.1-fast, kling-3.0, seedance-2.0, runway-4.5, sora-2
2. FILTER      sora-2       → DROP  (vendor announced API discontinuation 24 Sep 2026 [W])
               runway-4.5   → DROP  (est. $1.20 for 6 s > budget 0.25)
               kling-3.0    → DROP  (no credential configured)
               seedance-2.0 → DROP  (no credential configured)
               veo-3.1-fast → keep  (~$0.90/6 s — over budget → DROP)
               veo-3.1-lite → keep  (~$0.18–0.30/6 s)
3. RANK        veo-3.1-lite sole survivor
4. GATE        capability policy: `video_generation.requires_human_approval = true`
               → NOT executed autonomously; queued for a human decision
5. FALLBACK    the deterministic path: the business's own photograph, statically composed
```

**Note what the router did:** it eliminated a provider on *vendor lifecycle* news, two on
*budget*, two on *credentials*, and then refused to spend on the survivor because the capability
itself is policy-gated. **A capability can be registered, priced, ranked, and still never fire.**
That is the correct relationship between BusinessForge and video.

---

## 8. AGENT_POOL MODEL

### 8.1 Roles, and what each one is allowed to touch

| Pool | Members | Model? | Concurrency driver | Writes |
|---|---|---|---|---|
| **Evidence** | discovery, collector, normalizer | no | browser contexts | `1-,2-,3-*.json` [V] |
| **Understanding** | analyst, writer, content director | 2 model calls | provider RPM | `4-,5-*.json` [V] |
| **Cabinet** | Creative, Art, UX, Motion, Asset | 5 model calls | provider RPM | `5a-directive.json` |
| **Architect** | Technical Architect | **no — deterministic** | CPU | capability plan |
| **Builder** | compose + render | no | CPU | `5b-design.json`, `site/` [V] |
| **Browser** | screenshot, functional, a11y, perf | no | **local CPU — the real ceiling** | `shots/`, `qa/` |
| **Judging** | Visual Jury ×k, Adversarial Critic | vision calls | provider RPM | critique records |
| **Decision** | gate + Hermes | **no — deterministic** | — | `job.json` [V] |

### 8.2 Pool invariants

1. **Every pool has a bounded worker count**, and the bound is a property of the *constraint*, not
   a guess: provider RPM for model pools, CPU cores for browser pools.
2. **A pool never writes another pool's artifact.** Enforced today by the stage/artifact map [V:
   `main.ts:202-212`] and by serialising `job.json` writes through one chain [V:
   `stage-server.ts:61-66`].
3. **Deterministic pools are unbounded and free.** Architect, Builder, and Decision cost nothing
   and can run at full parallelism.
4. **A model pool's worker holds a budget lease.** No lease, no call — this is how §19 of the
   architecture audit's cost ledger becomes enforcement rather than reporting.
5. **Failure is a pool-local event.** A dead judge degrades the jury to k−1 with a recorded
   disagreement, exactly as a vision outage degrades to `uncertain` today [V].

---

## 9. MULTI-AGENT PARALLELISM MODEL

### 9.1 Where the parallelism actually is

```
                      ┌─ Candidate A ─ 5 cabinet calls ─ build ─ 2 shots ─┐
Evidence ─ Understand ├─ Candidate B ─ 5 cabinet calls ─ build ─ 2 shots ─┤─ Round 1 (€0)
(serial)   (serial)   └─ Candidate C ─ 5 cabinet calls ─ build ─ 2 shots ─┘      │
                                                                                 ▼
                                              survivors → Jury: pairs × 2 orders × 2 vendors
                                                                (all independent, all parallel)
                                                                                 ▼
                                                        Adversarial (1) → QA quartet (parallel)
```

**Peak concurrent demand:** 3 candidates × 5 cabinet calls = **15 concurrent LLM requests**, then
3 × 2 = **6 concurrent browser contexts**, then up to **12 vision calls**.

### 9.2 The binding constraints, in order

| Constraint | Value | Consequence |
|---|---|---|
| **Gemini free tier RPM** | 5–15 RPM depending on model, **per Cloud project** [W] | 15 concurrent cabinet calls **exceeds the free tier instantly**. Either stagger, or route the cabinet to a paid cheap model, or use multiple capabilities across vendors. |
| **OpenRouter free variants** | 20 RPM, 50–1,000/day [W] | Usable as spillover for enum calls |
| **Local CPU** | 6 Chromium contexts is heavy on a laptop | **The browser pool, not the model pool, is the first thing to saturate on the developer's own machine.** |
| **Serialised `job.json`** | one chain [V] | Parallel *work* is fine; parallel *state writes* are not. Candidates must write to `candidates/<id>/`, merging only at the gate. |

### 9.3 The parallelism rules

1. **Fan out on candidates, never on stages.** Stage order encodes dependency; candidate identity
   does not. Two candidates share nothing after `planNarrative`, which is derived **once** [V:
   `lib/design/plan.ts`] — that single design decision is what makes candidate parallelism safe.
2. **Deterministic work parallelises freely; model work parallelises under a rate governor.**
3. **The governor is per-vendor, not global.** Three vendors at 10 RPM each is 30 RPM of capacity;
   a global limit would waste two-thirds of it. This is also **the second reason for
   multi-vendor**: not just redundancy, but *aggregate throughput*.
4. **Candidate artifacts are isolated until the gate.** `output/<runId>/candidates/<a|b|c>/`.
5. **Round 1 runs before any paid call** — free elimination is both the cost lever (§4) and the
   concurrency lever, since it decides how many candidates reach the expensive stage.
6. **Degrade N, never the gates.** Under rate-limit pressure `N` falls 3 → 2 → 1; `N=1` reduces
   exactly to today's behaviour [V: `runJob.ts`]. Thresholds never move.

### 9.4 When to reach for Browserbase

Only when **local browser contexts, not model quota, are the ceiling** — i.e. batch-building many
sites at once. At $20/mo for 25 concurrent sessions and 100 browser-hours [W], it converts a
hardware constraint into a small fixed cost. **Do not adopt it for a single-site pipeline; local
Chromium is faster and free.**

---

## 10. ASSET_GENERATION ARCHITECTURE

### 10.1 The existing pipeline is the spine — extend it, do not replace it

```
collector (bounded: 40 images, 1KB–8MB) [V]
  → lib/art/decode.ts        decode to pixels
  → lib/art/palette.ts       quantize → seedFrom() → brand hex     ← colour comes from the
  → lib/art/seed.ts          brandSeedFor(), cached beside artifacts   business's OWN photos [V]
  → lib/art/direction.ts     dropUndersized · dedupeByIdentity ·
                             subjectOf ∈ {merchandise,venue,people,scene} ·
                             curateGallery (budget 6) · arrangeSequence
  → lib/design/assets.ts     choreographAssets → placements + rights
  → lib/render/assets.ts     safeImageUrl allow-list → site/assets/
```

### 10.2 The generation policy — three lanes, one prohibition

| Lane | What | Providers | Gate |
|---|---|---|---|
| **A — Non-depictive** | textures, grain, gradients, abstract grounds | Imagen 4 Fast (~$0.02), fal.ai, FLUX | must assert nothing about the business |
| **B — Editing real photos** | upscale, denoise, background removal, crop-safe outpaint | Recraft (upscale $0.004, erase $0.002), fal.ai | subject must remain the real subject |
| **C — Vector marks** | icons, dividers, placeholder wordmark | **Recraft ($0.08 vector)**, local SVG | structural only |
| **PROHIBITED** | any image that depicts the business, its premises, its staff, its products, or its customers and was not photographed there | — | **hard block in the router's licence/policy filter** |

**Enforcement, structurally rather than by prompt** — the same discipline that governs
testimonials [V]: the Asset Director nominates assets by **index into the profile's real asset
list**, never by URL and never by description. A model that cannot name an image cannot conjure
one. Generated lane-A/C assets enter through a *separate* channel with `origin: 'generated'`
recorded on the placement, and the rights gate refuses `origin:'generated'` in any depictive
role.

### 10.3 Rights, which the repo already tracks and 2.0 must enforce

`AssetRights = 'usable' | 'reference-only' | 'unknown'` [V: `lib/design/assets.ts:43`], with
Facebook/Instagram/Google-hosted images marked `reference-only(rights?)` by host heuristic and
surfaced in the Director's brief [V: `designDirectorAgent.ts:345,387`].

**The 2.0 change is one line of policy:** a `reference-only` asset may be a placeholder, and may
never be the hero of a **paying** deliverable. Today it is flagged; tomorrow it blocks.

### 10.4 Optimization — build time, not request time

sharp (AVIF/WebP + responsive sets) and svgo, at build. **Prefer this to Cloudflare Images**
(no free tier; ~$0.50/1k transformations [W]): the renderer already knows every image it will
ever serve, so transformation is a build step, not a runtime service. Buying on-the-fly variants
for a static site with a fixed asset list is paying for a problem the architecture does not have.

---

## 11. BROWSER / QA TOOLCHAIN

| Layer | Tool | Class | Cost | What it proves |
|---|---|---|---|---|
| Driver | **Playwright + Chromium** | CORE | €0 | everything below runs here |
| Capture | **one consolidated capture module** | CORE | €0 | fixes defect D1 — four copies of one technique |
| Functional | Playwright assertions [V] | CORE | €0 | h1 uniqueness, CTA target resolves, **nav proven by clicking it**, no dead anchors, images decode, no horizontal overflow, ≥50 words |
| Accessibility | **axe-core** + keyboard sweep + rendered-page contrast | CORE | €0 | WCAG rules; 8-stop tab traversal with a visible focus ring; contrast **on the world-repainted ground**, not only in tokens — the repo has already been bitten by exactly that [D: `PROJECT_STATUS.md`] |
| Performance | **Lighthouse** + budgets | CORE | €0 | LCP/CLS proxies, page weight, DOM ceiling, largest image; frame-time sweep when the Tier-2 runtime is on |
| Responsive | viewport matrix 390/768/1440 | CORE | €0 | mobile overflow is the classic silent break |
| Motion safety | `prefers-reduced-motion` + no-JS pass | CORE | €0 | the runtime must vanish cleanly [V: `runtime-rules.ts`] |
| Visual judging | Visual Jury (§2.1, k=2 vendors) | CORE | paid | distinctness and craft |
| Semantic navigation | Stagehand | OPTIONAL | €0 + LLM | evidence collection on unknown sites only — **never for measurement** |
| Scale | Browserbase | FALLBACK | $20/mo | when local contexts saturate |
| Real-device truth | WebPageTest | OPTIONAL | free tier | once per template class, not per job |

**The ordering rule:** functional → accessibility → security → performance. Functional first
because every other measurement on a broken page is meaningless; performance last because a
degraded pass (over budget but working) is a legitimate human decision, and nothing else is.

---

## 12. SECURITY TOOLCHAIN

### 12.1 Output security — what ships to the customer

Already enforced [V: `scripts/publish-run.ts:290-299`]: no inline `on*` handlers · no
`javascript:` URLs · no mixed content · `rel=noopener` on `target=_blank` · **no third-party
scripts**. Collected but not yet asserted: `dataUrls`, `iframes`, `formsWithoutAction`.

**Add:** a strict `Content-Security-Policy` meta (trivial to make near-maximal — the page has no
external scripts by design), plus assertions on the three collected-but-unchecked fields.

### 12.2 Supply chain — BusinessForge's own code

| Tool | Class | Cost | Note |
|---|---|---|---|
| **gitleaks / trufflehog** | CORE | €0 | Directly targets the demonstrated failure class: a live key reaching a committed artifact [V: `docs/architecture.md:120-125`] |
| **OSV-Scanner / Trivy** | OPTIONAL | €0 | Only 2 runtime dependencies [V: `package.json`] — a genuinely small surface |
| **Semgrep** | OPTIONAL | free tier | Workshop-time static analysis |
| **npm audit / lockfile discipline** | CORE | €0 | — |
| **OWASP ZAP** | **REJECT** | €0 | A DAST scanner against static HTML with no server, no forms, no scripts. Wrong tool. |

### 12.3 Credential handling — already strong, three fixes outstanding

Verified good [V]: one module reads `process.env`; `describe()` reports credential **names only**;
suffix-pattern credential detection; Places photo URLs stripped of the key before persistence;
`runId` **rejected** rather than sanitised; branded `Html` type makes escaping structural.

Outstanding: `VISION_*` bypasses `lib/config.ts` (defect D2); MCP headers are literal with no
`${VAR}` expansion [V: `.env.example:120-123`]; stage-server token compared with `!==` rather
than constant-time, `/health` unauthenticated, no rate limit, no TLS.

### 12.4 The arsenal's own security questions — **[?] and blocking**

| Question | Why it blocks |
|---|---|
| Does customer evidence flow to **non-EU jurisdictions** (DeepSeek, Qwen, Moonshot, Zhipu)? | GDPR transfer basis for an EU SMB platform. **Decide before routing customer data to any of them.** Mistral exists as the EU answer. |
| Do **free-tier** terms permit commercial use of outputs, and do they train on inputs? | Gemini free tier, OpenRouter `:free`, ElevenLabs free (explicitly **not** commercial [W]) |
| What are the **open-weight** licences actually being used? | FLUX's default open-weight path is **non-commercial** [W]; Llama's terms have thresholds |
| Places API review **storage and display** terms | Already flagged in the architecture audit |
| Prompt injection from scraped pages | Scraped text is embedded verbatim in briefs [V: `designDirectorAgent.ts:479-484`]. The closed schema blunts it structurally; **add the explicit rule that scraped content is data, never instruction**, and never widen a schema to free-form output. |

---

## 13. OBSERVABILITY TOOLCHAIN

| Layer | Tool | Class | Cost | Note |
|---|---|---|---|---|
| Run logs | **in-repo NDJSON + child scopes** [V] | CORE | €0 | Already per-run, structured, on disk |
| Capability metrics | **in-repo telemetry** [V] | CORE | €0 | Latency samples, availability, error accounting — **this is what the router ranks on (§7.4.1)** |
| Provenance | **`DirectorProvenance`** [V] | CORE | €0 | provider, **served** model, requested model, tokens, finish reason, **provider request id**, duration. Already sufficient for a cost ledger; only aggregation is missing. |
| Cost ledger | **BUILD** | CORE | €0 | Sum the above into `job.json` |
| LLM tracing | **Langfuse self-hosted** | OPTIONAL | €0 (MIT core; cloud Hobby 50k obs/mo) [W] | The only one whose self-hosted path is free and unlimited |
| — alternative | Helicone | FALLBACK | free 10k req/mo [W] | **Acquired by Mintlify in March 2026; roadmap uncertain** [W] — a live example of why observability should be self-hosted |
| — alternative | Phoenix / OpenLLMetry | OPTIONAL | €0 OSS | OTel-native |
| Site analytics | **Cloudflare Web Analytics** | OPTIONAL | €0 | **The only analytics that does not break `security.no-external-scripts`** [V] — server-side, cookieless, no consent banner |
| Uptime | Cloudflare / UptimeRobot | OPTIONAL | free tiers | For delivered sites |
| Evaluation | **promptfoo / DeepEval** | OPTIONAL | €0 OSS | Jury-vs-human calibration (§C25) — the missing piece that makes a model judge trustworthy |

**The 2.0 additions that matter most:** the cost ledger, the **battle record** (every candidate,
its scores, its rank, why the winner won — as an artifact, not a log line), the **distinctness
time series** (the collapse alarm is only meaningful as a trend), and the **jury disagreement
metric** (consensus is a signal about the design, not only about the judges).

**REJECT: any external observability SaaS.** The €0 policy and the no-external-scripts posture
point the same way, and Helicone's acquisition is the cautionary example.

---

## 14. RECOMMENDED BUSINESSFORGE ARSENAL

### 14.1 CORE — the product depends on these

| Capability | Provider | Cost |
|---|---|---|
| Reasoning + structured output | **Gemini** (free tier) | €0 |
| Prose (paying customers) | **Anthropic Claude** | ~$0.16–0.40/site |
| Second vendor / adversarial / jury | **OpenAI** | ~$0.01–0.05/site |
| Cost-floor reasoning | **DeepSeek** (pending jurisdiction call) | ~$0.01/site |
| Failover bus + free stacking | **OpenRouter** | €0 (+ one-time $10) |
| Browser, screenshots, all QA | **Playwright + Chromium** | €0 |
| Accessibility | **axe-core** | €0 |
| Performance | **Lighthouse** | €0 |
| Secret scanning | **gitleaks** | €0 |
| Embeddings (fingerprint L3) | **local BGE/E5 via ONNX** | €0 |
| Hosting + assets | **Cloudflare Pages + R2** | €0 |
| Image optimization | **sharp + svgo** | €0 |
| Orchestration | **n8n + in-process fallback** [V] | €0 |
| Observability | **in-repo NDJSON + telemetry** [V] | €0 |
| Design intelligence | **the three in-repo research docs** [V] | €0 |
| Motion | **in-repo Tier-2 runtime** [V] | €0 |

### 14.2 OPTIONAL — earns its place for specific jobs

Places API (reviews, ~$0.01/business, founder exception) · Mistral OCR (menus, after Docling) ·
Docling (menus, €0) · Recraft (vector marks, $0.08) · fal.ai (image aggregator) · Voyage (200M
free embedding tokens) · Tavily/Exa (competitor research) · GSAP (free, incl. commercial) ·
Cloudflare Web Analytics · Langfuse self-hosted · Mistral platform (EU jurisdiction) · Stagehand
(semantic evidence collection) · WebPageTest.

### 14.3 FALLBACK — exists to be second

Qwen · Kimi · GLM · Imagen/Nano Banana · Ideogram · Replicate · Serper · Brave · Netlify · GitHub
Pages · Pa11y · Helicone · Browserbase · Tesseract/Surya · Jina · Cohere Rerank.

### 14.4 EXPERIMENTAL — evaluate, never depend

Veo 3.1 Lite (image-to-video ambient loop from the business's *own* photo, CWV-gated) · Higgsfield
(if video is ever needed, adopt the aggregator not a vendor) · Rive · Spline · Three.js/R3F for a
Tier-3 host · Grok · local VLMs for asset attributes · Antigravity (workshop).

### 14.5 REJECT — see §15

---

## 15. TOOLS TO REJECT

| Item | Class | Reason |
|---|---|---|
| **Lovable as deploy target** | REJECT | Re-introduces model-authored markup into a pipeline built to eliminate it; `run()` throws today [V]. Replace with Cloudflare Pages. |
| **Video generation for the product path** (Kling, Seedance, Runway, Luma, Pika, and Veo at full price) | REJECT | The business has no footage; generated footage of a real venue is a fabricated fact. CWV liability. No consumer in `WebsiteDesign` [V]. |
| **Sora** | REJECT | **API discontinuation scheduled 24 Sept 2026** [W] — and the reason the router must never hard-code a vendor. |
| **Video-to-video** | REJECT | Requires source footage that does not exist. |
| **3D generation (Meshy, Tripo)** | REJECT for product | No consumer in the pipeline; Tier 3 is one quarantined reference host by doctrine [V]. |
| **ElevenLabs / any TTS on the site** | REJECT for product | Autoplay is an a11y violation and browser-blocked; a play button nobody presses is weight. Free-tier output is **explicitly not licensed for commercial use** [W]. |
| **Sandboxing (E2B, Modal, Daytona) in the product path** | REJECT | Needed only to run untrusted code. **No model in BusinessForge emits executable code** [V]. Needing a sandbox would mean the invariant broke. |
| **Autonomous SWE agents (Devin-class) on the product** | REJECT | An agent that rewrites the pipeline between customer jobs makes output non-reproducible — the property the whole artifact/resume design exists to guarantee [V: `main.ts:150-162`]. |
| **Google Analytics / any JS tag** | REJECT | Breaks `security.no-external-scripts` [V], adds a consent banner and GDPR exposure to a site whose selling point is being clean and fast. |
| **CDN fonts (Google Fonts et al.)** | REJECT | Faces are vendored and inlined [V]. A network font is a third-party request, a privacy leak, and a CLS risk. |
| **CSS frameworks (Tailwind, Bootstrap)** | REJECT | 3,692 lines of `variants.ts` exist so the design system owns every value [V]. A utility framework recreates the template signature the distinctness gate exists to catch. |
| **Ahrefs / Semrush** | REJECT | $100+/mo enterprise SEO suites for a platform that does not sell SEO. |
| **OWASP ZAP** | REJECT | DAST against a static file with no server, no forms, no scripts. |
| **Bright Data (for now)** | REJECT | Playwright handles every current target. Revisit only if one proves genuinely unscrapeable, with a founder exception. |
| **External observability SaaS** | REJECT | €0 policy + no-external-scripts; Helicone's acquisition [W] is the cautionary tale. |
| **Cloudflare Images** | REJECT (prefer build-time) | No free tier; the asset list is fixed at build, so runtime transformation buys nothing. |
| **Depictive image generation of a real business** | **REJECT — hard** | Rule 2. The image equivalent of a fabricated testimonial. |
| **Self-hosted FLUX `-dev` weights on customer work** | REJECT until licensed | Default open-weight path is **non-commercial** [W]. |
| **Any model emitting CSS/JS/GLSL/DOM/hex/durations** | **REJECT — hard** | The single invariant [V]. |

---

## BUSINESSFORGE 2.0 ARSENAL — FINAL RECOMMENDATION

### A. Minimum viable arsenal — **€0/month, €0.00 per site**

Everything needed to build, judge, and ship a distinct, functional, accessible, fast website with
no bill at all.

| Capability | Provider |
|---|---|
| Reasoning + structured output | Gemini free tier |
| Overflow reasoning | OpenRouter `:free` |
| Everything design, content, layout, render | **in-repo deterministic layers** [V] |
| Browser + screenshots + functional QA | Playwright local |
| Accessibility | axe-core |
| Performance | Lighthouse |
| Security | in-repo checks + gitleaks |
| Fingerprint L1 + L2 | own code |
| Design Memory | append-only JSONL |
| Embeddings (L3) | local BGE/E5 |
| Hosting | Cloudflare Pages + R2 |
| Motion | in-repo Tier-2 runtime |
| Orchestration | n8n self-host + `run-job.ts` |
| Observability | in-repo NDJSON + telemetry |
| Design intelligence | the three in-repo docs |

**One-time spend that raises the ceiling 20×: $10 of OpenRouter credit** (50 → 1,000 free
requests/day, permanently) [W].

**What this cannot do:** run a paid Visual Jury, buy reviews, or exceed Gemini's daily request
count. Everything else — including a full deterministic Design Battle via `perturbedDirective`
[V] — is reachable.

---

### B. Production arsenal — **~€0.10–0.25 per delivered site**

Add exactly five paid relationships to the minimum, and nothing else:

| Add | For | Cost |
|---|---|---|
| **Anthropic** | the writer, where model quality is visible to the paying customer | ~$0.16–0.40/site |
| **OpenAI** | the second vendor — jury judge B and the Adversarial Critic, which **must not share a vendor with the Creative Director** | ~$0.01–0.05/site |
| **DeepSeek** *(or Mistral if the EU jurisdiction call goes that way)* | the cheap enum-director floor | ~$0.01/site |
| **Places API** | reviews → testimonials → `aggregateRating` | ~$0.01/business |
| **Mistral OCR** | menus and price lists, after Docling fails | ~$0.002–0.004/page |

Plus €0 additions: **GSAP** (free incl. commercial [W]), **Cloudflare Web Analytics**,
**Langfuse self-hosted**, **Voyage** (200M free tokens), **Tavily** (1,000 free/mo).

**Total marginal cost per site: ~€0.10–0.25.** Against any plausible price for a small business
website, this is not a cost centre. The constraints that actually bind are **rate limits,
latency, and licensing** — which is why the router (§7) ranks on availability and filters on
licence rather than optimising for price.

---

### C. Optional premium arsenal — **~€1.00–2.00 per site, per customer request**

Reach for these when a specific customer justifies them, never by default:

| Add | For | Cost |
|---|---|---|
| **Claude Opus 5 for the Creative Director** | genuinely different concepts across N battle candidates | ~$0.35/site |
| **k=3 jury across three vendors** | tighter calibration where the verdict matters | ~$0.10–0.20 |
| **Recraft vector marks** | a real wordmark and icon set instead of CSS primitives | ~$0.08–0.50 |
| **fal.ai image editing** | upscale/outpaint the business's own photographs to full-bleed | ~$0.01–0.10 |
| **Adobe Firefly** | the **only** indemnified source, if depictive generation is ever unavoidable | subscription + credits |
| **Browserbase** | 25 concurrent sessions when building many sites at once | $20/mo |
| **Veo 3.1 Lite ambient loop** | 3 s of motion from the business's *own* photograph, CWV-gated and reduced-motion-safe | ~$0.09–0.15 |
| **WebPageTest** | real-device truth once per template class | free tier |

---

### D. The three decisions that must be made before any of this is bought

1. **Jurisdiction.** Does customer evidence go to DeepSeek/Qwen/Moonshot/Zhipu? If not, Mistral
   moves from OPTIONAL to CORE and the cost floor rises. **This is a founder decision, not an
   engineering one.**
2. **Free-tier commercial terms.** Gemini free tier, OpenRouter `:free`, and every open-weight
   model must be confirmed to permit commercial output and to state their training-on-input
   posture before a paying customer's site passes through them.
3. **Places API review licence.** Already flagged in the architecture audit; still unresolved;
   blocks the testimonials feature commercially.

---

### E. What this arsenal deliberately does not contain

No video vendor. No 3D generator. No voice. No sandbox. No autonomous coding agent in the product
path. No analytics tag. No CSS framework. No CDN font. No single provider appearing first in more
than two fallback rows.

**That absence is the design.** Every provider in §14 is there because a capability the
architecture already names has no other way to be served — and every one of them can be switched
off without the platform losing its ability to ship a working website.

---

## Sources

Prices and availability searched 2026-08-14, predominantly from pricing-aggregator sites rather
than vendor pages. **Re-verify at the vendor before committing spend.**

[Anthropic API pricing](https://benchlm.ai/anthropic/api-pricing) ·
[Claude pricing overview](https://www.cloudzero.com/blog/claude-pricing/) ·
[OpenAI API pricing](https://benchlm.ai/openai/api-pricing) ·
[OpenAI pricing overview](https://www.cloudzero.com/blog/openai-pricing/) ·
[Gemini free tier limits](https://www.aifreeapi.com/en/posts/gemini-api-rate-limits-per-tier) ·
[Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing) ·
[Gemini image pricing](https://www.aifreeapi.com/en/posts/gemini-image-generation-api-pricing) ·
[OpenRouter free tier](https://klymentiev.com/blog/openrouter-free-tier) ·
[OpenRouter free models](https://costgoat.com/pricing/openrouter-free-models) ·
[DeepSeek pricing](https://www.nxcode.io/resources/news/deepseek-api-pricing-complete-guide-2026) ·
[Kimi/Moonshot pricing](https://benchlm.ai/moonshot/api-pricing) ·
[GLM/Zhipu pricing](https://www.layer3labs.io/guides/glm-5-2-pricing) ·
[Qwen pricing](https://benchlm.ai/alibaba/api-pricing) ·
[Qwen free tier](https://inferencehub.org/blog/alibaba-cloud-qwen-api-pricing-2026/) ·
[Mistral pricing](https://www.cloudzero.com/blog/mistral-api-pricing/) ·
[Mistral OCR 4](https://mistral.ai/news/ocr-4/) ·
[Hugging Face Inference pricing](https://huggingface.co/docs/inference-providers/pricing) ·
[FLUX pricing](https://bfl.ai/pricing) ·
[FLUX API terms](https://bfl.ai/legal/flux-api-service-terms) ·
[Ideogram pricing](https://pricepertoken.com/ideogram-pricing) ·
[Recraft API pricing](https://www.recraft.ai/docs/api-reference/pricing) ·
[Adobe Firefly indemnification](https://www.licenseorg.com/blog/adobe-firefly-indemnification-explained) ·
[fal.ai pricing](https://pricepertoken.com/fal-ai-pricing) ·
[fal vs Replicate](https://www.teamday.ai/blog/fal-ai-vs-replicate-comparison) ·
[AI video API pricing](https://www.buildmvpfast.com/api-costs/ai-video) ·
[Video API comparison](https://devtk.ai/en/blog/ai-video-generation-pricing-2026/) ·
[Sora/Luma/Pika/Higgsfield availability](https://wavespeed.ai/blog/posts/complete-guide-ai-video-apis-2026/) ·
[Meshy pricing](https://www.meshy.ai/pricing) ·
[3D API comparison](https://www.3daistudio.com/blog/best-3d-model-generation-apis-2026) ·
[Browserbase pricing](https://www.browserbase.com/pricing) ·
[Browserbase vs Stagehand](https://www.skyvern.com/blog/browserbase-vs-stagehand-which-is-better/) ·
[GSAP free licence](https://webflow.com/blog/gsap-becomes-free) ·
[GSAP licensing](https://gsap.com/licensing) ·
[ElevenLabs pricing & commercial rights](https://bigvu.tv/blog/elevenlabs-pricing-2026-plans-credits-commercial-rights-api-costs/) ·
[Embedding model pricing](https://pecollective.com/tools/text-embedding-models-compared/) ·
[Search API pricing](https://www.buildmvpfast.com/api-costs/ai-search) ·
[Sandbox platform comparison](https://blog.logrocket.com/comparing-ai-agent-sandbox-platforms-e2b-modal-daytona-and-more/) ·
[Langfuse/Helicone comparison](https://particula.tech/blog/helicone-vs-langfuse-vs-langsmith-llm-observability) ·
[Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) ·
[Cloudflare free tier](https://agentdeals.dev/vendor/cloudflare) ·
[Cloudflare Images pricing](https://theimagecdn.com/docs/cloudflare-images-pricing) ·
[Gemini CLI pricing](https://www.tembo.io/blog/gemini-cli-pricing) ·
[Google Antigravity free tier](https://agentdeals.dev/vendor/google-antigravity) ·
[Codex vs Claude Code](https://www.morphllm.com/comparisons/codex-vs-claude-code) ·
[Codex pricing](https://www.cloudzero.com/blog/openai-codex-pricing/)

---

_End. Nothing in this document was implemented. The repository, the n8n workflow, and the
dependency tree are exactly as they were found._
