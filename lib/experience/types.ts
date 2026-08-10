/**
 * The scene model for an immersive, scroll-as-time website.
 *
 * A conventional page is a list of sections; each one is a container and the
 * order between them carries no meaning. An experience is a list of *scenes*,
 * and the order is the whole point — scene N only reads correctly because scene
 * N-1 put the visitor somewhere. So the model here is deliberately not
 * "hero, about, gallery". It is a script: each scene declares where it sits on
 * a clock, what ground it paints, what the WebGL layer should be doing while it
 * is on screen, and what it says.
 *
 * The composer derives all of it from a verified business profile. Nothing in
 * this file invents a fact; the invention is in the framing, which is what a
 * scene model is for.
 */

/** Where a scene sits in the night, as a 24h stamp. Drives the mono log line. */
export type Clock = string;

/** A ground: the full-viewport colour a scene paints behind everything. */
export interface Ground {
  /** Base colour the scene settles on. */
  readonly base: string;
  /** Ink that reads against `base` at 4.5:1 or better. */
  readonly ink: string;
  /** Dimmed ink for secondary copy — still 4.5:1 against `base`. */
  readonly inkDim: string;
  /** The scene's one warm signal. Used sparingly; never for body text. */
  readonly ember: string;
}

/**
 * What the dough shader is doing while a scene holds the viewport.
 *
 * `offsetX`/`offsetY` are the reason this reads as art direction rather than a
 * background: the loaf is *placed* in each composition, opposite the type,
 * rather than sitting dead-centre behind it in every scene.
 */
export interface DoughState {
  /** 0 = slack and dormant, 1 = fully proofed and domed. */
  readonly rise: number;
  /** 0 = raw pale dough, 1 = dark blistered crust. */
  readonly bake: number;
  /** Kelvin-ish mood of the key light: 0 = night blue, 1 = oven orange. */
  readonly heat: number;
  /** Camera distance. Larger backs off and lets the type breathe. */
  readonly dolly: number;
  /** How much the surface churns. Fermentation is not still. */
  readonly ferment: number;
  /** Horizontal placement in world units. Positive moves it right. */
  readonly offsetX: number;
  /** Vertical placement in world units. Positive moves it up. */
  readonly offsetY: number;
  /**
   * Vertical placement on a phone, when the default does the wrong thing.
   *
   * On a narrow screen the loaf normally drops below the type, since there is
   * no side column for it to sit beside. That is wrong for the scenes whose
   * copy is already anchored to the bottom of the stage — there the loaf has to
   * go up instead, or it lands on the words.
   */
  readonly offsetYMobile?: number;
  /** Overall size. Below 1 reads as distance rather than a smaller loaf. */
  readonly scale: number;
  /**
   * How present the dough is, 0–1.
   *
   * The loaf belongs to the night. Once the doors open the story has moved on
   * to the room and the people in it, so the scene dissolves rather than
   * hanging around behind daylight photography looking for something to do.
   * At 0 the renderer stops drawing entirely, which is also the cheapest frame
   * on the page.
   */
  readonly presence: number;
  /**
   * The score, 0–1: uncut, incision travelled, ear open.
   *
   * Interpolated between scene centres like everything else, which means the
   * blade begins its travel in the empty tail of the scene before — an absence
   * that was previously just absence.
   */
  readonly score: number;
  /** Oven spring: the volume jump when heat first hits the loaf. */
  readonly spring: number;
}

/**
 * A full-viewport wash at a scene boundary.
 *
 * Used exactly twice, at the two moments the page changes polarity: dawn blows
 * the screen out to white, and the close of the day sinks it back to black.
 * It is an emotional beat first, but it also covers the colour crossing — ink
 * and ground blending past each other is unreadable mid-flip, and a veil at
 * full opacity is the one state where that genuinely does not matter.
 */
export interface Veil {
  /** Colour the screen washes to. */
  readonly colour: string;
  /** Peak opacity, 0–1. */
  readonly peak: number;
}

/** A photograph, placed with intent rather than dropped into a grid. */
export interface Plate {
  /** Path relative to the site root. */
  readonly src: string;
  /** Honest alt text. Empty string marks it decorative. */
  readonly alt: string;
  /** How the scene wants it framed. */
  readonly crop: 'portrait' | 'landscape' | 'square' | 'full';
}

/** One line of the baker's log — a measured fact, set in mono. */
export interface LogLine {
  readonly key: string;
  readonly value: string;
}

/**
 * The kinds of scene the script can call for.
 *
 * Each kind is a distinct composition, not a variant of one layout. That is the
 * difference between a page that progresses and a page that repeats: a visitor
 * cannot predict scene N+1 from scene N.
 */
export type SceneKind =
  /** Full-bleed WebGL with a single oversized line. The opening and the climax. */
  | 'immersion'
  /** Three measured columns over a dark ground. The ingredient scene. */
  | 'triptych'
  /** Type pinned while the dough works behind it. The long middle. */
  | 'sustain'
  /** One photograph at scale, with a caption that earns it. */
  | 'plate'
  /** A rack of photographs travelled along in perspective. */
  | 'reel'
  /** Near-silence. The loaf fills the frame and something happens to it. */
  | 'silence'
  /** The turn into daylight — ground flips, type inverts. */
  | 'daybreak'
  /** Practical information, composed as a shopfront rather than a table. */
  | 'threshold'
  /** Colophon. */
  | 'coda';

/** One scene in the script. */
export interface Scene {
  readonly id: string;
  readonly kind: SceneKind;
  readonly clock: Clock;
  /** The short mono label that rides with the clock. */
  readonly marker: string;
  readonly ground: Ground;
  readonly dough: DoughState;
  /** Viewport heights this scene occupies. Pacing lives here. */
  readonly beats: number;
  /** A wash covering the boundary *into* this scene. */
  readonly veil?: Veil;
  /** Oversized display line. May be split across lines by `|`. */
  readonly display?: string;
  /** Smaller lead-in above the display line. */
  readonly kicker?: string;
  /** Body copy. One or two short paragraphs — this is not a brochure. */
  readonly body?: readonly string[];
  /** Measured facts, set in mono. */
  readonly log?: readonly LogLine[];
  readonly plates?: readonly Plate[];
  /** A pulled quote with mandatory attribution. */
  readonly quote?: { readonly text: string; readonly cite: string };
  /** Optional in-scene action. */
  readonly cta?: { readonly label: string; readonly href: string };
}

/** Practical, verified business information for the threshold scene. */
export interface Practical {
  readonly name: string;
  readonly street: string;
  readonly city: string;
  readonly phoneDisplay: string;
  readonly phoneHref: string;
  readonly email: string;
  readonly website: string;
  /** Verified opening hours, and only those. */
  readonly hours: readonly { readonly day: string; readonly range: string }[];
  /** Set when the profile could not verify a full week. */
  readonly hoursCaveat: string | null;
  readonly rating: number | null;
  readonly social: readonly { readonly label: string; readonly href: string }[];
  readonly mapHref: string;
}

/** Everything the emitter needs to write the site. */
export interface Experience {
  readonly title: string;
  readonly metaDescription: string;
  readonly conceptName: string;
  readonly scenes: readonly Scene[];
  readonly practical: Practical;
  readonly logoSrc: string | null;
  /** Every asset path the page references, relative to the site root. */
  readonly assets: readonly string[];
  /** Families the page sets, so only those faces ship. */
  readonly fontFamilies: readonly string[];
}
