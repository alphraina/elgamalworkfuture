@echo off
REM ─────────────────────────────────────────────────────────────────
REM  OMTP Log Pusher — Silent background launcher
REM  Called by OMTP_Runner.vbs — do NOT run this directly.
REM  Reads saved settings from omtp_config.txt and starts the pusher.
REM  All output goes to omtp_pusher.log in the same folder.
REM ─────────────────────────────────────────────────────────────────

set SCRIPT_DIR=%~dp0
set CONFIG_FILE=%SCRIPT_DIR%omtp_config.txt
set LOG_FILE=%SCRIPT_DIR%omtp_pusher.log

REM ── Load saved config ─────────────────────────────────────────────
if not exist "%CONFIG_FILE%" (
    echo %DATE% %TIME% [ERROR] omtp_config.txt not found. Run OMTP_Setup.bat first. >> "%LOG_FILE%"
    exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in ("%CONFIG_FILE%") do set %%A=%%B

REM ── Validate ──────────────────────────────────────────────────────
if "%SAVED_API_URL%"=="" (
    echo %DATE% %TIME% [ERROR] SAVED_API_URL missing from config. >> "%LOG_FILE%"
    exit /b 1
)
if "%SAVED_API_KEY%"=="" (
    echo %DATE% %TIME% [ERROR] SAVED_API_KEY missing from config. >> "%LOG_FILE%"
    exit /b 1
)
if "%SAVED_LOG_ROOT%"=="" set SAVED_LOG_ROOT=D:\OMTP_LOG
if "%SAVED_LINE_ID%"==""  set SAVED_LINE_ID=0

REM ── Run pusher — output appended to log file ───────────────────────
python "%SCRIPT_DIR%omtp_log_pusher.py" ^
  --api-url "%SAVED_API_URL%" ^
  --api-key "%SAVED_API_KEY%" ^
  --log-root "%SAVED_LOG_ROOT%" ^
  --line-id %SAVED_LINE_ID% ^
  --interval 30 >> "%LOG_FILE%" 2>&1
