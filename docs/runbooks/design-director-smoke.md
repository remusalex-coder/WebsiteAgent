# Runbook — the Design Director smoke test

Proves, with one business and one real model call, that

```
real AI → designDirectorAgent → DesignDirective → applyDirective()
        → deterministic design → HTML → screenshots → persistent artifacts
```

works end to end, and that the pages it produces are working websites.

## Run it

```bash
npm run design-director
```

Free rehearsal — everything except the model call, no credential needed:

```bash
npm run design-director -- --control-only
```

## What it costs

**One AI call**, and only when `smoke-test/director/directive.json` is absent.

Three things guarantee that, described in
[ADR 0002](../decisions/0002-resumable-jobs-enforce-the-one-call-rule.md):
`maxRetries` is forced to 0; the provider is wrapped in a counter that throws on
a second call; and every step is a resumable job, so a crash after the call is
free to fix and re-run.

**To force a fresh call, delete `smoke-test/director/directive.json`.** There is
no flag for it. Spending money should require removing evidence.

## What it produces

```
smoke-test/
  control/                     deterministic design, no model
    design.json  index.html  styles.css  report.json
    assets/  fonts/
    screenshots/desktop.png  screenshots/mobile.png
  director/                    same input, directive applied
    directive.json             ← the model's raw output
    directive.provenance.json  ← provider, model, tokens, request id, timing
    design.json  index.html  styles.css  report.json
    assets/  fonts/
    screenshots/desktop.png  screenshots/mobile.png
  smoke-results.json           verdict, checks, structural diff
  run.log.ndjson               every step, appended across runs
  run.meta.json                run id, so a resumed run keeps its identity
```

`smoke-test/` is at the repository root and is **not** gitignored — `output/` is,
and an artifact an operator cannot open is not evidence.

Open a page directly from disk; it needs no server and no JavaScript:

```bash
start smoke-test/director/index.html
```

## How to read the result

`smoke-results.json` carries `verdict`, and the command prints every check. Three
groups:

- **Functional**, per variant per viewport — page errors, console, failed
  requests, `h1`, primary CTA, in-page navigation (clicked, not just counted),
  images decoded, horizontal overflow, word and section counts, screenshot size.
- **Provenance** — `ai.exactly-one-call` and `ai.directive-is-model-output`. A
  resumed run passes the first but says so, naming the timestamp and vendor
  request id of the live call behind the artifact.
- **Difference** — `design.structural-difference` (fields that moved in
  `WebsiteDesign`), `render.observable-difference` (HTML and CSS hashes), and
  `render.same-copy`.

`render.same-copy` compares section headings and section ids read with
`textContent`, **not** rendered word counts. Word counts are the wrong
instrument and said so on the first run: the director's page came out 34 words
shorter, all of it design — `text-transform: uppercase` on the tagline (which
`innerText` reports as changed text), the ordinals a numbered section variant
draws, and a footer nav the editorial direction drops. `textContent` returns what
the writer actually wrote.

## The fixture

`test/fixtures/business.ts` and `test/fixtures/content.ts` — the typechecked
ones, so they cannot drift from `BusinessProfile` without the build saying so.
Do not use `scripts/example-businesses.ts`: `scripts/` is outside both tsconfig
includes, and its `build()` is already missing three required profile fields.

The only edit the harness makes is repointing the image assets at `.svg` files it
writes, because `fullContent` names `.png`/`.jpg` paths no file backs and a page
of broken-image icons reads as a layout fault. The placeholders are a fixed
neutral grey, **identical in both variants** — deliberately unlike
`scripts/generate-examples.ts`, which tints them from each design's own ramp.
There the point is to review a page; here the point is to attribute a difference,
and a placeholder that changes colour with the design would let "the images are a
different grey" masquerade as evidence about the layout.

Nothing about the business is invented: no facts, no copy, no claims.
