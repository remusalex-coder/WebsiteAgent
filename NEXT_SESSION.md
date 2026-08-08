# Next Session

_Written 2026-08-08, after the five-industry validation batch (`47b040f`)._

> **Canonical documentation is BusinessForge HQ in Notion.** This file is the
> thirty-second version for whoever opens the repo first.

## Where the project actually is

The pipeline works end to end and has been run on **six real businesses**. It
costs **$0.00** per site and takes about 90 seconds. Industry classification was
correct 5/5 across restaurant, dentist, law firm, hotel and salon.

**Open the review dashboard first:** `output/review/index.html`. Scorecards,
comparison matrix, recurring-defect table, side-by-side full pages.

## The one thing that matters now

The batch split in two, and the split is the whole story:

| Profile | Sites | Words | Images | Cause |
| --- | --- | --- | --- | --- |
| Rich | 2/5 | 355–554 | 16–17 | Business has a crawlable website |
| Thin | 3/5 | 126–174 | 0 | No website on the listing (2), or JS-only (1) |

**A business with no website is BusinessForge's ideal customer, and it is the
case the platform serves worst.** Two listings carried no website at all; one
resolved to a JS-rendered page yielding 62 characters.

That is backlog **PRD-007**, priority P0. Nothing else moves the business as
much. Two of the three directions worth trying invent nothing:

1. **Render JS sites properly** — the collector already drives Playwright.
   Waiting for hydration would have rescued Salon DnA outright.
2. **Use the Maps listing as a content source** — rating, reviews, category,
   and the owner-uploaded photography the pipeline never touches. That alone
   would give the hotel and the law firm images.

## Then

- **PRD-008** — render the Maps star rating as a trust signal. Trust scored
  3–6 on all five, the weakest category, and the rating is already in every
  profile.
- **PRD-002** — Places API. All five sites show one opening day of seven.

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

## Two traps that will cost you an hour each

**Screenshots lie about lazy images.** Playwright's `fullPage` capture resizes
the viewport, which re-runs lazy-loading heuristics — a gallery captures as an
empty white band and looks exactly like broken CSS. Measured in the DOM it was a
correct 4×12 grid. Both harnesses now strip `loading="lazy"` and await
`img.decode()`. **Measure the DOM before believing a screenshot.**

**The two stylesheets override each other silently.** `variants.ts` is emitted
after the base sheet, and re-declaring a selector there wins at equal
specificity with no warning. This has now happened twice — the colour tokens in
the twenty-site review, and `.section--hero h1` in this batch. Tracked as
INF-007.

## Also true

- 248 tests pass; `npm run typecheck && npm test`.
- Provider calls now retry retryable failures (429/5xx/transport) with
  exponential backoff and full jitter. Two of five generations died on a
  transient 503 before this existed.
- Models: `gemini-3.6-flash` for both stages. The entire Gemini 2.5 family is
  404 for accounts created after mid-2026 — the model catalogue still lists it,
  so only a real generation call reveals the truth.
- Stage 6 deploy is still a stub. When it lands, target **Cloudflare Pages**,
  not Vercel: Vercel's Hobby tier prohibits commercial use, and BusinessForge
  hosts customer sites commercially.
