# Roadmap

_Last updated: 2026-08-06_

Goal: a Google Maps URL goes in, a deployed website comes out, unattended.
Stages 1–4 and the renderer are built. The loop does not close until a spec written by
stage 5 reaches a live URL.

## Priorities

| | Meaning |
|---|---|
| **P0** | Blocks the next step. Do first. |
| **P1** | Required to close the loop. |
| **P2** | Quality and durability. Do once the loop closes. |

---

## M1 — Deterministic renderer (P0) ✅

Nothing turned a `WebsiteContent` into a website. The strategy and the spec were
structured data with no artifact at the end of them, which made every stage upstream
unverifiable in the only way that counts — by looking at the result.

1. ✅ **`lib/render`** — `WebsiteContent` → `index.html`, `styles.css`, assets.
   Semantic HTML5, accessible markup, responsive layout, every string escaped.
2. ✅ **Deterministic.** No clock, no randomness, sorted JSON-LD keys. The same spec
   renders to the same bytes.
3. ✅ **Tests** — 110 assertions in `test/render/`, including whole-file snapshots.
4. ✅ **Wired in.** Runs after stage 5 in `runPipeline`; `npm run render` renders a
   saved spec standalone.

_Exit:_ a rendered site opened from disk and read end to end. **Done** — see
[docs/renderer.md](docs/renderer.md).

## M2 — Vercel preview deployment (P0)

The renderer produces files; nothing publishes them. This is the next blocker, and it
can be built and verified now, against a fixture spec, without the writer existing.

5. **Deployment agent** — `RenderedSite` → a preview URL. Consumes `renderSite` output
   unchanged: it uploads `RenderedFile[]` and the assets beside them, and renders
   nothing of its own. No second rendering system.
6. **Project create/reuse**, upload, poll to ready or failed, return the URL.
7. **Reproducibility** — store what was deployed alongside the run's artifacts, so a
   run can be replayed from `output/<runId>/` with no network call to Vercel.
8. **Replace or retire `lovableAgent`.** `DeploymentResult` already fits; the agent is
   still a stub and still names Lovable in its contract comment.

_Exit:_ `output/<runId>/site/` served at a preview URL, from a fixture spec, unattended.

## M3 — Content (P1)

Both of these need a live API key, which is why they sit behind the two milestones
that do not.

9. **Verify stage 4.** It has never executed. One Maps URL, one API call. Confirm
   `strategy.json` validates, `stop_reason` is `end_turn`, and the recommendations are
   grounded rather than generic. Tune `ANALYST_EFFORT`,
   `ANALYST_MAX_OUTPUT_TOKENS` and the system prompt against observed output.
10. **`writerAgent`** — profile + strategy → `WebsiteContent`. Sections, copy, brand
    voice, SEO metadata, LocalBusiness JSON-LD. Grounding is the hard requirement:
    every claim traceable to a profile field; gaps go to `unresolvedGaps`, never to
    invented filler.
11. **First full run.** Maps URL → live URL, no manual steps. ← **the loop closes here**

_Exit:_ a working website nobody hand-edited.

## M4 — Make it durable (P2)

12. **Commit everything.** `git log` still ends at stage 3; four milestones of work
    live only in one working tree.
13. **Older tests into the repo.** Five suites remain in a scratchpad — discovery
    parsers, normalizer primitives, merge/dedup/validation, analyst schema and brief.
    `test/` and `npm test` now exist to receive them.
14. **Retry and backoff** on transient Maps/site failures; today one blip fails a stage.
15. **Resume from artifacts** — `--from-stage` so a failed deploy doesn't re-scrape.
16. **CI** — typecheck, tests and build on push. Add `.gitattributes`
    (`* text=auto eol=lf`); `core.autocrlf=true` locally would give a collaborator on
    macOS or Linux whole-file diffs.

## M5 — Quality and scale (P2)

17. **Accessibility and HTML validation in CI** — axe and the W3C validator against a
    rendered fixture. The markup is currently checked by assertions about the string.
18. **Multi-page output.** `WebsiteContent` describes one document, so the renderer
    emits one; the strategy already recommends several. This is a contract change, and
    a deliberate one.
19. **Places API path** for review count and full-week hours — the fields scraping
    structurally cannot get.
20. **Image quality pass** — the hero is currently the largest gallery image when
    nothing is tagged; a real check would improve every site.
21. **Batch mode** — many URLs per run, concurrency-bounded.
22. **Regression fixtures** — snapshot a few profiles so selector rot surfaces in CI
    rather than in production.

---

## Order

```
M1 renderer ✅
  └─ M2 Vercel preview deployment
       └─ M3 verify stage 4 → writerAgent → first full run   ← loop closes here
            └─ M4 durability
                 └─ M5 quality & scale
```

M1 and M2 are the half of the pipeline that needs no credentials, which is why they
come first: both are verifiable today, against a fixture spec, with no API key at all.
M4 and M5 are independent of each other; both depend on the loop closing.
