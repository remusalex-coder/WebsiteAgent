# Design Director V1 — Architecture & Contract Specification

## 1. Approved Architecture

The AI Design Director is an **Art Director**, not a token generator.

It decides *what* a website should feel and look like at a high level. The
deterministic design system remains the execution layer. The AI directive feeds
a small, pure adapter function that translates it into the existing
`ComposeOptions` interface.

```
AI Design Director
        ↓
  DesignDirective           (high-level semantic intent)
        ↓
  applyDirective()          (pure deterministic adapter)
        ↓
  ComposeOptions            (small, existing interface)
        ↓
  composeDesign()           (existing deterministic system)
        ↓
  WebsiteDesign
        ↓
  Renderer
```

The renderer and `WebsiteDesign` are **not modified**. The AI director's
influence arrives at a single seam — `ComposeOptions` — and no further.

---

## 2. V1 Contract — `DesignDirective`

All fields are optional. A completely empty directive is valid and produces
output identical to calling `composeDesign` with no options.

```ts
interface DesignDirective {
  direction?:          DesignDirection;          // existing closed enum
  visualIntent?:       string;                   // free-text, one sentence
  density?:            VisualDensity;            // 'airy' | 'balanced' | 'dense'
  heroIntent?:         HeroIntent;               // { preference: HeroVariant | null, intent: string }
  layoutIntent?:       string;                   // free-text semantic intent
  colorStrategy?:      ColorStrategy;            // 'brand-led' | 'neutral' | 'high-contrast'
  typographyIntent?:   TypographyIntent;         // { intent: string, preference: 'serif' | 'sans' | null }
  imageryIntent?:      ImageryIntent;            // { intent: string, treatment: ImageTreatment | null }
  accessibilityTarget?: 'AA' | 'AAA';
  rationale?:          string;
  confidence?:         number;                   // 0–1
}
```

### Field semantics

| Field | Role | V1 effect |
|---|---|---|
| `direction` | Overrides industry inference for design direction | Mapped to `ComposeOptions.direction` |
| `visualIntent` | Free-text statement of intended feel | Logged for observability only |
| `density` | Preferred visual density | Advisory — logged; deterministic system may adjust |
| `heroIntent.preference` | Preferred hero variant | Advisory — layout planner has final say |
| `heroIntent.intent` | Semantic intent of the hero | Logged for observability only |
| `layoutIntent` | Semantic layout description | Logged for observability only |
| `colorStrategy` | High-level palette approach | `'high-contrast'` forces `accessibilityLevel: 'AAA'`; others logged only |
| `typographyIntent.intent` | Typographic goal | Logged for observability only |
| `typographyIntent.preference` | Typeface character class hint | Advisory in V1; theme owns the typeface |
| `imageryIntent.intent` | Imagery goal | Logged for observability only |
| `imageryIntent.treatment` | Preferred image treatment | Advisory in V1; theme owns the treatment |
| `accessibilityTarget` | WCAG conformance level | Mapped to `ComposeOptions.accessibilityLevel` |
| `rationale` | Decision audit trail | Logged; warning emitted when absent |
| `confidence` | Director certainty 0–1 | Warning below 0.5; never causes failure |

---

## 3. What Is Deliberately Excluded from V1

The following fields were considered and **rejected** for V1:

| Excluded field | Reason |
|---|---|
| `brandColorHex` | The design system extracts brand colour from content; an AI-specified hex bypasses that extraction and is not needed for direction decisions |
| `chromaScale` | Token-level control; the director sets direction, not chroma values |
| `accentHueShift` | Token-level control |
| `typeScaleBias` | Token-level control |
| `emphasisHints` | Section-level overrides; not a high-level art direction decision |
| `layoutRhythm` | Token-level spacing control |
| Arbitrary CSS values | The director must never directly control CSS |
| Arbitrary spacing values | Token-level control |
| Arbitrary typography sizes | Token-level control |
| Arbitrary token values | The director operates above the token layer |

These may be added in future versions **if Visual Critic evidence shows that the
deterministic design system needs additional control surfaces**. The bar is
empirical, not speculative.

---

## 4. Fallback Behaviour

Missing or invalid directive fields degrade gracefully:

- A missing `rationale` emits a warning but does not fail.
- An out-of-range `confidence` emits a warning and is ignored.
- A `confidence < 0.5` emits a warning; the directive is still applied.
- An unrecognised `direction` string emits a warning; direction falls back to
  the deterministic system's own inference.
- An unrecognised `density` string emits a warning and is ignored.
- Semantic intent fields (`visualIntent`, `layoutIntent`, etc.) are always
  safe to omit; they carry no runtime consequence in V1.
- An `undefined` directive returns the operator options unchanged — behaviour is
  identical to not passing a directive at all.

No field in `DesignDirective` can cause `composeDesign` to throw. The
deterministic design system's own promise ("always produce a usable design")
is preserved.

---

## 5. Determinism Guarantees

`applyDirective` is a **pure deterministic function**:

- Same `DesignDirective` + same operator options → same `ComposeOptions`, always.
- No clock access, no randomness, no model calls. Observability is surfaced via an optional `Logger` parameter (defaults to a no-op); the return value remains pure regardless of the logger supplied.
- Does not mutate its inputs.
- Returns a new object; never returns the operator options object directly.

Because `applyDirective` is pure and `composeDesign` is pure, the composed
chain `applyDirective → composeDesign` is also pure. The same directive
applied to the same content always produces a byte-identical `WebsiteDesign`,
making the result snapshot-testable and diff-readable.

---

## 6. Operator Override Precedence

Operator overrides always take precedence over AI director values:

```
Precedence (highest → lowest):

  1. operator explicit ComposeOptions.direction
  2. directive.direction
  3. deterministic inference (industry + copy signals)

  1. operator explicit ComposeOptions.accessibilityLevel
  2. directive.colorStrategy = 'high-contrast' → 'AAA'
  3. directive.accessibilityTarget
  4. default: 'AA'
```

This is implemented in `applyDirective` by spreading operator options *after*
directive-derived values. An operator who fixes `direction: 'minimal'` cannot
be overridden by an AI directive, regardless of what the directive says.

The existing `ComposeOptions.direction` feature-flag override was present before
the Design Director. Its behaviour is unchanged: it accepts any valid
`DesignDirection` and forces that direction through the entire composition
pipeline. The directive is layered *beneath* it.

---

## 7. Future Extension Points

The V1 contract is intentionally minimal. Identified extension points, in
priority order:

1. **Visual Critic feedback loop** — when a Visual Critic scores rendered pages,
   the director can learn which `direction` + `density` combinations underperform
   and adjust its confidence / directive accordingly.

2. **Density as a hard constraint** — if Visual Critic evidence shows that
   advisory density is not respected in enough cases, `density` can be promoted
   to a `ComposeOptions` field and the deterministic system updated to honour it.

3. **Hero preference as a constraint** — if layout planning consistently
   overrides `heroIntent.preference` in ways that misalign with director intent,
   `ComposeOptions` can be extended with `preferredHero`.

4. **Typography character class** — if serif/sans preference meaningfully
   improves design quality (as measured by Visual Critic), `typographyIntent.preference`
   can be mapped to a `ComposeOptions.headingCharacter` field.

5. **Image treatment** — if the director reliably identifies cases where the
   theme's default `imageTreatment` is wrong for the brand, `imageryIntent.treatment`
   can be promoted to a constraint.

6. **Design Memory** — a persistent store of which directives worked well for
   which industry/content combinations, feeding future director decisions.

7. **Autonomous Repair Loop** — the Visual Critic identifies failures; the
   director issues a revised directive; the loop converges.

Items 2–7 are **not** in scope for V1. They are recorded here so the contract
can be extended without redesigning it.

---

## 8. Files Changed (V1 Implementation)

| File | Change |
|---|---|
| `lib/design/directive.ts` | New — `DesignDirective` contract + `applyDirective` adapter |
| `lib/design/index.ts` | Added exports for `applyDirective`, `DesignDirective`, and supporting types |
| `test/design/directive.test.ts` | New — 40 tests covering contract, adapter, and end-to-end behaviour |
| `docs/design-director-v1-spec.md` | This document |

Files **not** changed: renderer, `WebsiteDesign`, `composeDesign`, design
tokens, themes, layout planner, color system, all other existing files.
