# Angular `llms-full.txt` importieren und embedden

```bash
# 1) Stack starten
docker compose -f infra/docker-compose.yml up -d

# 2) Server starten (neues Terminal)
cd server
dotnet run --project src/Gravion.Noesis.Server

# 3) Angular Source registrieren
curl -X POST http://localhost:5000/api/sources \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Angular",
    "url": "https://next.angular.dev/assets/context/llms-full.txt",
    "importerType": "llmstxt"
  }'

# 4) Import starten (SOURCE_ID ersetzen)
SOURCE_ID="<source-id>"
curl -X POST http://localhost:5000/api/sources/$SOURCE_ID/import

# 5) Job prüfen (JOB_ID ersetzen)
JOB_ID="<job-id>"
curl http://localhost:5000/api/jobs/$JOB_ID

# 6) Suche testen
curl -X POST http://localhost:5000/mcp \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "id": 1,
    "params": {
      "name": "search_docs",
      "arguments": { "query": "Angular dependency injection", "limit": 3 }
    }
  }'
```
