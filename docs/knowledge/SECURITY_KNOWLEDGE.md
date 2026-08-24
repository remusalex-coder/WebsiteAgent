# SECURITY_KNOWLEDGE.md

**Status:** Research artifact — pre-implementation. **Do not implement.** This document is a knowledge base to inform future security gates, code review, and a forward-looking Security Worker. No code is written here.

**Date:** 2026-08-17
**Author role:** Research Director
**Part of:** Phase 14 knowledge capture for the WebsiteAgent repo (`docs/knowledge/`).

**Knowledge-class discipline (from `docs/knowledge/KNOWLEDGE_TAXONOMY.md`):**
- K1 invariant — timeless, rarely changes (e.g. CSP directives, cookie flags).
- K2 craft — implementation technique / how-to (e.g. parameterised queries).
- K3 trend — moves with the ecosystem (e.g. dependency CVEs, OWASP edition).
- K4 anti-knowledge — actively wrong patterns to suppress (e.g. `eval`, string-concat SQL).

Each rule below carries an implied class. The `ACTIVATES_WHEN` / `SUPPRESSED_WHEN` discipline from the taxonomy is mirrored in the `APPLIES WHEN` / `DOES NOT APPLY WHEN` fields.

---

## Repo context (assumed verified)

- `lib/qa/gates/{performance,accessibility,technical}.ts` exist today as QA gates.
- `lib/render/` emits static HTML/CSS with **no JS by default**.
- There is **no backend runtime** in the repo today: delivery is static plus a `scripts/publish-run.ts` deploy hook.
- Consequence: any rule that presupposes a server, session store, or dynamic request handler is **forward-looking knowledge for a future Security Worker** and is flagged `FORWARD-LOOKING`. Such rules are NOT currently enforceable against the static output and must not be treated as blocking gates until a backend exists.

---

## Honesty note — verification table

| URL / Claim | Verified live? | Date | Notes |
|---|---|---|---|
| https://owasp.org/Top10/ | YES (HTTP 200) | 2026-08-17 | Page served; specific edition label UNVERIFIED (content not fetched) |
| https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP | YES (HTTP 200, redirected from /Web/HTTP/CSP) | 2026-08-17 | Canonical CSP guide |
| https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API | YES (HTTP 200) | 2026-08-17 | Trusted Types API reference |
| https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie | YES (HTTP 200, redirected from /Web/HTTP/Headers/Set-Cookie) | 2026-08-17 | Set-Cookie reference |
| OWASP Top 10 edition == "2021" | UNVERIFIED | 2026-08-17 | 2021 is the published edition; live page content not fetched |
| RFC 6265 / cookie flag semantics | UNVERIFIED | 2026-08-17 | General knowledge; not re-fetched |
| All specific CVE identifiers | NONE cited | — | No CVE is invented in this document |
| Everything else (rule bodies) | SYNTHESIS | 2026-08-17 | Drawn from established web-security practice; not independently re-verified per claim |

**Rule:** No source, spec, or CVE is invented. Where a claim is not live-verified it is marked `UNVERIFIED`.

---

# Section A — OWASP Top 10 mapping

This section maps the OWASP Top 10 (canonical URL https://owasp.org/Top10/, HTTP 200 on 2026-08-17; edition label UNVERIFIED) onto concrete rules. Detailed technique rules appear in later sections.

**SEC-001** / RULE: Treat the OWASP Top 10 as the baseline risk catalogue for any dynamic capability added to the repo.
RATIONALE: It is the widely adopted industry baseline; a Security Worker should map every new feature to at least one category.
APPLIES WHEN: Any new backend, form, API, or dynamic route is introduced.
DOES NOT APPLY WHEN: Pure static brochure site with no user input and no deploy secrets (most of the repo today).
VERIFICATION CHECK: Grep new feature specs for a referenced Top 10 category; CI comment required.
SEVERITY: Informational
SOURCE: https://owasp.org/Top10/ (verified HTTP 200, 2026-08-17); edition UNVERIFIED.

**SEC-002** / RULE (A01 Broken Access Control): Every route/action that reads or mutates data MUST have an explicit authorization check; absence is a defect.
RATIONALE: Broken access control is the #1 category in the OWASP Top 10.
APPLIES WHEN: A backend or API exists (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No backend (current repo state).
VERIFICATION CHECK: Static analysis flag any handler without an authz guard; manual review.
SEVERITY: Critical (when backend exists)
SOURCE: OWASP Top 10 A01; UNVERIFIED edition.

**SEC-003** / RULE (A02 Cryptographic Failures): Never transmit or store sensitive data without TLS in transit and documented encryption at rest.
RATIONALE: Plaintext secrets/credentials are a primary breach vector.
APPLIES WHEN: Any secret, PII, or credential is handled (FORWARD-LOOKING for backend; applies now to deploy/env handling).
DOES NOT APPLY WHEN: No sensitive data in scope.
VERIFICATION CHECK: Config scan for plaintext secrets; TLS-only deploy check.
SEVERITY: Critical
SOURCE: OWASP Top 10 A02; UNVERIFIED edition.

**SEC-004** / RULE (A03 Injection): All interpreter inputs (SQL, NoSQL, OS command, LDAP, XPath) MUST use parameterisation or safe APIs.
RATIONALE: Injection remains a top risk across languages.
APPLIES WHEN: Any query/interpreter call exists (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No dynamic queries (current static repo).
VERIFICATION CHECK: Ban string-concatenated query builders; require prepared statements.
SEVERITY: Critical
SOURCE: OWASP Top 10 A03; UNVERIFIED edition.

**SEC-005** / RULE (A04 Insecure Design): Security requirements and abuse cases MUST be documented before building a feature, not bolted on after.
RATIONALE: Design-phase gaps are expensive to fix.
APPLIES WHEN: New feature design (FORWARD-LOOKING and process).
DOES NOT APPLY WHEN: Trivial static content.
VERIFICATION CHECK: Feature spec contains a "threats" subsection.
SEVERITY: High
SOURCE: OWASP Top 10 A04; UNVERIFIED edition.

**SEC-006** / RULE (A05 Security Misconfiguration): Ship secure-by-default config; disable verbose errors, directory listing, and default creds.
RATIONALE: Misconfig is the most common avoidable exposure.
APPLIES WHEN: Any server, framework, or deploy config exists.
DOES NOT APPLY WHEN: No config surface (current static repo, except deploy hook).
VERIFICATION CHECK: Config lint for `debug=true`, verbose error pages, open directories.
SEVERITY: High
SOURCE: OWASP Top 10 A05; UNVERIFIED edition.

**SEC-007** / RULE (A06 Vulnerable & Outdated Components): Maintain a lockfile and SCA scan; do not ship known-vulnerable deps.
RATIONALE: Supply-chain compromise is widespread.
APPLIES WHEN: Any dependency is added (applies now to build tooling).
DOES NOT APPLY WHEN: Zero dependencies (rare).
VERIFICATION CHECK: `npm audit` / `pip-audit` / SCA gate in CI; lockfile committed.
SEVERITY: High
SOURCE: OWASP Top 10 A06; UNVERIFIED edition.

**SEC-008** / RULE (A07 Identification & Authentication Failures): Enforce strong auth: no default creds, rate-limit login, secure session management.
RATIONALE: Credential attacks are ubiquitous.
APPLIES WHEN: Any login/identity system (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No auth (current repo).
VERIFICATION CHECK: Auth flow review; lockout + MFA where sensitive.
SEVERITY: Critical
SOURCE: OWASP Top 10 A07; UNVERIFIED edition.

**SEC-009** / RULE (A08 Software & Data Integrity Failures): Verify integrity of dependencies, updates, and deserialized data (signatures, provenance).
RATIONALE: Unsigned updates/deserialization enable RCE.
APPLIES WHEN: Any auto-update, plugin load, or untrusted deserialization (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No such mechanisms.
VERIFICATION CHECK: Require signed artifacts; ban unsafe deserialization.
SEVERITY: High
SOURCE: OWASP Top 10 A08; UNVERIFIED edition.

**SEC-010** / RULE (A09 Security Logging & Monitoring Failures): Log authz failures and security events; alert on anomalies.
RATIONALE: Undetected breaches persist for months.
APPLIES WHEN: A backend exists (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No backend.
VERIFICATION CHECK: Review that security events are logged to a tamper-evident sink.
SEVERITY: Medium
SOURCE: OWASP Top 10 A09; UNVERIFIED edition.

**SEC-011** / RULE (A10 SSRF): Server-side requests MUST validate and allowlist target URLs/schemes.
RATIONALE: SSRF reaches internal services and metadata endpoints.
APPLIES WHEN: Any server fetches user-supplied URLs (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No server-side fetch.
VERIFICATION CHECK: Allowlist check on fetch targets; block link-local/metadata IPs.
SEVERITY: Critical
SOURCE: OWASP Top 10 A10; UNVERIFIED edition.

---

# Section B — XSS, DOM XSS, CSP, Trusted Types

**SEC-012** / RULE: Never interpolate untrusted data into HTML, attributes, JS, or CSS contexts without context-aware encoding.
RATIONALE: XSS lets attackers execute script in victims' browsers.
APPLIES WHEN: Any dynamic HTML/JS is emitted (FORWARD-LOOKING for JS; the static renderer must still encode any data it templates).
DOES NOT APPLY WHEN: Truly static markup with no interpolated values.
VERIFICATION CHECK: Renderer must HTML-encode interpolated text; flag raw interpolation.
SEVERITY: High
SOURCE: OWASP XSS; UNVERIFIED edition.

**SEC-013** / RULE: For the static renderer, all templated text MUST be HTML-escaped by default; opt-out requires explicit review.
RATIONALE: Even static sites template titles, metadata, and content; unescaped content is reflected XSS.
APPLIES WHEN: `lib/render/` interpolates any variable into output.
DOES NOT APPLY WHEN: Literal constant strings only.
VERIFICATION CHECK: Unit test asserting `<`, `&`, `"` are escaped in rendered output.
SEVERITY: High
SOURCE: Synthesis from established practice (UNVERIFIED per-claim).

**SEC-014** / RULE: Avoid DOM-XSS sinks (`innerHTML`, `outerHTML`, `document.write`, `insertAdjacentHTML`, `eval`-based assignment) for untrusted data.
RATIONALE: DOM XSS executes without a server round-trip.
APPLIES WHEN: Any client JS is introduced (currently off by default).
DOES NOT APPLY WHEN: No JS (current default).
VERIFICATION CHECK: Lint ban on `innerHTML`/`document.write` with non-constant args.
SEVERITY: High
SOURCE: MDN DOM XSS guidance; UNVERIFIED per-claim.

**SEC-015** / RULE: Emit a Content-Security-Policy that defaults to `default-src 'self'` and blocks inline scripts/styles unless strictly required.
RATIONALE: CSP is the principal defense-in-depth against XSS.
APPLIES WHEN: Any HTML is served (applies now as a deploy header / meta).
DOES NOT APPLY WHEN: Never (recommended universally).
VERIFICATION CHECK: Response/header contains CSP; `script-src` lacks `'unsafe-inline'` where avoidable.
SEVERITY: Medium (defense-in-depth)
SOURCE: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP (verified HTTP 200, 2026-08-17).

**SEC-016** / RULE: Use CSP `nonce` or hash-based `script-src` instead of `'unsafe-inline'` when inline scripts are unavoidable.
RATIONALE: Nonces/hashes preserve CSP strength while allowing needed inline code.
APPLIES WHEN: Inline scripts exist.
DOES NOT APPLY WHEN: External script files only (preferred).
VERIFICATION CHECK: CSP `script-src` uses `'nonce-...'` or `'sha256-...'`; no `'unsafe-inline'`.
SEVERITY: Medium
SOURCE: MDN CSP guide (verified 2026-08-17).

**SEC-017** / RULE: Deploy CSP with `report-only` first, then enforce, to avoid breaking legitimate content.
RATIONALE: Sudden strict CSP can break sites; staged rollout prevents outages.
APPLIES WHEN: Enabling CSP on an existing site.
DOES NOT APPLY WHEN: Greenfield site designed CSP-first.
VERIFICATION CHECK: History shows `Content-Security-Policy-Report-Only` phase before enforce.
SEVERITY: Low
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-018** / RULE: Adopt Trusted Types to eliminate DOM-XSS sinks by forbidding assignment to dangerous DOM sinks without a vetted policy.
RATIONALE: Trusted Types makes `innerHTML`/`script` injection structurally impossible.
APPLIES WHEN: Client JS uses DOM sinks (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No JS.
VERIFICATION CHECK: `require-trusted-types-for 'script'` present; sinks use `trustedTypes`.
SEVERITY: Medium
SOURCE: https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API (verified HTTP 200, 2026-08-17).

**SEC-019** / RULE: Set `X-Content-Type-Options: nosniff` so browsers do not MIME-sniff away CSP/type protections.
RATIONALE: MIME sniffing can execute attacker-controlled content as script.
APPLIES WHEN: Serving any content (applies now at deploy).
DOES NOT APPLY WHEN: Never.
VERIFICATION CHECK: Header present with `nosniff`.
SEVERITY: Low
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-020** / RULE: Encode data for the correct parser context (HTML body, attribute, JS string, CSS, URL) — a single escaper is insufficient.
RATIONALE: Wrong-context encoding is a classic XSS bypass.
APPLIES WHEN: Multiple interpolation contexts exist.
DOES NOT APPLY WHEN: Single HTML-text context only.
VERIFICATION CHECK: Renderer uses context-specific encoders.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-021** / RULE: Sanitize rich/HTML user content with a vetted allowlist sanitizer (e.g. DOMPurify-equivalent) — never a denylist.
RATIONALE: Denylists are trivially bypassed.
APPLIES WHEN: User-supplied HTML is rendered (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Plain text only.
VERIFICATION CHECK: Sanitizer dependency present and used; no hand-rolled strip.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-022** / RULE: Avoid reflecting user input in error messages or URLs that are later rendered without encoding.
RATIONALE: Reflected input is the XSS delivery vector.
APPLIES WHEN: Any input is echoed back (FORWARD-LOOKING for forms).
DOES NOT APPLY WHEN: No input reflection.
VERIFICATION CHECK: Review templates for echoed request values.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-023** / RULE: Set `frame-ancestors 'none'` (or specific origins) via CSP to prevent clickjacking.
RATIONALE: Clickjacking overlays UI to trick users.
APPLIES WHEN: Any interactive page (applies now).
DOES NOT APPLY WHEN: Never (recommended).
VERIFICATION CHECK: CSP `frame-ancestors` set; deprecated `X-Frame-Options` also acceptable.
SEVERITY: Medium
SOURCE: MDN CSP guide (verified 2026-08-17).

**SEC-024** / RULE: For JSON endpoints consumed cross-origin, set correct `Content-Type: application/json` and avoid `text/html` to prevent content sniffing.
RATIONALE: Wrong content-type enables sniffing-based XSS.
APPLIES WHEN: API returns JSON (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No API.
VERIFICATION CHECK: Response content-type matches payload.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-025** / RULE: Prefer server-side / build-time rendering of trusted content; if client hydration is added, isolate untrusted data from DOM sinks.
RATIONALE: Reduces attack surface versus runtime DOM writes.
APPLIES WHEN: Any client JS added.
DOES NOT APPLY WHEN: No JS.
VERIFICATION CHECK: Architecture review of data flow to DOM.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

---

# Section C — CSRF

**SEC-026** / RULE: State-changing requests MUST be protected against CSRF via SameSite cookies plus a token or origin check.
RATIONALE: CSRF forces authenticated users to perform unwanted actions.
APPLIES WHEN: Authenticated state-changing endpoints exist (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No auth/session (current repo).
VERIFICATION CHECK: Mutations require CSRF token or verified `Origin`/`X-Requested-With`; `SameSite=Lax/Strict` set.
SEVERITY: High
SOURCE: OWASP CSRF; UNVERIFIED edition.

**SEC-027** / RULE: Use `SameSite=Lax` (or `Strict`) on session cookies as baseline CSRF defense.
RATIONALE: SameSite blocks cross-site credential submission for top-level navigations/unsafe methods.
APPLIES WHEN: Any cookie set (FORWARD-LOOKING for session; relevant to deploy).
DOES NOT APPLY WHEN: No cookies.
VERIFICATION CHECK: Set-Cookie includes `SameSite`.
SEVERITY: Medium
SOURCE: MDN Set-Cookie (verified 2026-08-17).

**SEC-028** / RULE: For sensitive actions, require a non-cookie token (double-submit or synchronizer) in addition to SameSite.
RATIONALE: SameSite has bypasses (some browsers, Lax+POST); defense-in-depth needed.
APPLIES WHEN: High-value mutations (payments, account change) (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Read-only or low-value.
VERIFICATION CHECK: Token validated server-side on mutations.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-029** / RULE: Verify the `Origin` header (or `Referer` fallback) on state-changing requests and reject mismatches.
RATIONALE: Origin check is a robust CSRF mitigation.
APPLIES WHEN: Server handles mutations (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No server.
VERIFICATION CHECK: Server rejects requests whose Origin is not an allowed host.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-030** / RULE: Do not use GET for state-changing operations.
RATIONALE: GET requests are pre-flighted/cached and easily CSRF-triggered via `<img>`/links.
APPLIES WHEN: Any API/route design (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Read-only.
VERIFICATION CHECK: Lint: no mutation side-effects in GET handlers.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

---

# Section D — SSRF

**SEC-031** / RULE: Validate and allowlist outbound request targets; reject non-HTTP(S) schemes and private/link-local ranges.
RATIONALE: SSRF reaches cloud metadata (169.254.169.254) and internal services.
APPLIES WHEN: Server fetches user-controlled URLs (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No server-side fetch.
VERIFICATION CHECK: Resolver blocks RFC1918/loopback/link-local; scheme allowlist = http/https.
SEVERITY: Critical
SOURCE: OWASP SSRF; UNVERIFIED edition.

**SEC-032** / RULE: Resolve DNS and re-check the resolved IP against the allowlist before connecting (TOCTOU defense).
RATIONALE: DNS rebinding evades pre-resolve checks.
APPLIES WHEN: Dynamic outbound fetch (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No fetch.
VERIFICATION CHECK: Connect to validated resolved IP; deny on mismatch.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-033** / RULE: Block access to cloud instance metadata endpoints from application code paths.
RATIONALE: Metadata endpoints leak IAM credentials.
APPLIES WHEN: App runs in cloud with metadata service (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No cloud metadata exposure.
VERIFICATION CHECK: IMDSv2 required; app egress to 169.254.169.254 denied.
SEVERITY: Critical
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-034** / RULE: Apply an egress firewall / network policy so the app cannot reach internal ranges even if app-level checks fail.
RATIONALE: Defense-in-depth beyond app logic.
APPLIES WHEN: Backend deployed (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No backend.
VERIFICATION CHECK: Network policy reviewed.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-035** / RULE: Do not return raw upstream responses/errors that may leak internal topology.
RATIONALE: SSRF responses can map internal network.
APPLIES WHEN: Proxying/fetching external then returning content (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No proxying.
VERIFICATION CHECK: Responses sanitized; internal details stripped.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

---

# Section E — SQL / NoSQL Injection

**SEC-036** / RULE: Use parameterised queries / prepared statements for 100% of database access.
RATIONALE: Parameterisation separates code from data, defeating injection.
APPLIES WHEN: Any DB query (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No DB.
VERIFICATION CHECK: No string-concatenated SQL; ORM/prepare used.
SEVERITY: Critical
SOURCE: OWASP Injection; UNVERIFIED edition.

**SEC-037** / RULE: For NoSQL, use query builders that bind values as data, not as query operators/objects.
RATIONALE: NoSQL injection manipulates query objects (e.g. `$gt`).
APPLIES WHEN: NoSQL store used (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No NoSQL.
VERIFICATION CHECK: User input never becomes a query operator key.
SEVERITY: Critical
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-038** / RULE: Validate and strictly type input at the boundary before it reaches a query.
RATIONALE: Type/format validation reduces injection surface.
APPLIES WHEN: Any input feeds a data store (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No input to store.
VERIFICATION CHECK: Schema validation at entry; reject unexpected types.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-039** / RULE: Apply least-privilege DB accounts; the app user must not have DDL/admin rights.
RATIONALE: Limits blast radius if injection occurs.
APPLIES WHEN: DB access exists (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No DB.
VERIFICATION CHECK: App DB role lacks `DROP`/`CREATE`/superuser.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-040** / RULE: Escape/encode LIKE and order-by inputs; do not build them via raw concatenation.
RATIONALE: LIKE wildcards and sort columns are injection-prone.
APPLIES WHEN: Dynamic sorting/search (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Fixed queries.
VERIFICATION CHECK: Sort column from allowlist; wildcards escaped.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-041** / RULE: Avoid dynamic table/column names from user input; use server-side allowlists.
RATIONALE: Identifiers cannot be parameterised.
APPLIES WHEN: Dynamic schema references (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Static schema.
VERIFICATION CHECK: Identifier drawn from constant allowlist.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-042** / RULE: Log and alert on injection-pattern attempts at the WAF/query layer.
RATIONALE: Detection limits dwell time.
APPLIES WHEN: Backend with DB (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No DB.
VERIFICATION CHECK: Logging of malformed queries.
SEVERITY: Low
SOURCE: OWASP Logging; UNVERIFIED edition.

---

# Section F — Authentication

**SEC-043** / RULE: Enforce minimum password/secret strength and secure storage (bcrypt/argon2/scrypt, never plaintext or fast hashes).
RATIONALE: Weak storage enables mass credential theft.
APPLIES WHEN: Any credential storage (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No credentials.
VERIFICATION CHECK: Hashing algo is memory-hard; no MD5/SHA1/plaintext.
SEVERITY: Critical
SOURCE: OWASP Auth; UNVERIFIED edition.

**SEC-044** / RULE: Implement rate limiting and lockout on authentication endpoints to stop brute force.
RATIONALE: Unlimited attempts enable credential stuffing.
APPLIES WHEN: Login exists (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No login.
VERIFICATION CHECK: Throttle by IP + account; progressive delay.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-045** / RULE: Support and encourage MFA for sensitive accounts.
RATIONALE: MFA neutralizes stolen-password attacks.
APPLIES WHEN: Account with sensitive data (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No accounts.
VERIFICATION CHECK: MFA enrollable for privileged roles.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-046** / RULE: Use secure, HttpOnly, SameSite session cookies; never put session tokens in URLs.
RATIONALE: URL tokens leak via logs/Referer.
APPLIES WHEN: Session auth (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No sessions.
VERIFICATION CHECK: Token in cookie with flags; absent from URL.
SEVERITY: High
SOURCE: MDN Set-Cookie (verified 2026-08-17).

**SEC-047** / RULE: Implement secure password reset without account enumeration (uniform responses).
RATIONALE: Reset flows leak valid accounts.
APPLIES WHEN: Reset feature (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No reset.
VERIFICATION CHECK: Same response for existent/nonexistent accounts.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-048** / RULE: Enforce session timeout and re-authentication for sensitive actions.
RATIONALE: Limits stolen-session window.
APPLIES WHEN: Authenticated sessions (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No sessions.
VERIFICATION CHECK: Idle/time absolute expiry; step-up auth.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-049** / RULE: Use a vetted identity library rather than hand-rolled crypto for auth.
RATIONALE: Homegrown auth is routinely broken.
APPLIES WHEN: Implementing auth (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Delegating to managed IdP only.
VERIFICATION CHECK: Auth via maintained library/IdP.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-050** / RULE: Rotate and invalidate sessions on privilege change and logout.
RATIONALE: Stale sessions are a persistence risk.
APPLIES WHEN: Session auth (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No sessions.
VERIFICATION CHECK: Server invalidates token on logout/role change.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

---

# Section G — Authorization

**SEC-051** / RULE: Enforce authorization on every access-controlled operation, server-side (not just hidden UI).
RATIONALE: Client-side hiding is not a control.
APPLIES WHEN: Any protected resource (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No protected resources.
VERIFICATION CHECK: Each handler checks caller's rights; UI hiding insufficient.
SEVERITY: Critical
SOURCE: OWASP A01; UNVERIFIED edition.

**SEC-052** / RULE: Apply deny-by-default: access granted only by explicit policy.
RATIONALE: Default-allow leaks resources.
APPLIES WHEN: Any authorization layer (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No authz.
VERIFICATION CHECK: Default deny in policy engine.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-053** / RULE: Use direct object reference checks (verify ownership) to prevent IDOR.
RATIONALE: Predictable IDs let attackers access others' data.
APPLIES WHEN: Resource IDs in URLs/params (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No per-user resources.
VERIFICATION CHECK: Ownership verified before returning resource.
SEVERITY: Critical
SOURCE: OWASP A01; UNVERIFIED edition.

**SEC-054** / RULE: Separate roles/permissions (RBAC) and least privilege for admin functions.
RATIONALE: Over-broad roles widen impact.
APPLIES WHEN: Multiple privilege tiers (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Single tier.
VERIFICATION CHECK: Admin routes require admin role.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-055** / RULE: Validate authorization on the server even for same-origin API calls.
RATIONALE: XHR/fetch calls are attacker-controllable.
APPLIES WHEN: API + authz (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No API.
VERIFICATION CHECK: API handlers re-check authz.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-056** / RULE: Log authorization failures as security events.
RATIONALE: Failed authz attempts indicate probing.
APPLIES WHEN: Authz layer (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No authz.
VERIFICATION CHECK: Failures logged with context.
SEVERITY: Low
SOURCE: OWASP Logging; UNVERIFIED edition.

---

# Section H — Secrets Handling

**SEC-057** / RULE: No secret (API key, token, private key, DB password) may be committed to the repository.
RATIONALE: Committed secrets are permanently exposed in history.
APPLIES WHEN: Any secret exists (applies NOW to deploy/env).
DOES NOT APPLY WHEN: Never (always applies).
VERIFICATION CHECK: Secret scanner (gitleaks/trufflehog) in CI + pre-commit; no matches.
SEVERITY: Critical
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-058** / RULE: Secrets MUST come from environment variables or a secrets manager, never hardcoded literals.
RATIONALE: Hardcoding forces secrets into source and images.
APPLIES WHEN: Code needs a secret (FORWARD-LOOKING; deploy hook now).
DOES NOT APPLY WHEN: No secret needed.
VERIFICATION CHECK: No literal credential strings; `process.env`/manager lookup.
SEVERITY: Critical
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-059** / RULE: Never ship secrets in client bundles or static assets.
RATIONALE: Client code is public; any embedded secret is leaked.
APPLIES WHEN: Any client JS/asset (current default no-JS still relevant if added).
DOES NOT APPLY WHEN: No client secret use.
VERIFICATION CHECK: Bundle scan for key/token patterns.
SEVERITY: Critical
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-060** / RULE: Separate secrets per environment (dev/staging/prod); never reuse production secrets elsewhere.
RATIONALE: Reuse widens blast radius.
APPLIES WHEN: Multiple environments (applies to deploy).
DOES NOT APPLY WHEN: Single environment.
VERIFICATION CHECK: Env-specific secret references; no prod secret in dev config.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-061** / RULE: Rotate secrets on suspicion of exposure and support rotation without code changes.
RATIONALE: Un-rotatable secrets linger after leaks.
APPLIES WHEN: Any long-lived secret (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Ephemeral/short-lived tokens only.
VERIFICATION CHECK: Rotation procedure documented; no code edit required.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-062** / RULE: Restrict secret visibility via least-privilege IAM and audit secret access.
RATIONALE: Insider/thieved access is a vector.
APPLIES WHEN: Secrets manager in use (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No secret store.
VERIFICATION CHECK: Access logs reviewed; minimal grant.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

---

# Section I — Rate Limiting

**SEC-063** / RULE: Apply rate limiting on auth, form-submit, and API endpoints keyed by identity/IP.
RATIONALE: Throttling stops abuse, scraping, and brute force.
APPLIES WHEN: Any publicly reachable endpoint (FORWARD-LOOKING; CDN/WAF now).
DOES NOT APPLY WHEN: Fully static, no endpoints.
VERIFICATION CHECK: Limits configured; 429 returned when exceeded.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-064** / RULE: Use a shared, atomic counter (e.g. Redis/token-bucket) so limits hold across instances.
RATIONALE: Per-instance limits are bypassable by spreading requests.
APPLIES WHEN: Multiple app instances (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Single instance.
VERIFICATION CHECK: Counter stored centrally.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-065** / RULE: Return `429` with `Retry-After` and avoid leaking remaining quota unnecessarily.
RATIONALE: Clear signal aids clients; over-disclosure aids attackers.
APPLIES WHEN: Rate limiting active (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No limiting.
VERIFICATION CHECK: 429 + Retry-After present.
SEVERITY: Low
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-066** / RULE: Distinguish anonymous vs authenticated limits (authenticated may be higher).
RATIONALE: Fairness and abuse control.
APPLIES WHEN: Mixed traffic (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Uniform traffic.
VERIFICATION CHECK: Separate buckets by auth state.
SEVERITY: Low
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-067** / RULE: Protect expensive operations (search, export, render) with stricter limits.
RATIONALE: Cost-based DoS via heavy endpoints.
APPLIES WHEN: Compute-heavy endpoints (FORWARD-LOOKING; build/render now).
DOES NOT APPLY WHEN: Cheap endpoints only.
VERIFICATION CHECK: Heavy routes have own caps.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

---

# Section J — File Uploads

**SEC-068** / RULE: Validate uploads by content-type AND real file signature (magic bytes), not extension only.
RATIONALE: Extension checks are spoofable.
APPLIES WHEN: Any upload endpoint (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No uploads.
VERIFICATION CHECK: Server reads first bytes; rejects mismatch.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-069** / RULE: Store uploads outside the web root / serve via a non-executing handler; never allow direct script execution.
RATIONALE: Uploaded files can become RCE if executed.
APPLIES WHEN: File storage served (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No uploads.
VERIFICATION CHECK: Upload dir not executable; served as attachment.
SEVERITY: Critical
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-070** / RULE: Enforce max size and count limits; reject oversized payloads before processing.
RATIONALE: Large uploads are a DoS vector.
APPLIES WHEN: Uploads (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No uploads.
VERIFICATION CHECK: Server rejects > limit pre-parse.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-071** / RULE: Generate random filenames; never use user-supplied names (path traversal / overwrite).
RATIONALE: User names enable `../` traversal and collisions.
APPLIES WHEN: Storing uploads (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No uploads.
VERIFICATION CHECK: Server-side random name; user name discarded.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-072** / RULE: Scan uploads for malware where feasible.
RATIONALE: Uploads are an infection channel.
APPLIES WHEN: Untrusted uploads (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Trusted/internal only.
VERIFICATION CHECK: AV scan in pipeline.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-073** / RULE: Set `Content-Disposition: attachment` and restrictive CSP when serving user files.
RATIONALE: Prevents files from executing in app origin.
APPLIES WHEN: Serving uploads (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No uploads.
VERIFICATION CHECK: Attachment header present.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

---

# Section K — Sessions

**SEC-074** / RULE: Generate session IDs with a CSPRNG; never predictable/sequential IDs.
RATIONALE: Predictable IDs enable session fixation/hijack.
APPLIES WHEN: Session management (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No sessions.
VERIFICATION CHECK: ID entropy >=128 bits from CSPRNG.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-075** / RULE: Bind sessions to client attributes (IP/UA) and rotate ID on privilege change.
RATIONALE: Reduces hijack utility.
APPLIES WHEN: Sessions (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No sessions.
VERIFICATION CHECK: Binding verified; ID rotated.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-076** / RULE: Store session state server-side or in signed/encrypted tokens (e.g. JWT with verifiable signature + expiry).
RATIONALE: Tamperable client state is a control bypass.
APPLIES WHEN: Token-based auth (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No sessions.
VERIFICATION CHECK: Token signature verified; no trust of unsigned claims.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-077** / RULE: Enforce absolute and idle timeouts; allow explicit logout that invalidates server-side.
RATIONALE: Limits stolen-session lifetime.
APPLIES WHEN: Sessions (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No sessions.
VERIFICATION CHECK: Timeouts configured; logout invalidates.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-078** / RULE: Regenerate session ID after login to defeat fixation.
RATIONALE: Fixation reuses pre-auth ID post-login.
APPLIES WHEN: Login flows (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No login.
VERIFICATION CHECK: New ID issued at auth.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-079** / RULE: Transmit session cookies only over HTTPS and mark Secure.
RATIONALE: Plaintext cookies are sniffable.
APPLIES WHEN: Any session cookie (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No cookies.
VERIFICATION CHECK: `Secure` flag set; HTTPS enforced.
SEVERITY: High
SOURCE: MDN Set-Cookie (verified 2026-08-17).

---

# Section L — Cookies (SameSite / Secure / HttpOnly / Partitioned)

**SEC-080** / RULE: Mark session/auth cookies `HttpOnly` so JS cannot read them (mitigates XSS token theft).
RATIONALE: Script cannot exfiltrate HttpOnly cookies.
APPLIES WHEN: Any sensitive cookie (FORWARD-LOOKING; deploy now).
DOES NOT APPLY WHEN: No sensitive cookies.
VERIFICATION CHECK: `HttpOnly` present.
SEVERITY: High
SOURCE: MDN Set-Cookie (verified 2026-08-17).

**SEC-081** / RULE: Mark cookies `Secure` so they never traverse HTTP.
RATIONALE: Prevents plaintext exposure.
APPLIES WHEN: Any cookie (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No cookies.
VERIFICATION CHECK: `Secure` present.
SEVERITY: High
SOURCE: MDN Set-Cookie (verified 2026-08-17).

**SEC-082** / RULE: Set `SameSite` (Lax default, Strict for sensitive) to contain CSRF.
RATIONALE: Restricts cross-site sending.
APPLIES WHEN: Any cookie (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No cookies.
VERIFICATION CHECK: `SameSite` present and appropriate.
SEVERITY: Medium
SOURCE: MDN Set-Cookie (verified 2026-08-17).

**SEC-083** / RULE: Consider `Partitioned` (CHIPS) for cookies used in third-party/embedded contexts.
RATIONALE: Partitioning isolates cookies per top-level site, reducing cross-site tracking/abuse.
APPLIES WHEN: Cookies set in embedded/iframes (FORWARD-LOOKING).
DOES NOT APPLY WHEN: First-party only.
VERIFICATION CHECK: `Partitioned` flag where embedded.
SEVERITY: Low
SOURCE: MDN Set-Cookie (verified 2026-08-17); CHIPS spec UNVERIFIED.

**SEC-084** / RULE: Set explicit `Path`/`Domain` to the minimum scope needed.
RATIONALE: Over-broad scope widens exposure.
APPLIES WHEN: Cookies set (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No cookies.
VERIFICATION CHECK: Scope is minimal.
SEVERITY: Low
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-085** / RULE: Set a sensible `Max-Age`/expiry; avoid session cookies that never expire for sensitive data.
RATIONALE: Persistent sensitive cookies widen theft window.
APPLIES WHEN: Sensitive cookies (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No sensitive cookies.
VERIFICATION CHECK: Expiry bounded.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-086** / RULE: Avoid storing PII or secrets in cookies; keep payload minimal.
RATIONALE: Cookies are sent on every request.
APPLIES WHEN: Any cookie (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No cookies.
VERIFICATION CHECK: Cookie content reviewed; no PII/secret.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

---

# Section M — API Security

**SEC-087** / RULE: Enforce authentication and authorization on every API endpoint (deny-by-default).
RATIONALE: Open endpoints leak data.
APPLIES WHEN: Any API (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No API.
VERIFICATION CHECK: Each route has authz; public ones explicitly marked.
SEVERITY: Critical
SOURCE: OWASP API Security; UNVERIFIED.

**SEC-088** / RULE: Validate and schema-check all request bodies/params; reject extras.
RATIONALE: Unexpected fields enable mass-assignment/injection.
APPLIES WHEN: API with input (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No API.
VERIFICATION CHECK: Schema validation; unknown fields rejected.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-089** / RULE: Implement proper pagination and filtering to avoid uncontrolled data exposure (BOLA/Excessive Data Exposure).
RATIONALE: Returning full objects leaks fields.
APPLIES WHEN: List/detail APIs (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No API.
VERIFICATION CHECK: Response shape scoped to caller.
SEVERITY: High
SOURCE: OWASP API Top 10; UNVERIFIED.

**SEC-090** / RULE: Use correct, specific HTTP status codes and avoid verbose errors exposing internals.
RATIONALE: Leaky errors aid attackers.
APPLIES WHEN: Any API/error path (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No API.
VERIFICATION CHECK: Errors generic; details in logs only.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-091** / RULE: Apply CORS as narrowly as possible; never `Access-Control-Allow-Origin: *` with credentials.
RATIONALE: Wildcard + credentials = any site can call authenticated API.
APPLIES WHEN: Cross-origin API (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Same-origin only.
VERIFICATION CHECK: CORS allowlist explicit; no `*` with `Allow-Credentials: true`.
SEVERITY: Critical
SOURCE: MDN CORS; UNVERIFIED per-claim.

**SEC-092** / RULE: Version and deprecate APIs; avoid breaking/security fixes on live unversioned routes.
RATIONALE: Unversioned changes force insecure shortcuts.
APPLIES WHEN: Public API (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No API.
VERIFICATION CHECK: Versioned routes; deprecation policy.
SEVERITY: Low
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-093** / RULE: Rate-limit and quota APIs per key/identity.
RATIONALE: Abuse/cost control.
APPLIES WHEN: API (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No API.
VERIFICATION CHECK: Per-key quotas enforced.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-094** / RULE: Require and verify signatures/nonces on privileged or webhook endpoints.
RATIONALE: Unverified webhooks are spoofable.
APPLIES WHEN: Webhooks/callbacks (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No webhooks.
VERIFICATION CHECK: HMAC signature verified before processing.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

---

# Section N — Dependency Security

**SEC-095** / RULE: Commit a lockfile and reproduce installs from it (no floating versions in prod).
RATIONALE: Floating versions allow unexpected/vulnerable updates.
APPLIES WHEN: Any dependency (applies NOW to build tooling).
DOES NOT APPLY WHEN: Zero dependencies.
VERIFICATION CHECK: Lockfile present; CI installs `--frozen-lockfile`/equivalent.
SEVERITY: High
SOURCE: OWASP A06; UNVERIFIED edition.

**SEC-096** / RULE: Run SCA (software composition analysis) in CI; fail on high/critical known CVEs.
RATIONALE: Known-vulnerable deps are a top breach source.
APPLIES WHEN: Any dependency (applies NOW).
DOES NOT APPLY WHEN: Zero dependencies.
VERIFICATION CHECK: `npm audit`/`pip-audit`/SCA gate; non-zero on critical.
SEVERITY: High
SOURCE: OWASP A06; UNVERIFIED edition.

**SEC-097** / RULE: Prefer packages with verified provenance (signed releases, maintained, known publisher).
RATIONALE: Reduces supply-chain/typosquat risk.
APPLIES WHEN: Adding dependencies (applies NOW).
DOES NOT APPLY WHEN: No deps.
VERIFICATION CHECK: Package has maintainer reputation / sigstore/SLSA where available.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-098** / RULE: Ban installation of packages whose names are unverified/hallucinated; verify against a registry before use.
RATIONALE: Slopsquatting/hallucinated names pull malicious code (see SEC-124).
APPLIES WHEN: LLM-authored code adds imports (applies NOW to generated code).
DOES NOT APPLY WHEN: Hand-audited deps only.
VERIFICATION CHECK: Each imported package exists in the intended registry.
SEVERITY: Critical
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-099** / RULE: Minimize dependency count; prefer stdlib/trimmed alternatives.
RATIONALE: Fewer deps = smaller attack surface.
APPLIES WHEN: Any dependency decision (applies NOW).
DOES NOT APPLY WHEN: N/A.
VERIFICATION CHECK: Review justified; no redundant packages.
SEVERITY: Low
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-100** / RULE: Subscribe to advisories and patch promptly; track EOL of dependencies.
RATIONALE: Unpatched/EOL deps accumulate CVEs.
APPLIES WHEN: Any dependency (applies NOW).
DOES NOT APPLY WHEN: Zero deps.
VERIFICATION CHECK: Advisory feed; EOL monitored.
SEVERITY: Medium
SOURCE: OWASP A06; UNVERIFIED edition.

**SEC-101** / RULE: Pin and review transitive dependencies; they are as risky as direct ones.
RATIONALE: Most CVEs arrive transitively.
APPLIES WHEN: Any dependency tree (applies NOW).
DOES NOT APPLY WHEN: Zero deps.
VERIFICATION CHECK: Transitive tree scanned; overrides documented.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-102** / RULE: Use a private proxy/mirror for installs in CI to avoid registry hijack.
RATIONALE: Registry compromise can serve malicious versions.
APPLIES WHEN: CI installs (applies NOW).
DOES NOT APPLY WHEN: No CI installs.
VERIFICATION CHECK: Install source is controlled mirror.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

---

# Section O — Deployment Security

**SEC-103** / RULE: Emit security headers on every response: CSP, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`/CSP `frame-ancestors`, HSTS where HTTPS.
RATIONALE: Headers provide baseline browser protections.
APPLIES WHEN: Any HTTP response (applies NOW at deploy/the publish hook).
DOES NOT APPLY WHEN: Never (recommended universally).
VERIFICATION CHECK: Header scan on live site; all present.
SEVERITY: Medium
SOURCE: MDN CSP (verified 2026-08-17); others synthesis UNVERIFIED.

**SEC-104** / RULE: Enforce HTTPS/TLS for all traffic; redirect HTTP→HTTPS; enable HSTS.
RATIONALE: Plaintext transport exposes data and cookies.
APPLIES WHEN: Any deployment (applies NOW).
DOES NOT APPLY WHEN: Local-only offline.
VERIFICATION CHECK: HSTS present; HTTP redirects to HTTPS.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-105** / RULE: Use modern TLS configuration (TLS 1.2+; prefer 1.3; strong ciphers; valid certs).
RATIONALE: Weak TLS is decryptable/downgradable.
APPLIES WHEN: TLS termination (applies NOW).
DOES NOT APPLY WHEN: No TLS.
VERIFICATION CHECK: SSL Labs-style scan; no SSLv3/TLS1.0/1.1.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-106** / RULE: Separate environment configuration from code; never bake env into images/static.
RATIONALE: Env leakage crosses boundaries.
APPLIES WHEN: Any deploy (applies NOW to publish-run.ts).
DOES NOT APPLY WHEN: No env differences.
VERIFICATION CHECK: No env values in committed artifacts.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-107** / RULE: Apply least-privilege to the deploy/service account and CI.
RATIONALE: CI creds are high-value targets.
APPLIES WHEN: Deploy pipeline (applies NOW).
DOES NOT APPLY WHEN: No pipeline.
VERIFICATION CHECK: Deploy role minimal; secrets scoped.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-108** / RULE: Lock down the build/publish hook; it must not execute untrusted input as code.
RATIONALE: `scripts/publish-run.ts` is a code-execution point.
APPLIES WHEN: Running publish hook (applies NOW).
DOES NOT APPLY WHEN: No publish hook.
VERIFICATION CHECK: Hook inputs sanitized; no `eval` of external data.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-109** / RULE: Enable logging/monitoring of deploy and runtime; retain tamper-evident logs.
RATIONALE: Detects compromise and misconfig.
APPLIES WHEN: Any deployment (applies NOW).
DOES NOT APPLY WHEN: No deploy.
VERIFICATION CHECK: Logs shipped to protected sink.
SEVERITY: Medium
SOURCE: OWASP Logging; UNVERIFIED edition.

**SEC-110** / RULE: Restrict network exposure (firewall, private subnets) for any backend.
RATIONALE: Minimizes attack surface.
APPLIES WHEN: Backend deployed (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Static only.
VERIFICATION CHECK: Only intended ports open.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

---

# Section P — Privacy / GDPR-adjacent

**SEC-111** / RULE: Collect only necessary personal data (data minimization).
RATIONALE: Less data = less liability/breach impact.
APPLIES WHEN: Any PII collected (FORWARD-LOOKING; analytics now).
DOES NOT APPLY WHEN: No PII.
VERIFICATION CHECK: Data inventory; justification per field.
SEVERITY: Medium
SOURCE: GDPR Art.5(1)(c); UNVERIFIED per-claim.

**SEC-112** / RULE: Provide a lawful basis and clear notice/consent for tracking and PII.
RATIONALE: Legal requirement; user trust.
APPLIES WHEN: Analytics/cookies/PII (applies NOW if analytics used).
DOES NOT APPLY WHEN: No tracking/PII.
VERIFICATION CHECK: Consent banner; privacy policy linked.
SEVERITY: Medium
SOURCE: GDPR; UNVERIFIED per-claim.

**SEC-113** / RULE: Honor Do-Not-Track / Global Privacy Control signals where applicable.
RATIONALE: Respect user choice; some jurisdictions require it.
APPLIES WHEN: Tracking present (applies NOW if analytics).
DOES NOT APPLY WHEN: No tracking.
VERIFICATION CHECK: GPC honored server-side.
SEVERITY: Low
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-114** / RULE: Encrypt PII at rest and in transit.
RATIONALE: Breach containment.
APPLIES WHEN: PII stored (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No PII.
VERIFICATION CHECK: Encryption verified.
SEVERITY: High
SOURCE: GDPR Art.32; UNVERIFIED per-claim.

**SEC-115** / RULE: Implement data-subject rights (access, deletion, portability) workflows.
RATIONALE: Legal obligation.
APPLIES WHEN: PII of EU/regulated users (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No PII.
VERIFICATION CHECK: Deletion/export process exists.
SEVERITY: Medium
SOURCE: GDPR; UNVERIFIED per-claim.

**SEC-116** / RULE: Avoid embedding third-party trackers that exfiltrate user data without consent.
RATIONALE: Unconsented exfiltration is a violation.
APPLIES WHEN: Third-party scripts (applies NOW if added).
DOES NOT APPLY WHEN: No third parties.
VERIFICATION CHECK: Script inventory; consent gating.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-117** / RULE: Set a privacy-respecting `Referrer-Policy` (e.g. `strict-origin-when-cross-origin`).
RATIONALE: Full referrers leak URLs/paths.
APPLIES WHEN: Any deployment (applies NOW).
DOES NOT APPLY WHEN: Never.
VERIFICATION CHECK: Header present.
SEVERITY: Low
SOURCE: MDN; UNVERIFIED per-claim.

---

# Section Q — SECURITY OF AI-GENERATED CODE (K4 anti-knowledge focus)

This section is forward-looking and also applies NOW wherever LLM-authored code (including this repo's generated output) is reviewed. These are the patterns LLM-generated code most commonly gets wrong. They are K4 anti-knowledge: actively wrong, to be suppressed on sight.

**SEC-118** / RULE: Reject any generated code that writes untrusted data into `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, or React `dangerouslySetInnerHTML` without sanitization.
RATIONALE: These are the top XSS sinks; models reach for them to "just render."
APPLIES WHEN: Any client/rendered HTML from generated code (FORWARD-LOOKING; relevant if JS added).
DOES NOT APPLY WHEN: No DOM write of dynamic data.
VERIFICATION CHECK: Lint flags sink + non-constant arg; require sanitizer/Trusted Types.
SEVERITY: High
SOURCE: Synthesis from observed LLM failure modes (UNVERIFIED per-claim).

**SEC-119** / RULE: Reject string-concatenated SQL/NoSQL in generated code; require parameterised queries / ORM.
RATIONALE: Models emit `"SELECT * FROM t WHERE id=" + id` routinely.
APPLIES WHEN: Generated data-access code (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No DB code.
VERIFICATION CHECK: Static scan: no `+`/template-literal building of query strings with variables.
SEVERITY: Critical
SOURCE: Synthesis from observed LLM failure modes (UNVERIFIED per-claim).

**SEC-120** / RULE: Reject generated routes/handlers that perform an action without an explicit authorization check.
RATIONALE: Models implement happy-path handlers and omit authz.
APPLIES WHEN: Generated server/API routes (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No routes.
VERIFICATION CHECK: Each handler references an authz guard; absent → fail.
SEVERITY: Critical
SOURCE: Synthesis from observed LLM failure modes (UNVERIFIED per-claim).

**SEC-121** / RULE: Reject generated code that commits or embeds secrets (hardcoded keys, `.env` with values, tokens in client bundle).
RATIONALE: Models invent plausible-looking keys and paste them inline.
APPLIES WHEN: Any generated code touching secrets (applies NOW to generated output).
DOES NOT APPLY WHEN: No secrets.
VERIFICATION CHECK: Secret scanner on generated diffs; no literals.
SEVERITY: Critical
SOURCE: Synthesis from observed LLM failure modes (UNVERIFIED per-claim).

**SEC-122** / RULE: Reject generated CORS config with `Access-Control-Allow-Origin: *` combined with `Access-Control-Allow-Credentials: true`.
RATIONALE: Wildcard-with-credentials lets any origin read authenticated responses; models copy it from old snippets.
APPLIES WHEN: Generated cross-origin API config (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Same-origin only.
VERIFICATION CHECK: Lint: reject `*` + credentials pair.
SEVERITY: Critical
SOURCE: MDN CORS (UNVERIFIED per-claim); synthesis.

**SEC-123** / RULE: Reject generated code that disables TLS/certificate verification (`NODE_TLS_REJECT_UNAUTHORIZED=0`, `verify=False`, `InsecureSkipVerify`).
RATIONALE: Models add this to "fix" cert errors; it removes all transport security.
APPLIES WHEN: Generated network/client code (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No TLS code.
VERIFICATION CHECK: Grep bans the disable flags.
SEVERITY: Critical
SOURCE: Synthesis from observed LLM failure modes (UNVERIFIED per-claim).

**SEC-124** / RULE: Reject generated imports/dependencies that are not verified to exist in the intended registry (slopsquatting / hallucinated package names).
RATIONALE: Models fabricate package names (e.g. `npm i react-hooks-utils`); installing them pulls attacker code.
APPLIES WHEN: Any generated `import`/install statement (applies NOW).
DOES NOT APPLY WHEN: Stdlib-only code.
VERIFICATION CHECK: Each package name resolved against the registry before install.
SEVERITY: Critical
SOURCE: Synthesis from observed LLM failure modes (slopsquatting); UNVERIFIED per-claim.

**SEC-125** / RULE: Reject generated use of outdated/deprecated packages pinned to known-vulnerable versions.
RATIONALE: Models prefer familiar old versions with CVEs.
APPLIES WHEN: Generated dependency manifests (applies NOW).
DOES NOT APPLY WHEN: No deps.
VERIFICATION CHECK: SCA on generated manifest; fail on known CVEs.
SEVERITY: High
SOURCE: OWASP A06; UNVERIFIED edition.

**SEC-126** / RULE: Reject generated unvalidated redirects/forwards using user input (`redirect=` param, `Location` from input).
RATIONALE: Open redirects enable phishing; models build them naively.
APPLIES WHEN: Generated redirect logic (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No redirects.
VERIFICATION CHECK: Redirect target from allowlist; rejects external/relative abuse.
SEVERITY: Medium
SOURCE: OWASP Unvalidated Redirect; UNVERIFIED per-claim.

**SEC-127** / RULE: Reject generated endpoints lacking rate limiting on auth/expensive routes.
RATIONALE: Models omit throttling; enables brute force/abuse.
APPLIES WHEN: Generated public endpoints (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No endpoints.
VERIFICATION CHECK: Auth/expensive routes have limiter; absent → flag.
SEVERITY: Medium
SOURCE: Synthesis from observed LLM failure modes (UNVERIFIED per-claim).

**SEC-128** / RULE: Reject generated verbose error handling that returns stack traces / internal detail to clients.
RATIONALE: Models `res.send(err.stack)` for convenience; leaks internals.
APPLIES WHEN: Generated error handlers (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No error responses.
VERIFICATION CHECK: Lint: no stack/err object in client response; generic message only.
SEVERITY: Medium
SOURCE: Synthesis from observed LLM failure modes (UNVERIFIED per-claim).

**SEC-129** / RULE: Reject generated tokens/secrets built with weak randomness (`Math.random()`, `Date.now()`, predictable sequences).
RATIONALE: Models use `Math.random()` for tokens; trivially guessable.
APPLIES WHEN: Generated token/session/ID generation (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No token generation.
VERIFICATION CHECK: Uses CSPRNG (`crypto.randomBytes`/`randomUUID`); no `Math.random` for secrets.
SEVERITY: High
SOURCE: Synthesis from observed LLM failure modes (UNVERIFIED per-claim).

**SEC-130** / RULE: Reject generated unsafe deserialization (`eval(JSON)` is fine, but `yaml.load` on untrusted, `pickle.loads` of untrusted, `new Function`, `vm` on input).
RATIONALE: Untrusted deserialization → RCE; models use `eval` to parse.
APPLIES WHEN: Generated parsing of untrusted data (FORWARD-LOOKING).
DOES NOT APPLY WHEN: Trusted-only data.
VERIFICATION CHECK: Ban `eval`/`Function`/`pickle`/`yaml.load` on untrusted input.
SEVERITY: Critical
SOURCE: Synthesis from observed LLM failure modes (UNVERIFIED per-claim).

**SEC-131** / RULE: Reject generated `eval`/`setTimeout(string)`/`setInterval(string)`/`new Function` usage on any dynamic data.
RATIONALE: eval-family is arbitrary code execution; models use it for "dynamic" behavior.
APPLIES WHEN: Any generated dynamic execution (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No dynamic eval.
VERIFICATION CHECK: Lint bans eval-family with non-constant args.
SEVERITY: Critical
SOURCE: Synthesis from observed LLM failure modes (UNVERIFIED per-claim).

**SEC-132** / RULE: Require human security review of any generated code that touches auth, payments, or secrets — never auto-merge LLM security-sensitive output.
RATIONALE: Models are unreliable on security-critical logic; autonomy here is dangerous.
APPLIES WHEN: Generated auth/payment/secret code (applies NOW + FORWARD-LOOKING).
DOES NOT APPLY WHEN: Trivial presentational code.
VERIFICATION CHECK: PR gate requires security reviewer sign-off.
SEVERITY: High
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-133** / RULE: Reject generated regex used for validation/security that is ReDoS-prone (nested quantifiers on adversarial input).
RATIONALE: Models write catastrophic-backtracking regexes; DoS vector.
APPLIES WHEN: Generated validation regex (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No regex validation.
VERIFICATION CHECK: Static ReDoS analysis on validation regexes.
SEVERITY: Medium
SOURCE: Synthesis (UNVERIFIED per-claim).

**SEC-134** / RULE: Reject generated path handling that concatenates user input into filesystem paths without normalization/allowlist.
RATIONALE: Path traversal (`../../`) is a classic; models build paths by string join.
APPLIES WHEN: Generated file/route path logic (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No path construction.
VERIFICATION CHECK: Resolve + ensure within base dir; reject `..`.
SEVERITY: High
SOURCE: Synthesis from observed LLM failure modes (UNVERIFIED per-claim).

**SEC-135** / RULE: Reject generated code that disables security middleware "to make it work" (CSP off, helmet removed, CORS opened).
RATIONALE: Models silence failing security controls instead of fixing root cause.
APPLIES WHEN: Generated config/middleware (applies NOW + FORWARD-LOOKING).
DOES NOT APPLY WHEN: No such middleware.
VERIFICATION CHECK: Diff review: no removed/disabled security headers/middleware.
SEVERITY: High
SOURCE: Synthesis from observed LLM failure modes (UNVERIFIED per-claim).

**SEC-136** / RULE: Reject generated client-side enforcement of authorization (hiding buttons/endpoints) as a substitute for server-side checks.
RATIONALE: Client checks are not controls; models hide UI and call it "secured."
APPLIES WHEN: Generated access-control code (FORWARD-LOOKING).
DOES NOT APPLY WHEN: No access control.
VERIFICATION CHECK: Authorization present server-side; UI hiding alone rejected.
SEVERITY: High
SOURCE: Synthesis from observed LLM failure modes (UNVERIFIED per-claim).

---

# Triage table — blocking gate vs warning

Legend: **BLOCK** = must block a release/merge; **WARN** = flagged, non-blocking; **N/A** = not applicable to that site profile. "FORWARD-LOOKING" rules are never blocking until a backend exists.

| Rule | Static no-JS site | Site with forms | Site with payments/auth |
|---|---|---|---|
| SEC-012/013 HTML escaping in renderer | **BLOCK** | **BLOCK** | **BLOCK** |
| SEC-015/016/017/019/023 CSP + nosniff + frame-ancestors | **WARN** | **BLOCK** | **BLOCK** |
| SEC-018/014 Trusted Types / DOM-XSS sinks | N/A (no JS) | **BLOCK** (if JS) | **BLOCK** (if JS) |
| SEC-020/021 context encoding / sanitizer | **WARN** | **BLOCK** | **BLOCK** |
| SEC-103/104/105 deploy headers + HTTPS/HSTS | **BLOCK** | **BLOCK** | **BLOCK** |
| SEC-057/058/059/121 secrets not committed/shipped | **BLOCK** | **BLOCK** | **BLOCK** |
| SEC-095/096/098/101/124/125 dependency SCA + no hallucinated deps | **BLOCK** | **BLOCK** | **BLOCK** |
| SEC-106/107/108 env separation + deploy-hook lockdown | **BLOCK** | **BLOCK** | **BLOCK** |
| SEC-026/027/028/029/030 CSRF | N/A | **BLOCK** (if state-changing) | **BLOCK** |
| SEC-031..035 SSRF | N/A | N/A until backend | **BLOCK** (if backend) |
| SEC-036..042 SQL/NoSQL injection | N/A | N/A until backend | **BLOCK** (if DB) |
| SEC-043..050 Authentication | N/A | N/A | **BLOCK** |
| SEC-051..056 Authorization / IDOR | N/A | N/A | **BLOCK** |
| SEC-063..067 Rate limiting | N/A | **WARN** | **BLOCK** |
| SEC-068..073 File uploads | N/A | **BLOCK** (if uploads) | **BLOCK** (if uploads) |
| SEC-074..079 / 080..086 Sessions & cookie flags | N/A | N/A | **BLOCK** |
| SEC-087..094 API security / CORS | N/A | **WARN** | **BLOCK** |
| SEC-111..117 Privacy / GDPR-adjacent | **WARN** | **WARN** | **BLOCK** |
| SEC-118..136 AI-generated code anti-patterns | **BLOCK** (on any generated code) | **BLOCK** | **BLOCK** |
| SEC-001..011 OWASP Top 10 mapping | **WARN** | **WARN** | **BLOCK** (coverage required) |

**Note on FORWARD-LOOKING rules:** SEC-026..035, 036..042, 043..056, 074..086, 087..094 are not enforceable against the current static repo and MUST NOT block a static-site release. They become BLOCK once the corresponding backend capability is introduced. The AI-generated-code rules (SEC-118..136) apply immediately to any LLM-authored output in the repo, including the static renderer and build tooling.

**Note on the Security Worker:** This document is input knowledge. The actual enforcement belongs in `lib/qa/gates/` (present: performance, accessibility, technical) and in a future `security` gate / Security Worker. No code is written here per the task constraint.

<!-- END CHUNK 4 -->
