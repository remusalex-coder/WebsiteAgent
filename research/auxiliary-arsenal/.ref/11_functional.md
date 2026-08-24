# BusinessForge — Functional Components & Third-Party Services Matrix

**Purpose:** Document which functional website components BusinessForge can wire into generated sites
**AUTOMATICALLY** (deterministic, no client secrets) vs which **REQUIRE human credentials/setup**
(the client's own account/API keys), plus the best provider, pricing, free tier, API/embed model,
and commercial-use posture for each category.

**Evidence tags used per claim:**
- `[VERIFIED]` — confirmed directly from an official source fetched during this research pass.
- `[OBSERVED]` — confirmed from the live page/DOM (e.g. open-source license, no-key embed).
- `[INFERRED]` — based on the provider's official docs/pricing as known; source URL cited, but
  not re-fetched in this pass. Treat as high-confidence but verify at build time.
- `[UNKNOWN]` — could not confirm; needs human verification before relying on it.

> **Core principle for BusinessForge:** Anything that needs a *secret* (API key, OAuth token,
> account login) is `[HUMAN]`. Anything that is pure client-side code, an open-source
> self-hosted stack BusinessForge owns, or a no-key public embed is `[AUTO]`. BusinessForge can
> *scaffold and pre-wire* the integration code deterministically (`[AUTO]` code), but *activation*
> (putting live client keys in) is almost always `[HUMAN]` unless BusinessForge operates the
> service itself (self-hosted open source).

---

## 1. Booking / Appointment Scheduling

**AUTO (deterministic, no creds):**
- A static "Request an appointment" form (HTML/JS) that captures name/email/datetime and
  submits to a form/email backend BusinessForge owns — `[AUTO]` for the markup; delivery is
  `[HUMAN]` if it needs the client's email service. `[INFERRED]`
- BusinessForge can *pre-build* the booking UI/embed code for any scheduler below without keys.
  The embed snippet itself is `[AUTO]`; it only renders once the client's account URL/ID is slotted in.

**HUMAN (needs client account/keys):**
- Cal.com Cloud, Calendly, TidyCal, SavvyCal all require the *client's* account to own the
  calendar/booking page. The inline embed (`<script>`/iframe) needs the client's username or
  API token. `[INFERRED]`
- Cal.com **self-hosted** is the one `[AUTO]` path: BusinessForge can run its own Cal.com
  instance (AGPL, open source) and create a booking page per client with no per-client SaaS fee. `[OBSERVED]`

**Providers:**
| Provider | Best for | Pricing | Free tier | API/Embed | Commercial use | Tag / Source |
|---|---|---|---|---|---|---|
| **Cal.com** | Open-source scheduling | Self-host **free** (AGPL); Cloud Free $0; Pro ~$12/mo; Teams ~$24/seat/mo | Free self-host + free cloud tier | Inline embed + REST API | Yes (AGPL self-host free; cloud paid) | `[OBSERVED]` open source / `[INFERRED]` tiers — https://cal.com/pricing |
| **Calendly** | Mainstream booking | Essentials ~$10, Professional ~$16, Teams ~$20/mo (per seat) | 1 calendar, limited | Inline + popup embed, API (paid) | Yes | `[INFERRED]` — https://calendly.com/pricing |
| **TidyCal** | Budget scheduling | One-time **$29 lifetime** or ~$9/mo | Free tier (watermarked) | Embed + API | Yes | `[INFERRED]` — https://tidycal.com/pricing |
| **SavvyCal** | Personalized links | Pro ~$12/mo; Teams higher | Free tier | Embed + API | Yes | `[INFERRED]` — https://savvycal.com/pricing |

> `[VERIFIED]` anchors: Cal.com pricing page returns free/Pro/Team tiers and open-source model
> (https://cal.com/pricing). Exact dollar amounts for Pro/Teams are `[INFERRED]`.

---

## 2. Payments / Checkout

**AUTO (deterministic, no creds):**
- BusinessForge can *generate* the checkout UI/Stripe Elements/Checkout integration code,
  the Snipcart drop-in cart JS, and a "pay" button deterministically. The **code** is `[AUTO]`;
  it goes live only when the client's publishable/secret keys are inserted → `[HUMAN]` activation.
- A static donation/"support us" button that links to a client-provided payment link is `[AUTO]`
  for the markup, but the destination URL is `[HUMAN]`.

**HUMAN (needs client account/keys):**
- Every processor (Stripe, Lemon Squeezy, Paddle, Square) requires the client to open a merchant
  account and supply API keys / a hosted-checkout URL. Payouts are to the client's bank. `[INFERRED]`

**Providers:**
| Provider | Model | Fees | Free tier | API/Embed | Commercial | Tag / Source |
|---|---|---|---|---|---|---|
| **Stripe** | Direct PSP | **No monthly fee**; **2.9% + 30¢** per successful card charge (US) | Pay-per-tx, no fixed cost | Checkout, Elements, Payment Links, full REST API | Yes | `[VERIFIED]` "No setup fee" + "2.9%" (https://stripe.com/pricing); 30¢ `[INFERRED]` standard US rate |
| **Lemon Squeezy** | Merchant of Record (handles global tax) | **5% + $0.50** per transaction; **no monthly fee** | Free to start (MoR) | API + checkout overlay | Yes | `[VERIFIED]` 5% + $0 (https://www.lemonsqueezy.com/pricing) |
| **Paddle** | Merchant of Record | **~5% + ~$0.99 fixed** per transaction; no monthly fee | Free (MoR, tax incl.) | API + checkout | Yes | `[VERIFIED]` 5% (https://www.paddle.com/pricing); fixed fee `[INFERRED]` |
| **Square** | Direct PSP | Online **2.9% + 30¢**; in-person lower | No monthly (some plans) | Checkout, APIs, POS | Yes | `[INFERRED]` — https://squareup.com/pricing |

> Note: MoR providers (Lemon Squeezy, Paddle) absorb sales-tax/VAT compliance — attractive for
> small clients selling internationally. `[INFERRED]`

---

## 3. Forms / Contact

**AUTO (deterministic, no creds):**
- **Netlify Forms** — if the site is deployed on Netlify, form handling is free and needs no
  API key beyond the hosting account BusinessForge controls. `[OBSERVED]` (Netlify native feature)
- A `mailto:` or client-side form that POSTs to a BusinessForge-owned endpoint is `[AUTO]`
  if BF operates the endpoint; otherwise `[HUMAN]`.
- Pure static contact form with client-side validation (no submission backend) is `[AUTO]` but
  does nothing without a delivery path.

**HUMAN (needs client account/keys):**
- Formspree, Getform, Basin require the client's account to receive submissions (or BF owns a
  shared account → then `[AUTO]` at BF's risk). Typeform/Tally embed needs the client's form ID. `[INFERRED]`

**Providers:**
| Provider | Pricing | Free tier | API/Embed | Commercial | Tag / Source |
|---|---|---|---|---|---|
| **Formspree** | From ~$8/mo | ~50 submissions/mo | POST endpoint + AJAX | Yes | `[INFERRED]` — https://formspree.io/pricing |
| **Getform** | From ~$9/mo | ~50 submissions/mo | POST endpoint | Yes | `[INFERRED]` — https://getform.io/pricing |
| **Basin** | From ~$7/mo | ~100 submissions/mo | POST endpoint | Yes | `[INFERRED]` — https://usebasin.com/pricing |
| **Typeform** | From ~$25/mo | 10 responses/mo | iframe embed + API | Yes | `[INFERRED]` — https://www.typeform.com/pricing |
| **Tally** | From ~$29/mo | Unlimited forms/responses (branding) | iframe embed + API | Yes | `[INFERRED]` — https://tally.so/pricing |

---

## 4. Email / Transactional

**AUTO (deterministic, no creds):**
- None robustly — sending email requires an authenticated SMTP/API provider with keys. `[INFERRED]`
- BusinessForge can *pre-build* the send integration (Resend/SendGrid SDK calls, React Email
  templates) deterministically; activation is `[HUMAN]`.

**HUMAN (needs client account/keys):** All four require the client's API key + verified domain. `[INFERRED]`

**Providers:**
| Provider | Pricing | Free tier | API/Embed | Commercial | Tag / Source |
|---|---|---|---|---|---|
| **Resend** | From ~$20/mo (Pro) | 3,000 emails/mo | REST API + React Email | Yes | `[INFERRED]` — https://resend.com/pricing |
| **SendGrid** (Twilio) | From ~$20/mo | 100 emails/day | API + SMTP relay | Yes | `[INFERRED]` — https://sendgrid.com/pricing |
| **Postmark** | From ~$15/mo (10k) | 100 emails/mo | API + SMTP | Yes | `[INFERRED]` — https://postmarkapp.com/pricing |
| **Brevo** (ex-Sendinblue) | From ~€25/mo | 300 emails/day | API + SMTP | Yes | `[INFERRED]` — https://www.brevo.com/pricing |

---

## 5. Maps / Directions

**AUTO (deterministic, no creds):**
- **Leaflet + OpenStreetMap** — fully client-side, **no API key**, free tile usage, MIT-licensed.
  BusinessForge can drop a styled map with markers/directions deterministically. `[OBSERVED]` (open standard)
- Static map images via OSM/self-hosted tile server — `[AUTO]`.

**HUMAN (needs client account/keys):**
- **Mapbox GL JS** and **Google Maps JS API** require the client's (or BF's) API token/key, and
  both bill by usage. `[INFERRED]`

**Providers:**
| Provider | Pricing | Free tier | API/Embed | Commercial | Tag / Source |
|---|---|---|---|---|---|
| **Leaflet + OSM** | Free (donation) | Unlimited (fair-use tiles) | JS lib, no key | Yes (ODbL/OSM attribution) | `[OBSERVED]` — https://leafletjs.com / https://www.openstreetmap.org |
| **Mapbox** | ~$0.50 per 1k map loads (usage) | **50,000 map loads/mo** | GL JS + REST APIs, token req. | Yes | `[VERIFIED]` 50,000 free/mo (https://www.mapbox.com/pricing); per-1k price `[INFERRED]` |
| **Google Maps JS API** | Pay-as-you-go, **$200/mo credit** | $200 equiv/mo credit | JS API + Places, key req. | Yes | `[INFERRED]` — https://developers.google.com/maps/pricing |

> Recommendation: default to Leaflet+OSM (`[AUTO]`); upgrade to Mapbox/Google only when the
> client needs routing, geocoding, or satellite imagery (`[HUMAN]`). `[INFERRED]`

---

## 6. CMS (Content Management)

**AUTO (deterministic, no creds):**
- **Decap (Netlify CMS)** — Git-based, open source, works with a static site + GitHub repo that
  BusinessForge controls. No paid service, no API key beyond the repo. `[OBSERVED]` open source.
- **Strapi** / **Payload** self-hosted — BusinessForge can host the CMS and give the client a
  admin login; the software is free (MIT). `[OBSERVED]` open source.

**HUMAN (needs client account/keys):**
- **Sanity** and **Contentful** cloud require the client's project ID + API token, and bill by
  usage/seats. `[INFERRED]`

**Providers:**
| Provider | Pricing | Free tier | API/Embed | Commercial | Tag / Source |
|---|---|---|---|---|---|
| **Sanity** | From ~$15/mo (team) | Studio free; ~50k API CDN req/mo, 500MB dataset | GraphQL/REST + React Studio | Yes | `[INFERRED]` — https://www.sanity.io/pricing |
| **Contentful** | From ~$300/mo (team) | 2 envs, ~25k/mo, 5 users | Content API + GraphQL | Yes | `[INFERRED]` — https://www.contentful.com/pricing |
| **Strapi** | Self-host **free** (MIT) | Unlimited self-host | REST/GraphQL API | Yes | `[OBSERVED]` — https://strapi.io |
| **Decap / Netlify CMS** | **Free** (open source) | Unlimited (Git-backed) | Git + admin UI | Yes | `[OBSERVED]` — https://decapcms.org |
| **Payload** | Self-host **free** (MIT); Cloud paid | Self-host free | REST/GraphQL API | Yes | `[INFERRED]` — https://payloadcms.com |

> For BusinessForge factories: Decap (Git-based) is the cleanest `[AUTO]` CMS; Strapi/Payload
> self-hosted are `[AUTO]` if BF runs the server. `[INFERRED]`

---

## 7. Auth / Accounts

**AUTO (deterministic, no creds):**
- **Lucia** is a bare auth *library* — BusinessForge can write the integration code deterministically,
  but it still needs a database/session store (which is `[HUMAN]` unless BF self-hosts the DB). `[OBSERVED]` open source.
- BusinessForge can pre-build login/signup UI components for any provider below without keys. `[INFERRED]`

**HUMAN (needs client account/keys):**
- Clerk, Auth0, and Supabase Auth all require the client's (or BF's) project/tenant and API keys. `[INFERRED]`

**Providers:**
| Provider | Pricing | Free tier | API/Embed | Commercial | Tag / Source |
|---|---|---|---|---|---|
| **Clerk** | From ~$25/mo | ~10,000 MAU | Prebuilt React/Vue components + API | Yes | `[INFERRED]` — https://clerk.com/pricing |
| **Auth0** (Okta) | From ~$35/mo | ~7,500 MAU | SDKs + universal login | Yes | `[INFERRED]` — https://auth0.com/pricing |
| **Supabase Auth** | Included in Supabase plan | Free tier ~50k MAU | SDK + REST/GoTrue API | Yes | `[INFERRED]` + `[VERIFIED]` free $0/`Pro $25` (https://supabase.com/pricing) |
| **Lucia** | **Free** (open source) | Unlimited (self-host) | Library (you build UI) | Yes | `[OBSERVED]` — https://lucia-auth.com |

> Pragmatic path: if the site already uses Supabase (DB), use Supabase Auth (`[HUMAN]` account,
> free tier) — one vendor, one free tier. `[INFERRED]`

---

## 8. Search / Filter

**AUTO (deterministic, no creds):**
- **FlexSearch**, **Fuse.js**, **Lunr** — pure client-side JS libraries, **no API key, no server**.
  BusinessForge can index static/site content and ship instant search deterministically. `[OBSERVED]` open source.
- Great for small/medium sites (docs, product lists, blogs) without a backend. `[INFERRED]`

**HUMAN (needs client account/keys):**
- **Algolia** needs an app ID + API key (and billing past free quota). `[INFERRED]`
- **Meilisearch** self-hosted is `[AUTO]` if BusinessForge runs the server (open source, MIT). `[OBSERVED]`

**Providers:**
| Provider | Pricing | Free tier | API/Embed | Commercial | Tag / Source |
|---|---|---|---|---|---|
| **FlexSearch / Fuse.js / Lunr** | **Free** (open source) | Unlimited (client-side) | JS lib, no key | Yes | `[OBSERVED]` — https://github.com/nextapps-de/flexsearch / https://fusejs.io |
| **Algolia** | From ~$1/mo + usage | ~10k records, ~50k ops/mo | REST API + InstantSearch UI | Yes | `[INFERRED]` — https://www.algolia.com/pricing |
| **Meilisearch** | Self-host **free** (MIT); Cloud paid | Self-host free | REST API | Yes | `[OBSERVED]` — https://www.meilisearch.com |

> Default: FlexSearch/Fuse for client-side (`[AUTO]`). Use Algolia/Meilisearch only for large
> catalogs or server-indexed search (`[HUMAN]`/self-host). `[INFERRED]`

---

## 9. Reviews / Testimonials

**AUTO (deterministic, no creds):**
- A **static, curated testimonials section** (hardcoded quotes + avatars) is fully `[AUTO]` —
  no backend, no keys, ships with the site. `[INFERRED]`
- BusinessForge can also generate a styled "Leave a review" CTA linking to the client's Google/
  Trustpilot profile (the link is `[HUMAN]`-provided). `[INFERRED]`

**HUMAN (needs client account/keys):**
- **Trustpilot** business profile + review widgets require the client's Trustpilot account. `[INFERRED]`
- **Google reviews** live embed needs the client's Google Business Profile + Places API key (or a
  third-party widget account). `[INFERRED]`
- Third-party widget builders (Elfsight, etc.) need an account/key. `[INFERRED]`

**Providers / approaches:**
| Approach | Pricing | Free tier | Embed | Commercial | Tag / Source |
|---|---|---|---|---|---|
| **Static curated testimonials** | Free | Unlimited | Hardcoded HTML | Yes | `[AUTO]` `[INFERRED]` |
| **Trustpilot** | Free business acct; paid tiers for features | Free widget | iframe/JS | Yes | `[HUMAN]` `[INFERRED]` — https://business.trustpilot.com |
| **Google Business Profile reviews** | Free | Unlimited | Places API key req. | Yes | `[HUMAN]` `[INFERRED]` — https://developers.google.com/maps/documentation/places/web-service/reviews |
| **Elfsight Reviews** | From ~$5/mo | Limited | JS widget | Yes | `[HUMAN]` `[INFERRED]` — https://elfsight.com |

> Recommendation: ship static testimonials by default (`[AUTO]`); offer live Trustpilot/Google
> aggregation as a `[HUMAN]` upsell. `[INFERRED]`

---

## 10. Ecommerce

**AUTO (deterministic, no creds):**
- **Medusa** self-hosted (open source, MIT) — BusinessForge can run the storefront+admin and give
  the client a login; software is free. `[OBSERVED]` open source.
- **Snipcart** drop-in cart JS can be pre-wired deterministically; activation needs the client's
  Snipcart account/key → `[HUMAN]`. `[VERIFIED]` (Snipcart pricing fetched)
- BusinessForge can build product grids, cart, and checkout UI without keys (the plumbing is `[AUTO]`). `[INFERRED]`

**HUMAN (needs client account/keys):**
- Shopify Storefront API needs a Shopify store + token (`[HUMAN]`, Shopify plan ~$39+/mo). `[INFERRED]`
- Commerce.js needs a client account/key. `[INFERRED]`

**Providers:**
| Provider | Pricing | Free tier | API/Embed | Commercial | Tag / Source |
|---|---|---|---|---|---|
| **Snipcart** | **2%** fee; **free forever** up to ~$1,000 sales/mo, then ~$20/mo | Free up to $1k/mo | Drop-in JS cart | Yes | `[VERIFIED]` 2% / free / $20 / $1,000 (https://snipcart.com/pricing) |
| **Shopify Storefront API** | Needs Shopify plan ~$39+/mo | None standalone (needs store) | Storefront GraphQL API | Yes | `[HUMAN]` `[INFERRED]` — https://www.shopify.com/pricing |
| **Medusa** | Self-host **free** (MIT); Cloud paid | Self-host free | REST/GraphQL API | Yes | `[OBSERVED]` — https://medusajs.com |
| **Commerce.js** | From ~$0 dev / paid tiers | Dev tier | JS SDK + API | Yes | `[HUMAN]` `[INFERRED]` — https://commercejs.com/pricing |

> For a hands-off factory: Snipcart (`[HUMAN]` account, very low friction) or Medusa self-host
> (`[AUTO]` if BF hosts). `[INFERRED]`

---

## 11. Analytics

**AUTO (deterministic, no creds):**
- **Plausible self-hosted** — open source, **free**, BusinessForge can host the instance and embed
  the script with no client account. `[OBSERVED]` (plausible.io home confirms "Open source" + "free").
- **Umami self-hosted** — open source, free, no key. `[OBSERVED]` open source.
- **PostHog self-hosted** — open source, free. `[INFERRED]`
- A privacy-friendly analytics script is `[AUTO]` once BF operates the instance.

**HUMAN (needs client account/keys):**
- **GA4** is free but needs a Google account + Measurement ID (`[HUMAN]`, no cost). `[OBSERVED]`
- **Plausible / Umami / PostHog cloud** need the client's account (or BF's shared account). `[INFERRED]`

**Providers:**
| Provider | Pricing | Free tier | API/Embed | Commercial | Tag / Source |
|---|---|---|---|---|---|
| **Plausible (self-host)** | **Free** (AGPL) | Unlimited (self-host) | JS script, no key | Yes | `[OBSERVED]` — https://plausible.io |
| **Plausible (cloud)** | From ~€9/mo | 30-day trial | JS script | Yes | `[INFERRED]` — https://plausible.io/pricing |
| **Umami** | Self-host free; cloud from ~$9/mo | Self-host free | JS script | Yes | `[OBSERVED]` — https://umami.is |
| **GA4** (Google) | **Free** | Unlimited | gtag.js, Measurement ID | Yes (Google ToS) | `[OBSERVED]` — https://analytics.google.com |
| **PostHog** | Self-host free; cloud free 1M events/mo | 1M events/mo (cloud) | JS + API | Yes | `[INFERRED]` — https://posthog.com/pricing |

> Default: Plausible self-hosted (`[AUTO]`, privacy-first, no cookie banner needed). Fallback to
> GA4 when the client demands Google (`[HUMAN]` account, free). `[INFERRED]`

---

## 12. Databases / Backend

**AUTO (deterministic, no creds):**
- BusinessForge can *scaffold* the schema, migrations, and query/SDK code deterministically. `[INFERRED]`
- A **self-hosted Postgres/SQLite** that BusinessForge operates is `[AUTO]` (no client keys). `[INFERRED]`
- Serverless function wrappers (edge functions) can be pre-wired without keys. `[INFERRED]`

**HUMAN (needs client account/keys):**
- Supabase, Firebase, Neon, Turso all require the client's (or BF's) project + connection keys. `[INFERRED]`

**Providers:**
| Provider | Pricing | Free tier | API/Embed | Commercial | Tag / Source |
|---|---|---|---|---|---|
| **Supabase** | From **$25/mo** (Pro) | **$0** free: 2 projects, ~500MB DB, ~1GB storage, ~50k MAU | REST/GraphQL + Realtime + Auth | Yes | `[VERIFIED]` free $0 / Pro $25 (https://supabase.com/pricing); quota details `[INFERRED]` |
| **Firebase** | Pay-as-you-go (Blaze) | **Spark** free: auth, Firestore, hosting limits | SDK + REST | Yes | `[INFERRED]` — https://firebase.google.com/pricing |
| **Neon** | From ~$19/mo | 0.5 GB, ~10 branches, compute | Postgres wire + API | Yes | `[INFERRED]` — https://neon.tech/pricing |
| **Turso** | From ~$29/mo | 500 MB, ~1B reads/mo, 3 DBs | libSQL/SQLite + API | Yes | `[INFERRED]` — https://turso.tech/pricing |

> Recommendation: Supabase free tier (`[HUMAN]` account, generous) covers DB+Auth+Storage+Functions
> in one — best single backend for BusinessForge sites. `[INFERRED]`

---

## 13. Chat / AI Assistant on Site

**AUTO (deterministic, no creds):**
- A **static FAQ / rule-based chat widget** (client-side decision tree, no LLM) is fully `[AUTO]`. `[INFERRED]`
- Pre-built chat UI components (message bubbles, quick-reply buttons) can ship without keys. `[INFERRED]`

**HUMAN (needs client account/keys):**
- **Custom LLM chat** (OpenAI / Anthropic API) needs the client's API key + billing; tokens are
  metered and cost money. Must be server-proxied to avoid leaking keys. `[INFERRED]`
- **Embedded live-chat widgets** (Intercom, Crisp, Tawk.to, Drift) need the client's account/key;
  some have free tiers. `[INFERRED]`

**Providers / approaches:**
| Approach | Pricing | Free tier | API/Embed | Commercial | Tag / Source |
|---|---|---|---|---|---|
| **Static FAQ bot** | Free | Unlimited | Client-side JS | Yes | `[AUTO]` `[INFERRED]` |
| **OpenAI API (custom)** | Pay per token (~$0.01–$0.10/1k) | $5 free credit (new accts, varies) | REST API (proxy needed) | Yes | `[HUMAN]` `[INFERRED]` — https://openai.com/api/pricing |
| **Anthropic API (custom)** | Pay per token (~$0.01–$0.15/1k) | Varies | REST API (proxy needed) | Yes | `[HUMAN]` `[INFERRED]` — https://www.anthropic.com/pricing |
| **Tawk.to** | Free | Full free tier | JS widget | Yes | `[HUMAN]` `[INFERRED]` — https://www.tawk.to |
| **Crisp** | Free basic; paid ~$25/mo | Basic free | JS widget | Yes | `[HUMAN]` `[INFERRED]` — https://crisp.chat/pricing |
| **Intercom** | From ~$39/mo | Trial only | JS widget | Yes | `[HUMAN]` `[INFERRED]` — https://www.intercom.com/pricing |

> For a no-credential default: static FAQ widget (`[AUTO]`). For live human support: Tawk.to (free,
> `[HUMAN]` account). For AI assistant: custom LLM is `[HUMAN]` (keys + cost) — proxy via BF's
> backend if bundling. `[INFERRED]`

---

## Appendix — AUTO vs HUMAN Quick Reference

| # | Category | Cleanest `[AUTO]` path | Typical `[HUMAN]` requirement |
|---|---|---|---|
| 1 | Booking | Cal.com self-host (BF runs it) | Client Cal.com/Calendly account |
| 2 | Payments | Pre-wired checkout code | Client merchant account + keys |
| 3 | Forms | Netlify Forms (on Netlify) | Client Formspree/Typeform account |
| 4 | Email | Pre-built send code | Client Resend/SendGrid key + domain |
| 5 | Maps | Leaflet + OpenStreetMap | Client Mapbox/Google key |
| 6 | CMS | Decap (Git) / Strapi self-host | Client Sanity/Contentful account |
| 7 | Auth | Lucia (needs DB) / Supabase Auth | Client auth tenant + keys |
| 8 | Search | FlexSearch / Fuse.js (client-side) | Client Algolia key |
| 9 | Reviews | Static curated testimonials | Client Trustpilot/Google profile |
| 10 | Ecommerce | Medusa self-host / Snipcart code | Client Snipcart/Shopify account |
| 11 | Analytics | Plausible self-host / Umami self-host | Client GA4/Plausible cloud account |
| 12 | Database | Self-hosted Postgres (BF runs it) | Client Supabase/Neon/Turso account |
| 13 | Chat | Static FAQ widget | Client LLM key or chat-widget account |

**Build rule for BusinessForge:** Ship the `[AUTO]` path by default in every site; expose a
single "connect your account" step for the `[HUMAN]` upgrade. Never hardcode client secrets in
generated repos — inject at deploy time via env vars / a config panel. `[INFERRED]`
