@echo off
rem Starts the school portal with a full sample school. Works with no internet.
rem Double-click to start. To start again with a fresh sample school, run:  "Start Demo.bat" --reset
title School Portal demo
cd /d "%~dp0backend"
node scripts\demo.mjs %*
echo.
pause
