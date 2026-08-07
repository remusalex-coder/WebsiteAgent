/**
 * The adapter table.
 *
 * This is the entire extension surface of the provider layer. Supporting a new
 * vendor — Ollama, Bedrock, Vertex, Mistral, xAI, an Azure deployment — means:
 *
 *   1. write `providers/<vendor>.ts` exporting a `ProviderAdapter`;
 *   2. add its name to `AI_PROVIDER_NAMES` in `../types.ts`;
 *   3. add one line to the table below.
 *
 * Nothing else changes. No agent, no skill, no orchestration, no configuration
 * consumer — the factory reads this table, and `AIProviderName` is derived from
 * the same list the table is keyed by, so a missing entry is a compile error
 * rather than a runtime surprise.
 */

import { adapter as anthropic } from './anthropic.js';
import { adapter as gemini } from './gemini.js';
import { adapter as openai } from './openai.js';
import { adapter as openrouter } from './openrouter.js';

import type { AIProviderName, ProviderAdapter } from '../types.js';

/** Every adapter this build ships, keyed by provider name. */
export const ADAPTERS: Readonly<Record<AIProviderName, ProviderAdapter>> = {
  anthropic,
  openai,
  gemini,
  openrouter,
};

export function adapterFor(name: AIProviderName): ProviderAdapter {
  return ADAPTERS[name];
}
