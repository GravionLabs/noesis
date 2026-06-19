param()

$ErrorActionPreference = "Stop"
$RepoDir = Split-Path -Parent $PSScriptRoot

Write-Host "==> Starting test database..."
docker compose -f "$RepoDir/infra/docker-compose.yml" up -d postgres

Write-Host "==> Waiting for Postgres..."
Start-Sleep -Seconds 3

Write-Host "==> Running database migrations..."
Set-Location $RepoDir
pnpm db:migrate

Write-Host "==> Running tests..."
pnpm test
