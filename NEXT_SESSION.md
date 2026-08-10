# Next Session

_Rewritten 2026-08-10, after a read-only audit found the working tree had
already gone further than this file said — the Director was wired into
`main.ts` and a whole second engine (`lib/experience/`) existed — all
uncommitted. That work is now committed (`ebcb49a`, `a1c44af`, `efb84af`,
`239975e`) and this file is corrected to match. See PROJECT_STATUS.md for the
full account; this is the thirty-second version._

> **Canonical documentation is BusinessForge HQ in Notion.**

## Start here (2026-08-10)

**Look at River Park first**, the first real business the Director actually
directed in production, not a harness:

```bash
npm run preview -- 77c15289
```

`artifacts/77c15289/qa/qa.json` is the QA record — 28/28 checks pass. It also
still carries the PUA/tofu glyph defect that `239975e` fixes going forward
(the fix isn't retroactive to this artifact; see PROJECT_STATUS.md).

**Then look at Bakery V2**, now a recorded, reproducible baseline rather than
just "the immersive thing from a few sessions ago":
[docs/canonical-bakery-v2.md](docs/canonical-bakery-v2.md). It has the exact
commands to rebuild it and the specific screenshots proving Blade, Oven
Spring, Whiteout, the photography handoff and the loop-closing ending.

## The next milestone

**Not this session's to implement — this session closed and documented what
already existed.** The real open question, evidenced rather than assumed:

River Park (general pipeline) and Bakery V2 (`lib/experience/`) are two
disjoint code paths today. Nothing learned building the bakery experience —
scroll-as-time scenes, signature moments, a scene-level ink system — is
reachable by any other business. **The next milestone is deciding how to
generalize experiential capability into the pipeline without forcing every
generated site into a cinematic mode it doesn't earn.** That is a design
decision first, and should be made with evidence from more than one
business's Director output — not from Bakery V2 alone, which is a capability
ceiling, not a template.

Not yet independently re-verified this session, carried over from before:
whether resuming a completed pipeline run genuinely skips a second Director
call (ADR 0002's property, proven for the smoke-test harness; the general
pipeline's `step()`/`ARTIFACT_DEFAULTS` machinery looks built for the same
thing but wasn't exercised by re-running a completed job this session).

Then, and only with evidence from more than one business: consider opening
`heroIntent.preference` as the Director's second control surface (ADR 0004).
Not before — nine of eleven directive fields are still advisory, and widening
on symmetry rather than on observed defects is how a closed contract stops
being one.

## Known reds — none currently open

Both prior reds are resolved and verified this session (524/524,
`npm run typecheck` clean):

- `compose.test.ts`'s ground-separation assertion — fixed by the visual-worlds
  work (`efb84af`).
- Services cards / menu band contrast (~1.13–1.23:1) — same commit; every
  ground now carries its own full ink family via `lib/render/variants.ts`'s
  `ground()` helper.

`shoot-handoff.mjs` hardcodes port 4321 rather than taking one as an argument
— found while producing the Bakery V2 record, not fixed (see
docs/canonical-bakery-v2.md). Small, not urgent.

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
