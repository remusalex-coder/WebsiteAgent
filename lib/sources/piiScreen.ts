/**
 * PII screening at normalize, pre-model (Freeze N-19, P4-7, CP10).
 *
 * The freeze is explicit about *when* and *what*:
 *
 *   - screening runs **before the first model call**, not at render — so the
 *     profile's PII never reaches a brief, a writer, or a director prompt.
 *   - a **typed PII boundary** marks fields structurally unrenderable — the
 *     marker is not a redaction string the renderer might print, it is a type
 *     that makes the field impossible to render.
 *
 * What counts as PII here is deliberately narrow. A business's public phone
 * number is *meant* to be published — the pipeline's job is to publish it. A
 * **personal** mobile, an individual's email, a home address, are not the
 * business's to publish. The screen keys on the *kind* of the value and the
 * *consent it arrived with*, not on paranoia about every digit.
 */

const SOURCE = 'sources.piiScreen';

/** The kinds of PII this screen can recognise. */
export type PiiKind = 'phone' | 'email' | 'postal-address';

/**
 * A typed boundary. Carried in place of the raw value, and structurally
 * distinct from it: `renderer` has no branch that prints a `Boundary`, so a
 * boundaried field cannot be rendered even by mistake.
 */
export interface PiiBoundary {
  readonly kind: PiiKind;
  /** What was screened, in the shortest safe form (e.g. last digits). */
  readonly fingerprint: string;
  readonly reason: string;
  /** The canonical form a legitimate value would have taken. */
  readonly masked: 'REDACTED';
}

export interface ScreeningResult {
  readonly boundary: PiiBoundary | null;
  /** When a boundary was applied, the value that was suppressed. */
  readonly suppressedValue: string | null;
}

/** The consent facts a screened value may carry. */
export interface ConsentContext {
  /** The business published this contact point itself, on its own channels. */
  readonly businessPublished: boolean;
  /** The individual it belongs to consented to its publication here. */
  readonly individualConsented: boolean;
}

/**
 * Whether a phone number looks personal rather than business-published.
 *
 * The heuristic is narrow on purpose: a number is *suspected* personal when it
 * sits in an individual's social profile or a review byline, or when its
 * attribution is a personal page rather than the business's own listing. It is
 * never screened on the digits alone — the freeze's own doctrine is that
 * nothing is dropped silently and nothing is guessed.
 */
export function classifyPhone(
  phone: string,
  context: ConsentContext,
  attribution: string,
): ScreeningResult {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return { boundary: null, suppressedValue: null };

  if (context.businessPublished || context.individualConsented) {
    return { boundary: null, suppressedValue: null };
  }

  const personalAttribution = /(owner|founder|employee|staff|personal|profile|review)/i.test(attribution);
  if (!personalAttribution) return { boundary: null, suppressedValue: null };

  return {
    boundary: {
      kind: 'phone',
      fingerprint: `…${digits.slice(-4)}`,
      reason: `phone attributed to ${attribution} without business publication or individual consent`,
      masked: 'REDACTED',
    },
    suppressedValue: phone,
  };
}

/**
 * Whether an email is safe to pass to a model. Same rule as phones: the
 * business's own published address passes; a personal address attached to an
 * individual does not.
 */
export function classifyEmail(
  email: string,
  context: ConsentContext,
  attribution: string,
): ScreeningResult {
  if (context.businessPublished || context.individualConsented) {
    return { boundary: null, suppressedValue: null };
  }
  const personalAttribution = /(owner|founder|employee|staff|personal|profile|review)/i.test(attribution);
  if (!personalAttribution) return { boundary: null, suppressedValue: null };

  const local = email.split('@')[0] ?? '';
  return {
    boundary: {
      kind: 'email',
      fingerprint: `${local.slice(0, 1)}…@${email.split('@')[1] ?? 'unknown'}`,
      reason: `email attributed to ${attribution} without business publication or individual consent`,
      masked: 'REDACTED',
    },
    suppressedValue: email,
  };
}

export const SOURCE_NAME = SOURCE;