/**
 * The language the page is written in, and the closed vocabulary the system is
 * allowed to author in it.
 *
 * ## The defect this closes
 *
 * River Park Events is a Romanian venue. Every word of *evidence* on its page —
 * the description, the six service names, the eleven amenities, the image alt
 * text — is Romanian. Every word the *platform* wrote was English: "What we
 * offer", "Photographs", "Opening hours", "Address", "Phone", "Call us",
 * "Monday to Saturday", "Visit … in …". The page read as a Romanian business
 * described by an English tool, which is the opposite of "deliberately
 * conceived for this business".
 *
 * The rule is general, not a patch for one venue: **the language of the copy
 * follows the language of the evidence.** Detection is deterministic and reads
 * function words, which are the part of a language a business cannot avoid
 * using.
 *
 * ## What this file may and may not do
 *
 * It may translate **labels the platform itself authored** — a section heading
 * the system chose, a button verb, the caption on a contact row. It must never
 * translate **evidence**: the category as the listing states it, a service
 * name, an amenity, a sentence the business published. Those are quoted
 * verbatim in whatever language they arrived in, because translating a fact is
 * editing it.
 *
 * Adding a language is a data change: one `Lexicon` literal and one row of
 * function words. No new code path.
 */

import type { CtaIntent } from '../design/conversion.js';

/** Languages the platform can author scaffolding in. Closed set. */
export type ContentLanguage = 'en' | 'ro';

export const LANGUAGES: readonly ContentLanguage[] = ['en', 'ro'];

export interface LanguageRead {
  readonly language: ContentLanguage;
  /** `evidence` when the corpus decided it; `default` when nothing did. */
  readonly basis: 'evidence' | 'default';
  readonly evidence: readonly string[];
}

/**
 * Function words, which are what actually identify a language in a short
 * corpus. Content words drift — a Romanian venue's page says "corporate" and
 * "catering" — but nobody writes Romanian without "și" and "pentru".
 */
const MARKERS: Readonly<Record<ContentLanguage, readonly string[]>> = {
  en: ['the', 'and', 'with', 'for', 'from', 'our', 'we', 'is', 'are', 'you', 'your', 'of', 'a', 'to', 'in'],
  ro: ['și', 'si', 'cu', 'de', 'pentru', 'din', 'la', 'în', 'in', 'este', 'sunt', 'are', 'sau', 'pe', 'ale', 'nostru', 'noastre'],
};

/** Letters only Romanian uses among the supported set. A strong, cheap signal. */
const DIACRITICS: Readonly<Partial<Record<ContentLanguage, RegExp>>> = {
  ro: /[ăâîșşțţ]/gi,
};

function wordCounts(corpus: string, words: readonly string[]): number {
  let total = 0;
  for (const word of words) {
    const pattern = new RegExp(`(^|[^\\p{L}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}]|$)`, 'giu');
    total += (corpus.match(pattern) ?? []).length;
  }
  return total;
}

/**
 * Reads the language off the evidence corpus.
 *
 * Ties and empty corpora fall to English, and say so — a default is a decision
 * somebody should be able to see was made, exactly as an inferred brand colour
 * is. Diacritics count double: a page with "ș" and "ț" in it is not English,
 * however many times the word "in" appears.
 */
export function detectLanguage(corpus: string): LanguageRead {
  const text = corpus.toLowerCase();
  if (text.trim() === '') {
    return { language: 'en', basis: 'default', evidence: ['corpus:empty'] };
  }

  const scores = new Map<ContentLanguage, number>();
  const evidence: string[] = [];
  for (const language of LANGUAGES) {
    const markers = wordCounts(text, MARKERS[language]);
    const pattern = DIACRITICS[language];
    const diacritics = pattern === undefined ? 0 : (text.match(pattern) ?? []).length;
    const score = markers + diacritics * 2;
    scores.set(language, score);
    evidence.push(`${language}:${markers}+${diacritics}d=${score}`);
  }

  const ranked = [...scores.entries()].sort((a, b) => (b[1] - a[1]) || LANGUAGES.indexOf(a[0]) - LANGUAGES.indexOf(b[0]));
  const [winner, score] = ranked[0] ?? (['en', 0] as const);
  const runnerUp = ranked[1]?.[1] ?? 0;

  // A clear margin, not a hair. A single stray "și" in an English page is not a
  // Romanian page, and getting this wrong is visible on every heading.
  if (score === 0 || score < runnerUp * 1.3) {
    return { language: 'en', basis: 'default', evidence };
  }
  return { language: winner, basis: 'evidence', evidence };
}

/* ------------------------------------------------------------------ */
/* The lexicon                                                         */
/* ------------------------------------------------------------------ */

/**
 * A heading the platform authors when no evidence-built one survives.
 *
 * Keyed by *narrative role*, not by section kind — that is the whole point.
 * "What we offer" is what a template says; the frames here say what this beat
 * of this page is doing.
 */
export type LabelKey =
  | 'reveal' | 'process' | 'signature' | 'space' | 'breadth'
  | 'proof' | 'trust' | 'hours' | 'location' | 'contact' | 'gallery' | 'coda';

/** A frame that composes one evidence token into a heading. */
export type FrameKey =
  | 'reveal'          // about, an experiential business  → "About <name>"
  | 'process'         // about, a functional business     → "How <name> works"
  | 'tradeInPlace'    // "<trade> in <place>"
  | 'signatureOf'     // "Inside <name>" — names whose peak it is, never what is in it
  | 'closeCall' | 'closeBook' | 'closeReserve' | 'closeOrder'
  | 'closeVisit' | 'closeEnquire' | 'closeQuote';

/**
 * The section-kind eyebrow, in the page's language.
 *
 * The renderer prints the *kind* above a section that has no tagline — a small
 * uppercase label carrying the eyebrow step of the type scale. It printed the
 * TypeScript identifier, so a Romanian venue's page read "ABOUT", "GALLERY",
 * "SERVICES" down its left edge: three English words nobody wrote, in the one
 * place a reader's eye lands before the heading.
 */
export type KindKey =
  | 'hero' | 'statement' | 'about' | 'services' | 'menu' | 'gallery'
  | 'testimonials' | 'hours' | 'location' | 'contact' | 'cta' | 'faq';

export type FurnitureKey =
  | 'address' | 'phone' | 'email' | 'rating' | 'dayRange' | 'closed'
  | 'onGoogle' | 'fromReviews' | 'openAllWeek' | 'callToConfirm' | 'skipToContent';

export interface Lexicon {
  readonly id: ContentLanguage;
  /** BCP-47 tag for the rendered document. */
  readonly htmlLang: string;
  readonly label: Readonly<Record<LabelKey, string>>;
  readonly frame: Readonly<Record<FrameKey, (token: string, second?: string) => string>>;
  /** Button text per conversion intent, from `ConversionStrategy.primaryCta`. */
  readonly cta: Readonly<Record<CtaIntent, string>>;
  /** The eyebrow above a section with no tagline. See `KindKey`. */
  readonly kind: Readonly<Record<KindKey, string>>;
  /**
   * Header navigation labels: short, conventional, never a sentence.
   *
   * A closed map per language for the reason the English one is closed — a
   * label derived from the heading produced a nav reading "Sourdough loaves,
   * pastries, cakes, and dining" — and per *language* because a Romanian page
   * navigated by "About / Gallery / Services / Hours" is the platform's outline
   * of someone else's business.
   */
  readonly nav: Readonly<Record<KindKey, string>>;
  readonly furniture: Readonly<Record<FurnitureKey, string>>;
  readonly days: readonly string[];
  /** Joins the business's own terms: `["a","b","c"] → "a, b and c"`. */
  readonly list: (items: readonly string[]) => string;
  /** The partial-hours disclosure, which is prose and so must be localised. */
  readonly hoursPartial: (daysKnown: number, canCall: boolean) => string;
  /**
   * Words that may not end a heading, because a heading ending on a
   * preposition is a sentence that was cut, not a title.
   */
  readonly tailStopWords: readonly string[];
  /** Openers that mean a sentence continues an argument the reader has not seen. */
  readonly continuations: readonly string[];
  /** Copulas that introduce a business's own description of what it is. */
  readonly copulas: readonly string[];
  /** Words that end a self-description noun phrase. */
  readonly phraseBreaks: readonly string[];
}

const EN: Lexicon = {
  id: 'en',
  htmlLang: 'en',
  label: {
    reveal: 'About', process: 'How we work', signature: 'The centrepiece',
    space: 'The space', breadth: 'What we offer', proof: 'Questions',
    trust: 'Reviews', hours: 'Opening hours', location: 'Where to find us',
    contact: 'Contact', gallery: 'Photographs', coda: 'Before you go',
  },
  frame: {
    reveal: (name) => `About ${name}`,
    process: (name) => `How ${name} works`,
    tradeInPlace: (trade, place) => (place === undefined || place === '' ? trade : `${trade} in ${place}`),
    signatureOf: (name) => (name === '' ? 'Inside' : `Inside ${name}`),
    closeCall: (name) => `Call ${name}`,
    closeBook: (name) => `Book ${name}`,
    closeReserve: (name) => `Reserve at ${name}`,
    closeOrder: (name) => `Order from ${name}`,
    closeVisit: (name, place) => (place === undefined || place === '' ? `Visit ${name}` : `Visit ${name} in ${place}`),
    closeEnquire: (name) => `Enquire at ${name}`,
    closeQuote: (name) => `Get a quote from ${name}`,
  },
  cta: {
    call: 'Call us', book: 'Book', reserve: 'Reserve', order: 'Order',
    visit: 'Get directions', enquire: 'Enquire', quote: 'Request a quote',
  },
  // Identical to the section-kind identifiers, so an English page renders
  // exactly the string it always has.
  kind: {
    hero: 'hero', statement: 'statement', about: 'about', services: 'services',
    menu: 'menu', gallery: 'gallery', testimonials: 'testimonials', hours: 'hours',
    location: 'location', contact: 'contact', cta: 'cta', faq: 'faq',
  },
  nav: {
    hero: 'Top', statement: '', about: 'About', services: 'Services', menu: 'Menu',
    gallery: 'Gallery', testimonials: 'Reviews', hours: 'Hours', location: 'Visit',
    contact: 'Contact', cta: 'Start', faq: 'FAQ',
  },
  furniture: {
    address: 'Address', phone: 'Phone', email: 'Email', rating: 'Rating',
    dayRange: 'to', closed: 'Closed', onGoogle: 'on Google', fromReviews: 'reviews',
    openAllWeek: 'Open seven days a week', callToConfirm: 'Call to confirm',
    skipToContent: 'Skip to content',
  },
  days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  list: (items) => {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0] ?? '';
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  },
  hoursPartial: (daysKnown, canCall) =>
    `Google publishes hours for ${daysKnown === 1 ? 'one day' : `${daysKnown} days`} of the week.`
    + (canCall ? ' Call ahead to confirm the rest.' : ''),
  tailStopWords: ['a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'is', 'are', 'that', 'which', 'as'],
  continuations: ['nevertheless', 'however', 'but', 'so', 'then', 'meanwhile', 'moreover', 'furthermore', 'additionally', 'also', 'yet', 'still', 'therefore', 'thus', 'consequently'],
  copulas: ['is a', 'is an', 'is the', 'we are a', 'we are an', 'are a', 'are an'],
  phraseBreaks: ['serving', 'offering', 'that', 'which', 'where', 'with', 'for', 'in', 'on', 'and', 'located', 'based', 'specialising', 'specializing', 'providing'],
};

const RO: Lexicon = {
  id: 'ro',
  htmlLang: 'ro',
  label: {
    reveal: 'Despre', process: 'Cum lucrăm', signature: 'Momentul semnătură',
    space: 'Spațiul', breadth: 'Ce oferim', proof: 'Întrebări',
    trust: 'Recenzii', hours: 'Program', location: 'Cum ajungi',
    contact: 'Contact', gallery: 'Fotografii', coda: 'Înainte să pleci',
  },
  frame: {
    reveal: (name) => `Despre ${name}`,
    process: (name) => `Cum lucrează ${name}`,
    tradeInPlace: (trade, place) => (place === undefined || place === '' ? trade : `${trade} în ${place}`),
    signatureOf: (name) => (name === '' ? 'În interior' : `În interior, la ${name}`),
    closeCall: (name) => `Sună la ${name}`,
    closeBook: (name) => `Rezervă la ${name}`,
    closeReserve: (name) => `Rezervă la ${name}`,
    closeOrder: (name) => `Comandă de la ${name}`,
    closeVisit: (name, place) => (place === undefined || place === '' ? `Vino la ${name}` : `Vino la ${name}, în ${place}`),
    closeEnquire: (name) => `Cere detalii de la ${name}`,
    closeQuote: (name) => `Cere o ofertă de la ${name}`,
  },
  cta: {
    call: 'Sună-ne', book: 'Rezervă', reserve: 'Rezervă', order: 'Comandă',
    visit: 'Cum ajungi', enquire: 'Cere detalii', quote: 'Cere o ofertă',
  },
  kind: {
    hero: 'început', statement: 'citat', about: 'despre', services: 'servicii',
    menu: 'meniu', gallery: 'fotografii', testimonials: 'recenzii', hours: 'program',
    location: 'locație', contact: 'contact', cta: 'invitație', faq: 'întrebări',
  },
  nav: {
    hero: 'Sus', statement: '', about: 'Despre', services: 'Servicii', menu: 'Meniu',
    gallery: 'Galerie', testimonials: 'Recenzii', hours: 'Program', location: 'Vizitează',
    contact: 'Contact', cta: 'Rezervă', faq: 'Întrebări',
  },
  furniture: {
    address: 'Adresă', phone: 'Telefon', email: 'E-mail', rating: 'Rating',
    dayRange: 'până', closed: 'Închis', onGoogle: 'pe Google', fromReviews: 'recenzii',
    openAllWeek: 'Deschis șapte zile pe săptămână', callToConfirm: 'Sună pentru confirmare',
    skipToContent: 'Sari la conținut',
  },
  days: ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'],
  list: (items) => {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0] ?? '';
    return `${items.slice(0, -1).join(', ')} și ${items[items.length - 1]}`;
  },
  hoursPartial: (daysKnown, canCall) =>
    `Google publică programul pentru ${daysKnown === 1 ? 'o zi' : `${daysKnown} zile`} din săptămână.`
    + (canCall ? ' Sună pentru a confirma restul.' : ''),
  tailStopWords: ['un', 'o', 'și', 'si', 'sau', 'de', 'din', 'în', 'in', 'la', 'pe', 'cu', 'pentru', 'este', 'sunt', 'care', 'ce', 'ca'],
  continuations: ['totuși', 'însă', 'dar', 'deci', 'apoi', 'între timp', 'în plus', 'de asemenea', 'prin urmare', 'astfel'],
  copulas: ['este o', 'este un', 'este cel', 'suntem o', 'suntem un', 'e o', 'e un'],
  phraseBreaks: ['care', 'unde', 'cu', 'pentru', 'din', 'în', 'pe', 'și', 'si', 'situat', 'situată', 'aflat', 'aflată', 'oferind'],
};

const LEXICONS: Readonly<Record<ContentLanguage, Lexicon>> = { en: EN, ro: RO };

export function lexiconFor(language: ContentLanguage): Lexicon {
  return LEXICONS[language];
}
