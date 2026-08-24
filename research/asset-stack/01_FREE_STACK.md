# 01 — FREE STACK (€0 capable)

> Everything BusinessForge can use at **$0 build cost**. This is the DEFAULT base layer.
> Premium feel here comes from craft + open-source + browser-native, not paid generation.

## Evidence classes used below
VERIFIED = confirmed on official site/docs. KNOWN = established open-source fact.
INFERRED = reasonable but unconfirmed. UNKNOWN = could not confirm.

---

## 1. IMAGE (FREE)
| Solution | Type | Commercial? | Evidence |
|----------|------|-------------|----------|
| **Client-supplied photos** | business asset | yes (client owns) | KNOWN |
| **Local FLUX / Stable Diffusion** (ComfyUI, Automatic1111) | local model | depends on base model licence | KNOWN open-source |
| **Recraft free** | web API | ❌ NO — owned by Recraft, public, non-commercial | VERIFIED recraft.ai/pricing |
| **Ideogram free** | web API | limited; verify | INFERRED |
| **Unsplash / Pexels / Pixabay** | open photography | ✅ commercial (each has licence; Unsplash/Pexels MIT-like, Pixabay custom) | KNOWN |
| **SVG / CSS procedural graphics** | procedural | ✅ | KNOWN |
| **Open-source icon sets** (Lucide, Heroicons, Tabler) | OSS MIT | ✅ | KNOWN |

**Free image rule:** prefer client photos + open photography (Unsplash/Pexels) + local
SD/FLUX. NEVER use Recraft/Ideogram free output commercially.

## 2. VIDEO (FREE)
| Solution | Type | Note | Evidence |
|----------|------|------|----------|
| **Procedural "video"** — CSS Ken-Burns, Canvas, GSAP image-sequence | procedural | premium feel, $0, autonomous | KNOWN |
| **Local I2V model** (e.g. open SVD) | local | heavy GPU, quality UNKNOWN | INFERRED |
| **Client-supplied footage** | business asset | best free option | KNOWN |
| Higgsfield free (~10 credits/day) | web | tiny quota, commercial rights UNKNOWN | VERIFIED tier via search |
| CapCut/Clipchamp free | manual tool | NOT autonomous | KNOWN |

**Free video rule:** default = procedural still motion or client footage. Only use
free-tier AI video for internal/non-commercial or with confirmed licence.

## 3. 3D (FREE)
| Solution | Type | Evidence |
|----------|------|----------|
| **Three.js / React Three Fiber** (MIT) | runtime | VERIFIED threejs.org |
| **OGL / Babylon.js / PlayCanvas** | runtime | KNOWN |
| **Client-supplied GLB/GLTF** | business asset | KNOWN |
| **Open model libraries** (Sketchfab CC, Poly Haven) | OSS/CC | KNOWN |
| **Local reconstruction** (InstantMesh, TripoSR) | local | KNOWN open |
| **Spline free embed** (spline-viewer) | free service | VERIFIED spline.design |

## 4. AUDIO / VOICE (FREE)
| Solution | Type | Commercial | Evidence |
|----------|------|------------|----------|
| **Piper TTS** (open, ~50 voices) | local | ✅ (Apache-2/OSS) | KNOWN |
| **Kokoro-82M** (open, multilingual) | local | ✅ (permissive) | KNOWN |
| **Whisper.cpp** (STT) | local | ✅ (MIT) | KNOWN |
| **ElevenLabs Free** (10k credits/mo) | web API | ❌ until paid | VERIFIED elevenlabs.io/pricing |
| **Suno Free** (10 songs/day) | web API | ❌ until paid | VERIFIED suno.com/suno-plus |
| **PD/Sox generated SFX** | local | ✅ | KNOWN |

**Free voice rule:** local Piper/Kokoro for any commercial voice. Cloud free tiers are
non-commercial only.

## 5. MOTION (FREE — always)
GSAP (standard "no charge" licence for most uses — VERIFIED greensock.com/gsap; ⚠ some
GSAP plugins historically required "Club" membership — verify before using premium
plugins like SplitText/MorphSVG historically paid; as of 2025 GSAP is fully free under
Webflow ownership — INFERRED, re-verify), Lenis (free), CSS, Web Animations API, View
Transitions API, Framer Motion (free, MIT), Lottie (free), Rive (free tier).

## 6. INTERACTION (FREE — always, procedural)
Custom cursor, magnetic buttons, drag (GSAP Draggable free), physics (matter.js MIT),
clip-path masks, kinetic typography, before/after sliders, configurators (Three.js),
hotspots, timelines — all CSS+JS. Study CRAV/cuberto mechanisms, not branding.

## 7. LOADING / NAVIGATION (FREE)
Asset-aware preloaders, skeleton UI, progressive reveal, animated menus, page transitions
(View Transitions + GSAP), Lenis smooth route scroll. No fake loading.

## 8. FUNCTIONAL (FREE)
Search/filter: Fuse.js / Lunr (MIT). Forms: **Web3Forms free (250/mo, no backend)**
VERIFIED. Booking: **Cal.com (open-source self-host)**. Maps: **OpenStreetMap + Leaflet
(no key, no bill)**. Auth/CMS: **Supabase free (50k MAU)** VERIFIED. Analytics: **Plausible
(self-host $0) / Umami**. Email: EmailJS free / Resend free 3k/mo. Localization: i18next.

## 9. MEDIA PROCESSING (FREE + LOCAL)
FFmpeg (GPL), Sharp (Apache-2), ImageMagick, WebCodecs (browser), Blender (GPL). All
automatable at build.

## 10. STORAGE / DELIVERY (FREE)
**Cloudflare R2 free: 10 GB storage, 1M Class A ops, 10M Class B ops, NO egress fee**
VERIFIED cloudflare.com/products/r2. Cloudflare CDN free. Netlify/Vercel/GitHub Pages free
tiers.

---

## FREE STACK BOTTOM LINE
A complete, premium-feeling, fully-functional website can be built and shipped at **€0**
using: client assets + local models + open-source libraries + free APIs + Cloudflare free.
This is the BusinessForge default. Money is the exception, not the rule.
