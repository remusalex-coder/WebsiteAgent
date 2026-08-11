# 0007 — Content is directed by narrative role, and written in the language of the evidence

_Status: accepted, 2026-08-11. Extends ADR 0006, which made the page's **order** a
narrative; this makes its **words** one too._

## Context

ADR 0006 shipped the experience layer, and it worked: River Park Events was
correctly read as an image-led romantic venue, given a `narrative` arc
(`emotion → reveal → signature → breadth → context → conversion`), a full-bleed
signature gallery, an editorial `book` conversion, and a 99/100 experience
score.

Then the renderer set that arc in these words:

> **Event & wedding venue in Drăgășani** · About River Park Events Drăgășani ·
> **What we offer** · **Photographs** · **Opening hours** · Contact ·
> **Visit River Park Events Drăgășani in Drăgășani** — every button reading
> **"Call us"**.

Six of those seven strings are identical on every business BusinessForge has ever
produced, and all seven are English on a venue whose every published word —
description, six service names, eleven amenities, every photograph caption — is
Romanian. The page was *structured* specifically and *worded* generically. The
structure said "this venue"; the prose said "a website".

Three separate failures were tangled together:

1. **No layer decided what a beat should say.** `composeBaseline` emits fixed
   labels keyed to section kind, and it runs *before* the narrative plan exists,
   so it could not have known the role of any beat even in principle.
2. **The language of the platform was not the language of the business.**
3. **Later layers erased earlier ones.** The conversion strategy chose `book`;
   `primaryCtaFor` overwrote every button with "Call us" because a phone number
   existed. The narrative nominated a signature gallery; a stylesheet rule
   written for the era of `"Photographs"` headings hid its heading entirely.

## Decision

Insert a deterministic **Content Director** between the narrative plan and the
composer, and make the language of the copy a function of the evidence.

```
Evidence
  → planNarrative()         lib/design/plan.ts       (character · experience · conversion · roles)
  → directContent()         lib/content/director.ts  (what each beat says)
  → auditContent()          lib/content/quality.ts   (may it say it?)
  → composeDesign(…, plan)  lib/design/compose.ts
  → renderer
```

### 1. The director rewrites words, never structure

Same sections, same kinds, same order, same images, same factual bullets. It
cannot add a section and it cannot add a fact. Every string it emits carries a
`basis`:

- **`quoted`** — verbatim from the business (a service name, a sentence of its
  own description, the alt text on its own photograph). The only permitted edit
  is where the phrase is cut.
- **`composed`** — facts joined by a closed-set frame: `"locație de evenimente"`
  + `"Drăgășani"` → `"Locație de evenimente în Drăgășani"`.
- **`framing`** — a label from the closed lexicon, keyed to the *narrative role*.

**A frame may compose facts. It may never supply them.** That is the rule
`lib/design/patterns.ts` already enforces on the pattern library, and the tests
enforce it here: a `quoted` value must appear verbatim in the evidence index, and
a `composed` one may contain no word that is neither evidence nor lexicon.

### 2. The heading is chosen by the beat, not by the section kind

Each role names the evidence that is *right for that beat*, and falls back to a
role-keyed label only when the evidence does not survive its guards:

| role | what it names |
|---|---|
| `arrival` / `emotion` | the trade, in the business's own words where it published them |
| `reveal` | the opening phrase of its own prose |
| `signature` | what the photograph on that beat actually shows |
| `breadth` | its own offering names, when naming all of them *is* the range |
| `trust` | the rating and the review count |
| `conversion` | the action the conversion strategy chose |
| `context` / `proof` | a plain practical label — a bespoke heading here is worse UX |

### 3. The language of the copy follows the language of the evidence

Deterministic detection over function words and diacritics, and a closed
`Lexicon` per language covering every string the platform authors: role labels,
CTA verbs, contact captions, weekday names, nav labels, the section eyebrow, the
skip link, the partial-hours disclosure. `WebsiteContent.language` carries the
tag to `<html lang>`.

**Evidence is never translated.** The category as Google states it, a service
name, a published sentence — all stay verbatim in whatever language they arrived
in, because translating a fact is editing it.

### 4. The plan is derived once and read twice

`deriveCharacter` used to read the register off the *page's* prose. With a
director writing that prose, a page could read its own adjectives back as
evidence and talk itself into being romantic. So the register is now read from
the business's own material only — description, services, stated attributes,
published pages — and `planNarrative` runs once, before direction, feeding both
the director and `composeDesign`. The benchmark asserts the plan is byte-identical
before and after direction, for all seven businesses.

### 5. A content quality gate that can fail

`auditContent` checks twelve classes of defect against the evidence index:
fabricated claims (awards, tenure, certifications, guarantees, prices, customer
counts, superlatives), banned boilerplate, repeated phrases and structures, weak
headings, role mismatch, CTA mismatch, empty sections, verbosity, duplicated
propositions, terminology drift, and the absence of any business-specific
evidence at all. Errors block; warnings measure how much of the page is still
template. The benchmark feeds every one of the seven businesses a deliberately
fabricating page and asserts all seven are rejected.

## Consequences

- **The rendered page changed, not only the artifact.** River Park now reads
  `Locație de evenimente în Drăgășani · Despre River Park Events · Ce oferim ·
  Sala mare cu candelabru floral și arcade filigranate · Program · Contact ·
  Rezervă la River Park Events`, every button "Rezervă", `<html lang="ro">`.
- **`NarrativeRole` reaches the stylesheet** as `data-role`, so CSS can treat the
  page's peak as a peak. Two rules written in the `"Photographs"` era were
  correctly scoped rather than deleted.
- **A new required field**, `WebsiteContent.language`. `ARTIFACT_DEFAULTS` in
  `main.ts` gained `language: 'en'` in the same commit, per the standing rule.
- **Adding a language is a data change** — one `Lexicon` literal and one row of
  function words. No new code path.
- **The gate is honest about thin businesses.** Tartine Bakery, whose photographs
  carry no useful alt text and whose prose contains no self-description, scores
  lower on `specificity` than River Park. That is the correct answer, not a bug
  to tune away.

## What this does not decide

- The director makes **no model call**. An AI writer remains possible as a
  validated *improver* on top of this floor, exactly as the AI Director sits on
  top of the deterministic experience floor. It is not built.
- Imagery *strategy* (pacing, crop, prominence) is still advisory in places.
- `classifyIndustry` has no `venue` category, so event venues reach `general`
  unless a service name happens to contain a known trade word. River Park
  classifies as `hotel` because one of its six services is "Cazare — River Park
  Hotel". That is an accident that currently works, and it is the next thing to
  fix.
