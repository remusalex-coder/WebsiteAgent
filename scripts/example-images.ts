/**
 * Placeholder imagery for the example businesses.
 *
 * Its own module because both halves of the example set need it and the two
 * halves reference each other: with these helpers living in
 * `example-businesses.ts`, importing the extras from there meant the extras'
 * top-level array evaluated before that module's own constants existed.
 *
 * The planner picks a hero and a gallery variant from how many usable images a
 * section has — `magazine` needs two, `masonry` four, `collage` four. A fixture
 * set with no images would send every one of them to the `stack` fallback and
 * make the layout layer look far more repetitive than it is, so the examples
 * carry images and `generate-examples.ts` writes a real file for each.
 */

import type { ImageAsset } from '../lib/types.js';

export const SOURCE = 'https://example.test';

function placeholder(role: ImageAsset['role'], name: string, alt: string): ImageAsset {
  return {
    url: `${SOURCE}/${name}`,
    role,
    alt,
    sourceUrl: SOURCE,
    width: role === 'hero' ? 1600 : 1200,
    height: role === 'hero' ? 900 : 900,
    localPath: `assets/${name}`,
    bytes: null,
  };
}

export function heroImage(alt: string): ImageAsset {
  return placeholder('hero', 'hero.svg', alt);
}

export function galleryImages(count: number, alt: string): readonly ImageAsset[] {
  return Array.from({ length: count }, (_unused, index) =>
    placeholder('gallery', `gallery-${index + 1}.svg`, `${alt} ${index + 1}`));
}
