/**
 * Which agent-pool providers are actually usable right now.
 *
 * `probe-providers.ts` probes each adapter's *default* model, which is how it
 * reported gemini as unreachable when the key was fine and only the model id had
 * been retired. This probes the models this deployment is configured to use, and
 * reports per provider: credentialled? reachable? which model answered?
 *
 *   npx tsx --env-file=.env scripts/probe-pool.ts
 *
 * It spends one tiny structured generation per credentialled provider.
 */

import { createAIProviderFactory } from '../lib/ai/index.js';
import { loadConfig } from '../lib/config.js';
import { createLogger, createConsoleSink } from '../lib/logger.js';
import { AI_PROVIDER_NAMES } from '../lib/ai/types.js';

import type { AIProviderName } from '../lib/ai/types.js';

/** Models to try per vendor, best first. Only ids this repo already configures. */
const CANDIDATES: Readonly<Record<AIProviderName, readonly string[]>> = {
  gemini: ['gemini-3.6-flash', 'gemini-2.0-flash'],
  anthropic: ['claude-sonnet-5', 'claude-haiku-4-5-20251001'],
  openai: ['gpt-5.2', 'gpt-4.1-mini'],
  openrouter: ['deepseek/deepseek-chat', 'google/gemini-2.0-flash-exp:free'],
};

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: 'error', scope: 'probe-pool', sink: createConsoleSink() });
  const factory = createAIProviderFactory({ config: config.ai, logger });
  const credentialled = new Set(factory.configured());

  const rows: Record<string, unknown>[] = [];

  for (const name of AI_PROVIDER_NAMES) {
    if (!credentialled.has(name)) {
      rows.push({ provider: name, credential: 'MISSING', usable: false, model: null, note: 'no API key in env' });
      continue;
    }

    const provider = factory.create(name);
    let ok = false;
    let usedModel: string | null = null;
    let note = '';

    for (const model of CANDIDATES[name]) {
      try {
        const result = await provider.generate({
          system: 'Answer with JSON only.',
          prompt: 'Reply with {"ok": true}.',
          schema: {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
            required: ['ok'],
            additionalProperties: false,
          },
          model,
          effort: 'low',
          maxTokens: 2048,
        });
        ok = true;
        usedModel = result.model;
        break;
      } catch (error) {
        note = error instanceof Error ? error.message.slice(0, 140) : String(error);
      }
    }

    rows.push({ provider: name, credential: 'present', usable: ok, model: usedModel, note: ok ? '' : note });
  }

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
