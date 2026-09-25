@echo off
title MedScript OPD - Autostart Installer (Windows)
color 0B

echo =================================================================
echo        MEDSCRIPT OPD - WINDOWS AUTOSTART INSTALLER
echo =================================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "TASK_NAME=MedScriptOPD"

:: Check if Node is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not detected! Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

:: Create hidden runner VBS script so no console window stays open
set "VBS_FILE=%SCRIPT_DIR%start-hidden.vbs"
echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_FILE%"
echo WshShell.Run "cmd /c cd /d """ ^& "%SCRIPT_DIR%" ^& """ && npm run start -- -H 0.0.0.0 -p 3000", 0, False >> "%VBS_FILE%"

echo Registering Windows Startup Task '%TASK_NAME%'...
schtasks /create /tn "%TASK_NAME%" /tr "wscript.exe \"%VBS_FILE%\"" /sc onlogon /f /rl highest

if %errorlevel% equ 0 (
    echo.
    echo =================================================================
    echo  SUCCESS! MedScript OPD is now configured to start automatically
    echo  whenever this computer starts up or you log into Windows.
    echo.
    echo  • To start it now: schtasks /run /tn "%TASK_NAME%"
    echo  • To remove autostart: Run 'uninstall-windows-service.bat'
    echo =================================================================
    echo.
    echo Starting service now...
    schtasks /run /tn "%TASK_NAME%"
) else (
    echo [WARNING] Failed to register with elevated privileges. Retrying standard user task...
    schtasks /create /tn "%TASK_NAME%" /tr "wscript.exe \"%VBS_FILE%\"" /sc onlogon /f
)

pause
