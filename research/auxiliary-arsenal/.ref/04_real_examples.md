# REAL-SITE EXAMPLES DOSSIER (OBSERVED evidence, boundary-verified)

Method & honesty note: each site's homepage HTML was curl-fetched and grepped with **boundary-aware**
regex. CRITICAL lesson: the token `ogl` matches the substring of `g-o-o-g-l-e`; we excluded that with
`(?<!g)ogl(?!e)`. An earlier shallow grep falsely reported "OGL WebGL" on studios — that was the GOOGLE
substring trap. Retracted. WebGL/Three.js in modern SPAs often lives in lazily-loaded route chunks NOT
present in the initial HTML/bundle, so absence of a signature here = UNKNOWN (not proven absent) unless
the site is a simple SSR shell.

## Signature table (token counts in fetched homepage HTML only)

| Site | gsap | lenis | scrolltrigger | ogl(lib) | three | webgl | cursor | preload |
|---|---|---|---|---|---|---|---|---|
| CRAV (burgers) cravburgers.shop | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 22 |
| Cuberto cuberto.com | 2 | 0 | 0 | 0 | 0 | 1 | 84 | 12 |
| Awwwards winners listing awwwards.com/websites | 4 | 0 | 0 | 0 | 1 | 4 | 70 | 1 |
| Codrops tympanus.net/codrops | 11 | 0 | 0 | 0 | 3 | 8 | 1 | 3 |
| Webflow webflow.com | 50 | 0 | 0 | 0 | 0 | 1 | 4 | 6 |
| Apple apple.com | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 |
| SSENSE (fashion) ssense.com | 0 | 0 | 0 | 0 | 0 | 0 | 59 | 4 |
| Noma (restaurant) noma.dk | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 1 |
| Framer framer.com | 0 | 0 | 0 | 0 | 0 | 0 | 40 | 1 |
| Rive rive.app | 0 | 0 | 0 | 0 | 0 | 0 | 19 | 2 |

(Cuberto's JS bundles additionally show gsap(105) scrolltrigger(25) lenis(42) split-text(72) cursor(55)
— confirming the GSAP+Lenis family. No OGL/three in bundles either.)

## Per-site interpretation

### CRAV (burgers) — https://cravburgers.shop
- OBSERVED: cursor(30), preload(22); bundles show Lenis+GSAP+ScrollTrigger+Framer Motion+lerp cursor+
  exponential-smoothing; ZERO ogl/three/webgl in homepage + 15 bundles.
- WebGL/3D: firmly OBSERVED-absent. Premium via DOM transforms.
- EVIDENCE: OBSERVED. The user's reference site — the key proof that premium ≠ WebGL.

### Cuberto — https://cuberto.com
- OBSERVED: HTML cursor(84) preload(12) webgl(1); bundles gsap(105) lenis(42) split(72). No OGL/three.
- WebGL/3D: minimal signal (webgl=1 likely a generic check). Same family as CRAV + heavy custom cursor.
- EVIDENCE: OBSERVED (homepage + bundle).

### Awwwards winners listing — https://www.awwwards.com/websites
- OBSERVED: gsap(4) webgl(4) three(1) cursor(70). Aggregated across many winners → WebGL does appear
  across the award field, but this is a directory page, not one experience.
- EVIDENCE: OBSERVED (directory).

### Codrops — https://tympanus.net/codrops
- OBSERVED: gsap(11) three(3) webgl(8). A dev tutorial blog whose articles are explicitly about
  WebGL/Three.js — not a single brand experience.
- EVIDENCE: OBSERVED.

### Webflow — https://webflow.com
- OBSERVED: gsap(50) three(34). Platform marketing page.
- EVIDENCE: OBSERVED.

### Apple / SSENSE / Noma / Framer / Rive
- OBSERVED: no animation-lib signatures in homepage HTML (gsap/lenis/three/ogl all 0). These are either
  custom/SSR or native. WebGL status UNKNOWN (route chunks).
- EVIDENCE: OBSERVED-absent-in-HTML; WebGL UNKNOWN.

## BLOCKED / INFERRED (could not fetch — reputation only)
- Immersive Garden, Resn, Locomotive, Aesop, Tesla: fetch blocked. Known premium; live DOM not probed →
  INFERRED. Their WebGL usage is UNKNOWN without a rendered-DOM probe.

## TRANSFERABLE LESSONS FOR BUSINESSFORGE
- CRAV (the user's reference) is genuinely GSAP + Lenis + ScrollTrigger + Framer + lerp-cursor with ZERO
  WebGL. Premium ≠ WebGL.
- "OGL/WebGL everywhere" is a FALSE claim born of the google-substring trap. Do NOT assert studio WebGL
  without a rendered-DOM probe (Playwright/Chrome rendering + WebGL context inspection).
- Coherent motion (GSAP/Lenis family) + honest loader + reduced-motion branch is the verified premium
  pattern.
- To truly classify a studio's WebGL, a real browser must render the page and expose the WebGL context —
  static curl is insufficient. Flag this as a known limitation of this research method.
