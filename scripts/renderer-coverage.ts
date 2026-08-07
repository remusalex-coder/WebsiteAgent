/**
 * Renderer coverage: which `WebsiteDesign` fields actually reach the page.
 *
 *   npx tsx scripts/renderer-coverage.ts [--md]
 *
 * Coverage is measured by perturbation rather than by reading the renderer.
 * Every leaf field of the design is mutated to a different legal value, the
 * site is re-rendered, and the output is compared:
 *
 * - **USED**            the mutation changed markup, or changed a custom property
 *                       that some rule in the stylesheet reads.
 * - **PARTIALLY USED**  the mutation only changed declarations nothing consumes —
 *                       the value is published to the page and then ignored.
 * - **IGNORED**         the mutation produced byte-identical output.
 *
 * A claim that a field is honoured is therefore not a claim about intent: if the
 * renderer stops reading a token, this report says so on the next run without
 * anybody remembering to update it.
 *
 * Fields are also labelled by what they are for, because a percentage that mixes
 * `hero` with `rationale` measures nothing. Only `visual` fields count toward the
 * headline number.
 */

import { composeDesign } from '../lib/design/index.js';
import { renderSite } from '../lib/render/index.js';
import { EXAMPLES, build } from './example-businesses.js';

import type { WebsiteDesign } from '../lib/design/index.js';
import type { WebsiteContent } from '../lib/types.js';

/* ------------------------------------------------------------------ */
/* The field table                                                     */
/* ------------------------------------------------------------------ */

/**
 * What a field is for.
 *
 * `visual` is the only kind the headline percentage counts. `documentation`
 * fields carry reasoning a reviewer reads; `structural` fields are contract
 * bookkeeping with no visual reading at all.
 */
type FieldKind = 'visual' | 'documentation' | 'structural';

interface Field {
  readonly path: string;
  readonly kind: FieldKind;
  /** Returns a design differing from `design` only at `path`. */
  readonly mutate: (design: WebsiteDesign) => WebsiteDesign;
}

/** Structural clone with one path replaced. Paths are dotted, arrays by index. */
function set(design: WebsiteDesign, dotted: string, value: unknown): WebsiteDesign {
  const keys = dotted.split('.');

  const walk = (node: unknown, depth: number): unknown => {
    const key = keys[depth];
    if (key === undefined) return value;

    if (Array.isArray(node)) {
      const index = Number(key);
      return node.map((entry, position) => (position === index ? walk(entry, depth + 1) : entry));
    }
    const record = node as Record<string, unknown>;
    return { ...record, [key]: walk(record[key], depth + 1) };
  };

  return walk(design, 0) as WebsiteDesign;
}

/** Reads a dotted path. */
function get(design: WebsiteDesign, dotted: string): unknown {
  let node: unknown = design;
  for (const key of dotted.split('.')) {
    if (node === null || node === undefined) return undefined;
    node = Array.isArray(node)
      ? (node as unknown[])[Number(key)]
      : (node as Record<string, unknown>)[key];
  }
  return node;
}

/** A field whose value is swapped for a different member of a closed set. */
function pick(dotted: string, options: readonly unknown[], kind: FieldKind = 'visual'): Field {
  return {
    path: dotted,
    kind,
    mutate: (design) => {
      const current = get(design, dotted);
      const other = options.find((option) => option !== current) ?? options[0];
      return set(design, dotted, other);
    },
  };
}

/** A numeric field, nudged far enough that a `clamp()` cannot round it away. */
function num(dotted: string, delta = 1.7, kind: FieldKind = 'visual'): Field {
  return {
    path: dotted,
    kind,
    mutate: (design) => {
      const current = get(design, dotted);
      return set(design, dotted, typeof current === 'number' ? current + delta : delta);
    },
  };
}

/** A free string — a colour, a font stack, a piece of prose. */
function str(dotted: string, replacement: string, kind: FieldKind = 'visual'): Field {
  return { path: dotted, kind, mutate: (design) => set(design, dotted, replacement) };
}

const TYPE_STEPS = [
  'display', 'h1', 'h2', 'h3', 'h4', 'body', 'bodyLarge', 'small', 'caption', 'eyebrow',
] as const;

const SPACE_STEPS = [
  '3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl',
] as const;

const SEMANTIC_COLORS = [
  'canvas', 'canvasSubtle', 'surface', 'surfaceRaised', 'border', 'borderStrong',
  'text', 'textMuted', 'heading', 'brand', 'brandHover', 'onBrand', 'brandText',
  'accent', 'onAccent', 'inverted', 'onInverted', 'success', 'warning', 'danger',
] as const;

/**
 * Every leaf of `WebsiteDesign`.
 *
 * Written out rather than walked, because a walker cannot know that `hero` is a
 * closed set of seven names and `containerMaxRem` is a length — and mutating a
 * field to a value the type forbids would measure the renderer's tolerance for
 * garbage rather than its coverage.
 */
const FIELDS: readonly Field[] = [
  { path: 'version', kind: 'structural', mutate: (design) => design },

  /* Personality */
  pick('personality.direction', ['editorial', 'bold', 'minimal', 'luxury']),
  pick('personality.mood.temperature', ['warm', 'cool', 'neutral']),
  pick('personality.mood.energy', ['calm', 'energetic', 'steady']),
  pick('personality.mood.formality', ['formal', 'casual', 'neutral']),
  pick('personality.density', ['airy', 'dense', 'balanced']),
  pick('personality.contrast', ['soft', 'high', 'medium']),
  str('personality.rationale', 'A different rationale.', 'documentation'),
  { path: 'personality.evidence', kind: 'documentation', mutate: (d) => set(d, 'personality.evidence', ['different evidence']) },

  /* Industry */
  pick('industry.id', ['law', 'gym', 'spa', 'bakery']),
  pick('industry.basis', ['listing', 'inferred', 'fallback'], 'documentation'),
  { path: 'industry.matchedOn', kind: 'documentation', mutate: (d) => set(d, 'industry.matchedOn', ['category:other']) },
  str('industry.rationale', 'A different industry rationale.', 'documentation'),

  /* Colour */
  ...SEMANTIC_COLORS.map((name) => str(`tokens.color.semantic.${name}`, '#123456')),
  { path: 'tokens.color.ramps', kind: 'visual', mutate: (d) => set(d, 'tokens.color.ramps.primary.steps.5', '#654321') },
  pick('tokens.color.scheme', ['light', 'dark']),
  num('tokens.color.contrast.textOnCanvas', 1.1, 'documentation'),

  /* Typography */
  str('tokens.typography.heading.stack', '"Coverage Probe Heading", serif'),
  str('tokens.typography.body.stack', '"Coverage Probe Body", sans-serif'),
  pick('tokens.typography.heading.character', ['serif', 'sans', 'display', 'mono']),
  { path: 'tokens.typography.heading.weights', kind: 'visual', mutate: (d) => set(d, 'tokens.typography.heading.weights', [123, 456]) },
  {
    path: 'tokens.typography.mono',
    kind: 'visual',
    mutate: (d) => set(d, 'tokens.typography.mono', {
      family: 'Coverage Probe Mono',
      stack: '"Coverage Probe Mono", monospace',
      character: 'mono',
      weights: [400],
    }),
  },
  // Composition inputs, not renderer inputs. The scale they produced is emitted
  // in full; changing the ratio after composition cannot move a page, because
  // every size it decided is already a separate token. Recorded so a reader can
  // see they were considered rather than missed.
  num('tokens.typography.ratio', 0.37, 'structural'),
  num('tokens.typography.baseRem', 0.31, 'structural'),
  num('tokens.typography.measureCh', 17),
  num('tokens.typography.fluidRange.maxRem', 13),
  ...TYPE_STEPS.flatMap((step) => [
    num(`tokens.typography.scale.${step}.maxRem`, 2.3),
    num(`tokens.typography.scale.${step}.lineHeight`, 0.41),
    num(`tokens.typography.scale.${step}.letterSpacing`, 0.037),
    num(`tokens.typography.scale.${step}.weight`, 113),
  ]),

  /* Spacing */
  num('tokens.spacing.baseRem', 0.7, 'structural'),
  num('tokens.spacing.ratio', 0.3, 'structural'),
  ...SPACE_STEPS.map((step) => num(`tokens.spacing.scale.${step}.maxRem`, 3.1)),
  num('tokens.spacing.sectionMaxRem', 7.3),

  /* Form */
  pick('tokens.radius.style', ['sharp', 'round', 'soft', 'subtle']),
  str('tokens.radius.sm', '3.7px'),
  str('tokens.radius.md', '4.9px'),
  str('tokens.radius.lg', '5.3px'),
  str('tokens.radius.pill', '6.1px'),
  pick('tokens.elevation.style', ['flat', 'dramatic', 'lifted', 'subtle']),
  str('tokens.elevation.levels.sm.shadow', '0 0 1.7px #010203'),
  str('tokens.elevation.levels.md.shadow', '0 0 2.9px #010203'),
  str('tokens.elevation.levels.lg.shadow', '0 0 3.1px #010203'),
  pick('tokens.elevation.prefersBorders', [true, false]),

  /* Motion */
  pick('tokens.motion.level', ['none', 'expressive', 'moderate', 'subtle']),
  num('tokens.motion.durationFastMs', 37),
  num('tokens.motion.durationBaseMs', 41),
  num('tokens.motion.durationSlowMs', 43),
  str('tokens.motion.easing', 'cubic-bezier(0.11, 0.22, 0.33, 0.44)'),
  { path: 'tokens.motion.effects', kind: 'visual', mutate: (d) => set(d, 'tokens.motion.effects', ['fade', 'rise', 'scale', 'stagger']) },
  { path: 'tokens.motion.respectReducedMotion', kind: 'structural', mutate: (d) => d },

  /* Layout */
  pick('layout.hero', ['full-bleed', 'magazine', 'editorial', 'minimal', 'centered', 'split']),
  pick('layout.footer', ['rich', 'corporate', 'minimal']),
  pick('layout.stickyHeader', [true, false]),
  pick('layout.showNavigation', [true, false]),
  {
    path: 'layout.order',
    kind: 'visual',
    mutate: (d) => {
      const order = d.layout.order;
      if (order.length < 3) return d;
      // Swap the last two, which never moves the hero out of first place.
      const swapped = [...order];
      const last = swapped.length - 1;
      [swapped[last - 1], swapped[last]] = [swapped[last]!, swapped[last - 1]!];
      return set(d, 'layout.order', swapped);
    },
  },
  str('layout.rationale', 'A different layout rationale.', 'documentation'),
  pick('layout.sections.1.variant', ['timeline', 'bento', 'alternating', 'editorial', 'cards', 'list']),
  pick('layout.sections.1.emphasis', ['lead', 'quiet', 'primary', 'secondary']),
  pick('layout.sections.1.background', ['inverted', 'brand', 'surface', 'subtle', 'canvas']),
  pick('layout.sections.1.density', ['dense', 'airy', 'balanced']),
  num('layout.sections.1.columns', 1),
  pick('layout.sections.1.fullBleed', [true, false]),
  str('layout.sections.1.rationale', 'A different section rationale.', 'documentation'),
  { path: 'layout.sections.*.kind', kind: 'structural', mutate: (d) => d },
  { path: 'layout.sections.*.index', kind: 'structural', mutate: (d) => d },

  /* Imagery */
  pick('imagery.treatment', ['monochrome', 'warm', 'cool', 'muted', 'natural']),
  pick('imagery.heroCrop', ['portrait', 'wide', 'square', 'landscape', 'natural']),
  pick('imagery.galleryCrop', ['portrait', 'wide', 'square', 'landscape', 'natural']),
  pick('imagery.radius', ['none', 'pill', 'lg', 'md', 'sm']),
  num('imagery.overlayOpacity', 0.37),
  pick('imagery.fallback', ['pattern', 'gradient', 'solid', 'omit']),

  /* Icons */
  pick('icons.style', ['none', 'duotone', 'solid', 'line']),
  num('icons.strokeWidth', 1.7),
  num('icons.sizeRem', 1.3),

  /* Responsive */
  num('responsive.containerMaxRem', 7.3),
  num('responsive.containerWideRem', 9.1),
  num('responsive.breakpoints.smRem', 3.1),
  num('responsive.breakpoints.mdRem', 5.3),
  num('responsive.breakpoints.lgRem', 7.1),
  num('responsive.mobileColumns', 1),
  { path: 'responsive.fluid', kind: 'structural', mutate: (d) => d },

  /* Accessibility */
  pick('accessibility.targetLevel', ['AAA', 'AA']),
  num('accessibility.minContrastBody', 1.3, 'documentation'),
  num('accessibility.minContrastLarge', 1.1, 'documentation'),
  num('accessibility.minTapTargetPx', 13),
  { path: 'accessibility.respectReducedMotion', kind: 'structural', mutate: (d) => d },
  pick('accessibility.focusStyle', ['ring', 'outline']),
  { path: 'accessibility.semanticLandmarks', kind: 'structural', mutate: (d) => d },

  /* Notes */
  { path: 'notes', kind: 'documentation', mutate: (d) => set(d, 'notes', ['a different note']) },
];

/* ------------------------------------------------------------------ */
/* Measurement                                                         */
/* ------------------------------------------------------------------ */

type Verdict = 'USED' | 'PARTIALLY USED' | 'IGNORED';

interface Rendered {
  readonly html: string;
  readonly css: string;
}

function render(content: WebsiteContent, design: WebsiteDesign): Rendered {
  const site = renderSite(content, { design });
  return {
    html: site.files.find((file) => file.path.endsWith('.html'))?.contents ?? '',
    css: site.files.find((file) => file.path.endsWith('.css'))?.contents ?? '',
  };
}

/** Custom-property names some rule in the stylesheet actually reads. */
function consumedNames(css: string): ReadonlySet<string> {
  return new Set([...css.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((match) => match[1] ?? ''));
}

/** The `--name:` declarations that differ between two stylesheets. */
function changedDeclarations(before: string, after: string): readonly string[] {
  const lines = (css: string): readonly string[] => css.split('\n');
  const a = lines(before);
  const b = lines(after);
  const names: string[] = [];

  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if (a[index] === b[index]) continue;
    for (const line of [a[index] ?? '', b[index] ?? '']) {
      const declaration = /^\s*(--[a-z0-9-]+)\s*:/i.exec(line);
      if (declaration !== null) names.push(declaration[1] ?? '');
    }
  }
  return names;
}

/**
 * One field's verdict on one site.
 *
 * A stylesheet diff that is entirely custom-property declarations, none of which
 * any rule reads, is the signature of a published-and-ignored token — the
 * failure mode this whole report exists to find.
 */
function verdictFor(field: Field, content: WebsiteContent, design: WebsiteDesign, base: Rendered): Verdict {
  const mutated = field.mutate(design);
  if (mutated === design) return 'IGNORED';

  const after = render(content, mutated);
  if (after.html === base.html && after.css === base.css) return 'IGNORED';
  if (after.html !== base.html) return 'USED';

  const consumed = consumedNames(base.css);
  const changed = changedDeclarations(base.css, after.css);

  // Something other than a declaration line moved: a real rule changed.
  if (changed.length === 0) return 'USED';
  return changed.some((name) => consumed.has(name)) ? 'USED' : 'PARTIALLY USED';
}

const RANK: Readonly<Record<Verdict, number>> = { USED: 2, 'PARTIALLY USED': 1, IGNORED: 0 };

async function main(): Promise<void> {
  const results = new Map<string, Verdict>();

  // Measured across every example rather than one, because a field only a
  // masonry gallery reads is invisible on a site that has no gallery — and
  // reporting it as ignored would be wrong.
  for (const spec of EXAMPLES) {
    const example = build(spec);
    const design = composeDesign({
      profile: example.profile,
      strategy: example.strategy,
      content: example.content,
    });
    const base = render(example.content, design);

    for (const field of FIELDS) {
      const verdict = verdictFor(field, example.content, design, base);
      const previous = results.get(field.path);
      if (previous === undefined || RANK[verdict] > RANK[previous]) {
        results.set(field.path, verdict);
      }
    }
  }

  const rows = FIELDS.map((field) => ({
    path: field.path,
    kind: field.kind,
    verdict: results.get(field.path) ?? 'IGNORED',
  }));

  const visual = rows.filter((row) => row.kind === 'visual');
  const score = visual.reduce((total, row) => total + RANK[row.verdict] / 2, 0);
  const percent = visual.length === 0 ? 0 : (score / visual.length) * 100;

  const markdown = process.argv.includes('--md');
  const lines: string[] = [];

  if (markdown) {
    lines.push('# Renderer coverage of `WebsiteDesign`', '');
    lines.push(`Measured by perturbation across ${EXAMPLES.length} example sites.`, '');
    lines.push('| Field | Kind | Verdict |', '| --- | --- | --- |');
    for (const row of rows) lines.push(`| \`${row.path}\` | ${row.kind} | ${row.verdict} |`);
    lines.push('');
  } else {
    for (const row of rows) {
      lines.push(`${row.verdict.padEnd(15)} ${row.kind.padEnd(14)} ${row.path}`);
    }
    lines.push('');
  }

  const count = (verdict: Verdict, kind?: FieldKind): number =>
    rows.filter((row) => row.verdict === verdict && (kind === undefined || row.kind === kind)).length;

  lines.push(`Visual fields:        ${visual.length}`);
  lines.push(`  used:               ${count('USED', 'visual')}`);
  lines.push(`  partially used:     ${count('PARTIALLY USED', 'visual')}`);
  lines.push(`  ignored:            ${count('IGNORED', 'visual')}`);
  lines.push(`Visual coverage:      ${percent.toFixed(1)}%  (partial counts a half)`);
  lines.push('');
  lines.push(`Documentation fields: ${rows.filter((r) => r.kind === 'documentation').length} `
    + `(${count('IGNORED', 'documentation')} ignored)`);
  lines.push(`Structural fields:    ${rows.filter((r) => r.kind === 'structural').length} (not scored)`);

  const ignored = rows.filter((row) => row.verdict === 'IGNORED' && row.kind === 'visual');
  if (ignored.length > 0) {
    lines.push('', 'Ignored visual fields:');
    for (const row of ignored) lines.push(`  ${row.path}`);
  }

  console.log(lines.join('\n'));
}

await main();
