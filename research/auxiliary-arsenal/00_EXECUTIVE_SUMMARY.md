# 00 — EXECUTIVE SUMMARY

> Companion to `MASTER_AUXILIARY_ARSENAL.md`. Read this for the decision; read the
> master + per-category files for evidence. Research-only — no code/registry/.env touched.

## What we set out to do
Discover the entire external ecosystem BusinessForge could exploit to make its website
factory more capable — across research, visual archaeology, design, motion, image/video/
audio/3D, functional integrations, SEO/a11y/perf/security, MCP, agent skills, and
open-source repos — then decide what to actually adopt.

## What we found
1. **The factory already implements far more than expected.** 38 capabilities in
   `lib/capability/registry.ts`, 8 agent stages, a working forge (critic/battle/blueprint/
   signature/motion/functionalModules/browser/repair), QA gates (a11y/perf/security/
   visual-regression), and an MCP+skill hosting layer (`lib/platform/{mcp,skills}`).
   The job is **EXTEND**, not rebuild. Prior `bf_research/` already holds VERIFIED price/
   licence facts for image/3D/audio/video/functional — we reused them.
2. **FREE-first is overwhelmingly achievable.** Almost every premium capability has a
   free/self-host/OSS counterpart. The default factory stack is $0-capable.
3. **A small set of high-leverage external specialists** (Firecrawl/Tavily/Exa for
   research, Higgsfield for media, Playwright for QA, Style Dictionary for tokens,
   Supabase/Stripe/Cal.com/OSM for function, Cloudflare for delivery, Semgrep/axe/
   Lighthouse for QA) delivers 90% of the gain.
4. **MCP is the right integration shape** for the autonomous loop: Higgsfield, Algolia,
   Cloudinary, Axe, Firecrawl, Exa, Playwright/Puppeteer, GitHub, Postgres, Google-Maps
   all expose MCP. The repo already hosts MCP servers.
5. **Security is tractable** — Semgrep (free SAST/SCA/Secrets) + the existing
   `output_security` gate + `npm audit` + credential vaulting covers the real risks.

## The recommended stack (BUSINESSFORGE AUXILIARY STACK V1)
- **CORE (adopt now, P0):** Firecrawl/Tavily/Exa, Playwright, Style Dictionary, GSAP/
  Lenis/Rive/Lottie, Three.js/R3F/OGL, Unsplash/Pexels/Openverse, Gemini/OpenAI/FLUX image
  gen, Higgsfield video, Kokoro/Piper voice, Web3Forms, OSM+Leaflet, Cal.com self-host,
  Supabase, Stripe, Fuse.js/Lunr, Cloudflare R2/CDN, FFmpeg/Sharp, Lighthouse, axe-core,
  Semgrep, OpenRouter free.
- **OPTIONAL (P1–P2):** Meilisearch Cloud, Algolia, Cloudinary, Resend, Clerk, Payload/
  Strapi/Sanity, Twilio, Meshy/Tripo (if 3D gate re-opens), ElevenLabs (if voice gate
  re-opens), Runway/Veo/fal.
- **PREMIUM (escalation, human-approved):** Higgsfield Ultra, Runway Max, Veo 3.1, Adobe
  Firefly, ElevenLabs Pro, Meshy Studio, Algolia/Cloudinary Enterprise.
- **LOCAL FALLBACK:** FLUX/SD, Kokoro/Piper, Whisper.cpp, Blender, FFmpeg/Sharp, Meilisearch/
  Postgres, Playwright, Semgrep/axe-core.

## Highest-priority integrations (do these first)
1. **Business web-research specialist** (Firecrawl + Tavily + Exa) → feeds `evidence_research`.
2. **Visual archaeology study** (screenshot-to-code architecture, Playwright screenshot)
   → informs `experienceStrategy` without copying.
3. **Design-token pipeline** (Style Dictionary + Tokens Studio) → feeds `experience blueprint`.
4. **Provider bindings** for Higgsfield (MCP+CLI+REST) and the OPTIONAL SaaS → `19` registry.
5. **Security scan gate** (Semgrep + existing output_security) on every generated artifact.

## Explicit non-integrations
Midjourney (no API), Locomotive Scroll (deprecated), generic "AI site builder" SaaS
(defeats determinism), decorative-only video/3D generators, unsafe filesystem MCP without
sandbox, paid tools where a free/OSS equivalent already covers the need.

## Bottom line
BusinessForge can become a substantially more capable autonomous factory by **wiring ~25
external specialists** (mostly free/OSS/MCP) onto its existing deterministic core — not by
adding 200 dependencies. Escalation to paid media/function is gated on business evidence
and (for PREMIUM) human approval, preserving the FREE-first, anti-generic, cost-controlled
mandate.
