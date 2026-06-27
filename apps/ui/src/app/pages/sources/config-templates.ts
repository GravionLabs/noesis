export interface ImporterTypeOption {
  label: string;
  value: string;
}

export const IMPORTER_TYPES: ImporterTypeOption[] = [
  { label: 'LLMs.txt', value: 'llmstxt' },
  { label: 'LLMs.txt (Meta)', value: 'llmstxt-meta' },
  { label: 'LLMs.txt (Crawl)', value: 'llmstxt-crawl' },
  { label: 'Crawler', value: 'crawler' },
  { label: 'NPM README', value: 'npm-readme' },
  { label: 'OpenAPI', value: 'openapi' },
  { label: 'GitHub', value: 'github' },
  { label: 'Azure DevOps', value: 'azuredevops' },
  { label: 'URL List', value: 'url-list' },
  { label: 'Local Filesystem', value: 'local' },
];

const CRAWLER_TEMPLATE = JSON.stringify(
  {
    maxDepth: 2,
    maxPages: 50,
    includeSitemap: true,
    pageTimeoutMs: 15000,
    sameOriginOnly: true,
    allowedHosts: [],
    allowedPathPrefixes: [],
    excludePathPrefixes: [],
    crawlDelayMs: 0,
  },
  null,
  2,
);

const EMPTY_TEMPLATE = '{}';

// Only the crawler importer reads its config (see apps/server/src/crawler/crawler.ts
// normalizeCrawlConfig); every other importer ignores it.
export const CONFIG_TEMPLATES: Record<string, string> = {
  llmstxt: EMPTY_TEMPLATE,
  'llmstxt-meta': EMPTY_TEMPLATE,
  'llmstxt-crawl': EMPTY_TEMPLATE,
  crawler: CRAWLER_TEMPLATE,
  'npm-readme': EMPTY_TEMPLATE,
  openapi: EMPTY_TEMPLATE,
  github: EMPTY_TEMPLATE,
  azuredevops: EMPTY_TEMPLATE,
  'url-list': EMPTY_TEMPLATE,
  local: EMPTY_TEMPLATE,
};
