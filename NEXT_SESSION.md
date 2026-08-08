# Next Session

_Written 2026-08-08, after the Places API source and the testimonial rule._

> **Canonical documentation is BusinessForge HQ in Notion.** This file is the
> thirty-second version for whoever opens the repo first.

## Start here

**Two keys, and they are different keys.**

1. **A paid model key.** The Gemini free tier has now returned 429 on five
   attempts across three sessions. Any provider works — set `AI_PROVIDER` and
   that vendor's key; the analyst and writer name no vendor.
2. **`PLACES_API_KEY`, on a project with Places API (New) enabled.** This is
   the new one, and it is the higher-value one. Runbook:
   [places-api-source](docs/runbooks/places-api-source.md).

The Google key already in `.env` is **not** a Places key — it is scoped to the
Generative Language API and returns `401 UNAUTHENTICATED`. That was measured,
not assumed.

```bash
node --import tsx --env-file=.env main.ts --from=collect 216a1662
```

`216a1662` is a current Hotel Union Square run. Starting at `collect` is what
re-runs the sources.

**The platform still does not depend on either key.** `--compose <runId>` builds
a complete, truthful page from verified data with no model at all.

## What landed

**The `testimonials` section renders, for the first time.** The renderer has
drawn it since the design layer landed and the industry tables rank it above
`about` for six of nine industries. No run had ever filled it, because no source
could quote a customer — signed-out Maps serves no reviews, which is a wall and
was proven to be one. `lib/sources/placesApi.ts` is the source that can.

Nothing downstream of `lib/sources/` changed to gain reviews. That was the whole
point of defining `ListingHarvest` before there was a second source for it, and
it is the strongest evidence so far that the source seam is the right shape.

**The model may no longer write a testimonial.** `groundTestimonials` keeps the
section's position and heading — real editorial judgements — and replaces its
bullets *unread* with quotations that came from a source. With no verified
review the section is deleted. The prompt has forbidden fabricated testimonials
since the writer was built; a prompt is a request, and this is the version that
holds when a model misreads the brief. The brief now carries a review **count**,
never review text: a model cannot paraphrase a quotation it has not been shown.

**The review count arrived, and with it `aggregateRating`.** A signed-out pane
serves a rating with no total, so the trust bar had only ever said "4.9 on
Google" and the JSON-LD had *never once* emitted an `aggregateRating` — schema.org
requires the count and the platform does not print numbers it cannot prove.

## Two judgement calls worth re-examining

**A rating under 4.0 is no longer promoted to the trust bar.** The benchmark
hotel is 3.8, which is below average on Google's distribution, and printing it
under the headline is the page making the visitor's counter-argument for them.
The true value still goes to the JSON-LD and still appears in the contact block,
so nothing is hidden — this decides only what the business *leads with*.

Consequence to look at: that hotel now renders an **empty** trust bar, because
its category signal was already dropped as an echo of the headline. Arguably
correct — the testimonials do the reassurance work instead — but it is the first
page with no trust bar at all, and it deserves a second opinion.

**`MIN_REVIEW_CHARS` / `MAX_REVIEW_CHARS` (40–400) drop reviews rather than
trimming them.** A half-sentence in quotation marks misrepresents its author, so
length is a reason to omit a review and never a reason to edit one. On a
business whose reviews are all short, the section will be empty and vanish.

## Then, in order

1. **Enable Places API (New) and run the five-industry batch.** Everything is
   written and tested against a stub; the only unverified thing in the source is
   the live wire format. The scorecards in `output/review/index.html` are stale
   in at least two rows regardless.
2. **Reviews are now a trust extension point, not just a section.** "Rated 4.8
   by 812 guests" as a hero signal, review recency, and per-service proof are
   all `TrustSignal` entries now that the count exists.
3. **Stage 6 deploy.** Target **Cloudflare Pages**, not Vercel: Vercel's Hobby
   tier prohibits commercial use and BusinessForge hosts customer sites
   commercially.

## Repeatable commands

```bash
# Generate + measure the five-industry set (needs .env)
node --import tsx --env-file=.env scripts/batch-audit.ts

# Re-measure existing runs without regenerating
node --import tsx --env-file=.env scripts/batch-audit.ts --measure

# Rebuild the review dashboard
node --import tsx scripts/build-review.ts

# Re-render one saved spec in milliseconds
npx tsx main.ts --render output/<runId>/5-content.json
```

## Traps that will cost you an hour each

**A backtick in a CSS comment silently breaks the stylesheet.** `lib/render/css.ts`
and `variants.ts` are TypeScript template literals, so `` `display: grid` `` in a
comment closes the string. It cost twenty minutes this session *twice*, and the
second time the error was hidden because the regeneration command redirected
stderr to `/dev/null`. Never write a backtick in those files' comments, and never
silence a build you are about to screenshot.

**Screenshots lie, and they lie about alignment too.** The quote bylines were
"fixed", screenshotted, and still ragged — the fix targeted the figure when the
grid item is the `<li>` around it. `output/measure-quotes.mjs`-style DOM
measurement is what settled it. The older form of this trap: `fullPage` capture
resizes the viewport and re-runs lazy-loading, so a gallery captures as an empty
white band. **Measure the DOM before believing a screenshot.**

**Google publishes two identifiers and they are not interchangeable.** A Maps
URL carries an `ftid` (`0x…:0x…`); the Places API is keyed by a place id
(`ChIJ…`). `DiscoveryResult.placeId` is honestly either. Every run in the repo
holds the hex form, so a source that passed it straight through would 404 on
every business ever collected — and look exactly like a business with no
reviews. `resolvePlaceId` exchanges one for the other.

**The two stylesheets override each other silently.** `variants.ts` is emitted
after the base sheet, and re-declaring a selector there wins at equal
specificity with no warning. Twice now. Tracked as INF-007.

**Adding a field to a contract breaks every saved run.** An artifact directory is
a persistence format and old files lack the new field. Add an entry to
`ARTIFACT_DEFAULTS` in `main.ts` in the same commit — this session added four.

**A `.ts` probe script outside the repo will not run.** No `type: module` and no
`node_modules` above it. Put throwaway scripts in `output/` — gitignored, and
inside the package.

## Also true

- 336 tests pass; `npm run typecheck && npm test`.
- A photo URL must never carry a credential. The Places media endpoint takes the
  key as a query parameter, so the source resolves each photograph to a plain
  `googleusercontent` URL first. A test asserts it.
- Provider calls retry retryable failures (429/5xx/transport) with exponential
  backoff and full jitter. They do not rescue an exhausted daily quota.
- Models: `gemini-3.6-flash` for both stages. The entire Gemini 2.5 family is
  404 for accounts created after mid-2026.
- **WVBR LLP is unservable from public data** and that is a product answer, not
  an engineering one. Some businesses need an owner intake form; no amount of
  extraction invents facts that were never published.
