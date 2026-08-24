/**
 * Layout audit — QA that measures the rendered page instead of judging the spec.
 *
 * ## Why this exists
 *
 * The distinctness gate scores `WebsiteDesign` and `WebsiteContent`: whether the
 * concept is explainable, specific, coherent, and unlike its peers. Those are
 * real questions and it answers them well — but they are all questions about the
 * *plan*. A page whose sections overlap, whose content sits outside the viewport,
 * or which paints nothing below the hero scores exactly as highly as one that
 * renders correctly, because none of that is visible in the JSON.
 *
 * That is not hypothetical. A Sibiu bakery run rendered its hero and then 3,700px
 * of empty cream, and the gate scored it **99 and PASSED**. The only component
 * that could have seen it was the Visual Critic, which was degraded to
 * `uncertain` that day — so nothing in the loop was looking at the page at all.
 *
 * ## Why it is deterministic rather than a vision call
 *
 * Overlap and overflow are geometry. A model asked to spot them is slower, costs
 * money, answers differently on identical input, and — as that run showed —
 * fails open when the vendor truncates its JSON. `getBoundingClientRect` cannot
 * fail open. The Visual Critic still owns everything geometry cannot see (taste,
 * hierarchy, whether the page looks generic); this owns the defects that are
 * measurable, and reports them as blocking.
 *
 * ## Measurement and judgement are separate on purpose
 *
 * `measureLayout` runs in the page and only *reads* geometry. `classifyLayout`
 * is a pure function over that reading. The rules are therefore unit-testable
 * without launching a browser, which is what keeps them honest — a threshold
 * nobody can test is a threshold nobody will change.
 */

import { chromium } from 'playwright';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Logger } from '../logger.js';

/** The two viewports the production loop already shoots. */
export const AUDIT_VIEWPORTS = [
  { viewport: 'desktop' as const, width: 1440, height: 900 },
  { viewport: 'mobile' as const, width: 390, height: 844 },
];

export type LayoutViewport = 'desktop' | 'mobile';

export type LayoutFindingKind =
  | 'overlap'
  | 'horizontal-overflow'
  | 'blank-band'
  | 'collapsed-section'
  | 'offscreen-content';

export interface LayoutFinding {
  readonly kind: LayoutFindingKind;
  /** `blocking` fails the gate. `warning` is recorded and delivered anyway. */
  readonly severity: 'blocking' | 'warning';
  readonly viewport: LayoutViewport;
  /** One sentence naming what is wrong and where, for the repair brief. */
  readonly detail: string;
}

/** One element's geometry, as read in the page. */
export interface MeasuredBox {
  readonly label: string;
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
  /** Whether this box carries visible text or is an image. */
  readonly inked: boolean;
}

export interface LayoutMeasurement {
  readonly viewport: LayoutViewport;
  readonly width: number;
  readonly height: number;
  readonly scrollWidth: number;
  readonly scrollHeight: number;
  readonly sections: readonly MeasuredBox[];
  /** Elements whose painted content extends past the viewport's right edge. */
  readonly overflowing: readonly MeasuredBox[];
  /** Ink-bearing boxes anywhere on the page, used for the blank-band sweep. */
  readonly ink: readonly MeasuredBox[];
}

/* ------------------------------------------------------------------ */
/* Thresholds                                                          */
/* ------------------------------------------------------------------ */

/**
 * Sub-pixel layout rounding is normal; a real overflow is not two pixels.
 * Browsers routinely report a `scrollWidth` one or two greater than the
 * viewport for a page that has no horizontal scrollbar at all.
 */
const OVERFLOW_TOLERANCE_PX = 2;

/**
 * How much two sections must intersect before it counts.
 *
 * Adjacent sections legitimately share an edge, and a decorative element may be
 * deliberately pulled a little into its neighbour. A fifth of the smaller
 * section's height is past anything a designer does on purpose.
 */
const OVERLAP_RATIO = 0.2;

/** Below this a section did not render; it collapsed. */
const COLLAPSED_SECTION_PX = 24;

/**
 * A band this tall with no ink in it is a hole in the page.
 *
 * One viewport-height is the unit that matters: it is exactly the amount of
 * nothing a visitor can be looking at while believing the page has ended.
 */
const BLANK_BAND_RATIO = 1;

/* ------------------------------------------------------------------ */
/* Measurement (runs in the page)                                      */
/* ------------------------------------------------------------------ */

/**
 * The reader, as a plain-JS source string.
 *
 * Passed to `page.evaluate` as a string rather than a function on purpose: tsx
 * compiles this module through esbuild, which rewrites named function bindings
 * to reference its `__name` helper. That helper does not exist in the page, and
 * the whole call fails with `__name is not defined` — which is exactly how the
 * first version of the screenshot fix broke. A string is never instrumented.
 */
const MEASURE_SOURCE = `(() => {
  const doc = document.documentElement;
  const vw = window.innerWidth;

  const labelOf = (el) => {
    const role = el.dataset && el.dataset.role ? '[' + el.dataset.role + ']' : '';
    const cls = typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/)[0] : '';
    return (el.tagName.toLowerCase() + cls + role).slice(0, 60);
  };

  const boxOf = (el, inked) => {
    const r = el.getBoundingClientRect();
    return {
      label: labelOf(el),
      top: Math.round(r.top + window.scrollY),
      left: Math.round(r.left + window.scrollX),
      width: Math.round(r.width),
      height: Math.round(r.height),
      inked: inked,
    };
  };

  const isPainted = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (Number(cs.opacity) < 0.05) return false;
    return true;
  };

  const sections = [];
  for (const el of doc.querySelectorAll('section')) {
    if (!isPainted(el)) continue;
    sections.push(boxOf(el, true));
  }

  const ink = [];
  for (const el of doc.querySelectorAll('h1,h2,h3,h4,p,li,a,button,img,figure,picture,svg,input,label,td,th,span')) {
    if (!isPainted(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    const isImage = el.tagName === 'IMG' || el.tagName === 'SVG' || el.tagName === 'PICTURE' || el.tagName === 'FIGURE';
    const hasText = (el.textContent || '').trim().length > 0;
    if (!isImage && !hasText) continue;
    ink.push(boxOf(el, true));
  }

  const overflowing = [];
  for (const el of doc.querySelectorAll('*')) {
    if (!isPainted(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.right > vw + 2) overflowing.push(boxOf(el, true));
  }

  return {
    width: vw,
    height: window.innerHeight,
    scrollWidth: doc.scrollWidth,
    scrollHeight: doc.scrollHeight,
    sections: sections,
    ink: ink,
    overflowing: overflowing.slice(0, 25),
  };
})()`;

/**
 * Walks the page, then holds every section revealed, before anything is measured.
 *
 * Both halves matter. Walking fires the scroll-driven reveals and any deferred
 * loading, so the page is measured in a state a visitor actually reaches rather
 * than its unscrolled initial one. Pinning `--forge-vis` open afterwards is
 * what makes the reading *stable*: the reveal drives
 * `translateY((1 - --forge-vis) * -8%)`, so a section left at 0 is measured 8%
 * of its own height away from where it sits when read — which would invent
 * overlaps that no visitor can see and, worse, hide real ones.
 *
 * Kept in step with `SETTLE_FOR_CAPTURE` in `lib/workflow/runJob.ts` on
 * purpose: the audit and the screenshots must describe the same page, or a
 * finding here cannot be checked against the image beside it.
 */
const SETTLE_SOURCE = `(async () => {
  for (const img of Array.from(document.images)) img.removeAttribute('loading');
  await Promise.all(Array.from(document.images).map((i) => (i.complete ? null : i.decode().catch(() => null))));
  const step = window.innerHeight;
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
  }
  window.scrollTo(0, 0);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
  document.documentElement.style.setProperty('--forge-scroll', '1');
  for (const section of document.querySelectorAll('section')) {
    section.style.setProperty('--forge-vis', '1');
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
})()`;

/* ------------------------------------------------------------------ */
/* Judgement (pure)                                                    */
/* ------------------------------------------------------------------ */

/** Vertical overlap of two boxes, in pixels. */
function verticalOverlap(a: MeasuredBox, b: MeasuredBox): number {
  return Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
}

/** Horizontal overlap of two boxes, in pixels. */
function horizontalOverlap(a: MeasuredBox, b: MeasuredBox): number {
  return Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
}

/**
 * Turns one viewport's reading into findings.
 *
 * Pure, so every rule here is testable against a literal measurement.
 */
export function classifyLayout(m: LayoutMeasurement): readonly LayoutFinding[] {
  const findings: LayoutFinding[] = [];
  const at = (detail: string, kind: LayoutFindingKind, severity: LayoutFinding['severity']): void => {
    findings.push({ kind, severity, viewport: m.viewport, detail });
  };

  // 1. Responsive failure: the page is wider than the screen it is on.
  if (m.scrollWidth > m.width + OVERFLOW_TOLERANCE_PX) {
    const worst = [...m.overflowing].sort((a, b) => b.left + b.width - (a.left + a.width))[0];
    at(
      `page scrolls horizontally: content is ${m.scrollWidth}px wide in a ${m.width}px viewport` +
        (worst === undefined ? '' : `; widest offender is ${worst.label} reaching ${worst.left + worst.width}px`),
      'horizontal-overflow',
      'blocking',
    );
  }

  // 2. Sections that landed on top of each other.
  for (let i = 0; i < m.sections.length; i += 1) {
    for (let j = i + 1; j < m.sections.length; j += 1) {
      const a = m.sections[i]!;
      const b = m.sections[j]!;
      const vertical = verticalOverlap(a, b);
      if (vertical <= 0 || horizontalOverlap(a, b) <= 0) continue;
      // A section fully containing another is nesting, not collision.
      const nested = a.top <= b.top && a.top + a.height >= b.top + b.height;
      if (nested) continue;
      const smaller = Math.min(a.height, b.height);
      if (smaller > 0 && vertical / smaller >= OVERLAP_RATIO) {
        at(
          `sections overlap by ${Math.round(vertical)}px: ${a.label} and ${b.label}`,
          'overlap',
          'blocking',
        );
      }
    }
  }

  // 3. Sections that rendered to nothing.
  for (const section of m.sections) {
    if (section.height < COLLAPSED_SECTION_PX) {
      at(`section ${section.label} collapsed to ${section.height}px tall`, 'collapsed-section', 'blocking');
    }
  }

  // 4. Holes: a full viewport of page with nothing painted in it.
  const band = Math.round(m.height * BLANK_BAND_RATIO);
  if (band > 0 && m.scrollHeight > band) {
    for (let top = 0; top + band <= m.scrollHeight; top += band) {
      const bottom = top + band;
      const inked = m.ink.some((box) => box.top < bottom && box.top + box.height > top);
      if (!inked) {
        at(
          `nothing is painted between ${top}px and ${bottom}px of a ${m.scrollHeight}px page`,
          'blank-band',
          'blocking',
        );
      }
    }
  }

  // 5. Content parked outside the viewport, which reads as missing.
  const offscreen = m.overflowing.filter((box) => box.left >= m.width);
  if (offscreen.length > 0) {
    at(
      `${offscreen.length} element(s) start beyond the right edge, e.g. ${offscreen[0]!.label}`,
      'offscreen-content',
      'warning',
    );
  }

  return findings;
}

/* ------------------------------------------------------------------ */
/* The audit                                                           */
/* ------------------------------------------------------------------ */

export interface LayoutAudit {
  /** True when nothing blocking was found. */
  readonly ok: boolean;
  readonly findings: readonly LayoutFinding[];
  readonly measurements: readonly LayoutMeasurement[];
  readonly auditedAt: string;
}

/** The blocking findings, as the one-line reasons the gate and Hermes read. */
export function blockingReasons(audit: LayoutAudit): readonly string[] {
  return audit.findings
    .filter((finding) => finding.severity === 'blocking')
    .map((finding) => `Layout (${finding.viewport}): ${finding.detail}`);
}

/**
 * Renders the built site at each viewport and measures what actually painted.
 *
 * Uses its own browser rather than the run's shared session: this runs as its
 * own stage, after the site exists, and a QA pass that reused a session held
 * open since discovery would be measuring a page loaded under different
 * conditions than a visitor's.
 */
export async function auditLayout(args: {
  readonly siteDir: string;
  readonly logger: Logger;
}): Promise<LayoutAudit> {
  const { siteDir, logger } = args;
  const indexPath = path.join(siteDir, 'index.html');
  const browser = await chromium.launch({ headless: true });
  const measurements: LayoutMeasurement[] = [];

  try {
    for (const { viewport, width, height } of AUDIT_VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width, height } });
      try {
        await page.goto(pathToFileURL(indexPath).href);
        await page.evaluate(SETTLE_SOURCE);
        await page.waitForTimeout(300);
        const raw = (await page.evaluate(MEASURE_SOURCE)) as Omit<LayoutMeasurement, 'viewport'>;
        measurements.push({ ...raw, viewport });
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const findings = measurements.flatMap((m) => classifyLayout(m));
  const ok = !findings.some((finding) => finding.severity === 'blocking');

  logger.info('layout audit finished', {
    ok,
    blocking: findings.filter((f) => f.severity === 'blocking').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
  });

  return { ok, findings, measurements, auditedAt: new Date().toISOString() };
}
