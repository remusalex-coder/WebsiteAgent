/**
 * `WebsiteContent` fixtures.
 *
 * Two specs, at the two ends of what a writer can emit. `fullContent` uses
 * every section kind and deliberately carries the characters that break naive
 * escaping — an ampersand and angle brackets in the business name, a quote mark
 * in a heading, and a `</script>` inside the JSON-LD payload. `minimalContent`
 * leaves every optional field empty, which is the shape a thin profile produces
 * and the one most likely to throw.
 */

import type { ImageAsset, WebsiteContent, WebsiteSection } from '../../lib/types.js';

const SITE = 'https://example.test';

function image(overrides: Partial<ImageAsset> & Pick<ImageAsset, 'url' | 'role'>): ImageAsset {
  return {
    sourceUrl: SITE,
    alt: null,
    width: null,
    height: null,
    localPath: null,
    bytes: null,
    ...overrides,
  };
}

export const logoAsset: ImageAsset = image({
  url: `${SITE}/logo.png`,
  role: 'logo',
  localPath: 'assets/logo-a1b2.png',
  width: 240,
  height: 80,
});

export const faviconAsset: ImageAsset = image({
  url: `${SITE}/favicon.ico`,
  role: 'favicon',
  localPath: 'assets/favicon-c3d4.ico',
});

export const heroAsset: ImageAsset = image({
  url: `${SITE}/hero.jpg`,
  role: 'hero',
  alt: 'Loaves cooling on a rack',
  localPath: 'assets/hero-e5f6.jpg',
  width: 1600,
  height: 900,
});

/** Never downloaded — exercises the hot-link fallback. */
export const remoteAsset: ImageAsset = image({
  url: `${SITE}/gallery/counter.jpg`,
  role: 'gallery',
  alt: 'The counter at opening time',
});

/** No alt and nowhere to load from: must be dropped, with a warning. */
export const unusableAsset: ImageAsset = image({
  url: 'javascript:alert(1)',
  role: 'gallery',
});

const sections: readonly WebsiteSection[] = [
  {
    kind: 'hero',
    heading: 'Bread baked before dawn',
    subheading: 'A neighbourhood bakery on Rua da Prata',
    body: 'We mill our own flour and bake through the night.\n\nEverything is sold the day it is made.',
    bullets: [],
    images: [logoAsset, faviconAsset, heroAsset],
    callToAction: { label: 'Find us', href: '#location' },
  },
  {
    kind: 'about',
    heading: 'About "the oven"',
    subheading: null,
    body: 'Two ovens, four bakers & one long counter.',
    bullets: [],
    images: [],
    callToAction: null,
  },
  {
    kind: 'services',
    heading: 'What we bake',
    subheading: 'Daily, from 6am',
    body: '',
    bullets: ['Sourdough <400g>', 'Pastel de nata', 'Custom celebration cakes'],
    images: [],
    callToAction: null,
  },
  {
    kind: 'menu',
    heading: 'Menu',
    subheading: null,
    body: '',
    bullets: ['Coffee & pastry, 2.40', 'Soup of the day, 4.50'],
    images: [],
    callToAction: null,
  },
  {
    kind: 'gallery',
    heading: 'The shop',
    subheading: null,
    body: '',
    bullets: [],
    images: [remoteAsset, unusableAsset],
    callToAction: null,
  },
  {
    kind: 'testimonials',
    heading: 'What people say',
    subheading: null,
    body: '',
    bullets: ['"Best nata in the city." — a regular'],
    images: [],
    callToAction: null,
  },
  {
    kind: 'hours',
    heading: 'Opening hours',
    subheading: null,
    body: '',
    bullets: ['Tuesday to Saturday, 07:00-19:00', 'Sunday, 08:00-13:00'],
    images: [],
    callToAction: null,
  },
  {
    kind: 'location',
    heading: 'Find us',
    subheading: null,
    body: 'Rua da Prata 112, 1100-417 Lisboa',
    bullets: [],
    images: [],
    callToAction: { label: 'Open in Maps', href: 'https://maps.example.test/place/112' },
  },
  {
    kind: 'contact',
    heading: 'Contact',
    subheading: null,
    body: '',
    bullets: ['+351 21 000 0000', 'ola@example.test'],
    images: [],
    callToAction: { label: 'Call the shop', href: 'tel:+351210000000' },
  },
  {
    kind: 'faq',
    heading: 'Questions',
    subheading: null,
    body: '',
    bullets: ['Do you take card? Yes.', 'Can I order ahead? By phone, two days out.'],
    images: [],
    callToAction: null,
  },
  {
    kind: 'cta',
    heading: 'Order a cake',
    subheading: 'Two days notice',
    body: '',
    bullets: [],
    images: [],
    callToAction: { label: 'Email us', href: 'mailto:ola@example.test' },
  },
];

export const fullContent: WebsiteContent = {
  businessName: 'Padaria Ana & Sons <Lisboa>',
  tagline: 'Bread, coffee & nothing else',
  voice: {
    tone: 'warm',
    palette: ['#5b3a29', '#c98a3f', '#faf6f0'],
    typography: { heading: 'Playfair Display', body: 'Inter' },
  },
  sections,
  seo: {
    title: 'Padaria Ana & Sons — bakery in Lisboa',
    description: 'Sourdough, pastel de nata & coffee on Rua da Prata. Open Tuesday to Sunday.',
    keywords: ['bakery lisboa', 'pastel de nata', ''],
    structuredData: {
      '@type': 'LocalBusiness',
      '@context': 'https://schema.org',
      name: 'Padaria Ana & Sons <Lisboa>',
      // The one payload that can turn data into markup.
      description: 'A bakery </script><script>alert(1)</script>',
      address: {
        streetAddress: 'Rua da Prata 112',
        addressLocality: 'Lisboa',
        '@type': 'PostalAddress',
      },
      telephone: '+351 21 000 0000',
    },
  },
  unresolvedGaps: ['Year the bakery opened is not stated anywhere in the profile.'],
};

/** Every optional field empty: the shape a thin profile produces. */
export const minimalContent: WebsiteContent = {
  businessName: 'Corner Shop',
  tagline: '',
  voice: {
    tone: '',
    palette: [],
    typography: { heading: '', body: '' },
  },
  sections: [
    {
      kind: 'hero',
      heading: 'Corner Shop',
      subheading: null,
      body: '',
      bullets: [],
      images: [],
      callToAction: null,
    },
  ],
  seo: {
    title: 'Corner Shop',
    description: '',
    keywords: [],
    structuredData: {},
  },
  unresolvedGaps: [],
};

/** No sections at all — the degenerate spec the shell has to survive. */
export const emptyContent: WebsiteContent = {
  ...minimalContent,
  businessName: 'Nothing Yet',
  tagline: 'A tagline and no sections',
  sections: [],
};
