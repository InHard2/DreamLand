@echo off
title Update DreamLand
cd /d "%~dp0"
rem Each way of updating runs as one block, so the file can be replaced while it runs.
where git >nul 2>nul
if errorlevel 1 goto zip
if not exist ".git" (
  echo   First update: linking this folder to GitHub...
  git init -q
  git remote add origin https://github.com/InHard2/DreamLand.git
)
echo   Downloading the latest DreamLand...
git fetch --depth 1 origin main
if errorlevel 1 goto zip
(
  git checkout -q -f -B main origin/main
  git branch -q --set-upstream-to=origin/main main >nul 2>nul
  echo.
  echo   DreamLand is up to date. Your worlds are safe: they live in your browser.
  echo   Reload the game page ^(Ctrl+F5^) to play the new version.
  echo.
  pause
  exit /b
)

:zip
(
  echo   Downloading the latest DreamLand from GitHub ^(no Git needed^)...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $z=Join-Path $env:TEMP 'dreamland-main.zip'; $d=Join-Path $env:TEMP 'dreamland-main'; Invoke-WebRequest -UseBasicParsing 'https://github.com/InHard2/DreamLand/archive/refs/heads/main.zip' -OutFile $z; if (Test-Path $d) { Remove-Item -Recurse -Force $d }; Expand-Archive -Force $z $d; $src=(Get-ChildItem $d | Select-Object -First 1).FullName; Copy-Item -Recurse -Force (Join-Path $src '*') '.'; Remove-Item -Recurse -Force $d, $z"
  if errorlevel 1 (
    echo.
    echo   Could not download the update. Check your internet connection and try again.
    echo.
  ) else (
    echo.
    echo   DreamLand is up to date. Your worlds are safe: they live in your browser.
    echo   Reload the game page ^(Ctrl+F5^) to play the new version.
    echo.
  )
  pause
  exit /b
)
