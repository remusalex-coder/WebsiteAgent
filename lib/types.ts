/**
 * Domain contracts for the pipeline.
 *
 * These types are the only thing agents share. An agent may never import
 * another agent — it consumes the previous stage's output type and produces
 * the next stage's input type. That is what keeps each stage replaceable.
 *
 *   mapsUrl -> DiscoveryResult -> CollectedBusiness -> WebsiteContent -> DeploymentResult
 */

import type { AppConfig } from './config.js';
import type { Logger } from './logger.js';
import type { BrowserSession } from './browser.js';
import type { Platform } from './platform/platform.js';
import type { ListingReview } from './sources/types.js';

/**
 * A customer's words, defined with the source contracts and re-exported here.
 *
 * Same arrangement as `WebsiteDesign`: the type belongs beside the code that
 * produces it, and every pipeline contract still reads in one file.
 */
export type { ListingReview } from './sources/types.js';

/* ------------------------------------------------------------------ */
/* Agent contract                                                      */
/* ------------------------------------------------------------------ */

/**
 * Everything an agent is allowed to reach for. Agents take no ambient
 * dependencies: no direct `process.env`, no module-level singletons, no
 * `console`. This is what makes them testable in isolation.
 */
export interface AgentContext {
  /** Correlates every log line and output artifact from a single run. */
  readonly runId: string;
  readonly config: AppConfig;
  /** Already scoped to the agent's name by the orchestrator. */
  readonly logger: Logger;
  /**
   * Lazily opens (and caches) the shared browser session. Agents that never
   * call this never pay the cost of launching a browser.
   */
  readonly getBrowser: () => Promise<BrowserSession>;
  /**
   * Every pluggable capability: AI providers, skills, MCP servers.
   *
   * An agent asks for a capability and gets one; it never learns which vendor,
   * library or endpoint is behind it. That is what lets a provider be swapped,
   * a skill be implemented, or a server be added without any agent changing.
   */
  readonly platform: Platform;
  /** Absolute path to this run's artifact directory under `/output`. */
  readonly outputDir: string;
  /** Aborts long-running work when the pipeline is cancelled or times out. */
  readonly signal: AbortSignal;
}

/**
 * One responsibility, one transform. Every agent in `/agents` implements this
 * and nothing else.
 */
export interface Agent<TInput, TOutput> {
  /** Stable identifier, used for logging scope and artifact filenames. */
  readonly name: string;
  /** One line describing the single responsibility this agent owns. */
  readonly description: string;
  run(input: TInput, ctx: AgentContext): Promise<TOutput>;
}

/* ------------------------------------------------------------------ */
/* Stage 1 — discovery                                                 */
/* ------------------------------------------------------------------ */

export interface DiscoveryInput {
  /** The single input to the whole system. Any Maps URL form, incl. short links. */
  readonly mapsUrl: string;
}

export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

export interface OpeningHours {
  /** 0 = Sunday. */
  readonly dayOfWeek: number;
  /** `HH:mm`, 24h, in the venue's local time. */
  readonly opens: string;
  readonly closes: string;
}

/** Social profiles linked from the listing. `null` means "not found". */
export interface SocialLinks {
  readonly instagram: string | null;
  readonly facebook: string | null;
  readonly tiktok: string | null;
}

/**
 * Everything readable from the Maps listing itself. Enough to go and fetch
 * the rest — no descriptive content, no prose.
 *
 * Every field except `name` is nullable: a listing that omits a phone number
 * is normal, not an error.
 */
export interface DiscoveryResult {
  /** The URL as supplied by the caller, before redirects. */
  readonly sourceUrl: string;
  /** The Maps URL actually landed on, after redirects. */
  readonly canonicalUrl: string;
  /** Google's place identifier, when it can be extracted. */
  readonly placeId: string | null;
  readonly name: string;
  /** Primary category as Maps labels it, e.g. "Italian restaurant". */
  readonly category: string | null;
  readonly address: string | null;
  readonly phone: string | null;
  /** Official site linked from the listing, if any — a seed for the collector. */
  readonly website: string | null;
  readonly coordinates: GeoPoint | null;
  readonly rating: number | null;
  readonly reviewCount: number | null;
  readonly hours: readonly OpeningHours[];
  readonly socialLinks: SocialLinks;
  /** Other external links found on the listing: Yelp, delivery apps, etc. */
  readonly relatedLinks: readonly string[];
  /** ISO 8601. */
  readonly discoveredAt: string;
}

/* ------------------------------------------------------------------ */
/* Stage 2 — collection                                                */
/* ------------------------------------------------------------------ */

/**
 * Everything the collector emits is traceable: `sourceUrl` is the page the
 * value was read from, never the business's homepage by default. A writer that
 * cannot cite a fact must not use it.
 */
export interface Sourced {
  readonly sourceUrl: string;
}

export type ImageRole = 'logo' | 'favicon' | 'hero' | 'gallery';

export interface ImageAsset extends Sourced {
  /** Absolute URL, as resolved by the browser. */
  readonly url: string;
  readonly role: ImageRole;
  readonly alt: string | null;
  /** Intrinsic size when the browser reported one. */
  readonly width: number | null;
  readonly height: number | null;
  /** Path under the output directory once downloaded, e.g. `assets/logo-a1b2.png`. */
  readonly localPath: string | null;
  readonly bytes: number | null;
}

export interface NavigationLink extends Sourced {
  /** Link text, verbatim. */
  readonly label: string;
  readonly href: string;
  /** False for links leaving the business's own domain. */
  readonly internal: boolean;
}

/**
 * A service, product or menu item named on the site. Both fields are copied
 * verbatim — the collector never writes or paraphrases.
 */
export interface ServiceItem extends Sourced {
  readonly name: string;
  readonly description: string | null;
}

/** An email address or phone number, as published on the page. */
export interface ContactPoint extends Sourced {
  readonly value: string;
}

export interface SocialProfile extends Sourced {
  /** `instagram`, `facebook`, `tiktok`, `linkedin`, … or `other`. */
  readonly platform: string;
  readonly url: string;
}

/** The visible text of one page, unmodified. */
export interface PageText {
  readonly url: string;
  readonly title: string | null;
  /** `innerText` of the body: what a sighted visitor would read. */
  readonly text: string;
}

/**
 * A property the listing states about the business — "Wheelchair-accessible
 * entrance", "Free Wi-Fi", "Identifies as women-owned".
 *
 * `group` is the heading it appeared under, so an amenity is never presented as
 * a credential. `available` is the whole point of the type: a listing renders
 * what a business *lacks* alongside what it has, and a harvester that dropped
 * the distinction would turn "Pool unavailable" into a claimed swimming pool.
 */
export interface BusinessAttribute extends Sourced {
  /** Heading the attribute sat under, e.g. "Accessibility", "Amenities". */
  readonly group: string;
  readonly label: string;
  readonly available: boolean;
}

/**
 * Raw, unedited facts gathered from the sources available for this business.
 *
 * Name, hours, rating and review count already live on `identity` — this is
 * what the *content* sources add. Nothing here is generated: every string was
 * present on a page, and every one carries its source.
 *
 * Two sources feed it today, and neither is required: the business's own
 * website, and the Maps listing read as content rather than as identity. A
 * business with no website is thin, not empty.
 */
export interface CollectedBusiness {
  readonly identity: DiscoveryResult;
  /** The site actually crawled, or `null` when the listing had no website. */
  readonly siteUrl: string | null;
  readonly pages: readonly PageText[];
  /**
   * Properties the listing states, including the ones it states are absent.
   * Nothing downstream may assert one without checking `available`.
   */
  readonly attributes: readonly BusinessAttribute[];
  /**
   * The listing's own description of the business, verbatim, when it carries
   * one. Google writes these editorially; they are public, factual and are the
   * only prose available at all for a business with no website.
   */
  readonly listingDescription: string | null;
  /**
   * Customer reviews, verbatim and attributed, from whichever source could
   * quote them.
   *
   * Empty is the normal case and always has been: no source the platform had
   * before the Places API could serve a single one.
   */
  readonly reviews: readonly ListingReview[];
  /** Opening times a content source stated, which `identity.hours` may not have. */
  readonly listingHours: readonly OpeningHours[];
  /** Aggregate rating a content source stated, out of five. */
  readonly listingRating: number | null;
  /** How many ratings that average covers. A signed-out pane never says. */
  readonly listingReviewCount: number | null;
  readonly logo: ImageAsset | null;
  readonly favicon: ImageAsset | null;
  readonly hero: ImageAsset | null;
  readonly gallery: readonly ImageAsset[];
  readonly navigation: readonly NavigationLink[];
  readonly services: readonly ServiceItem[];
  readonly emails: readonly ContactPoint[];
  readonly phones: readonly ContactPoint[];
  readonly socialProfiles: readonly SocialProfile[];
  /** Every URL actually visited, for provenance and debugging. */
  readonly sources: readonly string[];
  /** ISO 8601 timestamp of collection. */
  readonly collectedAt: string;
}

/* ------------------------------------------------------------------ */
/* Stage 3 — normalization                                             */
/* ------------------------------------------------------------------ */

/** Which stage supplied a value. */
export type FieldSource = 'maps' | 'website';

export interface AttributedValue<T> {
  readonly value: T;
  readonly source: FieldSource;
  /** The URL the value was read from. */
  readonly sourceUrl: string;
}

/**
 * A chosen value and the candidates it beat.
 *
 * Merging is lossy by nature, so the losers are kept: a wrong pick stays
 * auditable, and nothing the pipeline saw is silently discarded.
 */
export interface Attributed<T> extends AttributedValue<T> {
  readonly alternatives: readonly AttributedValue<T>[];
}

export interface PostalAddress {
  /** The address exactly as published — always present, never reformatted. */
  readonly formatted: string;
  readonly street: string | null;
  readonly locality: string | null;
  readonly region: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
}

export interface PhoneNumber {
  /** As published, so a site can show what the business chose to show. */
  readonly formatted: string;
  /** E.164 for `tel:` links, when it can be derived without guessing. */
  readonly e164: string | null;
  readonly digits: string;
}

export interface RankedImages {
  readonly logo: ImageAsset | null;
  readonly favicon: ImageAsset | null;
  readonly hero: ImageAsset | null;
  /** Best first. */
  readonly gallery: readonly ImageAsset[];
}

export interface ValidationIssue {
  readonly field: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
}

export interface ValidationReport {
  /** True when no `error`-severity issue was raised. */
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
}

/**
 * One canonical view of the business, merged from the Maps listing and the
 * website, deduplicated and normalised.
 *
 * This is the writer's only input. Every field carries where it came from, so
 * the writer can cite any fact it uses and no claim is unattributable.
 */
export interface BusinessProfile {
  readonly name: Attributed<string>;
  readonly category: Attributed<string> | null;
  readonly address: Attributed<PostalAddress> | null;
  readonly coordinates: Attributed<GeoPoint> | null;
  readonly website: Attributed<string> | null;
  readonly phones: readonly Attributed<PhoneNumber>[];
  readonly emails: readonly Attributed<string>[];
  readonly socialProfiles: readonly Attributed<SocialProfile>[];
  readonly hours: readonly OpeningHours[];
  readonly rating: Attributed<number> | null;
  readonly reviewCount: Attributed<number> | null;
  readonly navigation: readonly NavigationLink[];
  readonly services: readonly ServiceItem[];
  /** Page text, deduplicated; the same copy served on two URLs appears once. */
  readonly pages: readonly PageText[];
  /**
   * Stated properties, available ones first. Both states are kept: what a
   * business does not offer is a fact the writer needs in order not to claim it.
   */
  readonly attributes: readonly BusinessAttribute[];
  /** The listing's editorial description, verbatim, where one exists. */
  readonly description: Attributed<string> | null;
  /**
   * Customer reviews, verbatim, best first.
   *
   * Reaches the writer as data the model may read but has no schema field to
   * answer with — testimonials are assembled from this list by code, exactly as
   * hours and the JSON-LD are, because a fabricated quotation under a real
   * person's name is the one defect a platform selling trust cannot ship.
   */
  readonly reviews: readonly ListingReview[];
  readonly images: RankedImages;
  readonly validation: ValidationReport;
  /** Every URL that contributed to this profile. */
  readonly sources: readonly string[];
  readonly normalizedAt: string;
}

/* ------------------------------------------------------------------ */
/* Stage 4 — business analysis                                         */
/* ------------------------------------------------------------------ */

export type Priority = 'high' | 'medium' | 'low';

/**
 * A single recommendation.
 *
 * `rationale` and `evidence` are not decoration — they are what makes the
 * strategy reviewable. `evidence` quotes or names the facts in the profile the
 * recommendation rests on, so a reader can tell an inference from a guess.
 */
export interface Recommendation {
  readonly title: string;
  readonly rationale: string;
  readonly priority: Priority;
  readonly evidence: readonly string[];
}

export interface BusinessCategory {
  readonly primary: string;
  readonly secondary: readonly string[];
  readonly rationale: string;
  /** `listing` when the Maps category settled it, `inferred` from site content. */
  readonly basis: 'listing' | 'inferred';
}

export interface AudienceSegment {
  readonly name: string;
  readonly description: string;
  /** What this group is trying to accomplish when it reaches the site. */
  readonly needs: readonly string[];
  readonly rationale: string;
}

export interface TargetAudience {
  readonly primary: AudienceSegment;
  readonly secondary: readonly AudienceSegment[];
}

export interface PageRecommendation extends Recommendation {
  /** Route the page should live at, e.g. `/` or `/services`. */
  readonly path: string;
  readonly sections: readonly string[];
}

export type ModuleLayer = 'backend' | 'frontend';

export interface ModuleRecommendation extends Recommendation {
  readonly layer: ModuleLayer;
  /** Titles of other recommended modules this one needs. */
  readonly dependsOn: readonly string[];
}

export type SeoKind = 'local' | 'content' | 'technical' | 'schema';

export interface SeoRecommendation extends Recommendation {
  readonly kind: SeoKind;
  readonly targetKeywords: readonly string[];
}

/**
 * What the business is, who it serves, and what its site should therefore do.
 *
 * Strategy only — no markup, no code, no copy. Every recommendation carries a
 * rationale and the evidence behind it.
 */
export interface BusinessStrategy {
  readonly businessName: string;
  readonly category: BusinessCategory;
  readonly goals: readonly Recommendation[];
  readonly audience: TargetAudience;
  readonly pages: readonly PageRecommendation[];
  readonly features: readonly Recommendation[];
  readonly backendModules: readonly ModuleRecommendation[];
  readonly frontendModules: readonly ModuleRecommendation[];
  readonly seoPriorities: readonly SeoRecommendation[];
  /** What the profile could not settle, and would need the owner to answer. */
  readonly openQuestions: readonly string[];
  /** Model that produced the strategy, for reproducibility. */
  readonly model: string;
  readonly generatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Stage 5 — writing                                                   */
/* ------------------------------------------------------------------ */

export type SectionKind =
  | 'hero'
  /**
   * One sentence of the business's own words, set large, alone in a band.
   *
   * A section rather than a renderer flourish, because the sentence is
   * *content* and has to be chosen where the rest of the prose is chosen — so
   * that it can be taken out of the passage it came from and never printed
   * twice. See `editorial-statement-break` in `lib/design/patterns.ts`.
   */
  | 'statement'
  | 'about'
  | 'services'
  | 'menu'
  | 'gallery'
  | 'testimonials'
  | 'hours'
  | 'location'
  | 'contact'
  | 'cta'
  | 'faq';

export interface WebsiteSection {
  readonly kind: SectionKind;
  readonly heading: string;
  readonly subheading: string | null;
  readonly body: string;
  readonly bullets: readonly string[];
  readonly images: readonly ImageAsset[];
  readonly callToAction: { readonly label: string; readonly href: string } | null;
}

export interface BrandVoice {
  /** e.g. "warm", "premium", "no-nonsense". */
  readonly tone: string;
  readonly palette: readonly string[];
  readonly typography: { readonly heading: string; readonly body: string };
}

export interface SeoMetadata {
  readonly title: string;
  readonly description: string;
  readonly keywords: readonly string[];
  /** JSON-LD LocalBusiness payload, serialised at render time. */
  readonly structuredData: Record<string, unknown>;
}

/**
 * What kind of reassurance a signal offers.
 *
 * A closed set, because the renderer orders and styles by it and because an
 * open one would invite a `kind` that is really a marketing claim.
 */
export type TrustSignalKind = 'rating' | 'category' | 'hours' | 'credential';

/**
 * One checkable fact, shown to a stranger deciding whether this business is
 * real.
 *
 * Trust scored lowest of the eight quality dimensions on every benchmark site,
 * and the reason was never that the facts were missing — every profile carried
 * a rating, a category and an address. They were simply never shown.
 *
 * The type exists so that stays honest as sources multiply. A signal is built
 * from `BusinessProfile` by code, never by the model, and `source` records
 * which stage proved it. Places API review counts, certifications and years in
 * business all become new entries here rather than new prose.
 */
export interface TrustSignal {
  readonly kind: TrustSignalKind;
  /** The line a visitor reads, e.g. "4.9 on Google". */
  readonly label: string;
  /** Which source proved it, so any claim on the page stays auditable. */
  readonly source: FieldSource;
}

/** A complete, buildable spec for the site. Still design-tool agnostic. */
export interface WebsiteContent {
  readonly businessName: string;
  readonly tagline: string;
  readonly voice: BrandVoice;
  readonly sections: readonly WebsiteSection[];
  /**
   * Verified reassurance, best first. Assembled from the profile after the
   * model has answered — the schema has no field for it, so the model cannot
   * offer one.
   */
  readonly trust: readonly TrustSignal[];
  /**
   * Short verified facts, for a rule across the page.
   *
   * Code-owned like `trust`, and for the same reason: a marquee is a band with
   * room in it, and room is what a model fills with adjectives. Every entry is
   * a fact the profile proved — the category, the locality, the rating, a
   * stated attribute — and each also appears somewhere the reader can check, so
   * nothing is stated only here.
   */
  readonly facts: readonly string[];
  readonly seo: SeoMetadata;
  /** Facts the writer could not verify — surfaced rather than invented. */
  readonly unresolvedGaps: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Stage 5b — design                                                   */
/* ------------------------------------------------------------------ */

/**
 * How the site should look, decided separately from what it says.
 *
 * Lives in `lib/design/types.ts` with the rest of the design vocabulary — the
 * same way the AI and platform layers keep their own — and is re-exported here
 * so every pipeline contract can still be read in one file.
 *
 * `WebsiteContent` and `WebsiteDesign` are independent by design: neither
 * imports the other, and the same content rendered under two designs differs in
 * every visual respect and in none of its claims.
 */
export type { WebsiteDesign } from './design/types.js';

/* ------------------------------------------------------------------ */
/* Stage 6 — deployment                                                */
/* ------------------------------------------------------------------ */

export interface DeploymentResult {
  readonly projectId: string;
  /** Public URL of the generated site, once it is live. */
  readonly liveUrl: string | null;
  readonly editorUrl: string | null;
  readonly status: 'created' | 'building' | 'live' | 'failed';
  /** The prompt actually sent, kept for reproducibility. */
  readonly promptUsed: string;
  readonly deployedAt: string;
}

/* ------------------------------------------------------------------ */
/* Pipeline                                                            */
/* ------------------------------------------------------------------ */

export interface PipelineResult {
  readonly runId: string;
  readonly input: DiscoveryInput;
  readonly discovery: DiscoveryResult;
  readonly collected: CollectedBusiness;
  readonly profile: BusinessProfile;
  readonly strategy: BusinessStrategy;
  readonly content: WebsiteContent;
  readonly design: import('./design/types.js').WebsiteDesign;
  readonly deployment: DeploymentResult;
  readonly startedAt: string;
  readonly finishedAt: string;
}
