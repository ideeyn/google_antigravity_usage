param (
    [switch]$Minor,
    [switch]$Major,
    [switch]$Patch,
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"

$Type = "patch"
if ($Major) {
    $Type = "major"
} elseif ($Minor) {
    $Type = "minor"
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Antigravity Usage: Automated Release Tool" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Enforce being on 'main' branch
$currentBranch = (git branch --show-current).Trim()
if ($currentBranch -ne "main") {
    Write-Error "This script must be run directly from the 'main' branch (current: '$currentBranch').`nPlease checkout 'main', merge your changes from 'dev', resolve any conflicts, and re-run this script."
    exit 1
}

# 2. Check working directory is clean
$status = git status --porcelain
if ($status) {
    Write-Error "Working directory is not clean. Please commit or stash all changes on 'main' before running the release."
    exit 1
}

# 3. Bump version in package.json & package-lock.json
Write-Host "`n[1/4] Bumping version ($Type)..." -ForegroundColor Yellow
if ($Version) {
    npm version $Version --no-git-tag-version --allow-same-version
} else {
    npm version $Type --no-git-tag-version
}
if ($LASTEXITCODE -ne 0) { exit 1 }

$newVersion = (Get-Content "package.json" -Raw | ConvertFrom-Json).version
Write-Host "New Version: $newVersion" -ForegroundColor Green

# 4. Commit to main with exact version message (triggers GitHub Actions release workflow)
Write-Host "`n[2/4] Committing version bump to 'main'..." -ForegroundColor Yellow
git add package.json package-lock.json
git commit -m "$newVersion"
if ($LASTEXITCODE -ne 0) { exit 1 }

# 5. Push to origin main
Write-Host "`n[3/4] Pushing 'main' to origin..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) { exit 1 }

# 6. Force sync dev to match main
Write-Host "`n[4/4] Syncing 'dev' branch to match 'main'..." -ForegroundColor Yellow
git checkout dev
if ($LASTEXITCODE -ne 0) { exit 1 }

git reset --hard main
git push origin dev --force
if ($LASTEXITCODE -ne 0) { exit 1 }

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host " SUCCESS! Version $newVersion published to main." -ForegroundColor Green
Write-Host " Branch 'dev' is now 100% synced with 'main'." -ForegroundColor Green
Write-Host " GitHub Actions is now building and publishing." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
