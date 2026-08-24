# BUSINESSFORGE — MASTER ASSET STACK

> **Purpose:** Single source of truth for the Autonomous Digital Experience Factory asset
> strategy. Read this first. It is the authoritative architecture input; the other 18
> files are drill-downs, evidence, and tables.
>
> **Status:** RESEARCH → EVIDENCE → ARCHITECTURE INPUT. No code written, no registry
> modified, no `.env` touched. All prices/licences below are labelled with evidence
> class: **VERIFIED** (official site/docs), **OBSERVED** (real site), **INFERRED**,
> **UNKNOWN**. Where a number could not be confirmed from an official source it is
> marked UNKNOWN rather than guessed.
>
> **Evidence capture date:** 2026-08-19. AI pricing moves fast — re-verify before
> committing budget. Raw fetched pages live in `research/asset-stack/.raw/`.

---

## 0. THE FUNDAMENTAL PRINCIPLE

```
FREE FIRST
  → MEDIUM IF JUSTIFIED (business evidence warrants spend)
    → PREMIUM ONLY IF JUSTIFIED (measurable ROI / brand need)
```

BusinessForge does **not** generate premium assets by default. Every asset request runs
through a router (see `15_IMPLEMENTATION_MAP.md` and `FREE_FIRST_ROUTER` concept in the
task spec). The router escalates only when business evidence proves the asset earns its
cost. A €0 internal-budget client must still get a *premium-feeling* site — achieved with
procedural, open-source, browser-native and FREE-API assets, not paid generation.

Key insight: **most "premium feel" is not a paid asset — it is craft.**
Custom cursor = CSS+JS+GSAP (free). Loader = SVG/CSS (free). Smooth scroll = Lenis (free).
3D viewer = Three.js (free). Editorial motion = GSAP timelines (free). The paid tiers
buy *content* (photoreal imagery, cinematic video, voice, 3D models) — not the mechanics.

---

## 1. ASSET TAXONOMY (10 classes — not just "AI")

The task explicitly warns: **do not confuse asset with AI.** An asset class may have zero
AI involvement. The factory must know all ten:

| # | Class | Free-native? | When AI/premium earns it |
|---|-------|--------------|--------------------------|
| 1 | AI-generated assets | sometimes | photoreal imagery, cinematic video, voice |
| 2 | Procedural assets | **always** | never needs paid — CSS/JS/SVG/Canvas |
| 3 | Open-source assets | **always** | never needs paid — fonts, icons, libs, models |
| 4 | Browser-native capabilities | **always** | View Transitions, Web Animations, WebCodecs |
| 5 | JavaScript libraries | **mostly free** | paid libs rare; prefer free (GSAP free tier) |
| 6 | Local models | self-hosted | privacy, zero per-call cost, offline |
| 7 | Free APIs | **always** | rate-limited but $0 |
| 8 | Commercial APIs | paid | scale, SLA, support, higher quality |
| 9 | External services | paid/free | forms, email, maps, payments, auth |
| 10 | Functional website capabilities | mixed | search, booking, ecommerce, CMS, auth |

**Rule:** Before any paid call, the router asks in order:
existing business asset? → procedural? → open-source? → browser-native? → free API? →
local model? → MEDIUM paid? → PREMIUM paid? → human approval.

---

## 2. PROVIDER ARCHITECTURE (how the factory talks to vendors)

Every external vendor is reached through ONE adapter pattern (consistent with the existing
`lib/ai/providers` contract — no agent imports a vendor SDK directly). For media assets
the same principle applies: a thin `AssetProvider` adapter wraps each vendor's API/SDK/CLI.

**Verified integration surface per priority vendor (2026-08-19):**

| Vendor | API | SDK | CLI | MCP | Async/webhook | Evidence |
|--------|-----|-----|-----|-----|---------------|----------|
| **Higgsfield** | ✅ REST, one endpoint for image/video/audio/3D | Python + TS SDK | ✅ (homepage lists "MCP & CLI") | ✅ (homepage lists "MCP & CLI" — "Turn Claude into a creative engine") | ✅ polling + webhooks | VERIFIED docs.higgsfield.ai + homepage |
| **fal.ai** | ✅ REST, per-model | Python + JS | via fal-client | partial | ✅ queue | VERIFIED fal.ai/pricing, fal.ai/models |
| **Replicate** | ✅ REST | Python + JS | ✅ cog | ❌ (community) | ✅ | VERIFIED replicate.com/pricing |
| **ElevenLabs** | ✅ REST | Python + JS + many | ❌ | ✅ (MCP server exists) | ❌ (sync + streaming) | VERIFIED elevenlabs.io/pricing |
| **Meshy** | ✅ REST | ✅ | ✅ | ✅ ("Generate 3D inside Claude, Cursor…") | ✅ | VERIFIED meshy.ai/pricing |
| **Tripo** | ✅ REST | ✅ | ❌ | UNKNOWN | ✅ | OBSERVED homepage lists API |
| **Runway** | ✅ REST | ✅ | ❌ | partial | ✅ | VERIFIED runwayml.com/pricing |
| **Stable Diffusion / FLUX local** | ✅ local server | ComfyUI/Automatic1111 | ✅ | ❌ | n/a | KNOWN (open-source) |

**Strategic note:** Higgsfield is the single most important vendor for the factory
because it exposes image+video+audio+3D through ONE async API with SDKs AND an MCP server
— exactly the autonomous-agent integration shape BusinessForge needs. Prioritise it as the
MEDIUM/PREMIUM video+image+audio escalation path. FLUX (via fal/Replicate/local) is the
FREE-leaning image path. ElevenLabs is the voice path. Meshy/Tripo are the 3D path.

---

## 3. THE DECIDED STACK (CATEGORY 20 — one decision, not 50 options)

For every capability, the factory's decision. Full justification in the drill-down files.

### IMAGE
- **Primary (FREE-leaning):** FLUX via fal.ai (`flux-schnell` $0.003/img, `flux-dev`
  $0.025) or **local FLUX/SD** (zero per-call). Replicate `flux-schnell` $0.003 too.
- **Free:** local ComfyUI/Automatic1111 + open-source models; or Recraft free (⚠ NOT
  commercial — see licence). Best free commercial image = **generated locally** or
  **client-supplied**.
- **Medium:** Replicate `flux-1.1-pro` $0.04/img, Ideogram v3 $0.09, Recraft paid
  (commercial rights), Higgsfield image.
- **Premium:** Adobe Firefly (brand-safe, enterprise licence) — price UNKNOWN from
  official source; Higgsfield Ultra for art direction.
- **Local fallback:** same as Free.

### VIDEO
- **Primary (MEDIUM/PREMIUM):** **Higgsfield** (image-to-video, director/camera controls,
  Seedance 2.5 1080p, MCP+CLI). Pricing ~$15 Starter / $39 Plus(annual) / $99 Ultra(annual);
  free ~10 credits/day. VERIFIED tiers via search snippets (INFERRED exact credit math).
- **Free:** local image-to-video (UNKNOWN quality) OR **no video — use a cinematic
  CSS/Canvas/Ken-Burns still sequence** (procedural, premium feel, $0). Free web tools
  (CapCut, etc.) are manual, not autonomous.
- **Medium:** Higgsfield Starter/Plus, Runway Standard $12/mo (625 credits, no watermark),
  fal.ai Wan 2.5 $0.05/s, Kling 2.5 Turbo $0.07/s.
- **Premium:** Higgsfield Ultra, Runway Max $76/mo, fal.ai Veo 3 $0.40/s, Google Veo 3
  (Vertex AI — price UNKNOWN), OpenAI Sora (price UNKNOWN).
- **Local fallback:** procedural video (CSS/Canvas) or local I2V model (heavy GPU).

### 3D
- **Primary (FREE-leaning):** **Three.js / React Three Fiber** runtime (always free,
  MIT). Generation via **Meshy free** (community) or **local** (InstantMesh/TripoSR).
- **Free:** Three.js + open GLB models + client-supplied models.
- **Medium:** Meshy Pro / Tripo paid (API credits) — text/image-to-GLB, auto-rig.
- **Premium:** Meshy Studio/Enterprise, Spline (design tool + viewer, free embed).
- **Local fallback:** Three.js + procedural geometry / client models.

### AUDIO / VOICE
- **Primary (FREE):** **local TTS** — Piper (open, tiny, ~50 voices) or **Kokoro-82M**
  (open, multilingual, high quality) running locally = $0, no watermark, full ownership.
  Whisper.cpp for STT (local, free).
- **Free API:** ElevenLabs Free ($0, 10k credits/mo, ⚠ non-commercial on free tier per
  typical ToS — VERIFIED paid tiers grant commercial).
- **Medium:** ElevenLabs Starter $6/mo (commercial licence, instant voice clone) /
  Creator $22. Cartesia, PlayHT (price UNKNOWN).
- **Premium:** ElevenLabs Pro $99+ (44.1kHz, low latency), Murf.
- **Music:** Suno free (10 songs/day) → Pro/Premier for commercial rights. Local:
  generative (Sox/PD toys) — limited.
- **Local fallback:** Piper / Kokoro / Whisper.cpp.

### MOTION
- **Primary (always FREE):** GSAP (free for most uses — standard "no charge" licence,
  see licence note), Lenis (smooth scroll, free), CSS, Web Animations API, View
  Transitions API.
- **Medium:** GSAP + ScrollTrigger (still free licence), Rive (free tier), Lottie
  (free, lottiefiles). Framer Motion (free, React).
- **Premium:** none required — motion is a craft, not a purchase.
- **Local fallback:** CSS/JS, no dependency.

### INTERACTION
- **Primary (always FREE, procedural):** custom cursor, magnetic buttons, drag, physics
  (matter.js free), clip-path masks, kinetic typography, before/after sliders,
  configurators — all buildable with CSS+JS+GSAP+Three.js. Study CRAV/cuberto mechanisms,
  do NOT copy branding.
- **Premium:** none required.

### LOADING / NAVIGATION
- **Primary (FREE):** real preloaders (asset-aware), skeleton UI, progressive reveal,
  animated menus, page transitions via View Transitions API + GSAP. Lenis for smooth route
  scroll. No fake loading.
- **Premium:** none required.

### FUNCTIONAL CAPABILITIES
- **Search/filter/sort:** FREE — client-side JS (Lunr/Fuse.js free) or Supabase full-text.
- **Forms/contact:** FREE — Web3Forms (250 subs/mo free, no backend), Formspree (free
  tier). VERIFIED Web3Forms.
- **Booking/appointments:** FREE — Cal.com (open-source, self-host) or external embed.
- **Maps:** FREE — OpenStreetMap + Leaflet (no key, no bill) — prefer over Google Maps
  (key + billing). 
- **Auth/customer portal:** FREE — Supabase Auth (50k MAU free). VERIFIED.
- **CMS:** FREE — Decap CMS / Sanity free / Payload (open-source).
- **Ecommerce/checkout/payments:** MEDIUM — Stripe (per-transaction fee, no monthly;
  ~2.9%+€0.30 EU). FREE to integrate, costs only on sales.
- **Email (transactional):** FREE — EmailJS/Web3Forms free; Resend free tier 3k/mo.
- **Analytics:** FREE — Plausible (open-source, self-host $0) or Umami.
- **Localization:** FREE — i18next / client-side.

### MEDIA PROCESSING (local, free)
- **FFmpeg** (local, GPL) — transcode, upscale (via filters), frame interp (minterpolate).
- **Sharp** (Node, Apache-2) — resize/optimise images. **ImageMagick** (free) — batch.
- **WebCodecs** (browser-native) — client-side transcode.
- **Blender** (open, GPL) — 3D render, procedural, headless.
- Everything above is FREE + LOCAL + AUTOMATABLE.

### STORAGE / DELIVERY
- **Free:** Cloudflare R2 free (10 GB storage, 1M Class A ops, 10M Class B ops, **no egress
  fee**). VERIFIED. + Cloudflare CDN (free). GitHub Pages / Netlify / Vercel free tiers.
- **Medium:** R2 paid ($0.015/GB-mo) or S3; Bunny CDN ($1/mo ~). Supabase storage 1GB free.
- **Premium:** enterprise CDN (Cloudflare Ent, Fastly).
- **Local fallback:** static host + client-side optimisation (Sharp at build).

---

## 4. COST STRATEGY (CATEGORY 14 — 4 scenarios)

Full tables in `12_COST_PER_SITE.md`. Summary:

| Scenario | Budget | Stack | Typical asset cost |
|----------|--------|-------|--------------------|
| A. €0 site | €0 | local FLUX/SD + Piper/Kokoro + Three.js + GSAP + Web3Forms + OSM + Cloudflare free | **€0** |
| B. €0–€1 | <€1 | + a few FLUX-schnell (€0.003) or Recraft-free edits; Suno free | **~€0–€1** |
| C. €1–€5 | €1–€5 | + Higgsfield Starter (~$15 but used fractionally) OR fal image+video pay-per-use; ElevenLabs Starter commercial; Meshy credits | **~€1–€5** |
| D. €5+ premium | €5–€20+ | Higgsfield Ultra + Runway + ElevenLabs Pro + Meshy Studio + Firefly; real footage from client | **€5–€20+** |

**Principle:** Stripe/processing costs are born by the *client's sales*, not the build
budget. Storage/free CDN = $0. The only build-time spend is generative content the
business evidence justifies.

---

## 5. LICENSING (CATEGORY 19 — the traps)

Verified licence facts (do NOT skip — wrong licence = client lawsuit):

- **Recraft FREE plan:** images owned by Recraft, publicly visible, **NOT licensed for
  commercial use.** Paid plan → full ownership + commercial. VERIFIED recraft.ai/pricing.
- **Suno FREE:** commercial rights only as **paid subscriber** ("Songs you create as a paid
  Suno subscriber are yours…"). Free = no commercial. VERIFIED suno.com/suno-plus.
- **ElevenLabs FREE:** Starter ($6) first grants **Commercial License**. VERIFIED.
- **Runway paid:** **No watermarks** on Standard+. VERIFIED.
- **Higgsfield / FLUX / Meshy / Tripo / fal:** ownership/commercial = VERIFIED present for
  paid; free-tier commercial rights = UNKNOWN per official source (treat free output as
  non-commercial until verified).
- **Local models (FLUX/SD, Piper, Kokoro, Whisper.cpp):** open licences (often
  non-commercial for some base models — verify per model), **zero watermark, you own
  output**, best for €0 commercial-safe path IF model licence allows commercial use.
- **Adobe Firefly:** enterprise/brand-safe licence — PREMIUM safe choice; price UNKNOWN.

**Rule:** FREE-tier generative output is NEVER assumed commercial. The router only uses
free-tier output for non-commercial/internal or swaps to local models (which you own) when
commercial rights are required and no paid licence is in budget.

---

## 6. FALLBACK STRATEGY (CATEGORY 16)

Every capability has: PRIMARY → SECONDARY → FREE FALLBACK → LOCAL FALLBACK → PREMIUM
ESCALATION. Full matrix in `04_PROVIDER_MATRIX.md`. Headline:

- **Image:** FLUX(fal) → Recraft → local SD → local SD → Adobe Firefly.
- **Video:** Higgsfield → Runway → procedural CSS/Canvas → local I2V → Veo 3 / Sora.
- **Voice:** ElevenLabs → Cartesia → Kokoro-local → Piper-local → ElevenLabs Pro.
- **3D:** Meshy → Tripo → Three.js+client model → Three.js+procedural → Meshy Studio.
- **Forms:** Web3Forms → Formspree → mailto → Supabase → (none).
- **Maps:** OSM/Leaflet → MapLibre → static image → (none) → Google Maps.

---

## 7. BUSINESS EVIDENCE → ASSET RULES (CATEGORY 17)

The factory maps industry → required assets. 15+ industries in
`14_BUSINESS_TO_ASSET_RULES.md`. Examples:

- **RESTAURANT** → food imagery (client photos preferred; FLUX edit if needed), menu
  interactions, booking (Cal.com), ingredient hover, optional short food video (Higgsfield
  only if budget).
- **AUTOMOTIVE** → service selector, booking, diagnostic visuals, 3D wheel/configurator
  (Three.js free), technical interaction.
- **REAL ESTATE** → property gallery, OSM map, floor plan (SVG/procedural), comparison
  table, optional 3D tour (Three.js).
- **FASHION** → editorial imagery (FLUX/Recraft), lookbook, product interactions,
  filtering (Fuse.js), optional video.
- **PROFESSIONAL SERVICES** → trust motion (GSAP), testimonials, contact (Web3Forms),
  auth portal (Supabase) for clients.

---

## 8. REJECT LIST (CATEGORY 18 — what NEVER gets auto-generated)

- decorative AI video with no business purpose
- generic 3D blobs / aimless WebGL
- fake loading screens
- generic AI stock-like photography (use client assets or local)
- unnecessary cursor effects on non-interactive pages
- animations without business purpose
- expensive assets with negligible UX value
- any free-tier generative output used commercially without licence confirmation

---

## 9. IMPLEMENTATION ORDER (CATEGORY 21 — what to build, when)

No code written now. Integration map in `16_IMPLEMENTATION_MAP.md`. Build order:

1. **Now (free, no creds):** procedural/motion/interaction libs (GSAP, Lenis, Three.js),
   functional FREE APIs (Web3Forms, OSM/Leaflet, Supabase free, Plausible), media
   processing (FFmpeg/Sharp at build), storage (Cloudflare free/R2).
2. **Needs credentials (user-supplied):** Higgsfield, fal, Replicate, ElevenLabs, Meshy,
   Tripo, Stripe, Supabase project, R2 bucket.
3. **Needs paid account (only when justified):** any MEDIUM/PREMIUM tier above.
4. **Needs local hardware:** local FLUX/SD, Piper/Kokoro, Whisper.cpp, Blender renders.
5. **Needs human approval:** any PREMIUM escalation, any client-facing commercial use of
   generative output, any asset that fails QA/visual critic.

---

## 10. FILE INDEX (this bundle)

| File | Contents |
|------|----------|
| `00_MASTER_ASSET_STACK.md` | this file — system overview |
| `01_FREE_STACK.md` | everything achievable at $0 |
| `02_MEDIUM_STACK.md` | MEDIUM justified tiers |
| `03_PREMIUM_STACK.md` | PREMIUM justified tiers |
| `04_PROVIDER_MATRIX.md` | full provider comparison table |
| `05_ASSET_MATRIX.md` | per-asset decision matrix |
| `06_VIDEO_IMAGE_AI.md` | image+video deep dive |
| `07_AUDIO_VOICE.md` | audio/voice deep dive |
| `08_3D.md` | 3D generation + runtime |
| `09_MOTION_INTERACTION.md` | motion + interaction |
| `10_FUNCTIONAL_CAPABILITIES.md` | functional website features |
| `11_REAL_SITE_RESEARCH.md` | 30+ real premium sites analysed |
| `12_COST_PER_SITE.md` | 4 scenarios + 5 industry estimates |
| `13_LICENSE_MATRIX.md` | licence/commercial/watermark matrix |
| `14_BUSINESS_TO_ASSET_RULES.md` | 15+ industry → asset rules |
| `15_REJECT_LIST.md` | reject conditions |
| `16_IMPLEMENTATION_MAP.md` | integration plan (no code) |
| `SOURCES.md` | all URLs + evidence class |

---

## 11. ANSWER TO THE FINAL QUESTION (stack for tomorrow)

**Q1 — Client with €0 internal budget, complete site tomorrow:**
Local FLUX/SD (or client-supplied photos) for imagery · Piper or Kokoro-82M **local** TTS
for any voice · Three.js/R3F for 3D · GSAP + Lenis + CSS for all motion/interaction ·
Web3Forms (free, 250/mo) for contact · OpenStreetMap + Leaflet for maps · Supabase free
(50k MAU) for auth/CMS if needed · Plausible (self-host) analytics · Cloudflare free + R2
free (10GB, no egress) for storage/CDN · FFmpeg/Sharp at build for media · Stripe for
payments (costs only on sales). **Total build cost: €0.** Premium feel from craft, not
spend.

**Q2 — Same site, business evidence justifies €1–€5:**
Add: Higgsfield Starter (~fractional, image+video+audio+3D one API) OR fal.ai pay-per-use
(image $0.03–0.04, video Wan $0.05/s) · ElevenLabs Starter $6 → but that alone is >€5, so
for ≤€5 prefer **local Kokoro + a few fal images + 1–2 Higgsfield/Runway seconds** ·
Meshy free/low credits for one hero 3D. **Total: ~€1–€5** of generative content on top of
the free base.

**Q3 — Business evidence justifies €5–€20:**
Higgsfield Ultra or Runway Max for hero cinematic video · ElevenLabs Pro for voice-over ·
Meshy Studio for product 3D · Recraft/Firefly paid for brand-safe imagery · fal.ai Veo 3
for top-tier shots if needed · client-supplied real photography prioritised. **Total:
~€5–€20**, concentrated on the 1–3 assets with proven business value; everything else
stays on the free base.

The factory escalates ONLY on evidence. Default is the €0 craft stack; money is spent
surgically.
