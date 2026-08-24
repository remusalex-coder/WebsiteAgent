# Architecture

_Last updated: 2026-08-06._

> **⚠ SUPERSEDED (2026-08-24).** This document describes the original six-agent
> classic pipeline and predates Forge (`lib/forge/`), Hermes, the Design Director,
> and the capability router's current 31-binding form. It is kept because the
> **capability platform** section below (Platform/AI providers/skills/MCP) is still
> largely accurate for that subsystem specifically. For the current, whole-system
> architecture, start at `docs/BUSINESSFORGE_FINAL_ARCHITECTURE.md` and
> `docs/MASTER_INVENTORY.json` (machine-readable). See `docs/IMPLEMENTATION_GAP.md`
> and `docs/MASTER_EXECUTION_PLAN.md` for what has actually been built and verified.

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
| `lib/sources/` | one content source each, behind one contract | `lib/types.ts` and `lib/browser.ts` |
| `lib/design/` | `profile + content` → `WebsiteDesign`, incl. the experience system | `lib/types.ts`, `lib/art/` |
| `lib/content/` | `profile + content + plan` → the words each beat says | `lib/types.ts`, `lib/design/` (types) |
| `lib/render/` | `WebsiteContent` → HTML, CSS, assets | `lib/types.ts`, `lib/content/language.ts` |
| `agents/` | one transform each | `lib/types.ts` and `Platform` |
| `main.ts` | run lifecycle, stage order, artifacts | everything |

The three subsystems do not import each other. `skills` reaches `ai` for one reason
only — a skill may need a model — and `mcp` reaches neither.

`lib/design/` is deterministic and model-free: it composes a full `WebsiteDesign`
from evidence, including the **experience system** (character → experience mode →
asset choreography → conversion/interaction strategy → narrative order). The AI
Design Director (`agents/designDirectorAgent.ts`) is an optional improver that may
override this floor only through validated closed-set decisions. See
[experience-system.md](experience-system.md) and
[decisions/0006](decisions/0006-experience-is-character-driven-and-order-is-a-narrative.md).

`lib/content/` is the same shape of thing for *words*: given the narrative plan,
it decides what each beat of the page says, in the language the business's own
evidence is written in, and audits the result against what the evidence can
support. It reads `lib/design/`'s types and is read by `lib/render/` for the
labels the platform authors (the section eyebrow, the nav, the skip link); it
never writes design. Also deterministic and model-free. See
[content-system.md](content-system.md) and
[decisions/0007](decisions/0007-content-is-directed-by-narrative-role-and-written-in-the-evidence-language.md).

## Sources

A *source* is somewhere facts about a business can be read from. The website
crawl is one. The Maps listing, read as content rather than as identity, is
another. Instagram, a PDF menu, a Places API response and an owner
questionnaire are all the same shape of thing.

So a source is a function returning `ListingHarvest`, not a branch inside the
collector. The collector merges harvests and never learns how any of them were
obtained. That is what made the Places API a drop-in rather than a rewrite: it
produces the same type from an HTTP call instead of a browser, and no stage
downstream of `lib/sources/` changed to gain customer reviews.

**Merging is policy, and it lives in `merge.ts`.** Sources are passed in order
of authority and earlier ones win, per *field* rather than per source — a source
that answered first about accessibility must not cost the amenity list only the
other one carries. Hours resolve day by day and attributes label by label, so a
business whose API knows Sunday and whose pane knows Saturday ends up open on
both. Authority means *how a source knows*: the API states accessibility as
booleans and hours as structured periods, where the pane recovers the same facts
from label text and is right most of the time.

This is the first step of the multi-source direction in the product brief, taken
where it paid for itself immediately rather than as an upfront refactor. Before
it, a listing with no website produced a page of 126 words — for exactly the
businesses most likely to buy one.

**What a signed-out Maps session can actually see.** Google serves an
unauthenticated visitor a reduced pane and says so in the markup. Measured
against two fingerprints, including a realistic user agent with the automation
flag removed, that pane has no Reviews tab and no photo grid. `lib/sources`
therefore does not attempt to scrape reviews — they are not there to scrape.
Reviews and the full photo set come from the Places API, under a licence.

That source now exists (`lib/sources/placesApi.ts`, optional, keyed by
`PLACES_API_KEY`; see [the runbook](runbooks/places-api-source.md)). Two of its
decisions are worth carrying into any future source:

- **A photo URL must never carry a credential.** The Places media endpoint takes
  the key as a query parameter, so the source resolves each photograph to its
  plain `googleusercontent` URL first. An artifact directory is a persistence
  format and a committed one; a live key in `2-raw.json` would outlive the run.
- **An identifier is not self-describing.** A Maps URL carries an `ftid`
  (`0x…:0x…`); the Places API is keyed by a `ChIJ…` place id. `DiscoveryResult.placeId`
  is honestly either, and the source exchanges one for the other. Passing the
  field through unexamined would have 404'd on every business ever collected,
  and looked exactly like a business with no reviews.

## Facts a model is never asked for

Hours, contact rows, the JSON-LD, the trust bar and now **testimonials** are
built from the profile by code, after the model has answered. The schema has no
field for any of them, so the model cannot offer one — a model never asked for a
certification cannot invent one.

Testimonials are the sharpest case and the reason the rule is structural rather
than a prompt instruction. Every other section is prose about a business; a
testimonial is a claim attributed to a *named human being*, and the failure mode
is not a clumsy sentence but a fabricated endorsement under a real person's
name, published on a paying customer's site. `groundTestimonials` therefore
keeps the model's *position and heading* for the section — genuine editorial
judgements — and replaces its bullets unread with quotations that came from a
source. With no verified review the section is removed entirely. The prompt says
the same thing, and the prompt is a request; this is the version that holds when
a model misreads the brief or someone edits the prompt in a hurry.

The writer's brief carries a review *count*, never the review text: a model
cannot paraphrase a quotation it has not been shown.

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
