# 10 — FUNCTIONAL INTEGRATIONS

> Real website functionality. Build-time (FREE/OSS) vs client-credential (HUMAN).
> VERIFIED this pass + `bf_research/11_functional.md`. Core principle: anything needing a
> secret is [HUMAN]; pure client-side / self-host / no-key embed is [AUTO].

## Booking / Scheduling
- **Cal.com** — OSS AGPL self-host **FREE**; Cloud Free $0, Pro ~$12, Teams ~$24/seat.
  Inline embed + REST API. **ADOPT P0** (self-host = €0, no per-client SaaS fee).
- Calendly/TidyCal/SavvyCal — cloud, need client account. Optional.
- Build deterministic booking UI; slot client's Cal.com embed at activation.

## Maps
- **OpenStreetMap + Leaflet** — **no key, no bill, GDPR-friendly (ODbL attribution)**.
  **ADOPT P0.** VERIFIED.
- Mapbox / Google Maps — need key+billing; use ONLY if client mandates. Optional P2.
- `lib/sources/mapsListing.ts` + `mapsUrl.ts` already collect listing data → feed OSM.

## Search
- **Fuse.js / Lunr** (client, MIT, $0) — ADOPT P0 for small/medium catalogs.
- **Meilisearch** — **self-host FREE** (MIT); Cloud **$20/mo** (usage $30/mo base,
  resource $23/mo XS). VERIFIED. ADOPT P1 (scale).
- **Algolia** — SaaS, **MCP Server** exists, free tier limited, paid subscription, Ent.
  VERIFIED (algolia.com/pricing shows MCP). OPTIONAL P2 (only if Fuse/Meili insufficient).
- Typesense — OSS alt to Meili. Optional.

## Payments
- **Stripe** — **no monthly fee**, ~2.9% + €0.30 EU per successful tx. API+SDK. VERIFIED.
  Costs only on client sales, not build. **ADOPT P0.** PayPal/Braintree optional.

## Commerce
- **Snipcart** (cart via JS, free tier), **Medusa** (OSS headless, self-host FREE),
  **Shopify** (if client already on it — embed). Stripe backs checkout. ADOPT P1 (Medusa
  self-host) / P2 (Shopify if existing).
- WooCommerce — WP-based, optional.

## Email (transactional)
- **Web3Forms** — 250/mo FREE, no backend, access key public-safe. **ADOPT P0** (contact/
  quote). VERIFIED.
- **Resend** — Free **100/day**, Pro/Scale/Ent; SDK+SMTP+React Email. VERIFIED. OPTIONAL P1.
- SendGrid/Postmark — optional. EmailJS free for simple forms.

## SMS
- **Twilio** — per-message (VERIFIED pricing page, volume tiers). Optional P2 (notifications).
- Vonage/Bandwidth — optional.

## Auth
- **Supabase Auth** — free 50k MAU, unlimited API, social OAuth, custom SMTP. VERIFIED.
  **ADOPT P0.** 
- **Clerk** — Free **50k MRU**, Pro $20, Business $250, MFA, SSO (ent). VERIFIED. OPTIONAL
  P2 (if Supabase UI needs augment).
- Auth.js (NextAuth) — OSS, self-host. Optional.

## Database
- **Supabase** (Postgres, free 500MB, 50k MAU) — ADOPT P0. Firebase — optional. Postgres
  self-host — local fallback.

## CMS
- **Payload** (OSS MIT, self-host FREE) / **Strapi** (OSS) — ADOPT P2 (client editing UI).
- **Sanity** (free tier) / **Contentful** (free tier) / **Decap** (Git-based OSS) — optional.
- `structured_data_validation` + JSON-LD already handled in repo.

## Media (optimization / CDN)
- **Cloudinary** — **Free $0** (25 credits/mo, image+video transform API, **MCP servers**,
  CDN). VERIFIED. OPTIONAL P2 (if R2+Sharp insufficient).
- **Cloudflare R2 + CDN** — Free 10GB, no egress; CDN free. **ADOPT P0.** VERIFIED.
- **FFmpeg / Sharp / ImageMagick / WebCodecs** — local build-time. ADOPT P0.

## Notifications / Analytics
- **Plausible** self-host $0 (GDPR, no cookie) — ADOPT P0. Umami optional. Resend/Twilio
  for email/SMS.

## Industry module map (extend `lib/forge/functionalModules.ts`)
Restaurant (menu/reservations/ordering/hours/gallery/reviews), Auto (services/booking/quote/
vehicle/reviews), Law (practice areas/attorneys/consult/downloads), Real Estate (search/
filters/map/gallery/floorplan/inquiry), E-commerce (catalog/variants/filters/cart/checkout/
accounts), + extend: Healthcare (booking/telehealth), Hotel (rooms/booking/experiences),
Education (courses/auth/dashboards), Agency (case studies/contact), Non-profit (donations/
impact), Finance (dashboards/calculators/auth), Local SMB (services/map/reviews/booking).
All assemble from the FREE stack above.

## Security for functional
- Never commit client secrets. Vault (Clerk/Supabase/Stripe keys) → env at activation.
- Prefer self-host (Cal.com/Meili/Payload/Supabase) to keep data in BusinessForge's control.
- `output_security` gate already checks injected script/leaks — extend to form endpoints.
