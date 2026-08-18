/**
 * Stage 4 of 6.
 *
 * Single responsibility: understand the business. It reads the canonical
 * profile and decides what the business is, who it serves, and what its site
 * therefore needs — pages, features, backend and frontend modules, SEO
 * priorities — with a rationale for each.
 *
 * Strategy only. It writes no markup, no code, and no site copy; that is the
 * writer's job, and the separation is what keeps this stage reviewable.
 *
 * This is the first agent that uses an LLM. Everything it recommends must be
 * traceable to the profile, so each recommendation carries the evidence it
 * rests on and anything the profile could not settle goes to `openQuestions`
 * rather than being invented.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import { UpstreamError } from '../lib/errors.js';
import { createModelInvoker } from '../lib/capability/invokers.js';
import type { AnalystConfig } from '../lib/config.js';
import type {
  Agent,
  AgentContext,
  BusinessProfile,
  BusinessStrategy,
  OpeningHours,
} from '../lib/types.js';

const NAME = 'businessAnalystAgent';

const ARTIFACT = 'strategy.json';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/* ------------------------------------------------------------------ */
/* Output schema                                                       */
/* ------------------------------------------------------------------ */

type JsonSchema = Record<string, unknown>;

const stringArray = (description: string): JsonSchema => ({
  type: 'array',
  description,
  items: { type: 'string' },
});

/**
 * Fields every recommendation carries.
 *
 * Structured outputs require `additionalProperties: false` and a `required`
 * list naming every property, so the shape is composed by spreading rather
 * than by `$ref` — the extended variants below add fields to it.
 */
const RECOMMENDATION_FIELDS: Record<string, JsonSchema> = {
  title: { type: 'string', description: 'Short name for the recommendation.' },
  rationale: {
    type: 'string',
    description: 'Why this is right for this business, in two or three sentences.',
  },
  priority: { type: 'string', enum: ['high', 'medium', 'low'] },
  evidence: stringArray(
    'Specific facts from the profile supporting this. Quote or name them; do not paraphrase into vagueness.',
  ),
};

const RECOMMENDATION_KEYS = Object.keys(RECOMMENDATION_FIELDS);

function objectSchema(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

function arrayOf(properties: Record<string, JsonSchema>, description: string): JsonSchema {
  return { type: 'array', description, items: objectSchema(properties) };
}

const SEGMENT_FIELDS: Record<string, JsonSchema> = {
  name: { type: 'string', description: 'Short label for this group of people.' },
  description: { type: 'string' },
  needs: stringArray('What this group is trying to accomplish on the site.'),
  rationale: { type: 'string', description: 'What in the profile points to this group.' },
};

/**
 * Exported so it can be checked against the structured-output constraints:
 * every object needs `additionalProperties: false` and a complete `required`
 * list, and the numeric/string constraint keywords are not supported.
 */
export const STRATEGY_SCHEMA: JsonSchema = objectSchema({
  businessName: { type: 'string' },
  category: objectSchema({
    primary: { type: 'string', description: 'The trade, as a customer would name it.' },
    secondary: stringArray('Adjacent categories the business also operates in.'),
    rationale: { type: 'string' },
    basis: {
      type: 'string',
      enum: ['listing', 'inferred'],
      description: '`listing` if the Maps category settled it, `inferred` if read from the site.',
    },
  }),
  goals: arrayOf(
    RECOMMENDATION_FIELDS,
    'What this business is trying to achieve, that a website can move. Commercial outcomes, not website features.',
  ),
  audience: objectSchema({
    primary: objectSchema(SEGMENT_FIELDS),
    secondary: arrayOf(SEGMENT_FIELDS, 'Other groups worth serving, in priority order.'),
  }),
  pages: arrayOf(
    {
      ...RECOMMENDATION_FIELDS,
      path: { type: 'string', description: 'Route, e.g. `/` or `/services`.' },
      sections: stringArray('Sections the page needs, in order down the page.'),
    },
    'Pages the site should have. Only pages this business can fill with real content.',
  ),
  features: arrayOf(
    RECOMMENDATION_FIELDS,
    'Capabilities a visitor can use: booking, ordering, enquiry forms, menus, galleries.',
  ),
  backendModules: arrayOf(
    { ...RECOMMENDATION_FIELDS, layer: { type: 'string', enum: ['backend'] }, dependsOn: stringArray('Titles of other recommended modules this needs.') },
    'Server-side capabilities the features require. Name the responsibility, not a library.',
  ),
  frontendModules: arrayOf(
    { ...RECOMMENDATION_FIELDS, layer: { type: 'string', enum: ['frontend'] }, dependsOn: stringArray('Titles of other recommended modules this needs.') },
    'Client-side building blocks the pages require. Name the responsibility, not a framework.',
  ),
  seoPriorities: arrayOf(
    {
      ...RECOMMENDATION_FIELDS,
      kind: { type: 'string', enum: ['local', 'content', 'technical', 'schema'] },
      targetKeywords: stringArray('Search terms this addresses, grounded in the trade and location.'),
    },
    'SEO work in priority order. For a business with a physical location, local SEO usually leads.',
  ),
  openQuestions: stringArray(
    'What the profile could not settle and the owner would have to answer. Put uncertainty here rather than guessing in a recommendation.',
  ),
});

/* ------------------------------------------------------------------ */
/* Prompt                                                              */
/* ------------------------------------------------------------------ */

const SYSTEM_PROMPT = `You are a business analyst on a team that builds websites for local businesses. You are given a factual profile of one business, assembled from its Google Maps listing and its existing website. Your job is to work out what the business is, who it serves, and what its website therefore needs to do.

You produce strategy, not implementation. Do not write website code, markup, styling, or site copy — another stage does that. Name what is needed and why; leave how it is built to the engineers, and name responsibilities rather than specific libraries or frameworks.

Ground every recommendation in the profile. The evidence field on each one names the facts it rests on, so a reader can tell an inference from a guess. Where the profile is thin, a smaller strategy that is actually supported beats a larger one that is invented — and what you could not settle belongs in openQuestions rather than in a confident recommendation.

Recommend what this business can deliver. A bakery with no online ordering today may warrant it; a bakery with no staff to run a blog does not warrant a content programme. Weigh what the profile shows about the size and nature of the operation.

Keep rationales to a few sentences. Say what the reader needs to decide with, and stop.`;

/** Renders opening hours as text, since the model reads prose better than indices. */
function formatHours(hours: readonly OpeningHours[]): string {
  if (hours.length === 0) return 'not published';
  return hours
    .map((entry) => `${DAY_NAMES[entry.dayOfWeek] ?? `day ${entry.dayOfWeek}`} ${entry.opens}-${entry.closes}`)
    .join('; ');
}

function truncate(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}\n…[truncated]`;
}

/**
 * Renders the profile as a factual brief.
 *
 * Deliberately not `JSON.stringify(profile)`: the profile carries per-field
 * alternatives and provenance that matter for auditing but only dilute the
 * model's attention here, and the page text needs bounding.
 */
export function buildBrief(profile: BusinessProfile, maxPageChars: number): string {
  const lines: string[] = [];
  const section = (heading: string, body: string): void => {
    lines.push(`## ${heading}`, body.trim() || 'none found', '');
  };

  section(
    'Identity',
    [
      `Name: ${profile.name.value}`,
      `Category (from the Maps listing): ${profile.category?.value ?? 'not listed'}`,
      `Address: ${profile.address?.value.formatted ?? 'not listed'}`,
      `Website: ${profile.website?.value ?? 'none'}`,
      `Rating: ${profile.rating?.value ?? 'not shown'}${
        profile.reviewCount?.value ? ` from ${profile.reviewCount.value} reviews` : ''
      }`,
      `Opening hours: ${formatHours(profile.hours)}`,
    ].join('\n'),
  );

  section(
    'Contact and social presence',
    [
      `Phones: ${profile.phones.map((p) => p.value.formatted).join(', ') || 'none found'}`,
      `Emails: ${profile.emails.map((e) => e.value).join(', ') || 'none found'}`,
      `Social profiles: ${
        profile.socialProfiles.map((s) => `${s.value.platform} (${s.value.url})`).join(', ') || 'none found'
      }`,
    ].join('\n'),
  );

  section(
    'Services named on the site',
    profile.services.map((service) =>
      service.description ? `- ${service.name}: ${service.description}` : `- ${service.name}`,
    ).join('\n'),
  );

  section(
    'Current site navigation',
    profile.navigation.map((link) => `- ${link.label} (${link.href})`).join('\n'),
  );

  section(
    'Existing imagery',
    [
      `Logo: ${profile.images.logo ? 'yes' : 'none found'}`,
      `Hero image: ${profile.images.hero ? 'yes' : 'none found'}`,
      `Gallery images: ${profile.images.gallery.length}`,
    ].join('\n'),
  );

  const pages = profile.pages
    .map((page) => `### ${page.title ?? page.url}\n${page.url}\n\n${truncate(page.text, maxPageChars)}`)
    .join('\n\n');
  section('Text from the current website', pages);

  // The gaps are as informative as the facts: a missing phone number or an
  // absent services page is itself a finding about the business.
  section(
    'Known gaps in this profile',
    profile.validation.issues.map((issue) => `- [${issue.severity}] ${issue.field}: ${issue.message}`).join('\n'),
  );

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Response handling                                                   */
/* ------------------------------------------------------------------ */

/**
 * Checks the shape the schema was supposed to guarantee.
 *
 * Structured outputs make a malformed response unlikely rather than
 * impossible — a truncated stream still parses as nothing useful — and this
 * turns that into one clear error instead of an undefined deep in the writer.
 */
function assertStrategyShape(value: unknown): asserts value is Omit<BusinessStrategy, 'model' | 'generatedAt'> {
  const required = [
    'businessName',
    'category',
    'goals',
    'audience',
    'pages',
    'features',
    'backendModules',
    'frontendModules',
    'seoPriorities',
    'openQuestions',
  ];

  if (typeof value !== 'object' || value === null) {
    throw new UpstreamError('Model returned a non-object strategy', { source: NAME, retryable: true });
  }

  const record = value as Record<string, unknown>;
  const missing = required.filter((key) => record[key] === undefined);
  if (missing.length > 0) {
    throw new UpstreamError(`Model omitted strategy fields: ${missing.join(', ')}`, {
      source: NAME,
      retryable: true,
    });
  }
}

/* ------------------------------------------------------------------ */
/* Analysis                                                            */
/* ------------------------------------------------------------------ */

/**
 * Asks the capability planner for one strategy object.
 *
 * Everything vendor-shaped has moved below this line, and now so has vendor
 * *choice*: `ctx.platform.ai()` used to hand this agent a single provider —
 * whichever `AI_PROVIDER` names — with no recourse if it failed. `reasoning`
 * routes through every credentialled vendor this deployment has, free-tier
 * allowance first, so a Gemini outage or an exhausted daily quota now fails
 * over to OpenAI instead of failing the stage. `ANALYST_MODEL` still pins the
 * id for whichever vendor `AI_PROVIDER` names — see `modelOverrides` on
 * `ModelInvocation` — but a vendor reached only by failover uses the
 * capability catalogue's own default for its class, because no pin was ever
 * written for it.
 *
 * What stays here is what is genuinely the analyst's: the prompt, the schema,
 * and the check that the object it got back is the one it asked for.
 */
async function analyse(
  brief: string,
  ctx: AgentContext,
  config: AnalystConfig,
): Promise<{ strategy: Omit<BusinessStrategy, 'model' | 'generatedAt'>; model: string; provider: string }> {
  const invoke = createModelInvoker(
    {
      system: SYSTEM_PROMPT,
      prompt: `Here is the profile of one business. Produce the website strategy.\n\n${brief}`,
      schema: STRATEGY_SCHEMA,
      schemaName: 'business_strategy',
      maxTokens: config.maxOutputTokens,
      signal: ctx.signal,
      effort: config.effort,
      modelOverrides: { [ctx.config.ai.provider]: config.model },
    },
    ctx.platform.providers,
    ctx.logger,
  );

  const { outcome, record } = await ctx.platform.capabilities.run('reasoning', invoke, {
    tokens: { inputTokens: brief.length / 4, outputTokens: config.maxOutputTokens },
  });

  if (!outcome.ok) {
    // Every attempt the chain made is in `record.attempts`; the outcome's
    // error is the last one, which is what a caller can actually act on.
    throw new UpstreamError(outcome.error.message, {
      source: NAME,
      retryable: outcome.error.retryable,
      cause: outcome.error,
    });
  }

  const result = outcome.data;
  const servedProvider = record.attempts.find((a) => a.service === record.servedBy)?.provider ?? 'unknown';

  ctx.logger.debug('analysis returned', {
    provider: servedProvider,
    model: result.model,
    structuredOutput: result.structuredOutput,
    finishReason: result.finishReason,
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    attempts: record.attempts.length,
    degraded: record.degraded,
  });

  assertStrategyShape(result.data);
  // `result.model` rather than the configured id: a fallback or a routing
  // decision may have put this on a different model than the one requested.
  return { strategy: result.data, model: result.model, provider: servedProvider };
}

/* ------------------------------------------------------------------ */
/* Agent                                                               */
/* ------------------------------------------------------------------ */

export interface BusinessAnalystAgent extends Agent<BusinessProfile, BusinessStrategy> {}

export const businessAnalystAgent: BusinessAnalystAgent = {
  name: NAME,
  description: 'Decides what the business is, who it serves, and what its site needs.',

  async run(input: BusinessProfile, ctx: AgentContext): Promise<BusinessStrategy> {
    const { logger, config } = ctx;
    const analyst = config.analyst;

    const brief = buildBrief(input, analyst.maxPageChars);

    // Which vendor actually serves this is now the capability planner's
    // decision, not a fixed choice — logged once the call returns rather than
    // asserted here, because a failover means the answer is not known yet.
    const plan = ctx.platform.capabilities.plan('reasoning');
    logger.info('analysis started', {
      business: input.name.value,
      plannedChain: plan.chain.map((step) => step.binding.id),
      pinnedModel: analyst.model,
      effort: analyst.effort,
      briefChars: brief.length,
    });

    const { strategy, model, provider } = await logger.time('analyse business', () =>
      analyse(brief, ctx, analyst),
    );
    logger.info('analysis served', { provider, model });

    const result: BusinessStrategy = {
      ...strategy,
      model,
      generatedAt: new Date().toISOString(),
    };

    const filePath = path.join(ctx.outputDir, ARTIFACT);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

    // An empty recommendation list is a real answer for a thin profile, but it
    // should be visible rather than quietly shipped to the writer.
    const empty = (
      [
        ['goals', result.goals],
        ['pages', result.pages],
        ['features', result.features],
        ['backendModules', result.backendModules],
        ['frontendModules', result.frontendModules],
        ['seoPriorities', result.seoPriorities],
      ] as const
    )
      .filter(([, value]) => value.length === 0)
      .map(([key]) => key);
    if (empty.length > 0) logger.warn('strategy sections came back empty', { empty });

    logger.info('analysis finished', {
      category: result.category.primary,
      goals: result.goals.length,
      pages: result.pages.length,
      features: result.features.length,
      backendModules: result.backendModules.length,
      frontendModules: result.frontendModules.length,
      seoPriorities: result.seoPriorities.length,
      openQuestions: result.openQuestions.length,
      artifact: filePath,
    });

    return result;
  },
};
