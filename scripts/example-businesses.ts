/**
 * Fifty businesses for reviewing the design layer — twenty here, thirty in
 * `example-businesses-extra.ts`.
 *
 * Written by hand rather than generated so that each one reads like a real
 * listing — the design layer takes signals from the copy (`chooseDirection`
 * votes on words like "artisan" and "bespoke"), so filler text would produce
 * filler designs and prove nothing.
 *
 * **No palette entry carries a colour.** That is deliberate: with a brand colour
 * present the industry fallback hue never fires, and the fallback hues are the
 * thing under review. These fifty are the calibration seen at full size.
 */

import type {
  Attributed,
  BusinessProfile,
  BusinessStrategy,
  ImageAsset,
  PageText,
  WebsiteContent,
  WebsiteSection,
} from '../lib/types.js';

import { EXTRA_EXAMPLES } from './example-businesses-extra.js';
import { SOURCE, galleryImages, heroImage } from './example-images.js';

// Re-exported so an existing caller importing them from here still resolves.
export { galleryImages, heroImage };

function attributed<T>(value: T): Attributed<T> {
  return { value, source: 'website', sourceUrl: SOURCE, alternatives: [] };
}

/** A section, with everything optional defaulted. */
type SectionSpec =
  & Pick<WebsiteSection, 'kind' | 'heading'>
  & Partial<Omit<WebsiteSection, 'kind' | 'heading'>>;

export interface ExampleSpec {
  readonly slug: string;
  readonly label: string;
  readonly name: string;
  readonly listingCategory: string;
  readonly strategyPrimary: string;
  readonly strategySecondary: readonly string[];
  readonly tagline: string;
  readonly tone: string;
  readonly headingFont: string;
  readonly bodyFont: string;
  readonly services: readonly string[];
  readonly sections: readonly SectionSpec[];
  readonly seoDescription: string;
}

export interface Example {
  readonly spec: ExampleSpec;
  readonly profile: BusinessProfile;
  readonly strategy: BusinessStrategy;
  readonly content: WebsiteContent;
}

function section(spec: SectionSpec): WebsiteSection {
  return {
    subheading: null,
    body: '',
    bullets: [],
    images: [],
    callToAction: null,
    ...spec,
  };
}

/** The page text the collector would have captured, for the copy-signal vote. */
function pages(spec: ExampleSpec): readonly PageText[] {
  return [{
    url: SOURCE,
    title: spec.name,
    text: [spec.tagline, spec.seoDescription, ...spec.sections.map((s) => s.body ?? '')].join(' '),
    fetchedAt: '2026-08-06T00:00:00.000Z',
  }];
}

export function build(spec: ExampleSpec): Example {
  const profile: BusinessProfile = {
    name: attributed(spec.name),
    category: attributed(spec.listingCategory),
    address: null,
    coordinates: null,
    website: attributed(SOURCE),
    phones: [],
    emails: [],
    socialProfiles: [],
    hours: [],
    rating: null,
    reviewCount: null,
    navigation: [],
    services: spec.services.map((name) => ({ name, description: null, sourceUrl: SOURCE })),
    pages: pages(spec),
    images: { logo: null, favicon: null, hero: null, gallery: [] },
    validation: { ok: true, issues: [] },
    sources: [SOURCE],
    normalizedAt: '2026-08-06T00:00:00.000Z',
  };

  const strategy: BusinessStrategy = {
    businessName: spec.name,
    category: {
      primary: spec.strategyPrimary,
      secondary: [...spec.strategySecondary],
      rationale: `Listed on Maps as "${spec.listingCategory}".`,
      basis: 'listing',
    },
    goals: [],
    audience: {
      primary: {
        name: 'Local customers',
        description: 'People searching for this service nearby.',
        needs: ['what is offered', 'how to get in touch'],
        rationale: 'A local business serves a local catchment.',
      },
      secondary: [],
    },
    pages: [],
    features: [],
    tone: { descriptor: spec.tone, rationale: 'Taken from the site copy.' },
    competitors: [],
    recommendations: [],
    unknowns: [],
    generatedAt: '2026-08-06T00:00:00.000Z',
  };

  const content: WebsiteContent = {
    businessName: spec.name,
    tagline: spec.tagline,
    voice: {
      tone: spec.tone,
      // Empty on purpose — see the file header.
      palette: [],
      typography: { heading: spec.headingFont, body: spec.bodyFont },
    },
    sections: spec.sections.map(section),
    seo: {
      title: `${spec.name} — ${spec.label}`,
      description: spec.seoDescription,
      keywords: [],
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: spec.name,
        description: spec.seoDescription,
      },
    },
    unresolvedGaps: [],
  };

  return { spec, profile, strategy, content };
}

/** The original twenty. `EXAMPLES` is these plus `EXTRA_EXAMPLES`. */
const CORE_EXAMPLES: readonly ExampleSpec[] = [
  {
    slug: 'bakery',
    label: 'Bakery',
    name: 'Fennel & Rye',
    listingCategory: 'Bakery',
    strategyPrimary: 'Bakery',
    strategySecondary: ['Cafe'],
    tagline: 'Baked before dawn, sold the same day',
    tone: 'warm and unfussy',
    headingFont: 'Nunito Sans',
    bodyFont: 'Nunito Sans',
    services: ['Sourdough', 'Viennoiserie', 'Celebration cakes', 'Wholesale to cafes'],
    seoDescription: 'A neighbourhood bakery milling its own flour. Sourdough, pastries and cakes to order.',
    sections: [
      {
        kind: 'hero',
        heading: 'Bread worth the walk',
        subheading: 'Milled, mixed and baked on Cross Street',
        body: 'We start the ovens at three in the morning and stop when the shelves are empty.',
        images: [heroImage('Loaves cooling on a rack')],
        callToAction: { label: 'See what is baking', href: '#what-we-bake' },
      },
      {
        kind: 'services',
        heading: 'What we bake',
        subheading: 'Daily, from 7am',
        bullets: ['Country sourdough, 48-hour ferment', 'Rye and caraway', 'Croissants and pain au chocolat', 'Cakes to order, three days notice'],
      },
      { kind: 'menu', heading: 'Counter menu', bullets: ['Coffee and a pastry — 4.20', 'Half loaf — 3.10', 'Soup and bread — 6.50'] },
      { kind: 'gallery', heading: 'The bakehouse', images: galleryImages(6, 'In the bakehouse') },
      { kind: 'hours', heading: 'Opening hours', bullets: ['Tuesday to Saturday, 07:00–17:00', 'Sunday, 08:00–13:00', 'Closed Monday'] },
      { kind: 'location', heading: 'Find us', body: '14 Cross Street' },
      { kind: 'contact', heading: 'Contact', bullets: ['hello@example.test', '0161 000 0000'] },
    ],
  },
  {
    slug: 'restaurant',
    label: 'Restaurant',
    name: 'Saltram',
    listingCategory: 'Italian restaurant',
    strategyPrimary: 'Restaurant',
    strategySecondary: ['Fine dining'],
    tagline: 'A short menu, changed weekly',
    tone: 'considered',
    headingFont: 'Lora',
    bodyFont: 'Source Sans 3',
    services: ['Dinner service', 'Private dining', 'Wine pairing'],
    seoDescription: 'A twenty-eight cover dining room. One menu, written each Monday around whatever the growers sent.',
    sections: [
      {
        kind: 'hero',
        heading: 'One menu, written on Monday',
        subheading: 'Twenty-eight covers, one sitting',
        body: 'We cook what arrived that week. The menu is not published in advance because we do not know it in advance.',
        images: [heroImage('A plate on the pass')],
        callToAction: { label: 'Reserve a table', href: '#contact' },
      },
      { kind: 'menu', heading: 'This week', bullets: ['Cuttlefish, fennel, bottarga', 'Hogget, turnip tops, anchovy', 'Quince, buttermilk, hazelnut'] },
      { kind: 'gallery', heading: 'The room', images: galleryImages(5, 'The dining room') },
      { kind: 'about', heading: 'The kitchen', body: 'Four cooks, one pass, no sections. Everything leaves the kitchen through the same pair of hands.' },
      { kind: 'testimonials', heading: 'Said elsewhere', bullets: ['"The best argument in the city for eating what you are given."'] },
      { kind: 'hours', heading: 'Service', bullets: ['Wednesday to Saturday, one sitting at 19:30'] },
      { kind: 'location', heading: 'Where', body: '3 Saltram Place' },
      { kind: 'contact', heading: 'Reservations', bullets: ['book@example.test'] },
    ],
  },
  {
    slug: 'cafe',
    label: 'Cafe',
    name: 'Third Room',
    listingCategory: 'Coffee shop',
    strategyPrimary: 'Cafe',
    strategySecondary: ['Coffee roaster'],
    tagline: 'Coffee, and somewhere to sit with it',
    tone: 'friendly and calm',
    headingFont: 'Nunito Sans',
    bodyFont: 'Nunito Sans',
    services: ['Espresso bar', 'Filter coffee', 'Retail beans', 'Brew classes'],
    seoDescription: 'A small coffee shop roasting on site. Espresso, filter, and beans to take home.',
    sections: [
      {
        kind: 'hero',
        heading: 'Somewhere to sit with it',
        subheading: 'Roasted at the back, poured at the front',
        body: 'Ten tables, no laptops after noon, and a roaster that runs on Tuesdays.',
        images: [heroImage('The espresso bar')],
        callToAction: { label: 'See the menu', href: '#menu' },
      },
      { kind: 'menu', heading: 'Menu', bullets: ['Espresso — 2.60', 'Batch filter — 3.00', 'Cortado — 3.20', 'Beans, 250g — 11.00'] },
      { kind: 'gallery', heading: 'The room', images: galleryImages(4, 'Inside the shop') },
      { kind: 'hours', heading: 'Open', bullets: ['Monday to Friday, 07:30–16:00', 'Weekends, 09:00–16:00'] },
      { kind: 'location', heading: 'Find us', body: '8 Gower Lane' },
      { kind: 'contact', heading: 'Say hello', bullets: ['hi@example.test'] },
    ],
  },
  {
    slug: 'hotel',
    label: 'Hotel',
    name: 'The Ferryman',
    listingCategory: 'Hotel',
    strategyPrimary: 'Hotel',
    strategySecondary: ['Restaurant'],
    tagline: 'Eleven rooms above the estuary',
    tone: 'quiet and confident',
    headingFont: 'Cormorant Garamond',
    bodyFont: 'Jost',
    services: ['Rooms', 'Dining room', 'Private events', 'Moorings'],
    seoDescription: 'Eleven rooms in a restored harbour building, with a dining room facing the water.',
    sections: [
      {
        kind: 'hero',
        heading: 'Eleven rooms above the water',
        subheading: 'A restored harbour building',
        body: 'Every room faces the estuary. None of them are the same shape.',
        images: [heroImage('A room facing the estuary')],
        callToAction: { label: 'Check availability', href: '#contact' },
      },
      { kind: 'gallery', heading: 'The rooms', images: galleryImages(8, 'Guest room') },
      { kind: 'services', heading: 'Staying here', bullets: ['Eleven rooms, two with a terrace', 'Dining room, open to non-residents', 'Moorings for guests arriving by water', 'Dogs in three of the rooms'] },
      { kind: 'about', heading: 'The building', body: 'A bonded warehouse until 1974, then nothing for thirty years. The floors are the original pitch pine.' },
      { kind: 'location', heading: 'Getting here', body: 'Quay Head, by the lifeboat station' },
      { kind: 'testimonials', heading: 'Guests', bullets: ['"We came for one night and stayed four."'] },
      { kind: 'contact', heading: 'Enquiries', bullets: ['stay@example.test', '01326 000 000'] },
    ],
  },
  {
    slug: 'dentist',
    label: 'Dentist',
    name: 'Marlow Dental Practice',
    listingCategory: 'Dentist',
    strategyPrimary: 'Dental practice',
    strategySecondary: ['Healthcare'],
    tagline: 'Dentistry without the dread',
    tone: 'reassuring',
    headingFont: 'Nunito Sans',
    bodyFont: 'Nunito Sans',
    services: ['Check-ups', 'Hygienist', 'Teeth whitening', 'Implants', 'Nervous patient appointments'],
    seoDescription: 'A family dental practice taking NHS and private patients, with longer appointments for nervous patients.',
    sections: [
      {
        kind: 'hero',
        heading: 'Dentistry without the dread',
        subheading: 'Taking new patients',
        body: 'Longer appointments, no upselling, and a practice that will tell you when you do not need treatment.',
        images: [heroImage('The treatment room')],
        callToAction: { label: 'Register as a patient', href: '#contact' },
      },
      { kind: 'services', heading: 'Treatments', bullets: ['Check-up and X-rays', 'Hygienist', 'White fillings', 'Implants and bridges', 'Nervous patient appointments'] },
      { kind: 'about', heading: 'The practice', body: 'Two dentists and a hygienist. The same person sees you each time.' },
      { kind: 'testimonials', heading: 'Patients', bullets: ['"First dentist in twenty years I have not dreaded."'] },
      { kind: 'hours', heading: 'Opening hours', bullets: ['Monday to Thursday, 08:30–17:30', 'Friday, 08:30–13:00'] },
      { kind: 'contact', heading: 'Contact', bullets: ['reception@example.test', '01628 000 000'] },
    ],
  },
  {
    slug: 'medical-clinic',
    label: 'Medical clinic',
    name: 'Northgate Clinic',
    listingCategory: 'Medical clinic',
    strategyPrimary: 'Medical clinic',
    strategySecondary: ['Healthcare'],
    tagline: 'Same-week appointments, no membership',
    tone: 'professional and clear',
    headingFont: 'IBM Plex Sans',
    bodyFont: 'IBM Plex Sans',
    services: ['GP appointments', 'Blood tests', 'Travel vaccinations', 'Health screening', 'Minor surgery'],
    seoDescription: 'A private GP clinic offering same-week appointments, blood tests and health screening.',
    sections: [
      {
        kind: 'hero',
        heading: 'See a doctor this week',
        subheading: 'No membership, no annual fee',
        body: 'Book a thirty-minute appointment and pay for that appointment. That is the whole model.',
        images: [heroImage('The consulting room')],
        callToAction: { label: 'Book an appointment', href: '#contact' },
      },
      { kind: 'services', heading: 'What we offer', bullets: ['GP appointments, 30 minutes', 'Blood tests, results in 48 hours', 'Travel vaccinations', 'Annual health screening', 'Minor surgery'] },
      { kind: 'about', heading: 'The clinic', body: 'Four GPs, two nurses, one phlebotomist. All of them NHS-trained and still practising.' },
      { kind: 'hours', heading: 'Opening hours', bullets: ['Monday to Friday, 08:00–19:00', 'Saturday, 09:00–13:00'] },
      { kind: 'location', heading: 'Where to find us', body: '2 Northgate' },
      { kind: 'contact', heading: 'Contact', bullets: ['appointments@example.test'] },
      { kind: 'faq', heading: 'Common questions', bullets: ['Do I need a referral? No.', 'Can I use insurance? Most major insurers, yes.'] },
    ],
  },
  {
    slug: 'law-firm',
    label: 'Law firm',
    name: 'Hallam & Rice',
    listingCategory: 'Law firm',
    strategyPrimary: 'Law firm',
    strategySecondary: ['Legal services'],
    tagline: 'Established 1974',
    tone: 'measured and traditional',
    headingFont: 'IBM Plex Sans',
    bodyFont: 'IBM Plex Sans',
    services: ['Commercial property', 'Employment law', 'Wills and probate', 'Dispute resolution'],
    seoDescription: 'A established regional practice in commercial property, employment and private client work.',
    sections: [
      {
        kind: 'hero',
        heading: 'Advice you can act on',
        subheading: 'A regional practice, established 1974',
        body: 'Nine solicitors across four disciplines. You will speak to the person doing the work.',
        callToAction: { label: 'Speak to a solicitor', href: '#contact' },
      },
      { kind: 'services', heading: 'Areas of practice', bullets: ['Commercial property', 'Employment law', 'Wills, trusts and probate', 'Dispute resolution'] },
      { kind: 'about', heading: 'The practice', body: 'Founded in 1974 and still in the same building. Nine solicitors, four of them partners.' },
      { kind: 'testimonials', heading: 'Clients', bullets: ['"Straight answers, and a bill that matched the estimate."'] },
      { kind: 'contact', heading: 'Contact', bullets: ['enquiries@example.test', '0113 000 0000'] },
      { kind: 'location', heading: 'Offices', body: '40 Park Square' },
    ],
  },
  {
    slug: 'accounting',
    label: 'Accountancy',
    name: 'Verity Accounts',
    listingCategory: 'Accountant',
    strategyPrimary: 'Accountancy practice',
    strategySecondary: ['Professional services'],
    tagline: 'Books, payroll and the bits in between',
    tone: 'professional and plain-speaking',
    headingFont: 'IBM Plex Sans',
    bodyFont: 'IBM Plex Sans',
    services: ['Year-end accounts', 'Payroll', 'VAT returns', 'Self assessment', 'Management accounts'],
    seoDescription: 'An accountancy practice for owner-managed businesses: year-end accounts, payroll, VAT and management reporting.',
    sections: [
      {
        kind: 'hero',
        heading: 'Numbers you can plan against',
        subheading: 'For owner-managed businesses',
        body: 'Management accounts by the tenth of the month, so the decisions you make are about this quarter and not the last one.',
        callToAction: { label: 'Book a call', href: '#contact' },
      },
      { kind: 'services', heading: 'What we do', bullets: ['Year-end accounts and corporation tax', 'Payroll and pension auto-enrolment', 'VAT returns', 'Monthly management accounts', 'Self assessment'] },
      { kind: 'about', heading: 'The practice', body: 'Six people, ninety clients, and a deliberate cap on both.' },
      { kind: 'testimonials', heading: 'Clients', bullets: ['"They tell us what the numbers mean, not just what they are."'] },
      { kind: 'cta', heading: 'Thinking of moving accountant?', subheading: 'The handover is our job, not yours', callToAction: { label: 'Start the conversation', href: '#contact' } },
      { kind: 'contact', heading: 'Contact', bullets: ['hello@example.test'] },
    ],
  },
  {
    slug: 'construction',
    label: 'Construction',
    name: 'Bracken Build',
    listingCategory: 'Construction company',
    strategyPrimary: 'Construction',
    strategySecondary: ['Building contractor'],
    tagline: 'Extensions, conversions and whole houses',
    tone: 'direct',
    headingFont: 'IBM Plex Sans',
    bodyFont: 'IBM Plex Sans',
    services: ['Extensions', 'Loft conversions', 'Full refurbishment', 'Structural work'],
    seoDescription: 'A building contractor working on extensions, loft conversions and full refurbishments.',
    sections: [
      {
        kind: 'hero',
        heading: 'Built once, built properly',
        subheading: 'Extensions, conversions and refurbishment',
        body: 'Fixed price, fixed programme, and a site manager whose number you have.',
        images: [heroImage('A finished extension')],
        callToAction: { label: 'See recent work', href: '#recent-work' },
      },
      { kind: 'services', heading: 'What we take on', bullets: ['Single and double storey extensions', 'Loft conversions', 'Full house refurbishment', 'Structural alterations'] },
      { kind: 'gallery', heading: 'Recent work', images: galleryImages(8, 'Completed project') },
      { kind: 'testimonials', heading: 'Clients', bullets: ['"Finished a week early and to the price we agreed."'] },
      { kind: 'about', heading: 'How we work', body: 'One project at a time per team. We do not start a job we cannot staff.' },
      { kind: 'contact', heading: 'Get a quote', bullets: ['office@example.test', '0114 000 0000'] },
    ],
  },
  {
    slug: 'gym',
    label: 'Gym',
    name: 'Ironworks',
    listingCategory: 'Gym',
    strategyPrimary: 'Gym',
    strategySecondary: ['Fitness'],
    tagline: 'Train hard. Nothing else required.',
    tone: 'bold and direct',
    headingFont: 'Archivo',
    bodyFont: 'Archivo',
    services: ['Strength training', 'Personal training', 'Olympic lifting', 'Open gym'],
    seoDescription: 'A strength gym with platforms, racks and coaching. No mirrors, no music policy, no contracts.',
    sections: [
      {
        kind: 'hero',
        heading: 'Train hard',
        subheading: 'Twelve platforms. No contracts.',
        body: 'A strength gym that is a strength gym. Turn up, lift, leave.',
        images: [heroImage('The lifting floor')],
        callToAction: { label: 'Get a day pass', href: '#membership' },
      },
      { kind: 'services', heading: 'What is here', bullets: ['Twelve lifting platforms', 'Full competition kit', 'Strongman yard', 'Coaching, one to one or in blocks'] },
      { kind: 'gallery', heading: 'The floor', images: galleryImages(6, 'On the floor') },
      { kind: 'testimonials', heading: 'Members', bullets: ['"No queue for a rack. Ever."'] },
      { kind: 'hours', heading: 'Open', bullets: ['Every day, 05:00–23:00', 'Staffed 07:00–21:00'] },
      { kind: 'cta', heading: 'First session is free', subheading: 'Bring shoes', callToAction: { label: 'Book it', href: '#contact' } },
      { kind: 'contact', heading: 'Contact', bullets: ['train@example.test'] },
    ],
  },
  {
    slug: 'beauty-salon',
    label: 'Beauty salon',
    name: 'Halo Studio',
    listingCategory: 'Beauty salon',
    strategyPrimary: 'Beauty salon',
    strategySecondary: ['Hair salon'],
    tagline: 'Cut, colour and everything after',
    tone: 'elegant and personal',
    headingFont: 'Lora',
    bodyFont: 'Source Sans 3',
    services: ['Cutting', 'Colour', 'Brows and lashes', 'Bridal'],
    seoDescription: 'A boutique salon for cutting, colour, brows and bridal work.',
    sections: [
      {
        kind: 'hero',
        heading: 'Cut, colour and everything after',
        subheading: 'A boutique studio of four chairs',
        body: 'Every appointment starts with a conversation and a coffee, and none of them are rushed.',
        images: [heroImage('The studio')],
        callToAction: { label: 'Book an appointment', href: '#contact' },
      },
      { kind: 'services', heading: 'Price list', bullets: ['Cut and finish — from 55', 'Full head colour — from 95', 'Balayage — from 140', 'Brows and lashes — from 25', 'Bridal, by consultation'] },
      { kind: 'gallery', heading: 'Recent work', images: galleryImages(6, 'Finished colour') },
      { kind: 'testimonials', heading: 'Clients', bullets: ['"The first colourist who listened before picking up a brush."'] },
      { kind: 'hours', heading: 'Opening hours', bullets: ['Tuesday to Friday, 09:00–19:00', 'Saturday, 09:00–16:00'] },
      { kind: 'contact', heading: 'Book', bullets: ['book@example.test'] },
    ],
  },
  {
    slug: 'spa',
    label: 'Spa',
    name: 'Stillwater',
    listingCategory: 'Day spa',
    strategyPrimary: 'Spa',
    strategySecondary: ['Wellness'],
    tagline: 'An afternoon that is not about anything',
    tone: 'calm and luxurious',
    headingFont: 'Cormorant Garamond',
    bodyFont: 'Jost',
    services: ['Massage', 'Facials', 'Thermal suite', 'Half-day packages'],
    seoDescription: 'A day spa with a thermal suite, treatment rooms and half-day packages.',
    sections: [
      {
        kind: 'hero',
        heading: 'An afternoon that is not about anything',
        subheading: 'Thermal suite, six treatment rooms',
        body: 'No phones past the door, no music in the pool room, no timetable except the one you booked.',
        images: [heroImage('The thermal suite')],
        callToAction: { label: 'View treatments', href: '#treatments' },
      },
      { kind: 'services', heading: 'Treatments', bullets: ['Deep tissue massage — 60 or 90 minutes', 'Facials, four protocols', 'Thermal suite, unlimited on a package day', 'Half day, including lunch'] },
      { kind: 'gallery', heading: 'The building', images: galleryImages(5, 'Inside the building') },
      { kind: 'about', heading: 'The idea', body: 'A converted pumping station with a thirty-metre barrel roof and very little in it.' },
      { kind: 'hours', heading: 'Open', bullets: ['Wednesday to Sunday, 10:00–20:00'] },
      { kind: 'contact', heading: 'Booking', bullets: ['reservations@example.test'] },
    ],
  },
  {
    slug: 'automotive',
    label: 'Automotive',
    name: 'Kessler Motor Works',
    listingCategory: 'Auto repair shop',
    strategyPrimary: 'Auto repair',
    strategySecondary: ['Garage'],
    tagline: 'Diagnostics, servicing and MOT',
    tone: 'modern and straightforward',
    headingFont: 'Manrope',
    bodyFont: 'Manrope',
    services: ['Servicing', 'MOT', 'Diagnostics', 'Tyres', 'Air conditioning'],
    seoDescription: 'An independent garage for servicing, MOT and diagnostics, with courtesy cars and same-day work.',
    sections: [
      {
        kind: 'hero',
        heading: 'Booked in today, back on the road today',
        subheading: 'Independent servicing, MOT and diagnostics',
        body: 'Five ramps, manufacturer diagnostics for most marques, and an itemised quote before anything is touched.',
        images: [heroImage('The workshop')],
        callToAction: { label: 'Book a service', href: '#contact' },
      },
      { kind: 'services', heading: 'What we do', bullets: ['Interim and full servicing', 'MOT, class 4 and 7', 'Fault diagnostics', 'Tyres and alignment', 'Air conditioning regas'] },
      { kind: 'about', heading: 'The workshop', body: 'Independent since 2009. Four technicians, all time-served.' },
      { kind: 'testimonials', heading: 'Customers', bullets: ['"Quoted, then charged the quote. Rarer than it should be."'] },
      { kind: 'hours', heading: 'Opening hours', bullets: ['Monday to Friday, 08:00–18:00', 'Saturday, 08:00–13:00'] },
      { kind: 'location', heading: 'Where we are', body: 'Unit 6, Baltic Industrial Estate' },
      { kind: 'contact', heading: 'Contact', bullets: ['workshop@example.test'] },
    ],
  },
  {
    slug: 'real-estate',
    label: 'Estate agency',
    name: 'Marchmont & Co',
    listingCategory: 'Real estate agency',
    strategyPrimary: 'Estate agency',
    strategySecondary: ['Property'],
    tagline: 'Selling houses people want to live in',
    tone: 'premium and assured',
    headingFont: 'Outfit',
    bodyFont: 'Outfit',
    services: ['Residential sales', 'Lettings', 'Valuations', 'Property management'],
    seoDescription: 'An independent estate agency handling residential sales, lettings and property management.',
    sections: [
      {
        kind: 'hero',
        heading: 'Houses people want to live in',
        subheading: 'Independent agency, one office, no call centre',
        body: 'The person who values your house is the person who shows it and the person who negotiates it.',
        images: [heroImage('A recently sold house')],
        callToAction: { label: 'Request a valuation', href: '#contact' },
      },
      { kind: 'services', heading: 'How we can help', bullets: ['Residential sales', 'Lettings and tenant find', 'Market valuations', 'Full property management'] },
      { kind: 'gallery', heading: 'Recently sold', images: galleryImages(6, 'Sold property') },
      { kind: 'about', heading: 'The agency', body: 'Founded in 2011, still one office, still answering our own phone.' },
      { kind: 'testimonials', heading: 'Sellers', bullets: ['"Sold in eleven days at the asking price."'] },
      { kind: 'contact', heading: 'Contact', bullets: ['sales@example.test', '0131 000 0000'] },
    ],
  },
  {
    slug: 'retail',
    label: 'Retail',
    name: 'Pell & Vane',
    listingCategory: 'Clothing store',
    strategyPrimary: 'Retail',
    strategySecondary: ['Clothing'],
    tagline: 'Fewer things, chosen properly',
    tone: 'modern and considered',
    headingFont: 'Manrope',
    bodyFont: 'Manrope',
    services: ['Womenswear', 'Menswear', 'Alterations', 'Personal shopping'],
    seoDescription: 'An independent clothing shop stocking a small number of makers, with alterations in house.',
    sections: [
      {
        kind: 'hero',
        heading: 'Fewer things, chosen properly',
        subheading: 'Eleven makers, one shop',
        body: 'We buy small and repeat what works. Nothing here is on a three-week cycle.',
        images: [heroImage('The shop floor')],
        callToAction: { label: 'See the shop', href: '#in-store' },
      },
      { kind: 'services', heading: 'In store', bullets: ['Womenswear and menswear', 'Alterations, in house', 'Personal shopping by appointment', 'Repairs on anything we sold you'] },
      { kind: 'gallery', heading: 'The shop', images: galleryImages(5, 'In the shop') },
      { kind: 'hours', heading: 'Opening hours', bullets: ['Monday to Saturday, 10:00–18:00', 'Sunday, 11:00–16:00'] },
      { kind: 'location', heading: 'Find us', body: '22 Vane Street' },
      { kind: 'contact', heading: 'Contact', bullets: ['shop@example.test'] },
    ],
  },
  {
    slug: 'jewellery',
    label: 'Jewellery',
    name: 'Aurum Fine Jewellery',
    listingCategory: 'Jewelry store',
    strategyPrimary: 'Jewellery retail',
    strategySecondary: ['Luxury retail'],
    tagline: 'Bespoke pieces, made on the premises',
    tone: 'luxury and exclusive',
    headingFont: 'Cormorant Garamond',
    bodyFont: 'Jost',
    services: ['Bespoke commissions', 'Engagement rings', 'Remodelling', 'Repairs and restoration'],
    seoDescription: 'A jeweller making bespoke and engagement pieces on the premises, with restoration and remodelling.',
    sections: [
      {
        kind: 'hero',
        heading: 'Made at the bench behind you',
        subheading: 'Bespoke and engagement pieces',
        body: 'Every commission is drawn, waxed and set in this building. Nothing is ordered in.',
        images: [heroImage('A ring at the bench')],
        callToAction: { label: 'Arrange a consultation', href: '#contact' },
      },
      { kind: 'services', heading: 'Commissions', bullets: ['Bespoke design, from sketch to setting', 'Engagement and wedding', 'Remodelling inherited pieces', 'Restoration and valuation'] },
      { kind: 'gallery', heading: 'Recent commissions', images: galleryImages(6, 'Commissioned piece') },
      { kind: 'about', heading: 'The workshop', body: 'A goldsmith and two apprentices. Registered with the Assay Office since 1988.' },
      { kind: 'testimonials', heading: 'Commissions', bullets: ['"They made my grandmother\'s ring into something I actually wear."'] },
      { kind: 'contact', heading: 'Consultations', bullets: ['bench@example.test'] },
    ],
  },
  {
    slug: 'florist',
    label: 'Florist',
    name: 'Verge',
    listingCategory: 'Florist',
    strategyPrimary: 'Florist',
    strategySecondary: ['Retail'],
    tagline: 'Seasonal, British, and never the same twice',
    tone: 'friendly and creative',
    headingFont: 'Manrope',
    bodyFont: 'Manrope',
    services: ['Weekly bouquets', 'Weddings', 'Events', 'Subscriptions'],
    seoDescription: 'A florist working with British-grown seasonal stems, for weekly bouquets, weddings and events.',
    sections: [
      {
        kind: 'hero',
        heading: 'Never the same bunch twice',
        subheading: 'British-grown, cut this week',
        body: 'We buy what the growers cut. You get the season rather than a catalogue.',
        images: [heroImage('This week of stems')],
        callToAction: { label: 'Order flowers', href: '#contact' },
      },
      { kind: 'services', heading: 'What we do', bullets: ['Weekly bouquets, three sizes', 'Weddings and ceremonies', 'Event and installation work', 'Subscriptions, fortnightly or monthly'] },
      { kind: 'gallery', heading: 'This season', images: galleryImages(6, 'Seasonal arrangement') },
      { kind: 'hours', heading: 'Open', bullets: ['Tuesday to Saturday, 09:00–17:00'] },
      { kind: 'location', heading: 'The shop', body: '5 Verge Row' },
      { kind: 'contact', heading: 'Orders', bullets: ['stems@example.test'] },
    ],
  },
  {
    slug: 'photography',
    label: 'Photography',
    name: 'Ada Kerr Photography',
    listingCategory: 'Photography studio',
    strategyPrimary: 'Photography',
    strategySecondary: ['Creative services'],
    tagline: 'Documentary work, not posed work',
    tone: 'creative and bold',
    headingFont: 'Space Grotesk',
    bodyFont: 'Work Sans',
    services: ['Weddings', 'Editorial', 'Portraits', 'Commercial'],
    seoDescription: 'A documentary photographer working on weddings, editorial commissions and portraits.',
    sections: [
      {
        kind: 'hero',
        heading: 'Documentary, not posed',
        subheading: 'Weddings, editorial and portraits',
        body: 'I photograph what happens. There is no shot list and there are no group photographs unless you ask for them.',
        images: [heroImage('A frame from a recent commission')],
        callToAction: { label: 'See the work', href: '#selected-work' },
      },
      { kind: 'gallery', heading: 'Selected work', images: galleryImages(9, 'Selected photograph') },
      { kind: 'services', heading: 'Commissions', bullets: ['Weddings, full day', 'Editorial and press', 'Portraits, studio or location', 'Commercial and product'] },
      { kind: 'about', heading: 'About', body: 'Twelve years, four cameras, one approach. Based here, works anywhere.' },
      { kind: 'testimonials', heading: 'Clients', bullets: ['"We forgot she was there and then we saw the photographs."'] },
      { kind: 'contact', heading: 'Enquiries', bullets: ['ada@example.test'] },
    ],
  },
  {
    slug: 'architecture',
    label: 'Architecture',
    name: 'Fell Studio',
    listingCategory: 'Architect',
    strategyPrimary: 'Architecture practice',
    strategySecondary: ['Design'],
    tagline: 'Buildings that suit the ground they are on',
    tone: 'minimal and considered',
    headingFont: 'Inter',
    bodyFont: 'Inter',
    services: ['Residential architecture', 'Planning applications', 'Conservation work', 'Interiors'],
    seoDescription: 'An architecture practice working on private houses, conservation projects and planning applications.',
    sections: [
      {
        kind: 'hero',
        heading: 'Buildings that suit the ground they are on',
        subheading: 'A practice of five',
        body: 'We take on eight projects a year, which is what five people can do properly.',
        images: [heroImage('A completed house')],
        callToAction: { label: 'See projects', href: '#projects' },
      },
      { kind: 'gallery', heading: 'Projects', images: galleryImages(4, 'Completed project') },
      { kind: 'services', heading: 'What we do', bullets: ['Private houses, new build and extension', 'Planning and listed building consent', 'Conservation and repair', 'Interiors and joinery design'] },
      { kind: 'about', heading: 'The practice', body: 'Five architects. No projects over 400 square metres and no work we cannot visit in a day.' },
      { kind: 'contact', heading: 'Enquiries', bullets: ['studio@example.test'] },
    ],
  },
  {
    slug: 'technology',
    label: 'Technology',
    name: 'Cadence Systems',
    listingCategory: 'Software company',
    strategyPrimary: 'Software and IT services',
    strategySecondary: ['Professional services'],
    tagline: 'Systems that outlast the people who built them',
    tone: 'professional and modern',
    headingFont: 'IBM Plex Sans',
    bodyFont: 'IBM Plex Sans',
    services: ['Software development', 'Systems integration', 'IT services', 'Technical due diligence'],
    seoDescription: 'A software consultancy building and maintaining line-of-business systems for mid-sized companies.',
    sections: [
      {
        kind: 'hero',
        heading: 'Systems that outlast the people who built them',
        subheading: 'Software for companies that are not software companies',
        body: 'We build the internal systems a business runs on, and we write them so that the next team can read them.',
        callToAction: { label: 'Start a conversation', href: '#contact' },
      },
      { kind: 'services', heading: 'What we do', bullets: ['Line-of-business software', 'Systems integration and data migration', 'Ongoing maintenance and support', 'Technical due diligence'] },
      { kind: 'about', heading: 'How we work', body: 'Small teams, fixed scope per phase, and code you own outright from the first commit.' },
      { kind: 'testimonials', heading: 'Clients', bullets: ['"The handover documentation was better than our own."'] },
      { kind: 'cta', heading: 'Have something that needs rebuilding?', subheading: 'The first conversation is free', callToAction: { label: 'Get in touch', href: '#contact' } },
      { kind: 'contact', heading: 'Contact', bullets: ['hello@example.test'] },
    ],
  },
];

/**
 * The full review set: fifty businesses.
 *
 * Kept as one exported array so every script — the generator, the screenshotter,
 * the coverage report — sees the same set and nothing has to be told twice how
 * many there are.
 */
export const EXAMPLES: readonly ExampleSpec[] = [...CORE_EXAMPLES, ...EXTRA_EXAMPLES];
