param(
    [string]$BaseUrl = "https://yorisoi-alagille-hj2kuu4pda-an.a.run.app",
    [string]$ProjectId = "yorisoi-dev-477515",
    [string]$DatabaseId = "yorisoi-alagille"
)

$ErrorActionPreference = "Stop"
$FirebaseApiKey = "AIzaSyAXaAZXL1SPv0rxtxpowlLO15CbaEoIFG0"
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$WorkspaceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\..\..\.."))
$GcloudWrapper = Join-Path $WorkspaceRoot ".codex\scripts\invoke-gcloud.ps1"
$RunId = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$Password = "E2e!$([guid]::NewGuid().ToString('N'))"
$Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$OriginHeaders = @{ Origin = $BaseUrl; "Sec-Fetch-Site" = "same-origin" }
$WavPath = Join-Path "C:\tmp" "alagille-visit-$RunId.wav"
$AudioCheckPath = Join-Path "C:\tmp" "alagille-visit-audio-$RunId.wav"
$Auth = $null
$FamilyId = ""
$PatientId = ""
$RecordingId = ""
$NoteId = ""
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

function Remove-FirestoreDocument {
    param([string]$DocumentPath, [string]$AccessToken)
    if (-not $DocumentPath) { return }
    $uri = "https://firestore.googleapis.com/v1/projects/$ProjectId/databases/$DatabaseId/documents/$DocumentPath"
    try { Invoke-RestMethod -Method DELETE -Uri $uri -Headers @{ Authorization = "Bearer $AccessToken"; "x-goog-user-project" = $ProjectId } -TimeoutSec 30 | Out-Null }
    catch { if ([int]$_.Exception.Response.StatusCode -ne 404) { throw } }
}

try {
    Write-Output "STEP=CREATE_SYNTHETIC_AUDIO"
    $speechText = "今日の診察では、血液検査の結果について話しました。先生から、エーエルティーは五十八でしたと説明がありました。お薬はウルソを今まで通り続けます。次回は八月二十日にエコー検査をします。家族から、夜のかゆみについて次回聞きたいです。"
    $gcpToken = (& $GcloudWrapper auth print-access-token --quiet | Select-Object -Last 1).Trim()
    $ttsBody = @{
        input = @{ text = $speechText }
        voice = @{ languageCode = "ja-JP"; ssmlGender = "FEMALE" }
        audioConfig = @{ audioEncoding = "LINEAR16"; speakingRate = 0.9 }
    } | ConvertTo-Json -Depth 6 -Compress
    $ttsRequestFile = Join-Path "C:\tmp" "alagille-tts-$RunId.json"
    try {
        [System.IO.File]::WriteAllText($ttsRequestFile, $ttsBody, [System.Text.UTF8Encoding]::new($false))
        $ttsOutput = & curl.exe --silent --show-error --max-time 180 --header "Authorization: Bearer $gcpToken" --header "x-goog-user-project: $ProjectId" --header "Content-Type: application/json; charset=utf-8" --data-binary "@$ttsRequestFile" "https://texttospeech.googleapis.com/v1/text:synthesize"
        if ($LASTEXITCODE -ne 0) { throw "Text-to-Speech request failed." }
        $tts = $ttsOutput | ConvertFrom-Json
        if ($tts.error) { throw $tts.error.message }
    } finally { if (Test-Path -LiteralPath $ttsRequestFile) { Remove-Item -LiteralPath $ttsRequestFile -Force } }
    [System.IO.File]::WriteAllBytes($WavPath, [Convert]::FromBase64String($tts.audioContent))
    if (-not (Test-Path -LiteralPath $WavPath) -or (Get-Item -LiteralPath $WavPath).Length -lt 1000) { throw "Synthetic audio was not created." }

    Write-Output "STEP=CREATE_ACCOUNT"
    $Auth = Invoke-FirebaseJson -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$FirebaseApiKey" -Body @{ email = "alagille-visit-e2e-$RunId@example.com"; password = $Password; returnSecureToken = $true }
    Invoke-Json -Method POST -Uri "$BaseUrl/api/account/session" -Headers ($OriginHeaders + @{ Authorization = "Bearer $($Auth.idToken)" }) | Out-Null
    $bootstrap = Invoke-Json -Method POST -Uri "$BaseUrl/api/account/bootstrap" -Headers $OriginHeaders -Body @{ displayName = "E2E記録者"; relationship = "self"; patientName = "E2E対象者"; birthDate = "1990-01-01"; avatarKey = "adult-woman" }
    $FamilyId = $bootstrap.familyId
    $PatientId = $bootstrap.patientId

    Write-Output "STEP=INIT_RECORDING"
    $initialized = Invoke-Json -Method POST -Uri "$BaseUrl/api/visit-notes/recordings" -Headers $OriginHeaders -Body @{ patientId = $PatientId; contentType = "audio/wav"; visitDate = "2026-07-13"; clinicName = "E2Eよりそい病院"; department = "小児肝臓外来"; familyMemo = "E2E架空データ" }
    $RecordingId = $initialized.recordingId
    if (-not $RecordingId) { throw "Recording was not initialized." }

    Write-Output "STEP=UPLOAD_AUDIO_CHUNK"
    $upload = Invoke-WebRequest -UseBasicParsing -Method PUT -Uri "$BaseUrl/api/visit-notes/recordings/$RecordingId/chunks/1?patientId=$PatientId" -WebSession $Session -Headers $OriginHeaders -ContentType "audio/wav" -InFile $WavPath -TimeoutSec 180
    if ($upload.StatusCode -ne 201) { throw "Audio chunk upload failed." }

    Write-Output "STEP=FINALIZE_RECORDING"
    $finalized = Invoke-Json -Method POST -Uri "$BaseUrl/api/visit-notes/recordings/$RecordingId/finalize" -Headers $OriginHeaders -Body @{ patientId = $PatientId; familyMemo = "E2E架空データ" }
    $NoteId = $finalized.noteId
    if (-not $NoteId) { throw "Finalize did not return a note ID." }

    Write-Output "STEP=POLL_STT_AND_ANALYSIS"
    $status = $null
    for ($i = 0; $i -lt 120; $i++) {
        Start-Sleep -Seconds 3
        $status = Invoke-Json -Method GET -Uri "$BaseUrl/api/visit-notes/recordings/$RecordingId/status?patientId=$PatientId"
        if ($status.status -eq "PROCESSED" -or $status.status -eq "FAILED") { break }
    }
    if ($status.status -ne "PROCESSED") { throw "Recording processing failed with status $($status.status), stage $($status.failureStage)." }
    if (-not $status.note.transcript -or $status.note.transcript.Length -lt 10) { throw "Transcript was not saved." }
    if (-not $status.note.summary) { throw "Structured summary was not saved." }

    Write-Output "STEP=READ_AUDIO_AND_LIST"
    Invoke-WebRequest -UseBasicParsing -Method GET -Uri "$BaseUrl/api/visit-notes/$NoteId/audio?patientId=$PatientId" -WebSession $Session -OutFile $AudioCheckPath -TimeoutSec 60
    if (-not (Test-Path -LiteralPath $AudioCheckPath) -or (Get-Item -LiteralPath $AudioCheckPath).Length -lt 1000) { throw "Saved audio could not be read." }
    $list = Invoke-Json -Method GET -Uri "$BaseUrl/api/visit-notes?patientId=$PatientId"
    if (@($list.notes | Where-Object { $_.id -eq $NoteId }).Count -ne 1) { throw "Saved visit note was not listed." }

    Write-Output "STEP=EDIT_NOTE"
    $edited = Invoke-Json -Method PATCH -Uri "$BaseUrl/api/visit-notes/$NoteId" -Headers $OriginHeaders -Body @{
        patientId = $PatientId; visitDate = "2026-07-13"; clinicName = "E2Eよりそい病院"; department = "小児肝臓外来";
        familyMemo = "編集確認済み"; transcript = $status.note.transcript;
        analysis = @{ summary = $status.note.summary; doctorSaid = @($status.note.doctorSaid); nextQuestions = @($status.note.nextQuestions); medicationChanges = @($status.note.medicationChanges); labAndTestTopics = @($status.note.labAndTestTopics); growthNutritionTopics = @($status.note.growthNutritionTopics); dailyLifeTopics = @($status.note.dailyLifeTopics); departments = @($status.note.departments) }
    }
    if ($edited.note.familyMemo -ne "編集確認済み") { throw "Visit note edit was not saved." }

    Write-Output "STEP=DELETE_NOTE_AND_AUDIO"
    Invoke-Json -Method DELETE -Uri "$BaseUrl/api/visit-notes/$NoteId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null
    $NoteId = ""
    $RecordingId = ""
    $afterDelete = Invoke-Json -Method GET -Uri "$BaseUrl/api/visit-notes?patientId=$PatientId"
    if (@($afterDelete.notes).Count -ne 0) { throw "Visit note remained after deletion." }

    $Succeeded = $true
    [pscustomobject]@{
        AccountBootstrap = "passed"
        ChunkUpload = "passed"
        SpeechToText = "passed"
        TranscriptLength = $status.note.transcript.Length
        GeminiAnalysis = "passed"
        AnalysisModel = $status.note.model
        AudioRead = "passed"
        EditDelete = "passed"
    } | ConvertTo-Json -Compress
} finally {
    if ($NoteId -and $PatientId) {
        try {
            Invoke-Json -Method DELETE -Uri "$BaseUrl/api/visit-notes/$NoteId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null
            $NoteId = ""
            $RecordingId = ""
        } catch { Write-Warning "Visit note cleanup failed." }
    }
    if ($RecordingId -and $PatientId) {
        try { Invoke-Json -Method DELETE -Uri "$BaseUrl/api/visit-notes/recordings/$RecordingId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null } catch { Write-Warning "Recording cleanup failed." }
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
    foreach ($file in @($WavPath,$AudioCheckPath)) { if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force } }
    if ($Succeeded) { Write-Output "E2E_CLEANUP=COMPLETED" }
}
