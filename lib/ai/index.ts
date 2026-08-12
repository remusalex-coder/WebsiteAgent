/**
 * Public surface of the AI layer.
 *
 * Agents import from here and never from a provider file — that is what keeps
 * vendor choice out of the stages.
 */

export { createAIProvider, createAIProviderFactory, API_KEY_VARIABLES } from './factory.js';
export { AI_PROVIDER_NAMES, isAIProviderName } from './types.js';
export { ADAPTERS } from './providers/index.js';

/**
 * Transport primitives reused by callers that need richer inputs than the
 * text-only `AIProvider.generate` contract allows — e.g. vision, which sends
 * images alongside a prompt. Kept narrow and explicit so the four text
 * providers stay the only thing a stage depends on, while a vision QA pass can
 * POST through the same deadline-and-retry-safety posture as the agents.
 */
export { postJson } from './protocol.js';
export { decodeAndValidate, validateAgainstSchema } from './schema.js';

export type { AIProviderFactory, AIProviderFactoryOptions } from './factory.js';

export type {
  AIGenerateRequest,
  AIGenerateResult,
  AIProvider,
  AIProviderName,
  AITokenUsage,
  JsonSchema,
  ProviderAdapter,
  ProviderOptions,
  StructuredOutputMode,
} from './types.js';
