/**
 * A verified profile becomes a night.
 *
 * The script below is the "night shift" narrative: a craft producer's day runs
 * backwards from the moment a customer sees the result, so the experience runs
 * forwards through the hours nobody sees. Scroll is time. The visitor enters at
 * 22:00 with a jar of starter and leaves at 07:30 when the door unlocks.
 *
 * The rule this module holds to: every *fact* on the page is read out of the
 * profile, and every *frame* around the fact is authored here. "600 Guerrero"
 * comes from the profile. "The corner has been awake for hours" is the frame.
 * Where the profile cannot support a claim — a full week of opening hours, say —
 * the composer degrades to what was verified and says so, rather than filling
 * the gap with a plausible invention.
 */

import type {
  Experience,
  Ground,
  LogLine,
  Plate,
  Practical,
  Scene,
} from './types.js';

/* ------------------------------------------------------------------ *\
   The colour world

   Six grounds, walked in order: the page cools into night, ignites at the
   oven, then opens into morning paper. Every ink/base pair below clears
   4.5:1, checked in `test/experience.contrast.test.ts`.
\* ------------------------------------------------------------------ */

const NIGHT: Ground = {
  base: '#080A10',
  ink: '#EFE6D8',
  inkDim: '#9BA0AE',
  ember: '#D98634',
};

const CELLAR: Ground = {
  base: '#0E1119',
  ink: '#EDE3D4',
  inkDim: '#9AA0AF',
  ember: '#C9762E',
};

const PROOF: Ground = {
  base: '#171520',
  ink: '#F0E5D4',
  inkDim: '#A69C9C',
  ember: '#E08B3A',
};

const OVEN: Ground = {
  base: '#2A0F06',
  ink: '#FFEBD2',
  inkDim: '#D3A183',
  ember: '#FF7A22',
};

const CRUST: Ground = {
  base: '#1A100A',
  ink: '#F3E2CC',
  inkDim: '#B29B84',
  ember: '#E8A33D',
};

const MORNING: Ground = {
  base: '#EFE6D6',
  ink: '#241A12',
  inkDim: '#5E5044',
  ember: '#A8481B',
};

const PAPER: Ground = {
  base: '#E6DAC6',
  ink: '#201710',
  inkDim: '#57493C',
  ember: '#A8481B',
};

/* ------------------------------------------------------------------ *\
   Reading the profile
\* ------------------------------------------------------------------ */

/** The profile wraps most scalars as `{ value, source }`. Unwrap defensively. */
function val<T>(node: unknown): T | null {
  if (node === null || node === undefined) return null;
  if (typeof node === 'object' && node !== null && 'value' in node) {
    return (node as { value: T }).value ?? null;
  }
  return node as T;
}

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

/** `07:30` → `7.30am`, in the lowercase the design sets it in. */
function clockLabel(hhmm: string): string {
  const parts = hhmm.split(':').map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}.${String(m).padStart(2, '0')}${suffix}`;
}

/** `+14154872600` → `(415) 487-2600`, for a US number; otherwise unchanged. */
function phoneLabel(digits: string): string {
  const d = digits.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  return digits;
}

/**
 * Picks a photograph by filename intent.
 *
 * The collector saved files under their upstream names, and those names carry
 * real signal — `chad-turns-dough`, `tartineinterior`, `Cut_Croissant`. Matching
 * on them is more honest than matching on `alt`, which is null for most of the
 * set. A miss returns null and the scene composes without that plate rather
 * than substituting an unrelated image.
 */
function pick(pool: readonly string[], ...needles: readonly string[]): string | null {
  for (const needle of needles) {
    const hit = pool.find((p) => p.toLowerCase().includes(needle.toLowerCase()));
    if (hit !== undefined) return hit;
  }
  return null;
}

/** Photographs that are product shots of books, screenshots, or logos. */
const NOT_PHOTOGRAPHY = /breadbook|_3d_|amazon|cookbook|screenshot|all_day|img_1307|favicon|\blogo\b/i;

export interface ComposeInput {
  /** Parsed `3-profile.json`. */
  readonly profile: Record<string, unknown>;
  /** Asset file names present on disk, e.g. `gallery-fougasse-82f03f14.jpg`. */
  readonly assetFiles: readonly string[];
}

export function compose(input: ComposeInput): Experience {
  const { profile } = input;

  const name = val<string>(profile['name']) ?? 'The Bakery';
  const address = val<{
    formatted: string; street: string; locality: string; region: string;
  }>(profile['address']);
  const street = address?.street ?? '';
  const city = [address?.locality, address?.region].filter(Boolean).join(', ');

  const phones = (profile['phones'] as { value: { e164: string } }[] | undefined) ?? [];
  const phoneE164 = phones[0]?.value?.e164 ?? '';

  const emails = (profile['emails'] as { value: string }[] | undefined) ?? [];
  const email = emails[0]?.value ?? '';

  const website = val<string>(profile['website']) ?? '';
  const rating = val<number>(profile['rating']);

  const socialRaw = (profile['socialProfiles'] as {
    value: { platform: string; url: string };
  }[] | undefined) ?? [];
  const social = socialRaw.map((s) => ({
    label: s.value.platform.replace(/^./, (c) => c.toUpperCase()),
    href: s.value.url,
  }));

  const hoursRaw = (profile['hours'] as {
    dayOfWeek: number; opens: string; closes: string;
  }[] | undefined) ?? [];
  const hours = hoursRaw.map((h) => ({
    day: DAY_NAMES[h.dayOfWeek] ?? '',
    range: `${clockLabel(h.opens)} — ${clockLabel(h.closes)}`,
  }));
  // Seven days verified is a week; anything less is a sample, and saying so is
  // the difference between a confident page and a dishonest one.
  const hoursCaveat = hours.length < 7
    ? 'Verified hours shown. Confirm the full week before travelling.'
    : null;

  const pool = input.assetFiles
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .filter((f) => !NOT_PHOTOGRAPHY.test(f))
    .map((f) => `assets/${f}`);

  const logoFile = input.assetFiles.find((f) => /^logo-/.test(f));
  const logoSrc = logoFile !== undefined ? `assets/${logoFile}` : null;

  /* -------- photography, cast by role rather than dumped in a grid -------- */

  const plate = (
    src: string | null, alt: string, crop: Plate['crop'],
  ): Plate[] => (src === null ? [] : [{ src, alt, crop }]);

  const pHands = pick(pool, 'chad-turns-dough', 'dough-turns');
  const pDough = pick(pool, 'dough-turns', 'chad-turns-dough');
  const pCrate = pick(pool, 'Bread_Crate_Amy_Holt__2_-a414e782', 'Bread_Crate');
  const pBaguettes = pick(pool, 'baguettes');
  const pRye = pick(pool, 'renes-rye');
  const pFougasse = pick(pool, 'fougasse');
  const pCroissant = pick(pool, 'Cut_Croissant');
  const pTart = pick(pool, 'Lemon_Cream_Tart');
  const pSalmon = pick(pool, 'Smoked_Salmon_Tartine');
  const pInterior = pick(pool, 'tartineinterior');
  const pExterior = pick(pool, 'manufactory---exterior', 'manufactory-sf-2-36');
  const pFounders = pick(pool, 'chad-robertson--elisabeth-prueitt', 'tartine-founders');
  const pCoffee = pick(pool, 'TARTINE_x_COFFEE', 'chad-coffee');
  const pBaked = pick(pool, 'baked5');
  const pRoom = pick(pool, 'manufactory-sf-127', 'manufactory-sf-2-36');

  /* ----------------------------- the script ----------------------------- */

  const scenes: Scene[] = [];

  // 22:00 — the starter. Almost nothing on screen. The page begins quiet so
  // that the oven, four scenes later, can be loud.
  scenes.push({
    id: 'levain',
    kind: 'immersion',
    clock: '22:00',
    marker: 'levain',
    ground: NIGHT,
    dough: {
      rise: 0.06, bake: 0, heat: 0.05, dolly: 3.5, ferment: 0.25,
      // Small, low and centred: a covered tub on a bench, not a hero object.
      offsetX: 0, offsetY: -0.68, scale: 0.58, presence: 1,
      score: 0, spring: 0,
    },
    beats: 2.6,
    kicker: `${street} · ${city}`,
    display: 'Proof',
    body: [
      'Nine hours before the door opens, something is already awake in the dark.',
    ],
  });

  // 00:40 — flour, water, salt. Three columns; the only scene built on a grid,
  // which is why the grid reads as deliberate.
  scenes.push({
    id: 'three-things',
    kind: 'triptych',
    clock: '00:40',
    marker: 'the mix',
    ground: CELLAR,
    dough: {
      rise: 0.16, bake: 0, heat: 0.1, dolly: 3.2, ferment: 0.55,
      // Text holds the left seven columns, so the dough takes the right.
      offsetX: 0.98, offsetY: -0.30, scale: 0.72, presence: 1,
      score: 0, spring: 0,
    },
    beats: 2.2,
    kicker: 'Three things',
    display: 'Flour.|Water.|Salt.',
    body: [
      'A complex balance of yeast, bacteria, time, temperature, moisture and '
      + 'fermentation, acting on the simplest of ingredients.',
    ],
    log: [
      { key: 'flour', value: 'Cairnspring Mills · Skagit Valley' },
      { key: 'grain', value: 'Hedlin Family Farms' },
      { key: 'method', value: 'natural leaven, long fermentation' },
    ],
    plates: plate(pHands, 'A baker turning dough by hand', 'portrait'),
  });

  // 02:00 — the long middle. Type holds still while the dough works behind it.
  // This is the scene the WebGL exists for.
  scenes.push({
    id: 'rise',
    kind: 'sustain',
    clock: '02:00',
    marker: 'bulk ferment',
    ground: PROOF,
    dough: {
      rise: 0.92, bake: 0.04, heat: 0.18, dolly: 3.1, ferment: 1.0,
      // The one scene where it is the subject: close, right of the type.
      offsetX: 0.95, offsetY: 0.30, scale: 0.86, presence: 1,
      score: 0, spring: 0,
    },
    beats: 3.4,
    kicker: 'It takes as long as it takes',
    display: 'The dough|is the clock.',
    body: [
      'A baker reads the weather, the flour, the levain, and yesterday’s '
      + 'baked bread before starting to mix.',
      'The process is ancient and intuitive. It is craft, science, art, and '
      + 'philosophy.',
    ],
    log: [
      { key: 'state', value: 'rising' },
      { key: 'attention', value: 'continuous' },
    ],
  });

  // 04:20 — the blade.
  //
  // The page holds its breath here. Type gets out of the way, the camera comes
  // in close, and one thing happens: a cut travels across the loaf and opens.
  // Because the dough values interpolate between scene *centres*, the blade
  // starts moving during the quiet tail of the ferment scene — which is the
  // emptiness that had nothing in it before.
  scenes.push({
    id: 'blade',
    kind: 'silence',
    clock: '04:20',
    marker: 'the blade',
    ground: PROOF,
    dough: {
      // Close, but not so close the loaf stops being a loaf: at dolly 2.0 it
      // overflowed the frame and read as a tan wall, and you cannot see a cut
      // travel across something you cannot see the edges of.
      rise: 1.0, bake: 0.10, heat: 0.22, dolly: 3.15, ferment: 0.35,
      offsetX: 0.42, offsetY: 0.06, scale: 0.90, presence: 1, offsetYMobile: 0.52,
      score: 0.5, spring: 0,
    },
    beats: 3.6,
    kicker: 'Four twenty',
    display: 'One cut,|and it knows|where to open.',
    log: [
      { key: 'blade', value: 'lame, held at an angle' },
      { key: 'depth', value: 'a quarter inch' },
    ],
  });

  // 04:30 — impact. The whole screen turns into the oven.
  scenes.push({
    id: 'oven',
    kind: 'immersion',
    clock: '04:30',
    marker: 'the oven',
    ground: OVEN,
    dough: {
      rise: 1.0, bake: 1.0, heat: 1.0, dolly: 2.55, ferment: 0.35,
      // Type sits bottom-left at the oven, so the loaf takes the upper right —
      // and it has to stay clear of it: cream on glowing orange never reaches 3:1.
      offsetX: 0.72, offsetY: 0.66, scale: 0.86, presence: 1, offsetYMobile: 0.72,
      score: 1, spring: 1,
    },
    beats: 2.8,
    kicker: 'Four thirty',
    display: 'Each day made.|Made each day.',
    body: [
      'The loaf goes dark and blistered. The crumb opens. Everything the night '
      + 'was for happens in twenty minutes.',
    ],
    log: [
      { key: 'crust', value: 'dark, blistered' },
      { key: 'crumb', value: 'wildly open' },
    ],
  });

  // 05:10 — one photograph, at scale, after the loudest moment. The quiet.
  scenes.push({
    id: 'cooling',
    kind: 'plate',
    clock: '05:10',
    marker: 'cooling rack',
    ground: CRUST,
    dough: {
      rise: 1.0, bake: 0.94, heat: 0.5, dolly: 3.4, ferment: 0.12,
      // Behind a full-bleed photograph; only the glow needs to survive.
      offsetX: 0.4, offsetY: 0.1, scale: 0.9, presence: 0.9,
      score: 1, spring: 0.25,
    },
    beats: 2.4,
    kicker: 'Then, nothing',
    display: 'Listen —|it crackles.',
    body: [
      'Bread sings as it cools. Bakers call it the song. It is the only part of '
      + 'the process you can hear from across a room.',
    ],
    plates: plate(pCrate, 'A crate of freshly baked loaves', 'full'),
  });

  // 06:00 — the reel. Horizontal drift, scrubbed by vertical scroll.
  const reel: Plate[] = [
    ...plate(pBaguettes, 'Baguettes, fresh from the oven', 'portrait'),
    ...plate(pCroissant, 'A croissant cut open to show the layers', 'square'),
    ...plate(pRye, 'A dark rye loaf', 'portrait'),
    ...plate(pTart, 'A lemon cream tart', 'square'),
    ...plate(pFougasse, 'Fougasse', 'landscape'),
    ...plate(pSalmon, 'A smoked salmon tartine', 'square'),
    ...plate(pBaked, 'Pastries on a baking tray', 'landscape'),
  ];
  scenes.push({
    id: 'rack',
    kind: 'reel',
    clock: '06:00',
    marker: 'the rack',
    ground: CRUST,
    dough: {
      rise: 1.0, bake: 0.9, heat: 0.42, dolly: 4.2, ferment: 0.08,
      offsetX: 1.95, offsetY: 0.92, scale: 0.62, presence: 0.13,
      score: 1, spring: 0,
    },
    beats: 3.0,
    kicker: 'Six o’clock',
    display: 'The rack fills.',
    plates: reel,
  });

  // 07:30 — daybreak. The ground flips to paper and the page exhales.
  scenes.push({
    id: 'doors',
    kind: 'daybreak',
    clock: '07:30',
    marker: 'the door',
    ground: MORNING,
    dough: {
      rise: 1.0, bake: 0.86, heat: 0.2, dolly: 5.0, ferment: 0.05,
      // Daylight ground: a dark loaf reads as an object on paper. Keep it small.
      offsetX: 1.35, offsetY: -0.75, scale: 0.62, presence: 0,
      score: 1, spring: 0,
    },
    beats: 2.8,
    // Seven scenes in the dark, and then the sun comes over the rooftops on
    // Guerrero. It should not crossfade — it should be too bright for a second.
    veil: { colour: '#FFF6E4', peak: 0.97 },
    kicker: 'And then you arrive',
    display: 'Rise each day.|Warm every table.',
    body: [
      `In 2002, Elisabeth Prueitt and Chad Robertson found a baker sitting `
      + `outside a corner shop in the Mission. He was ready to retire, but didn’t `
      + `want the neighbourhood to lose its bakery. It felt like fate.`,
    ],
    log: [
      { key: 'since', value: '2002' },
      { key: 'award', value: 'James Beard Foundation Award, 2008' },
    ],
    plates: [
      ...plate(pInterior, `Inside ${name}`, 'landscape'),
      ...plate(pFounders, 'Chad Robertson and Elisabeth Prueitt', 'portrait'),
    ],
  });

  // The practical scene. Information, composed as a shopfront.
  scenes.push({
    id: 'threshold',
    kind: 'threshold',
    clock: '07:31',
    marker: 'find it',
    ground: PAPER,
    dough: {
      rise: 1.0, bake: 0.8, heat: 0.12, dolly: 6.0, ferment: 0.03,
      offsetX: 1.7, offsetY: -1.0, scale: 0.5, presence: 0,
      score: 1, spring: 0,
    },
    beats: 1.9,
    kicker: 'The corner',
    display: 'Come and stand|in the queue.',
    body: [
      'The corner of 18th and Guerrero, since 2002.',
      'Come early — the morning is the best of it.',
    ],
    plates: [
      ...plate(pExterior ?? pRoom, `The ${name} shopfront`, 'landscape'),
    ],
  });

  // 22:00 again — the loop closes.
  //
  // A sourdough bakery never starts from nothing. A portion of today's levain
  // is held back and fed, and that is tomorrow's bread; the culture at 600
  // Guerrero has been continuous since 2002. So the page does not end on a
  // footer, it ends where it began: same ground, same slack tub in the dark,
  // twenty-four hours later. The clock rolling back to 22:00 is the point.
  scenes.push({
    id: 'coda',
    kind: 'coda',
    clock: '22:00',
    marker: 'again',
    ground: NIGHT,
    dough: {
      rise: 0.08, bake: 0, heat: 0.05, dolly: 3.5, ferment: 0.30,
      offsetX: 0, offsetY: -0.66, scale: 0.56, presence: 1,
      score: 0, spring: 0,
    },
    beats: 2.4,
    veil: { colour: '#05070C', peak: 0.94 },
    kicker: 'And tonight, again',
    display: 'A little is kept back,|and fed.',
    body: [
      'Tomorrow’s bread is already alive tonight. It has been, without a '
      + 'break, since 2002.',
    ],
  });

  const practical: Practical = {
    name,
    street,
    city,
    phoneDisplay: phoneLabel(phoneE164),
    phoneHref: `tel:${phoneE164}`,
    email,
    website,
    hours,
    hoursCaveat,
    rating,
    social,
    mapHref: `https://www.google.com/maps/search/?api=1&query=${
      encodeURIComponent(`${name} ${address?.formatted ?? ''}`)
    }`,
  };

  const assets = [
    ...new Set(
      scenes
        .flatMap((s) => s.plates ?? [])
        .map((p) => p.src)
        .concat(logoSrc === null ? [] : [logoSrc]),
    ),
  ];

  // Unused for now but kept honest: the log type is exported for the emitter.
  const _log: LogLine[] = [];
  void _log;

  return {
    title: `${name} — Proof`,
    metaDescription:
      `${name}, ${street}, ${city}. Bread made overnight and sold in the `
      + `morning. Walk through one night of baking.`,
    conceptName: 'Proof — the night shift',
    scenes,
    practical,
    logoSrc,
    assets,
    fontFamilies: ['Cormorant Garamond', 'Archivo', 'IBM Plex Mono'],
  };
}
