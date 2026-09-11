@echo off
setlocal

set "CONTENT_DIR="
if exist "%~dp0public\游戏内容\界面文字.json" set "CONTENT_DIR=%~dp0public\游戏内容"
if not defined CONTENT_DIR for /d %%D in ("%~dp0*") do if exist "%%~fD\public\游戏内容\界面文字.json" set "CONTENT_DIR=%%~fD\public\游戏内容"

if not defined CONTENT_DIR (
  echo Could not find the game content folder.
  pause
  exit /b 1
)

start "" explorer.exe "%CONTENT_DIR%"
