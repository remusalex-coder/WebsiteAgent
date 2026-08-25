/**
 * Primitive-contributed sibling files — the generic multi-file shipping
 * mechanism `lib/design/experienceRegistry.ts`'s `ExternalPrimitiveContract`
 * needed but Lenis and GSAP never did.
 *
 * ## Why this exists
 *
 * Lenis and GSAP both vendor as a single self-contained script, concatenated
 * into the one `runtime.js` string (`lib/runtime/scroll-progress.ts`'s
 * `RUNTIME_PRIMITIVE_SOURCES`). Three.js's core build cannot join that
 * table: it is a real ES module (`export{...}`, no `import`), only usable by
 * something else `import`-ing from it at a real relative URL — concatenation
 * cannot satisfy that, only the browser's own module resolution can. So a
 * primitive needs a way to say "ship this extra file, at this path,
 * alongside `runtime.js`" — that is the entire scope of this file.
 *
 * ## Why it is not a bigger change
 *
 * `RenderedFile` (`lib/render/types.ts`) already has exactly the shape a
 * sibling file needs (`path` + `contents`) — it is what `index.html` and
 * `styles.css` already are. Nothing new was invented; this only adds one
 * more dispatch table of the same shape as the two that already exist
 * (`RUNTIME_PRIMITIVE_SOURCES` for JS-into-`runtime.js`,
 * `RUNTIME_PRIMITIVE_RULES` for CSS-into-`styles.css`), and one small,
 * additive splice in `lib/render/site.ts`'s existing `files` assembly. No
 * new options, no new primitive category, no bundler.
 */
import { THREE_HERO_ASSET_FILES } from '../runtime/threeHero.js';
import { CURSOR_WEBGL_ASSET_FILES } from '../runtime/forgePrimitives.js';

import type { RuntimePrimitiveId } from '../design/experience.js';
import type { RenderedFile } from './types.js';

/**
 * The closed dispatch table: a `RuntimePrimitiveId` in, the extra sibling
 * files it needs out. Empty for every primitive that ships entirely through
 * the existing JS/CSS string tables — which, as of this pass, is every
 * primitive except `three-js-hero-object`.
 */
const RUNTIME_PRIMITIVE_ASSET_FILES: Readonly<Record<RuntimePrimitiveId, readonly RenderedFile[]>> = {
  'scroll-reveal': [],
  'css-scroll-driven-reveal': [],
  'text-reveal': [],
  'magnetic-cursor': [],
  'lenis-smooth-scroll': [],
  'gsap-scrolltrigger': [],
  'three-js-hero-object': THREE_HERO_ASSET_FILES,
  'horizontal-scroll': [],
  'bento-card-tilt': [],
  'cursor-reactive-webgl': CURSOR_WEBGL_ASSET_FILES,
  'marquee': [],
  'image-hover-reveal': [],
  'animated-counter': [],
  'sticky-text-pin': [],
  'menu-overlay': [],
};

/**
 * Resolves a set of requested primitives to the sibling files they need,
 * deduplicated by path (last-declared wins on a collision, matching the
 * dedup discipline `runtimePrimitiveRules`/`runtimeSourceFor` already use).
 * Empty input returns `[]` — the same "genuinely additive, zero bytes for a
 * caller that never opts in" guarantee every other runtime-primitive table
 * in this codebase carries.
 */
export function runtimePrimitiveAssetFiles(ids: readonly RuntimePrimitiveId[]): readonly RenderedFile[] {
  const unique = [...new Set(ids)];
  const byPath = new Map<string, RenderedFile>();
  for (const id of unique) {
    for (const file of RUNTIME_PRIMITIVE_ASSET_FILES[id]) {
      byPath.set(file.path, file);
    }
  }
  return [...byPath.values()];
}
