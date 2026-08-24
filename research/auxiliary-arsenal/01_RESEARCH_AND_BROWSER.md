# 01 — RESEARCH & BROWSER TOOLS

> Business-evidence gathering + browser automation for the factory. VERIFIED = official
> page fetched 2026-08-19. Reuse `lib/sources/*` (already collects Places/maps/instagram/
> authority/pii).

## A. Web research / crawl / extract (feed `evidence_research`, `market_research`)
| Tool | API | SDK | CLI | MCP | Free | MED $ | PREM $ | Comm | Evidence | Sec |
|---|---|---|---|---|---|---|---|---|---|---|
| **Firecrawl** | ✅ | ✅ | ✅ | ✅ agent (`agent-onboarding/SKILL.md` + keyless free tier) | **1,000 credits/mo** | Hobby $16 (5k), Standard $83 (100k), Scale $599 (1M) | Ent custom | yes | VERIFIED firecrawl.dev/pricing | REVIEW |
| **Tavily** | ✅ | ✅ | ❌ | ✅ | **1,000 API credits/mo** | PAYG $0.008/credit; Project $0 (4k) | Ent | yes | VERIFIED tavily.com/pricing | SAFE |
| **Exa** | ✅ | ✅ | ❌ | ✅ (MCP server) | **$10/mo + $120/yr free** | Dev PAYG $7/1k search, Agent $0.012–1/run | Ent | yes | VERIFIED exa.ai/pricing | REVIEW |
| **Crawlee** (Apify) | ✅ | ✅(JS/Py) | ❌ | ❌ | **OSS MIT $0** | Apify platform paid | — | MIT | VERIFIED crawlee.dev | SAFE |
| **Playwright** | ✅ | ✅ | ✅ | ✅(puppeteer MCP) | **OSS MIT $0** | — | — | MIT | VERIFIED github | SAFE |
| **Browser Use** | ✅ | ✅ | ✅ | ✅ | OSS $0 (needs LLM key) | cloud | — | MIT | KNOWN | REVIEW |

### Firecrawl detail (VERIFIED)
- Credits: Scrape 1/page, Crawl 1/page, Map 1/page, Search 2/10 results, Interact 2/browser-min,
  Monitor 1/page/check. Free = 1k/mo, 2 concurrent. Agent onboarding provides keyless free
  search/scrape/interact path. CLI `firecrawl` + SDKs (Py/JS/Go/Ruby). 
- **BusinessForge use:** primary research specialist — scrape client site, competitors,
  extract structured evidence, map sitemap. ADOPT P0.

### Tavily detail (VERIFIED)
- Free 1k credits/mo, no card. PAYG $0.008/credit. Search/Extract/Crawl endpoints. 
- **Use:** lightweight research fallback to Firecrawl. ADOPT P0.

### Exa detail (VERIFIED)
- Free $10/mo + $120/yr; MCP server access; paygo Search $7/1k, Agent $0.012–1/run;
  5 QPS free, 50+ integrations. Neural/semantic search + Contents API.
- **Use:** deep research / entity enrichment (company/person search). ADOPT P1.

## B. Browser automation / scraping / OCR
- **Playwright** (MIT) — primary. Already the factory's QA/render surface (`lib/forge/browser.ts`).
  Screenshots, assertions, visual regression. ADOPT P0.
- **Puppeteer MCP** (ref server) — browser automation inside agent loops.
- **OCR:** Tesseract (OSS), and LLM vision (Gemini/Claude) for layout OCR — no separate
  paid OCR needed.
- **BuiltWith / Wappalyzer:** tech-detection (VERIFIED pages fetched). Useful for
  competitive visual archaeology (what stack a site uses) but **INFERRED** accuracy; treat
  as signal not fact. OPTIONAL P2 (BuiltWith free tier limited, Wappalyzer freemium).

## C. Structured extraction / schema
- Firecrawl `extract` + Exa `Contents` + custom JSON-schema prompts via existing LLM
  providers → schema.org, contacts, pricing, products. No new vendor needed.

## D. Maps / Places / reviews (EXISTS in repo)
- `lib/sources/placesApi.ts`, `mapsListing.ts`, `mapsUrl.ts` already implement Google
  Places/listing extraction. **Do not rebuild.** Extend with review scraping via Firecrawl
  if needed. OSM/Leaflet is the FREE delivery path (see 10).

## E. Security note for research stage
- Scraped web content is untrusted → sanitise before it reaches the research LLM (prompt-
  injection risk). Isolate research context; never let scraped text write to the build
  directly. Semgrep + output_security gate catch leakage. See 18.
