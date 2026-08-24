# 13 — LICENSE MATRIX

> Commercial-use, ownership, watermark, redistribution per important provider.
> V=VERIFIED (official ToS/pricing), U=UNKNOWN (could not confirm from official source).
> CRITICAL: free-tier generative output is almost never commercial — see flags.

| Provider | Commercial use | Ownership of output | Attribution | Watermark | Redistribution | Client websites | Generated-asset rights | Evidence |
|---|---|---|---|---|---|---|---|---|
| **Higgsfield** | paid=yes / free=U | paid=you / free=U | U | none paid | U | yes(paid) | U | V tiers; free comm U |
| **fal.ai** | yes (paid use) | you | none | none | yes | yes | you | V fal.ai/pricing |
| **Replicate** | yes (paid) | you | per model | none | yes | yes | you | V replicate.com/pricing |
| **ElevenLabs** | **free=NO**, paid=YES | free=ElevenLabs, paid=you | none | none | paid=yes | paid=yes | paid=you | V elevenlabs.io/pricing |
| **Meshy** | paid=yes | paid=you | U | none | yes | yes | you | V meshy.ai/pricing |
| **Tripo** | paid=yes | paid=you | U | none | yes | yes | you | O |
| **Runway** | paid=YES (free limited) | paid=you | none | **none on paid** | yes | yes | you | V runwayml.com/pricing |
| **Ideogram** | paid=yes | paid=you | U | none | yes | yes | you | V/I |
| **Recraft** | **free=NO** (owned by Recraft, public), paid=YES (full ownership) | free=Recraft, paid=you | none | none | paid=yes | paid=yes | paid=you | V recraft.ai/pricing |
| **Adobe Firefly** | YES (brand-safe, indemnified) | you | none | none | yes | yes | you | U price; V safe |
| **Suno** | **free=NO**, paid=YES (commercial rights) | free=Suno, paid=you | none | none | paid=yes | paid=yes | paid=you | V suno.com/suno-plus |
| **Local FLUX/SD** | model-dependent (check base licence) | you (if licence allows) | per model | none | per model | per model | you | K |
| **Piper/Kokoro** | OSS yes (Apache-2/permissive) | you | none | none | yes | yes | you | K |
| **Whisper.cpp** | MIT yes | you | none | none | yes | yes | you | K |
| **Three.js/Spline** | MIT / Spline yes | you (scene) | none | none | yes | yes | you | V/K |
| **Web3Forms/Formspree** | yes | you (data) | none | none | yes | yes | you | V |
| **Supabase** | yes | you | none | none | yes | yes | you | V |
| **Cal.com** | OSS yes | you | none | none | yes | yes | you | V |
| **OSM/Leaflet** | ODbL (attribution) | you (derivative) | **ODbL attribution** | n/a | yes | yes | you | V |
| **Stripe** | yes | you (tx) | none | none | yes | yes | you | V |
| **Cloudflare R2** | yes | you | none | n/a | yes | yes | you | V |
| **Plausible** | yes | you | none | n/a | yes | yes | you | V |
| **FFmpeg/Sharp** | GPL/Apache | you | n/a | n/a | yes | yes | you | K |

## RED FLAGS (verify before any client use)
1. **Recraft FREE** — images owned by Recraft, public, NOT commercial. VERIFIED.
2. **ElevenLabs FREE** — no commercial licence; Starter ($6) first grants it. VERIFIED.
3. VERIFIED: Runway paid = no watermark. Suno free = no commercial. 
4. **Local model licences vary** — FLUX [some non-commercial], SD1.5/SDXL generally
   permissive, Pony/derivatives vary. Check per model before commercial use.
5. **OSM/Leaflet** — ODbL requires attribution; include credit.

## SAFE COMMERCIAL PATH AT €0
Local models (Piper/Kokoro for voice, local FLUX/SD if licence permits) + OSS libraries
(Three.js, GSAP, Lenis) + free functional services (Web3Forms, OSM, Supabase, Cal.com,
Cloudflare, Plausible). All commercial-safe, no watermark, you own output.

## RULE
FREE-tier generative output (image/voice/music) is NEVER assumed commercial. Router only
uses it for internal/non-commercial or swaps to local/OSS where you own the output.
