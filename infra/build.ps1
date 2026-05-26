[CmdletBinding()]
param(
    [switch]$EfMigrate,
    [switch]$All,
    [switch]$NoCache,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'

function Show-Usage {
    @'
Usage: ./infra/build.ps1 [-EfMigrate | -All] [-NoCache] [-Help]

Options:
  -EfMigrate  Build only ef-migrate image (default)
  -All        Build ef-migrate, crawler, and embedder images
  -NoCache    Build images without Docker layer cache
  -Help       Show this help text
'@ | Write-Host
}

if ($Help.IsPresent) {
    Show-Usage
    exit 0
}

if ($EfMigrate.IsPresent -and $All.IsPresent) {
    throw 'Use either -EfMigrate or -All, not both.'
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$composeFile = Join-Path $scriptDir 'docker-compose.yml'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'docker CLI not found. Install Docker Desktop or Docker Engine first.'
}

& docker compose version | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw 'docker compose is not available. Install Docker Compose plugin.'
}

$services = @('ef-migrate')
if ($All.IsPresent) {
    $services += @('crawler', 'embedder')
}

$args = @('compose', '-f', $composeFile, 'build')
if ($NoCache.IsPresent) {
    $args += '--no-cache'
}
$args += $services

Write-Host "Building Docker images from $composeFile ..."
Write-Host "Target services: $($services -join ', ')"

& docker @args
if ($LASTEXITCODE -ne 0) {
    throw 'Build failed.'
}

Write-Host 'Build complete.'
