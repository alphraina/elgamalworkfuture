@echo off
chcp 65001 > nul
title OMTP Log Pusher — Stop

echo.
echo Stopping OMTP Log Pusher...
echo.

REM ── Remove Task Scheduler task ────────────────────────────────────
schtasks /query /tn "OMTP Log Pusher" > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    schtasks /delete /tn "OMTP Log Pusher" /f > nul 2>&1
    echo [OK] Auto-start task removed.
) else (
    echo [INFO] No auto-start task found.
)

REM ── Kill the running Python pusher process ─────────────────────────
wmic process where "name='python.exe' and commandline like '%%omtp_log_pusher%%'" delete > nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Pusher process stopped.
) else (
    echo [INFO] Pusher was not running.
)

echo.
echo Done. The pusher will not start again until you run OMTP_Setup.bat.
echo.
pause
