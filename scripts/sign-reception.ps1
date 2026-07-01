# Signs SGMS Reception installer when CODESIGN_PFX_PATH is set.
param(
  [string]$ArtifactGlob = "apps/reception/release/*.exe"
)

$ErrorActionPreference = "Stop"

$pfx = $env:CODESIGN_PFX_PATH
$password = $env:CODESIGN_PFX_PASSWORD
$timestamp = if ($env:CODESIGN_TIMESTAMP_URL) { $env:CODESIGN_TIMESTAMP_URL } else { "http://timestamp.digicert.com" }

if (-not $pfx -or -not (Test-Path $pfx)) {
  Write-Host "CODESIGN_PFX_PATH not set — skipping Authenticode signing."
  Write-Host "See docs/desktop/CODE-SIGNING.md"
  exit 0
}

$signtool = Get-Command signtool.exe -ErrorAction SilentlyContinue
if (-not $signtool) {
  Write-Warning "signtool.exe not found. Install Windows SDK."
  exit 1
}

$files = Get-ChildItem -Path $ArtifactGlob -ErrorAction SilentlyContinue
if (-not $files) {
  Write-Warning "No installer found at $ArtifactGlob"
  exit 1
}

foreach ($file in $files) {
  Write-Host "Signing $($file.FullName)..."
  & signtool.exe sign /f $pfx /p $password /tr $timestamp /td sha256 /fd sha256 $file.FullName
}

Write-Host "Done."
