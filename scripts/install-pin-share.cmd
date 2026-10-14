@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$extensionId = Read-Host 'Paste the 32-character extension ID'; try { & '%~dp0scripts\install-native-host.ps1' -ExtensionId $extensionId } catch { Write-Host $_.Exception.Message -ForegroundColor Red }; Read-Host 'Press Enter to close'"
