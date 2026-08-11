# Next Session

_Rewritten 2026-08-11, after the content system shipped — BusinessForge now
derives `Evidence → Character → Intent → Narrative → Content → Composition`, and
the words on the page are as business-specific as its order. See
[docs/content-system.md](docs/content-system.md); this is the thirty-second
version._

> **Canonical documentation is BusinessForge HQ in Notion.**

## Start here (2026-08-11, content system)

**Look at two pages, in this order.** Both are real businesses through the real
pipeline, no manual edits:

```bash
npx tsx main.ts --compose riverpark && npx tsx scripts/shoot.ts riverpark riverpark
```

```bash
npx tsx main.ts --compose 25e648c7 && npx tsx scripts/shoot.ts 25e648c7 tartine
```

River Park is Romanian and reads Romanian — `Locație de evenimente în Drăgășani ·
Despre River Park Events · Ce oferim · **Sala mare cu candelabru floral și arcade
filigranate** · Program · Contact · Rezervă la River Park Events`, every button
"Rezervă", `<html lang="ro">`, `EventVenue` structured data. The bold line is the
signature beat: its heading is the caption on its own strongest photograph, set
at display scale (114 → **95** → 62 → 10px down the page), over a full-bleed 2×2
gallery. Before this session every one of those strings was an English template
label and the signature heading was hidden by a stylesheet rule.

Tartine is the control: English, thinner evidence, honestly plainer copy. Its
`specificity` score is lower than River Park's and that is the right answer.

**What changed, in one line each:** `lib/content/` is new (language, evidence
index, director, gate); `lib/design/plan.ts` derives the narrative once so the
copy can never feed back in as evidence; `NarrativeRole` reaches the stylesheet as
`data-role`. [ADR 0007](docs/decisions/0007-content-is-directed-by-narrative-role-and-written-in-the-evidence-language.md)
is the decision record.

**The next bottleneck is `classifyIndustry`.** There is no `venue` category, so an
event venue lands on `general` (`imageReliance: supporting`) and cannot reach the
narrative mode. River Park only reaches it because one of its six services is
literally "Cazare — River Park Hotel". That accident is load-bearing for the best
page the platform has produced, which is not a state to leave it in. After that:
imagery strategy is still advisory, and image alt text — now the director's
strongest content source — is only as good as research made it.

## Previous start (2026-08-11, experience system)

**The experience system is the current state.** Distinctiveness is now a function
of business *character*, not industry: `character.ts → experience.ts → assets.ts →
conversion.ts → interaction.ts → script.ts`, all deterministic and €0, all
observable on `WebsiteDesign`, with the AI Director as an optional validated
improver. The page **order is a narrative** (`script.ts` — `NarrativeRole` per
section along a story spine), not an industry sort.

Look first at the benchmark — six businesses, materially different experiences,
including two same-industry hotels that diverge:

```bash
node --import tsx --test test/design/benchmark.test.ts
```

Then River Park through the actual autonomous pipeline (no manual edits):

```bash
npx tsx main.ts --compose riverpark && npm run preview -- riverpark
```

Its script is `emotion → reveal → signature → breadth → context → conversion`,
rendered `hero → about → gallery(full-bleed, moment) → services → hours → contact
→ cta`, score 99/100.

**The next bottleneck is copy, not structure.** The order is business-specific;
the section *prose* is still `composeBaseline`'s generic labels ("What we offer",
"Photographs"). A character-aware writer — deterministic templates keyed to
narrative role + evidence, with the AI writer as an optional validated improver —
is the last thing between "this looks bespoke" and "this reads bespoke." Also
open: `pacing`/`imageryStrategy` are validated-but-advisory; the scroll-as-time
runtime is audited (`docs/experience-system.md`) but unbuilt.

`docs/decisions/0006-*` records the architecture decision. 580/580 tests pass.

## Start here (2026-08-10, previous)

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

## Experience Intent V1 — done

`DesignDirective.experienceIntent` (`mode` / `moment` / `momentIntent` /
`transitionAtMoment`) is built, tested (565/565), and proven with one real
Director call — see PROJECT_STATUS.md for the full account, including the
one real defect the live call found (Gemini rejects a nullable-union JSON
Schema type) and how it was fixed. `npm run experience-intent` reproduces
the whole thing; `-- --deterministic-only` reproduces the zero-AI half.

**It reaches production automatically.** The new logic lives inside
`applyDirective` itself (`lib/design/directive.ts`), which `agents/designAgent.ts`
already calls on every pipeline run — no `main.ts` wiring was needed. The
next time `DIRECTOR_ENABLED=true` and the model returns an
`experienceIntent`, it will affect the generated page. It has not yet been
observed doing so on a real, non-fixture business — River Park predates it.

## The next milestone

**Not decided here, deliberately** — this session's scope was Experience
Intent V1 alone. The honest options once someone is ready to spend another
AI call:

1. Run the real pipeline (`DIRECTOR_ENABLED=true`) against one or two more
   real, diverse businesses and observe `experienceIntent` in practice —
   evidence before any further widening, the same discipline ADR 0004
   already established for `heroIntent.preference`.
2. Only with evidence from more than one business: consider whether
   `heroIntent.preference` (still advisory, ADR 0004) or a second
   `experienceIntent` field is warranted. Not before.

Not yet independently re-verified, carried over from before: whether
resuming a completed pipeline run genuinely skips a second Director call
(ADR 0002's property, proven for the smoke-test harness; the general
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
