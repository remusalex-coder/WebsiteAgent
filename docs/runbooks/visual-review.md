# Runbook — visual review of a generated site

**Use when:** any change that can reach the page. Every session must end having
looked at a rendered site, because measurements do not catch what a defect
*looks* like.

**Why it exists:** the two worst defects found so far were both invisible to the
test suite and to the numbers. A hotel's category was the Maps button "Add
website" for three runs; a hotel's gallery contained four named competitors
while the metric read a healthy "11 images". Both were obvious within seconds of
looking.

## Steps

1. **Produce a site.** With a provider:

   ```bash
   node --import tsx --env-file=.env main.ts --from=analyze <runId>
   ```

   Without one — composed from verified data, no model:

   ```bash
   npx tsx main.ts --compose <runId>
   ```

2. **Shoot and measure it**, desktop and mobile in one pass:

   ```bash
   npx tsx scripts/shoot.ts <runId> <label>
   ```

   Writes `output/shots/<label>-desktop.png` and `-mobile.png`, and prints
   words, images, sections, trust items, CTAs, height and overflow.

3. **Run the creative review.** It measures the structural signatures of
   generated-looking work — timid imagery, flat type hierarchy, uniform rhythm,
   buried calls to action — in a real browser:

   ```bash
   npx tsx scripts/creative-review.ts <runId>
   ```

   Read it as a floor, not a verdict. It does not score taste, and a page can
   pass every check and still be one nobody would be proud to send a client.
   Calibrated against the pre-art-direction hotel, which it correctly marked
   weak on opening image and hero presence while passing its rhythm and CTA
   structure — because those genuinely were fine. Its problem was emptiness.

4. **Shoot the previous version under a different label** and compare the two
   images side by side. A number moving is not evidence that a page improved.

5. **Look for these five, in this order.** They are the ones that have actually
   occurred:
   - **Is anything on the page not this business?** Photographs of neighbours,
     a competitor's name, a category that is really a UI control.
   - **Is anything said more than once?** The category has appeared in the
     eyebrow, the headline, the trust bar, an amenity card and the footer at the
     same time.
   - **Does every section have something in it?** An empty column reads as
     broken CSS, not as restraint.
   - **Does the mobile capture overflow?** The printed `overflow` must be `0`.
   - **Would an owner publish this?** Write down why not. Every recurring answer
     is a platform change.

## The trap

**Screenshots lie about lazy images.** `fullPage` capture resizes the viewport,
which re-runs lazy-loading heuristics, and a gallery captures as an empty white
band that looks exactly like broken CSS. `scripts/shoot.ts` strips
`loading="lazy"` and awaits `img.decode()` before the shutter — do not screenshot
with a raw Playwright call instead. This has cost an hour twice.
