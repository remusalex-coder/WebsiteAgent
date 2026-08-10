/**
 * The art direction, as a stylesheet.
 *
 * Three typefaces, each doing one job and never the others:
 *
 *   Cormorant Garamond 300  — the voice. High contrast, set enormous, tight
 *                             leading. It carries the pastry side of the craft.
 *   Archivo 900             — the impact. Uppercase, negative tracking, used
 *                             at exactly two moments so both land.
 *   IBM Plex Mono 400       — the baker's log. Timestamps, temperatures,
 *                             mill names. It is the evidence layer.
 *
 * The grounds are not set here; the runtime writes `--ground`/`--ink` every
 * frame and everything below inherits from those four variables. That is what
 * lets the page change colour continuously without a single duplicated rule.
 *
 * Composition is per scene *kind*, not per scene. Eight kinds, eight genuinely
 * different placements — the visitor should not be able to predict where the
 * next line of type will sit.
 */

export const STYLES = /* css */ `
:root {
  --ground: #080A10;
  --ink: #EFE6D8;
  --ink-dim: #9BA0AE;
  --ember: #D98634;
  --night: 0;

  --gutter: clamp(1.25rem, 4.2vw, 5.5rem);
  --measure: 34ch;

  --display: 'Cormorant Garamond', 'Times New Roman', serif;
  --impact: 'Archivo', 'Helvetica Neue', Arial, sans-serif;
  --mono: 'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace;
  --body: 'Archivo', 'Helvetica Neue', Arial, sans-serif;

  --ease: cubic-bezier(0.22, 1, 0.36, 1);
}

* { box-sizing: border-box; }

html { scroll-behavior: auto; -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: var(--body);
  font-size: clamp(0.95rem, 0.9rem + 0.25vw, 1.075rem);
  line-height: 1.62;
  overflow-x: hidden;
  transition: background-color 90ms linear;
}

::selection { background: var(--ember); color: #100A05; }

a { color: inherit; }

/* ------------------------------- curtain ------------------------------- */

#curtain {
  position: fixed; inset: 0; z-index: 90;
  background: #080A10;
  display: grid; place-items: center;
  transition: opacity 1s var(--ease), visibility 1s;
}
body.is-ready #curtain { opacity: 0; visibility: hidden; }

.curtain-mark {
  font-family: var(--display);
  font-weight: 300;
  font-size: clamp(3.5rem, 11vw, 9rem);
  line-height: 1; letter-spacing: -0.02em;
  color: #EFE6D8;
  text-align: center;
}
.curtain-sub {
  margin-top: 1.6rem;
  font-family: var(--mono);
  font-size: 0.66rem; letter-spacing: 0.34em; text-transform: uppercase;
  color: #6E7686; text-align: center;
}
.curtain-bar {
  margin: 2.2rem auto 0; width: min(240px, 42vw); height: 1px;
  background: rgba(239,230,216,0.16); overflow: hidden;
}
.curtain-bar i {
  display: block; height: 100%; width: 100%;
  background: #D98634; transform-origin: left;
  animation: fill 2.2s var(--ease) forwards;
}
@keyframes fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }

/* ------------------------------- canvas ------------------------------- */

/* The scene renders below native resolution, so the raymarched silhouette
   arrives with visible stair-stepping. A sub-pixel blur removes it for far less
   than supersampling would cost — and on a warm, shallow-focus object it reads
   as depth of field rather than as a softened edge. */
#proof-gl {
  position: fixed; inset: 0; width: 100%; height: 100%;
  z-index: 0; display: block;
  filter: blur(0.6px);
  transition: opacity 320ms linear;
}
body.no-gl #proof-gl { display: none; }

/* The page without WebGL is not a broken page — it is a quieter one. */
.gl-fallback {
  position: fixed; inset: 0; z-index: 0; display: none;
  background:
    radial-gradient(58% 46% at 50% 46%,
      color-mix(in srgb, var(--ember) 38%, transparent), transparent 72%),
    var(--ground);
}
body.no-gl .gl-fallback { display: block; }

/* --------------------------------- veil --------------------------------- */

/* Sits above the scenes and below the HUD. Opacity is written every frame by
   the runtime and is zero for all but two boundaries on the page. */
/* Above the HUD as well as the scenes: at the peak of a whiteout the clock and
   the brand mark have to go too, or the moment reads as the content vanishing
   rather than as the light overwhelming everything. */
#veil {
  position: fixed; inset: 0; z-index: 45;
  pointer-events: none; opacity: 0;
  background: #FFF6E4;
  will-change: opacity;
}

/* --------------------------------- HUD --------------------------------- */

.hud {
  position: fixed; z-index: 40; pointer-events: none;
  font-family: var(--mono); font-size: 0.62rem;
  letter-spacing: 0.26em; text-transform: uppercase;
  color: var(--ink-dim);
  transition: color 120ms linear, opacity 420ms var(--ease);
}
.hud-brand { top: var(--gutter); left: var(--gutter); pointer-events: auto; }
.hud-brand img { display: block; height: 15px; width: auto; }
/* The mark is a black SVG; on the six dark scenes it has to flip. The class is
   set from the ground's measured luminance, not from the scene index. */
body.dark-ground .hud-brand img {
  filter: invert(1) brightness(1.6) drop-shadow(0 1px 6px rgba(0,0,0,0.55));
}
/* Two scenes run a photograph to all four edges and the HUD crosses it. */
.k-plate ~ * .hud, .hud-clock, .hud-scroll { text-shadow: 0 1px 8px rgba(0,0,0,0.45); }
body:not(.dark-ground) .hud-clock,
body:not(.dark-ground) .hud-scroll { text-shadow: none; }

.hud-clock {
  bottom: var(--gutter); left: var(--gutter);
  display: flex; align-items: baseline; gap: 0.85rem;
}
.hud-clock b {
  font-weight: 400; font-size: 0.86rem; letter-spacing: 0.12em;
  color: var(--ink); font-variant-numeric: tabular-nums;
}
.hud-clock b.tick { animation: tick 520ms var(--ease); }
@keyframes tick {
  0% { opacity: 0; transform: translateY(0.42em); }
  100% { opacity: 1; transform: none; }
}

.hud-rail {
  right: var(--gutter); top: 50%; transform: translateY(-50%);
  width: 1px; height: min(38vh, 300px);
  background: color-mix(in srgb, var(--ink) 16%, transparent);
}
.hud-rail i {
  position: absolute; inset: 0 auto auto 0; width: 100%;
  height: calc(var(--night) * 100%);
  background: var(--ember);
}
.hud-scroll {
  bottom: var(--gutter); right: var(--gutter);
  opacity: calc(1 - var(--night) * 7);
}

@media (max-width: 860px) {
  .hud-rail { display: none; }
  .hud-clock { gap: 0.6rem; }
  .hud { font-size: 0.55rem; letter-spacing: 0.2em; }
}

/* -------------------------------- scenes -------------------------------- */

main { position: relative; z-index: 10; }

.scene { position: relative; }

.stage {
  position: sticky; top: 0;
  height: 100svh;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  align-content: center;
  gap: 0 clamp(0.75rem, 1.6vw, 1.75rem);
  padding: calc(var(--gutter) * 2.1) var(--gutter);
  opacity: var(--vis, 0);
  transition: opacity 240ms linear;
}

/* Common type atoms ---------------------------------------------------- */

.kicker {
  font-family: var(--mono);
  font-size: 0.63rem; letter-spacing: 0.3em; text-transform: uppercase;
  color: var(--ink-dim);
  margin: 0 0 1.5rem;
  display: flex; align-items: center; gap: 0.9rem;
}
.kicker::before {
  content: ''; width: clamp(18px, 3vw, 46px); height: 1px;
  background: var(--ember); flex: none;
}

.display {
  font-family: var(--display);
  font-weight: 300;
  line-height: 0.88;
  letter-spacing: -0.022em;
  margin: 0;
  color: var(--ink);
  font-size: clamp(3.2rem, 9.4vw, 10.5rem);
}
.display .line { display: block; overflow: hidden; padding-bottom: 0.06em; }
.display .line-in {
  display: block;
  transform: translateY(105%);
  transition: transform 1.15s var(--ease);
}
.is-live .display .line-in { transform: none; }

.body-copy {
  max-width: var(--measure);
  color: var(--ink-dim);
  margin: 1.9rem 0 0;
}
.body-copy p { margin: 0 0 0.95em; }
.body-copy p:last-child { margin-bottom: 0; }

.log { margin: 2.3rem 0 0; padding: 0; list-style: none; }
.log li {
  display: flex; gap: 1.1rem; align-items: baseline;
  font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.06em;
  padding: 0.62rem 0;
  border-top: 1px solid color-mix(in srgb, var(--ink) 13%, transparent);
  color: var(--ink);
}
.log li:last-child { border-bottom: 1px solid color-mix(in srgb, var(--ink) 13%, transparent); }
.log .k {
  color: var(--ember); text-transform: uppercase; letter-spacing: 0.2em;
  flex: 0 0 clamp(4.5rem, 9vw, 7.5rem); font-size: 0.58rem;
}

figure { margin: 0; }
.plate img {
  display: block; width: 100%; height: 100%; object-fit: cover;
}

/* Photographs arrive by uncovering, not by fading. A fade says "a component
   loaded"; a wipe says "this was always here and you have just reached it". */
.plate {
  overflow: hidden;
  clip-path: inset(0 0 100% 0);
  transition: clip-path 1.35s var(--ease);
  will-change: clip-path;
}
.is-live .plate { clip-path: inset(0 0 0 0); }
.plate img {
  transform: scale(1.14);
  transition: transform 1.9s var(--ease);
}
.is-live .plate img { transform: scale(1); }

/* --- kind: immersion --------------------------------------------------- */

.k-immersion .stage { align-content: center; }
.k-immersion .col {
  grid-column: 1 / -1;
  display: flex; flex-direction: column; align-items: center; text-align: center;
}
.k-immersion .display { font-size: clamp(4rem, 15vw, 16rem); }
.k-immersion .kicker { justify-content: center; }
.k-immersion .body-copy { text-align: center; max-width: 40ch; }

/* The oven is the loudest scene on the page, so it is the one place the
   grotesque takes over from the serif. */
#scene-oven .display {
  font-family: var(--impact);
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: -0.045em;
  line-height: 0.84;
  font-size: clamp(2.7rem, 10.2vw, 11rem);
}
#scene-oven .stage { align-content: end; }
#scene-oven .col { align-items: flex-start; text-align: left; }
#scene-oven .kicker { justify-content: flex-start; }
#scene-oven .body-copy { text-align: left; }
#scene-oven .lower {
  display: flex; gap: clamp(1.5rem, 5vw, 6rem); align-items: flex-end;
  flex-wrap: wrap; width: 100%;
}
#scene-oven .lower .body-copy { margin-top: 0; flex: 1 1 22ch; }
#scene-oven .lower .log { flex: 0 1 26rem; margin-top: 0; }

/* --- kind: triptych ---------------------------------------------------- */

.k-triptych .col { grid-column: 1 / span 7; }
.k-triptych .display { font-size: clamp(2.8rem, 6.6vw, 6.6rem); }
.k-triptych .aside { grid-column: 9 / span 4; align-self: center; }
.k-triptych .plate { aspect-ratio: 3 / 4; }

/* --- kind: sustain ----------------------------------------------------- */

.k-sustain .col { grid-column: 1 / span 6; }
.k-sustain .aside {
  grid-column: 8 / span 4; align-self: end; padding-bottom: 2vh;
}
.k-sustain .display { font-size: clamp(2.9rem, 7.4vw, 7.6rem); }

/* --- kind: plate ------------------------------------------------------- */

.k-plate .stage { padding: 0; }

/* The handoff.
   For six scenes the loaf has been a rendered object. Here the photograph of
   the real thing opens out of the exact point the rendered one occupied, so
   the shader appears to become the photography rather than being replaced by
   it. Radius is driven by the scene's own scroll progress, so the visitor is
   performing the transition rather than watching it. */
.k-plate .plate {
  grid-column: 1 / -1; grid-row: 1;
  height: 100svh; width: 100%;
  clip-path: circle(calc(max(0, var(--p, 0) * 2.8 - 0.16) * 100%) at 52% 44%);
  transition: none;
}
/* The caption sits over a photograph of bread — mid-brown, high detail, and
   almost exactly the luminance of the dimmed ink. The scrim has to do real
   work here, not just tint the bottom edge. */
.k-plate .plate::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(
    to top,
    color-mix(in srgb, var(--ground) 97%, transparent) 0%,
    color-mix(in srgb, var(--ground) 84%, transparent) 22%,
    color-mix(in srgb, var(--ground) 44%, transparent) 48%,
    color-mix(in srgb, var(--ground) 12%, transparent) 70%,
    transparent 88%);
}
.k-plate .body-copy { color: var(--ink); }
.k-plate .col {
  grid-column: 1 / -1; grid-row: 1; align-self: end; z-index: 2;
  padding: var(--gutter) var(--gutter) calc(var(--gutter) * 2.4);
  max-width: 46rem;
}
.k-plate .display { font-size: clamp(2.6rem, 7vw, 7rem); }

/* --- kind: silence ----------------------------------------------------- */

/* The blade scene. The loaf fills the frame and the type stands aside — one
   small block in a corner, so that the only thing moving is the cut. */
.k-silence .stage { align-content: end; }
.k-silence .col {
  grid-column: 1 / span 4;
  align-self: end;
}
.k-silence .display {
  font-size: clamp(1.5rem, 2.5vw, 2.5rem);
  line-height: 1.12;
  letter-spacing: -0.01em;
}
.k-silence .log { margin-top: 1.5rem; }
.k-silence .kicker { margin-bottom: 1rem; }

/* --- kind: reel -------------------------------------------------------- */

.k-reel .stage { align-content: space-between; padding-inline: 0; }
.k-reel .col { grid-column: 1 / -1; padding-inline: var(--gutter); }
.k-reel .display { font-size: clamp(2.4rem, 5.6vw, 5.4rem); }
.k-reel .reel-wrap {
  grid-column: 1 / -1;
  overflow: hidden;
  perspective: 1500px;
  perspective-origin: 50% 50%;
}
.k-reel .reel {
  display: flex; gap: clamp(1.4rem, 3vw, 3.2rem);
  padding-inline: 32vw;
  will-change: transform;
  transform-style: preserve-3d;
}
.k-reel .reel .plate {
  flex: none; height: min(48vh, 420px);
  transform-origin: 50% 50%;
  backface-visibility: hidden;
}
.k-reel .reel .plate.portrait { width: min(30vh, 260px); }
.k-reel .reel .plate.square { width: min(48vh, 420px); }
.k-reel .reel .plate.landscape { width: min(72vh, 630px); }
.k-reel .reel .plate:nth-child(even) { align-self: flex-end; }
.k-reel .reel .plate:nth-child(3n) { height: min(38vh, 330px); }

/* --- kind: daybreak ---------------------------------------------------- */

.k-daybreak .col { grid-column: 1 / span 6; }
.k-daybreak .display { font-size: clamp(2.7rem, 6.4vw, 6.6rem); }
.k-daybreak .aside {
  grid-column: 8 / span 5; align-self: center;
  display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start;
}
.k-daybreak .aside .plate:first-child { grid-column: 1 / -1; aspect-ratio: 16 / 10; }
.k-daybreak .aside .plate:last-child { grid-column: 1 / span 1; aspect-ratio: 3 / 4; }

/* Everywhere else a photograph uncovers upward. Here it uncovers left to right,
   in the direction the light came from — the room arrives the way the sun
   crosses it, rather than by fading up out of nothing. */
.k-daybreak .plate { clip-path: inset(0 100% 0 0); transition-duration: 1.75s; }
.k-daybreak.is-live .plate { clip-path: inset(0 0 0 0); }
.k-daybreak .aside .plate:last-child { transition-delay: 0.22s; }

/* --- kind: threshold --------------------------------------------------- */

.k-threshold .stage { align-content: center; }
/* The card is tall; without this the heading sticks to the top of the row and
   collides with the fixed brand mark. */
.k-threshold .col { grid-column: 1 / span 5; align-self: center; }
.k-threshold .display { font-size: clamp(2.4rem, 5.4vw, 5.2rem); }
.k-threshold .aside { grid-column: 7 / span 6; align-self: center; }

.card {
  border: 1px solid color-mix(in srgb, var(--ink) 20%, transparent);
  background: color-mix(in srgb, var(--ink) 4%, transparent);
  padding: clamp(1.4rem, 2.6vw, 2.4rem);
}
.card .plate { aspect-ratio: 16 / 9; margin-bottom: 1.6rem; }
.card dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 0.1rem 1.4rem; }
.card dt {
  font-family: var(--mono); font-size: 0.57rem; letter-spacing: 0.22em;
  text-transform: uppercase; color: var(--ember);
  padding: 0.7rem 0 0;
}
.card dd {
  margin: 0; padding: 0.62rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--ink) 12%, transparent);
  font-size: 0.95rem;
}
.card dd:last-of-type { border-bottom: 0; }
.card a { text-decoration: none; border-bottom: 1px solid color-mix(in srgb, var(--ember) 60%, transparent); }
.card a:hover { color: var(--ember); }
.caveat {
  margin: 1.1rem 0 0; font-family: var(--mono);
  font-size: 0.6rem; letter-spacing: 0.08em; line-height: 1.7;
  color: var(--ink-dim);
}

.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 2rem; }
.action {
  display: inline-flex; align-items: center; gap: 0.7rem;
  padding: 0.95rem 1.5rem;
  font-family: var(--mono); font-size: 0.63rem;
  letter-spacing: 0.22em; text-transform: uppercase;
  text-decoration: none; cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--ink) 32%, transparent);
  color: var(--ink);
  background: transparent;
  transition: background-color 220ms var(--ease), color 220ms var(--ease),
              border-color 220ms var(--ease), transform 380ms var(--ease);
}
.action:hover, .action:focus-visible {
  background: var(--ember); border-color: var(--ember); color: #140B04;
}
.action.primary { background: var(--ember); border-color: var(--ember); color: #140B04; }
.action.primary:hover, .action.primary:focus-visible {
  background: transparent; color: var(--ink); border-color: var(--ink);
}
.action svg { width: 13px; height: 13px; flex: none; }

/* --- kind: coda -------------------------------------------------------- */

/* The page ends where it began — same night ground, same slack tub — so the
   closing scene is composed like the opening one rather than like a footer. */
.k-coda .stage { align-content: center; }
.k-coda .col {
  grid-column: 1 / -1;
  display: flex; flex-direction: column; align-items: center; text-align: center;
}
.k-coda .kicker { justify-content: center; }
.k-coda .display { font-size: clamp(2.4rem, 6.4vw, 6rem); }
.k-coda .body-copy { text-align: center; max-width: 38ch; }
.k-coda .colophon {
  grid-column: 1 / -1;
  display: flex; justify-content: space-between; align-items: flex-end;
  gap: 2rem; flex-wrap: wrap;
  border-top: 1px solid color-mix(in srgb, var(--ink) 18%, transparent);
  padding-top: 1.4rem; margin-top: clamp(3rem, 9vh, 7rem);
}
.k-coda .mark {
  font-family: var(--display); font-size: clamp(1.6rem, 3vw, 2.5rem);
  line-height: 1.05; font-weight: 300; margin: 0;
}
.k-coda .fine {
  font-family: var(--mono); font-size: 0.58rem; letter-spacing: 0.18em;
  text-transform: uppercase; color: var(--ink-dim); text-align: right;
  line-height: 2.1;
}
.k-coda .fine a { text-decoration: none; }
.k-coda .fine a:hover { color: var(--ember); }

/* ------------------------------ focus ring ------------------------------ */

:focus-visible {
  outline: 2px solid var(--ember);
  outline-offset: 3px;
}

.skip {
  position: fixed; top: -100px; left: var(--gutter); z-index: 100;
  background: var(--ember); color: #140B04; padding: 0.8rem 1.2rem;
  font-family: var(--mono); font-size: 0.65rem; letter-spacing: 0.2em;
  text-transform: uppercase; text-decoration: none;
}
.skip:focus { top: var(--gutter); }

.sr-only {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* ------------------------------- tablet -------------------------------- */

@media (max-width: 1080px) {
  .k-triptych .col { grid-column: 1 / span 8; }
  .k-triptych .aside { grid-column: 9 / span 4; }
  .k-sustain .col { grid-column: 1 / span 7; }
  .k-sustain .aside { grid-column: 9 / span 4; }
  .k-daybreak .col { grid-column: 1 / span 7; }
  .k-daybreak .aside { grid-column: 8 / span 5; }
  .k-threshold .col { grid-column: 1 / span 12; margin-bottom: 2.4rem; }
  .k-threshold .aside { grid-column: 1 / span 12; }
  .k-threshold .stage { align-content: center; }
}

/* -------------------------------- mobile -------------------------------- */

/* Mobile is not the desktop composition stacked. The grid collapses to one
   column, the two-column scenes drop their aside entirely rather than shrinking
   it into a thumbnail, and the reel becomes a swipeable strip the visitor
   controls instead of a scroll-scrubbed one they do not. */
@media (max-width: 860px) {
  :root { --measure: 30ch; }

  .stage {
    grid-template-columns: 1fr;
    align-content: center;
    padding: calc(var(--gutter) * 3.4) var(--gutter) calc(var(--gutter) * 3);
  }
  .col, .aside { grid-column: 1 / -1 !important; }

  .display { font-size: clamp(2.6rem, 12.5vw, 4.6rem); }
  .k-immersion .display { font-size: clamp(3.4rem, 20vw, 6.5rem); }
  #scene-oven .display { font-size: clamp(2.1rem, 10.5vw, 4rem); }

  .k-triptych .aside,
  .k-sustain .aside { display: none; }

  .k-daybreak .aside {
    margin-top: 2.2rem; grid-template-columns: 1fr 1fr; gap: 0.7rem;
  }
  .k-daybreak .aside .plate:first-child { grid-column: 1 / -1; aspect-ratio: 16 / 11; }

  .k-reel .stage { align-content: center; gap: 2rem 0; }
  .k-reel .reel-wrap { overflow-x: auto; scroll-snap-type: x mandatory; }
  .k-reel .reel { transform: none !important; }
  .k-reel .reel .plate { scroll-snap-align: center; height: 46svh; }
  .k-reel .reel .plate.portrait { width: 62vw; }
  .k-reel .reel .plate.square { width: 76vw; }
  .k-reel .reel .plate.landscape { width: 86vw; }
  .k-reel .reel .plate:nth-child(even) { align-self: auto; }
  .k-reel .reel .plate:nth-child(3n) { height: 46svh; }

  .k-plate .col { padding-bottom: calc(var(--gutter) * 3.2); }

  /* Content-heavy scenes stop being pinned.
     A sticky 100svh stage silently clips anything taller than the viewport,
     and on a phone the story block, the two photographs and the information
     card are all taller than that. These three flow normally instead: the
     timeline keeps running, they just scroll like a page. */
  .k-daybreak, .k-threshold, .k-coda { min-height: 0 !important; }
  .k-daybreak .stage,
  .k-threshold .stage,
  .k-coda .stage {
    position: relative;
    height: auto;
    min-height: auto;
    align-content: start;
    opacity: 1 !important;
    padding-block: calc(var(--gutter) * 3.4);
  }
  .k-coda .stage { padding-top: 0; }

  .k-threshold .col { margin-bottom: 1.8rem; }
  .card { padding: 1.2rem; }
  .card dl { grid-template-columns: 1fr; gap: 0; }
  .card dt { padding-top: 1rem; }
  .card dd { padding-top: 0.25rem; }

  .k-coda .col { flex-direction: column; align-items: flex-start; }
  .k-coda .fine { text-align: left; }

  .hud-brand img { height: 13px; }

  /* Once the scenes flow rather than pin, a fixed overlay has nothing to sit
     over and starts landing on the copy. The night HUD retires at daybreak —
     which is also when it has finished saying anything. */
  body:not(.dark-ground) .hud-brand,
  body:not(.dark-ground) .hud-clock,
  body:not(.dark-ground) .hud-scroll { opacity: 0; pointer-events: none; }
}

/* --------------------------- reduced motion --------------------------- */

@media (prefers-reduced-motion: reduce) {
  .display .line-in { transform: none !important; transition: none; }
  .plate { clip-path: none !important; transition: none; }
  .k-plate .plate { clip-path: circle(150% at 50% 50%) !important; }
  .plate img { transform: none !important; transition: none; }
  .stage { opacity: 1 !important; transition: none; }
  .curtain-bar i { animation: none; transform: none; }
  .hud-clock b.tick { animation: none; }
  .action { transition: none; }
  .k-reel .reel { transform: none !important; }
  .k-reel .reel-wrap { overflow-x: auto; }
}
`;
