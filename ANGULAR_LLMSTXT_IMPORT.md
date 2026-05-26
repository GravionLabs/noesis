# Angular `llms-full.txt` importieren und embedden

```bash
# 1) Stack starten
docker compose -f infra/docker-compose.yml up -d

# 2) Server starten (neues Terminal)
cd server
dotnet run --project src/Gravion.Noesis.Server

# 3) Einmaligen Angular-Import starten (Bash, legt Source an oder nutzt vorhandene)
chmod +x scripts/import-angular-llms-full.sh
./scripts/import-angular-llms-full.sh

# Optional: vorab Migrationen über ef-migrate erzwingen
# ./scripts/import-angular-llms-full.sh --ensure-migrations

# Optional: abweichende API-URL
# API_BASE_URL=http://localhost:5000 ./scripts/import-angular-llms-full.sh
```

```powershell
# 3b) Alternativ unter PowerShell
./scripts/import-angular-llms-full.ps1

# Optional: Migrationen vor dem Import ausführen
# ./scripts/import-angular-llms-full.ps1 -EnsureMigrations
```

```bash
# 4) Suche testen
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
