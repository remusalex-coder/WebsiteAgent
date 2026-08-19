/**
 * Functional modules — turning "beyond a landing page" into a concrete
 * build contract, not a slogan.
 *
 * `lib/forge` renders a static site with no backend (`lib/render`'s own
 * documented limit; deployment is a stub — see `PROJECT_STATUS.md`). That
 * is a real constraint, not an oversight to route around: a module spec
 * here must be honestly deliverable as a static, no-backend build, or it
 * does not belong in this file. That is why every module below resolves to
 * a real mechanism with zero new infrastructure — a `mailto:` handoff with
 * real client-side validation and real states — rather than a fake "submit"
 * button that silently does nothing, which would be worse than no form at
 * all (`WEBSITE_CAPABILITY_KNOWLEDGE.md`'s doctrine of absence: a capability
 * that only looks real is a defect, not generosity).
 *
 * Each spec names its real states (idle / validating / ready / handed-off /
 * error) because `MOTION_LIBRARY.md`'s loading discipline applies here too:
 * no fake progress, no state that isn't tied to something actually
 * happening.
 */

import type { FactualDossier, FunctionalModuleId } from './types.js';

export interface FunctionalModuleField {
  readonly name: string;
  readonly label: string;
  readonly type: 'text' | 'tel' | 'email' | 'date' | 'select' | 'textarea';
  readonly required: boolean;
  readonly options?: readonly string[];
}

export interface FunctionalModuleSpec {
  readonly id: FunctionalModuleId;
  readonly purpose: string;
  readonly fields: readonly FunctionalModuleField[];
  /** The real states the implementation must render distinctly — no fake progress. */
  readonly states: readonly string[];
  /** What happens after the user completes the primary action, in concrete terms. */
  readonly afterAction: string;
  /** The one mechanism specced, given no backend exists: a mailto: handoff. */
  readonly submissionMechanism: 'mailto' | 'none';
}

const BOOKING_OR_ENQUIRY_FIELDS: readonly FunctionalModuleField[] = [
  { name: 'name', label: 'Your name', type: 'text', required: true },
  { name: 'phone', label: 'Phone number', type: 'tel', required: true },
  { name: 'email', label: 'Email', type: 'email', required: false },
  { name: 'preferredDate', label: 'Preferred date', type: 'date', required: false },
  { name: 'message', label: 'What do you need?', type: 'textarea', required: true },
];

const MODULE_SPECS: Readonly<Record<Exclude<FunctionalModuleId, 'none'>, (dossier: Pick<FactualDossier, 'contact' | 'businessName'>) => FunctionalModuleSpec>> = {
  'enquiry-form': (dossier) => ({
    id: 'enquiry-form',
    purpose: `Let a visitor reach ${dossier.businessName} with a specific question, without a phone call.`,
    fields: BOOKING_OR_ENQUIRY_FIELDS.filter((f) => f.name !== 'preferredDate'),
    states: ['idle', 'validating', 'ready-to-send', 'handed-off', 'error'],
    afterAction: `Composes a real mailto: link to ${dossier.contact.email || dossier.contact.phone || 'the business'} pre-filled with the visitor's answers and opens the visitor's mail client. The page then shows a real "opens your email app" confirmation, never a fabricated "message sent" claim the site cannot back up.`,
    submissionMechanism: 'mailto',
  }),
  'booking-request': (dossier) => ({
    id: 'booking-request',
    purpose: `Let a visitor request a specific date/time slot from ${dossier.businessName}, preserving their chosen date through the whole flow (the top named bad pattern in the source research is losing it).`,
    fields: BOOKING_OR_ENQUIRY_FIELDS,
    states: ['idle', 'validating', 'ready-to-send', 'handed-off', 'error'],
    afterAction: 'Same mailto: handoff as enquiry-form, with the requested date/time carried into the message body verbatim — this is a request, not a confirmed booking, and the copy must say so honestly (no backend exists to confirm capacity).',
    submissionMechanism: 'mailto',
  }),
  'service-selector': (dossier) => ({
    id: 'service-selector',
    purpose: `Let a visitor pick the specific service they need from ${dossier.businessName}'s real, verified service list and see only the information relevant to that choice.`,
    fields: [{ name: 'service', label: 'What do you need?', type: 'select', required: true, options: ['(populated from the verified service list — never invented)'] }],
    states: ['idle', 'selected'],
    afterAction: 'Reveals the relevant section of the page (pricing basis, turnaround, what to bring) without a page navigation — pure client-side show/hide, no backend needed.',
    submissionMechanism: 'none',
  }),
  'product-configurator': (dossier) => ({
    id: 'product-configurator',
    purpose: `Let a visitor combine verified options for ${dossier.businessName}'s product/service and see the combination reflected back, never a price the business never verified.`,
    fields: [{ name: 'options', label: 'Choose your combination', type: 'select', required: true }],
    states: ['idle', 'configuring', 'summary'],
    afterAction: 'Shows a summary of the chosen combination and routes to the enquiry-form module carrying that summary — never fabricates a computed price the evidence does not verify.',
    submissionMechanism: 'none',
  }),
  'search-filter': () => ({
    id: 'search-filter',
    purpose: 'Let a visitor narrow a long, real list by a verified attribute.',
    fields: [{ name: 'filter', label: 'Filter', type: 'select', required: false }],
    states: ['idle', 'filtered', 'no-results'],
    afterAction: 'Client-side filtering of the already-rendered list — no network call, no backend. A genuine no-results state must be shown honestly, not hidden.',
    submissionMechanism: 'none',
  }),
  'comparison-tool': () => ({
    id: 'comparison-tool',
    purpose: 'Let a visitor compare two or more real options side by side.',
    fields: [],
    states: ['idle', 'comparing'],
    afterAction: 'Renders a side-by-side comparison of the selected real items — client-side only.',
    submissionMechanism: 'none',
  }),
  calculator: (dossier) => ({
    id: 'calculator',
    purpose: `Let a visitor estimate cost or output for ${dossier.businessName} from verified inputs only.`,
    fields: [{ name: 'inputs', label: 'Your details', type: 'text', required: true }],
    states: ['idle', 'calculating', 'result'],
    afterAction: 'Computes a result client-side from a formula grounded in verified pricing evidence, or — absent verified pricing — declines to show a number at all and routes to enquiry-form instead of inventing one.',
    submissionMechanism: 'none',
  }),
};

/** The concrete spec for one selected module, or `null` for `'none'`. */
export function specFor(id: FunctionalModuleId, dossier: Pick<FactualDossier, 'contact' | 'businessName'>): FunctionalModuleSpec | null {
  if (id === 'none') return null;
  return MODULE_SPECS[id](dossier);
}

/** The prompt fragment `builder.ts` includes for every selected module — the concrete contract the model must actually build, not a suggestion. */
export function functionalModulePrompt(ids: readonly FunctionalModuleId[], dossier: Pick<FactualDossier, 'contact' | 'businessName'>): string {
  const specs = ids.map((id) => specFor(id, dossier)).filter((s): s is FunctionalModuleSpec => s !== null);
  if (specs.length === 0) {
    return 'FUNCTIONAL MODULES: none selected. This build is informational only — do not add a form or interactive tool that was not asked for.';
  }

  const blocks = specs.map((spec) => `MODULE "${spec.id}": ${spec.purpose}
  Fields: ${spec.fields.map((f) => `${f.name} (${f.type}${f.required ? ', required' : ''})`).join(', ') || 'none'}
  Real states to render distinctly: ${spec.states.join(' → ')}
  After the primary action: ${spec.afterAction}
  Submission mechanism: ${spec.submissionMechanism === 'mailto' ? 'a real mailto: link built from the field values — NO fetch/POST to any endpoint, this site has no backend' : 'client-side only, no network call'}`).join('\n\n');

  return `FUNCTIONAL MODULES — this site is not a landing page. Implement each of the following as REAL, working client-side functionality (real validation, real states, no fake progress bars, no button that does nothing):

${blocks}

MANDATORY: every module above must have real inline validation (required fields actually block submission with a visible message), a real empty/error state, and — for mailto: modules — the mailto: link must be built from the actual field values at submit time, not hardcoded.`;
}
