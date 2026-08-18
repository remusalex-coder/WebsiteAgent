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
import { decodeStructured, postJson } from '../ai/protocol.js';
import { toGeminiSchema } from '../ai/schema.js';

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
   * The full instruction, including what shape the reply must take. Vision
   * models are asked in prose here rather than through native schema
   * enforcement on every vendor — Gemini gets both; see `VisionResult`.
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

  const content: unknown[] = [{ type: 'text', text: request.prompt }];
  for (const image of request.images) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:${image.mimeType};base64,${image.base64}`, detail: 'high' },
    });
  }

  const raw = (await postJson(provider, SOURCE, {
    url,
    headers: { authorization: `Bearer ${apiKey}` },
    timeoutMs: request.timeoutMs,
    signal: request.signal,
    body: {
      model: modelId,
      max_tokens: request.maxTokens,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
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
    }
  };
}

export const SOURCE_NAME = SOURCE;
