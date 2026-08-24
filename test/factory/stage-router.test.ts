/**
 * Regression test for Capability Router stage and n8n node integration.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isStageName, STAGES, runStage } from '../../scripts/n8n/stage.js';
import { buildFactoryWorkflow } from '../../scripts/n8n/build-factory-workflow.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('STAGES array includes router, diverge, jury, assets', () => {
  assert.ok(isStageName('router'), 'router is a valid stage');
  assert.ok(isStageName('diverge'), 'diverge is a valid stage');
  assert.ok(isStageName('jury'), 'jury is a valid stage');
  assert.ok(isStageName('assets'), 'assets is a valid stage');
  assert.ok(STAGES.includes('router'));
});

test('Capability Router node in factory-v1.json targets /stage/router with correct contract', () => {
  const workflow = buildFactoryWorkflow();
  const routerNode = workflow.nodes.find((n) => n.name === 'Capability Router');
  assert.ok(routerNode, 'Capability Router node exists in workflow');
  assert.equal(routerNode.type, 'n8n-nodes-base.httpRequest');

  const params = routerNode.parameters as {
    url?: string;
    queryParameters?: { parameters?: Array<{ name: string; value: string }> };
    headerParameters?: { parameters?: Array<{ name: string; value: string }> };
  };

  assert.ok(params.url && params.url.endsWith('/stage/router'), 'url must end with /stage/router');

  const queryParams = params.queryParameters?.parameters ?? [];
  const paramNames = queryParams.map((p) => p.name);
  assert.ok(paramNames.includes('runId'), 'query parameters must include runId');
  assert.ok(paramNames.includes('maxIter'), 'query parameters must include maxIter');

  const headerParams = params.headerParameters?.parameters ?? [];
  const headerNames = headerParams.map((h) => h.name);
  assert.ok(headerNames.includes('x-bf-token'), 'header parameters must include x-bf-token');
});

test('runStage(router) executes and writes 0-routes.json', async () => {
  const runId = 'test-router-' + Date.now().toString(36);
  const result = await runStage({ stage: 'router', runId });
  assert.equal(result.stage, 'router');
  assert.equal(result.runId, runId);
  assert.ok(result.note && result.note.includes('capability router'), 'note mentions capability router');

  const routesPath = path.join(REPO_ROOT, 'output', runId, '0-routes.json');
  assert.ok(fs.existsSync(routesPath), '0-routes.json was written');
  const routes = JSON.parse(fs.readFileSync(routesPath, 'utf8'));
  assert.ok(routes.research, 'routes has research capability');
  assert.ok(routes.content, 'routes has content capability');
  assert.ok(routes['design.concept'], 'routes has design.concept capability');
  assert.ok(routes['coding.frontend'], 'routes has coding.frontend capability');
});
