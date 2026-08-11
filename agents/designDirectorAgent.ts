/**
 * Design Director Agent — Stage 5a of 6.
 *
 * Single responsibility: decide what the website should feel and look like.
 *
 * This is the AI Art Director. It reads the business profile, strategy and
 * website content, then produces a structured `DesignDirective` — a set of
 * high-level visual decisions expressed in the closed V1 vocabulary.
 *
 * What this agent does:
 *   - Builds a concise, fact-grounded design brief from the supplied inputs.
 *   - Sends that brief to the platform's AI provider.
 *   - Validates and returns the structured `DesignDirective`.
 *
 * What this agent does NOT do:
 *   - Generate CSS, HTML, tokens, or pixel values.
 *   - Browse the web, scrape pages, or call external APIs.
 *   - Invent business facts not present in the inputs.
 *   - Call vendor SDKs directly — everything goes through `ctx.platform.ai()`.
 *   - Modify `composeDesign`, `WebsiteDesign`, or the renderer.
 *   - Fall back to a canned directive. There is no fallback: a failed call is a
 *     failed stage, and the caller decides what that means.
 *
 * Architecture:
 *
 *   BusinessProfile + BusinessStrategy + WebsiteContent
 *         ↓
 *   designDirectorAgent (this file)
 *         ↓
 *   DesignDirective (validated)
 *         ↓
 *   applyDirective() → composeDesign() → WebsiteDesign → Renderer
 */

import { UpstreamError } from '../lib/errors.js';
import type { AIProvider } from '../lib/ai/types.js';
import type { DirectorConfig } from '../lib/config.js';
import type { Logger } from '../lib/logger.js';
import type {
  Agent,
  AgentContext,
  BusinessProfile,
  BusinessStrategy,
  WebsiteContent,
} from '../lib/types.js';
import type { DesignDirective } from '../lib/design/directive.js';
import type { JsonSchema } from '../lib/ai/types.js';
import { subjectOf } from '../lib/art/direction.js';
import type { ImageAsset } from '../lib/types.js';

const NAME = 'designDirectorAgent';

/* ------------------------------------------------------------------ */
/* Input / output types                                                */
/* ------------------------------------------------------------------ */

export interface DesignDirectorInput {
  readonly profile: BusinessProfile;
  readonly strategy: BusinessStrategy;
  readonly content: WebsiteContent;
}

export interface DesignDirectorAgent extends Agent<DesignDirectorInput, DesignDirective> {}

/* ------------------------------------------------------------------ */
/* Output schema                                                       */
/* ------------------------------------------------------------------ */

/**
 * JSON Schema for the structured `DesignDirective`.
 *
 * All enum values match the closed sets in the V1 contract:
 * - `direction` → DesignDirection
 * - `density`   → VisualDensity
 * - `colorStrategy` → ColorStrategy
 * - `typographyIntent.preference` → 'serif' | 'sans'
 * - `heroIntent.preference` → HeroVariant
 * - `imageryIntent.treatment` → ImageTreatment
 * - `accessibilityTarget` → 'AA' | 'AAA'
 *
 * The schema uses `additionalProperties: false` so the model cannot inject
 * fields outside the contract (no CSS, no token values, no raw measurements).
 */
export const DIRECTIVE_SCHEMA: JsonSchema = {
  type: 'object',
  required: [
    'direction',
    'visualIntent',
    'density',
    'heroIntent',
    'layoutIntent',
    'colorStrategy',
    'typographyIntent',
    'imageryIntent',
    'accessibilityTarget',
    'rationale',
    'confidence',
  ],
  additionalProperties: false,
  properties: {
    direction: {
      type: 'string',
      enum: [
        'minimal', 'luxury', 'corporate', 'elegant', 'modern', 'editorial',
        'creative', 'playful', 'bold', 'premium', 'friendly',
      ],
      description: 'The overall visual design direction. Choose the one that best fits the business.',
    },
    visualIntent: {
      type: 'string',
      description: 'One sentence describing the intended visual feel. Not a CSS instruction.',
    },
    density: {
      type: 'string',
      enum: ['airy', 'balanced', 'dense'],
      description: 'How much visual breathing room the layout should have.',
    },
    heroIntent: {
      type: 'object',
      required: ['preference', 'intent'],
      additionalProperties: false,
      properties: {
        preference: {
          type: 'string',
          enum: ['centered', 'split', 'editorial', 'image-first', 'full-bleed', 'magazine', 'minimal'],
          description: 'Preferred hero layout structure.',
        },
        intent: {
          type: 'string',
          description: 'One sentence explaining why this hero structure fits the business.',
        },
      },
    },
    layoutIntent: {
      type: 'string',
      description: 'One sentence describing the intended spatial feel of the layout.',
    },
    colorStrategy: {
      type: 'string',
      enum: ['brand-led', 'neutral', 'high-contrast'],
      description: 'High-level color approach: brand-led, neutral, or high-contrast for accessibility.',
    },
    typographyIntent: {
      type: 'object',
      required: ['intent', 'preference'],
      additionalProperties: false,
      properties: {
        intent: {
          type: 'string',
          description: 'One sentence describing the typographic goal.',
        },
        preference: {
          type: 'string',
          enum: ['serif', 'sans'],
          description: 'Typeface character class hint. The design system picks the actual typeface.',
        },
      },
    },
    imageryIntent: {
      type: 'object',
      required: ['intent', 'treatment'],
      additionalProperties: false,
      properties: {
        intent: {
          type: 'string',
          description: 'One sentence describing the imagery goal.',
        },
        treatment: {
          type: 'string',
          enum: ['natural', 'warm', 'cool', 'monochrome', 'muted'],
          description: 'Image treatment hint. The theme owns the final treatment in V1.',
        },
      },
    },
    accessibilityTarget: {
      type: 'string',
      enum: ['AA', 'AAA'],
      description: 'Target WCAG conformance level.',
    },
    experienceIntent: {
      type: 'object',
      required: ['mode', 'moment', 'momentIntent', 'transitionAtMoment'],
      additionalProperties: false,
      description:
        'Whether one section of this specific page deserves outsized emphasis. '
        + 'Most businesses have no such section — "standard" is the common, correct '
        + 'answer, not a fallback. Only choose "moment-led" when the business has a '
        + 'genuine reason (real photography, a real fact, a real story) for one section '
        + 'to lead the page, and only nominate a section kind actually present in the '
        + '"Content sections" list above.',
      properties: {
        mode: {
          type: 'string',
          enum: ['standard', 'moment-led'],
          description: 'standard: no section is emphasised beyond the deterministic default. moment-led: one is.',
        },
        moment: {
          type: 'string',
          enum: [
            'hero', 'statement', 'about', 'services', 'menu', 'gallery',
            'testimonials', 'hours', 'location', 'contact', 'cta', 'faq',
          ],
          description:
            'The section kind that would be emphasised if mode were "moment-led" — a kind that '
            + 'appears in the "Content sections" list in the brief, never one this business does not '
            + 'have. Ignored by the deterministic system when mode is "standard"; pick any real kind '
            + 'from the brief rather than leaving this unconsidered.',
        },
        momentIntent: {
          type: 'string',
          description:
            'One concise sentence: why the nominated section would earn emphasis. Ignored by the '
            + 'deterministic system when mode is "standard".',
        },
        transitionAtMoment: {
          type: 'boolean',
          description:
            'Whether a brief visual transition should mark entry to the moment section. '
            + 'False when mode is "standard".',
        },
      },
    },
    experienceMode: {
      type: 'string',
      enum: ['brochure', 'showcase', 'narrative', 'immersive'],
      description:
        'The page\'s overall shape. brochure: a clear functional directory (a plumber, a notary). '
        + 'showcase: the business leads with imagery, the gallery is the subject. narrative: the evidence '
        + 'supports an arc built to a signature moment. immersive: a continuous scroll experience (rare; '
        + 'the renderer caps this at narrative today). Choose from the IMAGE CONTENT SIGNALS and character, '
        + 'not the category — a venue with a dramatic room and varied photography earns narrative; a trade '
        + 'with a logo does not.',
    },
    signatureMoment: {
      type: 'string',
      enum: ['hero', 'statement', 'about', 'services', 'menu', 'gallery', 'testimonials', 'hours', 'location', 'contact', 'cta', 'faq'],
      description: 'The one section the experience builds to. Must be a kind present in "Content sections". Ignored when experienceMode is brochure.',
    },
    pacing: {
      type: 'string',
      enum: ['restrained', 'measured', 'cinematic', 'immersive'],
      description: 'How much room the page gives each beat. Advisory this version.',
    },
    imageryStrategy: {
      type: 'string',
      enum: ['functional', 'editorial', 'gallery-led', 'hero-led', 'atmospheric'],
      description: 'How photography is used, from the image signals. Advisory this version.',
    },
    interactionStrategy: {
      type: 'string',
      enum: ['static', 'subtle', 'guided', 'immersive'],
      description: 'How much the page moves. Conservative by default; immersive is capped at guided by the renderer.',
    },
    conversionStrategy: {
      type: 'string',
      enum: ['direct', 'editorial', 'balanced', 'high-intent'],
      description:
        'The conversion posture. high-intent: press the action early (a mechanic, an emergency trade). '
        + 'editorial: earn the visitor first, ask at the end (a wedding venue, a boutique hotel). '
        + 'balanced/direct in between.',
    },
    rationale: {
      type: 'string',
      description: 'Two to four sentences explaining the overall visual strategy and its relationship to the business.',
    },
    confidence: {
      type: 'number',
      description: 'How strongly the available evidence supports these decisions, from 0 to 1. Reflect evidence quality, not decision quality.',
    },
  },
};

/* ------------------------------------------------------------------ */
/* System prompt                                                       */
/* ------------------------------------------------------------------ */

export const SYSTEM_PROMPT = `You are the Design Director for an autonomous website generation system.

Your responsibility is to determine the visual direction of a website from verified business information. Think like a senior Art Director, brand designer, and digital product designer.

Do not design CSS. Do not choose arbitrary pixel values. Do not invent facts about the business. Do not imitate or copy a specific website.

Make decisions based on:
- Business category and trade
- Positioning and competitive context
- Target audience and their expectations
- Business goals and conversion requirements
- Brand voice described in the content
- Available imagery (logo, hero, gallery)
- Content hierarchy and section structure
- Accessibility requirements

Prefer coherent systems over isolated visual tricks. Every decision you make should reinforce the others — direction, density, typography and imagery should read as a single visual strategy, not a collection of unrelated preferences.

When evidence is weak, use conservative design decisions and lower confidence rather than inventing brand characteristics. A thin profile warrants a restrained, broadly-applicable direction rather than a bold or distinctive one.

Separately, decide whether this specific business has one section worth building emphasis around — a real photograph, a real fact, a real story that would be diminished by equal treatment with every other section. This is experienceIntent. Most businesses do not have this: a plumber, an accountant, a law firm usually should get mode "standard", and that is the correct, unremarkable answer, not a failure to find something more exciting. Only choose "moment-led" when the evidence genuinely supports it, and only nominate a section kind that already appears in the brief's "Content sections" list — never invent one, never nominate a kind this business's content does not have.

Decide the experience architecture from the IMAGE CONTENT SIGNALS and the business character, not from the category. Set experienceMode (brochure/showcase/narrative/immersive), a signatureMoment (a section actually present), conversionStrategy (how hard and when to ask for the action), and interactionStrategy (how much the page moves). A business with several varied, atmospheric photographs and an emotional register earns a narrative built to a signature moment; a functional trade with a logo earns a brochure that presses the action early. Never invent photographs or facts to justify a richer mode — if the images are thin, the honest mode is the plainer one, and a strong deterministic floor will still produce an intentional page. These decisions are validated against closed sets and override the deterministic floor only when valid.

The output must be implementable by a deterministic design system. You are choosing from closed sets of options — do not suggest values outside the listed enums. Do not output CSS, pixel values, colour hex codes, spacing values, font sizes, Tailwind classes, or any renderer instruction.`;

/* ------------------------------------------------------------------ */
/* Brief builder                                                       */
/* ------------------------------------------------------------------ */

function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}\n…[truncated]`;
}

/** Hosts whose images are the business's own social/directory posts — usable but rights-unconfirmed. */
const REFERENCE_HOSTS = ['facebook', 'fbcdn', 'instagram', 'cdninstagram', 'honeypot', 'restaurantguru', 'weddingo', 'googleusercontent', 'ggpht'];

/**
 * Describes the business's photography as content signals, not a count.
 *
 * Deterministic — dimensions, orientation, a subject tag from `lib/art`, and a
 * rights heuristic from the host. No vision model is required; the contract is
 * shaped so a vision-derived `visual category / atmosphere / brightness / quality`
 * can be appended later without changing the Director's schema.
 */
function describeImageSignals(profile: BusinessProfile): string {
  const logo = profile.images.logo !== null;
  const images: readonly ImageAsset[] = [
    ...(profile.images.hero !== null ? [profile.images.hero] : []),
    ...profile.images.gallery,
  ].filter((i) => i.role !== 'logo' && i.role !== 'favicon');

  if (images.length === 0) {
    return `Logo: ${logo ? 'yes' : 'no'}\nUsable photographs: 0 — a text-led page; do not force a gallery or an image-led hero.`;
  }

  const orient = (i: ImageAsset): string => {
    if (i.width == null || i.height == null || i.height === 0) return 'unknown';
    const r = i.width / i.height;
    return r > 1.15 ? 'landscape' : r < 0.87 ? 'portrait' : 'square';
  };
  const rights = (i: ImageAsset): string => {
    const host = `${(() => { try { return new URL(i.url).host; } catch { return ''; } })()} ${(() => { try { return new URL(i.sourceUrl).host; } catch { return ''; } })()}`.toLowerCase();
    return REFERENCE_HOSTS.some((h) => host.includes(h)) ? 'reference-only(rights?)' : 'usable';
  };

  const orientations = new Set(images.map(orient));
  const refOnly = images.filter((i) => rights(i) === 'reference-only(rights?)').length;
  const lines = images.slice(0, 12).map((i, n) => {
    const dims = i.width != null && i.height != null ? `${i.width}x${i.height}` : 'unknown';
    return `- #${n + 1} ${i === profile.images.hero ? '(hero)' : '(gallery)'} ${dims} ${orient(i)} subject:${subjectOf(i)} ${rights(i)}`
      + (i.alt ? ` alt:"${truncate(i.alt, 60)}"` : '');
  });

  return [
    `Logo: ${logo ? 'yes' : 'no'}`,
    `Usable photographs: ${images.length} across ${orientations.size} framing(s) (${[...orientations].sort().join(', ')})`,
    refOnly > 0 ? `${refOnly} are reference-only (rights unconfirmed) — usable as placeholders, flag for replacement.` : 'Rights: own-source, usable.',
    'Per image:',
    ...lines,
  ].join('\n');
}

/**
 * Builds a concise, fact-grounded design brief from the pipeline inputs.
 *
 * Deliberately avoids dumping raw JSON. The brief emphasises signal that
 * informs visual decisions: category, positioning, audience, voice, imagery,
 * content structure. Operational detail (backend modules, SEO priorities,
 * open questions) is omitted — it is irrelevant to art direction.
 */
export function buildDesignBrief(
  profile: BusinessProfile,
  strategy: BusinessStrategy,
  content: WebsiteContent,
  maxPageChars: number,
): string {
  const lines: string[] = [];
  const section = (heading: string, body: string): void => {
    lines.push(`## ${heading}`, body.trim() || 'none', '');
  };

  // Business identity
  section(
    'Business',
    [
      `Name: ${profile.name.value}`,
      `Primary category: ${strategy.category.primary}`,
      strategy.category.secondary.length > 0
        ? `Adjacent categories: ${strategy.category.secondary.join(', ')}`
        : null,
      `Category basis: ${strategy.category.basis}`,
      profile.rating !== null
        ? `Rating: ${profile.rating.value}${profile.reviewCount !== null ? ` (${profile.reviewCount.value} reviews)` : ''}`
        : null,
    ].filter(Boolean).join('\n'),
  );

  // Positioning and goals
  const goalLines = strategy.goals.slice(0, 4).map((g) => `- [${g.priority}] ${g.title}: ${g.rationale}`);
  section('Business goals', goalLines.join('\n') || 'none described');

  // Target audience
  const { primary, secondary } = strategy.audience;
  const audienceLines = [
    `Primary audience: ${primary.name} — ${primary.description}`,
    `  Their needs: ${primary.needs.join('; ')}`,
    ...secondary.slice(0, 2).map((s) => `Secondary: ${s.name} — ${s.description}`),
  ];
  section('Target audience', audienceLines.join('\n'));

  // Brand voice from content
  section(
    'Brand voice',
    [
      `Tone: ${content.voice.tone}`,
      `Palette words: ${content.voice.palette.join(', ') || 'none'}`,
      `Heading typeface signal: ${content.voice.typography.heading || 'none'}`,
      `Body typeface signal: ${content.voice.typography.body || 'none'}`,
    ].join('\n'),
  );

  // Tagline / headline intent
  section('Tagline', content.tagline || 'none');

  // Image content signals — not just counts. Deterministic, from metadata:
  // dimensions, orientation, subject tag, and a rights heuristic from the host.
  // This is what lets the Director reason about experience mode and imagery
  // strategy rather than guessing from a number.
  section('Image content signals', describeImageSignals(profile));

  // Content structure — section kinds and headings
  const sectionLines = content.sections.map(
    (s) => `- [${s.kind}] ${s.heading}${s.subheading ? ` / ${s.subheading}` : ''}`,
  );
  section('Content sections (in order)', sectionLines.join('\n') || 'none');

  // Page structure from strategy
  const pageLines = strategy.pages.slice(0, 6).map((p) => `- ${p.path}: ${p.title}`);
  section('Recommended pages', pageLines.join('\n') || 'none');

  // Services / products
  const serviceLines = profile.services.slice(0, 10).map((s) =>
    s.description ? `- ${s.name}: ${s.description}` : `- ${s.name}`,
  );
  section('Services / products', serviceLines.join('\n') || 'none listed');

  // Sample page text (for additional context, bounded)
  const pageTexts = profile.pages
    .slice(0, 2)
    .map((p) => `### ${p.title ?? p.url}\n${truncate(p.text, maxPageChars)}`)
    .join('\n\n');
  if (pageTexts) {
    section('Existing website text (excerpt)', pageTexts);
  }

  // Known gaps
  const gapLines = [
    ...profile.validation.issues.map((i) => `- [${i.severity}] ${i.field}: ${i.message}`),
    ...content.unresolvedGaps.slice(0, 5).map((g) => `- ${g}`),
  ];
  section('Known gaps / uncertainties', gapLines.join('\n') || 'none');

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Response validation                                                 */
/* ------------------------------------------------------------------ */

/**
 * Checks that the model returned a plausible `DesignDirective`.
 *
 * The schema is enforced by the provider adapter; this adds a semantic check:
 * confidence must be in [0, 1]. Any structural failure here is retryable
 * because it reflects a provider-side truncation or refusal, not a code bug.
 */
function assertDirectiveShape(value: unknown): asserts value is DesignDirective {
  if (typeof value !== 'object' || value === null) {
    throw new UpstreamError('Model returned a non-object directive', {
      source: NAME,
      retryable: true,
    });
  }
  const record = value as Record<string, unknown>;

  const required = [
    'direction', 'visualIntent', 'density', 'heroIntent', 'layoutIntent',
    'colorStrategy', 'typographyIntent', 'imageryIntent',
    'accessibilityTarget', 'rationale', 'confidence',
  ];
  const missing = required.filter((k) => record[k] === undefined);
  if (missing.length > 0) {
    throw new UpstreamError(
      `Model omitted directive fields: ${missing.join(', ')}`,
      { source: NAME, retryable: true },
    );
  }

  const confidence = record['confidence'];
  if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
    throw new UpstreamError(
      `Model returned out-of-range confidence: ${String(confidence)}`,
      { source: NAME, retryable: true },
    );
  }
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

/**
 * What the call cost and where it came from, for the run's audit trail.
 *
 * Carried out of the agent rather than only logged, because a smoke test — or
 * an orchestrator deciding whether a stage may be retried — has to be able to
 * assert on the provider, the model that actually served the request, and the
 * token spend without parsing log lines.
 */
export interface DirectorProvenance {
  readonly provider: string;
  /** The model that actually served the request, which may differ from the ask. */
  readonly model: string;
  readonly requestedModel: string;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly structuredOutput: string;
  readonly finishReason: string | null;
  /** The provider's own id for this request, where it offers one. */
  readonly requestId: string | null;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly durationMs: number;
}

/** The directive plus everything needed to prove where it came from. */
export interface DirectorResult {
  readonly directive: DesignDirective;
  readonly provenance: DirectorProvenance;
}

async function direct(
  brief: string,
  provider: AIProvider,
  config: DirectorConfig,
  logger: Logger,
  signal: AbortSignal,
): Promise<DirectorResult> {
  const startedAt = new Date();

  let result;
  try {
    result = await provider.generate({
      system: SYSTEM_PROMPT,
      prompt: `Here is the business brief. Produce a DesignDirective for this website.\n\n${brief}`,
      schema: DIRECTIVE_SCHEMA,
      schemaName: 'design_directive',
      model: config.model,
      effort: config.effort,
      maxTokens: config.maxOutputTokens,
      signal,
    });
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    throw new UpstreamError(
      error instanceof Error ? error.message : String(error),
      { source: NAME, retryable: false, cause: error },
    );
  }

  const finishedAt = new Date();

  logger.debug('directive returned', {
    provider: provider.name,
    model: result.model,
    structuredOutput: result.structuredOutput,
    finishReason: result.finishReason,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
  });

  assertDirectiveShape(result.data);

  return {
    directive: result.data,
    provenance: {
      provider: provider.name,
      model: result.model,
      requestedModel: config.model,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      structuredOutput: result.structuredOutput,
      finishReason: result.finishReason,
      requestId: result.requestId ?? null,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Agent                                                               */
/* ------------------------------------------------------------------ */

/**
 * The directive with its provenance, for callers that need the audit trail.
 *
 * `designDirectorAgent.run` returns only the directive, because `Agent<I, O>`
 * has one output and the pipeline only wants the decision. A caller that has to
 * *prove* the decision came from a live model — the smoke harness, and later the
 * orchestrator's artifact writer — calls this instead.
 */
export async function directDesign(
  input: DesignDirectorInput,
  ctx: AgentContext,
): Promise<DirectorResult> {
  const { logger, config } = ctx;
  const directorConfig = config.director;

  const provider = ctx.platform.ai();

  const brief = buildDesignBrief(
    input.profile,
    input.strategy,
    input.content,
    directorConfig.maxPageChars,
  );

  logger.info('design direction started', {
    business: input.profile.name.value,
    provider: provider.name,
    model: directorConfig.model,
    effort: directorConfig.effort,
    maxOutputTokens: directorConfig.maxOutputTokens,
    briefChars: brief.length,
  });

  const result = await logger.time('direct design', () =>
    direct(brief, provider, directorConfig, logger, ctx.signal),
  );

  const { directive, provenance } = result;

  logger.info('design direction finished', {
    direction: directive.direction,
    colorStrategy: directive.colorStrategy,
    density: directive.density,
    accessibilityTarget: directive.accessibilityTarget,
    confidence: directive.confidence,
    model: provenance.model,
    inputTokens: provenance.inputTokens,
    outputTokens: provenance.outputTokens,
    requestId: provenance.requestId,
  });

  if (directive.confidence !== undefined && directive.confidence < 0.5) {
    logger.warn('design directive confidence is below 0.5', {
      confidence: directive.confidence,
      rationale: directive.rationale,
    });
  }

  return result;
}

export const designDirectorAgent: DesignDirectorAgent = {
  name: NAME,
  description: 'AI Art Director: decides what the website should feel and look like.',

  async run(input: DesignDirectorInput, ctx: AgentContext): Promise<DesignDirective> {
    const { directive } = await directDesign(input, ctx);
    return directive;
  },
};
