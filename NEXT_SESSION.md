# Next Session

_Written 2026-08-06, after M1 (the renderer)._

## Do this first (~5 minutes)

**Commit.** `git log` still ends at stage 3. The working tree now holds the analyst,
the AI provider layer, the capability platform, the renderer, `docs/` and `test/` —
four milestones of work on one machine, none of it on GitHub.

Verify before committing:

```bash
npm run typecheck && npm test && npm run build
```

All three pass as of this writing: 110 tests, 0 failures.

---

## Then implement: Vercel preview deployment (M2)

### Why this one, and not the writer

Because it needs no API key. `writerAgent` and the unverified stage-4 call both do,
and both are blocked on that; deployment is not. The renderer already produces a
complete site, and a fixture spec in `test/fixtures/content.ts` will drive an end-to-end
deploy today, with nothing else built.

That also makes it the honest next test of the renderer: it has been opened from disk
and read, but no host has ever served it.

### The contract to hold

**Consume `renderSite` unchanged.** The deployment agent uploads `RenderedFile[]` and
the assets beside them. It renders nothing of its own, templates nothing, and rewrites
no markup. A second rendering system is the failure mode to design against — the whole
point of `lib/render` being a library rather than a stage is that deployment can call it
and get exactly the bytes that were reviewed locally.

```ts
import { renderSite } from './lib/render/index.js';

const site = renderSite(content);
// site.files   -> upload as-is
// site.assets  -> read sourcePath from the run dir, upload at .path
```

`writeRenderedSite` is *not* on the path: the deployment agent should not need a
temporary folder. It exists for local inspection and for `npm run render`.

### What to build

1. **A deployment agent** — `WebsiteContent` → `DeploymentResult`, which already has
   the right shape (`projectId`, `liveUrl`, `status`, `deployedAt`).
2. **Project create or reuse**, upload, poll to ready or failed, return the URL.
   Bounded by a configured timeout and cancellable via `ctx.signal`, the same way the
   analyst handles its request.
3. **Reproducibility** — persist what was deployed alongside the run's artifacts, so a
   run can be replayed from `output/<runId>/` without calling Vercel again.
4. **Decide what happens to `lovableAgent`.** It is still a stub, and its contract
   comment still says it is "the only agent that knows Lovable exists". Replacing it is
   probably right; the milestone should say so either way.
5. **Config** — a `vercel` section in `lib/config.ts` plus entries in `.env.example`,
   and nowhere else. Follow the `lovable` block already there.

### Recommended prompt

> Implement the Vercel preview deployment agent only.
>
> Input: WebsiteContent
> Output: DeploymentResult
>
> Requirements:
>
> 1. Render with `renderSite` from `lib/render`. Do not build a second renderer.
> 2. Upload `RenderedFile[]` and the assets from the run directory.
> 3. Create or reuse a project; poll to ready or failed; return the preview URL.
> 4. Bound by a configured timeout, cancellable via `ctx.signal`.
> 5. Persist what was deployed so the run is reproducible from its artifacts.
> 6. Config goes in `lib/config.ts` and `.env.example`, nowhere else.
> 7. Verify against `test/fixtures/content.ts` — no API key is needed upstream.
>
> Do not implement writerAgent.
> Do not modify WebsiteContent or lib/render.

### Notes for whoever picks this up

- **The renderer is deterministic and tested** — if a deployed page differs from the
  local one, the difference came from the host, not from rendering. Diff
  `output/<runId>/site/index.html` against what was served.
- **`site.warnings` is not an error channel.** It reports fields the renderer worked
  around. Log it; do not fail a deploy on it.
- **Nothing in a rendered site fetches anything external** — no web fonts, no CDN. A
  host that needs a CSP will not need an allow-list.
- **`npm run render -- output/<runId>/5-content.json`** re-renders a saved spec in
  milliseconds. Use it while iterating rather than re-running the pipeline.

---

## After that: M3, which needs a key

`ANTHROPIC_API_KEY` (or another provider's) unblocks both remaining pieces:

1. **Verify stage 4.** It has still never executed. Check `strategy.json` parses,
   `stop_reason` is clean, and the recommendations are grounded rather than generic.
2. **`writerAgent`.** Grounding is the hard part, not the API call — that pattern is
   established in `businessAnalystAgent.ts`; copy it. Every claim must trace to a
   profile field, and a gap the layout wants belongs in `unresolvedGaps`, never in
   plausible filler. `config.writer` exists; note that Opus 5 rejects `temperature`, so
   use `effort`.

## Current state, in one line

Stages 1–3 verified live; stage 4 built but unproven; stage 5 a stub; the renderer
built, tested and read; nothing deployed. Repo is private at
`github.com/remusalex-coder/WebsiteAgent`, branch `main`, last commit `9ae470e` —
which includes **none** of the above.

See `PROJECT_STATUS.md` for known limitations, `ROADMAP.md` for the ordered plan, and
`docs/renderer.md` for the renderer.
