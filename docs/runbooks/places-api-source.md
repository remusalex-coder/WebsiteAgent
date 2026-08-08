# Runbook — turning on the Places API source

**Use when:** a run should carry customer reviews, a review count, or the full
week's opening hours. That is every run intended for a paying customer.

**Why it exists:** signed-out Google Maps serves a reduced pane with no Reviews
tab and no photo grid — verified against two browser fingerprints, including a
realistic user agent with `navigator.webdriver` deleted. It is a wall, not a
selector problem. The Places API is how the platform gets those facts, and it
is the only way the renderer's `testimonials` layouts are ever reached.

## What it changes

| | Without a key | With one |
| --- | --- | --- |
| Customer quotations | none, ever | up to 3 on the page, verbatim and attributed |
| Trust bar rating line | `4.9 on Google` | `4.9 on Google from 812 reviews` |
| `aggregateRating` JSON-LD | omitted — schema.org requires the count | emitted |
| Opening hours | roughly one day, from the pane | the full week |
| Accessibility attributes | inferred from label text | stated as booleans, absences included |

## Steps

1. **Enable the API.** In the Google Cloud project the key belongs to, enable
   **Places API (New)** — not the legacy Places API. Billing must be on; there
   is no free tier for the review fields.

2. **Set the key.** In `.env`:

   ```bash
   PLACES_API_KEY=your-key-here
   ```

   That is the whole switch. There is no feature flag: a key present means the
   source runs, absent means it is skipped.

3. **Run a collection.** The source runs inside stage 2, so it needs a run that
   reaches the collector:

   ```bash
   node --import tsx --env-file=.env main.ts --from=collect <runId>
   ```

4. **Confirm it answered.** The collector logs one line per source:

   ```
   places api harvested  reviews=5 photos=10 hoursDays=7 rating=4.7 reviewCount=812
   ```

   `reviews=0` with a healthy `rating` means the business genuinely has no
   review text, which is normal for a new listing.

5. **Look at the page.** Follow
   [visual-review](visual-review.md). The testimonials section should carry
   attributed quotations and the bylines should sit on one baseline.

## Reading a failure

Every failure degrades to an empty harvest and a warning; a run never fails
because of this source. The warning names the cause.

| Log line | Cause | Fix |
| --- | --- | --- |
| `places api source skipped … no PLACES_API_KEY` | key not set | step 2 |
| `401 … API keys are not supported by this API` | the key's project has not enabled Places API (New) | step 1 |
| `places api text search matched nothing` | the ftid could not be exchanged (see below) | check the listing's name and address on the profile |
| `403 … PERMISSION_DENIED` | key restrictions exclude this API or this server's IP | loosen the key restriction in Cloud Console |
| `429` | quota | wait, or raise the quota |

## Two things that will surprise you

**Discovery does not capture a place id.** Google publishes two identifiers for
the same place and they are not interchangeable. A Maps URL carries an **ftid**
(`0x8085808f5038d91f:0x38aa369224229222`); the Places API is keyed by a
**place id** (`ChIJ…`). Every run in the repository holds the hex form, so the
source exchanges it through Text Search on name and address before asking for
details. That is one extra billed request per business, and without it the
source would have returned `404` on every business the platform has ever
collected — while looking exactly like a business with no reviews.

**Photo URLs cost an extra request each, on purpose.** The media endpoint takes
the API key as a *query parameter*, so using that URL directly would write a
live credential into `2-raw.json`, into the image provenance, and into any page
that referenced it before download. The source asks the endpoint for the
resolved `photoUri` instead (`skipHttpRedirect=true`), which is an ordinary
`googleusercontent` URL. A test asserts the key never reaches a harvest.

## Cost

Roughly a cent per business: one Text Search (cheapest tier, field-masked to
`places.id`), one Place Details in the Enterprise + Atmosphere tier because
`reviews` and `rating` live there, and one media resolution per photograph up to
ten. The field mask deliberately omits identity fields — name, location, phone,
website — because stage 1 already established those and paying twice for a fact
the pipeline holds is waste.
