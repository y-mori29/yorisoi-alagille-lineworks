<#
.SYNOPSIS
    Deploys the Yorisoi Alagille backend to Google Cloud Run.
.DESCRIPTION
    アラジール症候群版よりそい専用デプロイスクリプト。
    - サービス名は yorisoi-alagille 固定（3ボタンLINE版・薬局版を上書きしない）
    - backend は専用ランタイムSA yorisoi-alagille-run で動かす
    - OCRはVertex AIではなくGemini Developer APIを利用する
    - finalize 後のSTT/Gemini処理がレスポンス返却後も走るため --no-cpu-throttling 必須
#>

param(
    [ValidateSet("backend")]
    [string]$Target = "backend",

    [string]$ProjectId = "yorisoi-dev-477515",
    [string]$Region = "asia-northeast1",

    [ValidateSet("alagille")]
    [string]$Environment = "alagille",

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$ServiceName = "yorisoi-alagille"
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

function Write-Success {
    param([string]$Message)
    Write-Host -ForegroundColor Green "SUCCESS: $Message"
}

function Format-CommandArgument {
    param([string]$Value)

    if ($Value -match '[\s"]') {
        return '"' + ($Value -replace '"', '\"') + '"'
    }
    return $Value
}

function Invoke-GcloudChecked {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$CloudArgs
    )

    $DisplayArgs = ($CloudArgs | ForEach-Object { Format-CommandArgument $_ }) -join " "
    Write-Host "gcloud $DisplayArgs"

    if ($DryRun) {
        return
    }

    & $GcloudWrapper @CloudArgs
    $ExitCode = $LASTEXITCODE
    if ($ExitCode -ne 0) {
        throw "gcloud command failed with exit code $ExitCode."
    }
}

Write-Step "Checking Configuration"
if (-not (Test-Path -LiteralPath $BackendPath -PathType Container)) {
    throw "Backend directory was not found: $BackendPath"
}
if (-not (Test-Path -LiteralPath $GcloudWrapper -PathType Leaf)) {
    throw "Workspace gcloud wrapper was not found: $GcloudWrapper"
}

Write-Host "Target: $Target"
Write-Host "Project: $ProjectId"
Write-Host "Region: $Region"
Write-Host "Runtime SA: $RuntimeSA"
Write-Host "Service: $ServiceName"
Write-Host "Source: $BackendPath"
Write-Host "Firestore database: $FirestoreDatabase"
Write-Host "GCS bucket: $Bucket"
Write-Host "DEMO_MODE: 0"
Write-Host "AUTH_REQUIRED: 1"
Write-Host "ALAGILLE_API_MODE: 1"
Write-Host "LAB_OCR_MODE: gemini"
Write-Host "Secret mount: DEV_GEMINI_API_KEY -> GOOGLE_GENAI_API_KEY"
Write-Host "Maximum instances: 1"
Write-Host "Cloud Run ingress: public; personal APIs require Firebase Authentication"
Write-Host "Dry run: $DryRun"

Write-Step "Deploying Backend ($ServiceName)"
Write-Warning "Personal APIs require a valid Firebase session and active family membership."
$EnvVars = @(
    "PROJECT_ID=$ProjectId",
    "FIRESTORE_DATABASE_ID=$FirestoreDatabase",
    "GCS_BUCKET=$Bucket",
    "DEFAULT_TENANT_ID=alagille-family",
    "DEMO_MODE=0",
    "AUTH_REQUIRED=1",
    "ALAGILLE_API_MODE=1",
    "NODE_ENV=production",
    "LAB_OCR_MODE=gemini",
    "OCR_PER_ACCOUNT_LIMIT=8",
    "OCR_DAILY_LIMIT=100",
    "OCR_CONCURRENCY_LIMIT=2",
    "GEMINI_OCR_MODEL=gemini-3.1-flash-lite",
    "GEMINI_OCR_FALLBACK_MODEL=gemini-3.5-flash",
    "STT_LOCATION=asia-northeast1",
    "STT_MODEL=long"
) -join ","
$DeployArgs = @(
    "run", "deploy", $ServiceName,
    "--source", $BackendPath,
    "--project", $ProjectId,
    "--platform", "managed",
    "--region", $Region,
    "--allow-unauthenticated",
    "--port", "8080",
    "--service-account", $RuntimeSA,
    "--memory", "1Gi",
    "--no-cpu-throttling",
    "--max-instances", "1",
    "--set-env-vars", $EnvVars,
    "--set-secrets", "GOOGLE_GENAI_API_KEY=DEV_GEMINI_API_KEY:latest"
)
Invoke-GcloudChecked -CloudArgs $DeployArgs

if ($DryRun) {
    Write-Success "Dry run completed. No Cloud Run resources were changed."
    return
}

Write-Success "Backend Deployed"

Write-Step "Retrieving Backend URL"
$DescribeArgs = @(
    "run", "services", "describe", $ServiceName,
    "--project", $ProjectId,
    "--platform", "managed",
    "--region", $Region,
    "--format=value(status.url)"
)
$BackendUrl = Invoke-GcloudChecked -CloudArgs $DescribeArgs
if (-not $BackendUrl) {
    throw "Failed to retrieve Backend URL. Is $ServiceName deployed?"
}

Write-Step "Deployment Complete"
Write-Host "Backend: $BackendUrl"
Write-Host "Patient entry: $BackendUrl/?disease=alagille"
