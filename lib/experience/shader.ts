/**
 * The dough, as a signed distance field.
 *
 * This is the one piece of 3D on the page and it earns its place by being the
 * subject rather than the decoration: the visitor scrolls and the same loaf
 * slumps, proofs, domes, splits along its score and goes dark. Scroll drives
 * fermentation. Nothing here is a spinning object placed near a headline.
 *
 * Raw WebGL2, no library. A single fullscreen triangle raymarches one SDF; at
 * three noise octaves and ~56 steps it holds 60fps on integrated graphics, and
 * the host halves the resolution scale on small screens rather than dropping
 * the scene. Every uniform below is driven by the scene script in `compose.ts`,
 * interpolated across scene boundaries by the runtime.
 */

export const VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  // Fullscreen triangle: cheaper than a quad and avoids the diagonal seam.
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform vec2  uRes;
uniform float uTime;
uniform float uRise;     // 0 slack .. 1 fully proofed
uniform float uBake;     // 0 raw .. 1 dark crust
uniform float uHeat;     // 0 night blue .. 1 oven orange
uniform float uDolly;    // camera distance
uniform float uFerment;  // surface churn
uniform vec3  uGround;   // scene ground colour, so the object sits in the page
uniform vec3  uEmber;    // scene accent, used for the key light at heat
uniform vec2  uPointer;  // -1..1, parallax only
uniform float uQuality;  // 1 full, 0.6 reduced (small screens)
uniform vec2  uOffset;   // where the loaf sits in the composition
uniform float uScale;    // overall size
uniform float uScore;    // 0 uncut .. 0.5 incision travelled .. 1 ear open
uniform float uSpring;   // oven spring: the volume jump when heat hits

/* ---------------------------- noise ---------------------------- */

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}

/**
 * Two octaves, not the customary four.
 *
 * This runs per raymarch step, so an extra octave costs a full noise lookup on
 * every step of every pixel — and on a soft, backlit, out-of-focus object the
 * fourth octave is invisible anyway. Two octaves plus one cheap high-frequency
 * term for the blisters buys the same surface at a third of the cost, which is
 * the difference between the scene running on integrated graphics and the
 * browser killing the context.
 */
float fbm(vec3 p) {
  return 0.62 * vnoise(p) + 0.30 * vnoise(p * 2.03);
}

/* ------------------------- the dough itself ------------------------- */

/**
 * Slack dough is a puddle; proofed dough is a dome under tension. So uRise
 * moves two things at once — the vertical squash and the surface tautness —
 * because that is what actually distinguishes them to the eye.
 */
/** Inigo Quilez's ellipsoid bound — a real distance estimate, unlike a scaled sphere. */
float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / max(k1, 1e-5);
}

/* The blade's plane, and the axis it travels along.
   The normal lies close to the view plane, so the cut it defines runs right
   across the face of the loaf the camera can see. An earlier normal pointed
   away from the camera, which put most of the score on the far side of the
   loaf and left a smudge near the silhouette as the only visible evidence. */
const vec3 SCORE_N = vec3(0.6203, -0.7203, 0.3101);  // normalised
const vec3 SCORE_T = vec3(-0.7580, -0.6525, 0.0000); // normalised, in-plane

/**
 * How much of the cut exists at a point, 0–1.
 *
 * A baker does not press a groove into the whole loaf at once — the blade
 * enters at one edge and travels. So the cut is masked along SCORE_T by how far
 * uScore has advanced, which is what makes the incision read as an action
 * rather than as a shape fading in.
 */
float scoreMask(vec3 p, float radius) {
  float along = dot(p, SCORE_T) / max(radius, 1e-4);       // -1 .. 1
  float travelled = uScore * 2.6 - 1.3;                    // sweeps past both ends
  return smoothstep(0.10, -0.06, along - travelled);
}

float doughField(vec3 p, out float bubble) {
  // Slack dough is a wide, low puddle; proofed dough is a taller dome that has
  // also grown outwards. The earlier version shrank as it proofed, which is
  // exactly backwards and read as a deflating balloon.
  vec3 rSlack  = vec3(0.78, 0.30, 0.78);
  vec3 rProof  = vec3(0.92, 0.76, 0.92);
  vec3 r = mix(rSlack, rProof, uRise) * uScale;

  // Oven spring. A loaf gains real volume in the first minutes of the bake as
  // trapped gas expands and the crust has not yet set. It is the most dramatic
  // thing bread does, and it is over in about four minutes.
  r *= 1.0 + 0.17 * uSpring;
  r.y *= 1.0 + 0.13 * uSpring;

  p = (p - vec3(uOffset, 0.0));

  float base = sdEllipsoid(p, r);

  // Fermentation: large slow cells that swell as the dough rises.
  float t = uTime * (0.05 + 0.11 * uFerment);
  float cells = fbm(p * (1.75 / uScale) + vec3(0.0, -t * 0.7, t * 0.35));
  float amp = mix(0.030, 0.075, uRise) * mix(0.55, 1.0, uFerment) * uScale;

  // Blisters are a single high-frequency lookup rather than a second fbm —
  // they only ever read as speckle, so the octaves would be wasted.
  float blister = vnoise(p * ((5.5 + 4.0 * uBake) / uScale) + vec3(t * 0.2, 0.0, 0.0));
  bubble = blister;

  // A third, fine octave. It contributes nothing at a distance, but the blade
  // scene puts the camera close enough that without it the crust is a smooth
  // wall of colour.
  float grain = vnoise(p * (17.0 / uScale));

  float d = base
    - (cells - 0.46) * 2.0 * amp
    - (blister - 0.5) * 0.026 * uBake * uScale
    - (grain - 0.5) * 0.0075 * uScale;

  // The score, in two acts.
  //
  // Act one: the blade travels and leaves a thin incision — the loaf is still
  // closed, just cut. Act two: the crust pulls back along that line and the ear
  // lifts, which is the loaf opening where the baker told it to.
  float slash = abs(dot(SCORE_N, p) - 0.04 * uScale);
  float mask = scoreMask(p, r.x);
  float open = smoothstep(0.46, 1.0, uScore);

  // The incision: a groove carved in. Deep enough to cast its own shadow —
  // a shallower one read as a smudge rather than as a cut.
  d += 0.080 * uScale * smoothstep(0.048 * uScale, 0.0, slash) * mask * (1.0 - open * 0.7);

  // The ear: the lip on one side of the cut lifting away.
  float lipSide = dot(SCORE_N, p) - 0.04 * uScale;
  float lip = smoothstep(0.34 * uScale, 0.02 * uScale, abs(lipSide - 0.10 * uScale))
            * step(0.0, lipSide);
  d -= 0.115 * uScale * lip * mask * open;

  // The squash makes this a distance *estimate*, not a true distance, so the
  // march is scaled back to stay conservative. 0.85 is the largest factor that
  // does not punch through the silhouette at grazing angles.
  return d * 0.85;
}

float map(vec3 p) {
  float b;
  return doughField(p, b);
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.0018;
  return normalize(
    e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) +
    e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

/* ---------------------------- shading ---------------------------- */

vec3 crustColour(vec3 p, vec3 n, float bubble) {
  vec3 raw   = vec3(0.90, 0.83, 0.68);   // pale, floured
  vec3 baked = vec3(0.42, 0.20, 0.09);   // dark, blistered
  vec3 deep  = vec3(0.17, 0.07, 0.03);

  float b = smoothstep(0.0, 1.0, uBake);
  vec3 c = mix(raw, baked, b);

  // Blisters darken faster than the field around them, and carry a bright rim
  // where the bubble wall has thinned — that rim is most of what makes a crust
  // look like a crust rather than a brown sphere.
  float spots = smoothstep(0.52, 0.78, bubble);
  c = mix(c, deep, spots * b * 0.80);
  c += vec3(0.30, 0.16, 0.05) * smoothstep(0.46, 0.54, bubble) * b * 0.5;

  // Flour never fully burns off the top of a loaf.
  float flour = smoothstep(0.35, 1.0, n.y) * (1.0 - b * 0.55);
  c = mix(c, vec3(0.93, 0.89, 0.80), flour * 0.32);

  // The cut, in the two states the geometry also models.
  //
  // Closed, it is a dark line: a slit in a pale surface, reading almost
  // entirely as shadow. Open, it is the opposite — raw crumb from the inside
  // of the loaf, paler than the crust around it. Getting these the wrong way
  // round (or blending between them) is what made the first attempt look like
  // a smudge instead of an incision.
  float slash = abs(dot(SCORE_N, p) - 0.04 * uScale);
  float mask = scoreMask(p, mix(0.78, 0.92, uRise) * uScale);
  float open = smoothstep(0.46, 1.0, uScore);

  float core = smoothstep(0.050 * uScale, 0.0, slash) * mask;
  float broad = smoothstep(0.17 * uScale, 0.03 * uScale, slash) * mask;

  c = mix(c, vec3(0.055, 0.028, 0.014), core * (1.0 - open) * 0.92);
  c = mix(c, vec3(0.90, 0.79, 0.60), broad * open * 0.70);
  c = mix(c, vec3(0.40, 0.24, 0.12), core * open * 0.55);

  return c;
}

void main() {
  vec2 uv = (vUv * uRes - 0.5 * uRes) / uRes.y;

  // Camera. The pointer only ever nudges it — this is not a turntable.
  vec3 ro = vec3(uPointer.x * 0.20, 0.34 + uPointer.y * 0.12, uDolly);
  vec3 ta = vec3(0.0, -0.03, 0.0);
  vec3 fw = normalize(ta - ro);
  // cross(fw, worldUp), not cross(worldUp, fw): the latter yields a left-handed
  // basis, which silently mirrors every compositional offset across the screen.
  vec3 rt = normalize(cross(fw, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(rt, fw);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.45 * fw);

  float t = 0.0;
  float hit = 0.0;
  int steps = uQuality > 0.8 ? 40 : 26;
  for (int i = 0; i < 40; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * t;
    float d = map(p);
    // A relaxed hit threshold that widens with distance: the far side of the
    // loaf does not need the precision the silhouette does.
    if (d < 0.0016 * t) { hit = 1.0; break; }
    t += d;
    if (t > 7.0) break;
  }

  // The page's own ground is the backdrop, so the canvas never reads as a
  // rectangle pasted over the layout.
  vec3 col = uGround;

  if (hit > 0.5) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    float bubble;
    doughField(p, bubble);
    vec3 lp = p - vec3(uOffset, 0.0);   // local space, for the score

    vec3 albedo = crustColour(lp, n, bubble);

    // Key light: the oven mouth. At night it is barely there — a bakery at
    // 22:00 is lit by one bulb over a bench, and a fully-lit loaf would give
    // away the whole page on the first screen.
    vec3 keyDir = normalize(mix(vec3(-0.45, 0.75, 0.55), vec3(-0.30, 0.28, 0.86), uHeat));
    vec3 keyCol = mix(vec3(0.115, 0.150, 0.245), uEmber * 1.95, uHeat);
    float key = max(dot(n, keyDir), 0.0);

    vec3 fillDir = normalize(vec3(0.72, 0.22, 0.42));
    float fill = max(dot(n, fillDir), 0.0);
    vec3 fillCol = mix(vec3(0.055, 0.070, 0.115), vec3(0.55, 0.24, 0.10), uHeat);

    // Rim: what actually reads as "this object is in a room".
    float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.4);
    vec3 rimCol = mix(vec3(0.30, 0.38, 0.62), uEmber * 2.2, uHeat);

    // Warm dough is translucent at the edges; cheap wrap term stands in for it.
    float wrap = max(dot(n, keyDir) * 0.5 + 0.5, 0.0);

    col = albedo * (0.05 + 1.05 * key) * keyCol
        + albedo * fill * 0.28 * fillCol
        + rimCol * rim * (0.26 + 0.60 * uHeat)
        + albedo * pow(wrap, 2.5) * 0.18 * mix(vec3(0.10,0.13,0.24), uEmber, uHeat);

    // Proofed dough has a taut, faintly damp skin; baked crust is drier but
    // catches a hard highlight on the blisters. One specular term, retuned by
    // bake, covers both and is most of what stops it reading as matte clay.
    vec3 h = normalize(keyDir - rd);
    float gloss = mix(28.0, 96.0, uBake);
    float spec = pow(max(dot(n, h), 0.0), gloss)
               * mix(0.18, 0.55, uBake)
               * (0.35 + 0.65 * smoothstep(0.42, 0.62, bubble));
    col += keyCol * spec * (0.6 + 1.8 * uHeat);

    // The open score glows: it is a hole into a loaf that is still cooking.
    float slash = abs(dot(SCORE_N, p - vec3(uOffset, 0.0)) - 0.04 * uScale);
    float openGlow = smoothstep(0.10 * uScale, 0.0, slash)
                   * smoothstep(0.46, 1.0, uScore) * uBake;
    col += uEmber * openGlow * 0.85;

    // Sitting the loaf into the page's ground at grazing angles.
    float horizon = smoothstep(0.9, -0.4, n.y);
    col = mix(col, uGround, horizon * 0.18);
  }

  // Oven glow spilling past the object, strongest at the bake.
  vec2 centre = uOffset * vec2(0.42, 0.42);
  float glow = exp(-2.1 * length(uv - centre - vec2(0.0, -0.06)));
  col += uEmber * glow * (0.030 + 0.34 * uHeat);

  // Steam. Only a hot loaf that has just been opened gives any off, so it is
  // gated on the score *and* the heat rather than being ambient atmosphere.
  float steaming = smoothstep(0.5, 1.0, uScore) * smoothstep(0.25, 0.8, uHeat);
  if (steaming > 0.01) {
    vec2 sp = (uv - centre) * vec2(1.6, 0.85);
    sp.y -= uTime * 0.10;
    float wisp = fbm(vec3(sp * 2.6, uTime * 0.09));
    float column = smoothstep(0.62, 0.0, abs(uv.x - centre.x) * 1.7)
                 * smoothstep(-0.10, 0.55, uv.y - centre.y)
                 * smoothstep(1.05, 0.42, uv.y - centre.y);
    col += vec3(1.0, 0.86, 0.72) * smoothstep(0.44, 0.80, wisp)
         * column * steaming * 0.20;
  }

  // Flour in the air. Specks, not orbs — at the earlier size they read as
  // lens dirt sitting on top of the loaf rather than dust drifting in front.
  vec2 dp = uv * 9.0;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    vec2 off = vec2(sin(uTime * 0.07 + fi * 2.1), uTime * 0.02 + fi * 0.7);
    vec2 gp = dp * (1.0 + fi * 0.75) + off;
    vec2 gi = floor(gp);
    float h = hash(vec3(gi, fi));
    if (h > 0.986) {
      float d = length(fract(gp) - 0.5);
      col += mix(vec3(0.55, 0.62, 0.85), uEmber, uHeat)
           * smoothstep(0.085, 0.0, d) * 0.30;
    }
  }

  // Grain. Digital gradients over a full viewport band without it.
  float g = hash(vec3(gl_FragCoord.xy, floor(uTime * 24.0))) - 0.5;
  col += g * 0.022;

  // Vignette, gentle — the type has to stay readable over this.
  col *= 1.0 - 0.22 * dot(uv, uv) * 0.5;

  fragColor = vec4(max(col, 0.0), 1.0);
}`;
