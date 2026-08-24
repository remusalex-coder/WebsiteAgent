/**
 * Functional + security gate (Freeze N-11, P4-4).
 *
 * Promoted from `scripts/publish-run.ts:254-302`, where these were collected
 * and reported but never gated delivery. The freeze names the three fields
 * that were collected-but-unasserted — `dataUrls`, `iframes`,
 * `formsWithoutAction` — and requires them to be asserted, plus a CSP
 * assertion. This module is those checks as blocking gates.
 *
 * The inspection itself is deliberately owned elsewhere (`lib/browser`), so
 * this module is pure: it takes the collected evidence and returns a verdict.
 * That keeps it unit-testable without a browser and without re-implementing
 * the capture technique the freeze forbids altering.
 */

const SOURCE = 'qa.gates.technical';

/** The evidence collected from one page, mirroring `publish-run.ts`. */
export interface SecurityEvidence {
  readonly inlineEventHandlers: readonly string[];
  readonly javascriptUrls: readonly string[];
  readonly dataUrls: readonly string[];
  readonly insecureHttpResources: readonly string[];
  readonly externalLinksWithoutNoopener: readonly string[];
  readonly scriptTags: number;
  readonly externalScripts: readonly string[];
  /**
   * The `src` of every `<iframe>` on the page, one entry per iframe, exactly
   * as found (not deduplicated, not resolved) — the shape a real origin
   * check needs. Was a bare `number` (Freeze N-11/P4-4's original shape,
   * "iframes: 0" was the entire assertion); widened to carry enough evidence
   * for `security.no-unapproved-iframes` below to check *which* origin, not
   * merely *whether one exists*, so a reviewed, approved embed (an
   * OpenStreetMap map, `lib/render/sections.ts`'s location section) does not
   * have to trip the same alarm as an arbitrary third-party iframe. The
   * default posture is unchanged: an empty or unparseable `src`, or any
   * origin not in `APPROVED_IFRAME_ORIGINS`, still fails exactly like every
   * iframe did before this widening.
   */
  readonly iframes: readonly string[];
  readonly formsWithoutAction: number;
  /** Whether the page or its headers declared a Content Security Policy. */
  readonly contentSecurityPolicy: string | null;
}

/**
 * Iframe origins this pipeline has explicitly reviewed and approved to
 * embed. A deliberate, reviewed allow-list — never something a business's
 * own content or a generated site's data can extend. OpenStreetMap's embed
 * endpoint is the first and, as of this pass, only entry: it is the one
 * iframe this renderer can actually emit (the location-section map,
 * `lib/render/sections.ts`), it ships no tracking script of its own, and its
 * embed URL shape is documented and stable.
 */
export const APPROVED_IFRAME_ORIGINS: readonly string[] = ['https://www.openstreetmap.org'];

/** `null` for a relative or malformed `src` — never treated as approved. */
function iframeOrigin(src: string): string | null {
  try {
    return new URL(src).origin;
  } catch {
    return null;
  }
}

export interface FunctionalEvidence {
  readonly pageErrors: readonly string[];
  readonly consoleErrors: readonly string[];
  readonly failedRequests: readonly string[];
}

export interface GateCheck {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface TechnicalGateResult {
  readonly passed: boolean;
  readonly checks: readonly GateCheck[];
}

export function gateFunctionalSecurity(
  functional: FunctionalEvidence,
  security: SecurityEvidence,
): TechnicalGateResult {
  const checks: GateCheck[] = [];
  const add = (id: string, passed: boolean, detail: string): void => {
    checks.push({ id, passed, detail });
  };

  add('page.no-errors', functional.pageErrors.length === 0,
    functional.pageErrors.length === 0 ? 'no uncaught page errors' : functional.pageErrors.join('; '));
  add('page.no-console-errors', functional.consoleErrors.length === 0,
    functional.consoleErrors.length === 0 ? 'console clean' : functional.consoleErrors.join('; '));
  add('page.no-failed-requests', functional.failedRequests.length === 0,
    functional.failedRequests.length === 0 ? 'every request resolved' : functional.failedRequests.join('; '));

  add('security.no-inline-handlers', security.inlineEventHandlers.length === 0,
    `${security.inlineEventHandlers.length} inline on* attributes`);
  add('security.no-javascript-urls', security.javascriptUrls.length === 0,
    `${security.javascriptUrls.length} javascript: hrefs`);
  // P4-4: data: URLs were collected but never asserted. An anchor that ships
  // base64 is a smuggling surface; assert it.
  add('security.no-data-urls', security.dataUrls.length === 0,
    `${security.dataUrls.length} data: hrefs`);
  add('security.no-mixed-content', security.insecureHttpResources.length === 0,
    `${security.insecureHttpResources.length} http:// subresources`);
  add('security.external-links-noopener', security.externalLinksWithoutNoopener.length === 0,
    `${security.externalLinksWithoutNoopener.length} target=_blank without rel=noopener`);
  add('security.no-external-scripts', security.externalScripts.length === 0,
    `${security.externalScripts.length} third-party scripts (${security.scriptTags} script tags total)`);
  // P4-4: iframes were collected but never asserted. Widened from a bare
  // zero-tolerance count to an allow-listed-origin check (see
  // APPROVED_IFRAME_ORIGINS above) — the default posture (no iframe passes
  // unless explicitly approved) is unchanged; only a reviewed origin can now
  // pass at all, instead of nothing ever could.
  const unapprovedIframes = security.iframes.filter((src) => {
    const origin = iframeOrigin(src);
    return origin === null || !APPROVED_IFRAME_ORIGINS.includes(origin);
  });
  add('security.no-unapproved-iframes', unapprovedIframes.length === 0,
    unapprovedIframes.length === 0
      ? `${security.iframes.length} iframes, all from approved origins`
      : `${unapprovedIframes.length} of ${security.iframes.length} iframes are not from an approved origin: ${unapprovedIframes.join(', ')}`);
  // P4-4: forms without an action were collected but never asserted — a form
  // that submits nowhere is a broken interaction surface.
  add('security.forms-have-action', security.formsWithoutAction === 0,
    `${security.formsWithoutAction} forms without an action`);
  // P4-4: CSP assertion — no inline scripting without a policy that frames it.
  const cspAbsent = security.contentSecurityPolicy === null || security.contentSecurityPolicy.trim() === '';
  const needsCsp = security.inlineEventHandlers.length > 0 || security.externalScripts.length > 0;
  add('security.content-security-policy', !(cspAbsent && needsCsp),
    cspAbsent && needsCsp ? 'inline/scripted page ships without a Content-Security-Policy' : `CSP: ${security.contentSecurityPolicy?.slice(0, 60) ?? 'none needed'}`);

  return { passed: checks.every((c) => c.passed), checks };
}

export const SOURCE_NAME = SOURCE;