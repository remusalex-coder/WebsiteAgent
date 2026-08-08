# Next Session

_Written 2026-08-08, after the composed page learned to speak._

> **Canonical documentation is BusinessForge HQ in Notion.** This file is the
> thirty-second version for whoever opens the repo first.

## Start here

**Look at a page before reading anything else.**

```bash
npx tsx main.ts --compose 9d55de50 && npx tsx scripts/shoot.ts 9d55de50 zuni
```

Then open `output/shots/zuni-desktop.png`. That is Zuni Café, composed with no
model and no paid API. At the start of this session the same command produced
**47 words on a 4,937px page** whose gallery led with a domestic-violence
crisis-hotline poster.

## The state of the product, honestly

| | Session start | Now |
| --- | --- | --- |
| Zuni Café | 47 words, 3 sections | 539 words, 5 sections |
| Tartine | 4 sections | 6 sections |
| Paradise Dental | 4 sections, gallery after contact | 6 sections, correct order |
| Hero headline | "Californi / an / restauran / t" | wraps correctly, 5 industries × 2 viewports |
| Page ending | a contact table | a closing invitation |
| Tests | 336 | 354 |

**The deterministic path is the product right now.** There is no working model
provider, so `--compose` is what a customer would actually receive. Judge the
platform by that page, not by the model path nobody can run.

## What is blocked, and on what

Every P0 in the backlog is blocked on money, and none of them is blocked on
engineering:

- **A model provider.** Gemini's free tier is exhausted; the key in `.env` is
  scoped to the Generative Language API only.
- **`PLACES_API_KEY`.** Code is written and tested; see DEC-024 (proposed).
- **Stage 6 deploy.** Target Cloudflare Pages, not Vercel — Hobby prohibits
  commercial use.

**Ollama is installed (0.32.6) and has zero models.** Do not assume it is the
answer: this machine is an i7-1165G7, 4 cores, 16 GB, Intel Iris Xe — **no
discrete GPU**. At CPU-only speeds a 7B model runs roughly 2–4 tokens/second,
and the writer stage is budgeted at 24,000 output tokens. That is over two hours
for one site. Local inference is viable for **short bounded judgements**
(classification, a creative verdict) and not for generation. If you want to test
that thesis:

```bash
ollama pull qwen3:4b
```

## Then, in order

1. **Hero presence (PRD-013).** The creative review scores the dentist 3 weak,
   and two of the three are the hero: it occupies 40% of the fold and its
   photograph covers 13% of it. `imageReliance: 'supporting'` picks a split hero
   that illustrates rather than immerses. This is the largest remaining gap
   between the output and an agency page, and it needs no provider.
2. **Conversion (PRD-010).** Now measurable: "one call to action per 2.1 screens
   of scroll". The closing moment added one CTA; the middle of a 5,800px page
   still has none.
3. **Gallery art direction.** Eleven honest photographs in a masonry is a
   scrapbook, not a portfolio. Aspect-ratio grouping and a hero image choice
   would do more for perceived quality than anything else in the renderer.

## Traps that will cost you an hour each

**Screenshots lie, and `fullPage` is why.** It resizes the viewport *after*
images decode, re-running lazy heuristics, so the top of a long page paints
white. Zuni's gallery captured as a 2,900px blank band while the DOM held eleven
images at `complete: true`. `scripts/shoot.ts` now grows the viewport to the
document height instead — but **any new capture harness must do the same**, and
the rule stands: measure the DOM before believing a screenshot.

**A backtick in a CSS comment breaks the build silently.** `lib/render/css.ts`
and `variants.ts` are TypeScript template literals. It cost time three times
this session, and the third time the error was hidden because the regeneration
command redirected stderr to `/dev/null`. Never silence a build you are about to
screenshot.

**The two stylesheets override each other (INF-007).** Third occurrence, now
guarded: `test/render/sheet-conflicts.test.ts` fails when the variants sheet
restates a property and drops a bound the base sheet set. It is deliberately
narrow — it ignores the design layer replacing a fallback with a token, which is
that layer's job — because the first draft flagged twenty-one things and twenty
were correct.

**Adding a field to a contract breaks every saved run.** Add an entry to
`ARTIFACT_DEFAULTS` in `main.ts` in the same commit.

**A `.ts` probe script outside the repo will not run.** Put throwaway scripts in
`output/` — gitignored, and inside the package.

## Also true

- 354 tests pass; `npm run typecheck && npm test`.
- Testimonials are code-built and the model may never write one (DEC-022).
- A rating below 4.0 is not promoted to the trust bar (DEC-023). It still
  reaches the JSON-LD and the contact block; only the lead changes.
- A photo URL must never carry a credential — the Places source resolves each
  photograph to a plain `googleusercontent` URL first, and a test asserts it.
- **WVBR LLP remains unservable from public data.** Composed, it is three
  sections and no photographs. That is a product answer (owner intake, PRD-011),
  not an engineering one.
