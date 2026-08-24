# 10 — FUNCTIONAL WEBSITE CAPABILITIES

> BusinessForge must build FUNCTIONAL sites, not just brochures. Every capability below
> has a FREE path. V=VERIFIED, K=KNOWN, U=UNKNOWN.

| Capability | FREE | MEDIUM | PREMIUM | API | Creds | Cost/site | Integration | Commercial | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| **Search** | Fuse.js/Lunr (client) | Supabase FTS | Algolia | ✅ | ❌/✅ | €0 | easy | yes | K |
| **Filtering/Sorting** | JS + data | Supabase query | Algolia | ✅ | ❌ | €0 | easy | yes | K |
| **Booking/Appt** | **Cal.com self-host** | Cal.com cloud | Cal.com Ent | ✅ | ✅ | €0 | med | yes | V cal.com |
| **Contact form** | **Web3Forms 250/mo** | Formspree | Ent | ✅ | access key | €0 | easy | yes | V web3forms.com |
| **Quote form** | Web3Forms + fields | Formspree | — | ✅ | key | €0 | easy | yes | V |
| **Calculators** | JS | — | — | n/a | ❌ | €0 | easy | yes | K |
| **Product selector** | JS/Three.js | — | — | n/a | ❌ | €0 | easy | yes | K |
| **Configurator** | Three.js | Spline | — | ✅ | ❌ | €0 | med | yes | V |
| **Ecommerce** | Snipcart/Medusa(OSS) | Shopify | SFCC | ✅ | ✅ | €0 build | med | yes | K |
| **Checkout/Payments** | **Stripe** (per-tx) | — | Braintree | ✅ | API key | €0 build | med | yes | V stripe.com |
| **Maps/Directions** | **OSM + Leaflet** (no key) | MapLibre | Google Maps | ✅ | ❌/key | €0 | easy | ODbL | V openstreetmap.org |
| **Reviews** | static/JSON-LD | Trustpilot embed | — | ✅ | ❌ | €0 | easy | yes | K |
| **Auth/Portal** | **Supabase free 50k MAU** | Supabase Pro $25 | Ent $599 | ✅ | proj | €0 | med | yes | V supabase.com |
| **Dashboards** | Supabase + charts | — | Retool | ✅ | proj | €0 | med | yes | V |
| **CMS** | **Decap/Payload(OSS)** | Sanity free | Contentful | ✅ | ❌/key | €0 | med | yes | K |
| **Localization** | i18next/client | Crowdin | — | ✅ | ❌ | €0 | easy | yes | K |
| **Notifications** | EmailJS/Web3Forms | Resend free 3k | Twilio | ✅ | key | €0 | easy | yes | V |
| **Email (tx)** | EmailJS/Resend free | SendGrid | — | ✅ | key | €0 | easy | yes | V |
| **Analytics** | **Plausible self-host** | Plausible cloud | GA360 | ✅ | ❌ | €0 | easy | yes/DNT | V plausible.io |

## Key decisions
1. **Forms:** Web3Forms free (250/mo, no backend) is the default contact/quote path.
   VERIFIED. No server code needed — perfect for static premium sites.
2. **Maps:** OpenStreetMap + Leaflet — NO API key, NO bill, GDPR-friendly. Prefer over
   Google Maps (requires key + billing). VERIFIED.
3. **Auth/CMS/DB:** Supabase free (50k MAU, 500MB DB, unlimited API) covers portals,
   dashboards, CMS backing. VERIFIED. Pay only when scaling.
4. **Payments:** Stripe — no monthly fee, costs only on successful sales (~2.9% + €0.30
   EU). Integrate free; client bears tx cost. VERIFIED typical EU pricing.
5. **Booking:** Cal.com open-source self-host = €0 scheduling with all features.
6. **Analytics:** Plausible self-host (€0, GDPR, no cookie banner) > Google Analytics.

## Integration difficulty
- Easy (build-time, no creds): search/filter/forms/maps/calculators/localization/analytics.
- Medium (needs credentials): auth/CMS/dashboards/payments/booking cloud/notifications.

## Commercial use
All FREE options above are commercial-safe (OSS or free-tier ToS permits commercial
websites). No licence trap here unlike generative image/voice free tiers.

## Cost per site (functional)
€0 for all functional capabilities on free tiers. Only scale (Supabase Pro, Stripe tx,
Resend volume) costs money, and only when the client's usage demands it.
