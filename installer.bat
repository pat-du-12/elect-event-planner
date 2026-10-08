@echo off
:: Planification des IRD - installation (double-cliquer)
net session >nul 2>&1 || (powershell -Command "Start-Process '%~f0' -Verb RunAs" & exit /b)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\docker\ird.ps1" -Action installer
pause
