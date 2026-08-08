/**
 * The page shell: everything around the sections.
 *
 * `<head>` metadata, the header and its navigation, the footer, and the
 * JSON-LD block. The shell is the only place that reads `WebsiteContent`
 * fields other than `sections` — the section renderers see one section each and
 * nothing else, which is what keeps them independently testable.
 */

import { element, empty, join, jsonLd, raw, text } from './html.js';
import { safeHref } from './assets.js';

import type { Html } from './html.js';
import type { ImageAsset, SectionKind, TrustSignal, WebsiteContent } from '../types.js';
import type { AssetPlan, ResolvedImage } from './assets.js';
import type { WebsiteDesign } from '../design/types.js';
import type { ResolvedRenderOptions } from './types.js';

/** One entry in the header navigation: a section that can be jumped to. */
export interface NavItem {
  readonly label: string;
  readonly fragment: string;
}

export interface DocumentInput {
  readonly content: WebsiteContent;
  /** Already-rendered sections, in document order. */
  readonly sections: readonly Html[];
  readonly nav: readonly NavItem[];
  readonly options: ResolvedRenderOptions;
  readonly assets: AssetPlan;
  readonly themeColor: string;
  /** The design, when one was supplied. `null` is the pre-design shell. */
  readonly design: WebsiteDesign | null;
  /** Collects what the shell had to leave out. Never throws. */
  readonly warn: (message: string) => void;
}

/** Finds the first image with a given role anywhere in the spec. */
function findByRole(content: WebsiteContent, role: ImageAsset['role']): ImageAsset | null {
  for (const section of content.sections) {
    for (const image of section.images) {
      if (image.role === role) return image;
    }
  }
  return null;
}

/**
 * The `<head>`.
 *
 * Anything the spec left empty is left out rather than emitted blank: an empty
 * `description` is a worse signal to a crawler than no description, and an
 * empty JSON-LD object is invalid structured data. A field the writer did not
 * fill is the writer's gap to report, not something markup should paper over.
 *
 * `og:image` is emitted only for an absolute `http(s)` source — a crawler has
 * nothing to resolve a relative path against, so one there is a broken preview
 * rather than a missing one.
 */
function renderHead(
  input: DocumentInput,
  logo: ResolvedImage | null,
  favicon: ResolvedImage | null,
  warn: (message: string) => void,
): Html {
  const { content, options, themeColor } = input;
  const { seo } = content;

  const title = seo.title.trim() || content.businessName;
  const description = seo.description.trim();
  const keywords = seo.keywords.map((keyword) => keyword.trim()).filter((keyword) => keyword !== '');
  const social = logo !== null && /^https?:\/\//i.test(logo.src) ? logo.src : null;

  if (seo.title.trim() === '') warn('seo.title is empty; the business name was used as the title');
  if (description === '') warn('seo.description is empty; no description meta was emitted');

  const structuredData = content.seo.structuredData;
  const hasStructuredData = Object.keys(structuredData).length > 0;
  if (!hasStructuredData) warn('seo.structuredData is empty; no JSON-LD was emitted');

  return element('head', {}, [
    element('meta', { charset: 'utf-8' }),
    element('meta', { name: 'viewport', content: 'width=device-width, initial-scale=1' }),
    element('title', {}, text(title)),
    description === '' ? null : element('meta', { name: 'description', content: description }),
    keywords.length === 0 ? null : element('meta', { name: 'keywords', content: keywords.join(', ') }),
    element('meta', { name: 'theme-color', content: themeColor }),
    element('meta', { name: 'generator', content: 'BusinessForge' }),

    element('meta', { property: 'og:type', content: 'website' }),
    element('meta', { property: 'og:site_name', content: content.businessName }),
    element('meta', { property: 'og:title', content: title }),
    description === '' ? null : element('meta', { property: 'og:description', content: description }),
    social === null ? null : element('meta', { property: 'og:image', content: social }),
    element('meta', {
      name: 'twitter:card',
      content: social === null ? 'summary' : 'summary_large_image',
    }),

    favicon === null ? null : element('link', { rel: 'icon', href: favicon.src }),
    element('link', { rel: 'stylesheet', href: options.cssFileName }),

    !hasStructuredData
      ? null
      : element('script', { type: 'application/ld+json' }, jsonLd(structuredData)),
  ]);
}

/**
 * The header: brand, then navigation.
 *
 * The brand is a link to the top of the page rather than a heading — the `<h1>`
 * belongs to the first section, and a second one here would give the document
 * two competing titles.
 */
function renderBrand(content: WebsiteContent, logo: ResolvedImage | null): Html {
  return element('a', { class: 'brand', href: '#top' }, [
    logo === null
      ? null
      : element('img', {
          class: 'brand__logo',
          src: logo.src,
          alt: logo.alt,
          width: logo.width,
          height: logo.height,
          decoding: 'async',
        }),
    /*
     * The wordmark is hidden when a logo is present.
     *
     * A logo almost always contains the business name already, so rendering
     * both printed it twice side by side — "TARTINE Tartine Bakery",
     * "PARADISE DENTAL CARE Paradise Dental Care" — on every site that had a
     * logo. It stays in the DOM rather than being dropped: the link needs an
     * accessible name, and a logo's alt text is whatever the previous site's
     * author wrote, which is often empty.
     */
    element(
      'span',
      { class: logo === null ? 'brand__name' : 'brand__name visually-hidden' },
      text(content.businessName),
    ),
  ]);
}

function renderNav(nav: readonly NavItem[], modifier: string | null, label: string): Html | null {
  if (nav.length === 0) return null;

  return element('nav', { class: modifier === null ? 'site-nav' : `site-nav ${modifier}`, 'aria-label': label },
    element('ul', { class: 'site-nav__list', role: 'list' },
      nav.map((item) =>
        element('li', {},
          element('a', { class: 'site-nav__link', href: `#${item.fragment}` }, text(item.label)),
        ),
      ),
    ),
  );
}

/**
 * The header: brand, then navigation.
 *
 * The brand is a link to the top of the page rather than a heading — the `<h1>`
 * belongs to the first section, and a second one here would give the document
 * two competing titles.
 *
 * `LayoutPlan.stickyHeader` is a class, not a style: a short page's header
 * scrolling away is a design decision, and putting it in the markup lets a
 * reviewer see which pages made it. Without a design the header carries no
 * modifier at all and the base sheet's sticky rule stands, which is what the
 * renderer emitted before the design layer existed.
 */
function renderHeader(input: DocumentInput, logo: ResolvedImage | null): Html {
  const { content, nav, design } = input;
  const sticky = design !== null && design.layout.stickyHeader;

  return element('header', { class: `site-header${sticky ? ' site-header--sticky' : ''}` },
    element('div', { class: 'container site-header__inner' }, [
      renderBrand(content, logo),
      renderNav(nav, design === null ? null : 'site-nav--header', 'Sections'),
    ]),
  );
}

/**
 * Bullets from the first section of a given kind.
 *
 * The rich footer repeats the contact details and the opening hours, which is
 * the convention it exists for. It repeats them verbatim from the sections the
 * writer already produced — a footer that states a phone number the page does
 * not is a footer inventing facts.
 */
function bulletsOf(content: WebsiteContent, kind: SectionKind): readonly string[] {
  return content.sections.find((section) => section.kind === kind)?.bullets ?? [];
}

/** A contact line, linked when it is plainly an email or a phone number. */
function contactLine(value: string): Html {
  const trimmed = value.trim();
  const scheme = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    ? `mailto:${trimmed}`
    : /^[+()\d][\d\s()+.-]{6,}$/.test(trimmed)
      ? `tel:${trimmed.replace(/[^\d+]/g, '')}`
      : null;

  if (scheme === null) return element('li', {}, text(trimmed));
  const href = safeHref(scheme);
  if (href === null) return element('li', {}, text(trimmed));
  return element('li', {}, element('a', { href }, text(trimmed)));
}

function footerColumn(title: string, items: readonly string[], linked: boolean): Html | null {
  if (items.length === 0) return null;

  return element('div', { class: 'site-footer__column' }, [
    element('h2', { class: 'site-footer__title' }, text(title)),
    element('ul', { class: 'site-footer__list', role: 'list' },
      items.map((item) => (linked ? contactLine(item) : element('li', {}, text(item.trim())))),
    ),
  ]);
}

/**
 * The footer, in the variant the design chose.
 *
 * No copyright year in any of them: the renderer is deterministic, and a year
 * read from the clock would make the same spec render differently on New Year's
 * Eve. It is also a claim about the business that nothing in the profile
 * supports.
 */
function renderFooter(input: DocumentInput): Html {
  const { content, design, nav } = input;
  const tagline = content.tagline.trim();
  const variant = design?.layout.footer ?? 'minimal';

  const colophon = element('div', { class: 'site-footer__colophon' }, [
    element('p', {}, join([raw('&copy; '), text(content.businessName)])),
    tagline === '' ? null : element('p', {}, text(tagline)),
  ]);

  if (variant === 'minimal') {
    return element('footer', { class: design === null ? 'site-footer' : 'site-footer site-footer--minimal' },
      element('div', { class: 'container site-footer__inner' }, [
        element('p', {}, join([raw('&copy; '), text(content.businessName)])),
        tagline === '' ? null : element('p', {}, text(tagline)),
      ]),
    );
  }

  const columns: (Html | null)[] = [
    element('div', { class: 'site-footer__column site-footer__column--brand' }, [
      element('p', { class: 'site-footer__name' }, text(content.businessName)),
      tagline === '' ? null : element('p', { class: 'site-footer__tagline' }, text(tagline)),
    ]),
    nav.length === 0
      ? null
      : element('div', { class: 'site-footer__column' }, [
          element('h2', { class: 'site-footer__title' }, text('Sections')),
          renderNav(nav, 'site-nav--footer', 'Footer'),
        ]),
    footerColumn('Contact', bulletsOf(content, 'contact'), true),
  ];

  if (variant === 'rich') {
    columns.push(footerColumn('Hours', bulletsOf(content, 'hours'), false));
    columns.push(footerColumn('Find us', bulletsOf(content, 'location'), false));
  }

  return element('footer', { class: `site-footer site-footer--${variant}` },
    element('div', { class: 'container' }, [
      element('div', { class: 'site-footer__grid' }, columns),
      colophon,
      renderWordmark(content.businessName),
    ]),
  );
}

/**
 * The business's name at the foot of the page, at a size nothing else reaches.
 *
 * `marquee-wordmark`. It invents nothing — the name is already in the header,
 * the `<title>`, the colophon and the structured data — and it gives the page a
 * full stop instead of letting it stop.
 *
 * `aria-hidden`, and that is the point rather than an oversight: the name has
 * already been announced three times above this, and a screen reader hearing it
 * a fourth time gains nothing. It is set as real text so it stays crisp and
 * selectable-looking at any zoom, and marked decorative so it is silent.
 *
 * Sized by character count in CSS, which needs the count here.
 */
function renderWordmark(businessName: string): Html | null {
  const name = businessName.trim();
  if (name === '') return null;
  return element(
    'p',
    {
      class: 'wordmark',
      'aria-hidden': 'true',
      style: `--wordmark-length: ${Math.max(name.length, 6)}`,
    },
    text(name),
  );
}

/**
 * A rule of verified facts, directly under the hero.
 *
 * `marquee-verified-facts`. Every item is a `TrustSignal`, which code builds
 * from the profile and a model may never write — so the band cannot contain a
 * claim the business has not proved. Where fewer than three exist the band is
 * not rendered at all, because a marquee with two items in it does not read as
 * a rule, it reads as a mistake.
 *
 * The track is duplicated so the horizontal loop has no seam. The copy is
 * `aria-hidden`, so the facts are announced once.
 */
function renderFactsBar(facts: readonly string[]): Html | null {
  const labels = facts.map((fact) => fact.trim()).filter((label) => label !== '');
  if (labels.length < 3) return null;

  /*
   * The facts are repeated until the track is wider than any viewport.
   *
   * A business with three verified facts produced a 496px track on a 1440px
   * page, so the band was mostly empty and the loop showed a visible gap every
   * few seconds. Repeating to a floor of twelve items fills the widest common
   * desktop width whatever the business has, and costs a handful of spans.
   *
   * The repeats are inside each track rather than being more tracks, so the
   * "shift by half" that makes the loop seamless still holds.
   */
  const REPEAT_FLOOR = 12;
  const repeats = Math.max(1, Math.ceil(REPEAT_FLOOR / labels.length));
  const items = Array.from({ length: repeats }, () => labels).flat();

  const run = (): Html =>
    element(
      'div',
      { class: 'facts-bar__track' },
      items.map((label) => element('span', { class: 'facts-bar__item' }, text(label))),
    );

  /*
   * The whole band is decorative, and that is the honest marking.
   *
   * The first version labelled it as a landmark and hid only the duplicate
   * track. Once the facts were repeated to fill the width, that left a screen
   * reader hearing "Bakery, San Francisco, 4.5 on Google" four times in a row —
   * which is worse than not hearing it at all.
   *
   * Marking the band `aria-hidden` is correct rather than a workaround,
   * because `verifiedFacts` only ever contains facts that are also stated
   * somewhere a reader can act on: the category and locality are in the hero
   * heading, the rating is in the contact block and the structured data, and
   * the attributes are in the offerings list. Nothing is lost by silencing a
   * band that says what the page has already said.
   *
   * The corollary is a rule the composer has to keep: **nothing may appear
   * only in the marquee.**
   */
  return element(
    'div',
    { class: 'facts-bar', 'aria-hidden': 'true' },
    element('div', { class: 'facts-bar__viewport' }, [run(), run()]),
  );
}

/**
 * Assembles the document.
 *
 * `<main id="main" tabindex="-1">` is the skip link's target: without the
 * tabindex the browser moves the scroll position but not the focus, so the next
 * Tab returns to the navigation the user just skipped. The brand's `#top` needs
 * no element — HTML defines that fragment as the top of the document.
 */
export function renderDocument(input: DocumentInput): string {
  const { content, options, assets, design } = input;

  const logoAsset = findByRole(content, 'logo');
  const faviconAsset = findByRole(content, 'favicon');
  const logo = logoAsset === null ? null : assets.resolve(logoAsset, content.businessName);
  const favicon = faviconAsset === null ? null : assets.resolve(faviconAsset, null);

  const body = element('body', {}, [
    element('a', { class: 'skip-link', href: '#main' }, text('Skip to content')),
    renderHeader(input, logo),
    element('main', { id: 'main', class: 'site-main', tabindex: '-1' },
      input.sections.length === 0
        ? renderEmptyMain(content)
        : join(
            /*
             * The facts rule goes directly after the hero, which is the one
             * place on the page where a visitor is already deciding. Inserted
             * here rather than emitted as a section because it is not one — it
             * has no heading, no landmark of its own and no place in the
             * navigation, and making it a `WebsiteSection` would put it in all
             * three.
             */
            design === null
              ? input.sections
              : [
                  ...input.sections.slice(0, 1),
                  renderFactsBar(content.facts) ?? empty,
                  ...input.sections.slice(1),
                ],
            '\n',
          ),
    ),
    renderFooter(input),
  ]);

  // The root carries the decisions that hold for the whole page. Rules that
  // vary by direction, industry or colour scheme key off these rather than off
  // a class the stylesheet would have to invent a name for — and a reviewer can
  // read the four loudest choices off the first line of the document.
  const html = element('html', {
    lang: options.lang,
    ...(design === null ? {} : {
      'data-direction': design.personality.direction,
      'data-industry': design.industry.id,
      'data-density': design.personality.density,
      'data-contrast': design.personality.contrast,
      'data-scheme': design.tokens.color.scheme,
      'data-mood': `${design.personality.mood.temperature} ${design.personality.mood.energy} ${design.personality.mood.formality}`,
      'data-heading-character': design.tokens.typography.heading.character,
      'data-motion': design.tokens.motion.level,
      'data-icons': design.icons.style,
      'data-imagery': design.imagery.treatment,
      'data-a11y': design.accessibility.targetLevel,
    }),
  }, [
    renderHead(input, logo, favicon, input.warn),
    body,
  ]);

  return `<!doctype html>\n${html}\n`;
}

/**
 * What `<main>` holds when the spec has no sections at all.
 *
 * A degenerate spec still produces a valid, titled document with one `<h1>` —
 * an empty `<main>` would fail the same accessibility checks a real page has to
 * pass, and hide the fact that the writer produced nothing.
 */
function renderEmptyMain(content: WebsiteContent): Html {
  const tagline = content.tagline.trim();

  return element('section', { class: 'section' },
    element('div', { class: 'container' }, [
      element('h1', {}, text(content.businessName)),
      tagline === '' ? null : element('p', { class: 'section__subheading' }, text(tagline)),
    ]),
  );
}
