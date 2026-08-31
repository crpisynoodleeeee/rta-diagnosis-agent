# deploy-ghpages.ps1
# 一键部署 demo/V1.0 到 gh-pages 分支（GitHub Pages）
# 用法：
#   1. 先关联远端：git remote add origin https://github.com/<用户名>/<仓库名>.git
#   2. .\deploy-ghpages.ps1              # 构建 gh-pages 分支并推送
#   3. .\deploy-ghpages.ps1 -SkipPush    # 只在本地构建，不推送（本地演练用）
# 部署后 URL：https://<用户名>.github.io/<仓库名>/
# 然后 GitHub 仓库 Settings → Pages → Source: Deploy from a branch → gh-pages / root
#
# 注意：脚本含中文，请以 UTF-8 with BOM 保存（Windows PowerShell 5.1 需要）。

param(
  [string]$CommitMsg = "Deploy demo v6 to GitHub Pages",
  [switch]$SkipPush
)

$ErrorActionPreference = "Continue"   # 不用 Stop：git 的 stderr 信息流在 PS5.1 会被转成错误记录
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$demo = Join-Path $root "demo\v6"
Set-Location $root

function Invoke-Git {
  param([string[]]$Cmd)   # 不能用 $Args（与自动变量 $args 冲突）
  $out = & git @Cmd 2>$null
  if ($LASTEXITCODE -ne 0) { throw "git $($Cmd -join ' ') 失败（exit $LASTEXITCODE）" }
  return $out
}

# ── 前置校验 ──────────────────────────────────────────────
if (-not (Test-Path (Join-Path $demo "index.html"))) { throw "未找到 demo/V1.0/index.html，请确认在仓库根目录运行" }
if (-not (Test-Path (Join-Path $demo "vendor\vue.global.js"))) { throw "vendor/vue.global.js 缺失，无法部署" }

$current = (Invoke-Git @('rev-parse', '--abbrev-ref', 'HEAD')).Trim()
# 安全护栏：工作区必须干净（有未提交/未跟踪文件会在此中止，防止误删）
$dirty = (& git status --porcelain 2>$null)
if ($dirty) { throw "工作区存在未提交/未跟踪文件，请先 commit 或 stash 再运行部署脚本：`n$($dirty -join "`n")" }

# 把 demo/V1.0 先暂存到系统临时目录（避免清理工作区时误删 main 上未提交的文件）
$stage = Join-Path $env:TEMP ("ghpages-" + [guid]::NewGuid().ToString("N").Substring(0,8))
New-Item -ItemType Directory -Path $stage | Out-Null
try {
  Copy-Item (Join-Path $demo "*") $stage -Recurse -Force

  # ── 切到 gh-pages 分支（不存在则 orphan 创建）─────────────
  $hasBranch = $false
  & git rev-parse --verify --quiet refs/heads/gh-pages 2>$null
  if ($LASTEXITCODE -eq 0) { $hasBranch = $true }

  if ($hasBranch) {
    Invoke-Git @('checkout', 'gh-pages') | Out-Null
  } else {
    Invoke-Git @('checkout', '--orphan', 'gh-pages') | Out-Null
  }

  # 清空 gh-pages 工作区（demo 内容已在 $stage，可安全删除一切非 .git 文件）
  & git rm -rf --quiet . 2>$null
  Get-ChildItem -Force | Where-Object { $_.Name -ne ".git" } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

  # ── 拷贝 demo/V1.0 到分支根 ────────────────────────────────
  Copy-Item (Join-Path $stage "*") . -Recurse -Force

  # ── 提交 ──────────────────────────────────────────────────
  & git add -A 2>$null
  $changed = (& git status --porcelain 2>$null)
  if ($changed) {
    Invoke-Git @('commit', '-m', $CommitMsg) | Out-Null
    Write-Host "OK 已提交 gh-pages 分支：$CommitMsg"
  } else {
    Write-Host "WARN 内容无变化，跳过提交（debug: status=[$($changed -join ',')]）"
  }

  # ── 推送 ──────────────────────────────────────────────────
  if (-not $SkipPush) {
    $remote = (& git remote get-url origin 2>$null)
    if (-not $remote) { throw "未配置 origin remote。请先执行：git remote add origin https://github.com/<用户名>/<仓库名>.git" }
    Invoke-Git @('push', '-u', 'origin', 'gh-pages') | Out-Null
    Write-Host "OK 已推送到 origin/gh-pages"
  }
}
finally {
  Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
  & git checkout $current 2>$null | Out-Null
  Write-Host "已回到分支：$current"
}

Write-Host ""
Write-Host "🎉 gh-pages 分支就绪。"
if (-not $SkipPush) {
  $remote = (& git remote get-url origin 2>$null)
  $repo = (($remote -split '[/:]')[-1]) -replace '\.git$', ''
  Write-Host "   GitHub 仓库：https://github.com/$repo"
  Write-Host "   下一步：仓库 Settings → Pages → Source: Deploy from a branch → gh-pages / (root)"
  Write-Host "   成品 URL：https://<用户名>.github.io/$repo/"
}
