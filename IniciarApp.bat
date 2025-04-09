@echo off
cd /d "%~dp0"
start cmd /c "npm start"
timeout /t 3 >nul
