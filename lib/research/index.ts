/**
 * The research layer: Claude asks, Hermes answers, the answer persists.
 *
 * Beside the pipeline, not in it — the same relationship `lib/render` has. It
 * imports no agent and no pipeline contract, and no agent imports it. Research
 * supplies attributed evidence; what BusinessForge does with that evidence stays
 * a decision made in the pipeline, by the stages that already make decisions.
 *
 * See `docs/research-handoff.md` for the contract, the storage layout, and what
 * happens when Hermes is unavailable.
 */

export {
  RESEARCH_SCHEMA_VERSION,
} from './types.js';

export type {
  AssetKind,
  ClaimStatus,
  Confidence,
  KnownClaim,
  ProvenanceEntry,
  ProvenanceValue,
  Requester,
  Researcher,
  ResearchArtifact,
  ResearchAsset,
  ResearchClaim,
  ResearchConflict,
  ResearchDelta,
  ResearchGap,
  ResearchPass,
  ResearchProvenance,
  ResearchRequest,
  ResearchScope,
  ResearchSource,
  ResearchSubject,
  SourceAccess,
  SourceKind,
} from './types.js';

export { claimId, requestId, slugify } from './identity.js';
export { parseArtifact, parseDelta, parseRequest, parseSubject } from './validate.js';
export { alreadyMerged, computeConflicts, emptyArtifact, mergeResearch } from './merge.js';
export type { MergeResult } from './merge.js';
export { buildRequest, hermesPrompt, researchBrief, settledFields } from './brief.js';
export { projectProvenance } from './projection.js';

export {
  closeRequest,
  listRequests,
  listSubjects,
  loadArtifact,
  loadDelta,
  loadRequest,
  researchPaths,
  saveAnswer,
  saveArtifact,
  saveRequest,
} from './store.js';
export type { ResearchPaths } from './store.js';

export {
  createHermesClient,
  hermesClientFor,
  mcpTransport,
  noTransportError,
  unwrapMcpResult,
  HERMES_REF,
  RESEARCH_CAPABILITY,
} from './hermes.js';
export type { HermesClient, HermesTransport, McpCaller } from './hermes.js';

export { applyAnswerFile, applyDelta, openRequest } from './session.js';
export type {
  AnsweredNow,
  ApplyAnswerFileOptions,
  ApplyDeltaOptions,
  ApplyDeltaResult,
  OpenRequestOptions,
  OpenRequestResult,
} from './session.js';
