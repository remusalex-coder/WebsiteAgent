/**
 * Public surface of the capability layer.
 *
 * Agents and stages import from here, never from an individual module — that
 * is what keeps the vocabulary, the registry and the routing rules from being
 * reached around.
 */

export {
  CAPABILITY_IDS,
  isCapabilityId,
  MODEL_CLASSES,
  isModelClassName,
  serviceRef,
} from './types.js';

export type {
  CapabilityId,
  CapabilityDescriptor,
  CapabilityTier,
  CapabilityGate,
  ServiceBinding,
  ServiceKind,
  LicenceClass,
  Jurisdiction,
  ModelClassName,
  ModelRecord,
  Modality,
  FreeAllowance,
} from './types.js';

export {
  CAPABILITY_REGISTRY,
  CAPABILITY_DESCRIPTORS,
  describeCapability,
  capabilitiesAtTier,
  autonomouslyPlannable,
} from './registry.js';

export { bindingsFor, ALL_BINDINGS } from './bindings.js';

export {
  MODEL_CATALOG,
  CATALOGUED_PROVIDERS,
  modelKey,
  resolveModel,
  catalogFor,
  supportsVision,
  estimateCents,
  DEFAULT_TOKEN_ESTIMATE,
} from './models.js';
export type { TokenEstimate, PriceOverrides } from './models.js';

export { openQuotaLedger, unmeteredQuotaLedger, utcDay, QUOTA_FILE } from './quota.js';
export type { QuotaLedger, QuotaSnapshot } from './quota.js';

export { planCapability, DEFAULT_POLICY } from './plan.js';
export type {
  CapabilityPlan,
  CapabilityPolicy,
  PlanStep,
  PlanOptions,
  Exclusion,
  ExclusionReason,
} from './plan.js';

export { executeCapability } from './execute.js';
export type {
  CapabilityInvoker,
  ExecuteOptions,
  ExecuteResult,
  ExecutionRecord,
  AttemptRecord,
} from './execute.js';

export {
  AGENT_POOLS,
  AGENT_SEATS,
  seat,
  seatsInPool,
  seatsForCapability,
  crossVendorExclusions,
} from './agents.js';
export type { AgentPool, AgentSeat, AgentStatus } from './agents.js';

export {
  RUNTIME_TIERS,
  tierRank,
  decideRuntimeTier,
  LIBRARY_IDS,
  LIBRARY_REGISTER,
  librariesAt,
  weightBudgetKb,
} from './experience.js';
export type {
  RuntimeTier,
  ExperienceEvidence,
  TierDecision,
  LibraryId,
  LibraryStatus,
  LibraryEntry,
} from './experience.js';

export { createCapabilityOrchestrator, tierCounts } from './orchestrator.js';
export type {
  CapabilityOrchestrator,
  CapabilityBoard,
  BoardRow,
  PlanOverrides,
  OrchestratorOptions,
} from './orchestrator.js';

export { createModelInvoker } from './invokers.js';
export type { ModelInvocation } from './invokers.js';

export { createVisionInvoker } from './visionInvoker.js';
export type { VisionInvocation, VisionImage, VisionResult } from './visionInvoker.js';
