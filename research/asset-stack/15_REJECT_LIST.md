# 15 — REJECT LIST

> Assets/decisions the autonomous factory must NEVER auto-generate or must gate.
> The QA/visual-critic layer enforces these. Each item has a reject condition.

## HARD REJECTS (never generate automatically)
1. **Decorative AI video with no business purpose** — reject if video has no CTA, no
   product, no narrative link to the business. Condition: `asset.type==video AND
   business_evidence==none`.
2. **Generic 3D blobs / aimless WebGL** — reject if 3D has no interaction, no product,
   no data. Condition: `3D AND no_interaction AND no_business_object`.
3. **Fake loading screens** — never use timed fake preloaders. Only asset-aware real
   loaders. Condition: `loader.timed==true`.
4. **Generic AI stock-like photography** — reject FLUX/Recraft output that looks like
   stock when client has real photos or open photography fits. Condition: `image.quality
   ==generic AND client_asset_available`.
5. **Unnecessary cursor effects** — reject custom cursor on non-interactive/utility pages
   (checkout, legal, forms). Condition: `cursor AND page.type==utility`.
6. **Animations without business purpose** — reject motion that doesn't direct attention
   or communicate state. Condition: `motion.purpose==decorative_only`.
7. **Expensive assets with negligible UX value** — reject PREMIUM spend where FREE
   achieves equivalent UX. Condition: `cost>=MEDIUM AND free_equivalent_ux>=0.9`.
8. **Free-tier generative output used commercially** — reject Recraft/ElevenLabs/Suno
   FREE output on a paying client site. Condition: `source==free_tier AND
   commercial==required`. (Swap to local/OSS or paid.)

## CONDITIONAL REJECTS (gate, don't blanket-block)
9. **Heavy WebGL on mobile** — gate 3D/WebGL behind device capability + reduced-motion;
   fallback to static. Condition: `webgl AND mobile AND perf_budget_exceeded`.
10. **Autoplay video with sound** — reject autoplay-with-audio; mute + controls only.
    Condition: `video.autoplay AND audio==on`.
11. **Motion violating reduced-motion** — any motion must respect `prefers-reduced-motion`.
    Condition: `motion AND reduced_motion==ignore`.
12. **Non-accessible interaction** — reject interactions without keyboard/aria fallback.
    Condition: `interaction AND keyboard==none`.
13. **Unsourced map without attribution** — reject OSM/Leaflet without ODbL credit.
    Condition: `map==OSM AND attribution==missing`.

## REJECT MECHANISM (how it plugs in)
- Planner emits asset requests → router assigns tier → generator produces → QA/visual
  critic validates against REJECT LIST + asset matrix reject column.
- Any REJECT condition → asset marked `rejected`, fallback chain triggered, event logged.
- PREMIUM escalation requires human approval (see 16_IMPLEMENTATION_MAP) — never auto.

## Why this list exists
The task's core warning: "technically-correct-but-generic = FAIL." The reject list is the
enforcement of "premium with cost minimal, escalate only on evidence." It prevents the
factory from spending money (or compute) on assets that don't earn it, and from shipping
generic AI slop that damages brand.
