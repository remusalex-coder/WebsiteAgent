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
 * Raw, unedited facts gathered from the business's own website.
 *
 * Name, hours, rating and review count already live on `identity` — the
 * collector adds what only the site can supply. Nothing here is generated:
 * every string was present on a page, and every one carries its source.
 */
export interface CollectedBusiness {
  readonly identity: DiscoveryResult;
  /** The site actually crawled, or `null` when the listing had no website. */
  readonly siteUrl: string | null;
  readonly pages: readonly PageText[];
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
  readonly images: RankedImages;
  readonly validation: ValidationReport;
  /** Every URL that contributed to this profile. */
  readonly sources: readonly string[];
  readonly normalizedAt: string;
}

/* ------------------------------------------------------------------ */
/* Stage 4 — writing                                                   */
/* ------------------------------------------------------------------ */

export type SectionKind =
  | 'hero'
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

/** A complete, buildable spec for the site. Still design-tool agnostic. */
export interface WebsiteContent {
  readonly businessName: string;
  readonly tagline: string;
  readonly voice: BrandVoice;
  readonly sections: readonly WebsiteSection[];
  readonly seo: SeoMetadata;
  /** Facts the writer could not verify — surfaced rather than invented. */
  readonly unresolvedGaps: readonly string[];
}

/* ------------------------------------------------------------------ */
/* Stage 5 — deployment                                                */
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
  readonly content: WebsiteContent;
  readonly deployment: DeploymentResult;
  readonly startedAt: string;
  readonly finishedAt: string;
}
