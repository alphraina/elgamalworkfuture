@echo off
chcp 65001 > nul
title OPPO CMMS — OMTP Log Pusher Setup

REM ─────────────────────────────────────────────────────────────────
REM  This script will ask you a few questions then start pushing
REM  CSV log files from D:\OMTP_LOG to the CMMS Machine Monitor.
REM ─────────────────────────────────────────────────────────────────

echo.
echo ╔══════════════════════════════════════════════════════════╗
echo ║       OPPO CMMS — OMTP Log Pusher Setup                 ║
echo ╚══════════════════════════════════════════════════════════╝
echo.

REM ── Check Python ──────────────────────────────────────────────────
python --version > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python is not installed.
    echo.
    echo Please download and install Python from:
    echo   https://www.python.org/downloads/
    echo.
    echo During installation, tick "Add Python to PATH"
    echo Then run this file again.
    echo.
    pause
    exit /b 1
)

REM ── Install required packages ──────────────────────────────────────
echo [1/4] Checking required packages...
python -m pip install requests -q
echo       Done.
echo.

REM ── Config file ───────────────────────────────────────────────────
set CONFIG_FILE=%~dp0omtp_config.txt

if exist "%CONFIG_FILE%" (
    echo [INFO] Found saved settings in omtp_config.txt
    echo        Loading saved settings...
    for /f "tokens=1,* delims==" %%A in (%CONFIG_FILE%) do (
        set %%A=%%B
    )
    echo.
    echo Current settings:
    echo   CMMS URL  : %SAVED_API_URL%
    echo   Line ID   : %SAVED_LINE_ID%
    echo   Log Root  : %SAVED_LOG_ROOT%
    echo.
    set /p USE_SAVED=Use these settings? (Y/N): 
    if /i "%USE_SAVED%"=="Y" goto :run
    if /i "%USE_SAVED%"=="y" goto :run
    echo.
    echo OK, let's enter new settings...
    echo.
)

REM ── Ask for settings ──────────────────────────────────────────────
echo [2/4] Enter your CMMS settings
echo.

:ask_url
set /p SAVED_API_URL=CMMS Website URL (e.g. https://yourapp.replit.app): 
if "%SAVED_API_URL%"=="" (
    echo Please enter the URL.
    goto :ask_url
)

:ask_key
set /p SAVED_API_KEY=Machine API Key (from CMMS Factory Settings): 
if "%SAVED_API_KEY%"=="" (
    echo Please enter the API key.
    goto :ask_key
)

:ask_line
set /p SAVED_LINE_ID=Production Line ID (number, e.g. 1 or 2): 
if "%SAVED_LINE_ID%"=="" set SAVED_LINE_ID=1

set SAVED_LOG_ROOT=D:\OMTP_LOG
set /p SAVED_LOG_ROOT=Log Root Folder (press Enter to use D:\OMTP_LOG): 
if "%SAVED_LOG_ROOT%"=="" set SAVED_LOG_ROOT=D:\OMTP_LOG

REM ── Save config ────────────────────────────────────────────────────
(
    echo SAVED_API_URL=%SAVED_API_URL%
    echo SAVED_API_KEY=%SAVED_API_KEY%
    echo SAVED_LINE_ID=%SAVED_LINE_ID%
    echo SAVED_LOG_ROOT=%SAVED_LOG_ROOT%
) > "%CONFIG_FILE%"
echo.
echo [3/4] Settings saved to omtp_config.txt
echo.

:run
REM ── Register silent auto-start via Task Scheduler ─────────────────
echo [4/5] Registering auto-start task (runs silently on every login)...
set TASK_NAME=OMTP Log Pusher
set VBS_PATH=%~dp0OMTP_Runner.vbs

REM Remove old task first (ignore error if it doesn't exist)
schtasks /delete /tn "%TASK_NAME%" /f > nul 2>&1

REM Create new task: runs as the current user, at logon, highest privileges
schtasks /create ^
  /tn "%TASK_NAME%" ^
  /tr "wscript.exe //nologo \"%VBS_PATH%\"" ^
  /sc ONLOGON ^
  /ru "%USERNAME%" ^
  /rl HIGHEST ^
  /f > nul 2>&1

if %ERRORLEVEL% EQU 0 (
    echo       Auto-start registered. Pusher will start silently on every login.
) else (
    echo       [WARN] Could not register auto-start task. Run as Administrator to enable.
)
echo.

REM ── Start it NOW in background (no window) ─────────────────────────
echo [5/5] Starting pusher in background (no window will appear)...
wscript.exe //nologo "%VBS_PATH%"
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  OMTP Log Pusher is now running silently in background.   ║
echo ║                                                            ║
echo ║  • No window will appear while it is running.             ║
echo ║  • It will restart automatically on every PC login.       ║
echo ║  • Logs are saved to: omtp_pusher.log                     ║
echo ║  • To stop it: run OMTP_Stop.bat                          ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
pause
