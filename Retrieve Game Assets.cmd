@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Retrieve-GameAssets.ps1" %*
pause
