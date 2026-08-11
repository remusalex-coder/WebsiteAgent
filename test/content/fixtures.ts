/**
 * Compact fixtures for the content layer.
 *
 * A full `BusinessProfile` is thirty fields and a `WebsiteContent` is ten more;
 * spelled out per test they hide the one thing each test is about. These build
 * a valid pair from a short spec, the same way `test/design/benchmark.test.ts`
 * does — and deliberately shaped like real research output, never like a
 * generated page, because the whole point of the content layer is what it does
 * with *evidence*.
 */

import type {
  BusinessProfile,
  ImageAsset,
  OpeningHours,
  SectionKind,
  WebsiteContent,
  WebsiteSection,
} from '../../lib/types.js';

export interface Photo {
  readonly alt: string;
  readonly w?: number;
  readonly h?: number;
  readonly host?: string;
}

export interface Spec {
  readonly name: string;
  readonly category: string | null;
  readonly description: string;
  readonly locality: string | null;
  readonly services: readonly string[];
  readonly attributes?: readonly string[];
  readonly rating?: number | null;
  readonly reviewCount?: number | null;
  readonly phone?: boolean;
  readonly email?: boolean;
  readonly hours?: readonly OpeningHours[];
  readonly photos?: readonly Photo[];
  readonly pages?: readonly string[];
}

function image(photo: Photo, index: number): ImageAsset {
  const host = photo.host ?? 'ownsite.example';
  return {
    url: `https://${host}/img${index}.jpg`,
    role: index === 0 ? 'hero' : 'gallery',
    alt: photo.alt,
    width: photo.w ?? 1600,
    height: photo.h ?? 1066,
    localPath: `assets/g${index}.jpg`,
    bytes: 200000,
    sourceUrl: `https://${host}/page`,
  };
}

export function profileFrom(spec: Spec): BusinessProfile {
  const photos = (spec.photos ?? []).map(image);
  const attributed = <T>(value: T) => ({ value, source: 'maps' as const, sourceUrl: 'https://maps.example', alternatives: [] });

  return {
    name: attributed(spec.name),
    category: spec.category === null ? null : attributed(spec.category),
    description: { value: spec.description, source: 'website', sourceUrl: 'https://ownsite.example', alternatives: [] },
    address: spec.locality === null ? null : attributed({
      formatted: `1 Main Street, ${spec.locality}`,
      street: '1 Main Street',
      locality: spec.locality,
      region: null,
      postalCode: null,
      country: null,
    }),
    coordinates: null,
    website: attributed('https://ownsite.example'),
    phones: spec.phone === false ? [] : [attributed({ formatted: '0700 900 900', e164: '+447009009000', digits: '07009009000' })],
    emails: spec.email === true ? [attributed('hello@ownsite.example')] : [],
    socialProfiles: [],
    hours: spec.hours ?? [],
    rating: spec.rating === undefined || spec.rating === null ? null : attributed(spec.rating),
    reviewCount: spec.reviewCount === undefined || spec.reviewCount === null ? null : attributed(spec.reviewCount),
    navigation: [],
    services: spec.services.map((name) => ({ name, description: `${name} for every occasion.`, sourceUrl: 'https://ownsite.example' })),
    pages: (spec.pages ?? []).map((text, index) => ({ url: `https://ownsite.example/p${index}`, title: 'About', text })),
    attributes: (spec.attributes ?? []).map((label) => ({ label, available: true, group: 'Amenities', sourceUrl: 'https://maps.example' })),
    reviews: [],
    images: { logo: null, favicon: null, hero: photos[0] ?? null, gallery: photos.slice(1) },
    validation: { ok: true, issues: [] },
    sources: ['https://maps.example'],
    normalizedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as BusinessProfile;
}

/**
 * The page shape `composeBaseline` produces, with its generic English labels.
 *
 * Written out rather than produced by calling the composer so a content test
 * fails for a content reason: the point of these fixtures is the *input* to the
 * director, and it must not move when the composer's wording does.
 */
export function baselineFrom(spec: Spec, kinds: readonly SectionKind[]): WebsiteContent {
  const photos = (spec.photos ?? []).map(image);
  const [lead, ...rest] = spec.description.split(/(?<=[.!?])\s+/u);

  const section = (kind: SectionKind): WebsiteSection => {
    switch (kind) {
      case 'hero':
        return {
          kind, heading: spec.locality === null ? (spec.category ?? spec.name) : `${spec.category ?? spec.name} in ${spec.locality}`,
          subheading: null, body: lead ?? '', bullets: [],
          images: photos.slice(0, 1),
          callToAction: spec.phone === false ? null : { label: 'Call us', href: 'tel:+447009009000' },
        };
      case 'about':
        return { kind, heading: `About ${spec.name}`, subheading: null, body: rest.join(' '), bullets: [], images: [], callToAction: null };
      case 'services':
        return {
          kind, heading: 'What we offer', subheading: null, body: '',
          bullets: spec.services.map((name) => `${name} — ${name} for every occasion.`),
          images: [], callToAction: null,
        };
      case 'gallery':
        return { kind, heading: 'Photographs', subheading: null, body: '', bullets: [], images: photos.slice(1), callToAction: null };
      case 'hours':
        return {
          kind, heading: 'Opening hours', subheading: null, body: '',
          bullets: (spec.hours ?? []).length === 0 ? [] : ['Monday to Friday — 09:00–17:00'],
          images: [], callToAction: null,
        };
      case 'contact':
        return {
          kind, heading: 'Contact', subheading: null, body: '',
          bullets: [
            ...(spec.locality === null ? [] : [`Address — 1 Main Street, ${spec.locality}`]),
            ...(spec.phone === false ? [] : ['Phone — 0700 900 900']),
            ...(spec.rating === undefined || spec.rating === null ? [] : [`Rating — ${spec.rating} on Google${spec.reviewCount ? ` from ${spec.reviewCount} reviews` : ''}`]),
          ],
          images: [], callToAction: spec.phone === false ? null : { label: 'Call us', href: 'tel:+447009009000' },
        };
      case 'cta':
        return {
          kind,
          heading: spec.locality === null ? `Get in touch with ${spec.name}` : `Visit ${spec.name} in ${spec.locality}`,
          subheading: null, body: '', bullets: [], images: [],
          callToAction: spec.phone === false ? null : { label: 'Call us', href: 'tel:+447009009000' },
        };
      default:
        return { kind, heading: kind, subheading: null, body: '', bullets: [], images: [], callToAction: null };
    }
  };

  return {
    businessName: spec.name,
    tagline: spec.category ?? '',
    language: 'en',
    voice: { tone: '', palette: [], typography: { heading: '', body: '' } },
    sections: kinds.map(section),
    trust: spec.rating === undefined || spec.rating === null
      ? []
      : [{ kind: 'rating', label: `${spec.rating} on Google${spec.reviewCount ? ` from ${spec.reviewCount} reviews` : ''}`, source: 'maps' }],
    facts: [spec.category ?? '', spec.locality ?? ''].filter((fact) => fact !== ''),
    seo: { title: spec.name, description: lead ?? '', keywords: [], structuredData: {} },
    unresolvedGaps: [],
  } as unknown as WebsiteContent;
}

/** A Romanian event venue: the business the content layer was built for. */
export const VENUE: Spec = {
  name: 'Casa Florilor Târgoviște',
  category: 'Event & wedding venue',
  locality: 'Târgoviște',
  description:
    'Casa Florilor este o locație de evenimente din Târgoviște, pe malul lacului, cu spații interioare și exterioare pentru nunți, botezuri și celebrări. '
    + 'Sala mare, cu pereți damasc și un candelabru impunător, găzduiește momentul semnătură al casei — primul dans sub lumini reci. '
    + 'Echipa ajută fiecare cuplu să personalizeze spațiul, iar bucătăria proprie îmbină tradiția românească cu influențe internaționale.',
  services: ['Nunți', 'Botezuri', 'Cununii civile', 'Evenimente corporate', 'Gastronomie', 'Cazare'],
  attributes: ['Sală mare de recepție', 'Grădină de ceremonie', 'Parcare gratuită'],
  rating: 4.7,
  reviewCount: 217,
  hours: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, opens: '09:00', closes: '17:00' })),
  photos: [
    { alt: 'Primul dans sub lumini reci, în sala mare' },
    { alt: 'Sala mare cu candelabru floral și arcade filigranate' },
    { alt: 'Grădina de ceremonie la apus', w: 1200, h: 1600 },
    { alt: 'Aranjament de masă în tonuri blush', w: 1400, h: 1400 },
    { alt: 'Prezidiu cu drapaj verde' },
  ],
};

/** An English garage: functional, text-led, high-intent. The opposite shape. */
export const GARAGE: Spec = {
  name: 'Fairfield Motors',
  category: 'Auto repair shop',
  locality: 'Bristol',
  description:
    'Fairfield Motors is an independent garage in Bristol. We service and repair cars of every make, and we are open six days a week.',
  services: ['Servicing', 'MOT testing', 'Diagnostics', 'Brakes and tyres'],
  attributes: ['Wheelchair-accessible entrance'],
  rating: 4.4,
  reviewCount: 96,
  hours: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, opens: '08:00', closes: '18:00' })),
  photos: [],
};

/**
 * A small English bakery with real photography: three named offerings, a warm
 * register, and enough usable images across enough framings that the evidence
 * earns a `narrative` arc with the gallery as its signature.
 *
 * The contrast with `VENUE` is the point. Both have a gallery; only this one's
 * evidence makes it the page's peak, so the same section kind must be written
 * differently in the two pages.
 */
export const BAKERY: Spec = {
  name: 'Mill Lane Bakehouse',
  category: 'Bakery',
  locality: 'Frome',
  description:
    'Mill Lane Bakehouse is a small bakery on the edge of Frome. Everything is mixed by hand the evening before and baked from four in the morning. '
    + 'The stone oven at the back of the room has been in use since the building was a mill, and every loaf that leaves the counter has been in it.',
  services: ['Sourdough', 'Pastries', 'Celebration cakes'],
  rating: 4.8,
  reviewCount: 140,
  hours: [2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, opens: '07:30', closes: '15:00' })),
  photos: [
    { alt: 'Loaves cooling on a rack by the window' },
    { alt: 'The stone oven at four in the morning' },
    { alt: 'Croissants on a tray', w: 1200, h: 1500 },
    { alt: 'The counter, first thing', w: 1400, h: 1400 },
    { alt: 'A split sourdough crumb, close' },
    { alt: 'Dough under linen, proving overnight', w: 1200, h: 1600 },
  ],
};
