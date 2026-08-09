# DesignDirective V1 — Contract Analysis

_Produced: 2026-08-09_

## Scope and method

This document analyses the V1 `DesignDirective` contract for the AI Design Director layer. The analysis is grounded in a direct reading of:

- `lib/design/types.ts` — all closed enums, type aliases, and the `WebsiteDesign` shape
- `lib/design/compose.ts` — `composeDesign()`, `ComposeOptions`, `chooseDirection()`, `densityFor()`, `findBrandColor()`, `imageryFor()`, `iconsFor()`, `responsiveFor()`
- `lib/design/layout.ts` — `chooseHero()`, `chooseVariant()`, `planLayout()`, frame and emphasis logic
- `lib/design/themes.ts` — `ThemeDefinition`, `THEMES` (eleven entries), `ThemeFontChoice`
- `lib/design/tokens.ts` — `buildColorSystem()`, `buildTypography()`, `buildSpacing()`, `buildRadius()`, `buildElevation()`, `buildMotion()`
- `lib/design/industries.ts` — `IndustryDefaults`, classification rules, `defaultsFor()`, `emphasisFor()`
- `test/design/` — compose, determinism, colour, industries, palette tests

The architecture under analysis is:

```
AI Design Director
→ DesignDirective
→ Directive Adapter          (new deterministic module)
→ composeDesign()            (existing, unchanged)
→ WebsiteDesign              (existing, unchanged)
→ renderSite()               (existing, unchanged)
```

---

## Foundational constraints from the existing code

These facts from the implementation constrain every decision in the contract.

### What `composeDesign` currently accepts from the outside

`ComposeOptions` today has exactly two optional fields:

```typescript
export interface ComposeOptions {
  readonly direction?: DesignDirection;      // short-circuits chooseDirection()
  readonly accessibilityLevel?: 'AA' | 'AAA'; // drives accessibilityFor()
}
```

Everything else is internal: the brand-colour seed comes from `findBrandColor(content, profile)`, density from `densityFor(industryDensity, themeDensity, sectionCount)`, hero preference from `theme.heroPreference`, colour harmony from `theme.accentHueShift`, chroma ceiling from `theme.chroma`.

### What the AI Director must NEVER output

The following are internal arithmetic parameters. Letting the AI output them raw would produce brittle, non-reproducible output and would violate the determinism guarantee:

- Raw CSS values (`rem`, `px`, `%`, `vw`)
- Hex colours that are placed verbatim into the stylesheet (they are accepted only as a hue seed; lightness and chroma are discarded and rebuilt)
- Modular scale ratios (computed from `theme.typeRatio`)
- Spacing step sizes (computed from `theme.spacingRatio × baseRem`)
- Shadow values, border widths, elevation numbers
- Token names (`spacing.md`, `fontSize.h2`, etc.)
- Font family names (the AI does not name fonts; the theme does)

### What the AI Director CAN output safely

- A value from any closed enum that feeds a pure function — becomes a fixed, reproducible input
- A validated `#rrggbb`/`#rgb` hex string as a brand colour seed (only the OKLCH hue angle is extracted; lightness and chroma are discarded and rebuilt by `buildColorSystem`)
- Semantic natural-language prose (stored in rationale and note fields; never enters arithmetic)
- A bounded float for `confidence` (0.0–1.0; clamped at the adapter boundary)

---

## A. Exact proposed TypeScript shape

```typescript
// -----------------------------------------------------------------------
// New closed enums (local to lib/design/directive.ts)
// -----------------------------------------------------------------------

/**
 * How saturated the palette should read.
 * Maps to a scaling factor on theme.chroma inside the adapter.
 *   restrained → 0.75 × theme.chroma
 *   balanced   → 1.0  × theme.chroma  (no-op; adapter passes through)
 *   vivid      → 1.25 × theme.chroma  (clamped at 0.25, display-P3 ceiling)
 */
export type ChromaIntent = 'restrained' | 'balanced' | 'vivid';

/**
 * Hue relationship between primary and accent ramps.
 * Maps to a degree offset passed to buildColorSystem as accentHueShift.
 *   monochromatic → 0°
 *   analogous     → 30°
 *   complementary → 180°
 *   triadic       → 120°
 *   split         → 150°
 */
export type ColorHarmony =
  | 'monochromatic'
  | 'analogous'
  | 'complementary'
  | 'triadic'
  | 'split';

/**
 * How visual weight is distributed across sections.
 *   uniform        → all sections get 'primary' emphasis
 *   editorial      → first non-hero section gets 'lead'; rest get 'secondary'
 *   stacked-peaks  → Director names which section kinds receive 'lead' via emphasisHints
 */
export type LayoutRhythm = 'uniform' | 'editorial' | 'stacked-peaks';

/**
 * How photography is weighted relative to typography.
 * Maps to the imageReliance parameter used by planLayout() and imageryFor().
 *   type-led  → 'incidental'
 *   balanced  → 'supporting'
 *   image-led → 'essential'
 */
export type ImageryBalance = 'type-led' | 'balanced' | 'image-led';

// -----------------------------------------------------------------------
// The contract
// -----------------------------------------------------------------------

/**
 * The AI Design Director's structured output.
 *
 * A DesignDirective expresses visual intent in terms of what should be
 * achieved; a WebsiteDesign records the deterministic decisions that
 * achieve it. The two are kept separate so that the Director's output can
 * be validated, logged, diffed and fed back into the next iteration
 * without any part of the rendering pipeline changing.
 *
 * Design rules:
 *
 * 1. Every field that feeds a pure function uses a closed enum or a
 *    bounded value. The AI never outputs CSS, rem values, or token names.
 * 2. Intent fields carry semantic prose. They inform rationale logging
 *    and the repair loop's next Director prompt; they never enter
 *    arithmetic.
 * 3. All behavioural fields are optional. Absent fields let composeDesign
 *    infer as it always has — the directive is a bias layer, not a
 *    replacement.
 * 4. rationale and confidence are always required for accountability.
 */
export interface DesignDirective {

  // ── 1. direction ───────────────────────────────────────────────────

  /**
   * Which of the eleven design directions to use.
   *
   * When absent, composeDesign infers from industry keywords and copy
   * signals (chooseDirection). When present, short-circuits that
   * inference — identical to what the existing directionOverride()
   * feature flag does, formalized as a typed field.
   *
   * Enum: DesignDirection (reused from lib/design/types.ts)
   * Values: minimal | luxury | corporate | elegant | modern | editorial
   *       | creative | playful | bold | premium | friendly
   */
  readonly direction?: DesignDirection;

  // ── 2. visualIntent ────────────────────────────────────────────────

  /**
   * One or two sentences describing the feeling the site should convey.
   *
   * Semantic prose only. Never enters arithmetic. Stored in
   * design.personality.rationale and used as context in the repair
   * loop's next Director prompt.
   *
   * Max 280 characters. Truncated (not rejected) at the adapter.
   */
  readonly visualIntent?: string;

  // ── 3. density ─────────────────────────────────────────────────────

  /**
   * Visual density preference.
   *
   * When present, replaces the industry default as the first argument to
   * densityFor(directiveDensity, themeDensity, sectionCount). The
   * function still resolves the airier of directive and theme — so
   * 'dense' on a 'minimal' direction (which is 'airy') still produces
   * 'balanced', as logged. This is intentional: the Director cannot
   * override the theme's fundamental character.
   *
   * Enum: VisualDensity (reused from lib/design/types.ts)
   * Values: airy | balanced | dense
   */
  readonly density?: VisualDensity;

  // ── 4. heroIntent ──────────────────────────────────────────────────

  /**
   * Preferred hero layout variant.
   *
   * When present, the adapter prepends this to the theme's heroPreference
   * list before chooseHero() runs. chooseHero() still vetoes it when the
   * content cannot support it (split requires an image; magazine requires
   * two). The directive is a preference, not a mandate.
   *
   * Enum: HeroVariant (reused from lib/design/types.ts)
   * Values: centered | split | editorial | image-first | full-bleed
   *       | magazine | minimal
   */
  readonly heroVariantHint?: HeroVariant;

  /**
   * Why the Director wants this hero treatment.
   *
   * Semantic prose. Stored in design.layout.rationale. Max 200 chars.
   */
  readonly heroIntent?: string;

  // ── 5. layoutIntent ────────────────────────────────────────────────

  /**
   * How visual weight should be distributed across sections.
   *
   * Enum: LayoutRhythm (new, defined above)
   * Values: uniform | editorial | stacked-peaks
   */
  readonly layoutRhythm?: LayoutRhythm;

  /**
   * Which section kinds should receive 'lead' emphasis.
   *
   * Only meaningful when layoutRhythm is 'stacked-peaks'. The adapter
   * marks the first section of each named kind as 'lead'; all others
   * receive 'secondary'. Unrecognised kinds are dropped with a warning.
   *
   * Array of SectionKind (reused from lib/types.ts). Max 3 entries.
   * Values: hero | about | services | menu | gallery | testimonials
   *       | hours | location | contact | cta | faq
   */
  readonly emphasisHints?: readonly SectionKind[];

  /**
   * Why the Director chose this layout rhythm.
   *
   * Semantic prose. Stored in design.layout.rationale. Max 200 chars.
   */
  readonly layoutIntent?: string;

  // ── 6. colorStrategy ───────────────────────────────────────────────

  /**
   * A brand colour to seed the colour system.
   *
   * Safe for the same reason findBrandColor() is safe: hexToOklch()
   * extracts only the hue angle; lightness and chroma are discarded and
   * rebuilt from theme.chroma. An unparseable value is ignored with a
   * warning, not a thrown error, and findBrandColor() runs instead.
   *
   * Format: #rrggbb or #rgb only. No oklch(), hsl(), or named colours.
   * Max 7 characters.
   */
  readonly brandColorHex?: string;

  /**
   * How saturated the palette should read.
   *
   * Applied as a multiplier to theme.chroma before buildColorSystem():
   *   restrained → 0.75 × theme.chroma
   *   balanced   → 1.0  × theme.chroma (no-op)
   *   vivid      → 1.25 × theme.chroma (clamped at 0.25)
   *
   * Enum: ChromaIntent (new, defined above)
   */
  readonly chromaIntent?: ChromaIntent;

  /**
   * Hue relationship between primary and accent.
   *
   * Maps to a degree value overriding theme.accentHueShift:
   *   monochromatic →   0°
   *   analogous     →  30°
   *   complementary → 180°
   *   triadic       → 120°
   *   split         → 150°
   *
   * Enum: ColorHarmony (new, defined above)
   */
  readonly colorHarmony?: ColorHarmony;

  /**
   * Why the Director made this colour choice.
   *
   * Semantic prose. Stored in design notes. Max 200 chars.
   */
  readonly colorIntent?: string;

  // ── 7. typographyIntent ────────────────────────────────────────────

  /**
   * Preferred heading typeface character.
   *
   * When present, the adapter selects the closest available typeface
   * within the chosen direction's font pairing. If the direction's theme
   * has a fixed heading character that conflicts (e.g., luxury always
   * uses a serif), the direction wins and the conflict is logged as a
   * design note. The AI does not name font families.
   *
   * Enum: subset of FontCharacter from lib/design/types.ts
   * Values: serif | sans
   */
  readonly headingCharacter?: 'serif' | 'sans';

  /**
   * Preferred type scale drama relative to the direction's default.
   *
   * Maps to a scaling bias on theme.typeRatio in the adapter:
   *   subtle   → lowest ratio in the direction's range (≈ 1.25)
   *   standard → the direction's own typeRatio (no-op)
   *   dramatic → highest ratio available (≈ 1.5 or 1.618)
   *
   * The adapter clamps to the nearest defined ratio step rather than
   * computing a raw float, preserving determinism.
   *
   * Enum: 'subtle' | 'standard' | 'dramatic' (new, local)
   */
  readonly typeScale?: 'subtle' | 'standard' | 'dramatic';

  /**
   * Why the Director made this typography choice.
   *
   * Semantic prose. Stored in design notes. Max 200 chars.
   */
  readonly typographyIntent?: string;

  // ── 8. imageryIntent ───────────────────────────────────────────────

  /**
   * How photography should be weighted relative to typography.
   *
   * Maps to the imageReliance parameter in planLayout() and imageryFor():
   *   type-led  → 'incidental'
   *   balanced  → 'supporting'
   *   image-led → 'essential'
   *
   * When absent, the industry default imageReliance is used.
   *
   * Enum: ImageryBalance (new, defined above)
   */
  readonly imageryBalance?: ImageryBalance;

  /**
   * How images should be treated visually.
   *
   * Maps directly to ImageTreatment; overrides theme.imageTreatment
   * inside imageryFor().
   *
   * Enum: ImageTreatment (reused from lib/design/types.ts)
   * Values: natural | warm | cool | monochrome | muted
   */
  readonly imageTreatment?: ImageTreatment;

  /**
   * Why the Director made this imagery choice.
   *
   * Semantic prose. Stored in design notes. Max 200 chars.
   */
  readonly imageryIntent?: string;

  // ── 9. accessibilityTarget ─────────────────────────────────────────

  /**
   * WCAG conformance level to target.
   *
   * Maps directly to ComposeOptions.accessibilityLevel, which drives
   * accessibilityFor() and sets minContrastBody (4.5 for AA, 7 for AAA).
   * Defaults to 'AA' when absent — the existing composeDesign default.
   *
   * Enum: 'AA' | 'AAA' (reused from ComposeOptions)
   */
  readonly accessibilityLevel?: 'AA' | 'AAA';

  // ── 10. rationale ──────────────────────────────────────────────────

  /**
   * The Director's overall rationale for these choices.
   *
   * A short paragraph naming which facts in the business profile and
   * strategy drove each major decision. Used in the run log and as seed
   * context for the repair loop's next Director call.
   *
   * Required. The adapter throws InvalidDirectiveError for an empty or
   * absent rationale — this is the one hard failure in the contract.
   * Max 600 characters. Values longer than 600 chars are truncated with
   * a warning rather than rejected, because a truncated rationale is
   * better than a failed run.
   */
  readonly rationale: string;

  // ── 11. confidence ─────────────────────────────────────────────────

  /**
   * The Director's self-assessed confidence in these choices, 0.0–1.0.
   *
   * 0.0 = almost no signal (thin profile, no website, no imagery).
   * 1.0 = rich, consistent signal across profile, strategy, and content.
   *
   * Used by the repair loop to decide iteration priority: low-confidence
   * directives receive more repair passes. Values outside [0, 1] are
   * clamped, not rejected.
   *
   * Required. A directive with no confidence value cannot be prioritised
   * by the repair loop.
   */
  readonly confidence: number;
}
```

---

## B. Fields that should be closed enums

| Field | Type | Reused or new | Values |
|---|---|---|---|
| `direction` | `DesignDirection` | Reused — `lib/design/types.ts` | minimal, luxury, corporate, elegant, modern, editorial, creative, playful, bold, premium, friendly |
| `density` | `VisualDensity` | Reused — `lib/design/types.ts` | airy, balanced, dense |
| `heroVariantHint` | `HeroVariant` | Reused — `lib/design/types.ts` | centered, split, editorial, image-first, full-bleed, magazine, minimal |
| `emphasisHints[]` | `SectionKind` | Reused — `lib/types.ts` | hero, about, services, menu, gallery, testimonials, hours, location, contact, cta, faq |
| `chromaIntent` | `ChromaIntent` | New | restrained, balanced, vivid |
| `colorHarmony` | `ColorHarmony` | New | monochromatic, analogous, complementary, triadic, split |
| `layoutRhythm` | `LayoutRhythm` | New | uniform, editorial, stacked-peaks |
| `imageryBalance` | `ImageryBalance` | New | type-led, balanced, image-led |
| `imageTreatment` | `ImageTreatment` | Reused — `lib/design/types.ts` | natural, warm, cool, monochrome, muted |
| `headingCharacter` | `'serif' \| 'sans'` | Subset of `FontCharacter` | serif, sans |
| `typeScale` | `'subtle' \| 'standard' \| 'dramatic'` | New | subtle, standard, dramatic |
| `accessibilityLevel` | `'AA' \| 'AAA'` | Reused — `ComposeOptions` | AA, AAA |

---

## C. Fields that should contain semantic text

These fields never enter arithmetic. They are stored in `design.personality.rationale`, `design.layout.rationale`, `design.notes[]`, and the repair loop's next Director prompt.

| Field | Max chars | Where it appears |
|---|---|---|
| `visualIntent` | 280 | `design.personality.rationale` (appended) |
| `heroIntent` | 200 | `design.layout.rationale` (appended) |
| `layoutIntent` | 200 | `design.layout.rationale` (appended) |
| `colorIntent` | 200 | `design.notes[]` |
| `typographyIntent` | 200 | `design.notes[]` |
| `imageryIntent` | 200 | `design.notes[]` |
| `rationale` | 600 (required) | Run log + repair loop seed context |

`confidence` is a bounded float (0.0–1.0), not prose and not an enum. It is a declaration, not a quality gate.

---

## D. Allowed enum values (complete reference)

```
DesignDirection:
  minimal | luxury | corporate | elegant | modern | editorial
  | creative | playful | bold | premium | friendly

VisualDensity:
  airy | balanced | dense

HeroVariant:
  centered | split | editorial | image-first | full-bleed | magazine | minimal

SectionKind:
  hero | about | services | menu | gallery | testimonials
  | hours | location | contact | cta | faq

ImageTreatment:
  natural | warm | cool | monochrome | muted

ChromaIntent:
  restrained | balanced | vivid

ColorHarmony:
  monochromatic | analogous | complementary | triadic | split

LayoutRhythm:
  uniform | editorial | stacked-peaks

ImageryBalance:
  type-led | balanced | image-led

headingCharacter:
  serif | sans

typeScale:
  subtle | standard | dramatic

accessibilityLevel:
  AA | AAA
```

---

## E. Validation rules

All validation lives in the **Directive Adapter**, not in `composeDesign`. The adapter is the only new code between the Director and the deterministic pipeline.

### Hard failure (throws `InvalidDirectiveError`)

| Condition | Field |
|---|---|
| `rationale` is absent or empty string | `rationale` |

This is the only exception. Every other violation degrades gracefully.

### Soft failures (log warning, treat field as absent)

| Condition | Field | Resolution |
|---|---|---|
| Not a member of `DESIGN_DIRECTIONS` | `direction` | Treat as absent; inference runs |
| Not a member of `['airy','balanced','dense']` | `density` | Treat as absent |
| Not a member of `HERO_VARIANTS` | `heroVariantHint` | Treat as absent |
| Contains entry not in `SectionKind` union | `emphasisHints[n]` | Drop that entry |
| `emphasisHints.length > 3` | `emphasisHints` | Truncate to first 3 |
| Does not match `/^#[0-9a-f]{3}([0-9a-f]{3})?$/i` | `brandColorHex` | Treat as absent; `findBrandColor()` runs |
| Not a member of `ChromaIntent` | `chromaIntent` | Treat as absent |
| Not a member of `ColorHarmony` | `colorHarmony` | Treat as absent |
| Not a member of `ImageryBalance` | `imageryBalance` | Treat as absent |
| Not a member of `ImageTreatment` | `imageTreatment` | Treat as absent |
| Not `'serif'` or `'sans'` | `headingCharacter` | Treat as absent |
| Not `'subtle'`, `'standard'`, or `'dramatic'` | `typeScale` | Treat as absent |
| Not `'AA'` or `'AAA'` | `accessibilityLevel` | Default to `'AA'` with warning |
| `confidence < 0` or `confidence > 1` | `confidence` | Clamp to [0, 1] with warning |

### Truncation (log warning, continue with truncated value)

| Condition | Resolution |
|---|---|
| `rationale.length > 600` | Truncate to 600 chars |
| `visualIntent.length > 280` | Truncate to 280 chars |
| Any intent field length > 200 | Truncate to 200 chars |

---

## F. Defaults and fallback behaviour

When any field is absent or invalid after adapter validation, `composeDesign` behaves exactly as it does today. The directive is a bias layer; absence of a field means "infer as normal."

| Field absent → | Fallback |
|---|---|
| `direction` | `chooseDirection()` infers from industry keyword scoring + copy signals |
| `density` | `densityFor(industryDefaults.density, theme.density, sectionCount)` |
| `heroVariantHint` | `theme.heroPreference` order unchanged |
| `layoutRhythm` | `emphasisFor()` from `industries.ts` determines section emphasis |
| `emphasisHints` | Ignored (only used with `stacked-peaks`) |
| `brandColorHex` | `findBrandColor(content, profile)` searches palette and page text |
| `chromaIntent` | `theme.chroma` unchanged |
| `colorHarmony` | `theme.accentHueShift` unchanged |
| `imageryBalance` | `defaults.imageReliance` from `IndustryDefaults` |
| `imageTreatment` | `theme.imageTreatment` unchanged |
| `headingCharacter` | `theme.headingFont.character` unchanged |
| `typeScale` | `theme.typeRatio` unchanged |
| `accessibilityLevel` | `'AA'` — current `composeDesign` default |

---

## G. How `DesignDirective` maps into existing `ComposeOptions`

The **Directive Adapter** (`lib/design/directiveAdapter.ts`) is the sole new translation layer. Its contract: pure function, no model calls, no filesystem, no network. Same inputs always produce the same `ComposeOptions`.

### `ComposeOptions` extensions required (all additive, all optional)

```typescript
export interface ComposeOptions {
  // ── existing fields ──────────────────────────────────────────
  readonly direction?: DesignDirection;
  readonly accessibilityLevel?: 'AA' | 'AAA';

  // ── new fields added by this contract ────────────────────────
  /** Brand colour seed. Only the OKLCH hue is used; lightness and chroma are discarded. */
  readonly seedHex?: string;
  /** Replaces industryDefaults.density as the first argument to densityFor(). */
  readonly densityBias?: VisualDensity;
  /** Prepended to theme.heroPreference before chooseHero() runs. */
  readonly heroVariantHint?: HeroVariant;
  /** Multiplied against theme.chroma before buildColorSystem(). Range [0.5, 1.5]. */
  readonly chromaScale?: number;
  /** Overrides theme.accentHueShift (degrees, 0–360). */
  readonly accentHueShift?: number;
  /** Overrides industryDefaults.imageReliance in planLayout() and imageryFor(). */
  readonly imageReliance?: 'essential' | 'supporting' | 'incidental';
  /** Overrides theme.imageTreatment inside imageryFor(). */
  readonly imageTreatment?: ImageTreatment;
  /** Biases theme heading font selection toward the specified character class. */
  readonly headingCharacter?: 'serif' | 'sans';
  /** Scales theme.typeRatio: subtle < standard (no-op) < dramatic. */
  readonly typeScaleBias?: 'subtle' | 'standard' | 'dramatic';
  /** Layout rhythm intent fed to emphasis assignment logic. */
  readonly layoutRhythm?: LayoutRhythm;
  /** Section kinds to receive 'lead' emphasis (used with stacked-peaks rhythm). */
  readonly emphasisHints?: readonly SectionKind[];
}
```

### Adapter translation table

| `DesignDirective` field | Adapter action | `ComposeOptions` field |
|---|---|---|
| `direction` | Pass through | `direction` |
| `accessibilityLevel` | Pass through; default `'AA'` | `accessibilityLevel` |
| `brandColorHex` | Validate format; pass through | `seedHex` |
| `density` | Pass through as densityBias | `densityBias` |
| `heroVariantHint` | Validate against `HERO_VARIANTS`; pass through | `heroVariantHint` |
| `chromaIntent` | `restrained→0.75`, `balanced→1.0`, `vivid→1.25` | `chromaScale` |
| `colorHarmony` | `mono→0`, `analogous→30`, `complementary→180`, `triadic→120`, `split→150` | `accentHueShift` |
| `imageryBalance` | `type-led→'incidental'`, `balanced→'supporting'`, `image-led→'essential'` | `imageReliance` |
| `imageTreatment` | Pass through | `imageTreatment` |
| `headingCharacter` | Pass through | `headingCharacter` |
| `typeScale` | Pass through | `typeScaleBias` |
| `layoutRhythm` | Pass through | `layoutRhythm` |
| `emphasisHints` | Validate each entry; truncate to 3 | `emphasisHints` |
| `visualIntent` | Append to personality rationale string | (prose field) |
| `heroIntent` | Append to layout rationale string | (prose field) |
| `layoutIntent` | Append to layout rationale string | (prose field) |
| `colorIntent` | Push to notes[] | (prose field) |
| `typographyIntent` | Push to notes[] | (prose field) |
| `imageryIntent` | Push to notes[] | (prose field) |
| `rationale` | Required; push to notes[] | (prose field) |
| `confidence` | Clamp [0,1]; pass to repair loop | (not in ComposeOptions) |

Prose fields and `confidence` do not enter `ComposeOptions`. They travel alongside the design as metadata.

---

## H. What must remain unchanged

These components are contractually frozen regardless of what the Director produces.

| Component | Constraint |
|---|---|
| `composeDesign()` signature | Additive only — new optional fields on `ComposeOptions` are permitted; existing fields must not be renamed or removed |
| `WebsiteDesign` type | Shape and `version: 1` unchanged; Director choices appear only inside existing fields (`personality.rationale`, `notes`) |
| `designAgent.ts` | Remains the same thin wrapper; the adapter runs before it, not inside it |
| `lib/render/*` | Zero changes; the renderer reads `WebsiteDesign`, which is unchanged |
| `lib/design/types.ts` | Enum values may be extended; no existing value may be renamed or removed |
| All existing tests | Must pass without modification after the adapter and extensions are added |
| Determinism guarantee | `composeDesign(input, options)` must be byte-identical across runs for the same `options`; this means the new fields must feed only pure functions and no field may be a mutable object |

---

## I. Required tests

### Directive validation (`test/design/directive.test.ts`)

1. A directive with all optional fields absent and a valid `rationale` produces a valid `ComposeOptions` with no overrides applied — every new field is `undefined`. Proves the adapter is a transparent pass-through by default.
2. Missing `rationale` throws `InvalidDirectiveError`.
3. Empty string `rationale` throws `InvalidDirectiveError`.
4. `rationale` longer than 600 characters is truncated to 600 and logged as a warning (not thrown).
5. `confidence` of `1.5` is clamped to `1.0` with a warning.
6. `confidence` of `-0.2` is clamped to `0.0` with a warning.
7. `confidence` of `0.0` is accepted without error.
8. Unrecognised `direction` value (e.g. `'ultramodern'`) is treated as absent; inference runs.
9. `brandColorHex: '#abc'` passes validation.
10. `brandColorHex: '#aabbcc'` passes validation.
11. `brandColorHex: 'rgba(0,0,0)'` fails validation; field treated as absent with a warning.
12. `brandColorHex: '#gggggg'` fails validation; field treated as absent with a warning.
13. `emphasisHints` with 5 entries is truncated to first 3 with a warning.
14. `emphasisHints` containing `'invalid-kind'` drops that entry and logs a warning.
15. `accessibilityLevel: 'AAA'` passes through correctly; `'AAAA'` is replaced with `'AA'` and logged.
16. `visualIntent` longer than 280 chars is truncated to 280 with a warning.
17. `heroIntent` at exactly 200 chars passes without truncation.
18. All intent fields do not appear in `ComposeOptions` output.

### Adapter mapping (`test/design/directiveAdapter.test.ts`)

19. `direction: 'luxury'` → `options.direction === 'luxury'`.
20. `density: 'dense'` → `options.densityBias === 'dense'`.
21. `heroVariantHint: 'full-bleed'` → `options.heroVariantHint === 'full-bleed'`.
22. `chromaIntent: 'restrained'` → `options.chromaScale === 0.75`.
23. `chromaIntent: 'balanced'` → `options.chromaScale === 1.0`.
24. `chromaIntent: 'vivid'` → `options.chromaScale === 1.25`.
25. `colorHarmony: 'complementary'` → `options.accentHueShift === 180`.
26. `colorHarmony: 'monochromatic'` → `options.accentHueShift === 0`.
27. `colorHarmony: 'triadic'` → `options.accentHueShift === 120`.
28. `imageryBalance: 'image-led'` → `options.imageReliance === 'essential'`.
29. `imageryBalance: 'type-led'` → `options.imageReliance === 'incidental'`.
30. `imageryBalance: 'balanced'` → `options.imageReliance === 'supporting'`.
31. `emphasisHints: ['services', 'testimonials']` passes through in order.
32. `typeScale: 'dramatic'` → `options.typeScaleBias === 'dramatic'`.
33. `layoutRhythm: 'stacked-peaks'` without `emphasisHints` → `layoutRhythm` set, `emphasisHints` undefined.

### Integration with `composeDesign` (`test/design/compose.test.ts` — additions only)

34. `seedHex: '#2d6a4f'` produces a design whose colour ramps reflect that hue (hue extracted by `hexToOklch`; the exact ramp steps change relative to the baseline).
35. `densityBias: 'dense'` on direction `'minimal'` (which is `'airy'`) produces `design.personality.density === 'balanced'` — the airier of dense and airy.
36. `composeDesign` called twice with the same extended `ComposeOptions` produces byte-identical output (determinism preserved).
37. `composeDesign` with `{ direction: 'elegant' }` via the adapter produces the same result as calling `composeDesign` directly with `{ direction: 'elegant' }`.
38. `heroVariantHint: 'magazine'` on content with only one hero image falls back to the next eligible variant in the preference list; the resulting design is still valid.
39. `accessibilityLevel: 'AAA'` produces `design.accessibility.minContrastBody === 7`.

### Rationale / prose field integration (`test/design/directive.test.ts` — continued)

40. `design.personality.rationale` includes the directive's `visualIntent` text when `visualIntent` is present.
41. `design.personality.rationale` is not empty when `visualIntent` is absent (inference-produced rationale is preserved).
42. `design.notes` includes the `colorIntent` text when `colorIntent` is present.
43. `design.notes` includes the `typographyIntent` text when `typographyIntent` is present.

---

## J. Potential architectural problems

### J1 — `ComposeOptions` extension surface

**Problem:** Every new optional field on `ComposeOptions` must be read and honoured inside `composeDesign`. As the field count grows, `composeDesign` accumulates conditional branches. The function is currently ~80 lines; at ten new fields it risks becoming difficult to review.

**Mitigation:** Keep the adapter translation deterministic and thin. Document each new `ComposeOptions` field with the exact line in `composeDesign` it affects. Add a lint rule or review checklist entry: every `ComposeOptions` field must be exercised by at least one snapshot test.

### J2 — `chromaScale` breaks the existing theme coherence guarantee

**Problem:** `ThemeDefinition.chroma` is not an isolated parameter — it is calibrated against `neutralChroma`, `secondaryHueShift`, and `accentHueShift` as a coherent unit. Multiplying `chroma` without adjusting the others can produce ramps that look unintentionally desaturated or over-saturated in their relationship to neutral and accent.

**Mitigation:** Scale `neutralChroma` by the same factor (capped independently at its own ceiling). Document this coupling explicitly. Consider whether `vivid` should also scale `neutralChroma × 0.5` to keep greys from tinting too strongly.

### J3 — `headingCharacter` and `typeScaleBias` have no clean hook in the current token pipeline

**Problem:** `buildTypography()` receives a `ThemeDefinition` and a `VisualDensity`. It does not accept a font character override or a ratio bias. Implementing these requires either (a) mutating the `ThemeDefinition` inside the adapter before passing it to `composeDesign`, or (b) adding parameters to `buildTypography()`.

Mutating `ThemeDefinition` is the wrong approach — it breaks the guarantee that the theme library is a fixed lookup table and makes the composed design depend on mutable objects.

**Mitigation:** Add `headingCharacter?: 'serif' | 'sans'` and `typeScaleBias?: 'subtle' | 'standard' | 'dramatic'` as parameters to `buildTypography()`, where they select the closest available font and ratio from the theme's own vocabulary. The adapter passes them through `ComposeOptions`; `composeDesign` passes them into `buildTypography()`. No `ThemeDefinition` is mutated.

### J4 — `layoutRhythm` and `emphasisHints` require changes to `planLayout()`

**Problem:** `planLayout()` currently determines section emphasis via `emphasisFor()` from `industries.ts` — a pure, industry-keyed lookup. Injecting `layoutRhythm` and `emphasisHints` requires `planLayout()` to accept new parameters and conditionally override `emphasisFor()`.

This is a legitimate extension but must be written carefully: the Director's emphasis hints must never reduce a section below `'secondary'` (the layout should never be quieter than the industry default expects), and the `lead` emphasis designation must follow the existing `emphasisFor()` semantics so the renderer's existing emphasis-to-background mapping works unchanged.

**Mitigation:** Add `layoutRhythm` and `emphasisHints` to `LayoutInput` in `layout.ts`. Treat the hints as a post-pass override on the `emphasisFor()` result rather than a replacement. Snapshot-test the resulting `layout.sections[n].emphasis` values for each rhythm variant.

### J5 — `confidence` has no consumer in the existing pipeline

**Problem:** `confidence` is required in the contract but the repair loop that would consume it does not yet exist. Requiring it now adds validation overhead for a field with no current effect.

**Mitigation:** The field is required because it must be present before the repair loop is built — retrofitting it later would break the contract. Accept the cost. Log `confidence` alongside the direction and direction basis in `designAgent.ts` so it is visible in runs before the repair loop exists.

### J6 — Semantic prose fields cannot be validated for quality

**Problem:** `visualIntent`, `heroIntent`, and the other prose fields are validated only for character count. A Director that outputs `"make it nice"` passes validation. The repair loop cannot currently distinguish a high-quality rationale from a vacuous one.

**Mitigation:** This is a model quality problem, not a contract problem. The contract's job is to bound and route the prose, not to evaluate it. The repair loop (future) will use `confidence` and `VisualCritiqueResult.overallScore` as the quality signal, not the rationale text.

### J7 — `brandColorHex` hex validation conflicts with the existing `findBrandColor()` regex

**Problem:** `findBrandColor()` uses `/\#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/i` (requires 3 or 6 hex digits only). The adapter should use the same regex to remain consistent — not a superset that accepts 4 or 8 digit forms that `buildColorSystem` / `hexToOklch` may handle differently.

**Mitigation:** The adapter must import and reuse the same hex pattern from `lib/design/color.ts` (or extract it to a shared constant) rather than defining its own. Divergent regexes are how subtle cross-module bugs form.

### J8 — The adapter is a new module with no existing test infrastructure

**Problem:** Unlike `composeDesign`, which is tested by `test/design/compose.test.ts` with rich fixtures, the adapter is a new module that needs its own fixture set. The existing `profileFixture` / `strategyFixture` / `fullContent` fixtures in `test/fixtures/` do not need to change, but adapter-specific fixtures (various `DesignDirective` objects) do not yet exist.

**Mitigation:** The adapter's test file (`test/design/directiveAdapter.test.ts`) should be the very first file written when implementation begins, before the adapter itself, as a TDD anchor. This is the correct order because the adapter's contract (validated input → `ComposeOptions`) is fully specified here.

### J9 — Adding fields to `ComposeOptions` must not break the `directionOverride()` feature-flag path

**Problem:** `designAgent.ts` currently calls `directionOverride(ctx)` to read a feature flag and passes the result directly to `composeDesign`. When the adapter is introduced, there are now two paths that can set `direction`: the feature flag and the Director. The precedence rule must be explicit.

**Recommended rule:** Feature flag wins over Director. The feature flag exists for operator override; the Director exists for AI inference. An operator who sets `design-direction-luxury` should always get luxury, regardless of what the Director chose.

**Mitigation:** The adapter should check whether a feature-flag direction override is active and, if so, overwrite `options.direction` with it before returning. Alternatively, `designAgent.ts` applies the flag after calling the adapter and before calling `composeDesign` — the same place it does today, just with the adapter's `ComposeOptions` as input. The second approach requires no change to the adapter's interface.

---

## Summary table

| Category | Count | Notes |
|---|---|---|
| Closed-enum fields | 12 | 7 reused from existing types; 5 new |
| Semantic prose fields | 7 | None enter arithmetic |
| Required fields | 2 | `rationale`, `confidence` |
| Hard validation failures | 1 | Empty/absent `rationale` only |
| Soft validation failures | 16 | All degrade to existing inference |
| New `ComposeOptions` fields | 10 | All optional; all additive |
| Existing files modified (source code) | 2 | `ComposeOptions` in `compose.ts`; `LayoutInput` in `layout.ts` |
| Existing files modified (tests) | 1 | `test/design/compose.test.ts` — additions only, no deletions |
| New source files | 2 | `lib/design/directive.ts`, `lib/design/directiveAdapter.ts` |
| New test files | 2 | `test/design/directive.test.ts`, `test/design/directiveAdapter.test.ts` |
| Required tests | 43 | Across validation, mapping, integration, and prose tests |
