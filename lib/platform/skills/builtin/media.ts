/**
 * Media capabilities: understanding and producing images, audio and language.
 *
 * `vision`, `image-generation`, `speech` and `translation` all end up calling a
 * model, and none of them names a vendor. They take the run's `AIProvider` from
 * `ctx.ai` like everything else — so switching provider switches these too,
 * with no per-skill configuration.
 */

import { definePlaceholders } from '../placeholder.js';

import type { AnySkill } from '../types.js';

export const MEDIA_SKILLS: readonly AnySkill[] = definePlaceholders('media', [
  {
    id: 'vision',
    name: 'Vision',
    description:
      'Describes and classifies an image: what it shows, whether it is a logo or a photograph, whether it is usable as a hero.',
    blockedOn: 'needs multimodal input on the AIProvider contract, which is text-only today',
  },
  {
    id: 'ocr',
    name: 'OCR',
    description:
      'Reads text out of an image or a scanned page, with per-block confidence and position.',
    blockedOn: 'needs an OCR engine chosen — local Tesseract or a hosted API',
  },
  {
    id: 'image-generation',
    name: 'Image generation',
    description:
      'Produces imagery from a prompt, for sites whose own photography is missing or unusable.',
    blockedOn: 'needs an image-model contract; the provider layer generates text only',
  },
  {
    id: 'speech',
    name: 'Speech',
    description: 'Transcribes audio to text and synthesises speech from text.',
    blockedOn: 'needs an audio-model contract and a format policy',
  },
  {
    id: 'translation',
    name: 'Translation',
    description:
      'Translates site copy between languages, preserving tone, formatting and named entities.',
    blockedOn: 'needs a glossary mechanism so business names are never translated',
  },
]);
