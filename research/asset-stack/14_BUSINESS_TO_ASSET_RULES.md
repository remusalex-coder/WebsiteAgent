# 14 — BUSINESS EVIDENCE → ASSET RULES

> Concrete mapping: industry → required assets → which FREE/MEDIUM/PREMIUM path.
> 15+ industries. The factory uses these as planner rules. Evidence: KNOWN patterns.

## Rule format
`INDUSTRY → [assets] → [interaction/motion] → [functional] → [escalation trigger]`

1. **RESTAURANT**
   → food imagery (client photos > FLUX edit), menu interactions, booking (Cal.com),
     ingredient/product hover, optional short food video.
   → GSAP menu reveal, image hover.
   → contact (Web3Forms), map (OSM), reviews (JSON-LD).
   → ESCALATE: video only if brand is premium/delivery-app competing → Higgsfield food film.

2. **AUTOMOTIVE / SERVICE**
   → service selector, booking (test-drive/service), diagnostic visuals, 3D wheel/config
     (Three.js free), technical interaction, product video.
   → configurator (Three.js), magnetic CTAs.
   → Stripe for deposits, OSM for location.
   → ESCALATE: cinematic hero (Higgsfield/Runway) if dealership brand tier high.

3. **REAL ESTATE**
   → property gallery, OSM map, SVG floor plan, comparison table, optional 3D tour.
   → gallery lightbox, scroll reveals, before/after (renovations).
   → search/filter (Fuse.js), booking (viewings via Cal.com).
   → ESCALATE: 3D tour (Meshy) if high-value listings.

4. **FASHION / APPAREL**
   → editorial imagery (FLUX/Recraft), lookbook, product interactions, filtering, video.
   → hover preview, kinetic type, drag gallery.
   → Stripe shop, Fuse.js filter/sort.
   → ESCALATE: campaign film (Higgsfield) + ElevenLabs voice if brand tier.

5. **PROFESSIONAL SERVICES (law, consult, finance)**
   → trust motion (GSAP), testimonials, team portraits (client/FLUX), explainer.
   → scroll storytelling, subtle reveals.
   → Web3Forms, Supabase client portal, Plausible.
   → ESCALATE: ElevenLabs intro narration if video used.

6. **HEALTH / CLINIC / DENTAL**
   → service pages, booking (Cal.com), map (OSM), reviews.
   → clean motion, before/after (treatment).
   → Web3Forms, Stripe for plans.
   → ESCALATE: rarely — keep €0.

7. **HOTEL / HOSPITALITY / RESORT**
   → large photography, ambient hero video, experiences, booking.
   → immersive scroll, gallery.
   → Cal.com/booking engine, OSM, Stripe.
   → ESCALATE: cinematic hero (Higgsfield/Runway) standard for luxury tier.

8. **TECH / SAAS**
   → product video, 3D product viewer, scroll storytelling, diagrams (SVG).
   → Lenis + GSAP micro-interactions (Linear-style), View Transitions.
   → Supabase auth/dashboards, Stripe billing.
   → ESCALATE: 3D viewer (Three.js free) — usually no paid needed.

9. **ECOMMERCE / RETAIL**
   → product photography (client/FLUX), video, 3D for key products.
   → configurator, filter/sort, cart animation.
   → Stripe, Fuse.js search, Supabase CMS.
   → ESCALATE: 3D (Meshy) for hero products, video for campaigns.

10. **EDUCATION / COURSES**
    → instructor video, course grid, auth, dashboards.
    → progress motion, gallery.
    → Supabase auth, Stripe for enrolment, search.
    → ESCALATE: course promo video (Higgsfield) if marketing budget.

11. **AGENCY / STUDIO / PORTFOLIO**
    → bold motion, custom cursor, case studies, video.
    → CRAV/cuberto mechanisms (cursor, magnetic, drag) — €0.
    → Web3Forms, CMS.
    → ESCALATE: showreel video (Higgsfield/Runway) expected for tier.

12. **ARCHITECTURE / DESIGN FIRM**
    → project gallery, renders, video, parametric motion (SVG/Canvas not heavy WebGL).
    → scroll storytelling, clip-path reveals.
    → CMS, contact.
    → ESCALATE: 3D walkthrough (Three.js) if client supplies models.

13. **LOCAL BUSINESS (gym, salon, trades)**
    → photos (client), services, booking, map, reviews.
    → simple motion, before/after.
    → Cal.com, OSM, Web3Forms, JSON-LD reviews.
    → ESCALATE: none — €0 is the product.

14. **EVENTS / VENUE**
    → gallery, map, booking, schedule.
    → timeline motion, gallery.
    → Cal.com, Stripe tickets, OSM.

15. **NON-PROFIT / CAUSE**
    → story motion, donation (Stripe), impact stats.
    → emotional scroll storytelling.
    → Web3Forms, Stripe, Plausible.
    → ESCALATE: none — keep €0, maximise impact.

16. **FOOD & BEVERAGE / CPG**
    → product shots (FLUX/client), brand video, packaging 3D (Meshy).
    → kinetic type, hover.
    → Stripe shop, filter.
    → ESCALATE: brand film + 3D packaging (Meshy).

17. **TRAVEL / TOURISM**
    → destination photography, video, map, booking.
    → immersive scroll, gallery.
    → OSM, Cal.com, Stripe.
    → ESCALATE: destination hero film (Higgsfield).

18. **FINANCE / FINTECH**
    → dashboards (Supabase), auth, calculators, explainer.
    → trust motion, diagrams (SVG).
    → Supabase, Stripe, Plausible.
    → ESCALATE: brand film if consumer brand.

19. **ART / PHOTOGRAPHY PORTFOLIO**
    → high-res gallery, lightbox, minimal motion.
    → drag gallery, hover.
    → CMS, contact.
    → ESCALATE: none — client assets shine.

20. **MANUFACTURING / INDUSTRIAL**
    → product 3D (Three.js/Meshy), specs, video.
    → configurator, technical interaction.
    → Stripe B2B, CMS.
    → ESCALATE: 3D + product video for complex products.

## Escalation principle
Each industry has a €0 baseline (functional + craft motion + client/OSS assets). The
ESCALATE line lists the single asset most likely to justify MEDIUM/PREMIUM spend, and only
when business evidence (brand tier, conversion need, client request) supports it.
