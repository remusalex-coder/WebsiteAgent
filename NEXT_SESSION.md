# Next Session

_Written 2026-08-08, after making the Maps listing a content source._

> **Canonical documentation is BusinessForge HQ in Notion.** This file is the
> thirty-second version for whoever opens the repo first.

## Start here: one command is owed

The hotel run `output/e6187d7d` has stages 1–3 on disk and **stages 4–6 never
ran** — the Gemini free-tier daily quota was exhausted mid-session. The whole
point of last session's work is unmeasured until this finishes:

```bash
node --import tsx --env-file=.env main.ts --from=analyze e6187d7d
```

If the quota is still spent, put any other provider key in `.env` and set
`AI_PROVIDER` — the analyst and writer name no vendor.

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
say "Access Denied" rather than "confirm you are human" are now caught; the star
rating renders for the first time.

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
2. **Hero trust badge** (PRD-008b). The rating currently renders as a contact
   row, which is the weakest possible placement. One optional field on
   `WebsiteContent`, one branch in `renderHead`, snapshots regenerated.
3. **Re-run the five-industry batch** and rebuild the scorecards. The recurring
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

**A `.ts` probe script outside the repo will not run.** No `type: module` and no
`node_modules` above it. Put throwaway scripts in `output/` — gitignored, and
inside the package.

## Also true

- 272 tests pass; `npm run typecheck && npm test`.
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
