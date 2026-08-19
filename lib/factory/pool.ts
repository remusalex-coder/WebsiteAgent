/**
 * Role-based agent pools.
 *
 * The factory does not call "the model". It calls a *role* — research, design,
 * content — and the pool decides which vendors serve that role on this
 * deployment. That indirection is the whole point: adding DeepSeek to research
 * is an environment change, not a workflow change, and n8n fans out over
 * whatever `membersFor` returns without knowing any vendor's name.
 *
 * ## Absent credentials are reported, never silently dropped
 *
 * A provider with no API key is not an error and does not stop a run — but it
 * also must not vanish. `resolvePool` returns the usable members *and* the
 * declined ones with the variable that would enable each, so an execution can
 * show "ran on gemini; anthropic and openrouter have no credential" rather than
 * quietly running on one vendor and looking like a pool.
 *
 * ## Why the default pool is one free provider
 *
 * The platform's baseline is €0. `BF_POOL` therefore defaults to the vendors
 * with a free tier, and widening it to a paid vendor is an explicit, recorded
 * act — one environment variable, named in the run's own artifacts.
 */

import { createAIProviderFactory } from '../ai/index.js';
import { AI_PROVIDER_NAMES, isAIProviderName } from '../ai/types.js';
import { ADAPTERS } from '../ai/providers/index.js';

import type { AiConfig } from '../config.js';
import type { Logger } from '../logger.js';
import type { AIProvider, AIProviderName } from '../ai/types.js';

/** The roles the factory recruits for. One pool per role. */
export const POOL_ROLES = ['research', 'design', 'content'] as const;
export type PoolRole = (typeof POOL_ROLES)[number];

export function isPoolRole(value: string): value is PoolRole {
  return (POOL_ROLES as readonly string[]).includes(value);
}

/**
 * Model each vendor is asked for when the environment names none.
 *
 * These are ids this deployment has actually reached — not an adapter's
 * historical default, which is how a live key came to be reported as an
 * unreachable provider (`gemini-2.5-flash` is retired; the key was fine).
 * Override per vendor with `BF_MODEL_GEMINI`, `BF_MODEL_OPENAI`, and so on.
 */
const DEFAULT_MODELS: Readonly<Record<AIProviderName, string>> = {
  gemini: 'gemini-3.6-flash',
  openai: 'gpt-5.2',
  anthropic: 'claude-sonnet-5',
  openrouter: 'deepseek/deepseek-chat',
  xai: 'grok-4.6',
  deepseek: 'deepseek-v4-flash',
  cerebras: 'gpt-oss-120b',
};

/** Vendors with a free tier — the €0 default pool. */
const FREE_TIER: readonly AIProviderName[] = ['gemini'];

export interface PoolMember {
  readonly role: PoolRole;
  readonly provider: AIProviderName;
  readonly model: string;
}

/** A vendor asked for but not usable, and what would fix it. */
export interface PoolAbsence {
  readonly provider: AIProviderName;
  readonly reason: string;
  readonly variable: string;
}

export interface ResolvedPool {
  readonly role: PoolRole;
  /** Vendors that can actually be called, in the order the environment named them. */
  readonly members: readonly PoolMember[];
  /** Vendors named or supported but unusable. Reported, never fatal. */
  readonly absent: readonly PoolAbsence[];
}

/**
 * Which vendors this role may use, before credentials are considered.
 *
 * `BF_POOL_RESEARCH` overrides `BF_POOL` overrides the free-tier default, so a
 * deployment can widen one role without widening all of them.
 */
function requestedFor(role: PoolRole, env: NodeJS.ProcessEnv): readonly string[] {
  const raw = env[`BF_POOL_${role.toUpperCase()}`] ?? env.BF_POOL ?? '';
  const named = raw
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '');
  return named.length > 0 ? named : FREE_TIER;
}

function modelFor(provider: AIProviderName, env: NodeJS.ProcessEnv): string {
  const override = env[`BF_MODEL_${provider.toUpperCase()}`]?.trim();
  return override !== undefined && override !== '' ? override : DEFAULT_MODELS[provider];
}

/**
 * Resolves one role's pool against the credentials this process actually holds.
 *
 * Never throws and never returns a member that cannot be called: a caller that
 * gets an empty `members` knows the role is unstaffed and can say so, which is
 * a different failure from a vendor erroring mid-call.
 */
export function resolvePool(
  role: PoolRole,
  config: AiConfig,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedPool {
  const requested = requestedFor(role, env);
  const members: PoolMember[] = [];
  const absent: PoolAbsence[] = [];

  for (const name of requested) {
    if (!isAIProviderName(name)) {
      absent.push({
        provider: name as AIProviderName,
        reason: `no adapter for "${name}" in this build`,
        variable: '(none)',
      });
      continue;
    }
    if (config.apiKeys[name] === '') {
      absent.push({
        provider: name,
        reason: 'no credential configured',
        variable: ADAPTERS[name].apiKeyVariable,
      });
      continue;
    }
    members.push({ role, provider: name, model: modelFor(name, env) });
  }

  // Supported vendors nobody asked for are still worth naming: the point of the
  // report is to make the shape of the pool legible, including its gaps.
  for (const name of AI_PROVIDER_NAMES) {
    if (requested.includes(name)) continue;
    if (absent.some((entry) => entry.provider === name)) continue;
    absent.push({
      provider: name,
      reason:
        config.apiKeys[name] === ''
          ? 'no credential configured'
          : `credentialled but not in this pool (set BF_POOL_${role.toUpperCase()})`,
      variable: ADAPTERS[name].apiKeyVariable,
    });
  }

  return { role, members, absent };
}

/**
 * Constructs the callable provider for a member.
 *
 * Goes through the shared factory rather than an adapter directly, so pool
 * calls inherit the same retry-with-jitter every other model call in this
 * repository gets.
 */
export function providerFor(
  member: PoolMember,
  config: AiConfig,
  logger: Logger,
): AIProvider {
  return createAIProviderFactory({ config, logger }).create(member.provider);
}
