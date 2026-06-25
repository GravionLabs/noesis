[CmdletBinding()]
param(
    [switch]$EnsureMigrations
)

$ErrorActionPreference = 'Stop'

$ApiBaseUrl = if ($env:API_BASE_URL) { $env:API_BASE_URL } else { 'http://localhost:5000' }
$SourceName = if ($env:SOURCE_NAME) { $env:SOURCE_NAME } else { 'Angular' }
$SourceUrl = if ($env:SOURCE_URL) { $env:SOURCE_URL } else { 'https://next.angular.dev/assets/context/llms-full.txt' }
$ImporterType = 'llmstxt'
$PollIntervalSeconds = if ($env:POLL_INTERVAL_SECONDS) { [int]$env:POLL_INTERVAL_SECONDS } else { 2 }
$PollTimeoutSeconds = if ($env:POLL_TIMEOUT_SECONDS) { [int]$env:POLL_TIMEOUT_SECONDS } else { 1800 }

$RepoRoot = Split-Path -Parent $PSScriptRoot
$ComposeFile = Join-Path $RepoRoot 'infra/docker-compose.yml'

function Invoke-Api {
    param(
        [Parameter(Mandatory = $true)][ValidateSet('GET', 'POST')] [string]$Method,
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $false)]$Body
    )

    try {
        if ($null -ne $Body) {
            return Invoke-RestMethod -Method $Method -Uri $Url -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Compress)
        }

        return Invoke-RestMethod -Method $Method -Uri $Url
    }
    catch {
        throw "API error at $Method $Url: $($_.Exception.Message)"
    }
}

function Ensure-Migrations {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "docker is not installed. --EnsureMigrations cannot be used."
    }

    if (-not (Test-Path $ComposeFile)) {
        throw "Compose file not found: $ComposeFile"
    }

    Write-Host "Running optional DB migrations (ef-migrate) ..."

    & docker compose -f $ComposeFile build ef-migrate
    if ($LASTEXITCODE -ne 0) { throw "docker compose build ef-migrate failed." }

    & docker compose -f $ComposeFile up -d postgres
    if ($LASTEXITCODE -ne 0) { throw "docker compose up -d postgres failed." }

    & docker compose -f $ComposeFile run --rm ef-migrate --migrate
    if ($LASTEXITCODE -ne 0) { throw "docker compose run ef-migrate --migrate failed." }
}

Write-Host "Checking server: $ApiBaseUrl/healthz/ready"
[void](Invoke-Api -Method GET -Url "$ApiBaseUrl/healthz/ready")

if ($EnsureMigrations.IsPresent) {
    Ensure-Migrations
}

Write-Host "Looking for existing Angular source ..."
$sources = @(Invoke-Api -Method GET -Url "$ApiBaseUrl/api/sources")
$source = $sources | Where-Object { $_.url -eq $SourceUrl -and $_.importerType -eq $ImporterType } | Select-Object -First 1

if ($null -eq $source) {
    Write-Host "Source not found. Creating new source ..."
    $source = Invoke-Api -Method POST -Url "$ApiBaseUrl/api/sources" -Body @{
        name = $SourceName
        url = $SourceUrl
        importerType = $ImporterType
    }
}
else {
    Write-Host "Existing source found: $($source.id)"
}

if ([string]::IsNullOrWhiteSpace($source.id)) {
    throw "Could not read source ID from response."
}

Write-Host "Triggering import for source $($source.id) ..."
$trigger = Invoke-Api -Method POST -Url "$ApiBaseUrl/api/sources/$($source.id)/import"
$jobId = "$($trigger.jobId)"

if ([string]::IsNullOrWhiteSpace($jobId)) {
    throw "Could not read job ID from response."
}

Write-Host "Import started. Job ID: $jobId"
Write-Host "Waiting for completion (timeout: $PollTimeoutSeconds s, interval: $PollIntervalSeconds s) ..."

$started = Get-Date
while ($true) {
    $job = Invoke-Api -Method GET -Url "$ApiBaseUrl/api/jobs/$jobId"
    $status = "$($job.status)"
    $errorText = "$($job.error)"

    switch ($status) {
        'done' {
            Write-Host "Import completed successfully (status: done)."
            break
        }
        'failed' {
            throw "Import failed (status: failed). $errorText"
        }
        'error' {
            throw "Import failed (status: error). $errorText"
        }
        'pending' { Write-Host "Current status: pending" }
        'running' { Write-Host "Current status: running" }
        'embedding' { Write-Host "Current status: embedding" }
        default { Write-Host "WARN: Unexpected job status: $status" }
    }

    if ((New-TimeSpan -Start $started -End (Get-Date)).TotalSeconds -ge $PollTimeoutSeconds) {
        throw "Timeout reached, last status: $status (jobId: $jobId)."
    }

    Start-Sleep -Seconds $PollIntervalSeconds
}

Write-Host "Done. Source ID: $($source.id) | Job ID: $jobId"
