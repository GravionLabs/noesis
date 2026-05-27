import assert from 'node:assert/strict';
import test from 'node:test';

import { extractLocsFromSitemap, normalizeCrawlConfig, normalizeUrl } from '../src/crawler.js';

test('normalizeUrl removes hashes and trailing index files', () => {
  assert.equal(normalizeUrl('https://example.com/docs/#intro'), 'https://example.com/docs');
  assert.equal(normalizeUrl('https://example.com/docs/index.html'), 'https://example.com/docs');
  assert.equal(normalizeUrl('https://example.com/docs/index.htm'), 'https://example.com/docs');
  assert.equal(normalizeUrl('https://example.com/docs/'), 'https://example.com/docs');
});

test('normalizeCrawlConfig applies defaults and custom overrides', () => {
  const config = normalizeCrawlConfig({
    maxDepth: 4,
    crawlDelayMs: 250,
    allowedHosts: ['example.com'],
  });

  assert.equal(config.maxDepth, 4);
  assert.equal(config.crawlDelayMs, 250);
  assert.deepEqual(config.allowedHosts, ['example.com']);
  assert.equal(config.includeSitemap, true);
});

test('extractLocsFromSitemap resolves relative URLs', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset>
      <url><loc>/docs/getting-started</loc></url>
      <url><loc>https://example.com/docs/advanced/</loc></url>
    </urlset>`;

  const urls = extractLocsFromSitemap(xml, 'https://example.com/sitemap.xml');

  assert.deepEqual(urls, [
    'https://example.com/docs/getting-started',
    'https://example.com/docs/advanced',
  ]);
});
