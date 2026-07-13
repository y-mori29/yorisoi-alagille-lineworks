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
$Auth = $null
$FamilyId = ""
$PatientId = ""
$AppointmentId = ""
$QuestionId = ""
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
    Write-Output "STEP=CREATE_ACCOUNT"
    $Auth = Invoke-FirebaseJson -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$FirebaseApiKey" -Body @{ email = "alagille-planning-e2e-$RunId@example.com"; password = $Password; returnSecureToken = $true }
    Invoke-Json -Method POST -Uri "$BaseUrl/api/account/session" -Headers ($OriginHeaders + @{ Authorization = "Bearer $($Auth.idToken)" }) | Out-Null
    $bootstrap = Invoke-Json -Method POST -Uri "$BaseUrl/api/account/bootstrap" -Headers $OriginHeaders -Body @{ displayName = "E2E記録者"; relationship = "self"; patientName = "E2E対象者"; birthDate = "1990-01-01"; avatarKey = "adult-woman" }
    $FamilyId = $bootstrap.familyId
    $PatientId = $bootstrap.patientId

    Write-Output "STEP=CREATE_AND_LIST_APPOINTMENT"
    $future = [DateTimeOffset]::UtcNow.AddDays(14).ToString("o")
    $createdAppointment = Invoke-Json -Method POST -Uri "$BaseUrl/api/appointments" -Headers $OriginHeaders -Body @{ patientId=$PatientId; scheduledAt=$future; clinicName="E2Eよりそい病院"; department="小児肝臓外来"; location="2階"; memo="E2E架空予定"; status="scheduled" }
    $AppointmentId = $createdAppointment.appointment.id
    if (-not $AppointmentId) { throw "Appointment was not created." }
    $upcoming = Invoke-Json -Method GET -Uri "$BaseUrl/api/appointments?patientId=$PatientId&upcoming=1"
    if (@($upcoming.appointments | Where-Object { $_.id -eq $AppointmentId }).Count -ne 1) { throw "Upcoming appointment was not listed." }
    $editedAppointment = Invoke-Json -Method PATCH -Uri "$BaseUrl/api/appointments/$AppointmentId" -Headers $OriginHeaders -Body @{ patientId=$PatientId; scheduledAt=$future; clinicName="E2Eよりそい病院"; department="小児科"; location="本館2階"; memo="編集確認済み"; status="scheduled" }
    if ($editedAppointment.appointment.memo -ne "編集確認済み") { throw "Appointment edit failed." }

    Write-Output "STEP=CREATE_AND_COMPLETE_QUESTION"
    $createdQuestion = Invoke-Json -Method POST -Uri "$BaseUrl/api/questions" -Headers $OriginHeaders -Body @{ patientId=$PatientId; text="夜のかゆみについて聞く"; category="daily"; status="open"; answerMemo="" }
    $QuestionId = $createdQuestion.question.id
    if (-not $QuestionId) { throw "Question was not created." }
    $askedQuestion = Invoke-Json -Method PATCH -Uri "$BaseUrl/api/questions/$QuestionId" -Headers $OriginHeaders -Body @{ patientId=$PatientId; text="夜のかゆみについて聞く"; category="daily"; status="asked"; answerMemo="冷やして様子を見る"; askedAt=[DateTimeOffset]::UtcNow.ToString("o") }
    if ($askedQuestion.question.status -ne "asked" -or $askedQuestion.question.answerMemo -ne "冷やして様子を見る") { throw "Question completion failed." }
    $questions = Invoke-Json -Method GET -Uri "$BaseUrl/api/questions?patientId=$PatientId&status=asked"
    if (@($questions.questions | Where-Object { $_.id -eq $QuestionId }).Count -ne 1) { throw "Asked question was not listed." }

    Write-Output "STEP=DELETE_PLANNING_RECORDS"
    Invoke-Json -Method DELETE -Uri "$BaseUrl/api/questions/$QuestionId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null
    $QuestionId = ""
    Invoke-Json -Method DELETE -Uri "$BaseUrl/api/appointments/$AppointmentId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null
    $AppointmentId = ""
    if (@((Invoke-Json -Method GET -Uri "$BaseUrl/api/questions?patientId=$PatientId").questions).Count -ne 0) { throw "Question remained after deletion." }
    if (@((Invoke-Json -Method GET -Uri "$BaseUrl/api/appointments?patientId=$PatientId").appointments).Count -ne 0) { throw "Appointment remained after deletion." }

    $Succeeded = $true
    [pscustomobject]@{ AccountBoundary="passed"; AppointmentCrud="passed"; UpcomingQuery="passed"; QuestionCrud="passed"; QuestionStatus="passed"; Cleanup="passed" } | ConvertTo-Json -Compress
} finally {
    if ($QuestionId -and $PatientId) { try { Invoke-Json -Method DELETE -Uri "$BaseUrl/api/questions/$QuestionId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null } catch { Write-Warning "Question cleanup failed." } }
    if ($AppointmentId -and $PatientId) { try { Invoke-Json -Method DELETE -Uri "$BaseUrl/api/appointments/$AppointmentId`?patientId=$PatientId" -Headers $OriginHeaders | Out-Null } catch { Write-Warning "Appointment cleanup failed." } }
    if ($FamilyId) {
        try {
            $token = (& $GcloudWrapper auth print-access-token --quiet | Select-Object -Last 1).Trim()
            if ($PatientId) { Remove-FirestoreDocument -DocumentPath "families/$FamilyId/patients/$PatientId" -AccessToken $token }
            if ($Auth.localId) { Remove-FirestoreDocument -DocumentPath "families/$FamilyId/members/$($Auth.localId)" -AccessToken $token }
            Remove-FirestoreDocument -DocumentPath "families/$FamilyId" -AccessToken $token
            if ($Auth.localId) { Remove-FirestoreDocument -DocumentPath "users/$($Auth.localId)" -AccessToken $token }
        } catch { Write-Warning "Firestore cleanup failed: $($_.Exception.Message)" }
    }
    if ($Auth.idToken) { try { Invoke-FirebaseJson -Uri "https://identitytoolkit.googleapis.com/v1/accounts:delete?key=$FirebaseApiKey" -Body @{ idToken=$Auth.idToken } | Out-Null } catch { Write-Warning "Firebase user cleanup failed." } }
    if ($Succeeded) { Write-Output "E2E_CLEANUP=COMPLETED" }
}
