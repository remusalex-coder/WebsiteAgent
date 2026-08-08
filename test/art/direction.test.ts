/**
 * Art direction: what a page is allowed to show, and where.
 *
 * Two defects are pinned here, both found by looking at a rendered page rather
 * than by a failing assertion:
 *
 * 1. **Tartine's gallery opened on a cookbook.** Six retail packshots outranked
 *    forty-three photographs of bread, and the writer's word list caught only
 *    three of them.
 * 2. **Tartine's location section illustrated a street corner with pastries.**
 *    A section about a specific place took whatever image was next in the pool.
 *
 * The tests are written against the *rule*, not against Tartine. The relative
 * width rule has to keep its hands off a site whose images are uniformly small,
 * and the subject rule has to return nothing rather than something tolerable.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  GALLERY_BUDGET,
  chooseForSection,
  curateGallery,
  dropUndersized,
  servedWidth,
  subjectOf,
} from '../../lib/art/direction.js';

import type { ImageAsset } from '../../lib/types.js';

function image(overrides: Partial<ImageAsset> & { url: string }): ImageAsset {
  return {
    role: 'gallery',
    alt: null,
    width: null,
    height: null,
    localPath: null,
    bytes: null,
    sourceUrl: 'https://example.com/',
    ...overrides,
  };
}

/** Enough images that the relative rule is willing to run. */
function photographs(count: number, width: number): ImageAsset[] {
  return Array.from({ length: count }, (_, index) =>
    image({ url: `https://cdn.example.com/photo-${index}.jpg?w=${width}` }),
  );
}

describe('servedWidth', () => {
  it('prefers the intrinsic size the browser reported', () => {
    assert.equal(servedWidth(image({ url: 'https://x.test/a.jpg?w=800', width: 1600 })), 1600);
  });

  it('falls back to the width the CDN was asked for', () => {
    assert.equal(servedWidth(image({ url: 'https://x.test/a.jpg?w=1800' })), 1800);
  });

  it('is null when nothing states a width', () => {
    assert.equal(servedWidth(image({ url: 'https://x.test/a.jpg' })), null);
  });
});

describe('dropUndersized', () => {
  it('drops the thumbnails a site serves beside its photography', () => {
    // The measured Tartine shape: six packshots at 596–800, the rest at 1800.
    const packshots = [596, 596, 596, 800, 800, 297].map((w, i) =>
      image({ url: `https://cdn.example.com/book-${i}.jpg?w=${w}` }),
    );
    const { kept, note } = dropUndersized([...packshots, ...photographs(20, 1800)]);

    assert.equal(kept.length, 20);
    assert.ok(note !== null && note.includes('median'));
  });

  it('leaves a site alone when all its images are the same size', () => {
    const uniform = photographs(12, 640);
    const { kept, note } = dropUndersized(uniform);

    assert.equal(kept.length, 12);
    assert.equal(note, null);
  });

  it('refuses to run rather than empty a gallery', () => {
    // One enormous image would otherwise make every other image "undersized".
    const set = [
      image({ url: 'https://x.test/huge.jpg?w=6000' }),
      ...photographs(5, 500),
    ];
    assert.equal(dropUndersized(set).kept.length, set.length);
  });

  it('says nothing about a set too small to have a norm', () => {
    const { kept, note } = dropUndersized([
      image({ url: 'https://x.test/a.jpg?w=200' }),
      image({ url: 'https://x.test/b.jpg?w=2000' }),
    ]);
    assert.equal(kept.length, 2);
    assert.equal(note, null);
  });
});

describe('subjectOf', () => {
  it('reads merchandise from alt text', () => {
    assert.equal(subjectOf(image({ url: 'https://x.test/i.jpg', alt: 'Tartine Bread on Amazon' })), 'merchandise');
  });

  it('reads merchandise from a file name', () => {
    assert.equal(subjectOf(image({ url: 'https://x.test/home-image-cookbook.jpg' })), 'merchandise');
  });

  it('reads the premises', () => {
    assert.equal(subjectOf(image({ url: 'https://x.test/tartineinterior_689.jpg' })), 'venue');
  });

  it('reads people', () => {
    assert.equal(subjectOf(image({ url: 'https://x.test/Tartine_Portraits-8463.jpg' })), 'people');
  });

  it('defaults to scene rather than guessing', () => {
    assert.equal(subjectOf(image({ url: 'https://x.test/2L1A2128-2.jpg' })), 'scene');
  });

  it('lets merchandise win over a competing tag', () => {
    // A person holding a branded tote is a photograph of the tote.
    assert.equal(subjectOf(image({ url: 'https://x.test/team-tote-bag.jpg' })), 'merchandise');
  });
});

describe('chooseForSection', () => {
  const interior = image({ url: 'https://x.test/dining-room.jpg' });
  const pastry = image({ url: 'https://x.test/lemon-tart.jpg' });
  const portrait = image({ url: 'https://x.test/founder-portrait.jpg' });

  it('gives a location section the premises', () => {
    assert.equal(chooseForSection('location', [pastry, interior]), interior);
  });

  it('gives a location section nothing when the premises were never photographed', () => {
    // The Tartine defect: a tray of pastries must not illustrate a street corner.
    assert.equal(chooseForSection('location', [pastry, portrait]), null);
  });

  it('prefers a face on an about section', () => {
    assert.equal(chooseForSection('about', [pastry, portrait]), portrait);
  });

  it('never puts a photograph behind information', () => {
    for (const kind of ['hours', 'contact', 'faq', 'cta'] as const) {
      assert.equal(chooseForSection(kind, [pastry, interior, portrait]), null, kind);
    }
  });
});

describe('curateGallery', () => {
  it('holds back merchandise and shows an edit rather than everything', () => {
    const books = [596, 596, 800].map((w, i) =>
      image({ url: `https://cdn.example.com/cookbook-${i}.jpg?w=${w}`, alt: 'Cookbook cover' }),
    );
    const { chosen, rest, notes } = curateGallery([...books, ...photographs(20, 1800)]);

    assert.equal(chosen.length, GALLERY_BUDGET, 'a gallery is an edit');
    assert.ok(chosen.every((entry) => subjectOf(entry) !== 'merchandise'));
    assert.ok(rest.length > 0, 'the remainder stays available to other sections');
    assert.ok(notes.length > 0, 'every cut is explained in the design notes');
  });

  it('rations portraits so a gallery does not become a staff album', () => {
    const people = Array.from({ length: 6 }, (_, i) =>
      image({ url: `https://cdn.example.com/staff-portrait-${i}.jpg?w=1800` }),
    );
    const { chosen } = curateGallery([...people, ...photographs(6, 1800)]);

    assert.ok(chosen.filter((entry) => subjectOf(entry) === 'people').length <= 2);
  });

  it('is deterministic across equal candidates', () => {
    const set = photographs(14, 1200);
    const first = curateGallery(set).chosen.map((entry) => entry.url);
    const second = curateGallery([...set].reverse()).chosen.map((entry) => entry.url);
    assert.deepEqual(first, second);
  });

  it('survives a business with no photographs', () => {
    const { chosen, rest, notes } = curateGallery([]);
    assert.deepEqual(chosen, []);
    assert.deepEqual(rest, []);
    assert.deepEqual(notes, []);
  });
});
