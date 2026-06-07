# Infrastructure

## Runtime components
- `TypeScript server` (Fastify, Drizzle ORM, pgvector)
- `Node.js crawler` (Playwright)
- `Postgres + pgvector`
- `RabbitMQ` (optional — only needed when crawler runs as separate service)

## Local ports
- Server: `5000`
- Crawler: `3001`
- Postgres: `5442`
- RabbitMQ AMQP: `5682`
- RabbitMQ Management: `15682`

## Configuration
- `DATABASE_URL` — Postgres connection string
- `EMBEDDING_PROVIDER` — `local`, `ollama`, or `openai`
- `EMBEDDING_MODEL`
- `CRAWLER_URL`
- `RABBITMQ_URL`

## Modes
- `docker compose` for full local stack.
- Standalone: `pnpm dev` with local Postgres.
- MCP Inspector connects to `http://host.docker.internal:5000/mcp` in local development.
