/**
 * SEO and discoverability: what a crawler and a search results page see.
 */

import { check, extractJsonLd, hasFile } from '../helpers.js';
import type { CheckFn } from '../types.js';

const robotsTxt: CheckFn = (ctx) => {
  const c = check('seo.robots-txt', 'seo-discoverability', 'robots.txt', 'medium');
  if (hasFile(ctx, /^robots\.txt$/i)) return c.pass(['robots.txt is present in the rendered output']);
  return c.fail(
    ['no robots.txt among the rendered files'],
    'Emit a robots.txt that allows crawling and, once a domain is chosen, points to the sitemap.',
  );
};

const uniqueTitle: CheckFn = (ctx) => {
  const c = check('seo.unique-title', 'seo-discoverability', 'Page title', 'high');
  const title = ctx.content.seo.title.trim();
  const fellBack = ctx.site.warnings.some((w) => /seo\.title is empty/.test(w));
  if (fellBack || title === '') {
    return c.fail(
      ['seo.title is empty; the renderer used the business name alone as <title>'],
      'Write a title under 60 characters naming the business, its trade and its town.',
    );
  }
  if (title.length > 70) {
    return c.warn([`title is ${title.length} characters: "${title}"`], 'Shorten the title below ~60 characters so search engines do not truncate it.');
  }
  return c.pass([`<title>${title}</title>, ${title.length} characters`]);
};

const metaDescription: CheckFn = (ctx) => {
  const c = check('seo.meta-description', 'seo-discoverability', 'Meta description', 'high');
  const description = ctx.content.seo.description.trim();
  if (description === '') {
    return c.fail(
      ['seo.description is empty; no <meta name="description"> was emitted'],
      'Write a 140-160 character description of what a visitor will find.',
    );
  }
  if (description.length < 50 || description.length > 165) {
    return c.warn(
      [`description is ${description.length} characters: "${description}"`],
      'Aim for roughly 140-160 characters — search engines truncate outside that range.',
    );
  }
  return c.pass([`meta description is ${description.length} characters`]);
};

const socialShareImage: CheckFn = (ctx) => {
  const c = check('seo.social-share-image', 'seo-discoverability', 'Social share image (Open Graph)', 'low');
  if (/<meta property="og:image"/.test(ctx.html)) {
    const match = /<meta property="og:image" content="([^"]*)">/.exec(ctx.html);
    return c.pass([`og:image is set to ${match?.[1] ?? '(present)'}`]);
  }
  return c.warn(
    ['no og:image meta tag was emitted; the renderer only emits one for an absolute http(s) logo URL'],
    'Host a share image at an absolute URL (a downloaded logo/hero re-hosted after deploy, or a generated 1200x630 card) so links shared on social platforms carry a preview.',
  );
};

const structuredDataPresence: CheckFn = (ctx) => {
  const c = check('seo.structured-data', 'seo-discoverability', 'Structured data (JSON-LD)', 'high');
  const emptyWarning = ctx.site.warnings.some((w) => /structuredData is empty/.test(w));
  if (emptyWarning || Object.keys(ctx.content.seo.structuredData).length === 0) {
    return c.fail(['seo.structuredData is an empty object; no JSON-LD script was emitted'], 'Populate structuredData from the verified profile — name, address, hours, and a schema.org @type.');
  }
  const parsed = extractJsonLd(ctx.html);
  if (parsed === null) {
    return c.fail(['a JSON-LD script tag could not be parsed back out of the rendered page'], 'Verify the structured data survives rendering as valid JSON.');
  }
  const type = parsed['@type'];
  if (typeof type !== 'string' || type.trim() === '') {
    return c.fail(['JSON-LD payload has no @type'], 'Every schema.org payload needs an @type.');
  }
  return c.pass([`JSON-LD @type is "${type}"`, `@context is "${String(parsed['@context'] ?? '(missing)')}"`]);
};

export const seoChecks: readonly CheckFn[] = [
  robotsTxt,
  uniqueTitle,
  metaDescription,
  socialShareImage,
  structuredDataPresence,
];
