<#
.SYNOPSIS
  Local build and packaging script for Google Antigravity Usage extension.

.DESCRIPTION
  This script is an optional, transparent way to compile and package the extension
  entirely on your local machine—ideal for testing changes -- or if you prefer 100%
  verifiable local builds without downloading pre-built binaries from outside sources.
  (I got it, its getting harder to trust random opensources nowadays, so many AI fluffs 
  outside. I declare this package is safe, haha, but whatever it's up to you to decide)

.HOW TO RUN
  1. Open Terminal or PowerShell in this project's root folder.
  2. Run the script:
     .\build-local-vsix.ps1

.HOW TO INSTALL IN VS CODE / ANTIGRAVITY IDE
  1. Open VS Code or Antigravity IDE.
  2. Press Ctrl + Shift + X (or Cmd + Shift + X on macOS) to open the Extensions view.
  3. Click the '...' (Views and More Actions) menu in the top-right corner of the Extensions panel.
  4. Select "Install from VSIX...".
  5. Navigate to the 'dev_vsix/' folder and choose the generated '.vsix' file.
#>

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$vsixDir = Join-Path $scriptDir "dev_vsix"
if (-not (Test-Path $vsixDir)) {
    New-Item -ItemType Directory -Path $vsixDir | Out-Null
    Write-Host "[1/3] Created 'dev_vsix' directory." -ForegroundColor Cyan
} else {
    Write-Host "[1/3] 'dev_vsix' directory already exists." -ForegroundColor Cyan
}

Write-Host "[2/3] Compiling extension..." -ForegroundColor Cyan
npm run compile

Write-Host "[3/3] Packaging VSIX into 'dev_vsix' folder..." -ForegroundColor Cyan
npx @vscode/vsce package --out dev_vsix/ --no-dependencies

$vsixFiles = Get-ChildItem -Path $vsixDir -Filter "*.vsix" | Sort-Object LastWriteTime -Descending
if ($vsixFiles.Count -gt 0) {
    $latest = $vsixFiles[0]
    $sizeKb = [math]::Round($latest.Length / 1KB, 2)
    Write-Host "`nSUCCESS! VSIX created:" -ForegroundColor Green
    Write-Host "  Path: $($latest.FullName)" -ForegroundColor Yellow
    Write-Host "  Size: $sizeKb KB" -ForegroundColor Yellow
}
