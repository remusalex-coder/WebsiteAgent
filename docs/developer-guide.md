# Developer guide

_Last updated: 2026-08-06._

## The rule that matters

**Agents state what they need. They never learn how it is met.**

```ts
// yes
const model = ctx.platform.ai();
const pdf   = ctx.platform.skills.get('pdf');

// no — this is what the platform exists to prevent
import Anthropic from '@anthropic-ai/sdk';
import { chromium } from 'playwright';
```

If you find yourself importing a vendor SDK inside `agents/`, the thing you want is a
skill or a provider adapter.

## Recipes

### Use a model

```ts
const provider = ctx.platform.ai();   // throws, naming the variable to set
const result = await provider.generate({
  system: SYSTEM_PROMPT,
  prompt: brief,
  schema: MY_SCHEMA,
  model: ctx.config.writer.model,
  effort: ctx.config.writer.effort,
  maxTokens: ctx.config.writer.maxOutputTokens,
  signal: ctx.signal,
});
```

Use `ctx.platform.tryAi()` when a model is optional — it returns `null` instead.

Structured-output schemas must keep `additionalProperties: false` and a complete
`required` list on every object, and must avoid `minLength` / `minItems` / `minimum`:
Anthropic and OpenAI reject those keywords.

### Use a capability that might not exist

```ts
const ocr = ctx.platform.skills.get('ocr');
if (!ocr.available) {
  gaps.push('menu is an image and OCR is not configured');
} else {
  const out = await ocr.execute({ image: asset.localPath });
  if (out.ok) text = out.data.text;
  else ctx.logger.warn('ocr failed', { code: out.error.code });
}
```

### Use one you cannot proceed without

```ts
const browser = ctx.platform.skills.require('browser-automation');
```

Throws `CapabilityUnavailableError`, carrying the same `CapabilityError` the handle
would have returned.

### Add a provider

See [providers.md](providers.md#adding-a-provider). Three steps, all inside `lib/ai/`.

### Implement a skill

See [skills.md](skills.md#implementing-one). Keep the id — callers already use it.

### Add a skill without touching this repository

Drop a `*.skill.ts` in a `SKILLS_DIR`. It replaces a built-in with the same id.

### Add an MCP server

Edit `MCP_SERVERS`. No code.

## Never scrape twice

Stages 1–3 cost about forty seconds of live browsing — a browser launch, a Maps
consent interstitial, a site crawl, an image download — and they are not what you are
changing. Resume instead:

```bash
npm run resume -- --from=analyze <runId>
```

Earlier stages are read back from `output/<runId>/`; the named stage and everything
after it re-runs. Stages: `discovery, collect, normalize, analyze, write, design,
render, deploy`. Resuming at `analyze` or later opens no browser at all.

It re-runs **in place**, so it overwrites the artifacts from that stage onwards — which
is the point, but copy a strategy or a spec out of the folder first if you want to diff
against it. In place is also required rather than chosen: the collector's images live in
`output/<runId>/assets/`, and the renderer resolves asset paths against the run
directory.

To iterate on the renderer alone, `npm run render -- output/<runId>/5-content.json` is
faster still — it skips the platform and the design agent.

## Testing

Every seam is constructor-injected, so nothing needs a network.

```ts
// a registry with one fake skill
const registry = createSkillRegistry();
registry.register({
  id: 'pdf', name: 'PDF', description: 'test', version: '1.0.0',
  dependencies: [], category: 'documents',
  execute: async () => ({ text: 'hello' }),
});

// a loader with no built-ins
const loader = createSkillLoader({ logger, builtins: [] });

// a provider that returns a fixed object
const provider: AIProvider = {
  name: 'anthropic', version: 'test', defaultModel: 'test',
  supportsNativeSchema: true,
  generate: async () => ({ data: FIXTURE, model: 'test',
    usage: { inputTokens: 1, outputTokens: 1 },
    structuredOutput: 'native', finishReason: 'end_turn' }),
  health: async () => healthReport('ready', 'test'),
};
```

`loadConfig(env)` takes an environment object, so configuration is a value in tests.

## Things that will bite you

**`exactOptionalPropertyTypes` is on.** `{ signal: undefined }` is not the same as
omitting `signal`. Spread conditionally:

```ts
...(signal !== undefined ? { signal } : {})
```

**`noUncheckedIndexedAccess` is on.** `array[0]` is `T | undefined`.

**Skill ids are kebab-case** and validated at registration. `vectorStore` is rejected.

**A placeholder never returns an empty result.** If you implement one, do not "fix" it
by returning `[]` on the unimplemented path — that is precisely the failure mode the
placeholders avoid.

**Discovery replaces built-ins silently.** That is intended. If a skill behaves
strangely, check whether a `SKILLS_DIR` module is shadowing it.

## Verified vs. unverified

| | Status |
|---|---|
| Typecheck | passes |
| Platform boot, policy, structured errors, telemetry, flags | exercised |
| Anthropic adapter | call shape unchanged from the pre-refactor analyst; **never run live** |
| OpenAI / Gemini / OpenRouter adapters | **never run live** |
| MCP HTTP connector | **never run against a live server** |
| Every built-in skill | placeholder by design |

## Reading order

1. [architecture.md](architecture.md) — the shape and the one rule
2. [folder-structure.md](folder-structure.md) — where things live
3. [providers.md](providers.md) / [skills.md](skills.md) / [mcp.md](mcp.md)
4. [configuration.md](configuration.md) — every knob
