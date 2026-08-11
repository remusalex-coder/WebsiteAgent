/**
 * Language detection and the lexicon.
 *
 * The tests that matter here are the *negative* ones: English must stay the
 * answer when the evidence does not clearly say otherwise, because a page
 * mistakenly labelled Romanian is worse than one honestly labelled English —
 * every platform label would be wrong at once and `<html lang>` would send a
 * screen reader to the wrong voice.
 */

import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

import { detectLanguage, lexiconFor, LANGUAGES } from '../../lib/content/language.js';

describe('detectLanguage', () => {
  test('reads Romanian off a Romanian corpus', () => {
    const read = detectLanguage(
      'River Park Events este o locație de evenimente din Drăgășani, pe malul râului, '
      + 'cu spații interioare și exterioare pentru nunți, botezuri și celebrări.',
    );
    assert.equal(read.language, 'ro');
    assert.equal(read.basis, 'evidence');
  });

  test('reads English off an English corpus', () => {
    const read = detectLanguage(
      'A neighbourhood restaurant serving seasonal cuisine, with a wine list and a warm dining room for you and your guests.',
    );
    assert.equal(read.language, 'en');
    assert.equal(read.basis, 'evidence');
  });

  test('falls back to English on an empty corpus, and says the basis was a default', () => {
    const read = detectLanguage('   ');
    assert.equal(read.language, 'en');
    assert.equal(read.basis, 'default');
  });

  test('a stray foreign word does not flip the page', () => {
    // "de" and "la" are Romanian function words and also appear in English
    // proper nouns; one of each must not outvote a page of English.
    const read = detectLanguage(
      'Cafe de la Paix is a coffee shop in the old town. We roast our own beans and bake bread for the morning.',
    );
    assert.equal(read.language, 'en');
  });

  test('the decision is recorded as evidence a reviewer can read', () => {
    const read = detectLanguage('Servicii de reparații auto în București, cu piese și garanție.');
    assert.ok(read.evidence.some((entry) => entry.startsWith('ro:')), read.evidence.join(', '));
  });
});

describe('the lexicon', () => {
  test('English renders the section-kind eyebrow exactly as it always did', () => {
    // The renderer used to print the raw kind. Keeping the English row equal to
    // the identifiers is what makes this change invisible on an English page.
    const en = lexiconFor('en');
    for (const [kind, label] of Object.entries(en.kind)) assert.equal(label, kind);
  });

  test('every language answers every key, so no page can render a blank label', () => {
    const reference = lexiconFor('en');
    for (const language of LANGUAGES) {
      const lex = lexiconFor(language);
      for (const key of Object.keys(reference.label)) {
        assert.ok((lex.label as Record<string, string>)[key], `${language} is missing label.${key}`);
      }
      for (const key of Object.keys(reference.cta)) {
        assert.ok((lex.cta as Record<string, string>)[key], `${language} is missing cta.${key}`);
      }
      for (const key of Object.keys(reference.furniture)) {
        assert.ok((lex.furniture as Record<string, string>)[key], `${language} is missing furniture.${key}`);
      }
      assert.equal(lex.days.length, 7, `${language} needs seven day names`);
      // `statement` is deliberately empty — a statement band is not a nav target.
      for (const [kind, label] of Object.entries(lex.nav)) {
        if (kind !== 'statement') assert.ok(label !== '', `${language} is missing nav.${kind}`);
      }
    }
  });

  test('a list of the business\'s own terms is joined in the page\'s language', () => {
    assert.equal(lexiconFor('en').list(['Cuts', 'Shaves', 'Beard trims']), 'Cuts, Shaves and Beard trims');
    assert.equal(lexiconFor('ro').list(['Nunți', 'Botezuri']), 'Nunți și Botezuri');
    assert.equal(lexiconFor('ro').list(['Nunți']), 'Nunți');
    assert.equal(lexiconFor('en').list([]), '');
  });

  test('the partial-hours disclosure drops the phone half when there is no phone', () => {
    const withPhone = lexiconFor('en').hoursPartial(2, true);
    const without = lexiconFor('en').hoursPartial(2, false);
    assert.match(withPhone, /Call ahead/);
    assert.doesNotMatch(without, /Call ahead/);
    assert.match(without, /2 days/);
  });
});
