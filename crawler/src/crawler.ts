import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

export interface RawChunk {
  docUrl: string;
  docTitle: string | undefined;
  content: string;
  heading: string | undefined;
  headingPath: string[];
  chunkIndex: number;
}

export async function crawlUrl(
  url: string,
  sourceId: string,
  type: string,
): Promise<RawChunk[]> {
  if (type === 'github') {
    return crawlGitHub(url);
  }
  return crawlDocs(url);
}

async function crawlDocs(startUrl: string): Promise<RawChunk[]> {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    const html = await page.content();
    return extractChunks(html, startUrl);
  } finally {
    await browser.close();
  }
}

async function crawlGitHub(repoUrl: string): Promise<RawChunk[]> {
  // Convert github.com URL to raw API URL for README
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) return [];
  const [, owner, repo] = match;

  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/readme`,
    { headers: { Accept: 'application/vnd.github.raw' } },
  );
  if (!res.ok) return [];
  const md = await res.text();

  return chunkMarkdown(md, repoUrl, `${owner}/${repo} README`);
}

function extractChunks(html: string, url: string): RawChunk[] {
  const $ = cheerio.load(html);
  const title = $('title').text().trim() || $('h1').first().text().trim();

  // Remove navigation, footer, scripts
  $('nav, footer, script, style, [role="navigation"]').remove();

  const mainContent = $('main, article, .content, .docs-content, #content').first();
  const target = mainContent.length ? mainContent : $('body');
  const md = td.turndown(target.html() ?? '');

  return chunkMarkdown(md, url, title);
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
