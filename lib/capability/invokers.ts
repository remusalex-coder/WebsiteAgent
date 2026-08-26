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
 *
 * ## Why this takes a factory, not a config
 *
 * The first version of this function built its own `AIProviderFactory` from
 * `AiConfig`. That meant every capability call constructed a second factory
 * alongside the platform's own `providers` — a separate cache, separate
 * retry-with-jitter state, and (in a test) no seam to substitute a fake
 * provider without also faking a working `AiConfig` and a live-looking
 * adapter. Taking the factory as a parameter means production passes
 * `ctx.platform.providers` — the same cached instances every other caller in
 * the process uses — and a test passes a two-line fake.
 *
 * ## Preserving a pinned model id across failover
 *
 * `ANALYST_MODEL` / `WRITER_MODEL` / `DIRECTOR_MODEL` let an operator pin a
 * specific id for the vendor named by `AI_PROVIDER` — a knob that predates
 * this layer and several deployments already set. The model catalogue's
 * per-class default is right for a vendor reached by *failover*, where no
 * such pin exists, but it must not silently override one that does.
 * `modelOverrides` is `{ [vendor]: pinnedId }`: applied only when the
 * resolved step's vendor matches a key, so a pin for `gemini` has no effect
 * on the id used if the chain fails over to `openai`.
 */

import type { Effort } from '../config.js';
import type { Logger } from '../logger.js';
import type { AIProviderFactory } from '../ai/factory.js';
import type { AIGenerateResult, AIProviderName, JsonSchema } from '../ai/types.js';
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
  /** A pinned model id per vendor, applied only when that vendor is the resolved step. */
  readonly modelOverrides?: Readonly<Partial<Record<AIProviderName, string>>>;
  /**
   * The caller's own configured effort (e.g. `ANALYST_EFFORT`, `WRITER_EFFORT`,
   * `DIRECTOR_EFFORT`). Wins whenever supplied — a stage that already tuned
   * its own reasoning depth did not delegate that choice to this function.
   * Only absent when a caller genuinely has none of its own, in which case
   * the model class's own default applies (see below).
   */
  readonly effort?: Effort;
}

/**
 * Builds an invoker bound to one job's request. `request.effort`, when the
 * caller supplies one, wins outright. Absent one, an `enum` step asks for
 * `low` and everything else `high` — because asking a Flash-Lite
 * pick-from-eleven-values call to think hard is exactly the waste the enum
 * model class exists to prevent, and that default should hold for a caller
 * that never had an effort setting of its own to begin with.
 */
export function createModelInvoker(
  request: ModelInvocation,
  providers: AIProviderFactory,
  logger: Logger,
): CapabilityInvoker<AIGenerateResult> {
  const scoped = logger.child(SOURCE);

  return async (step: PlanStep): Promise<AIGenerateResult> => {
    if (step.binding.kind !== 'model' || step.model === null) {
      throw new Error(
        `[${SOURCE}] createModelInvoker was handed a non-model step: ${step.binding.id}`,
      );
    }

    const pinned = request.modelOverrides?.[step.model.provider];
    const modelId = pinned ?? step.model.id;
    if (pinned !== undefined && pinned !== step.model.id) {
      scoped.debug('using a pinned model id for this vendor', {
        provider: step.model.provider,
        catalogued: step.model.id,
        pinned,
      });
    }

    const provider = providers.create(step.model.provider);
    return provider.generate({
      system: request.system,
      prompt: request.prompt,
      schema: request.schema,
      model: modelId,
      effort: request.effort ?? (step.model.modelClass === 'enum' ? 'low' : 'high'),
      maxTokens: request.maxTokens,
      ...(request.schemaName === undefined ? {} : { schemaName: request.schemaName }),
      ...(request.signal === undefined ? {} : { signal: request.signal }),
    });
  };
}

/**
 * Dispatches a plan step to a model invoker or a deterministic handler, by
 * `step.binding.kind`.
 *
 * `createModelInvoker`'s returned function throws when handed anything but a
 * `kind: 'model'` step — deliberately: it has no way to serve a `tool`,
 * `skill`, or `deterministic` binding, and that throw is the right defence
 * against a caller wiring it up wrong. But every capability in `bindings.ts`
 * ends its chain with a `deterministic` floor precisely so a run survives
 * when every model fails, and that floor is reachable only if *something* in
 * the chain knows how to run it. Before this combinator, no call site did:
 * the model invoker was the only `invoke` most stages ever built, so the
 * chain reaching its own declared floor produced the same "non-model step"
 * throw as a genuine wiring bug — indistinguishable from one, and in
 * `grounding.ts` and `research.ts`, fatal to the whole run.
 *
 * `onModel` is typically `createModelInvoker(...)`'s return value. `onDeterministic`
 * is the call site's own floor implementation — whatever "compose the
 * baseline", "discard and keep the deterministic value", or similar means
 * for that particular capability and shape of `T`.
 */
export function withDeterministicFloor<T>(
  onModel: CapabilityInvoker<T>,
  onDeterministic: (step: PlanStep) => T | Promise<T>,
): CapabilityInvoker<T> {
  return async (step: PlanStep): Promise<T> => {
    if (step.binding.kind === 'deterministic') {
      return onDeterministic(step);
    }
    return onModel(step);
  };
}

/**
 * The `AIGenerateResult` shape for a deterministic floor step, so a call
 * site's `onDeterministic` handler can hand back a value indistinguishable
 * in shape from a real model response. That matters because every stage
 * already writes `(parsed.field as T) ?? default` for a field a model
 * *omitted* — passing `data` here through that same parsing path is what
 * lets those existing per-field fallbacks compose the whole result when the
 * chain lands on the floor, rather than duplicating that logic.
 */
export function deterministicModelResult(step: PlanStep, data: unknown): AIGenerateResult {
  return {
    data,
    model: step.binding.id,
    usage: { inputTokens: null, outputTokens: null },
    structuredOutput: 'native',
    finishReason: 'deterministic-floor',
  };
}

export const SOURCE_NAME = SOURCE;
