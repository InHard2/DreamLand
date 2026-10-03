@echo off
title Update DreamLand
cd /d "%~dp0"
where git >nul 2>nul
if not %errorlevel%==0 (
  echo.
  echo   Updating needs Git. Install it from https://git-scm.com/download/win
  echo   ^(or type: winget install --id Git.Git -e^), then run this file again.
  echo.
  goto end
)
if not exist ".git" (
  echo   First update: linking this folder to GitHub...
  git init -q
  git remote add origin https://github.com/InHard2/DreamLand.git
)
echo   Downloading the latest DreamLand...
git fetch --depth 1 origin main
if not %errorlevel%==0 (
  echo.
  echo   Could not reach GitHub. Check your internet connection and try again.
  echo.
  goto end
)
git checkout -q -f -B main origin/main
git branch -q --set-upstream-to=origin/main main >nul 2>nul
echo.
echo   DreamLand is up to date. Your worlds are safe: they live in your browser.
echo   Reload the game page (Ctrl+F5) to play the new version.
echo.
:end
pause
