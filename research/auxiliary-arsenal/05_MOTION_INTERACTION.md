# 05 — MOTION & INTERACTION STACK

> All FREE at base. VERIFIED prior `bf_research` + this pass. Reuse, extend.

## Libraries (VERIFIED)
| Tool | Licence | Cost | Bundle | Mobile | Reduced-motion | React | Notes |
|---|---|---|---|---|---|---|---|
| **GSAP** | free (Webflow-owned; standard free licence) | $0 | ~50KB | ✅ | manual | ✅ | ScrollTrigger free; premium plugins free post-acquisition (I — verify) |
| **Lenis** | MIT | $0 | ~4KB | ✅ | ✅ | ✅ | smooth scroll |
| **Motion** (Framer Motion) | MIT | $0 | mod | ✅ | ✅ | ✅ | React motion |
| **Motion One** | MIT | $0 | tiny | ✅ | ✅ | ❌ | vanilla |
| **Rive** | runtime free | freemium | small | ✅ | ✅ | ✅ | interactive vectors |
| **Lottie** (lottie-web) | MIT | $0 | mod | ✅ | ✅ | ✅ | JSON animation |
| **Barba** | MIT | $0 | small | ✅ | ❌ | ❌ | page transitions (SPA) |
| **View Transitions API** | browser | $0 | 0 | ✅ | ✅ | n/a | native route transition |
| **Web Animations API / CSS** | browser | $0 | 0 | ✅ | ✅ | n/a | base |
| **OGL** | Unlicense | $0 | tiny | ✅ | manual | ✅ | WebGL light |
| **Three.js / R3F** | MIT | $0 | 178KB gz / 51KB gz | ✅ | manual | ✅ | 3D |

## Decision
- **Central motion system** = GSAP + Lenis + CSS + View Transitions (EXISTS:
  `lib/forge/motion.ts`). Expose as a capability, not 11 libraries.
- **Rive/Lottie** = optional microinteraction layer (ADOPT P2). 
- **Barba** = only for true SPA transitions; prefer View Transitions for static.
- **Locomotive Scroll = DO NOT USE** (deprecated, prior research). Use Lenis.

## Automation suitability
All are build-time/declarative → automatable by the Design Director emitting motion tokens.
No per-site cost. Reduced-motion is a hard gate (accessibility capability EXISTS).

## When to escalate
Motion never needs PREMIUM. Escalation is *content* (video/3D), not the motion engine.
