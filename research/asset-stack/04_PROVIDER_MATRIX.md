# 04 — PROVIDER MATRIX

> Full comparison of every vendor researched. Evidence class in last column.
> V = VERIFIED (official source), O = OBSERVED, I = INFERRED, U = UNKNOWN.
> Prices are per the capture date 2026-08-19; re-verify before spend.

| Provider | Category | Capability | Free | Medium | Premium | API | SDK | CLI | MCP | Unit Cost | Typ. Cost/Website | Commercial Lic | Watermark | Rate Limit | Output | Quality | Latency | Automation | Fallback | Evidence | Source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Higgsfield** | Image/Video/Audio/3D | all media | ~10 cr/day | Starter $15(~200cr) Plus $39(1k) | Ultra $99(3k) | ✅ | Py/TS | ✅ | ✅ | credit-based | $0–$15+ | paid=yes/free=U | none paid | async | high | med | ✅ poll+webhook | Runway/fal/local | V tiers I math | higgsfield.ai, docs.higgsfield.ai |
| **fal.ai** | Image/Video | API hub | ❌ | Wan $0.05/s, Kling $0.07/s, Flux $0.04/1MP | Veo3 $0.40/s | ✅ | Py/JS | fal-client | partial | per use | $1–$10 | yes (paid) | none | queue | high | low-med | ✅ | local/Higgsfield | V | fal.ai/pricing |
| **Replicate** | Image/Video | API hub | ❌ | flux-1.1-pro $0.04/img, flux-dev $0.025, schnell $0.003, ideogram $0.09 | custom models | ✅ | Py/JS | ✅ cog | community | per use | $1–$8 | yes (paid) | none | queue | high | med | ✅ | fal/local | V | replicate.com/pricing |
| **ElevenLabs** | Audio/Voice | TTS/SFX/VC | $0 10k cr/mo (non-comm) | Starter $6 (commlic), Creator $22 | Pro $99, Scale $299 | ✅ | Py/JS | ❌ | ✅ | credit | $0–$6+ | free=NO, paid=YES | none | generous | top | low | ✅ streaming | Kokoro-local | V | elevenlabs.io/pricing |
| **Meshy** | 3D | txt/img→GLB, tex, rig | community | Pro (U price) | Studio/Ent | ✅ | ✅ | ✅ | ✅ | credit | $0–$U | paid=yes | none | async | good | med | ✅ | Tripo/Three.js | V | meshy.ai/pricing |
| **Tripo** | 3D | txt/img→GLB | free (U) | paid credits (U) | Ent | ✅ | ✅ | ❌ | U | credit | $0–$U | paid=yes | none | async | good | med | ✅ | Meshy/Three.js | O | tripo3d.ai |
| **Runway** | Video/Image | Gen video/img | 125 one-time cr | Standard $12(625cr), Pro $28 | Max $76(9500cr) | ✅ | ✅ | ❌ | partial | credit | $0–$12+ | paid=YES, no WM | queue | high | med | ✅ | Higgsfield/fal | V | runwayml.com/pricing |
| **Ideogram** | Image | img+text | free (lim) | API $0.03–0.09/img | custom | ✅ | ❌ | ❌ | U | per img | $1–$8 | paid=yes | none | queue | high | med | ✅ | FLUX/Recraft | V(repl)/I | ideogram.ai |
| **Recraft** | Image/Vector | gen/edit/vector | free (NON-comm) | Basic/Pro (owned+comm) | Ent | ✅ | ❌ | ❌ | U | credit | $0–$U | free=NO, paid=YES | none | queue | high | med | ✅ | FLUX/local | V | recraft.ai/pricing |
| **Adobe Firefly** | Image | brand-safe gen | limited | sub | Ent (indemnified) | ✅ | ❌ | ❌ | U | U | U | YES (safe) | none | U | high | med | U | FLUX/Recraft | U price | adobe.com/firefly |
| **Suno** | Audio/Music | song gen | 10 songs/day (non-comm) | Pro/Premier (comm) | custom | ✅ | ❌ | ❌ | U | sub | $0–$U | free=NO, paid=YES | none | queue | high | med | ✅ | local/PD | V | suno.com/suno-plus |
| **Local FLUX/SD** | Image | txt/img→img | ✅ $0 | n/a | n/a | local | ComfyUI | ✅ | ❌ | $0 (HW) | €0 | model-depend | none | local | var | self | ✅ | fal/Recraft | K | github |
| **Piper** | Voice | TTS | ✅ $0 | n/a | n/a | local | ❌ | ✅ | ❌ | $0 | €0 | OSS yes | none | local | good | low | ✅ | Kokoro/Eleven | K | rhasspy/piper |
| **Kokoro-82M** | Voice | TTS | ✅ $0 | n/a | n/a | local | ❌ | ✅ | ❌ | $0 | €0 | perm yes | none | local | high | low | ✅ | Piper/Eleven | K | huggingface |
| **Whisper.cpp** | Audio | STT | ✅ $0 | n/a | n/a | local | ❌ | ✅ | ❌ | $0 | €0 | MIT yes | none | local | high | med | ✅ | API STT | K | github |
| **Three.js** | 3D runtime | viewer | ✅ $0 MIT | n/a | n/a | n/a | npm | ❌ | ❌ | $0 | €0 | MIT | n/a | n/a | high | n/a | ✅ | OGL/Babylon | V | threejs.org |
| **Spline** | 3D | design+viewer | ✅ embed free | teams paid | Ent | ✅ | ✅ | ❌ | U | sub | €0–$U | yes | none | n/a | good | n/a | ✅ | Three.js | V | spline.design |
| **Web3Forms** | Functional | form→email | 250/mo $0 | pro paid | n/a | ✅ | ❌ | ❌ | ❌ | $0 | €0 | yes | none | 250/mo | email | n/a | ✅ | Formspree/mailto | V | web3forms.com |
| **Formspree** | Functional | form→email | free tier | paid | Ent | ✅ | ❌ | ❌ | ❌ | $0+ | €0 | yes | none | free lim | email | n/a | ✅ | Web3Forms | V | formspree.io |
| **Supabase** | Functional | DB/Auth/CMS | 50k MAU $0 | Pro $25 | Team $599 | ✅ | ✅ | ✅ | ✅ | sub | €0–$25 | yes | none | free lim | SQL | n/a | ✅ | PocketBase | V | supabase.com/pricing |
| **Cal.com** | Functional | booking | OSS self-host $0 | cloud paid | Ent | ✅ | ✅ | ✅ | ✅ | $0+ | €0 | yes | none | self | n/a | n/a | ✅ | embed | V | cal.com |
| **OpenStreetMap** | Functional | maps | ✅ $0 no key | n/a | n/a | ✅ | Leaflet | ❌ | ❌ | $0 | €0 | ODbL | n/a | none | tiles | n/a | ✅ | MapLibre | V | openstreetmap.org |
| **Stripe** | Functional | payments | no monthly | per-tx 2.9%+$0.30 | custom | ✅ | ✅ | ❌ | ❌ | per tx | €0 build | yes | none | high | n/a | n/a | ✅ | PayPal | V | stripe.com/pricing |
| **Cloudflare R2** | Storage | object+CDN | 10GB $0 no egress | $0.015/GB-mo | Ent | ✅ | ✅ | ❌ | ❌ | $0+ | €0 | yes | n/a | gen | n/a | n/a | ✅ | S3/Bunny | V | cloudflare.com/r2 |
| **Plausible** | Analytics | privacy analytics | self-host $0 | cloud paid | n/a | ✅ | ❌ | ✅ | ❌ | $0+ | €0 | yes | none | n/a | n/a | n/a | ✅ | Umami | V | plausible.io |
| **FFmpeg/Sharp** | Media proc | transcode/optimise | ✅ $0 local | n/a | n/a | CLI | ❌ | ✅ | ❌ | $0 | €0 | GPL/Apache | n/a | local | high | n/a | ✅ | cloud proc | K | ffmpeg.org |

## Notes on ambiguous cells
- Higgsfield exact credit→generation math is **INFERRED** from search snippets; official
  pricing page is JS-rendered and returned no static numbers. Treat tiers as indicative.
- Meshy/Tripo/Suno/PlayHT/Cartesia/Murf/Firefly/Google Veo/Sora exact prices = **UNKNOWN**
  (official pages JS-rendered or blocked). Do not hardcode; fetch live at integration time.
- Recraft/ElevenLabs/Suno **FREE tiers are non-commercial** — VERIFIED. Never use free-tier
  output on a paying client site without licence confirmation.
