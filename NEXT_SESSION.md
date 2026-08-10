# Next Session

_Written 2026-08-10, after the Design Director ran live for the first time._

> **Canonical documentation is BusinessForge HQ in Notion.** This file is the
> thirty-second version for whoever opens the repo first.

## Start here (2026-08-10)

**Look at the two pages side by side.**

```bash
start smoke-test/control/screenshots/desktop.png
```

Then `smoke-test/director/screenshots/desktop.png`. Same business, same words,
same fixture. The left one is what the deterministic system chose on its own;
the right one is what it built after a real model call said `editorial`.

Re-running `npm run design-director` is **free** — the directive is on disk and
the run resumes from it. It costs a call only if you delete
`smoke-test/director/directive.json`.

## The next milestone

**Wire the Director into `main.ts`, behind `DIRECTOR_ENABLED`.** It is ported,
tested and proven in a harness, and the pipeline still does not call it. That is
the one thing standing between "we proved it works" and "it works".

It is deliberately not done here: the smoke test was the deliverable, and
untested code on the pipeline's critical path would have been the wrong way to
end a milestone whose whole point was proving something honestly.

Two things to settle while doing it:

1. **Where the directive artifact lives in a real run.** `output/<runId>/` is
   gitignored, which is right for a run and wrong for evidence. The smoke test
   sidesteps it with `smoke-test/`; the pipeline needs an answer.
2. **Whether stages become resumable jobs.** The harness already works this way
   (ADR 0002) and it is what makes a second model call impossible after a
   downstream crash. The pipeline does not, and that is the gap between this
   harness and an orchestrator.

Then, and only with evidence: consider opening `heroIntent.preference` as the
Director's second control surface (ADR 0004). Not before — nine of eleven
directive fields are advisory today, and widening on symmetry rather than on
observed defects is how a closed contract stops being one.

## Two known reds, neither from the Director

- `test/design/compose.test.ts` "separates adjacent sections by ground" fails
  against the uncommitted design work. Passes at `0223a41`.
- Services cards and the menu band render at ~1.13–1.23:1 contrast, identically
  in both variants.

## Previous session

**Look at a page before reading anything else.**

```bash
npx tsx main.ts --compose 25e648c7 && npx tsx scripts/shoot.ts 25e648c7 tartine
```

Then open `output/shots/tartine-desktop.png`. That is Tartine Bakery, composed
with no model and no paid API.

## What happened this session

Three things, in order.

**The art direction layer** (`lib/art/`). Tartine's gallery used to open on a
cookbook — six Amazon packshots outranked forty-three photographs of bread. The
rule that catches them is relative rather than a word list: a site serves its
photography larger than its furniture, so the threshold is the set's own median.
Colour is now read off the business's own logo, or its photographs where there
is no logo, using the Chromium that Playwright already installs.

**An external benchmark.** Tartine scored **72/150** against a premium
human-designed Framer reference at **127/150**. Framer AI and Lovable could not
be run directly — both require an account, and Lovable sits behind a bot
challenge — so the comparison was against Framer's *marketplace templates*,
which is a harder bar than its AI. Read that number as a ceiling comparison, not
a like-for-like loss.

**The design vocabulary engine** (`lib/design/patterns.ts`). Twenty patterns,
thirteen of them executable, each with a `requires` gate that decides whether the
page can fill it honestly. Tartine re-scored **101/150**.

## The one idea worth keeping

**A pattern may compose facts. It may never supply them.**

The marquee needs three verified facts before it renders. The statement band
needs prose to quote and a page long enough to interrupt. A thin business gets a
plainer page, never a richer-looking one with invented copy in it. That gate is
what makes a pattern library safe to grow — see `test/design/patterns.test.ts`,
which tests the gates and not the row count.

## Then, in order

1. **Gallery art direction is the biggest remaining visual gap.** Tartine's grid
   still carries a beach photograph and a wheat-texture macro, because ranking is
   by served width and width is not a subject. Aspect grouping and one
   hero-sized cell would do more than any other renderer change.
2. **`gallery-immersive-band` and `editorial-alternating-story` are `declared`,
   not built.** Both are the storytelling patterns; both need a renderer
   component. That is the shortest path from 101 to the mid-110s.
3. **Content is the ceiling, not design.** The Framer reference wins on menu
   prices, testimonials, multiple locations and a news grid — none of which
   BusinessForge may invent. The Places API (DEC-024, proposed) is the unlock,
   and it is a money decision rather than an engineering one.

## Traps that will cost you an hour each

**A backtick in a CSS comment breaks the build silently.** `lib/render/css.ts`
and `variants.ts` are TypeScript template literals. Cost time again this session
inside the new hero comment. Never silence a build you are about to screenshot.

**Screenshots lie, and `fullPage` is why.** `scripts/shoot.ts` grows the viewport
instead. Any new capture harness must do the same. **Also: a downscaled
screenshot lies about contrast** — the CTA button looked washed out and measured
4.97:1. Measure the DOM before believing your eyes in either direction.

**The two stylesheets override each other (INF-007).** Fourth occurrence
avoided this session by carrying all four caps into `.hero--full-bleed h1`.
`test/render/sheet-conflicts.test.ts` guards it.

**Adding a field to a contract breaks every saved run.** `WebsiteContent.facts`
and `SectionKind: 'statement'` both landed this session; `ARTIFACT_DEFAULTS` in
`main.ts` was updated in the same commit. Do the same next time.

**A `declared` pattern must never be selectable.** `selectPatterns` filters on
status first. If you build a component, flip the status in the same commit.

## Also true

- 414 tests pass; `npm run typecheck && npm test`.
- **Ollama is installed with `gemma4:26b`, and it is unusable for generation** —
  measured at **1.6 tokens/second** with a 67-second load on this machine. It is
  a 17 GB model on 16 GB of RAM with no discrete GPU. Viable only for very short
  bounded judgements, and not for the writer.
- There is still no working model provider. `--compose` is what a customer would
  receive, so judge the platform by that page.
- Testimonials are code-built (DEC-022); a rating below 4.0 is not promoted
  (DEC-023); the facts marquee is code-built for the same reason.
- The marquee is `aria-hidden` by design, because every fact in it is stated
  somewhere else on the page. **Nothing may ever appear only in the marquee.**
