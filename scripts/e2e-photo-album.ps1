param(
    [string]$BaseUrl = "https://yorisoi-alagille-hj2kuu4pda-an.a.run.app",
    [string]$ProjectId = "yorisoi-dev-477515",
    [string]$DatabaseId = "yorisoi-alagille"
)

$ErrorActionPreference = "Stop"
$FirebaseApiKey = "AIzaSyAXaAZXL1SPv0rxtxpowlLO15CbaEoIFG0"
$WorkspaceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\..\.."))
$GcloudWrapper = Join-Path $WorkspaceRoot ".codex\scripts\invoke-gcloud.ps1"
$RunId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$Password = "E2e!$([guid]::NewGuid().ToString('N'))"
$Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$OriginHeaders = @{ Origin = $BaseUrl; "Sec-Fetch-Site" = "same-origin" }
$PhotoPath = Join-Path "C:\tmp" "alagille-album-$RunId.png"
$PhotoChecks = @()
$Auth = $null
$FamilyId = ""
$PatientId = ""
$LabId = ""
$MedicationId = ""
$DailyLogId = ""
$Succeeded = $false

function Invoke-Json {
    param([string]$Method, [string]$Uri, $Body = $null, [hashtable]$Headers = @{})
    $params = @{ Method=$Method; Uri=$Uri; Headers=$Headers; WebSession=$Session; TimeoutSec=180 }
    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 15 -Compress
        $params.ContentType = "application/json; charset=utf-8"
        $params.Body = [Text.Encoding]::UTF8.GetBytes($json)
    }
    Invoke-RestMethod @params
}

function Invoke-FirebaseJson {
    param([string]$Uri, $Body)
    $temp = Join-Path "C:\tmp" "alagille-firebase-$([guid]::NewGuid().ToString('N')).json"
    try {
        [IO.File]::WriteAllText($temp, ($Body | ConvertTo-Json -Depth 8 -Compress), [Text.UTF8Encoding]::new($false))
        $output = & curl.exe --silent --show-error --max-time 30 --header "Content-Type: application/json" --data-binary "@$temp" $Uri
        if ($LASTEXITCODE -ne 0) { throw "Firebase request failed." }
        $result = $output | ConvertFrom-Json
        if ($result.error) { throw $result.error.message }
        $result
    } finally { if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force } }
}

function Invoke-MultipartPhoto {
    param([string]$Uri, [hashtable]$Fields, [string]$Path)
    $boundary = "----Yorisoi$([guid]::NewGuid().ToString('N'))"
    $stream = New-Object IO.MemoryStream
    $utf8 = New-Object Text.UTF8Encoding($false)
    try {
        foreach ($key in $Fields.Keys) {
            $bytes = $utf8.GetBytes("--$boundary`r`nContent-Disposition: form-data; name=`"$key`"`r`n`r`n$($Fields[$key])`r`n")
            $stream.Write($bytes, 0, $bytes.Length)
        }
        $header = $utf8.GetBytes("--$boundary`r`nContent-Disposition: form-data; name=`"media`"; filename=`"album-sample.png`"`r`nContent-Type: image/png`r`n`r`n")
        $stream.Write($header, 0, $header.Length)
        $fileBytes = [IO.File]::ReadAllBytes($Path)
        $stream.Write($fileBytes, 0, $fileBytes.Length)
        $ending = $utf8.GetBytes("`r`n--$boundary--`r`n")
        $stream.Write($ending, 0, $ending.Length)
        Invoke-RestMethod -Method POST -Uri $Uri -Headers $OriginHeaders -WebSession $Session -ContentType "multipart/form-data; boundary=$boundary" -Body $stream.ToArray() -TimeoutSec 180
    } finally { $stream.Dispose() }
}

function Remove-FirestoreDocument {
    param([string]$DocumentPath, [string]$AccessToken)
    if (-not $DocumentPath) { return }
    $uri = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/$DatabaseId/documents/$DocumentPath"
    try { Invoke-RestMethod -Method DELETE -Uri $uri -Headers @{ Authorization="Bearer $AccessToken"; "x-goog-user-project"=$ProjectId } -TimeoutSec 30 | Out-Null }
    catch { if ([int]$_.Exception.Response.StatusCode -ne 404) { throw } }
}

try {
    Write-Output "STEP=CREATE_SYNTHETIC_PHOTO"
    $png = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nS0AAAAASUVORK5CYII=")
    [IO.File]::WriteAllBytes($PhotoPath, $png)
    $photoDataUrl = "data:image/png;base64,$([Convert]::ToBase64String($png))"

    Write-Output "STEP=CREATE_ACCOUNT"
    $Auth = Invoke-FirebaseJson -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$FirebaseApiKey" -Body @{ email="alagille-album-e2e-$RunId@example.com"; password=$Password; returnSecureToken=$true }
    Invoke-Json -Method POST -Uri "$BaseUrl/api/account/session" -Headers ($OriginHeaders + @{ Authorization="Bearer $($Auth.idToken)" }) | Out-Null
    $bootstrap = Invoke-Json -Method POST -Uri "$BaseUrl/api/account/bootstrap" -Headers $OriginHeaders -Body @{ displayName="E2E記録者"; relationship="self"; patientName="E2E対象者"; birthDate="1990-01-01"; avatarKey="adult-woman" }
    $FamilyId = $bootstrap.familyId
    $PatientId = $bootstrap.patientId
    $today = [DateTimeOffset]::UtcNow.ToString("yyyy-MM-dd")

    Write-Output "STEP=CREATE_THREE_PHOTO_SOURCES"
    $lab = Invoke-Json -Method POST -Uri "$BaseUrl/api/labs" -Headers $OriginHeaders -Body @{ patientId=$PatientId; testDate=$today; hospitalName="E2E病院"; category="blood"; photoDataUrl=$photoDataUrl; values=@(@{name="ALT";value="58";unit="U/L";referenceRange="9〜30";flag="H"}) }
    $LabId = $lab.record.id
    $medication = Invoke-Json -Method POST -Uri "$BaseUrl/api/medications" -Headers $OriginHeaders -Body @{ patientId=$PatientId; name="E2Eお薬"; dosageText="1日2回"; timingText="朝・夕"; status="active"; startedAt=$today; memo="架空"; photoDataUrl=$photoDataUrl }
    $MedicationId = $medication.medication.id
    $daily = Invoke-MultipartPhoto -Uri "$BaseUrl/api/daily-logs" -Fields @{ patientId=$PatientId; occurredAt=[DateTimeOffset]::UtcNow.ToString("o"); category="meal"; title="E2Eの食事"; memo="架空"; keepMediaIds="[]" } -Path $PhotoPath
    $DailyLogId = $daily.log.id

    Write-Output "STEP=VERIFY_CROSS_SOURCE_ALBUM"
    $album = Invoke-Json -Method GET -Uri "$BaseUrl/api/photos?patientId=$PatientId"
    if (@($album.items).Count -ne 3) { throw "Photo album did not return all three photos." }
    $categories = @($album.items.category)
    foreach ($required in @("lab","medication","meal")) { if ($categories -notcontains $required) { throw "Photo album missing category: $required" } }
    if (($album.items | ConvertTo-Json -Depth 8) -match "storagePath|photoObject|internal/") { throw "Photo album exposed an internal storage path." }
    $index = 0
    foreach ($item in $album.items) {
        $check = Join-Path "C:\tmp" "alagille-album-check-$RunId-$index.png"
        $PhotoChecks += $check
        Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl$($item.url)" -WebSession $Session -OutFile $check -TimeoutSec 60
        if ((Get-Item -LiteralPath $check).Length -ne $png.Length) { throw "Album photo could not be read: $($item.category)" }
        $index++
    }

    Write-Output "STEP=DELETE_SOURCE_RECORDS"
    Invoke-Json -Method DELETE -Uri "$BaseUrl/api/daily-logs/$DailyLogId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null; $DailyLogId=""
    Invoke-Json -Method DELETE -Uri "$BaseUrl/api/medications/$MedicationId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null; $MedicationId=""
    Invoke-Json -Method DELETE -Uri "$BaseUrl/api/labs/$LabId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null; $LabId=""
    $after = Invoke-Json -Method GET -Uri "$BaseUrl/api/photos?patientId=$PatientId"
    if (@($after.items).Count -ne 0) { throw "Photo album items remained after source deletion." }

    $Succeeded = $true
    [pscustomobject]@{ AccountBoundary="passed"; LabPhoto="passed"; MedicationPhoto="passed"; DailyPhoto="passed"; CrossSourceAlbum="passed"; InternalPathsHidden="passed"; Cleanup="passed" } | ConvertTo-Json -Compress
} finally {
    if ($DailyLogId -and $PatientId) { try { Invoke-Json -Method DELETE -Uri "$BaseUrl/api/daily-logs/$DailyLogId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null } catch { Write-Warning "Daily log cleanup failed." } }
    if ($MedicationId -and $PatientId) { try { Invoke-Json -Method DELETE -Uri "$BaseUrl/api/medications/$MedicationId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null } catch { Write-Warning "Medication cleanup failed." } }
    if ($LabId -and $PatientId) { try { Invoke-Json -Method DELETE -Uri "$BaseUrl/api/labs/$LabId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null } catch { Write-Warning "Lab cleanup failed." } }
    if ($FamilyId) {
        try {
            $token = (& $GcloudWrapper auth print-access-token --quiet | Select-Object -Last 1).Trim()
            if ($PatientId) { Remove-FirestoreDocument "families/$FamilyId/patients/$PatientId" $token }
            if ($Auth.localId) { Remove-FirestoreDocument "families/$FamilyId/members/$($Auth.localId)" $token }
            Remove-FirestoreDocument "families/$FamilyId" $token
            if ($Auth.localId) { Remove-FirestoreDocument "users/$($Auth.localId)" $token }
        } catch { Write-Warning "Firestore cleanup failed." }
    }
    if ($Auth.idToken) { try { Invoke-FirebaseJson -Uri "https://identitytoolkit.googleapis.com/v1/accounts:delete?key=$FirebaseApiKey" -Body @{ idToken=$Auth.idToken } | Out-Null } catch { Write-Warning "Firebase user cleanup failed." } }
    foreach ($file in @($PhotoPath) + $PhotoChecks) { if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force } }
    if ($Succeeded) { Write-Output "E2E_CLEANUP=COMPLETED" }
}
