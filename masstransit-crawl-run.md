# MassTransit-Crawl starten

## Voraussetzungen

- Docker-Stack läuft (`infra/docker-compose.yml`)
- Noesis Server läuft auf `http://localhost:5000`
- Crawler-Image ist aktuell gebaut
- Bei Code-Änderungen am Event-Routing: Server neu bauen/starten, damit `StartCrawlJob`
  mit dem konfigurierten Entity-Name `noesis.start-crawl-job` publiziert wird.

## 1. (Optional) Crawler-Image neu bauen

```bash
docker compose -f infra/docker-compose.yml build crawler
docker compose -f infra/docker-compose.yml up -d crawler
```

## 1b. Server neu starten (nach Routing-Codeänderungen)

```bash
cd server
dotnet build Gravion.Noesis.slnx
dotnet run --project src/Gravion.Noesis.Server
```

## 2. Source für MassTransit anlegen

```bash
curl -X POST http://localhost:5000/api/sources \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "MassTransit Docs",
    "url": "https://masstransit.massient.com/",
    "importerType": "crawler",
    "config": "{\"maxDepth\":2,\"maxPages\":150,\"includeSitemap\":true,\"crawlDelayMs\":250}"
  }'
```

Die Antwort enthält die `id` der Source.

## 3. Import starten

```bash
SOURCE_ID="<source-id-aus-schritt-2>"
curl -X POST http://localhost:5000/api/sources/$SOURCE_ID/import
```

Die Antwort enthält die `jobId`.

## 4. Job-Status prüfen

```bash
JOB_ID="<job-id-aus-schritt-3>"
curl http://localhost:5000/api/jobs/$JOB_ID
```

Erwarteter Ablauf: `pending -> running -> embedding -> done`.
