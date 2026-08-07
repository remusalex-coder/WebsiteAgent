/**
 * The built-in skill catalogue.
 *
 * Thirty-eight reserved capability ids across eight categories. Every one is a
 * placeholder today — a settled contract with nothing bound behind it — and
 * every one is honest about that: version `0.0.0`, health `unavailable`, and a
 * `not_implemented` error rather than an empty result.
 *
 * Implementing one means replacing its entry in the category file, or shipping
 * a `*.skill.ts` in a discovery directory that reuses the id. Discovery
 * replaces built-ins deliberately, so the second path needs no change here at
 * all. Either way no agent is touched, which is the point of the whole layer.
 */

import { DATA_SKILLS } from './data.js';
import { DEVELOPMENT_SKILLS } from './development.js';
import { DOCUMENT_SKILLS } from './documents.js';
import { MARKETING_SKILLS } from './marketing.js';
import { MEDIA_SKILLS } from './media.js';
import { OPERATIONS_SKILLS } from './operations.js';
import { PRODUCTIVITY_SKILLS } from './productivity.js';
import { WEB_SKILLS } from './web.js';

import type { AnySkill } from '../types.js';

export const BUILTIN_SKILLS: readonly AnySkill[] = [
  ...WEB_SKILLS,
  ...DEVELOPMENT_SKILLS,
  ...DOCUMENT_SKILLS,
  ...MEDIA_SKILLS,
  ...DATA_SKILLS,
  ...OPERATIONS_SKILLS,
  ...MARKETING_SKILLS,
  ...PRODUCTIVITY_SKILLS,
];

export {
  DATA_SKILLS,
  DEVELOPMENT_SKILLS,
  DOCUMENT_SKILLS,
  MARKETING_SKILLS,
  MEDIA_SKILLS,
  OPERATIONS_SKILLS,
  PRODUCTIVITY_SKILLS,
  WEB_SKILLS,
};
