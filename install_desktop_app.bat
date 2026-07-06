@echo off
title MemoFlow Desktop Shortcut Creator
echo Creating desktop shortcut for MemoFlow...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_desktop_app.ps1"
echo Done.
pause
