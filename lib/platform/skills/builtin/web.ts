/**
 * Web capabilities: driving browsers, fetching pages, and the two external
 * services this pipeline is built around.
 *
 * `google-maps` and `lovable` are listed here as skills even though stages 1
 * and 6 already talk to those systems. That is deliberate: the skill ids are
 * where those integrations belong once the agents stop owning their transports,
 * and reserving them now means that move is a registration change rather than
 * an agent rewrite.
 */

import { definePlaceholders } from '../placeholder.js';

import type { AnySkill } from '../types.js';

export const WEB_SKILLS: readonly AnySkill[] = definePlaceholders('web', [
  {
    id: 'browser-automation',
    name: 'Browser automation',
    description:
      'Drives a headless browser: navigate, wait, read the DOM, extract text and links. The driver-agnostic layer every page-reading skill sits on.',
    blockedOn: 'needs to wrap lib/browser.ts so a skill and an agent share one session',
  },
  {
    id: 'playwright',
    name: 'Playwright',
    description:
      'Playwright-specific automation: selectors, network interception, screenshots, tracing, multi-context runs.',
    dependencies: ['browser-automation'],
    blockedOn: 'needs the Playwright driver bound to the shared browser session',
  },
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    description:
      'Managed crawl-and-extract: turns a site into clean markdown without running a browser locally.',
    requiredCredentials: ['FIRECRAWL_API_KEY'],
    blockedOn: 'needs the Firecrawl HTTP client and a crawl-budget policy',
  },
  {
    id: 'google-maps',
    name: 'Google Maps',
    description:
      'Place lookup and business details. The Places API path for the review count and full-week hours that scraping structurally cannot reach.',
    requiredCredentials: ['GOOGLE_MAPS_API_KEY'],
    blockedOn: 'needs the Places API client; discoveryAgent scrapes today',
  },
  {
    id: 'web-search',
    name: 'Web search',
    description:
      'Queries a search engine and returns ranked results with titles, URLs and snippets.',
    requiredCredentials: ['SEARCH_API_KEY'],
    blockedOn: 'needs a search provider chosen and its adapter written',
  },
  {
    id: 'lovable',
    name: 'Lovable',
    description:
      'Creates and builds a Lovable project from a site spec, then polls it to live or failed.',
    requiredCredentials: ['LOVABLE_API_KEY'],
    blockedOn: 'stage 6 is still a stub; the API client does not exist yet',
  },
]);
