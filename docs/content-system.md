# The content system

_How BusinessForge decides what a business's page actually **says** — the layer
added after the experience system made the page's *order* bespoke and left its
*prose* generic. See [ADR 0007](decisions/0007-content-is-directed-by-narrative-role-and-written-in-the-evidence-language.md)
for the decision record._

## The chain

```
Research evidence (profile)
  → composeBaseline          agents/writerAgent.ts    (facts + structure, no writing)
  → planNarrative            lib/design/plan.ts       (character · experience · conversion · roles)
  → indexEvidence            lib/content/evidence.ts  (what may be said)
  → detectLanguage           lib/content/language.ts  (what language to say it in)
  → directContent            lib/content/director.ts  (what each beat says)
  → auditContent             lib/content/quality.ts   (may it say that?)
  → composeDesign(…, plan)   lib/design/compose.ts
  → renderer                 lib/render/
```

Everything here is **deterministic and runs with no model**. `--compose` produces
the finished copy on its own. An AI writer remains possible as a validated
*improver* on top of this floor — the same relationship the AI Director has with
the deterministic experience floor — and is not built.

## What the director may say

Three bases, recorded on every string it emits so any line on the page can be
audited back to a fact:

| basis | meaning | example |
|---|---|---|
| `quoted` | verbatim from the business; the only edit is where the phrase is cut | `Sala mare cu candelabru floral și arcade filigranate` (a photograph's own caption) |
| `composed` | facts joined by a closed-set frame | `Locație de evenimente` + `Drăgășani` → `Locație de evenimente în Drăgășani` |
| `framing` | a label from the closed lexicon, keyed to the narrative role | `Program`, `Ce oferim`, `Rezervă` |

**A frame may compose facts. It may never supply them.** `test/content/director.test.ts`
enforces both halves: a `quoted` value must appear verbatim in the evidence index,
and a `composed` one may contain no word that is neither evidence nor lexicon.

## The heading is chosen by the beat

The same section kind is written differently for a different business, because
what the beat is *for* differs and so does the evidence behind it.

| role | names | falls back to |
|---|---|---|
| `arrival` / `emotion` | the trade in the business's own words, plus the town | the listing category |
| `reveal` | the opening phrase of its own prose | `About <name>` |
| `process` | the same, for a functional business | `How <name> works` |
| `signature` | what the photograph on that beat shows | `Inside <name>` |
| `breadth` | its own offering names, when naming **all** of them is the range | `What we offer` |
| `trust` | the rating and review count | `Reviews` |
| `conversion` | the action the conversion strategy chose | — |
| `context` / `proof` | a plain practical label — a bespoke heading here is worse UX | — |

Three guards keep a quotation from reading as a machine's mistake: it may not
open on a connective, end on a preposition, restate the business's name, run past
56 characters, or repeat the first words of the copy directly beneath it. When a
quotation fails them, the honest generic label is better than a mangled phrase.

### One sentence may move

A page whose visual peak carries no words is a photograph with its caption
missing. The strongest sentence the business published — measured by how much of
its own distinctive vocabulary it carries — is **moved** to the signature beat,
never copied, and only when the section it came from can spare it.

## Language follows evidence

Detection is deterministic: function words and diacritics, with a margin, and
English as the recorded default when nothing decides. `WebsiteContent.language`
carries the tag to `<html lang>`, which is what a screen reader uses to choose a
voice.

The `Lexicon` covers **every string the platform authors**: role labels, CTA
verbs, contact-row captions, weekday names, navigation labels, the section
eyebrow, the skip link, the partial-hours disclosure, the rating line. Adding a
language is one literal and one row of function words — no new code path.

**Evidence is never translated.** "Event & wedding venue" stays as Google states
it even on a Romanian page, because translating a fact is editing it.

## The gate

`auditContent` is written to be failable, and the benchmark proves it fails: it is
fed a deliberately fabricating page for each of the seven businesses and must
reject all seven.

`error` — the page must not ship:

- `unsupported-claim` — an award, a founding year, a certification, a guarantee,
  a customer count, a superlative rank or a price that the evidence index does
  not contain
- `boilerplate` — "Welcome to", "We are passionate about", "Discover our", "Your
  trusted", "Where quality meets", "Something for everyone", …
- `repeated-phrase`, `duplicate-value-proposition`
- `role-mismatch` — a breadth beat listing nothing, a conversion beat offering no
  action, a signature beat carrying neither imagery nor words
- `cta-mismatch` — a button whose verb the conversion strategy did not choose
- `empty-section` — a heading with nothing under it
- `no-business-evidence` — no heading on the page built from anything this
  business said or offers

`warning` — honest but plain: `weak-heading`, `verbose`, `repeated-structure`,
`inconsistent-terminology`. Warnings are the measure of how much of the page is
still template; `specificity` (the share of headings built from the business's own
words) is the number to watch.

## Narrative role reaches the stylesheet

`SectionDesign.role` is emitted as `data-role`, so CSS can reason about *beats*
rather than section kinds:

- `[data-role="signature"]` is set at display scale, capped against the viewport —
  the peak has to look like one, and it was arriving 5px larger than the section
  three bands above it
- a `[data-world="ember"]` gallery still steps its heading aside, **unless** it is
  the signature, because that heading is now the business's own words
- `[data-role="context"]` on a cinematic page steps down: an opening-hours band
  competing with the peak is what flattens an arc back into a stack

The rule this encodes: **do not let a later layer erase the intelligence of an
earlier one.** Both stylesheet exceptions above were rules written when every
gallery on every page was headed "Photographs"; they were scoped rather than
deleted.

## Two real businesses, end to end

Both run through the actual pipeline with no manual edits (`npx tsx main.ts
--compose <runId>`).

**River Park Events, Drăgășani** — Romanian, image-led, romantic, `narrative`:

```
Locație de evenimente în Drăgășani     ← self-description + locality (composed)
Despre River Park Events               ← reveal frame
Ce oferim                              ← six offerings: naming three would be a partial claim
Sala mare cu candelabru floral și arcade filigranate   ← the signature photograph's own caption
Program · Contact
Rezervă la River Park Events           ← conversion.primaryCta = book
```

Buttons: "Rezervă". `<html lang="ro">`. Heading scale 114 → 95 → 62 → 10px, so
the peak is visibly the peak. `EventVenue` structured data, seven days of opening
hours, zero JavaScript.

**Tartine Bakery, San Francisco** — English, `narrative`, thinner evidence:

```
Bakery in San Francisco                ← listing category + locality
(statement band — deliberately unheaded)
About Tartine Bakery
Inside Tartine Bakery                  ← no usable photograph caption, so the honest frame
Opening hours · Contact
Order from Tartine Bakery              ← conversion.primaryCta = order
```

Tartine scores lower on `specificity` than River Park, because its photographs
carry no useful alt text and its prose contains no self-description. That is the
correct answer, not a number to tune away.

## Known limits

- **`classifyIndustry` has no venue category.** An event venue reaches `general`
  (`imageReliance: supporting`), which suppresses the narrative mode, unless a
  service name happens to contain a known trade word. River Park classifies as
  `hotel` because one of its six services is "Cazare — River Park Hotel". That
  accident currently works and should not be relied on.
- **Image alt text is the strongest content source the director has**, and it
  comes from research. A business whose photographs were captured without
  captions gets plainer headings — visible in Tartine's `specificity`.
- **No canonical link is emitted.** A statically written site has no known
  origin, and pointing one at the directory page the research came from would be
  wrong. Absence is the honest answer here.
