import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { chromium } from 'playwright';

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

const DISALLOWED_EXTENSIONS = /\.(?:css|js|mjs|map|png|jpe?g|gif|svg|webp|ico|pdf|zip|gz|tgz|bz2|xz|7z|rar|mp3|mp4|mov|avi|wmv|mkv|docx?|xlsx?|pptx?)$/i;

export interface RawChunk {
  docUrl: string;
  docTitle: string | undefined;
  content: string;
  heading: string | undefined;
  headingPath: string[];
  chunkIndex: number;
}

export interface CrawlConfig {
  maxDepth?: number;
  maxPages?: number;
  includeSitemap?: boolean;
  pageTimeoutMs?: number;
  sameOriginOnly?: boolean;
  allowedHosts?: string[];
  allowedPathPrefixes?: string[];
  excludePathPrefixes?: string[];
  /** Milliseconds to wait between page fetches. 0 = no delay (default). */
  crawlDelayMs?: number;
}

interface NormalizedCrawlConfig {
  maxDepth: number;
  maxPages: number;
  includeSitemap: boolean;
  pageTimeoutMs: number;
  sameOriginOnly: boolean;
  allowedHosts: string[];
  allowedPathPrefixes: string[];
  excludePathPrefixes: string[];
  crawlDelayMs: number;
}

interface CrawlTarget {
  url: string;
  depth: number;
}

interface CrawlPageResult {
  chunks: RawChunk[];
  discoveredLinks: string[];
  pageUrl: string;
  /** Canonical URL from <link rel="canonical">, if different from pageUrl. */
  canonicalUrl?: string;
}

export interface CrawlResult {
  chunks: RawChunk[];
  docCount: number;
}

const DEFAULT_CONFIG: NormalizedCrawlConfig = {
  maxDepth: 2,
  maxPages: 100,
  includeSitemap: true,
  pageTimeoutMs: 30_000,
  sameOriginOnly: true,
  allowedHosts: [],
  allowedPathPrefixes: [],
  excludePathPrefixes: [],
  crawlDelayMs: 0,
};

export async function crawlUrl(
  url: string,
  _sourceId: string,
  type: string,
  config?: CrawlConfig,
): Promise<CrawlResult> {
  if (type === 'github') {
    return crawlGitHub(url);
  }

  return crawlDocs(url, config);
}

export function normalizeCrawlConfig(config: CrawlConfig = {}): NormalizedCrawlConfig {
  return {
    maxDepth: config.maxDepth ?? DEFAULT_CONFIG.maxDepth,
    maxPages: config.maxPages ?? DEFAULT_CONFIG.maxPages,
    includeSitemap: config.includeSitemap ?? DEFAULT_CONFIG.includeSitemap,
    pageTimeoutMs: config.pageTimeoutMs ?? DEFAULT_CONFIG.pageTimeoutMs,
    sameOriginOnly: config.sameOriginOnly ?? DEFAULT_CONFIG.sameOriginOnly,
    allowedHosts: [...(config.allowedHosts ?? DEFAULT_CONFIG.allowedHosts)].filter(Boolean),
    allowedPathPrefixes: [...(config.allowedPathPrefixes ?? DEFAULT_CONFIG.allowedPathPrefixes)].filter(Boolean),
    excludePathPrefixes: [...(config.excludePathPrefixes ?? DEFAULT_CONFIG.excludePathPrefixes)].filter(Boolean),
    crawlDelayMs: config.crawlDelayMs ?? DEFAULT_CONFIG.crawlDelayMs,
  };
}

async function crawlDocs(startUrl: string, config: CrawlConfig = {}): Promise<CrawlResult> {
  const options = normalizeCrawlConfig(config);
  const start = normalizeUrl(startUrl);
  const browser = await chromium.launch();

  try {
    const queue: CrawlTarget[] = [{ url: start, depth: 0 }];
    const visited = new Set<string>();
    const queued = new Set<string>([start]);
    const chunks: RawChunk[] = [];
    let docCount = 0;

    if (options.includeSitemap) {
      for (const sitemapUrl of await discoverSitemapUrls(start, options.pageTimeoutMs)) {
        enqueue(queue, queued, sitemapUrl, 1, options.maxDepth);
      }
    }

    while (queue.length > 0 && visited.size < options.maxPages) {
      const target = queue.shift();
      if (!target) {
        continue;
      }

      const normalizedTarget = normalizeUrl(target.url);
      queued.delete(normalizedTarget);

      if (visited.has(normalizedTarget)) {
        continue;
      }

      visited.add(normalizedTarget);

      try {
        const pageResult = await crawlPage(browser, target.url, options);
        chunks.push(...pageResult.chunks);
        docCount += 1;

        // If the page declares a canonical URL different from the fetched URL,
        // mark it visited so we skip it if we encounter it later in the queue.
        if (pageResult.canonicalUrl) {
          visited.add(pageResult.canonicalUrl);
        }

        if (target.depth < options.maxDepth) {
          for (const link of pageResult.discoveredLinks) {
            enqueue(queue, queued, link, target.depth + 1, options.maxDepth);
          }
        }

        if (options.crawlDelayMs > 0 && queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, options.crawlDelayMs));
        }
      } catch (error) {
        console.warn(`Failed to crawl ${target.url}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return { chunks, docCount };
  } finally {
    await browser.close();
  }
}

async function crawlPage(browser: Awaited<ReturnType<typeof chromium.launch>>, url: string, options: NormalizedCrawlConfig): Promise<CrawlPageResult> {
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: options.pageTimeoutMs });
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => undefined);

    const html = await page.content();
    const pageUrl = normalizeUrl(page.url());

    // Resolve canonical URL from <link rel="canonical"> if present and different.
    let canonicalUrl: string | undefined;
    const $ = cheerio.load(html);
    const canonicalHref = $('link[rel="canonical"]').first().attr('href');
    if (canonicalHref) {
      try {
        const normalized = normalizeUrl(new URL(canonicalHref, pageUrl).toString());
        if (normalized !== pageUrl) {
          canonicalUrl = normalized;
        }
      } catch {
        // ignore unparseable canonical href
      }
    }

    const effectiveUrl = canonicalUrl ?? pageUrl;
    const chunks = extractChunks(html, effectiveUrl);
    const discoveredLinks = extractInternalLinks(html, pageUrl, options);

    return { chunks, discoveredLinks, pageUrl, canonicalUrl };
  } finally {
    await page.close();
  }
}

async function crawlGitHub(repoUrl: string): Promise<CrawlResult> {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return { chunks: [], docCount: 0 };
  const [, owner, repo] = match;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/readme`,
    { headers: { Accept: 'application/vnd.github.raw' } },
  );
  if (!res.ok) return { chunks: [], docCount: 0 };
  const md = await res.text();

  return { chunks: chunkMarkdown(md, repoUrl, `${owner}/${repo} README`), docCount: 1 };
}

function extractChunks(html: string, url: string): RawChunk[] {
  const $ = cheerio.load(html);
  const title = $('title').text().trim() || $('h1').first().text().trim();

  $('nav, footer, script, style, noscript, [role="navigation"]').remove();

  const mainContent = $('main, article, [role="main"], .content, .docs-content, .documentation, .docs, #content').first();
  const target = mainContent.length ? mainContent : $('body');
  const markdown = td.turndown(target.html() ?? '');

  return chunkMarkdown(markdown, url, title);
}

function extractInternalLinks(html: string, pageUrl: string, options: NormalizedCrawlConfig): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();
  const baseUrl = new URL(pageUrl);

  $('a[href]').each((_, element) => {
    const href = ($(element).attr('href') ?? '').trim();
    const resolved = resolveCandidateUrl(href, baseUrl);
    if (!resolved || !isAllowedUrl(resolved, baseUrl, options)) {
      return;
    }

    links.add(resolved);
  });

  return [...links];
}

function resolveCandidateUrl(href: string, baseUrl: URL): string | null {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
    return null;
  }

  let candidate: URL;
  try {
    candidate = new URL(href, baseUrl);
  } catch {
    return null;
  }

  if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') {
    return null;
  }

  return normalizeUrl(candidate.toString());
}

function isAllowedUrl(candidateUrl: string, baseUrl: URL, options: NormalizedCrawlConfig): boolean {
  const candidate = new URL(candidateUrl);

  if (DISALLOWED_EXTENSIONS.test(candidate.pathname)) {
    return false;
  }

  if (options.sameOriginOnly && candidate.origin !== baseUrl.origin && !options.allowedHosts.includes(candidate.host)) {
    return false;
  }

  if (options.allowedHosts.length > 0 && !options.allowedHosts.includes(candidate.host)) {
    return false;
  }

  if (options.allowedPathPrefixes.length > 0 && !options.allowedPathPrefixes.some(prefix => candidate.pathname.startsWith(prefix))) {
    return false;
  }

  if (options.excludePathPrefixes.some(prefix => candidate.pathname.startsWith(prefix))) {
    return false;
  }

  return true;
}

async function discoverSitemapUrls(startUrl: string, timeoutMs: number): Promise<string[]> {
  const origin = new URL(startUrl).origin;
  const discoveredSitemaps = new Set<string>();
  const discoveredUrls = new Set<string>();

  const robotsTxt = await fetchText(new URL('/robots.txt', origin).toString(), timeoutMs);
  if (robotsTxt) {
    for (const line of robotsTxt.split('\n')) {
      const match = line.match(/^sitemap:\s*(.+)$/i);
      if (match) {
        discoveredSitemaps.add(normalizeUrl(match[1].trim()));
      }
    }
  }

  for (const fallback of [
    new URL('/sitemap.xml', origin).toString(),
    new URL('/sitemap_index.xml', origin).toString(),
    new URL('/sitemap-index.xml', origin).toString(),
  ]) {
    discoveredSitemaps.add(normalizeUrl(fallback));
  }

  const visitedSitemaps = new Set<string>();

  async function visitSitemap(url: string): Promise<void> {
    const normalized = normalizeUrl(url);
    if (visitedSitemaps.has(normalized)) {
      return;
    }

    visitedSitemaps.add(normalized);
    const xml = await fetchText(normalized, timeoutMs);
    if (!xml) {
      return;
    }

    for (const loc of extractLocsFromSitemap(xml, normalized)) {
      if (isSitemapUrl(loc)) {
        await visitSitemap(loc);
      } else if (isSameOrigin(loc, origin)) {
        discoveredUrls.add(normalizeUrl(loc));
      }
    }
  }

  for (const sitemapUrl of discoveredSitemaps) {
    await visitSitemap(sitemapUrl);
  }

  return [...discoveredUrls];
}

export function extractLocsFromSitemap(xml: string, sitemapUrl: string): string[] {
  const locMatches = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)];
  return locMatches
    .map(match => match[1].trim())
    .map(loc => {
      try {
        return normalizeUrl(new URL(loc, sitemapUrl).toString());
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

function isSitemapUrl(url: string): boolean {
  return /sitemap(?:[_-]index)?\.xml(?:$|\?)/i.test(new URL(url).pathname);
}

function isSameOrigin(url: string, origin: string): boolean {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
}

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

function enqueue(queue: CrawlTarget[], queued: Set<string>, url: string, depth: number, maxDepth: number): void {
  if (depth > maxDepth) {
    return;
  }

  const normalized = normalizeUrl(url);
  if (queued.has(normalized)) {
    return;
  }

  queue.push({ url: normalized, depth });
  queued.add(normalized);
}

export function normalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hash = '';

  if (url.pathname.endsWith('/index.html')) {
    url.pathname = url.pathname.slice(0, -'/index.html'.length) || '/';
  } else if (url.pathname.endsWith('/index.htm')) {
    url.pathname = url.pathname.slice(0, -'/index.htm'.length) || '/';
  }

  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

function chunkMarkdown(md: string, url: string, title: string | undefined): RawChunk[] {
  const MAX_CHARS = 2000;
  const chunks: RawChunk[] = [];
  const headingPath: string[] = [];

  const lines = md.split('\n');
  let currentHeading: string | undefined;
  let buffer = '';
  let chunkIndex = 0;

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed.length > 50) {
      chunks.push({
        docUrl: url,
        docTitle: title,
        content: trimmed,
        heading: currentHeading,
        headingPath: [...headingPath],
        chunkIndex: chunkIndex++,
      });
    }
    buffer = '';
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      flush();
      const level = headingMatch[1].length;
      currentHeading = headingMatch[2];
      headingPath.splice(level - 1);
      headingPath[level - 1] = currentHeading;
    } else {
      buffer += line + '\n';
      if (buffer.length >= MAX_CHARS) flush();
    }
  }
  flush();

  return chunks;
}
