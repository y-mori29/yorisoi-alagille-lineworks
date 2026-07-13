param(
    [switch]$Apply,
    [string]$CredentialFile = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
if (-not $CredentialFile) {
    $CredentialFile = Join-Path $RepoRoot "secure\developer-demo-account.env"
}
$CredentialFile = [System.IO.Path]::GetFullPath($CredentialFile)

if (-not (Test-Path -LiteralPath $CredentialFile -PathType Leaf)) {
    throw "Demo credential file was not found: $CredentialFile"
}

$loadedNames = New-Object System.Collections.Generic.List[string]
try {
    foreach ($line in Get-Content -LiteralPath $CredentialFile -Encoding UTF8) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        $separator = $trimmed.IndexOf("=")
        if ($separator -lt 1) { continue }
        $name = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1)
        if ($name -notin @("YORISOI_DEMO_EMAIL", "YORISOI_DEMO_PASSWORD")) { continue }
        [Environment]::SetEnvironmentVariable($name, $value, "Process")
        $loadedNames.Add($name)
    }

    if ($loadedNames.Count -ne 2) {
        throw "Credential file must contain YORISOI_DEMO_EMAIL and YORISOI_DEMO_PASSWORD."
    }

    $arguments = @((Join-Path $PSScriptRoot "manage-developer-demo-account.js"))
    if ($Apply) { $arguments += "--apply" }
    & node @arguments
    if ($LASTEXITCODE -ne 0) { throw "Demo account reset failed with exit code $LASTEXITCODE." }
} finally {
    foreach ($name in $loadedNames) {
        [Environment]::SetEnvironmentVariable($name, $null, "Process")
    }
}
