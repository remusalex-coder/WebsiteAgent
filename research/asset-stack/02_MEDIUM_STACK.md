# 02 — MEDIUM STACK (€1–€5 justified)

> MEDIUM = paid tiers that are cheap per-use or low monthly, justified when business
> evidence shows the asset earns it. Concentrated spend on 1–3 high-value assets.

## When to escalate FREE → MEDIUM
- Client has no usable photos AND open photography doesn't fit the brand → paid image gen.
- A hero video measurably increases conversion (e.g. restaurant/fashion/automotive) →
  pay-per-use video.
- Voice-over needed for accessibility/promotion AND commercial rights required → paid TTS.
- Product needs a real 3D model the client can't supply → paid 3D gen.

---

## 1. IMAGE (MEDIUM)
| Provider | Price | Notes | Evidence |
|----------|-------|-------|----------|
| Replicate `flux-1.1-pro` | $0.04 / image | high quality, API | VERIFIED replicate.com/pricing |
| Replicate `flux-dev` | $0.025 / image | good quality | VERIFIED |
| Replicate `flux-schnell` | $0.003 / image | fast, dev/personal | VERIFIED |
| Ideogram v3 | $0.09 / image (quality); API $0.03–0.09 | text-in-image strong | VERIFIED replicate + search |
| Recraft paid (Basic/Pro) | subscription; images owned + commercial | VERIFIED recraft.ai/pricing |
| fal.ai Flux Kontext Pro | $0.04 / 1MP | editing/in-context | VERIFIED fal.ai/pricing |
| fal.ai Nanobanana | $0.0398 / 1MP | VERIFIED |
| Higgsfield image | part of credit plan | VERIFIED |

**MEDIUM image pick:** fal.ai or Replicate FLUX for volume; Recraft paid for brand-owned
commercial assets; Ideogram when text-in-image matters.

## 2. VIDEO (MEDIUM)
| Provider | Price | Notes | Evidence |
|----------|-------|-------|----------|
| **Higgsfield Starter** | ~$15/mo, ~200 credits (INFERRED exact math) | image+video+audio+3D, MCP+CLI | VERIFIED tiers (search) |
| **Runway Standard** | $12/mo, 625 credits = ~52s Gen-4.5 / 78 images, **no watermark** | VERIFIED runwayml.com/pricing |
| fal.ai **Wan 2.5** | $0.05 / second | ~20s per $1 | VERIFIED fal.ai/pricing |
| fal.ai **Kling 2.5 Turbo Pro** | $0.07 / second | ~14s per $1 | VERIFIED |
| Higgsfield Plus | ~$39/mo (annual) / $49 (INFERRED) | more credits | VERIFIED tiers |

**MEDIUM video pick:** pay-per-use fal.ai (Wan/Kling) for 1–2 hero clips at €1–€5; or
Runway Standard if ongoing. Higgsfield is the integration-priority (one API + MCP).

## 3. 3D (MEDIUM)
| Provider | Price | Notes | Evidence |
|----------|-------|-------|----------|
| Meshy Pro | subscription (price UNKNOWN from official source) | text/image→GLB, API, MCP | VERIFIED meshy.ai/pricing (tiers not numeric) |
| Tripo paid | per-credit (UNKNOWN exact) | text/image→GLB | OBSERVED tripo3d.ai API |
| Spline | free embed + paid teams | design tool + viewer | VERIFIED spline.design |

**MEDIUM 3D pick:** Meshy/Tripo API for one hero product model; otherwise Three.js +
client model stays free.

## 4. AUDIO / VOICE (MEDIUM)
| Provider | Price | Notes | Evidence |
|----------|-------|-------|----------|
| **ElevenLabs Starter** | $6/mo — **Commercial License + Instant Voice Cloning** | VERIFIED elevenlabs.io/pricing |
| ElevenLabs Creator | $22/mo (often $11 first mo) | + Pro Voice Cloning | VERIFIED |
| Cartesia | per-character (UNKNOWN) | low-latency | UNKNOWN price |
| PlayHT | per-character (UNKNOWN) | UNKNOWN price |
| Suno Pro | paid (commercial rights) | music | VERIFIED suno.com/suno-plus (price UNKNOWN exact) |

**MEDIUM voice pick:** ElevenLabs Starter ($6) is the commercial-safe voice floor — but
that alone exceeds the €1–€5 band, so for ≤€5 prefer **local Kokoro + a few fal images**.
For €5–€20, ElevenLabs Starter/Creator is the standard.

## 5. STORAGE / DELIVERY (MEDIUM)
R2 paid $0.015/GB-mo; Bunny CDN ~$1/mo; Supabase Pro $25/mo (if DB/auth scale needed).
For most sites the free tier suffices — MEDIUM only when traffic/storage exceeds free.

## 6. FUNCTIONAL (MEDIUM)
Stripe (payments): no monthly fee, ~2.9% + €0.30 per successful charge (EU cards; VERIFIED
typical Stripe EU pricing — exact cross-border varies). Costs only on sales, not build.

---

## MEDIUM BOTTOM LINE
€1–€5 buys a few high-impact generative assets (typically 5–30 FLUX images, or 1–2 short
video clips, or one 3D model). Everything else rides the FREE stack. Escalate per asset,
never blanket-upgrade.
