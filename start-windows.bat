@echo off
title MedScript OPD - Starting Clinic Server...
color 0B

echo =================================================================
echo                 MEDSCRIPT OPD - CLINIC EMR LAUNCHER
echo =================================================================
echo.

:: 1. Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not detected on this system!
    echo Please download and install Node.js (version 20+ recommended) from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 2. Check if dependencies are installed
if not exist "node_modules\" (
    echo [INFO] First-time setup detected. Installing clinic dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies. Check your internet connection.
        pause
        exit /b 1
    )
)

:: 3. Check if database exists, seed if brand new
if not exist "sqlite.db" (
    echo [INFO] Initializing new clinic database...
    call npm run db:seed
)

:: 4. Check if production build exists
if not exist ".next\" (
    echo [INFO] Building MedScript OPD for production...
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Production build failed.
        pause
        exit /b 1
    )
)

:: 5. Open in standalone application window (Edge/Chrome app-mode or default browser)
start "" cmd /c "timeout /t 2 /nobreak >nul & if exist \"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe\" (start \"\" \"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe\" --app=http://localhost:3000) else if exist \"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe\" (start \"\" \"%ProgramFiles%\Microsoft\Edge\Application\msedge.exe\" --app=http://localhost:3000) else if exist \"%ProgramFiles%\Google\Chrome\Application\chrome.exe\" (start \"\" \"%ProgramFiles%\Google\Chrome\Application\chrome.exe\" --app=http://localhost:3000) else (start http://localhost:3000)"

echo.
echo =================================================================
echo  MedScript OPD is LIVE!
echo  Consultation Desk: http://localhost:3000
echo  Press Ctrl+C in this window when you wish to stop the server.
echo =================================================================
echo.

:: 6. Start the server
call npm run start

pause
