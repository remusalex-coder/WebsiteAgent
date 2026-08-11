/**
 * The content layer: what this business should say, and whether it may say it.
 *
 * Sits between the narrative plan (`lib/design/plan.ts`) and the composer
 * (`lib/design/compose.ts`) — after the page's beats have roles, before the
 * design is composed around the words those beats carry.
 */

export { detectLanguage, lexiconFor, LANGUAGES } from './language.js';
export type { ContentLanguage, LanguageRead, Lexicon } from './language.js';

export { indexEvidence, selfDescriptionFrom, fold } from './evidence.js';
export type { ContentEvidence, EvidenceSentence } from './evidence.js';

export { directContent, headingFromProse, ctaLabelFor } from './director.js';
export type { CopyBasis, CopyDecision, DirectedContent, NarrativePlanForCopy } from './director.js';

export { auditContent } from './quality.js';
export type { AuditInput, ContentAudit, ContentIssue, ContentIssueKind } from './quality.js';
