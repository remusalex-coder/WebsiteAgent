# Project Status

_Last updated: 2026-08-07_

> **Canonical status now lives in BusinessForge HQ (Notion) → Executive
> Dashboard.** This file remains the in-repo technical reference: architecture,
> known limitations and engineering debt. For milestone, blockers and next
> action, read the Dashboard.

Autonomous website builder: one Google Maps URL in, a deployed website out.
Stages 1–5b and the renderer implemented; stage 6 stubbed. **Stages 4 and 5 have
never executed against a live model** — that is the current milestone.

## Architecture

Six single-responsibility agents communicating only through the contracts in
`lib/types.ts`. No agent imports another; each is replaceable and runnable alone.
`main.ts` owns configuration, the browser lifecycle, and artifact persistence —
agents take no ambient dependencies (no `process.env`, no `console`, no singletons),
receiving everything through `AgentContext`.

Beneath the pipeline sits a **capability platform**: AI providers, skills and MCP
servers, all pluggable by configuration. An agent asks for a capability and never
learns how it is provided, so adding a provider, implementing a skill or registering a
server touches no agent, no stage, and no JSON artifact.

Beside it sits the **renderer**: a pure `WebsiteContent → static site` function. Not an
agent, because it needs nothing an agent gets — no model, no browser, no context. It
runs after stage 5 and deployment will consume it unchanged.

```
main.ts              orchestration, CLI, run lifecycle
agents/              one file per stage
lib/                 browser · config · logger · errors · types
  ai/                AIProvider contract, factory, 4 vendor adapters
  platform/          capability vocabulary, telemetry, skills, MCP
  render/            WebsiteContent → index.html + styles.css + assets
test/                node:test suites, fixtures, snapshots
docs/                architecture · providers · skills · mcp · renderer · config · dev guide
output/              artifacts (gitignored)
```

## Pipeline

| # | Agent | In → Out | Status |
|---|---|---|---|
| 1 | `discoveryAgent` | Maps URL → `DiscoveryResult` | ✅ verified live |
| 2 | `collectorAgent` | identity → `CollectedBusiness` | ✅ verified live |
| 3 | `normalizerAgent` | both → `BusinessProfile` | ✅ verified live |
| 4 | `businessAnalystAgent` | profile → `BusinessStrategy` | ⚠️ built, **never executed** |
| 5 | `writerAgent` | profile + strategy → `WebsiteContent` | ⚠️ built, **never executed** |
| 5b | `designAgent` | all three → `WebsiteDesign` | ✅ built and tested (no model call) |
| — | `lib/render` | content + design → `index.html`, `styles.css`, assets | ✅ built and tested |
| 6 | `lovableAgent` | content → `DeploymentResult` | ⛔ stub |

Stages 1–3 need no credentials. Stage 4 onward needs an AI provider — `AI_PROVIDER`
plus that vendor's key. Anthropic, OpenAI, Gemini and OpenRouter are all supported.
The renderer needs no credentials and makes no network call.

## Completed

**1. Discovery** — Playwright/Chromium. Name, category, address, phone, website,
coordinates, rating, hours, place id, socials. Handles short links, place URLs, and
search URLs (opens the first result). Declines the EU consent interstitial; never
accepts. Canonicalises through a bare `ftid` URL to get a clean single-pane DOM.

**2. Collection** — crawls the business website on the shared browser session.
Logo, favicon, hero, gallery, visible text, navigation, services, emails, phones,
social links. Images found in `<img>` (incl. lazy `srcset`/`data-src`) **and** CSS
`background-image`. Bot-verification walls are detected and skipped, never solved.
Writes `content.md`, `collector.json`, `assets/`.

**3. Normalization** — merges both sources into one attributed profile. Every field
is `{ value, source, sourceUrl, alternatives[] }`. Dedup by meaning: phones on last
9 digits, social URLs on path, images by CDN path **and** SHA-256 of bytes, page text
by content hash. Strips tracking params. Validates required fields; reports rather
than throws. Writes `business.json`.

**4. Business analysis** — structured outputs through the provider layer. Category,
goals, audience, pages, features, backend/frontend modules, SEO priorities — each with
a `rationale` and an `evidence` list naming the profile facts behind it. Writes
`strategy.json`. Names no vendor: it asks `ctx.platform.ai()` and runs unchanged on
any of the four providers.

**Platform (infrastructure, not a stage)** — three pluggable subsystems reached through
`ctx.platform`:

- **Providers.** One `AIProvider` interface, four adapters (Anthropic via SDK; OpenAI,
  Gemini and OpenRouter over `fetch`). Selected by `AI_PROVIDER`. A fifth vendor is one
  adapter file plus two list entries. `lib/ai/providers/anthropic.ts` is the only file
  in the repository importing a vendor SDK.
- **Skills.** `SkillRegistry` / `SkillLoader` / `SkillManager` with register,
  unregister, discover, execute and health. 38 reserved capability ids across eight
  categories, plus runtime discovery of `*.skill.ts` from `SKILLS_DIR`.
- **MCP.** `MCPManager` over an `MCPConnector` contract (metadata, health, capabilities,
  execute), with capability caching and cross-server search.

Every call returns a `CapabilityOutcome` rather than throwing, and every provider,
skill and server reports health, version, latency, errors and availability.

**Renderer (a library, not a stage)** — `WebsiteContent` → `index.html`, `styles.css`
and the assets the page refers to. Semantic HTML5, one `<h1>`, named section landmarks,
a skip link, no invented `alt` text, mobile-first fluid layout, and no external request
of any kind — a rendered site opens from disk.

**Deterministic**: the same spec renders to the same bytes on any machine. No clock, no
randomness; JSON-LD keys are sorted and the copyright line carries no year. That is
what makes a rendered site diffable and the snapshots in `test/__snapshots__/` worth
having.

Every string in the spec is treated as untrusted, and escaping is enforced by the type
system rather than by discipline — `Html` is a branded string and the element builders
accept nothing else. A `javascript:` call to action renders as plain text, a palette
entry that is really a CSS fragment falls back to a default, and a `</script>` inside
the JSON-LD cannot close its own element. Nothing about bad content throws: it is
worked around and reported in `site.warnings`. See [docs/renderer.md](docs/renderer.md).

Run standalone with `npm run render -- output/<runId>/5-content.json`.

## Pending

**6. Deployment** — a rendered site → a live URL. Consumes `renderSite` output
unchanged; it uploads `RenderedFile[]` rather than rendering its own. **The only
remaining stub.**

**Live verification of stages 4 and 5.** Both are implemented and unit-tested;
neither has made a model call. Their first execution is the current milestone and
needs one credential. See `NEXT_SESSION.md` for the four gates.

## Known limitations

**Google serves a reduced pane** to unauthenticated headless sessions: **no review
count**, **only today's opening hours**, and **no social links** unless the listed
website is itself a profile. The extraction strategies exist and will pick these up
wherever Maps renders them; until then the fields are honestly `null`. Getting them
reliably means the Places API, not scraping.

**Selectors are Google's to rotate.** Every field degrades to `null` rather than
breaking the run, but `discoveryAgent.ts` is the file to expect maintenance in.

Also:
- **Coordinates are `null` for a bare `?ftid=` input** — that page carries none. Normal place and search URLs resolve them.
- **Search URLs are non-deterministic** — the same query returned a different business across runs. Prefer place URLs.
- **Bot-walled sites yield zero pages** (by design — we detect, we don't solve).
- **Services extraction is heuristic** — headings/list items on a services-type page, else nav entries. Verbatim, but expect false positives on unusual layouts.
- **E.164 only when derivable** — explicit `+`, or NANP length on a US/CA address. A UK number without `+` keeps `e164: null`. No country code is ever invented.
- **Address components are best-effort** on comma-separated forms; `formatted` is always verbatim.
- **Stage 4's live call has never run** — no API key was available.

**Platform limits, all deliberate and all declared:**

- **All 38 built-in skills are placeholders.** Reserved ids with settled contracts and
  nothing bound behind them. Each reports version `0.0.0`, health `unavailable`, and
  `not_implemented` from `execute` — never an empty result that would let a caller
  produce output looking complete.
- **The stdio MCP transport is not implemented.** Spawning, framing and reaping a child
  process correctly is real work; it is declared honestly rather than half-built.
- **The OpenAI, Gemini and OpenRouter adapters and the MCP HTTP connector have never
  run against a live endpoint.** They follow their published request and response
  shapes and pass the typecheck, but the first real call of each is the test.
- **The provider layer is text-only.** No multimodal input, no embeddings, no image or
  audio generation — which is what blocks the `vision`, `embeddings`,
  `image-generation` and `speech` skills specifically.

**Renderer limits, all deliberate:**

- **One page.** `WebsiteContent` describes one document — it has `sections`, not
  `pages` — so the renderer emits one. The strategy's multi-page recommendation is not
  reachable without changing a contract this milestone was told not to change.
- **No `og:image` for a local asset.** A crawler has nothing to resolve a relative path
  against, and the deployment URL is not known at render time. Emitted only when the
  logo is an absolute `http(s)` URL.
- **Bullets are flat strings**, so an `faq` section renders as a list rather than
  question/answer pairs. Splitting one would mean guessing where the question ends.
- **No web fonts.** A typeface name becomes the first entry in a system stack; if the
  visitor does not have it, they see the fallback. Fetching one would mean an external
  request, which would end the "opens from disk" property.
- **The rendered site has never been deployed** — it has been opened from disk and
  read, and it is covered by tests, but no host has served it.

## Engineering debt

- ~~**Everything after stage 3 is uncommitted.**~~ **Resolved 2026-08-07** — 158 files, 30,003 lines committed as `f078d4b` and pushed to `origin/main`.
- ~~**No `.gitattributes`**~~ **Resolved 2026-08-07** — `* text=auto eol=lf` plus binary rules, added before the first large commit so the repository never needed a renormalisation pass.
- **The capability platform has no tests.** Its boot path, policy, structured errors and telemetry were verified by a runtime smoke run, not by anything committed. The registry, the manager's `blockingReason` ladder, and the schema translation are the pieces most worth covering.
- **Only the renderer is tested.** `npm test` runs 110 assertions, all in `test/render/`. Nothing else in the repository has a committed test.
- **Older suites still live outside the repo** — discovery parsers, normalizer primitives, merge/dedup/validation, analyst schema and analyst brief remain in a scratchpad rather than `test/`.
- **No accessibility or HTML validation in CI.** The markup is checked by assertions about the string, not by axe or the W3C validator. A real audit would be worth one pass before the first deploy.
- **No retry/backoff** on transient Maps or site failures beyond Playwright's timeouts. The platform reports `retryable` honestly on every failure, but nothing acts on it yet.
- `npm install` downloads Chromium (~150 MB) via `postinstall`.
