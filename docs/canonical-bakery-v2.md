# CANONICAL_BAKERY_V2

_Recorded 2026-08-10, after `lib/experience/` was committed and verified locally with no AI/API call._

This is the capability benchmark referenced elsewhere as "Bakery V2" or "the
immersive experience". It proves what the engine *can* build for a business
whose story suits it — it is not a template every generated site goes
through. See [design-intelligence-review.md](design-intelligence-review.md)
and `PROJECT_STATUS.md` for how it relates to the general pipeline.

## Source of truth

| | |
|---|---|
| Engine commit | `a1c44af` — "Add the bakery immersive V2 experience engine" |
| Engine source | `lib/experience/{types,compose,emit,runtime,shader,styles}.ts` |
| Entry point | `npx tsx scripts/build-experience.ts 25e648c7` |
| Fixture | `output/25e648c7/3-profile.json` + `output/25e648c7/assets/` — Tartine Bakery, San Francisco, collected in an earlier session. No model call in this path: `compose()` derives the scene script purely from the verified profile. |
| Built output | `output/25e648c7/experience/` (not committed — gitignored `output/*`, same policy as every other run) |

## Reproduction

```bash
npx tsx scripts/build-experience.ts 25e648c7
node scripts/serve-experience.mjs 25e648c7 4322
node scripts/shoot-moments.mjs 4322 canonical-v2
node scripts/shoot-experience.mjs 4322 canonical-v2
node scripts/verify-experience.mjs 4322
```

`shoot-handoff.mjs` hardcodes port `4321` rather than taking one as an
argument — a real gap found while producing this record, not fixed here
per this session's scope (see Known limitations). Run the server on
`4321` for that one script, or point an equivalent script at whatever port
is free.

**Port note from this run**: `4321` was occupied by a stray leftover
process serving unrelated content (the River Park pipeline site) when this
baseline was produced. The capture scripts correctly reported every scene
as missing rather than silently photographing the wrong page — that
failure mode is what this note exists to make legible for the next
session, not a defect in the experience engine.

## Evidence produced (this session, zero AI/API cost)

All under `output/review/` (gitignored, reproducible from the commands
above — not committed as binaries):

- `canonical-v2/01…11-*.png` — the 11 named moments, sampled at the exact
  scroll fraction each event occupies, not scene midpoints.
- `canonical-v2/desktop-*.png`, `mobile-*.png` — one shot per scene, both
  viewports (1440×900 and 390×844).
- `handoff/handoff-{06,14,22,34}.png` — the 3D loaf dissolving into real
  bread photography.
- `degraded/reduced-motion.png`, `degraded/no-webgl.png` — the two
  fallback paths, visually inspected.

Three frames were opened and read, not just captured, before this record
was written: `08-dawn-peak.png`, `04-blade-open.png`, `11-coda.png`,
`handoff-34.png`, `mobile-blade.png`, `degraded/no-webgl.png`.

## The signatures, with evidence

**Blade.** `04-blade-open.png`: a real WebGL-rendered loaf with a visible
scored incision, clock `04:20`, copy "One cut, and it knows where to
open." `shoot-moments.mjs` samples three fractions through the `blade`
scene (0.30 / 0.52 / 0.72) specifically because the cut is a travelling
event, not a static composition.

**Oven spring.** `05-oven-spring.png` / `06-oven.png`, clock `04:30` —
sampled at the volume-jump fraction of the `oven` scene.

**Whiteout / daybreak.** `08-dawn-peak.png`: veil opacity measured at
`0.97` by the capture script itself (not eyeballed), page visually reads
as a near-total wash to cream/white with only the wordmark and clock
surviving at low opacity. The turn happens across the `rack` → `doors`
scene boundary.

**3D → photography handoff.** `handoff-34.png`: the composited loaf is
gone: the frame is a real photograph of loaves in a bakery crate, clock
`05:10`, copy "Listen — it crackles." over the `cooling` scene.

**Loop-closing ending.** `10-nightfall` and `11-coda` both land at clock
`22:00` (`11-coda.png` confirms this visually — "And tonight, again... A
little is kept back, and fed"), with the veil relaxing from `0.94` back to
`0` — the page returns to the night state it opened in rather than ending
on the daylight arc.

**Mobile.** `mobile-blade.png`: same scene, correctly reflowed at 390px —
copy stacks above the loaf instead of beside it, blade and score visible
at the narrower frame.

**Reduced motion.** `verify-experience.mjs`, `reduced-motion` mode: no
page errors; `bodyClass` includes `no-gl` (WebGL is not merely paused but
not engaged at all under `prefers-reduced-motion`); the display line's
`lineTransform` is `none` and `stageOpacity` is `1` — meaning type is
already in its resting position rather than mid-animation-that-never-plays.

**No WebGL.** `verify-experience.mjs`, `no-webgl` mode: no page errors;
fallback element shown (`display: block`), canvas hidden, loading curtain
removed. `degraded/no-webgl.png` shows a static radial-gradient ground
with the same copy — a legible page, not a broken one.

**Accessibility.** `verify-experience.mjs`, `contrast-while-scrolling`
(both `no-preference` and `reduce`): **0 failures** across every
ground/scene combination sampled during a scroll; worst measured pair
6.27:1, above the 4.5:1 AA body target. `keyboard` mode: 8 focusable stops
(skip link, phone, email, directions, hours, two socials, official site),
every one with a visible `solid 2px` focus outline. This is also asserted
continuously, not just this one run, by `test/experience.contrast.test.ts`
(part of the 524 passing tests on every `npm test`).

**Performance.** `shoot-experience.mjs`: desktop load `1531ms`, `61fps`,
WebGL context live, 0 console errors; mobile load `2008ms`, `60fps`, WebGL
live, 0 console errors. Page height desktop `24390px` / mobile `19696px`
— the full ten-scene sequence actually rendered, not truncated.

## Known limitations

- **`shoot-handoff.mjs` hardcodes port 4321.** Every other capture script
  takes the port as `argv[2]`; this one doesn't. Left as-is per this
  session's scope (documentation and verification, not new
  implementation) — worth a one-line fix next time someone is in this file.
- **Not generalized.** `lib/experience/` is Tartine-shaped: dough, a
  levain, an oven. It is reached only via `scripts/build-experience.ts`
  and is not part of `main.ts`'s pipeline or reachable from any other
  business's data. See PROJECT_STATUS.md's architectural-gap note.
- **First 10 seconds are quiet** and loaf contact-shadow/grounding is
  still soft — both noted previously in NEXT_SESSION.md and unchanged by
  this session, which verified the existing build rather than revising it.
- **Determinism across machines is not separately verified.** `compose()`
  is pure (same profile → same scene script), but the emitted image bytes
  go through a Chromium re-encode (`build-experience.ts`'s `optimise()`)
  whose exact output was not diffed byte-for-byte against a second machine.
