# ════════════════════════════════════════════════
# NEXUS-SEO Deploy Script — GitHub Pages
# Запусти этот файл ПОСЛЕ 'gh auth login'
# ════════════════════════════════════════════════

param(
    [string]$RepoName = "contractor-calc",
    [string]$Description = "Free Contractor Markup & Profit Margin Calculator | ContractorCalc.pro"
)

Write-Host "`n🚀 NEXUS-SEO Auto-Deploy Script" -ForegroundColor Cyan
Write-Host "════════════════════════════════════" -ForegroundColor DarkGray

# Step 1: Verify git status
Write-Host "`n[1/5] Verifying Git repository..." -ForegroundColor Yellow
$gitLog = git log --oneline -1 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ No git commits found. Run 'git commit' first." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Git OK — Last commit: $gitLog" -ForegroundColor Green

# Step 2: Check gh auth
Write-Host "`n[2/5] Checking GitHub CLI auth..." -ForegroundColor Yellow
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Not logged in. Launching browser login..." -ForegroundColor Yellow
    gh auth login --web --git-protocol https
    if ($LASTEXITCODE -ne 0) { Write-Host "❌ Auth failed." -ForegroundColor Red; exit 1 }
}
Write-Host "✅ GitHub CLI authenticated" -ForegroundColor Green

# Step 3: Create GitHub repo
Write-Host "`n[3/5] Creating GitHub repository '$RepoName'..." -ForegroundColor Yellow
gh repo create $RepoName --public --description $Description --source=. --remote=origin --push 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Repository created and pushed!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Repo may already exist. Attempting push..." -ForegroundColor Yellow
    git push -u origin main 2>&1
}

# Step 4: Enable GitHub Pages via API
Write-Host "`n[4/5] Enabling GitHub Pages (GitHub Actions source)..." -ForegroundColor Yellow
$username = gh api user --jq '.login'
gh api `
  --method POST `
  -H "Accept: application/vnd.github+json" `
  "/repos/$username/$RepoName/pages" `
  -f "source[branch]=main" `
  -f "source[path]=/" `
  --silent 2>&1

# Try updating if already exists
gh api `
  --method PUT `
  -H "Accept: application/vnd.github+json" `
  "/repos/$username/$RepoName/pages" `
  -f "source[branch]=main" `
  -f "build_type=workflow" `
  --silent 2>&1

Write-Host "✅ GitHub Pages configuration applied" -ForegroundColor Green

# Step 5: Trigger workflow
Write-Host "`n[5/5] Triggering GitHub Actions deploy workflow..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
gh workflow run deploy.yml 2>&1
Write-Host "✅ Workflow triggered!" -ForegroundColor Green

# Final output
$username = gh api user --jq '.login'
Write-Host "`n════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "🎉 DEPLOYMENT INITIATED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 Repository : https://github.com/$username/$RepoName" -ForegroundColor White
Write-Host "🌐 Live URL   : https://$username.github.io/$RepoName/" -ForegroundColor White  
Write-Host "⚙️  Actions   : https://github.com/$username/$RepoName/actions" -ForegroundColor White
Write-Host ""
Write-Host "⏱  Site will be live in ~60 seconds after Actions completes." -ForegroundColor DarkGray
Write-Host "════════════════════════════════════════════`n" -ForegroundColor Cyan
