# Design Director V1 — A/B Experiment Report

Generated: 2026-08-09T22:27:57.700Z

## 1. Experiment Objective

Compare the existing deterministic design pipeline (Control A, `DIRECTOR_ENABLED=false`)
against the same pipeline guided by the AI Design Director (Director B, `DIRECTOR_ENABLED=true`).

The goal is to measure whether the Design Director produces **meaningfully better** outcomes,
not merely different ones.

## 2. Corpus

Five real businesses, as defined in `scripts/batch-audit.ts` (unchanged):

| # | Business | Industry | Maps URL |
|---|---|---|---|
| 1 | Zuni Café | Restaurant | Google Maps search |
| 2 | Union Square Dental | Dentist | Google Maps search |
| 3 | Kerr & Wagstaffe LLP | Lawyer | Google Maps search |
| 4 | Hotel Union Square | Hotel | Google Maps search |
| 5 | Salon DnA | Hair & Beauty Salon | Google Maps search |

## 3. Control Configuration (Group A)

- `DIRECTOR_ENABLED=false`
- `OUTPUT_DIR=./output/ab-test/control`
- All other settings: default / same as Director B

## 4. Director Configuration (Group B)

- `DIRECTOR_ENABLED=true`
- `OUTPUT_DIR=./output/ab-test/director`
- All other settings: default / same as Control A

## 5. Methodology

Pipeline for both groups:

```
business → discovery → collection → normalization → analysis → writer → [Director B only: Design Director] → deterministic design → render
```

Each business is run as a separate subprocess via `main.ts`.
The `OUTPUT_DIR` env var directs artifacts to group-specific directories.
Both groups process the same Maps URLs. Pipeline stages are non-deterministic for
discovery/collection (Google Maps is live), so inputs are not byte-identical between A and B.
This is a documented limitation — see Section 5.1.

### 5.1 Input Non-Determinism

Discovery and collection stages hit live Google Maps URLs. Content may differ between
Control A and Director B runs if Google serves different results. This is inherent to
the pipeline and cannot be avoided without caching stage 1–3 artifacts and replaying them.
The experiment documents this limitation rather than silently masking it.

## 6. Per-Business Comparison

### Zuni Café (Restaurant)

**Control A**: ⚠️ pipeline did not produce a site


---

**Director B**: ⚠️ pipeline did not produce a site


#### Differences (A vs B)

_No mechanical differences detected._

#### Regressions (AUTOMATED)

- ⚠️ incomplete — one or both groups failed to produce a site

#### Improvements (AUTOMATED)

_None detected mechanically (visual improvements require human review)._

#### Director Directive Analysis (Director B only)

> Director was disabled — no directive produced.

#### Verdict: ⚠️ INCOMPLETE

> 🖼️ **VISUAL/HUMAN REVIEW REQUIRED**
> Screenshots are located at:
> - Control:  `output/ab-test/control/<runId>/shots/`
> - Director: `output/ab-test/director/<runId>/shots/`
>
> Human reviewers must assess: visual hierarchy, hero suitability, brand/industry fit,
> information density, imagery usage, typography, CTA prominence, mobile composition,
> accessibility, and overall coherence.
> Do NOT infer a visual winner from automated metrics alone.

---

### Union Square Dental (Dentist)

**Control A**: ⚠️ pipeline did not produce a site


---

**Director B**: ⚠️ pipeline did not produce a site


#### Differences (A vs B)

_No mechanical differences detected._

#### Regressions (AUTOMATED)

- ⚠️ incomplete — one or both groups failed to produce a site

#### Improvements (AUTOMATED)

_None detected mechanically (visual improvements require human review)._

#### Director Directive Analysis (Director B only)

> Director was disabled — no directive produced.

#### Verdict: ⚠️ INCOMPLETE

> 🖼️ **VISUAL/HUMAN REVIEW REQUIRED**
> Screenshots are located at:
> - Control:  `output/ab-test/control/<runId>/shots/`
> - Director: `output/ab-test/director/<runId>/shots/`
>
> Human reviewers must assess: visual hierarchy, hero suitability, brand/industry fit,
> information density, imagery usage, typography, CTA prominence, mobile composition,
> accessibility, and overall coherence.
> Do NOT infer a visual winner from automated metrics alone.

---

### Kerr & Wagstaffe LLP (Lawyer)

**Control A**: ⚠️ pipeline did not produce a site


---

**Director B**: ⚠️ pipeline did not produce a site


#### Differences (A vs B)

_No mechanical differences detected._

#### Regressions (AUTOMATED)

- ⚠️ incomplete — one or both groups failed to produce a site

#### Improvements (AUTOMATED)

_None detected mechanically (visual improvements require human review)._

#### Director Directive Analysis (Director B only)

> Director was disabled — no directive produced.

#### Verdict: ⚠️ INCOMPLETE

> 🖼️ **VISUAL/HUMAN REVIEW REQUIRED**
> Screenshots are located at:
> - Control:  `output/ab-test/control/<runId>/shots/`
> - Director: `output/ab-test/director/<runId>/shots/`
>
> Human reviewers must assess: visual hierarchy, hero suitability, brand/industry fit,
> information density, imagery usage, typography, CTA prominence, mobile composition,
> accessibility, and overall coherence.
> Do NOT infer a visual winner from automated metrics alone.

---

### Hotel Union Square (Hotel)

**Control A**: ⚠️ pipeline did not produce a site


---

**Director B**: ⚠️ pipeline did not produce a site


#### Differences (A vs B)

_No mechanical differences detected._

#### Regressions (AUTOMATED)

- ⚠️ incomplete — one or both groups failed to produce a site

#### Improvements (AUTOMATED)

_None detected mechanically (visual improvements require human review)._

#### Director Directive Analysis (Director B only)

> Director was disabled — no directive produced.

#### Verdict: ⚠️ INCOMPLETE

> 🖼️ **VISUAL/HUMAN REVIEW REQUIRED**
> Screenshots are located at:
> - Control:  `output/ab-test/control/<runId>/shots/`
> - Director: `output/ab-test/director/<runId>/shots/`
>
> Human reviewers must assess: visual hierarchy, hero suitability, brand/industry fit,
> information density, imagery usage, typography, CTA prominence, mobile composition,
> accessibility, and overall coherence.
> Do NOT infer a visual winner from automated metrics alone.

---

### Salon DnA (Hair & Beauty Salon)

**Control A**: ⚠️ pipeline did not produce a site


---

**Director B**: ⚠️ pipeline did not produce a site


#### Differences (A vs B)

_No mechanical differences detected._

#### Regressions (AUTOMATED)

- ⚠️ incomplete — one or both groups failed to produce a site

#### Improvements (AUTOMATED)

_None detected mechanically (visual improvements require human review)._

#### Director Directive Analysis (Director B only)

> Director was disabled — no directive produced.

#### Verdict: ⚠️ INCOMPLETE

> 🖼️ **VISUAL/HUMAN REVIEW REQUIRED**
> Screenshots are located at:
> - Control:  `output/ab-test/control/<runId>/shots/`
> - Director: `output/ab-test/director/<runId>/shots/`
>
> Human reviewers must assess: visual hierarchy, hero suitability, brand/industry fit,
> information density, imagery usage, typography, CTA prominence, mobile composition,
> accessibility, and overall coherence.
> Do NOT infer a visual winner from automated metrics alone.

## 7. Mechanical Metrics Summary

| Business | Group | Direction | Hero | Sections | Broken Imgs | H-Overflow | CTAs |
|---|---|---|---|---|---|---|---|
| Zuni Café | Control A | - | - | - | - | No | - |
| Zuni Café | Director B | - | - | - | - | No | - |
| Union Square Dental | Control A | - | - | - | - | No | - |
| Union Square Dental | Director B | - | - | - | - | No | - |
| Kerr & Wagstaffe LLP | Control A | - | - | - | - | No | - |
| Kerr & Wagstaffe LLP | Director B | - | - | - | - | No | - |
| Hotel Union Square | Control A | - | - | - | - | No | - |
| Hotel Union Square | Director B | - | - | - | - | No | - |
| Salon DnA | Control A | - | - | - | - | No | - |
| Salon DnA | Director B | - | - | - | - | No | - |

## 8. Director Directive Quality

For each Director B run, the directive was analysed for:
- Presence of generic reasoning (flags flagged, not automatically failed)
- Confidence level
- Rationale completeness
- Direction validity

See per-business sections above for per-business analysis.

## 9. Regressions

- **Zuni Café**: incomplete — one or both groups failed to produce a site
- **Union Square Dental**: incomplete — one or both groups failed to produce a site
- **Kerr & Wagstaffe LLP**: incomplete — one or both groups failed to produce a site
- **Hotel Union Square**: incomplete — one or both groups failed to produce a site
- **Salon DnA**: incomplete — one or both groups failed to produce a site

## 10. Improvements (Mechanical)

_No mechanical improvements detected._

> ⚠️ Visual improvements require human review of screenshots. See per-business sections.

## 11. Neutral Changes

Changes in direction, color, or hero variant are **differences**, not improvements or regressions.
They require human review to assess quality.

No significant neutral changes detected mechanically.

## 12. Overall Result

**⚠️ INCOMPLETE — not all businesses completed both groups**

- Businesses compared: 0/5
- Positive verdicts: 0
- Neutral verdicts: 0
- Negative verdicts: 0

> ⚠️ Automated metrics measure mechanical correctness, not visual quality.
> A complete verdict requires human review of screenshots in `output/ab-test/`.

## 13. Recommendation

The experiment is **INCOMPLETE**. Re-run with valid API credentials for all five businesses before drawing conclusions.
