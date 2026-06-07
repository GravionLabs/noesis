# Noesis — Roadmap

> Last updated: June 2026

---

## Completed Phases

### Phase 1 — TypeScript Server Rewrite
- [x] Fastify server with REST API and MCP tools
- [x] 8 importer types (llmstxt, npm-readme, openapi, github, etc.)
- [x] Embedding providers (local ONNX, Ollama, OpenAI)
- [x] Text + vector search with fallback

### Phase 2 — Infrastructure Cleanup
- [x] Removed .NET server (`server/`)
- [x] Removed Python embedder (`embedder/`)
- [x] Single Dockerfile for TypeScript server
- [x] Updated CI pipeline
- [x] Architecture docs updated

---

## Future Import Sources

| Priority | Source | Importer Type | Description |
|---|---|---|---|
| 🟡 Medium | PyPI package docs | `pypi-readme` | README via PyPI JSON API |
| 🟡 Medium | Confluence | `confluence` | REST API, pages as Markdown |
| 🟡 Medium | Notion | `notion` | Notion API, pages + databases |
| 🟡 Medium | PDF documents | `pdf` | Text extraction from PDFs |
| 🟢 Low | YouTube transcripts | `youtube` | yt-dlp or YouTube API |
| 🟢 Low | RSS / blog posts | `rss` | Atom/RSS feed → article chunk |
| 🟢 Low | Crates.io (Rust) | `crates-readme` | README via crates.io API |
| 🟢 Low | Stack Overflow tags | `stackoverflow` | Top answers for a tag |

---

## Infrastructure & Production

- [ ] **Helm Chart** (in `infra/`) for Kubernetes deployment
- [ ] **Auth** for the MCP endpoint (API key via header or Bearer token)
- [ ] **Rate-limiting** for crawler
- [ ] **Retry logic** for failed import jobs

---

## MCP Tools Expansion

- [ ] **`import_source`** tool — register + import from MCP client
- [ ] **`get_job_status`** tool — query running import jobs
- [ ] **`search_by_url`** tool — retrieve chunks for a given URL
