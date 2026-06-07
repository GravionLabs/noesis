# Infrastructure

## Runtime components
- `.NET server`
- `Node.js crawler`
- `Python embedder`
- `Postgres + pgvector`
- `RabbitMQ`
- `Seq`
- `Vector`
- `MCP Inspector`

## Local ports
- Server: `5000`
- Crawler: `3001`
- Embedder: `8000`
- Postgres: `5442`
- RabbitMQ AMQP: `5682`
- RabbitMQ Management: `15682`
- Seq: `5341`
- MCP Inspector UI: `6274`

## Configuration
- `DbSettings`
- `RabbitMqSettings`
- `Services`
- `Mcp`
- `OllamaSettings`

## Modes
- `docker compose` for full local stack.
- Aspire AppHost for managed or external infra modes.
- MCP Inspector connects to `http://host.docker.internal:5000/mcp` in local development.
