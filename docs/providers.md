# Provider system

_Last updated: 2026-08-06._

One interface, four implementations, one line of configuration.

```bash
AI_PROVIDER=anthropic     # or openai | gemini | openrouter
ANTHROPIC_API_KEY=...
```

## The contract

```ts
interface AIProvider {
  name: AIProviderName;
  version: string;
  defaultModel: string;
  supportsNativeSchema: boolean;
  generate(request: AIGenerateRequest): Promise<AIGenerateResult>;
  health(signal?: AbortSignal): Promise<HealthReport>;
}
```

A caller supplies a system prompt, a user prompt, a JSON Schema, a model id, an
effort level and a token cap. It gets back an object that **has already been
validated against that schema**. Which vendor served it, how that vendor spells
"reasoning effort", and whether it enforces schemas natively are all below the line.

```ts
const result = await ctx.platform.ai().generate({
  system: SYSTEM_PROMPT,
  prompt: brief,
  schema: STRATEGY_SCHEMA,
  model: config.analyst.model,
  effort: config.analyst.effort,
  maxTokens: config.analyst.maxOutputTokens,
  signal: ctx.signal,
});
```

**No agent may import a provider SDK.** `lib/ai/providers/anthropic.ts` is the only
file in the repository that imports `@anthropic-ai/sdk`.

## What each adapter does differently

| | Transport | Schema | Effort | Notes |
|---|---|---|---|---|
| **anthropic** | official SDK, streaming | native `output_config.format` | passed through, all five levels | adaptive thinking; server-side fallbacks (`fallbacks: "default"`) |
| **openai** | `fetch`, Chat Completions | native `json_schema`, `strict: true` | `reasoning_effort`; `xhigh`/`max` → `high` | refusal is a message field, checked before parsing |
| **gemini** | `fetch`, `generateContent` | native `responseSchema` | `thinkingBudget` in tokens; `max` → `-1` | schema is translated to an OpenAPI subset on the way out |
| **openrouter** | `fetch`, Chat Completions | **instructed** + local validation | `reasoning.effort`; same clamp as OpenAI | upstream errors arrive in-band with HTTP 200 |

Two of those deserve the detail:

**Gemini's dialect.** Its `responseSchema` is an OpenAPI 3.0 subset, not JSON Schema —
it rejects `additionalProperties`, which our schemas set everywhere. `toGeminiSchema`
drops what it cannot express. The response is then validated against the **original**
schema, not the reduced copy, so the dropped constraints are still enforced.

**OpenRouter is instructed, on purpose.** It forwards `response_format` only to
upstreams that implement it, and which model a request lands on is a routing decision.
Claiming native enforcement would make the guarantee depend on today's routing table.
So the schema goes in the prompt and the response is validated locally, which holds
for every model on the platform. The returned object is identical either way; only
`result.structuredOutput` differs, and it is logged.

Local validation runs in **both** modes, even where the vendor guarantees the shape.
It costs microseconds, and a vendor whose enforcement regresses should fail in
`protocol.ts` rather than as an `undefined` two stages downstream.

## Adding a provider

Three steps. Nothing above the adapter changes.

**1.** Write `lib/ai/providers/<vendor>.ts` exporting one `ProviderAdapter`:

```ts
export const adapter: ProviderAdapter = {
  name: 'ollama',
  apiKeyVariable: 'OLLAMA_API_KEY',
  version: '1.0.0',
  defaultModel: 'llama4',
  defaultBaseUrl: 'http://localhost:11434/v1',
  supportsNativeSchema: false,
  create: createOllamaProvider,
};
```

**2.** Add the name to `AI_PROVIDER_NAMES` in `lib/ai/types.ts`.

**3.** Add one line to `ADAPTERS` in `lib/ai/providers/index.ts`.

`AIProviderName` is derived from the same list `ADAPTERS` is keyed by, so a missing
entry is a compile error rather than a runtime surprise. Add the key and base-URL
entries to `AiConfig` in `lib/config.ts` and you are done.

This is what makes Claude 6, GPT-6, Gemini Ultra, DeepSeek, xAI, Mistral, local
Ollama, Azure OpenAI, Bedrock and Vertex one adapter each — and zero agent changes.

**Endpoint overrides need no adapter at all.** Azure, a proxy, or a local server that
speaks an existing vendor's protocol is `OPENAI_BASE_URL=...`.

## Failure handling

Everything leaves an adapter as `ProviderRequestError` — an `UpstreamError` carrying
the provider name and an honest `retryable`:

| Situation | Retryable |
|---|---|
| 429, 5xx, connection failure, timeout | yes |
| response unparseable or off-schema | yes |
| 4xx other than 429, auth rejected | no |
| model refused, generation truncated | no |
| run cancelled | no |

Truncation is caught before parsing and names the knob that fixes it, rather than
surfacing as a JSON syntax error.

## Validation timing

`AI_PROVIDER` is **not** validated at config load. Stages 1–3 need no model, and a
run that only scrapes should not be blocked by a typo. The failure arrives when a
stage first asks for a model — `MissingProviderError`, `UnsupportedProviderError` or
`MissingApiKeyError`, each naming the variable to set.

## Health

`providers.status()` returns one row per supported provider. Only the **selected**
provider is probed — four round trips to learn about three vendors nobody asked for
would be waste. Uncredentialled providers report `unavailable` naming their variable;
credentialled but unselected ones report `unknown`.
