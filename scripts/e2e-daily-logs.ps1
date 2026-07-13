param(
    [string]$BaseUrl = "https://yorisoi-alagille-hj2kuu4pda-an.a.run.app",
    [string]$ProjectId = "yorisoi-dev-477515",
    [string]$DatabaseId = "yorisoi-alagille"
)

$ErrorActionPreference = "Stop"
$FirebaseApiKey = "AIzaSyAXaAZXL1SPv0rxtxpowlLO15CbaEoIFG0"
$WorkspaceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\..\.."))
$GcloudWrapper = Join-Path $WorkspaceRoot ".codex\scripts\invoke-gcloud.ps1"
$RunId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$Password = "E2e!$([guid]::NewGuid().ToString('N'))"
$Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$OriginHeaders = @{ Origin = $BaseUrl; "Sec-Fetch-Site" = "same-origin" }
$PhotoPath = Join-Path "C:\tmp" "alagille-daily-$RunId.png"
$VideoPath = Join-Path "C:\tmp" "alagille-daily-$RunId.mp4"
$PhotoCheckPath = Join-Path "C:\tmp" "alagille-daily-photo-$RunId.png"
$VideoRangePath = Join-Path "C:\tmp" "alagille-daily-video-range-$RunId.bin"
$Auth = $null
$FamilyId = ""
$PatientId = ""
$LogId = ""
$Succeeded = $false

function Invoke-Json {
    param([string]$Method, [string]$Uri, $Body = $null, [hashtable]$Headers = @{})
    $params = @{ Method = $Method; Uri = $Uri; Headers = $Headers; WebSession = $Session; TimeoutSec = 180 }
    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 12 -Compress
        $params.ContentType = "application/json; charset=utf-8"
        $params.Body = [System.Text.Encoding]::UTF8.GetBytes($json)
    }
    Invoke-RestMethod @params
}

function Invoke-FirebaseJson {
    param([string]$Uri, $Body)
    $temp = Join-Path "C:\tmp" "alagille-firebase-$([guid]::NewGuid().ToString('N')).json"
    try {
        [System.IO.File]::WriteAllText($temp, ($Body | ConvertTo-Json -Depth 8 -Compress), [System.Text.UTF8Encoding]::new($false))
        $output = & curl.exe --silent --show-error --max-time 30 --header "Content-Type: application/json" --data-binary "@$temp" $Uri
        if ($LASTEXITCODE -ne 0) { throw "Firebase request failed." }
        $result = $output | ConvertFrom-Json
        if ($result.error) { throw $result.error.message }
        $result
    } finally { if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force } }
}

function Invoke-Multipart {
    param([string]$Method, [string]$Uri, [hashtable]$Fields, [array]$Files = @())
    $boundary = "----Yorisoi$([guid]::NewGuid().ToString('N'))"
    $stream = New-Object System.IO.MemoryStream
    $utf8 = New-Object System.Text.UTF8Encoding($false)
    try {
        foreach ($key in $Fields.Keys) {
            $text = "--$boundary`r`nContent-Disposition: form-data; name=`"$key`"`r`n`r`n$($Fields[$key])`r`n"
            $bytes = $utf8.GetBytes($text)
            $stream.Write($bytes, 0, $bytes.Length)
        }
        foreach ($file in $Files) {
            $header = "--$boundary`r`nContent-Disposition: form-data; name=`"media`"; filename=`"$($file.Name)`"`r`nContent-Type: $($file.ContentType)`r`n`r`n"
            $headerBytes = $utf8.GetBytes($header)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $fileBytes = [System.IO.File]::ReadAllBytes($file.Path)
            $stream.Write($fileBytes, 0, $fileBytes.Length)
            $endingBytes = $utf8.GetBytes("`r`n")
            $stream.Write($endingBytes, 0, $endingBytes.Length)
        }
        $closing = $utf8.GetBytes("--$boundary--`r`n")
        $stream.Write($closing, 0, $closing.Length)
        Invoke-RestMethod -Method $Method -Uri $Uri -Headers $OriginHeaders -WebSession $Session -ContentType "multipart/form-data; boundary=$boundary" -Body $stream.ToArray() -TimeoutSec 180
    } finally { $stream.Dispose() }
}

function Remove-FirestoreDocument {
    param([string]$DocumentPath, [string]$AccessToken)
    if (-not $DocumentPath) { return }
    $uri = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/$DatabaseId/documents/$DocumentPath"
    try { Invoke-RestMethod -Method DELETE -Uri $uri -Headers @{ Authorization = "Bearer $AccessToken"; "x-goog-user-project" = $ProjectId } -TimeoutSec 30 | Out-Null }
    catch { if ([int]$_.Exception.Response.StatusCode -ne 404) { throw } }
}

try {
    Write-Output "STEP=CREATE_SYNTHETIC_MEDIA"
    $png = [Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nS0AAAAASUVORK5CYII=")
    [System.IO.File]::WriteAllBytes($PhotoPath, $png)
    $videoBytes = New-Object byte[] 4096
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    try { $rng.GetBytes($videoBytes) } finally { $rng.Dispose() }
    [System.IO.File]::WriteAllBytes($VideoPath, $videoBytes)

    Write-Output "STEP=CREATE_ACCOUNT"
    $Auth = Invoke-FirebaseJson -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$FirebaseApiKey" -Body @{ email = "alagille-daily-e2e-$RunId@example.com"; password = $Password; returnSecureToken = $true }
    Invoke-Json -Method POST -Uri "$BaseUrl/api/account/session" -Headers ($OriginHeaders + @{ Authorization = "Bearer $($Auth.idToken)" }) | Out-Null
    $bootstrap = Invoke-Json -Method POST -Uri "$BaseUrl/api/account/bootstrap" -Headers $OriginHeaders -Body @{ displayName = "E2E記録者"; relationship = "self"; patientName = "E2E対象者"; birthDate = "1990-01-01"; avatarKey = "adult-woman" }
    $FamilyId = $bootstrap.familyId
    $PatientId = $bootstrap.patientId

    Write-Output "STEP=CREATE_DAILY_LOG_WITH_MEDIA"
    $created = Invoke-Multipart -Method POST -Uri "$BaseUrl/api/daily-logs" -Fields @{
        patientId = $PatientId; occurredAt = "2026-07-13T09:30:00+09:00"; category = "itch"; title = "夜のかゆみ"; memo = "E2E架空データ"; keepMediaIds = "[]"
    } -Files @(
        @{ Path = $PhotoPath; Name = "daily-sample.png"; ContentType = "image/png" },
        @{ Path = $VideoPath; Name = "daily-sample.mp4"; ContentType = "video/mp4" }
    )
    $LogId = $created.log.id
    if (-not $LogId -or @($created.log.media).Count -ne 2) { throw "Daily log and media were not created." }
    $photo = @($created.log.media | Where-Object { $_.mediaType -eq "photo" })[0]
    $video = @($created.log.media | Where-Object { $_.mediaType -eq "video" })[0]

    Write-Output "STEP=READ_PHOTO_AND_VIDEO_RANGE"
    Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl$($photo.url)" -WebSession $Session -OutFile $PhotoCheckPath -TimeoutSec 60
    if ((Get-Item -LiteralPath $PhotoCheckPath).Length -ne $png.Length) { throw "Photo media could not be read." }
    $rangeRequest = [System.Net.HttpWebRequest]::Create("$BaseUrl$($video.url)")
    $rangeRequest.CookieContainer = $Session.Cookies
    $rangeRequest.AddRange(0, 99)
    $rangeResponse = $rangeRequest.GetResponse()
    try {
        if ([int]$rangeResponse.StatusCode -ne 206) { throw "Video range response did not return 206." }
        $input = $rangeResponse.GetResponseStream()
        $output = [System.IO.File]::Create($VideoRangePath)
        try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
    } finally { $rangeResponse.Dispose() }
    if ((Get-Item -LiteralPath $VideoRangePath).Length -ne 100) { throw "Video range response was invalid." }

    Write-Output "STEP=EDIT_AND_REMOVE_VIDEO"
    $edited = Invoke-Multipart -Method PATCH -Uri "$BaseUrl/api/daily-logs/$LogId" -Fields @{
        patientId = $PatientId; occurredAt = "2026-07-13T10:00:00+09:00"; category = "skin"; title = "皮膚の様子"; memo = "編集確認済み"; keepMediaIds = "[`"$($photo.id)`"]"
    }
    if ($edited.log.memo -ne "編集確認済み" -or @($edited.log.media).Count -ne 1 -or $edited.log.media[0].mediaType -ne "photo") { throw "Daily log edit or media removal failed." }
    $list = Invoke-Json -Method GET -Uri "$BaseUrl/api/daily-logs?patientId=$PatientId"
    if (@($list.logs).Count -ne 1 -or $list.logs[0].category -ne "skin") { throw "Daily log list did not reflect the edit." }

    Write-Output "STEP=DELETE_DAILY_LOG"
    Invoke-Json -Method DELETE -Uri "$BaseUrl/api/daily-logs/$LogId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null
    $LogId = ""
    $afterDelete = Invoke-Json -Method GET -Uri "$BaseUrl/api/daily-logs?patientId=$PatientId"
    if (@($afterDelete.logs).Count -ne 0) { throw "Daily log remained after deletion." }

    $Succeeded = $true
    [pscustomobject]@{
        AccountBoundary = "passed"
        FirestoreCrud = "passed"
        PhotoGcsRead = "passed"
        VideoRangeRead = "passed"
        MediaRemoval = "passed"
        DeleteCleanup = "passed"
    } | ConvertTo-Json -Compress
} finally {
    if ($LogId -and $PatientId) {
        try { Invoke-Json -Method DELETE -Uri "$BaseUrl/api/daily-logs/$LogId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null } catch { Write-Warning "Daily log cleanup failed: $($_.Exception.Message)" }
    }
    if ($FamilyId) {
        try {
            $token = (& $GcloudWrapper auth print-access-token --quiet | Select-Object -Last 1).Trim()
            if ($PatientId) { Remove-FirestoreDocument -DocumentPath "families/$FamilyId/patients/$PatientId" -AccessToken $token }
            if ($Auth.localId) { Remove-FirestoreDocument -DocumentPath "families/$FamilyId/members/$($Auth.localId)" -AccessToken $token }
            Remove-FirestoreDocument -DocumentPath "families/$FamilyId" -AccessToken $token
            if ($Auth.localId) { Remove-FirestoreDocument -DocumentPath "users/$($Auth.localId)" -AccessToken $token }
        } catch { Write-Warning "Firestore cleanup failed: $($_.Exception.Message)" }
    }
    if ($Auth.idToken) { try { Invoke-FirebaseJson -Uri "https://identitytoolkit.googleapis.com/v1/accounts:delete?key=$FirebaseApiKey" -Body @{ idToken = $Auth.idToken } | Out-Null } catch { Write-Warning "Firebase user cleanup failed." } }
    foreach ($file in @($PhotoPath,$VideoPath,$PhotoCheckPath,$VideoRangePath)) { if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force } }
    if ($Succeeded) { Write-Output "E2E_CLEANUP=COMPLETED" }
}
