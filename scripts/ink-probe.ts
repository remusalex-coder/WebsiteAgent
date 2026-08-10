import {
  adjustForContrast, contrastHex, hexToOklch, oklchToHex,
} from '../lib/design/color.js';

const semantic = {
  canvas: '#fcfcfc', surface: '#efeeee', text: '#252423', textMuted: '#504c4b',
  heading: '#252423', brand: '#ad5622', brandText: '#a6501b', onBrand: '#fcfcfc',
  inverted: '#252423', onInverted: '#fcfcfc',
};

const EMBER_NIGHT = '#12100e';
const EMBER_DUSK = '#1c1815';

const grounds = [
  ['inverted', semantic.inverted],
  ['ember-night', EMBER_NIGHT],
  ['ember-dusk', EMBER_DUSK],
  ['brand', semantic.brand],
] as const;

console.log('=== current page ink on light grounds ===');
for (const [name, value] of [['canvas', semantic.canvas], ['surface', semantic.surface]] as const) {
  console.log(`${name.padEnd(12)} heading ${contrastHex(semantic.heading, value).toFixed(2)}  `
    + `muted ${contrastHex(semantic.textMuted, value).toFixed(2)}  `
    + `accent ${contrastHex(semantic.brandText, value).toFixed(2)}`);
}

console.log('\n=== what the page ink does on the dark grounds (the bug) ===');
for (const [name, value] of grounds) {
  console.log(`${name.padEnd(12)} heading ${contrastHex(semantic.heading, value).toFixed(2)}  `
    + `muted ${contrastHex(semantic.textMuted, value).toFixed(2)}  `
    + `accent ${contrastHex(semantic.brandText, value).toFixed(2)}`);
}

console.log('\n=== candidate muted ink for a dark ground (walk up from the ground) ===');
const invertedOklch = hexToOklch(semantic.inverted);
if (invertedOklch === null) throw new Error('inverted is not a hex colour');
for (const target of [4.5, 5.5, 6.5, 7, 8]) {
  const hex = oklchToHex(adjustForContrast(invertedOklch, semantic.inverted, target, 'lighter'));
  const row = grounds
    .map(([name, value]) => `${name} ${contrastHex(hex, value).toFixed(2)}`)
    .join('  ');
  console.log(`target ${String(target).padEnd(4)} -> ${hex}   ${row}`);
}

console.log('\n=== candidate accent ink for a dark ground (brand hue, walked lighter) ===');
const brandOklch = hexToOklch(semantic.brand);
if (brandOklch === null) throw new Error('brand is not a hex colour');
for (const target of [4.5, 5.5, 6.5]) {
  const hex = oklchToHex(adjustForContrast(brandOklch, semantic.inverted, target, 'lighter'));
  const row = grounds
    .map(([name, value]) => `${name} ${contrastHex(hex, value).toFixed(2)}`)
    .join('  ');
  console.log(`target ${String(target).padEnd(4)} -> ${hex}   ${row}`);
}

console.log('\n=== ink on the brand ground ===');
console.log(`onBrand on brand      ${contrastHex(semantic.onBrand, semantic.brand).toFixed(2)}`);
for (const pct of [90, 80, 74]) {
  // What a naive "dim the ink" would cost on a brand ground.
  const mixed = oklchToHex({
    ...hexToOklch(semantic.onBrand)!,
    l: hexToOklch(semantic.onBrand)!.l * (pct / 100) + hexToOklch(semantic.brand)!.l * (1 - pct / 100),
  });
  console.log(`onBrand dimmed ${pct}%   ${mixed}  ${contrastHex(mixed, semantic.brand).toFixed(2)}`);
}
