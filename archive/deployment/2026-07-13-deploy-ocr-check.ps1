<#
.SYNOPSIS
    Deploys a private, IAM-authenticated service for Gemini OCR verification.
.DESCRIPTION
    公開デモ yorisoi-alagille へGemini Secretを接続せず、架空の検査画像だけで
    Gemini Developer APIの実OCRを確認するための限定サービスを作る。
#>

param(
    [string]$ProjectId = "yorisoi-dev-477515",
    [string]$Region = "asia-northeast1",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ServiceName = "yorisoi-alagille-ocr-check"
$RuntimeSA = "yorisoi-alagille-run@$ProjectId.iam.gserviceaccount.com"
$FirestoreDatabase = "yorisoi-alagille"
$Bucket = "$ProjectId-yorisoi-alagille-files"
$BackendPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "backend"))
$WorkspaceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\.."))
$GcloudWrapper = Join-Path $WorkspaceRoot ".codex\scripts\invoke-gcloud.ps1"

function Write-Step {
    param([string]$Message)
    Write-Host -ForegroundColor Cyan "`n=== $Message ==="
}

function Format-CommandArgument {
    param([string]$Value)
    if ($Value -match '[\s"]') {
        return '"' + ($Value -replace '"', '\"') + '"'
    }
    return $Value
}

function Invoke-GcloudChecked {
    param([Parameter(Mandatory = $true)][string[]]$CloudArgs)

    $DisplayArgs = ($CloudArgs | ForEach-Object { Format-CommandArgument $_ }) -join " "
    Write-Host "gcloud $DisplayArgs"
    if ($DryRun) { return }

    & $GcloudWrapper @CloudArgs
    if ($LASTEXITCODE -ne 0) {
        throw "gcloud command failed with exit code $LASTEXITCODE."
    }
}

Write-Step "Checking Private OCR Configuration"
if (-not (Test-Path -LiteralPath $BackendPath -PathType Container)) {
    throw "Backend directory was not found: $BackendPath"
}
if (-not (Test-Path -LiteralPath $GcloudWrapper -PathType Leaf)) {
    throw "Workspace gcloud wrapper was not found: $GcloudWrapper"
}

Write-Host "Service: $ServiceName"
Write-Host "Public access: disabled (IAM authentication required)"
Write-Host "DEMO_MODE: 1 (no Firestore/GCS record persistence)"
Write-Host "LAB_OCR_MODE: gemini"
Write-Host "Secret: DEV_GEMINI_API_KEY -> GOOGLE_GENAI_API_KEY"
Write-Host "Maximum instances: 1"
Write-Host "Allowed test data: synthetic lab report only"
Write-Host "Dry run: $DryRun"

$EnvVars = @(
    "PROJECT_ID=$ProjectId",
    "FIRESTORE_DATABASE_ID=$FirestoreDatabase",
    "GCS_BUCKET=$Bucket",
    "DEFAULT_TENANT_ID=alagille-family",
    "DEMO_MODE=1",
    "LAB_OCR_MODE=gemini",
    "GEMINI_OCR_MODEL=gemini-3.1-flash-lite",
    "GEMINI_OCR_FALLBACK_MODEL=gemini-3.5-flash"
) -join ","

$DeployArgs = @(
    "run", "deploy", $ServiceName,
    "--source", $BackendPath,
    "--project", $ProjectId,
    "--platform", "managed",
    "--region", $Region,
    "--no-allow-unauthenticated",
    "--ingress", "all",
    "--port", "8080",
    "--service-account", $RuntimeSA,
    "--memory", "1Gi",
    "--max-instances", "1",
    "--min-instances", "0",
    "--set-env-vars", $EnvVars,
    "--set-secrets", "GOOGLE_GENAI_API_KEY=DEV_GEMINI_API_KEY:latest"
)

Write-Step "Deploying Private OCR Check Service"
Invoke-GcloudChecked -CloudArgs $DeployArgs

if ($DryRun) {
    Write-Host -ForegroundColor Green "SUCCESS: Dry run completed. No GCP resources were changed."
    return
}

$DescribeArgs = @(
    "run", "services", "describe", $ServiceName,
    "--project", $ProjectId,
    "--region", $Region,
    "--format=value(status.url)"
)
$ServiceUrl = Invoke-GcloudChecked -CloudArgs $DescribeArgs
if (-not $ServiceUrl) {
    throw "Failed to retrieve private OCR service URL."
}

Write-Host -ForegroundColor Green "SUCCESS: Private OCR service deployed."
Write-Host "Service URL: $ServiceUrl"
Write-Host "Do not grant allUsers or allAuthenticatedUsers the run.invoker role."
