param(
  [string]$ExtensionId = "kacphaiefjcgokdfakpjdpjplfpnkpai",
  [string]$InstallDirectory = (Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::CommonDocuments)) ("PromptButler\NativeHost\" + [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value))
)

$ErrorActionPreference = "Stop"

$hostName = "com.promptbutler.window"
$projectRoot = Split-Path -Parent $PSScriptRoot
$publishDirectory = Join-Path $env:TEMP ("prompt-butler-native-host-" + [guid]::NewGuid().ToString("N"))
$hostExecutable = Join-Path $installDirectory "PromptButler.TopMostHost.exe"
$hostManifest = Join-Path $installDirectory "$hostName.json"

try {
  New-Item -ItemType Directory -Path $publishDirectory -Force | Out-Null
  $compilerPath = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
  if (-not (Test-Path -LiteralPath $compilerPath)) {
    throw 'Windows .NET Framework 4.x is required to install the window pin host.'
  }
  & $compilerPath /nologo /target:exe /platform:x64 `
    "/out:$publishDirectory\PromptButler.TopMostHost.exe" `
    /reference:System.Web.Extensions.dll `
    (Join-Path $projectRoot 'native\PromptButler.TopMostHost\FrameworkHost.cs')

  if ($LASTEXITCODE -ne 0) {
    throw "Failed to build the window pin host."
  }

  New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $publishDirectory "PromptButler.TopMostHost.exe") -Destination $hostExecutable -Force

  $manifest = [ordered]@{
    name = $hostName
    description = "Prompt Butler same-window topmost host"
    path = $hostExecutable
    type = "stdio"
    allowed_origins = @("chrome-extension://$ExtensionId/")
  }
  $utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText(
    $hostManifest,
    ($manifest | ConvertTo-Json -Depth 3),
    $utf8WithoutBom
  )

  foreach ($registryPath in @(
    "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$hostName",
    "HKCU:\Software\Microsoft\Edge\NativeMessagingHosts\$hostName"
  )) {
    New-Item -Path $registryPath -Force | Out-Null
    Set-Item -Path $registryPath -Value $hostManifest
  }

  Write-Host "Prompt Butler window pin host installed."
  Write-Host "Allowed extension ID: $ExtensionId"
  Write-Host "Reload the extension before testing."
}
finally {
  Remove-Item -LiteralPath $publishDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
