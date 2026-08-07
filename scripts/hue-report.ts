/**
 * Prints the colour each industry's fallback hue actually produces.
 *
 * A hue number is not reviewable by reading it — 258° is navy in HSL and
 * something else entirely in OKLCH. This renders the solid step of the primary
 * ramp for every industry, through that industry's own first-choice theme (the
 * chroma ceiling changes the result), so the table can be checked against the
 * intended identity by eye.
 *
 *   npx tsx scripts/hue-report.ts
 */

import { INDUSTRY_DEFAULTS } from '../lib/design/industries.js';
import { themeFor } from '../lib/design/themes.js';
import { buildColorSystem } from '../lib/design/tokens.js';
import { INDUSTRIES } from '../lib/design/types.js';

const accessibility = {
  targetLevel: 'AA',
  minContrastBody: 4.5,
  minContrastLarge: 3,
  minTapTargetPx: 44,
  respectReducedMotion: true,
  focusStyle: 'outline',
  semanticLandmarks: true,
} as const;

/** Rough name for a hex, for reading the table without a colour picker. */
function nameOf(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta < 0.04) return 'grey';

  let h = 0;
  if (max === r) h = ((g - b) / delta) % 6;
  else if (max === g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;
  h = (h * 60 + 360) % 360;

  const light = max < 0.35 ? 'deep ' : max > 0.85 ? 'light ' : '';
  const names: readonly (readonly [number, string])[] = [
    [12, 'red'], [26, 'vermilion'], [40, 'orange'], [50, 'amber'], [62, 'gold'],
    [75, 'yellow'], [95, 'chartreuse'], [140, 'green'], [165, 'emerald'],
    [180, 'teal'], [195, 'cyan'], [212, 'azure'], [235, 'blue'], [255, 'indigo'],
    [275, 'violet'], [295, 'purple'], [320, 'magenta'], [340, 'pink'], [360, 'crimson'],
  ];
  for (const [limit, name] of names) if (h < limit) return `${light}${name}`;
  return `${light}red`;
}

const rows: string[] = [];
for (const industry of INDUSTRIES) {
  const defaults = INDUSTRY_DEFAULTS[industry];
  for (const direction of defaults.directions.slice(0, 1)) {
    const theme = themeFor(direction);
    const { system } = buildColorSystem({
      seedHex: null,
      fallbackHue: defaults.fallbackHue,
      theme,
      accessibility,
    });
    const brand = system.semantic.brand;
    const accent = system.semantic.accent;
    rows.push(
      [
        industry.padEnd(22),
        `${String(defaults.fallbackHue).padStart(3)}°`,
        direction.padEnd(11),
        brand,
        nameOf(brand).padEnd(16),
        `accent ${accent} ${nameOf(accent).padEnd(16)}`,
        `text ${system.semantic.text}`,
        `canvas ${system.semantic.canvas}`,
        `contrast ${system.contrast.textOnCanvas}`,
      ].join('  '),
    );
  }
}

console.log(rows.join('\n'));
