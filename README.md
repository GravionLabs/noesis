# contexteur

Self-hosted documentation context engine — crawl, embed, and query via MCP.

## Architecture

```
contexteur/
├── server/      # .NET 9 – MCP Server (SSE), Job Orchestration, pgvector queries
├── crawler/     # Node.js/TypeScript – Playwright-based doc/web crawler
├── embedder/    # Python – Embedding pipeline (OpenAI, Ollama, HuggingFace)
└── infra/
    ├── docker-compose.yml   # Local development (Podman-compatible)
    ├── helm/                # Kubernetes Helm chart
    └── migrations/          # Postgres SQL migrations
```

## Quick Start (Development)

```bash
# Start Postgres + pgvector
docker compose -f infra/docker-compose.yml up -d

# Run server
cd server && dotnet run

# Run crawler
cd crawler && npm install && npm run dev

# Run embedder
cd embedder && pip install -r requirements.txt && python main.py
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `search_docs` | Semantic vector search across indexed documentation |
| `retrieve_context` | Retrieve chunks by ID or query |
| `list_sources` | List all registered documentation sources |
