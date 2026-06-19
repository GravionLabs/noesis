# Phase 2: Copilot CLI Skill – `repo-llms-txt-generator`

**Status:** In Progress  
**Ziel:** Ein Copilot Skill, das via CLI `llms.txt` / `llms-full.txt` aus Repos generiert  
**Abhängigkeiten:** Phase 1 ✅ komplett (embedder + crawler mit Providern)

---

## Überblick

Phase 2 konvertiert die Phase 1 Komponenten in einen **produktionsreifen Copilot Skill**:

```
User CLI
  │
  ├─→ /skill repo-llms-txt-generator
  │      --repo https://github.com/user/project
  │      --output ./llms-full.txt
  │      --embedding-model bge-large-en-v1.5
  │      --max-depth 5
  │      --format full | summary
  │
  ├─→ Calls: npm run analyze-repo [options]
  │      ↓
  └─→ TypeScript CLI (repo-analyzer-cli.ts)
         ├─→ Provider selection (GitHub/Azure/Local)
         ├─→ Repository structure traversal
         ├─→ Calls HTTP /embed & /chunk (Python embedder)
         └─→ Generates llms-full.txt
```

---

## Architektur & Komponenten

### A. Skill Definition (`crawler/skill.toml`)

```toml
[skill]
name = "repo-llms-txt-generator"
version = "1.0.0"
provider = "gravionlabs"
description = "Generate llms.txt/llms-full.txt from GitHub and Azure DevOps repositories using semantic analysis"
category = "documentation"

[[commands]]
name = "analyze-repo"
description = "Analyze a repository and generate llms.txt with semantic chunking"
entry_point = "npm run analyze-repo"

[[flags]]
name = "repo"
type = "string"
required = true
description = "Repository URL (GitHub, Azure DevOps, or local path)"

[[flags]]
name = "output"
type = "string"
required = true
description = "Output file path (default: ./llms-full.txt)"

[[flags]]
name = "embedding-model"
type = "string"
default = "bge-large-en-v1.5"
description = "HuggingFace model: bge-large-en-v1.5 | e5-large-v2 | nomic-embed-text-v1.5"

[[flags]]
name = "max-depth"
type = "number"
default = 10
description = "Maximum directory traversal depth"

[[flags]]
name = "format"
type = "string"
default = "full"
description = "Output format: full (all code) | summary (structure only)"

[[flags]]
name = "include-symbols"
type = "boolean"
default = false
description = "Include extracted code symbols (functions, classes) in output"

[[flags]]
name = "token"
type = "string"
description = "GitHub/Azure DevOps personal access token (env: GH_TOKEN or ADO_TOKEN)"

[[flags]]
name = "embedder-url"
type = "string"
default = "http://localhost:8000"
description = "FastAPI embedder service URL (for distributed setup)"
```

### B. Skill Entry Point (`crawler/src/skills/repo-llms-txt-generator.ts`)

```typescript
// Skill wrapper for Copilot CLI
import { RepoAnalyzer, RepoAnalyzerConfig } from '../repo-analyzer';
import { getProvider } from '../providers';

export async function runSkill(args: Record<string, unknown>): Promise<void> {
  const config: RepoAnalyzerConfig = {
    repoUrl: args.repo as string,
    outputPath: args.output as string,
    embeddingModel: (args['embedding-model'] as string) || 'bge-large-en-v1.5',
    maxDepth: (args['max-depth'] as number) || 10,
    format: (args.format as 'full' | 'summary') || 'full',
    includeSymbols: (args['include-symbols'] as boolean) || false,
    token: (args.token as string) || process.env.GH_TOKEN || process.env.ADO_TOKEN,
    embedderUrl: (args['embedder-url'] as string) || 'http://localhost:8000',
  };

  const analyzer = new RepoAnalyzer(config);
  const result = await analyzer.analyze();
  
  console.log(`✅ Generated ${result.outputPath}`);
  console.log(`📦 Files: ${result.filesCount}`);
  console.log(`📄 Chunks: ${result.chunksCount}`);
  console.log(`⚡ Time: ${result.elapsedMs}ms`);
}
```

### C. Erweiterte RepoAnalyzer Konfiguration

Modifiziere `crawler/src/repo-analyzer.ts`:

```typescript
export interface RepoAnalyzerConfig {
  repoUrl: string;
  outputPath: string;
  embeddingModel: 'bge-large-en-v1.5' | 'e5-large-v2' | 'nomic-embed-text-v1.5';
  maxDepth?: number;
  format?: 'full' | 'summary';
  includeSymbols?: boolean;
  token?: string;
  embedderUrl?: string;
  filePatterns?: string[];  // Inclusion patterns
  excludePatterns?: string[];  // Exclusion patterns
}

export interface AnalysisResult {
  outputPath: string;
  filesCount: number;
  chunksCount: number;
  elapsedMs: number;
  modelUsed: string;
}
```

### D. CLI Einstiegspunkt (`crawler/src/repo-analyzer-cli.ts`)

Erweitere existierenden CLI mit Skill-Integration:

```typescript
import { RepoAnalyzer } from './repo-analyzer';
import { runSkill } from './skills/repo-llms-txt-generator';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  
  // If called as skill
  if (args.skill === 'true') {
    return runSkill(args);
  }
  
  // Direct CLI invocation (fallback)
  const analyzer = new RepoAnalyzer({
    repoUrl: args.repo as string,
    outputPath: args.output as string || './llms-full.txt',
    embeddingModel: args['embedding-model'] as any || 'bge-large-en-v1.5',
    // ... rest of config
  });
  
  await analyzer.analyze();
}

main().catch(console.error);
```

---

## Implementation Details

### 1. Skill Packaging

**Option A (Recommended):** Lokales Skill im Copilot CLI config

```json
{
  "skills": {
    "repo-llms-txt-generator": {
      "location": "file:///path/to/noesis/crawler",
      "entry": "npm run analyze-repo"
    }
  }
}
```

**Option B:** Als npm package veröffentlichen

```bash
npm publish --registry https://npm.pkg.github.com
```

### 2. Error Handling & Validation

```typescript
// Validierung in RepoAnalyzer.analyze()
if (!this.config.repoUrl) throw new Error('Missing --repo flag');
if (!this.config.outputPath) throw new Error('Missing --output flag');

// Provider detection mit Fehlerbehandlung
try {
  const provider = getProvider(this.config.repoUrl);
} catch (e) {
  throw new Error(`Unsupported repository URL: ${this.config.repoUrl}`);
}

// Embedder Verfügbarkeit prüfen
try {
  const health = await fetch(`${this.config.embedderUrl}/repo-analyzer/health`);
  if (!health.ok) throw new Error('Embedder service not running');
} catch (e) {
  console.warn(`⚠️  Embedder service unreachable at ${this.config.embedderUrl}`);
  console.warn('Continuing without semantic chunking...');
  // Fallback: naive chunking
}
```

### 3. Progress Reporting

```typescript
// Emit progress events
interface AnalysisEvent {
  phase: 'init' | 'traverse' | 'chunk' | 'embed' | 'finalize';
  current: number;
  total: number;
  message: string;
}

// Console output
console.log(`🔍 Analyzing repository...`);
console.log(`📂 Found ${totalFiles} files`);
console.log(`🔄 Processing chunks (${processedChunks}/${totalChunks})...`);
console.log(`✨ Embedding completed in ${elapsedMs}ms`);
```

---

## Abhängigkeiten & Setup

### npm Dependencies (bereits in `crawler/package.json`)

```json
{
  "dependencies": {
    "axios": "^1.6",
    "dotenv": "^16.0"
  },
  "devDependencies": {
    "typescript": "^5.0"
  }
}
```

### npm Scripts (hinzufügen zu `crawler/package.json`)

```json
{
  "scripts": {
    "analyze-repo": "tsx src/repo-analyzer-cli.ts",
    "analyze-repo:skill": "tsx src/repo-analyzer-cli.ts --skill=true",
    "build": "tsc",
    "test:analyzer": "tsx test/repo-analyzer.test.ts"
  }
}
```

---

## Testing & Validierung

### Unit Tests (`crawler/test/repo-analyzer.test.ts`)

```typescript
describe('RepoAnalyzer', () => {
  it('should analyze GitHub repository', async () => {
    const analyzer = new RepoAnalyzer({
      repoUrl: 'https://github.com/angular/angular',
      outputPath: '/tmp/angular-llms.txt',
    });
    const result = await analyzer.analyze();
    expect(result.filesCount).toBeGreaterThan(0);
    expect(result.outputPath).toBe('/tmp/angular-llms.txt');
  });

  it('should validate config', () => {
    expect(() => new RepoAnalyzer({ repoUrl: '', outputPath: '' }))
      .toThrow('Missing --repo flag');
  });

  it('should handle unsupported repos', async () => {
    const analyzer = new RepoAnalyzer({
      repoUrl: 'https://gitlab.com/example/repo',
      outputPath: '/tmp/out.txt',
    });
    expect(analyzer.analyze()).rejects.toThrow('Unsupported repository');
  });
});
```

### Integration Tests

```bash
# Lokales Repo
npm run analyze-repo --repo=/path/to/local --output=/tmp/test.txt

# GitHub
npm run analyze-repo --repo=https://github.com/angular/angular --output=/tmp/angular.txt

# Azure DevOps
npm run analyze-repo \
  --repo=https://dev.azure.com/gravionlabs/contexteur/_git/noesis \
  --output=/tmp/noesis.txt \
  --token=$ADO_TOKEN
```

---

## Output Format & Struktur

### llms-full.txt Struktur

```
# Repository: angular/angular
**URL:** https://github.com/angular/angular
**Last Updated:** 2026-05-14

## Overview
[README content]

## Directory Structure
```
packages/
├── core/
│   ├── src/
│   │   ├── di/ (Dependency Injection)
│   │   ├── zone/ (Zone.js)
│   │   └── ...
```

## Code Files

### packages/core/src/di/injector.ts
**Purpose:** Core dependency injection engine
**Symbols:** Injector (class), createInjector (function)

\`\`\`typescript
[code snippet or semantic summary]
\`\`\`

### [weitere Dateien...]
```

---

## Konfiguration & Flags

| Flag | Typ | Default | Beschreibung |
|------|-----|---------|-------------|
| `--repo` | string | — | Repository URL (erforderlich) |
| `--output` | string | `./llms-full.txt` | Ausgabedatei |
| `--embedding-model` | string | `bge-large-en-v1.5` | HF-Modell |
| `--max-depth` | number | `10` | Max. Verzeichnistiefe |
| `--format` | string | `full` | `full` oder `summary` |
| `--include-symbols` | boolean | `false` | Code-Symbole extrahieren |
| `--token` | string | `$GH_TOKEN` / `$ADO_TOKEN` | Auth-Token |
| `--embedder-url` | string | `http://localhost:8000` | Embedder API URL |

---

## Implementierungs-Checkliste

- [ ] **Skill Definition:** `skill.toml` erstellen
- [ ] **Skill Wrapper:** `src/skills/repo-llms-txt-generator.ts`
- [ ] **Config Extension:** `RepoAnalyzerConfig` erweitern
- [ ] **CLI Integration:** `repo-analyzer-cli.ts` anpassen
- [ ] **Error Handling:** Validierung + Fallbacks
- [ ] **Progress Reporting:** Console-Output verbessern
- [ ] **npm Scripts:** `package.json` aktualisieren
- [ ] **Unit Tests:** `test/repo-analyzer.test.ts`
- [ ] **Integration Tests:** Manuelle Tests mit realen Repos
- [ ] **Documentation:** README in `crawler/`

---

## Nächste Schritte

1. **Vor Phase 3:** Phase 2 komplett implementieren & testen
2. **Skill-Publishing:** Decision GitHub Packages vs. lokal
3. **Copilot CLI Config:** Skill in `~/.copilot/skill-config.json` registrieren
4. **Verifikation:** `copilot skill repo-llms-txt-generator --repo=... --output=...`

---

## Notizen für Fortsetzung

### Abhängigkeiten von anderen Systemen
- ✅ Phase 1 (embedder + crawler) — komplett
- 🔄 Python Embedder service läuft auf `http://localhost:8000`
- 🔄 Repository Provider (GitHub/Azure/Local) — in Phase 1 implementiert

### Bekannte Limitationen
- GitLab noch nicht unterstützt (einfach hinzufügbar)
- Großrepos (>10k Dateien) könnten langsam sein → Parallelisierung in Phase 4
- Ollama LLM-Summarization bewusst ausgelassen (HF Embeddings ausreichend)

### Architektur-Entscheidungen
- Skill als `npm run analyze-repo` vs. direkter TypeScript
  - **Gewählt:** npm script für bessere Portabilität
- Embedder als Dependency vs. HTTP-Dependency
  - **Gewählt:** HTTP für loosely-coupled Architektur (Phase 3 notwendig)
