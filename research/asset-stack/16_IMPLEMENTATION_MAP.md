# 16 — IMPLEMENTATION MAP (no code written)

> Describes exactly how the asset stack integrates later. Maps to the existing
> BusinessForge architecture (lib/ai/providers adapter pattern; lib/capability registry).
> NOT modifying code/registry/.env now — this is the integration spec.

## A. PER-CAPABILITY INTEGRATION CONTRACT

For every asset capability, the factory later needs:
1. **Registry entry** — capability id (e.g. `image.generate`, `video.i2v`, `voice.tts`,
   `threed.gen`, `form.contact`, `map.display`, `booking.create`).
2. **Provider adapter** — thin wrapper per vendor implementing a common interface
   (`AssetProvider.generate(req) → AssetResult`), mirroring `lib/ai/providers/*` contract
   (no vendor SDK imported outside the adapter).
3. **Capability binding** — maps capability → ordered provider list
   [primary, secondary, freeFallback, localFallback, premiumEscalation].
4. **Planner rule** — when the planner decides this asset is needed (from business
   evidence + industry rules in 14_BUSINESS_TO_ASSET_RULES).
5. **Quota** — per-provider monthly/$ cap; router refuses escalation beyond quota.
6. **Cost tracking** — every generation logs vendor, units, $ cost → site cost ledger.
7. **Asset generation** — async (poll/webhook) for cloud; sync for local/procedural.
8. **Storage** — output → R2 (free 10GB) with hash + dedupe; CDN delivery.
9. **Validation** — format/size/dimension checks + visual critic (QA layer).
10. **QA** — against REJECT LIST (15) + asset-matrix reject column.
11. **Fallback** — on failure/quota, next provider in binding; local last.
12. **Human approval** — PREMIUM escalation + any client-facing commercial generative
    output requires approval gate.

## B. BUILD ORDER (what to implement when)

### Phase 1 — NOW (free, no credentials)
- Procedural/motion/interaction: GSAP, Lenis, CSS, View Transitions, Three.js/R3F, matter.js.
- Functional FREE: Web3Forms, OSM+Leaflet, Supabase free client, Cal.com embed, Plausible,
  Fuse.js/Lunr, i18next.
- Media processing at build: FFmpeg, Sharp, ImageMagick, WebCodecs.
- Storage/delivery: Cloudflare free + R2 free.
- These need NO external credentials and deliver the €0 premium-feeling base.

### Phase 2 — CREDENTIALS REQUIRED (user supplies keys)
- Higgsfield adapter (API key) — priority (one API for image/video/audio/3D + MCP).
- fal.ai adapter (API key) — pay-per-use image/video.
- Replicate adapter (API key) — FLUX/image.
- ElevenLabs adapter (API key) — voice (commercial on paid).
- Meshy/Tripo adapter (API key) — 3D.
- Stripe adapter (API key) — payments.
- Supabase project (anon key) — auth/CMS if client needs portal.
- R2 bucket (account id + keys) — if >10GB or needs write.

### Phase 3 — PAID ACCOUNT (only when justified)
- Any MEDIUM/PREMIUM subscription (Higgsfield Starter/Ultra, Runway, ElevenLabs Pro,
  Meshy Studio, Firefly). Triggered by planner rule + quota + human approval.

### Phase 4 — LOCAL HARDWARE
- Local FLUX/SD (ComfyUI) server — zero per-call image.
- Piper/Kokoro TTS server — zero per-call voice.
- Whisper.cpp — STT.
- Blender headless — 3D render/procedural.

### Phase 5 — HUMAN APPROVAL GATES
- PREMIUM escalation (any spend above MEDIUM band).
- Client-facing commercial use of any generative output (licence confirmation).
- Any asset that fails visual critic after fallback exhaustion.

## C. ROUTER PSEUDO-FLOW (FREE-FIRST)
```
asset_request(business, capability)
  if business has asset → use it
  elif procedural possible → generate (CSS/JS/SVG)  # €0
  elif open_source/local model → generate            # €0
  elif free_api(capability) available → call         # €0 (verify licence)
  elif medium_justified(evidence) → call paid MEDIUM # €1–€5
  elif premium_justified(evidence) → request HUMAN approval → call PREMIUM
  else → reject (see 15)
```
Each `call` wrapped in try/catch → fallback chain → cost ledger entry.

## D. ALIGNMENT WITH EXISTING ARCHITECTURE
- Reuse `lib/ai/providers` adapter pattern for media vendors (same "no SDK outside
  adapter" rule). Add `lib/asset/providers/*` mirroring it.
- Reuse `lib/capability/registry.ts` shape for asset capabilities (do NOT modify existing
  registry — extend with new capability ids only at integration time).
- Cost ledger hooks into existing quota/cost infra if present; otherwise new lightweight
  ledger.

## E. AUTONOMY GUARDRAILS
- Factory runs fully autonomous at €0 (Phase 1) with zero credentials.
- Credentials unlock MEDIUM/PREMIUM on demand.
- Nothing spends money without planner evidence + (for PREMIUM) human approval.
- This satisfies the task's "autonomous factory, free-first, escalate on evidence."
