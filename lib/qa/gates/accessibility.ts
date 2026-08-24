/**
 * Accessibility gate (Freeze N-12, P4-3).
 *
 * Three layers of evidence:
 *
 *   1. **DOM-derived checks** measured on the rendered page — landmarks, lang,
 *      image alt, heading structure. These need no library and run first.
 *   2. **Keyboard sweep** — the freeze names an "8-stop sweep": the tab order
 *      must reach the primary CTA, navigation, and content without trapping
 *      the focus. The evidence is a list of stops and whether each was
 *      reachable.
 *   3. **Rendered contrast** — measured *on the rendered page against the
 *      world-repainted ground*, i.e. computed colours, not declared ones.
 *      Contrast is asserted as WCAG AA (4.5:1 body, 3:1 large text).
 *   4. **axe-core results**, when present. `axe` is an M-12 devDependency;
 *      the gate consumes axe's `violations` array when a caller injects it,
 *      and treats its presence as blocking. Without axe injected, the
 *      DOM-derived checks still gate — the freeze's "fixture site with a known
 *      violation fails" must hold even with axe absent.
 *
 * The gate is pure: it receives evidence and returns a verdict. Collecting
 * the evidence is the browser's job, not this module's.
 */

const SOURCE = 'qa.gates.accessibility';

/** WCAG AA contrast floors: 4.5:1 body text, 3:1 large text. */
export const CONTRAST_BODY = 4.5;
export const CONTRAST_LARGE = 3.0;

/** One measured text contrast pair on the rendered page. */
export interface ContrastPair {
  readonly selector: string;
  readonly ratio: number;
  /** When true, the text is considered large (18pt+ or 14pt+ bold). */
  readonly large: boolean;
}

/** One stop in the keyboard sweep. */
export interface KeyboardStop {
  readonly index: number;
  /** Where the tab landed, e.g. `nav`, `a#main-content`, `a.button--primary`. */
  readonly target: string;
  /** Whether the stop was reachable and revealed focus. */
  readonly reachable: boolean;
  /** When false, what blocked it. */
  readonly reason?: string;
}

export interface AccessibilityEvidence {
  readonly hasMainLandmark: boolean;
  readonly hasSkipLink: boolean;
  readonly lang: string;
  readonly imagesMissingAlt: number;
  readonly totalImages: number;
  readonly headingGaps: readonly string[];
  readonly keyboard: readonly KeyboardStop[];
  readonly contrast: readonly ContrastPair[];
  /** axe-core `violations`, when a caller injected axe. Empty = no axe run. */
  readonly axeViolations?: readonly { readonly id: string; readonly impact: string; readonly nodes: readonly unknown[] }[];
}

export interface AccessibilityCheck {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface AccessibilityResult {
  readonly passed: boolean;
  readonly checks: readonly AccessibilityCheck[];
}

/**
 * Runs the accessibility gate over the collected evidence.
 *
 * A violation is blocking. The freeze's acceptance — "a fixture site with a
 * known violation fails; the current snapshot sites pass or their debt is
 * recorded" — is satisfied by `passed === false` on any blocking check.
 */
export function gateAccessibility(evidence: AccessibilityEvidence): AccessibilityResult {
  const checks: AccessibilityCheck[] = [];
  const add = (id: string, passed: boolean, detail: string): void => {
    checks.push({ id, passed, detail });
  };

  add('a11y.main-landmark', evidence.hasMainLandmark,
    evidence.hasMainLandmark ? 'main landmark present' : 'no <main> landmark');
  add('a11y.skip-link', evidence.hasSkipLink,
    evidence.hasSkipLink ? 'skip link present' : 'no skip link');
  add('a11y.lang', evidence.lang.trim() !== '',
    evidence.lang.trim() !== '' ? `lang="${evidence.lang}"` : 'missing lang attribute');
  add('a11y.image-alt', evidence.imagesMissingAlt === 0,
    evidence.imagesMissingAlt === 0 ? `all ${evidence.totalImages} images have alt` : `${evidence.imagesMissingAlt} of ${evidence.totalImages} images lack alt`);
  add('a11y.heading-order', evidence.headingGaps.length === 0,
    evidence.headingGaps.length === 0 ? 'heading structure is sequential' : evidence.headingGaps.join('; '));

  const keyboardBlocked = evidence.keyboard.filter((s) => !s.reachable);
  add('a11y.keyboard', keyboardBlocked.length === 0,
    keyboardBlocked.length === 0
      ? `keyboard sweep: all ${evidence.keyboard.length} stops reachable`
      : `keyboard trap at: ${keyboardBlocked.map((s) => `${s.target}${s.reason ? ` (${s.reason})` : ''}`).join('; ')}`);

  const failingContrast = evidence.contrast.filter((c) => c.ratio < (c.large ? CONTRAST_LARGE : CONTRAST_BODY));
  add('a11y.contrast', failingContrast.length === 0,
    failingContrast.length === 0
      ? `all ${evidence.contrast.length} measured pairs meet WCAG AA`
      : `contrast below AA at: ${failingContrast.map((c) => `${c.selector} (${c.ratio.toFixed(2)}:1)`).join('; ')}`);

  const seriousAxe = (evidence.axeViolations ?? []).filter((v) => v.impact === 'critical' || v.impact === 'serious');
  add('a11y.axe', seriousAxe.length === 0,
    seriousAxe.length === 0
      ? (evidence.axeViolations?.length ?? 0) === 0 ? 'no axe violations reported' : `${evidence.axeViolations?.length} minor axe violations`
      : `axe violations: ${seriousAxe.map((v) => v.id).join('; ')}`);

  return { passed: checks.every((c) => c.passed), checks };
}

export const SOURCE_NAME = SOURCE;