# Website Capability Knowledge (Domain D22–D31 / F4-Engineering) — Phase 13

**Status:** Research artifact, pre-implementation. **Do NOT implement. Do NOT modify application code.** This document is knowledge to inform future capability-gating workers and a forward-looking Engineering Worker. No code is written here.

**Date:** 2026-08-17
**Author role:** Research Director
**Part of:** Phase 13 knowledge capture for the WebsiteAgent repo (`docs/knowledge/`).
**Owns:** taxonomy domains **D22 BACKEND, D23 DATABASE, D24 AUTHENTICATION, D25 AUTHORIZATION, D26 PAYMENTS, D27 EMAIL, D28 BOOKING, D29 CMS, D30 DEPLOYMENT, D31 ANALYTICS** (engineering family F4) — and the horizontal capabilities **frontend, search, filters, accounts, dashboards, admin, notifications, monitoring, backups, domains, SSL, CDN, integrations** which the taxonomy maps into F4 and F5. Obligation domains D32–D37 (accessibility, performance, security, SEO, GDPR, legal) are *referenced* from their own documents, not re-stated.

---

## 0. Honesty note

- This document is **structure and doctrine plus synthesis** drawn from established web-engineering practice. It contains no invented CVEs, no invented API behaviour, and no fabricated vendor claims. Where a claim depends on an external source it is cited with a URL + access date below; where it is not live-verified it is marked **UNVERIFIED**.
- **Verified live (HTTP 200 on 2026-08-17):** EDPB `https://edpb.europa.eu/`; Stripe docs `https://stripe.com/docs`; WCAG 2.1 `https://www.w3.org/TR/WCAG21/`; Google Search Central `https://developers.google.com/search/docs`. (web.dev / MDN / OWASP already verified in `PERFORMANCE_KNOWLEDGE.md` and `SECURITY_KNOWLEDGE.md`.)
- **UNVERIFIED (not re-fetched):** Let's Encrypt issuance specifics `https://letsencrypt.org/`; specific GDPR article numbers' exact wording (the regulation is EURLex 2016/679; cited by reference, text not re-fetched); every vendor pricing/SLA figure.
- Repository facts below were read from `C:\Users\40728\WebsiteAgent` on 2026-08-17 and treated as verified: `lib/render/` emits **static HTML/CSS with no JS by default**; there is **no backend runtime** today; delivery is static + a `scripts/publish-run.ts` deploy hook.

---

## 1. Alignment (do not duplicate)

- **Knowledge classes** (`KNOWLEDGE_TAXONOMY.md` §2): K1 invariant (gates), K2 craft, K3 trend, K4 anti-knowledge. Capability *presence* is governed by `ACTIVATES_WHEN` / `SUPPRESSED_WHEN`; **SUPPRESSED_WHEN is the load-bearing field** (taxonomy §1). Default is absence.
- **Security detail is owned by `SECURITY_KNOWLEDGE.md`.** This document cross-references its `SEC-nnn` rule ids instead of restating them. Every capability that introduces a server, form, account, or PII is mapped to the relevant SEC rule.
- **Performance budget is owned by `PERFORMANCE_KNOWLEDGE.md`.** Any capability requiring JS, a runtime, or third-party tags must clear that document's no-JS K1 floor and tier budgets.
- **Industry priors** (`EXPERIENCE_SIGNATURE_SYSTEM.md` §9) are the source of truth for *which* capabilities a business type tends to need. The decision table in §6 of this document is consistent with that section (e.g. clinic ⇒ elevated accessibility/GDPR; wedding venue ⇒ structured enquiry not booking; car service ⇒ phone-first, no experience delay).
- **The current delivery envelope:** static HTML/CSS, no JS, no backend. A capability marked `WITHIN CURRENT DELIVERY ENVELOPE? no` is outside today's envelope and would require new infrastructure (a backend runtime, a build-time integration, or a third-party embed that needs JS) before it can ship. This is a repo fact, not a judgement.

---

## 2. Cost-Complexity tier vocabulary

| Tier | Meaning | Implies |
|---|---|---|
| **T0** | None — capability absent | Nothing to build, host, or maintain |
| **T1** | Static — delivered with static HTML/CSS only | Within current envelope; no runtime |
| **T2** | Hosted third-party — embed/widget or hosted SaaS, minimal integration | Usually needs JS or an admin host; often outside current no-JS envelope |
| **T3** | Custom backend — bespoke server, API, data store | Outside current envelope; new infrastructure |
| **T4** | Ongoing operational burden — continuous staffing/compliance/uptime | T3 + people + SLA + monitoring + backups |

---

## 3. Capability catalogue

Each entry: ID · WHAT IT IS · WHEN A BUSINESS NEEDS IT · WHEN IT DOES NOT · COMMON IMPLEMENTATION (named products) · SECURITY RISKS (SEC-nnn) · UX IMPLICATIONS · COST-COMPLEXITY TIER · DECISION TRIGGER (machine-evaluable) · WITHIN CURRENT DELIVERY ENVELOPE?

---

### CAP-01 — Frontend
- **ID:** CAP-01
- **WHAT IT IS:** The presentation layer — HTML structure, CSS, typography, layout, imagery. The thing the visitor sees and reads.
- **WHEN A BUSINESS NEEDS IT:** Always. A website without a frontend is not a website.
- **WHEN IT DOES NOT:** Never suppressed. This is the baseline that every other capability sits on top of.
- **COMMON IMPLEMENTATION:** Hand-authored semantic HTML + CSS; the repo's `lib/render/` + `lib/design/` token system; design systems (e.g. Tailwind, vanilla-extract) as build tooling.
- **SECURITY RISKS:** SEC-012 / SEC-013 (any templated text must be HTML-escaped by `lib/render/`); SEC-015 / SEC-016 (CSP); SEC-019 (`nosniff`); SEC-020 (context-correct encoding); SEC-023 (`frame-ancestors 'none'`).
- **UX IMPLICATIONS:** Determines legibility, hierarchy, load speed (LCP/CLS per `PERFORMANCE_KNOWLEDGE.md`), and accessibility baseline (WCAG, `SECURITY_KNOWLEDGE.md` D32). Restraint over ornament (taxonomy D39).
- **COST-COMPLEXITY TIER:** T1 (static)
- **DECISION TRIGGER:** `business_requires_website => frontend` (always true; the non-negotiable baseline)
- **WITHIN CURRENT DELIVERY ENVELOPE?:** yes

### CAP-02 — Backend
- **ID:** CAP-02
- **WHAT IT IS:** Server-side runtime that handles requests, business logic, sessions, and integration beyond static file serving.
- **WHEN A BUSINESS NEEDS IT:** A transaction must be computed/server-validated (payment capture, availability check, account state, dynamic content per user), or state must persist server-side.
- **WHEN IT DOES NOT:** The site only informs or links out (phone, WhatsApp, walk-in). Adding a backend to a brochure site is the canonical over-build (taxonomy D22 SUPPRESSED_WHEN).
- **COMMON IMPLEMENTATION:** Node (e.g. Hono, Fastify), Python (FastAPI, Django), managed functions (Vercel/Netlify Functions, Cloudflare Workers), BaaS (Supabase, Firebase).
- **SECURITY RISKS:** SEC-001 (OWASP baseline), SEC-002 (broken access control), SEC-004 / SEC-036 (injection), SEC-006 (misconfig), SEC-010 (logging), SEC-011 (SSRF) — **all FORWARD-LOOKING** (no backend today).
- **UX IMPLICATIONS:** Enables dynamic flows but adds latency/risk; must clear the no-JS K1 floor via a static fallback (PERF-DECIDE-3).
- **COST-COMPLEXITY TIER:** T3 (custom backend)
- **DECISION TRIGGER:** `requires_server_side_state OR requires_server_validation_of_transaction OR requires_per_user_dynamic_content => backend`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no

### CAP-03 — Database
- **ID:** CAP-03
- **WHAT IT IS:** Persistent structured storage (relational or document) backing dynamic behaviour.
- **WHEN A BUSINESS NEEDS IT:** Bookings, accounts, inventory, orders, or any data that must survive requests and be queried.
- **WHEN IT DOES NOT:** All content is editorial and published at build time; nothing is created/updated by end users. Static content needs no DB.
- **COMMON IMPLEMENTATION:** Postgres, SQLite, MySQL, MongoDB, Supabase (Postgres+), PlanetScale; or static data files / JSON at build (no live DB).
- **SECURITY RISKS:** SEC-004 / SEC-036 (parameterised queries — 100%), SEC-037 (NoSQL injection), SEC-038 (boundary validation), SEC-039 (least-privilege role), SEC-040 / SEC-041 (LIKE/identifier safety) — **FORWARD-LOOKING**.
- **UX IMPLICATIONS:** None directly visible; enables the dynamic capabilities above. Wrong modelling causes slow queries → INP/CLS regressions.
- **COST-COMPLEXITY TIER:** T3
- **DECISION TRIGGER:** `requires_persistent_queryable_user_data OR booking OR accounts OR orders => database`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no

### CAP-04 — Authentication
- **ID:** CAP-04
- **WHAT IT IS:** Verifying *who* a user is (login, session, identity).
- **WHEN A BUSINESS NEEDS IT:** There is a private account area, admin, or personalised state tied to an identity the user must prove.
- **WHEN IT DOES NOT:** No accounts, no private area. A brochure site with login is a defect (taxonomy D24 SUPPRESSED_WHEN). See over-building list §7.
- **COMMON IMPLEMENTATION:** Managed IdP (Auth0, Clerk, Firebase Auth, Supabase Auth, WorkOS), or vetted library (Lucia, Passport).
- **SECURITY RISKS:** SEC-008 (auth failures), SEC-043 (memory-hard hashing, never plaintext), SEC-044 (rate-limit/lockout), SEC-045 (MFA), SEC-046 (HttpOnly/SameSite session cookie), SEC-047 (reset without enumeration), SEC-048 (timeout), SEC-049 (use vetted lib not homegrown), SEC-050 (rotate on logout) — **FORWARD-LOOKING**.
- **UX IMPLICATIONS:** Adds a login step; must be the shortest possible path to the user's real task. Friction here kills conversion.
- **COST-COMPLEXITY TIER:** T3
- **DECISION TRIGGER:** `private_account_area OR admin_for_end_users OR personalised_identity_state => authentication`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no

### CAP-05 — Authorization
- **ID:** CAP-05
- **WHAT IT IS:** Deciding *what* an authenticated (or anonymous) actor is allowed to do/see.
- **WHEN A BUSINESS NEEDS IT:** Roles exist (admin vs customer), or per-user resources (bookings, orders) must be scoped to their owner.
- **WHEN IT DOES NOT:** No protected resources; no roles. Meaningless without CAP-04.
- **COMMON IMPLEMENTATION:** RBAC/ABAC policy (e.g. Casbin, Oso, Auth0 fine-grained), server-side guards.
- **SECURITY RISKS:** SEC-002 / SEC-051 (authz on every protected op, server-side), SEC-052 (deny-by-default), SEC-053 (IDOR — verify ownership), SEC-054 (RBAC/least-privilege) — **FORWARD-LOOKING**.
- **UX IMPLICATIONS:** Invisible when correct; when wrong, users see "access denied" or — worse — other people's data.
- **COST-COMPLEXITY TIER:** T3 (rides on CAP-04)
- **DECISION TRIGGER:** `authentication_present AND (roles_exist OR per_user_resources) => authorization`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no

### CAP-06 — CMS
- **ID:** CAP-06
- **WHAT IT IS:** A system letting non-developers edit site content without touching code.
- **WHEN A BUSINESS NEEDS IT:** The owner/staff will genuinely update content often AND has verified willingness/ability to use an editor (taxonomy D29 ACTIVATES_WHEN).
- **WHEN IT DOES NOT:** Content changes ≤ a few times a year, or the owner will never log in. An unused CMS is dead weight + attack surface (over-building §7).
- **COMMON IMPLEMENTATION:** Headless static CMS (Decap CMS, Cosmic, Sanity, Contentful) built into the static pipeline; traditional (WordPress, Ghost, Strapi) where a backend exists.
- **SECURITY RISKS:** SEC-007 (SCA on CMS deps), SEC-006 (admin misconfig), SEC-021 (sanitize rich HTML), SEC-013 (escape templated content) — CMS admin is **FORWARD-LOOKING** but the static build path is in-envelope.
- **UX IMPLICATIONS:** None for visitors; for owners it must be simpler than asking the agency to edit. If the editor is harder than emailing the dev, it will be abandoned.
- **COST-COMPLEXITY TIER:** T2 (hosted/headless) — build-time integration only
- **DECISION TRIGGER:** `owner_will_update_content_monthly AND verified_editor_willingness => CMS`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no (requires a headless/static CMS build step + admin host; not a pure static file)

### CAP-07 — Booking
- **ID:** CAP-07
- **WHAT IT IS:** Letting a visitor reserve a time-slotted, capacity-constrained service online.
- **WHEN A BUSINESS NEEDS IT:** Verified time-slotted service AND finite capacity AND no adequate existing booking system (taxonomy D28 trigger; `EXPERIENCE_SIGNATURE_SYSTEM.md` §9: hotel direct bookings, clinic appointments, wedding-venue visits).
- **WHEN IT DOES NOT:** The business only takes phone/WhatsApp bookings, or capacity is not time-slotted (a bakery taking pre-orders is *enquiry*, not booking). A booking form for a phone-only business is the over-build archetype (§7).
- **COMMON IMPLEMENTATION:** Calendly, Acuity/Squarespace Scheduling, Simplybook, Resova, Treatwell, Google Reserve; custom = T3.
- **SECURITY RISKS:** SEC-026 (CSRF on mutations), SEC-028 (double-submit for sensitive), SEC-029 (Origin check), SEC-030 (no GET mutation) — **FORWARD-LOOKING**; third-party embeds inherit the vendor's posture (SEC-007).
- **UX IMPLICATIONS:** Must preserve the visitor's dates/party through the flow; a "book now" that loses the dates is a top bad-pattern (hotel §9). Keep it the shortest path to the real task.
- **COST-COMPLEXITY TIER:** T2 (hosted embed) today; T3 if custom
- **DECISION TRIGGER:** `verified_time_slotted_service AND finite_capacity AND no_adequate_existing_booking_system => booking`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no (needs JS embed or backend)

### CAP-08 — Payments
- **ID:** CAP-08
- **WHAT IT IS:** Taking money online (one-off or recurring).
- **WHEN A BUSINESS NEEDS IT:** The business sells online AND the buyer expects to pay on-site (ecommerce, deposits, ticketing).
- **WHEN IT DOES NOT:** Payment happens in person, by invoice, or off-platform. Never hand-roll a payment form (taxonomy D26; SEC-003 crypto, SEC-028 sensitive-action tokens).
- **COMMON IMPLEMENTATION:** Stripe (Checkout / Payment Links / Elements — docs `https://stripe.com/docs`, verified 200), Square, PayPal, GoCardless, Adyen; hosted checkout avoids storing card data.
- **SECURITY RISKS:** SEC-003 (TLS + encryption at rest), SEC-028 (non-cookie token for sensitive action), SEC-046 (secure session) — **FORWARD-LOOKING**; prefer hosted checkout so card data never touches the repo (PCI scope reduction).
- **UX IMPLICATIONS:** Hidden shipping cost until checkout and fake urgency are explicit ecommerce bad-patterns (§9). Total cost must be visible before pay.
- **COST-COMPLEXITY TIER:** T2 (hosted checkout redirect) today; T3 if custom
- **DECISION TRIGGER:** `sells_online AND buyer_expects_on_site_payment AND not_invoice_only => payments`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no (Stripe Checkout redirect needs JS/hosted step)

### CAP-09 — Email
- **ID:** CAP-09
- **WHAT IT IS:** Sending or receiving email — transactional (enquiry receipt, booking confirm) or outbound marketing.
- **WHEN A BUSINESS NEEDS IT:** An enquiry/booking flow exists and the business wants a receipt, OR runs a verified newsletter the visitor opted into.
- **WHEN IT DOES NOT:** A `mailto:` link suffices (that is T1, in-envelope). Do not stand up an SMTP server to avoid one mailto link.
- **COMMON IMPLEMENTATION:** Form-to-email SaaS (Formspree, Getform, Basin); transactional ESP (Postmark, SendGrid, Mailgun, Resend); plain `mailto:` for static.
- **SECURITY RISKS:** SEC-003 (don't log PII in mail), SEC-022 (don't reflect input), SEC-021 (sanitize if HTML email) — ESP handles deliverability/spoofing (SPF/DKIM/DMARC).
- **UX IMPLICATIONS:** A clear "we received your enquiry" state prevents duplicate submissions. Silent forms feel broken.
- **COST-COMPLEXITY TIER:** T1 (mailto) / T2 (form SaaS)
- **DECISION TRIGGER:** `enquiry_or_booking_flow_exists AND business_wants_receipt OR verified_opt_in_newsletter => email`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** partial — `mailto:` yes; form-to-email SaaS no (needs JS/third-party)

### CAP-10 — Notifications
- **ID:** CAP-10
- **WHAT IT IS:** Proactive alerts to business or user (SMS, push, webhook, Slack) when an event occurs.
- **WHEN A BUSINESS NEEDS IT:** A backend event (new booking, low stock, downtime) must page a human in near-real-time.
- **WHEN IT DOES NOT:** No backend event stream; the business checks a dashboard manually. Notifications without an event source are vapour.
- **COMMON IMPLEMENTATION:** Twilio (SMS), OneSignal (push), Slack/Discord webhooks, SendGrid events; all require a backend or SaaS trigger.
- **SECURITY RISKS:** SEC-011 (SSRF if notifying a user-supplied URL), SEC-010 (log the event), SEC-003 (PII in payload) — **FORWARD-LOOKING**.
- **UX IMPLICATIONS:** For the end user, only opt-in (e.g. booking reminder). Unsolicited SMS/push is spam and a GDPR issue.
- **COST-COMPLEXITY TIER:** T3 (needs event source)
- **DECISION TRIGGER:** `backend_event_exists AND human_must_be_paged_realtime => notifications`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no
### CAP-11 — Search
- **ID:** CAP-11
- **WHAT IT IS:** Letting a visitor find content by typing a query (site search).
- **WHEN A BUSINESS NEEDS IT:** The site has enough pages/items that scanning nav is insufficient (real estate listings, ecommerce catalogue, large docs/B2B). `EXPERIENCE_SIGNATURE_SYSTEM.md` §9 makes search the *primary designed object* for real estate.
- **WHEN IT DOES NOT:** A handful of pages reachable by nav. A search box on a 5-page brochure is decoration (over-building §7; analytics-nobody-reads sibling).
- **COMMON IMPLEMENTATION:** Static index search (Pagefind, Lunr, FlexSearch built at compile time); hosted (Algolia, SwiftType, Google Programmable Search).
- **SECURITY RISKS:** SEC-012 (escape query echo), SEC-022 (no reflected input), SEC-040 (escape LIKE/sort if backend) — static index is low-risk; hosted embeds need JS.
- **UX IMPLICATIONS:** Must return relevant results fast; a search that returns "no results" for everything erodes trust more than no search box.
- **COST-COMPLEXITY TIER:** T2 (static index built at compile = near T1; hosted = T2)
- **DECISION TRIGGER:** `page_count >= threshold(approx 20) OR catalogue_items_exist AND nav_insufficient => search`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no (static index is build-time; live search needs JS — outside no-JS envelope. A plain `/sitemap` or index page is the in-envelope substitute.)

### CAP-12 — Filters
- **ID:** CAP-12
- **WHAT IT IS:** Faceted narrowing of a list (by price, date, location, category).
- **WHEN A BUSINESS NEEDS IT:** A list the visitor must narrow to find the right item (real estate, ecommerce, jobs, events).
- **WHEN IT DOES NOT:** A short, homogeneous list. Filters on 6 items are friction, not help.
- **COMMON IMPLEMENTATION:** Algolia (facets), client-side filter over a static JSON (build-time), FacetWP (WordPress); custom = T3.
- **SECURITY RISKS:** SEC-041 (identifier allowlist for sort/facet fields), SEC-038 (validate filter values) — **FORWARD-LOOKING** for backend; static JSON filters are low-risk.
- **UX IMPLICATIONS:** Filters must show result counts and be removable; hidden-filter states confuse. Respect `prefers-reduced-motion` on animated list updates (PERF-R52).
- **COST-COMPLEXITY TIER:** T2 (static JSON + JS) / T3 (backend facet)
- **DECISION TRIGGER:** `list_size_large AND visitor_narrows_by_attribute => filters`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no (needs JS or backend)

### CAP-13 — Accounts
- **ID:** CAP-13
- **WHAT IT IS:** End-user accounts with persisted profile/order/booking history.
- **WHEN A BUSINESS NEEDS IT:** Repeat users need a persistent view of their own data (ecommerce order history, membership, subscriptions).
- **WHEN IT DOES NOT:** One-off enquiry or single purchase; the user never returns with state. Accounts add CAP-04/05 + GDPR weight for no gain.
- **COMMON IMPLEMENTATION:** Supabase Auth, Auth0, Clerk, Firebase Auth; custom = T3.
- **SECURITY RISKS:** Inherits CAP-04/05 (SEC-043..SEC-050); SEC-046 (session cookie); SEC-003 (PII at rest) — **FORWARD-LOOKING**.
- **UX IMPLICATIONS:** Account creation must be optional and never block the primary task; guest checkout is the ecommerce-correct default.
- **COST-COMPLEXITY TIER:** T3
- **DECISION TRIGGER:** `repeat_user_with_persistent_own_data AND accounts_reduce_friction => accounts`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no

### CAP-14 — Dashboards
- **ID:** CAP-14
- **WHAT IT IS:** An at-a-glance view of metrics/data for the business or user.
- **WHEN A BUSINESS NEEDS IT:** There is real data to act on (sales, bookings, analytics) AND a human will actually read it regularly.
- **WHEN IT DOES NOT:** No data yet, or nobody will look. "A dashboard with no data" is an explicit over-build (§7).
- **COMMON IMPLEMENTATION:** Metabase, Grafana, Retool, Looker; custom = T3.
- **SECURITY RISKS:** SEC-051 (authz on every widget/data call), SEC-053 (no IDOR between orgs) — **FORWARD-LOOKING**.
- **UX IMPLICATIONS:** Only show metrics tied to a decision; vanity dashboards are ignored and then become stale lie-sources.
- **COST-COMPLEXITY TIER:** T3
- **DECISION TRIGGER:** `meaningful_dataset_exists AND owner_will_review_regularly => dashboards`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no

### CAP-15 — Admin
- **ID:** CAP-15
- **WHAT IT IS:** A privileged back-office to manage content, users, orders, or settings.
- **WHEN A BUSINESS NEEDS IT:** There are resources to manage behind auth (CAP-04/05) — usually rides on CMS/booking/payments.
- **WHEN IT DOES NOT:** No managed resources; a static site needs no admin. A custom admin for a brochure is pure over-build.
- **COMMON IMPLEMENTATION:** Supabase Dashboard, Strapi/Directus admin, Retool; custom = T3.
- **SECURITY RISKS:** SEC-054 (RBAC/least-privilege admin), SEC-002 / SEC-051 (every admin action authz-checked), SEC-006 (no verbose errors), SEC-010 (audit log) — **FORWARD-LOOKING**.
- **UX IMPLICATIONS:** Admin UX is for staff, not visitors; but a painful admin gets abandoned → stale content → the public site rots.
- **COST-COMPLEXITY TIER:** T3
- **DECISION TRIGGER:** `managed_resources_exist_behind_auth => admin`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no

### CAP-16 — Analytics
- **ID:** CAP-16
- **WHAT IT IS:** Measuring visitor behaviour (page views, events, funnels).
- **WHEN A BUSINESS NEEDS IT:** The owner will actually use the data to make a decision, AND the chosen tool is privacy-proportionate (plausible/fathom/matomo over GA where EU users + consent apply).
- **WHEN IT DOES NOT:** Nobody reads it ("analytics nobody reads" is an over-build §7) OR the site ships no tracking — then analytics is absent and **a cookie banner must NOT appear** (Doctrine of Absence §5).
- **COMMON IMPLEMENTATION:** Plausible, Fathom, Umami (privacy-first, cookieless), Matomo (self-host), GA4 / Microsoft Clarity (needs consent in EU).
- **SECURITY RISKS:** SEC-003 (PII must not be sent to third parties), GDPR (D36) consent before any non-essential tracking; SEC-022 (no reflected data).
- **UX IMPLICATIONS:** Cookie-consent UI is itself friction; if there is no tracking, omitting it is both lawful and cleaner. See §5 inversion.
- **COST-COMPLEXITY TIER:** T2 (hosted/privacy-first) — but needs JS
- **DECISION TRIGGER:** `owner_will_act_on_data AND tool_privacy_proportionate => analytics` (and if EU users, `consent_obtained => tracking`)
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no (all JS-based; server-log analysis is the only in-envelope proxy and is not a capability)

### CAP-17 — SEO
- **ID:** CAP-17
- **WHAT IT IS:** Making the site findable and correctly represented in search engines.
- **WHEN A BUSINESS NEEDS IT:** Always — organic discovery is near-universal. This is a K1 floor for findability (D35).
- **WHEN IT DOES NOT:** Never suppressed as a floor; only *depth* (schema richness, hreflang) is tunable.
- **COMMON IMPLEMENTATION:** Semantic HTML + headings; `meta description`/`title`; `sitemap.xml` + `robots.txt`; JSON-LD (`schema.org`); Google Search Central guidance (`https://developers.google.com/search/docs`, verified 200); Search Console.
- **SECURITY RISKS:** SEC-012 (escape templated meta); low direct risk. Mostly correctness, not security.
- **UX IMPLICATIONS:** Good SEO and good UX coincide (clear titles, fast pages, real headings). Keyword stuffing harms both.
- **COST-COMPLEXITY TIER:** T1 (static, in-envelope)
- **DECISION TRIGGER:** `site_is_public => SEO` (always; depth escalates with market)
- **WITHIN CURRENT DELIVERY ENVELOPE?:** yes

### CAP-18 — Accessibility
- **ID:** CAP-18
- **WHAT IT IS:** The site is usable by people with disabilities and assistive tech (WCAG 2.1, `https://www.w3.org/TR/WCAG21/`, verified 200).
- **WHEN A BUSINESS NEEDS IT:** Always — K1 gate (D32). Escalates for clinics, education, government (diverse/impaired audiences, §9).
- **WHEN IT DOES NOT:** Never suppressed. Presence is non-negotiable; only *depth* is tunable.
- **COMMON IMPLEMENTATION:** Semantic HTML, labelled forms, `prefers-reduced-motion`, colour-contrast ≥ WCAG AA, focus order; tooling axe/Lighthouse/WAVE; enforced at `lib/qa/gates/accessibility.ts`.
- **SECURITY RISKS:** None directly; overlaps SEC-019 (nosniff) and CSP indirectly. Pure K1 obligation.
- **UX IMPLICATIONS:** Accessible = clearer for everyone. Low-contrast "premium" type that fails AA is a defect, not a style.
- **COST-COMPLEXITY TIER:** T1 (static, in-envelope)
- **DECISION TRIGGER:** `site_is_public => accessibility` (always; severity escalates by audience)
- **WITHIN CURRENT DELIVERY ENVELOPE?:** yes

### CAP-19 — Security
- **ID:** CAP-19
- **WHAT IT IS:** Hardening the delivered site against the OWASP Top 10 and common web attacks (CSP, escaping, headers, dependency hygiene).
- **WHEN A BUSINESS NEEDS IT:** Always as a floor (D34, K1). Intensity escalates with dynamic capability (forms, auth, payment).
- **WHEN IT DOES NOT:** Never suppressed. The static subset (CSP, escaping, headers) applies to every page today; server-side rules are FORWARD-LOOKING until a backend exists.
- **COMMON IMPLEMENTATION:** CSP (SEC-015/016), `X-Content-Type-Options: nosniff` (SEC-019), `frame-ancestors 'none'` (SEC-023), HTML-escaping in `lib/render/` (SEC-013), SCA via `npm audit` (SEC-007), Let's Encrypt TLS (UNVERIFIED specifics, `https://letsencrypt.org/`).
- **SECURITY RISKS:** This capability *is* the mitigation of SEC-001..SEC-054. Owns the cross-reference map used throughout this catalogue.
- **UX IMPLICATIONS:** Good security is invisible; bad security (broken CSP blocking legit content) is a visible defect — stage CSP `report-only` first (SEC-017).
- **COST-COMPLEXITY TIER:** T1 (static subset) / T3 (full server-side)
- **DECISION TRIGGER:** `site_is_public => security` (always; intensity = f(dynamic_capabilities))
- **WITHIN CURRENT DELIVERY ENVELOPE?:** yes (static subset; server-side rules pending backend)

### CAP-20 — GDPR
- **ID:** CAP-20
- **WHAT IT IS:** Compliance with the EU/UK data-protection regime (Regulation 2016/679; EDPB `https://edpb.europa.eu/`, verified 200) — lawful basis, transparency, data-subject rights, breach duty.
- **WHEN A BUSINESS NEEDS IT:** The site targets or processes EU/UK persons' data (almost always for an EU business). Health data (clinics) is *special category* → maximum severity (§9 clinic).
- **WHEN IT DOES NOT:** No personal data processed and no EU/UK reach — rare. Even then, a privacy notice is good practice.
- **COMMON IMPLEMENTATION:** Privacy policy + cookie/consent design; consent managers (Cookiebot, Osano, OneTrust) where tracking exists; data-processing terms with vendors; subject-rights flow.
- **SECURITY RISKS:** SEC-003 (encrypt PII), SEC-046 (secure session), SEC-021 (sanitize), plus the consent-before-tracking rule that drives the §5 cookie-banner inversion.
- **UX IMPLICATIONS:** Consent must be granular and revocable; a non-skippable "accept all" wall is both unlawful and hostile. If no tracking → no banner (§5).
- **COST-COMPLEXITY TIER:** T1 (policy + consent design) / T2 (consent manager)
- **DECISION TRIGGER:** `processes_eu_uk_personal_data OR sets_non_essential_cookies => GDPR` (almost always true for EU sites)
- **WITHIN CURRENT DELIVERY ENVELOPE?:** yes (policy + consent design; manager embed needs JS)
### CAP-21 — Cookies
- **ID:** CAP-21
- **WHAT IT IS:** Setting/reading browser cookies, and the consent UI that governs non-essential ones.
- **WHEN A BUSINESS NEEDS IT:** The site sets any non-essential cookie (analytics, tracking, personalisation). Essential cookies (session, consent-record) need no banner but should be documented.
- **WHEN IT DOES NOT:** **No tracking and no non-essential cookies.** Then NO consent banner must ship — shipping one is both a false legal statement and a UX defect (the §5 inversion; taxonomy D37 one inversion).
- **COMMON IMPLEMENTATION:** Consent managers (Cookiebot, Osano, OneTrust); `SameSite=Lax/Strict` + `HttpOnly` + `Secure` flags (SEC-027, SEC-046); a static consent-record cookie if a banner exists.
- **SECURITY RISKS:** SEC-027 (SameSite baseline), SEC-046 (HttpOnly/Secure session), SEC-022 (no reflected values); GDPR (D36) lawful basis before setting non-essential.
- **UX IMPLICATIONS:** If a banner exists it must be dismissable, granular, and not block content. Its absence when unneeded is a feature, not a gap.
- **COST-COMPLEXITY TIER:** T1 (design/doc) / T2 (consent manager)
- **DECISION TRIGGER:** `sets_non_essential_cookie => cookies_consent` ; `no_non_essential_cookie => NO_banner`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** yes (design + flags; manager embed needs JS)

### CAP-22 — Legal
- **ID:** CAP-22
- **WHAT IT IS:** The legally-required and risk-reducing pages: imprint/registered address, terms, privacy policy, cookie notice, accessibility statement.
- **WHEN A BUSINESS NEEDS IT:** Always for a public commercial site (D37, K1 floor). Impressum where required by jurisdiction.
- **WHEN IT DOES NOT:** Never suppressed as a floor; only *depth* (number of policies) scales with business type.
- **COMMON IMPLEMENTATION:** Static pages authored from verified business facts (registered name, address, contact, entity) — never invented (TRUTH_AND_EVIDENCE.md F-01..F-26); templates (Termly/Iubenda) only as drafts to be verified.
- **SECURITY RISKS:** SEC-003 (don't publish PII unnecessarily); mostly accuracy/liability, not infosec.
- **UX IMPLICATIONS:** Legal links belong in the footer, quiet but present. Missing imprint reads as scam.
- **COST-COMPLEXITY TIER:** T1 (static, in-envelope)
- **DECISION TRIGGER:** `site_is_public_commercial => legal` (always; breadth scales with type)
- **WITHIN CURRENT DELIVERY ENVELOPE?:** yes

### CAP-23 — Monitoring
- **ID:** CAP-23
- **WHAT IT IS:** Uptime, error, and security-event observation of the running site.
- **WHEN A BUSINESS NEEDS IT:** A backend or dynamic flow exists whose failure costs money (payments down, booking down) — then SEC-010 (log authz failures) and uptime alerts apply.
- **WHEN IT DOES NOT:** Pure static site on a reliable host — uptime is the host's job; per-page monitoring is over-build unless SLA-bound.
- **COMMON IMPLEMENTATION:** Sentry, UptimeRobot, Grafana/Prometheus, Datadog; static-host built-in analytics.
- **SECURITY RISKS:** SEC-010 (security-event logging to tamper-evident sink), SEC-022 (no reflected data in dashboards) — **FORWARD-LOOKING** for backends.
- **UX IMPLICATIONS:** None for visitors; protects the experience indirectly by catching outages.
- **COST-COMPLEXITY TIER:** T4 (ongoing) when backend exists; T1 adjacent for static-host status
- **DECISION TRIGGER:** `backend_or_sla_bound_dynamic_flow_exists => monitoring`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** no

### CAP-24 — Backups
- **ID:** CAP-24
- **WHAT IT IS:** Regular, restorable copies of site content/data/infra.
- **WHEN A BUSINESS NEEDS IT:** There is mutable state worth losing (DB, CMS content, config) — i.e. any T3 capability. A static site's source is already version-controlled (git), so backup ≈ repo + host snapshots.
- **WHEN IT DOES NOT:** Pure static, git-backed, host-redundant — additional backup process is low-value (the repo IS the backup).
- **COMMON IMPLEMENTATION:** Git history (source of truth), host snapshots (Netlify/Vercel), DB dumps to S3, automated SCA + lockfile (SEC-007).
- **SECURITY RISKS:** SEC-007 (lockfile + SCA so backups restore known-good deps), SEC-003 (encrypt backup at rest).
- **UX IMPLICATIONS:** None visible; but a site that cannot be restored after a bad deploy visibly rots.
- **COST-COMPLEXITY TIER:** T1 (git + host) / T4 (DB backup regime)
- **DECISION TRIGGER:** `mutable_server_state_exists => backups`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** partial (git + static host = yes; DB backup = no, needs state)

### CAP-25 — Deployment
- **ID:** CAP-25
- **WHAT IT IS:** How the built site reaches the internet (build → publish).
- **WHEN A BUSINESS NEEDS IT:** Always — a site must be delivered.
- **WHEN IT DOES NOT:** Never suppressed.
- **COMMON IMPLEMENTATION:** The repo's `scripts/publish-run.ts` deploy hook; static hosts (Netlify, Vercel, Cloudflare Pages, GitHub Pages); cache/compression headers per PERF-R80/81.
- **SECURITY RISKS:** SEC-006 (no verbose deploy errors), SEC-015 (CSP at edge), SEC-019 (nosniff), SEC-003 (no secrets in deploy logs).
- **UX IMPLICATIONS:** Deterministic deploys prevent "works locally" rot; instant rollback protects the live experience.
- **COST-COMPLEXITY TIER:** T1 (static, in-envelope)
- **DECISION TRIGGER:** `site_exists => deployment` (always)
- **WITHIN CURRENT DELIVERY ENVELOPE?:** yes (current pipeline)

### CAP-26 — Domains
- **ID:** CAP-26
- **WHAT IT IS:** Owning and configuring the site's domain name + DNS.
- **WHEN A BUSINESS NEEDS IT:** Always — a site needs an address.
- **WHEN IT DOES NOT:** Never suppressed; only the number of domains/subdomains scales.
- **COMMON IMPLEMENTATION:** Registrar (Cloudflare Registrar, Namecheap, Gandi); DNS (A/AAAA/CNAME, MX, TXT for SPF/DKIM/DMARC from CAP-09).
- **SECURITY RISKS:** SEC-006 (lock domain, no default creds), DNSSEC where supported; expired-domain takeover is a real vector.
- **UX IMPLICATIONS:** A memorable, owned domain is part of brand trust; a near-expired domain that lapses is catastrophic.
- **COST-COMPLEXITY TIER:** T1 (ops, in-envelope)
- **DECISION TRIGGER:** `site_exists => domains` (always)
- **WITHIN CURRENT DELIVERY ENVELOPE?:** yes

### CAP-27 — SSL
- **ID:** CAP-27
- **WHAT IT IS:** HTTPS/TLS for the served site (encryption in transit).
- **WHEN A BUSINESS NEEDS IT:** Always — HTTPS is a hard baseline (SEC-003, browser-marked secure).
- **WHEN IT DOES NOT:** Never suppressed.
- **COMMON IMPLEMENTATION:** Let's Encrypt (auto-renew; specifics UNVERIFIED, `https://letsencrypt.org/`), Cloudflare Universal SSL, provider-default TLS on static hosts.
- **SECURITY RISKS:** SEC-003 (TLS in transit); HSTS header recommended; avoid mixed content (PERF-R82 preconnect must be https).
- **UX IMPLICATIONS:** Non-HTTPS triggers browser "not secure" — instant trust loss.
- **COST-COMPLEXITY TIER:** T1 (provided by host, in-envelope)
- **DECISION TRIGGER:** `site_is_served => SSL` (always)
- **WITHIN CURRENT DELIVERY ENVELOPE?:** yes

### CAP-28 — CDN
- **ID:** CAP-28
- **WHAT IT IS:** Edge caching/serving so the site is fast worldwide.
- **WHEN A BUSINESS NEEDS IT:** Always for a public site — global low-latency is the default expectation (PERF-R81, TTFB ≤ 0.8 s).
- **WHEN IT DOES NOT:** Never suppressed as a floor; only *edge compute* (functions) is opt-in (rides CAP-02).
- **COMMON IMPLEMENTATION:** Cloudflare, Fastly, BunnyCDN; static-host edge (Netlify/Vercel); Brotli/Gzip compression (PERF-R81).
- **SECURITY RISKS:** SEC-015 (edge CSP), SEC-019 (nosniff at edge), SEC-006 (no info leak in error pages).
- **UX IMPLICATIONS:** Faster TTFB/LCP directly; a misconfigured CDN that serves stale HTML breaks the experience.
- **COST-COMPLEXITY TIER:** T1 (static host edge, in-envelope)
- **DECISION TRIGGER:** `site_is_public => CDN` (always; edge functions opt-in via CAP-02)
- **WITHIN CURRENT DELIVERY ENVELOPE?:** yes

### CAP-29 — Integrations
- **ID:** CAP-29
- **WHAT IT IS:** Connecting the site to external systems (CRM, maps, calendar, social, payment, email, Zapier/Make automations, webhooks).
- **WHEN A BUSINESS NEEDS IT:** A verified external system must receive or supply site data (e.g. enquiry → CRM, map embed, calendar sync).
- **WHEN IT DOES NOT:** The integration is aspirational or the external system adds no verified value. Integrations are attack surface + a maintenance tail.
- **COMMON IMPLEMENTATION:** Native embeds (Google Maps, Calendly), API/SDK (Stripe, HubSpot), automation (Zapier, Make), webhooks; static-only = embed/link, no server call.
- **SECURITY RISKS:** SEC-011 (SSRF if server fetches user URL), SEC-031 (allowlist outbound), SEC-003 (PII to third party), SEC-007 (vendor SCA), GDPR (D36) lawful basis for sharing data.
- **UX IMPLICATIONS:** Embeds must be consent-gated if they track (PERF-R22); a third-party map that slows LCP hurts the floor.
- **COST-COMPLEXITY TIER:** T2 (embed/automation) / T3 (API integration)
- **DECISION TRIGGER:** `verified_external_system_must_exchange_data_with_site => integrations`
- **WITHIN CURRENT DELIVERY ENVELOPE?:** partial (static embed/link = yes; server API call = no)

---

## 4. Verified source citations

| Claim | URL | Verified | Date |
|---|---|---|---|
| EDPB (GDPR guidance) | https://edpb.europa.eu/ | HTTP 200 | 2026-08-17 |
| Stripe documentation | https://stripe.com/docs | HTTP 200 | 2026-08-17 |
| WCAG 2.1 Recommendation | https://www.w3.org/TR/WCAG21/ | HTTP 200 | 2026-08-17 |
| Google Search Central docs | https://developers.google.com/search/docs | HTTP 200 | 2026-08-17 |
| OWASP Top 10 | https://owasp.org/Top10/ | HTTP 200 | 2026-08-17 (per SECURITY_KNOWLEDGE.md) |
| web.dev Core Web Vitals | https://web.dev/articles/vitals | HTTP 200 | 2026-08-17 (per PERFORMANCE_KNOWLEDGE.md) |
| MDN CSP / Set-Cookie / Trusted Types | https://developer.mozilla.org/ | HTTP 200 | 2026-08-17 (per SECURITY_KNOWLEDGE.md) |
| Let's Encrypt (TLS issuance) | https://letsencrypt.org/ | UNVERIFIED (not re-fetched) | 2026-08-17 |
| GDPR Regulation 2016/679 text | https://eur-lex.europa.eu/eli/reg/2016/679/oj | UNVERIFIED (cited by reference) | 2026-08-17 |

No source, spec, CVE, or vendor claim has been invented. UNVERIFIED rows are flagged as such.
---

## 5. Mandatory closing sections

### 5.1 CAPABILITY-BY-BUSINESS-TYPE DECISION TABLE

Legend: **R** = required (in every delivery of this type) · **C** = conditional (include only when that capability's DECISION TRIGGER fires) · **F** = forbidden (over-build for this type — must NOT be added). Consistent with `EXPERIENCE_SIGNATURE_SYSTEM.md` §9 industry priors.

Business-type codes: REST restaurant · BAKE bakery · CONF confectionery · HOTEL hotel · WED wedding venue · CLIN clinic · LAW law firm · ARCH architecture studio · CAR car service · RE real estate · ECOM ecommerce · B2B B2B · AGENCY creative agency · FREE freelancer · FIT fitness · EDU education.

Capability codes map to CAP-01…CAP-29 in §3.

**Table A — interactive / transactional capabilities**

| Type | FE | BE | DB | AUTH | AUTHZ | CMS | BK | PAY | EML | NOT | SRCH | FILT | ACCT | DASH | ADM |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REST | R | F | F | F | F | C | C | F | C | F | F | F | F | F | C |
| BAKE | R | F | F | F | F | C | F | C | C | F | F | F | F | F | C |
| CONF | R | F | F | F | F | C | F | C | C | F | F | F | F | F | C |
| HOTEL | R | C | C | C | C | C | C | C | C | C | F | F | C | C | C |
| WED | R | F | F | F | F | C | C | C | C | F | F | F | F | F | C |
| CLIN | R | C | C | C | C | C | C | C | C | C | F | F | C | C | C |
| LAW | R | F | F | F | F | C | F | F | C | F | F | F | F | F | C |
| ARCH | R | F | F | F | F | C | F | F | C | F | F | F | F | F | C |
| CAR | R | F | F | F | F | C | C | F | C | F | F | F | F | F | C |
| RE | R | C | C | C | C | C | F | F | C | C | R | C | C | C | C |
| ECOM | R | C | C | C | C | C | F | C | C | C | C | C | C | C | C |
| B2B | R | C | C | C | C | C | F | F | C | C | C | C | C | C | C |
| AGENCY | R | F | F | F | F | C | F | F | C | F | F | F | F | F | C |
| FREE | R | F | F | F | F | C | F | F | C | F | F | F | F | F | F |
| FIT | R | C | C | C | C | C | C | C | C | C | F | F | C | C | C |
| EDU | R | C | C | C | C | C | C | C | C | C | C | C | C | C | C |

**Table B — obligation / observation / delivery capabilities**

| Type | ANL | SEO | A11Y | SEC | GDPR | CK | LEG | MON | BKP | DEP | DOM | SSL | CDN | INT |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| REST | C | R | R | R | R | C | R | F | F | R | R | R | R | C |
| BAKE | C | R | R | R | R | C | R | F | F | R | R | R | R | C |
| CONF | C | R | R | R | R | C | R | F | F | R | R | R | R | C |
| HOTEL | C | R | R | R | R | C | R | C | C | R | R | R | R | C |
| WED | C | R | R | R | R | C | R | F | F | R | R | R | R | C |
| CLIN | C | R | R† | R | R† | C | R | C | C | R | R | R | R | C |
| LAW | C | R | R | R | R | C | R | F | F | R | R | R | R | C |
| ARCH | C | R | R | R | R | C | R | F | F | R | R | R | R | C |
| CAR | C | R | R | R | R | C | R | F | F | R | R | R | R | C |
| RE | C | R | R | R | R | C | R | C | C | R | R | R | R | C |
| ECOM | C | R | R | R | R | C | R | C | C | R | R | R | R | C |
| B2B | C | R | R | R‡ | R | C | R | C | C | R | R | R | R | C |
| AGENCY | C | R | R | R | R | C | R | F | F | R | R | R | R | C |
| FREE | C | R | R | R | R | C | R | F | F | R | R | R | R | F |
| FIT | C | R | R | R | R | C | R | C | C | R | R | R | R | C |
| EDU | C | R | R† | R | R | C | R | C | C | R | R | R | R | C |

† Accessibility severity escalated (diverse/impaired audiences). ‡ Security posture is a B2B trust signal (verify, don't claim).
**CK note:** on the current no-JS static envelope almost every site sets *no* non-essential cookie, so CK resolves to **none → no banner**. A consent banner appears only when a non-essential cookie/tracker is actually added (Doctrine of Absence §5.4).

### 5.2 MINIMUM VIABLE SITE (baseline every delivery must contain)

Regardless of business type, every shipped site MUST include:

1. **Frontend (CAP-01)** — semantic, on-brand HTML/CSS; fully usable with **zero JS** (PERF-DECIDE-3).
2. **SEO (CAP-17)** — unique `<title>` + `meta description` per page, logical headings, `sitemap.xml`, `robots.txt`, basic JSON-LD (`LocalBusiness`/`Organization`).
3. **Accessibility (CAP-18)** — WCAG 2.1 AA: contrast, labels, focus order, `prefers-reduced-motion` honored; passes `lib/qa/gates/accessibility.ts`.
4. **Security static subset (CAP-19)** — CSP (SEC-015), `X-Content-Type-Options: nosniff` (SEC-019), `frame-ancestors 'none'` (SEC-023), HTML-escaping enforced in `lib/render/` (SEC-013).
5. **Legal (CAP-22)** — verifiable imprint/contact + privacy notice (never invented facts).
6. **GDPR (CAP-20)** — privacy notice; **no cookie banner unless a non-essential tracker exists**.
7. **Delivery envelope (CAP-25/26/27/28)** — deployed via the existing `scripts/publish-run.ts` pipeline to a owned domain over HTTPS behind a CDN, with PERF-R80/81 cache/compression headers.
8. **One true primary action** matching the business's *real* conversion (phone / WhatsApp / walk-in / enquiry) — restraint over ornament (taxonomy D39). No capability below is added without its §3 DECISION TRIGGER firing.

### 5.3 ESCALATION LADDER (ordered addition as evidence justifies)

Add the next rung ONLY when its evidence exists. Each rung below a backend requires no new infrastructure; backend-dependent rungs require the envelope to expand first (new infra), which is itself a gated decision.

1. **Baseline (always):** §5.2 MVS.
2. **Enquiry evidence:** business takes enquiries → `email` (mailto or form SaaS, CAP-09) + a structured enquiry path (CAP-07 as *enquiry*, not booking) + `CMS` (CAP-06) **iff** owner updates content monthly.
3. **Booking evidence:** verified time-slotted service AND finite capacity AND no adequate existing system → `booking` (CAP-07) + `notifications` (CAP-10). Backend-dependent items (monitoring/backups) arm only once a backend exists.
4. **Commerce evidence:** sells online AND buyer expects on-site payment → `payments` (CAP-08) → pulls in `accounts` (CAP-13), `database` (CAP-03), `backend` (CAP-02), `admin` (CAP-15) + `dashboards` (CAP-14).
5. **Catalogue evidence:** large list the visitor must narrow → `search` (CAP-11) + `filters` (CAP-12).
6. **Tracking evidence:** EU/UK reach AND a privacy-proportionate, *actually-read* analytics tool → `cookies` consent (CAP-21) + `analytics` (CAP-16) **with** prior consent.
7. **Integration evidence:** a verified external system must exchange data → `integrations` (CAP-29).

Nothing is added speculatively. The ladder is evidence-driven, not ambition-driven.

### 5.4 THE DOCTRINE OF ABSENCE

**Default is NO capability.** Every capability is opt-in on evidence. The burden of proof is on the capability, not on absence. Each capability added is, simultaneously:

- **attack surface** (more SEC-nnn rules engage, more vendor trust assumed),
- **cost** (T1→T4 tier climb; hosting, licenses, staff),
- **maintenance** (deps to patch, uptime to guard, content to keep fresh),
- **UX friction** (one more step, one more banner, one more thing to load).

Therefore *capability is opt-in on evidence, never opt-out on caution* (taxonomy D22 doctrine). A brochure site with an unused auth system, a CMS nobody logs into, or a dashboard with no data is not "generous" — it is a defect carrying real liabilities.

**The notable inversion:** a site that ships **no tracking and no non-essential cookies must NOT display a cookie-consent banner.** Doing so is (a) a **false legal statement** — it asserts that the site sets trackers it does not set, and (b) a **UX defect** — it imposes consent friction with no corresponding processing to consent to. The banner is the one place where *adding* a control for an absent capability is both unlawful and worse for the user. On the current no-JS static envelope, this inversion applies to the large majority of deliveries: no analytics, no non-essential cookies, no banner. (Taxonomy D37 records this as the single explicit inversion of an otherwise always-on obligation.)

### 5.5 OVER-BUILDING anti-pattern list

Named failures to honour the Doctrine of Absence. Each is a build defect, not a feature:

1. **Auth on a brochure site** — CAP-04/05 added with no private area to protect. Attack surface + friction, zero benefit.
2. **A CMS nobody will use** — CAP-06 built because "sites have CMSes," then abandoned; stale content + admin attack surface. Add only on verified monthly-update intent.
3. **A booking form for a phone-only business** — CAP-07 where the real conversion is a call (car service, many trades). The form adds a step that *reduces* conversion (taxonomy D02 SUPPRESSED_WHEN).
4. **Analytics nobody reads** — CAP-16 emitting events into a dashboard no human consults; plus, if it needs consent, an unlawful banner (§5.4).
5. **A dashboard with no data** — CAP-14 shipped before any dataset exists; a vanity surface that rots into a lie-source.
6. *(corollaries)* **Search box on a 5-page site** (CAP-11), **filters on 6 items** (CAP-12), **a backend where `mailto:` suffices** (CAP-02 vs CAP-09), **notifications with no event source** (CAP-10), **aspirational integrations** (CAP-29).

---

## 6. Footer

- **Class of this document:** K1 (invariant floors: frontend/SEO/a11y/security/legal/deploy always on; absence default) + K2 (craft tiers, product choices) + K4 (over-building prohibitions). Contains no K3 by design.
- **Owns** taxonomy domains D22–D31 (engineering) and the horizontal capabilities; **references** D32–D37 from `SECURITY_KNOWLEDGE.md`, `PERFORMANCE_KNOWLEDGE.md`, and obligation sections. **Cites** `KNOWLEDGE_TAXONOMY.md` (K1–K4, ACTIVATES_WHEN/SUPPRESSED_WHEN) and `EXPERIENCE_SIGNATURE_SYSTEM.md` §9 (industry priors).
- **Repo facts relied on** (read 2026-08-17): `lib/render/` static HTML/CSS, no JS by default; no backend runtime; `scripts/publish-run.ts` deploy hook. Capabilities marked `WITHIN CURRENT DELIVERY ENVELOPE? no` require new infrastructure before they can ship.
- **Re-verify annually:** WCAG thresholds, GDPR/EDPB guidance, Stripe docs, CSP/Let's Encrypt specifics, vendor posture.
- **Do not implement. Hand to the Engineering/Factory worker and the Capability-Gating worker as the decision reference for `lib/factory/capabilities.ts` and future F4 gates.**
