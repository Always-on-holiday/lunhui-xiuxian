@echo off
setlocal

set "PWSH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\powershell\pwsh.exe"
if not exist "%PWSH%" set "PWSH=powershell.exe"

set "LAUNCHER="
if exist "%~dp0scripts\start-online.ps1" set "LAUNCHER=%~dp0scripts\start-online.ps1"
if not defined LAUNCHER for /d %%D in ("%~dp0*") do if exist "%%~fD\scripts\start-online.ps1" set "LAUNCHER=%%~fD\scripts\start-online.ps1"

if not defined LAUNCHER (
  echo Could not find the game launcher.
  echo Keep this file in the web project or in the folder directly above it.
  pause
  exit /b 1
)

"%PWSH%" -NoProfile -ExecutionPolicy Bypass -File "%LAUNCHER%"
