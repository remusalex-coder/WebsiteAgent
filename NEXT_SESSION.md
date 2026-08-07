# Next Session

_Written 2026-08-07, after Milestone 1 (repository secured)._

> **Canonical documentation is BusinessForge HQ in Notion.** This file is the
> thirty-second version for whoever opens the repo first. The HQ has the
> Executive Dashboard, Decision Log, Master Backlog and one page per subsystem.

## The one thing blocking everything

Stages 4 and 5 need an AI provider credential. There is none on this machine.

```bash
printf 'AI_PROVIDER=gemini\nGEMINI_API_KEY=<key>\nANALYST_MODEL=gemini-2.5-flash\nWRITER_MODEL=gemini-2.5-flash\n' > .env
```

A free key comes from `aistudio.google.com`; no card is required. `.env` is
gitignored.

**The two `*_MODEL` lines are mandatory, not optional.** `DEFAULT_MODELS.gemini`
in `lib/config.ts` is `gemini-2.5-pro`, which lost its free tier in April 2026 —
setting `AI_PROVIDER=gemini` alone silently selects a paid model.

## Then run the four gates, in order

Each is cheap, and each has a defined failure exit.

**Gate 1 — first live provider call this project has ever made.** A throwaway
script: `provider.health()`, then one `generate()` against a two-field schema.
Proves credential, endpoint, header and schema translation in isolation.
*Fails → the adapter has a bug; fall back to `AI_PROVIDER=anthropic` with
`claude-haiku-4-5` (~$0.12/site).*

**Gate 2 — stage 4 on the real profile.** No re-scraping; the Tartine profile is
already on disk.

```bash
npx tsx main.ts --from=analyze 25e648c7 --env-file=.env
```

*Fails → `STRATEGY_SCHEMA` is 6,954 chars and Google publishes no size limit;
flatten it, or run the analyst on Haiku.*

**Gate 3 — stage 5.** Same run continues. Check `5-content.json`: 6–9 sections,
hero first, services with ≥ 5 bullets, `hours` and `contact` matching the
profile exactly, `unresolvedGaps` naming the six missing opening days, and no
grounding warnings in the run log.

**Gate 4 — read the site.** The design agent and renderer run automatically and
write `output/25e648c7/site/index.html`. Stage 6 then throws
`NotImplementedError` — expected; the site is written before that point, so the
artifact survives.

## What is already true, so you do not re-derive it

- **246 tests pass, typecheck is clean.** `npm run typecheck && npm test`.
- **Everything is committed.** `git log` no longer ends at stage 3.
- **`writerAgent` is implemented.** The model writes prose only; contact details,
  opening hours, JSON-LD and image selection are assembled from
  `BusinessProfile` afterwards. Its deterministic half is verified against the
  real Tartine profile — hours merging, JSON-LD, and the grounding check, which
  caught all three plants in deliberately poisoned copy.
- **`designAgent` makes no model call** and never will. Determinism is a
  property of the code, not a promise about temperature.
- **The renderer is a library, not a stage**, so deployment can call it and get
  byte-identical output to what was reviewed locally.
- **Resume is the fast loop.** `npm run render -- output/<runId>/5-content.json`
  re-renders a saved spec in milliseconds without paying for two model calls.

## Two known product defects, already diagnosed

Both surfaced from verifying the writer against real data, and both will be
visible on the first generated site:

1. **The contact block lists three emails**, including a press inbox and a
   *different* business's address. `contactBullets` emits every email in the
   profile; it needs ranking and a cap.
2. **The phone renders as `+14154872600`** because that is what Maps supplied.
   Honest, and wrong for a customer-facing page. Needs display formatting that
   invents no digits.

Do not fix these before Milestone 7. The critique decides what is highest impact.

## Current state, in one line

Repository secured at `f078d4b`; stages 1–3 verified live; stages 4–5 built and
never executed; design and renderer built and tested; nothing deployed; blocked
on one credential.
