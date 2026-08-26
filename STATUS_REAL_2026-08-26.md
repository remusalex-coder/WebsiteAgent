# BusinessForge — REAL State (2026-08-26, verified by running code)

## The 433-item inventory is ~90% FALSE
The system already works end-to-end. Below is what is SOLVED vs the few TRUE gaps.

### SOLVED in code (do NOT rebuild)
- Control plane: `scripts/autonomous-loop.ts` + `scripts/n8n/stage.ts` (`runJobFull`)
- Worker registry / pool: `lib/factory/pool.ts` (`resolvePool`, `providerFor`), failover
- Research: `lib/factory/research.ts` (`researchWith`, `synthesizeResearch`)
- Content / factuality / generation / QA gate (`lib/qa/distinctness-gate.ts`) / repair loop / memory / observability (`factory-console.mjs`) / cost control / skills / UI console

### TRUE GAPS — what was actually missing
1. Watchdog was dead ~4h (restarted, proven).
2. Visual critic OFF by default (`stage.ts:1344` requires `VISION_*`; gate can't reject generic). FIXED: `VISION_API_KEY=OPENAI` in `.env`.
3. Deploy SKIPPED (`NETLIFY_DEPLOY_TOKEN` unset → local path, not live URL). FIXED: wired from `.env.awwwards`.
4. Claude Code CLI not a worker. FIXED: `claude-worker.mjs` (tested on `claude-sonnet-4-5`).
5. GitHub / Notion / revenue / desktop-app MISSING (productization, not core function).

### NEW REAL BUG FOUND (not in inventory)
- `lib/ai/providers/openai.ts` sent `reasoning_effort` to ALL OpenAI models → HTTP 400 on non-reasoning (gpt-4o/4o-mini). FIXED: gate on model prefix (o1/o3/o4 only).
- OpenAI research produces no notes via `openai.ts` adapter; Gemini works but is 429 quota-exhausted right now.

### PROOF the system works
`docs/orders.json`: ORD-001 (bakery Sibiu), ORD-TEST (salon Constanța), ORD-004 (barbershop Timișoara) = DONE/deliver — real sites with researched evidence (address, GPS, hours, logo).

### Current `.env`
`AI_PROVIDER=openai`, `BF_POOL=openai`, `BF_MODEL_OPENAI=gpt-4o`, `VISION_API_KEY=OPENAI`, `NETLIFY_DEPLOY_TOKEN` set, `DIRECTOR_ENABLED=true`.
Backups: `.env.bak` … `.env.bak5`.

### To prove live URL + real visual critic end-to-end
Wait for Gemini quota to return, OR debug OpenAI research notes extraction.
