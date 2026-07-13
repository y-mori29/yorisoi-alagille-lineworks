param(
    [string]$BaseUrl = "https://yorisoi-alagille-hj2kuu4pda-an.a.run.app",
    [string]$ProjectId = "yorisoi-dev-477515",
    [string]$DatabaseId = "yorisoi-alagille"
)

$ErrorActionPreference = "Stop"

$FirebaseApiKey = "AIzaSyAXaAZXL1SPv0rxtxpowlLO15CbaEoIFG0"
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$SampleImage = Join-Path $RepoRoot "backend\public\assets\alagille-brand\generated\lab-report-tutorial-sample-v3.png"
$WorkspaceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\..\.."))
$GcloudWrapper = Join-Path $WorkspaceRoot ".codex\scripts\invoke-gcloud.ps1"
$RunId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$Password = "E2e!$([guid]::NewGuid().ToString('N'))"
$OriginHeaders = @{ Origin = $BaseUrl; "Sec-Fetch-Site" = "same-origin" }

$primaryAuth = $null
$secondaryAuth = $null
$primarySession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$secondarySession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$familyId = ""
$patientId = ""
$labId = ""
$medicationId = ""
$invitationToken = ""
$testSucceeded = $false

function Invoke-Json {
    param(
        [string]$Method,
        [string]$Uri,
        $Body = $null,
        $Session = $null,
        [hashtable]$Headers = @{}
    )

    $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; TimeoutSec = 180 }
    if ($Session) { $params.WebSession = $Session }
    if ($null -ne $Body) {
        $params.ContentType = "application/json"
        $params.Body = ($Body | ConvertTo-Json -Depth 12 -Compress)
    }
    return Invoke-RestMethod @params
}

function Invoke-FirebaseJson {
    param([string]$Uri, $Body)
    $tempFile = Join-Path "C:\tmp" "yorisoi-firebase-$([guid]::NewGuid().ToString('N')).json"
    try {
        $json = $Body | ConvertTo-Json -Depth 8 -Compress
        [System.IO.File]::WriteAllText($tempFile, $json, [System.Text.UTF8Encoding]::new($false))
        $output = & curl.exe --silent --show-error --max-time 30 --header "Content-Type: application/json" --data-binary "@$tempFile" $Uri
        if ($LASTEXITCODE -ne 0) { throw "Firebase HTTP request failed with exit code $LASTEXITCODE." }
        $result = $output | ConvertFrom-Json
        if ($result.error) { throw "Firebase request failed: $($result.error.message)" }
        return $result
    } finally {
        if (Test-Path -LiteralPath $tempFile) { Remove-Item -LiteralPath $tempFile -Force }
    }
}

function New-FirebaseUser {
    param([string]$Email)
    return Invoke-FirebaseJson -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$FirebaseApiKey" -Body @{
        email = $Email
        password = $Password
        returnSecureToken = $true
    }
}

function New-AppSession {
    param($AuthResult, $Session)
    Invoke-Json -Method POST -Uri "$BaseUrl/api/account/session" -Session $Session -Headers ($OriginHeaders + @{ Authorization = "Bearer $($AuthResult.idToken)" }) | Out-Null
}

function Remove-FirestoreDocument {
    param([string]$DocumentPath, [string]$AccessToken)
    if (-not $DocumentPath) { return }
    $uri = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/$DatabaseId/documents/$DocumentPath"
    try {
        Invoke-RestMethod -Method DELETE -Uri $uri -Headers @{ Authorization = "Bearer $AccessToken"; "x-goog-user-project" = $ProjectId } -TimeoutSec 30 | Out-Null
    } catch {
        if ([int]$_.Exception.Response.StatusCode -ne 404) { throw }
    }
}

function Remove-FirebaseUser {
    param($AuthResult)
    if (-not $AuthResult.idToken) { return }
    try {
        Invoke-FirebaseJson -Uri "https://identitytoolkit.googleapis.com/v1/accounts:delete?key=$FirebaseApiKey" -Body @{ idToken = $AuthResult.idToken } | Out-Null
    } catch {
        Write-Warning "Temporary Firebase user cleanup failed."
    }
}

if (-not (Test-Path -LiteralPath $SampleImage -PathType Leaf)) {
    throw "Synthetic OCR sample was not found: $SampleImage"
}

try {
    Write-Output "STEP=CREATE_PRIMARY_ACCOUNT"
    $primaryAuth = New-FirebaseUser -Email "alagille-e2e-owner-$RunId@example.com"
    Write-Output "STEP=CREATE_PRIMARY_SESSION"
    New-AppSession -AuthResult $primaryAuth -Session $primarySession

    Write-Output "STEP=BOOTSTRAP_FAMILY"
    $bootstrap = Invoke-Json -Method POST -Uri "$BaseUrl/api/account/bootstrap" -Session $primarySession -Headers $OriginHeaders -Body @{
        displayName = "E2E保護者"
        relationship = "mother"
        patientName = "E2E記録対象者"
        birthDate = "2020-04-10"
        avatarKey = "child-boy"
    }
    $familyId = $bootstrap.familyId
    $patientId = $bootstrap.patientId
    if (-not $familyId -or -not $patientId) { throw "Account bootstrap did not return family and patient IDs." }

    $bytes = [System.IO.File]::ReadAllBytes($SampleImage)
    $photoDataUrl = "data:image/png;base64,$([Convert]::ToBase64String($bytes))"
    Write-Output "STEP=GEMINI_OCR"
    $ocr = Invoke-Json -Method POST -Uri "$BaseUrl/api/labs/ocr" -Session $primarySession -Headers $OriginHeaders -Body @{
        patientId = $patientId
        photoDataUrl = $photoDataUrl
        testDate = "2026-07-12"
    }
    if ($ocr.mode -ne "gemini" -or @($ocr.values).Count -lt 3) {
        throw "Gemini OCR did not return the expected structured values."
    }

    Write-Output "STEP=SAVE_LAB_AND_PHOTO"
    $savedLab = Invoke-Json -Method POST -Uri "$BaseUrl/api/labs" -Session $primarySession -Headers $OriginHeaders -Body @{
        patientId = $patientId
        testDate = $(if ($ocr.testDate) { $ocr.testDate } else { "2026-07-12" })
        category = "blood"
        photoDataUrl = $photoDataUrl
        photoName = "synthetic-e2e-lab-report.png"
        hospitalName = $ocr.hospitalName
        department = $ocr.department
        values = $ocr.values
    }
    $labId = $savedLab.record.id
    if (-not $labId -or -not $savedLab.record.photoObject) { throw "Lab record or GCS photo object was not saved." }

    Write-Output "STEP=SAVE_MEDICATION"
    $savedMedication = Invoke-Json -Method POST -Uri "$BaseUrl/api/medications" -Session $primarySession -Headers $OriginHeaders -Body @{
        patientId = $patientId
        name = "E2E確認用のお薬"
        dosageText = "テストデータ"
        status = "active"
    }
    $medicationId = $savedMedication.medication.id

    Write-Output "STEP=CREATE_INVITATION"
    $invitation = Invoke-Json -Method POST -Uri "$BaseUrl/api/family/invitations" -Session $primarySession -Headers $OriginHeaders -Body @{ role = "viewer" }
    $invitationToken = $invitation.invitation.token
    if (-not $invitationToken) { throw "Family invitation was not created." }

    Write-Output "STEP=CREATE_SECONDARY_ACCOUNT"
    $secondaryAuth = New-FirebaseUser -Email "alagille-e2e-viewer-$RunId@example.com"
    New-AppSession -AuthResult $secondaryAuth -Session $secondarySession
    Invoke-Json -Method POST -Uri "$BaseUrl/api/family/invitations/$invitationToken/accept" -Session $secondarySession -Headers $OriginHeaders -Body @{
        displayName = "E2E共有家族"
        relationship = "father"
    } | Out-Null

    $sharedLabs = Invoke-Json -Method GET -Uri "$BaseUrl/api/labs?patientId=$patientId" -Session $secondarySession
    if (@($sharedLabs.records | Where-Object { $_.id -eq $labId }).Count -ne 1) {
        throw "The invited family account could not read the shared lab record."
    }

    $testSucceeded = $true
    [pscustomobject]@{
        AccountRegistration = "passed"
        FamilyInvitation = "passed"
        GeminiOcr = "passed"
        OcrModel = $ocr.model
        OcrValueCount = @($ocr.values).Count
        FirestoreLabSave = "passed"
        GcsPhotoSave = "passed"
        SharedFamilyRead = "passed"
    } | ConvertTo-Json -Compress
} finally {
    if ($labId) {
        try { Invoke-Json -Method DELETE -Uri "$BaseUrl/api/labs/$labId`?patientId=$patientId" -Session $primarySession -Headers $OriginHeaders | Out-Null } catch { Write-Warning "Temporary lab cleanup failed." }
    }
    if ($medicationId) {
        try { Invoke-Json -Method DELETE -Uri "$BaseUrl/api/medications/$medicationId`?patientId=$patientId" -Session $primarySession -Headers $OriginHeaders | Out-Null } catch { Write-Warning "Temporary medication cleanup failed." }
    }

    if ($familyId) {
        try {
            $accessToken = (& $GcloudWrapper auth print-access-token --quiet | Select-Object -Last 1).Trim()
            if ($invitationToken) { Remove-FirestoreDocument -DocumentPath "familyInvitations/$invitationToken" -AccessToken $accessToken }
            if ($patientId) { Remove-FirestoreDocument -DocumentPath "families/$familyId/patients/$patientId" -AccessToken $accessToken }
            if ($secondaryAuth.localId) { Remove-FirestoreDocument -DocumentPath "families/$familyId/members/$($secondaryAuth.localId)" -AccessToken $accessToken }
            if ($primaryAuth.localId) { Remove-FirestoreDocument -DocumentPath "families/$familyId/members/$($primaryAuth.localId)" -AccessToken $accessToken }
            Remove-FirestoreDocument -DocumentPath "families/$familyId" -AccessToken $accessToken
            if ($secondaryAuth.localId) { Remove-FirestoreDocument -DocumentPath "users/$($secondaryAuth.localId)" -AccessToken $accessToken }
            if ($primaryAuth.localId) { Remove-FirestoreDocument -DocumentPath "users/$($primaryAuth.localId)" -AccessToken $accessToken }
        } catch {
            Write-Warning "Temporary Firestore cleanup failed: $($_.Exception.Message)"
        }
    }

    Remove-FirebaseUser -AuthResult $secondaryAuth
    Remove-FirebaseUser -AuthResult $primaryAuth
    if ($testSucceeded) { Write-Output "E2E_CLEANUP=COMPLETED" }
}
