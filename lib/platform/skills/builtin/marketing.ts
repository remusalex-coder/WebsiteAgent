/**
 * Marketing capabilities: getting a finished site found, measured and updated.
 *
 * `seo` is the one with an existing counterpart in the pipeline — stage 4
 * already produces SEO *priorities*. This skill is the other half: executing
 * and verifying them against a live site. The strategy stays in the analyst;
 * the measurement belongs out here.
 */

import { definePlaceholders } from '../placeholder.js';

import type { AnySkill } from '../types.js';

export const MARKETING_SKILLS: readonly AnySkill[] = definePlaceholders('marketing', [
  {
    id: 'seo',
    name: 'SEO',
    description:
      'Audits a live site: metadata, headings, structured data, canonical URLs, internal linking, local signals.',
    dependencies: ['browser-automation'],
    blockedOn: 'needs an audit rule set; stage 4 recommends but nothing verifies',
  },
  {
    id: 'analytics',
    name: 'Analytics',
    description:
      'Installs page and event tracking on a generated site, and reads traffic back out.',
    blockedOn: 'needs an analytics provider chosen and a consent-aware install',
  },
  {
    id: 'cms',
    name: 'CMS',
    description:
      'Creates and updates pages, posts and media in a content management system, so a site can be maintained after launch.',
    requiredCredentials: ['CMS_API_KEY'],
    blockedOn: 'needs a CMS chosen and a content-model mapping',
  },
  {
    id: 'social-media',
    name: 'Social media',
    description:
      'Reads profile and post data from a business’s social accounts, and publishes to them.',
    requiredCredentials: ['SOCIAL_API_KEY'],
    blockedOn:
      'needs per-network adapters and an explicit publish confirmation — posting is outward-facing',
  },
]);
