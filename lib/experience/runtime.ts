/**
 * The client runtime: scroll is time.
 *
 * One idea drives everything below. The page has a single continuous timeline —
 * 22:00 to 07:30 — and scroll position is the playhead. Scene boundaries are
 * keyframes on that timeline, not independent widgets that each animate
 * themselves in. So there is exactly one rAF loop, one interpolator, and one
 * place where scroll becomes state; the WebGL uniforms, the page's ground
 * colour, the clock in the corner and the type choreography all read from it.
 *
 * Two deliberate asymmetries in the interpolation:
 *
 *   - Dough uniforms blend centre-to-centre, smoothly, because fermentation is
 *     continuous and should never appear to snap.
 *   - Ground colours blend across a *narrow band* at each scene boundary, at a
 *     moment when both scenes' text has already faded out. Blending them
 *     centre-to-centre would park the page at mid-grey ink on mid-grey ground
 *     for hundreds of pixels of scroll, which is the one thing a colour-shifting
 *     page must never do.
 */

export const RUNTIME_JS = /* js */ `
(function () {
  'use strict';

  var SCENES = window.__PROOF__.scenes;
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse = window.matchMedia('(pointer: coarse)').matches;
  var small = window.matchMedia('(max-width: 860px)').matches;

  /* ------------------------------ utilities ------------------------------ */

  /* Where a scene's copy fades out, and where its ground begins changing.
     The gap between FADE_OUT_END and GROUND_BAND_START is the safety margin
     that keeps the night-to-daylight flip off the type. Verified in the
     browser by scripts/verify-experience.mjs, which samples computed colour
     against computed opacity at 220 scroll positions. */
  var FADE_OUT_START = 0.70;
  var FADE_OUT_END = 0.86;
  var GROUND_BAND_START = 0.90;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mixRgb(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }
  function hexToRgb(h) {
    var n = parseInt(h.slice(1), 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
  }
  function css(rgb) {
    return 'rgb(' + Math.round(rgb[0] * 255) + ',' + Math.round(rgb[1] * 255)
      + ',' + Math.round(rgb[2] * 255) + ')';
  }

  for (var i = 0; i < SCENES.length; i++) {
    var g = SCENES[i].ground;
    SCENES[i]._base = hexToRgb(g.base);
    SCENES[i]._ink = hexToRgb(g.ink);
    SCENES[i]._dim = hexToRgb(g.inkDim);
    SCENES[i]._emb = hexToRgb(g.ember);
  }

  /* --------------------------- scene geometry --------------------------- */

  var els = SCENES.map(function (s) { return document.getElementById('scene-' + s.id); });
  var bounds = [];

  function measure() {
    bounds = els.map(function (el) {
      var r = el.getBoundingClientRect();
      var top = r.top + window.scrollY;
      return { top: top, height: el.offsetHeight, bottom: top + el.offsetHeight };
    });
  }

  /* ---------------------------- WebGL layer ---------------------------- */

  var gl = null, prog = null, uni = {}, canvas = document.getElementById('proof-gl');
  var quality = small ? 0.6 : 1.0;

  // The loaf is a soft, backlit, low-frequency object; it does not need one
  // shaded sample per device pixel. Rendering at ~half linear resolution and
  // letting the compositor scale it up is visually free here and cuts the
  // per-frame cost by four, which is what keeps the scene alive on a laptop.
  var renderScale = small ? 0.5 : 0.7;

  function initGL() {
    try {
      gl = canvas.getContext('webgl2', {
        antialias: false, alpha: false, powerPreference: 'high-performance',
        depth: false, stencil: false,
      });
    } catch (e) { gl = null; }
    if (!gl) { document.body.classList.add('no-gl'); return false; }

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn('shader', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }

    var vs = compile(gl.VERTEX_SHADER, window.__PROOF__.vs);
    var fs = compile(gl.FRAGMENT_SHADER, window.__PROOF__.fs);
    if (!vs || !fs) { document.body.classList.add('no-gl'); gl = null; return false; }

    prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      document.body.classList.add('no-gl'); gl = null; return false;
    }
    gl.useProgram(prog);
    ['uRes','uTime','uRise','uBake','uHeat','uDolly','uFerment','uGround','uEmber',
     'uPointer','uQuality','uOffset','uScale','uScore','uSpring']
      .forEach(function (n) { uni[n] = gl.getUniformLocation(prog, n); });
    gl.bindVertexArray(gl.createVertexArray());
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      loseGL();
    });
    document.body.classList.add('has-gl');
    return true;
  }

  function resizeGL() {
    if (!gl) return;
    var w = Math.max(2, Math.round(window.innerWidth * renderScale));
    var h = Math.max(2, Math.round(window.innerHeight * renderScale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  /**
   * A lost context must not leave a black rectangle over the page.
   *
   * The scene is an enhancement; the ground colour, the type and the
   * photography carry the experience without it. So losing the context drops
   * the page to the same state a machine without WebGL2 would have seen, which
   * is a designed state rather than a failure.
   */
  function loseGL() {
    gl = null;
    document.body.classList.remove('has-gl');
    document.body.classList.add('no-gl');
  }

  /* ------------------------------- state ------------------------------- */

  var state = {
    rise: 0, bake: 0, heat: 0, dolly: 3.4, ferment: 0.2, ox: 0, oy: 0, scale: 1,
    presence: 1, score: 0, spring: 0, veil: 0, veilColour: '#FFF6E4', oyM: 0,
    base: SCENES[0]._base, ink: SCENES[0]._ink, dim: SCENES[0]._dim, emb: SCENES[0]._emb,
    active: 0,
  };
  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  /**
   * Reads scroll into the shared state object.
   *
   * The playhead is the viewport centre. Dough uniforms interpolate between the
   * centres of adjacent scenes; grounds interpolate only inside a short band
   * either side of a boundary, so the flip lands as a designed moment.
   */
  function sample() {
    if (!bounds.length) return;
    var play = window.scrollY + window.innerHeight * 0.5;

    var idx = 0;
    for (var i = 0; i < bounds.length; i++) {
      if (play >= bounds[i].top) idx = i;
    }
    state.active = idx;

    var centres = bounds.map(function (b) { return b.top + b.height * 0.5; });
    var a = idx, b = Math.min(idx + 1, SCENES.length - 1);
    if (play < centres[idx] && idx > 0) { a = idx - 1; b = idx; }
    var span = centres[b] - centres[a];
    var t = span > 0 ? smooth(clamp((play - centres[a]) / span, 0, 1)) : 0;

    var A = SCENES[a].dough, B = SCENES[b].dough;
    state.rise = lerp(A.rise, B.rise, t);
    state.bake = lerp(A.bake, B.bake, t);
    state.heat = lerp(A.heat, B.heat, t);
    state.dolly = lerp(A.dolly, B.dolly, t);
    state.ferment = lerp(A.ferment, B.ferment, t);
    state.ox = lerp(A.offsetX, B.offsetX, t);
    state.oy = lerp(A.offsetY, B.offsetY, t);
    state.oyM = lerp(
      A.offsetYMobile === undefined ? A.offsetY - 0.5 : A.offsetYMobile,
      B.offsetYMobile === undefined ? B.offsetY - 0.5 : B.offsetYMobile,
      t,
    );
    state.scale = lerp(A.scale, B.scale, t);
    state.presence = lerp(A.presence, B.presence, t);
    state.score = lerp(A.score, B.score, t);
    state.spring = lerp(A.spring, B.spring, t);

    // Ground: a band at the end of the scene, sized as a fraction of the scene
    // rather than of the viewport. It has to start *after* FADE_OUT_END, so
    // that the polarity flip from night to daylight — whose midpoint is about
    // 1.05:1 — happens while no copy is on screen. Sizing it from the viewport
    // instead made it 18% of a 300vh scene, which put the crossing right on top
    // of a heading that was still 40% visible.
    var gi = idx, gt = 0;
    var edge = bounds[idx].bottom;
    // With motion reduced, every stage is pinned at full opacity — so the copy
    // that the blend normally happens behind is on screen the whole time, and a
    // blended ground would park grey ink on a grey ground. Snapping the ground
    // at the boundary removes the intermediate state entirely, which is what
    // reducing motion is supposed to mean.
    var band = reduced ? 0 : bounds[idx].height * (1 - GROUND_BAND_START);
    if (idx < SCENES.length - 1 && play > edge - band) {
      gt = smooth(clamp((play - (edge - band)) / band, 0, 1));
      state.base = mixRgb(SCENES[idx]._base, SCENES[idx + 1]._base, gt);
      state.ink = mixRgb(SCENES[idx]._ink, SCENES[idx + 1]._ink, gt);
      state.dim = mixRgb(SCENES[idx]._dim, SCENES[idx + 1]._dim, gt);
      state.emb = mixRgb(SCENES[idx]._emb, SCENES[idx + 1]._emb, gt);
    } else {
      state.base = SCENES[gi]._base; state.ink = SCENES[gi]._ink;
      state.dim = SCENES[gi]._dim; state.emb = SCENES[gi]._emb;
    }

    /* The veil: a wash over the two boundaries where the page changes polarity.
       It rises and falls across a window centred on the boundary, so the
       brightest instant is exactly where night meets morning. It also happens
       to be the only moment when ink and ground are blending past each other,
       which the veil hides completely. */
    state.veil = 0;

    function wash(edge, veil, ownerHeight) {
      // A near-opaque full-screen flash is exactly what someone asking for
      // reduced motion is asking not to receive.
      if (!veil || reduced) return;
      // Short: this is a flash, not a white room to scroll through. Half a
      // viewport either side of the boundary is about a second of scrolling.
      var reach = Math.min(window.innerHeight * 0.52, ownerHeight * 0.22);
      var dist = Math.abs(play - edge);
      if (dist >= reach) return;
      var k = 1 - dist / reach;
      var v = veil.peak * smooth(k) * smooth(k);
      if (v > state.veil) { state.veil = v; state.veilColour = veil.colour; }
    }

    // A boundary is owned by the scene *after* it, and has to be considered
    // from both sides: reading only the boundary ahead made the veil snap to
    // zero the instant it was crossed, so the flash never fell away into the
    // morning it was supposed to reveal — it just vanished at full brightness.
    if (idx < SCENES.length - 1) {
      wash(bounds[idx].bottom, SCENES[idx + 1].veil, bounds[idx].height);
    }
    wash(bounds[idx].top, SCENES[idx].veil, bounds[idx].height);

    // Per-scene local progress drives the choreography of its own content.
    for (var j = 0; j < els.length; j++) {
      var bd = bounds[j];
      var p = clamp((play - bd.top) / bd.height, 0, 1);
      var el = els[j];
      if (play > bd.top - window.innerHeight && play < bd.bottom + window.innerHeight) {
        el.style.setProperty('--p', p.toFixed(4));
        // still → movement → hold → quiet, and fully quiet before the ground
        // starts changing underneath it.
        var inT = smooth(clamp((p - 0.05) / 0.18, 0, 1));
        var outT = 1 - smooth(clamp((p - FADE_OUT_START) / (FADE_OUT_END - FADE_OUT_START), 0, 1));
        el.style.setProperty('--vis', (inT * outT).toFixed(4));
        if (!el.classList.contains('is-live')) el.classList.add('is-live');
      } else if (el.classList.contains('is-live')) {
        el.classList.remove('is-live');
      }
    }

    var total = document.body.scrollHeight - window.innerHeight;
    root.style.setProperty('--night', (total > 0 ? window.scrollY / total : 0).toFixed(4));
  }

  /* ----------------------------- the clock ----------------------------- */

  var veilEl = document.getElementById('veil');
  var clockEl = document.querySelector('[data-clock]');
  var markerEl = document.querySelector('[data-marker]');
  var lastActive = -1;

  function paintHud() {
    if (state.active === lastActive) return;
    lastActive = state.active;
    var s = SCENES[state.active];
    if (clockEl) {
      clockEl.textContent = s.clock;
      clockEl.classList.remove('tick');
      void clockEl.offsetWidth;
      clockEl.classList.add('tick');
    }
    if (markerEl) markerEl.textContent = s.marker || '';
  }

  /* ------------------------------ the loop ------------------------------ */

  var t0 = performance.now();
  var frames = 0, fpsT = t0, fps = 60;
  var darkGround = null;

  function frame(now) {
    var time = (now - t0) / 1000;

    // The brand mark is a black SVG. Across six of the nine scenes it sits on a
    // near-black ground, so its polarity has to follow the ground rather than
    // being decided once at build time.
    var lum = 0.2126 * state.base[0] + 0.7152 * state.base[1] + 0.0722 * state.base[2];
    var dark = lum < 0.32;
    if (dark !== darkGround) {
      darkGround = dark;
      document.body.classList.toggle('dark-ground', dark);
    }

    if (veilEl) {
      veilEl.style.opacity = state.veil.toFixed(3);
      if (state.veil > 0.002) veilEl.style.background = state.veilColour;
    }

    root.style.setProperty('--ground', css(state.base));
    root.style.setProperty('--ink', css(state.ink));
    root.style.setProperty('--ink-dim', css(state.dim));
    root.style.setProperty('--ember', css(state.emb));

    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;

    // Below a perceptible threshold the scene is not drawn at all: daylight
    // scenes then cost nothing, which is where the photography is heaviest.
    var visible = state.presence > 0.012;
    canvas.style.opacity = visible ? state.presence.toFixed(3) : '0';

    if (gl && visible) {
      resizeGL();
      gl.uniform2f(uni.uRes, canvas.width, canvas.height);
      gl.uniform1f(uni.uTime, reduced ? 4.0 : time);
      gl.uniform1f(uni.uRise, state.rise);
      gl.uniform1f(uni.uBake, state.bake);
      gl.uniform1f(uni.uHeat, state.heat);
      gl.uniform1f(uni.uDolly, state.dolly);
      gl.uniform1f(uni.uFerment, reduced ? 0.0 : state.ferment);
      gl.uniform3f(uni.uGround, state.base[0], state.base[1], state.base[2]);
      gl.uniform3f(uni.uEmber, state.emb[0], state.emb[1], state.emb[2]);
      gl.uniform2f(uni.uPointer, pointer.x, pointer.y);
      gl.uniform1f(uni.uQuality, quality);
      // On a phone there is no side column to clear, so the loaf drops below
      // the type instead of beside it — sideways offsets would only push it
      // off a 390px screen, and leaving it centred puts it behind the copy.
      gl.uniform2f(
        uni.uOffset,
        small ? state.ox * 0.15 : state.ox,
        small ? state.oyM : state.oy,
      );
      gl.uniform1f(uni.uScale, small ? state.scale * 0.82 : state.scale);
      gl.uniform1f(uni.uScore, state.score);
      gl.uniform1f(uni.uSpring, state.spring);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    paintHud();

    // If the machine cannot hold the frame budget, drop shader quality once
    // rather than letting the whole page stutter.
    frames++;
    if (now - fpsT > 1400) {
      fps = frames * 1000 / (now - fpsT);
      frames = 0; fpsT = now;
      // Two rungs down before giving up: fewer march steps, then fewer pixels.
      if (fps < 40) {
        if (quality > 0.7) quality = 0.6;
        else if (renderScale > 0.3) renderScale = 0.3;
        else loseGL();
      }
    }

    requestAnimationFrame(frame);
  }

  /* ------------------------------- input ------------------------------- */

  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { sample(); ticking = false; });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { measure(); sample(); }, { passive: true });

  if (!coarse) {
    window.addEventListener('pointermove', function (e) {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    }, { passive: true });
  }

  /* ------------------------ typographic entrance ------------------------ */

  // Display lines are split once, at boot, so the stagger is a CSS delay rather
  // than a per-frame write.
  document.querySelectorAll('[data-split]').forEach(function (el) {
    var lines = el.textContent.split('|');
    el.textContent = '';
    lines.forEach(function (line, li) {
      var wrap = document.createElement('span');
      wrap.className = 'line';
      var inner = document.createElement('span');
      inner.className = 'line-in';
      inner.textContent = line.trim();
      inner.style.transitionDelay = (li * 0.09) + 's';
      wrap.appendChild(inner);
      el.appendChild(wrap);
    });
  });

  /* ---------------------------- the reel ---------------------------- */

  /* The rack.
     A flat strip sliding sideways is a carousel, and a carousel is the one
     generic pattern this page cannot afford. So each photograph is turned in
     perspective by how far it is from the centre of the screen: the loaves
     ahead of you are angled away, the one in front of you is square on. The
     effect is walking down the length of a rack rather than watching a
     filmstrip go past. */
  var reels = [].slice.call(document.querySelectorAll('[data-reel]'));
  function driveReels() {
    if (!small) {
      reels.forEach(function (track) {
        var scene = track.closest('.scene');
        var p = parseFloat(scene.style.getPropertyValue('--p') || '0');
        var over = track.scrollWidth - window.innerWidth;
        if (over > 0) {
          var q = clamp((p - 0.15) / 0.70, 0, 1);
          track.style.transform = 'translate3d(' + (-over * q) + 'px,0,0)';
        }
        var mid = window.innerWidth * 0.5;
        for (var i = 0; i < track.children.length; i++) {
          var card = track.children[i];
          var r = card.getBoundingClientRect();
          if (r.right < -300 || r.left > window.innerWidth + 300) continue;
          var off = clamp(((r.left + r.width / 2) - mid) / mid, -1.6, 1.6);
          card.style.transform =
            'perspective(1500px) translateZ(' + (-170 * Math.abs(off)).toFixed(1) + 'px)'
            + ' rotateY(' + (-off * 26).toFixed(2) + 'deg)';
          card.style.filter = 'brightness(' + (1 - Math.abs(off) * 0.34).toFixed(3) + ')';
        }
      });
    }
    requestAnimationFrame(driveReels);
  }
  if (reels.length) driveReels();

  /* -------------------------- magnetic actions -------------------------- */

  if (!coarse && !reduced) {
    document.querySelectorAll('[data-magnet]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.transform = 'translate(' + dx * 0.22 + 'px,' + dy * 0.3 + 'px)';
      });
      el.addEventListener('pointerleave', function () { el.style.transform = ''; });
    });
  }

  /* ------------------------------- boot ------------------------------- */

  function boot() {
    measure();
    if (!reduced) initGL(); else document.body.classList.add('no-gl');
    sample();
    requestAnimationFrame(frame);

    // Hold the curtain until the first frame is genuinely on screen.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.classList.add('is-ready');
        setTimeout(function () {
          var c = document.getElementById('curtain');
          if (c) c.remove();
          measure(); sample();
        }, 1500);
      });
    });
  }

  if (document.readyState === 'complete') boot();
  else window.addEventListener('load', boot);

  // Images arriving late change scene heights; re-measure when they land.
  window.addEventListener('load', function () { setTimeout(function () { measure(); sample(); }, 60); });
})();
`;
