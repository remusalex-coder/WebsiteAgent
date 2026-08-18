/**
 * The standard model invoker.
 *
 * `executeCapability` takes an `invoke(step)` function and does not know how
 * to call a model — that is deliberate, see `execute.ts`. This is the function
 * every stage that wants a structured generation actually passes: it turns a
 * `PlanStep` whose binding is `kind: 'model'` into a real `AIProvider.generate`
 * call, using the vendor and model the planner already resolved.
 *
 * A stage that needs a tool, a skill or an MCP capability instead writes its
 * own `invoke` — this module only covers the one case common enough to be
 * worth sharing.
 */

import { createAIProviderFactory } from '../ai/factory.js';

import type { AiConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { AIGenerateResult, JsonSchema } from '../ai/types.js';
import type { PlanStep } from './plan.js';
import type { CapabilityInvoker } from './execute.js';

const SOURCE = 'capability.invokers';

/** What the caller wants generated. Everything else comes from the plan step. */
export interface ModelInvocation {
  readonly system: string;
  readonly prompt: string;
  readonly schema: JsonSchema;
  readonly schemaName?: string;
  readonly maxTokens: number;
  readonly signal?: AbortSignal;
}

/**
 * Builds an invoker bound to one job's request. Effort is read off the step's
 * resolved model class — `enum` steps ask for `low`, everything else `high` —
 * because asking a Flash-Lite pick-from-eleven-values call to think hard is
 * exactly the waste the enum model class exists to prevent.
 */
export function createModelInvoker(
  request: ModelInvocation,
  config: AiConfig,
  logger: Logger,
): CapabilityInvoker<AIGenerateResult> {
  const factory = createAIProviderFactory({ config, logger: logger.child(SOURCE) });

  return async (step: PlanStep): Promise<AIGenerateResult> => {
    if (step.binding.kind !== 'model' || step.model === null) {
      throw new Error(
        `[${SOURCE}] createModelInvoker was handed a non-model step: ${step.binding.id}`,
      );
    }

    const provider = factory.create(step.model.provider);
    return provider.generate({
      system: request.system,
      prompt: request.prompt,
      schema: request.schema,
      model: step.model.id,
      effort: step.model.modelClass === 'enum' ? 'low' : 'high',
      maxTokens: request.maxTokens,
      ...(request.schemaName === undefined ? {} : { schemaName: request.schemaName }),
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
  };
}

export const SOURCE_NAME = SOURCE;
