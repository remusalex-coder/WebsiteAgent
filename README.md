# WebsiteAgent

Autonomous website builder. One Google Maps URL in, one deployed website out.

> **📓 Full documentation lives in BusinessForge HQ (Notion).** Status, roadmap,
> architecture, decision log, backlog and one page per subsystem. Start at the
> Executive Dashboard. This README covers running the code; the HQ covers why it
> is the way it is.

**Status: stages 1–5b and the renderer implemented; stage 6 is a stub.**
Stages 1–3 are verified against live sites. **Stages 4 and 5 have never executed
against a real model** — they are built, typechecked and unit-tested, and their
first live call is the current milestone.

## Pipeline

```
mapsUrl
  -> discoveryAgent       -> DiscoveryResult    who is this business?      [verified live]
  -> collectorAgent       -> CollectedBusiness  what are the raw facts?    [verified live]
  -> normalizerAgent      -> BusinessProfile    one canonical truth        [verified live]
  -> businessAnalystAgent -> BusinessStrategy   what should the site do?   [never executed]
  -> writerAgent          -> WebsiteContent     what should the site say?  [never executed]
  -> designAgent          -> WebsiteDesign      how should it look?        [implemented]
  -> lib/render           -> index.html + css   turn the spec into a site  [implemented]
  -> lovableAgent         -> DeploymentResult   build it and put it online [stub]
```

Stages 1–3 need no credentials. Stage 4 onward needs an AI provider — any of
Anthropic, OpenAI, Gemini or OpenRouter, chosen by `AI_PROVIDER`. The renderer needs
none: it is a deterministic function, not an agent.

Each stage's output is persisted to `output/<runId>/` before the next begins, so a
failed deploy never means re-scraping.

Underneath the pipeline sits a **capability platform**: pluggable AI providers, skills
and MCP servers. Agents ask it for what they need and never learn how it is provided —
see [docs/architecture.md](docs/architecture.md).

## Layout

```
main.ts              orchestration, CLI, run lifecycle
agents/
  discoveryAgent.ts  Maps URL  -> business identity
  collectorAgent.ts  identity  -> raw facts (text, images, contacts, services)
  normalizerAgent.ts both       -> one canonical, attributed profile
  businessAnalystAgent.ts
                     profile   -> strategy: category, audience, pages, modules, SEO
  writerAgent.ts     + strategy-> site structure, copy, brand voice, SEO
  lovableAgent.ts    spec      -> live site
lib/
  browser.ts         headless browser abstraction (Playwright-shaped, driver-agnostic)
  config.ts          typed config; the only module that reads process.env
  logger.ts          structured, scoped logging
  types.ts           domain contracts shared between stages
  errors.ts          error taxonomy
  ai/                provider-agnostic LLM layer
    types.ts         the AIProvider contract every vendor implements
    factory.ts       selects a provider from AI_PROVIDER
    protocol.ts      shared HTTP/JSON transport
    schema.ts        schema translation, JSON recovery, local validation
    http.ts          request deadlines and health probes
    providers/       one adapter per vendor (anthropic, openai, gemini, openrouter)
  platform/          pluggable capabilities
    platform.ts      createPlatform(); the object every agent receives
    types.ts         health, structured errors, outcomes, metrics
    telemetry.ts     latency, availability and error accounting
    skills/          registry, loader, manager, 38 built-in capability ids
    mcp/             connector contract, manager, http + stdio transports
  render/            WebsiteContent -> a static site. Deterministic, no I/O
    index.ts         the public surface: renderSite, writeRenderedSite
    html.ts          escaping and element construction
    theme.ts         brand voice -> validated design tokens
    css.ts           the stylesheet
    sections.ts      one renderer per SectionKind
    document.ts      head, header, nav, footer, JSON-LD
    site.ts          renderSite()
    write.ts         the only part that touches the filesystem
test/                node:test suites, fixtures and snapshots
docs/                architecture, providers, skills, MCP, renderer, config, dev guide
output/              per-run artifacts (gitignored)
```

## Design rules

These are what keep the agents swappable — worth holding to as bodies get filled in.

1. **One responsibility per agent.** The collector never writes prose. The writer never
   browses. The Lovable agent never makes content decisions.
2. **Agents never import each other.** They communicate only through the types in
   `lib/types.ts`, so any stage can be replaced or run standalone.
3. **No ambient dependencies.** No `process.env`, no `console`, no module singletons
   inside an agent — everything arrives via `AgentContext`.
4. **The orchestrator owns lifecycles.** `main.ts` opens and closes the browser; agents
   borrow it through `ctx.getBrowser()`.
5. **Facts are grounded.** The writer may only make claims traceable to collected data.
   Gaps go in `unresolvedGaps` rather than being filled with plausible copy.
6. **No agent knows which vendor it is talking to.** A stage that needs a model asks
   `ctx.platform.ai()` for an `AIProvider` and calls `generate()`. No agent imports a
   vendor SDK, names a vendor, or reads a vendor's API key — so switching from Anthropic
   to OpenAI, Gemini or OpenRouter is one environment variable and zero agent changes.

## Getting started

`npm install` also downloads the Chromium build Playwright drives (~150 MB, via
`postinstall`).

```bash
npm install
```

Run stage 1 on its own. It prints the `DiscoveryResult` to stdout, logs to stderr, and
writes `output/discovery.json`:

```bash
npm run discover -- "https://maps.app.goo.gl/example"
```

The full pipeline runs stage 1 and then stops at the `collectorAgent` stub:

```bash
npm run dev -- "https://maps.app.goo.gl/example"
```

Stages 1–3 need no credentials. Stage 4 onward needs an AI provider — see below.

Render a saved content spec into a site, without running the pipeline:

```bash
npm run render -- output/<runId>/5-content.json
```

That writes `index.html`, `styles.css` and the assets the page refers to into
`output/<runId>/site/`, prints the path to the page, and reports anything it had to
work around on stderr. `--out=<dir>` writes somewhere else. Needs no credentials and
makes no network call — open the result straight from disk.

Run the tests:

```bash
npm test
```

> Nothing loads `.env` automatically: there is no `dotenv` dependency and the npm
> scripts do not pass `--env-file`. Export the variables in your shell, or invoke Node
> with `--env-file=.env` yourself.

## AI providers

Every stage that uses a model goes through one interface, `AIProvider`, and receives it
from `ctx.platform.ai()`. Agents contain no vendor logic, so a provider is chosen
entirely by configuration.

**Switching providers is two lines.** Set the provider and its key:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

That is the whole change — no code edit, no agent edit, no schema edit. The artifacts
(`strategy.json` and everything downstream) are byte-identical in shape regardless of
which vendor produced them.

| `AI_PROVIDER` | API key | Default model | Native JSON schema |
| --- | --- | --- | --- |
| `anthropic` (default) | `ANTHROPIC_API_KEY` | `claude-opus-5` | yes |
| `openai` | `OPENAI_API_KEY` | `gpt-5` | yes (`strict: true`) |
| `gemini` | `GEMINI_API_KEY` | `gemini-2.5-pro` | yes (OpenAPI subset) |
| `openrouter` | `OPENROUTER_API_KEY` | `openai/gpt-5` | per model |

Only the selected provider's key is required. `AI_PROVIDER` defaults to `anthropic`, so
an existing `.env` that sets only `ANTHROPIC_API_KEY` keeps working unchanged.

### Structured output, and what happens when a provider cannot enforce it

Each stage supplies a JSON Schema; the provider's job is to return an object that
validates against it. Where the vendor enforces schemas server-side, it is used
directly. Where it cannot — an OpenRouter model that rejects `response_format`, or a
schema Gemini finds too complex — the adapter falls back deterministically: the schema
goes into the prompt, the response is recovered by a string- and escape-aware brace
scan, and it is then **validated against the same schema locally** before being
returned. A response that does not conform fails in the provider with a message naming
the offending fields, rather than surfacing as an `undefined` three stages later.

The fallback is transparent to the caller. `AIGenerateResult.structuredOutput` reports
`native` or `instructed` for the run log, and the returned object is identical either
way. Agent prompts are never modified — the schema instruction is appended by the
adapter, which is where a vendor's formatting quirks belong.

### Endpoint overrides

Each provider accepts a base-URL override, which is the seam for an Azure deployment, a
local Ollama, a gateway or a proxy — no adapter change:

```bash
OPENAI_BASE_URL=https://my-gateway.internal/v1
```

### Effort

`ANALYST_EFFORT` (and `WRITER_EFFORT`) take `low` … `max` and are mapped per vendor:
Anthropic accepts all five verbatim; OpenAI and OpenRouter clamp `xhigh`/`max` to their
`high`; Gemini maps them onto a thinking budget.

### Errors

Misconfiguration fails with a message that names the fix, and does so at the point a
stage actually asks for a model — so stages 1–3 still run with the AI environment unset
or wrong:

| Error | Cause |
| --- | --- |
| `MissingProviderError` | `AI_PROVIDER` resolved to nothing |
| `UnsupportedProviderError` | named a vendor with no adapter; lists the valid names |
| `MissingApiKeyError` | adapter exists, credentials do not; names the exact variable |
| `ProviderRequestError` | the request failed — HTTP status, refusal, truncation, or a response that would not validate |

### Adding a fifth provider

1. Write `lib/ai/providers/<vendor>.ts` exporting a `ProviderAdapter`.
2. Add its name to `AI_PROVIDER_NAMES` in `lib/ai/types.ts`.
3. Add one line to the table in `lib/ai/providers/index.ts`.

Nothing else changes — no agent, no config consumer, no artifact.

## The capability platform

Providers are one of three pluggable subsystems. All three reach agents through one
object on `AgentContext`:

```ts
const model  = ctx.platform.ai();                  // some vendor
const pdf    = ctx.platform.skills.get('pdf');     // some library
const github = ctx.platform.mcp.get('github');     // some server
```

Nothing in an agent names Anthropic, Playwright, or an endpoint. That is the property
the platform exists for: **adding a provider, implementing a skill or registering a
server changes configuration and at most one adapter file — never an agent, never a
stage, never a JSON artifact.**

### Capabilities return errors, they do not throw

`skills.get(id)` returns a handle for **any** id, registered or not:

```ts
const ocr = ctx.platform.skills.get('ocr');
if (!ocr.available) {
  gaps.push('menu is an image and OCR is not configured');
} else {
  const out = await ocr.execute({ image: asset.localPath });
  if (!out.ok) ctx.logger.warn('ocr failed', { code: out.error.code });
}
```

An unknown, disabled, uncredentialled or unimplemented skill yields `available: false`
and returns the reason as data. A caller never writes a null check and never wraps an
optional capability in `try`/`catch` — which is where "we couldn't do it" quietly
becomes "we did nothing". `skills.require(id)` throws instead, for the cases you cannot
proceed without.

Error codes are a closed set: `not_registered`, `disabled`, `not_implemented`,
`missing_dependency`, `missing_credential`, `invalid_input`, `timeout`, `cancelled`,
`upstream`, `internal`.

### Skills

38 capability ids across eight categories — browser automation, Playwright, GitHub,
Lovable, Firecrawl, Google Maps, vision, OCR, image generation, PDF, Word, Excel,
PowerPoint, email, calendar, filesystem, git, web search, SEO, analytics, CMS,
translation, speech, vector store, embeddings, database, deployment, authentication,
payments, monitoring, logging, notifications, scheduling, social media, API testing,
performance testing, security scanning, accessibility testing.

**All 38 are placeholders**, and they say so rather than pretending: `version` is
`0.0.0`, `health()` reports `unavailable` with the reason, and `execute()` returns
`not_implemented` — **never an empty result**, which would let a caller carry on with
nothing and produce output that looks complete.

Implementing one means replacing its entry, or dropping a `*.skill.ts` into a
`SKILLS_DIR` reusing the same id — discovered skills replace built-ins deliberately.
Either way no agent changes.

```bash
SKILLS_DIR=./skills           # scanned at startup
SKILLS_DISABLED=payments      # deny-list, always wins over SKILLS_ENABLED
SKILL_TIMEOUT_MS=120000       # a skill cannot hang a stage
```

### MCP servers

Registering one takes no code:

```bash
MCP_SERVERS='[{"id":"github","transport":"http","endpoint":"https://api.githubcopilot.com/mcp/","headers":{"Authorization":"Bearer ghp_xxx"}}]'
```

The HTTP transport (JSON-RPC over Streamable HTTP, sessions, SSE or JSON responses) is
implemented. The **stdio transport is declared but not implemented** — spawning,
framing and reaping a child process correctly is real work that was not part of this
refactor, so it reports `unavailable` and returns `not_implemented` rather than being
half-built.

> The HTTP connector and the OpenAI, Gemini and OpenRouter adapters have **never run
> against a live endpoint.** They follow their published shapes and pass the typecheck;
> treat the first real call of each as the test.

### Observability

Every provider, skill and MCP server reports health, version, latency, errors and
availability:

```ts
const rows = await ctx.platform.status();
// [{ id, kind, name, version, enabled, health, metrics }, …]
```

`metrics` carries calls, failures, availability (successes ÷ attempts), and latency
avg/p50/p95/max/last from a bounded sample ring. Refused calls are recorded too — an
agent repeatedly asking for a capability that is not there is exactly what a status
board should show.

`platform.describe()` gives a credential-free summary safe to log: it reports which
credential variable **names** are set, never their values.

Full detail: [docs/](docs/) — [architecture](docs/architecture.md),
[providers](docs/providers.md), [skills](docs/skills.md), [MCP](docs/mcp.md),
[configuration](docs/configuration.md), [developer guide](docs/developer-guide.md).

## Stage 1: what discovery extracts

Name, category, address, phone, website, coordinates, rating, opening hours, place id,
and Instagram / Facebook / TikTok links. Every field except `name` is nullable — a
listing that omits one is normal, and the agent logs which fields came back empty
rather than guessing. Only failing to resolve a listing at all is an error.

Input can be a short link, a `/maps/place/` URL, or a `/maps/search/` URL. Search URLs
resolve to their first result, so they are inherently ambiguous — Google does not
return a stable result set for the same query. Prefer a place URL for reproducibility.

Three limits are Google's, not the agent's. To an unauthenticated headless session
Maps currently serves a reduced pane that contains **no review count**, **only today's
opening hours** (the week is behind a toggle that variant does not render), and **no
social links** unless the business's listed website is itself a social profile. The
extraction strategies for all three are in place and will pick the data up wherever
Maps does render it; until then those fields are honestly `null`.

Google rotates the obfuscated class names these selectors match. Every field is read
through an ordered list of strategies and degrades to `null`, so a rotation thins the
result rather than breaking the run — but `agents/discoveryAgent.ts` is the file to
expect maintenance in.

## Stage 2: what the collector extracts

From the business's own website, reusing the browser session the orchestrator already
opened: logo, favicon, hero image, gallery images, the visible text of every page,
navigation, services, emails, phones and social profiles.

Nothing is generated or rewritten — every string was present on a page verbatim — and
**every value carries the `sourceUrl` it was read from**, so the writer can cite any
fact it uses.

It writes three artifacts:

```
output/content.md      visible text, page by page, unmodified
output/collector.json  the full CollectedBusiness
output/assets/         every downloaded image, named <role>-<slug>-<hash>.<ext>
```

The crawl is bounded by `COLLECTOR_MAX_PAGES` (default 6) and spends its budget by
ranking: service and menu pages first, then contact and location pages, then gallery
and about pages. Boilerplate — privacy, terms, cart, login — is skipped.

Images are found in `<img>` (including lazy `srcset` / `data-src`) **and** in CSS
`background-image`, which is where most modern sites put their photography. An image
that fails to download stays in the result with `localPath: null` rather than
vanishing, so a failed fetch is visible rather than silent.

Known limits, all deliberate:

- **Bot-verification walls are detected and skipped, never solved.** A site behind one
  yields zero pages and a warning. Without that check the challenge page — "Let's
  confirm you are human" — would become the business's website copy.
- **Services are a heuristic.** On a page that is *about* services, its headings and
  list items are taken as the offering; elsewhere only navigation entries naming a
  service page count. Names are copied verbatim, never invented.
- **Phone numbers prefer `tel:` links.** Body-text matching is deliberately
  conservative (9+ digits) so dates and order numbers do not become phone numbers.
- **A listing with no website returns an empty result, not an error** — and never
  opens a browser. The writer still has the Maps identity to work from.

## Stage 3: what the normalizer produces

One `BusinessProfile`, written to `output/business.json`. It merges the listing and
the website, deduplicates, normalises and validates. It fetches nothing and writes no
prose — pure functions over the two previous stages' output.

**Every field records where it came from and what it beat.** A value is
`{ value, source, sourceUrl, alternatives[] }`, so a wrong pick is auditable and no
observed value is silently discarded.

How conflicts resolve, when both sources have an opinion:

| Field | Winner | Why |
| --- | --- | --- |
| name | Maps listing | the listing is the authoritative name; page titles carry taglines |
| website | the origin the homepage actually resolved to | beats what either source recorded — that is how `http://www.x.com` loses to the `https://x.com` it redirects to |
| phone | the E.164-derivable candidate | a dialable number beats a prettier one |
| social profiles | the site's own link | a business linking its own profile beats a link scraped off a listing |
| images | the largest variant that downloaded | a file on disk beats a reference that never resolved |

Deduplication is by meaning, not string equality: phones compare on their last nine
digits, so `+1 415-487-2600` and `(415) 487-2600` are one number; URLs compare with
scheme, `www.` and trailing slash removed; social URLs compare on path alone, so
`?hl=en` does not fork an account; images collapse both by CDN path — `?w=400` and
`?w=2000` are one photograph — and by SHA-256 of the downloaded bytes, which catches
the same picture served under two URLs; page text collapses on a hash of its content,
so one page served on two routes appears once.

Tracking parameters (`utm_*`, `gclid`, `fbclid`, `igshid`, `si`, `mc_cid`, and the
rest) are stripped from every URL. Real query parameters survive.

Two things it will not do. **It never invents a country code**: E.164 is produced only
from an explicit `+`, or a NANP-length number on a demonstrably US or Canadian
address — a UK number without a `+` keeps `e164: null`. And **address components are
best-effort**: `formatted` is always the address as published, and any part that
cannot be identified stays `null` rather than being guessed at.

Validation reports rather than throws. Errors — empty name, no location, no way to
contact the business — set `validation.ok` to false; everything else is a warning. The
profile is still produced, so the writer can decide what to do about a gap. Only an
empty business name is fatal, since nothing downstream can proceed without it.

## Stage 4: what the analyst decides

One `BusinessStrategy`, written to `output/strategy.json`: the business category, its
goals, its primary and secondary audiences, and recommended pages, features, backend
modules, frontend modules and SEO priorities.

**Every recommendation carries a `rationale` and an `evidence` list** naming the facts
in the profile it rests on, so a reader can tell an inference from a guess. Anything
the profile could not settle goes to `openQuestions` rather than becoming a confident
recommendation. It is the first stage that uses an LLM, and the last one before any
prose gets written: it produces strategy only — no markup, no code, no site copy.

The model is not handed the raw profile. `buildBrief` renders it as a factual brief —
identity, contact, services, navigation, imagery, bounded excerpts of the site text,
and the profile's own validation gaps, since a missing phone number is itself a
finding. Per-field provenance and rejected alternatives stay out: they matter for
auditing, not for analysis.

The stage names no vendor. It asks `ctx.platform.ai()` for an `AIProvider`, hands it the
brief and the schema, and gets a validated object back — so the same stage runs on
Anthropic, OpenAI, Gemini or OpenRouter unchanged. See [AI providers](#ai-providers).

Configuration lives under `ANALYST_*` in `.env`:

| Variable | Default | Notes |
| --- | --- | --- |
| `ANALYST_MODEL` | the provider's default | e.g. `claude-opus-5` on `anthropic`, `gpt-5` on `openai` |
| `ANALYST_EFFORT` | `high` | `low` … `max`; how deeply the model reasons |
| `ANALYST_MAX_OUTPUT_TOKENS` | `32000` | caps thinking **and** response together |
| `ANALYST_MAX_PAGE_CHARS` | `4000` | per-page cap on site text in the brief |

What the stage still owns is the prompt, the schema, and the check that the object it
got back is the one it asked for. Everything vendor-shaped now lives in the adapter —
so these notes are about `lib/ai/providers/anthropic.ts`, not about this agent:

- **Structured outputs, not prompt-and-parse.** The response is constrained to a JSON
  schema, so the shape is guaranteed rather than hoped for. That schema must keep
  `additionalProperties: false` and a complete `required` list on every object, and
  must avoid `minLength` / `minItems` / `minimum` — the API rejects those keywords.
  Every adapter also re-validates locally before returning, so a vendor whose
  enforcement regresses fails in the provider rather than three stages later.
- **Server-side fallbacks are enabled** (`fallbacks: "default"`). Claude Opus 5's
  safety classifiers can decline a request; this re-runs a declined one on Anthropic's
  recommended substitute instead of failing the pipeline. A listing can carry arbitrary
  third-party text, so this is cheap insurance.
- **The request streams.** `max_tokens` caps thinking and response text together on
  Opus 5, and a non-streaming request that large risks an HTTP timeout. `stop_reason`
  is checked before the content is read: a refusal carries no usable text and a
  truncated response is not valid JSON, and each gets its own actionable error.

Because the analyst reports `result.model` rather than the configured id, a strategy
produced through a fallback or an OpenRouter routing decision records the model that
actually served it.

## The renderer

`WebsiteContent` in, a complete static site out — semantic HTML5, one stylesheet, and
the assets the page refers to. It is a library rather than an agent because it needs
nothing an agent gets: no model, no browser, no context. See
[docs/renderer.md](docs/renderer.md).

```ts
import { renderSite, writeRenderedSite } from './lib/render/index.js';

const site = renderSite(content);              // pure: no clock, no I/O
await writeRenderedSite(site, { sourceDir: runDir, targetDir: siteDir });
```

`renderSite` is **deterministic**: the same spec renders to the same bytes on any
machine. Nothing is read from the clock, nothing is random, and JSON-LD keys are
sorted before serialisation, so two semantically identical payloads produce identical
output. That is what makes a rendered site diffable and the snapshot tests meaningful.

It also never throws on content. A colour it cannot parse, a link scheme it refuses,
an image with nowhere to load from — each is worked around and reported in
`site.warnings`, because a spec is written by a model and failing a whole site over
one malformed field would be the wrong trade.

**Everything from the spec is escaped.** A `javascript:` call to action becomes plain
text, a palette entry that is really a CSS fragment falls back to a default, and a
`</script>` inside the JSON-LD cannot close its own element.

## Implementation order

`writerAgent` → deployment. Each is independently testable against the stage before
it, using a persisted artifact from `output/` as fixture input. Deployment consumes
`renderSite` unchanged: it uploads the `RenderedFile[]` rather than rendering its own.

Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY` before running stage 4 —
the pipeline fails fast with an actionable message if it is missing, before any
network call.
