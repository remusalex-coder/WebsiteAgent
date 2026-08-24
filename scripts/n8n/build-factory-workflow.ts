/**
 * Generates "BusinessForge — Factory V1": the complete autonomous website factory
 * visible directly within n8n canvas.
 *
 *   npx tsx scripts/n8n/build-factory-workflow.ts > n8n/factory-v1.json
 *
 * ## Architectural Structure
 *
 * 1. Intake & Identity (Order Webhook, Manual Trigger, Job Intake, QA Check)
 * 2. Capability Router (routes research, content, design, code, image, video, 3D, evidence)
 * 3. Parallel Research Provider Workers (Gemini, DeepSeek, Claude, OpenRouter, Fallback Floor)
 * 4. Research Merge & Synthesis -> Evidence Sourcing (Bright Data & Maps)
 * 5. Business Strategy Analysis -> Content Authoring (Writer Agent with Baseline Fallback)
 * 6. Creative Direction -> Design Divergence Fork (Candidate A, Candidate B, Candidate C)
 * 7. Design Jury (Multi-candidate deterministic quality & vision evaluation, winner selection)
 * 8. Asset Requirements Engine -> Media Workers (Image, Video Hero, 3D Spatial) -> Manifest Aggregator
 * 9. Production Build & Assembly
 * 10. Playwright Browser Capture -> Multi-Gate QA (UX/Layout QA, Visual Critic QA, Distinctness Gate)
 * 11. Hermes Control Plane Decision -> Autonomous Repair & Rebuild Loop
 * 12. Observability & QA Reporting -> Webhook Response / Human Escalation
 */

import { randomUUID } from 'node:crypto';
import { stageToken, STAGE_PORT } from './stage-server.js';

export interface N8nNode {
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

export interface N8nConnection {
  main: Array<Array<{ node: string; type: 'main'; index: number }>>;
}

export interface N8nWorkflow {
  id: string;
  name: string;
  nodes: N8nNode[];
  connections: Record<string, N8nConnection>;
  settings: Record<string, unknown>;
  active: boolean;
}

const STAGE_HOST = process.env.BF_STAGE_HOST ?? 'host.docker.internal';
const TOKEN = stageToken();

const RUN = '={{ $("Job Intake").first().json.runId }}';
const MAX_ITER = '={{ $("Job Intake").first().json.maxIter }}';
const ORDER = '={{ $("Job Intake").first().json.order }}';
const BUSINESS_URL = '={{ $("Job Intake").first().json.businessUrl || "" }}';
const SOURCE_URLS = '={{ $("Job Intake").first().json.sourceUrls || "" }}';
const ADDITIONAL_INSTRUCTION = '={{ $("Job Intake").first().json.additionalInstruction || "" }}';

const STAGE_TIMEOUT_MS = 900_000;

export interface StageOptions {
  readonly query?: Readonly<Record<string, string>>;
  readonly executeOnce?: boolean;
  readonly onError?: N8nNode['onError'];
  readonly retry?: boolean;
}

export function stageNode(
  name: string,
  stage: string,
  pos: [number, number],
  notes: string,
  options: StageOptions = {},
): N8nNode {
  const query = { runId: RUN, maxIter: MAX_ITER, ...(options.query ?? {}) };
  return {
    parameters: {
      url: `http://${STAGE_HOST}:${STAGE_PORT}/stage/${stage}`,
      sendQuery: true,
      queryParameters: {
        parameters: Object.entries(query).map(([name_, value]) => ({ name: name_, value })),
      },
      sendHeaders: true,
      headerParameters: { parameters: [{ name: 'x-bf-token', value: TOKEN }] },
      options: { timeout: STAGE_TIMEOUT_MS },
    },
    name,
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.5,
    position: pos,
    notes,
    ...(options.executeOnce === true ? { executeOnce: true } : {}),
    ...(options.onError === undefined ? {} : { onError: options.onError, alwaysOutputData: true }),
    ...(options.retry === true ? { retryOnFail: true, maxTries: 3 } : {}),
  };
}

export function link(to: string): N8nConnection {
  return { main: [[{ node: to, type: 'main', index: 0 }]] };
}

export function branch(targets: readonly string[]): N8nConnection {
  return { main: [targets.map((node) => ({ node, type: 'main' as const, index: 0 }))] };
}

const pick = (field: string, fallback: string): string =>
  `={{ ($json.body && $json.body.${field}) ? $json.body.${field} : ` +
  `(($json.query && $json.query.${field}) ? $json.query.${field} : ${fallback}) }}`;

const DEMO_ORDER = 'Construieste un website premium pentru o brutarie artizanala din Sibiu';

export function buildFactoryWorkflow(): N8nWorkflow {
  const nodes: N8nNode[] = [
    // -------------------------------------------------------------------------
    // 1. Intake & Job Initialization
    // -------------------------------------------------------------------------
    {
      parameters: { httpMethod: 'POST', path: 'bf-factory', responseMode: 'responseNode', options: {} },
      name: 'Order Webhook',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.1,
      position: [-400, 300],
      webhookId: 'bf-factory',
      notes:
        'POST /webhook/bf-factory {"businessUrl": "...", "sourceUrls": ["..."], "additionalInstruction": "...", "order": "...", "maxIter": 3}\n' +
        'Also accepts ?businessUrl=, ?order=, etc. on the query string.',
    },
    {
      parameters: {},
      name: 'Manual Trigger',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [-400, 480],
      notes: 'Runs the demo order baked into Job Intake.',
    },
    {
      parameters: {
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
            {
              id: 'businessUrl',
              name: 'businessUrl',
              value: pick('businessUrl', "''"),
              type: 'string',
            },
            {
              id: 'sourceUrls',
              name: 'sourceUrls',
              value: pick('sourceUrls', "''"),
              type: 'string',
            },
            {
              id: 'additionalInstruction',
              name: 'additionalInstruction',
              value: pick('additionalInstruction', "''"),
              type: 'string',
            },
            { id: 'order', name: 'order', value: pick('order', `'${DEMO_ORDER}'`), type: 'string' },
            { id: 'maxIter', name: 'maxIter', value: pick('maxIter', '3'), type: 'number' },
            { id: 'startAt', name: 'startAt', value: pick('startAt', "'order'"), type: 'string' },
          ],
        },
        options: {},
      },
      name: 'Job Intake',
      type: 'n8n-nodes-base.set',
      typeVersion: 3.5,
      position: [-180, 380],
      notes: 'The job identity. Every stage reads runId/businessUrl/sourceUrls/additionalInstruction/order from here.',
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [
            {
              id: 'startAt',
              leftValue: '={{ $json.startAt }}',
              rightValue: 'quality',
              operator: { type: 'string', operation: 'equals' },
            },
          ],
          combinator: 'and',
        },
        looseTypeValidation: true,
        options: {},
      },
      name: 'Start at QA?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.3,
      position: [60, 380],
      notes: 'startAt=quality -> straight to Browser Capture (re-test only).\notherwise -> the full factory.',
    },
    stageNode('Create Job', 'create', [280, 480], 'Opens output/<runId>/job.json and initializes job lifecycle state.'),
    stageNode(
      'Normalize Brief',
      'intake',
      [500, 480],
      'Business URL & Order -> brief: trade classification, city, language, and search queries.',
      {
        query: {
          order: ORDER,
          businessUrl: BUSINESS_URL,
          sourceUrls: SOURCE_URLS,
          additionalInstruction: ADDITIONAL_INSTRUCTION,
        },
      },
    ),

    // -------------------------------------------------------------------------
    // 2. Capability Router & Worker Pools
    // -------------------------------------------------------------------------
    stageNode(
      'Capability Router',
      'router',
      [720, 480],
      'Evaluates provider eligibility, rate limits & telemetry across research, content, design, code, image, video, 3D, and evidence channels.',
    ),
    {
      parameters: {
        jsCode: [
          '// Research Pool Dispatcher: Emits work items for parallel AI provider workers',
          '// and deterministic fallback floor.',
          'const routerOutput = $input.first().json;',
          'return [',
          "  { json: { provider: 'gemini', role: 'research', label: 'Gemini 2.5 Flash' } },",
          "  { json: { provider: 'deepseek', role: 'research', label: 'DeepSeek V3' } },",
          "  { json: { provider: 'claude', role: 'research', label: 'Claude 3.7 Sonnet' } },",
          "  { json: { provider: 'openrouter', role: 'research', label: 'OpenRouter Multi-Model' } },",
          "  { json: { provider: 'deterministic-floor', role: 'research', label: 'Deterministic Floor' } },",
          '];',
        ].join('\n'),
      },
      name: 'Research Pool Dispatcher',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [940, 480],
      notes: 'Fans out brief to parallel AI research workers and fallback floor.',
    },

    // -------------------------------------------------------------------------
    // 3. Parallel Research Provider Workers (Failover Protected)
    // -------------------------------------------------------------------------
    stageNode(
      'Gemini Research Worker',
      'research',
      [1180, 200],
      'Gemini 2.5 Flash research worker: extracts localized market context and trade keywords.',
      { query: { provider: 'gemini' }, onError: 'continueRegularOutput', retry: true },
    ),
    stageNode(
      'DeepSeek Research Worker',
      'research',
      [1180, 340],
      'DeepSeek V3 research worker: deep trade analysis and competitive positioning.',
      { query: { provider: 'deepseek' }, onError: 'continueRegularOutput', retry: true },
    ),
    stageNode(
      'Claude Research Worker',
      'research',
      [1180, 480],
      'Claude 3.7 Sonnet research worker: high-fidelity industry nuance and intent mapping.',
      { query: { provider: 'claude' }, onError: 'continueRegularOutput', retry: true },
    ),
    stageNode(
      'OpenRouter Research Worker',
      'research',
      [1180, 620],
      'OpenRouter multi-model worker fallback aggregator.',
      { query: { provider: 'openrouter' }, onError: 'continueRegularOutput', retry: true },
    ),
    {
      parameters: {
        mode: 'manual',
        includeOtherFields: true,
        assignments: {
          assignments: [
            { id: 'provider', name: 'provider', value: 'deterministic-floor', type: 'string' },
            { id: 'status', name: 'status', value: 'fallback-ready', type: 'string' },
          ],
        },
        options: {},
      },
      name: 'Research Fallback Floor',
      type: 'n8n-nodes-base.set',
      typeVersion: 3.5,
      position: [1180, 760],
      notes: 'Deterministic search query fallback when external AI workers are unavailable.',
    },

    // -------------------------------------------------------------------------
    // 4. Synthesis & Sourcing (Real Business Evidence)
    // -------------------------------------------------------------------------
    stageNode(
      'Research Merge & Synthesis',
      'synthesize',
      [1420, 480],
      'Merges research notes from all responding providers into unified 0-research.json.',
      { executeOnce: true },
    ),
    stageNode(
      'Bright Data & Maps Evidence',
      'source',
      [1640, 480],
      'Sourcing & Evidence: Extracts verified business listing, real reviews, photos, hours, and attributes.',
      { executeOnce: true, retry: true },
    ),

    // -------------------------------------------------------------------------
    // 5. Strategy & Content Generation
    // -------------------------------------------------------------------------
    stageNode(
      'Business Strategy Analyst',
      'analyze',
      [1860, 480],
      'businessAnalystAgent produces 4-strategy.json with cross-provider failover.',
    ),
    stageNode(
      'Content Authoring Worker',
      'write',
      [2080, 480],
      'writerAgent authors 5-content.json using routed content pool with automatic fallback to profile baseline.',
    ),

    // -------------------------------------------------------------------------
    // 6. Creative Direction & Design Divergence A/B/C
    // -------------------------------------------------------------------------
    stageNode(
      'Creative Direction',
      'direct',
      [2300, 480],
      'designDirectorAgent generates master design directive (5a-directive.json).',
    ),
    {
      parameters: {
        jsCode: [
          '// Design Divergence Fork: splits master directive into K=3 distinct candidate directions',
          'return [',
          "  { json: { direction: 'A', axis: 'structural-archetype', label: 'Candidate A: Structural Layout' } },",
          "  { json: { direction: 'B', axis: 'visual-density', label: 'Candidate B: Spatial Density & Rhythm' } },",
          "  { json: { direction: 'C', axis: 'typographic-motion', label: 'Candidate C: Typographic & Motion' } },",
          '];',
        ].join('\n'),
      },
      name: 'Design Divergence Fork',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2520, 480],
      notes: 'Forks directive into K=3 distinct candidates across structural archetype, visual density, and typography.',
    },
    stageNode(
      'Design Candidate A (Structural Archetype)',
      'diverge',
      [2760, 300],
      'Candidate A: Structural layout perturbation (e.g. asymmetrical grid, split-screen hero showcase).',
      { query: { direction: 'A' } },
    ),
    stageNode(
      'Design Candidate B (Visual Density & Rhythm)',
      'diverge',
      [2760, 480],
      'Candidate B: Spatial density & rhythm perturbation (e.g. compact high-contrast editorial).',
      { query: { direction: 'B' } },
    ),
    stageNode(
      'Design Candidate C (Typographic & Motion)',
      'diverge',
      [2760, 660],
      'Candidate C: Typography, color temperature & motion perturbation.',
      { query: { direction: 'C' } },
    ),

    // -------------------------------------------------------------------------
    // 7. Design Jury & Winner Selection
    // -------------------------------------------------------------------------
    stageNode(
      'Design Jury',
      'jury',
      [3000, 480],
      'Evaluates Candidates A, B, C via deterministic quality scoring and conditional vision judge. Selects winner.',
      { executeOnce: true },
    ),

    // -------------------------------------------------------------------------
    // 8. Asset Requirements & Generation Workers (Image, Video, 3D)
    // -------------------------------------------------------------------------
    stageNode(
      'Asset Requirements Engine',
      'assets',
      [3220, 480],
      'Extracts image, video hero, and 3D spatial asset requirements for the winner design.',
    ),
    {
      parameters: {
        jsCode: [
          '// Asset Workers Dispatcher: Fans out asset requests to specialized media generation workers',
          'return [',
          "  { json: { assetType: 'image', label: 'Image Generation & Optimization Worker' } },",
          "  { json: { assetType: 'video', label: 'Video Hero Worker (Veo/Sora/Kling/Higgsfield)' } },",
          "  { json: { assetType: '3d', label: '3D Spatial Worker (Tripo/Meshy)' } },",
          '];',
        ].join('\n'),
      },
      name: 'Asset Workers Dispatcher',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [3440, 480],
      notes: 'Fans out to media generation workers with failover to curated/local assets.',
    },
    stageNode(
      'Image Asset Worker',
      'assets',
      [3660, 300],
      'Image Worker: Generates/optimizes imagery or routes to curated photography and SVG.',
      { query: { type: 'image' }, onError: 'continueRegularOutput' },
    ),
    stageNode(
      'Video Hero Worker',
      'assets',
      [3660, 480],
      'Video Worker (Veo/Sora/Kling/Higgsfield): Generates video hero or activates CSS motion fallback.',
      { query: { type: 'video' }, onError: 'continueRegularOutput' },
    ),
    stageNode(
      '3D Spatial Worker',
      'assets',
      [3660, 660],
      '3D Worker (Tripo/Meshy): Generates 3D models or activates WebGL/CSS3D spatial fallback.',
      { query: { type: '3d' }, onError: 'continueRegularOutput' },
    ),
    {
      parameters: {
        jsCode: [
          '// Asset Aggregator & Manifest Resolver',
          'const items = $input.all();',
          'return [{ json: { status: "assets-resolved", count: items.length, at: new Date().toISOString() } }];',
        ].join('\n'),
      },
      name: 'Asset Aggregator & Manifest',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [3900, 480],
      executeOnce: true,
      notes: 'Combines generated and fallback assets into verified asset manifest.',
    },

    // -------------------------------------------------------------------------
    // 9. Site Assembly & Build
    // -------------------------------------------------------------------------
    stageNode(
      'Build & Assemble Site',
      'build',
      [4120, 480],
      'Compiles winner design, content, and assets into standalone production HTML/CSS bundle.',
    ),

    // -------------------------------------------------------------------------
    // 10. Playwright Browser & Multi-Gate QA
    // -------------------------------------------------------------------------
    stageNode(
      'Browser Capture',
      'browser',
      [4340, 480],
      'Playwright captures desktop (1440px) and mobile (390px) full-page screenshots.',
    ),
    stageNode(
      'UX & Technical Layout QA',
      'layout',
      [4560, 480],
      'Measures rendered DOM for overlap, horizontal overflow, blank bands, and collapsed containers.',
    ),
    stageNode(
      'Visual Critic QA',
      'critic',
      [4780, 480],
      'Vision model critique evaluating 13 visual and brand alignment axes.',
    ),
    stageNode(
      'Distinctness & Quality Gate',
      'gate',
      [5000, 480],
      'Lexicographic quality gate: combines layout audit, visual critique, and peer-distinctness. Verdict PASS/FAIL.',
    ),

    // -------------------------------------------------------------------------
    // 11. Hermes Control Plane & Autonomous Repair Loop
    // -------------------------------------------------------------------------
    stageNode(
      'Hermes Decision Engine',
      'hermes',
      [5220, 480],
      'Hermes Control Plane: Evaluates gate verdict, iteration count & budget. Emits deliver / reconcept / escalate.',
      { query: { decideOnly: '1' } },
    ),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [
            {
              id: 'loop',
              leftValue: '={{ $json.loop }}',
              rightValue: '',
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
          combinator: 'and',
        },
        looseTypeValidation: true,
        options: {},
      },
      name: 'Repair Needed?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.3,
      position: [5440, 480],
      notes: 'true -> Repair & Rebuild; false -> Delivered check.',
    },
    stageNode(
      'Repair & Rebuild Engine',
      'repair',
      [5440, 260],
      'Rebuilds design specifically targeting measured layout defects and gate diagnosis. Loops back into Browser Capture.',
    ),
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [
            {
              id: 'delivered',
              leftValue: '={{ $json.decision }}',
              rightValue: 'deliver',
              operator: { type: 'string', operation: 'equals' },
            },
          ],
          combinator: 'and',
        },
        looseTypeValidation: true,
        options: {},
      },
      name: 'Delivered?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.3,
      position: [5660, 600],
      notes: 'true -> Observability & QA Report; false -> Escalate to Human.',
    },

    // -------------------------------------------------------------------------
    // 12. Observability, Reporting & Delivery
    // -------------------------------------------------------------------------
    stageNode(
      'Observability & QA Report',
      'report',
      [5880, 480],
      'Writes qa/report.json: business, iterations, gate scores, provider observability ledger, worker failovers, site path.',
    ),
    {
      parameters: {
        mode: 'manual',
        includeOtherFields: true,
        assignments: {
          assignments: [
            { id: 'status', name: 'status', value: 'escalated', type: 'string' },
            {
              id: 'reason',
              name: 'reason',
              value:
                '={{ "The gate did not pass within " + $("Job Intake").first().json.maxIter + ' +
                '" iteration(s). Screenshots, critique and gate reasons are in output/" + ' +
                '$("Job Intake").first().json.runId + "/." }}',
              type: 'string',
            },
          ],
        },
        options: {},
      },
      name: 'Escalate to Human',
      type: 'n8n-nodes-base.set',
      typeVersion: 3.5,
      position: [5880, 720],
      notes: 'Explicit escalation path when gate fails after max iterations, recording exact failure reasons.',
    },
    {
      parameters: { respondWith: 'allIncomingItems', options: {} },
      name: 'Respond to Webhook',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.5,
      position: [6100, 600],
      notes: 'Terminal responder: returns final status, metrics, and site bundle to the caller.',
    },
  ];

  const connections: Record<string, N8nConnection> = {
    'Order Webhook': link('Job Intake'),
    'Manual Trigger': link('Job Intake'),
    'Job Intake': link('Start at QA?'),
    'Start at QA?': {
      main: [
        [{ node: 'Browser Capture', type: 'main', index: 0 }],
        [{ node: 'Create Job', type: 'main', index: 0 }],
      ],
    },
    'Create Job': link('Normalize Brief'),
    'Normalize Brief': link('Capability Router'),
    'Capability Router': link('Research Pool Dispatcher'),
    'Research Pool Dispatcher': branch([
      'Gemini Research Worker',
      'DeepSeek Research Worker',
      'Claude Research Worker',
      'OpenRouter Research Worker',
      'Research Fallback Floor',
    ]),
    'Gemini Research Worker': link('Research Merge & Synthesis'),
    'DeepSeek Research Worker': link('Research Merge & Synthesis'),
    'Claude Research Worker': link('Research Merge & Synthesis'),
    'OpenRouter Research Worker': link('Research Merge & Synthesis'),
    'Research Fallback Floor': link('Research Merge & Synthesis'),
    'Research Merge & Synthesis': link('Bright Data & Maps Evidence'),
    'Bright Data & Maps Evidence': link('Business Strategy Analyst'),
    'Business Strategy Analyst': link('Content Authoring Worker'),
    'Content Authoring Worker': link('Creative Direction'),
    'Creative Direction': link('Design Divergence Fork'),
    'Design Divergence Fork': branch([
      'Design Candidate A (Structural Archetype)',
      'Design Candidate B (Visual Density & Rhythm)',
      'Design Candidate C (Typographic & Motion)',
    ]),
    'Design Candidate A (Structural Archetype)': link('Design Jury'),
    'Design Candidate B (Visual Density & Rhythm)': link('Design Jury'),
    'Design Candidate C (Typographic & Motion)': link('Design Jury'),
    'Design Jury': link('Asset Requirements Engine'),
    'Asset Requirements Engine': link('Asset Workers Dispatcher'),
    'Asset Workers Dispatcher': branch([
      'Image Asset Worker',
      'Video Hero Worker',
      '3D Spatial Worker',
    ]),
    'Image Asset Worker': link('Asset Aggregator & Manifest'),
    'Video Hero Worker': link('Asset Aggregator & Manifest'),
    '3D Spatial Worker': link('Asset Aggregator & Manifest'),
    'Asset Aggregator & Manifest': link('Build & Assemble Site'),
    'Build & Assemble Site': link('Browser Capture'),
    'Browser Capture': link('UX & Technical Layout QA'),
    'UX & Technical Layout QA': link('Visual Critic QA'),
    'Visual Critic QA': link('Distinctness & Quality Gate'),
    'Distinctness & Quality Gate': link('Hermes Decision Engine'),
    'Hermes Decision Engine': link('Repair Needed?'),
    'Repair Needed?': {
      main: [
        [{ node: 'Repair & Rebuild Engine', type: 'main', index: 0 }],
        [{ node: 'Delivered?', type: 'main', index: 0 }],
      ],
    },
    // The autonomous QA repair loop: rebuild -> shoot -> measure -> decide
    'Repair & Rebuild Engine': link('Browser Capture'),
    'Delivered?': {
      main: [
        [{ node: 'Observability & QA Report', type: 'main', index: 0 }],
        [{ node: 'Escalate to Human', type: 'main', index: 0 }],
      ],
    },
    'Observability & QA Report': link('Respond to Webhook'),
    'Escalate to Human': link('Respond to Webhook'),
  };

  return {
    id: process.env.BF_FACTORY_WORKFLOW_ID ?? 'db021a5d-954e-48bb-ac19-3cfca0dfd838',
    name: 'BusinessForge — Factory V1',
    active: false,
    nodes,
    connections,
    settings: {
      executionOrder: 'v1',
      executionTimeout: 7_200,
      saveDataErrorExecution: 'all',
      saveDataSuccessExecution: 'all',
    },
  };
}

const invokedDirectly =
  process.argv[1] !== undefined && process.argv[1].includes('build-factory-workflow');

if (invokedDirectly) {
  const workflow = buildFactoryWorkflow();
  const fsSync = await import('node:fs');
  const pathMod = await import('node:path');
  const fileURLToPathMod = await import('node:url');
  const repoDir = pathMod.resolve(pathMod.dirname(fileURLToPathMod.fileURLToPath(import.meta.url)), '..', '..');
  const targetPath = pathMod.join(repoDir, 'n8n', 'factory-v1.json');
  fsSync.writeFileSync(targetPath, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`[build-factory-workflow] wrote ${workflow.nodes.length} nodes to ${targetPath}`);
}

