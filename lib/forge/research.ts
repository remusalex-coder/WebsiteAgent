/**
 * Deep Research & Evidence Harvester for BusinessForge.
 *
 * Crawls the target business website, Instagram profile, or Google Maps listing,
 * downloads and links real high-res media assets, and uses LLM to synthesize a rich,
 * authentic business dossier (services, spaces, story, verified facts, sensory details).
 *
 * The crawl itself is Playwright, never a model (`evidence_collection`'s own
 * rule: a model that "collects" evidence invents it). Only the synthesis
 * step — turning raw scraped text into a structured dossier — calls a
 * model, and it now routes through the `reasoning` capability rather than
 * constructing a provider directly, for the same reason `signature.ts` and
 * `critic.ts` already do: real cross-vendor failover instead of a single
 * point of failure on whichever vendor `AI_PROVIDER` names.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { createModelInvoker, deterministicModelResult, withDeterministicFloor } from '../capability/invokers.js';
import type { BusinessResearch, ForgeRouting, SourcedAsset } from './types.js';
import type { AppConfig } from '../config.js';
import type { Logger } from '../logger.js';

export interface ResearchOptions {
  readonly url: string;
  readonly order?: string | undefined;
  readonly runDir: string;
  readonly config: AppConfig;
  readonly routing: ForgeRouting;
  readonly logger: Logger;
}

export async function harvestResearch(options: ResearchOptions): Promise<BusinessResearch> {
  const { url, order, runDir, config, routing, logger } = options;
  const assetsDir = path.join(runDir, 'assets');
  await fs.mkdir(assetsDir, { recursive: true });

  logger.info('Starting deep research & harvesting', { url, order });

  const rawPages: { url: string; title: string; text: string; images: string[] }[] = [];
  const downloadedAssets: SourcedAsset[] = [];

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    // Determine starting URLs
    const targetsToCrawl: string[] = [url];

    // If it's a domain, look for common subpages
    if (url.startsWith('http') && !url.includes('google.com/maps') && !url.includes('instagram.com')) {
      const baseUrl = new URL(url).origin;
      targetsToCrawl.push(`${baseUrl}/despre-noi`, `${baseUrl}/despre`, `${baseUrl}/produse`, `${baseUrl}/servicii`, `${baseUrl}/galerie`, `${baseUrl}/contact`);
    }

    const visited = new Set<string>();

    for (const targetUrl of targetsToCrawl) {
      if (visited.has(targetUrl) || visited.size >= 4) continue;
      visited.add(targetUrl);

      try {
        logger.debug('Crawling page', { targetUrl });
        const response = await page.goto(targetUrl, { timeout: 15000, waitUntil: 'domcontentloaded' }).catch(() => null);
        if (!response || response.status() >= 400) continue;

        await page.waitForTimeout(1500);

        const pageData = await page.evaluate(() => {
          const title = document.title || '';
          const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
          const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4')).map((h) => h.textContent?.trim() || '').filter(Boolean);
          const paragraphs = Array.from(document.querySelectorAll('p, li, span')).map((p) => p.textContent?.trim() || '').filter(Boolean);
          const text = [metaDesc, ogDesc, ...headings, ...paragraphs].join('\n');

          const imgs = Array.from(document.querySelectorAll('img'))
            .map((img) => img.src || img.getAttribute('data-src') || '')
            .filter((src) => src && !src.startsWith('data:') && !src.includes('logo') && !src.includes('icon'));

          return { title, text: text.slice(0, 8000), images: Array.from(new Set(imgs)).slice(0, 15) };
        });

        rawPages.push({ url: targetUrl, title: pageData.title, text: pageData.text, images: pageData.images });

        // Download up to 6 distinct images
        for (let i = 0; i < pageData.images.length && downloadedAssets.length < 10; i++) {
          const imgUrl = pageData.images[i];
          if (!imgUrl || !imgUrl.startsWith('http')) continue;

          try {
            const ext = imgUrl.endsWith('.png') ? '.png' : imgUrl.endsWith('.webp') ? '.webp' : '.jpg';
            const fileName = `web_img_${downloadedAssets.length + 1}${ext}`;
            const localFile = path.join(assetsDir, fileName);

            const res = await fetch(imgUrl, { signal: AbortSignal.timeout(6000) });
            if (res.ok) {
              const buffer = Buffer.from(await res.arrayBuffer());
              if (buffer.length > 5000) {
                await fs.writeFile(localFile, buffer);
                downloadedAssets.push({
                  id: `asset-${downloadedAssets.length + 1}`,
                  role: downloadedAssets.length === 0 ? 'hero' : 'gallery',
                  url: imgUrl,
                  localPath: `assets/${fileName}`,
                  alt: pageData.title || 'Venue photography',
                  realDescription: pageData.title || 'Verified website/social photo',
                  provenanceSource: targetUrl,
                });
              }
            }
          } catch {
            // ignore individual image failure
          }
        }
      } catch (err) {
        logger.debug('Failed crawling subpage', { targetUrl, err });
      }
    }
  } catch (err) {
    logger.warn('Browser crawling encountered error, checking fallback artifacts', { err });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  // Synthesize research using LLM
  const prompt = `You are the Lead Business Intelligence Researcher for an elite digital design agency.
Synthesize the gathered raw web/social/location evidence for "${url}" into a rich, structured dossier.

Raw extracted text & evidence:
${rawPages.map((p) => `--- SOURCE: ${p.url} (${p.title}) ---\n${p.text}`).join('\n\n')}

Order/Instructions: "${order || 'Build a world-class luxury digital experience'}"
Available Asset Filenames: ${JSON.stringify(downloadedAssets.map((a) => a.localPath))}

Requirements:
- Extract or formulate the exact business name, authentic story, architectural features/ambiance, spaces (e.g. Grand ballroom with floral chandelier & filigree arches, riverside ceremony garden, intimate halls), signature moments (e.g. first dance on clouds with low-smoke fog & cold sparklers), services/catering, exact location (city, street, region), verified phone number, verified opening hours, verified ratings and reviews, and key emotional differentiators.
- If primary language is Romanian (e.g. for a venue in Drăgășani, Romania), write evocative Romanian copy for descriptions/story/services, while keeping the structure valid.
- Output MUST be valid JSON conforming to the schema.`;

  const modelInvoke = createModelInvoker(
    {
      system: 'You extract factual, evocative, high-fidelity business intelligence into structured JSON. Never return generic placeholders.',
      prompt,
      schemaName: 'business_research',
      effort: 'high',
      maxTokens: 16000,
      modelOverrides: { [config.ai.provider]: config.analyst.model },
      schema: {
        type: 'object',
        required: [
          'name',
          'taglines',
          'category',
          'description',
          'storyAndPhilosophy',
          'productsOrServices',
          'differentiators',
          'location',
          'contact',
          'hours',
          'reviews',
          'primaryLanguage',
        ],
        properties: {
          name: { type: 'string' },
          taglines: { type: 'array', items: { type: 'string' } },
          category: { type: 'string' },
          description: { type: 'string' },
          storyAndPhilosophy: { type: 'string' },
          productsOrServices: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'description'],
              properties: {
                name: { type: 'string' },
                category: { type: 'string' },
                description: { type: 'string' },
                highlight: { type: 'string' },
                price: { type: 'string' },
              },
            },
          },
          differentiators: { type: 'array', items: { type: 'string' } },
          location: {
            type: 'object',
            required: ['address', 'city'],
            properties: {
              address: { type: 'string' },
              city: { type: 'string' },
            },
          },
          contact: {
            type: 'object',
            properties: {
              phone: { type: 'string' },
              email: { type: 'string' },
              website: { type: 'string' },
              instagram: { type: 'string' },
              facebook: { type: 'string' },
            },
          },
          hours: {
            type: 'array',
            items: {
              type: 'object',
              required: ['day', 'range'],
              properties: {
                day: { type: 'string' },
                range: { type: 'string' },
              },
            },
          },
          reviews: {
            type: 'array',
            items: {
              type: 'object',
              required: ['author', 'text', 'rating'],
              properties: {
                author: { type: 'string' },
                text: { type: 'string' },
                rating: { type: 'number' },
              },
            },
          },
          primaryLanguage: { type: 'string' },
        },
      },
    },
    routing.providers,
    logger,
  );

  // Same reasoning as `grounding.ts`: every field below already falls back
  // to a default when a model omits it, so an empty object on the
  // deterministic floor lets that same fallback path compose the whole
  // result — a run survives every vendor being unreachable rather than
  // crashing on a step this invoker never expected to see. The defaults
  // themselves must stay neutral: derived only from evidence already in
  // scope (the crawl target's own `url`, or a crawled page's own `title`),
  // never a fabricated business identity — inventing specific facts here is
  // exactly what the Factual Firewall (`grounding.ts`) exists to catch
  // downstream, one stage too late.
  const invoke = withDeterministicFloor(modelInvoke, (step) => {
    logger.warn('reasoning capability degraded to its deterministic floor — synthesizing research from defaults only', {
      service: step.binding.id,
    });
    return deterministicModelResult(step, {});
  });

  const outcome = await routing.capabilities.run('reasoning', invoke, {
    tokens: { inputTokens: prompt.length / 4, outputTokens: 6_000 },
  });

  if (!outcome.outcome.ok) {
    throw new Error(`[forge.research] no vendor could synthesize research: ${outcome.outcome.error.message}`);
  }

  const parsed = outcome.outcome.data.data as Record<string, unknown>;

  // Neutral, non-fabricated fallback for the business name: prefer a title
  // actually seen on a crawled page (real evidence), then the crawl
  // target's own hostname, before giving up on a generic placeholder.
  // Never a specific invented business identity.
  let fallbackName = 'Unknown Business';
  const crawledTitle = rawPages.find((p) => p.title?.trim())?.title?.trim();
  if (crawledTitle) {
    fallbackName = crawledTitle;
  } else {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      if (host) fallbackName = host;
    } catch {
      // url isn't a parseable absolute URL (e.g. a bare handle); keep the placeholder
    }
  }

  const result: BusinessResearch = {
    name: (parsed.name as string) || fallbackName,
    taglines: (parsed.taglines as string[]) || [],
    category: (parsed.category as string) || '',
    description: (parsed.description as string) || '',
    storyAndPhilosophy: (parsed.storyAndPhilosophy as string) || '',
    productsOrServices: (parsed.productsOrServices as any[]) || [],
    differentiators: (parsed.differentiators as string[]) || [],
    location: {
      address: ((parsed.location as any)?.address as string) || '',
      city: ((parsed.location as any)?.city as string) || '',
      ...((parsed.location as any)?.coordinates ? { coordinates: (parsed.location as any).coordinates } : {}),
    },
    contact: {
      ...((parsed.contact as any)?.phone ? { phone: (parsed.contact as any).phone as string } : {}),
      ...((parsed.contact as any)?.email ? { email: (parsed.contact as any).email as string } : {}),
      website: ((parsed.contact as any)?.website as string) || url,
      ...((parsed.contact as any)?.instagram ? { instagram: (parsed.contact as any).instagram as string } : {}),
      ...((parsed.contact as any)?.facebook ? { facebook: (parsed.contact as any).facebook as string } : {}),
    },
    hours: (parsed.hours as any[]) || [],
    reviews: (parsed.reviews as any[]) || [],
    ...(parsed.ratingSummary ? { ratingSummary: parsed.ratingSummary as any } : {}),
    assets: downloadedAssets,
    primaryLanguage: (parsed.primaryLanguage as string) || 'en',
  };

  logger.info('Research completed successfully', {
    businessName: result.name,
    category: result.category,
    assetsCount: result.assets.length,
  });

  return result;
}
