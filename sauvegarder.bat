@echo off
:: Planification des IRD - sauvegarde (double-cliquer, ou planifier chaque nuit)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\docker\ird.ps1" -Action sauvegarder
if "%1"=="" pause
