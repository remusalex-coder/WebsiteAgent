/**
 * Document capabilities: reading and writing the four office formats.
 *
 * Each is bidirectional by design — a business's existing PDF menu is an input,
 * and a generated proposal is an output — so the eventual implementations take
 * an operation rather than being split into reader and writer skills.
 */

import { definePlaceholders } from '../placeholder.js';

import type { AnySkill } from '../types.js';

export const DOCUMENT_SKILLS: readonly AnySkill[] = definePlaceholders('documents', [
  {
    id: 'pdf',
    name: 'PDF',
    description:
      'Extracts text, tables and images from a PDF, and renders a PDF from structured content.',
    blockedOn: 'needs a PDF library chosen and a text-extraction fidelity target',
  },
  {
    id: 'word',
    name: 'Word',
    description: 'Reads and writes .docx: headings, paragraphs, tables, styles.',
    blockedOn: 'needs an OOXML library and a style-mapping decision',
  },
  {
    id: 'excel',
    name: 'Excel',
    description: 'Reads and writes .xlsx: sheets, ranges, formulas, typed cell values.',
    blockedOn: 'needs a spreadsheet library and a type-coercion policy',
  },
  {
    id: 'powerpoint',
    name: 'PowerPoint',
    description: 'Reads and writes .pptx: slides, layouts, text frames, embedded images.',
    blockedOn: 'needs an OOXML library and a layout template set',
  },
]);
