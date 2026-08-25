# BUSINESSFORGE — FULL FACTORY AUDIT

_Audit performed 2026-08-17 against commit `06d3ab1` on branch `claude/businessforge-full-audit-lg7ctk`._

**Method.** Every claim below is one of three kinds, labelled explicitly:

| Label | Meaning |
|---|---|
| **FACT** | Verified by reading the code, running it, or measuring its output in this session. Cited to `file:line`. |
| **INFERENCE** | My judgement from the facts. Arguable. |
| **UNKNOWN** | Could not be verified from this repository or this environment. |

No file in the repository was modified. `npm install` was run and
`scripts/generate-examples.ts`, `scripts/renderer-coverage.ts`, `npm test`,
`npm run typecheck`, `npm run build` and `npm run render` were executed. All
artifacts landed in `output/`, which is gitignored (`.gitignore:11`).
`git status --porcelain` is empty.

---

## 0. Read this first — the audit brief does not match the repository

Six premises in the audit brief are **contradicted by the repository**. Stating
them plainly, because most of the requested phases are questions about systems
that do not exist.

| Brief says | Repository shows | Evidence |
|---|---|---|
| Repo at `C:\Users\40728\WebsiteAgent` | This session has a **fresh Linux clone** at `/home/user/WebsiteAgent`. The laptop was never visible. | Phase 10 is therefore **UNKNOWN**, not audited |
| n8n is part of the system | **Zero occurrences** of `n8n` in any file | `grep -ri n8n .` → 0 hits |
| Docker is part of the system | **Zero occurrences** of `docker`/`Dockerfile` | `grep -ri docker .` → 0 hits |
| "Go Sweet" / "River Park Events" are recent projects | **Neither name appears anywhere.** No run artifacts exist at all — `output/` contains only `.gitkeep` | `grep -ri "go sweet\|river park" .` → 0 hits |
| A `designDirector`, creative blueprint, worlds, divergence, candidate generation, jury, quality gate, vision critic, repair loop exist | **None of these exist.** No `blueprint`, no `jury`, no `divergence`, no `world`, no `critic` in code | `grep` for each → 0 hits in `lib/`, `agents/` |
| BusinessForge is a "factory" with a Control Room, Factory Manager and workers | It is a **7-stage linear CLI pipeline**. No control room, no queue, no worker pool, no UI of any kind | `main.ts:169-178`; no HTTP server anywhere |

Also absent: WebGL, Canvas rendering, 3D, video, image generation, vision,
motion/animation output, backend generation, multi-page output, a database, a
job queue, authentication, and any deployment mechanism.

**What BusinessForge actually is (FACT):** a 29,000-line TypeScript CLI that
takes one Google Maps URL, scrapes the listing and the business's existing
website with Playwright, makes **two** LLM calls (strategy, then copy), composes
a deterministic design from lookup tables, and renders **one static HTML page
plus one stylesheet plus copied assets** to disk. Nothing deploys. Nothing
loops. Nothing self-corrects.

**INFERENCE:** the gap between the brief and the code is not the user
misremembering. It reads like the brief describes an intended BusinessForge 2.0
that has been discussed and documented outside the repository (both
`PROJECT_STATUS.md:5` and `NEXT_SESSION.md:6` point at "BusinessForge HQ
(Notion)" as canonical), while the repository holds a much smaller, much more
disciplined v1. The rest of this audit describes the v1 that exists and what it
would take to reach the factory described.

---

## 1. Executive Summary

**What we have.** A genuinely well-engineered *slice* of a website factory. The
engineering discipline is unusually high: one module owns `process.env`
(`lib/config.ts:5`), agents take no ambient dependencies, escaping is enforced by
a branded type rather than by convention (`lib/render/html.ts:18`), the design
layer is byte-deterministic, and — critically — **the project's own
documentation is mostly honest about what does not work.** 248 tests pass,
typecheck and build are clean.

**What works, verified in this session.**
- Stages 1–3 (scrape → collect → normalise): real Playwright, no LLM.
- Stages 4–5 (strategy → copy): real HTTP to four AI vendors, structured outputs.
- Stage 5b (design): real, deterministic, 98.1% of its decisions reach the page.
- Renderer: real, produces valid accessible HTML + CSS from disk with no network call.

**What does not work.**
- **Stage 6 (deploy) throws.** `agents/lovableAgent.ts:33` is
  `throw new NotImplementedError(...)`. I executed it: it throws. Because
  `main.ts:360` has no try/catch, **every full pipeline run exits non-zero after
  writing the site.** The product's headline claim — "one deployed website out"
  (`README.md:3`) — is false.
- **All 38 platform skills are placeholders.** Every one throws
  `SkillNotImplementedError` (`lib/platform/skills/placeholder.ts:56`). That
  includes `vision`, `image-generation`, `deployment`, `database`,
  `authentication`, `payments`, `cms`, `email`, `seo`, `security-scanning`,
  `accessibility-testing` and `playwright`.
- **The MCP stdio transport throws** (`lib/platform/mcp/stdioConnector.ts:70`).

**Why the sites look AI-generated.** Measured, not guessed. I generated all 51
example sites and fingerprinted their visual systems: **51 businesses collapse
into 24 distinct visual systems.** Eight unrelated businesses — a bike shop, a
bookshop, a butcher, a jeweller, a marketing agency, an optician, a generic
retailer and a tattoo studio — receive a **byte-identical** design: same
direction, same density, same hero, same violet `#7c5cb8`, same Manrope. I
screenshotted the optician and the tattoo studio: they are the same page with
different words. The cause is architectural and precise — design is a pure
function of `(industry, keyword votes, content shape)`, industry is one of 17
keyword buckets, each bucket permits only ~3 of 11 themes, and a business with no
brand colour on its site gets its industry's fallback hue. **Two businesses in
one bucket with no brand colour are mathematically guaranteed to be identical.**

**The single most important finding beyond that.** The system has a real,
structurally-enforced anti-invention design in the writer — the schema has no
field for a phone number, an address, or an image URL, so the model *cannot*
invent one (`agents/writerAgent.ts:19-31, 164`). This is the best part of the
codebase and it directly answers the "River Park Events is not near a river"
concern **for contact data**. But it does not extend to prose, and **all
provenance is destroyed at the writer boundary**: `BusinessProfile` carries
`{value, source, sourceUrl, alternatives[]}` per field (`lib/types.ts:221-236`),
and `WebsiteSection` is six plain strings (`lib/types.ts:408-416`). Once copy is
written, nothing knows which sentence rests on which fact.

**Top risks.** (1) No SSRF protection — the collector navigates a real browser to
a URL taken from a third-party Maps listing with only an http/https scheme check
(`agents/collectorAgent.ts:98`), so `http://169.254.169.254/` is reachable.
(2) **No prompt-injection defence at all** — scraped third-party page text is
interpolated raw into both LLM prompts with only length truncation
(`agents/writerAgent.ts:350-355`).

**CTO verdict.** Do not rewrite. The deterministic core (colour, tokens, type
scale, renderer, grounding) is professional work that would be expensive to
rebuild and is not the problem. The problem is that the creative decision space
is a 17×3 lookup table and there is no deployment, no evidence model, and no
feedback loop. Build those four things; keep almost everything else.

---

## 2. Current Architecture

### 2.1 Real shape

```
CLI (main.ts)
  │  npm run dev -- "<google-maps-url>"
  ▼
STAGES  (main.ts:169-178, strictly linear, resumable via --from)
  1 discovery  → 1-discovery.json    Playwright, no LLM
  2 collect    → 2-collected.json    Playwright, no LLM
  3 normalize  → 3-profile.json      pure, no LLM
  4 analyze    → 4-strategy.json     ★ LLM call #1
  5 write      → 5-content.json      ★ LLM call #2
  5b design    → 5b-design.json      pure, deterministic, NO LLM
  – render     → site/               pure; index.html + styles.css + assets
  6 deploy     → ✗ THROWS
```

Beneath it, a **capability platform** (`lib/platform/platform.ts:42-63`) exposing
three subsystems to agents via `ctx.platform`: AI providers (real), skills (all
placeholder), MCP (http real / stdio stub).

### 2.2 Component inventory

Classification key: **REAL** = works, exercised. **PARTIAL** = works, materially
incomplete. **MOCK/STUB** = declared, throws or fakes. **DEAD** = present, never
reached. **DEV-ONLY** = tooling, not product.

| Component | File | Class | Called by | Input | Output | Persisted | Consumed by | In a real run? | Required? | If absent | AI? | Provider |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| CLI / orchestrator | `main.ts` | **REAL** | user | argv | `PipelineResult` | `result.json` | — | yes | yes | nothing runs | no | — |
| `discoveryAgent` | `agents/discoveryAgent.ts` | **REAL** | `main.ts:336` | Maps URL | `DiscoveryResult` | `1-discovery.json` | collector, normalizer | yes | yes | no identity → no run | no | Playwright |
| `collectorAgent` | `agents/collectorAgent.ts` | **REAL** | `main.ts:339` | discovery | `CollectedBusiness` | `2-collected.json`, `assets/`, `content.md` | normalizer | yes | yes | thin profile, run continues | no | Playwright |
| `normalizerAgent` | `agents/normalizerAgent.ts` | **REAL** | `main.ts:342` | both | `BusinessProfile` | `3-profile.json` | analyst, writer, design | yes | yes | no facts | no | — |
| `businessAnalystAgent` | `agents/businessAnalystAgent.ts` | **REAL** | `main.ts:345` | profile | `BusinessStrategy` | `4-strategy.json` | writer, design | yes | yes | writer loses direction | **yes** | configured vendor |
| `writerAgent` | `agents/writerAgent.ts` | **REAL** | `main.ts:348` | profile+strategy | `WebsiteContent` | `5-content.json` | design, render | yes | yes | no copy | **yes** | configured vendor |
| `designAgent` | `agents/designAgent.ts` | **REAL** | `main.ts:351` | all three | `WebsiteDesign` | `5b-design.json` | render | yes | no | renderer falls back to base sheet | **no** | — |
| `renderSite` | `lib/render/` | **REAL** | `main.ts:357` | content+design | HTML+CSS+assets | `site/` | browser / human | yes | yes | no deliverable | no | — |
| `lovableAgent` (deploy) | `agents/lovableAgent.ts:33` | **STUB** | `main.ts:360` | content | — | — | — | **reached, throws** | yes (declared) | **run exits 1** | no | Lovable (unbuilt) |
| AI provider layer | `lib/ai/` | **REAL** | analyst, writer | prompt+schema | JSON | — | agents | yes | yes | stages 4–5 fail | — | 4 vendors |
| ├ anthropic adapter | `lib/ai/providers/anthropic.ts` | **REAL** | factory | — | — | — | — | yes | one of four | — | — | SDK |
| ├ openai adapter | `lib/ai/providers/openai.ts` | **REAL, unproven** | factory | — | — | — | — | **UNKNOWN** | alt | — | — | fetch |
| ├ gemini adapter | `lib/ai/providers/gemini.ts` | **REAL, unproven** | factory | — | — | — | — | **UNKNOWN** | alt | — | — | fetch |
| └ openrouter adapter | `lib/ai/providers/openrouter.ts` | **REAL, unproven** | factory | — | — | — | — | **UNKNOWN** | alt | — | — | fetch |
| Skill registry/manager/loader | `lib/platform/skills/` | **REAL (empty)** | platform boot | config | catalogue | — | nobody | boots, never used | no | nothing changes | no | — |
| 38 built-in skills | `lib/platform/skills/builtin/` | **STUB ×38** | nobody | — | throws | — | — | **no** | no | nothing changes | declared | none |
| MCP manager | `lib/platform/mcp/manager.ts` | **REAL (empty)** | platform boot | config | — | — | nobody | boots, never used | no | nothing changes | no | — |
| MCP http connector | `lib/platform/mcp/httpConnector.ts` | **REAL, unproven** | manager | — | — | — | — | **UNKNOWN** | no | — | no | HTTP |
| MCP stdio connector | `lib/platform/mcp/stdioConnector.ts:70` | **STUB** | manager | — | throws | — | — | no | no | nothing changes | no | — |
| Telemetry | `lib/platform/telemetry.ts` | **PARTIAL** | platform | call events | metrics | run log | status board | yes | no | lose metrics | no | — |
| Browser abstraction | `lib/browser.ts` | **REAL** | stages 1–2 | URLs | DOM/bytes | — | agents | yes | yes | no scraping | no | Playwright |
| Design system | `lib/design/` | **REAL** | designAgent | 3 inputs | `WebsiteDesign` | `5b-design.json` | renderer | yes | no | base stylesheet | no | — |
| Font vendoring | `lib/render/fonts.ts`, `assets/fonts/*.woff2` (34 files) | **REAL** | renderer | design | `@font-face` + woff2 | `site/assets/fonts/` | browser | yes | no | fallback stack | no | — |
| `PageHandle.screenshot` | `lib/browser.ts:240` | **DEAD in product** | only dev scripts | — | png | — | human | **no** | no | nothing | no | Playwright |
| `batch-audit.ts` | `scripts/` | **DEV-ONLY** | human | 5 Maps URLs | metrics+screenshots | `output/batch.json` | human | no | no | lose QA harness | no | Playwright |
| `generate-examples.ts` | `scripts/` | **DEV-ONLY** | human | 51 hand-written fixtures | 51 sites | `output/examples/` | human | no | no | lose review set | **no** | — |
| `renderer-coverage.ts` | `scripts/` | **DEV-ONLY** | human | design | coverage report | stdout | human | no | no | lose the best audit tool | no | — |
| `build-review.ts`, `hue-report.ts`, `screenshot-examples.ts`, `vendor-fonts.ts` | `scripts/` | **DEV-ONLY** | human | — | — | — | human | no | no | — | no | — |
| Dark colour scheme | `lib/design/types.ts:199` | **DEAD** | — | — | — | — | — | **no** | no | nothing | no | — |

**Duplicated systems (FACT).** `playwright` and `browser-automation` are two of
the 38 placeholder skill ids, while real Playwright already works in
`lib/browser.ts`. Likewise `deployment` and `lovable` are placeholder skills
alongside the `lovableAgent` stub, and `seo` is a placeholder skill while SEO
metadata is really produced by the writer. **INFERENCE:** the skill catalogue was
designed as a future capability namespace and now overlaps the real
implementations, which is a naming hazard rather than working code.

**Dead code (FACT).** `ColorSystem.scheme` is typed `'light' | 'dark'`
(`lib/design/types.ts:199`) but `lib/design/tokens.ts:241` hard-codes
`scheme: 'light'`. Nothing in the renderer keys off `[data-scheme]`. All 51
generated sites are light. The `premium` theme's own description — "Dark ground,
precise detail" (`lib/design/themes.ts:365`) — is therefore **false in effect**:
it never renders on a dark ground.

### 2.3 Contradictions found

**Documentation vs code:**

1. `PROJECT_STATUS.md:178-180` — "**No web fonts.** A typeface name becomes the
   first entry in a system stack." **False.** `lib/render/fonts.ts:107` emits
   `@font-face`, `lib/render/write.ts:107-120` copies woff2 files, and the
   generated hotel site ships 5 `@font-face` blocks and 5 woff2 files. Verified.
2. `PROJECT_STATUS.md:192` — "Only the renderer is tested. `npm test` runs 110
   assertions, all in `test/render/`." **False.** 248 tests, and `test/design/`
   holds five suites.
3. `PROJECT_STATUS.md:53` says stage 4 is "✅ verified live"; `PROJECT_STATUS.md:151`
   says "Stage 4's live call has **never run** — no API key was available."
   **Direct self-contradiction inside one file.** Commit `06d3ab1` updated the
   table and left line 151 stale.
4. `scripts/vendor-fonts.ts:7` — "the renderer … base64-inlines only the faces the
   design actually uses." **False.** `lib/render/fonts.ts:119` emits
   `src: url("assets/fonts/…")`; files are copied, not inlined.
5. `lib/design/themes.ts:14-16` — "Font families are named but never fetched: the
   renderer emits a stack and no external request." **Stale.** Fonts are now
   served locally. (The *conclusion* — no external request — still holds.)
6. `agents/designAgent.ts:49-51` — the docstring promises "An unrecognised name is
   ignored with a warning rather than failing the run." **The code does no such
   check:** `designAgent.ts:58-59` casts any `FEATURE_design-direction-*` suffix
   straight to `DesignDirection` with no validation and no warning. A typo
   (`FEATURE_DESIGN_DIRECTION_LUXURIOUS=true`) reaches
   `THEMES[direction]` (`lib/design/themes.ts:430`) as `undefined`, and the run
   crashes on a property access rather than warning. **This is a live latent bug**,
   not just a doc error.
7. `docs/design-intelligence-review.md` §3 lists 10 defects. **Five are now
   fixed** and the document does not say so — variant classes, `layout.order`,
   footer variants, computed columns and web fonts all reach the page now
   (measured). **Five remain true** (see §5).
8. `NEXT_SESSION.md:10` — "The pipeline works end to end." **False** given
   `lovableAgent` throws; and `README.md:3` "one deployed website out" is false.

**Subsystem vs subsystem:** `.env.example` advertises `GOOGLE_MAPS_API_KEY`,
`FIRECRAWL_API_KEY`, `CMS_API_KEY`, `EMAIL_API_KEY`, `PAYMENTS_API_KEY`,
`CALENDAR_API_KEY`, `SOCIAL_API_KEY`, `SEARCH_API_KEY`, `DATABASE_URL` and
`GITHUB_TOKEN`. **Every capability they would credential is a placeholder that
throws.** The configuration surface advertises a platform that does not exist.

---

## 3. Real Execution Trace

**The brief asked me to trace Go Sweet or River Park Events. Neither exists in
this repository, and `output/` is empty (`output/.gitkeep` only).** No run
artifact of any kind is committed — `.gitignore:11` excludes `output/*`. So the
requested trace is **UNVERIFIABLE**, and any claim about those two projects is
**UNKNOWN**.

What I could do instead: trace the code path exactly, and *execute* the parts
that need no credential.

### 3.1 Traced by execution (this session)

| Step | Input | Process | Provider | Output | Next consumer | Status |
|---|---|---|---|---|---|---|
| Design compose | 51 hand-written profiles | `composeDesign` | none — deterministic | 51 `WebsiteDesign` | renderer | ✅ ran |
| Render | content + design | `renderSite` → `writeRenderedSite` | none | 51 × `index.html`+`styles.css`+assets+fonts | browser | ✅ ran |
| Render CLI | `5-content.json` | `main.ts --render` | none | `site/index.html` | browser | ✅ ran |
| Deploy | `WebsiteContent` | `lovableAgent.run` | Lovable | — | — | ❌ **threw `NotImplementedError`** |
| Browser preview | `site/index.html` | Chromium | Playwright | screenshots | human | ✅ ran |

### 3.2 Traced by reading (needs credentials/network — not executed)

| Step | Input | Process | Provider | Output | Persisted | Next consumer |
|---|---|---|---|---|---|---|
| intake | Maps URL from argv | `parseArgs` `main.ts:466` | — | `DiscoveryInput` | — | discovery |
| research (listing) | URL | `normalizeMapsUrl` → Chromium → consent-decline → place pane → ~9 extractors | Playwright | `DiscoveryResult` | `1-discovery.json` | collector |
| research (site) | `discovery.website` | crawl ≤6 pages, images from `<img>` + `srcset` + `data-src` + CSS `background-image`, bot-wall detection | Playwright | `CollectedBusiness` | `2-collected.json`, `assets/`, `content.md` | normalizer |
| evidence | both | merge + dedupe (phones on last 9 digits, images on CDN path **and** SHA-256, text on content hash) + validate | pure | `BusinessProfile` with per-field `{value,source,sourceUrl,alternatives[]}` | `3-profile.json` | analyst, writer, design |
| strategy | profile | `buildBrief` → `provider.generate(STRATEGY_SCHEMA)` | **LLM #1** | category, goals, audience, pages, features, backend/frontend modules, SEO, openQuestions | `4-strategy.json` | writer, design |
| creative direction | profile+strategy+content | `chooseDirection` keyword vote over industry preference list | **none** | 1 of 11 themes | inside `5b-design.json` | tokens, layout |
| copy | profile+strategy | `buildWriterBrief` → `provider.generate(CONTENT_SCHEMA)` → dedupe → **facts re-injected** → CTA resolution → grounding check | **LLM #2** | `WebsiteContent` | `5-content.json` | design, render |
| assets | profile images | `assignImages` cursor: filter map tiles/tiny/product shots, rank, assign hero→gallery→single-image sections | pure | `ImageAsset[]` per section | in `5-content.json` | renderer |
| design tokens | direction+industry+content | OKLCH ramps, modular type scale, spacing, radius, elevation, motion | pure | `WebsiteDesign` | `5b-design.json` | renderer |
| layout | content+industry+theme | hero veto walk, per-section variant scoring, frame anti-repeat, background rhythm, industry reorder | pure | `LayoutPlan` | in `5b-design.json` | renderer |
| build | content+design | `renderSite` | pure | `RenderedSite` | — | writer |
| write | `RenderedSite` | `writeRenderedSite` with path-escape guard | pure | `site/` on disk | `site/` | browser |
| **screenshots** | — | — | — | — | — | **DOES NOT EXIST in pipeline** |
| **vision** | — | — | — | — | — | **DOES NOT EXIST** |
| **critic** | — | — | — | — | — | **DOES NOT EXIST** |
| **repair** | — | — | — | — | — | **DOES NOT EXIST** |
| deploy | content | `lovableAgent.run` | — | — | — | **THROWS** |

### 3.3 The crash, precisely

`main.ts:356-361`:

```
if (STAGES.indexOf('render') >= firstIndex) await renderStage(run, content, design);
const deployment = await step('deploy', () => lovableAgent.run(content, …));
```

There is no `try` around the deploy step — only `finally { run.dispose() }`
(`main.ts:381`). So on **every** full run:

1. `site/` **is written** — the actual deliverable exists on disk.
2. `lovableAgent.run` throws.
3. `6-deployment.json` is never written; `result.json` is never written;
   `runPipeline` never returns.
4. `main()`'s catch prints `[lovableAgent] Not implemented: lovableAgent.run` and
   sets `process.exitCode = 1` (`main.ts:619-625`).

**INFERENCE:** this is why the pipeline can be described as "working end to end"
in `NEXT_SESSION.md:10` and as a stub in `PROJECT_STATUS.md:57` at the same time
— the artifact is produced, but the process reports failure. Any automation
wrapping this CLI and checking the exit code sees every run as a failure.

### 3.4 What "screenshots → vision → critic → repair" actually is

**FACT.** Screenshots exist only in two dev scripts. `scripts/batch-audit.ts`
launches Chromium, forces image decode, captures desktop-fold, desktop-full and
mobile, and evaluates a DOM measurement script (`batch-audit.ts:114-144`)
returning broken-image count, horizontal overflow, header height, h1 size and
font, per-section height/word/image counts, CTA counts. It writes
`output/batch.json`.

That is a **metrics harness with a human critic**. It emits numbers; it makes no
judgement, has no thresholds, no pass/fail gate, and nothing consumes its output
programmatically. `scripts/build-review.ts:4` reads `output/scores.json` — "the
qualitative scorecard" — which is **not produced by any script in the
repository**. **INFERENCE:** it is hand-written by a person. The QA loop is a
human reading a dashboard.

---

## 4. AI Provider Audit

### 4.1 What is real

**AI REAL — text generation, two call sites.** `lib/ai/` is a clean
provider-agnostic layer: one `AIProvider` interface (`lib/ai/types.ts:87-97`),
four adapters, selected by `AI_PROVIDER`.

| Provider | Transport | Default model | Native schema | Effort mapping | Live-proven? |
|---|---|---|---|---|---|
| anthropic | `@anthropic-ai/sdk`, streaming | `claude-opus-5` | yes (`output_config.format`) | passed verbatim | **INFERENCE: yes** — the only adapter with vendor-specific bug handling (refusal, `max_tokens`, server-side fallback beta `anthropic.ts:41`) |
| openai | raw `fetch` | `gpt-5` | yes | `xhigh`/`max` clamped to `high` | **UNKNOWN** — `PROJECT_STATUS.md:161` says never run live |
| gemini | raw `fetch` | `gemini-3.6-flash` | yes (OpenAPI subset via `toGeminiSchema`) | mapped to `thinkingBudget` | **UNKNOWN** — same |
| openrouter | raw `fetch` | `openai/gpt-5` | yes | clamped | **UNKNOWN** — same |

Quality markers that are genuinely good (FACT):
- Retry with exponential backoff **and full jitter**, honouring each adapter's own
  `retryable` classification, and refusing to resurrect an aborted run
  (`lib/ai/factory.ts:126-155`).
- Gemini's response is validated against the **original** JSON Schema, not the
  lossy translated one (`gemini.ts:148`) — a real correctness detail.
- Refusal and truncation are distinguished from transport failure and are
  **non-retryable** (`anthropic.ts:143-155`).
- `health()` probes a listing endpoint, costing no tokens (`anthropic.ts:174`).
- Credentials never leave `lib/config.ts`; `platform.describe()` reports variable
  **names only** (`platform.ts:223`).

**Tasks the AI actually receives — exactly two:**
1. `businessAnalystAgent`: profile brief → strategy object (`STRATEGY_SCHEMA`,
   `businessAnalystAgent.ts:97-148`).
2. `writerAgent`: profile+strategy brief → copy object (`CONTENT_SCHEMA`,
   `writerAgent.ts:164-221`).

### 4.2 Behaviour without an API key

**FACT, and this is a design strength.** Validation is deliberately deferred out
of `loadConfig` (`lib/ai/factory.ts:9-14`), so stages 1–3 run with no credential
at all. `platform.ai()` throws `MissingProviderError` / `UnsupportedProviderError`
/ `MissingApiKeyError` **naming the exact variable to set**, before any network
call. There is **no silent fallback to a mock and no degraded text path** — a
missing key fails the run loudly. Correct.

### 4.3 AI DECLARED but NOT IMPLEMENTED

All in `lib/platform/skills/builtin/`, all throwing `SkillNotImplementedError`:

| Capability | Declared id | Stated blocker |
|---|---|---|
| **vision** | `vision` | "needs multimodal input on the AIProvider contract, which is text-only today" (`media.ts:20`) |
| **image generation** | `image-generation` | "needs an image-model contract; the provider layer generates text only" (`media.ts:34`) |
| OCR | `ocr` | engine not chosen |
| speech | `speech` | no audio contract |
| translation | `translation` | no glossary mechanism |
| embeddings / vector store | `embeddings`, `vector-store` | — |
| security scanning | `security-scanning` | — |
| accessibility testing | `accessibility-testing` | — |
| SEO | `seo` | — |
| deployment | `deployment`, `lovable` | — |
| database / auth / payments / CMS / email / calendar | 6 ids | — |

### 4.4 AI INEXISTENT — not even declared

**FACT.** No file, no enum entry, no comment, no placeholder for:
**video generation**, **3D generation**, **WebGL**, **motion/animation
generation**, **frontend code generation** (the renderer is hand-written
TypeScript emitting a fixed component set — no model writes markup),
**backend code generation** (the analyst *names* backend modules as strategy
prose at `businessAnalystAgent.ts:129-132`; nothing generates them),
**creative direction by model** (`designAgent.ts:9-13` states explicitly that it
makes no model call, by design).

### 4.5 AI MOCK

**FACT: there are no AI mocks anywhere.** No fake provider, no canned response,
no fixture-replay. **INFERENCE:** this is a point in the project's favour and is
also why the AI layer has zero tests (§9.6) — there is no seam to test against.

### 4.6 Summary table

| Category | Contents |
|---|---|
| **AI REAL** | Text/JSON generation via 4 adapters. Anthropic proven; other 3 **UNKNOWN**. Exactly 2 tasks: strategy, copy. |
| **AI FALLBACK** | Provider→provider fallback: **none in code** (Anthropic's *server-side* `fallbacks: 'default'` is the vendor's, `anthropic.ts:41`). Retry-same-provider: real. No-key fallback: **none — fails loudly**. |
| **AI DECLARED** | 38 skill ids incl. vision, image-generation, OCR, speech, embeddings, security-scanning, a11y-testing, SEO, deployment, database, auth, payments, CMS, email. All throw. |
| **AI MOCK** | none |
| **AI INEXISTENT** | video, 3D, WebGL, motion, frontend codegen, backend codegen, model-driven creative direction |

**Cost tracking (FACT): none.** `AITokenUsage` is captured
(`lib/ai/types.ts:54-57`) and logged at `debug` (`writerAgent.ts:1009-1016`), then
discarded. Telemetry records calls, failures, availability and latency only
(`lib/platform/types.ts:203-219`). No pricing table, no per-run cost, no budget,
no cap. **INFERENCE:** the `$0.00 per site` claim in `NEXT_SESSION.md:11` is a
statement about the Gemini free tier, not a measurement the system can make; it
is also inconsistent with the `claude-opus-5` default at `lib/config.ts:252`.

---

## 5. Design Pipeline Audit

### 5.1 What changed between generic sites and the recent results

**FACT, from `docs/design-intelligence-review.md` §3 cross-checked against
current code.** The improvement was **not** better creative intelligence. It was
**connecting an already-built design layer to the renderer.** The layer computed
correct decisions and the renderer discarded them at the boundary. Five specific
reconnections, all now verified live in the current code:

| Fix | Then | Now (measured this session) |
|---|---|---|
| Variant classes emitted | none | `class="section section--gallery section--grid"`, `section--services section--feature-grid` |
| Hero variants distinct | 5 names → 1 composition | hotel `hero-full-bleed`, law `hero-editorial`, optician `hero-split` |
| `layout.order` honoured | discarded | design plan order == DOM order, exactly |
| Computed columns | CSS used `auto-fit` | 7 `--columns` usages |
| Web fonts | 18 families → 2 fallbacks | 5 `@font-face` + 5 woff2 shipped per site |

Plus the seven token-collision fixes documented at
`docs/design-intelligence-review.md` §"Defects found": page background, section
rhythm, type scale, container width, card padding, elevation, and 61 WCAG AA
failures — all were `--token` name collisions between the base sheet and the
design block, fixed with the `var(--design-token, old-value)` two-name form.

**I independently confirmed the layer now reaches the page.**
`scripts/renderer-coverage.ts` measures by *perturbation* — mutate each leaf
field, re-render, diff. Result: **132 visual fields, 127 fully used, 5 partially,
0 ignored → 98.1% visual coverage.**

**INFERENCE — this is the single most important design finding.** The renderer is
**not** the bottleneck any more. Every knob the design layer turns reaches the
browser. The remaining problem is that **there are not enough distinct knob
settings**, and that is upstream of the renderer entirely.

### 5.2 Why it still looks AI-generated — measured

I generated all 51 example sites and fingerprinted each on
`(direction, density, hero, brand hex, heading family)`.

**51 businesses → 24 distinct visual systems.**

| Count | Direction | Density | Hero | Brand | Font | Businesses |
|---|---|---|---|---|---|---|
| **8×** | modern | balanced | split | `#7c5cb8` | Manrope | bike-shop, bookshop, butcher, jewellery, marketing-agency, optician, retail, tattoo-studio |
| **5×** | corporate | balanced | split | `#8c6d08` | IBM Plex Sans | construction, electrician, interior-design, landscaping, plumbing |
| **5×** | friendly | balanced | split | `#3e71bc` | Nunito Sans | funeral-director, music-school, nursery, pet-grooming, photography |
| **4×** | corporate | balanced | split | `#2a78ac` | IBM Plex Sans | medical-clinic, pharmacy, physiotherapy, veterinary |
| 3× | luxury | airy | full-bleed | `#3b7f78` | Cormorant Garamond | boutique-hotel, hotel, wedding-venue |
| 3× | bold | balanced | full-bleed | `#d3013d` | Archivo | brewery, cocktail-bar, wine-bar |
| 2× ×5 | — | — | — | — | — | accountant/recruitment, automotive/driving-school, estate-agent/real-estate, florist/garden-centre, gym/yoga-studio |

Only 22 distinct brand colours across 51 sites. All 51 are light scheme.

I screenshotted the **optician** and the **tattoo studio** side by side. Identical
grey sticky header, identical lavender wordmark, identical split hero with the
placeholder block right, identical 3+2 card grid, identical lavender button. The
only difference is the words. A funeral director and a nursery school get the
same site. A tattoo studio and an optician get the same site.

### 5.3 The exact mechanisms producing that

Six, in causal order. Each is a named line of code.

**M1 — Industry is a 17-bucket keyword match, and it is the root of everything.**
`lib/design/industries.ts:75-92` is 16 ordered rules plus `general`.
First-match-wins over the Maps category, then strategy category, then services,
then name. Everything downstream — directions, density, image reliance, section
priority, variant hints, fallback hue — is a lookup on that one id
(`INDUSTRY_DEFAULTS`, `industries.ts:102-318`). **A jeweller, a butcher, a
bookshop and a tattoo studio all resolve to `retail`**, and therefore to one
design. Verified: `photography` resolves to `general` with basis `fallback` —
there is no keyword for it, and no `creative` industry exists.

**M2 — Each industry permits only ~3 of 11 themes, and eligibility is a hard
veto.** `compose.ts:164-166`: `preferences.map(...)` — the ranked list is built
**only from the industry's own `directions` array**. Copy keyword votes
(`compose.ts:86-112`) can only **reorder within that list**. The comment at
`compose.ts:162-163` is explicit: "a law firm whose copy says 'fun' still should
not get the playful theme." **Effective design space ≈ 17 × 3 = 51 coordinates**,
before content narrows it further. That is the whole creative universe.

**M3 — No brand colour means the industry's hue, and most businesses have no
brand colour.** `compose.ts:255-266` looks for a hex in `content.voice.palette`,
then any hex in scraped page text; failing both it takes
`defaults.fallbackHue`. A business with no crawlable website — **3 of 5 in the
project's own real batch** (`NEXT_SESSION.md`) — has no hex to find. So the
colour is the *category's* colour, not the *brand's*. Two same-bucket businesses
are then identical by construction.

**M4 — Determinism is enforced as an architectural principle, which forecloses
divergence.** `compose.ts:5-21`: "No clock, no randomness, no model call… the
same three inputs always produce a byte-identical design," and "a pipeline with a
feedback loop in it is one where the output depends on iteration count." This is
excellent *engineering* and it is precisely what makes candidate generation,
divergence, juries and repair loops impossible without changing the contract.
**There is no seam for exploration.** The one seam that exists —
`ComposeOptions.direction` (`compose.ts:62-69`), explicitly documented as where a
model-driven art director would plug in — is currently reachable only by an
environment variable, and that path is the unvalidated-cast bug in §2.3(6).

**M5 — Composition is one page object.** Verified in the generated markup: sticky
grey header → hero → N sections each `section__head` + content, backgrounds
alternating canvas/subtle (`layout.ts:313-335`) → footer. Frames vary the
silhouette (`aside`/`offset`/`stacked`/`centered`/`statement`,
`layout.ts:240-266`) and an anti-repeat rule stops three identical frames in a row
(`layout.ts:280-299`) — real sophistication. But the **envelope never changes**:
every section is a full-width horizontal band in document order. No overlap, no
asymmetry, no bleed between sections, no pinned column, no diagonal, no
type-on-image beyond the hero overlay.

**M6 — There is no motion, no interaction and no JavaScript.** FACT, measured on
the generated output: the only `<script>` is `application/ld+json`
(`document.ts:106`) — data, not code. In 578 lines of generated CSS there are
**zero `@keyframes`**, two `transition` declarations (the skip link and a button
hover), and one `prefers-reduced-motion` reset block. Meanwhile the design layer
computes `tokens.motion.level`, `durationFast/Base/SlowMs`, `easing`, and an
`effects` array of `['fade','rise','scale','stagger']` (`themes.ts:78`), and
`renderer-coverage` reports all of them **USED** — meaning they are emitted as
custom properties and *published to the page*. **INFERENCE:** the motion
vocabulary is declared, published, and has almost nothing consuming it. `fade`,
`rise`, `scale` and `stagger` name entrance animations that require either
`@keyframes` + `animation` or an IntersectionObserver, and neither exists.

### 5.4 Defects from the project's own review that are still true

Verified against current code, not taken on trust:

- **Mid-tier type hole.** `.section__subheading` is hard-coded
  `clamp(1.0625rem, 1rem + 0.4vw, 1.25rem)` in the generated CSS regardless of
  direction. A 143px editorial display headline is still followed by a ~19px
  subheading. **STILL TRUE.**
- **Taxonomy too small.** 17 ids, no `creative`; photography → `general/fallback`.
  **STILL TRUE.**
- **Accents that argue with the brand.** `friendly.accentHueShift: 200`
  (`themes.ts:406`) unchanged. Measured result: bakery brand `#986600` (honey
  gold) with accent `#5e68bc` (periwinkle). **STILL TRUE.**
- **Alt text rendered as visible captions.** **UNKNOWN** — not re-verified.
- **The card is one bordered box everywhere.** Confirmed visually on the optician
  and tattoo pages: same bordered box on services. **STILL TRUE.**

### 5.5 What is genuinely good and must be kept

- **The colour system.** OKLCH perceptual ramps with contrast *constructed*
  rather than checked, 17 hues each traced to a real anchor colour with the
  derivation in a comment (`industries.ts:102-318`), and a test enforcing ≥20°
  separation between industries sharing a first direction. This is professional.
- **The type scale.** One ratio per direction (1.2 corporate → 1.5 editorial)
  producing 40px–143px display. The law firm at Playfair 143px against the
  clinic at IBM Plex 40px is a *real* difference in voice.
- **Content-aware variant vetoes.** `supports()` (`layout.ts:130-164`) refuses a
  bento below 5 items, masonry below 4 images, alternating without one image per
  item. This is what stops embarrassing near-empty grids, and it is the right idea.
- **The rationale trail.** Every decision carries a `rationale` string; `notes[]`
  records every compromise. A bad output is diagnosable.
- **Determinism + snapshots.** A visual regression is a readable diff.
- **Accessibility.** Skip link with `tabindex="-1"` target, one `<h1>`, named
  landmarks, no invented alt text, 44px tap targets, no mobile overflow.

### 5.6 Verdict

| Layer | Grade |
|---|---|
| Colour / contrast / token generation | **Professional** |
| Typography scale | **Professional**, now that faces arrive |
| Accessibility & semantics | **Good** |
| Determinism & diagnosability | **Excellent** |
| Composition | **Template** — 51 businesses, one page object |
| Motion / interaction | **Absent** |
| Art direction | **Absent** — no concept, no metaphor, no restraint-as-choice |

---

## 6. Human-Made / AI-Slop Analysis

The brief asks what is missing to look like a very good human studio, tied to the
architecture. Each item names the specific architectural reason.

| Dimension | Present? | The architectural reason |
|---|---|---|
| **Art direction** | ✗ | There is no artefact representing "the idea for this site." `WebsiteDesign` is tokens + a layout plan. A studio starts from a concept that then *decides* the tokens; here tokens are decided by `industry`, and nothing upstream of them exists. |
| **Creative concept** | ✗ | No stage produces one. `designAgent` is explicitly non-AI by design (`designAgent.ts:9-13`). |
| **Visual metaphor** | ✗ | Nothing in `WebsiteDesign` can express "this site behaves like X". No shape vocabulary, no illustration, no custom graphic primitive. |
| **Storytelling** | Partial | The writer's prompt asks for concrete detail and forbids brochure language (`writerAgent.ts:242`) — genuinely good. But `sections` is a flat list of typed blocks; there is no narrative arc, no reveal, no pacing structure. |
| **Composition** | ✗ | Every section is a full-width band in document order (M5). No overlap, asymmetry, bleed, or pinned column is expressible. |
| **Typography craft** | Partial | Scale, tracking, measure: real. Missing: the mid-tier step (§5.4), any per-face optical adjustment, any pull quote / drop cap / marginalia / mixed-size line breaking. |
| **Visual rhythm** | Partial | `assignBackgrounds` + `assignFrames` vary ground and silhouette deliberately. But rhythm is only *vertical alternation* — no change of tempo, no compression before a climax. |
| **Interaction design** | ✗ | **Zero JavaScript emitted.** No disclosure, no tabs, no filter, no lightbox, no form. Mobile nav wraps as two rows of links because a disclosure button would need JS. |
| **Motion design** | ✗ (declared) | `motion.effects: ['fade','rise','scale','stagger']` is computed and published as CSS custom properties; **no `@keyframes` and no observer exist to consume it.** |
| **Loading sequences** | ✗ | Static file, no JS. Nothing to sequence. `font-display: swap` is the only load-time behaviour. |
| **Scroll choreography** | ✗ | Requires JS or `scroll-timeline`. Neither present. |
| **Micro-interactions** | ✗ | Two `transition` rules total in the whole stylesheet. |
| **Cursor interactions** | ✗ | Nothing. |
| **2D animation / Canvas / WebGL / 3D** | ✗ | No `<canvas>`, no shader, no library, not even a placeholder skill. (`canvas` in the codebase is a **colour token name** — the page background — not the element.) |
| **Photography direction** | ✗ | `assignImages` (`writerAgent.ts:779-838`) *selects* from what was scraped and filters map tiles, tiny icons and product shots — good defensive work. It cannot *direct*: no crop intent, no subject detection (that would need `vision`, a placeholder), no art-directed pairing, no generation for a business with no photos. For the 3-of-5 businesses with no website, there are **no images at all**. |
| **Sound** | ✗ | Nothing, and correctly so. |
| **Responsive art direction** | Partial | Fluid + one mobile column + breakpoints. But the *same* composition scales down; no layout is re-conceived for small screens. |
| **Transitions between states/pages** | ✗ | One page, no states. |
| **Surprise** | ✗ | Determinism forecloses it (M4). Identical inputs → identical bytes is the stated contract. |
| **Restraint** | Simulated | `luxury`/`minimal` have low chroma and wide margins — restraint as *parameters*. Studio restraint is *choosing to omit something the brief asked for*, which requires a judgement stage that does not exist. `docs/design-intelligence-review.md` names the symptom: "The luxury spa's restraint reads as emptiness rather than as confidence." |
| **Negative space** | Partial | Generous section padding. But §5.4's "left-rail syndrome" — heading pinned left with 40–60% of the width empty — is unused space, not composed space. |
| **Originality** | ✗ | 24 visual systems for 51 businesses. |
| **Brand specificity** | ✗ | This is the crux. The design is a function of **category**, not of **brand**. The only brand-specific input to the entire visual system is a hex code scraped from page text — and it is usually absent. |

**The one-sentence version (INFERENCE).** BusinessForge currently produces
*category-appropriate* design, and category-appropriate design executed
consistently is exactly what "AI slop" means: nothing is wrong, and nothing could
only belong to this business.

---

## 7. Truth & Evidence Audit

**This is the strongest part of the codebase and it has a specific, locatable
hole.**

### 7.1 What is genuinely enforced

**FACT — invention is prevented structurally, not by instruction.**
`agents/writerAgent.ts:19-31` states the principle: "A model told 'do not invent a
phone number' usually complies; a model that is never asked for one cannot fail."
Implemented as:

1. **`CONTENT_SCHEMA` has no field for a fact.** No phone, no address, no email,
   no image URL, no href, no structured data (`writerAgent.ts:164-221`). The
   model is never given a slot to fill.
2. **Data sections are overwritten after generation.** `hours` and `contact`
   bullets are **replaced** with profile-derived values regardless of what the
   model wrote (`writerAgent.ts:1093-1097`).
3. **CTAs are a closed intent enum resolved from the profile.** The model says
   `'phone'`; `resolveCta` (`writerAgent.ts:847-878`) looks up the real number and
   returns `null` if none exists, and the button is dropped with a warning. A
   "Call us" button cannot exist for a business with no number — and a
   `javascript:` href cannot come from the model at all.
4. **JSON-LD is built from verified fields only** (`writerAgent.ts:611-671`).
   `aggregateRating` is omitted when the review count is missing, because
   schema.org requires both. The rationale is right: structured data is read by
   machines that repeat it unchecked.
5. **`groundingWarnings`** (`writerAgent.ts:917-967`) reads every output string
   back and flags any email, host or 9+-digit run not in the profile. It
   **reports rather than edits** — deliberately, so a run stays reviewable.
6. **The system prompt has a specific prohibition list** — awards, founding year,
   prices, staff counts, certifications, delivery/parking/booking/payment,
   testimonials, hours in prose (`writerAgent.ts:229-240`) — plus "A shorter
   honest page beats a fuller invented one."
7. **`unresolvedGaps`** is where uncertainty is routed, and the code **adds
   gaps the data proves** on top of the ones the model noticed
   (`writerAgent.ts:1123-1143`).
8. **The name is taken from the profile, not the model's rendering of it**
   (`writerAgent.ts:1147`).
9. **Bot-verification walls are detected and skipped, never solved**
   (`collectorAgent.ts:78-83`) — specifically to keep "confirm you are human" out
   of the copy.
10. **`rankEmails`** (`writerAgent.ts:516-552`) refuses to print another company's
    domain and demotes `press@`/`jobs@`. The comment is the right insight:
    "Truthfulness was never the problem here. Editorial judgement was."

### 7.2 Where unverified information can still become a factual claim

Six holes, ordered by severity.

**H1 — The taxonomy has no FACT/INFERENCE distinction.** `FieldSource` is
`'maps' | 'website'` (`lib/types.ts:219`). That is *where it came from*, not *how
much it can be trusted*. There is no confidence, no verification status, no
`inferred` marker on a profile field. The strategy has a two-value `basis:
'listing' | 'inferred'` (`businessAnalystAgent.ts:103-107`) — the only place the
distinction exists anywhere, and it applies to one field.

**H2 — Provenance is destroyed at the writer boundary. This is the central
defect.** `BusinessProfile` fields are `Attributed<T> = {value, source, sourceUrl,
alternatives[]}` (`lib/types.ts:221-236`). `buildWriterBrief`
(`writerAgent.ts:302-385`) **flattens all of it into prose** —
`` `Name: ${profile.name.value}` `` — dropping source and alternatives before the
model sees them. And `WebsiteSection` is `{kind, heading, subheading, body,
bullets, images, callToAction}` — **six plain strings, zero provenance**
(`lib/types.ts:408-416`). After stage 5, **no component can answer "what is this
sentence based on?"** Every downstream consumer, including the renderer and any
future QA, sees assertion without evidence.

**H3 — `groundingWarnings` catches only mechanically detectable classes.** It
admits this (`writerAgent.ts:906-910`): "no cheap check can tell whether 'we mill
our own flour' is true." It catches emails, hosts, and long digit runs. It cannot
catch **"River Park Events sits beside the water"** — no email, no URL, no digits.
This is exactly the user's stated example, and it passes every existing check.

**H4 — The name is an uncontrolled inference source.** The prohibition list
(`writerAgent.ts:229-240`) forbids awards, prices, years, staff counts,
credentials and amenities. **It does not forbid inferring anything from the
business name.** Meanwhile the prompt *actively invites* place-inference: "Write
the orientation copy a local would find useful — the neighbourhood, the nearest
cross street, what the category means in practice" (`writerAgent.ts:274`). Given
`Name: River Park Events` and an address, "beside the river" is the statistically
obvious completion, it is invited by the prompt, and nothing blocks or flags it.
`unresolvedGaps` is voluntary.

**H5 — Scraped text is trusted as the business's own voice.** The writer brief
labels page text "**What the business says about itself (verbatim, from its own
site)**" (`writerAgent.ts:351`). The collector extracts visible text from up to 6
pages. That text can include a cookie banner, a third-party widget, an
embedded review from a *different* business, or an old tenant's copy. The
collector filters *some* non-content paths (`SKIP_PATH`,
`collectorAgent.ts:75`) and non-profile social links, but the page body is taken
wholesale. **The `emails` case proves the general risk is real and already
observed**: `rankEmails`' comment records that a live run surfaced
`info@tartinemanufactory.com` — "belongs to a *different business*" — from the
scraped site. The same contamination applies to prose, with no equivalent guard.

**H6 — The strategy's `evidence[]` is model-authored and never verified.** Each
recommendation carries an `evidence` array that must "Quote or name" supporting
facts (`businessAnalystAgent.ts:65-67`). **Nothing checks that those quotes appear
in the profile.** `assertStrategyShape` (`businessAnalystAgent.ts:261-287`) checks
only that keys are present. So the evidence trail is a *claim about* evidence.

### 7.3 Proposed evidence/truth architecture (design only — not implemented)

**A five-level claim lattice, carried end to end.**

```
FACT              a value read from a named source, with the source URL and the
                  raw text span it was read from. Publishable as an assertion.
INFERENCE         derived from ≥1 FACT by a named, inspectable rule.
                  Publishable ONLY with hedged language, or not at all.
CREATIVE          a subjective statement carrying no factual content
                  ("unhurried", "worth the walk"). Publishable freely.
UNVERIFIED        plausible, no source. NEVER publishable. Routes to gaps.
FORBIDDEN         a claim class that is illegal/regulated for this category
                  even when sourced (medical outcomes, legal guarantees, prices,
                  "best", certifications). Blocked regardless of evidence.
```

**Four architectural changes, in dependency order.**

1. **Make `FieldSource` a `Provenance` record.** Replace
   `'maps' | 'website'` with `{ kind: 'listing'|'own-site'|'third-party'|'derived',
   sourceUrl, retrievedAt, textSpan: [start,end], extractor: string,
   confidence: number, claimLevel: ClaimLevel }`. The `textSpan` is the key
   addition — it makes every fact re-checkable against the captured page text
   without re-scraping.

2. **Introduce a `ClaimSet` between the writer and the renderer.** This is the
   missing artefact. The writer stops emitting prose strings and emits
   *claims*:
   ```
   Claim = { id, text, level: ClaimLevel, supports: FactId[],
             rule: string|null, hedged: boolean }
   Section = { kind, heading: Claim, body: Claim[], bullets: Claim[], … }
   ```
   `WebsiteContent` becomes a projection of a `ClaimSet`, so the renderer can
   still be a pure function of strings while the evidence survives to QA,
   review and the client-facing report.

3. **Add an Evidence Worker (deterministic, no model) between writer and
   render.** It does what `groundingWarnings` does, generalised, and it is a
   **gate** rather than a log:
   - **Entity-name guard** — tokenise the business name; for each token that is a
     geographic, temporal, material or superlative noun (`river`, `park`,
     `royal`, `1892`, `oak`, `premier`), require that any copy asserting that
     property cites a FACT other than the name itself. This is the direct answer
     to the River Park case, and it is a lexicon plus a lookup, not a model.
   - **Span verification** — every FACT-level claim must have `supports` resolving
     to a `textSpan` whose text still contains the asserted value.
   - **Category prohibition lists** — per-industry FORBIDDEN classes
     (medical/legal/financial are strict), enforced by pattern, blocking.
   - **Hedge enforcement** — an INFERENCE-level claim must carry hedging
     ("appears to", "the listing shows") or be demoted to gaps.
   - **Third-party contamination check** — reject any claim whose supporting span
     comes from a page region whose domain, or whose adjacent entity name, does
     not match the business.

4. **Split the writer in two.** A **Content Planner** that selects *which claims
   to make* from the `FactStore` (deterministic or model-with-citations-required),
   and a **Prose Writer** that may only phrase claims it was handed and may not
   introduce new nouns. This is the same trick already used successfully for
   contact data — remove the ability rather than forbid the behaviour — applied to
   prose.

**Also worth fixing cheaply (INFERENCE):** add a `FORBIDDEN`-style rule that the
business name may never be used as evidence for a property of the place, and make
`unresolvedGaps` mandatory rather than voluntary for any section whose claims are
all INFERENCE.

---

## 8. Website Completeness Audit

Current output: **one static HTML page, one stylesheet, copied images, vendored
woff2. No JavaScript. No server. No database.**

| Category | Status | Evidence / note |
|---|---|---|
| FRONTEND | **PARTIAL** | One page, semantic HTML5, fluid CSS, no JS. `WebsiteContent` has `sections`, not `pages` (`PROJECT_STATUS.md:170`) — multi-page needs a contract change. |
| BACKEND | **NONE** | Analyst *names* backend modules as prose; nothing generates any. |
| DATABASE | **NONE** | `database` is a placeholder skill. `DATABASE_URL` is credentialled for nothing. |
| AUTHENTICATION | **NONE** | placeholder skill |
| ROLES / PERMISSIONS | **NONE** | not even declared |
| CMS | **NONE** | placeholder skill. Editing means editing `5-content.json` and re-rendering. |
| FORMS | **NONE** | no `<form>` anywhere. Contact is `tel:`/`mailto:` links only. |
| EMAIL | **NONE** | placeholder skill |
| BOOKING / CALENDAR | **NONE** | placeholder skill. Real gap: hotels and salons need it. |
| PAYMENTS / ECOMMERCE | **NONE** | placeholder skill |
| SEARCH / FILTERING | **NONE** | needs JS |
| UPLOADS / USER ACCOUNTS / DASHBOARDS / ADMIN | **NONE** | — |
| ANALYTICS | **NONE** | placeholder skill. Also a deliberate consequence of "no external request". |
| SEO | **REAL** | title, description, keywords, OG, Twitter card, `theme-color`, empty fields omitted rather than blanked (`document.ts:61-107`) |
| SCHEMA.ORG | **REAL, good** | `LocalBusiness` + 16 narrower types, verified fields only, keys sorted, `</script>` neutralised (`html.ts:204-212`) |
| ACCESSIBILITY | **PARTIAL, good for what it covers** | skip link + `tabindex="-1"`, one `<h1>`, landmarks, `role="list"`, no invented alt, 44px targets, AA contrast constructed not checked, `prefers-reduced-motion`. **Never validated by axe or the W3C validator** (`PROJECT_STATUS.md:194`). |
| GDPR / COOKIES | **N/A → REAL by construction** | no cookies, no third-party requests, no analytics. The strongest privacy posture available, achieved by having no features. |
| SECURITY (output) | **REAL** | branded `Html` type, `safeHref` blocks `javascript:`/`vbscript:`/`data:text/html` (tested), path-escape guard on write (`write.ts:57-61`) |
| SECURITY (pipeline) | **WEAK** | §9 |
| RATE LIMITING | **NONE** | no server to limit; no politeness limiting on scraping either |
| SECRETS | **REAL** | single `process.env` reader, names-only in logs, `.env` gitignored, no committed keys (scanned) |
| BACKUPS | **NONE** | artifacts are local files under `output/` |
| MONITORING | **PARTIAL** | health + telemetry per capability; nothing exports it |
| ERROR HANDLING | **REAL, good** | `AgentError` taxonomy with honest `retryable`; degrade-and-report rather than throw throughout the renderer and design layer |
| LOGGING | **REAL** | NDJSON to file + console, per-run scoped, `logger.time` spans |
| PERFORMANCE | **REAL by construction** | one HTML + one CSS + local fonts, zero external requests, zero JS. **Never measured** — no Lighthouse. |
| DEPLOYMENT | **NONE** | the stub |
| DOMAINS / SSL / CDN / EMAIL DELIVERY | **NONE** | downstream of deployment |
| THIRD-PARTY INTEGRATIONS | **NONE** | MCP layer exists and is empty |

### 8.1 How the factory should decide what each business needs

**FACT: the machinery for this decision already exists and is thrown away.**
`businessAnalystAgent` already emits `features[]`, `backendModules[]` (with
`dependsOn`), `frontendModules[]` and `pages[]` — each with a rationale, an
evidence list and a priority (`businessAnalystAgent.ts:117-144`). **Nothing
consumes any of it.** The writer reads only feature *titles* into a prose brief
(`writerAgent.ts:366`); the renderer never sees it.

**Proposed (design only):** a **Capability Requirements Document** as a
first-class artefact between analyst and build, with three inputs:

1. **Category baseline** — a per-industry required/recommended/irrelevant matrix.
   A restaurant needs menu + hours + location + reservations; a law firm needs
   services + credentials + enquiry form and must *not* have ecommerce; a hotel
   needs booking + gallery + rooms.
2. **Observed evidence** — what the business already does. This is the honest
   signal and it is already collected: an existing "Book now" link, an online
   ordering host in `relatedLinks`, a menu page in navigation, a shop path. Derive
   need from behaviour, not from category alone.
3. **Deliverability gate** — the analyst's own prompt already contains the right
   rule (`businessAnalystAgent.ts:160`): "A bakery with no staff to run a blog does
   not warrant a content programme." Formalise it: every capability must name who
   operates it and what happens if nobody does. A booking system nobody answers is
   worse than a phone number.

Then a **tier ladder**, so the factory has a small number of buildable targets
rather than an open-ended feature space:

| Tier | Contents | Backend needed |
|---|---|---|
| **T0 Presence** | today's output + real deployment | none |
| **T1 Contact** | + working form, spam control, email delivery | minimal (one function) |
| **T2 Content** | + multi-page, CMS-editable content, sitemap, per-page SEO | storage + auth |
| **T3 Transaction** | + booking/ordering/payments, confirmations, calendar | full app |
| **T4 Account** | + user accounts, roles, dashboards | full app + tenancy |

**INFERENCE:** T0 is the entire commercial priority. Nothing above T0 matters
while nothing deploys, and T1 is where a small business actually converts.

---

## 9. Security Audit

Real risks, ordered by exploitability. Nothing was modified.

### 9.1 HIGH — SSRF via the collector

**FACT.** `toAbsolute` (`collectorAgent.ts:94-103`) validates **only** the
scheme:
```
if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
```
There is no check for `localhost`, `127.0.0.0/8`, `10/8`, `172.16/12`,
`192.168/16`, `169.254.169.254` (cloud metadata), `::1`, or internal hostnames. I
grepped for all of them: **zero occurrences in the entire repository.**

The chain: the operator supplies a Maps URL → `discoveryAgent` reads the
`website` field **from the listing** → `collectorAgent` navigates a **real
Chromium context** there, crawls up to 6 pages, and calls
`session.fetchBinary` on up to 40 image URLs (`browser.ts:313-323`,
`failOnStatusCode: false`). Whoever controls that listing controls the URL.

Impact: internal network and cloud-metadata reachability; response text lands in
`3-profile.json` and then in an LLM prompt; response bytes land in `assets/` and
can be copied into a published site.

### 9.2 HIGH — Prompt injection, entirely undefended

**FACT.** Scraped third-party page text is interpolated **raw** into both
prompts, with only length truncation:
```
profile.pages.map((page) => `### ${page.title ?? page.url}\n${page.url}\n\n${truncate(page.text, maxPageChars)}`)
```
(`writerAgent.ts:350-355`; same at `businessAnalystAgent.ts:235-238`.) I grepped
`agents/` and `lib/ai/` for `injection|sanitiz|sanitis|untrusted`: **zero hits.**
There is no delimiting, no escaping, no instruction-hardening, no
"content between markers is data not instructions", no post-hoc consistency check.
Up to 6 KB per page × 6 pages of attacker-controlled text sits inside the same
context as the system prompt.

**Real mitigations that limit blast radius (FACT, and they matter):** the output
schema has no field for a fact (§7.1); `hours`/`contact` bullets are overwritten;
CTA targets are a closed enum resolved from the profile, so **no injected href
can reach the page**; `groundingWarnings` flags injected emails/hosts/numbers.

**What injection still controls (INFERENCE):** the tagline, every heading and
subheading, all body prose, all non-data bullets, the SEO title and description,
and `unresolvedGaps`. That is enough to publish defamatory, misleading or
competitor-promoting copy on a real customer's website, and enough to suppress
the gap list that a reviewer relies on. Given the product's entire value claim is
"we do not invent things about your business", this is the highest-severity risk
in the system.

### 9.3 MEDIUM — Website content injection into the rendered page

**Largely mitigated, and worth stating precisely.** Escaping is enforced by the
type system: `Html` is a branded string, `text()` escapes, `raw()` is greppable
and used only for the doctype, `&copy;` and pre-escaped JSON-LD
(`lib/render/html.ts:15-83`). `jsonLd` escapes `<`, `>`, `&` so `</script>`
cannot close its element (`html.ts:204-212`). `safeHref` rejects
`javascript:`, `JavaScript:`, `vbscript:` and `data:text/html`, with tests
(`test/render/assets.test.ts:44-51`). Alt text is never invented. **Residual
risk:** scraped alt text and file names are rendered (escaped) as visible
captions, so an attacker controls *visible text*, not markup.

### 9.4 MEDIUM — Path traversal (defended, correctly)

`resolveInside` (`write.ts:57-61`) resolves and requires the target to be under
the root; `path.basename` is applied to every font file name before joining
(`write.ts:113`). The comment is right that this is the check that does not depend
on the upstream ones holding. **Adequate.**

### 9.5 MEDIUM — Unbounded scraping and asset ingestion

Caps exist: `maxPages 6`, `maxImages 40`, `maxAssetBytes 8 MB`
(`lib/config.ts:201-207`). But there is no total-bytes budget (40 × 8 MB =
320 MB per run), no content-type verification before writing an "image", no
image decode validation, and no politeness rate limiting on the crawl. Downloaded
bytes are copied into the published site.

### 9.6 MEDIUM — The security-relevant code is the untested code

**FACT.** Zero tests import `agents/`, `lib/ai/`, `lib/platform/`,
`lib/browser.ts`, `lib/config.ts` or `main.ts`. All 248 tests are in
`test/design/` and `test/render/`. So: **every scraper, every provider adapter,
the credential resolver, the retry logic, the skill and MCP managers, and the
orchestrator are entirely uncovered.** The project states this itself
(`PROJECT_STATUS.md:191`). The green suite tests the deterministic half and says
nothing about the half that touches the network, the filesystem and secrets.

### 9.7 LOW / NOT APPLICABLE

- **XSS in output** — mitigated (§9.3).
- **CSRF, SQL injection** — **N/A**: no forms, no server, no database, no SQL.
- **Command injection** — **N/A today**: the only `spawnSync` is in
  `scripts/batch-audit.ts` (a dev script) with a fixed argv. **Becomes live** the
  moment the stdio MCP connector is implemented.
- **Arbitrary code execution** — **one real vector, currently opt-in**:
  `SKILLS_DIR` discovery loads and executes `*.skill.ts` from operator-specified
  directories (`lib/platform/skills/loader.ts`). That is by design and is
  operator-controlled, but it is a code-execution path configured by an env var.
- **Generated code execution** — **N/A**: no code is generated. No `eval`, no
  `new Function`, no generated JS. This is a genuine security advantage of the
  current architecture that a future codegen worker would destroy.
- **Multi-tenant isolation** — **N/A**: single-user CLI, runs keyed by a
  `randomUUID().slice(0,8)` (`main.ts:387`). **UNKNOWN/future risk:** 8 hex chars
  is ~4.3 billion values; fine for a laptop, inadequate as a multi-tenant
  identifier, and `resumePipeline` overwrites in place (`main.ts:396-400`).
- **Dependency vulnerabilities** — `npm audit` reported **0 vulnerabilities**
  across 16 packages. The dependency surface is remarkably small: 2 runtime deps
  (`@anthropic-ai/sdk`, `playwright`), 3 dev. This is a real strength.
- **Deployment secrets** — **N/A**: nothing deploys. `LOVABLE_API_KEY` is read and
  never used.
- **Secrets hygiene** — scanned for `sk-`, `sk-ant-`, `AIza` patterns: **clean**.
  `.env` is gitignored and absent. `platform.describe()` returns credential
  **names** only (`platform.ts:223`). Good.

---

## 10. n8n Audit

**FACT: n8n does not exist in this repository.** `grep -ri n8n` across all 168
files returns **zero** matches. No workflow JSON, no webhook endpoint, no queue,
no Docker compose, no reference in any of the 9 docs, the README, the roadmap or
the status file. n8n is also not installed in this environment.

I audited it without prejudice as asked, so: **there is no n8n logic to weigh
against Node logic.** 100% of the orchestration logic is in `main.ts` — a
`STAGES` array, a `step()` helper that either runs a stage or reads its artifact
off disk, and sequential `await`s (`main.ts:169-384`).

**Should it be kept? There is nothing to keep. Should it be introduced?** Judged
on what the target architecture needs:

**What n8n would genuinely add (INFERENCE):**
- A **visual run graph** a non-engineer can read — directly relevant to the
  Control Room the brief wants.
- **Human-in-the-loop approval gates** as a first-class primitive. The brief's
  Approve/Reject step is exactly n8n's Wait-for-webhook pattern, and building
  that from scratch in Node means building a web app.
- **Retries, queues and scheduling** without writing a job runner.
- **Third-party connectors** for the delivery end — email the client, post to
  Slack, create the Notion page, register the domain.
- **Per-run execution history** with inputs and outputs visible per node.

**What n8n would cost (INFERENCE, and it is significant here):**
- It **breaks the property this codebase is built on**. The pipeline's value is
  that it is typed end to end and byte-deterministic. n8n's currency is untyped
  JSON in a visual editor; logic that migrates into nodes leaves the type system,
  the test suite and `git diff`.
- It adds Docker, a database and a service to a project whose current deployment
  story is `npm run dev`, and whose privacy posture depends on making no external
  requests.
- **It does not solve any current blocker.** The blockers are: nothing deploys,
  the design space is 17×3, and there is no evidence model. None of those is an
  orchestration problem.

**Recommendation (INFERENCE): do not adopt n8n as the orchestrator. Consider it
later, and only as the control plane at the edges.** The correct division:

```
n8n owns:   triggers, scheduling, the run queue, human approval gates,
            notifications, delivery integrations, the visual run history
            — everything that is a WORKFLOW.

Node owns:  every stage, every worker, every transform, the type contracts,
            the design system, the renderer, QA
            — everything that is a COMPUTATION.

Interface:  a stable HTTP/CLI job contract. n8n calls
            `POST /runs {mapsUrl}` and polls `GET /runs/:id`; it never
            reaches inside a stage.
```

**Precondition, and it is the important part:** BusinessForge has **no HTTP
interface at all** today. That job contract is the thing to build — and once it
exists, the choice of control plane (n8n, Temporal, a plain queue, or a small
custom UI) becomes reversible and low-stakes. **Build the seam, defer the tool.**

---

## 11. Laptop / Runtime Audit

**Scope warning — this is the phase I cannot answer as asked.** The brief names
`C:\Users\40728\WebsiteAgent`. This session runs in an **ephemeral Linux
container** with a fresh clone at `/home/user/WebsiteAgent`. I have no access to
the Windows laptop, its installed tooling, its processes, its ports, its
environment variables or its config files.

**Everything about the actual development machine is UNKNOWN.** In particular
whether Docker, n8n, Antigravity, Hermes, the Gemini CLI or the OpenAI CLI are
installed there — the brief implies some are, and the repository requires none of
them.

What I *can* report is this container, which is useful only as a statement of
what the project actually needs to run:

| Tool | This container | Required for BusinessForge? |
|---|---|---|
| Node | v22.22.2 | **REQUIRED** (`engines: >=20`) |
| npm | 10.9.7 | **REQUIRED** |
| Playwright | 1.56.1 | **REQUIRED** — stages 1–2 |
| Chromium | present, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` | **REQUIRED** |
| TypeScript / tsx | 6.0.2 / installed | **REQUIRED** (`npm run dev` is `tsx main.ts`) |
| Git | 2.43.0 | **DEVELOPMENT ONLY** |
| Docker | 29.3.1 | **NOT REQUIRED** — nothing in the repo uses it |
| Python | 3.11.15 | **NOT REQUIRED** — no Python in the repo |
| n8n | not installed | **NOT REQUIRED** — not referenced |
| Claude Code CLI | 2.1.233 | **DEVELOPMENT ONLY** |
| Gemini CLI / OpenAI CLI | not installed | **NOT REQUIRED** — vendors are reached over HTTPS from `lib/ai/`, never via a CLI |
| Antigravity / Hermes | not present | **UNKNOWN** on the laptop; **not referenced anywhere in the repo** |
| Local services / listening ports | none | **NOT REQUIRED** — there is no server |

**Verified facts about the runtime requirement (FACT):**
- `npm install` succeeded; **0 vulnerabilities**; 16 packages total.
- `postinstall` downloads Chromium (~115 MB observed). This is the one heavy
  install step, and `PROJECT_STATUS.md:196` flags it.
- `npm test` → **248 pass, 0 fail**, 1.67 s. `npm run typecheck` → clean.
  `npm run build` → clean.
- **Zero AI credentials** are configured in this environment, which is why stages
  4–5 could not be executed live.
- **No environment variable is required to run stages 1–3 or the renderer.**

**INFERENCE:** the runtime dependency surface is genuinely minimal — Node,
Playwright, Chromium. Everything else the brief lists (Docker, n8n, Python, AI
CLIs, Antigravity, Hermes) is either legacy, aspirational, or belongs to the
developer's environment rather than the product's.

---

## 12. Autonomy Audit

Target: `Laptop ON → BusinessForge OPEN → Client Request → Factory Manager →
Workers → Website → Browser Preview → Approve/Reject → Delivery`.

**Measured: roughly 45% of the flow exists, and it stops at the two ends —
there is no way in and no way out.**

| Target step | Reality | State |
|---|---|---|
| Laptop ON | — | ✅ |
| **BusinessForge OPEN** | **There is nothing to open.** No UI, no server, no daemon, no tray app. "Open" means a terminal. | ❌ |
| **Client Request** | A Google Maps URL typed as a CLI argument. Nothing accepts a request from a client, and nothing accepts a *brief* — only a URL. | ⚠️ CLI only |
| **Factory Manager** | A `for`-equivalent of 7 sequential `await`s (`main.ts:336-361`). No scheduling, no concurrency, no retry across stages, no cost control, no decisions. | ⚠️ linear script |
| **Workers** | 7 agents. 6 real, 1 throws. No parallelism, no queue, no isolation, no per-worker retry. | ⚠️ |
| **Website** | Produced — `site/index.html` + CSS + assets + fonts. Real. | ✅ |
| **Browser Preview** | Manual: open `file://…/site/index.html`. The pipeline never opens a browser to show you the result. `PageHandle.screenshot` exists and **no product code calls it.** | ❌ manual |
| **Approve / Reject** | **Does not exist in any form.** No gate, no state, no record of a decision. | ❌ |
| **Delivery** | **Does not exist.** `lovableAgent` throws. | ❌ |

### 12.1 Manual interventions, enumerated and classified

| # | Intervention | Why | Class |
|---|---|---|---|
| 1 | Open a terminal | no UI exists | **SHOULD BE AUTOMATED** |
| 2 | `npm install` (+ ~115 MB Chromium) | first run only | **NECESSARY** (one-off) |
| 3 | Create `.env`, paste an API key | stages 4–5 need a credential | **NECESSARY** (secret entry is legitimately human) |
| 4 | Find and paste a Maps URL | the only supported input | **ACCIDENTAL** — a name + city should resolve to a listing; the `google-maps` skill that would do it is a placeholder |
| 5 | Run `npm run dev -- "<url>"` | — | **SHOULD BE AUTOMATED** (job submission) |
| 6 | Read the run log to see what happened | only observability | **SHOULD BE AUTOMATED** (run status) |
| 7 | **Ignore the non-zero exit and the `NotImplementedError`** | the deploy stub always throws | **TEMPORARY** — disappears when deployment ships |
| 8 | Manually locate `output/<runId>/site/index.html` | pipeline does not report or open it | **SHOULD BE AUTOMATED** |
| 9 | Open it in a browser yourself | no preview step | **SHOULD BE AUTOMATED** |
| 10 | **Judge the result by eye** | no QA gate, no critic, no score | **SHOULD BE AUTOMATED** (partially — a gate can catch defects; taste stays human) |
| 11 | Run `npx tsx scripts/batch-audit.ts` separately for metrics | QA is a dev script outside the pipeline | **ACCIDENTAL** |
| 12 | **Hand-write `output/scores.json`** | `build-review.ts:4` consumes a file nothing produces | **ACCIDENTAL** |
| 13 | Decide to accept/reject, with no place to record it | no approval state | **SHOULD BE AUTOMATED** |
| 14 | Re-run with `--from=write` after a code change | correct and well-designed | **NECESSARY** (this is a feature) |
| 15 | Set `FEATURE_design-direction-*` to try another look | the only creative override | **TEMPORARY** — and currently unvalidated (§2.3(6)) |
| 16 | **Deliver the site to the client by hand** | nothing publishes | **TEMPORARY** — the P0 |

**Nothing in the list is impossible; two are structural.** Interventions 1, 5, 6,
8, 9, 13 all disappear behind **one HTTP job interface plus a thin UI**.
Interventions 7 and 16 disappear with **one deployment worker**. Interventions
10–12 need a **QA gate**. That is three pieces of work, not thirty.

---

## 13. Worker Architecture

Proposed. **Not implemented.** The brief's instruction not to assume every worker
is a model is the right one and I have applied it hard: **11 of 20 workers below
need no model at all**, and three of the most valuable ones are pure functions.

Legend — **D** deterministic, **M** model-backed, **H** hybrid.

| Worker | Kind | Role | Input | Output | Tools | Model | Deterministic logic | Failure mode | QA | Cost |
|---|---|---|---|---|---|---|---|---|---|---|
| **Factory Manager** | **D** | Own the run: plan the stage graph from the Capability Requirements Doc, schedule, retry, budget, gate, record approvals | job request | run state machine | queue, artifact store | **none** | DAG execution, retry policy, budget enforcement, idempotency | stalls → run parked, never silently dropped | run invariants | ~0 |
| Research (Listing) | **D** | Resolve a listing to identity | Maps URL / name+city | `DiscoveryResult` | Playwright, **Places API** | none | selector ladders, degrade to `null` | thin identity | field-presence report | ~0 (API: low) |
| Research (Site) | **D** | Crawl the business's own site | site URL | raw pages, images | Playwright | none | crawl budget, bot-wall detect, **SSRF allowlist** | 0 pages → thin profile | page/image counts | ~0 |
| **Evidence** | **D** | Build the `FactStore`; assign claim levels; verify spans; enforce FORBIDDEN | raw sources | `FactStore` + provenance | — | **none** | merge, dedupe, span capture, entity-name guard, category prohibitions | **blocks the run** on an unsupported FACT | self-verifying | ~0 |
| Business Analyst | **M** | Strategy + the Capability Requirements Doc | `FactStore` | strategy + CRD | provider | reasoning, cheap–mid | schema validation, **evidence-span verification** | empty strategy → surfaced | citations must resolve | 1 call |
| **Creative Director** | **M** | The missing worker. Produce an *art direction brief*: concept, metaphor, reference register, what to omit | `FactStore` + strategy + **DesignMemory** | `ArtDirection` (concept, direction, mood, motion budget, type intent, imagery intent, **anti-brief**) | provider, DesignMemory | strong | must resolve to legal token ranges | falls back to today's industry default — **never blocks** | jury + human | 1 call |
| **Experience Architect** | **H** | Turn `ArtDirection` + content shape into a **composition plan** — not a section list | ArtDirection, content shape | `CompositionPlan` (grid, bleed, overlap, pacing, reveal points) | — | optional | shape vetoes (today's `supports()`, generalised) | degrade to today's band stack | renders without holes | 0–1 |
| Content Planner | **H** | Choose *which claims* the page makes | `FactStore`, strategy | `ClaimSet` | provider | mid | every claim cites a FactId | too few claims → shorter page | claim coverage | 0–1 |
| Prose Writer | **M** | Phrase claims. **May not introduce new nouns.** | `ClaimSet`, ArtDirection | prose per claim | provider | strong | closed schema, no fact fields, hours/contact overwritten | invention → caught by Evidence re-check | grounding gate | 1 call |
| Design System | **D** | Tokens from ArtDirection | ArtDirection | `WebsiteDesign` | — | **none** | today's `composeDesign`, widened | contrast unreachable → note | contrast tests | ~0 |
| Frontend | **D** | Compose the page | content + design + CompositionPlan | HTML/CSS/JS | — | **none** | today's renderer + variants | degrade + warn | snapshots, a11y | ~0 |
| Backend | **H** | Generate T1–T3 services from the CRD | CRD | code + config | codegen templates | mid, **template-first** | **templates, not free codegen** | omit capability, report | integration tests | 0–1 |
| Asset | **H** | Select, crop, optimise; generate only when justified | images + ArtDirection | processed assets | sharp, **vision**, image model | vision + image gen | filters (map tiles, tiny, product shots), crop math | fall back to no imagery | broken-image = 0 | per image |
| Motion | **D** | Emit motion from the budget | motion tokens, CompositionPlan | CSS/JS | — | **none** | keyframes + observer from a closed effect set | omit → static page, still valid | reduced-motion honoured | ~0 |
| 3D / WebGL | **D→H** | Only where justified | ArtDirection | canvas module | three.js | none initially | **hard gate: never on a local-business T0 site** | omit | perf budget | ~0 |
| **QA** | **D** | The missing gate. Render, screenshot, measure, **score against thresholds, pass/fail** | site | `QAReport` + verdict | Playwright, axe, Lighthouse | **none** | today's `batch-audit` measurements **plus thresholds**: 0 broken images, 0 overflow, AA, no empty band, no ragged tail, no orphan | **blocks delivery** | self | ~0 |
| Visual Critic | **M** | Judge what metrics cannot: is this designed? | screenshots + ArtDirection | critique + score | **vision** | vision, strong | rubric anchored to the ArtDirection, not generic taste | advisory only, never blocking alone | human spot-check | 1 call |
| Repair | **H** | Act on QA + critic findings | findings + artifacts | targeted re-run | — | mid | **bounded: max 2 iterations, must reduce a measured defect** | give up, escalate to human | defect count must fall | 0–2 |
| Security | **D** | Scan generated output and config | site + config | findings | scanners | **none** | CSP, href schemes, injected-content diff | blocks on high | self | ~0 |
| SEO / Accessibility | **D** | Validate, don't generate | site | findings | axe, validator | **none** | schema.org validation, meta completeness | warn | self | ~0 |
| Deployment | **D** | Publish `RenderedFile[]` | site | live URL | Vercel/S3 API | **none** | upload, poll, record what shipped | retry, then park | URL responds 200 | ~0 |
| Cost Controller | **D** | Meter and cap | usage events | ledger + verdict | — | **none** | price table × tokens; **hard per-run cap** | **halts the run** | self | ~0 |
| Memory | **D** | Persist and retrieve | artifacts | memory records | store | **none** | append-only, keyed | degrade to no memory | self | ~0 |
| Knowledge | **H** | Curate what generalises | memory | rules, exemplars | provider | mid, offline | promotion needs N observations | stale knowledge | human review | offline |

**Three architectural points about this map (INFERENCE):**

1. **The Factory Manager must be deterministic.** A model deciding which stage
   runs next makes runs unreproducible and unbudgetable. It plans a DAG and
   executes it; the *creative* judgement lives in the Creative Director and the
   Critic, where non-determinism is the point.
2. **The Creative Director must never block.** It is the only worker whose
   failure mode should be "fall back to today's deterministic design". That
   preserves the current guarantee — every run produces a competent site — while
   allowing the ceiling to rise.
3. **Repair must be bounded and monotonic.** `compose.ts:17-21` warns correctly
   that a feedback loop makes output depend on iteration count. The answer is not
   to avoid loops but to bound them: max 2 iterations, each must reduce a
   *measured* defect count, and the QA report is the arbiter. That keeps runs
   reproducible-by-artifact even though they are not byte-deterministic.

---

## 14. Knowledge & Memory Architecture

### 14.1 What exists today

**FACT: there is no memory of any kind.** No `designMemory` — I grepped, it does
not exist. Every run is fully cold. The only persistence is per-run JSON under
`output/<runId>/` (`main.ts:146-152`), and `output/*` is gitignored.

| Asked about | Status |
|---|---|
| designMemory | **does not exist** |
| project artifacts | **PARTIAL** — 7 JSON files per run, local, gitignored, no index |
| research | **not reused** — re-scraped every run |
| previous critiques | **not stored** — no critic exists |
| successful designs | **not stored** |
| rejected designs | **not stored** — no rejection concept |
| client feedback | **not stored** — no feedback mechanism |
| provider performance | **PARTIAL** — telemetry is **in-memory, per-run, discarded on exit** (`lib/platform/telemetry.ts`) |
| cost history | **does not exist** — token counts logged then dropped |

**INFERENCE:** the resumable-stage design (`--from`, `main.ts:317-327`) is a
genuinely good *within-run* memory. There is no *across-run* memory at all, and
that is why the system cannot improve: it has no way to know that its last
tattoo-studio site was identical to its last optician site.

### 14.2 Proposed architecture (design only)

Five stores, each with a different lifetime, owner and write discipline. The key
design decision: **separate what is TRUE from what WORKED**, because they age
differently and have different trust rules.

```
┌──────────────────────────────────────────────────────────────┐
│ FACT MEMORY            per business · authoritative · TTL'd  │
│ FactStore keyed by placeId. Every fact with provenance,      │
│ textSpan, retrievedAt, claimLevel.                           │
│ Rules: append-only, never overwritten — a changed fact is a  │
│ new observation, so contradictions are visible. TTL per       │
│ field kind (hours: 30d, address: 1y, prose: 90d).            │
│ Buys: no re-scraping, change detection, and an audit trail    │
│ for any published claim.                                     │
├──────────────────────────────────────────────────────────────┤
│ PROJECT MEMORY         per run · immutable · permanent       │
│ Today's artifacts, plus: ArtDirection, ClaimSet, QAReport,   │
│ critique, approval decision, deployed URL, cost ledger.      │
│ Rules: immutable, content-addressed, indexed by business +   │
│ date. This is the record that makes a run replayable and a   │
│ published claim defensible months later.                     │
├──────────────────────────────────────────────────────────────┤
│ DESIGN MEMORY          cross-business · the anti-slop store  │
│ Every shipped design's fingerprint (the tuple I measured in  │
│ §5.2), with its QA score, critique and approval outcome.     │
│ Rules: the Creative Director MUST query it before choosing,  │
│ and a fingerprint already used for a business in the same    │
│ industry within the same locale is DISQUALIFIED.             │
│ This is the single highest-leverage memory in the system:    │
│ it is what would have prevented eight identical sites.       │
├──────────────────────────────────────────────────────────────┤
│ WORKER MEMORY          per worker · operational · rolling    │
│ Provider latency, failure rate, refusal rate, retry rate,    │
│ tokens and cost per task kind; deterministic workers' timing │
│ and defect rates.                                            │
│ Rules: rolling window, aggregate-only. Feeds routing         │
│ (cheap model where it suffices) and the Cost Controller.     │
├──────────────────────────────────────────────────────────────┤
│ FAILURE MEMORY         cross-run · the regression store      │
│ Every QA defect and critique finding, normalised to a        │
│ defect id, with the artifact that exhibited it and the fix.  │
│ Rules: a defect seen in ≥2 runs is PROMOTED to a QA          │
│ threshold — the loop that turns "we noticed this once" into  │
│ "this can never ship again".                                 │
├──────────────────────────────────────────────────────────────┤
│ KNOWLEDGE BASE         curated · slow-moving · reviewed      │
│ Industry conventions, category prohibition lists, the        │
│ entity-name lexicon, hue anchors, exemplar compositions.     │
│ Rules: HUMAN-REVIEWED promotion only. Nothing enters         │
│ automatically. This is the boundary that stops the factory   │
│ from learning its own mistakes.                              │
└──────────────────────────────────────────────────────────────┘
```

**Two rules that matter more than the schema (INFERENCE):**

1. **Fact memory must never be written by a model.** It is populated by
   deterministic extractors with spans. The moment a model can write a fact, the
   provenance chain is worthless.
2. **Design memory must be a hard constraint, not a hint.** A "prefer novelty"
   nudge will not survive a deterministic preference walk. Disqualification will.

**Storage:** SQLite is sufficient and correct for all five for a long time —
single file, no service, transactional, queryable, and it preserves the current
zero-infrastructure property. Do not reach for a vector store until there is a
retrieval problem; there is not one yet.

---

## 15. Target BusinessForge 2.0

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CONTROL ROOM  (web UI — the thing that does not exist today)           │
│  Submit a job (name+city or URL or a brief) · live run graph · per-stage │
│  artifacts · screenshots · QA scorecard · critique · cost meter ·        │
│  APPROVE / REJECT / REQUEST-CHANGES · delivery status · run history     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │  HTTP job contract  (the key new seam)
                                │  POST /runs · GET /runs/:id · POST /runs/:id/approve
┌───────────────────────────────▼─────────────────────────────────────────┐
│  FACTORY MANAGER  (deterministic — no model)                            │
│  Plans the DAG from the Capability Requirements Doc · schedules ·        │
│  retries per worker · enforces the cost cap · holds approval gates ·     │
│  writes run state · idempotent · resumable (today's --from, generalised) │
└───┬─────────────┬──────────────┬───────────────┬────────────┬───────────┘
    │             │              │               │            │
┌───▼───┐  ┌──────▼──────┐  ┌────▼─────┐  ┌──────▼─────┐ ┌────▼────┐
│RESEARCH│ │  EVIDENCE   │  │ CREATIVE │  │   BUILD    │ │   QA    │
│listing │ │ ★ FactStore │  │ Director │  │ Design Sys │ │ measure │
│ site   │ │  claim      │  │ Experi-  │  │ Frontend   │ │ score   │
│ (D)    │ │  levels     │  │ ence     │  │ Backend    │ │ GATE    │
│        │ │  span verif │  │ Architect│  │ Asset      │ │ (D)     │
│        │ │  FORBIDDEN  │  │ (M)      │  │ Motion (D) │ │ +Critic │
│        │ │  GATE (D)   │  │          │  │            │ │  (M)    │
└────────┘ └─────────────┘  └──────────┘  └────────────┘ └────┬────┘
                                                              │ fail
                                                     ┌────────▼────────┐
                                                     │ REPAIR (bounded)│
                                                     │ ≤2 iterations,  │
                                                     │ must reduce a   │
                                                     │ measured defect │
                                                     └────────┬────────┘
                                                              │ pass
                                              ┌───────────────▼──────────┐
                                              │ SECURITY → HUMAN APPROVAL│
                                              │        → DEPLOYMENT      │
                                              └───────────────┬──────────┘
┌─────────────────────────────────────────────────────────────▼───────────┐
│ CROSS-CUTTING                                                            │
│ AI PROVIDERS (today's layer + multimodal + image) · KNOWLEDGE BASE ·      │
│ MEMORY (5 stores) · BROWSER · BUILD SYSTEM · DATABASE (SQLite) ·          │
│ OBSERVABILITY (today's logger+telemetry, exported) · COST CONTROLLER      │
└──────────────────────────────────────────────────────────────────────────┘
```

**Responsibilities, stated precisely:**

| Component | Owns | Explicitly does NOT own |
|---|---|---|
| **Control Room** | Job submission, visibility, the human approval decision, run history | Any pipeline logic. It is a client of the job contract, nothing more. |
| **Factory Manager** | Stage graph, scheduling, retry, budget, gates, run state, resumability | Any creative or factual decision. Fully deterministic. |
| **Research** | Turning an identity into raw sources | Interpreting them |
| **Evidence** ★ | The `FactStore`, claim levels, span verification, FORBIDDEN enforcement. **The only writer of facts.** | Prose, design, strategy |
| **Business Analyst** | Strategy + the Capability Requirements Doc | Copy, design, code |
| **Creative Director** ★ | The art direction brief and the **anti-brief** (what to omit) | Tokens, markup. Must never block a run. |
| **Experience Architect** ★ | The composition plan: grid, bleed, overlap, pacing | Colour, type, copy |
| **Content Planner / Prose Writer** | Which claims, then how they are phrased | Introducing facts |
| **Design System** | Tokens from art direction | Choosing the direction |
| **Frontend / Motion / Asset** | Executing the plan as files | Deciding the plan |
| **Backend** | T1–T3 services from the CRD | Deciding which are needed |
| **QA** ★ | Measurement **and the pass/fail verdict**. Blocks delivery. | Taste |
| **Visual Critic** | Judging whether it reads as designed, against the art direction | Blocking alone |
| **Repair** | Bounded, monotonic correction | Unbounded iteration |
| **Security** | Scanning output and config; blocks on high severity | — |
| **Human Approval** | The final yes | — |
| **Deployment** | Publishing bytes, recording what shipped | Rendering anything |
| **Cost Controller** | The ledger and the hard cap. Halts runs. | — |
| **Memory / Knowledge** | Recall; disqualifying repeated designs; promoting repeated defects to thresholds | Writing facts (Evidence owns that) |

**The four genuinely new pieces are starred.** Everything unstarred either exists
today or is a modest extension of something that exists.

---

## 16. KEEP / REPLACE / REMOVE / BUILD

Prioritised by impact, not by ease — as instructed.

### KEEP (and protect from refactors)

| Item | Why |
|---|---|
| **The colour system** (`lib/design/color.ts`, `tokens.ts`, the 17 anchored hues) | Professional-grade. OKLCH ramps with contrast *constructed*, every hue traced to a real anchor, a test enforcing ≥20° separation between industries sharing a direction. A studio would not do this better by hand and could not do it consistently across 51 sites. |
| **The renderer and its escaping discipline** (`lib/render/`) | Branded `Html` type makes XSS a type error. `safeHref`, `jsonLd` escaping, path-escape guard, degrade-and-warn. 98.1% of design decisions reach the page. |
| **The writer's structural anti-invention design** (`writerAgent.ts:19-31, 164`) | The single best idea in the codebase: remove the ability to invent rather than instruct against it. Generalise it; never weaken it. |
| **`groundingWarnings`** | Real, cheap, catches the most damaging mechanically-detectable class. Extend, don't replace. |
| **JSON-LD from verified fields only** | Correct on the detail that matters (`aggregateRating` omitted without a count). |
| **The AI provider abstraction** (`lib/ai/`) | Clean four-vendor layer, honest retryability, jittered backoff, schema validated against the original not the translation. Extend to multimodal; do not rewrite. |
| **`AppConfig` / single `process.env` reader** | Makes every agent testable and keeps secrets in one place. |
| **The error taxonomy** (`lib/errors.ts`) with honest `retryable` | Already correct; the Factory Manager can finally consume it. |
| **Stage artifacts + `--from` resumability** (`main.ts:317-327`) | The right idea, well argued. Generalise into the Factory Manager. |
| **Content-aware variant vetoes** (`layout.ts:130-164`) | Prevents embarrassing near-empty grids. Keep and extend to compositions. |
| **The rationale/notes trail** | Every decision explains itself. Rare and valuable. |
| **`scripts/renderer-coverage.ts`** | Measures coverage by perturbation rather than by reading code. The most sophisticated tool in the repo. Promote it to CI. |
| **`scripts/batch-audit.ts` measurement script** | The measurement half is exactly right. It needs thresholds, not a rewrite. |
| **The tiny dependency surface** (2 runtime deps, 0 vulnerabilities) | A real asset. Defend it. |
| **`docs/design-intelligence-review.md`'s honesty** | A team that writes "No — but the distance is measurable" about its own output can be trusted with a roadmap. Keep the practice; **update the stale parts**. |

### REPLACE

| Item | With | Why |
|---|---|---|
| **`agents/lovableAgent.ts`** | A real deployment worker consuming `RenderedFile[]` (Vercel/S3/Cloudflare) | It is the only thing between "we make websites" and "we deliver websites". `ROADMAP.md:36-50` already specifies this correctly and even says to retire the agent. **Highest-impact single change in the audit.** |
| **`FieldSource = 'maps' \| 'website'`** | The full `Provenance` record + 5-level `ClaimLevel` (§7.3) | Without this there is no truth control, only good intentions. |
| **`WebsiteSection` as 6 plain strings** | A projection of a `ClaimSet` | Provenance currently dies at the writer boundary. This is the structural fix. |
| **`designAgent` as a pure lookup** | Creative Director (model, with a real brief) → Experience Architect → today's `composeDesign` as the *executor* | Keeps determinism downstream of a creative decision. The seam is already documented at `compose.ts:62-69`. |
| **Industry → direction as a hard 3-of-11 veto** (`compose.ts:164-166`) | A soft prior the Creative Director may override with a recorded reason | This single line is the mathematical cause of the 8-way collision. |
| **Industry fallback hue as the brand colour** (`compose.ts:255-266`) | Real brand extraction: logo colour quantisation (deterministic, no model), then favicon, then stylesheet, then industry hue as the last resort | Category colour is the second cause of the collision, and the logo is already downloaded. |
| **The 17-bucket keyword taxonomy** | A wider taxonomy incl. `creative`, plus embedding-based classification with the keyword table as the audit trail | 17 buckets for the whole economy; photography falls through to `general`. |
| **`batch-audit.ts` as a dev script** | A QA worker inside the pipeline with **thresholds and a verdict** | Measurement without a gate is a dashboard nobody reads. |
| **Hand-written `output/scores.json`** | The Visual Critic's output | `build-review.ts:4` reads a file nothing produces. |
| **`.env.example`'s 10 credentials for placeholder skills** | Only the variables that do something | Advertising capabilities that throw is the one place this project's honesty slips. |

### REMOVE

| Item | Why |
|---|---|
| **All 38 placeholder skills, or at minimum the ~20 overlapping real code** | `playwright` and `browser-automation` are placeholders while real Playwright works in `lib/browser.ts`; `deployment`/`lovable` duplicate the stub agent; `seo` duplicates the writer. The *pattern* is honest and good; the *catalogue* is now a 38-entry namespace where every entry throws, and it makes the platform look far more capable than it is. Keep the placeholder mechanism; delete the entries that are not on the roadmap. |
| **The dead dark-scheme path** — `ColorSystem.scheme` with `'light'` hard-coded at `tokens.ts:241` | Either implement dark mode or drop the field. Right now `premium`'s "Dark ground" description is false and `data-scheme` is a constant. |
| **`FEATURE_design-direction-*` as the creative override** (`designAgent.ts:53-60`) | An unvalidated cast that crashes on a typo, replaced by the Creative Director anyway. |
| **`README.md:3` / `NEXT_SESSION.md:10` end-to-end and deployment claims**; the three stale `PROJECT_STATUS.md` lines; the five fixed items in `design-intelligence-review.md` | Documentation drift is the fastest way to lose the trust this project has earned by being honest. |
| **`lib/platform/mcp/stdioConnector.ts`** — *if* MCP is not on the near roadmap | 77 lines that throw. If MCP stays, implement it and note it becomes a command-injection surface. |

### BUILD

Ordered by impact.

| # | Build | Why it is at this rank |
|---|---|---|
| 1 | **Deployment worker** | Nothing else converts work into value. Every run currently exits 1. |
| 2 | **Evidence/Truth layer** (`FactStore`, `ClaimSet`, claim levels, entity-name guard, FORBIDDEN lists) | It is the product's core promise, the user named it critical, and the River Park case passes every current check. |
| 3 | **QA gate** (thresholds on the measurements that already exist) | Turns a dashboard into a guarantee, and it is mostly *adding numbers* to code that already runs. |
| 4 | **HTTP job contract** (`POST /runs`, `GET /runs/:id`, `POST /runs/:id/approve`) | The seam that makes the Control Room, n8n, autonomy and approval all possible — and makes the choice of control plane reversible. |
| 5 | **Creative Director + Experience Architect + brand colour extraction + Design Memory disqualification** | The four pieces that break the 8-way collision. Ranked below QA because without a gate you cannot tell whether more creative freedom made things better or worse. |
| 6 | **Control Room UI** | Removes 6 of the 16 manual interventions. |
| 7 | **Motion worker** | The motion vocabulary is already computed and published; nothing consumes it. Cheapest large perceptual gain. |
| 8 | **Cost Controller** | Token counts are already captured and discarded. Needed before any loop or multi-candidate generation. |
| 9 | **Tests for `agents/`, `lib/ai/`, `lib/platform/`, `lib/config.ts`** | The untested half is the half that touches network, filesystem and secrets. |
| 10 | **SSRF allowlist + prompt-injection hardening** | Small, well-understood, and they close the two HIGH findings. Ranked here only because 1–3 are existential; **do them alongside, not after.** |
| 11 | **Multimodal on `AIProvider`** | Unblocks vision, the Visual Critic and image generation in one contract change. |
| 12 | **Multi-page (`WebsiteContent.pages`)** | Unblocks the analyst's existing page recommendations. A contract change, so it needs its own milestone. |
| 13 | **Visual Critic + bounded Repair** | Last, deliberately: it needs 2, 3, 8 and 11 first, and it is the piece most likely to be built prematurely. |

---

## 17. Prioritized Roadmap

Dependency-ordered, as requested. Complexity is **S** (days) / **M** (1–2 weeks)
/ **L** (3+ weeks), assuming the current single-developer pace.

### FOUNDATION — make the current product truthful and shippable

| | |
|---|---|
| **Goal** | A run exits 0 and produces a live URL. Documentation matches code. |
| **Depends on** | nothing |
| **Files** | `agents/lovableAgent.ts` → `agents/deploymentAgent.ts`; `main.ts:360`; `lib/types.ts` (`DeploymentResult`); `PROJECT_STATUS.md`, `README.md`, `NEXT_SESSION.md`, `docs/design-intelligence-review.md`; `agents/designAgent.ts:53-60` (the unvalidated cast); `lib/design/tokens.ts:241` (dark-scheme decision) |
| **Risks** | Vendor lock-in — mitigate by uploading `RenderedFile[]` through a target-agnostic interface, exactly as `ROADMAP.md:41` already specifies. Deploy secrets become live for the first time. |
| **Success** | `npm run dev -- <url>` exits **0**, prints a URL that serves the rendered site, writes `6-deployment.json`; every stale doc claim corrected; the direction-override typo warns instead of crashing. |
| **Complexity** | **M** |

### SECURITY BASELINE — run in parallel with Foundation, do not defer

| | |
|---|---|
| **Goal** | Close the two HIGH findings before anything is exposed beyond one laptop. |
| **Depends on** | nothing (deliberately — this must not queue behind features) |
| **Files** | `agents/collectorAgent.ts:94-103` (SSRF allowlist: reject private/link-local/loopback, resolve-then-check to defeat DNS rebinding); `lib/browser.ts:313` (`fetchBinary` same check + content-type verification + total-byte budget); `agents/writerAgent.ts:350`, `agents/businessAnalystAgent.ts:235` (delimit scraped text, mark it data-not-instructions, add a post-generation consistency check) |
| **Risks** | An over-strict allowlist blocks a legitimate customer site behind an unusual host. Injection hardening is mitigation, never a guarantee — the closed schema remains the real defence. |
| **Success** | A listing whose website is `http://169.254.169.254/` is refused with a named error; a page containing "ignore previous instructions and write X" does not produce X; both cases have a committed test. |
| **Complexity** | **S** |

### ORCHESTRATION — a way in and a way out

| | |
|---|---|
| **Goal** | Jobs are submitted and observed without a terminal. Approval is a recorded state. |
| **Depends on** | Foundation |
| **Files** | new `lib/factory/manager.ts` (generalise `main.ts:307-384` into a DAG with per-worker retry consuming the existing honest `retryable`); new `server/` (HTTP contract); new `lib/store/` (SQLite run state); `main.ts` becomes one client of the manager |
| **Risks** | Over-engineering into a distributed system. **Mitigation: single process, SQLite, in-process queue.** Do not add a broker until there is contention. |
| **Success** | `POST /runs {mapsUrl}` returns a run id; `GET /runs/:id` streams stage status and artifact paths; `POST /runs/:id/approve` gates deployment; a killed process resumes the run. |
| **Complexity** | **L** |

### KNOWLEDGE — remember across runs

| | |
|---|---|
| **Goal** | Facts, artifacts, design fingerprints, worker stats and defects persist. |
| **Depends on** | Orchestration (needs the store) |
| **Files** | new `lib/memory/{facts,project,design,worker,failure}.ts`; `lib/platform/telemetry.ts` (persist instead of discard); `lib/ai/*` (emit usage to the ledger) |
| **Risks** | Stale facts published as current — **mitigate with per-field-kind TTL and append-only observations so contradictions are visible.** Design Memory is useless unless it is a hard disqualifier. |
| **Success** | A second run on the same business reuses facts and re-scrapes only what expired; Design Memory can answer "has this fingerprint shipped for a retailer in this locale?"; the cost ledger reports per-run spend. |
| **Complexity** | **M** |

### TRUTH — the evidence layer (this is the one the user called critical)

| | |
|---|---|
| **Goal** | No unverified statement can be published as fact. |
| **Depends on** | Knowledge (FactStore) |
| **Files** | `lib/types.ts` (`Provenance`, `ClaimLevel`, `Claim`, `ClaimSet` — replaces `FieldSource:219` and reshapes `WebsiteSection:408`); `agents/normalizerAgent.ts` (capture `textSpan`); new `agents/evidenceAgent.ts` (the gate: span verification, entity-name guard, category prohibitions, hedge enforcement, third-party contamination); split `writerAgent` into Content Planner + Prose Writer; `agents/businessAnalystAgent.ts` (verify `evidence[]` spans resolve) |
| **Risks** | **This is a breaking contract change and touches the most valuable existing code.** Mitigate by making `WebsiteContent` a *projection* of `ClaimSet`, so the renderer and all 248 tests keep working unchanged. Over-strict gating produces uselessly thin pages — mitigate by routing blocked claims to `unresolvedGaps` rather than deleting them. |
| **Success** | Given `Name: River Park Events` with no water fact, copy asserting "beside the river" is **blocked**, not warned, and appears in gaps; every FACT-level claim resolves to a span; a medical site cannot publish an outcome claim; the client-facing report lists every claim with its evidence. |
| **Complexity** | **L** |

### QA — measurement with a verdict

| | |
|---|---|
| **Goal** | A defective site cannot reach a human. |
| **Depends on** | Orchestration; Knowledge (Failure Memory) |
| **Files** | promote `scripts/batch-audit.ts:114-144` into `agents/qaAgent.ts`; add axe + Lighthouse; promote `scripts/renderer-coverage.ts` into CI; new `lib/factory/gate.ts` |
| **Risks** | Thresholds that block on cosmetics stall the factory — mitigate by starting with the seven objective defects already measurable (broken images, horizontal overflow, AA contrast, empty band, ragged tail, orphan grid item, missing `<h1>`) and letting Failure Memory promote new ones only after 2 observations. |
| **Success** | The gate blocks a site with a broken image; `output/scores.json` is generated rather than hand-written; CI fails on a coverage regression. |
| **Complexity** | **M** |

### CREATIVE INTELLIGENCE — break the collision

| | |
|---|---|
| **Goal** | Two businesses in one industry never receive the same visual system. |
| **Depends on** | QA (to prove change is improvement); Knowledge (Design Memory) |
| **Files** | new `agents/creativeDirectorAgent.ts`; new `lib/design/composition.ts` (Experience Architect); `lib/design/compose.ts:164-166` (veto → prior) and `:255-266` (brand extraction); new `lib/design/brandColor.ts` (logo quantisation — deterministic); `lib/design/industries.ts:75-92` (widen taxonomy, add `creative`); `lib/design/themes.ts:406` (accent shifts); `lib/render/variants.ts` + `css.ts` (compositions, mid-tier type scale, card treatments per elevation/radius) |
| **Risks** | **The highest-risk milestone.** A model in the design path ends byte-determinism — mitigate by having the Creative Director emit only a *closed set of legal values*, so everything downstream stays deterministic **given the brief**, and the brief is persisted in Project Memory so a run remains replayable. Creative freedom can lower quality — that is precisely why QA precedes this. The Creative Director must fall back to today's deterministic path on any failure. |
| **Success** | Regenerate the 51-site set: **distinct visual fingerprints rise from 24 toward 51**; no two same-industry sites share a fingerprint; QA scores do not regress; the optician and the tattoo studio are visibly different sites. |
| **Complexity** | **L** |

### AUTONOMOUS FRONTEND — motion, interaction, composition

| | |
|---|---|
| **Goal** | The page behaves, not just displays. |
| **Depends on** | Creative Intelligence (needs a motion budget worth honouring) |
| **Files** | new `lib/render/motion.ts` (`@keyframes` + IntersectionObserver from the existing closed effect set — `fade`/`rise`/`scale`/`stagger` are already computed and published); `lib/render/document.ts` (first real `<script>`); `lib/render/css.ts` (scroll behaviour, mobile nav disclosure) |
| **Risks** | Emitting JavaScript ends "opens from disk with no external request" — mitigate by inlining a single tiny module and keeping the page fully functional with JS disabled. Motion that ignores `prefers-reduced-motion` is an accessibility regression; the reset block already exists, so honour it. |
| **Success** | Entrance animations match `tokens.motion.effects`; mobile nav is a disclosure, not two wrapped rows; reduced-motion produces a static page; Lighthouse performance does not drop. |
| **Complexity** | **M** |

### BACKEND & COMPLETENESS — T1, then T2

| | |
|---|---|
| **Goal** | Working contact forms (T1), then multi-page + CMS (T2). |
| **Depends on** | Deployment; Truth (a form submits claims about a real business) |
| **Files** | new `agents/backendAgent.ts` (**template-first, not free codegen**); `lib/types.ts` (`WebsiteContent.pages` — the change `PROJECT_STATUS.md:170` correctly refused to make early); the Capability Requirements Doc from `businessAnalystAgent.ts:117-144`, finally consumed |
| **Risks** | Generated backend code is the single largest new security surface, and it would destroy the current "no code is generated, no `eval` anywhere" advantage — **mitigate by shipping audited templates parameterised by the CRD, never model-authored code, until a security worker exists.** |
| **Success** | A contact form delivers email with spam control; a multi-page site renders the analyst's recommended pages with per-page SEO. |
| **Complexity** | **L** |

### CONTROL ROOM → AUTONOMY

| | |
|---|---|
| **Goal** | Laptop on → submit → watch → approve → delivered, no terminal. |
| **Depends on** | everything above |
| **Files** | new `ui/`; optional n8n **only** at the trigger/notification/delivery edges, over the HTTP contract |
| **Risks** | Building the UI before the gates exist produces a pretty window onto an unreliable factory. Adopting n8n before the job contract exists puts business logic in an untyped visual editor (§10). |
| **Success** | All 16 manual interventions in §12.1 are either eliminated or reclassified NECESSARY; a run is submitted, monitored, approved and delivered from a browser. |
| **Complexity** | **L** |

**Critical path, one line:**
`Deployment + Security → Orchestration → Knowledge → Truth → QA → Creative → Motion → Backend → Control Room`

**INFERENCE on sequencing.** The instinct will be to do Creative Intelligence
first, because the collision is the most visible problem and the most interesting
to work on. Resist it. Without Deployment there is no product; without QA you
cannot tell whether creative changes helped; without Truth the product's core
claim is unenforced. Creative Intelligence is fifth on the path and that ordering
is the most important recommendation in this roadmap.

---

## 18. Critical Risks

| # | Risk | Severity | Evidence | Mitigation |
|---|---|---|---|---|
| 1 | **Nothing deploys; every run exits non-zero** | **Existential** | `lovableAgent.ts:33` throws; `main.ts:360` has no catch; executed and confirmed | Foundation milestone |
| 2 | **Prompt injection is completely undefended** | **Critical** | Raw scraped text in both prompts (`writerAgent.ts:350`); zero `sanitiz\|untrusted\|injection` hits in `agents/` or `lib/ai/` | Security Baseline; the closed schema already limits blast radius |
| 3 | **Unverified inference can become published fact** | **Critical** | `groundingWarnings` catches only emails/hosts/digits; nothing forbids inference from the business name; the prompt actively invites place-inference (`writerAgent.ts:274`) | Truth milestone |
| 4 | **SSRF: real browser navigates a third-party-controlled URL** | **Critical** | `collectorAgent.ts:94-103` checks scheme only; no private-range check anywhere | Security Baseline |
| 5 | **Design collision — 51 businesses → 24 visual systems, one 8-way tie** | **High** (commercial) | Measured; screenshots of optician vs tattoo studio are the same page | Creative Intelligence |
| 6 | **No across-run memory; the factory cannot improve** | **High** | No `designMemory`; telemetry in-memory and discarded; `output/` gitignored | Knowledge |
| 7 | **The untested half is the dangerous half** | **High** | 0 tests import `agents/`, `lib/ai/`, `lib/platform/`, `lib/browser.ts`, `lib/config.ts`, `main.ts` | BUILD #9 |
| 8 | **Three of four provider adapters have never run live** | **High** | `PROJECT_STATUS.md:161`; no integration tests | One live call each; recorded fixtures |
| 9 | **Documentation drift is eroding a real asset** | **High** | 8 contradictions in §2.3, incl. a self-contradiction inside `PROJECT_STATUS.md` | Foundation includes doc correction |
| 10 | **The ideal customer is the worst-served case** | **High** (commercial) | `NEXT_SESSION.md`: 3 of 5 real businesses had no crawlable site → 126–174 words, 0 images | PRD-007: render JS sites; use Maps photography (both invent nothing) |
| 11 | **No cost control before any loop is introduced** | **Medium→High** | No pricing, no cap; token counts logged then dropped | Cost Controller **before** Repair or multi-candidate generation |
| 12 | **Latent crash: unvalidated direction override** | **Medium** | `designAgent.ts:58-59` casts any flag suffix; docstring at `:49-51` claims validation that does not exist | Foundation |
| 13 | **Google will rotate the Maps selectors** | **Medium** | Acknowledged at `PROJECT_STATUS.md:141`; degrades to `null` per field | Places API for the fields that matter |
| 14 | **Deterministic-by-contract forecloses creative exploration** | **Medium** (architectural) | `compose.ts:5-21` states no feedback loops as a principle | Move determinism boundary: non-deterministic brief, deterministic execution, replayable via persisted brief |
| 15 | **The platform advertises 38 capabilities that throw** | **Medium** | All 38 placeholders; 10 credentials in `.env.example` for none of them | Prune the catalogue |
| 16 | **Single-user assumptions** (8-hex run ids, in-place resume overwrite, local files) | **Low today / High at multi-tenant** | `main.ts:387, 396-400` | Address in Orchestration |

---

## 19. Open Questions

**For the user — these change the roadmap:**

1. **Where is the BusinessForge described in the brief?** Both `PROJECT_STATUS.md:5`
   and `NEXT_SESSION.md:6` name "BusinessForge HQ (Notion)" as canonical. If the
   Factory Manager, Control Room, n8n workflows and the Go Sweet / River Park runs
   exist as designs or as a separate implementation, **this audit is missing
   them** and I should be pointed at them. If they are aspirations, this audit is
   complete and §0 stands.
2. **Do Go Sweet and River Park Events exist as real runs?** They are in no file
   and `output/` is empty. If artifacts exist on the laptop, the Phase 2 trace can
   be completed properly. **Currently UNKNOWN.**
3. **Is n8n actually installed and used?** Nothing references it. If there are
   workflows outside the repo, §10 needs revisiting with them in hand.
4. **What are Antigravity and Hermes in this system?** They appear nowhere in the
   repository. **UNKNOWN.**
5. **Has stage 4 ever run live?** `PROJECT_STATUS.md` says both yes (`:53`) and no
   (`:151`). This determines whether the Anthropic adapter is REAL-proven or
   REAL-unproven.
6. **Which deployment target?** `ROADMAP.md:36` says Vercel; the code says
   Lovable; `.env.example` credentials Lovable. Deciding this unblocks the P0.
7. **Is byte-determinism a requirement or an implementation choice?** This is the
   single most consequential architectural question. Everything creative the brief
   asks for — divergence, candidates, juries, repair — requires giving it up
   *somewhere*. My recommendation is to move the boundary rather than abandon the
   property, but this is the user's call.
8. **Who is the customer and what do they buy?** T0 presence vs T1 contact vs T3
   transaction is a business decision that determines whether the Backend
   milestone exists at all.
9. **Is a human always in the loop?** "Approve/Reject" in the brief implies yes.
   If so, QA is a filter; if fully autonomous, QA must be far stricter and the
   Truth layer becomes non-negotiable rather than important.

**Technical, answerable from within the project:**

10. Do the OpenAI, Gemini, OpenRouter adapters and the MCP HTTP connector actually
    work? One live call each answers it.
11. What does the current output score on axe and Lighthouse? Never measured.
12. Should dark mode be implemented or the field removed?
13. Is MCP on the roadmap? If not, delete the stdio stub.
14. How many of the 38 skill ids are genuinely planned?

---

## 20. Final CTO Recommendation

### The honest assessment

BusinessForge is **not** a factory. It is a **very well-built 55% of one pipeline
stage-chain**, plus an empty capability platform, plus a genuinely excellent
deterministic design and rendering engine, plus a stub where the product should
be.

The engineering quality is materially better than most projects at this stage:
one module owns the environment, agents have no ambient dependencies, XSS is a
type error, the design layer is byte-deterministic and snapshot-tested, the error
taxonomy is honest about retryability, and 98.1% of design decisions provably
reach the page. Two runtime dependencies, zero vulnerabilities. The
`renderer-coverage.ts` perturbation harness is a tool most teams never build.

And the project's own documentation is, with the specific exceptions in §2.3,
**more honest than this kind of document usually is** — `design-intelligence-review.md`
ends with "No — but the distance is now measurable," which is exactly right and
exactly the disposition needed to get to the factory.

### The three things that are actually wrong

Strip away the phases and there are three problems, in this order:

1. **It does not deliver.** The deploy stage throws. Every run exits 1 after
   writing the site. A website builder that cannot publish a website has no
   product, and this is a **known, specified, small piece of work** —
   `ROADMAP.md:36-50` already describes it correctly.

2. **Its core promise is unenforced.** The system is built around not inventing
   things about real businesses, and the *structural* defence for contact data is
   the best idea in the codebase. But provenance is destroyed at the writer
   boundary, `FieldSource` has only two values and no confidence, and nothing
   stops the model inferring a property of a place from the place's *name* — while
   the prompt actively invites geographic orientation copy. **The user's own
   River Park example passes every check the system has.**

3. **Its creative decisions are category decisions.** Measured: 51 businesses
   collapse to 24 visual systems; eight unrelated businesses receive a
   byte-identical design; a tattoo studio and an optician are the same page. The
   cause is three specific lines — a 17-bucket keyword taxonomy, a hard 3-of-11
   theme veto, and a category fallback hue used because most businesses have no
   brand colour to find. Determinism-as-principle then forecloses the exploration
   that would fix it.

Everything else in this audit — n8n, workers, memory, autonomy, the Control Room
— is downstream of those three.

### What I would do

**Do not rewrite.** The deterministic core is an asset that would be expensive to
rebuild and is not the problem. Extend it.

**Sequence, and I would defend this ordering hard:**

1. **Ship deployment. Fix the docs. Close SSRF and injection.** Weeks, not months.
   At the end you have a product that delivers and a repository that tells the
   truth about itself. Nothing else should start first.
2. **Build the job contract and the Factory Manager.** One HTTP seam makes the
   Control Room, approval, autonomy and the n8n question all tractable — and makes
   the control-plane choice reversible instead of a bet.
3. **Build the Evidence layer.** This is the product's moat. "We do not invent
   things about your business, and here is the evidence for every sentence" is
   defensible in a market full of generators that will happily tell a customer
   their venue is beside a river.
4. **Build the QA gate before touching the creative layer.** This is the step
   most likely to be skipped and the one that determines whether step 5 succeeds.
   Without a measurement gate, more creative freedom is indistinguishable from
   more variance.
5. **Then break the collision** — Creative Director, real brand-colour
   extraction, composition vocabulary, Design Memory as a hard disqualifier.

**On determinism, the pivotal decision:** do not abandon it — **move its
boundary.** Let a Creative Director make a non-deterministic choice from a closed
set of legal values, persist that brief as an artifact, and keep everything
downstream byte-deterministic *given the brief*. A run stays replayable, a visual
regression stays a readable diff, and the ceiling rises. That single reframing is
what lets this codebase become the factory without discarding what makes it good.

**On n8n:** build the seam, defer the tool. There is no n8n today and no reason to
adopt it before an HTTP job contract exists. Once it does, n8n is a reasonable
choice for triggers, approval gates, notifications and delivery — and a poor one
for anything that should stay typed and tested.

**On the biggest commercial insight in the repository**, which is the project's
own and which I would act on early: *a business with no website is BusinessForge's
ideal customer, and it is the case the platform serves worst*
(`NEXT_SESSION.md`). Three of five real businesses produced 126–174 words and
zero images. The two fixes named there — render JS-rendered sites properly, and
use the Maps listing's own owner-uploaded photography — **invent nothing** and
would roughly double the material available for the customers who need the
product most. That is rare: a large quality gain that is fully compatible with the
truth constraint.

### The one-paragraph verdict

Keep the colour system, the renderer, the escaping discipline, the provider
abstraction, the config discipline, the resumable artifacts, the coverage harness,
and above all the writer's structural anti-invention design — that last one is the
idea the whole product should be built around, and it should be generalised from
contact data to every claim on the page. Replace the deploy stub, the two-value
provenance model, the string-only content contract, and the industry→design lookup.
Remove the 38 throwing skills, the dead dark-scheme path, and every stale
documentation claim. Build deployment, evidence, a QA gate and a job contract —
in that order — and BusinessForge stops being a promising pipeline and becomes a
factory that can be trusted with a real customer's real business.

---

_Audit complete. No file in the repository was modified; `git status --porcelain`
is empty. Artifacts generated during the audit live in `output/examples/`
(gitignored) and can be inspected: open `output/examples/index.html` for all 51
sites, `output/examples/comparison.md` for the decision matrix._
