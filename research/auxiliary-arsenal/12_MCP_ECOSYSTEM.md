# 12 — MCP ECOSYSTEM

> MCP servers BusinessForge could exploit. The repo ALREADY hosts MCP
> (`lib/platform/mcp/*` manager + http/stdio connectors). This maps candidates. VERIFIED
> where fetched; OBSERVED from official repos.

## A. MCP servers with direct factory value
| Server | Official? | Trust | Maintained | Perms | Sec risk | BF use | Recommend |
|---|---|---|---|---|---|---|---|
| **Higgsfield** | ✅ (vendor) | HIGH | yes | account auth, no key for MCP | LOW (vendor ToS) | media gen in agent loop | ADOPT P0 |
| **Algolia** | ✅ (vendor) | HIGH | yes | index read/write | MED (writes index) | search in workflow | ADOPT P2 |
| **Cloudinary** | ✅ (vendor) | HIGH | yes | media transform | LOW | media opt/CDN | ADOPT P2 |
| **Axe (Deque)** | ✅ (vendor) | HIGH | yes | scan page | LOW | a11y in QA | ADOPT P1 |
| **Firecrawl** | ✅ (agent skill) | HIGH | yes | scrape/web | MED (web egress) | research | ADOPT P0 |
| **Exa** | ✅ (vendor) | HIGH | yes | search | LOW | research | ADOPT P1 |
| **Playwright / Puppeteer** | ✅ (ref) | HIGH | yes | browser | MED (browser/network) | QA/render | ADOPT P0 |
| **GitHub** | ✅ (ref) | HIGH | yes | repo ops | MED (token) | deploy/publish | ADOPT P1 |
| **PostgreSQL** | ✅ (ref) | HIGH | yes | DB read | MED (DB) | data/CMS | ADOPT P1 |
| **Google Maps** | ✅ (ref) | HIGH | yes | maps/places | LOW | maps (alt to OSM) | OPTIONAL P2 |
| **Brave Search** | ✅ (ref) | HIGH | yes | search | LOW | research alt | OPTIONAL P2 |
| **Filesystem** | ✅ (ref) | MED | yes | file RW (sandboxed) | **HIGH if unsandboxed** | build I/O | ADOPT P1 (sandboxed only) |
| **Git** | ✅ (ref) | HIGH | yes | repo | MED | versioning | ADOPT P1 |
| **Memory** | ✅ (ref) | HIGH | yes | KV memory | LOW | agent memory | ADOPT P2 |
| **Sequential Thinking** | ✅ (ref) | HIGH | yes | reasoning | LOW | planning | ADOPT P2 |
| **Sentry** | ✅ (ref) | HIGH | yes | error data | MED | monitoring | OPTIONAL P2 |
| **Slack** | ✅ (ref, Zencoder) | MED | yes | messaging | MED | notify | OPTIONAL P2 |

## B. Who should use which
- **Hermes (research/architect):** Firecrawl/Exa/Brave (research), GitHub/Filesystem(sandboxed)/
  Git (build), Sequential Thinking (planning), Memory.
- **WebsiteAgent (build/QA):** Higgsfield (media), Playwright/Puppeteer (QA), Axe (a11y),
  Algolia/Cloudinary (function), Postgres (data), Filesystem(sandboxed).
- **Neither:** untrusted third-party MCPs with broad filesystem/network + no sandbox →
  REVIEW/HIGH RISK. Maintain an allow-list; the repo's `manager.ts` already mediates.

## C. Security governance (see 18)
- Only allow-list vetted MCPs. Filesystem MUST be path-sandboxed (repo `stdioConnector`
  supports config). Network-egress MCPs (Firecrawl/Playwright) get egress review. Secrets
  via env, never in server config committed.

## D. Redundancy check
- Google Maps MCP redundant with OSM+Leaflet (prefer OSM). Brave redundant with Tavily/
  Exa/Firecrawl. GitHub/Filesystem/Git overlap — use GitHub+Git for publish, Filesystem
  (sandboxed) for local I/O only.
