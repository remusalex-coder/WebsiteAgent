/**
 * The Production Preflight gate's public surface.
 *
 *   const report = await runProductionPreflight({ profile, strategy, content, design, site, config, outputDir });
 *
 * A pure function of its inputs except for the one optional filesystem read
 * (`scanForSecrets`, only when `outputDir` is supplied). Every check is a
 * synchronous function of `PreflightContext`, so the whole battery runs in
 * milliseconds and is trivially unit-testable against a hand-built context —
 * see `test/preflight/`.
 */

import { accessibilityChecks } from './checks/accessibility.js';
import { analyticsChecks } from './checks/analytics.js';
import { businessChecks } from './checks/business.js';
import { functionalChecks } from './checks/functional.js';
import { performanceChecks } from './checks/performance.js';
import { privacyChecks } from './checks/privacy.js';
import { securityChecks } from './checks/security.js';
import { seoChecks } from './checks/seo.js';
import { computeProductionGate, summarize } from './report.js';
import { EMPTY_SECRET_SCAN, scanForSecrets } from './scan.js';

import type { CheckFn, PreflightContext, PreflightInput, PreflightReport } from './types.js';

/**
 * Every check, in the category order the report presents them in. Order
 * matters only for readability — no check depends on another's result.
 */
const ALL_CHECKS: readonly CheckFn[] = [
  ...functionalChecks,
  ...seoChecks,
  ...accessibilityChecks,
  ...performanceChecks,
  ...securityChecks,
  ...privacyChecks,
  ...analyticsChecks,
  ...businessChecks,
];

function fileNamed(files: PreflightInput['site']['files'], name: string): string {
  return files.find((file) => file.path === name)?.contents ?? '';
}

export async function runProductionPreflight(input: PreflightInput): Promise<PreflightReport> {
  const secretScan = input.outputDir === null ? EMPTY_SECRET_SCAN : await scanForSecrets(input.outputDir);

  const ctx: PreflightContext = {
    runId: input.runId,
    profile: input.profile,
    strategy: input.strategy,
    content: input.content,
    design: input.design,
    site: input.site,
    config: input.config,
    html: fileNamed(input.site.files, 'index.html') || (input.site.files[0]?.contents ?? ''),
    css: fileNamed(input.site.files, 'styles.css'),
    secretScan,
  };

  const results = ALL_CHECKS.map((run) => run(ctx));

  return {
    runId: input.runId,
    generatedAt: new Date().toISOString(),
    businessName: input.content.businessName,
    industry: input.design.industry.id,
    results,
    summary: summarize(results),
    productionGate: computeProductionGate(results),
  };
}

export * from './types.js';
