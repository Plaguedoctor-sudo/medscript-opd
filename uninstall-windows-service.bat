@echo off
title MedScript OPD - Autostart Removal (Windows)
color 0C

echo =================================================================
echo        MEDSCRIPT OPD - WINDOWS AUTOSTART REMOVER
echo =================================================================
echo.

set "TASK_NAME=MedScriptOPD"
set "SCRIPT_DIR=%~dp0"
set "VBS_FILE=%SCRIPT_DIR%start-hidden.vbs"

echo Removing Windows Startup Task '%TASK_NAME%'...
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

if exist "%VBS_FILE%" (
    del "%VBS_FILE%" >nul 2>&1
)

echo.
echo =================================================================
echo  MedScript OPD autostart task has been removed from Windows.
echo =================================================================
echo.
pause
