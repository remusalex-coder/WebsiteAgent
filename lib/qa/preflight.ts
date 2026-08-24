/**
 * Production preflight — collects the evidence `qa/gates/technical.ts`,
 * `qa/gates/accessibility.ts`, and `qa/gates/performance.ts` need, and
 * combines their verdicts into one PASS/FAIL a production driver can act on.
 *
 * ## Why this exists (Decision Gate §1.J / §8 item 8, §10 item 2)
 *
 * Those three gates were built (Freeze N-11/N-12/N-13) as pure functions over
 * pre-collected evidence — correctly, so they are unit-testable without a
 * browser. But nothing collected that evidence for them outside
 * `scripts/publish-run.ts`, which is a standalone script invoked manually
 * (`npm run publish`) and never called by `runJob.ts` or `stage.ts`. This
 * module is the missing collector, scoped to exactly what those three gates'
 * contracts need — not a second capture implementation, and not a rewrite of
 * `lib/qa/layout-audit.ts`, which owns geometry and stays untouched.
 *
 * ## LCP / CLS
 *
 * `PerformanceEvidence.lcpMs`/`.cls` (`gates/performance.ts`, N-13) were
 * typed from the start as optional — "when the browser supplied them" — a
 * deliberate seam for exactly this collector to fill in later, not a field
 * nothing was ever going to populate. `LCP_CLS_INIT_SOURCE` below installs
 * real `PerformanceObserver`s (`largest-contentful-paint`, `layout-shift`)
 * via `page.addInitScript`, so they attach before the very first paint —
 * attaching after `goto` would already have missed the metric a static,
 * `waitUntil: 'load'` page produces almost immediately. Both APIs work
 * fine against a plain static page regardless of transport — but the
 * collector serves the site over a real local HTTP server anyway (see
 * `serveDirectory` below), for a different, unrelated reason: `runtime.js`
 * ships as `<script type="module">`, and a browser refuses to load a
 * `type="module"` script cross-origin, which every `file://` resource is
 * (`origin: "null"`). `file://` navigation silently broke
 * `page.no-console-errors`/`page.no-failed-requests` for every business
 * whose experience actually engages the Tier-2 runtime — found by running
 * this collector against a real 10-business benchmark, not a targeted
 * test, since every existing fixture happened to either skip the runtime
 * or never assert these two checks against a runtime-engaged page.
 * `gates/performance.ts`'s own budgets (N-13, `SHOULD` not `MUST`) and its
 * "over-budget is a caveat, never a hard fail" rule are untouched — this
 * only supplies more real evidence to an already-frozen, already-tolerant
 * gate, the same "additive, never a semantic change" shape every other
 * extension in this codebase uses.
 *
 * ## What is deliberately NOT collected here
 *
 * `AccessibilityEvidence.keyboard` (the 8-stop keyboard sweep) and `.contrast`
 * (rendered-page contrast pairs) are left empty. Both require scripted
 * interaction beyond a DOM read and are real, separate pieces of work — the
 * freeze reserves them as their own acceptance criteria (P4-3). Leaving them
 * empty is the honest shape: `gateAccessibility` reads an empty array as
 * "nothing failed", never as "verified fine", which is the same distinction
 * the visual critic's `uncertain` verdict already draws elsewhere in this
 * codebase. `axeViolations` is left undefined for the same reason — axe is
 * not wired into any Playwright session in this repository yet.
 */

import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs/promises';
import http from 'node:http';

import { AUDIT_VIEWPORTS } from './layout-audit.js';
import { gateFunctionalSecurity } from './gates/technical.js';
import { gateAccessibility } from './gates/accessibility.js';
import { gatePerformance, DEFAULT_BUDGETS } from './gates/performance.js';
import { gateStructuredData } from './gates/structuredData.js';

import type { FunctionalEvidence, SecurityEvidence, TechnicalGateResult } from './gates/technical.js';
import type { AccessibilityEvidence, AccessibilityResult } from './gates/accessibility.js';
import type { PerformanceEvidence, PerformanceResult, PerformanceBudget } from './gates/performance.js';
import type { StructuredDataResult } from './gates/structuredData.js';
import type { Logger } from '../logger.js';

/**
 * Installed via `page.addInitScript` — runs before any page script, so the
 * observers are attached before the first paint. Buffers onto
 * `window.__bfPerf` rather than resolving a promise: LCP can still update
 * after this script runs (a later, larger element can paint), so the value
 * is read back at the end of the page's lifetime (`LCP_CLS_READ_SOURCE`
 * below), not captured once here.
 *
 * `buffered: true` on the observers also captures any entry that fired
 * before the observer itself attached — belt-and-suspenders alongside
 * attaching pre-paint, not a substitute for it.
 */
const LCP_CLS_INIT_SOURCE = `(() => {
  window.__bfPerf = { lcpMs: 0, cls: 0 };
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) window.__bfPerf.lcpMs = last.renderTime || last.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (err) {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__bfPerf.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch (err) {}
})()`;

/** Reads back what `LCP_CLS_INIT_SOURCE` accumulated. */
const LCP_CLS_READ_SOURCE = `(() => ({
  lcpMs: window.__bfPerf ? Math.round(window.__bfPerf.lcpMs) : 0,
  cls: window.__bfPerf ? Math.round(window.__bfPerf.cls * 1000) / 1000 : 0,
}))()`;

/**
 * Read in the page. A plain-JS source string for the same reason
 * `layout-audit.ts`'s `MEASURE_SOURCE` is one: `tsx`/esbuild rewrite named
 * function bindings to reference a helper that does not exist inside
 * `page.evaluate`, and a string is never instrumented.
 */
const COLLECT_SOURCE = `(() => {
  const attrs = [];
  for (const el of Array.from(document.querySelectorAll('*'))) {
    for (const a of Array.from(el.attributes)) {
      if (a.name.startsWith('on')) attrs.push(el.tagName.toLowerCase() + '[' + a.name + ']');
    }
  }
  const hrefs = Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') || '');
  const images = Array.from(document.images);
  const headings = Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6'))
    .map((h) => Number(h.tagName.slice(1)));
  const headingGaps = [];
  for (let i = 1; i < headings.length; i += 1) {
    if (headings[i] - headings[i - 1] > 1) {
      headingGaps.push('heading jumps from h' + headings[i - 1] + ' to h' + headings[i] + ' at position ' + i);
    }
  }
  if (headings.length > 0 && headings[0] !== 1) {
    headingGaps.push('first heading is h' + headings[0] + ', not h1');
  }
  const metaCsp = document.querySelector('meta[http-equiv="Content-Security-Policy" i]');
  let structuredData = {};
  const ldJson = document.querySelector('script[type="application/ld+json"]');
  if (ldJson && ldJson.textContent) {
    try {
      const parsed = JSON.parse(ldJson.textContent);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) structuredData = parsed;
    } catch (err) {
      structuredData = { '@context': null, '@type': null };
    }
  }
  return {
    functional: {
      images: images.length,
    },
    security: {
      inlineEventHandlers: attrs,
      javascriptUrls: hrefs.filter((h) => /^\\s*javascript:/i.test(h)),
      dataUrls: hrefs.filter((h) => /^\\s*data:/i.test(h)),
      insecureHttpResources: [
        ...images.map((i) => i.getAttribute('src') || ''),
        ...Array.from(document.querySelectorAll('link[href], script[src]'))
          .map((e) => e.getAttribute('href') || e.getAttribute('src') || ''),
      ].filter((u) => /^http:\\/\\//i.test(u)),
      externalLinksWithoutNoopener: Array.from(document.querySelectorAll('a[target="_blank"]'))
        .filter((a) => !(a.getAttribute('rel') || '').includes('noopener'))
        .map((a) => a.getAttribute('href') || ''),
      scriptTags: document.querySelectorAll('script').length,
      externalScripts: Array.from(document.querySelectorAll('script[src]'))
        .map((s) => s.getAttribute('src') || '')
        .filter((s) => /^https?:/i.test(s)),
      iframes: Array.from(document.querySelectorAll('iframe')).map((f) => f.getAttribute('src') || ''),
      formsWithoutAction: Array.from(document.querySelectorAll('form'))
        .filter((f) => !f.getAttribute('action')).length,
      contentSecurityPolicy: metaCsp ? metaCsp.getAttribute('content') : null,
    },
    accessibility: {
      hasMainLandmark: document.querySelector('main') !== null,
      hasSkipLink: document.querySelector('a[href="#main"], .skip-link') !== null,
      lang: document.documentElement.getAttribute('lang') || '',
      imagesMissingAlt: images.filter((i) => !i.hasAttribute('alt')).length,
      totalImages: images.length,
      headingGaps: headingGaps,
    },
    performance: {
      domNodes: document.querySelectorAll('*').length,
    },
    structuredData: structuredData,
  };
})()`;

interface CollectedPage {
  readonly functional: { readonly images: number };
  readonly security: Omit<SecurityEvidence, never>;
  readonly accessibility: Omit<AccessibilityEvidence, 'keyboard' | 'contrast' | 'axeViolations'>;
  readonly performance: { readonly domNodes: number };
  /** The page's own JSON-LD, read back from its rendered `<script type="application/ld+json">` — `{}` when none was emitted. */
  readonly structuredData: Record<string, unknown>;
}

export interface PreflightEvidence {
  readonly functional: FunctionalEvidence;
  readonly security: SecurityEvidence;
  readonly accessibility: AccessibilityEvidence;
  readonly performance: PerformanceEvidence;
  readonly structuredData: Record<string, unknown>;
}

const MIME_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * A minimal static file server over the rendered site — real HTTP, not
 * `file://`, which is what lets `runtime.js`'s `type="module"` script load
 * at all (see this file's own "LCP / CLS" doc section for why `file://`
 * fails it). Ephemeral: bound to `127.0.0.1` on a random free port
 * (`listen(0, ...)`), closed once the collector is done. Deliberately not a
 * general-purpose static server — it serves exactly this one directory,
 * refuses any path that would escape it, and 404s everything else.
 *
 * Exported: any other tool that opens a rendered site in a real browser —
 * a screenshot script, a visual benchmark — needs the exact same fix for
 * the exact same reason, and duplicating this function was how the bug got
 * missed the first time (`scripts/benchmark-10.ts`'s own screenshot capture
 * used raw `file://` and silently produced pages where every
 * scroll-reveal/text-reveal section rendered at its CSS *base* opacity,
 * because `runtime.js` never loaded to override it — not a renderer bug,
 * a `file://` capture-tooling one, found only by looking at the actual
 * screenshots).
 */
export async function serveDirectory(dir: string): Promise<{ readonly url: string; readonly close: () => Promise<void> }> {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    void (async () => {
      try {
        const requestPath = decodeURIComponent((req.url ?? '/').split('?')[0] ?? '/');
        const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
        const full = path.resolve(root, relative);
        if (full !== root && !full.startsWith(`${root}${path.sep}`)) {
          res.writeHead(403).end();
          return;
        }
        const body = await fs.readFile(full);
        res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(full)] ?? 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end();
      }
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * Loads the built site and reads the evidence the three gates need.
 *
 * One page load per viewport, mirroring `layout-audit.ts`'s viewport list so
 * a preflight defect and a layout defect describe the same page. DOM
 * evidence (security, accessibility, heading structure) is collected once,
 * on desktop — those do not vary by viewport. Page weight and console/network
 * errors are collected per viewport and combined, because those genuinely can.
 */
export async function collectPreflightEvidence(args: {
  readonly siteDir: string;
  readonly logger: Logger;
}): Promise<PreflightEvidence> {
  const { siteDir, logger } = args;
  const server = await serveDirectory(siteDir);
  const browser = await chromium.launch({ headless: true });

  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  let pageBytes = 0;
  let largestImageBytes = 0;
  let collected: CollectedPage | null = null;
  let lcpMs: number | undefined;
  let cls: number | undefined;

  try {
    for (const { viewport, width, height } of AUDIT_VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width, height } });
      // Must attach before goto — an observer added after navigation has
      // already missed a static page's near-immediate first paint.
      await page.addInitScript(LCP_CLS_INIT_SOURCE);
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(`${viewport}: ${m.text()}`);
      });
      page.on('pageerror', (e) => pageErrors.push(`${viewport}: ${e.message}`));
      page.on('requestfailed', (r) => {
        failedRequests.push(`${viewport}: ${r.url()} (${r.failure()?.errorText ?? 'unknown'})`);
      });
      page.on('response', (r) => {
        if (r.status() >= 400) failedRequests.push(`${viewport}: HTTP ${r.status()} ${r.url()}`);
      });
      page.on('requestfinished', (request) => {
        void request
          .response()
          .then(async (response) => {
            if (response === null) return;
            const body = await response.body().catch(() => null);
            if (body === null) return;
            pageBytes += body.length;
            const type = response.headers()['content-type'] ?? '';
            if (type.startsWith('image/') && body.length > largestImageBytes) largestImageBytes = body.length;
          })
          .catch(() => undefined);
      });

      try {
        await page.goto(server.url, { waitUntil: 'load' });
        await page.evaluate(async () => {
          for (const img of Array.from(document.images)) img.removeAttribute('loading');
          await Promise.all(
            Array.from(document.images).map((i) => (i.complete ? null : i.decode().catch(() => null))),
          );
        });
        await page.waitForTimeout(300);

        if (viewport === 'desktop') {
          collected = (await page.evaluate(COLLECT_SOURCE)) as CollectedPage;
          const perf = (await page.evaluate(LCP_CLS_READ_SOURCE)) as { lcpMs: number; cls: number };
          lcpMs = perf.lcpMs;
          cls = perf.cls;
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  if (collected === null) {
    // Desktop is always the first viewport in AUDIT_VIEWPORTS; this branch is
    // unreachable in practice and exists only so the return type is total.
    throw new Error('preflight: desktop viewport evidence was never collected');
  }
  const page: CollectedPage = collected;

  logger.info('preflight evidence collected', {
    pageErrors: pageErrors.length,
    consoleErrors: consoleErrors.length,
    failedRequests: failedRequests.length,
    pageBytes,
    lcpMs,
    cls,
  });

  return {
    functional: { pageErrors, consoleErrors, failedRequests },
    security: page.security,
    accessibility: { ...page.accessibility, keyboard: [], contrast: [] },
    performance: {
      pageBytes,
      largestImageBytes,
      domNodes: page.performance.domNodes,
      // Measured after this collector's own image-decode forcing above
      // (`img.decode()`), not a naturalistic lazy-load timeline — a real
      // visitor's LCP may arrive later than this number on a slow
      // connection where lazy images stay deferred. Still real numbers
      // from a real render, and still gated by gatePerformance's existing
      // "caveat, never a hard fail" rule (N-13) — not a new failure mode,
      // more evidence for an unchanged one. Omitted entirely (not `undefined`)
      // when the desktop pass never ran, matching `PerformanceEvidence`'s
      // own optional-when-unsupplied contract.
      ...(lcpMs !== undefined ? { lcpMs } : {}),
      ...(cls !== undefined ? { cls } : {}),
    },
    structuredData: page.structuredData,
  };
}

export interface PreflightResult {
  /** True only when both blocking gates (technical, accessibility) pass. Performance and structured-data never block. */
  readonly passed: boolean;
  readonly technical: TechnicalGateResult;
  readonly accessibility: AccessibilityResult;
  readonly performance: PerformanceResult;
  readonly structuredData: StructuredDataResult;
}

/**
 * Combines the gates' verdicts.
 *
 * Matches Freeze N-13's own rule, unchanged: performance is a caveat, never a
 * blocking reason — `passed` is decided by technical and accessibility alone.
 * This is not this module inventing a policy; it is `gatePerformance`'s
 * existing, documented contract, simply not overridden here. Structured-data
 * validation is added on the same non-blocking footing, for the same reason
 * `lib/render/document.ts` already only *warns* on thin/missing SEO fields
 * rather than failing the render: a crawler that cannot use incomplete JSON-LD
 * still gets a usable page.
 */
export function gatePreflight(
  evidence: PreflightEvidence,
  performanceBudgets: PerformanceBudget = DEFAULT_BUDGETS,
): PreflightResult {
  const technical = gateFunctionalSecurity(evidence.functional, evidence.security);
  const accessibility = gateAccessibility(evidence.accessibility);
  const performance = gatePerformance(evidence.performance, performanceBudgets);
  const structuredData = gateStructuredData(evidence.structuredData);
  return {
    passed: technical.passed && accessibility.passed,
    technical,
    accessibility,
    performance,
    structuredData,
  };
}

export interface PreflightDecisionInput {
  /** What Hermes decided before preflight ran. */
  readonly currentDecision: 'running' | 'deliver' | 'reconcept' | 'escalate';
  readonly preflightPassed: boolean;
}

export interface PreflightDecisionOutcome {
  /** `true` when this call changed `deliver` into `escalate`. */
  readonly downgraded: boolean;
  readonly decision: 'running' | 'deliver' | 'reconcept' | 'escalate';
  /** `finalOutput` must be cleared exactly when a downgrade happens. */
  readonly clearFinalOutput: boolean;
}

/**
 * Whether — and how — a preflight result changes the delivery decision.
 *
 * Pure and total, deliberately separated from `collectPreflightEvidence`'s
 * browser work, so "a critical preflight failure blocks delivery" is provable
 * without launching Chromium (Decision Gate Phase 10 item 3/Phase 11 item 9).
 *
 * The only transition this function ever makes is `deliver` → `escalate`. It
 * never touches `reconcept`/`escalate`/`running` — there is nothing for a
 * preflight pass to promote, and nothing for a preflight pass to un-escalate:
 * a human who is already going to see this job should not have its record
 * quietly rewritten back to "deliver" because the automated gate happened to
 * agree with something else that already failed it.
 */
export function applyPreflightToDecision(input: PreflightDecisionInput): PreflightDecisionOutcome {
  const shouldDowngrade = input.currentDecision === 'deliver' && !input.preflightPassed;
  return {
    downgraded: shouldDowngrade,
    decision: shouldDowngrade ? 'escalate' : input.currentDecision,
    clearFinalOutput: shouldDowngrade,
  };
}
