@echo off
title MedScript OPD - Clinic LAN Multi-Device Mode
color 0A

echo =================================================================
echo         MEDSCRIPT OPD - CLINIC MULTI-DEVICE LAN LAUNCHER
echo =================================================================
echo.

if not exist "node_modules\" (
    call npm install
)

if not exist ".next\" (
    call npm run build
)

echo.
echo =================================================================
echo  MedScript OPD is accessible to all devices on your Clinic Wi-Fi!
echo.
echo  • On this PC:           http://localhost:3000
echo  • On other devices:     Open your PC's IP address on port 3000
echo    (Check your IP via 'ipconfig' command, e.g. http://192.168.1.50:3000)
echo.
echo  Press Ctrl+C to stop the server.
echo =================================================================
echo.

call npm run start -- -H 0.0.0.0 -p 3000

pause
