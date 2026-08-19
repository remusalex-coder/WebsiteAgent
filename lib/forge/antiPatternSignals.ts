/**
 * Anti-pattern signal detectors — S-STATIC checks transcribed from
 * `docs/knowledge/ANTI_AI_SLOP.md` (research artifact, 2026-08-17), plus one
 * check this module adds itself: motion coherence against the intensity the
 * signature actually declared (`lib/forge/motion.ts`).
 *
 * Every check here reads only `code.html`/`code.css`/`code.js` as text — no
 * rendered geometry, no vision call. That is a deliberate, honest scope
 * limit: `ANTI_AI_SLOP.md`'s own S-LAYOUT signals (identical section
 * rhythms, predictable spacing) need computed geometry from a live page,
 * which `lib/forge/anti-ai-gate.ts` runs *before* `captureSite` — adding
 * those would mean moving part of this gate to run post-capture, which is a
 * real architectural change, not a same-shape extension, and is out of
 * scope for this pass (see `PROJECT_STATUS.md`'s "next bottleneck" note).
 *
 * Not every A-nn entry in the source document is implemented. Only the ones
 * that are (a) cheaply and reliably detectable from source text alone, and
 * (b) not already covered by an existing check, are included — adding a
 * check for its own sake, uncalibrated, would just be a new source of
 * false positives of exactly the kind this session's other fix (the old
 * `GENERIC_SIMILARITY_FAIL`) already cost a whole session to find and undo.
 */

import type { ExperienceBlueprint, ExperienceStrategy, GeneratedCode } from './types.js';
import { motionContractFor, DURATION_BANDS_MS } from './motion.js';

export interface AntiPatternFlag {
  readonly code: string;
  readonly severity: 'fail' | 'warning' | 'info';
  readonly message: string;
  readonly evidence?: string;
}

const GENERIC_PHRASES: readonly string[] = [
  'seamless', 'elevate your', 'unlock', 'cutting-edge', 'state-of-the-art',
  'tailored to your needs', 'we believe', 'passionate about', 'take it to the next level',
];

const PREMIUM_WORDS: readonly string[] = [
  'premium', 'luxury', 'elevate', 'exceptional', 'finest', 'exquisite', 'unparalleled', 'world-class',
];

const BADGE_MARKERS = /[✨\u{1F680}\u{1F389}]/u; // ✨ 🚀 🎉

/**
 * `ANTI_AI_SLOP.md`'s S-STATIC anti-pattern checks this gate can honestly
 * run pre-capture. Each flag names its source A-nn id.
 */
export function checkAntiPatternSignals(code: GeneratedCode, blueprint: ExperienceBlueprint): AntiPatternFlag[] {
  const html = code.html;
  const css = code.css;
  const flags: AntiPatternFlag[] = [];

  // A-02 — Excessive gradients
  const gradientCount = (css.match(/(linear-gradient|radial-gradient|conic-gradient)\(/gi) ?? []).length;
  if (gradientCount > 3) {
    flags.push({
      code: 'A-02',
      severity: 'warning',
      message: `${gradientCount} gradient declarations found; more than 3 is the generic-AI-site tell (ANTI_AI_SLOP A-02).`,
    });
  }

  // A-06 — Unnecessary badges (decorative emoji as a substitute for a real trust signal)
  if (BADGE_MARKERS.test(html)) {
    flags.push({
      code: 'A-06',
      severity: 'warning',
      message: 'Decorative badge emoji (✨🚀🎉) found in markup — a real trust signal or nothing (ANTI_AI_SLOP A-06).',
    });
  }

  // A-07 — Fake statistics (a blocking check in the source document, not a warning).
  //
  // Narrowed to numbers sitting near a trust/scale claim word ("clients",
  // "years", "rating", …) — a bare percentage is not evidence of anything
  // by itself. Found via this check's own test run against the real
  // Ridgeway fixture: an unscoped version flagged "32% Remaining Integrity"
  // on a diagnostic health-bar gauge — a legitimate interactive-tool demo
  // reading, not a marketing trust-stat — as a fake statistic. The
  // anti-pattern this guards against is specifically an unverified claim
  // about the business's own scale or reputation.
  const TRUST_CLAIM_WINDOW = 60;
  const TRUST_CLAIM_WORDS = /client|customer|year|project|satisfaction|rating|review|trusted|served|happy|guarantee|success stor|star\b/i;
  const statMatches = [...html.matchAll(/\b(\d{1,4}(?:,\d{3})*)\s*(\+|%)/g)]
    .filter((m) => {
      const start = Math.max(0, (m.index ?? 0) - TRUST_CLAIM_WINDOW);
      const end = Math.min(html.length, (m.index ?? 0) + (m[0]?.length ?? 0) + TRUST_CLAIM_WINDOW);
      return TRUST_CLAIM_WORDS.test(html.slice(start, end));
    })
    .map((m) => (m[1] ?? '').replace(/,/g, ''));
  if (statMatches.length >= 3) {
    const evidenceText = blueprint.factualDossier.verifiedFacts.map((f) => f.claim).join(' ');
    const unverified = statMatches.filter((n) => !evidenceText.includes(n));
    if (unverified.length >= 3) {
      flags.push({
        code: 'A-07',
        severity: 'fail',
        message: `${unverified.length} trust/scale claims (${unverified.slice(0, 5).join(', ')}) appear in the page with no matching verified fact. Fake statistics are a blocking defect, not a style note (ANTI_AI_SLOP A-07).`,
        evidence: unverified.join(', '),
      });
    }
  }

  // A-08 — Generic copy
  const genericMatches = GENERIC_PHRASES.filter((phrase) => html.toLowerCase().includes(phrase));
  if (genericMatches.length >= 2) {
    flags.push({
      code: 'A-08',
      severity: 'warning',
      message: `Generic-copy phrases found: ${genericMatches.join(', ')} (ANTI_AI_SLOP A-08).`,
    });
  }

  // A-11 — Repeated CTAs
  const buttonTexts = [...html.matchAll(/<(?:button|a)[^>]*class="[^"]*(?:btn|button|cta)[^"]*"[^>]*>([^<]{1,40})</gi)]
    .map((m) => (m[1] ?? '').trim().toLowerCase())
    .filter((t) => t.length > 0);
  const textCounts = new Map<string, number>();
  for (const t of buttonTexts) textCounts.set(t, (textCounts.get(t) ?? 0) + 1);
  const repeatedCtas = [...textCounts.entries()].filter(([, count]) => count > 2);
  if (repeatedCtas.length > 0) {
    flags.push({
      code: 'A-11',
      severity: 'warning',
      message: `Identical call-to-action text repeated more than twice: ${repeatedCtas.map(([t, n]) => `"${t}"×${n}`).join(', ')} (ANTI_AI_SLOP A-11).`,
    });
  }

  // A-13 — Meaningless animation (proxy: one keyframe reused indiscriminately)
  const keyframeNames = new Set([...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]));
  const animationDeclarations = (css.match(/animation(?:-name)?:\s*[\w-]+/g) ?? []).length;
  if (keyframeNames.size === 1 && animationDeclarations > 5) {
    flags.push({
      code: 'A-13',
      severity: 'info',
      message: `A single @keyframes rule is reused across ${animationDeclarations} declarations — every element moving the same way, regardless of what it is, is decoration rather than meaning (ANTI_AI_SLOP A-13).`,
    });
  }

  // A-16 — Excessive "premium" language
  const premiumCount = PREMIUM_WORDS.reduce((sum, word) => sum + (html.match(new RegExp(word, 'gi')) ?? []).length, 0);
  if (premiumCount > 5) {
    flags.push({
      code: 'A-16',
      severity: 'warning',
      message: `Premium/luxury adjectives appear ${premiumCount} times — language standing in for a claim rather than a verified one (ANTI_AI_SLOP A-16).`,
    });
  }

  // A-19 — Unnecessary 3D: cross-checked against the signature's own declared requirement,
  // not a static keyword count alone — this is the check that makes experienceStrategy.requires3D
  // more than a field nobody reads.
  const has3DCode = /three\.js|babylonjs|react-three-fiber|getContext\(\s*['"]webgl/i.test(code.js);
  if (has3DCode && !blueprint.signature.experienceStrategy.requires3D) {
    flags.push({
      code: 'A-19',
      severity: 'fail',
      message: '3D/WebGL code is present in the generated JavaScript, but experienceStrategy.requires3D is false — 3D was never declared as evidence-justified for this build (ANTI_AI_SLOP A-19).',
    });
  }

  return flags;
}

/** How far a declared duration may exceed the widest allowed band before it is flagged, in ms — accommodates rounding, not a second permitted band. */
const DURATION_TOLERANCE_MS = 20;

function parseCssDurationsMs(css: string): number[] {
  const values: number[] = [];
  for (const match of css.matchAll(/(?:transition-duration|animation-duration)\s*:\s*([\d.]+)(ms|s)\b/gi)) {
    const raw = parseFloat(match[1] ?? '0');
    const unit = (match[2] ?? 'ms').toLowerCase();
    values.push(unit === 's' ? raw * 1000 : raw);
  }
  return values;
}

/**
 * Checks the generated CSS's declared durations against the motion
 * contract for the signature's own declared `motionIntensity` — the
 * enforcement half of `lib/forge/motion.ts`'s "one shared contract, not
 * per-component invention". A build that claims `motionIntensity: "none"`
 * and then ships animated transitions is inconsistent with its own
 * signature, which is exactly the kind of unverifiable claim the rest of
 * this gate exists to catch elsewhere.
 */
export function checkMotionCoherence(code: GeneratedCode, experienceStrategy: ExperienceStrategy): AntiPatternFlag[] {
  const contract = motionContractFor(experienceStrategy.motionIntensity);
  const durations = parseCssDurationsMs(code.css);
  if (durations.length === 0) return [];

  if (contract.allowedDurationBands.length === 0) {
    return [{
      code: 'MOTION_INCOHERENT',
      severity: 'fail',
      message: `experienceStrategy.motionIntensity is "none" (no animated transitions), but the CSS declares ${durations.length} timed transition/animation duration(s). The build does not match its own declared motion strategy.`,
      evidence: durations.map((d) => `${d}ms`).join(', '),
    }];
  }

  const ceilingMs = Math.max(...contract.allowedDurationBands.map((band) => DURATION_BANDS_MS[band][1]));
  const offenders = durations.filter((d) => d > ceilingMs + DURATION_TOLERANCE_MS);
  if (offenders.length === 0) return [];

  return [{
    code: 'MOTION_INCOHERENT',
    severity: 'warning',
    message: `${offenders.length} declared duration(s) exceed the ${ceilingMs}ms ceiling for motionIntensity "${experienceStrategy.motionIntensity}" (${offenders.map((d) => `${d}ms`).join(', ')}). Durations must come from the motion contract, not be invented per component.`,
    evidence: offenders.map((d) => `${d}ms`).join(', '),
  }];
}

/** Where a motion library's call syntax and its expected CDN filename both live, for one library. */
interface LibraryUsageCheck {
  readonly name: string;
  readonly usage: RegExp;
  readonly srcHint: RegExp;
}

const MOTION_LIBRARY_USAGE: readonly LibraryUsageCheck[] = [
  { name: 'GSAP', usage: /\bgsap\s*\./, srcHint: /gsap/i },
  { name: 'ScrollTrigger', usage: /\bScrollTrigger\s*\./, srcHint: /scrolltrigger/i },
  { name: 'Lenis', usage: /\bnew\s+Lenis\s*\(/, srcHint: /lenis/i },
];

/**
 * Checks that any motion-library call in the generated JS is backed by a
 * matching CDN `<script>` tag in the generated HTML. `motionContractPrompt`
 * tells the model explicitly: "never claim a library is present without
 * actually loading it" — this is the enforcement half of that instruction,
 * mirroring A-19's "declared vs. actually justified" shape but for the
 * opposite failure direction (code that assumes a library it never loaded,
 * rather than code that adds one nothing asked for).
 *
 * This never requires a library to be used at any intensity — motion.ts's
 * library guidance is a recommendation the signature may or may not act on
 * (`experienceStrategy.motionIntensity` decides that from evidence, and
 * "none"/"subtle" recommend no library at all). It only catches the one
 * thing that is not a style disagreement but an actual runtime bug: calling
 * something that was never loaded, which throws a `ReferenceError` the
 * moment the page runs — a functional defect, not cosmetic drift, which is
 * why this fails rather than warns.
 */
export function checkMotionLibraryUsage(code: GeneratedCode): AntiPatternFlag[] {
  const scriptSrcs = [...code.html.matchAll(/<script[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi)]
    .map((m) => m[1] ?? '')
    .join(' ');

  const flags: AntiPatternFlag[] = [];
  for (const { name, usage, srcHint } of MOTION_LIBRARY_USAGE) {
    if (usage.test(code.js) && !srcHint.test(scriptSrcs)) {
      flags.push({
        code: 'MOTION_LIBRARY_UNLOADED',
        severity: 'fail',
        message: `experience.js calls ${name} but no matching CDN <script> tag was found in index.html — this throws a ReferenceError on load, not merely a style disagreement.`,
        evidence: name,
      });
    }
  }
  return flags;
}
