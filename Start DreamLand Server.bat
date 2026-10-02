@echo off
title DreamLand LAN server
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
  goto end
)
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py
  goto end
)
python --version >nul 2>nul
if %errorlevel%==0 (
  python server.py
  goto end
)
echo.
echo   DreamLand needs Node.js or Python 3 to run its LAN server.
echo   Install one of them (https://nodejs.org or https://www.python.org),
echo   then double-click this file again.
echo.
:end
pause
