# Skill system

_Last updated: 2026-08-06._

A skill is one capability the platform hands to an agent. Agents never import the
library behind a skill — they ask by id.

```ts
const pdf = ctx.platform.skills.get('pdf');
const result = await pdf.execute({ path: 'menu.pdf' });
if (!result.ok) {
  ctx.logger.warn('no pdf text', { code: result.error.code });
  return;
}
```

## The contract

```ts
interface Skill<TInput, TOutput> {
  id: string;                       // kebab-case, globally unique, stable
  name: string;
  description: string;
  version: string;                  // semver; 0.0.0 means "placeholder"
  dependencies: readonly string[];  // other skill ids
  category: SkillCategory;
  requiredCredentials?: readonly string[];

  execute(input: TInput, ctx: SkillContext): Promise<TOutput>;
  health?(ctx: SkillContext): Promise<HealthReport>;
  init?(ctx: SkillContext): Promise<void>;
  dispose?(): Promise<void>;
}
```

**Skills are written to throw.** The manager catches, classifies and converts to
`CapabilityOutcome`, so a skill author writes ordinary code and every caller still
gets structured errors.

`SkillContext` follows the same discipline as `AgentContext`: no `process.env`, no
`console`, no module singletons. A skill that needs a model uses `ctx.ai`; one that
needs another skill uses `ctx.skills`, which is how `playwright` sits on
`browser-automation` without importing it.

## Three objects, three jobs

| | Owns | Does not |
|---|---|---|
| **SkillRegistry** | a validated id → skill map | execute, time, or log anything |
| **SkillLoader** | turning built-ins and directories into skills | register them |
| **SkillManager** | policy, dependencies, credentials, timeouts, telemetry, outcomes, lifecycle | know where a skill came from |

The split is what makes the registry testable in three lines, and what keeps "is this
skill known?" separate from "did this skill work?".

Validation happens at `register`, not at call time. A malformed descriptor, a
duplicate id, or a dependency cycle is a wiring mistake, and it fails at startup
naming the offending registration.

## The handle contract

`skills.get(id)` returns a handle for **any** id, registered or not.

| | `get(id)` | `require(id)` |
|---|---|---|
| unknown / disabled / broken | handle with `available: false` | throws `CapabilityUnavailableError` |
| failure surfaces as | data from `execute()` | a throw, same `CapabilityError` inside |
| use for | optional capabilities | capabilities you cannot proceed without |

A caller of `get` never writes a null check and never wraps in `try`/`catch` — which
is where "we couldn't do it" quietly becomes "we did nothing".

## Why a call was refused

`blockingReason` checks in order, so the message names the root cause:

1. `not_registered` — nothing under that id (lists what is known)
2. `disabled` — switched off by configuration
3. `missing_dependency` — a declared dependency is absent or disabled
4. `missing_credential` — a declared variable is unset (names it)

Then, from `execute` itself: `not_implemented`, `timeout`, `cancelled`, `internal`.

## The 38 built-ins

All placeholders today. Every one is honest about it: `version` `0.0.0`, health
`unavailable`, and `not_implemented` from `execute` — **never an empty result**, which
would let a caller carry on with nothing and produce output that looks complete.

| Category | Skills |
|---|---|
| **web** (6) | `browser-automation` `playwright` `firecrawl` `google-maps` `web-search` `lovable` |
| **development** (7) | `github` `git` `filesystem` `api-testing` `performance-testing` `security-scanning` `accessibility-testing` |
| **documents** (4) | `pdf` `word` `excel` `powerpoint` |
| **media** (5) | `vision` `ocr` `image-generation` `speech` `translation` |
| **data** (3) | `embeddings` `vector-store` `database` |
| **operations** (7) | `deployment` `authentication` `payments` `monitoring` `logging` `notifications` `scheduling` |
| **marketing** (4) | `seo` `analytics` `cms` `social-media` |
| **productivity** (2) | `email` `calendar` |

Declared dependencies already in place: `playwright` → `browser-automation`;
`performance-testing`, `security-scanning`, `accessibility-testing`, `seo` →
`browser-automation`; `vector-store` → `embeddings`.

## Implementing one

Replace the placeholder's entry in its category file:

```ts
export const PDF_SKILL: Skill<{ path: string }, { text: string }> = {
  id: 'pdf',
  name: 'PDF',
  description: 'Extracts text, tables and images from a PDF.',
  version: '1.0.0',
  dependencies: [],
  category: 'documents',

  async execute(input, ctx) {
    ctx.logger.debug('reading pdf', { path: input.path });
    return { text: await extract(input.path) };
  },
};
```

Keep the id. Every caller already refers to it.

## Adding one without touching this repository

Drop a `*.skill.ts` (or `.js`) into a directory named by `SKILLS_DIR`:

```bash
SKILLS_DIR=./skills,/opt/businessforge/skills
```

Export it as `default`, as `skill`, or an array as `skills` — all three are accepted.
Discovery is sorted, so registration order is the same on every machine.

**Discovered skills replace built-ins with the same id.** That is deliberate: it is
how a real Playwright implementation supersedes its placeholder with no code change
here. A module that fails to import is logged and skipped, never fatal.

## Policy and budgets

```bash
SKILLS_ENABLED=pdf,excel      # allow-list; empty means "all"
SKILLS_DISABLED=payments      # deny-list, applied last — always wins
SKILL_TIMEOUT_MS=120000       # per call; 0 disables
```

`disabled` beating `enabled` lets an operator allow a broad set and carve one entry
back out without the two lists contradicting each other.

A skill that ignores `ctx.signal` still returns to its caller on time — its result is
discarded. A skill cannot hang a pipeline stage.
