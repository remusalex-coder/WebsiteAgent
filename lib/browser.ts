/**
 * Headless browser abstraction over Playwright Chromium.
 *
 * Deliberately narrow: the surface below is everything the agents need, and
 * nothing about the driver leaks through it. No agent imports Playwright.
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

import { UpstreamError } from './errors.js';
import type { BrowserConfig } from './config.js';
import type { Logger } from './logger.js';

const SOURCE = 'browser';

export interface NavigateOptions {
  /** Overrides `BrowserConfig.timeoutMs` for this navigation. */
  readonly timeoutMs?: number;
  /** How settled the page must be before the call resolves. */
  readonly waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface WaitOptions {
  readonly timeoutMs?: number;
  readonly state?: 'attached' | 'visible' | 'hidden';
}

/** A single page. Obtained from `BrowserSession.newPage`. */
export interface PageHandle {
  /** The URL after any redirects. */
  url(): string;
  goto(url: string, options?: NavigateOptions): Promise<void>;
  waitForSelector(selector: string, options?: WaitOptions): Promise<void>;
  /** Resolves `true` if at least one node matches — never throws on absence. */
  exists(selector: string): Promise<boolean>;
  /** First match's text content, or `null` when absent. */
  text(selector: string): Promise<string | null>;
  /** Text of every match. */
  textAll(selector: string): Promise<string[]>;
  /**
   * Rendered text of the first match — what a sighted visitor would read.
   * Unlike `text`, this respects layout and skips hidden elements.
   */
  innerText(selector: string): Promise<string | null>;
  attribute(selector: string, name: string): Promise<string | null>;
  /** The named attribute across every match, absent values dropped. */
  attributeAll(selector: string, name: string): Promise<string[]>;
  /**
   * Reads several fields from every match, one record per element.
   *
   * A field resolves to the element's DOM property when it has one and falls
   * back to the HTML attribute otherwise. That distinction is the point: `src`
   * and `href` come back absolute rather than as authored, and `naturalWidth`
   * on an image reports its intrinsic size.
   */
  fieldsAll(
    selector: string,
    fields: readonly string[],
  ): Promise<Record<string, string | null>[]>;
  click(selector: string, options?: WaitOptions): Promise<void>;
  /** Scrolls a scrollable container — needed for lazy-loaded Maps reviews. */
  scroll(selector: string, times: number): Promise<void>;
  /**
   * Scrolls the viewport down in steps, so lazy-loaded sections mount and
   * deferred images start fetching. Returns to the top afterwards.
   */
  scrollPage(steps: number): Promise<void>;
  /**
   * The resolved value of a CSS property across every match, in document
   * order. Resolved, not authored: `background-image` comes back as an
   * absolute `url(...)` regardless of how the stylesheet wrote it.
   */
  computedStyleAll(selector: string, property: string): Promise<string[]>;
  /** Full serialised DOM. */
  html(): Promise<string>;
  screenshot(path: string): Promise<void>;
  /** Pauses; used sparingly, to let client-rendered panes settle. */
  wait(ms: number): Promise<void>;
  close(): Promise<void>;
}

export interface BinaryResponse {
  readonly status: number;
  readonly contentType: string | null;
  readonly body: Uint8Array;
}

/** One browser instance, shared across the agents in a run. */
export interface BrowserSession {
  newPage(): Promise<PageHandle>;
  /** Opens a page, runs `fn`, and always closes the page afterwards. */
  withPage<T>(fn: (page: PageHandle) => Promise<T>): Promise<T>;
  /**
   * Downloads a URL through the browser's own context, so cookies, headers and
   * user agent match the pages being read — many hosts serve images only to a
   * request that looks like it came from the page referencing them.
   *
   * Non-2xx responses come back with their status rather than throwing; the
   * caller decides what a 404 means.
   */
  fetchBinary(url: string, options?: { timeoutMs?: number }): Promise<BinaryResponse>;
  close(): Promise<void>;
}

export interface BrowserOptions {
  readonly config: BrowserConfig;
  readonly logger: Logger;
  /** Closes the session when the run is cancelled. */
  readonly signal?: AbortSignal;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function createPageHandle(page: Page, config: BrowserConfig): PageHandle {
  const timeout = (override?: number): number => override ?? config.timeoutMs;
  const clean = (value: string | null): string | null => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  };

  return {
    url: () => page.url(),

    async goto(url, options) {
      await page.goto(url, {
        timeout: timeout(options?.timeoutMs),
        waitUntil: options?.waitUntil ?? 'domcontentloaded',
      });
    },

    async waitForSelector(selector, options) {
      await page.locator(selector).first().waitFor({
        timeout: timeout(options?.timeoutMs),
        state: options?.state ?? 'visible',
      });
    },

    async exists(selector) {
      return (await page.locator(selector).count()) > 0;
    },

    async text(selector) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) return null;
      return clean(await locator.textContent());
    },

    async textAll(selector) {
      const values = await page.locator(selector).allTextContents();
      return values.map((value) => value.trim()).filter((value) => value.length > 0);
    },

    async attribute(selector, name) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) return null;
      return clean(await locator.getAttribute(name));
    },

    async attributeAll(selector, name) {
      const values = await page
        .locator(selector)
        .evaluateAll((nodes, attr: string) => nodes.map((node) => node.getAttribute(attr)), name);
      return values.filter((value): value is string => typeof value === 'string' && value.length > 0);
    },

    async innerText(selector) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) === 0) return null;
      return clean(await locator.innerText());
    },

    async fieldsAll(selector, fields) {
      return page.locator(selector).evaluateAll(
        (nodes, names: string[]) =>
          nodes.map((node) => {
            const record: Record<string, string | null> = {};
            const holder = node as unknown as Record<string, unknown>;
            for (const name of names) {
              const property = holder[name];
              if (typeof property === 'string') record[name] = property;
              else if (typeof property === 'number') record[name] = String(property);
              else record[name] = node.getAttribute(name);
            }
            return record;
          }),
        [...fields],
      );
    },

    async click(selector, options) {
      await page.locator(selector).first().click({ timeout: timeout(options?.timeoutMs) });
    },

    async scroll(selector, times) {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: 'attached', timeout: config.timeoutMs });
      for (let i = 0; i < times; i += 1) {
        // Typed structurally rather than as HTMLElement: this callback runs in
        // the page, and pulling in the DOM lib would put browser globals on
        // Node code that has no business seeing them.
        await locator.evaluate((node) => {
          const element = node as unknown as {
            clientHeight: number;
            scrollBy(x: number, y: number): void;
          };
          element.scrollBy(0, element.clientHeight || 800);
        });
        await page.waitForTimeout(350);
      }
    },

    async scrollPage(steps) {
      for (let i = 0; i < steps; i += 1) {
        await page.mouse.wheel(0, 1_400);
        await page.waitForTimeout(400);
      }
      await page.keyboard.press('Home').catch(() => undefined);
    },

    async computedStyleAll(selector, property) {
      const values = await page.locator(selector).evaluateAll(
        (nodes, prop: string) => {
          // Typed structurally: this runs in the page, and pulling in the DOM
          // lib would put browser globals on Node code that has no use for them.
          const styleOf = (globalThis as unknown as {
            getComputedStyle?: (node: unknown) => { getPropertyValue(name: string): string };
          }).getComputedStyle;
          if (!styleOf) return [];
          return nodes.map((node) => styleOf(node).getPropertyValue(prop) ?? '');
        },
        property,
      );
      return values.filter((value) => value.length > 0 && value !== 'none');
    },

    html: () => page.content(),

    async screenshot(path) {
      await page.screenshot({ path, fullPage: true });
    },

    wait: (ms) => page.waitForTimeout(ms),

    close: () => page.close(),
  };
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

/**
 * Launches a browser session. The caller owns it and must `close()` it —
 * in this system that owner is the orchestrator in `main.ts`, or whichever
 * standalone entry point created the session.
 */
export async function createBrowserSession(options: BrowserOptions): Promise<BrowserSession> {
  const { config, logger, signal } = options;

  let browser: Browser;
  try {
    browser = await chromium.launch({
      headless: config.headless,
      ...(config.proxyUrl ? { proxy: { server: config.proxyUrl } } : {}),
    });
  } catch (error) {
    throw new UpstreamError('Failed to launch Chromium. Run: npx playwright install chromium', {
      source: SOURCE,
      retryable: false,
      cause: error,
    });
  }

  const context: BrowserContext = await browser.newContext({
    locale: config.locale,
    viewport: { width: 1440, height: 1000 },
    ...(config.userAgent ? { userAgent: config.userAgent } : {}),
  });
  context.setDefaultTimeout(config.timeoutMs);
  context.setDefaultNavigationTimeout(config.timeoutMs);

  logger.debug('browser launched', { headless: config.headless, locale: config.locale });

  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    // Never let teardown mask the run's real failure.
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    logger.debug('browser closed');
  };

  signal?.addEventListener('abort', () => void close(), { once: true });

  const session: BrowserSession = {
    async newPage() {
      const page = await context.newPage();
      return createPageHandle(page, config);
    },

    async withPage(fn) {
      const page = await session.newPage();
      try {
        return await fn(page);
      } finally {
        await page.close().catch(() => undefined);
      }
    },

    async fetchBinary(url, options) {
      const response = await context.request.get(url, {
        timeout: options?.timeoutMs ?? config.timeoutMs,
        failOnStatusCode: false,
      });
      return {
        status: response.status(),
        contentType: response.headers()['content-type'] ?? null,
        body: await response.body(),
      };
    },

    close,
  };

  return session;
}
