# Architecture

_Last updated: 2026-08-06._

BusinessForge is a pipeline of six single-responsibility agents sitting on top of a
platform of pluggable capabilities. The two halves are deliberately separate, and the
line between them is the point of the whole design.

```
┌──────────────────────────────────────────────────────────────────┐
│ main.ts — orchestration, run lifecycle, artifact persistence      │
└───────────────┬──────────────────────────────────────────────────┘
                │ AgentContext { config, logger, getBrowser, platform, … }
┌───────────────▼──────────────────────────────────────────────────┐
│ agents/  discovery → collector → normalizer → analyst → writer →  │
│          lovable.  Pure transforms. No ambient dependencies.      │
└───────────────┬──────────────────────────────────────────────────┘
                │ asks for capabilities, never for implementations
┌───────────────▼──────────────────────────────────────────────────┐
│ lib/platform — Platform                                           │
│   ├── ai      AIProvider          anthropic│openai│gemini│openrouter
│   ├── skills  SkillManager        38 ids across 8 categories      │
│   ├── mcp     MCPManager          n servers, http + stdio         │
│   └── telemetry                   health · latency · availability │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ lib/render — renderSite(WebsiteContent) -> RenderedSite           │
│   Beside the pipeline, not in it. A pure function: no context,    │
│   no model, no browser, no I/O. Deployment consumes it unchanged. │
└──────────────────────────────────────────────────────────────────┘
```

## The one rule

**An agent states what it needs. It never learns how that need is met.**

```ts
const model = ctx.platform.ai();              // some vendor
const pdf   = ctx.platform.skills.get('pdf'); // some library
const gh    = ctx.platform.mcp.get('github'); // some server
```

Nothing in an agent names Anthropic, Playwright, or an endpoint. The consequence is
the property this refactor was for: **adding a provider, implementing a skill, or
registering a server changes configuration and one adapter file — never an agent,
never a stage, never a JSON artifact.**

## Layers, bottom up

| Layer | Owns | Knows about |
|---|---|---|
| `lib/platform/types.ts` | health, structured errors, outcomes, metrics | nothing but `lib/errors.ts` |
| `lib/platform/telemetry.ts` | latency, availability, error accounting | the vocabulary above |
| `lib/ai/` | provider contract, four adapters, factory | the vocabulary; the vendors |
| `lib/platform/skills/` | registry, loader, manager, 38 built-ins | the vocabulary; `lib/ai` for `ctx.ai` |
| `lib/platform/mcp/` | connector contract, manager, transports | the vocabulary |
| `lib/platform/platform.ts` | assembling all three from config | all of the above |
| `lib/render/` | `WebsiteContent` → HTML, CSS, assets | `lib/types.ts` and nothing else |
| `agents/` | one transform each | `lib/types.ts` and `Platform` |
| `main.ts` | run lifecycle, stage order, artifacts | everything |

The three subsystems do not import each other. `skills` reaches `ai` for one reason
only — a skill may need a model — and `mcp` reaches neither.

## Why capabilities return errors instead of throwing

Every capability call returns a `CapabilityOutcome`:

```ts
type CapabilityOutcome<T> =
  | { ok: true;  data: T;               durationMs: number }
  | { ok: false; error: CapabilityError; durationMs: number };
```

`skills.get(id)` returns a handle for **any** id — registered or not. An unknown,
disabled, uncredentialled or unimplemented skill yields a handle whose `available` is
`false` and whose `execute` returns the reason as data.

That removes two failure modes at once. A caller never writes a null check, and a
caller never wraps an optional capability in `try`/`catch` — which is where "we
couldn't do it" quietly becomes "we did nothing". For callers that genuinely require
a capability, `skills.require(id)` throws `CapabilityUnavailableError` carrying the
identical `CapabilityError`.

The error codes are a closed set: `not_registered`, `disabled`, `not_implemented`,
`missing_dependency`, `missing_credential`, `invalid_input`, `timeout`, `cancelled`,
`upstream`, `internal`.

## Honesty about what is not built

The 38 built-in skills are **placeholders**, and they say so rather than pretending:

- `version` is `0.0.0`
- `health()` reports `unavailable` with the reason
- `execute()` returns `not_implemented` — **never an empty result**

The last one matters most. A placeholder that returned `[]` would let a caller carry
on with nothing and produce output that looks complete. The stdio MCP transport is
handled the same way, for the same reason.

## What is verified, and what is not

| | Status |
|---|---|
| Typecheck | passes |
| Platform boot: 38 skills, 8 categories, policy, telemetry, flags | exercised |
| Structured errors for all five blocking reasons | exercised |
| Anthropic adapter | call shape unchanged from the pre-refactor analyst; **never run against a live key** |
| OpenAI / Gemini / OpenRouter adapters | **never run against a live key** |
| MCP HTTP connector | **never run against a live server** |
| Renderer | 110 assertions incl. snapshots; a rendered site opened from disk and read; **never deployed to a host** |

The three new provider adapters and the MCP connector follow their published request
and response shapes and are exercised by the typecheck, but nothing here has made a
real call. Treat the first live run of each as the test.

## Related

- [Folder structure](folder-structure.md)
- [Renderer](renderer.md)
- [Provider system](providers.md)
- [Skill system](skills.md)
- [MCP system](mcp.md)
- [Configuration](configuration.md)
- [Developer guide](developer-guide.md)
