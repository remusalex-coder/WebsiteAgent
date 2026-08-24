/**
 * P7-1 — job-level endpoint routing on the stage server.
 *
 * `POST /job` validates runId/order/maxIter and returns 400 before any stage
 * runs; `GET /job` reads a run's job.json and maps a terminal decision to
 * status "complete". The success path calls `runJobFull` (heavy, needs real
 * stages + credentials), so this test covers the validation branches and the
 * poll mapping — the routing the n8n workflow actually depends on.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { createStageServer } from '../../scripts/n8n/stage-server.js';

const TOKEN = 'test-token';

function request(port: number, method: string, pathname: string, withToken = true): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, method, path: pathname, headers: withToken ? { 'x-bf-token': TOKEN } : {} },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let body: unknown = null;
          try {
            body = JSON.parse(data);
          } catch {
            body = data;
          }
          resolve({ status: res.statusCode ?? 0, body });
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function withServer<T>(token: string, fn: (port: number) => Promise<T>): Promise<T> {
  const server = createStageServer(token);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  try {
    return await fn(address.port);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test('the server rejects requests without the shared token (401)', async () => {
  await withServer(TOKEN, async (port) => {
    const res = await request(port, 'POST', '/job?runId=abc&order=x', false);
    assert.equal(res.status, 401);
  });
});

test('POST /job rejects a bad runId before running anything (400)', async () => {
  await withServer(TOKEN, async (port) => {
    const res = await request(port, 'POST', '/job?runId=../etc&order=x');
    assert.equal(res.status, 400);
    assert.ok((res.body as { error: string }).error.includes('runId must match'));
  });
});

test('POST /job rejects a missing or over-long order (400)', async () => {
  await withServer(TOKEN, async (port) => {
    const missing = await request(port, 'POST', '/job?runId=abc123&order=');
    assert.equal(missing.status, 400);
    assert.ok((missing.body as { error: string }).error.includes('order is required'));

    const long = await request(port, 'POST', `/job?runId=abc123&order=${'x'.repeat(2001)}`);
    assert.equal(long.status, 400);
    assert.ok((long.body as { error: string }).error.includes('at most'));
  });
});

test('POST /job rejects a maxIter outside 1..20 (400)', async () => {
  await withServer(TOKEN, async (port) => {
    const zero = await request(port, 'POST', '/job?runId=abc123&order=x&maxIter=0');
    assert.equal(zero.status, 400);
    const big = await request(port, 'POST', '/job?runId=abc123&order=x&maxIter=21');
    assert.equal(big.status, 400);
    const float = await request(port, 'POST', '/job?runId=abc123&order=x&maxIter=2.5');
    assert.equal(float.status, 400);
  });
});

test('GET /job returns 404 for a run that does not exist', async () => {
  await withServer(TOKEN, async (port) => {
    const res = await request(port, 'GET', '/job?runId=doesnotexist');
    assert.equal(res.status, 404);
    assert.ok((res.body as { error: string }).error.includes('no such run'));
  });
});

test('GET /job maps a terminal decision to status complete', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-stage-server-'));
  const runId = 'testrun';
  const runDir = path.join(tmpRoot, 'output', runId);
  fs.mkdirSync(runDir, { recursive: true });
  const job = {
    runId,
    stage: 'hermes',
    iteration: 2,
    maxIter: 3,
    decision: 'deliver',
    business: 'Mara',
    finalOutput: '/site',
    budgetCents: 20,
    providerLog: [
      { stage: 'analyze', capability: 'research', provider: 'gemini', outcome: 'ok', at: new Date().toISOString() },
      { stage: 'repair', capability: 'design.concept', provider: 'openai', outcome: 'failed', at: new Date().toISOString() },
    ],
    distinctnessScore: { verdict: 'PASS', overallScore: 88 },
  };
  fs.writeFileSync(path.join(runDir, 'job.json'), JSON.stringify(job), 'utf8');

  const original = process.env.BF_REPO_ROOT;
  process.env.BF_REPO_ROOT = tmpRoot;
  try {
    await withServer(TOKEN, async (port) => {
      const res = await request(port, 'GET', `/job?runId=${runId}`);
      assert.equal(res.status, 200);
      const body = res.body as Record<string, unknown>;
      assert.equal(body.status, 'complete');
      assert.equal(body.stage, 'hermes');
      assert.equal(body.decision, 'deliver');
      assert.equal(body.finalOutput, '/site');
      // The observability board the workflow can surface.
      const workers = body.workers as Record<string, unknown>;
      assert.equal(workers.calls, 2);
      assert.deepEqual(workers.providersUsed, ['gemini']);
      assert.deepEqual(workers.failedProviders, ['openai']);
      assert.equal(workers.fallbacks, 0);
      assert.equal(body.budgetCents, 20);
      const gate = body.gate as Record<string, unknown>;
      assert.equal(gate.verdict, 'PASS');
      assert.equal(gate.score, 88);
    });
  } finally {
    if (original === undefined) {
      delete process.env.BF_REPO_ROOT;
    } else {
      process.env.BF_REPO_ROOT = original;
    }
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('GET /job reports a non-terminal decision as running', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bf-stage-server-'));
  const runId = 'testrun';
  const runDir = path.join(tmpRoot, 'output', runId);
  fs.mkdirSync(runDir, { recursive: true });
  const job = { runId, stage: 'browser', iteration: 1, maxIter: 3, decision: null };
  fs.writeFileSync(path.join(runDir, 'job.json'), JSON.stringify(job), 'utf8');

  const original = process.env.BF_REPO_ROOT;
  process.env.BF_REPO_ROOT = tmpRoot;
  try {
    await withServer(TOKEN, async (port) => {
      const res = await request(port, 'GET', `/job?runId=${runId}`);
      assert.equal(res.status, 200);
      const body = res.body as Record<string, unknown>;
      assert.equal(body.status, 'running');
      assert.equal(body.stage, 'browser');
      assert.equal(body.decision, null);
    });
  } finally {
    if (original === undefined) {
      delete process.env.BF_REPO_ROOT;
    } else {
      process.env.BF_REPO_ROOT = original;
    }
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('GET /job rejects a bad runId (400) before reading the filesystem', async () => {
  await withServer(TOKEN, async (port) => {
    const res = await request(port, 'GET', '/job?runId=..%2F..%2Fetc');
    assert.equal(res.status, 400);
  });
});

test('POST /job runs the whole job and answers 200 with status complete', async () => {
  const calls: Array<{ runId: string; order: string; maxIter: number }> = [];
  const stubRunJob = async (opts: { runId: string; order: string; maxIter?: number }) => {
    calls.push({ runId: opts.runId, order: opts.order, maxIter: opts.maxIter ?? 3 });
    return { runId: opts.runId, stage: 'report' as const, loop: false, iteration: 2, decision: 'deliver' as const, verdict: 'PASS' as const, nextStage: null, finalOutput: '/site', business: 'Mara' };
  };
  const server = createStageServer(TOKEN, { runJob: stubRunJob });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  try {
    const res = await request(address.port, 'POST', '/job?runId=abc123&order=build%20a%20bakery&maxIter=4');
    assert.equal(res.status, 200);
    const body = res.body as Record<string, unknown>;
    assert.equal(body.status, 'complete');
    assert.equal(body.decision, 'deliver');
    assert.equal(body.finalOutput, '/site');
    assert.deepEqual(calls, [{ runId: 'abc123', order: 'build a bakery', maxIter: 4 }]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('POST /job maps a failure to 500 with status failed', async () => {
  const failingRunJob = async (): Promise<never> => {
    throw new Error('stage create blew up');
  };
  const server = createStageServer(TOKEN, { runJob: failingRunJob });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === 'object');
  try {
    const res = await request(address.port, 'POST', '/job?runId=abc123&order=x');
    assert.equal(res.status, 500);
    const body = res.body as { error: string; status: string };
    assert.equal(body.status, 'failed');
    assert.equal(body.error, 'stage create blew up');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});