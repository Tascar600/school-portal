@echo off
rem Adds the pupils' names and details from the school's Excel class sheets to the portal, class by class.
rem No attendance registers are loaded (use "Import Class Registers.bat" later for those).
rem Double-click it and it finds the class sheets (..._Pupils_and_Attendance.xlsx and ..._Pupil_Details.xlsx) on the Desktop,
rem in Downloads, and in any folder there with "class", "register" or "pupil" in its name; or drag chosen .xlsx files onto it.
rem It asks for the portal's address, the Administrator's email and password, shows what it would do,
rem and changes nothing until you type IMPORT.
title Add pupils to the school portal
cd /d "%~dp0backend"
call npx tsx scripts\import-register.ts --names-only %*
echo.
pause
