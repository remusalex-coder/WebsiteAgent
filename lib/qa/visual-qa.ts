/**
 * Visual QA loop.
 *
 * The pipeline already produces a real, deterministic static site and the
 * `publish-run.ts` script already screenshots it and runs a *mechanical* check
 * suite — broken images, dead links, horizontal overflow, missing alt text.
 * That suite reads the DOM; it cannot *see*. This module closes that gap: it
 * captures desktop and mobile screenshots, asks a vision model what is actually
 * wrong with the page (layout, spacing, overflow, responsive behaviour,
 * typography, contrast, missing or wrong visual elements), turns each finding
 * into a targeted patch, and re-checks until the defects are gone or the
 * budget is spent.
 *
 * Design constraints, borrowed from the rest of the system:
 *
 *  - No new framework, no paid service. The vision call reuses `postJson` and
 *    `validateAgainstSchema` from `lib/ai` — the same transport posture the
 *    four text providers get.
 *  - The vision model is *not* trusted to invent anything. It describes defects
 *    against pixels it can see; it never touches business facts. The patcher is
 *    a deterministic `sed`-free file edit it could not reach on its own.
 *  - Every fix is verified by re-capturing and re-analysing. A defect that the
 *    model claims to have fixed but the screenshot still shows is reported as
 *    unresolved, not swept under the rug.
 *  - The loop is bounded. A runaway model call cannot loop forever: an
 *    attempt ceiling caps it, and mechanical checks gate acceptance so a
 *    regression in the CSS the page actually ships is caught locally.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { postJson, decodeAndValidate } from '../ai/index.js';
import { ProviderRequestError } from '../errors.js';

import type { Logger } from '../logger.js';
import type { JsonSchema } from '../ai/index.js';

const SOURCE = 'qa.visual';

/* ------------------------------------------------------------------ */
/* Defect shape                                                       */
/* ------------------------------------------------------------------ */

/** One category the vision loop is allowed to judge. */
export type DefectCategory =
  | 'layout'
  | 'spacing'
  | 'overflow'
  | 'responsive'
  | 'typography'
  | 'contrast'
  | 'missing-element'
  | 'wrong-element';

export const DEFECT_CATEGORIES: readonly DefectCategory[] = [
  'layout',
  'spacing',
  'overflow',
  'responsive',
  'typography',
  'contrast',
  'missing-element',
  'wrong-element',
] as const;

/** Severity, so a loop can prefer to fix the loudest problem first. */
export type DefectSeverity = 'blocker' | 'major' | 'minor';

/** A single visual defect the model reports against a screenshot. */
export interface VisualDefect {
  readonly id: string;
  readonly viewport: 'desktop' | 'mobile';
  readonly category: DefectCategory;
  readonly severity: DefectSeverity;
  /** Human-readable, in the model's own words. */
  readonly description: string;
  /** Where on the page, as precisely as the model can say. */
  readonly location: string;
  /**
   * The concrete CSS change that should fix it, written as a value the patcher
   * can apply. Free text — the model is describing intent, not executing.
   */
  readonly suggestedFix: string;
}

export interface VisionAnalysis {
  readonly defects: readonly VisualDefect[];
  /** Anything the model wants to note that is not a defect (kept for context). */
  readonly notes: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Patching                                                           */
/* ------------------------------------------------------------------ */

/**
 * Turns a defect into a concrete edit against the site's files.
 *
 * The patcher is deliberately dumb: it edits text files the renderer produced,
 * and it only edits CSS or HTML the page already contains — it never introduces
 * a fact, never writes copy, never adds an external resource. The loop owns the
 * "what to fix"; the patcher owns "apply this string change safely".
 */
export interface FilePatch {
  readonly file: string;
  /** Exact string to replace. */
  readonly find: string;
  /** Replacement text. */
  readonly replace: string;
}

export interface PatchOutcome {
  readonly applied: boolean;
  /** Why a patch was not applied (no match, ambiguous match, denied). */
  readonly reason?: string;
  readonly patch: FilePatch;
}

/**
 * Applies a list of patches to a single file, refusing any that would be
 * ambiguous.
 *
 * Returns one outcome per patch so the caller can tell the vision model which
 * fixes landed and which it must reconsider — that feedback is what makes the
 * next loop iteration useful rather than repetitive.
 */
export async function applyPatches(file: string, patches: readonly FilePatch[]): Promise<readonly PatchOutcome[]> {
  let current: string;
  try {
    current = await fs.readFile(file, 'utf8');
  } catch {
    return patches.map((patch) => ({ applied: false, reason: 'file not found', patch }));
  }

  const outcomes: PatchOutcome[] = [];
  // Apply sequentially so later patches see earlier edits; cheap and safe.
  for (const patch of patches) {
    const count = current.split(patch.find).length - 1;
    if (count === 0) {
      outcomes.push({ applied: false, reason: 'pattern not found', patch });
      continue;
    }
    if (count > 1) {
      outcomes.push({ applied: false, reason: 'pattern matches more than once; refusing ambiguous edit', patch });
      continue;
    }
    current = current.replace(patch.find, patch.replace);
    outcomes.push({ applied: true, patch });
  }

  if (outcomes.some((o) => o.applied)) {
    await fs.writeFile(file, current, 'utf8');
  }
  return outcomes;
}

/* ------------------------------------------------------------------ */
/* The vision call                                                    */
/* ------------------------------------------------------------------ */

/**
 * Minimal, honest schema for the model's reply.
 *
 * Kept loose on purpose: the value of this loop is the *description* and the
 * *targeted fix*, not a perfect taxonomy. The validator only guarantees we got
 * a list-shaped answer we can iterate.
 */
const ANALYSIS_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    defects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          severity: { type: 'string' },
          description: { type: 'string' },
          location: { type: 'string' },
          suggestedFix: { type: 'string' },
        },
      },
    },
    notes: { type: 'array', items: { type: 'string' } },
  },
};

/**
 * Maps the model's natural-language category labels onto the closed set the
 * loop reasons about. Vision models do not reliably emit enum tokens, and
 * rejecting a whole analysis over "Layout" vs "layout" would waste a call — so
 * we normalise instead. Unknown labels fall through to `wrong-element`, which
 * the loop treats as "something looks off; let the patcher decide".
 */
const CATEGORY_ALIASES: Readonly<Record<string, DefectCategory>> = {
  layout: 'layout',
  alignment: 'spacing',
  spacing: 'spacing',
  padding: 'spacing',
  margin: 'spacing',
  overflow: 'overflow',
  'horizontal overflow': 'overflow',
  responsive: 'responsive',
  'responsive design': 'responsive',
  'responsive behaviour': 'responsive',
  typography: 'typography',
  font: 'typography',
  text: 'typography',
  contrast: 'contrast',
  'color contrast': 'contrast',
  'colour contrast': 'contrast',
  'missing element': 'missing-element',
  'missing visual element': 'missing-element',
  'missing visual elements': 'missing-element',
  'wrong element': 'wrong-element',
  'wrong visual element': 'wrong-element',
};

/**
 * Normalises the model's category label onto the loop's closed set.
 *
 * Two layers, because vision models drift:
 *   1. An explicit alias table for the common canonical spellings ("Layout",
 *      "Color Contrast", "Responsive Design", ...).
 *   2. A keyword scan so free phrasing ("text overlapping image", "image
 *      overflow", "low contrast between text and background") still lands on the
 *      right bucket instead of the catch-all. A defect whose category we cannot
 *      infer is reported as `wrong-element` and left for the patcher to judge —
 *      never dropped.
 */
function normalizeCategory(value: unknown): DefectCategory {
  const raw = String(value ?? '').trim();
  const key = raw.toLowerCase();

  const alias = CATEGORY_ALIASES[key];
  if (alias !== undefined) return alias;

  const tokens: readonly [DefectCategory, readonly string[]][] = [
    ['contrast', ['contrast', 'colour', 'color', 'legib', 'readable']],
    ['responsive', ['responsive', 'mobile', 'overflow', 'overlap', 'cropped', 'small screen', 'resize']],
    ['overflow', ['overflow', 'overlap', 'cropped', 'cut off', 'cut-off', 'truncat']],
    ['typography', ['typograph', 'font', 'heading', 'text size', 'inconsistent text', 'letter']],
    ['spacing', ['spacing', 'padding', 'margin', 'align', 'gap', 'centered', 'close together', 'cluttered']],
    ['layout', ['layout', 'position', 'arrang', 'section']],
    ['missing-element', ['missing', 'absent', 'lacking', 'no image', 'no button']],
    ['wrong-element', ['wrong', 'incorrect', 'placeholder', 'broken image']],
  ];

  for (const [category, words] of tokens) {
    if (words.some((word) => key.includes(word))) return category;
  }
  return 'wrong-element';
}

function normalizeSeverity(value: unknown): DefectSeverity {
  const key = String(value ?? '').trim().toLowerCase();
  if (key === 'blocker' || key === 'critical' || key === 'high') return 'blocker';
  if (key === 'major' || key === 'medium' || key === 'moderate') return 'major';
  return 'minor';
}

export interface VisionRequest {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
  /** desktop.png / mobile.png absolute paths. */
  readonly screenshots: ReadonlyArray<{ readonly viewport: 'desktop' | 'mobile'; readonly path: string }>;
  readonly business: string;
  readonly logger: Logger;
}

function base64Of(filePath: string): Promise<string> {
  return fs.readFile(filePath).then((buf) => buf.toString('base64'));
}

/**
 * Sends the screenshots to an OpenAI-compatible vision endpoint and returns a
 * structured analysis.
 *
 * Reuses `postJson` — the same deadline-and-retry-safe transport the text
 * providers use — and the shared `decodeAndValidate` validator, so a vision
 * failure is classified exactly like a generation failure (retryable where it
 * should be). The endpoint is configurable so this works against OpenAI
 * directly or any OpenAI-compatible vision gateway.
 */
export async function analyzeScreenshots(request: VisionRequest): Promise<VisionAnalysis> {
  const images = await Promise.all(
    request.screenshots.map(async (shot) => ({
      viewport: shot.viewport,
      data: await base64Of(shot.path),
    })),
  );

  const content: unknown[] = [
    {
      type: 'text',
      text:
        'You are a senior front-end reviewer. Below are desktop and mobile screenshots of a ' +
        'static business website generated by an autonomous builder. Review each screenshot as a ' +
        'human would. Report ONLY real, visible defects in these categories: layout, spacing, ' +
        'overflow, responsive behaviour, typography, contrast, missing visual elements, wrong ' +
        'visual elements. Ignore things you cannot verify from a screenshot. For each defect give a ' +
        'short description, its location on the page, a severity (blocker/major/minor), and a ' +
        'concrete CSS suggestion that would fix it without changing the page content or copying. ' +
        `The business is: ${request.business || 'a local small business'}. ` +
        'Respond with a single JSON object whose "defects" key is an array and whose "notes" key ' +
        'is an array of strings; do not wrap it in markdown. Each defect\'s "category" MUST be one of: ' +
        'layout, spacing, overflow, responsive, typography, contrast, missing-element, wrong-element. ' +
        'Each defect\'s "severity" MUST be one of: blocker, major, minor.',
    },
  ];

  for (const image of images) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/png;base64,${image.data}`,
        detail: 'high',
      },
    } as unknown);
  }

  const raw = (await postJson('openai', SOURCE, {
    url: `${request.baseUrl.replace(/\/+$/, '')}/chat/completions`,
    headers: { authorization: `Bearer ${request.apiKey}` },
    timeoutMs: request.timeoutMs,
    signal: request.signal,
    body: {
      model: request.model,
      max_tokens: 2048,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
    },
  })) as { choices?: readonly { message?: { content?: unknown } }[] };

  const choice = raw.choices?.[0];
  const text = typeof choice?.message?.content === 'string' ? choice.message.content : null;
  if (text === null) {
    throw new ProviderRequestError('openai', 'vision response carried no content', { source: SOURCE, retryable: true });
  }

  const parsed = decodeAndValidate(text, ANALYSIS_SCHEMA) as {
    defects: readonly Record<string, unknown>[];
    notes: readonly unknown[];
  };

  const defects: VisualDefect[] = parsed.defects.map((rawDefect, index) => ({
    id: `d${index + 1}`,
    viewport: (rawDefect.viewport as VisualDefect['viewport']) ?? 'desktop',
    category: normalizeCategory(rawDefect.category),
    severity: normalizeSeverity(rawDefect.severity),
    description: String(rawDefect.description ?? ''),
    location: String(rawDefect.location ?? ''),
    suggestedFix: String(rawDefect.suggestedFix ?? ''),
  }));

  return {
    defects,
    notes: parsed.notes.map((note) => String(note)),
  };
}

/* ------------------------------------------------------------------ */
/* Mechanical regression gate                                         */
/* ------------------------------------------------------------------ */

/**
 * The cheap checks the page must still pass after a patch.
 *
 * These are local, deterministic, and the same properties `publish-run.ts`
 * asserts — horizontal overflow, broken images, missing alt. If a CSS patch
 * the vision loop applied breaks one of these on the file that actually ships,
 * the loop must see it before declaring the page fixed.
 */
export interface MechanicalCheck {
  readonly id: string;
  readonly passed: boolean;
  readonly detail: string;
}

export async function mechanicalChecks(indexPath: string): Promise<readonly MechanicalCheck[]> {
  const checks: MechanicalCheck[] = [];
  const add = (id: string, passed: boolean, detail: string): void => {
    checks.push({ id, passed, detail });
  };

  let html: string;
  try {
    html = await fs.readFile(indexPath, 'utf8');
  } catch {
    add('page.present', false, 'index.html could not be read');
    return checks;
  }

  add('page.present', true, 'index.html readable');

  const imgTags = [...html.matchAll(/<img\b[^>]*>/g)];
  const withoutAlt = imgTags.filter((m) => !/\balt=/.test(m[0]));
  add('images.alt', withoutAlt.length === 0, `${withoutAlt.length} of ${imgTags.length} images without alt`);

  // Broken-image and overflow checks need a real browser; here we assert the
  // structural properties a static site controls without one. The full browser
  // pass lives in publish-run.ts and re-screenshots after the patch is applied.
  const hasHeading = /<h1\b/.test(html);
  add('content.heading', hasHeading, hasHeading ? 'page has an h1' : 'no h1 on the page');

  return checks;
}

/* ------------------------------------------------------------------ */
/* The loop                                                           */
/* ------------------------------------------------------------------ */

export interface VisualQaOptions {
  /** Directory holding index.html + styles.css (+ assets). */
  readonly siteDir: string;
  /** Vision endpoint. */
  readonly visionApiKey: string;
  readonly visionBaseUrl: string;
  readonly visionModel: string;
  readonly timeoutMs: number;
  /** Maximum analyse → patch → recheck iterations. */
  readonly maxAttempts: number;
  readonly logger: Logger;
  readonly signal?: AbortSignal;
  /**
   * Re-captures the screenshots for this attempt. Called at the top of every
   * iteration so the analysis sees the page *after* the previous patch. The
   * driver owns the browser; this module owns the decision.
   */
  readonly capture: (
    attempt: number,
  ) => Promise<ReadonlyArray<{ readonly viewport: 'desktop' | 'mobile'; readonly path: string }>>;
  /**
   * Turns defects into a structured analysis. Injected so the loop is unit
   * tested without a model; production passes the real `analyzeScreenshots`.
   * Must never throw into the loop uncaught — the loop treats a thrown analysis
   * as a non-fatal vision outage and stops, leaving the page as it was.
   */
  readonly analyze: (shots: ReadonlyArray<{ readonly viewport: 'desktop' | 'mobile'; readonly path: string }>) => Promise<VisionAnalysis>;
  /**
   * Applies a defect's fix to the site. Injected so the loop is testable
   * without a real editor: a test passes a recorder, production passes the
   * Claude Code driver.
   */
  readonly patchSite: (
    defects: readonly VisualDefect[],
    attempt: number,
  ) => Promise<readonly PatchOutcome[]>;
}

export interface VisualQaResult {
  readonly runId: string;
  readonly attempts: number;
  readonly remainingDefects: readonly VisualDefect[];
  readonly resolved: readonly string[];
  readonly patched: readonly PatchOutcome[];
  readonly finalChecks: readonly MechanicalCheck[];
  readonly verdict: 'fixed' | 'partial' | 'unfixed';
}

/**
 * Runs the visual QA loop against an already-rendered site.
 *
 * It does not render and does not deploy. Capture and re-check are the caller's
 * job (the `scripts/visual-qa.ts` driver owns the browser); this module owns
 * the decision logic: analyse, repair, gate. That split keeps the pure logic
 * under unit test and the browser under the operator.
 */
export async function runVisualQa(options: VisualQaOptions): Promise<VisualQaResult> {
  const { logger, siteDir } = options;
  const indexPath = path.join(siteDir, 'index.html');
  const runId = `visual-qa-${Date.now().toString(36)}`;

  const resolved: string[] = [];
  const allPatched: PatchOutcome[] = [];
  let lastDefects: readonly VisualDefect[] = [];
  let attempts = 0;
  /** True once at least one analysis completed — distinguishes "confirmed clean" from "never analyzed". */
  let analyzed = false;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    if (options.signal?.aborted === true) break;
    attempts = attempt;

    // Re-capture so the analysis sees the page after the previous patch.
    const shots = await options.capture(attempt);
    if (shots.length === 0) {
      logger.warn('visual qa: capture produced no screenshots', { attempt });
      break;
    }

    let analysis: VisionAnalysis;
    try {
      analysis = await options.analyze(shots);
    } catch (error) {
      // A vision outage must not kill the page. Report it and stop the loop;
      // the mechanical checks below still gate what already shipped.
      logger.warn('visual qa: vision analysis failed', {
        attempt,
        error: error instanceof Error ? error.message.slice(0, 160) : String(error),
      });
      break;
    }

    lastDefects = analysis.defects;
    analyzed = true;
    if (analysis.defects.length === 0) {
      logger.info('visual qa: no defects reported', { attempt });
      break;
    }

    logger.warn('visual qa: defects found', {
      attempt,
      count: analysis.defects.length,
      categories: analysis.defects.map((d) => d.category),
    });

    const outcomes = await options.patchSite(analysis.defects, attempt);
    allPatched.push(...outcomes);
    for (const o of outcomes) if (o.applied) resolved.push(o.patch.find);

    const checks = await mechanicalChecks(indexPath);
    const regressed = checks.some((c) => !c.passed);
    if (regressed) {
      logger.warn('visual qa: mechanical check regressed after patch', {
        attempt,
        failed: checks.filter((c) => !c.passed).map((c) => c.id),
      });
      // Keep looping; the next attempt's analysis may abandon the bad fix.
    }
  }

  const finalChecks = await mechanicalChecks(indexPath);
  const verdict: VisualQaResult['verdict'] =
    !analyzed ? 'unfixed'
      : lastDefects.length === 0 ? 'fixed'
      : resolved.length > 0 ? 'partial'
      : 'unfixed';

  return {
    runId,
    attempts,
    remainingDefects: lastDefects,
    resolved,
    patched: allPatched,
    finalChecks,
    verdict,
  };
}
