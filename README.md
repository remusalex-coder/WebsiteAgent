# WebsiteAgent

Autonomous website builder. One Google Maps URL in, one deployed website out.

**Status: stages 1–3 implemented.** `discoveryAgent`, `collectorAgent`,
`normalizerAgent` and the `config`, `logger`, and `browser` libraries are real.
Stages 4–5 are documented stubs that throw `NotImplementedError`.

## Pipeline

```
mapsUrl
  -> discoveryAgent  -> DiscoveryResult     who is this business?     [implemented]
  -> collectorAgent  -> CollectedBusiness   what are the raw facts?   [implemented]
  -> normalizerAgent -> BusinessProfile     one canonical truth       [implemented]
  -> writerAgent     -> WebsiteContent      what should the site say? [stub]
  -> lovableAgent    -> DeploymentResult    build it and put it online[stub]
```

Each stage's output is persisted to `output/<runId>/` before the next begins, so a
failed deploy never means re-scraping.

## Layout

```
main.ts              orchestration, CLI, run lifecycle
agents/
  discoveryAgent.ts  Maps URL  -> business identity
  collectorAgent.ts  identity  -> raw facts (text, images, contacts, services)
  normalizerAgent.ts both       -> one canonical, attributed profile
  writerAgent.ts     profile   -> site structure, copy, brand voice, SEO
  lovableAgent.ts    spec      -> live site
lib/
  browser.ts         headless browser abstraction (Playwright-shaped, driver-agnostic)
  config.ts          typed config; the only module that reads process.env
  logger.ts          structured, scoped logging
  types.ts           domain contracts shared between stages
  errors.ts          error taxonomy
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

## Implementation order

`writerAgent` → `lovableAgent`. Each is independently testable against the stage
before it, using a persisted artifact from `output/` as fixture input.

Copy `.env.example` to `.env` before starting on `writerAgent` — discovery and
collection need no credentials, but the writer and Lovable stages do.
