# Next Session

_Written 2026-08-08, after the listing source and the trust engine._

> **Canonical documentation is BusinessForge HQ in Notion.** This file is the
> thirty-second version for whoever opens the repo first.

## Start here

**The provider quota is the bottleneck, not the code.** The Gemini free-tier
daily quota has now blocked stages 4–6 on two consecutive sessions. Try this
first; if it 429s again, stop waiting and get a paid key — at roughly \$0.02 a
site the cost is irrelevant next to one customer, and this has cost more
engineering time than it would ever cost in credit:

```bash
node --import tsx --env-file=.env main.ts --from=analyze f353c77b
```

`f353c77b` is a fresh Hotel Union Square run with the corrected category. Any
provider works — the analyst and writer name no vendor; set `AI_PROVIDER` and
that vendor's key in `.env`.

**Meanwhile, the platform is verifiable without a model.** See
[docs/runbooks/offline-verification.md](docs/runbooks/offline-verification.md).
That loop is what found the category defect below.

## What changed and what it bought

A business with no website is BusinessForge's ideal customer and was the case
the platform served worst. The listing is now a **content** source, not just an
identity one (`lib/sources/`). Measured live on Hotel Union Square, which has no
website at all:

| | Before | After |
| --- | --- | --- |
| Photographs | 0 | 11, at native resolution |
| Prose available to the writer | 0 chars | 610 chars of Google's editorial description |
| Stated attributes | 0 | 12, two of them correctly marked *not* available |

Also landed: the crawl waits for content instead of a fixed 1.2s; bot walls that
say "Access Denied" rather than "confirm you are human" are now caught.

## The trust engine

Trust scored lowest of the eight dimensions on all five benchmark sites, and the
reason was never missing data — every profile carried a rating, a category and
an address. They were never shown.

`WebsiteContent.trust` is now a typed list of verified signals, built by code
from the profile (never by the model, same rule as hours and the JSON-LD) and
rendered as a bar directly under the hero's call to action. **5/5 benchmark
sites render one, with no overflow at 390px.** It is the extension point:
Places API review counts, certifications and years in business become entries
here rather than new prose.

## A defect the trust bar exposed

Putting the category at the top of the page is what revealed that the benchmark
hotel's category was **"Add website"** — a Maps UI button, scraped because a
hotel pane renders no category line and the selector matched the next control
along. It had already reached the profile, the schema.org type and the design
layer's industry match, on both hotel runs, unnoticed.

Fixed in two places: discovery rejects Maps control labels and degrades to
`null`, and the normalizer recovers the real category from what the listing
states about itself — the hotel now resolves to `3-star hotel`. `scripts/trust-audit.ts`
carries a permanent check for the defect class.

**The general lesson: a field nobody renders is a field nobody validates.**

## Two findings that change the roadmap

**1. Reviews cannot be scraped. Stop trying.** Signed-out Maps serves a reduced
pane and says so in the markup. Verified against two fingerprints, including a
realistic UA with `navigator.webdriver` deleted: no Reviews tab, no photo grid,
`div[data-review-id]` matches nothing. This is a wall, not a selector problem.
Reviews and the full photo set mean the **Places API** — and that is now a
one-file job, because `lib/sources/types.ts` defines the contract and the
collector merges harvests without knowing where they came from.

**2. The salon was misdiagnosed.** Last session recorded it as JS-rendered,
yielding 62 characters. It is not: `salondnahair.com` answers a headless request
with `Access Denied: error code 4d1dbadd…`. Worse, that error page was being
collected as the business's own website copy and fed to the writer. Fixed, but
the lesson generalises — **read the collected text before believing the
diagnosis of why it is short.**

## Then, in order

1. **Places API source** (PRD-002, now the highest-ROI item). Implements
   `ListingHarvest` from an HTTP call: up to five reviews with author and
   rating, ten photos, the full week's hours, the editorial summary. Costs cents
   per site against a $0.00 baseline, which is irrelevant next to one paying
   customer. This is what finally makes the `testimonials` section reachable —
   the renderer has supported it since the design layer landed and no run has
   ever filled it.
2. **Re-run the five-industry batch** and rebuild the scorecards. The recurring
   defect table in `output/review/index.html` is now stale in at least two rows.

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

**Screenshots lie about lazy images.** Playwright's `fullPage` capture resizes
the viewport, which re-runs lazy-loading heuristics — a gallery captures as an
empty white band and looks exactly like broken CSS. Measured in the DOM it was a
correct 4×12 grid. Both harnesses strip `loading="lazy"` and await
`img.decode()`. **Measure the DOM before believing a screenshot.**

**The two stylesheets override each other silently.** `variants.ts` is emitted
after the base sheet, and re-declaring a selector there wins at equal
specificity with no warning. Twice now. Tracked as INF-007.

**Adding a field to a contract breaks every saved run.** An artifact directory is
a persistence format and old files lack the new field. Add an entry to
`ARTIFACT_DEFAULTS` in `main.ts` in the same commit, or `--from=<stage>` on any
older run fails with a `TypeError` several stages from the cause.

**A `.ts` probe script outside the repo will not run.** No `type: module` and no
`node_modules` above it. Put throwaway scripts in `output/` — gitignored, and
inside the package.

## Also true

- 282 tests pass; `npm run typecheck && npm test`.
- Provider calls retry retryable failures (429/5xx/transport) with exponential
  backoff and full jitter. They do not rescue an exhausted daily quota.
- Models: `gemini-3.6-flash` for both stages. The entire Gemini 2.5 family is
  404 for accounts created after mid-2026.
- Stage 6 deploy is still a stub. When it lands, target **Cloudflare Pages**,
  not Vercel: Vercel's Hobby tier prohibits commercial use, and BusinessForge
  hosts customer sites commercially.
- **WVBR LLP is unservable from public data** and that is a product answer, not
  an engineering one. Its listing has no website, no hours, no rating, no
  photos and two accessibility lines. Some businesses need an owner intake form;
  no amount of extraction invents facts that were never published.
