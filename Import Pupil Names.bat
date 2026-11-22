@echo off
rem Adds the pupils' names and details from the school's Excel class sheets to the portal, class by class.
rem No attendance registers are loaded (use "Import Class Registers.bat" later for those).
rem Double-click it and it finds the sheets named ..._Pupils_and_Attendance.xlsx on the Desktop and in Downloads,
rem or drag chosen .xlsx files onto it. It asks for the portal's address, the Administrator's email and password,
rem shows what it would do, and changes nothing until you type IMPORT.
title Add pupils to the school portal
cd /d "%~dp0backend"
call npx tsx scripts\import-register.ts --names-only %*
echo.
pause
