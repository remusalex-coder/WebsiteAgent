/**
 * Shared inspection utilities and the result-builder every check file uses.
 *
 * Nothing here decides policy — that stays in `checks/*.ts`, where each
 * check's applicability and pass/fail logic is legible on its own. This file
 * only makes the mechanical parts (finding a section, scanning for a
 * pattern, building a `CheckResult`) not worth repeating fifty times.
 */

import type {
  BusinessProfile,
  PageText,
  SectionKind,
  WebsiteSection,
} from '../types.js';
import type { Industry } from '../design/types.js';
import type {
  CheckCategory,
  CheckResult,
  CheckSeverity,
  PreflightContext,
} from './types.js';

/* ------------------------------------------------------------------ */
/* Result builder                                                      */
/* ------------------------------------------------------------------ */

export interface CheckBuilder {
  /** The evidence does not call for this check at all. */
  na(reason: string): CheckResult;
  pass(evidence: readonly string[]): CheckResult;
  fail(evidence: readonly string[], remediation: string): CheckResult;
  warn(evidence: readonly string[], remediation: string): CheckResult;
  /** Applicable, but the run does not yet carry what is needed to answer it. */
  blocked(evidence: readonly string[], remediation: string): CheckResult;
}

/**
 * One check's identity, bound once, reused across its `pass`/`fail`/... exits.
 *
 * `severity` is the check's inherent importance — the same value whichever
 * way the check comes out, so a report can be scanned for "what's critical
 * here" independent of which of those are currently failing.
 */
export function check(
  id: string,
  category: CheckCategory,
  title: string,
  severity: CheckSeverity,
): CheckBuilder {
  const base = { id, category, title, severity };
  return {
    na: (reason) => ({
      ...base,
      applicability: 'not_applicable',
      status: 'NOT_APPLICABLE',
      evidence: [reason],
      remediation: null,
    }),
    pass: (evidence) => ({
      ...base,
      applicability: 'applicable',
      status: 'PASS',
      evidence,
      remediation: null,
    }),
    fail: (evidence, remediation) => ({
      ...base,
      applicability: 'applicable',
      status: 'FAIL',
      evidence,
      remediation,
    }),
    warn: (evidence, remediation) => ({
      ...base,
      applicability: 'applicable',
      status: 'WARN',
      evidence,
      remediation,
    }),
    blocked: (evidence, remediation) => ({
      ...base,
      applicability: 'applicable',
      status: 'BLOCKED',
      evidence,
      remediation,
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Content inspection                                                  */
/* ------------------------------------------------------------------ */

export function sectionOf(ctx: PreflightContext, kind: SectionKind): WebsiteSection | null {
  return ctx.content.sections.find((section) => section.kind === kind) ?? null;
}

export function hasSection(ctx: PreflightContext, kind: SectionKind): boolean {
  return sectionOf(ctx, kind) !== null;
}

/** Every call to action in the content spec, section kind attached. */
export function callsToAction(
  ctx: PreflightContext,
): readonly { readonly kind: SectionKind; readonly label: string; readonly href: string }[] {
  return ctx.content.sections
    .filter((section) => section.callToAction !== null)
    .map((section) => ({
      kind: section.kind,
      label: section.callToAction?.label ?? '',
      href: section.callToAction?.href ?? '',
    }));
}

/** All prose in the content spec: tagline, SEO copy, and every section's text. */
export function allProse(ctx: PreflightContext): readonly string[] {
  const out: string[] = [ctx.content.tagline, ctx.content.seo.title, ctx.content.seo.description];
  for (const section of ctx.content.sections) {
    out.push(section.heading, section.subheading ?? '', section.body, ...section.bullets);
  }
  return out.filter((entry) => entry.trim() !== '');
}

/** Every image actually placed on the page, across all sections. */
export function allPlacedImages(ctx: PreflightContext): readonly { readonly kind: SectionKind; readonly alt: string | null }[] {
  const out: { kind: SectionKind; alt: string | null }[] = [];
  for (const section of ctx.content.sections) {
    for (const image of section.images) out.push({ kind: section.kind, alt: image.alt });
  }
  return out;
}

/** Full text of every page the collector actually read, concatenated once. */
export function profileText(profile: BusinessProfile): string {
  return profile.pages.map((page: PageText) => page.text).join('\n');
}

/**
 * Whether a claim's substance appears in the pages the collector actually
 * read. A loose containment check, not a fuzzy match — the point is to catch
 * a wholly invented sentence, not to grade paraphrase quality, and a stricter
 * check would punish honest rewording of a real fact.
 */
export function isGroundedInPages(claim: string, profile: BusinessProfile): boolean {
  const normalise = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const needle = normalise(claim);
  if (needle.length < 8) return false;
  const haystack = normalise(profileText(profile));
  if (haystack.includes(needle)) return true;

  // A long claim rarely appears byte-for-byte in scraped text once rewritten,
  // so a long claim is checked by its most distinctive run of words instead
  // of demanding the whole sentence match.
  const words = needle.split(' ').filter((word) => word.length > 2);
  if (words.length < 4) return haystack.includes(needle);

  const window = 6;
  for (let start = 0; start + window <= words.length; start += window) {
    const phrase = words.slice(start, start + window).join(' ');
    if (haystack.includes(phrase)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Rendered-output inspection                                          */
/* ------------------------------------------------------------------ */

export function hasFile(ctx: PreflightContext, pattern: RegExp): boolean {
  return ctx.site.files.some((file) => pattern.test(file.path));
}

export function countMatches(haystack: string, pattern: RegExp): number {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return [...haystack.matchAll(new RegExp(pattern.source, flags))].length;
}

/** Extracts the JSON-LD payload, un-escaping the renderer's `<`/`>`/`&` guards. */
export function extractJsonLd(html: string): Record<string, unknown> | null {
  const match = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  if (match?.[1] === undefined) return null;
  const unescaped = match[1]
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&');
  try {
    const parsed: unknown = JSON.parse(unescaped);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Business context                                                    */
/* ------------------------------------------------------------------ */

/** Industries where a visitor's next step is plausibly a real-world visit. */
export const PHYSICAL_VISIT_INDUSTRIES: ReadonlySet<Industry> = new Set([
  'bakery', 'restaurant', 'cafe', 'bar', 'hotel', 'gym', 'spa', 'beauty',
  'medical', 'dental', 'retail', 'automotive', 'construction',
]);

/** Industries where naming the people doing the work is part of the pitch. */
export const TEAM_RELEVANT_INDUSTRIES: ReadonlySet<Industry> = new Set([
  'law', 'medical', 'dental', 'beauty', 'spa', 'gym', 'professional-services', 'real-estate',
]);

/** Industries that sell an ongoing service relationship, not a single visit. */
export const SERVICE_SLA_INDUSTRIES: ReadonlySet<Industry> = new Set([
  'construction', 'automotive', 'law', 'professional-services',
]);

/** Industries where documented past work is a normal trust signal. */
export const CASE_STUDY_INDUSTRIES: ReadonlySet<Industry> = new Set([
  'law', 'professional-services', 'construction', 'real-estate',
]);

const ANALYTICS_PATTERNS: readonly RegExp[] = [
  /googletagmanager\.com/i,
  /google-analytics\.com/i,
  /gtag\(/i,
  /\bga\(['"]create/i,
  /plausible\.io/i,
  /fathom\.(io|com)/i,
  /cdn\.segment\.com/i,
  /static\.hotjar\.com/i,
  /clarity\.ms/i,
  /matomo\.(js|php)/i,
];

export function detectAnalytics(html: string): readonly string[] {
  return ANALYTICS_PATTERNS.filter((pattern) => pattern.test(html)).map((pattern) => pattern.source);
}

/** Vendors that run without a cookie and are widely treated as consent-exempt. */
const CONSENTLESS_ANALYTICS = [/plausible\.io/i, /fathom\.(io|com)/i];

export function analyticsNeedsConsent(html: string): boolean {
  const found = detectAnalytics(html);
  if (found.length === 0) return false;
  return !found.every((source) => CONSENTLESS_ANALYTICS.some((pattern) => pattern.source === source));
}

const CONSENT_MARKERS = [
  /cookie[- ]consent/i,
  /consent[- ]banner/i,
  /gdpr/i,
  /accept cookies/i,
  /cookie preferences/i,
  /\bconsent\s*:\s*['"]?default/i, // gtag consent-mode default call
];

export function hasConsentMechanism(html: string): boolean {
  return CONSENT_MARKERS.some((pattern) => pattern.test(html));
}

/* ------------------------------------------------------------------ */
/* Secret detection                                                    */
/* ------------------------------------------------------------------ */

/** Shapes of a credential a static site must never carry, regardless of vendor. */
const SECRET_PATTERNS: readonly [string, RegExp][] = [
  ['Anthropic API key', /sk-ant-[a-zA-Z0-9_-]{20,}/],
  ['OpenAI API key', /sk-[a-zA-Z0-9]{20,}/],
  ['Google API key', /AIza[0-9A-Za-z_-]{35}/],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{20,}/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{10,}/],
  ['generic bearer token', /Bearer [A-Za-z0-9._-]{20,}/],
  ['private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['JWT', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
];

/** Pattern-matched secrets in a blob of text. Empty when nothing matches. */
export function scanTextForSecretPatterns(text: string): readonly string[] {
  const findings: string[] = [];
  for (const [label, pattern] of SECRET_PATTERNS) {
    const match = pattern.exec(text);
    if (match !== null) findings.push(`${label} pattern matched: "${match[0].slice(0, 12)}…"`);
  }
  return findings;
}

/**
 * Literal configured-secret values found verbatim in a blob of text.
 *
 * Stronger than a pattern match: this checks the run's *actual* configured
 * credentials rather than a shape any string could accidentally match.
 */
export function scanTextForKnownValues(text: string, knownSecrets: ReadonlyMap<string, string>): readonly string[] {
  const findings: string[] = [];
  for (const [name, value] of knownSecrets) {
    if (value.trim().length >= 8 && text.includes(value)) {
      findings.push(`configured value of ${name} appears verbatim in the output`);
    }
  }
  return findings;
}
