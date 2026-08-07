/**
 * The seam between the design layer and the renderer.
 *
 * Two contracts are under test here. The design path must actually take over
 * the page's colours and type, and the no-design path must be unchanged to the
 * byte — an existing caller upgrading this library should see no diff at all
 * until it opts in.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { composeDesign } from '../../lib/design/index.js';
import { renderSite, themeFromDesign } from '../../lib/render/index.js';
import { renderStylesheet } from '../../lib/render/css.js';
import { contrastHex } from '../../lib/design/color.js';
import { profileFixture, strategyFixture } from '../fixtures/business.js';
import { fullContent, minimalContent } from '../fixtures/content.js';
import { assertMatchesSnapshot } from '../support/snapshot.js';

import type { WebsiteContent } from '../../lib/types.js';
import type { DesignDirection } from '../../lib/design/index.js';

function designFor(content: WebsiteContent = fullContent, direction?: DesignDirection) {
  return composeDesign(
    { profile: profileFixture(), strategy: strategyFixture(), content },
    direction === undefined ? {} : { direction },
  );
}

function css(content: WebsiteContent, direction?: DesignDirection): string {
  const site = renderSite(content, { design: designFor(content, direction) });
  return site.files.find((file) => file.path === 'styles.css')?.contents ?? '';
}

describe('backwards compatibility', () => {
  it('renders byte-identically when no design is supplied', () => {
    const before = renderSite(fullContent);
    const after = renderSite(fullContent, {});
    assert.deepEqual(before, after);
  });

  it('emits no design token block without a design', () => {
    const site = renderSite(fullContent);
    const stylesheet = site.files.find((file) => file.path === 'styles.css')?.contents ?? '';

    assert.ok(!stylesheet.includes('Design tokens'));
    // The base rules *reference* the design's names with a fallback, so the
    // check is that nothing declares one. `--space-section` appears either way;
    // `--space-section:` only appears when there is a design to declare it.
    assert.ok(!stylesheet.includes('--space-section:'));
    assert.ok(!stylesheet.includes('--container-max:'));
    assert.ok(!stylesheet.includes('--text-display-size:'));
  });

  it('resolves every design name it references to the old value without a design', () => {
    // The two-name var() form is what keeps the vocabularies from colliding. If
    // a rule ever references a design token with no fallback, a caller that has
    // not opted in silently loses that declaration — so no bare reference to a
    // design-only name may exist in the base stylesheet.
    const site = renderSite(fullContent);
    const stylesheet = site.files.find((file) => file.path === 'styles.css')?.contents ?? '';

    const designOnly = [
      '--color-canvas', '--space-section', '--container-max', '--shadow-sm',
      '--shadow-lg', '--text-body-size', '--text-h1-size', '--text-h2-size',
      '--text-h3-size', '--text-display-size',
    ];

    for (const name of designOnly) {
      const bare = new RegExp(`var\\(\\s*${name}\\s*\\)`);
      assert.ok(!bare.test(stylesheet), `${name} is referenced without a fallback`);
    }
  });

  it('still sanitises BrandVoice when no design is supplied', () => {
    const hostile: WebsiteContent = {
      ...minimalContent,
      voice: { tone: '', palette: ['red; } body { display: none } .x {'], typography: { heading: '', body: '' } },
    };
    const site = renderSite(hostile);
    const stylesheet = site.files[1]?.contents ?? '';

    // The base stylesheet has a legitimate `display: none` in its print block,
    // so assert on the injection payload itself rather than on the property.
    assert.ok(!stylesheet.includes('body { display: none }'));
    assert.ok(!stylesheet.includes('.x {'));
    assert.ok(site.warnings.some((warning) => /palette\[0\]/.test(warning)));
  });
});

describe('rendering under a design', () => {
  it('takes its colours from the design, not from BrandVoice', () => {
    const design = designFor();
    const stylesheet = css(fullContent);

    assert.ok(stylesheet.includes(`--color-primary: ${design.tokens.color.semantic.brand};`));
    assert.ok(stylesheet.includes(`--color-text: ${design.tokens.color.semantic.text};`));
    // The fixture's own palette must not survive.
    assert.ok(!stylesheet.includes('--color-primary: #5b3a29;'));
  });

  it('ignores an unsafe BrandVoice palette entirely rather than sanitising it', () => {
    const hostile: WebsiteContent = {
      ...fullContent,
      voice: { ...fullContent.voice, palette: ['red; } body { display: none } .x {'] },
    };
    const site = renderSite(hostile, { design: designFor(hostile) });
    const stylesheet = site.files[1]?.contents ?? '';

    assert.ok(!stylesheet.includes('body { display: none }'));
    assert.ok(!stylesheet.includes('.x {'));
    // No palette warning: the voice was never consulted.
    assert.ok(!site.warnings.some((warning) => /palette/.test(warning)));
  });

  it('publishes every semantic colour and every ramp step', () => {
    const design = designFor();
    const stylesheet = css(fullContent);

    for (const value of Object.values(design.tokens.color.semantic)) {
      assert.ok(stylesheet.includes(value), `missing ${value}`);
    }
    for (const step of design.tokens.color.ramps.primary.steps) {
      assert.ok(stylesheet.includes(step), `missing ramp step ${step}`);
    }
  });

  it('emits the type scale as clamp() rather than fixed sizes', () => {
    const stylesheet = css(fullContent);

    assert.ok(stylesheet.includes('--text-display-size: clamp('));
    assert.ok(stylesheet.includes('--text-h1-size: clamp('));
    assert.ok(stylesheet.includes('--text-body-height:'));
    assert.ok(stylesheet.includes('--text-h1-weight:'));
  });

  it('emits the spacing scale and section rhythm', () => {
    const stylesheet = css(fullContent);
    for (const token of ['--space-xs', '--space-md', '--space-4xl', '--space-section']) {
      assert.ok(stylesheet.includes(token), token);
    }
  });

  it('emits form, layout, motion and accessibility tokens', () => {
    const stylesheet = css(fullContent);
    for (const token of [
      '--radius-md', '--shadow-md', '--container-max',
      '--duration-base', '--easing', '--tap-target',
    ]) {
      assert.ok(stylesheet.includes(token), token);
    }
  });

  it('produces valid clamp() expressions, low bound before high', () => {
    const stylesheet = css(fullContent);
    const clamps = [...stylesheet.matchAll(/clamp\(([\d.]+)rem, [^,]+, ([\d.]+)rem\)/g)];

    assert.ok(clamps.length > 10, 'expected many fluid tokens');
    for (const [whole, low, high] of clamps) {
      assert.ok(Number(low) <= Number(high), `${whole} has its bounds reversed`);
    }
  });

  it('keeps the stylesheet free of external requests', () => {
    const stylesheet = css(fullContent);
    assert.ok(!stylesheet.includes('@import'));
    assert.ok(!/url\(\s*https?:/i.test(stylesheet));
  });

  it('renders every direction without emitting a broken value', () => {
    const directions: readonly DesignDirection[] = [
      'minimal', 'luxury', 'corporate', 'elegant', 'modern', 'editorial',
      'creative', 'playful', 'bold', 'premium', 'friendly',
    ];

    for (const direction of directions) {
      const stylesheet = css(fullContent, direction);
      assert.ok(!stylesheet.includes('undefined'), `${direction} emitted undefined`);
      assert.ok(!stylesheet.includes('NaN'), `${direction} emitted NaN`);
      assert.ok(stylesheet.includes('--color-primary:'), direction);
    }
  });

  it('carries the contrast guarantee from the design into the emitted CSS', () => {
    const design = designFor();
    const stylesheet = css(fullContent);

    const text = /--color-text: (#[0-9a-f]{6});/.exec(stylesheet)?.[1] ?? '';
    const canvas = /--color-canvas: (#[0-9a-f]{6});/.exec(stylesheet)?.[1] ?? '';

    assert.ok(text !== '' && canvas !== '');
    assert.ok(contrastHex(text, canvas) >= design.accessibility.minContrastBody);
  });

  it('carries the theme colour into the markup', () => {
    const design = designFor();
    const styled = renderSite(fullContent, { design }).files[0]?.contents ?? '';
    assert.ok(styled.includes(`<meta name="theme-color" content="${design.tokens.color.semantic.brand}">`));
  });
});

/**
 * The layout plan is the design decision with the most visual authority, and
 * for one milestone the renderer published it and ignored it. These are the
 * tests that stop that from happening again — each one names a field of
 * `LayoutPlan` or `SectionDesign` and asserts it reached the page.
 */
describe('consuming the layout plan', () => {
  it('renders sections in the plan order, not the written order', () => {
    const design = designFor();
    const html = renderSite(fullContent, { design }).files[0]?.contents ?? '';

    const positions = design.layout.order.map((index) => {
      const kind = fullContent.sections[index]?.kind ?? '';
      return html.indexOf(`section--${kind}`);
    });

    assert.ok(positions.every((position) => position >= 0), 'every planned section rendered');
    for (let step = 1; step < positions.length; step += 1) {
      assert.ok(positions[step]! > positions[step - 1]!, 'sections are out of plan order');
    }
  });

  it('renders every section the plan omits rather than dropping the writer\'s copy', () => {
    const design = designFor();
    const truncated = { ...design, layout: { ...design.layout, order: [0] } };
    const html = renderSite(fullContent, { design: truncated }).files[0]?.contents ?? '';

    for (const section of fullContent.sections) {
      assert.ok(html.includes(`section--${section.kind}`), `${section.kind} was dropped`);
    }
  });

  it('puts the hero variant, section variant, emphasis, density and ground in the markup', () => {
    const design = designFor();
    const html = renderSite(fullContent, { design }).files[0]?.contents ?? '';

    assert.ok(html.includes(`data-variant="${design.layout.hero}"`), 'hero variant');
    assert.ok(html.includes(`section--hero-${design.layout.hero}`), 'hero class');

    for (const section of design.layout.sections) {
      if (section.kind === 'hero') continue;
      assert.ok(html.includes(`data-variant="${section.variant}"`), `variant ${section.variant}`);
      assert.ok(html.includes(`data-emphasis="${section.emphasis}"`), `emphasis ${section.emphasis}`);
      assert.ok(html.includes(`data-density="${section.density}"`), `density ${section.density}`);
      assert.ok(html.includes(`data-bg="${section.background}"`), `ground ${section.background}`);
    }
  });

  it('emits the column count the plan computed', () => {
    const design = designFor();
    const html = renderSite(fullContent, { design }).files[0]?.contents ?? '';
    const columns = design.layout.sections.map((section) => section.columns).filter((value): value is number => value !== null);

    assert.ok(columns.length > 0, 'the fixture should exercise at least one column decision');
    for (const count of columns) {
      assert.ok(html.includes(`--columns: ${count}`), `columns ${count}`);
    }
  });

  it('obeys stickyHeader, showNavigation and the footer variant', () => {
    const design = designFor();

    const sticky = { ...design, layout: { ...design.layout, stickyHeader: true, showNavigation: true, footer: 'rich' as const } };
    const plain = { ...design, layout: { ...design.layout, stickyHeader: false, showNavigation: false, footer: 'minimal' as const } };

    const a = renderSite(fullContent, { design: sticky }).files[0]?.contents ?? '';
    const b = renderSite(fullContent, { design: plain }).files[0]?.contents ?? '';

    assert.ok(a.includes('site-header--sticky'));
    assert.ok(!b.includes('site-header--sticky'));
    assert.ok(a.includes('site-nav--header'));
    assert.ok(!b.includes('site-nav--header'));
    assert.ok(a.includes('site-footer--rich'));
    assert.ok(b.includes('site-footer--minimal'));
  });

  it('renders every hero variant as a different tree', () => {
    const design = designFor();
    const variants = ['centered', 'split', 'editorial', 'image-first', 'full-bleed', 'magazine', 'minimal'] as const;

    const trees = variants.map((hero) => {
      const html = renderSite(fullContent, { design: { ...design, layout: { ...design.layout, hero } } }).files[0] ?? { contents: '' };
      return html.contents;
    });

    assert.equal(new Set(trees).size, variants.length, 'two hero variants rendered identically');
  });

  it('renders every section variant as a different tree', () => {
    const design = designFor();
    const variants = [
      'stack', 'cards', 'bento', 'alternating', 'timeline', 'feature-grid', 'split',
      'list', 'masonry', 'grid', 'collage', 'carousel', 'quotes', 'editorial',
      'slider', 'banner',
    ] as const;

    // The services section of the fixture: bullets, no images, a real heading.
    const target = design.layout.sections.findIndex((section) => section.kind === 'services');
    assert.ok(target >= 0);

    const trees = variants.map((variant) => {
      const sections = design.layout.sections.map((section, position) =>
        (position === target ? { ...section, variant } : section));
      return renderSite(fullContent, { design: { ...design, layout: { ...design.layout, sections } } })
        .files[0]?.contents ?? '';
    });

    // `carousel` and `slider` are the same rail by design — every other pair
    // must differ, or the renderer is treating a variant name as decoration.
    assert.ok(new Set(trees).size >= variants.length - 1, 'section variants collapsed onto one another');
  });

  it('reports a plan whose kind disagrees with the content rather than rendering it silently', () => {
    const design = designFor();
    const sections = design.layout.sections.map((section, position) =>
      (position === 1 ? { ...section, kind: 'faq' as const } : section));

    const site = renderSite(fullContent, { design: { ...design, layout: { ...design.layout, sections } } });
    assert.ok(site.warnings.some((warning) => /expects a "faq"/.test(warning)));
  });
});

describe('consuming imagery, icons and accessibility', () => {
  it('applies the image treatment, crops and radius', () => {
    const stylesheet = css(fullContent);
    for (const token of ['--image-filter:', '--hero-aspect:', '--gallery-aspect:', '--image-radius:', '--overlay-opacity:']) {
      assert.ok(stylesheet.includes(token), token);
    }
    assert.ok(/filter: var\(--image-filter\)/.test(stylesheet), 'the filter is read, not only declared');
  });

  it('sets the item index in the icon style and emits an element only when there is one', () => {
    const design = designFor();
    const withIcons = renderSite(fullContent, { design: { ...design, icons: { ...design.icons, style: 'solid' } } });
    const without = renderSite(fullContent, { design: { ...design, icons: { ...design.icons, style: 'none' } } });

    // The mark is a two-digit index rather than a shape drawn from a border —
    // a bordered square read as an unticked checkbox on every services grid.
    assert.ok((withIcons.files[0]?.contents ?? '').includes('class="index index--solid"'));
    assert.ok(/>01</.test(withIcons.files[0]?.contents ?? ''), 'the first item is numbered');
    assert.ok(!(without.files[0]?.contents ?? '').includes('class="index'));
  });

  it('takes the tap target and the focus style from the accessibility preferences', () => {
    const design = designFor();
    const ring = { ...design, accessibility: { ...design.accessibility, focusStyle: 'ring' as const } };

    const outlined = css(fullContent);
    const ringed = renderSite(fullContent, { design: ring }).files[1]?.contents ?? '';

    assert.ok(outlined.includes('min-height: var(--tap-target)'));
    assert.ok(!outlined.includes('box-shadow: 0 0 0 3px var(--color-canvas)'));
    assert.ok(ringed.includes('box-shadow: 0 0 0 3px var(--color-canvas)'));
  });

  it('spends no motion budget when the direction asks for none', () => {
    const design = designFor();
    const still = { ...design, tokens: { ...design.tokens, motion: { ...design.tokens.motion, level: 'none' as const, effects: [] } } };
    const stylesheet = renderSite(fullContent, { design: still }).files[1]?.contents ?? '';

    assert.ok(!stylesheet.includes('@keyframes forge-enter'));
  });

  it('carries the design\'s reasoning into the stylesheet', () => {
    const design = designFor();
    const stylesheet = css(fullContent);

    assert.ok(stylesheet.includes(design.personality.rationale));
    assert.ok(stylesheet.includes(design.layout.rationale));

    // A rationale that closed the comment would turn prose into declarations.
    //
    // Scoped to the preamble block itself rather than to everything before the
    // banner: the `@font-face` rules are emitted between the two and carry
    // their own comment, so counting terminators across both would fail on a
    // stylesheet where nothing had escaped anything.
    const end = stylesheet.indexOf('*/');
    const preamble = stylesheet.slice(0, end);
    assert.ok(preamble.startsWith('/*'));
    assert.ok(preamble.includes(design.personality.rationale));
    assert.ok(preamble.includes(design.layout.rationale));
  });

  /**
   * The property that pays for the typefaces.
   *
   * The theme library names eighteen faces and none of them used to reach a
   * page, because fetching one would have ended the "a rendered site is a
   * folder that opens from disk" guarantee. Vendoring moved the fetch to build
   * time, and this is the assertion that keeps it there — a future change that
   * points an `@font-face` at a CDN would be a real regression in what the
   * renderer promises, and it would be invisible on a machine with a network.
   */
  it('declares its typefaces as local files and requests nothing', () => {
    const design = designFor();
    const site = renderSite(fullContent, { design });
    const stylesheet = site.files[1]?.contents ?? '';

    assert.ok(stylesheet.includes('@font-face'), 'the design path emits real faces');
    assert.ok(!/url\(\s*["']?https?:/i.test(stylesheet), 'no face is fetched');
    assert.ok(!stylesheet.includes('@import'));

    // Every family the type system names is declared, and every declared face
    // is a file the writer was told to place.
    const declared = [...stylesheet.matchAll(/src: url\("([^"]+)"\)/g)].map((match) => match[1]);
    assert.ok(declared.length > 0);
    assert.deepEqual(
      [...declared].sort(),
      site.fonts.map((font) => font.path).sort(),
      'every @font-face points at a font this render asked the writer to copy',
    );

    for (const family of [design.tokens.typography.heading.family, design.tokens.typography.body.family]) {
      assert.ok(stylesheet.includes(`font-family: "${family}";`), family);
    }
  });
});

describe('themeFromDesign', () => {
  it('maps semantic colours onto the theme slots', () => {
    const design = designFor();
    const theme = themeFromDesign(design);

    assert.equal(theme.colors.primary, design.tokens.color.semantic.brand);
    assert.equal(theme.colors.onPrimary, design.tokens.color.semantic.onBrand);
    assert.equal(theme.colors.surface, design.tokens.color.semantic.canvas);
    assert.equal(theme.design, design);
  });

  it('produces no warnings — a design needs no sanitising', () => {
    const theme = themeFromDesign(designFor());
    assert.equal(theme.extraColors.length, 0);
    assert.ok(renderStylesheet(theme).length > 0);
  });
});

describe('snapshots', () => {
  it('composes the bakery design', () => {
    assertMatchesSnapshot('design.bakery.json', `${JSON.stringify(designFor(), null, 2)}\n`);
  });

  it('composes a law firm design from the same content', () => {
    const design = composeDesign({
      profile: profileFixture({ category: 'Law firm', name: 'Ana & Partners' }),
      strategy: strategyFixture({ primary: 'Law firm', secondary: [] }),
      content: fullContent,
    });
    assertMatchesSnapshot('design.law.json', `${JSON.stringify(design, null, 2)}\n`);
  });

  it('renders the bakery stylesheet under its design', () => {
    assertMatchesSnapshot('design.bakery.styles.css', css(fullContent));
  });
});
