/**
 * The Content Director — what this business should actually *say*, at this beat
 * of this page.
 *
 * ## The gap this closes
 *
 * By the time this file was written the platform could already decide, from
 * evidence, that River Park Events is an image-led romantic venue whose page
 * should run `emotion → reveal → signature → breadth → context → conversion`,
 * with the gallery as a full-bleed signature moment and an editorial `book`
 * conversion. Then it rendered that arc with the words **"What we offer"**,
 * **"Photographs"**, **"Opening hours"** and **"Visit River Park Events
 * Drăgășani in Drăgășani"** — English labels on a Romanian venue, identical to
 * every other business the platform has ever produced. The structure was
 * bespoke; the prose was a template. That is what this fixes.
 *
 * ## What it is
 *
 * A pure function of `(profile, content, narrative plan)` that rewrites the
 * *words* of a page — heading, subheading, body framing, button label — while
 * changing **nothing** about its structure: same sections, same order, same
 * kinds, same images, same factual bullets. It cannot add a section and it
 * cannot add a fact.
 *
 * ## The three kinds of string it may emit
 *
 * 1. **Quoted** — verbatim from the business: a service name, an amenity, a
 *    sentence of its own description, the alt text on its own photograph. The
 *    only edit permitted is where the phrase is cut. Never paraphrased, never
 *    translated.
 * 2. **Composed** — two or more facts joined by a closed-set frame: "locație de
 *    evenimente" + "Târgoviște" → "Locație de evenimente în Târgoviște". Every
 *    token in it is evidence; only the joining word is the platform's.
 * 3. **Framing** — a label the platform authored, drawn from a closed lexicon
 *    keyed to the narrative role and rendered in the language the evidence is
 *    written in.
 *
 * A frame may **compose** facts. It may never **supply** them. That is the same
 * rule `lib/design/patterns.ts` already enforces on the pattern library, and it
 * is what makes this layer safe to grow.
 *
 * Every decision records which of the two it was, and what it drew on, so a
 * reviewer can audit any line on the page back to a fact. That is the same
 * `basis` discipline `conversion.ts` and `script.ts` already use.
 *
 * ## Why it runs where it runs
 *
 * After the narrative plan (it needs the role of each beat) and before
 * `composeDesign` consumes the content (the design must see the words it will
 * actually set). The plan is computed once and handed to both, so the copy the
 * system writes can never feed back in as evidence about the business — a page
 * must not read its own adjectives and conclude the business is romantic.
 *
 * Deterministic and €0. No model, no network, no clock.
 */

import { indexEvidence, fold } from './evidence.js';

import type { ContentEvidence } from './evidence.js';
import type { Lexicon } from './language.js';
import type { NarrativeRole } from '../design/script.js';
import type { ConversionStrategy, CtaIntent } from '../design/conversion.js';
import type { ExperienceArchitecture } from '../design/experience.js';
import type { BusinessCharacter } from '../design/character.js';
import type {
  BusinessProfile,
  ImageAsset,
  SectionKind,
  WebsiteContent,
  WebsiteSection,
} from '../types.js';

/* ------------------------------------------------------------------ */
/* Contract                                                            */
/* ------------------------------------------------------------------ */

/**
 * Where one string came from.
 *
 * The distinction is enforceable, and `test/content/director.test.ts` enforces
 * it: a `quoted` value must appear verbatim in the evidence index, and a
 * `composed` one must be built only from tokens that do.
 */
export type CopyBasis = 'quoted' | 'composed' | 'framing';

/** What the director drew on for one string, so any line can be audited. */
export interface CopyDecision {
  readonly index: number;
  readonly kind: SectionKind;
  readonly role: NarrativeRole;
  readonly field: 'heading' | 'subheading' | 'body' | 'cta' | 'seo';
  /**
   * `quoted` = the business's own words, verbatim. `composed` = its facts
   * joined by a closed-set frame. `framing` = a lexicon label.
   */
  readonly basis: CopyBasis;
  /** Which evidence it came from, e.g. `service-names`, `image-alt`, `prose`. */
  readonly source: string;
  readonly value: string;
}

export interface NarrativePlanForCopy {
  readonly character: BusinessCharacter;
  readonly experience: ExperienceArchitecture;
  readonly conversion: ConversionStrategy;
  /** Narrative role per section index, from `planNarrativeOrder`. */
  readonly roles: ReadonlyMap<number, NarrativeRole>;
}

export interface DirectedContent {
  readonly content: WebsiteContent;
  readonly decisions: readonly CopyDecision[];
  readonly evidence: ContentEvidence;
}

/* ------------------------------------------------------------------ */
/* Verbatim extraction                                                 */
/* ------------------------------------------------------------------ */

/** Where a heading-length phrase ends inside a longer passage. */
const PHRASE_CUT = /[,;:(—–]|\s-\s/;

const MIN_HEADING_CHARS = 6;
/** Characters, not words, is what governs how a heading sets. */
const MAX_HEADING_CHARS = 56;
/**
 * A loose upper bound, there only to stop a whole clause of short words
 * arriving as a "heading". The character cap does the real work: capping words
 * at seven rejected "Sala mare cu candelabru floral și arcade filigranate" —
 * eight words, fifty-one characters, and the best line on the page.
 */
const MAX_HEADING_WORDS = 9;

/**
 * Lifts a heading out of a passage the business wrote, or returns `null`.
 *
 * The only edit is the cut: the words are the business's own. The guards are
 * what make that safe — a fragment that opens mid-argument, ends on a
 * preposition, restates the business's name or is really a sentence would each
 * read as a machine's mistake rather than as a title, and any of them is worse
 * than an honest generic label.
 */
export function headingFromProse(
  passage: string,
  lexicon: Lexicon,
  forbidden: readonly string[],
): string | null {
  const first = passage.trim().split(/(?<=[.!?])\s/u)[0] ?? '';
  const cut = first.split(PHRASE_CUT)[0] ?? '';
  const phrase = cut.replace(/[.!?…]+$/u, '').replace(/^[„"'«]/u, '').trim();
  if (phrase === '') return null;

  const words = phrase.split(/\s+/u);
  if (words.length < 2 || words.length > MAX_HEADING_WORDS) return null;
  if (phrase.length < MIN_HEADING_CHARS || phrase.length > MAX_HEADING_CHARS) return null;
  if (!/^\p{L}/u.test(phrase)) return null;
  if (/\d{3,}/u.test(phrase)) return null;

  const head = fold(words[0] ?? '');
  if (lexicon.continuations.some((c) => head === fold(c))) return null;
  const tail = fold((words[words.length - 1] ?? '').replace(/[^\p{L}\p{N}-]/gu, ''));
  if (lexicon.tailStopWords.includes(tail)) return null;

  const folded = fold(phrase);
  for (const term of forbidden) {
    const f = fold(term).trim();
    if (f.length >= 3 && folded.includes(f)) return null;
  }
  return phrase.charAt(0).toLocaleUpperCase() + phrase.slice(1);
}

/** True when a heading merely restates how its own body opens. */
function stutters(heading: string, body: string): boolean {
  if (body.trim() === '') return false;
  const h = fold(heading).replace(/\s+/g, ' ');
  const b = fold(body).replace(/\s+/g, ' ');
  return b.startsWith(h.slice(0, Math.min(h.length, 24)));
}

/* ------------------------------------------------------------------ */
/* Furniture: labels the platform owns, in the page's language          */
/* ------------------------------------------------------------------ */

/**
 * Captions on the factual rows, translated.
 *
 * The *values* — the address, the number, the rating — are never touched. Only
 * the caption is the platform's, and a Romanian page whose contact block says
 * "Address" is the platform talking over the business.
 */
const CAPTIONS: Readonly<Record<string, 'address' | 'phone' | 'email' | 'rating'>> = {
  Address: 'address', Phone: 'phone', Email: 'email', Rating: 'rating',
};

const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function localizeBullet(bullet: string, lexicon: Lexicon): string {
  const at = bullet.indexOf(' — ');
  if (at === -1) return bullet;
  const caption = bullet.slice(0, at);
  const value = bullet.slice(at + 3);

  const known = CAPTIONS[caption];
  if (known !== undefined) return `${lexicon.furniture[known]} — ${localizeRating(value, lexicon)}`;

  // A day or a day range, e.g. "Monday to Saturday". Both halves are platform
  // words; the times beside them are data and stay as published.
  const range = /^(\w+) to (\w+)$/.exec(caption);
  const day = (name: string): string | null => {
    const i = EN_DAYS.indexOf(name);
    return i === -1 ? null : lexicon.days[i] ?? null;
  };
  // A caption opens a row, so it is capitalised even in a language that writes
  // its weekdays lower-case in running prose.
  const opener = (name: string): string => name.charAt(0).toLocaleUpperCase() + name.slice(1);
  if (range !== null) {
    const from = day(range[1] ?? '');
    const to = day(range[2] ?? '');
    if (from !== null && to !== null) return `${opener(from)} ${lexicon.furniture.dayRange} ${to} — ${value}`;
  }
  const single = day(caption);
  return single === null ? bullet : `${opener(single)} — ${value}`;
}

/** "4.7 on Google from 217 reviews" — a fact, in platform words. */
function localizeRating(value: string, lexicon: Lexicon): string {
  const match = /^([\d.,]+) on Google(?: from ([\d,]+) reviews?)?$/.exec(value.trim());
  if (match === null) return value;
  const score = match[1] ?? '';
  const count = match[2];
  const base = `${score} ${lexicon.furniture.onGoogle}`;
  return count === undefined ? base : `${base}, ${count} ${lexicon.furniture.fromReviews}`;
}

/* ------------------------------------------------------------------ */
/* The heading, per narrative role                                     */
/* ------------------------------------------------------------------ */

const CLOSE_FRAME: Readonly<Record<CtaIntent, 'closeCall' | 'closeBook' | 'closeReserve' | 'closeOrder' | 'closeVisit' | 'closeEnquire' | 'closeQuote'>> = {
  call: 'closeCall', book: 'closeBook', reserve: 'closeReserve', order: 'closeOrder',
  visit: 'closeVisit', enquire: 'closeEnquire', quote: 'closeQuote',
};

/** The heading a beat opens with, and where it came from. */
interface Chosen {
  readonly value: string;
  readonly basis: CopyBasis;
  readonly source: string;
}

/**
 * The breadth beat's heading, when the business's own offering names *are* the
 * whole range.
 *
 * The test is completeness, not count: naming every service a business offers
 * is a true statement about its range, and it is the most specific heading such
 * a page can carry — "Servicing, MOT, Repairs and Diagnostics" instead of "What
 * we offer". Naming *some* of them would be a partial claim dressed as a
 * summary, so a business with more offerings than fit gets the role's label and
 * the grid beneath it does the enumerating.
 */
const MAX_NAMED_OFFERINGS = 4;

function offeringsHeading(ev: ContentEvidence): Chosen | null {
  if (ev.offerings.length < 2 || ev.offerings.length > MAX_NAMED_OFFERINGS) return null;
  // Every one of them, or none: a heading that silently drops the fifth service
  // is the partial claim this guard exists to prevent.
  const short = ev.offerings.filter((name) => name.split(/\s+/).length <= 3 && name.length <= 24);
  if (short.length !== ev.offerings.length) return null;
  const joined = ev.lexicon.list(short);
  if (joined.length > MAX_HEADING_CHARS) return null;
  return { value: joined, basis: 'composed', source: 'service-names' };
}

/**
 * A heading naming what a photograph on this beat actually shows.
 *
 * Ranked by how much of the business's own vocabulary the caption carries, not
 * by the gallery's visual sequence. The sequence is arranged for *contrast* —
 * `arrangeSequence` puts a portrait after a wide so the grid has rhythm — and
 * the first cell in that arrangement is frequently the least descriptive image
 * of the set. River Park's gallery opens on "Sala caldă, cu scaune aurii" and
 * carries "Sala mare cu candelabru floral și arcade filigranate" two cells
 * later; the second is the heading the page wants.
 */
function imageryHeading(
  images: readonly ImageAsset[],
  ev: ContentEvidence,
  forbidden: readonly string[],
  body: string,
): Chosen | null {
  const rank = new Set(ev.distinctiveTerms.slice(0, 20));
  const contentWords = (value: string): readonly string[] => value.toLowerCase().match(/\p{L}[\p{L}-]{3,}/gu) ?? [];
  // The opening of the copy directly beneath, which the heading must not simply
  // restate: a heading earns its line by adding a subject, not by echoing one.
  const opening = new Set(contentWords(body).slice(0, 12));

  const candidates = images
    .map((image) => headingFromProse((image.alt ?? '').trim(), ev.lexicon, forbidden))
    .filter((phrase): phrase is string => phrase !== null)
    .map((phrase) => {
      const own = contentWords(phrase);
      return {
        phrase,
        weight: own.filter((w) => rank.has(w)).length - own.filter((w) => opening.has(w)).length,
      };
    });
  if (candidates.length === 0) return null;
  // Most of the business's own words, least of the body's; longer wins a tie,
  // because a longer surviving phrase said more before the guards cut it.
  candidates.sort((a, b) => (b.weight - a.weight) || (b.phrase.length - a.phrase.length));
  return { value: candidates[0]?.phrase ?? '', basis: 'quoted', source: 'image-alt' };
}

function ratingHeading(ev: ContentEvidence): Chosen | null {
  if (ev.rating === null) return null;
  const score = ev.rating.toFixed(1);
  const value = ev.reviewCount === null
    ? `${score} ${ev.lexicon.furniture.onGoogle}`
    : `${score} ${ev.lexicon.furniture.onGoogle}, ${ev.reviewCount} ${ev.lexicon.furniture.fromReviews}`;
  return { value, basis: 'composed', source: 'rating' };
}

/* ------------------------------------------------------------------ */
/* Direction                                                           */
/* ------------------------------------------------------------------ */

/**
 * Directs the copy.
 *
 * Walks the page once in written order, deciding each beat's words from its
 * narrative role and the evidence still unspent. Sections, kinds, order,
 * images and factual bullets are carried through untouched — this function
 * changes what the page says, never what it is.
 */
export function directContent(
  profile: BusinessProfile,
  content: WebsiteContent,
  plan: NarrativePlanForCopy,
): DirectedContent {
  const ev = indexEvidence(profile, content);
  const lex = ev.lexicon;
  const decisions: CopyDecision[] = [];

  /* Prose already on the page. A sentence may be moved, never duplicated. */
  const placed = new Set<string>();
  for (const section of content.sections) {
    for (const sentence of section.body.split(/(?<=[.!?])\s+/u)) {
      const key = fold(sentence).replace(/\s+/g, ' ').trim();
      if (key !== '') placed.add(key);
    }
  }

  /*
   * The one sentence the signature beat is allowed to take.
   *
   * A page whose visual peak carries no words is a photograph with a caption
   * missing. The strongest sentence the business wrote about itself belongs
   * there rather than three paragraphs up — so it is *moved*, not copied, and
   * the section it came from keeps the rest. Only ever one, and only when the
   * source paragraph can spare it.
   */
  const signatureIndex = content.sections.findIndex(
    (section, index) => plan.roles.get(index) === 'signature' && section.body.trim() === '',
  );
  let claimed: { sentence: string; fromIndex: number } | null = null;
  if (signatureIndex !== -1) {
    const candidates: { sentence: string; index: number; weight: number }[] = [];
    content.sections.forEach((section, index) => {
      const sentences = section.body.split(/(?<=[.!?])\s+(?=[\p{Lu}„"'])/u).map((s) => s.trim()).filter((s) => s.length >= 40);
      if (sentences.length < 2) return; // never strip a section to nothing
      for (const sentence of sentences) {
        const weight = ev.sentences.find((s) => fold(s.text) === fold(sentence))?.weight ?? 0;
        if (weight > 0) candidates.push({ sentence, index, weight });
      }
    });
    // Strongest first; ties keep written order, so the choice is reproducible.
    candidates.sort((a, b) => (b.weight - a.weight) || (a.index - b.index));
    const best = candidates[0];
    if (best !== undefined) claimed = { sentence: best.sentence, fromIndex: best.index };
  }

  const forbiddenInHeadings = [ev.name, ev.shortName].filter((n) => n.trim() !== '');
  const usedHeadings = new Set<string>();

  const sections: WebsiteSection[] = content.sections.map((section, index) => {
    const role = plan.roles.get(index) ?? 'reveal';

    /* --- body ------------------------------------------------------ */
    let body = section.body;
    if (claimed !== null && index === claimed.fromIndex) {
      body = body.replace(claimed.sentence, '').replace(/\s{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    }
    if (claimed !== null && index === signatureIndex) {
      body = claimed.sentence;
      decisions.push({ index, kind: section.kind, role, field: 'body', basis: 'quoted', source: 'prose (moved to the signature beat)', value: body });
    }
    if (section.kind === 'hours' && ev.daysKnown > 0 && ev.daysKnown < 7) {
      body = lex.hoursPartial(ev.daysKnown, ev.hasPhone);
      decisions.push({ index, kind: section.kind, role, field: 'body', basis: 'framing', source: 'partial-hours disclosure', value: body });
    }

    /* --- heading --------------------------------------------------- */
    /*
     * A section the writer left unheaded stays unheaded.
     *
     * The statement band is the case: one sentence of the business's own words
     * alone in a band, and `composeBaseline` documents why it carries no label
     * ("a label above it would be a claim the business never made"). A director
     * that titles it "About Tartine Bakery" both breaks that composition and
     * spends the reveal frame the *about* section then cannot use. An absent
     * heading is a decision, not a gap.
     */
    const chosen = section.heading.trim() === ''
      ? { value: '', basis: 'framing' as const, source: 'left unheaded by the writer' }
      : chooseHeading(section, index, role, ev, plan, body, forbiddenInHeadings, usedHeadings);
    if (chosen.value !== '') usedHeadings.add(fold(chosen.value));
    decisions.push({ index, kind: section.kind, role, field: 'heading', basis: chosen.basis, source: chosen.source, value: chosen.value });

    /* --- subheading ------------------------------------------------ */
    let subheading = section.subheading;
    if (role === 'breadth' && subheading === null) {
      const line = ev.sentences.find((candidate) => {
        const key = fold(candidate.text).replace(/\s+/g, ' ').trim();
        if (placed.has(key)) return false;
        return ev.offerings.some((offering) => fold(candidate.text).includes(fold(offering)));
      });
      if (line !== undefined) {
        subheading = line.text;
        placed.add(fold(line.text).replace(/\s+/g, ' ').trim());
        decisions.push({ index, kind: section.kind, role, field: 'subheading', basis: 'quoted', source: 'prose', value: subheading });
      }
    }

    /* --- bullets: platform captions, business values ---------------- */
    const bullets = lex.id === 'en'
      ? section.bullets
      : section.bullets.map((bullet) => localizeBullet(bullet, lex));

    /* --- call to action --------------------------------------------- */
    let callToAction = section.callToAction;
    if (callToAction !== null) {
      const label = ctaLabelFor(section, plan.conversion, ev);
      if (label !== callToAction.label) {
        decisions.push({ index, kind: section.kind, role, field: 'cta', basis: 'framing', source: `conversion.primaryCta=${plan.conversion.primaryCta}`, value: label });
      }
      callToAction = { label, href: callToAction.href };
    }

    return { ...section, heading: chosen.value, subheading, body, bullets, callToAction };
  });

  /* --- page-level strings ------------------------------------------ */
  const trade = ev.selfDescription ?? ev.trade;

  /*
   * The eyebrow and the footer line say what the business is, in its own words.
   *
   * `composeBaseline` sets this to the listing's category, which for a Romanian
   * venue is Google's English classification — so the first screen read
   * "Event & wedding venue" above "Locație de evenimente în Drăgășani": one
   * proposition, twice, in two languages. Where the business published its own
   * answer, that is the better label; the renderer then drops the eyebrow
   * because the headline already contains it, and the footer keeps it.
   */
  const tagline = trade === null
    ? content.tagline
    : trade.charAt(0).toLocaleUpperCase() + trade.slice(1);

  const seoTitle = trade === null
    ? ev.name
    : `${ev.name} — ${lex.frame.tradeInPlace(trade, ev.place ?? '')}`;
  decisions.push({ index: -1, kind: 'hero', role: 'arrival', field: 'seo', basis: 'composed', source: 'name + self-description + locality', value: seoTitle });

  const facts = lex.id === 'en' ? content.facts : content.facts.map((fact) => localizeRating(fact, lex));
  const trust = lex.id === 'en'
    ? content.trust
    : content.trust.map((signal) => ({ ...signal, label: localizeTrust(signal.label, lex) }));

  return {
    content: {
      ...content,
      language: lex.htmlLang,
      tagline,
      sections,
      facts,
      trust,
      seo: { ...content.seo, title: seoTitle },
    },
    decisions,
    evidence: ev,
  };
}

function localizeTrust(label: string, lexicon: Lexicon): string {
  if (label === 'Open seven days a week') return lexicon.furniture.openAllWeek;
  return localizeRating(label, lexicon);
}

/**
 * The button's words, from the conversion strategy rather than from whichever
 * contact detail the profile happened to carry.
 *
 * The strategy layer decides a venue should be *booked* and a garage *called*;
 * before this, every button on every page said "Call us" because that is what
 * `primaryCtaFor` returns whenever a phone number exists. That is a later layer
 * erasing an earlier one's decision. The href is untouched — where the button
 * *points* is still resolved from what the profile can prove.
 */
export function ctaLabelFor(
  section: WebsiteSection,
  conversion: ConversionStrategy,
  ev: ContentEvidence,
): string {
  const href = section.callToAction?.href ?? '';
  // A "call to confirm" button under partial hours is answering a different
  // question from the page's primary ask, and keeps its own words.
  if (section.kind === 'hours') return ev.lexicon.furniture.callToConfirm;

  /*
   * The verb is the strategy's; the channel is the profile's.
   *
   * A venue whose evidence says `book` and whose only channel is a phone gets
   * "Rezervă" on a `tel:` link, because ringing is how one books there — the
   * button says what pressing it *achieves*, and the number is stated in full
   * in the contact block for anyone who wants the mechanism. What it may never
   * do is promise something the link cannot perform, which is why `visit`
   * (directions, a map) degrades to `call` on a telephone link rather than
   * inviting someone to walk into a phone.
   */
  if (href.startsWith('tel:')) {
    return ev.lexicon.cta[conversion.primaryCta === 'visit' ? 'call' : conversion.primaryCta];
  }
  if (href.startsWith('mailto:')) {
    return conversion.primaryCta === 'enquire' || conversion.primaryCta === 'quote'
      ? ev.lexicon.cta[conversion.primaryCta]
      : ev.lexicon.cta.enquire;
  }
  return ev.lexicon.cta[conversion.primaryCta];
}

/**
 * Picks a heading for one beat.
 *
 * The precedence is the same argument in every branch: the business's own words
 * first, a fact second, a role-keyed label last. What differs per role is
 * *which* evidence is the right evidence — a signature beat should name what
 * its photograph shows, a breadth beat should name what is on offer, a
 * conversion beat should name the action the strategy chose.
 */
function chooseHeading(
  section: WebsiteSection,
  index: number,
  role: NarrativeRole,
  ev: ContentEvidence,
  plan: NarrativePlanForCopy,
  body: string,
  forbidden: readonly string[],
  used: ReadonlySet<string>,
): Chosen {
  const lex = ev.lexicon;
  const place = ev.place ?? '';

  const prose = (): Chosen | null => {
    const phrase = headingFromProse(body, lex, forbidden);
    return phrase === null ? null : { value: phrase, basis: 'quoted', source: 'prose' };
  };
  const shown = (): Chosen | null => imageryHeading(section.images, ev, forbidden, body);
  const label = (value: string): Chosen => ({ value, basis: 'framing', source: `role:${role}` });

  /*
   * Candidates, best first: the business's own words, then a fact, then a
   * role-keyed label, and last a label disambiguated by kind.
   *
   * A list rather than a chain of early returns because the *last* entry has to
   * be reachable. A page whose gallery and about section both play `reveal`
   * would otherwise print "Despre Casa Florilor" twice — the fallback was
   * outside the freshness check, so a duplicate could only be produced by the
   * one branch that never tested for it.
   */
  const candidates: readonly (Chosen | null)[] = (() => {
    switch (role) {
      case 'arrival':
      case 'emotion': {
        // The trade, in the business's own words where it published them. A
        // directory's category is a classification; "locație de evenimente" is
        // what the business calls itself, and it is already public.
        const trade = ev.selfDescription ?? ev.trade;
        if (trade === null) return [{ value: ev.name, basis: 'quoted', source: 'business name' } as Chosen];
        const value = lex.frame.tradeInPlace(trade, place);
        return [{
          value: value.charAt(0).toLocaleUpperCase() + value.slice(1),
          basis: 'composed',
          source: ev.selfDescription !== null ? 'self-description + locality' : 'listing category + locality',
        }];
      }

      // What the photograph shows, then what the prose says about it.
      case 'signature':
        // The last resort names the business, not the town: "Inside Tartine
        // Bakery" is a true sentence about whose peak this is; "Inside San
        // Francisco" is set at display scale over four photographs of a bakery.
        return [shown(), prose(), label(lex.frame.signatureOf(ev.shortName))];

      /*
       * A reveal names what it shows only when the photographs *are* the
       * content.
       *
       * On a gallery they are, so an alt outranks the label. On an about
       * section they are an illustration beside the prose, and promoting one to
       * the heading gets a venue's story titled "Aranjament de masă în tonuri
       * blush cu candelabre înalte" — a true caption about the wrong subject.
       */
      case 'reveal':
        return section.kind === 'gallery'
          ? [prose(), shown(), label(lex.frame.reveal(ev.shortName)), label(kindLabel(section.kind, lex))]
          : [prose(), label(lex.frame.reveal(ev.shortName)), shown(), label(kindLabel(section.kind, lex))];

      case 'process':
        return [prose(), label(lex.frame.process(ev.shortName)), label(kindLabel(section.kind, lex))];

      case 'breadth':
        return [offeringsHeading(ev), label(lex.label.breadth), label(kindLabel(section.kind, lex))];

      case 'space':
        return [
          shown(),
          label(section.kind === 'location' ? lex.label.location : section.kind === 'gallery' ? lex.label.gallery : lex.label.space),
        ];

      case 'trust':
        return [ratingHeading(ev), label(lex.label.trust)];

      case 'proof':
        return [label(lex.label.proof)];

      case 'context':
        return [label(section.kind === 'location' ? lex.label.location : lex.label.hours)];

      case 'conversion': {
        // The closing beat states the action the conversion strategy chose; an
        // earlier contact beat stays a plain label, because two headings both
        // shouting the same verb is a funnel, not a page.
        if (section.kind !== 'cta') return [label(lex.label.contact)];
        const intent = ev.hasAddress || plan.conversion.primaryCta !== 'visit'
          ? plan.conversion.primaryCta
          : 'call';
        const frame = lex.frame[CLOSE_FRAME[intent]];
        return [{
          value: frame(ev.shortName, place),
          basis: 'composed',
          source: `conversion.primaryCta=${intent}`,
        }];
      }

      case 'coda':
        return [label(lex.label.coda)];
    }
  })();

  for (const candidate of candidates) {
    if (candidate === null || candidate.value.trim() === '') continue;
    if (used.has(fold(candidate.value))) continue;
    if (stutters(candidate.value, body)) continue;
    return candidate;
  }

  // Every candidate was taken or stuttered. The last resort names the section
  // and the place, which is unique on the page and still states only facts.
  const last = candidates.find((candidate): candidate is Chosen => candidate !== null);
  const fallback = last?.value ?? kindLabel(section.kind, lex);
  return {
    value: place === '' ? fallback : `${fallback}, ${place}`,
    basis: last?.basis ?? 'framing',
    source: `${last?.source ?? `role:${role}`} (disambiguated by locality)`,
  };
}

/** The role-neutral name of a section kind, in the page's language. */
function kindLabel(kind: SectionKind, lexicon: Lexicon): string {
  switch (kind) {
    case 'gallery': return lexicon.label.gallery;
    case 'hours': return lexicon.label.hours;
    case 'location': return lexicon.label.location;
    case 'contact': return lexicon.label.contact;
    case 'services':
    case 'menu': return lexicon.label.breadth;
    case 'testimonials': return lexicon.label.trust;
    case 'faq': return lexicon.label.proof;
    // "About" rather than "The space": this is the last resort for a prose
    // section, and a prose section is about the business. Tartine's about
    // section reached here and was headed "The space", which is a room.
    default: return lexicon.label.reveal;
  }
}
