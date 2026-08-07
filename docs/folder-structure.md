# Folder structure

_Last updated: 2026-08-06._

```
main.ts                          orchestration, CLI, run lifecycle, artifacts

agents/                          one file per stage; pure transforms
  discoveryAgent.ts              Maps URL  → DiscoveryResult
  collectorAgent.ts              identity  → CollectedBusiness
  normalizerAgent.ts             both      → BusinessProfile
  businessAnalystAgent.ts        profile   → BusinessStrategy
  writerAgent.ts                 + strategy→ WebsiteContent          [stub]
  lovableAgent.ts                content   → DeploymentResult        [stub]

lib/
  browser.ts                     headless browser, driver-agnostic
  config.ts                      typed config; the ONLY reader of process.env
  logger.ts                      structured, scoped logging
  errors.ts                      error taxonomy
  types.ts                       domain contracts + AgentContext

  ai/                            ── PROVIDER LAYER ──
    index.ts                     public surface; agents import from here
    types.ts                     AIProvider, AIGenerateRequest/Result,
                                 ProviderAdapter, ProviderOptions
    factory.ts                   AIProviderFactory, createAIProvider,
                                 API_KEY_VARIABLES
    http.ts                      deadline composition, credential probe
    protocol.ts                  postJson, response decoding, effort mapping
    schema.ts                    Gemini dialect, JSON recovery, local validation
    providers/
      index.ts                   ADAPTERS — the extension surface
      anthropic.ts               the only file importing @anthropic-ai/sdk
      openai.ts                  fetch; native json_schema
      gemini.ts                  fetch; OpenAPI dialect + thinking budget
      openrouter.ts              fetch; instructed schema (routing-dependent)

  platform/                      ── CAPABILITY PLATFORM ──
    platform.ts                  createPlatform(); the object agents receive
    types.ts                     health, structured errors, outcomes, metrics
    telemetry.ts                 latency/availability accounting, instrument()
    skills/
      types.ts                   Skill, SkillHandle, SkillContext, descriptors
      registry.ts                SkillRegistry — validated id → skill map
      loader.ts                  SkillLoader — built-ins + directory discovery
      manager.ts                 SkillManager — policy, timeouts, outcomes
      placeholder.ts             definePlaceholderSkill()
      builtin/
        index.ts                 BUILTIN_SKILLS (38)
        web.ts                   6   development.ts  7   documents.ts    4
        media.ts                 5   data.ts         3   operations.ts   7
        marketing.ts             4   productivity.ts 2
    mcp/
      types.ts                   MCPConnector, MCPCapability, MCPHandle
      manager.ts                 MCPManager — routing, caching, search
      httpConnector.ts           JSON-RPC over Streamable HTTP
      stdioConnector.ts          declared, not implemented

  render/                        ── RENDERER ──
    index.ts                     public surface; callers import only from here
    types.ts                     RenderedSite/File/Asset, RenderOptions
    html.ts                      Html brand, escaping, element(), jsonLd(), slug()
    theme.ts                     BrandVoice -> validated tokens; colour/font allow-lists
    css.ts                       the stylesheet, from tokens
    assets.ts                    URL allow-lists, asset placement plan
    sections.ts                  one renderer per SectionKind
    document.ts                  head, header, nav, footer, JSON-LD
    site.ts                      renderSite() — pure, no I/O
    write.ts                     the only file here that touches the filesystem

test/                            node:test suites
  fixtures/content.ts            full / minimal / empty WebsiteContent
  support/snapshot.ts            file-backed snapshot helper
  render/                        html, theme, assets, site, write, snapshot
  __snapshots__/                 committed rendered output

docs/                            this documentation set
output/                          per-run artifacts (gitignored)
```

## Where things go

| Adding… | Touch |
|---|---|
| an AI provider | `lib/ai/providers/<name>.ts` + `AI_PROVIDER_NAMES` + `ADAPTERS` |
| a skill implementation | the built-in's entry, or a `*.skill.ts` in `SKILLS_DIR` |
| an MCP server | `MCP_SERVERS` — no code at all |
| a pipeline stage | `agents/`, `lib/types.ts`, `main.ts` |
| an environment variable | `lib/config.ts` and `.env.example`, nowhere else |
| a section kind | `lib/types.ts` `SectionKind` + one entry in `BULLET_LAYOUTS` |
| a stylesheet rule | `lib/render/css.ts` — and regenerate the snapshots |

## Naming

- Skill ids are kebab-case and globally unique: `vector-store`, not `vectorStore`.
- Discovery modules must be named `*.skill.ts` / `*.skill.js` to be picked up.
- Adapter files are named after their vendor and export exactly one `adapter`.
