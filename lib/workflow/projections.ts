/**
 * Independent input views for the K concept agents (Freeze P5-3).
 *
 * The battle's K candidates must each receive a *different projection* of the
 * evidence — the three briefs differ in content, not only in ordering, because
 * a reordered copy of the same brief produces the same concept three times.
 *
 * Each projection foregrounds a different facet of the evidence and suppresses
 * or re-emphasises others:
 *
 *   - `identity`   — who the business IS: name, category basis, rating, voice,
 *                    tagline, image signals, the listing's own description.
 *   - `audience`   — who it serves: goals, target audience, recommended pages,
 *                    the shape of the site the strategy proposes.
 *   - `grounding`  — the hard facts a concept must not contradict: services
 *                    detail, hours, stated-available attributes, review
 *                    evidence, known gaps.
 *
 * Pure and deterministic: the same evidence always produces the same three
 * briefs, so a failed candidate can be rebuilt from the same view.
 */

import type { BusinessProfile, BusinessStrategy, WebsiteContent } from '../types.js';

const SOURCE = 'workflow.projections';

/** The K views, one per concept agent. */
export type ProjectionKind = 'identity' | 'audience' | 'grounding';

/** The K projections this milestone supplies. 3 is the frozen K=3 default. */
export const PROJECTION_KINDS: readonly ProjectionKind[] = ['identity', 'audience', 'grounding'];

export interface Projection {
  readonly kind: ProjectionKind;
  readonly brief: string;
}

const section = (lines: string[], heading: string, body: string): void => {
  lines.push(`## ${heading}`, body.trim() || 'none', '');
};

/** The one clean fact every view must carry: what the business is called. */
function identityHeader(profile: BusinessProfile, strategy: BusinessStrategy): string {
  return [
    `Name: ${profile.name.value}`,
    `Category: ${strategy.category.primary}${strategy.category.basis ? ` (${strategy.category.basis})` : ''}`,
    profile.rating !== null ? `Rating: ${profile.rating.value}${profile.reviewCount !== null ? ` (${profile.reviewCount.value} reviews)` : ''}` : null,
    profile.address !== null ? `Address: ${profile.address.value}` : null,
  ].filter(Boolean).join('\n');
}

function identityProjection(
  profile: BusinessProfile,
  strategy: BusinessStrategy,
  content: WebsiteContent,
): string {
  const lines: string[] = [];
  section(lines, 'The business', identityHeader(profile, strategy));
  if (profile.description !== null) {
    section(lines, 'How the listing describes it', profile.description.value);
  }
  section(
    lines,
    'Brand voice',
    [
      `Tone: ${content.voice.tone}`,
      `Palette words: ${content.voice.palette.join(', ') || 'none'}`,
      `Heading typeface signal: ${content.voice.typography.heading || 'none'}`,
      `Body typeface signal: ${content.voice.typography.body || 'none'}`,
    ].join('\n'),
  );
  section(lines, 'Tagline', content.tagline || 'none');
  section(lines, 'Image content signals', describeImageSignals(profile));
  return lines.join('\n');
}

function audienceProjection(
  profile: BusinessProfile,
  strategy: BusinessStrategy,
  content: WebsiteContent,
): string {
  const lines: string[] = [];
  section(lines, 'The business', identityHeader(profile, strategy));
  const goalLines = strategy.goals.slice(0, 4).map((g) => `- [${g.priority}] ${g.title}: ${g.rationale}`);
  section(lines, 'Business goals', goalLines.join('\n') || 'none described');
  const { primary, secondary } = strategy.audience;
  section(
    lines,
    'Target audience',
    [
      `Primary: ${primary.name} — ${primary.description}`,
      `  Needs: ${primary.needs.join('; ')}`,
      ...secondary.slice(0, 2).map((s) => `Secondary: ${s.name} — ${s.description}`),
    ].join('\n'),
  );
  const pageLines = strategy.pages.slice(0, 6).map((p) => `- ${p.path}: ${p.title}`);
  section(lines, 'Recommended pages', pageLines.join('\n') || 'none');
  const sectionLines = content.sections.map(
    (s) => `- [${s.kind}] ${s.heading}${s.subheading ? ` / ${s.subheading}` : ''}`,
  );
  section(lines, 'Content sections (in order)', sectionLines.join('\n') || 'none');
  return lines.join('\n');
}

function groundingProjection(
  profile: BusinessProfile,
  strategy: BusinessStrategy,
  content: WebsiteContent,
): string {
  const lines: string[] = [];
  section(lines, 'The business', identityHeader(profile, strategy));
  const serviceLines = profile.services.slice(0, 10).map((s) =>
    s.description ? `- ${s.name}: ${s.description}` : `- ${s.name}`,
  );
  section(lines, 'Services / products', serviceLines.join('\n') || 'none listed');
  if (profile.hours.length > 0) {
    section(
      lines,
      'Opening hours',
      profile.hours.slice(0, 7).map((h) => `${h.opens}–${h.closes}`).join(', '),
    );
  }
  const attributeLines = profile.attributes
    .slice(0, 14)
    .map((a) => `- ${a.available ? '' : 'NOT available: '}${a.label}`);
  if (attributeLines.length > 0) {
    section(lines, 'Stated properties (grounding)', attributeLines.join('\n'));
  }
  const gapLines = [
    ...profile.validation.issues.map((i) => `- [${i.severity}] ${i.field}: ${i.message}`),
    ...content.unresolvedGaps.slice(0, 5).map((g) => `- ${g}`),
  ];
  section(lines, 'Known gaps / uncertainties', gapLines.join('\n') || 'none');
  return lines.join('\n');
}

/**
 * Builds the K independent input views. Each projection foregrounds a
 * different facet — identity, audience, grounding — so the briefs differ in
 * content, not merely in ordering.
 */
export function buildProjections(
  profile: BusinessProfile,
  strategy: BusinessStrategy,
  content: WebsiteContent,
): readonly Projection[] {
  return PROJECTION_KINDS.map((kind) => ({
    kind,
    brief: (() => {
      switch (kind) {
        case 'identity':
          return identityProjection(profile, strategy, content);
        case 'audience':
          return audienceProjection(profile, strategy, content);
        case 'grounding':
          return groundingProjection(profile, strategy, content);
      }
    })(),
  }));
}

/** A given view, for the runner to hand one concept agent its own brief. */
export function projectionFor(
  profile: BusinessProfile,
  strategy: BusinessStrategy,
  content: WebsiteContent,
  kind: ProjectionKind,
): string {
  const projection = buildProjections(profile, strategy, content).find((p) => p.kind === kind);
  return projection?.brief ?? '';
}

function describeImageSignals(profile: BusinessProfile): string {
  const logo = profile.images.logo !== null;
  const images: readonly import('../types.js').ImageAsset[] = [
    ...(profile.images.hero !== null ? [profile.images.hero] : []),
    ...profile.images.gallery,
  ].filter((i) => i.role !== 'logo' && i.role !== 'favicon');

  if (images.length === 0) {
    return `Logo: ${logo ? 'yes' : 'no'}\nUsable photographs: 0 — a text-led page; do not force a gallery or an image-led hero.`;
  }

  const orient = (i: import('../types.js').ImageAsset): string => {
    if (i.width == null || i.height == null || i.height === 0) return 'unknown';
    const r = i.width / i.height;
    return r > 1.15 ? 'landscape' : r < 0.87 ? 'portrait' : 'square';
  };

  return [
    `Logo: ${logo ? 'yes' : 'no'}`,
    `Usable photographs: ${images.length}`,
    ...images.slice(0, 6).map((i) => `- ${orient(i)}${i.width != null ? ` ${i.width}×${i.height}` : ''}${i.alt ? ` "${i.alt}"` : ''}`),
  ].join('\n');
}

export const SOURCE_NAME = SOURCE;