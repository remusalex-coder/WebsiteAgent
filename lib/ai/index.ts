/**
 * Public surface of the AI layer.
 *
 * Agents import from here and never from a provider file — that is what keeps
 * vendor choice out of the stages.
 */

export { createAIProvider, createAIProviderFactory, API_KEY_VARIABLES } from './factory.js';
export { AI_PROVIDER_NAMES, isAIProviderName } from './types.js';
export { ADAPTERS } from './providers/index.js';

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
