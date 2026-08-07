# Configuration

_Last updated: 2026-08-06._

`lib/config.ts` is the only module permitted to read `process.env`. Everything else
receives an `AppConfig` through `AgentContext`, so any component can be run against
any configuration without touching the environment.

**Everything below can be enabled, disabled or redirected without a code change.**

Malformed values fail at startup. Missing credentials do not — they are asserted by
whichever capability needs them, so stages 1–3 run with nothing configured at all.

## Runtime

| Variable | Default | |
|---|---|---|
| `LOG_LEVEL` | `info` | `debug`…`silent` |
| `OUTPUT_DIR` | `./output` | artifact root; per-run subfolders beneath it |

## AI providers

| Variable | Default | |
|---|---|---|
| `AI_PROVIDER` | `anthropic` | `anthropic` \| `openai` \| `gemini` \| `openrouter` |
| `ANTHROPIC_API_KEY` | — | |
| `OPENAI_API_KEY` | — | |
| `GEMINI_API_KEY` | — | |
| `OPENROUTER_API_KEY` | — | |
| `ANTHROPIC_BASE_URL` | vendor default | endpoint override |
| `OPENAI_BASE_URL` | vendor default | **this is the Azure / proxy / Ollama seam** |
| `GEMINI_BASE_URL` | vendor default | |
| `OPENROUTER_BASE_URL` | vendor default | |
| `AI_REQUEST_TIMEOUT_MS` | `300000` | per request |
| `OPENROUTER_REFERER` | — | optional attribution |
| `OPENROUTER_TITLE` | — | optional attribution |

All four keys are read unconditionally, so switching `AI_PROVIDER` needs no other
change. `AI_PROVIDER` is validated at point of use, not at load — see
[providers.md](providers.md#validation-timing).

## Stages

| Variable | Default | |
|---|---|---|
| `ANALYST_MODEL` | provider's default | |
| `ANALYST_EFFORT` | `high` | `low`…`max` |
| `ANALYST_MAX_OUTPUT_TOKENS` | `32000` | caps thinking **and** response together |
| `ANALYST_MAX_PAGE_CHARS` | `4000` | per-page cap on site text in the brief |
| `WRITER_MODEL` | provider's default | |
| `WRITER_EFFORT` | `high` | |
| `WRITER_MAX_OUTPUT_TOKENS` | `8000` | |

Model defaults are per-provider (`DEFAULT_MODELS` in `lib/config.ts`) — a model id is
meaningless outside its vendor. OpenRouter ids are `vendor/model` slugs and are the
most likely to need setting explicitly.

## Skills

| Variable | Default | |
|---|---|---|
| `SKILLS_ENABLED` | — | allow-list, comma-separated; empty means all |
| `SKILLS_DISABLED` | — | deny-list, applied last — **always wins** |
| `SKILLS_DIR` | — | directories scanned for `*.skill.ts` / `*.skill.js` |
| `SKILL_TIMEOUT_MS` | `120000` | per call; `0` disables |

## MCP

| Variable | Default | |
|---|---|---|
| `MCP_SERVERS` | `[]` | JSON array of server declarations |
| `MCP_ENABLED` | — | allow-list |
| `MCP_DISABLED` | — | deny-list |
| `MCP_REQUEST_TIMEOUT_MS` | `60000` | |

See [mcp.md](mcp.md#configuration) for the declaration shape.

## Telemetry

| Variable | Default | |
|---|---|---|
| `TELEMETRY_ENABLED` | `true` | when false, calls are still timed but nothing is emitted |
| `TELEMETRY_SAMPLE_LIMIT` | `100` | latency samples retained per capability |

## Feature flags

Two forms that compose:

```bash
FEATURE_FLAGS=batch-mode,!legacy-writer   # terse; leading ! turns one off
FEATURE_PLACES_API=true                   # explicit; wins over the terse form
```

```ts
if (ctx.platform.feature('places-api')) { … }
```

Names are normalised to lower-case with hyphens, so `FEATURE_PLACES_API`,
`places-api` and `PLACES_API` are the same flag. Unknown flags are off.

Flags are deliberately untyped: one exists to be added and removed without a code
change, and requiring it to be declared first would defeat that.

## Skill and MCP credentials

Skills and servers declare credentials by name (`GITHUB_TOKEN`, `FIRECRAWL_API_KEY`).
Any environment variable ending in `_API_KEY`, `_KEY`, `_TOKEN`, `_SECRET`,
`_PASSWORD` or `_CREDENTIALS` — plus `DATABASE_URL` — is collected into
`config.credentials`.

Matched by suffix rather than an allow-list, so a third-party skill can declare
`NOTION_TOKEN` and have it resolve without `lib/config.ts` learning about Notion.

**Values are never logged and never written to an artifact.**
`platform.describe().credentialsPresent` reports which variable *names* are set, never
their contents — enough to explain why a skill is unavailable, without becoming
something that has to be handled carefully.

## Browser and collector

Unchanged by this refactor: `BROWSER_HEADLESS`, `BROWSER_TIMEOUT_MS`,
`BROWSER_LOCALE`, `BROWSER_USER_AGENT`, `BROWSER_PROXY_URL`, `COLLECTOR_MAX_PAGES`,
`COLLECTOR_MAX_IMAGES`, `COLLECTOR_MIN_ASSET_BYTES`, `COLLECTOR_MAX_ASSET_BYTES`,
`COLLECTOR_ASSET_DIR`.

## Lovable

`LOVABLE_API_KEY`, `LOVABLE_BASE_URL`, `LOVABLE_PROJECT_ID`,
`LOVABLE_DEPLOY_TIMEOUT_MS`.
