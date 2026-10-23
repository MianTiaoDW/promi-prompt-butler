param([switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
  if (-not $SkipBuild) { npm run build
  if ($LASTEXITCODE -ne 0) { throw 'Build failed.' } }
  $version = (Get-Content package.json -Raw | ConvertFrom-Json).version
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $name = "Promi-$version-test-$stamp"
  $stage = Join-Path $projectRoot "exports/$name"
  New-Item -ItemType Directory -Path $stage | Out-Null
  Copy-Item -LiteralPath (Join-Path $projectRoot 'dist') -Destination (Join-Path $stage 'extension') -Recurse
  Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/测试版使用说明.txt') -Destination (Join-Path $stage '先看我-安装与使用.txt')
  Copy-Item -LiteralPath (Join-Path $projectRoot 'docs/测试反馈模板.txt') -Destination $stage
  $releaseNotes = Join-Path $projectRoot "docs/RELEASE_v$version.md"
  if (Test-Path -LiteralPath $releaseNotes) { Copy-Item -LiteralPath $releaseNotes -Destination (Join-Path $stage '更新说明.md') }
  $pin = Join-Path $stage 'windows-pin'
  New-Item -ItemType Directory -Path (Join-Path $pin 'scripts') -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $pin 'native/PromptButler.TopMostHost') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $projectRoot 'scripts/install-pin-share.cmd') -Destination (Join-Path $pin 'install.cmd')
  foreach ($file in @('install-native-host.ps1', 'uninstall-native-host.ps1')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $file) -Destination (Join-Path $pin 'scripts')
  }
  Copy-Item -LiteralPath (Join-Path $projectRoot 'native/PromptButler.TopMostHost/FrameworkHost.cs') -Destination (Join-Path $pin 'native/PromptButler.TopMostHost')
  $commit = git rev-parse --short HEAD
  "Version: $version`r`nSource baseline: $commit`r`nBuilt: $stamp`r`nNo personal settings or keys included." | Set-Content -LiteralPath (Join-Path $stage 'BUILD.txt') -Encoding utf8
  $zip = Join-Path $projectRoot "exports/$name.zip"
  Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
  Write-Output "PACKAGE: $zip"
} finally { Pop-Location }
