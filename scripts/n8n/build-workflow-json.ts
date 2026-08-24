/**
 * Generates the importable n8n workflow JSON for BusinessForge — control
 * surface only (Freeze F-15, P7-1/M-10).
 *
 * The workflow is now three steps, nothing else:
 *
 *   Webhook Trigger → Job Intake → POST /job → poll GET /job/:runId → Respond
 *
 * The `Reconcept?` IF node is gone. The loop it used to own now lives in
 * `runJobFull` (scripts/n8n/stage.ts) on the host, so n8n holds no decision:
 * it accepts an order, starts the job, and waits for a terminal decision.
 *
 * Why HTTP rather than Execute Command nodes: n8n 2.x excludes
 * `n8n-nodes-base.executeCommand` by default (`nodes.exclude`), so a workflow
 * built from those nodes cannot be activated at all. HTTP Request is a
 * first-class node, and running the stages on the host is also the only way
 * Playwright and the platform-built `node_modules` work. See n8n/README.md.
 *
 *   npx tsx scripts/n8n/build-workflow-json.ts > n8n/businessforge-workflow.json
 */

import { randomUUID } from 'node:crypto';
import { stageToken, STAGE_PORT } from './stage-server.js';

interface N8nNode {
  parameters: Record<string, unknown>;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  id?: string;
  webhookId?: string;
  notes?: string;
  executeOnce?: boolean;
  alwaysOutputData?: boolean;
  onError?: 'continueRegularOutput' | 'continueErrorOutput' | 'stopWorkflow';
  retryOnFail?: boolean;
  maxTries?: number;
}

interface N8nConnection {
  main: Array<Array<{ node: string; type: 'main'; index: number }>>;
}

interface N8nWorkflow {
  id: string;
  name: string;
  nodes: N8nNode[];
  connections: Record<string, N8nConnection>;
  settings: Record<string, unknown>;
  active: boolean;
}

/**
 * From inside the n8n container the host is `host.docker.internal`. Override
 * with BF_STAGE_HOST when n8n runs directly on the host (`localhost`).
 */
const STAGE_HOST = process.env.BF_STAGE_HOST ?? 'host.docker.internal';
const TOKEN = stageToken();

/** Read the job identity off the Job Intake Set node. */
const RUN = '={{ $("Job Intake").first().json.runId }}';
const ORDER = '={{ $("Job Intake").first().json.order }}';
const MAX_ITER = '={{ $("Job Intake").first().json.maxIter }}';

/**
 * The job is one long host-side run — sourcing, authoring, browser capture
 * and the bounded QA loop all happen inside `runJobFull`, so the workflow's
 * one HTTP call has to wait for all of it. A tight timeout would fail a
 * healthy run.
 */
const JOB_TIMEOUT_MS = 3_600_000;

function httpNode(
  name: string,
  method: string,
  path_: string,
  pos: [number, number],
  notes: string,
  queryParameters: ReadonlyArray<{ readonly name: string; readonly value: string }>,
): N8nNode {
  return {
    parameters: {
      url: `http://${STAGE_HOST}:${STAGE_PORT}${path_}`,
      method,
      sendQuery: true,
      queryParameters: {
        parameters: queryParameters.map(({ name: qn, value }) => ({ name: qn, value })),
      },
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: 'x-bf-token', value: TOKEN }],
      },
      options: { timeout: JOB_TIMEOUT_MS },
    },
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.5,
    position: pos,
    notes,
    alwaysOutputData: true,
  };
}

function link(to: string): N8nConnection {
  return { main: [[{ node: to, type: 'main', index: 0 }]] };
}

/**
 * Reads the order off whichever trigger fired.
 *
 * `?.` is avoided in favour of explicit guards: the Set node's expressions are
 * evaluated per item, and a missing `body` on the manual-trigger path must
 * produce the default rather than an error that stops the workflow.
 */
const pick = (field: string, fallback: string): string =>
  `={{ ($json.body && $json.body.${field}) ? $json.body.${field} : ` +
  `(($json.query && $json.query.${field}) ? $json.query.${field} : ${fallback}) }}`;

const DEMO_ORDER = 'Construieste un website premium pentru o brutarie artizanala din Sibiu';

/**
 * Builds the control-surface workflow. Exported so the static test can assert
 * the structure without re-running the generator's stdout.
 */
export function buildWorkflow(): N8nWorkflow {
  return {
  // Fixed id so re-imports UPDATE the existing workflow instead of duplicating.
  // Override with BF_WORKFLOW_ID if you want a fresh copy.
  id: process.env.BF_WORKFLOW_ID ?? randomUUID(),
  name: 'BusinessForge — Control Surface',
  // Activation is done over the public API after import (POST
  // /api/v1/workflows/:id/activate) — n8n's importer ignores this flag.
  active: false,
  nodes: [
    {
      parameters: { httpMethod: 'POST', path: 'bf-order', responseMode: 'responseNode', options: {} },
      name: 'Order Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.1,
      position: [-220, 200],
      webhookId: 'bf-order',
      notes: 'POST /webhook/bf-order  {"order": "...", "maxIter": 3}\nAlso accepts ?order= on the query string.',
    },
    {
      parameters: {},
      name: 'Manual Trigger',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [-220, 420],
      notes: 'Runs the demo order baked into Job Intake.',
    },
    {
      parameters: {
        // `assignments` is HIDDEN on Set typeVersion 3/3.1/3.2 (those still use
        // the legacy `fields` parameter), so a node pinned at 3 silently ignores
        // the assignments and passes its input straight through. Pin 3.5.
        mode: 'manual',
        includeOtherFields: false,
        assignments: {
          assignments: [
            {
              id: 'runId',
              name: 'runId',
              value: pick('runId', "'bf' + $now.toMillis().toString(36)"),
              type: 'string',
            },
            { id: 'order', name: 'order', value: pick('order', `'${DEMO_ORDER}'`), type: 'string' },
            { id: 'maxIter', name: 'maxIter', value: pick('maxIter', '3'), type: 'number' },
          ],
        },
        options: {},
      },
      name: 'Job Intake',
      type: 'n8n-nodes-base.set',
      typeVersion: 3.5,
      position: [0, 300],
      notes: 'The job identity. POST /job reads runId/order/maxIter from here.',
    },
    httpNode(
      'Start Job',
      'POST',
      '/job',
      [240, 300],
      'POST /job?runId=<id>&order=<order>&maxIter=<n>. Runs the WHOLE job host-side — the loop lives in runJobFull, not here.',
      [
        { name: 'runId', value: RUN },
        { name: 'order', value: ORDER },
        { name: 'maxIter', value: MAX_ITER },
      ],
    ),
    httpNode(
      'Poll Job',
      'GET',
      '/job',
      [480, 300],
      'GET /job?runId=<id> — confirm the terminal decision (deliver/escalate). Bound by maxIter inside runJobFull.',
      [{ name: 'runId', value: RUN }],
    ),
    {
      parameters: {
        mode: 'manual',
        includeOtherFields: false,
        assignments: {
          assignments: [
            {
              id: 'summary',
              name: 'summary',
              value:
                '={{ "Job " + $("Job Intake").first().json.runId + " -> " + $json.decision + ' +
                '" (iter " + $json.iteration + "/" + $json.maxIter + "). Site: " + ' +
                '($json.finalOutput || "none") }}',
              type: 'string',
            },
          ],
        },
        options: {},
      },
      name: 'Summarise',
      type: 'n8n-nodes-base.set',
      typeVersion: 3.5,
      position: [960, 300],
      notes: 'One line the caller can act on.',
    },
    {
      parameters: { respondWith: 'allIncomingItems', options: {} },
      name: 'Respond',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.5,
      position: [960, 300],
      notes: 'Answers the Order Webhook with the final job summary.',
    },
  ],
  connections: {
    'Order Webhook': link('Job Intake'),
    'Manual Trigger': link('Job Intake'),
    'Job Intake': link('Start Job'),
    'Start Job': link('Poll Job'),
    'Poll Job': link('Summarise'),
    Summarise: link('Respond'),
  },
  settings: {
    executionOrder: 'v1',
    // A last-resort ceiling underneath runJobFull's own iteration bound.
    executionTimeout: 7_200,
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'all',
  },
  };
}

// eslint-disable-next-line no-console
console.log(JSON.stringify(buildWorkflow(), null, 2));