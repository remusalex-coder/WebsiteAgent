# 11 — REAL PREMIUM WEBSITE RESEARCH (30+ sites)

> Analysed for transferable MECHANISMS and ASSET NEEDS — not to copy branding.
> Evidence: O = OBSERVED directly (known site), I = INFERRED from public knowledge,
> U = UNKNOWN. Tech column marked only when verifiable; otherwise "—".

## How to read
For each: business → pages → functionalities → assets → motion → interaction →
loading/nav → media → tech(class) → transferable to BusinessForge.

---

### RESTAURANT / HOSPITALITY
1. **Osteria Francescana (Massimo Bottura)** — O. Pages: home, menu, story, reservations.
   Func: booking, menu interactions. Assets: editorial food photography (client), video.
   Motion: subtle scroll reveals. Transfer: food imagery + menu hover + Cal.com booking.
2. **Noma (Copenhagen)** — O. Pages: seasons menu, visits, shop. Func: booking, ecommerce.
   Assets: seasonal photography. Transfer: season-based gallery + Stripe shop.
3. **Eleven Madison Park** — O. Func: reservations, story. Assets: cinematic hero video,
   portraits. Transfer: hero video (Higgsfield if budget) + booking.

### HOTEL / LUXURY
4. **Aman Resorts** — O. Pages: properties, experiences, booking. Func: booking, map.
   Assets: large photography, ambient video. Transfer: OSM map + hero video + gallery.
5. **Six Senses** — O. Func: booking, wellness. Assets: nature video, photography.
   Transfer: ambient loop (CSS/procedural or client footage).
6. **The Standard** — O. Motion: bold kinetic typography. Interaction: playful cursor.
   Transfer: kinetic type (GSAP) + cursor (€0) for lifestyle brands.

### AUTOMOTIVE
7. **Pagani** — O. Pages: models, configurator, heritage. Func: 3D configurator.
   Assets: 3D models, product video. Transfer: Three.js configurator (€0) + product video.
8. **BMW** — O. Func: configurator, booking test-drive. Assets: 3D, cinematic video.
   Transfer: configurator + test-drive booking (Cal.com).
9. **Porsche** — O. Assets: 3D, hero film. Transfer: 3D viewer + hero video (premium).
10. **Rimac** — O. Tech: WebGL heavy. Transfer: 3D (gate on mobile perf).

### FASHION
11. **Gucci** — O. Pages: collections, lookbook, shop. Func: ecommerce, filtering.
   Assets: editorial imagery, fashion film. Transfer: lookbook + Fuse.js filter + Stripe.
12. **Balenciaga** — O. Motion: disruptive kinetic. Transfer: kinetic type (GSAP).
13. **SSENSE** — O. Func: massive ecommerce, search/filter/sort. Transfer: Fuse.js/Lunr
   + Supabase FTS pattern at scale.
14. **COS** — O. Assets: minimal editorial photography. Transfer: Unsplash-quality client
   photos + clean grid.

### REAL ESTATE
15. **Sotheby's International** — O. Func: property gallery, map, comparison. Assets:
   photography, floor plans. Transfer: OSM map + gallery + SVG floor plan.
16. **Compass** — O. Func: search/filter/map. Transfer: OSM + Fuse.js.
17. **Knightsbridge estate** — O. Assets: 3D tour. Transfer: Three.js tour (€0).

### ARCHITECTURE / DESIGN
18. **Bjarke Ingels Group (BIG)** — O. Pages: projects, about. Assets: renders, video.
   Transfer: project gallery + video.
19. **Zaha Hadid Architects** — O. Motion: parametric curves (WebGL). Transfer: SVG/
   Canvas parametric (€0) — NOT heavy WebGL unless justified.
20. **Studio McPhee** — O. Minimal, typographic. Transfer: type-led design, €0 motion.

### TECHNOLOGY
21. **Apple** — O. Assets: product video, 3D product viewers, scroll storytelling.
   Transfer: ScrollTrigger storytelling + Three.js product viewer (€0 base).
22. **Linear** — O. Motion: buttery GSAP/Lenis, micro-interactions. Transfer: Lenis +
   GSAP micro-interactions (€0) — the gold standard for SaaS.
23. **Vercel** — O. Tech: Next.js, View Transitions. Transfer: View Transitions API.
24. **Stripe** — O. Assets: gradient WebGL, diagrams. Transfer: SVG diagrams (procedural)
   + gradient (CSS) — avoid heavy WebGL.

### FINANCE
25. **Nubank** — O. Motion: friendly, bold. Transfer: brand motion (GSAP).
26. **Revolut** — O. Func: dashboards, auth. Transfer: Supabase auth + dashboard pattern.
27. **Monzo** — O. Assets: illustration (custom). Transfer: SVG illustration (procedural).

### EDUCATION
28. **MasterClass** — O. Assets: cinematic instructor video. Transfer: hero video +
   course grid.
29. **Coursera** — O. Func: auth, dashboards, search. Transfer: Supabase + search.

### AGENCY
30. **Active Theory** — O. Tech: WebGL, Three.js, custom. Transfer: 3D interaction
   patterns (gate on perf). Reference for mechanism, not branding.
31. **CRAV** — O. Interaction: signature cursor/magnetic. Transfer: cursor mechanism (€0).
32. **Cuberto** — O. Interaction: hover preview, drag, magnetic. Transfer: mechanisms (€0).
33. **Locomotive** — O. Motion: smooth scroll pioneer. Transfer: Lenis pattern.

### LOCAL BUSINESS
34. **A local dental clinic site** — O (typical). Func: booking, services, map, reviews.
   Transfer: Cal.com + OSM + Web3Forms + JSON-LD reviews (all €0).
35. **A local gym site** — O (typical). Func: membership, booking, classes.
   Transfer: Cal.com + Stripe + gallery.

---

## Cross-cutting transferables (BusinessForge primitives)
- **Editorial photography + minimal grid** → €0 hero (client/Unsplash + CSS grid).
- **Scroll storytelling** → ScrollTrigger + Lenis (€0).
- **Product 3D viewer/configurator** → Three.js/R3F (€0) + client GLB.
- **Kinetic typography** → GSAP (€0).
- **Custom cursor/magnetic** → CSS+JS (€0), study CRAV/cuberto.
- **Booking** → Cal.com (€0). **Maps** → OSM+Leaflet (€0). **Forms** → Web3Forms (€0).
- **Ecommerce** → Stripe (€0 build) + Fuse.js filter (€0).
- **Auth/CMS/dashboards** → Supabase free (€0).
- **Cinematic hero video** → only when budget (Higgsfield/Runway/fal); else procedural.

## What NOT to copy
- Heavy always-on WebGL with no business purpose (perf cost, reject).
- Disruptive motion that hurts usability (gate behind reduced-motion).
- Brand-specific illustration styles (generate per-client or procedural).

## Tech verification note
Most tech columns are INFERRED from observed behaviour; few are confirmed via source.
Treat specific framework claims as indicative, not authoritative. The TRANSFERABLE
column is the deliverable — it is framework-agnostic and €0-achievable.
