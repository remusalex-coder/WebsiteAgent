# 05 — ASSET MATRIX

> Per-asset decision table. Every important asset has FREE / MEDIUM / PREMIUM / LOCAL,
> plus cost, licence, automation, reject conditions, and priority. P = Priority
> (1 = always-free base, 2 = medium escalation, 3 = premium surgical).

| Asset | Type | FREE | MEDIUM | PREMIUM | LOCAL | Input | Output | Cost | Licence | Automation | Perf | Mobile | A11y | Use cases | Reject if | Fallback | P |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Hero photo | AI/img | client/Unsplash | FLUX $0.04 | Firefly/Higgsfield Ultra | local SD | prompt/photo | JPG/PNG | €0–€0.04 | free=check | ✅ | fast | ✅ | alt text | hero, editorial | stock-like generic | Unsplash | 1 |
| Product photo | img | client | FLUX edit $0.025 | Recraft paid | local SD | product scan | PNG | €0–€0.03 | paid=comm | ✅ | fast | ✅ | alt | ecommerce | low-res fake | client | 1 |
| Icon set | OSS | Lucide/Heroicons | — | — | — | n/a | SVG | €0 | MIT | build | fast | ✅ | aria | UI | decorative-only | SVG | 1 |
| Illustration | proc/AI | SVG/CSS | Recraft paid | Firefly | local SD | prompt | SVG/PNG | €0–€0.05 | paid=comm | ✅ | fast | ✅ | aria | explainer | generic AI illo | SVG | 2 |
| Background removal | proc/AI | local rembg | fal $0.04 | Photoshop API | rembg(OSS) | image | PNG | €0–€0.04 | OSS/free | ✅ | fast | ✅ | — | product, portrait | unnecessary | keep bg | 1 |
| Hero video | video | procedural CSS | Higgsfield/Runway/fal | Higgsfield Ultra/Veo3 | local I2V | img/prompt | MP4 | €0–€0.40/s | paid=comm | ✅ | med | ✅ | reduced | hero, fashion | decorative no purpose | still motion | 2 |
| Product video | video | client footage | Higgsfield I2V | Higgsfield Ultra | local | product img | MP4 | €0–€0.20/s | paid=comm | ✅ | med | ✅ | reduced | automotive, retail | fake spin | img gallery | 2 |
| Looping BG video | video | CSS loop | fal Wan $0.05/s | Veo3 | CSS | prompt | MP4/WebM | €0–€0.05 | paid=comm | ✅ | med | ✅ | reduced | ambient | unnecessary | CSS | 2 |
| 3D product | 3D | client GLB | Meshy/Tripo | Meshy Studio | Three.js+proc | img/txt | GLB | €0–€U | paid=comm | ✅ | med | ✅ | reduced | ecommerce, real-estate | blob | img | 1/2 |
| 3D configurator | 3D | Three.js | Meshy | Spline | Three.js | GLB | interactive | €0 | MIT | ✅ | med | ✅ | keyboard | automotive, furniture | aimless | img | 2 |
| Voice-over | audio | Kokoro/Piper local | ElevenLabs $6 | ElevenLabs Pro $99 | Kokoro/Piper | text | MP3 | €0–$6+ | local=yes/free=NO | ✅ | fast | ✅ | transcript | narration, promo | no business need | SFX off | 2 |
| STT | audio | Whisper.cpp | ElevenLabs/OpenAI | — | Whisper.cpp | audio | text | €0 | MIT | ✅ | med | ✅ | — | voice search, captions | unnecessary | form | 3 |
| Music | audio | PD/Sunosfree | Suno Pro | Suno Premier | PD | prompt | MP3 | €0–$U | free=NO/paid=yes | ✅ | fast | ✅ | controls | brand film, bg | generic loop | SFX | 3 |
| SFX | audio | PD/Sox | ElevenLabs SFX | — | PD | prompt | WAV | €0 | OSS | ✅ | fast | ✅ | — | interaction, UI | excessive | none | 1 |
| Cursor | interaction | CSS+JS | GSAP | — | CSS+JS | n/a | CSS | €0 | free | build | fast | ⚠ touch | reduced-motion | interactive brands | on non-interactive | default | 1 |
| Loader | motion | SVG/CSS | Lottie | — | SVG/CSS | n/a | SVG | €0 | free | build | fast | ✅ | aria | page load | fake loading | instant | 1 |
| Smooth scroll | motion | Lenis | — | — | Lenis | n/a | JS | €0 | free | build | fast | ✅ | reduced | long pages | short pages | native | 1 |
| Page transition | motion | View Transitions | GSAP | — | CSS | n/a | CSS | €0 | free | build | fast | ✅ | reduced | route change | janky | none | 1 |
| Scroll story | motion | GSAP+Lenis | — | — | GSAP | n/a | JS | €0 | free | build | med | ✅ | reduced | brand, agency | no narrative | static | 2 |
| Configurator UI | functional | Three.js | — | Spline | Three.js | GLB | interactive | €0 | MIT | ✅ | med | ✅ | keyboard | product select | unnecessary | img | 2 |
| Search | functional | Fuse.js/Lunr | Supabase FTS | Algolia | Fuse.js | data | results | €0 | MIT | build | fast | ✅ | aria | directories, shop | tiny dataset | list | 1 |
| Filter/sort | functional | JS | Supabase | Algolia | JS | data | UI | €0 | free | build | fast | ✅ | aria | ecommerce, real-estate | 1 item | list | 1 |
| Booking | functional | Cal.com self | Cal.com cloud | Cal.com Ent | Cal.com | schedule | booking | €0 | OSS | ✅ | fast | ✅ | aria | services, clinics | unnecessary | form | 1 |
| Contact form | functional | Web3Forms free | Formspree | — | Supabase | form | email | €0 | yes | ✅ | fast | ✅ | labels | all | spam-open | mailto | 1 |
| Payments | functional | Stripe | — | Braintree | Stripe | cart | charge | €0 build | yes | ✅ | fast | ✅ | aria | ecommerce | no sales | invoice | 1 |
| Maps | functional | OSM+Leaflet | MapLibre | Google Maps | OSM | coords | map | €0 | ODbL | ✅ | fast | ✅ | aria | local business | unnecessary | static img | 1 |
| Auth/portal | functional | Supabase free | Supabase Pro | Ent | Supabase | creds | session | €0 | yes | ✅ | fast | ✅ | aria | members, clients | public site | none | 1 |
| CMS | functional | Decap/Payload | Sanity free | Contentful | Payload | content | site | €0 | OSS | ✅ | fast | ✅ | — | blogs, edits | static enough | md | 1 |
| Analytics | functional | Plausible self | Plausible cloud | — | Plausible | page | stats | €0 | yes | ✅ | fast | ✅ | DNT | all | privacy breach | none | 1 |
| Media optimise | proc | Sharp/FFmpeg | cloud | — | Sharp/FFmpeg | media | optimised | €0 | OSS | build | fast | ✅ | — | all | none | none | 1 |
| Storage/CDN | storage | R2 free | R2 paid | CF Ent | static | files | URL | €0 | yes | ✅ | fast | ✅ | — | all | none | other CDN | 1 |

## Reject column drivers
See `15_REJECT_LIST.md`. Any asset whose REJECT condition is true is blocked by the QA
layer regardless of budget.
