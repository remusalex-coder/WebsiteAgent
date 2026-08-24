/**
 * P7-1 (F-15, M-10) — static audit of the n8n control surface.
 *
 * The workflow JSON must hold no decision: no IF node, no Reconcept? loop, and
 * it must only talk to the job-level endpoints (`POST /job`, `GET /job`). The
 * loop lives in `runJobFull` on the host.
 *
 * Static because these artifacts cannot be executed here — the freeze defines
 * the correct output structurally, so the test asserts the structure.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKFLOW = path.join(REPO_ROOT, 'n8n', 'businessforge-workflow.json');

test('the workflow JSON exists and parses', () => {
  assert.ok(fs.existsSync(WORKFLOW), 'n8n/businessforge-workflow.json exists');
  const workflow = JSON.parse(fs.readFileSync(WORKFLOW, 'utf8'));
  assert.ok(Array.isArray(workflow.nodes), 'has a nodes array');
  assert.ok(workflow.nodes.length > 0, 'has nodes');
});

test('no IF node and no reconcept loop remain (P7-1, D-02)', () => {
  const workflow = JSON.parse(fs.readFileSync(WORKFLOW, 'utf8')) as {
    nodes: readonly { readonly name: string; readonly type: string }[];
  };
  const ifNodes = workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.if');
  assert.deepEqual(ifNodes, [], 'the Reconcept? IF node is deleted');
  for (const node of workflow.nodes) {
    assert.ok(!/reconcept/i.test(node.name), `no reconcept node: ${node.name}`);
    assert.ok(!/repair needed/i.test(node.name), `no repair-loop node: ${node.name}`);
  }
});

test('the workflow only talks to job-level endpoints (P7-1)', () => {
  const workflow = JSON.parse(fs.readFileSync(WORKFLOW, 'utf8')) as {
    nodes: readonly { readonly name: string; readonly type: string; readonly parameters: { readonly url?: string } }[];
  };
  const httpNodes = workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.httpRequest');
  assert.ok(httpNodes.length >= 2, 'workflow calls the job endpoints');
  for (const node of httpNodes) {
    const url = node.parameters.url ?? '';
    assert.ok(url.includes('/job'), `${node.name} targets the job-level endpoint (got ${url})`);
    assert.ok(!/\/stage\//.test(url), `${node.name} does not target a per-stage endpoint`);
  }
});

test('Start Job passes runId/order/maxIter and Poll Job passes runId (P7-1)', () => {
  const workflow = JSON.parse(fs.readFileSync(WORKFLOW, 'utf8')) as {
    nodes: readonly {
      readonly name: string;
      readonly type: string;
      readonly parameters: {
        readonly queryParameters?: { readonly parameters: ReadonlyArray<{ readonly name: string; readonly value: string }> };
      };
    }[];
  };
  const startJob = workflow.nodes.find((n) => n.name === 'Start Job');
  assert.ok(startJob, 'Start Job node exists');
  const startParams = startJob.parameters.queryParameters?.parameters ?? [];
  assert.deepEqual(
    startParams.map((p) => p.name),
    ['runId', 'order', 'maxIter'],
    'Start Job carries runId, order and maxIter',
  );
  for (const p of startParams) {
    assert.ok(p.value.includes('Job Intake'), `${p.name} is read off the Job Intake Set node`);
  }
  const pollJob = workflow.nodes.find((n) => n.name === 'Poll Job');
  assert.ok(pollJob, 'Poll Job node exists');
  const pollParams = pollJob.parameters.queryParameters?.parameters ?? [];
  assert.deepEqual(
    pollParams.map((p) => p.name),
    ['runId'],
    'Poll Job only needs the runId',
  );
});

test('the workflow has a trigger and a responder', () => {
  const workflow = JSON.parse(fs.readFileSync(WORKFLOW, 'utf8')) as {
    nodes: readonly { readonly type: string }[];
  };
  const types = workflow.nodes.map((n) => n.type);
  assert.ok(types.includes('n8n-nodes-base.webhook'), 'has a webhook trigger');
  assert.ok(types.includes('n8n-nodes-base.respondToWebhook'), 'has a responder');
  assert.ok(types.includes('n8n-nodes-base.manualTrigger'), 'keeps the manual trigger');
});

test('Set nodes stay pinned at a version that honours assignments (typeVersion pin)', () => {
  const workflow = JSON.parse(fs.readFileSync(WORKFLOW, 'utf8')) as {
    nodes: readonly { readonly type: string; readonly typeVersion: number }[];
  };
  for (const node of workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.set')) {
    assert.ok(node.typeVersion >= 3.5, `Set node pinned at ${node.typeVersion} (must honour assignments)`);
  }
});

test('the workflow generator emits a workflow with no IF node', async () => {
  const { buildWorkflow } = await import('../../scripts/n8n/build-workflow-json.js');
  const workflow = buildWorkflow();
  const ifNodes = workflow.nodes.filter((node) => node.type === 'n8n-nodes-base.if');
  assert.deepEqual(ifNodes, []);
});