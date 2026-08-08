# Runbook — verifying a platform change without a model call

**Use when:** the AI provider is rate-limited, out of quota, or down, and a change
to the writer's derived fields, the renderer, the design layer or the CSS needs
measuring anyway.

**Why it exists:** the Gemini free tier's daily quota has blocked stages 4–6 on two
consecutive sessions. Both times the work itself was verifiable — it just needed
a path that did not call a model. Waiting for a quota reset is not a plan.

## The insight

Stages 1–3 (browse, collect, normalise) and stage 5 (write) persist their output.
Six businesses have both a `business.json` and a `5-content.json` on disk. Anything
downstream of those files is a pure function and costs nothing to re-run:

| Artifact | Written by | Lets you re-run |
|---|---|---|
| `business.json` | normalizer | every derived field the writer computes in code |
| `5-content.json` | writer | the renderer, the design layer, the whole stylesheet |
| `5b-design.json` | design agent | the renderer under a real design |

Only *model-written prose* needs the provider. Everything the platform decides in
code does not — and most defects live there.

## Steps

1. **Run the trust audit.** It recomputes the writer's code-owned fields from every
   saved profile, re-renders each saved spec, and measures the result at 390px in a
   real browser.

   ```bash
   npx tsx scripts/trust-audit.ts
   ```

2. **Read the signal list, not just the pass/fail.** This is what caught
   `"Add website in San Francisco"` as a hotel's category — a Maps UI button that
   had already reached the profile, the schema.org type and the design layer's
   industry match. A green overflow check would not have found it.

3. **Re-render one spec** to look at a whole page:

   ```bash
   npx tsx main.ts --render output/<runId>/5-content.json
   ```

4. **Run the suite**, which covers the renderer, the design layer, the listing
   source and the writer's brief — all without a provider:

   ```bash
   npm run typecheck && npm test
   ```

## Two traps

**Old artifacts are missing new fields.** An artifact directory is a persistence
format with a long life, and every field added to a contract arrives as
`undefined` from every file already on disk. `readArtifact` in `main.ts` backfills
them from `ARTIFACT_DEFAULTS` — **add an entry there whenever you add a field to a
contract**, or `--from=<stage>` on any older run will fail with a `TypeError`
several stages away from the cause. Defaults are empty values only; filling one
with a guess would put an invented fact into a profile.

**A pre-fix run keeps its pre-fix profile.** Re-running `--from=normalize` reuses
the saved `discovery.json`, so a fix inside discovery will not show. Re-run from
the top when the defect is upstream of the stage you are resuming.

## What still needs a provider

Only prose quality: whether the writer turns available material into a page
someone would publish. That is the first-draft acceptance KPI and it cannot be
faked — but it is also the only thing that has to wait.
