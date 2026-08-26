/**
 * Autonomous order loop — the missing "continuous execution" seam (mandate §4).
 *
 *   npm run autonomous              # runs forever, one order at a time
 *   npm run autonomous -- --once    # drains the queue once, then exits (great for cron)
 *
 * The pipeline itself (scripts/n8n/stage.ts's runJobFull: create -> intake ->
 * research -> synthesize -> source -> analyze -> write -> direct -> diverge ->
 * browser/layout/critic/gate/hermes -> preflight -> deploy -> report) already
 * runs end-to-end with zero human steps. What did NOT exist was anything that
 * (1) held a queue of business orders, (2) ran them one after another, and
 * (3) resumed after a process/session died. This file is that seam.
 *
 * It is deliberately tiny and dependency-free at the orchestration layer: it
 * imports runJobFull (the exact same function the n8n webhook drives) so there
 * is one production run path, not two. State lives in docs/orders.json; the
 * per-run pipeline state lives in output/<runId>/job.json (written by the
 * pipeline itself). A killed process re-reads both on boot and continues.
 *
 * Run it under the project's proper scheduled-task tooling (a cron that invokes
 * `npm run autonomous -- --once` on a regular cadence, per mandate §4) rather
 * than an in-process timer — a single session cannot literally run forever.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { runJobFull } from './n8n/stage.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORDERS_FILE = path.join(REPO_ROOT, 'docs', 'orders.json');

const RUN_ONCE = process.argv.includes('--once');
const INTERVAL_MS = Number(process.env.BF_LOOP_INTERVAL_MS ?? '15000');
const MAX_ITER = Number(process.env.BF_LOOP_MAXITER ?? '3');
const DEFAULT_BUDGET_TIER = (process.env.BF_LOOP_BUDGET_TIER ?? 'tier1') as string;
const MAX_ATTEMPTS = Number(process.env.BF_LOOP_MAX_ATTEMPTS ?? '3');

type OrderStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ESCALATED' | 'FAILED';

interface Order {
  id: string;
  order: string;
  status: OrderStatus;
  runId?: string;
  maxIter: number;
  attempts: number;
  budgetTier: string;
  decision?: string | null;
  finalOutput?: string | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OrdersFile {
  orders: Order[];
}

async function readOrders(): Promise<OrdersFile> {
  try {
    return JSON.parse(await fs.readFile(ORDERS_FILE, 'utf8')) as OrdersFile;
  } catch {
    return { orders: [] };
  }
}

async function writeOrders(data: OrdersFile): Promise<void> {
  await fs.writeFile(ORDERS_FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeRunId(): string {
  // Short, filesystem-safe, collision-resistant enough for one host.
  return `ord-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function pickNext(data: OrdersFile): Order | null {
  // Prefer a PENDING order we have never started; if a RUNNING order is found
  // (left over from a crash — its process died before flippling status), treat
  // it as resumable: re-run it. This is the resume guarantee.
  const running = data.orders.find((o) => o.status === 'RUNNING');
  if (running !== undefined) return running;
  return data.orders.find((o) => o.status === 'PENDING') ?? null;
}

async function runOne(order: Order): Promise<void> {
  const runId = order.runId ?? makeRunId();
  const maxIter = order.maxIter > 0 ? order.maxIter : MAX_ITER;

  // Persist RUNNING before launching, so a crash mid-run is recoverable.
  order.status = 'RUNNING';
  order.runId = runId;
  order.attempts += 1;
  order.updatedAt = nowIso();
  const data = await readOrders();
  const idx = data.orders.findIndex((o) => o.id === order.id);
  if (idx >= 0) data.orders[idx] = order;
  await writeOrders(data);

  // eslint-disable-next-line no-console
  console.log(`[loop] order=${order.id} run=${runId} iter=${maxIter} attempt=${order.attempts} :: ${order.order}`);

  try {
    const result = await runJobFull({ runId, order: order.order, maxIter });
    order.decision = result.decision ?? null;
    order.finalOutput = result.finalOutput ?? null;
    order.status = result.decision === 'deliver' ? 'DONE'
      : result.decision === 'escalate' ? 'ESCALATED'
      : 'FAILED';
    order.error = order.status === 'FAILED' ? `unexpected decision: ${result.decision}` : null;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    order.error = message;
    // Retry up to MAX_ATTEMPTS, else mark FAILED so it does not loop forever.
    if (order.attempts < MAX_ATTEMPTS) {
      order.status = 'PENDING';
      // eslint-disable-next-line no-console
      console.error(`[loop] order=${order.id} run=${runId} FAILED (attempt ${order.attempts}/${MAX_ATTEMPTS}): ${message} — requeueing`);
    } else {
      order.status = 'FAILED';
      // eslint-disable-next-line no-console
      console.error(`[loop] order=${order.id} run=${runId} FAILED permanently after ${order.attempts} attempts: ${message}`);
    }
  }

  order.updatedAt = nowIso();
  const after = await readOrders();
  const afterIdx = after.orders.findIndex((o) => o.id === order.id);
  if (afterIdx >= 0) after.orders[afterIdx] = order;
  await writeOrders(after);

  // eslint-disable-next-line no-console
  console.log(`[loop] order=${order.id} -> ${order.status} decision=${order.decision ?? '-'} output=${order.finalOutput ?? '-'}`);
}

async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[loop] autonomous order loop starting (once=${RUN_ONCE}, intervalMs=${INTERVAL_MS}, maxIter=${MAX_ITER}, budgetTier=${DEFAULT_BUDGET_TIER})`);

  for (;;) {
    const data = await readOrders();
    const next = pickNext(data);
    if (next === null) {
      if (RUN_ONCE) {
        // eslint-disable-next-line no-console
        console.log('[loop] queue empty — draining once, exiting.');
        break;
      }
      // eslint-disable-next-line no-console
      console.log(`[loop] queue empty — sleeping ${INTERVAL_MS}ms`);
      await new Promise((r) => setTimeout(r, INTERVAL_MS));
      continue;
    }

    // Apply the env-driven defaults for any field the queued order left unset.
    if (!next.maxIter || next.maxIter <= 0) next.maxIter = MAX_ITER;
    if (!next.budgetTier) next.budgetTier = DEFAULT_BUDGET_TIER;

    await runOne(next);

    if (RUN_ONCE) {
      // Just ran one (or retried one). Drain the rest on the next pass until
      // the queue is empty, then the empty-branch above exits.
      continue;
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('[loop] fatal:', error);
  process.exit(1);
});
