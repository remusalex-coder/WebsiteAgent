# MASTER_AUXILIARY_ARSENAL

> BusinessForge Autonomous Digital Experience Factory — **Auxiliary Capability Arsenal**
> Research-only deliverable. No code, registry, `.env`, or `package.json` modified.
> Evidence classes: **VERIFIED** (official source fetched), **OBSERVED** (seen on live
> page/repo), **INFERRED**, **UNKNOWN**. Where `bf_research/` (prior live-curl pass,
> 2026-08-19) already holds VERIFIED numbers, this doc reuses them verbatim and extends.
>
> Folder: `WebsiteAgent/research/auxiliary-arsenal/` (this file + 00–20 + `.ref/`).

---

## 0. WHAT ALREADY EXISTS (repo audit — do NOT duplicate)

Inspected `lib/capability/registry.ts` (38 capabilities) + `lib/`, `agents/`, `lib/forge`,
`lib/qa`, `lib/platform/{mcp,skills}`, `lib/sources`. Classification:

**IMPLEMENTED / EXISTS in-repo**
- AI provider adapters: `lib/ai/providers/*` — anthropic, openai, gemini, openrouter,
  cerebras, deepseek, xai (the contract already supports all major text LLMs; adding a
  vendor = one adapter file, proven pattern).
- Capability registry + router: `lib/capability/*` (38 rows, tier + gate model).
- Business evidence: `lib/sources/*` — authority, mapsListing, placesApi, instagramProfile,
  piiScreen, merge (real local-business evidence already collected).
- Agents: discovery, collector, normalizer, businessAnalyst, writer, design, designDirector,
  lovable (8-stage deterministic pipeline).
- Forge: critic, battle, blueprint, signature, experienceStrategy, motion, functionalModules,
  browser, builder, repair, anti-ai-gate, orchestrator (design/motion/QA loop EXISTS).
- QA gates: `lib/qa/gates/*`, `lib/qa` — layout audit, visual regression, accessibility,
  performance, output_security, structured_data_validation.
- Platform: `lib/platform/mcp/*` (manager, http/stdio connectors, types) + `lib/platform/skills/*`
  (loader, registry, manager) — MCP + skill HOSTING already built.
- Prior research cache: `C:\Users\40728\bf_research/` — image (01), 3D (03), audio (04),
  layout/scroll/type (02), entry/nav/cursor (01), video Higgsfield/others (05), provider
  matrix (05), functional (11), arsenal v2 (BUSINESSFORGE_2.0_ARSENAL). **These are the
  authoritative VERIFIED price/licence facts; this doc extends them.**

**DECLARED BUT GATED (in registry, not active)**
- `image_editing` (tier conditional, gate human) — Higgsfield candidate researched.
- `motion_media` (tier specialist, gate human) — Higgsfield/Runway/Veo candidates researched.
- `audio_speech` (tier rejected — frozen F-18) — ElevenLabs researched, rejected on purpose.
- `three_d_generation` (tier rejected — frozen F-18) — Tripo/Meshy researched, rejected.
- `vector_generation` (conditional, no gate) — procedural SVG path exists.

**EXTERNAL CANDIDATE (this research's job):** everything in §2 below that is NOT in the
list above — business-research crawlers, visual-archaeology extractors, design-system
tooling, expanded functional SaaS, SEO/perf/security scanners, MCP servers, agent skills,
open-source repos.

---

## 1. CORE PRINCIPLE (unchanged)

FREE FIRST → MEDIUM IF JUSTIFIED → PREMIUM ONLY IF JUSTIFIED. The auxiliary arsenal is the
set of **external specialists** the factory can call. Most are FREE or self-hostable; paid
ones are escalation paths gated on business evidence + (for PREMIUM) human approval.

---

## 2. THE AUXILIARY STACK V1 (proposed — practical, not 200 tools)

### CORE (integrate into factory — free / self-host / already-wired)
| Capability | Tool | Why | Evidence |
|---|---|---|---|
| Web research / crawl | **Firecrawl** (Free 1k/mo, keyless agent tier) + **Tavily** (Free 1k/mo) + **Exa** (Free $10/mo + MCP) | business-evidence gathering, autonomous | VERIFIED pricing pages |
| Browser automation / QA | **Playwright** (OSS, MIT) — already the QA surface | render, screenshot, visual judge, repair loop | repo `lib/forge/browser.ts` |
| Visual archaeology | **screenshot-to-code** (74.2k★, MIT, self-host) — study architecture only, do NOT generate site code from it | extract layout/component intent from competitor refs | VERIFIED github |
| Design tokens | **Style Dictionary** (OSS) + **Tokens Studio** (Figma) → feed `experience blueprint` | design-system generation | VERIFIED |
| Motion | **GSAP + Lenis + View Transitions + Rive + Lottie** (all free) | all motion/interaction | VERIFIED (prior) |
| 3D runtime | **Three.js / R3F / OGL** (MIT) | 3D viewer/configurator | VERIFIED (prior) |
| Image free | **Unsplash / Pexels / Pixabay / Openverse / Wikimedia** (commercial OK, check per-licence) | free imagery | KNOWN |
| Image gen | **Gemini Imagen / OpenAI gpt-image / FLUX(local or fal/Replicate)** | generated imagery | VERIFIED (prior + this) |
| Video | **Higgsfield** (MCP+CLI+REST, Free→Ultra) as PRIMARY medium/premium | image/video/audio/3D one API | VERIFIED (prior) |
| Voice | **Kokoro-82M / Piper** local (free, own output) | TTS at €0 | VERIFIED (prior) |
| Functional — forms | **Web3Forms** (250/mo free) | contact/quote | VERIFIED (prior) |
| Functional — maps | **OpenStreetMap + Leaflet** (no key) | maps/directions | VERIFIED (prior) |
| Functional — booking | **Cal.com** self-host (AGPL) | scheduling | VERIFIED (prior) |
| Functional — auth/DB/CMS | **Supabase** free (50k MAU) | auth/portal/CMS-backing | VERIFIED (prior) |
| Functional — payments | **Stripe** (no monthly, per-tx) | checkout | VERIFIED (prior) |
| Functional — search | **Fuse.js / Lunr** (client) + **Meilisearch** self-host (free) | search/filter | VERIFIED this |
| Storage/CDN | **Cloudflare R2 free + CDN** (no egress) | asset delivery | VERIFIED (prior) |
| Media proc | **FFmpeg / Sharp / ImageMagick / WebCodecs** (local) | optimise/transcode | VERIFIED (prior) |
| SEO | **schema.org JSON-LD** (hand-built) + **Screaming Frog free / Sitebulb** | structured data, crawl | KNOWN |
| Accessibility | **axe-core** (OSS) + **Lighthouse** (OSS) | a11y/perf gates | VERIFIED this |
| Performance | **Lighthouse / WebPageTest / bundle analyzers** | budgets | VERIFIED this |
| Security | **Semgrep** free (SAST/SCA/Secrets) + `npm audit` + CSP/security-headers | code/dep scan | VERIFIED this |
| Visual QA judge | **Playwright screenshot + multimodal LLM judge** (existing critic) | generate→judge→repair | repo exists |

### OPTIONAL (wire when client needs / medium tier)
- **Algolia** (search SaaS, has MCP) — only if Fuse.js/Meilisearch insufficient at scale.
- **Cloudinary** (Free $0, 25 credits/mo, MCP) — media optimisation/CDN if R2+Sharp not enough.
- **Resend** (Free 100/day) — transactional email if Web3Forms insufficient.
- **Clerk** (Free 50k MRU) — if Supabase Auth UI needs augmenting.
- **Payload / Strapi / Sanity** — headless CMS if client wants editing UI.
- **Twilio** — SMS notifications (per-use).
- **Meshy / Tripo** — 3D generation IF `three_d_generation` gate re-opened by evidence.
- **ElevenLabs** — voice IF `audio_speech` gate re-opened by evidence.
- **Runway / Veo / fal** — video alternates to Higgsfield.

### PREMIUM (escalation, human-approved)
- **Higgsfield Ultra**, **Runway Max**, **Veo 3.1**, **Adobe Firefly** (brand-safe),
  **ElevenLabs Pro**, **Meshy Studio**, **Algolia Enterprise**, **Cloudinary Enterprise**.

### EXTERNAL (stay external, call via API/MCP, never embed)
- All paid SaaS above; Mapbox/Google Maps (only if OSM rejected by client); Shopify (if
  client already on it); social/Places APIs (already in `lib/sources`).

### LOCAL FALLBACK (always available, $0, no vendor risk)
- FLUX/SD (image), Kokoro/Piper (voice), Whisper.cpp (STT), Blender (3D), FFmpeg/Sharp
  (media), Meilisearch/Postgres (search/DB), Playwright (QA), Semgrep/axe-core (scan).

---

## 3. MASTER TABLE (condensed — full matrix in 04/11/19)

See `04_FREE_MEDIUM_PREMIUM_STACK.md` (decision matrix), `11_AI_PROVIDER_MATRIX.md`
(providers), `19_CAPABILITY_REGISTRY_PROPOSAL.md` (registry rows). Headline rows:

| NAME | CAT | TYPE | API | SDK | CLI | MCP | FREE | MED $ | PREM $ | COMM LIC | SEC | RECO | PRI |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Firecrawl | research | SaaS | ✅ | ✅ | ✅ | ✅(agent) | 1k/mo | $16 | $599 | yes | REVIEW | ADOPT | P0 |
| Tavily | research | SaaS | ✅ | ✅ | ❌ | ✅ | 1k/mo | $0.008/cr | ent | yes | SAFE | ADOPT | P0 |
| Exa | research | SaaS | ✅ | ✅ | ❌ | ✅ | $10/mo | PAYG $7/1k | ent | yes | REVIEW | ADOPT | P1 |
| Playwright | QA/auto | OSS | ✅ | ✅ | ✅ | ✅(puppeteer) | ✅$0 | — | — | MIT | SAFE | ADOPT | P0 |
| screenshot-to-code | visual-arch | OSS | ✅(local) | ✅ | ❌ | ❌ | ✅$0 | — | — | MIT | REVIEW | STUDY | P2 |
| Style Dictionary | design | OSS | ❌ | ✅ | ✅ | ❌ | ✅$0 | — | — | Apache-2 | SAFE | ADOPT | P1 |
| Tokens Studio | design | SaaS | ✅ | ✅ | ❌ | ✅(Figma) | free tier | sub | ent | yes | REVIEW | ADOPT | P2 |
| GSAP/Lenis/Rive/Lottie | motion | lib | n/a | ✅ | ❌ | ❌ | ✅$0 | — | — | free/MIT | SAFE | ADOPT | P0 |
| Three.js/R3F/OGL | 3D | lib | n/a | ✅ | ❌ | ❌ | ✅$0 | — | — | MIT | SAFE | ADOPT | P0 |
| Unsplash/Pexels/Openverse | image-free | API | ✅ | ✅ | ❌ | ❌ | ✅$0 | — | — | comm(perp) | SAFE | ADOPT | P0 |
| Gemini Imagen | image-gen | API | ✅ | ✅ | ❌ | ❌ | free allow | per-img | — | yes(paid) | REVIEW | ADOPT | P0 |
| OpenAI gpt-image | image-gen | API | ✅ | ✅ | ❌ | ❌ | no API free | $0.011–.167 | — | yes(paid) | REVIEW | ADOPT | P0 |
| FLUX (fal/Replicate/local) | image-gen | API/local | ✅ | ✅ | ✅ | ❌ | $0.003–.04 | $0.04 | — | model-dep | REVIEW | ADOPT | P0 |
| Higgsfield | video/img/audio/3D | API | ✅ | ✅ | ✅ | ✅ | Free→$99 | $19/$47 | $99 | yes(paid) | REVIEW | ADOPT | P0 |
| Runway | video | API | ✅ | ✅ | ❌ | partial | 125cr | $12/$28 | $76 | yes(paid) | REVIEW | ADOPT | P1 |
| ElevenLabs | voice | API | ✅ | ✅ | ❌ | ✅ | $0(non-comm) | $6 comm | $99+ | paid-only | REVIEW | OPTIONAL | P2 |
| Kokoro/Piper | voice | local | ✅ | ❌ | ✅ | ❌ | ✅$0 | — | — | OSS | SAFE | ADOPT | P0 |
| Web3Forms | forms | SaaS | ✅ | ❌ | ❌ | ❌ | 250/mo | pro | — | yes | SAFE | ADOPT | P0 |
| OSM+Leaflet | maps | OSS/API | ✅ | ✅ | ❌ | ❌ | ✅$0 | — | — | ODbL(attr) | SAFE | ADOPT | P0 |
| Cal.com | booking | OSS/SaaS | ✅ | ✅ | ✅ | ✅ | self-host $0 | $12 | ent | AGPL/yes | REVIEW | ADOPT | P0 |
| Supabase | auth/DB/CMS | SaaS/OSS | ✅ | ✅ | ✅ | ✅ | 50k MAU $0 | $25 | $599 | yes | REVIEW | ADOPT | P0 |
| Stripe | payments | SaaS | ✅ | ✅ | ❌ | ❌ | no monthly | per-tx 2.9%+.30 | ent | yes | REVIEW | ADOPT | P0 |
| Fuse.js/Lunr | search | OSS | n/a | ✅ | ❌ | ❌ | ✅$0 | — | — | MIT | SAFE | ADOPT | P0 |
| Meilisearch | search | OSS/SaaS | ✅ | ✅ | ✅ | ❌ | self-host $0 | $20/mo | ent | MIT/yes | SAFE | ADOPT | P1 |
| Algolia | search | SaaS | ✅ | ✅ | ❌ | ✅ | limited | sub | ent | yes | REVIEW | OPTIONAL | P2 |
| Cloudinary | media | SaaS | ✅ | ✅ | ❌ | ✅ | $0(25cr) | $89 | $249 | yes | REVIEW | OPTIONAL | P2 |
| Resend | email | SaaS | ✅ | ✅ | ❌ | ❌ | 100/day $0 | pro | ent | yes | REVIEW | OPTIONAL | P1 |
| Clerk | auth | SaaS | ✅ | ✅ | ❌ | ❌ | 50k MRU $0 | $20 | $250 | yes | REVIEW | OPTIONAL | P2 |
| Payload/Strapi | CMS | OSS | ✅ | ✅ | ✅ | ❌ | self-host $0 | — | ent | MIT/yes | SAFE | OPTIONAL | P2 |
| Cloudflare R2/CDN | storage | SaaS | ✅ | ✅ | ❌ | ❌ | 10GB $0 | $0.015/GB | ent | yes | SAFE | ADOPT | P0 |
| FFmpeg/Sharp | media-proc | OSS | CLI | ✅ | ✅ | ❌ | ✅$0 | — | — | GPL/Apache | SAFE | ADOPT | P0 |
| Lighthouse | perf/a11y | OSS | ✅ | ✅ | ✅ | ❌ | ✅$0 | — | — | Apache-2 | SAFE | ADOPT | P0 |
| axe-core | a11y | OSS | ✅ | ✅ | ❌ | ✅(Axe) | ✅$0 | — | paid | MPL-2 | SAFE | ADOPT | P0 |
| Semgrep | security | OSS/SaaS | ✅ | ✅ | ✅ | ❌ | 10 contrib $0 | $30/contrib | ent | LGPL/yes | SAFE | ADOPT | P1 |
| OpenRouter | LLM hub | API | ✅ | ✅ | ❌ | ❌ | 25+ free models $0 | 5.5% fee | ent | yes | REVIEW | ADOPT | P0 |
| Groq/Cerebras | LLM fast | API | ✅ | ✅ | ❌ | ❌ | free credit | PAYG | ent | yes | REVIEW | ADOPT | P1 |
| MCP ref servers | integration | OSS | n/a | n/a | n/a | ✅ | ✅$0 | — | — | MIT/Apache | REVIEW | ADOPT | P1 |

Full attribute detail (latency, rate limit, maturity, fallback, use) in the per-category
files. SEC column: SAFE (OSS/no-cred), REVIEW (needs key/ToS review), HIGH RISK (none
recommended). No tool scored REJECT-at-large; per-use REJECT conditions in 18_SECURITY_REVIEW.

---

## 4. ANSWER TO THE 20 QUESTIONS (full reasoning in 20_ADOPTION_ROADMAP)

1. **20 most valuable aux capabilities:** business web research (Firecrawl/Tavily/Exa),
   browser/QA automation (Playwright), visual archaeology (screenshot-to-code study),
   design tokens (Style Dictionary/Tokens Studio), motion stack (GSAP/Lenis), 3D runtime
   (Three.js), free image libraries, image generation (Gemini/OpenAI/FLUX), video
   (Higgsfield), local voice (Kokoro/Piper), forms (Web3Forms), maps (OSM), booking
   (Cal.com), auth/DB (Supabase), payments (Stripe), search (Fuse/Meili), storage/CDN
   (Cloudflare), a11y (axe-core), perf (Lighthouse), security (Semgrep).
2. **20 best free tools:** Playwright, screenshot-to-code, Style Dictionary, GSAP, Lenis,
   Three.js, Unsplash/Pexels/Openverse, Kokoro/Piper, Web3Forms, OSM+Leaflet, Cal.com
   self-host, Supabase free, Fuse.js/Lunr, Meilisearch self-host, Cloudflare R2 free,
   FFmpeg/Sharp, Lighthouse, axe-core, Semgrep free, OpenRouter free models.
3. **20 best premium tools:** Higgsfield Ultra, Runway Max, Veo 3.1, Adobe Firefly,
   ElevenLabs Pro, Meshy Studio, Algolia, Cloudinary, Resend Scale, Clerk Business, Payload
   Enterprise, Mapbox, Shopify Plus, Twilio, Exa Enterprise, Firecrawl Scale, Tavily
   Enterprise, Groq/Cerebras dedicated, Spline Enterprise, Sanctity Enterprise.
4. **Run locally:** FLUX/SD, Kokoro/Piper, Whisper.cpp, Blender, FFmpeg/Sharp, Meilisearch,
   Postgres, Playwright, Semgrep, axe-core, Lighthouse, Cal.com, Payload/Strapi, any OSS lib.
5. **API-based:** Firecrawl, Tavily, Exa, Higgsfield, Runway, ElevenLabs, Stripe, Supabase,
   Algolia, Cloudinary, Resend, Clerk, Maps/Places, image-gen APIs.
6. **MCP-based:** Higgsfield, Algolia (MCP), Cloudinary (MCP), Axe (MCP), Firecrawl
   (agent), Exa (MCP), Playwright/Puppeteer (MCP), GitHub/Postgres/Google-Maps (ref servers).
7. **Agent skills:** Higgsfield skills (`npx skills add higgsfield-ai/skills` — OBSERVED),
   Firecrawl agent-onboarding SKILL.md (OBSERVED), visual-QA judge skill, screenshot-to-code
   local-run skill. Build internal BF skills around each.
8. **Integrate directly (no external dep):** motion libs, 3D libs, Fuse/Lunr, FFmpeg/Sharp,
   axe-core, Lighthouse, Semgrep, OpenRouter-free models, schema.org JSON-LD.
9. **Remain external (API/MCP call):** all paid SaaS; social/Places; Shopify; client-owned
   accounts (Cal.com cloud, Stripe keys).
10. **Reduce cost/site:** local models (image/voice), free image libraries, OSM, Web3Forms,
    Cloudflare free, self-host Meilisearch/Cal.com/Payload, OpenRouter free models,
    Sharp-at-build, reject decorative video (gate on evidence).
11. **Improve visual quality:** Higgsfield director/camera control, FLUX/Recraft for
    brand imagery, screenshot-to-code pattern study, design tokens, Awwwards pattern library
    (already in repo), Rive/Lottie microinteractions, WebGPU where justified.
12. **Improve functional quality:** Supabase (auth/CMS), Stripe (payments), Cal.com
    (booking), Algolia/Meili (search), Cloudinary (media), Resend (email), structured
    modules in `lib/forge/functionalModules.ts`.
13. **Reduce generic AI output:** anti-ai-gate (exists), real business evidence
    (`lib/sources`), screenshot-to-code *study-not-copy*, design tokens from brand, reject
    list, visual critic + distinctness gate (exists).
14. **Awwwards-level interactions:** GSAP ScrollTrigger pinning/horizontal scroll, Lenis,
    custom cursor/magnetic (CRAV/cuberto mechanisms, studied not copied), clip-path masks,
    kinetic type, Rive/Lottie, Three.js configurators — all FREE, gated on business relevance.
15. **Generate product/video/3D:** Higgsfield (video+image+3D), FLUX/Recraft (product img),
    Meshy/Tripo (3D, if gate re-opened), Runway/Veo (video), ElevenLabs (voice, if gate).
16. **Free alt for almost every premium:** every premium above has a free/self-host/OSS
    counterpart (see §2 CORE). The factory default is the free column.
17. **Biggest security risks:** (a) MCP servers with filesystem/network access + credentials
    — review per-server; (b) secret scanners must run before any generated code ships
    (Semgrep Secrets + output_security gate exists); (c) prompt injection via scraped web
    content into research stage — sanitise/isolate; (d) paid-API keys in client repos —
    vault, never commit; (e) OSS supply-chain — Semgrep SCA + `npm audit`.
18. **Integrate immediately (P0):** Firecrawl/Tavily/Exa (research), Playwright (QA),
    Style Dictionary (tokens), GSAP/Lenis/Three.js (motion/3D), free image libs, Web3Forms,
    OSM, Supabase, Stripe, Cloudflare, FFmpeg/Sharp, Lighthouse/axe-core, Semgrep, OpenRouter.
19. **Explicitly NOT integrate:** Midjourney (no API), generic "AI website builder" SaaS
    (defeats determinism), Locomotive Scroll (DEPRECATED — prior research), any tool requiring
    unsafe filesystem MCP with no sandbox, decorative-only video/3D generators, paid tools
    whose free/OSS equivalent already covers the need.
20. **Final ecosystem shape:** a FREE-first determinism core (existing factory + OSS libs +
    local models) wrapped by a thin capability-router that escalates to API/MCP specialists
    (Higgsfield, Firecrawl, Algolia, Cloudinary, ElevenLabs…) ONLY on business evidence, with
    a human gate on PREMIUM and a security scan on every generated artifact. See §5 diagram.

---

## 5. FACTORY PIPELINE + AUXILIARY POPULATION

```
BUSINESSFORGE
   ↓
BUSINESS RESEARCH  ── Firecrawl / Tavily / Exa / Maps·Places / OCR
   ↓
VISUAL INTELLIGENCE ── screenshot-to-code (study) / Playwright screenshot / axe / Lighthouse
   ↓
EXPERIENCE DIRECTOR ── (exists) + Design Tokens (Style Dictionary/Tokens Studio)
   ↓
CAPABILITY ROUTER ── (exists) + provider bindings from 19_CAPABILITY_REGISTRY_PROPOSAL
   ↓
┌───────────────┬───────────────┬───────────────┐
│ ASSET STACK   │ MOTION STACK  │ FUNCTION STACK│
│ Image: Unsplash/│ GSAP         │ Booking:Cal.com│
│  FLUX/Gemini/  │ Lenis         │ Search:Fuse/  │
│  OpenAI/Higgs  │ Rive/Lottie   │  Meili/Algolia│
│ Video: Higgs/  │ View Trans    │ Maps:OSM      │
│  Runway/Veo    │ clip/path     │ Payments:Strip│
│ Audio: Kokoro/ │ kinetic type  │ Auth:Supabase │
│  ElevenLabs    │ cursor/magnet │ CMS:Payload/  │
│ 3D: Three.js/  │ scroll story  │  Sanity      │
│  Meshy(local)  │              │ Email:Resend/ │
│               │              │  Web3Forms   │
└───────┬───────┴───────┬───────┴───────┬───────┘
        ↓               ↓               ↓
WEBSITE BUILDER (exists)
        ↓
BROWSER / PLAYWRIGHT ── render + screenshot
        ↓
VISUAL JUDGES ── multimodal LLM + distinctness gate (exists)
        ↓
FUNCTIONAL QA ── Playwright assertions + structured_data_validation
        ↓
ACCESSIBILITY ── axe-core (exists + Axe MCP optional)
        ↓
PERFORMANCE ── Lighthouse / WebPageTest budgets (exists)
        ↓
SECURITY ── Semgrep + output_security gate (exists) + npm audit
        ↓
ANTI-GENERICITY ── anti-ai-gate + critic + reject list (exists)
        ↓
REPAIR LOOP ── (exists) → back to BUILDER
        ↓
PRODUCTION ── Cloudflare R2/CDN + Stripe live + client accounts
```

---

## 6. EVIDENCE & CONTRADICTIONS

- All price/licence numbers for Higgsfield, Runway, Veo, ElevenLabs, Tripo, Meshy, Spline,
  FLUX, GSAP, Lenis, Three.js, Supabase, Cal.com, Stripe, Web3Forms, OSM, Cloudflare R2
  reused from `bf_research/` VERIFIED live-curl pass (2026-08-19) — NOT re-invented.
- New VERIFIED this pass: Firecrawl/Tavily/Exa pricing, Algolia MCP, Cloudinary Free+MCP,
  Axe MCP, Meilisearch Cloud $20, Clerk free 50k MRU, Semgrep free, OpenRouter free tier,
  screenshot-to-code 74.2k★/MIT, MCP reference servers list.
- No contradictions found with prior research; where prior said UNKNOWN (e.g. Higgsfield
  exact $ from static page), this pass did not fabricate — preserved as UNKNOWN/INFERRED.
- INFERRED used only where source is high-confidence but not re-fetched (marked per claim).

---

## 7. FILE INDEX
00_EXECUTIVE_SUMMARY · 01_RESEARCH_AND_BROWSER · 02_VISUAL_INTELLIGENCE ·
03_DESIGN_SYSTEMS · 04_AWWWARDS_EXPERIENCE_PATTERNS · 05_MOTION_INTERACTION ·
06_IMAGE_ASSETS · 07_VIDEO_ASSETS · 08_AUDIO_VOICE · 09_3D_ASSETS ·
10_FUNCTIONAL_INTEGRATIONS · 11_AI_PROVIDER_MATRIX · 12_MCP_ECOSYSTEM ·
13_AGENT_SKILLS · 14_OPEN_SOURCE_REPOSITORIES · 15_FREE_MEDIUM_PREMIUM_STACK ·
16_LICENSE_MATRIX · 17_COST_MODEL · 18_SECURITY_REVIEW · 19_CAPABILITY_REGISTRY_PROPOSAL ·
20_ADOPTION_ROADMAP · MASTER_AUXILIARY_ARSENAL (this) · SOURCES.md
