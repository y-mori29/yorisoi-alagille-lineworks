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
$Ids = @{}
$Succeeded = $false

function Invoke-Json {
    param([string]$Method, [string]$Uri, $Body = $null, [hashtable]$Headers = @{})
    $params = @{ Method=$Method; Uri=$Uri; Headers=$Headers; WebSession=$Session; TimeoutSec=180 }
    if ($null -ne $Body) { $json=$Body|ConvertTo-Json -Depth 15 -Compress; $params.ContentType="application/json; charset=utf-8"; $params.Body=[Text.Encoding]::UTF8.GetBytes($json) }
    Invoke-RestMethod @params
}

function Invoke-FirebaseJson {
    param([string]$Uri,$Body)
    $temp=Join-Path "C:\tmp" "alagille-firebase-$([guid]::NewGuid().ToString('N')).json"
    try { [IO.File]::WriteAllText($temp,($Body|ConvertTo-Json -Depth 8 -Compress),[Text.UTF8Encoding]::new($false));$output=& curl.exe --silent --show-error --max-time 30 --header "Content-Type: application/json" --data-binary "@$temp" $Uri;if($LASTEXITCODE-ne 0){throw "Firebase request failed."};$result=$output|ConvertFrom-Json;if($result.error){throw $result.error.message};$result } finally { if(Test-Path -LiteralPath $temp){Remove-Item -LiteralPath $temp -Force} }
}

function Invoke-MultipartFields {
    param([string]$Uri,[hashtable]$Fields)
    $boundary="----Yorisoi$([guid]::NewGuid().ToString('N'))";$stream=New-Object IO.MemoryStream;$utf8=New-Object Text.UTF8Encoding($false)
    try { foreach($key in $Fields.Keys){$bytes=$utf8.GetBytes("--$boundary`r`nContent-Disposition: form-data; name=`"$key`"`r`n`r`n$($Fields[$key])`r`n");$stream.Write($bytes,0,$bytes.Length)};$closing=$utf8.GetBytes("--$boundary--`r`n");$stream.Write($closing,0,$closing.Length);Invoke-RestMethod -Method POST -Uri $Uri -Headers $OriginHeaders -WebSession $Session -ContentType "multipart/form-data; boundary=$boundary" -Body $stream.ToArray() -TimeoutSec 180 } finally { $stream.Dispose() }
}

function Remove-FirestoreDocument { param([string]$DocumentPath,[string]$AccessToken);if(-not $DocumentPath){return};$uri="https://firestore.googleapis.com/v1/projects/$ProjectId/databases/$DatabaseId/documents/$DocumentPath";try{Invoke-RestMethod -Method DELETE -Uri $uri -Headers @{Authorization="Bearer $AccessToken";"x-goog-user-project"=$ProjectId} -TimeoutSec 30|Out-Null}catch{if([int]$_.Exception.Response.StatusCode-ne 404){throw}} }

try {
    Write-Output "STEP=CREATE_ACCOUNT"
    $Auth=Invoke-FirebaseJson -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=$FirebaseApiKey" -Body @{email="alagille-overview-e2e-$RunId@example.com";password=$Password;returnSecureToken=$true}
    Invoke-Json -Method POST -Uri "$BaseUrl/api/account/session" -Headers ($OriginHeaders+@{Authorization="Bearer $($Auth.idToken)"})|Out-Null
    $bootstrap=Invoke-Json -Method POST -Uri "$BaseUrl/api/account/bootstrap" -Headers $OriginHeaders -Body @{displayName="E2E記録者";relationship="self";patientName="E2E対象者";birthDate="1990-01-01";avatarKey="adult-woman"}
    $FamilyId=$bootstrap.familyId;$PatientId=$bootstrap.patientId;$today=[DateTimeOffset]::UtcNow.ToString("yyyy-MM-dd")

    Write-Output "STEP=CREATE_SOURCE_RECORDS"
    $visit=Invoke-Json -Method POST -Uri "$BaseUrl/api/visit-notes" -Headers $OriginHeaders -Body @{patientId=$PatientId;visitDate=$today;clinicName="E2E病院";department="小児科";familyMemo="架空";transcript="架空の診察記録";summary="検査と次回予定を確認しました。";doctorSaid=@("薬を続けると説明がありました。");nextQuestions=@("次回検査の準備を聞く");medicationChanges=@();labAndTestTopics=@("ALTを確認");growthNutritionTopics=@();dailyLifeTopics=@();departments=@("小児科")}
    $Ids.visit=$visit.note.id
    $lab=Invoke-Json -Method POST -Uri "$BaseUrl/api/labs" -Headers $OriginHeaders -Body @{patientId=$PatientId;testDate=$today;hospitalName="E2E病院";department="小児科";category="blood";notes="架空";values=@(@{name="ALT";value="58";unit="U/L";referenceRange="9〜30";flag="H"})}
    $Ids.lab=$lab.record.id
    $med=Invoke-Json -Method POST -Uri "$BaseUrl/api/medications" -Headers $OriginHeaders -Body @{patientId=$PatientId;name="E2Eお薬";dosageText="1日2回";timingText="朝・夕";status="active";startedAt=$today;memo="架空"}
    $Ids.med=$med.medication.id
    $growth=Invoke-Json -Method POST -Uri "$BaseUrl/api/growth-records" -Headers $OriginHeaders -Body @{patientId=$PatientId;measuredAt=$today;heightCm=107.2;weightKg=17.6;memo="架空"}
    $Ids.growth=$growth.record.id
    $daily=Invoke-MultipartFields -Uri "$BaseUrl/api/daily-logs" -Fields @{patientId=$PatientId;occurredAt=[DateTimeOffset]::UtcNow.ToString("o");category="itch";title="夜のかゆみ";memo="架空の日々記録";keepMediaIds="[]"}
    $Ids.daily=$daily.log.id
    $question=Invoke-Json -Method POST -Uri "$BaseUrl/api/questions" -Headers $OriginHeaders -Body @{patientId=$PatientId;text="夜のかゆみについて聞く";category="daily";status="open";answerMemo=""}
    $Ids.question=$question.question.id

    Write-Output "STEP=VERIFY_RECENT_AND_DOCTOR_VIEW"
    $recent=Invoke-Json -Method GET -Uri "$BaseUrl/api/recent-changes?patientId=$PatientId"
    $types=@($recent.items.type)
    foreach($required in @("visit","daily","lab","medication","growth")){if($types-notcontains $required){throw "Recent changes missing $required."}}
    if((($recent.items|ConvertTo-Json -Depth 8)-match "改善|悪化|正常|異常")){throw "Recent changes contained a medical judgment."}
    $view=Invoke-Json -Method GET -Uri "$BaseUrl/api/doctor-view?patientId=$PatientId&from=$today&to=$today"
    if(@($view.view.visitNotes).Count-ne 1-or @($view.view.labs).Count-ne 1-or @($view.view.growth).Count-ne 1-or @($view.view.dailyLogs).Count-ne 1-or @($view.view.questions).Count-ne 1){throw "Doctor view aggregation was incomplete."}
    if(@($view.view.aiQuestionCandidates).Count-ne 1){throw "AI question candidate was not aggregated."}
    $export=Invoke-Json -Method POST -Uri "$BaseUrl/api/doctor-view/export" -Headers $OriginHeaders -Body @{patientId=$PatientId;from=$today;to=$today;included=@{visitNotes=$true;labs=$true;growth=$true;medications=$false;dailyLogs=$true;questions=$true}}
    if($export.text-notmatch "ALT: 58 U/L \(H\)"-or $export.text-notmatch "診察メモからの候補"-or $export.text-match "E2Eお薬"){throw "Doctor view export did not honor the selected sections."}

    Write-Output "STEP=DELETE_SOURCE_RECORDS"
    Invoke-Json -Method DELETE -Uri "$BaseUrl/api/questions/$($Ids.question)?patientId=$PatientId" -Headers $OriginHeaders|Out-Null;$Ids.question=""
    Invoke-Json -Method DELETE -Uri "$BaseUrl/api/daily-logs/$($Ids.daily)?patientId=$PatientId" -Headers $OriginHeaders|Out-Null;$Ids.daily=""
    Invoke-Json -Method DELETE -Uri "$BaseUrl/api/growth-records/$($Ids.growth)?patientId=$PatientId" -Headers $OriginHeaders|Out-Null;$Ids.growth=""
    Invoke-Json -Method DELETE -Uri "$BaseUrl/api/medications/$($Ids.med)?patientId=$PatientId" -Headers $OriginHeaders|Out-Null;$Ids.med=""
    Invoke-Json -Method DELETE -Uri "$BaseUrl/api/labs/$($Ids.lab)?patientId=$PatientId" -Headers $OriginHeaders|Out-Null;$Ids.lab=""
    Invoke-Json -Method DELETE -Uri "$BaseUrl/api/visit-notes/$($Ids.visit)?patientId=$PatientId" -Headers $OriginHeaders|Out-Null;$Ids.visit=""
    $Succeeded=$true
    [pscustomobject]@{AccountBoundary="passed";RecentAggregation="passed";NoMedicalJudgment="passed";DoctorViewAggregation="passed";SectionExport="passed";Cleanup="passed"}|ConvertTo-Json -Compress
} finally {
    $cleanup=@(@("question","questions"),@("daily","daily-logs"),@("growth","growth-records"),@("med","medications"),@("lab","labs"),@("visit","visit-notes"))
    foreach($item in $cleanup){$id=$Ids[$item[0]];if($id-and $PatientId){try{Invoke-Json -Method DELETE -Uri "$BaseUrl/api/$($item[1])/$id`?patientId=$PatientId" -Headers $OriginHeaders|Out-Null}catch{Write-Warning "$($item[0]) cleanup failed."}}}
    if($FamilyId){try{$token=(& $GcloudWrapper auth print-access-token --quiet|Select-Object -Last 1).Trim();if($PatientId){Remove-FirestoreDocument "families/$FamilyId/patients/$PatientId" $token};if($Auth.localId){Remove-FirestoreDocument "families/$FamilyId/members/$($Auth.localId)" $token};Remove-FirestoreDocument "families/$FamilyId" $token;if($Auth.localId){Remove-FirestoreDocument "users/$($Auth.localId)" $token}}catch{Write-Warning "Firestore cleanup failed."}}
    if($Auth.idToken){try{Invoke-FirebaseJson -Uri "https://identitytoolkit.googleapis.com/v1/accounts:delete?key=$FirebaseApiKey" -Body @{idToken=$Auth.idToken}|Out-Null}catch{Write-Warning "Firebase user cleanup failed."}}
    if($Succeeded){Write-Output "E2E_CLEANUP=COMPLETED"}
}
