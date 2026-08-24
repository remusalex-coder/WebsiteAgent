/**
 * The vision invoker — the missing half of `createModelInvoker`.
 *
 * `AIProvider.generate()` is text-only (`system`, `prompt`, `schema` — no
 * image field), which is a deliberate boundary documented in
 * `PROJECT_STATUS.md`. It is also why `craft_judging` — the one capability
 * that reads rendered pixels and decides whether a page looks like a generic
 * AI template — has never been routable through the capability planner:
 * `lib/qa/visual-critic.ts` reaches around the provider layer entirely with a
 * single hardcoded `postJson('openai', …)` call against a *separate*
 * `VISION_*` credential block, so a deployment with `GEMINI_API_KEY` and
 * `OPENAI_API_KEY` already configured — this one — still needs a third,
 * distinct `VISION_API_KEY` set before the critic runs at all. Absent one, it
 * silently returns `uncertain` on every job, forever, which is the actual
 * production behaviour this module exists to fix.
 *
 * This is not a new transport. Every vendor's request shape below is the same
 * one `lib/ai/providers/*.ts` already builds for text, extended with the
 * image content each vendor's multimodal endpoint expects, over the same
 * `postJson` / `decodeStructured` primitives `lib/ai/protocol.ts` already
 * exports. It exists here rather than as a fifth field on `AIGenerateRequest`
 * because widening that interface would touch all four adapters and their
 * retry wrapper for a capability only two of them serve today.
 *
 * ## Coverage
 *
 * Gemini and OpenAI-compatible (which covers OpenRouter too, since it mirrors
 * the OpenAI chat-completions shape) are implemented. Anthropic is not: its
 * adapter is the one file in this repository permitted to import
 * `@anthropic-ai/sdk` (see `lib/ai/providers/anthropic.ts`), and building a
 * parallel raw-HTTP path around that boundary for one capability is not
 * worth the duplication. A step that resolves to `anthropic` fails cleanly
 * with a message that says why, which — same as any other failed step —
 * advances the chain rather than stalling it.
 */

import { ProviderRequestError } from '../errors.js';
import { decodeStructured, postJson, toOpenAIReasoningReserve } from '../ai/protocol.js';
import { buildSchemaInstruction, toGeminiSchema } from '../ai/schema.js';
import { toStrictSchema } from '../ai/providers/openai.js';

import type { AiConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { JsonSchema } from '../ai/types.js';
import type { PlanStep } from './plan.js';
import type { CapabilityInvoker } from './execute.js';

const SOURCE = 'capability.visionInvoker';

/** One image to attach, already base64-encoded. */
export interface VisionImage {
  readonly base64: string;
  /** e.g. `image/png`. */
  readonly mimeType: string;
}

/** What the caller wants judged. Everything else comes from the plan step. */
export interface VisionInvocation {
  /**
   * The substantive instruction — what to look at and how to judge it. What
   * shape the reply must take is *not* this field's job to spell out: each
   * transport enforces `schema` itself — natively for Gemini and OpenAI
   * (`responseSchema` / `json_schema` + `strict`), appended as prose only
   * for OpenRouter, whose routing can't guarantee every backend model
   * supports native enforcement. A caller that pastes its own "respond
   * matching the schema" line into this field is not wrong, exactly, but it
   * is redundant for two of three vendors and, if it doesn't actually name
   * the required top-level keys, is silently relying on the model reading
   * one that was never sent — see `callOpenAICompatible`'s `json_object`→
   * `json_schema` fix, 2026-08-20, for what that looked like in practice.
   */
  readonly prompt: string;
  readonly schema: JsonSchema;
  readonly images: readonly VisionImage[];
  readonly maxTokens: number;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

export interface VisionResult {
  readonly data: unknown;
  readonly model: string;
}

/** Gemini's `generateContent`, extended with `inline_data` image parts. */
async function callGemini(
  modelId: string,
  request: VisionInvocation,
  apiKey: string,
  baseUrl: string | null,
): Promise<VisionResult> {
  const url = `${(baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '')}/models/${encodeURIComponent(modelId)}:generateContent`;

  const raw = (await postJson('gemini', SOURCE, {
    url,
    headers: { 'x-goog-api-key': apiKey },
    timeoutMs: request.timeoutMs,
    signal: request.signal,
    body: {
      contents: [
        {
          role: 'user',
          parts: [
            { text: request.prompt },
            ...request.images.map((image) => ({
              inline_data: { mime_type: image.mimeType, data: image.base64 },
            })),
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: request.maxTokens,
        responseMimeType: 'application/json',
        responseSchema: toGeminiSchema(request.schema),
      },
    },
  })) as {
    modelVersion?: unknown;
    candidates?: readonly { content?: { parts?: readonly { text?: unknown }[] } }[];
  };

  const text = (raw.candidates?.[0]?.content?.parts ?? [])
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('');
  if (text === '') {
    throw new ProviderRequestError('gemini', 'vision response carried no text content', {
      source: SOURCE,
      retryable: true,
    });
  }

  return {
    data: decodeStructured('gemini', SOURCE, text, request.schema),
    model: typeof raw.modelVersion === 'string' ? raw.modelVersion : modelId,
  };
}

/** OpenAI's `chat/completions` with `image_url` content parts. Also serves OpenRouter. */
async function callOpenAICompatible(
  provider: 'openai' | 'openrouter',
  modelId: string,
  request: VisionInvocation,
  apiKey: string,
  baseUrl: string | null,
): Promise<VisionResult> {
  const defaultBase =
    provider === 'openai' ? 'https://api.openai.com/v1' : 'https://openrouter.ai/api/v1';
  const url = `${(baseUrl ?? defaultBase).replace(/\/+$/, '')}/chat/completions`;

  // OpenAI gets native schema enforcement below (`json_schema` + `strict`),
  // so its prompt text is untouched. OpenRouter's `response_format` only
  // reaches upstreams that implement it — same reasoning as the text path's
  // `lib/ai/providers/openrouter.ts` — so the schema is spelled out in the
  // prompt instead, same as `systemWithSchema(request, false)` does there.
  //
  // This is also the fix for the second live-confirmed bug (2026-08-19):
  // `json_object` mode only guarantees syntactically valid JSON, not any
  // particular shape, and this request never sent the schema to the vendor
  // at all — the model had nothing but `critic.ts`'s prose ("matching the
  // required schema") to go on, which never names the top-level keys. Every
  // real OpenAI vision critique came back missing `score`,
  // `feelsArtDirectedVsAi`, and `criteriaScores`, failed `decodeStructured`'s
  // validation, and degraded to the `uncertain` floor.
  const promptText =
    provider === 'openai' ? request.prompt : `${request.prompt}\n\n${buildSchemaInstruction(request.schema)}`;

  const content: unknown[] = [{ type: 'text', text: promptText }];
  for (const image of request.images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.base64}`, detail: 'high' },
    });
  }

  // OpenAI's newer reasoning-capable models (gpt-5.2 among them) reject
  // `max_tokens` outright ("Unsupported parameter... Use
  // 'max_completion_tokens'") — confirmed live, 2026-08-19: the vision
  // critic degraded to `uncertain` on every real OpenAI call until this
  // fix, because this hand-rolled request never got the same
  // `max_completion_tokens` migration `lib/ai/providers/openai.ts`'s
  // `maxCompletionTokensFor` already has for the text path. OpenRouter's
  // gateway proxies many different backend models and has been observed
  // accepting `max_tokens` — left unchanged rather than migrated on the
  // strength of one vendor's fix.
  const tokenField = provider === 'openai'
    ? { max_completion_tokens: request.maxTokens + toOpenAIReasoningReserve('medium') }
    : { max_tokens: request.maxTokens };

  const raw = (await postJson(provider, SOURCE, {
    url,
    headers: { authorization: `Bearer ${apiKey}` },
    timeoutMs: request.timeoutMs,
    signal: request.signal,
    body: {
      model: modelId,
      ...tokenField,
      messages: [{ role: 'user', content }],
      response_format:
        provider === 'openai'
          ? {
              type: 'json_schema',
              json_schema: {
                name: 'vision_critique',
                strict: true,
                schema: toStrictSchema(request.schema),
              },
            }
          : { type: 'json_object' },
    },
  })) as { model?: unknown; choices?: readonly { message?: { content?: unknown } }[] };

  const text = raw.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text === '') {
    throw new ProviderRequestError(provider, 'vision response carried no content', {
      source: SOURCE,
      retryable: true,
    });
  }

  return {
    data: decodeStructured(provider, SOURCE, text, request.schema),
    model: typeof raw.model === 'string' ? raw.model : modelId,
  };
}

/**
 * Builds an invoker that sends images to whichever vendor the plan resolved.
 *
 * Takes `AiConfig` rather than the platform's `AIProviderFactory` — unlike
 * `createModelInvoker`, this never goes through `AIProvider.generate()` at
 * all, so it needs the raw credential the factory would otherwise keep
 * behind the adapter.
 */
export function createVisionInvoker(
  request: VisionInvocation,
  config: AiConfig,
  logger: Logger,
): CapabilityInvoker<VisionResult> {
  const scoped = logger.child(SOURCE);

  return async (step: PlanStep): Promise<VisionResult> => {
    if (step.binding.kind !== 'model' || step.model === null) {
      throw new Error(`[${SOURCE}] createVisionInvoker was handed a non-model step: ${step.binding.id}`);
    }

    const vendor = step.model.provider;
    const apiKey = config.apiKeys[vendor];
    if (apiKey === '') {
      // The planner already filters on credential presence; reaching here
      // without one means the caller built its own plan and skipped that
      // filter. Fail loudly rather than send an unauthenticated request.
      throw new Error(`[${SOURCE}] no credential configured for ${vendor}`);
    }

    const modelId = step.model.id;
    scoped.debug('vision call', { provider: vendor, model: modelId, images: request.images.length });

    switch (vendor) {
      case 'gemini':
        return callGemini(modelId, request, apiKey, config.baseUrls.gemini);
      case 'openai':
        return callOpenAICompatible('openai', modelId, request, apiKey, config.baseUrls.openai);
      case 'openrouter':
        return callOpenAICompatible('openrouter', modelId, request, apiKey, config.baseUrls.openrouter);
      case 'anthropic':
        throw new Error(
          `[${SOURCE}] anthropic vision is not implemented — its adapter is the only file ` +
            'permitted to import the Anthropic SDK, and this module deliberately does not ' +
            'build a parallel raw-HTTP path around that boundary',
        );
      case 'xai':
        throw new Error(
          `[${SOURCE}] xai vision is not implemented — the adapter (lib/ai/providers/xai.ts) ` +
            'is text-only so far; no vision request shape has been verified against a live ' +
            'call, and this module does not guess at one',
        );
      case 'deepseek':
        throw new Error(
          `[${SOURCE}] deepseek vision is not implemented — the adapter (lib/ai/providers/` +
            'deepseek.ts) is text-only so far; no vision request shape has been verified ' +
            'against a live call, and this module does not guess at one',
        );
      case 'cerebras':
        throw new Error(
          `[${SOURCE}] cerebras vision is not implemented — the adapter (lib/ai/providers/` +
            'cerebras.ts) is text-only so far; no vision request shape has been verified ' +
            'against a live call, and this module does not guess at one',
        );
      case 'groq':
        throw new Error(
          `[${SOURCE}] groq vision is not implemented — the adapter (lib/ai/providers/` +
            'groq.ts) is text-only so far (Groq documents OCR/image recognition as a ' +
            'separate feature from the GPT-OSS chat models this adapter targets); no ' +
            'vision request shape has been verified against a live call, and this module ' +
            'does not guess at one',
        );
    }
  };
}

export const SOURCE_NAME = SOURCE;
