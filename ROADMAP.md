# Contexteur — Strategischer Fahrplan

> Erstellungsdatum: Mai 2026  
> Dokument enthält Architekturentscheidungen, Vergleichstabellen und Roadmap.

---

## 1. Python Dependency Management: `requirements.txt` → `uv`

### Ist-Zustand

Der Embedder (`embedder/`) verwendet `requirements.txt` mit 7 fest versionierten Paketen.
Kein Lockfile, kein Python-Versions-Pinning, kein Build-Tool-Standard.

### Was ist `uv`?

`uv` (Astral) ist ein moderner Python-Package-Manager in Rust — Ersatz für `pip`, `pip-tools`,
`venv` und teilweise `poetry`. Er verwaltet `pyproject.toml` + `uv.lock`.

### Vergleich

| Kriterium | `requirements.txt` | `uv` + `pyproject.toml` |
|---|---|---|
| **Lockfile** | ❌ Nein (nur fixe Versionen) | ✅ `uv.lock` — exakt reproduzierbar |
| **Python-Versions-Pinning** | ❌ Nein | ✅ `requires-python = ">=3.12"` |
| **Installationsgeschwindigkeit** | Langsam (pip) | ✅ 10–100× schneller |
| **Dev-/Prod-Dependencies trennen** | ❌ Umständlich | ✅ `[dependency-groups]` |
| **Docker-Kompatibilität** | ✅ `pip install -r requirements.txt` | ✅ `uv sync --no-dev` |
| **Virtual-Env-Management** | Manuell oder `python -m venv` | ✅ `uv venv` / automatisch |
| **CI-Caching** | Pip-Cache via hash | ✅ `uv.lock` als Cache-Key |
| **Ecosystem-Standard** | Legacy | ✅ PEP 517/518 konform |
| **Editable Installs** | `pip install -e .` | ✅ `uv pip install -e .` |
| **Komplexität** | Sehr niedrig | Niedrig (1 Datei mehr) |

### Empfehlung

**Migration zu `uv` durchführen.** Aufwand: ~30 Minuten, Nutzen dauerhaft.

```bash
# Migration in embedder/
cd embedder
uv init --no-readme         # erzeugt pyproject.toml
uv add fastapi uvicorn psycopg2-binary pgvector openai httpx pydantic-settings
# requirements.txt entfernen
```

**Docker-Änderung:**
```dockerfile
# Vorher
RUN pip install -r requirements.txt

# Nachher
COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --no-dev
```

---

## 2. Monorepo vs. Multi-Repo

### Ist-Zustand

```
contexteur/         ← 1 Repository
├── server/         ← .NET 10 (C#)
├── crawler/        ← Node.js / TypeScript / Playwright
├── embedder/       ← Python / FastAPI
└── infra/          ← Docker Compose / Helm
```

### Vergleich

| Kriterium | Monorepo (aktuell) | Multi-Repo |
|---|---|---|
| **Cross-Service-Änderungen** | ✅ 1 Commit, 1 PR | ❌ Mehrere PRs koordinieren |
| **Unabhängige Releases** | ⚠️ Alle zusammen | ✅ Je Dienst eigene Version |
| **CI-Zeit** | ⚠️ Alles wird gebaut | ✅ Nur geänderter Dienst |
| **Abhängigkeitsmanagement** | ✅ Shared `infra/` | ❌ Infra muss dupliziert/referenziert werden |
| **Onboarding** | ✅ 1 Clone, 1 README | ❌ Mehrere Repos verstehen |
| **Tooling-Komplexität** | Niedrig | ❌ ggf. Nx, Turborepo, o.ä. |
| **Secrets / Permissions** | ✅ 1 Repo-Secret-Set | ✅ Granularer pro Repo |
| **Copilot-Kontext** | ✅ Alles sichtbar | ❌ Kontext fragmentiert |
| **Team-Skalierung** | ⚠️ Ab ~10 Personen problematisch | ✅ Teams arbeiten isoliert |
| **Changelog / Versioning** | ⚠️ Gemeinsam | ✅ `CHANGELOG.md` pro Dienst |
| **Docker-Build-Context** | ✅ Shared Dockerfiles in `infra/` | ❌ Jeder Dienst eigenes Compose |

### Empfehlung

**Monorepo beibehalten.** Begründung:

- Das Projekt ist in aktiver Entwicklung — atomare Cross-Service-Commits sind wertvoll.
- `server/`, `crawler/`, `embedder/` sind logisch eng gekoppelt (shared DB-Schema, Events).
- Copilot / AI-Assistenten profitieren vom vollständigen Kontext in einem Repo.
- Multi-Repo lohnt sich erst ab eigenem Team pro Dienst oder wenn externe Teams einzelne
  Dienste konsumed (z.B. Embedder als eigenständiges Produkt).

**Strukturverbesserung (optional):** Separate CI-Jobs per Verzeichnis via GitHub Actions
`paths:` Filter — so wird nur der geänderte Dienst gebaut.

---

## 3. Weitere Importquellen (Roadmap)

### Priorisierte Liste

| Priorität | Quelle | Importer-Typ | Beschreibung | Aufwand |
|---|---|---|---|---|
| 🔴 Hoch | **npm package docs** | `npm-readme` | README + Changelog via npm registry API | C# (klein) |
| 🔴 Hoch | **OpenAPI / Swagger** | `openapi` | Endpoints + Beschreibungen aus `.yaml`/`.json` | C# (mittel) |
| 🟡 Mittel | **MDN Web Docs** | `llmstxt-crawl` | `https://developer.mozilla.org/llms.txt` existiert | Sofort nutzbar |
| 🟡 Mittel | **PyPI package docs** | `pypi-readme` | README via PyPI JSON API | C# (klein) |
| 🟡 Mittel | **Confluence** | `confluence` | REST API, Seiten als Markdown | C# (mittel) |
| 🟡 Mittel | **Notion** | `notion` | Notion API, Seiten + Datenbanken | C# (mittel) |
| 🟡 Mittel | **PDF Dokumente** | `pdf` | Text-Extraktion aus PDFs | Python (klein) |
| 🟢 Niedrig | **YouTube Transcripts** | `youtube` | yt-dlp oder YouTube API | Node.js (mittel) |
| 🟢 Niedrig | **RSS / Blog-Posts** | `rss` | Atom/RSS Feed → Artikel chunken | C# (klein) |
| 🟢 Niedrig | **Crates.io (Rust)** | `crates-readme` | README via crates.io API | C# (klein) |
| 🟢 Niedrig | **Stack Overflow Tags** | `stackoverflow` | API: Top-Antworten eines Tags | C# (mittel) |

### Beste nächste Quellen mit sofortigem Wert

1. **MDN Web Docs** — `https://developer.mozilla.org/llms.txt` existiert → `llmstxt-crawl` sofort nutzbar
2. **OpenAPI-Import** — eigene APIs (oder externe) als Quelle → direkt im Copilot-Kontext verfügbar
3. **npm-README** — `https://registry.npmjs.org/<pkg>` gibt JSON mit README zurück, trivial zu implementieren

---

## 4. MCP-Server: Erreichbarkeit aus Copilot CLI

### Ist-Zustand

Der `.NET`-Server (`Gravion.Contexteur.Server`) exposes bereits einen vollständigen MCP-Server:

```csharp
builder.Services
    .AddMcpServer()
    .WithHttpTransport()       // HTTP-basierter Transport (SSE + Streamable)
    .WithToolsFromAssembly();

app.MapMcp("/mcp");            // Endpunkt: http://localhost:5000/mcp
```

**Verfügbare MCP-Tools:**
| Tool | Beschreibung |
|---|---|
| `search_docs` | Semantische Suche über alle Chunks |
| `get_chunk` | Einzelnen Chunk per UUID abrufen |
| `list_sources` | Alle registrierten Quellen auflisten |

### Kann Copilot CLI den Server direkt aufrufen?

**Ja — kein separater MCP-Proxy benötigt.**

`ModelContextProtocol.AspNetCore` mit `WithHttpTransport()` implementiert den MCP
HTTP-Transport (Streamable HTTP + SSE-Fallback) nach dem MCP-Spec. Copilot CLI unterstützt
beide Varianten.

### Voraussetzungen

Der `.NET`-Server muss laufen (lokal oder remote):

```bash
# Lokal (ohne Docker): dotnet run aus server/src/Gravion.Contexteur.Server/
# Oder: docker compose up (wenn vollständig containerisiert)
```

### Copilot CLI — MCP-Server konfigurieren

**Option A: VS Code / Copilot Chat (`.vscode/mcp.json` oder User-Settings)**

```json
{
  "mcpServers": {
    "contexteur": {
      "url": "http://localhost:5000/mcp"
    }
  }
}
```

**Option B: GitHub Copilot CLI (`~/.config/github-copilot/mcp.json`)**

```json
{
  "mcpServers": {
    "contexteur": {
      "url": "http://localhost:5000/mcp",
      "transport": "http"
    }
  }
}
```

**Option C: Remote-Server (Produktion)**

Wenn der Server öffentlich erreichbar ist (z.B. `https://contexteur.example.com`):

```json
{
  "mcpServers": {
    "contexteur": {
      "url": "https://contexteur.example.com/mcp"
    }
  }
}
```

### Ist es jetzt schon nutzbar?

**Ja, sobald der Server läuft:**

```bash
# 1. Infra starten
cd infra && docker compose up -d

# 2. Server starten (mit DB-Verbindung)
cd server/src/Gravion.Contexteur.Server
dotnet run

# 3. MCP-Endpoint testen
curl -N http://localhost:5000/mcp \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json"
```

### Kein lokaler MCP-Proxy nötig?

Nein, **wenn** der Server erreichbar ist. Ein lokaler MCP-Proxy/Adapter würde nur benötigt
werden, wenn:
- Der Server keine HTTP-MCP-Transport-Unterstützung hätte (z.B. nur stdio-basiert)
- Authentifizierung / Token-Injection vor dem Server nötig wäre
- Der Server in einem nicht erreichbaren Netz läuft

---

## 5. Offene Aufgaben & Implementierungs-Roadmap

### Phase 1 — Stabilisierung (sofort)

- [ ] **uv-Migration** für `embedder/` (`pyproject.toml` + `uv.lock` + Dockerfile anpassen)
- [ ] **MCP-Konfigurationsdatei** im Repo ablegen (`.vscode/mcp.json` + `README.md`-Abschnitt)
- [ ] **CI/CD**: GitHub Actions mit `paths:`-Filter pro Dienst (Server, Crawler, Embedder)
- [ ] **Embedder Dockerfile** fehlt noch — erstellen (mit uv)
- [ ] **Crawler Dockerfile** prüfen/ergänzen

### Phase 2 — Neue Importquellen

- [ ] **MDN Web Docs** via bestehenden `llmstxt-crawl` (`https://developer.mozilla.org/llms.txt`)
- [ ] **OpenAPI-Importer** (`openapi`): lädt `.yaml` / `.json`, extrahiert Endpoints + Descriptions
- [ ] **npm-README-Importer** (`npm-readme`): `GET https://registry.npmjs.org/<pkg>` → README-Chunk
- [ ] **PyPI-README-Importer** (`pypi-readme`): `GET https://pypi.org/pypi/<pkg>/json` → README-Chunk

### Phase 3 — Infrastruktur & Produktion

- [ ] **Helm Chart** (in `infra/`) für Kubernetes-Deployment
- [ ] **Auth** für den MCP-Endpunkt (API-Key via Header oder Bearer Token)
- [ ] **Remote-Embedder**: Unterstützung für weitere Embedding-Provider (Mistral, Cohere, lokale Modelle via Ollama)
- [ ] **Rate-Limiting** für Crawler (max. Seiten/Minute pro Source)
- [ ] **Retry-Logik** für fehlgeschlagene Jobs (Wolverine Dead-Letter-Queue)

### Phase 4 — Erweiterung MCP-Tools

- [ ] **`import_source`** Tool: Neue Quelle direkt aus dem MCP-Client registrieren + importieren
- [ ] **`get_job_status`** Tool: Status laufender Import-Jobs abfragen
- [ ] **`search_by_url`** Tool: Chunks einer bestimmten URL abrufen

---

## 6. Kurzreferenz — Aktuelle Importer-Typen

| Typ | Sprache | Beschreibung |
|---|---|---|
| `llmstxt` | C# | llms-full.txt laden, H2-Split, Chunks → Postgres |
| `llmstxt-meta` | C# | SHORT llms.txt → Metadaten in `sources.config` |
| `llmstxt-crawl` | C# → Node.js | SHORT llms.txt → Links → Playwright-Crawl |
| `crawler` | C# → Node.js | Einzelne URL per Playwright crawlen |
| `github` | C# | GitHub README via API |
| `azuredevops` | C# | Azure DevOps Crawling |
