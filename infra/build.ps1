[CmdletBinding()]
param(
    [switch]$NoCache,
    [switch]$Help
)

$ErrorActionPreference = 'Stop'

# The only buildable service in docker-compose.yml is `server`.
# Other services (postgres, seq) use prebuilt images.
$services = @('server')

function Show-Usage {
    @'
Usage: ./infra/build.ps1 [-NoCache] [-Help]

Builds the `server` Docker image from infra/docker-compose.yml.

Options:
  -NoCache    Build images without Docker layer cache
  -Help       Show this help text
'@ | Write-Host
}

if ($Help.IsPresent) {
    Show-Usage
    exit 0
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
