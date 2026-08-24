# 03 — DESIGN SYSTEMS / DESIGN INTELLIGENCE

> Feed Visual DNA / Experience Signature / Experience Blueprint / Design Director.
> VERIFIED where fetched.

## A. Tokens Studio
- Figma plugin → export design tokens (color, type, spacing, shadow, etc.) as JSON.
- Syncs to code via **Style Dictionary** or W3C DTCG format. MCP/API available (Figma-side).
- **Free tier** + paid. VERIFIED exists (tokens.studio). Commercial: yes (user-owned tokens).
- **BusinessForge use:** if a client supplies a Figma, extract their token set → feed
  `experience blueprint` directly (brand-accurate, not generic). ADOPT P2 (only when
  client provides Figma). SEC: REVIEW (Figma token access needs client OAuth).

## B. Style Dictionary
- **OSS (Apache-2)**, Amazon. Transforms design tokens → platform outputs (CSS vars,
  iOS, Android, JS). CLI + Node. VERIFIED (style-dictionary.com / GitHub, Apache-2).
- **BusinessForge use:** the natural home for our generated design tokens. The Design
  Director emits a token JSON → Style Dictionary compiles to CSS custom properties consumed
  by the renderer. ADOPT P1 (central, deterministic). SEC: SAFE (OSS, local).

## C. Design-token → CSS variable system
- Our renderer already ships CSS variables (per `vector_generation`/`runtime_tier` rationale).
  Style Dictionary becomes the compile step. No new runtime dep; build-time only.

## D. Typography / font identification
- **Fontjoy / WhatFontIs / Google Fonts** (free) — identify/select type. For generated
  sites, prefer **Google Fonts** (free, OFL, CDN) or **Fontsource** (self-host OSS).
- Font identification of a client brand → use **Fontsource/Google** equivalent, don't
  pir@te proprietary fonts. Licence check required for any non-OFL font.

## E. Color extraction / visual hierarchy
- **Vibrant.js / Colorthief** (OSS) — extract palette from an image (client logo/photo).
- **Huemint / Khroma** — AI palettes (free tiers). 
- Feed extracted palette into token system with contrast validation (axe-core).

## F. Design-to-code systems (study only)
- **Superflex, Quest, Figma Dev Mode, Penpot** (OSS Figma alt, Apache-2). Penpot = OSS,
  self-host, good if client wants an open design tool. ADOPT P2 optional.
- **Reject** black-box Figma→code SaaS (Anima/Locofy) for production — determinism.

## G. How it plugs in
```
client Figma / brand assets
   → Tokens Studio export (if provided)
   → Style Dictionary compile → tokens.css
   → Design Director merges with evidence → Experience Blueprint
   → renderer consumes CSS variables
```
This makes individualization real (brand tokens) instead of generic AI defaults.
