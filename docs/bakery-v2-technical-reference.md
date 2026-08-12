# Bakery V2 — technical reference

_Read-only reconstruction, 2026-08-12. No file modified, nothing committed,
nothing implemented. Every claim below is cited to a file and line at commit
`a1c44af`, which is byte-identical to the working tree for `lib/experience/`
(verified: `git diff --stat a1c44af HEAD -- lib/experience` is empty)._

**Purpose.** Answer, without assumption: *how did Bakery V2 produce a
cinematic, scene-based, scroll-driven, 3D website when the general
BusinessForge pipeline produces static brochure sites?*

**Relationship to existing docs.** [`experience-capability-audit.md`](experience-capability-audit.md)
already answers the strategic questions (§12–14, §19–20 of the brief) and
[`canonical-bakery-v2.md`](canonical-bakery-v2.md) records the verification
evidence. This document is the *implementation-level* reconstruction those two
deliberately do not contain. Where they already settle a question, this
document cites them rather than restating.

---

## 0. Three findings that reframe the question

**0.1 — Nothing was lost.** The premise "capabilities existed in V2 and
disappeared" is not supported by the repository. `lib/experience/` was
introduced in exactly one commit (`a1c44af`, 15 files, 3390 insertions) and has
never been touched since:

```
git log --oneline --all -- lib/experience   →   a1c44af   (single commit)
git diff --stat a1c44af HEAD -- lib/experience   →   (empty)
```

Every V2 capability is still present, still runnable today via
`npx tsx scripts/build-experience.ts 25e648c7`. See §19.

**0.2 — Bakery V2 never went through the general pipeline, so it never *lost*
access to it — it never had it.** There is no import edge from `main.ts` or any
`lib/design/` or `lib/render/` module into `lib/experience/`. The only two
importers in the entire repository are:

- `scripts/build-experience.ts:23-24`
- `test/experience.contrast.test.ts:13`

Bakery V2 is a **parallel renderer**, not a mode of the existing one. It shares
the collected profile fixture and the vendored fonts, and nothing else.

**0.3 — There is a name collision that will mislead any future agent.**

| Path | What it is |
|---|---|
| `lib/experience/` | The Bakery V2 engine. Committed `a1c44af`. Isolated. |
| `lib/design/experience.ts` | A **different** module — the *general* pipeline's narrative/arc layer, added after the audit. Currently uncommitted (`M` in git status). |

They are unrelated codebases with confusingly similar names. `lib/design/experience.ts:1-21`
describes itself as choosing "values the renderer already understands —
emphasis, full-bleed, the moment marker, the transition primitive, density…
There is no new renderer primitive here". That is the general pipeline's
answer to the audit's gap, and it is *not* the Bakery V2 engine.

---

## 1. Architecture — the complete flow

The brief asks for `business/content → experience model → scene model → design
model → renderer → runtime → browser`.

**There is no design-model stage.** Bakery V2 has no `WebsiteDesign`, no design
tokens, no `LayoutPlan`, no Design Director involvement. The actual flow is
five stages, and the absence of the sixth is the single most important
architectural fact in this document.

```
3-profile.json  ──►  compose()  ──►  Experience  ──►  optimise()  ──►  emit()  ──►  index.html
 (verified facts)     (authored          (scene            (Chromium      (static      + styles.css
                       script)            model)            re-encode)     emitter)    + proof.js
                                                                                            │
                                                                          window.__PROOF__  ▼
                                                                                        runtime IIFE
                                                                                        (scroll → state)
```

### Stage 1 — Input: the verified profile

| | |
|---|---|
| File | `output/25e648c7/3-profile.json` (gitignored; produced by the collector in an earlier session) |
| Shape | Fields wrapped as `{ value, source, sourceUrl, alternatives[] }` |
| Also read | `output/25e648c7/assets/` — 40 files, filenames carry upstream semantics (`chad-turns-dough`, `tartineinterior`, `Cut_Croissant`) |
| Read by | `scripts/build-experience.ts:104` `main()` — `fs.readFile(...3-profile.json)` + `fs.readdir(assetDir)` |

**No model call anywhere in this path.** `compose()` is pure and deterministic.

### Stage 2 — `compose()` → the scene model

| | |
|---|---|
| File | `lib/experience/compose.ts` |
| Signature | `export function compose(input: ComposeInput): Experience` — line 146 |
| Input | `ComposeInput { profile: Record<string, unknown>; assetFiles: readonly string[] }` — line 139 |
| Output | `Experience` — `lib/experience/types.ts:193` |

Responsibilities, in order:

1. **Unwrap verified facts** — `val<T>()` (line 88) strips the `{value,…}`
   envelope. Name, address, phones, emails, website, rating, socials, hours.
2. **Format** — `clockLabel()` (101) `07:30 → 7.30am`; `phoneLabel()` (111)
   `+14154872600 → (415) 487-2600`.
3. **Degrade honestly on hours** — lines 180-184. `hours.length < 7` sets
   `hoursCaveat`. One verified day is published as one day plus a caveat, never
   extrapolated to a week.
4. **Filter photography** — `NOT_PHOTOGRAPHY` regex (137) removes book covers,
   Amazon product shots, screenshots, logos. `pick()` (128) casts photographs to
   narrative roles by filename substring; a miss returns `null` and the scene
   composes without that plate rather than substituting an unrelated image.
5. **Author the scene script** — lines ~218-490. Ten `scenes.push({...})` calls.
   **This is hand-written creative direction, not derived from the profile.**
6. **Assemble** `Practical` (175) and return `Experience`.

**Communication to the next stage:** a plain immutable object. No side effects.

### Stage 3 — `optimise()` → image re-encode

| | |
|---|---|
| File | `scripts/build-experience.ts:33` `async function optimise(files, fromDir, toDir)` |
| Why here | `sharp` is not a dependency; Chromium already is (Playwright) |
| Mechanism | Launches `chromium`, loads each image as a `data:` URI, draws to a `<canvas>` at a capped longest edge, `canvas.toDataURL('image/jpeg', 0.80)` (line 78) |
| Cap table | `MAX_EDGE` (line 29): `full: 2000, landscape: 1700, portrait: 1300, square: 1300` — per `Plate.crop` |
| Guard | Line 91: never writes a file larger than the source |
| Measured | 12 plates, 7.58MB → 2.94MB |

### Stage 4 — `emit()` → static files

| | |
|---|---|
| File | `lib/experience/emit.ts` |
| Signature | `export async function emit(options: EmitOptions): Promise<{ bytes: number }>` — line 240 |
| Input | `EmitOptions { experience, outDir, assetSourceDir, repoRoot }` — line 230 |
| Output | Writes to disk; returns total byte count |

Emits exactly three text files plus assets:

| Written | Line | Content |
|---|---|---|
| `index.html` | 332 | Scene markup + `window.__PROOF__` bootstrap |
| `styles.css` | 333 | `fontCss(x).css` + `STYLES` (the whole stylesheet, concatenated) |
| `proof.js` | 334 | `RUNTIME_JS` verbatim |
| `assets/*` | 246-256 | Photographs copied from the optimise cache |
| `assets/fonts/*` | 259-263 | Only faces actually set — `fontCss()` (190) filters `VENDORED_FACES` to Cormorant Garamond 300, Archivo 400/900, IBM Plex Mono 400 |

Per-scene markup is built by `sceneHtml(scene, x, index)` (line 105), a
`switch` on `scene.kind` with one branch per kind. Scene height is set inline:

```
`style="min-height:${scene.beats * 100}svh"`      emit.ts:185
```

**This is the sole mechanism translating narrative pacing into scroll distance.**

### Stage 5 — the browser handoff

`emit.ts:321` writes the bootstrap:

```js
window.__PROOF__ = {
  scenes: timeline,   // id, clock, marker, ground, dough, veil
  vs: VERTEX_SHADER,
  fs: FRAGMENT_SHADER
};
```

`timeline` (emit.ts:315-318) is a **projection** of the scene model — only the
fields the runtime needs. Copy, plates and practical data stay in HTML; they
are never re-serialised into JS.

`proof.js` is a single IIFE (`runtime.ts:23`) that reads `window.__PROOF__` at
line 25 and owns everything from there.

---

## 2. Scene model

**Type:** `Scene` — `lib/experience/types.ts:147-172`.

| Property | Line | Type | Meaning |
|---|---|---|---|
| `id` | 148 | `string` | DOM id becomes `scene-${id}` |
| `kind` | 149 | `SceneKind` | Selects both the emit branch and the CSS composition |
| `clock` | 150 | `Clock` (= `string`) | HUD timestamp — the narrative device |
| `marker` | 152 | `string` | HUD sub-label |
| `ground` | 153 | `Ground` | 4 colours: `base`, `ink`, `inkDim`, `ember` (21-30) |
| `dough` | 154 | `DoughState` | 12 numeric fields — the 3D object's state |
| `beats` | 156 | `number` | Viewport-heights of scroll. **Pacing.** |
| `veil` | 158 | `Veil?` | Optional wash covering the boundary *into* this scene |
| `display` | 160 | `string?` | Oversized line; `\|` splits lines |
| `kicker`, `body`, `log`, `plates`, `quote`, `cta` | 162-171 | | Copy and imagery |

`SceneKind` (126-144) — nine kinds: `immersion`, `triptych`, `sustain`,
`plate`, `reel`, `silence`, `daybreak`, `threshold`, `coda`.

`DoughState` (39-85) — the complete object-state vocabulary:

| Field | Line | Range | Drives |
|---|---|---|---|
| `rise` | 41 | 0–1 | Ellipsoid radii: slack puddle → proofed dome |
| `bake` | 43 | 0–1 | Crust colour, blister sharpness, gloss |
| `heat` | 45 | 0–1 | Key-light colour and direction (night blue → oven orange) |
| `dolly` | 47 | | Camera distance |
| `ferment` | 49 | 0–1 | Surface churn rate |
| `offsetX` / `offsetY` | 51/53 | world units | **Compositional placement** — the loaf is placed opposite the type |
| `offsetYMobile` | 62 | optional | Overrides the mobile default for bottom-anchored scenes |
| `scale` | 64 | | Overall size |
| `presence` | 74 | 0–1 | Canvas opacity; `<0.012` stops drawing entirely |
| `score` | 82 | 0–1 | The cut: 0 uncut, 0.5 travelled, 1 ear open |
| `spring` | 84 | 0–1 | Oven spring volume jump |

`Veil` (96-101) — `{ colour: string; peak: number }`.

### The ten scenes, in order

Total = **27.1 beats = 2710svh** of scroll (≈24390px at 900px viewport, matching
the measured page height in `canonical-bakery-v2.md`).

| # | id | kind | clock | beats | ground | rise | bake | heat | dolly | ferment | oX | oY | scale | presence | score | spring | veil |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `levain` | immersion | 22:00 | 2.6 | NIGHT | 0.06 | 0 | 0.05 | 3.5 | 0.25 | 0 | −0.68 | 0.58 | 1 | 0 | 0 | — |
| 2 | `three-things` | triptych | 00:40 | 2.2 | CELLAR | 0.16 | 0 | 0.10 | 3.2 | 0.55 | 0.98 | −0.30 | 0.72 | 1 | 0 | 0 | — |
| 3 | `rise` | sustain | 02:00 | 3.4 | PROOF | 0.92 | 0.04 | 0.18 | 3.1 | 1.0 | 0.95 | 0.30 | 0.86 | 1 | 0 | 0 | — |
| 4 | `blade` | silence | 04:20 | 3.6 | PROOF | 1.0 | 0.10 | 0.22 | 3.15 | 0.35 | 0.42 | 0.06 | 0.90 | 1 | **0.5** | 0 | — |
| 5 | `oven` | immersion | 04:30 | 2.8 | OVEN | 1.0 | 1.0 | 1.0 | 2.55 | 0.35 | 0.72 | 0.66 | 0.86 | 1 | **1** | **1** | — |
| 6 | `cooling` | plate | 05:10 | 2.4 | CRUST | 1.0 | 0.94 | 0.50 | 3.4 | 0.12 | 0.4 | 0.1 | 0.9 | 0.9 | 1 | 0.25 | — |
| 7 | `rack` | reel | 06:00 | 3.0 | CRUST | 1.0 | 0.90 | 0.42 | 4.2 | 0.08 | 1.95 | 0.92 | 0.62 | 0.13 | 1 | 0 | — |
| 8 | `doors` | daybreak | 07:30 | 2.8 | MORNING | 1.0 | 0.86 | 0.20 | 5.0 | 0.05 | 1.35 | −0.75 | 0.62 | **0** | 1 | 0 | **#FFF6E4 @ 0.97** |
| 9 | `threshold` | threshold | 07:31 | 1.9 | PAPER | 1.0 | 0.80 | 0.12 | 6.0 | 0.03 | 1.7 | −1.0 | 0.5 | 0 | 1 | 0 | — |
| 10 | `coda` | coda | **22:00** | 2.4 | **NIGHT** | **0.08** | 0 | 0.05 | 3.5 | 0.30 | 0 | −0.66 | 0.56 | 1 | **0** | 0 | **#05070C @ 0.94** |

Grounds are defined `compose.ts:34-81`: `NIGHT` `#080A10`, `CELLAR` `#0E1119`,
`PROOF` `#171520`, `OVEN` `#2A0F06`, `CRUST` `#1A100A`, `MORNING` `#EFE6D6`,
`PAPER` `#E6DAC6`.

### What happens in each of the named scenes

**22:00 `levain` (compose.ts:222-243).** `rise: 0.06` — the ellipsoid is at its
slack extreme, a wide flat puddle. `heat: 0.05` means the key light is almost
off, so the object is nearly silhouette. `scale: 0.58`, `offsetY: −0.68` place
it small and low, below centred type. Deliberately the quietest frame on the
page.

**02:00 `rise` (274-295).** `rise: 0.92`, `ferment: 1.0` — maximum surface
churn. `offsetX: 0.95` puts the dome right of a 6-column text block. `beats: 3.4`
is the second-longest scene; its last third is intentionally empty of copy
(see §3, `FADE_OUT_END`) so the blade can begin travelling into that emptiness.

**04:20 `blade` (307-330).** `kind: 'silence'` — a kind that exists so type can
get out of the way (`styles.ts:363-376`: `.k-silence .col` is 4 columns,
bottom-anchored, display clamped to 1.5–2.5rem). `score: 0.5` at the scene
centre. Because interpolation is centre-to-centre (§3), the cut travels from the
`rise` centre to the `blade` centre, then opens from the `blade` centre to the
`oven` centre. Full mechanism in §5.

**04:30 `oven` (331-355).** Every dial at maximum simultaneously: `bake: 1.0`,
`heat: 1.0`, `spring: 1.0`, `score: 1.0`, and the closest camera on the page
(`dolly: 2.55`). `offsetX/Y: 0.72/0.66` hold it clear of the Archivo 900
headline — a contrast requirement, not an aesthetic one (cream on glowing
orange cannot reach 3:1).

**07:30 `doors` (404-437).** `presence: 0` — the WebGL layer is switched off
entirely. Narrative reason: the loaf belongs to the night. `veil` at line 423.
Ground flips polarity from `CRUST` (dark) to `MORNING` (light).

**`coda` (462-490).** `ground: NIGHT`, `clock: '22:00'`, `rise: 0.08`,
`presence: 1` — numerically almost identical to `levain`. See §10.

---

## 3. Scroll-driven runtime

All in `lib/experience/runtime.ts`, exported as the string `RUNTIME_JS` and
written verbatim to `proof.js`.

### The playhead

```js
var play = window.scrollY + window.innerHeight * 0.5;     // runtime.ts:175
```

**The viewport centre, not the top.** One number for the whole page.

### Scene geometry

`measure()` (71-79) caches `{top, height, bottom}` per scene from
`getBoundingClientRect()`. Re-run on `resize` (397), on `load` (501), and after
the curtain lifts (491).

### Active scene

```js
for (var i = 0; i < bounds.length; i++) if (play >= bounds[i].top) idx = i;   // 178-180
```

### Interpolation — three *different* strategies, deliberately

This is the core design of the runtime and the thing most likely to be
misunderstood when porting it.

**(a) Dough uniforms — centre-to-centre, smoothstepped.** Lines 183-205.

```js
var centres = bounds.map(b => b.top + b.height * 0.5);
var a = idx, b = Math.min(idx + 1, SCENES.length - 1);
if (play < centres[idx] && idx > 0) { a = idx - 1; b = idx; }
var t = smooth(clamp((play - centres[a]) / span, 0, 1));
state.rise = lerp(A.rise, B.rise, t);   // …and 10 more
```

Consequence, and it is load-bearing: **a scene's declared dough values are only
reached exactly at its centre.** Physical parameters are continuous across the
whole page and never snap. This is why the blade begins moving during the
previous scene.

**(b) Ground colours — a narrow band at the scene *boundary*.** Lines 213-230.

```js
var band = reduced ? 0 : bounds[idx].height * (1 - GROUND_BAND_START);   // 220
if (idx < SCENES.length - 1 && play > edge - band) {
  gt = smooth(clamp((play - (edge - band)) / band, 0, 1));
  state.base = mixRgb(SCENES[idx]._base, SCENES[idx+1]._base, gt);   // + ink, dim, ember
}
```

Ground is a *step function with a short ramp*, not a continuous blend. Reason
is documented at 207-212: blending ink and ground centre-to-centre parks grey
text on a grey ground for hundreds of pixels. The rack→doors midpoint measures
≈1.05:1.

**(c) Per-scene content opacity — local progress.** Lines 262-278.

```js
var p = clamp((play - bd.top) / bd.height, 0, 1);
var inT  = smooth(clamp((p - 0.05) / 0.18, 0, 1));
var outT = 1 - smooth(clamp((p - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START), 0, 1));
el.style.setProperty('--vis', (inT * outT).toFixed(4));
el.style.setProperty('--p', p.toFixed(4));
```

### The three constants that couple (b) and (c)

```js
var FADE_OUT_START  = 0.70;   // runtime.ts:39
var FADE_OUT_END    = 0.86;   // runtime.ts:40
var GROUND_BAND_START = 0.90; // runtime.ts:41
```

**The gap between `FADE_OUT_END` (0.86) and `GROUND_BAND_START` (0.90) is the
entire safety margin of the design.** Copy is at zero opacity before the ground
begins to move. Comment at 34-38 records this; §15 records the browser test
that enforces it. An earlier version sized the band from the viewport rather
than the scene and produced 1.16:1 on a heading still 40% visible.

### Easing

Exactly one easing function in JS:

```js
function smooth(t) { return t * t * (3 - 2 * t); }     // runtime.ts:44
```

Classic smoothstep. Applied to dough `t` (187), ground `gt` (222), fade in/out
(271-272), and *squared* for the veil (249). CSS uses one curve:
`--ease: cubic-bezier(0.22, 1, 0.36, 1)` (`styles.ts:38`).

### Two CSS custom properties are the entire JS→CSS contract

- `--p` — raw local progress 0–1, per scene element
- `--vis` — computed visibility 0–1, per scene element

Plus four page-level: `--ground`, `--ink`, `--ink-dim`, `--ember` (328-331),
and `--night` (281, global scroll fraction, drives the HUD rail).

### Scroll handling

```js
window.addEventListener('scroll', onScroll, { passive: true });   // 396
function onScroll() { if (ticking) return; ticking = true;
  requestAnimationFrame(function () { sample(); ticking = false; }); }   // 390-394
```

`sample()` is rAF-coalesced. Separately, `frame()` (310) runs a permanent rAF
loop that writes CSS vars and GL uniforms. **Reading scroll and writing state
are two different loops.**

### Viewport / mobile / reduced motion

| Concern | Line | Behaviour |
|---|---|---|
| `small` | 30 | `matchMedia('(max-width: 860px)')` |
| `coarse` | 29 | `matchMedia('(pointer: coarse)')` — gates pointer parallax (399) and magnetic buttons (464) |
| `reduced` | 28 | `matchMedia('(prefers-reduced-motion: reduce)')` |
| Mobile offsets | 356-362 | `ox * 0.15`; `oyM` instead of `oy`; `scale * 0.82` |
| Mobile render scale | 88 | `0.5` vs `0.7` |
| Mobile march steps | shader 250 | `quality > 0.8 ? 40 : 26`; `quality = small ? 0.6 : 1.0` (82) |
| Reduced: no GL at all | 480 | `if (!reduced) initGL(); else document.body.classList.add('no-gl')` |
| Reduced: ground snaps | 220 | `band = 0` |
| Reduced: no veil | 242 | `if (!veil \|\| reduced) return` |
| Reduced: time frozen | 344 | `uTime` pinned to `4.0` |
| Reduced: reel not scrubbed | 436 | `if (!small)` guard + CSS `transform: none !important` (`styles.ts` reduced-motion block) |

---

## 4. 3D engine

**It is raw WebGL2. Not Three.js, not React Three Fiber, not CSS 3D.** Zero 3D
dependencies were added to `package.json`. The rack (§9) is the only CSS-3D
mechanism on the page and is unrelated to the WebGL layer.

| Aspect | Implementation |
|---|---|
| Context | `canvas.getContext('webgl2', {antialias:false, alpha:false, depth:false, stencil:false, powerPreference:'high-performance'})` — `runtime.ts:91-95` |
| Geometry | **None.** No vertex buffers. `gl.drawArrays(gl.TRIANGLES, 0, 3)` (365) draws one attribute-less fullscreen triangle generated from `gl_VertexID` (`shader.ts:19-23`) |
| Surface | Signed distance field, raymarched in the fragment shader |
| Primitive | `sdEllipsoid(p, r)` — `shader.ts:90` (Inigo Quilez's bound: `k0*(k0-1)/k1`) |
| Radii | `mix(vec3(0.78,0.30,0.78), vec3(0.92,0.76,0.92), uRise) * uScale` — 122-124 |
| March | 40 steps desktop / 26 mobile, `shader.ts:249-259`. Distance-relaxed hit test `d < 0.0016 * t` (256). Conservative step factor `d * 0.85` (178) |
| Normals | `calcNormal()` — 4-tap tetrahedral gradient, `shader.ts:186` |
| Camera | Hand-built basis in `main()`, 236-247. `ro = vec3(uPointer.x*0.20, 0.34 + uPointer.y*0.12, uDolly)`, target `(0,-0.03,0)`, FOV factor `1.45` |
| Handedness | `rt = normalize(cross(fw, vec3(0,1,0)))`, `up = cross(rt, fw)` — 240-241. Comment records that the reverse order silently mirrors every compositional offset |
| Noise | `hash()` (50), `vnoise()` (56), `fbm()` = **2 octaves only** (78-79) |
| Lighting | Two directional + rim + wrap, all analytic, `shader.ts:275-296`. `keyDir` and `keyCol` both lerp on `uHeat` |
| Specular | One Blinn-Phong term, gloss `mix(28, 96, uBake)` — 298-306 |
| Shadows | **None.** No shadow rays, no AO. Documented consequence: the loaf reads as floating |
| Depth buffer | Disabled — single object, no need |
| Layering | `#proof-gl` z-index 0 → `main` z-index 10 → `#veil` z-index 45 → `#curtain` z-index 90 |
| Antialiasing | MSAA off; a `filter: blur(0.6px)` on the canvas (`styles.ts:104`) instead — cheaper than supersampling, and reads as depth of field |

**Uniform set (16)** — `shader.ts:32-46`, bound at `runtime.ts:120-122`:
`uRes, uTime, uRise, uBake, uHeat, uDolly, uFerment, uGround, uEmber, uPointer,
uQuality, uOffset, uScale, uScore, uSpring`.

`uGround` is notable: the shader paints the *page's own ground colour* as its
background (`shader.ts:263`), so the canvas never reads as a rectangle pasted
over the layout.

---

## 5. The blade / score effect

Two GLSL constants define the cut plane and its travel axis:

```glsl
const vec3 SCORE_N = vec3(0.6203, -0.7203, 0.3101);  // shader.ts:101 — plane normal
const vec3 SCORE_T = vec3(-0.7580, -0.6525, 0.0000); // shader.ts:102 — in-plane travel axis
```

`SCORE_N` lies close to the view plane deliberately (comment 95-100): an
earlier normal pointed away from camera, putting the cut on the far side of the
loaf.

### How the blade travels

```glsl
float scoreMask(vec3 p, float radius) {                    // shader.ts:112
  float along = dot(p, SCORE_T) / max(radius, 1e-4);       // -1 .. 1
  float travelled = uScore * 2.6 - 1.3;                    // sweeps past both ends
  return smoothstep(0.10, -0.06, along - travelled);
}
```

The cut exists only where `along < travelled`. As `uScore` goes 0→1,
`travelled` sweeps −1.3→+1.3 and the incision grows from one edge to the other.
**`uScore` is driven purely by scroll** via the centre-to-centre lerp
(`runtime.ts:204`).

### The incision (act one) — geometry

```glsl
float slash = abs(dot(SCORE_N, p) - 0.04 * uScale);       // 161
float mask  = scoreMask(p, r.x);                          // 162
float open  = smoothstep(0.46, 1.0, uScore);              // 163
d += 0.080 * uScale * smoothstep(0.048*uScale, 0.0, slash) * mask * (1.0 - open*0.7);  // 167
```

`d +=` **adds** distance → carves a groove inward. Depth `0.080` was raised from
`0.052`; the comment at 165-166 records that the shallower value read as a
smudge.

### The ear (act two) — geometry

```glsl
float lipSide = dot(SCORE_N, p) - 0.04 * uScale;                       // 170
float lip = smoothstep(0.34*uScale, 0.02*uScale, abs(lipSide - 0.10*uScale))
          * step(0.0, lipSide);                                        // 171-172
d -= 0.115 * uScale * lip * mask * open;                               // 173
```

`step(0.0, lipSide)` restricts the lift to **one side** of the plane — that
asymmetry is what makes it an ear rather than a symmetric split. `d -=`
subtracts distance → raises the lip.

### The cut face — shading

`crustColour()`, `shader.ts:220-231`:

```glsl
float core  = smoothstep(0.050*uScale, 0.0, slash) * mask;
float broad = smoothstep(0.17*uScale, 0.03*uScale, slash) * mask;
c = mix(c, vec3(0.055,0.028,0.014), core * (1.0-open) * 0.92);   // closed: dark slit
c = mix(c, vec3(0.90,0.79,0.60),   broad * open * 0.70);         // open: raw crumb
c = mix(c, vec3(0.40,0.24,0.12),   core * open * 0.55);          // shadow in the gap
```

Closed and open are **opposite polarity**, not a blend — comment at 213-219
records that getting this wrong produced the smudge.

### The glow

```glsl
float openGlow = smoothstep(0.10*uScale, 0.0, slash) * smoothstep(0.46,1.0,uScore) * uBake;
col += uEmber * openGlow * 0.85;                                  // shader.ts:308-311
```

Gated on `uBake` — the cut only glows once there is heat behind it.

### Steam

```glsl
float steaming = smoothstep(0.5,1.0,uScore) * smoothstep(0.25,0.8,uHeat);   // 326
if (steaming > 0.01) { … fbm wisps, rising, column-masked … }               // 327-336
```

Gated on **both** score and heat — only a hot loaf that has just been opened
produces any. Screen-space, `uv`-based, `sp.y -= uTime * 0.10`.

### Scroll synchronisation summary

| `uScore` | Reached at | Visual |
|---|---|---|
| 0 | `rise` centre | uncut |
| 0→0.5 | `rise` centre → `blade` centre | blade travels; groove lengthens |
| 0.46 | — | `open` begins (smoothstep floor) |
| 0.5→1 | `blade` centre → `oven` centre | ear lifts, cut face pales, glow and steam appear |

---

## 6. Oven spring

**Volume.** `shader.ts:126-130`:

```glsl
r *= 1.0 + 0.17 * uSpring;      // all axes  +17%
r.y *= 1.0 + 0.13 * uSpring;    // vertical  +13% more  →  +32% height
```

Applied to the radii *before* the SDF evaluation, so it is genuine geometric
growth. `uSpring` reaches 1.0 only at the `oven` scene centre and falls to 0.25
by `cooling` — the loaf sets after the spring, as a real one does.

**Crust darkening.** `crustColour()` 196-201:

```glsl
vec3 raw = vec3(0.90,0.83,0.68); vec3 baked = vec3(0.42,0.20,0.09); vec3 deep = vec3(0.17,0.07,0.03);
float b = smoothstep(0.0, 1.0, uBake);
vec3 c = mix(raw, baked, b);
```

**Blistering.** Two parts. Geometry (143, 153): a single high-frequency
`vnoise` displaces the surface by `0.026 * uBake`. Shading (203-208):

```glsl
float spots = smoothstep(0.52, 0.78, bubble);
c = mix(c, deep, spots * b * 0.80);
c += vec3(0.30,0.16,0.05) * smoothstep(0.46,0.54,bubble) * b * 0.5;   // bright rim
```

The bright rim on the thinned bubble wall is explicitly noted as "most of what
makes a crust look like a crust rather than a brown sphere."

**Light transition.** `shader.ts:275-283` — `uHeat` moves both direction and
colour:

```glsl
keyDir = normalize(mix(vec3(-0.45,0.75,0.55), vec3(-0.30,0.28,0.86), uHeat));
keyCol = mix(vec3(0.115,0.150,0.245), uEmber * 1.95, uHeat);
```

**Material change.** Gloss `mix(28.0, 96.0, uBake)` and specular strength
`mix(0.18, 0.55, uBake)` (300-301) — dry baked crust is sharper and shinier
than proofed dough.

---

## 7. Whiteout / veils

**Element.** `<div id="veil" aria-hidden="true">` — `emit.ts` body, styled
`styles.ts:123-131`: `position: fixed; inset: 0; z-index: 45; opacity: 0;
will-change: opacity`.

z-index 45 is **above the HUD** (z-index 40) — comment 123-125: at peak the
clock and wordmark must also disappear, or the moment reads as content
vanishing rather than light overwhelming.

**Opacity.** `wash()` — `runtime.ts:239-251`:

```js
var reach = Math.min(window.innerHeight * 0.52, ownerHeight * 0.22);
var dist  = Math.abs(play - edge);
if (dist >= reach) return;
var k = 1 - dist / reach;
var v = veil.peak * smooth(k) * smooth(k);     // smoothstep SQUARED
```

Squaring produces a sharp peak with soft shoulders — a flash, not a plateau.

**Why it doesn't snap.** Lines 253-260 — the fix for a real bug:

```js
if (idx < SCENES.length - 1) wash(bounds[idx].bottom, SCENES[idx+1].veil, bounds[idx].height);
wash(bounds[idx].top, SCENES[idx].veil, bounds[idx].height);
```

A boundary is *owned by the scene after it*, and must be evaluated from **both
sides**. The first implementation only looked ahead, so the instant the
boundary was crossed `idx` advanced, `SCENES[idx+1].veil` became undefined, and
the veil dropped from 0.97 to 0 in one frame. Measured evidence of the bug and
the fix is in the shoot logs: before, `08-dawn-peak → veil 0`; after,
`08-dawn-peak → veil 0.97`.

**Photograph reveal.** The veil does not itself reveal images; it *covers* the
moment while CSS does. `styles.ts:420-425`:

```css
.k-daybreak .plate { clip-path: inset(0 100% 0 0); transition-duration: 1.75s; }
.k-daybreak.is-live .plate { clip-path: inset(0 0 0 0); }
.k-daybreak .aside .plate:last-child { transition-delay: 0.22s; }
```

A left-to-right wipe — the direction the light came from — instead of the
default bottom-up `inset(0 0 100% 0)` used everywhere else (267-273).

**Reduced motion.** `runtime.ts:242` — `if (!veil || reduced) return;`. The veil
never renders at all. A near-opaque full-screen flash is precisely what that
setting asks not to receive.

---

## 8. 3D → photography handoff

The single most transferable technique in Bakery V2.

**Where.** Scene 6, `cooling`, `kind: 'plate'`.

**Simultaneously on screen:** (a) the WebGL canvas still drawing at
`presence: 0.9`, `bake: 0.94`, `heat: 0.5`; (b) the full-bleed photograph
`gallery-Bread_Crate_Amy_Holt__2_-a414e782.jpg`, expanding; (c) the scrim; (d)
the copy.

**Mechanism — one CSS line.** `styles.ts:337-342`:

```css
.k-plate .plate {
  grid-column: 1 / -1; grid-row: 1;
  height: 100svh; width: 100%;
  clip-path: circle(calc(max(0, var(--p, 0) * 2.8 - 0.16) * 100%) at 52% 44%);
  transition: none;
}
```

- `var(--p)` is the scene's own scroll progress, written by `sample()` (268).
- `* 2.8 - 0.16` → radius 0 until `p ≈ 0.057`, full-frame by `p ≈ 0.41`.
- `max(0, …)` guards against a negative radius invalidating the property.
- `transition: none` is essential — the radius must track scroll *directly*, not
  ease toward a target. **The visitor performs the transition.**
- Origin `52% 44%` is hand-matched to where the rendered loaf sits given
  `cooling`'s `offsetX: 0.4, offsetY: 0.1`. **This is a hardcoded magic number
  with no derivation from the dough state** — see §13.

**Geometry/positioning.** `.k-plate .plate` and `.k-plate .col` are both
`grid-row: 1`, so photograph and copy occupy the same cell; copy is
`align-self: end`, `z-index: 2`.

**Scrim.** `styles.ts` `.k-plate .plate::after` — a 5-stop gradient from 97%
ground at the bottom to transparent at 88%, because the caption sits over
mid-brown bread at almost exactly the dimmed-ink luminance.

**Reduced motion.** `styles.ts` reduced-motion block:
`.k-plate .plate { clip-path: circle(150% at 50% 50%) !important; }` — the
photograph is simply present.

---

## 9. Rack / perspective

**CSS 3D, not WebGL.**

Container — `styles.ts:386-391`:

```css
.k-reel .reel-wrap { overflow: hidden; perspective: 1500px; perspective-origin: 50% 50%; }
.k-reel .reel { display: flex; gap: clamp(1.4rem,3vw,3.2rem);
                padding-inline: 32vw; transform-style: preserve-3d; will-change: transform; }
.k-reel .reel .plate { flex: none; transform-origin: 50% 50%; backface-visibility: hidden; }
```

`padding-inline: 32vw` lets the first and last cards reach screen centre.

Per-card transform — `runtime.ts:435-459`, inside its own permanent rAF loop
(`driveReels`, line 435, self-scheduling at 458):

```js
var q = clamp((p - 0.15) / 0.70, 0, 1);
track.style.transform = 'translate3d(' + (-over * q) + 'px,0,0)';   // track scrub

var mid = window.innerWidth * 0.5;
var off = clamp(((r.left + r.width/2) - mid) / mid, -1.6, 1.6);
card.style.transform = 'perspective(1500px) translateZ(' + (-170*Math.abs(off)) + 'px)'
                     + ' rotateY(' + (-off*26) + 'deg)';
card.style.filter = 'brightness(' + (1 - Math.abs(off)*0.34) + ')';
```

Each card's rotation and depth are a function of **its own distance from screen
centre**, not of its index. The card in front of you is square-on and full
brightness; cards ahead angle away and darken. That is what turns a filmstrip
into a rack.

Off-screen cards are skipped (`if (r.right < -300 || r.left > innerWidth + 300) continue`).

**Scroll mapping.** Track scrub uses the middle 70% of the scene
(`(p - 0.15) / 0.70`), so the reel is settled at both ends.

**Mobile.** `if (!small)` (436) disables the whole thing; CSS replaces it with
a native swipeable strip: `overflow-x: auto; scroll-snap-type: x mandatory;`
and `transform: none !important`. **A scroll-scrubbed carousel the user cannot
control is replaced by one they can.**

---

## 10. Coda / loop

**It is represented in the model, not merely conceptual.** Evidence — `coda`
vs `levain`:

| | `levain` | `coda` |
|---|---|---|
| `ground` | `NIGHT` | `NIGHT` |
| `clock` | `22:00` | `22:00` |
| `rise` | 0.06 | 0.08 |
| `bake` / `heat` | 0 / 0.05 | 0 / 0.05 |
| `dolly` | 3.5 | 3.5 |
| `scale` | 0.58 | 0.56 |
| `offsetY` | −0.68 | −0.66 |
| `score` | 0 | **0** (reset from 1) |
| `presence` | 1 | 1 |

The runtime has no loop construct — `sample()` treats `coda` as scene index 9
like any other. The return is achieved entirely by **authoring the same values
again**, plus the `#05070C @ 0.94` veil (compose.ts:484) covering the
PAPER→NIGHT polarity flip, mirroring the dawn whiteout.

`score` resetting 1 → 0 means the dough uniforms interpolate the cut *backwards*
across `threshold → coda`. Since `presence` is 0 through `threshold`, this is
invisible; the loaf reappears uncut.

CSS composes it like the opening rather than like a footer
(`styles.ts` `.k-coda`): centred column, `.colophon` as a separate bordered row
below.

---

## 11. Motion system — complete inventory

| # | Capability | File | Function / selector | Input | Output | Trigger | Reusable? | Bakery-specific? |
|---|---|---|---|---|---|---|---|---|
| 1 | Playhead | runtime.ts:175 | `sample()` | `scrollY`, `innerHeight` | `play` | scroll (rAF) | **Yes** | No |
| 2 | Dough interpolation | runtime.ts:183-205 | `sample()` + `lerp`/`smooth` | scene centres | 12 floats | scroll | **Yes** (as concept) | Field names only |
| 3 | Ground band blend | runtime.ts:213-230 | `sample()` + `mixRgb` | 2 `Ground`s | 4 CSS vars | scroll | **Yes** | No |
| 4 | Content fade in/out | runtime.ts:262-278 | `--vis` | local `p` | opacity | scroll | **Yes** | No |
| 5 | Veil wash | runtime.ts:239-260 | `wash()` | boundary, `Veil` | `#veil` opacity | scroll | **Yes** | No |
| 6 | Ground-luminance polarity | runtime.ts:315-321 | `frame()` | `state.base` | `body.dark-ground` | rAF | **Yes** | No |
| 7 | Line-split reveal | runtime.ts:410-424 / styles.ts:230-236 | `[data-split]`, `.line-in` | display string | staggered `translateY` | `.is-live` | **Yes** | No |
| 8 | Plate wipe (default) | styles.ts:267-273 | `.plate` clip-path inset | — | bottom-up uncover | `.is-live` | **Yes** | No |
| 9 | Plate wipe (daybreak) | styles.ts:423-425 | `.k-daybreak .plate` | — | left-right uncover | `.is-live` | **Yes** | No |
| 10 | Ken-Burns scale | styles.ts:274-278 | `.plate img` | — | `scale(1.14)→1` | `.is-live` | **Yes** | No |
| 11 | **Circular handoff** | styles.ts:337-342 | `.k-plate .plate` | `--p` | `clip-path: circle()` | scroll (direct) | **Yes** | Origin is hardcoded |
| 12 | Rack track scrub | runtime.ts:437-444 | `driveReels()` | `--p` | `translate3d` | rAF | **Yes** | No |
| 13 | Rack card perspective | runtime.ts:445-456 | `driveReels()` | screen position | `rotateY`+`translateZ`+`brightness` | rAF | **Yes** | No |
| 14 | Pointer parallax | runtime.ts:399-405, shader 237 | `pointermove` → `uPointer` | cursor | camera nudge | pointer | **Yes** | No |
| 15 | Magnetic buttons | runtime.ts:464-473 | `[data-magnet]` | cursor delta | `translate` | pointer | **Yes** | No |
| 16 | Clock tick | styles.ts:162-167 | `@keyframes tick` | scene change | fade+rise | `paintHud()` | **Yes** | No |
| 17 | HUD progress rail | runtime.ts:281 / styles.ts:168-177 | `--night` | scroll fraction | rail height | scroll | **Yes** | No |
| 18 | HUD retire at daylight | styles.ts (mobile block) | `body:not(.dark-ground) .hud-*` | ground | opacity 0 | ground | **Yes** | No |
| 19 | Curtain | styles.ts:62-77 | `#curtain`, `@keyframes fill` | — | opacity + bar | `body.is-ready` | **Yes** | No |
| 20 | Canvas presence fade | runtime.ts:336-338 / styles.ts:105 | `canvas.style.opacity` | `presence` | fade + draw skip | scroll | **Yes** | No |
| 21 | Fermentation churn | shader.ts:136-139 | `doughField` fbm | `uTime`, `uFerment` | surface displacement | rAF | Concept only | **Yes** |
| 22 | Rise / proof | shader.ts:122-124 | radii `mix` | `uRise` | geometry | scroll | Concept only | **Yes** |
| 23 | Oven spring | shader.ts:126-130 | radii scale | `uSpring` | +17%/+32% volume | scroll | Concept only | **Yes** |
| 24 | Blade travel | shader.ts:112-116 | `scoreMask()` | `uScore` | mask sweep | scroll | Technique | **Yes** |
| 25 | Incision groove | shader.ts:167 | `doughField` | `uScore` | `d +=` | scroll | Technique | **Yes** |
| 26 | Ear lift | shader.ts:170-173 | `doughField` | `uScore` | `d -=` one side | scroll | Technique | **Yes** |
| 27 | Cut-face shading | shader.ts:220-231 | `crustColour()` | `uScore` | polarity flip | scroll | Technique | **Yes** |
| 28 | Score glow | shader.ts:308-311 | `main()` | `uScore`×`uBake` | additive ember | scroll | Technique | **Yes** |
| 29 | Steam | shader.ts:324-336 | `main()` | `uScore`×`uHeat`,`uTime` | rising fbm wisps | rAF | Technique | **Yes** |
| 30 | Crust darkening | shader.ts:196-208 | `crustColour()` | `uBake` | albedo + blisters | scroll | Concept | **Yes** |
| 31 | Light temperature | shader.ts:275-283 | `main()` | `uHeat` | dir + colour | scroll | **Yes** | No |
| 32 | Specular / gloss | shader.ts:298-306 | `main()` | `uBake` | Blinn-Phong | scroll | **Yes** | No |
| 33 | Camera dolly | shader.ts:237 | `main()` | `uDolly` | ray origin | scroll | **Yes** | No |
| 34 | Compositional offset | shader.ts:132 | `doughField` | `uOffset` | object placement | scroll | **Yes** | No |
| 35 | Flour specks | shader.ts:338-351 | `main()` | `uTime` | screen-space specks | rAF | Concept | Semi |
| 36 | Film grain | shader.ts:354-356 | `main()` | `gl_FragCoord`,`uTime` | ±0.022 dither | rAF | **Yes** | No |
| 37 | Oven glow bloom | shader.ts:318-321 | `main()` | `uHeat`,`uOffset` | radial add | scroll | **Yes** | No |
| 38 | Canvas DoF blur | styles.ts:104 | `#proof-gl` | — | `blur(0.6px)` | static | **Yes** | No |
| 39 | Body ground transition | styles.ts:53 | `body` | `--ground` | 90ms linear | var change | **Yes** | No |
| 40 | Action hover | styles.ts:472-478 | `.action` | hover | bg/colour/transform | hover | **Yes** | No |
| 41 | FPS auto-degrade | runtime.ts:368-382 | `frame()` | measured fps | quality→scale→drop | continuous | **Yes** | No |

**Motion mechanisms not present, for the avoidance of doubt:** no scroll
hijacking, no smooth-scroll library, no scroll-snap on desktop, no IntersectionObserver
(`.is-live` is computed in `sample()` from measured bounds), no Web Animations API,
no CSS scroll-timelines, no GSAP/ScrollTrigger/Lenis/Locomotive.

---

## 12. Generic vs Bakery-specific

Fully treated in [`experience-capability-audit.md` §1](experience-capability-audit.md).
Summarised at implementation granularity:

**A — Generic mechanisms (portable to any business, no bread knowledge):**
scroll playhead; centre-to-centre parameter interpolation; boundary-band ground
blending; the `FADE_OUT_END`/`GROUND_BAND_START` coupling; veil wash; scene
kinds as distinct compositions; `--p`/`--vis` as the JS→CSS contract; all
clip-path reveals *including the circular handoff*; rack perspective;
luminance-driven polarity switching; curtain; FPS auto-degradation;
device-conditional composition (`offsetYMobile`); the QA harness shape.

**B — Bakery-specific creative direction (not portable):** the ten-scene
script and all its copy; the 22:00→07:30 clock; the seven named grounds;
`DoughState`'s twelve fields *as a vocabulary* (rise/bake/ferment/score/spring
are bread nouns); the entire SDF and its shading; `SCORE_N`/`SCORE_T`; steam;
flour specks; `schema.org` type hardcoded to `'Bakery'` (`emit.ts:208` — a
latent bug for any non-bakery reuse).

**The boundary is cleaner than expected.** `runtime.ts` contains **no bread
vocabulary in its control flow** — it lerps a fixed list of named floats and
knows nothing about what they mean. `styles.ts` contains bread words only in
comments and in `.k-*` class names derived from `SceneKind`. The bread is
concentrated almost entirely in `compose.ts` (the script) and `shader.ts` (the
object).

---

## 13. Experience vs renderer — declarative or hard-coded?

**Mostly declarative, with four specific hard-coded leaks.**

**Declarative (the scene model genuinely drives the renderer):**

- All 12 dough fields — `runtime.ts:190-205` lerps by name, no scene-specific branching.
- Ground colours — `mixRgb` over `Scene.ground`, no per-scene logic.
- Scroll length — `beats * 100svh`, `emit.ts:185`.
- Veils — `Scene.veil` is data; `wash()` is generic.
- HUD — `clock` and `marker` are read straight from the timeline (`paintHud()`, 291).

There is **no** `if (scene.id === 'oven')` anywhere in `runtime.ts` or
`shader.ts`. Confirmed by grep.

**Hard-coded leaks — these are what a Design Director could not currently express:**

1. **`SceneKind` → CSS composition.** The nine kinds are a closed enum whose
   layouts live in hand-written CSS (`styles.ts` `.k-immersion`, `.k-triptych`,
   …). A Director could pick a kind; it could not invent one.
2. **Per-scene ID overrides in CSS.** `#scene-oven .display` (`styles.ts`)
   switches the display face from Cormorant to Archivo 900 for that one scene.
   **This is a genuine hard-coded per-scene rule.**
3. **The handoff origin.** `circle(… at 52% 44%)` is hand-matched to `cooling`'s
   `offsetX/offsetY`. It is not derived. Change the dough offset and the handoff
   silently misaligns.
4. **Photography casting.** `pick(pool, 'chad-turns-dough', …)` matches Tartine
   filenames literally (`compose.ts:200-214`).

**The deepest coupling is not in the code but in the vocabulary:** `DoughState`
*is* the renderer's animation contract. Any other business would need a
different set of named floats, and the shader that consumes them.

---

## 14. Design Director connection

**Bakery V2 was produced by direct code authoring. There was no Design
Director involvement, no scene DSL, no design object, and no model call.**

Evidence:
- `compose()` takes only `{profile, assetFiles}` — no `WebsiteDesign`, no
  `DesignDirective`. `compose.ts:139`.
- `scripts/build-experience.ts` has no `--env-file` and no provider import,
  unlike `npm run design-director` / `experience-intent` in `package.json:19-20`.
- `docs/canonical-bakery-v2.md:18` states it: "No model call in this path".
- The ten `scenes.push({...})` blocks are literal authored objects.

**What the Director would need to generate an equivalent for another industry.**
The minimum viable contract, given the above analysis:

1. **A scene-sequence field** — an ordered list of `{ kind, beats, groundRef,
   momentRef? }`, where `kind` comes from a closed enum the renderer already
   implements. ADR 0005 already proposes `experienceMode` as the gate.
2. **A hero-object state contract** — the hard part. `DoughState` is
   bread-specific by construction. Generalising it means either (a) an abstract
   `heroState: Record<string, number>` plus a per-category shader, or (b)
   accepting that WebGL heroes are authored per category and the Director only
   *selects* one. The audit (§1, row 4; §5) recommends (b): a gated creative
   option, only where the business's own evidence supports it.
3. **A transition primitive vocabulary** — `veil`, `wipe`, `circular-handoff`
   as named, parameterised renderer capabilities rather than CSS written per
   site. This is the highest-value, lowest-risk extraction.
4. **A moment marker** — "this section is the payoff", which the audit already
   identifies as the layout-level gap.

**UNKNOWN — evidence not found:** whether `lib/design/experience.ts`
(uncommitted) already implements items 1 and 4. Its header claims a "moment
marker" and "transition primitive" exist in the general renderer, but verifying
that was outside this read-only pass over `lib/experience/`.

---

## 15. Testing

### `test/experience.contrast.test.ts` (121 lines, 5 tests)

Runs in `npm test` via `test/**/*.test.ts`. Pure — no browser, no build.

| Test | Line | Invariant protected |
|---|---|---|
| body text ≥ 4.5:1 per scene | 62 | Every `ground.ink`/`ground.base` and `inkDim`/`base` pair |
| ember ≥ 3:1 | 78 | Accent readable as a non-text signal |
| night→day flip inverts polarity | 92 | **Guards the band mechanism.** Asserts `rack` is dark (<0.1) and `doors` is light (>0.6) — i.e. that a severe crossing exists, so `GROUND_BAND_START` is load-bearing and cannot be "simplified" away |
| only verified hours reach the page | 99 | `hours.length === 1`, day is Thursday, `hoursCaveat !== null` |
| product shots never enter photography | 107 | `NOT_PHOTOGRAPHY` filter |

Helpers: `luminance()` (17) and `ratio()` (27) implement WCAG relative
luminance directly.

Note the third test's comment (85-91) explicitly records that the *runtime*
coupling cannot be asserted from the scene model alone and delegates it to the
browser harness.

### `scripts/verify-experience.mjs` (198 lines) — four browser modes

**Mode 1 — reduced motion** (lines 22-53). `newPage({reducedMotion:'reduce'})`.
Asserts `lineTransform === 'none'`, `stageOpacity === '1'`, `plateClip === 'none'`,
zero page errors. Screenshot to `output/review/degraded/reduced-motion.png`.

**Mode 2 — no WebGL** (56-95). Denies the context *before any script runs*:

```js
await page.addInitScript(() => {
  const real = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    if (String(type).indexOf('webgl') === 0) return null;
    return real.call(this, type, ...rest);
  };
});
```

Asserts fallback shown, canvas hidden, **curtain removed** (i.e. the page does
not hang behind the loader when GL is unavailable).

**Mode 3 — the contrast sweep at 220 scroll positions** (99-172).

This is the harness the brief singles out. Implementation:

```js
for (const motion of ['no-preference', 'reduce']) {          // line 99 — BOTH modes
  …
  for (let i = 0; i <= 220; i++) {                            // line 124
    window.scrollTo(0, Math.round((total * i) / 220));
    await wait();                                             // 2× requestAnimationFrame
    const ground = parse(getComputedStyle(document.documentElement)
                     .getPropertyValue('--ground'));
    for (const scene of document.querySelectorAll('.scene')) {
      const vis = parseFloat(scene.style.getPropertyValue('--vis') || '1');
      const flowing = getComputedStyle(scene.querySelector('.stage')).position !== 'sticky';
      const opacity = flowing ? 1 : vis;
      if (opacity < 0.06) continue;                           // invisible → not judged
      const rect = scene.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
      for (const sel of ['.display', '.body-copy', '.log li']) {
        const ink = parse(getComputedStyle(el).color);        // COMPUTED, not declared
        if (scene.classList.contains('k-plate')) continue;    // judged against its scrim
        worst.push({ y, scene: scene.id, sel, opacity, c: contrast(ink, ground) });
      }
    }
  }
  worst.sort((a,b) => a.c - b.c);
}
const failures = samples.filter(s => s.c < 4.5);
```

Design points worth preserving verbatim if this is ported:

- **220 evenly spaced positions across the entire page** — ≈111px steps on a
  24390px page, dense enough to land inside a 271px ground band.
- **Colour is read *computed*, not declared** — it measures what the browser
  actually painted, including the live `--ground`/`--ink` written that frame.
- **Contrast is only asserted where text is actually visible** (`opacity < 0.06`
  → skip). This is what makes the claim falsifiable rather than vacuous.
- **`flowing` detection** — scenes whose stage is not `position: sticky` (the
  mobile-reflowed ones) are treated as always-visible.
- **`k-plate` excluded** — its copy sits on a photographic scrim, not the page
  ground, so measuring it against `--ground` would be meaningless. **This is a
  documented coverage gap, not an oversight.**
- **Both motion modes swept** — they reach the same guarantee by different
  routes (fade-out vs ground-snap), and the `reduce` path is invisible unless
  measured.

Last recorded result: **0 failures in both modes; worst pair 6.27:1.**

**Mode 4 — keyboard** (174-196). Eight `Tab` presses; records tag, text and
computed `outlineStyle`/`outlineWidth` per stop. Last run: 8 stops, every one
`solid 2px`, skip link first.

### Capture scripts (evidence, not assertions)

| Script | Purpose |
|---|---|
| `shoot-experience.mjs` | One frame per scene at 46% depth, desktop 1440×900 + mobile 390×844; reports `loadMs`, `fps` (rAF-counted over 1s), `hasGl`, console messages, page height |
| `shoot-moments.mjs` | 11 named moments at exact fractions (blade at 0.30/0.52/0.72), and **measures `#veil` opacity programmatically** rather than eyeballing it |
| `shoot-handoff.mjs` | Four fractions through `cooling` (0.06/0.14/0.22/0.34). **Hardcodes port 4321** — known gap, recorded in `canonical-bakery-v2.md` |
| `probe-gl.mjs` | Reads canvas pixels, `isContextLost()`, computed style — the diagnostic that found the lost-context bug |
| `probe-baseline.mjs` | Trials swiftshader vs ANGLE vs default. **Proved swiftshader drops any WebGL2 context after ~3 frames**, so review must use `--use-angle=default --enable-gpu` |

`probe-baseline.mjs` deserves preservation: without it, the review harness was
photographing a fallback no real visitor would ever see.

---

## 16. Performance

Measured 60–61fps desktop and mobile, load 0.8–2.0s, 3.14MB total.

| Strategy | Location | Effect |
|---|---|---|
| **Sub-native render scale** | runtime.ts:88 | Canvas is `innerWidth * 0.7` (0.5 mobile). ~2× fewer shaded pixels than 1:1, ~4× fewer than DPR 2. Single largest win. |
| **2-octave fbm** | shader.ts:78-79 | Per march step, per pixel. Comment 70-77 records the third octave was invisible on a soft backlit object. |
| **Single-lookup blisters** | shader.ts:143 | One `vnoise` instead of a second `fbm` (3 lookups → 1) |
| **Step budget** | shader.ts:250 | 40 desktop / 26 mobile, hard `for (i < 40)` bound |
| **Relaxed hit test** | shader.ts:256 | `d < 0.0016 * t` — far surfaces converge sooner |
| **No depth/stencil/AA/alpha** | runtime.ts:91-95 | Context created with all four off |
| **Attribute-less draw** | shader.ts:19-23 | No VBO, no upload; 3 vertices from `gl_VertexID` |
| **Draw skipped when invisible** | runtime.ts:336-341 | `presence > 0.012` gate — daylight scenes cost zero GPU, which is exactly where photography is heaviest |
| **FPS auto-degradation** | runtime.ts:368-382 | Below 40fps: `quality 1.0 → 0.6`, then `renderScale → 0.3`, then `loseGL()`. Three rungs, then give up gracefully |
| **Context-loss recovery** | runtime.ts:124-127, 150-154 | `webglcontextlost` → `loseGL()` → designed fallback, never a black rectangle |
| **rAF coalescing** | runtime.ts:390-394 | `ticking` flag; scroll events never run `sample()` more than once per frame |
| **Two-loop split** | 310 / 435 | `frame()` and `driveReels()` are separate rAF loops; neither does layout reads in the write phase |
| **Off-screen card skip** | runtime.ts:449 | Rack cards outside ±300px are not touched |
| **CSS-var animation** | 328-331 | Colour changes are 5 custom-property writes per frame; the browser handles propagation. No per-element JS style writes. |
| **One-time DOM split** | 410-424 | `[data-split]` lines are split at boot; the stagger is a CSS `transition-delay`, not per-frame JS |
| **Image re-encode** | build-experience.ts:33-101 | 7.58MB → 2.94MB |
| **`loading="lazy"` + `decoding="async"`** | emit.ts:33-41 | Eager + `fetchpriority="high"` only for `index === 0` |
| **Fonts** | emit.ts:190-203 | 4 woff2 faces total, `font-display: swap`, first preloaded. No external request anywhere. |
| **Blur instead of MSAA** | styles.ts:104 | `filter: blur(0.6px)` is a compositor operation; MSAA on a raymarcher is not |
| **Curtain** | styles.ts:62-77 | Held until two rAFs after boot (runtime 485-493) — perceived performance |

---

## 17. File inventory

All 15 files from `a1c44af`, unchanged.

| Path | Role | Key symbols | Generic capability | Bakery-specific |
|---|---|---|---|---|
| `lib/experience/types.ts` | Scene model contract (204 ln) | `Scene`, `SceneKind`, `DoughState`, `Ground`, `Veil`, `Plate`, `LogLine`, `Practical`, `Experience`, `Clock` | Scene/Ground/Veil/Plate shapes | `DoughState` field names |
| `lib/experience/compose.ts` | Profile → scene script (535 ln) | `compose()`, `val()`, `clockLabel()`, `phoneLabel()`, `pick()`, `NOT_PHOTOGRAPHY`, 7 `Ground` consts | Fact unwrapping, honest-hours degradation, photo filtering | **The entire 10-scene script**, grounds, copy, filename casting |
| `lib/experience/emit.ts` | Scene model → static files (347 ln) | `emit()`, `sceneHtml()`, `copyHtml()`, `logHtml()`, `plateHtml()`, `thresholdCard()`, `fontCss()`, `jsonLd()`, `esc()`, `smart()` | Emitter shape, font subsetting, `beats→svh` | `switch` arms per kind; `'Bakery'` in `jsonLd()` |
| `lib/experience/runtime.ts` | Scroll→state engine (503 ln) | `sample()`, `frame()`, `wash()`, `driveReels()`, `initGL()`, `resizeGL()`, `loseGL()`, `measure()`, `paintHud()`, `boot()`, `smooth()`, `lerp()`, `mixRgb()`, `clamp()`, `hexToRgb()`, `css()` | **Almost entirely generic** — no bread in control flow | Uniform *names* only |
| `lib/experience/shader.ts` | GLSL (362 ln) | `VERTEX_SHADER`, `FRAGMENT_SHADER`, `sdEllipsoid()`, `doughField()`, `scoreMask()`, `crustColour()`, `calcNormal()`, `map()`, `fbm()`, `vnoise()`, `hash()`, `SCORE_N`, `SCORE_T` | Raymarch scaffold, camera, lighting, grain | **The loaf, the score, spring, steam, flour** |
| `lib/experience/styles.ts` | Art direction (640 ln) | `STYLES`; `.k-*` per kind; `#veil`, `#proof-gl`, `#curtain`, `.hud-*`, `.plate`, `.reel` | Reveals, veil, rack perspective, HUD, reduced-motion block | `#scene-oven .display` override; type scale |
| `scripts/build-experience.ts` | CLI entry (151 ln) | `main()`, `optimise()`, `MAX_EDGE` | Chromium re-encode | Default `runId '25e648c7'` |
| `scripts/serve-experience.mjs` | Static server (50 ln) | `TYPES` map | Yes | No |
| `scripts/shoot-experience.mjs` | Per-scene capture (95 ln) | `run(device, viewport)`, `SCENES` | Harness shape | Scene id list |
| `scripts/shoot-moments.mjs` | Event capture (77 ln) | `MOMENTS` | **Technique: sample events, not midpoints** | The 11 moments |
| `scripts/shoot-handoff.mjs` | Handoff capture (32 ln) | — | Yes | Port hardcoded 4321 |
| `scripts/verify-experience.mjs` | 4-mode QA (198 ln) | reduced-motion / no-webgl / contrast sweep / keyboard | **Fully generic harness** | Selector list |
| `scripts/probe-gl.mjs` | GL diagnostic (39 ln) | `readPixels`, `isContextLost` | Yes | No |
| `scripts/probe-baseline.mjs` | Renderer trial (38 ln) | `trial(name, args)` | **Yes — prevents reviewing a fallback** | No |
| `test/experience.contrast.test.ts` | Invariants (121 ln) | `luminance()`, `ratio()`, 5 tests | Contrast methodology | Scene ids, Thursday |

Supporting, not in the commit: `output/25e648c7/3-profile.json` + `assets/`
(gitignored fixture); `assets/fonts/*.woff2` (pre-existing, vendored);
`.claude/launch.json` (dev-server config, untracked).

---

## 18. Git history

| Commit | Relevance |
|---|---|
| `a1c44af` | **Add the bakery immersive V2 experience engine** — 15 files, +3390. The only commit that touches `lib/experience/`. |
| `e701267` | Let `serve-experience.mjs` take its port from `PORT` — the only later change to any V2 *script* |
| `f91020e` | Audit Bakery V2 against the general pipeline — added `docs/experience-capability-audit.md`, ADR 0005 |
| `ace1363` | Document repository state: Director integrated, Bakery V2 canonical — added `docs/canonical-bakery-v2.md` |
| `c3a591b` | Amend ADR 0005: `worlds.ts` already sequences grounds |
| `9b8383c` → `bbf4810` | Experience Intent V1 — a `DesignDirective` field, explicitly "not a new engine" |
| `7c69800` | Content directed by narrative role |

**Files introduced:** the 15 in §17. **Files later modified:** only
`scripts/serve-experience.mjs` (`e701267`, plus an uncommitted working-tree edit
adding `process.env.PORT`). **Files deleted:** none.

**Working tree at time of writing** — uncommitted changes exist in
`lib/design/*`, `lib/render/*`, `lib/sources/*`, `lib/ai/index.ts`,
`lib/qa/` (untracked) and test snapshots. **None of them touch
`lib/experience/`.**

---

## 19. Regression evidence

**No regressions found.** Applying the requested format honestly:

| CAPABILITY LOST | V2 FILE | CURRENT LOCATION | STATUS | POSSIBLE REASON |
|---|---|---|---|---|
| — | — | — | **Nothing lost** | — |

Every V2 capability is present at HEAD, byte-identical, and runnable.

What is true — and is a *different statement* — is that **no V2 capability was
ever available to the general pipeline.** The correct framing:

| CAPABILITY | V2 FILE | REACHABLE FROM `main.ts`? | STATUS | EVIDENCE |
|---|---|---|---|---|
| Scene sequencing | `lib/experience/compose.ts` | No | Never connected | No import edge; only `scripts/build-experience.ts:23` |
| Scroll-as-time runtime | `lib/experience/runtime.ts` | No | Never connected | Renderer emits no JS runtime |
| WebGL hero object | `lib/experience/shader.ts` | No | Never connected | — |
| Veil / handoff / rack primitives | `lib/experience/styles.ts` | No | Never connected | — |
| Scene-model contract | `lib/experience/types.ts` | No | Never connected | `DesignDirective` has no sequence field (audit §2) |

**UNKNOWN — evidence not found:** whether any attempt was ever made to wire
`lib/experience/` into `main.ts`. No such commit, branch or reverted change
appears in `git log --all`.

---

## 20. Architectural conclusion

**1 — What made V2 feel alive rather than brochure-like?**

One property: **scroll changes state, not just visibility.** In the general
pipeline scroll reveals pre-existing sections (`motion-enter-rise` is
entrance-only). In V2 the page has a continuous playhead and every visual
parameter — geometry, light temperature, camera distance, colour, opacity — is
a function of it. The loaf is not animated *at* the visitor; it is at whatever
state the visitor has scrolled it to. Two supporting properties: **events with
hard edges** (a cut that travels is perceptible; a value that drifts is not),
and **the ordering of grounds as a journey** rather than a palette.

**2 — The five capabilities responsible**

1. **The playhead + centre-to-centre interpolation** (`runtime.ts:173-205`) — scroll as a continuous clock.
2. **The `--p`/`--vis` contract** (`runtime.ts:262-278`) — two CSS variables let *any* CSS express scroll-driven behaviour without more JS. This is what made the handoff a one-liner.
3. **Boundary-band ground blending + the fade/band coupling** (`runtime.ts:207-230`, constants 39-41) — lets the page change colour world legibly.
4. **The veil primitive** (`runtime.ts:239-260`) — makes an otherwise-illegal transition both legal and the most memorable moment on the page.
5. **A parameterised hero object driven by declared per-scene state** (`DoughState` → 16 uniforms) — the spectacle.

**3 — Which are genericisable?**

1–4 are generic *today*: `runtime.ts` has no bread in its control flow. Number 5
is generic only as a *pattern* — the state-vector-drives-a-shader contract
transfers; the shader does not.

**4 — Which are currently unavailable to the Design Director?**

All five. Not because they were lost, but because `DesignDirective` has no
vocabulary that could name a sequence, a moment or a transition
(audit §2), and because `lib/render/` emits no client runtime by design (the
"opens from disk with no JS" guarantee). The gap is a **contract** gap, not a
capability gap.

**5 — The smallest architectural change**

Not "port the experience engine". The smallest change with real leverage, in
dependency order:

- **(a)** Extract items 2–4 above as *renderer primitives* — a scroll-progress
  variable per section, a ground-band transition, and a veil — usable with **no
  WebGL and no scene model**. This alone converts static section reveals into
  scroll-driven state on the existing pipeline.
- **(b)** Add a closed-enum **transition** field and a **moment** marker to the
  layout contract, so the Director can *nominate* where (a) applies.
- **(c)** Leave the WebGL hero as an authored, per-category, opt-in asset the
  Director selects but never generates. ADR 0005's `experienceMode` is the gate.

**6 — What NOT to do**

- Do not generalise `DoughState`. It is bread vocabulary; an abstract
  `heroState: Record<string, number>` would be untyped and unreviewable.
- Do not make scroll-as-time a default. It costs the "opens from disk, needs no
  JS" guarantee that the general renderer's correctness rests on.
- Do not port `styles.ts` wholesale — its `.k-*` compositions are tuned to one
  ten-scene script, and `#scene-oven .display` is a per-scene hack.
- Do not remove persistent navigation to imitate the guided path without an
  explicit per-business gate (audit §1, row on navigation).
- Do not attempt to have a model *generate* GLSL.

**7 — What to keep exactly**

- `sample()`'s three-strategy interpolation and the `FADE_OUT_END` /
  `GROUND_BAND_START` coupling, **including the comments**, which record a real
  measured failure.
- `wash()`'s both-sides boundary evaluation (the snap bug).
- The `presence > 0.012` draw gate and the three-rung FPS degradation.
- `webglcontextlost` → designed fallback.
- **`verify-experience.mjs` in full**, especially the 220-position sweep across
  both motion modes, and `probe-baseline.mjs`.
- The honest-hours degradation (`compose.ts:180-184`) and its test.

**8 — What to refactor / generalise**

- `runtime.ts` splits cleanly into a **generic scroll-state core** (playhead,
  interpolation, bands, veil, `--p`/`--vis`) and a **WebGL host**. The core has
  no bread in it and could ship to the general renderer as-is.
- The three reveal primitives in `styles.ts` (inset wipe, directional wipe,
  circular handoff) become parameterised utilities; the handoff's origin must
  become derived rather than the hardcoded `52% 44%`.
- `emit.ts`'s `switch (scene.kind)` is the natural seam for a kind registry.
- `jsonLd()`'s `'Bakery'` should read category, as the general renderer does.
- `shoot-handoff.mjs` should take a port argument like its siblings.
