/**
 * Performance gate (Freeze N-13, P4-5).
 *
 * Budgets that *fail* — but over-budget is a caveat, not a hard fail. The
 * freeze is explicit: "over-budget is a *caveat*, not a hard fail." A slow
 * page is deliverable; a broken one is not. So this gate never blocks, it
 * annotates, and the distinction between a caveat and a hard fail is what
 * `verdict.ts` consumes (performance is non-blocking there).
 *
 * Four budgets, each proxying a browser metric:
 *   page weight        — proxy for LCP (big payloads can't paint fast)
 *   largest image      — the single heaviest image (the usual LCP culprit)
 *   DOM ceiling        — node count (proxy for layout/CSS cost and CLS risk)
 *   LCP/CLS proxies    — derived from the above when the browser supplied them
 */

const SOURCE = 'qa.gates.performance';

export interface PerformanceEvidence {
  /** Total transferred bytes of the page and its subresources. */
  readonly pageBytes: number;
  /** Bytes of the largest single image. */
  readonly largestImageBytes: number;
  /** Number of DOM nodes. */
  readonly domNodes: number;
  /** Measured Largest Contentful Paint, ms, when the browser reported it. */
  readonly lcpMs?: number;
  /** Measured Cumulative Layout Shift, when the browser reported it. */
  readonly cls?: number;
}

export interface PerformanceBudget {
  /** Max total page weight, bytes. */
  readonly maxPageBytes: number;
  /** Max largest-image weight, bytes. */
  readonly maxImageBytes: number;
  /** Max DOM nodes. */
  readonly maxDomNodes: number;
  /** Max LCP, ms. Undefined = not asserted. */
  readonly maxLcpMs?: number;
  /** Max CLS. Undefined = not asserted. */
  readonly maxCls?: number;
}

export interface PerformanceCaveat {
  readonly id: string;
  readonly measured: number;
  readonly budget: number;
  readonly detail: string;
}

export interface PerformanceResult {
  /** True when nothing exceeds its budget. The gate never hard-fails. */
  readonly withinBudget: boolean;
  /** Every budget that was exceeded, as a caveat. */
  readonly caveats: readonly PerformanceCaveat[];
}

/** The default budgets — intentionally generous; a small business site should sail through. */
export const DEFAULT_BUDGETS: Required<PerformanceBudget> = {
  maxPageBytes: 2_000_000,
  maxImageBytes: 500_000,
  maxDomNodes: 3_000,
  maxLcpMs: 2_500,
  maxCls: 0.1,
};

/**
 * Runs the four budgets. Returns caveats, never a blocking failure.
 */
export function gatePerformance(
  evidence: PerformanceEvidence,
  budgets: PerformanceBudget = DEFAULT_BUDGETS,
): PerformanceResult {
  const caveats: PerformanceCaveat[] = [];

  const check = (id: string, measured: number | undefined, budget: number | undefined, unit: string, label: string): void => {
    if (measured === undefined || budget === undefined) return;
    if (measured > budget) {
      caveats.push({ id, measured, budget, detail: `${label}: ${measured}${unit} over ${budget}${unit}` });
    }
  };

  check('perf.page-weight', evidence.pageBytes, budgets.maxPageBytes, 'B', 'total page weight');
  check('perf.largest-image', evidence.largestImageBytes, budgets.maxImageBytes, 'B', 'largest image');
  check('perf.dom-nodes', evidence.domNodes, budgets.maxDomNodes, ' nodes', 'DOM ceiling');
  check('perf.lcp', evidence.lcpMs, budgets.maxLcpMs, 'ms', 'LCP');
  check('perf.cls', evidence.cls, budgets.maxCls, '', 'CLS');

  return { withinBudget: caveats.length === 0, caveats };
}

export const SOURCE_NAME = SOURCE;