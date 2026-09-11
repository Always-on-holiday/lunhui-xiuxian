@echo off
setlocal

set "PWSH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe"
if not exist "%PWSH%" set "PWSH=powershell.exe"

set "OPENER="
if exist "%~dp0scripts\open-content.ps1" set "OPENER=%~dp0scripts\open-content.ps1"
if not defined OPENER for /d %%D in ("%~dp0*") do if exist "%%~fD\scripts\open-content.ps1" set "OPENER=%%~fD\scripts\open-content.ps1"

if not defined OPENER (
  echo Could not find the content opener.
  pause
  exit /b 1
)

"%PWSH%" -NoProfile -ExecutionPolicy Bypass -File "%OPENER%" %*
