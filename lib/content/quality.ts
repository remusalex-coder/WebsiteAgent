/**
 * The content quality gate.
 *
 * ## What it is for
 *
 * `lib/design/quality.ts` already scores the *structure* of an experience — is
 * every decision explained, does the arc cohere, did the set of businesses
 * collapse to one template. It cannot read. This file reads: it audits the
 * words that will actually be on the page, against the evidence that is allowed
 * to support them.
 *
 * It exists because "the tests pass" and "the copy is any good" are different
 * claims, and because a generator that can write can also fabricate. A gate
 * that only a well-behaved generator passes is worth nothing; this one is
 * written to be **failable**, and the benchmark deliberately feeds it broken
 * content to prove it fails.
 *
 * ## The two severities
 *
 * `error` — the page must not ship: a claim no evidence supports, banned
 * marketing boilerplate, a button that promises an action the strategy did not
 * choose, a beat whose copy contradicts its narrative role.
 *
 * `warning` — the page is honest but plain: a role fell back to a generic
 * label, a heading is weak, prose is repeated. Warnings are the measure of how
 * much of the page is still template rather than business, and the benchmark
 * tracks them as a number rather than a pass/fail.
 *
 * Deterministic. No model, no network.
 */

import { fold } from './evidence.js';

import type { ContentEvidence } from './evidence.js';
import type { NarrativeRole } from '../design/script.js';
import type { ConversionStrategy } from '../design/conversion.js';
import type { SectionKind, WebsiteContent } from '../types.js';

export type ContentIssueKind =
  | 'unsupported-claim'
  | 'boilerplate'
  | 'repeated-phrase'
  | 'repeated-structure'
  | 'weak-heading'
  | 'role-mismatch'
  | 'cta-mismatch'
  | 'empty-section'
  | 'verbose'
  | 'no-business-evidence'
  | 'inconsistent-terminology'
  | 'duplicate-value-proposition';

export interface ContentIssue {
  readonly kind: ContentIssueKind;
  readonly severity: 'error' | 'warning';
  /** Section index, or -1 for a page-level issue. */
  readonly index: number;
  readonly message: string;
  /** The offending text, trimmed. */
  readonly quote: string;
}

export interface ContentAudit {
  readonly ok: boolean;
  readonly issues: readonly ContentIssue[];
  /** 0–100. Errors cost far more than warnings; specificity earns back. */
  readonly score: number;
  /** Share of headings built from the business's own words, 0–1. */
  readonly specificity: number;
}

/**
 * Phrases that mean a page has stopped saying anything.
 *
 * Every one of these is grammatical, positive and content-free — they are what
 * a generator reaches for when it has no evidence and will not admit it. The
 * list is the master brief's, and it is an `error` rather than a warning
 * because the honest alternative (a plain label, or nothing) always exists.
 */
const BOILERPLATE: readonly RegExp[] = [
  /\bwelcome to\b/i,
  /\bwe are passionate about\b/i,
  /\bwhether you(?:'|’re| are|re)? looking for\b/i,
  /\bdiscover (?:our|the|a)\b/i,
  /\bexperience excellence\b/i,
  /\byour trusted\b/i,
  /\bwhere quality meets\b/i,
  /\bsomething for everyone\b/i,
  /\bunparalleled\b/i,
  /\bstate[- ]of[- ]the[- ]art\b/i,
  /\bone[- ]stop[- ]shop\b/i,
  /\bnestled in the heart of\b/i,
  /\btake your .* to the next level\b/i,
];

/**
 * Claim shapes a page may not make without evidence behind them.
 *
 * Each pattern is a *kind* of fact — an award, a tenure, a certification, a
 * count of customers — and each is checked against the index of what the
 * business actually proved. The point is not to ban the words; a business that
 * really is award-winning may say so. The point is that the page cannot be the
 * first place the claim appears.
 */
const CLAIMS: readonly { readonly kind: string; readonly pattern: RegExp }[] = [
  { kind: 'an award', pattern: /\b(award[- ]winning|award|prize|michelin|premiat[ăa]?)\b/i },
  { kind: 'years in business', pattern: /\b(since \d{4}|for over \d+ years|est\.? ?\d{4}|din \d{4}|de peste \d+ ani)\b/i },
  { kind: 'a certification', pattern: /\b(certified|accredited|licen[cs]ed|iso ?\d+|certificat)\b/i },
  { kind: 'a customer count', pattern: /\b(\d[\d,.]{2,}\+? (?:customers|clients|guests|clienți|clienti))\b/i },
  { kind: 'a guarantee', pattern: /\b(guarantee[ds]?|warrant(?:y|ied)|garanție|garantie)\b/i },
  { kind: 'a superlative rank', pattern: /\b(best in|number one|no\.? ?1|#1|leading|cel mai bun)\b/i },
  { kind: 'a price', pattern: /(?:^|\s)(?:[$£€]\s?\d|\d+\s?(?:lei|eur|usd|gbp)\b)/i },
];

/** Headings that name a page's furniture rather than this business. */
const WEAK_HEADINGS: readonly string[] = [
  'about us', 'our services', 'services', 'gallery', 'photographs', 'photos',
  'welcome', 'home', 'more', 'info', 'information', 'details', 'overview',
];

/** Roughly how many words a beat may spend before it is padding. */
const VERBOSE_WORDS: Readonly<Partial<Record<NarrativeRole, number>>> = {
  emotion: 60, arrival: 60, signature: 140, reveal: 220, process: 220,
  breadth: 120, context: 80, conversion: 60, trust: 160, proof: 240, space: 120, coda: 60,
};

function words(value: string): number {
  return (value.match(/\S+/g) ?? []).length;
}

/** The shape of a sentence, for spotting a page written to one formula. */
function skeleton(sentence: string): string {
  const w = sentence.trim().split(/\s+/);
  return `${w.length <= 6 ? 'short' : w.length <= 14 ? 'mid' : 'long'}:${fold(w[0] ?? '')}:${fold(w[1] ?? '')}`;
}

export interface AuditInput {
  readonly content: WebsiteContent;
  readonly evidence: ContentEvidence;
  readonly roles: ReadonlyMap<number, NarrativeRole>;
  readonly conversion: ConversionStrategy;
}

/**
 * Audits the page's words.
 *
 * Every check answers one question a careful editor would ask, in the order
 * they would ask them: is anything here untrue, is anything here empty, does
 * each beat do its job, and does the page as a whole sound like this business
 * rather than like a generator.
 */
export function auditContent(input: AuditInput): ContentAudit {
  const { content, evidence: ev, roles, conversion } = input;
  const issues: ContentIssue[] = [];
  const add = (
    kind: ContentIssueKind,
    severity: 'error' | 'warning',
    index: number,
    message: string,
    quote: string,
  ): void => {
    issues.push({ kind, severity, index, message, quote: quote.trim().slice(0, 120) });
  };

  /*
   * The corpus of everything the business itself has said, folded for
   * comparison. A claim is "supported" when the words that make it appear
   * somewhere the research stage actually collected them.
   */
  const proven = fold([
    ev.name,
    ev.trade ?? '',
    ...ev.offerings,
    ...ev.amenities,
    ...ev.sentences.map((s) => s.text),
    ...ev.imageDescriptions,
    ev.rating === null ? '' : `${ev.rating}`,
    ev.reviewCount === null ? '' : `${ev.reviewCount}`,
  ].join(' \n '));

  let specific = 0;
  let headings = 0;
  const seenSentences = new Map<string, number>();
  const shapes = new Map<string, number>();
  const valueProps = new Map<string, number>();

  content.sections.forEach((section, index) => {
    const role = roles.get(index) ?? 'reveal';
    const authored = [section.heading, section.subheading ?? '', section.body].join('\n');
    const all = [authored, ...section.bullets].join('\n');

    /* --- fabrication ------------------------------------------------- */
    for (const claim of CLAIMS) {
      const match = claim.pattern.exec(all);
      if (match === null) continue;
      const phrase = fold(match[0]);
      if (proven.includes(phrase)) continue;
      add('unsupported-claim', 'error', index,
        `The ${section.kind} section claims ${claim.kind} that no evidence supports.`, match[0]);
    }

    /* --- boilerplate --------------------------------------------------- */
    for (const pattern of BOILERPLATE) {
      const match = pattern.exec(authored);
      if (match !== null) {
        add('boilerplate', 'error', index,
          `The ${section.kind} section uses empty marketing language.`, match[0]);
      }
    }

    /* --- headings ------------------------------------------------------ */
    const heading = section.heading.trim();
    if (heading !== '') {
      headings += 1;
      const folded = fold(heading);
      if (WEAK_HEADINGS.includes(folded)) {
        add('weak-heading', 'warning', index,
          `"${heading}" names a page's furniture rather than this business.`, heading);
      }
      // Built from the business's own words? Its own terms, offerings or name
      // appearing in the heading is the measurable version of "bespoke".
      const own = ev.offerings.some((o) => folded.includes(fold(o)))
        || ev.distinctiveTerms.slice(0, 20).some((t) => folded.includes(t))
        || folded.includes(fold(ev.shortName))
        || (ev.place !== null && folded.includes(fold(ev.place)));
      if (own) specific += 1;
    }

    /* --- the beat does its job ----------------------------------------- */
    if (section.bullets.length === 0 && section.body.trim() === '' && section.images.length === 0
      && section.callToAction === null && section.kind !== 'cta') {
      add('empty-section', 'error', index,
        `The ${section.kind} section renders as a heading with nothing under it.`, heading);
    }
    if (role === 'breadth' && section.bullets.length === 0 && section.body.trim() === '') {
      add('role-mismatch', 'error', index,
        'A breadth beat must show the range of what the business offers; this one lists nothing.', heading);
    }
    if (role === 'conversion' && section.callToAction === null && section.bullets.length === 0) {
      add('role-mismatch', 'error', index,
        'A conversion beat must give the visitor something to do; this one offers no action.', heading);
    }
    if (role === 'signature' && section.images.length === 0 && section.body.trim() === '' && section.bullets.length === 0) {
      add('role-mismatch', 'error', index,
        'The signature beat is the page\'s peak and carries neither imagery nor words.', heading);
    }

    /* --- CTA agrees with the strategy ----------------------------------- */
    const cta = section.callToAction;
    if (cta !== null) {
      const expected = new Set<string>([
        fold(ev.lexicon.cta[conversion.primaryCta]),
        fold(ev.lexicon.furniture.callToConfirm),
      ]);
      if (conversion.secondaryCta !== null) expected.add(fold(ev.lexicon.cta[conversion.secondaryCta]));
      if (cta.href.startsWith('tel:')) expected.add(fold(ev.lexicon.cta.call));
      if (cta.href.startsWith('mailto:')) expected.add(fold(ev.lexicon.cta.enquire));
      if (!expected.has(fold(cta.label))) {
        add('cta-mismatch', 'error', index,
          `The button says "${cta.label}" but the conversion strategy chose "${conversion.primaryCta}".`, cta.label);
      }
    }

    /* --- length --------------------------------------------------------- */
    const limit = VERBOSE_WORDS[role];
    if (limit !== undefined && words(section.body) > limit) {
      add('verbose', 'warning', index,
        `A ${role} beat runs to ${words(section.body)} words, past the ${limit} this beat can hold.`, section.body);
    }

    /* --- repetition ------------------------------------------------------ */
    for (const sentence of section.body.split(/(?<=[.!?])\s+/u)) {
      const trimmed = sentence.trim();
      if (trimmed.length < 25) continue;
      const key = fold(trimmed).replace(/\s+/g, ' ');
      const before = seenSentences.get(key);
      if (before !== undefined) {
        add('repeated-phrase', 'error', index,
          `This sentence already appears in section ${before}.`, trimmed);
      } else {
        seenSentences.set(key, index);
      }
      shapes.set(skeleton(trimmed), (shapes.get(skeleton(trimmed)) ?? 0) + 1);
    }

    const proposition = fold(`${heading} ${section.subheading ?? ''}`).replace(/\s+/g, ' ').trim();
    if (proposition.length >= 12) {
      const before = valueProps.get(proposition);
      if (before !== undefined) {
        add('duplicate-value-proposition', 'error', index,
          `The same proposition is made in section ${before}.`, proposition);
      } else {
        valueProps.set(proposition, index);
      }
    }
  });

  /* --- page-level ------------------------------------------------------- */
  for (const [shape, count] of shapes) {
    if (count >= 3) {
      add('repeated-structure', 'warning', -1,
        `${count} sentences share one structure (${shape}); the page reads as one formula.`, shape);
    }
  }

  const specificity = headings === 0 ? 0 : specific / headings;
  if (specificity === 0 && headings > 0) {
    add('no-business-evidence', 'error', -1,
      'No heading on the page is built from anything this business actually said or offers.', '');
  }

  /*
   * Terminology drift: the page should call the trade one thing.
   *
   * Three different words for what the business is, across headings, is how a
   * page written a section at a time reads — a restaurant that is also a
   * "bistro" and an "eatery" by the third screen.
   */
  const tradeWords = new Set<string>();
  if (ev.trade !== null) tradeWords.add(fold(ev.trade));
  if (ev.selfDescription !== null) tradeWords.add(fold(ev.selfDescription));
  if (tradeWords.size > 2) {
    add('inconsistent-terminology', 'warning', -1,
      `The page names the trade ${tradeWords.size} different ways.`, [...tradeWords].join(' / '));
  }

  const errors = issues.filter((issue) => issue.severity === 'error').length;
  const warnings = issues.length - errors;
  const score = Math.max(0, Math.min(100, Math.round(
    100 - errors * 25 - warnings * 5 + specificity * 10,
  )));

  return { ok: errors === 0, issues, score, specificity };
}
