# Design Director V1

**Status:** Implemented  
**File:** `agents/designDirectorAgent.ts`  
**Version:** V1

---

## Purpose

The Design Director is the AI Art Director of the BusinessForge pipeline. It sits between the Writer Agent and the deterministic Design Agent, deciding *what* the website should feel and look like based on verified business information.

It is not a CSS generator, not a token generator, and not a renderer. Its output is a structured `DesignDirective` — a set of high-level visual decisions expressed in the closed V1 vocabulary — which the deterministic design system then translates into actual design tokens, layouts, and a `WebsiteDesign`.

---

## Architecture Position

```
BusinessProfile
+
BusinessStrategy
+
WebsiteContent
        ↓
designDirectorAgent       ← this agent
        ↓
DesignDirective (validated)
        ↓
applyDirective()
        ↓
composeDesign()
        ↓
WebsiteDesign
        ↓
Renderer
```

---

## Inputs

The agent receives a `DesignDirectorInput`:

```typescript
interface DesignDirectorInput {
  readonly profile: BusinessProfile;
  readonly strategy: BusinessStrategy;
  readonly content: WebsiteContent;
}
```

All three inputs are existing canonical pipeline contracts. The agent uses them to build a concise design brief and never invents facts not present in them.

---

## Brief Construction

The agent builds a human-readable design brief from the inputs. It deliberately does **not** dump raw JSON into the model. The brief includes:

| Section | What is included |
|---|---|
| Business | Name, primary/secondary category, basis, rating |
| Goals | Top-4 goals with priority and rationale |
| Target audience | Primary segment + up to 2 secondary segments |
| Brand voice | Tone, palette words, heading/body typeface signals |
| Tagline | The content tagline |
| Imagery | Logo, hero, gallery image count |
| Content sections | All section kinds and headings in order |
| Recommended pages | Strategy page list |
| Services / products | Up to 10 services with descriptions |
| Existing site text | Up to 2 pages, truncated to `maxPageChars` |
| Known gaps | Profile validation issues + content unresolved gaps |

---

## Output

The agent returns a `DesignDirective` — the V1 contract defined in `lib/design/directive.ts`. All fields are required in the model's output and validated before being returned:

| Field | Type | Meaning |
|---|---|---|
| `direction` | `DesignDirection` | Overall visual direction from the closed 11-value set |
| `visualIntent` | `string` | One sentence describing the intended visual feel |
| `density` | `'airy' \| 'balanced' \| 'dense'` | Layout breathing room |
| `heroIntent` | `{ preference: HeroVariant, intent: string }` | Hero layout preference and rationale |
| `layoutIntent` | `string` | One sentence on spatial feel |
| `colorStrategy` | `'brand-led' \| 'neutral' \| 'high-contrast'` | Color approach |
| `typographyIntent` | `{ intent: string, preference: 'serif' \| 'sans' }` | Typographic goal and character class hint |
| `imageryIntent` | `{ intent: string, treatment: ImageTreatment }` | Imagery goal and treatment hint |
| `accessibilityTarget` | `'AA' \| 'AAA'` | Target WCAG conformance level |
| `rationale` | `string` | 2–4 sentences explaining the visual strategy |
| `confidence` | `number` (0–1) | Evidence-based confidence in the decisions |

The model must **not** return CSS, pixel values, colour hex codes, spacing values, font sizes, Tailwind classes, or renderer instructions. The output schema enforces this with `additionalProperties: false`.

---

## Model Responsibility vs Deterministic System Responsibility

| Responsibility | Owner |
|---|---|
| Overall visual direction | **Design Director (AI)** |
| Visual intent and rationale | **Design Director (AI)** |
| Hero layout preference | **Design Director (AI)** |
| Color strategy | **Design Director (AI)** |
| Typography character class | **Design Director (AI)** |
| Imagery treatment hint | **Design Director (AI)** |
| Accessibility target | **Design Director (AI)** |
| Actual design tokens | **Deterministic system** (`composeDesign`) |
| Typeface selection | **Deterministic system** (from theme's approved pairings) |
| Color palette generation | **Deterministic system** (from direction + industry) |
| Layout variant selection | **Deterministic system** (from direction + content) |
| Spacing and sizing | **Deterministic system** |
| CSS generation | **Renderer** |

---

## Prompt Principles

The system prompt establishes the model as a senior Art Director. Key instructions:

1. **Do not design CSS.** Do not choose arbitrary pixel values.
2. **Do not invent facts.** Make decisions based only on the supplied business information.
3. **Do not imitate a specific website.** Infer from the actual business data.
4. **Prefer coherent systems.** Direction, density, typography and imagery should reinforce each other.
5. **Conservative under thin evidence.** Low evidence → restrained direction + lower confidence.
6. **Output from closed sets only.** All fields use enums defined in the V1 contract.

---

## Validation

The agent enforces correctness at two levels:

1. **Schema enforcement** — The `DIRECTIVE_SCHEMA` is passed to the provider. Providers that support native structured output enforce it server-side; those that do not have it validated locally by `lib/ai/schema.ts` via the existing `validateAgainstSchema` / `decodeAndValidate` pipeline.

2. **Semantic check** — `assertDirectiveShape` checks that all required fields are present and that `confidence` is in `[0, 1]`. Any structural failure is thrown as a retryable `UpstreamError`.

Invalid model output never silently reaches `applyDirective()`.

---

## Confidence Semantics

Confidence is **evidence quality**, not decision quality.

| Condition | Expected confidence |
|---|---|
| Rich profile, clear positioning, strong brand signals, substantial content | 0.8–1.0 |
| Moderate profile, some positioning, some content | 0.5–0.8 |
| Thin profile, missing website, ambiguous positioning | 0.2–0.5 |
| Very little information | 0.0–0.2 |

The agent logs a warning when confidence is below 0.5. No threshold causes a hard failure — the directive is still applied, but observability surfaces the uncertainty.

---

## Failure Behavior

| Failure | Behavior |
|---|---|
| Provider returns non-object | `UpstreamError` (retryable) |
| Provider omits required fields | `UpstreamError` (retryable) |
| Confidence out of range | `UpstreamError` (retryable) |
| Provider throws `UpstreamError` | Re-raised as-is |
| Provider throws other error | Wrapped in `UpstreamError` (not retryable) |

All errors use the existing `lib/errors.ts` taxonomy. The agent never swallows failures — the orchestrator decides whether to retry.

---

## Configuration

The agent reads from `config.director` (a `DirectorConfig`):

| Variable | Default | Meaning |
|---|---|---|
| `DIRECTOR_MODEL` | Provider default | Model ID to use |
| `DIRECTOR_EFFORT` | `medium` | Reasoning depth |
| `DIRECTOR_MAX_OUTPUT_TOKENS` | `4000` | Token budget |
| `DIRECTOR_MAX_PAGE_CHARS` | `2000` | Per-page excerpt limit |

---

## Observability

The agent logs through `ctx.logger`:

- `design direction started` — provider, model, effort, brief length
- (debug) `directive returned` — provider, model, token usage, finish reason
- `design direction finished` — direction, colorStrategy, density, confidence, model
- (warn) `design directive confidence is below 0.5` — when evidence is thin

No API credentials, raw prompts, or full model responses are logged.

---

## Examples

### Neighbourhood bakery

Input signals: warm tone, local audience, natural photography, modest services list  
Expected output:

```json
{
  "direction": "friendly",
  "density": "balanced",
  "colorStrategy": "brand-led",
  "typographyIntent": { "preference": "sans", "intent": "Friendly sans-serif for approachability." },
  "accessibilityTarget": "AA",
  "confidence": 0.80
}
```

### Law firm

Input signals: formal tone, professional services, authority positioning, minimal imagery  
Expected output:

```json
{
  "direction": "corporate",
  "density": "airy",
  "colorStrategy": "neutral",
  "typographyIntent": { "preference": "serif", "intent": "Authoritative serif to signal trust and expertise." },
  "accessibilityTarget": "AAA",
  "confidence": 0.75
}
```

### Luxury hotel

Input signals: premium positioning, high-quality imagery, exclusive audience  
Expected output:

```json
{
  "direction": "luxury",
  "density": "airy",
  "colorStrategy": "neutral",
  "typographyIntent": { "preference": "serif", "intent": "Refined serif for restrained elegance." },
  "heroIntent": { "preference": "full-bleed", "intent": "Full-bleed imagery for maximum visual impact." },
  "confidence": 0.88
}
```

---

## Explicit Non-Goals (V1)

The following are **not implemented** and must not be added to V1:

- Visual Critic / Screenshot QA
- Browser QA
- Autonomous Repair Loop
- Design Memory / Reference Library
- Multimodal AI / image analysis
- Image generation
- New design tokens
- New CSS controls
- New renderer functionality
- New dependencies
- Direct vendor SDK calls (all model access via `ctx.platform.ai()`)
