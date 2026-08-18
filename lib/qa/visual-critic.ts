/**
 * Visual Critic — judges rendered screenshots, not defects.
 *
 * `lib/qa/visual-qa.ts` already asks a vision model "what is broken on this
 * page?" and patches it. That is a mechanical repair loop. This module asks a
 * different, harder question that the deterministic quality gates in
 * `lib/design/quality.ts` cannot answer because they never see pixels: does
 * this *look* like a distinct, premium site built for this business, or does
 * it look like a generic website template with the business's name swapped
 * in? The Visual Critic is a production judgment node in the rejection loop
 * (`lib/qa/distinctness-gate.ts` combines its verdict with the deterministic
 * scores), not a repair tool — it never proposes CSS or edits anything.
 *
 * Same transport posture as `visual-qa.ts`: `postJson` + `decodeAndValidate`
 * against a closed schema, screenshots sent as base64 image content. The
 * model judges only what it can see plus the design/character/creative-
 * direction JSON it is handed — it must never invent a business fact.
 */

import fs from 'node:fs/promises';

import { postJson, decodeAndValidate } from '../ai/index.js';
import { createVisionInvoker } from '../capability/visionInvoker.js';
import { ProviderRequestError } from '../errors.js';

import type { AiConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { JsonSchema } from '../ai/index.js';
import type { CapabilityOrchestrator } from '../capability/orchestrator.js';

const SOURCE = 'qa.visualCritic';

/** The thirteen axes the critic scores every review on, in prompt order. */
export const CRITIC_AXES = [
  'conceptClarity',
  'distinctiveness',
  'composition',
  'narrative',
  'pacing',
  'imagery',
  'typography',
  'interaction',
  'transitions',
  'conversion',
  'responsive',
  'premiumQuality',
  'businessSpecificity',
] as const;

export type CriticAxis = (typeof CRITIC_AXES)[number];

export interface VisualCriticInput {
  readonly business: string;
  readonly screenshots: ReadonlyArray<{ readonly viewport: 'desktop' | 'mobile'; readonly path: string }>;
  /** The rendered `WebsiteDesign`, passed as data only — the model judges pixels, not this JSON. */
  readonly design: unknown;
  readonly character: unknown;
  readonly creativeDirection: unknown;
}

export interface AxisScore {
  readonly axis: string;
  readonly score: number;
  readonly note: string;
}

export interface VisualCritique {
  readonly axes: readonly AxisScore[];
  readonly genericVerdict: 'generic' | 'distinct' | 'uncertain';
  readonly failReasons: readonly string[];
  readonly notes: readonly string[];
}

export interface VisualCriticRequest {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
  readonly logger: Logger;
}

/**
 * Strict, closed schema for the critic's reply.
 *
 * `additionalProperties: false` at every object level, plus `required` on
 * every field the loop reads — a critique this module cannot trust is worse
 * than no critique, because a silently-missing `genericVerdict` would let a
 * template through.
 */
const CRITIQUE_SCHEMA: JsonSchema = {
  type: 'object',
  required: ['axes', 'genericVerdict', 'failReasons', 'notes'],
  additionalProperties: false,
  properties: {
    axes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['axis', 'score', 'note'],
        additionalProperties: false,
        properties: {
          axis: { type: 'string' },
          score: { type: 'number' },
          note: { type: 'string' },
        },
      },
    },
    genericVerdict: { type: 'string', enum: ['generic', 'distinct', 'uncertain'] },
    failReasons: { type: 'array', items: { type: 'string' } },
    notes: { type: 'array', items: { type: 'string' } },
  },
};

function base64Of(filePath: string): Promise<string> {
  return fs.readFile(filePath).then((buf) => buf.toString('base64'));
}

function buildPrompt(input: VisualCriticInput): string {
  return [
    'You are a senior creative director and design critic reviewing desktop and mobile ',
    'screenshots of a static business website produced by an autonomous builder. You are ',
    'judging craft and distinctiveness, not fixing bugs.',
    '',
    `Business: ${input.business || 'a local small business'}.`,
    '',
    'You are also given the structured design decisions, the business character, and the ',
    'creative direction that produced this page, as JSON. Use them only to understand intent ',
    '(what the page was trying to be) — never invent a business fact that is not visible in the ',
    'screenshots or present in this JSON.',
    '',
    `Design JSON: ${JSON.stringify(input.design ?? null)}`,
    `Character JSON: ${JSON.stringify(input.character ?? null)}`,
    `Creative direction JSON: ${JSON.stringify(input.creativeDirection ?? null)}`,
    '',
    'Score each of these 13 axes from 0 (fails badly) to 10 (excellent), with a short note ',
    'explaining the score: conceptClarity, distinctiveness, composition, narrative, pacing, ',
    'imagery, typography, interaction, transitions, conversion, responsive, premiumQuality, ',
    'businessSpecificity.',
    '',
    'Then answer the decisive question directly: does this look like a generic website ',
    'template with the business name swapped in, or does it look distinctly built for this ',
    'business? Set "genericVerdict" to "generic", "distinct", or "uncertain".',
    '',
    'List every reason in "failReasons" when genericVerdict is "generic" or any axis scores ',
    'below 5 — each reason should name the axis or visible problem it is about. Use "notes" for ',
    'anything else worth recording that is not a failure reason.',
    '',
    'Respond with a single JSON object with exactly four keys: "axes" (array of ',
    '{axis, score, note}), "genericVerdict" (one of generic/distinct/uncertain), "failReasons" ',
    '(array of strings), "notes" (array of strings). No markdown, no prose outside the JSON.',
  ].join('\n');
}

/**
 * Sends the screenshots plus the design/character/creative-direction JSON to
 * an OpenAI-compatible vision endpoint and returns a validated critique.
 *
 * Mirrors `analyzeScreenshots` in `visual-qa.ts`: same transport, same
 * decode-and-validate discipline, so a vision outage here is classified
 * exactly like every other provider failure in this codebase.
 */
export async function analyzeCritique(req: VisualCriticRequest, input: VisualCriticInput): Promise<VisualCritique> {
  const images = await Promise.all(
    input.screenshots.map(async (shot) => ({
      viewport: shot.viewport,
      data: await base64Of(shot.path),
    })),
  );

  const content: unknown[] = [{ type: 'text', text: buildPrompt(input) }];
  for (const image of images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${image.data}`, detail: 'high' },
    } as unknown);
  }

  const raw = (await postJson('openai', SOURCE, {
    url: `${req.baseUrl.replace(/\/+$/, '')}/chat/completions`,
    headers: { authorization: `Bearer ${req.apiKey}` },
    timeoutMs: req.timeoutMs,
    signal: req.signal,
    body: {
      model: req.model,
      max_tokens: 2048,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
    },
  })) as { choices?: readonly { message?: { content?: unknown } }[] };

  const choice = raw.choices?.[0];
  const text = typeof choice?.message?.content === 'string' ? choice.message.content : null;
  if (text === null) {
    throw new ProviderRequestError('openai', 'visual critic response carried no content', { source: SOURCE, retryable: true });
  }

  return toVisualCritique(decodeAndValidate(text, CRITIQUE_SCHEMA));
}

/** Shapes a schema-validated response into `VisualCritique`. Shared by every transport. */
function toVisualCritique(parsed: unknown): VisualCritique {
  const record = parsed as {
    axes: readonly { axis: unknown; score: unknown; note: unknown }[];
    genericVerdict: VisualCritique['genericVerdict'];
    failReasons: readonly unknown[];
    notes: readonly unknown[];
  };
  return {
    axes: record.axes.map((a) => ({
      axis: String(a.axis ?? ''),
      score: Number(a.score ?? 0),
      note: String(a.note ?? ''),
    })),
    genericVerdict: record.genericVerdict,
    failReasons: record.failReasons.map((r) => String(r)),
    notes: record.notes.map((n) => String(n)),
  };
}

/**
 * Judges the same screenshots through the capability planner instead of a
 * single hardcoded `VISION_*` endpoint.
 *
 * This is the fix for the gap `docs/capability-orchestration.md` documents:
 * `analyzeCritique` above needs its own separate `VISION_API_KEY`, which this
 * deployment — and by default every deployment that only set `AI_PROVIDER`
 * plus that vendor's key — never configures, so the critic silently returned
 * `uncertain` on every job forever. `craft_judging` routes through whichever
 * vision-capable vendor is already credentialled (`gemini`, `openai`, in that
 * deployment's preference order), fails over between them, and degrades to
 * the same honest `uncertain` — via `runVisualCritic`'s existing catch — only
 * when every vision-capable vendor is unreachable.
 */
export async function analyzeCritiqueViaCapability(
  options: {
    readonly orchestrator: CapabilityOrchestrator;
    readonly aiConfig: AiConfig;
    readonly timeoutMs: number;
    readonly signal?: AbortSignal;
    readonly logger: Logger;
  },
  input: VisualCriticInput,
): Promise<VisualCritique> {
  const images = await Promise.all(
    input.screenshots.map(async (shot) => ({ base64: await base64Of(shot.path), mimeType: 'image/png' })),
  );

  const invoke = createVisionInvoker(
    {
      prompt: buildPrompt(input),
      schema: CRITIQUE_SCHEMA,
      images,
      maxTokens: 2048,
      timeoutMs: options.timeoutMs,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    },
    options.aiConfig,
    options.logger,
  );

  const { outcome, record } = await options.orchestrator.run('craft_judging', invoke);

  options.logger.debug('craft_judging resolved', {
    servedBy: record.servedBy,
    attempts: record.attempts.length,
    degraded: record.degraded,
  });

  if (!outcome.ok) {
    const lastAttempted = record.attempts[record.attempts.length - 1]?.provider ?? 'none';
    throw new ProviderRequestError(lastAttempted, outcome.error.message, {
      source: SOURCE,
      retryable: outcome.error.retryable,
    });
  }

  return toVisualCritique(outcome.data.data);
}

/** Returned when the vision call fails — a safe floor, never a thrown error into the caller. */
function safeDefault(reason: string): VisualCritique {
  return {
    axes: [],
    genericVerdict: 'uncertain',
    failReasons: [],
    notes: [`vision critique failed: ${reason}`],
  };
}

export interface RunVisualCriticOptions {
  readonly input: VisualCriticInput;
  /** Injected so this is unit-testable without a model; production passes `analyzeCritique` bound to a request. */
  readonly analyze: (input: VisualCriticInput) => Promise<VisualCritique>;
}

/**
 * Runs the critic against one input, never throwing into the caller.
 *
 * A vision outage must not stall the rejection loop or be mistaken for a
 * passing review: it degrades to `genericVerdict: 'uncertain'` with empty
 * axes, which `distinctness-gate.ts` treats as "cannot vouch for this",
 * not as a pass.
 */
export async function runVisualCritic(opts: RunVisualCriticOptions): Promise<VisualCritique> {
  try {
    return await opts.analyze(opts.input);
  } catch (error) {
    return safeDefault(error instanceof Error ? error.message.slice(0, 200) : String(error));
  }
}
