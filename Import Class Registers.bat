@echo off
rem Loads class lists and attendance registers from the school's Excel sheets into the portal.
rem Double-click it, or drag one or more of the .xlsx files onto it.
rem It asks for the portal's address, the Administrator's email and password, shows what it
rem would do, and changes nothing until you type IMPORT.
title Load class registers into the school portal
cd /d "%~dp0backend"
if "%~1"=="" (
  echo.
  echo Drag the Excel sheets onto this file, or type their full paths after the file name.
  echo Example:  "Import Class Registers.bat" "C:\Users\you\Desktop\Chakari_ECD_A_2026_Pupils_and_Attendance.xlsx"
  echo.
  pause
  exit /b 1
)
call npx tsx scripts\import-register.ts %*
echo.
pause
