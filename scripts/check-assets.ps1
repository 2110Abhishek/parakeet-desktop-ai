$ErrorActionPreference = "Stop"
$binary = Join-Path $PSScriptRoot "..\bin\whisper-cli.exe"
$model = Join-Path $PSScriptRoot "..\models\ggml-base.en.bin"
$binaryState = if (Test-Path $binary) { "FOUND" } else { "MISSING" }
$modelState = if (Test-Path $model) { "FOUND" } else { "MISSING" }
Write-Host "Whisper binary: $binaryState"
Write-Host "Whisper model:  $modelState"
if (!(Test-Path $binary) -or !(Test-Path $model)) {
  Write-Host "See README.md for the required downloads and paths."
  exit 1
}
Write-Host "Whisper assets look ready."
