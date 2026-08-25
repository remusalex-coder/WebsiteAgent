# n8n orchestration — BusinessForge control surface

n8n is a **control surface only** (Freeze F-15, P7-1/M-10): it accepts an order,
starts the job, and reports the outcome. It owns **no** decision. The rejection
loop that used to live in the workflow JSON now lives in `runJobFull`
(`scripts/n8n/stage.ts`) on the host, so if n8n is down, `scripts/run-job.ts`
runs the same loop.

```
Order Webhook / Manual Trigger
  -> Job Intake            (Set: runId, order, maxIter)
  -> Start Job             POST /job — the WHOLE job runs host-side
  -> Poll Job              GET /job — confirm the terminal decision
  -> Summarise             one line a human can act on
  -> Respond
```

There is no `Reconcept?` IF node. The QA loop (browser → layout → critic →
gate → hermes → repair) is bounded by `maxIter` inside `runJobFull` and never
re-enters the workflow.

## Why the stages run over HTTP, not in n8n

n8n 2.x ships this as a **security default** (`@n8n/config` → `NodesConfig`):

```js
this.exclude = ['n8n-nodes-base.executeCommand', 'n8n-nodes-base.localFileTrigger'];
```

A workflow built from Execute Command nodes therefore cannot even be activated —
the API rejects it with `Unrecognized node type: n8n-nodes-base.executeCommand`.
Clearing `NODES_EXCLUDE` would fix that by handing *every* workflow on the instance
a shell, so we do not do it. The workflow uses first-class HTTP Request nodes
against a narrow host-side endpoint that can only start a job or read its state.

Running on the host is also the only thing that works: the repo's `node_modules`
(esbuild, Playwright and its browser) is built for the host platform, not for the
Linux container.

## Job-level endpoints

The stage server exposes two job-level endpoints (plus `/health` and the
legacy `/stage/:name` used by the CLI and Factory V1):

- `POST /job?runId=<id>&order=<order>&maxIter=<n>` — runs the whole job to a
  terminal decision, returns `{ runId, status: "complete", decision, ... }`.
- `GET /job?runId=<id>` — polls a run's state; `status: "complete"` when the
  decision is `deliver` or `escalate`. The response is built from
  `lib/workflow/summary.ts`'s `summarizeRun` (WQ-016) — the same read model
  `scripts/status.ts` and the control-surface page below use, so there is one
  place that decides "which providers failed"/"is the battle done", not
  several. The original tested fields (`workers.{calls,providersUsed,
  failedProviders,fallbacks}`, `budgetCents`, `gate`) are unchanged; `errors`,
  `phases`, `candidateCount`, `battle` are additive.
- `GET /jobs` — every discoverable run under `output/`, most-recently-updated
  first. Same read model as `GET /job`; the control-surface page's job list.

## Control surface (WQ-016)

`GET /` and `GET /ui` serve a single self-contained HTML+JS page — no build
step, no CDN, works on this LAN-only host with no outbound internet. It is
the only piece served without the `x-bf-token` (a browser navigating to a URL
cannot set a custom header), but it embeds no job data: every fact it shows
comes from the page's own `fetch()` calls to `/job`/`/jobs`/`/job` (POST),
carrying the token a human pastes into the page (kept in `localStorage` so it
does not need retyping — this is a real page served to a real operator, not a
sandboxed preview).

Point a browser at `http://<host>:7717/` (or `/ui`), paste the token, enter a
business URL/brief, and click Start — it POSTs `/job` (fire-and-forget from
the browser's side, since that request only resolves once the whole job
reaches a terminal decision) and immediately starts polling `GET /job` every
few seconds, rendering stage/progress/phases/workers/provider fallback/design
battle/distinctness gate/errors/final result in plain language, no internal
vocabulary required. This is the same orchestrator every other entrypoint
drives — the page adds no execution logic of its own, only a view.

## Running it

1. Start the stage server on the host (keep it running):

   ```bash
   npx tsx scripts/n8n/stage-server.ts
   ```

   It listens on `0.0.0.0:7717`. That is deliberate — Docker reaches the host via
   `host.docker.internal`, which never resolves to a loopback-bound socket — so
   every request must carry `x-bf-token`. The token comes from `BF_STAGE_TOKEN`,
   otherwise it is generated once into `n8n/.stage-token` (gitignored). The
   workflow generator reads the same value, so nothing is copied by hand.

2. Generate and import the workflow:

   ```bash
   npx tsx scripts/n8n/build-workflow-json.ts > n8n/businessforge-workflow.json
   ```

   ```bash
   docker cp n8n/businessforge-workflow.json n8n:/tmp/bf.json && docker exec n8n n8n import:workflow --input=/tmp/bf.json
   ```

   Set `BF_WORKFLOW_ID` to an existing id so the import **updates** that workflow
   instead of creating a duplicate. On Git Bash, prefix with `MSYS_NO_PATHCONV=1`
   or `/tmp/bf.json` is rewritten to a Windows path and the import fails.

3. Activate it (n8n's importer ignores the `active` flag in the JSON):

   ```bash
   curl -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" http://localhost:5678/api/v1/workflows/<id>/activate
   ```

4. Run it:

   ```bash
   curl -X POST "http://localhost:5678/webhook/bf-order" -H "Content-Type: application/json" -d '{"order": "Construieste un website premium pentru o brutarie artizanala din Sibiu", "maxIter": 3}'
   ```

   The whole job runs on the host; the workflow waits for the terminal decision
   and responds with the summary. `maxIter` bounds the QA loop inside `runJobFull`.

## Vision

The Visual Critic degrades to `uncertain` unless the stage server has
`VISION_API_KEY`, `VISION_BASE_URL` and `VISION_MODEL` set, so the loop stays
runnable at zero cost. Start it with those set to make the critic actually look
at the screenshots:

```bash
node --import tsx --env-file=.env scripts/n8n/stage-server.ts
```

## Node versions are pinned on purpose

Parameter shapes are gated by `typeVersion`, and picking a stale one fails
*silently*. `assignments` is hidden on Set `3`/`3.1`/`3.2` (those still use the
legacy `fields` parameter), so a Set node pinned at `3` ignores its assignments
and passes its input straight through. The generator pins each node to the version
this instance reports as its default: Set `3.5`, If `2.3`, HTTP Request `4.5`,
Webhook `2.1`, Code `2`, Respond `1.5`. Before changing one, read the installed
node rather than guessing:

```bash
docker exec n8n node -e "const m=require('/usr/local/lib/node_modules/n8n/node_modules/n8n-nodes-base/dist/nodes/Set/Set.node.js');const i=new m[Object.keys(m)[0]]();console.log(Object.keys(i.nodeVersions))"
```

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Unrecognized node type: …executeCommand` | n8n's security default; use HTTP Request nodes (above) |
| `400 runId must match …` | The Set node did not apply its assignments — check its `typeVersion` |
| `401 bad or missing x-bf-token` | Workflow regenerated after the token changed; re-generate and re-import |
| Stage server unreachable from n8n | It must bind `0.0.0.0`, and n8n must resolve `host.docker.internal` |
| Job loops past `maxIter` | `maxIter` must be in the `POST /job` query; `runJobFull` bounds the loop at it |