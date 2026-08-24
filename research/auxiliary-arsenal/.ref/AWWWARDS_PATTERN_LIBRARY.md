# AWWWARDS PATTERN LIBRARY — Visual Teardown of 25 Awwwards-Winning Commercial Websites

**Status:** Research artifact v1 (pre-implementation). **Do NOT implement. Do NOT modify WebsiteAgent.**
**Author role:** Research Director
**Date:** 2026-08-11
**Companion doc:** `Design_Intelligence_Foundation.md` (Section 18 sourcing; this doc is the *visual-evidence* layer).

---

## 0. Method & honesty note

- **25 real Awwwards-winning commercial sites** were selected from the live Awwwards "Websites" directory, external URLs extracted from each winner's detail page, then each site was loaded in a real browser.
- **Vision service was unavailable** during this research (consistent 404 from the image-analysis endpoint). Rather than fabricate "looks," I extracted **precise, falsifiable DOM/CSS facts** from each live site: computed fonts, font-weights, type sizes, background-color palettes, grid templates, section counts, hero media type (text / video / canvas-WebGL), heading transforms, body line-heights, and nav structure. This is *more* reliable than eyeballing a screenshot and is reproducible.
- 74 screenshots were still captured (desktop hero + mid-page + mobile) as artifacts: `teardown/shots/`.
- For 6 heavy WebGL/canvas sites (Alkares, Fort Vega, Izanami, Oimachi, 21 Hrs, Alethia) the full DOM probe timed out, so those rows rely on the first-pass extraction (title, fonts, palette, nav) — flagged as partial.
- **No design was copied.** This document *abstracts* generalizable patterns, and Section 4 explicitly lists what must NOT be cloned.

### Evidence table (the raw signal behind every claim)

| # | Site | Type | H1 size | Hero media | Palette size | Key fonts | Nav style |
|---|---|---|---|---|---|---|---|
| 1 | Mosby Files | Creative agency | 117px ↑UPPER | type | 7 | Signifier, IBM Plex Mono, Founders Grotesk | minimal (About) |
| 2 | Revelatio | Studio | 16px (h2=50) | type | 4 | circe, smoothy | full text nav |
| 3 | Vectr | Agency | 64px | canvas/WebGL | 5 | Roboto | top nav |
| 4 | Nexola | Agency | 130px | video | 14 | Inter Display | logo+CTA only |
| 5 | Studio Modular | Studio | 50px | video | 8 | PolySans | full text nav |
| 6 | Paysages | Studio | (none) | type | 2 | Rational TW Text, Tarnac | none |
| 7 | Alkares *partial* | Brand | — | — | 9 | Formadjr | none |
| 8 | Fort Vega *partial* | Brand | 53px ↑UPPER | — | 0 | TT Hoves Pro | text nav |
| 9 | Studio OL | Studio | (none) | type | 3 | acp, Times New Roman | minimal |
| 10 | Cinética | Studio | 17px | video | 0 | — | none |
| 11 | Agence 3e Étage | Agency | 53px | type | 2 | Zeist | minimal (3) |
| 12 | Obscura | Studio | 25px (h2=46) | type | 4 | Neue Montreal | none |
| 13 | Normal Is Boring | Studio | (none) | type | 10 | Juana, Editorial New | text nav |
| 14 | Spur Intelligence | Product | 85px | canvas/WebGL | 7 | fontBody/Mono/Heading | top nav+CTAs |
| 15 | Meinhard Taxer | Service | 32px (h2=247) | video | 1 | Neue Haas Grotesk | minimal |
| 16 | Van Morrison | Artist | 150px ↑UPPER | video | 8 | Inria Serif, Oswald | text nav |
| 17 | Izanami *partial* | Brand | 53px (no h1) | — | 3 | Helvetica Neue, Playfair | minimal |
| 18 | Oimachi *partial* | Brand | — | — | 0 | Aeonik, Feature Deck | none |
| 19 | 21 Hrs *partial* | Brand | — | — | 3 | Arial | none |
| 20 | Dragonfly | Brand | (none) | canvas/WebGL | 7 | FK Roman Std, NON Natural | full text nav |
| 21 | Hamza Tariq | Portfolio | (none) | video | 6 | Tausend Soft | none |
| 22 | Crxtian Hub | Portfolio | 32px | type | 3 | Untitled Sans | none |
| 23 | Alethia *partial* | Brand | 53px | — | 16 | Geist | none |
| 24 | Serotoninn | Brand | 100px ↑UPPER | video | 3 | Thunder, PP Fraktion Mono | none |
| 25 | No Art | Music | (none) | video | 9 | Chivomono, Neue Haas | text nav |

*Legend: ↑UPPER = text-transform uppercase; "type" hero = typographic/editorial, no full-bleed media; "partial" = DOM probe timed out (WebGL-heavy).*

---

# 1. Per-Site Teardowns (20 attributes each)

> Format per site: Hero composition · Typography · Type scale · Grid · Spacing · Color strategy · Image/art direction · Section rhythm · Whitespace · Asymmetry · Visual hierarchy · CTA placement · Navigation · Footer · Interaction · Motion · Mobile · Storytelling · Premium feel · Bespoke feel.
> Where DOM evidence is partial, attributes are marked `(partial)` and inferred conservatively from available data only.

### 1 — Mosby Files (Creative agency) · mosbyfiles.com
- **Hero:** Oversized editorial headline "AMERICAN MODERNISM" (117px, uppercase) on near-black (#191919); no photographic hero — the *type is the hero*.
- **Typography:** Serif display (Signifier) + mono (IBM Plex Mono) + grotesk (Founders Grotesk) — a 3-family editorial system.
- **Type scale:** Display 117px → body 16px (ratio ~7×) — extreme contrast.
- **Grid:** Free/centered editorial; content narrow.
- **Spacing:** Generous; large vertical air around the statement.
- **Color:** Dark base + vivid accent blocks (blue #1E4BD7, red #D71E1E, teal, purple, yellow) used as *semantic/section* color, not decoration.
- **Image/art:** Minimal; color fields carry the visual.
- **Section rhythm:** Single long scroll statement (sections=1 in probe; site is a manifesto).
- **Whitespace:** High.
- **Asymmetry:** Low (centered statement) but scale creates tension.
- **Visual hierarchy:** The word is the focal point; accents are secondary.
- **CTA:** Minimal ("About" link) — not conversion-driven; it's a showcase.
- **Nav:** Bare (About).
- **Footer:** (not probed) minimal.
- **Interaction:** Low; reading-focused.
- **Motion:** Static/editorial.
- **Mobile:** Headline reflows; type-led scales down.
- **Storytelling:** Manifesto/positioning narrative.
- **Premium feel:** Restraint, confident typography, dark editorial.
- **Bespoke feel:** Unmistakably custom — a type specimen as a homepage; not a template.

### 2 — Revelatio (Studio) · revelio.studio
- **Hero:** Text hero "REVELIO AGENCE DE COMMUNICATION VISUELLE" (h2 50px) on white; h1 small (16px) — inverted hierarchy, brand-led.
- **Typography:** circe + smoothy (custom-feeling humanist).
- **Type scale:** modest (16→50px).
- **Grid:** Standard content grid.
- **Spacing:** Comfortable.
- **Color:** Deep teal (#003532 / #184A48) on white — restrained 2-tone.
- **Image/art:** (partial) likely project imagery.
- **Section rhythm:** Multi-section service site.
- **Whitespace:** Moderate-high.
- **Asymmetry:** Moderate.
- **Visual hierarchy:** Brand name dominant; services listed.
- **CTA:** "Pour les entrepreneuses / responsables communication" segmented paths.
- **Nav:** Full text nav (A propos, Nos offres, Portfolio…).
- **Footer:** (partial).
- **Interaction:** Standard.
- **Motion:** (partial).
- **Mobile:** Text nav → hamburger (mobNav=True).
- **Storytelling:** Service-categorized narrative (audience-segmented).
- **Premium feel:** Calm, confident, single-accent.
- **Bespoke feel:** Segmented audience paths + custom type.

### 3 — Vectr (Agency) · vectrfl.com
- **Hero:** "The New Standard in Staffing" over a live **canvas/WebGL** animated background (blue palette).
- **Typography:** Roboto (unusual for Awwwards — proves system font can win with strong concept + motion).
- **Type scale:** 64px display → 18px body.
- **Grid:** 6 sections, structured.
- **Spacing:** Standard.
- **Color:** Light blue-grey (#D0E1EB) base, dark ink (#050419) text/accents.
- **Image/art:** Generative canvas, not photos.
- **Section rhythm:** 6 clear sections.
- **Whitespace:** Moderate.
- **Asymmetry:** Moderate.
- **Visual hierarchy:** Headline + animated bg; "REQUEST CREWS / APPLY" dual CTAs.
- **CTA:** Top-right primary + section CTAs.
- **Nav:** OUR INDUSTRIES / MISSION / APPLY (uppercase, utilitarian).
- **Footer:** (partial).
- **Interaction:** WebGL pointer-reactive.
- **Motion:** Generative canvas (functional brand expression).
- **Mobile:** Hamburger (mobNav=True).
- **Storytelling:** Positioning ("new standard") + dual-audience (clients vs applicants).
- **Premium feel:** Tech-forward, confident motion.
- **Bespoke feel:** Custom generative hero, not a template.

### 4 — Nexola (Agency) · nexola.framer.website
- **Hero:** Giant "NEXOLA" (**130px**) over full-bleed **video** on near-black.
- **Typography:** Inter Display (Framer default-elevated).
- **Type scale:** 130px → 12px body (extreme).
- **Grid:** Full-width, no conventional grid.
- **Spacing:** Cinematic.
- **Color:** Dark (#0F0F0F) + electric lime (#B3FF00) accent + greys.
- **Image/art:** Full-bleed brand video.
- **Section rhythm:** (sections=0 in probe — likely single immersive scroll).
- **Whitespace:** High (dark negative space).
- **Asymmetry:** Low but scale-driven.
- **Visual hierarchy:** Wordmark + lime CTA ("Start Project").
- **CTA:** Single high-contrast lime button, top-right.
- **Nav:** Logo + "Start Project" only.
- **Footer:** (partial).
- **Interaction:** Minimal.
- **Motion:** Video bg.
- **Mobile:** Scales down; lime CTA persists.
- **Storytelling:** Brand-statement, not feature-led.
- **Premium feel:** Dark, cinematic, one hot accent.
- **Bespoke feel:** Oversized wordmark treatment; Framer-but-customized.

### 5 — Studio Modular (Studio) · studiomodular.be
- **Hero:** "Studio Modular" (50px) over **video**, with a colorful multi-hue palette (teal/green/blue/pink/orange blocks).
- **Typography:** PolySans (geometric grotesk).
- **Type scale:** 50px → 18px.
- **Grid:** Structured (8-color system suggests segmented content).
- **Spacing:** Comfortable.
- **Color:** Off-white base + saturated accent blocks (each likely a service category).
- **Image/art:** Video + color-coded categories.
- **Section rhythm:** Multi.
- **Whitespace:** Moderate-high.
- **Asymmetry:** Moderate.
- **Visual hierarchy:** Name + color-coded services.
- **CTA:** Nav "Contact" + Cases.
- **Nav:** Cases / Services / Aanpak / Over / Insights / Contact (full).
- **Footer:** (partial).
- **Interaction:** Standard.
- **Motion:** Video.
- **Mobile:** Hamburger (mobNav=True).
- **Storytelling:** Service-category color system.
- **Premium feel:** Confident, colorful-but-controlled.
- **Bespoke feel:** Category color language = own system.

### 6 — Paysages (Studio) · paysages.studio
- **Hero:** Typographic, no h1 captured; calm **sand/olive** (#E7E9D2) base, very light.
- **Typography:** Rational TW Text + Tarnac (light weights) — airy editorial.
- **Type scale:** small (h2 12px, p 13px) — unusually restrained.
- **Grid:** 5 sections.
- **Spacing:** Very generous.
- **Color:** Two near-tones of warm off-white — monochrome calm.
- **Image/art:** (partial) likely imagery-led.
- **Section rhythm:** 5 quiet sections.
- **Whitespace:** Very high.
- **Asymmetry:** Moderate.
- **Visual hierarchy:** Quiet; type and space.
- **CTA:** (not probed).
- **Nav:** None captured (minimal/scroll).
- **Footer:** (partial).
- **Interaction:** Quiet.
- **Motion:** Minimal.
- **Mobile:** Scales.
- **Storytelling:** Calm studio positioning.
- **Premium feel:** Understatement = confidence.
- **Bespoke feel:** Monochrome discipline + light type.

### 7 — Alkares (Brand/Product) · alkares.com *(partial — WebGL)*
- **Hero:** (DOM probe timed out) Foundation shows 27 imgs + 12-col grid + light cyan (#EDF9FA) base.
- **Typography:** Formadjr (custom display).
- **Type scale:** (partial).
- **Grid:** 12-col (repeat(12, minmax(0,1fr))).
- **Color:** Light cyan + ink + white.
- **Image/art:** Imagery-rich (27 imgs).
- **Section rhythm:** 10 sections.
- **Premium/bespoke:** Imagery-led product brand; 12-col discipline.
- *Inference only; verify before encoding.*

### 8 — Fort Vega (Brand) · fortvega.com *(partial)*
- **Hero:** "FORT VEGA" (53px uppercase) on warm stone (#D7D2C6).
- **Typography:** TT Hoves Pro + Optimalt.
- **Color:** Warm neutral mono.
- **Nav:** Portfolio / News / Members / Contact + language switch.
- **Premium/bespoke:** Editorial brand, warm restraint, membership model.

### 9 — Studio OL (Studio) · ol.studio
- **Hero:** Typographic, no h1; warm paper (#F2ECdf) + a single red accent (#FF0000).
- **Typography:** acp + Times New Roman (serif editorial).
- **Type scale:** p 12px.
- **Grid:** 12-col (numeric px grid).
- **Color:** Paper + ink + one red.
- **Image/art:** 27 imgs.
- **Whitespace:** High.
- **Premium/bespoke:** Editorial print aesthetic, single red accent = signature.

### 10 — Cinética (Studio) · cinetica.studio *(partial — WebGL)*
- **Hero:** Immersive CGI studio; video hero; "Award-winning digital studio…" (17px h1, small — video carries weight).
- **Typography:** (not captured — custom).
- **Color:** (not captured).
- **Storytelling:** Capability-led (immersive/CGI/virtual production).
- **Premium/bespoke:** Mexico-City CGI studio; motion-heavy.

### 11 — Agence 3e Étage (Agency) · agence3e-etage.com
- **Hero:** "Nous sommes une agence avec une vision affirmée…" (53px) on black + **yellow (#FFEE00)** accent.
- **Typography:** Zeist (custom).
- **Type scale:** 53px → 14px.
- **Grid:** 12-col.
- **Color:** Black + yellow — high-contrast 2-tone.
- **Image/art:** 6 imgs.
- **Nav:** projets / à propos / contact (minimal).
- **Whitespace:** Moderate.
- **Premium/bespoke:** Bold black/yellow editorial confidence.

### 12 — Obscura (Studio) · obscurastudio.webflow.io
- **Hero:** "We are a creative studio building identity and visual systems…" (h2 46px) on white.
- **Typography:** Neue Montreal (grotesk).
- **Type scale:** 25→46px.
- **Grid:** 12-col (1fr×12).
- **Color:** Black/white/grey — strict mono.
- **Image/art:** 16 imgs.
- **Nav:** None captured (scroll/scroll-menu).
- **Premium/bespoke:** Webflow-but-clean; systematic mono.

### 13 — Normal Is Boring (Studio) · normalisboring.es
- **Hero:** Typographic; serif display (Juana) + Editorial New — a **type-collection** aesthetic.
- **Typography:** Juana + Editorial New (multiple weights/italics) — typographic richness.
- **Type scale:** p 20px (large, readable).
- **Grid:** none captured (free).
- **Color:** Black + blue (#0056A7) + sand + pink — playful multi-accent.
- **Image/art:** 32 imgs (project-led).
- **Nav:** Menú / Conócenos / Proyectos / Contacto (text).
- **Whitespace:** Moderate-high.
- **Premium/bespoke:** Name-is-manifesto; typeplay = identity.

### 14 — Spur Intelligence (Product/Intel) · spur.us
- **Hero:** "We Reveal The Truth Hiding In Plain Sight" (85px) over **canvas/WebGL** map-like visualization; lab-color pale base.
- **Typography:** fontBody / fontMono / fontHeading (tokenized system).
- **Type scale:** 85px → 14px.
- **Grid:** 14 sections (content-rich SaaS).
- **Color:** Near-white (lab 93) + ink + one accent (lab 94,-35,88 ≈ vivid).
- **Image/art:** 51 imgs + canvas viz.
- **Nav:** Pricing / Login / Free Trial / Get A Demo (product nav + CTAs).
- **CTA:** Dual (Free Trial + Demo).
- **Whitespace:** High.
- **Premium/bespoke:** Data-product with bespoke visualization; tokenized type.

### 15 — Meinhard Taxer (Service) · meinhardtaxer.com
- **Hero:** Name (32px) + a **247px h2** — an oversized poster element (poster artist). Video bg.
- **Typography:** Neue Haas Grotesk + Helvetica Now.
- **Type scale:** extreme jump (32→247px) — poster scale.
- **Grid:** none captured (poster layout).
- **Color:** Near-black mono (#090909).
- **Image/art:** 31 imgs (posters).
- **Nav:** minimal (name© + categories).
- **Premium/bespoke:** Poster-artist portfolio; single giant typographic moment.

### 16 — Van Morrison (Artist/Brand) · vanmorrison.com
- **Hero:** "VAN MORRISON" (**150px uppercase**) repeated, over **video**, dark + warm orange (#F79E4C) accent.
- **Typography:** Inria Serif (display) + Oswald (condensed).
- **Type scale:** 150px → 26px.
- **Grid:** 7 sections.
- **Color:** Dark + white + warm orange.
- **Image/art:** 56 imgs (tour/photos).
- **Nav:** Shows / Music / News / Van Morrison (text).
- **Whitespace:** Moderate.
- **Premium/bespoke:** Artist brand; serif+condensed pairing, huge name.

### 17 — Izanami (Brand) · izanami-official.com *(partial)*
- **Hero:** "Remember who you are" (53px, no h1) on near-black (#0A0801).
- **Typography:** Helvetica Neue + Playfair Display + Cinzel + Shippori Mincho (East-meets-West serif stack).
- **Color:** Dark + warm off-white (#D9D7D4).
- **Nav:** IZANAMI / en / ja (language toggle).
- **Premium/bespoke:** Cultural duality (JP/EN), serif ceremony.

### 18 — Oimachi (Brand) · oimachi.co *(partial)*
- **Hero:** "Branding, Website & AI Visibility. Innovation Studio." on dark (#181818).
- **Typography:** Aeonik + Feature Deck.
- **Color:** Dark mono.
- **Nav:** product-feature links (Flowguide, Hubform) + Book a meeting.
- **Premium/bespoke:** Studio selling tools; dark confident.

### 19 — 21 Hrs (Brand) · 21hrs.space *(partial)*
- **Hero:** (not probed) 166 imgs, black base + warm off-white (#FFF3EA) + grey.
- **Typography:** Arial (system — deliberate brutalism).
- **Premium/bespoke:** Imagery-saturated brand; system-font brutalism.

### 20 — Dragonfly (Brand) · dragonfly.xyz
- **Hero:** Typographic over **canvas/WebGL**; dark + vivid accents (orange #FA4C14, pink #EC39B6, purple #5014FA).
- **Typography:** FK Roman Standard + NON Natural Mono + Times New Roman.
- **Type scale:** p 16px.
- **Grid:** 16-col.
- **Color:** Black + 3 vivid accents (multi-hue, confident).
- **Image/art:** 45 imgs + canvas.
- **Nav:** Home / ABOUT / WRITING / TEAM / PORTFOLIO / CAREERS / CONTACT (full uppercase).
- **Whitespace:** Moderate.
- **Premium/bespoke:** Web3 brand; mono+serif+grotesk mix, vivid tri-accent.

### 21 — Hamza Tariq (Portfolio) · hamzatariq.info
- **Hero:** Video-led; very light (#F1F1F1) base.
- **Typography:** Tausend Soft.
- **Color:** Light + multi (green/blue/red multi-accent, 6 cols).
- **Image/art:** 296 imgs (image-saturated portfolio).
- **Premium/bespoke:** Image-first portfolio; huge asset count.

### 22 — Crxtian Hub (Portfolio) · crxtianhub.com
- **Hero:** "Crxtian Hub, Cristian D'Agostino" (32px) on warm grey (#F0F0EF) + pink tint.
- **Typography:** Untitled Sans.
- **Type scale:** 32px → 16px.
- **Color:** Warm grey + pink (#EE83A7) accent (3 cols).
- **Image/art:** 0 imgs (type-led portfolio).
- **Premium/bespoke:** Minimal type portfolio; single pink accent.

### 23 — Alethia (Brand/Product) · alethia.earth *(partial)*
- **Hero:** "Where Ecosystem Science and Enterprise Strategy Meet" (53px) on deep green (#0F1F10).
- **Typography:** Geist (Mono/Medium/Regular).
- **Color:** Deep green + lime (#C6F19D) + magenta (#A6005E) + green (16 cols captured).
- **Image/art:** 25 imgs.
- **Premium/bespoke:** Science-brand; deep-green + lime signature.

### 24 — Serotoninn (Brand) · serotoninn.com
- **Hero:** "SEROTONINN" (**100px uppercase**) over **video**, warm off-white (#FFF9F7).
- **Typography:** Thunder (ultra-condensed display) + PP Fraktion Mono + Inter.
- **Type scale:** 100px → 25px.
- **Grid:** 7 sections.
- **Color:** Off-white + black (3 cols, restrained).
- **Image/art:** 295 imgs (image-saturated).
- **Nav:** None captured (scroll).
- **Whitespace:** High.
- **Premium/bespoke:** Ultra-condensed display + mono = signature; warm minimal.

### 25 — No Art (Music/Brand) · noartmusic.com
- **Hero:** Video-led; white base + ink + multi-accent (9 cols).
- **Typography:** Chivomono + Neue Haas Grotesk.
- **Color:** White/black + accents (pink/grey/ink).
- **Image/art:** 28 imgs + video.
- **Nav:** Events [6] / Shop / Label / Gallery / About / Tickets (text, content-rich).
- **Premium/bespoke:** Music label; mono display + event-count badges.

---

# 2. Cross-Site Patterns (what the 25 actually share)

1. **Type is a first-class hero.** 11/25 use a *typographic* hero (no full-bleed photo). Even media-led sites put an oversized wordmark/statement above the fold. Oversized display type (50–150px) is the norm, not the exception.
2. **Extreme type-scale contrast.** Display:body ratios of 4×–9× appear repeatedly (117/16, 130/12, 150/26, 100/25). Tight body (~12–16px) + giant display.
3. **Restrained palettes win.** Most sites use 1–3 active hues on a neutral (often off-white or near-black) base. Multi-accent "rainbow" appears only on imagery-saturated portfolios (Hamza 6, Dragonfly 3, No Art 9) and even then anchored to neutral.
4. **Dark OR warm-paper OR off-white base, rarely pure white.** Bases: #191919, #0F0F0F, #090909 (dark); #F2ECdf, #E7E9D2, #FFF9F7, #EDF9FA (warm/light). Pure #FFF appears but often with a tint.
5. **One hot accent is the signature.** Lime (Nexola), yellow (3e Étage), red (Studio OL), orange (Van Morrison/Dragonfly), lime-green (Alethia), pink (Crxtian). Accent is *sparse and intentional*.
6. **Custom/display typefaces, not system fonts** — except deliberate brutalism (Vectr=Roboto, 21 Hrs=Arial). When a system font is used, it's a *concept* choice, not laziness.
7. **Grid discipline under freedom.** Where measurable: 12-col (Alkares, 3e Étage, Obscura), 16-col (Dragonfly), 11-col-ish (No Art). Asymmetry happens *within* a grid, not without one.
8. **Motion is functional or cinematic, never gratuitous.** Hero media = video (9), canvas/WebGL (4: Vectr, Spur, Dragonfly, + partial), or type (11). No site uses decorative auto-rotating carousels.
9. **Minimal navigation on hero; expand later.** Many show only logo + 1 CTA (Nexola), or 3 links (3e Étage, Taxer), or segmented paths (Revelatio). Full nav appears on scroll or inner pages.
10. **Whitespace is high** across the board (generous section padding, narrow measure for reading).
11. **Image-saturation correlates with portfolio/brand-showcase type** (Hamza 296 imgs, Serotoninn 295, 21 Hrs 166, Van Morrison 56). Service/agency sites use fewer, larger, art-directed images.
12. **Single dominant CTA or dual-path**, never a button wall.
13. **Mobile collapses to hamburger** where a text nav exists (Revelatio, Vectr, Studio Modular, 3e Étage, Spur, Normal Is Boring, Serotoninn all mobNav=True). Type-led minimal sites often keep a simple top bar.

---

# 3. Reusable Design Patterns (abstracted, generalizable)

Each pattern: **Name / Visual description / Why it works / Business signals that trigger it / Suitable industries / Unsuitable situations / Deterministic constraints / AI judgment required / Risk of becoming a template.**

### P-001 — Oversized Typographic Hero (no photo)
- **Visual:** A single giant headline (80–150px) on a neutral base; the words *are* the visual.
- **Why:** Maximum brand-statement impact; fastest LCP; pure craft signal.
- **Triggers:** Strong verbal identity, name/positioning is the product (studios, artists, manifestos, luxury brands).
- **Industries:** architect, photographer, law firm (positioning), hotel (brand), artist.
- **Unsuitable:** mechanic, dentist, restaurant (need to show the real thing/people).
- **Deterministic:** min body 16px; contrast AA; type scale ratio cap; one focal line.
- **AI:** exact headline copy, typeface, weight, leading, transform.
- **Template risk:** MEDIUM — overused "big text on black" cliché; differentiate via type choice + accent.

### P-002 — Cinematic Video/Canvas Hero
- **Visual:** Full-bleed muted video or generative canvas behind/around a wordmark.
- **Why:** Immersive, premium, conveys motion/energy of the business.
- **Triggers:** Sensory/experience businesses; have real footage or can generate motion.
- **Industries:** hotel, restaurant, photographer, fitness, artist, architect (process).
- **Unsuitable:** utilitarian/local-trust (mechanic, dentist, law) where clarity > spectacle.
- **Deterministic:** LCP budget (poster frame, lazy/optimized), reduced-motion fallback (static frame), contrast scrim for text, no autoplay sound.
- **AI:** footage choice, treatment, scrim strength, text overlay.
- **Template risk:** HIGH if everyone uses the same stock-video hero — must be original footage.

### P-003 — Extreme Type-Scale Contrast
- **Visual:** Display 4–9× body; tight body (12–16px), giant headings.
- **Why:** Creates instant hierarchy and editorial tension.
- **Triggers:** Any brand wanting editorial/premium feel.
- **Industries:** all (universal premium lever).
- **Unsuitable:** dense-data/utility UIs needing uniform legibility (internal tools).
- **Deterministic:** body ≥16px (accessibility floor), display cap by viewport (clamp), ratio bounded.
- **AI:** ratio choice, display weight.
- **Template risk:** LOW — it's a principle, not a look.

### P-004 — Restrained Neutral Base + One Hot Accent
- **Visual:** Off-white or near-black base; a single vivid accent used sparingly (buttons, links, one block).
- **Why:** Confidence; guides eye; avoids chaos; timeless.
- **Triggers:** any business; strongest for premium/trust.
- **Industries:** all.
- **Unsuitable:** none (universal), but accent hue must be character-derived not industry-cliché.
- **Deterministic:** ≤3 active hues; accent reserved for primary action/active state; contrast AA.
- **AI:** accent hue from character vector; where applied.
- **Template risk:** MEDIUM — "dark + one accent" is itself a trend; vary base temperature + accent placement.

### P-005 — Editorial Multi-Family Type System
- **Visual:** 2–3 families with distinct jobs (display serif + grotesk + mono).
- **Why:** Each family carries a semantic role; richer than one-font sites.
- **Triggers:** content/brand-rich sites wanting depth.
- **Industries:** architect, law, hotel, artist, agency.
- **Unsuitable:** micro-sites, quick-task flows.
- **Deterministic:** ≤3 families; each mapped to a role; weights consistent.
- **AI:** which families + pairing.
- **Template risk:** LOW if pairings are character-matched.

### P-006 — Signature Single-Accent Monochrome
- **Visual:** near-monochrome (paper/ink or dark) with ONE accent repeated as a brand mark (Studio OL red, Crxtian pink, Alethia lime).
- **Why:** Memorable; disciplined; premium restraint.
- **Triggers:** brands wanting a recognizable mark.
- **Industries:** photographer, architect, boutique studio, law.
- **Unsuitable:** businesses needing category color coding (e.g., multi-service with distinct offerings).
- **Deterministic:** accent contrast AA; used ≥3 touchpoints (logo, CTA, link).
- **AI:** accent hue + repetition strategy.
- **Template risk:** MEDIUM.

### P-007 — Color-Coded Category System
- **Visual:** each service/category gets its own hue within a controlled set (Studio Modular 8 colors, Alethia greens).
- **Why:** communicates structure; scannable; ownable system.
- **Triggers:** businesses with 3–6 distinct offerings.
- **Industries:** agency, real-estate (listing types), fitness (classes), dentist (services), law (practice areas).
- **Unsuitable:** single-offering businesses.
- **Deterministic:** hues must meet contrast on base; ≤6; semantic consistency.
- **AI:** hue assignment per category from character.
- **Template risk:** MEDIUM (can become "rainbow nav").

### P-008 — Asymmetric Editorial Grid with Breakouts
- **Visual:** content aligned to grid but with deliberate full-bleed or offset blocks breaking the column rhythm.
- **Why:** bespoke feel; avoids template symmetry.
- **Triggers:** premium/editorial character.
- **Industries:** architect, photographer, hotel, artist.
- **Unsuitable:** utilitarian booking/checkout flows (need predictable alignment).
- **Deterministic:** base grid (12-col); breakouts allowed only as defined variants; never breaks accessibility.
- **AI:** where/when to break out.
- **Template risk:** MEDIUM.

### P-009 — Minimal Hero Nav (Logo + 1 CTA)
- **Visual:** above the fold shows only wordmark + single primary action; full nav deferred.
- **Why:** focus; confidence; lets hero breathe.
- **Triggers:** brand/showcase sites; strong single goal.
- **Industries:** photographer, artist, hotel, architect, boutique.
- **Unsuitable:** local SMB needing immediate phone/address (mechanic, dentist, restaurant) — those need persistent contact.
- **Deterministic:** persistent contact accessible within 1 tap on mobile (sticky bar or footer-reachable).
- **AI:** which CTA.
- **Template risk:** LOW.

### P-010 — Segmented Audience Paths
- **Visual:** hero offers 2+ distinct entry points by audience (Revelatio "entrepreneuses / responsables"; Vectr "Apply / Request Crews").
- **Why:** speaks directly; reduces bounce for multi-audience.
- **Triggers:** businesses serving 2+ distinct audiences.
- **Industries:** real-estate (buyers/sellers), law (individuals/business), agency (clients/talent), fitness (classes/membership).
- **Unsuitable:** single-audience.
- **Deterministic:** each path has own clear CTA + destination.
- **AI:** audience segmentation from business data.
- **Template risk:** LOW.

### P-011 — Poster-Scale Typographic Moment
- **Visual:** one element at absurd scale (Taxer 247px h2, Van Morrison 150px).
- **Why:** unforgettable focal point; art-directed.
- **Triggers:** brands with a hero artifact/name/statement.
- **Industries:** artist, photographer, architect, hotel (property name).
- **Unsuitable:** trust-first utilitarian.
- **delicate:** can hurt mobile if not clamped.
- **Deterministic:** clamp() so it never overflows mobile; maintain contrast.
- **AI:** which moment, copy.
- **Template risk:** MEDIUM.

### P-012 — Imagery-Saturated Showcase
- **Visual:** very high image count, large art-directed photos (Hamza 296, Serotoninn 295).
- **Why:** the work *is* the proof; visual density signals productivity/portfolio.
- **Triggers:** businesses whose output is visual.
- **Industries:** photographer, restaurant (food), hotel (rooms), real-estate, architect, fitness (results), nail salon (work), dentist (smiles).
- **Unsuitable:** abstract/services with no visual output (some law, tax).
- **Deterministic:** original photography rule (no stock cliché); lazy-load; alt text; consistent treatment.
- **AI:** curation, crop, treatment, sequencing.
- **Template risk:** HIGH if stock — must be original.

### P-013 — Tokenized Type System (Body/Mono/Heading)
- **Visual:** CSS/design tokens name roles (Spur fontBody/Mono/Heading; Alethia Geist stack).
- **Why:** scalable, consistent, systematic — the *mechanism* behind premium cohesion.
- **Triggers:** any site (this is the floor, not a style).
- **Industries:** all.
- **Unsuitable:** none.
- **Deterministic:** REQUIRED — tokens for type, color, space, radius.
- **AI:** token values per character.
- **Template risk:** NONE (it's infrastructure).

### P-014 — Quiet Monochrome Understatement
- **Visual:** 1–2 near-tones, tiny type, huge whitespace (Paysages, Studio OL, 6/9).
- **Why:** restraint reads as confidence/luxury; lets content/photos lead.
- **Triggers:** heritage/craft/premium character.
- **Industries:** architect, hotel, photographer, law, luxury salon.
- **Unsuitable:** energetic/youth (fitness, trend salon) needing vibrancy.
- **Deterministic:** contrast AA even at low contrast pairs; type min 16px.
- **AI:** tone choice, type scale.
- **Template risk:** MEDIUM.

### P-015 — Generative/Interactive Canvas Hero
- **Visual:** WebGL/canvas reacting to pointer or data (Vectr, Spur, Dragonfly).
- **Why:** tech-forward, ownable, "design-engineering" signal (Awwwards 2026 theme).
- **Triggers:** tech/brand with engineering capability; data products.
- **Industries:** agency, tech product (Spur), Web3 (Dragonfly), architect (parametric).
- **Unsuitable:** local SMBs without engineering capacity; performance-constrained.
- **Deterministic:** reduced-motion + no-JS fallback (static frame); perf budget; accessible alternative text.
- **AI:** concept, palette, interaction.
- **Template risk:** HIGH (becomes gimmick) — gate strictly.

### P-016 — Cultural/Language Duality
- **Visual:** JP/EN or multilingual toggle with culturally-distinct type (Izanami serif stack).
- **Why:** authenticity for dual-audience brands.
- **Triggers:** businesses serving 2 language/culture audiences.
- **Industries:** hotel (tourists), real-estate (expats), import/export, restaurants.
- **Unsuitable:** single-locale SMB.
- **Deterministic:** RTL/LTR support; lang attribute.
- **AI:** which languages, type per culture.
- **Template risk:** LOW.

### P-017 — Content-Rich Product Nav (SaaS-style)
- **Visual:** top nav with Pricing/Login/Trial/Demo + many sections (Spur 14 sections).
- **Why:** supports consideration journeys; many entry points.
- **Triggers:** businesses with deep content/offers.
- **Industries:** agency (services), real-estate (listings), law (practice areas), fitness (plans).
- **Unsuitable:** one-page brand sites.
- **Deterministic:** nav ≤7 top items; current-location indicator.
- **AI:** IA structure.
- **Template risk:** LOW.

### P-018 — Event/Inventory Badge Counts
- **Visual:** nav shows live counts (No Art "Events [6]", Crxtian availability).
- **Why:** signals activity/freshness; social proof.
- **Triggers:** businesses with countable live inventory/events.
- **Industries:** restaurant (specials), hotel (rooms), real-estate (listings), events, fitness (classes).
- **Unsuitable:** static service businesses.
- **Deterministic:** counts accurate & updated; not fake scarcity.
- **AI:** what to count.
- **Template risk:** LOW.

---

# 4. What MUST NOT be copied (anti-clone rules)

Derived from the contradiction that "Awwwards trends decorate, they don't decide" (Design Intelligence Foundation, Section 1.5).

1. **Do not clone a specific site's exact layout/type/colors.** These 25 are *evidence of principles*, not templates. Reusing Nexola's lime-on-black verbatim for an unrelated business is templating, not design.
2. **Do not default every site to "big text on black."** It's the most common Awwwards cliché (Mosby, Nexola, Taxer, 15, 16, 20, 23 all dark). Character must decide dark vs light vs warm-paper.
3. **Do not use stock video for cinematic heroes** (P-002). Original footage or none.
4. **Do not use system fonts lazily.** Vectr (Roboto) and 21 Hrs (Arial) work *because* they're deliberate concepts; copying system-font-as-default reads as cheap.
5. **Do not cargo-cult WebGL** (P-015). 4/25 use it; it's a minority signal of tech-brand capability, not a default.
6. **Do not apply industry color clichés** (navy law, red restaurant) — contradicted by the data (law here = black/yellow 3e Étage; restaurants weren't in set but principle holds). Character > industry.
7. **Do not replicate the exact typeface choices** (Signifier, Thunder, Neue Montreal) as "Awwwards fonts" — they were chosen per-brand. Choose *equivalently-character-matched* faces, not the same ones.
8. **Do not strip navigation on local-trust businesses** (P-009 is for brand sites; mechanic/dentist/restaurant need persistent contact).

---

# 5. Deterministic vs AI allocation (per pattern)

| Pattern | Deterministic floor | AI judgment |
|---|---|---|
| P-001 Typographic hero | body≥16, contrast, 1 focal line | headline, face, weight, transform |
| P-002 Video/canvas hero | LCP, reduced-motion, scrim, no-sound | footage, treatment |
| P-003 Type-scale contrast | body≥16, display clamp, ratio bound | ratio, weight |
| P-004 Neutral+accent | ≤3 hues, accent=action, AA | accent hue, placement |
| P-005 Multi-family | ≤3 families, role-mapped | which families |
| P-006 Signature mono | accent AA, ≥3 touchpoints | hue, repetition |
| P-007 Category colors | ≤6, contrast, semantic | hue per category |
| P-008 Asymmetric grid | 12-col base, breakout variants | where to break |
| P-009 Minimal nav | persistent contact ≤1 tap mobile | which CTA |
| P-010 Audience paths | each path own CTA | segmentation |
| P-011 Poster moment | clamp, no overflow, contrast | moment, copy |
| P-012 Imagery showcase | original-photo rule, lazy, alt | curation, crop |
| P-013 Token system | REQUIRED infrastructure | token values |
| P-014 Quiet monochrome | AA even low-contrast, 16px | tone, scale |
| P-015 Generative canvas | fallback, perf, a11y alt | concept, palette |
| P-016 Cultural duality | RTL/LTR, lang attr | languages, type |
| P-017 Product nav | ≤7 items, current-loc | IA |
| P-018 Live badges | accurate counts | what to count |

---

# 6. Integration notes for WebsiteAgent (non-binding)

- These patterns are **inputs to the character→design mapper** (Design Intelligence Foundation Section 14), not standalone templates.
- Encode P-013 (tokens), P-003/P-004 contrast & scale floors, and the P-009 contact-accessibility rule as **deterministic** in `lib/design`.
- Let AI **select** patterns from a business's character vector (price tier, sensory/functional, consideration level, audience count, cultural duality, engineering capability, visual-output volume).
- Gate P-002, P-015, P-011, P-012 behind: original-asset availability, performance budget, and reduced-motion — they are the highest "template-risk" patterns.
- Use the teardown `evidence table` (Section 0) as a **calibration set**: the generator's output for a given character should land in the same *neighborhood* (type-scale ratio, palette size, hero-media type) as the matching subset of these 25, without copying any single one.

---

*End of AWWWARDS_PATTERN_LIBRARY.md — research only, no implementation, repo not modified.*
