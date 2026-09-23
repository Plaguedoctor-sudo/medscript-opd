@echo off
:: MedScript OPD - Scheduled Daily Backup Task for Windows Task Scheduler
cd /d "%~dp0"
call npm run db:backup
