/**
 * The evidence index — everything the Content Director is allowed to say, and
 * nothing else.
 *
 * ## Why this is a separate file
 *
 * The rule the whole platform rests on is that a page may *compose* facts and
 * may never *supply* them. That rule is only enforceable if there is one place
 * that answers "what does this business actually have?", built from the profile
 * alone, before any writing happens. The director then draws from this index;
 * anything not in it cannot reach the page, because there is nowhere for it to
 * come from.
 *
 * Every field here is either a value the research stage proved (a service name,
 * an amenity, the rating) or a verbatim fragment of something the business
 * published (a sentence of its own description, the alt text on its own
 * photograph). Nothing is inferred about the business, and nothing is written.
 *
 * Deterministic and pure: the same profile always yields the same index.
 */

import { detectLanguage, lexiconFor } from './language.js';

import type { ContentLanguage, Lexicon } from './language.js';
import type { BusinessProfile, ImageAsset, WebsiteContent } from '../types.js';

/** One sentence the business published, with where it came from. */
export interface EvidenceSentence {
  readonly text: string;
  /** How many of the business's own distinctive terms it carries. */
  readonly weight: number;
  readonly source: string;
}

export interface ContentEvidence {
  readonly language: ContentLanguage;
  readonly languageBasis: 'evidence' | 'default';
  readonly lexicon: Lexicon;
  /** The verified name, verbatim. */
  readonly name: string;
  /** The name without a trailing locality, for use inside a sentence. */
  readonly shortName: string;
  /** The listing's category, verbatim. `null` when none was published. */
  readonly trade: string | null;
  /**
   * What the business calls itself, lifted verbatim from its own prose.
   *
   * Outranks `trade` for a heading: "locație de evenimente" is the business's
   * own words, "Event & wedding venue" is a directory's classification of it.
   */
  readonly selfDescription: string | null;
  readonly place: string | null;
  readonly region: string | null;
  /** Service names, verbatim, best first. */
  readonly offerings: readonly string[];
  /** Available attribute labels, verbatim. Never the unavailable ones. */
  readonly amenities: readonly string[];
  readonly rating: number | null;
  readonly reviewCount: number | null;
  readonly hasPhone: boolean;
  readonly hasEmail: boolean;
  readonly hasAddress: boolean;
  readonly daysKnown: number;
  /** Sentences from the business's own prose, strongest first. */
  readonly sentences: readonly EvidenceSentence[];
  /** Alt text on the business's own photographs, verbatim. */
  readonly imageDescriptions: readonly string[];
  /**
   * Content words this business uses and a generic page would not — its own
   * vocabulary. Used to *rank* evidence, never assembled into prose.
   */
  readonly distinctiveTerms: readonly string[];
}

/* Words that carry no identity in either supported language. Ranking only. */
const STOPWORDS = new Set([
  'the', 'and', 'with', 'for', 'from', 'our', 'we', 'is', 'are', 'you', 'your', 'of', 'a', 'an',
  'to', 'in', 'on', 'at', 'by', 'as', 'it', 'its', 'that', 'this', 'their', 'they', 'all', 'any',
  'can', 'has', 'have', 'was', 'were', 'been', 'more', 'most', 'also', 'each', 'every', 'other',
  'și', 'si', 'cu', 'de', 'pentru', 'din', 'la', 'în', 'in', 'este', 'sunt', 'are', 'sau', 'pe',
  'ale', 'lui', 'nostru', 'noastre', 'noastră', 'un', 'o', 'care', 'ce', 'ca', 'sa', 'să', 'se',
  'mai', 'fost', 'fiecare', 'toate', 'prin', 'dar', 'iar', 'nu',
]);

/** Strips diacritics so "Drăgășani" and "Dragasani" compare equal. */
export function fold(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** A contact detail must never end up inside prose the director places. */
const CONTACT_IN_TEXT = /[\w.+-]+@[\w-]+\.\w+|\+?\d[\d\s().-]{7,}\d|\bhttps?:\/\//;

function sentencesOf(passage: string): readonly string[] {
  return passage
    .split(/(?<=[.!?])\s+(?=[\p{Lu}„"'])/u)
    .map((s) => s.trim())
    .filter((s) => s.length >= 30 && !CONTACT_IN_TEXT.test(s));
}

function termsOf(corpus: string): readonly string[] {
  const counts = new Map<string, number>();
  for (const raw of corpus.toLowerCase().match(/\p{L}[\p{L}-]{3,}/gu) ?? []) {
    if (STOPWORDS.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, 40)
    .map(([term]) => term);
}

/**
 * Lifts the business's own answer to "what are you?" out of its prose.
 *
 * Looks for a copula the language actually uses ("is a", "este o") and takes
 * the noun phrase after it, stopping at the first word that starts a
 * subordinate clause. Verbatim: the words are the business's, only the cut is
 * the system's. Returns `null` rather than guessing — a generic category label
 * is a better answer than a mangled phrase.
 */
export function selfDescriptionFrom(prose: string, lexicon: Lexicon, name: string): string | null {
  const nameWords = new Set(fold(name).split(/\s+/).filter((w) => w.length >= 3));

  /*
   * Only a sentence in which the business is the subject.
   *
   * "is a" matches anything. Tartine Bakery's crawled prose contains the
   * sentence "…is a collaborative process…", and reading the phrase after the
   * first copula anywhere in the corpus gave the bakery the headline
   * "Collaborative process in San Francisco" — grammatical, verbatim, and about
   * something else entirely. So the copula has to *follow the business's own
   * name*, closely enough that the name is plausibly its subject.
   */
  const NAME_TO_COPULA_WORDS = 6;
  const sentence = prose
    .split(/(?<=[.!?])\s+/u)
    .find((candidate) => {
      const words = fold(candidate).split(/\s+/);
      const nameAt = words.findIndex((word) => nameWords.has(word.replace(/[^\p{L}\p{N}-]/gu, '')));
      if (nameAt === -1) return false;
      return lexicon.copulas.some((copula) => {
        const head = fold(copula).split(/\s+/)[0] ?? '';
        const copulaAt = words.indexOf(head, nameAt);
        return copulaAt !== -1 && copulaAt - nameAt <= NAME_TO_COPULA_WORDS;
      });
    });
  if (sentence === undefined) return null;

  const folded = fold(sentence);
  for (const copula of lexicon.copulas) {
    const at = folded.indexOf(` ${copula} `);
    if (at === -1) continue;

    const after = sentence.slice(at + copula.length + 2);
    const words = after.split(/\s+/);
    const phrase: string[] = [];
    for (const word of words) {
      const bare = fold(word.replace(/[^\p{L}\p{N}-]/gu, ''));
      if (bare === '') break;
      if (phrase.length > 0 && lexicon.phraseBreaks.includes(bare)) break;
      if (nameWords.has(bare)) break;
      phrase.push(word.replace(/[.,;:]$/, ''));
      if (phrase.length >= 5) break;
      if (/[.,;:]$/.test(word)) break;
    }

    if (phrase.length < 2 || phrase.length > 5) continue;
    const candidate = phrase.join(' ').trim();
    if (candidate.length < 6 || candidate.length > 48) continue;
    const tail = fold(phrase[phrase.length - 1] ?? '');
    if (lexicon.tailStopWords.includes(tail)) continue;
    return candidate;
  }
  return null;
}

/** Alt text worth quoting: written by a human about this photograph. */
function describedImages(profile: BusinessProfile, content: WebsiteContent): readonly string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (image: ImageAsset | null | undefined): void => {
    if (image == null || image.role === 'logo' || image.role === 'favicon') return;
    const alt = (image.alt ?? '').trim();
    if (alt.length < 12 || seen.has(alt)) return;
    seen.add(alt);
    out.push(alt);
  };
  push(profile.images.hero);
  profile.images.gallery.forEach(push);
  for (const section of content.sections) section.images.forEach(push);
  return out;
}

/**
 * Builds the index.
 *
 * `content` is read only for the prose already placed on the page and the
 * images assigned to sections — never for anything the writer invented, which
 * is why the sentence pool is drawn from the profile's own description and
 * pages first.
 */
export function indexEvidence(profile: BusinessProfile, content: WebsiteContent): ContentEvidence {
  const trade = profile.category?.value ?? null;
  const place = profile.address?.value.locality ?? null;
  const region = profile.address?.value.region ?? null;
  const description = profile.description?.value ?? '';
  const pageProse = profile.pages.map((page) => page.text).join('\n\n');
  const imageDescriptions = describedImages(profile, content);

  const corpus = [
    description,
    pageProse,
    ...profile.services.map((service) => `${service.name} ${service.description ?? ''}`),
    ...profile.attributes.filter((a) => a.available).map((a) => a.label),
    ...imageDescriptions,
    ...content.sections.map((s) => s.body),
  ].join('\n');

  const read = detectLanguage(corpus);
  const lexicon = lexiconFor(read.language);
  const distinctiveTerms = termsOf(corpus);
  const rank = new Set(distinctiveTerms.slice(0, 20));

  const pool: EvidenceSentence[] = [];
  const seen = new Set<string>();
  const collect = (passage: string, source: string): void => {
    for (const sentence of sentencesOf(passage)) {
      const key = fold(sentence).replace(/\s+/g, ' ');
      if (seen.has(key)) continue;
      seen.add(key);
      const words = sentence.toLowerCase().match(/\p{L}[\p{L}-]{3,}/gu) ?? [];
      const weight = words.filter((w) => rank.has(w)).length;
      pool.push({ text: sentence, weight, source });
    }
  };
  collect(description, profile.description?.sourceUrl ?? 'listing');
  for (const page of profile.pages) collect(page.text, page.url);

  const name = profile.name.value;
  // "River Park Events Drăgășani" reads as "River Park Events" inside a
  // sentence; the town is already the second half of every heading that needs
  // it. Only a trailing locality is dropped, and only when something is left.
  const shortName = place !== null && fold(name).endsWith(fold(place))
    ? name.slice(0, name.length - place.length).replace(/[\s,–—-]+$/, '').trim() || name
    : name;

  return {
    language: read.language,
    languageBasis: read.basis,
    lexicon,
    name,
    shortName,
    trade,
    selfDescription: selfDescriptionFrom(description === '' ? pageProse : description, lexicon, name),
    place,
    region,
    offerings: profile.services.map((service) => service.name.trim()).filter((n) => n !== ''),
    amenities: profile.attributes
      .filter((attribute) => attribute.available && fold(attribute.label) !== fold(trade ?? ' '))
      .map((attribute) => attribute.label.trim()),
    rating: profile.rating?.value ?? null,
    reviewCount: profile.reviewCount?.value ?? null,
    hasPhone: profile.phones.length > 0,
    hasEmail: profile.emails.length > 0,
    hasAddress: profile.address !== null,
    daysKnown: new Set(profile.hours.map((entry) => entry.dayOfWeek)).size,
    sentences: [...pool].sort((a, b) => b.weight - a.weight),
    imageDescriptions,
    distinctiveTerms,
  };
}
