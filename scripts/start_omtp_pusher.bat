@echo off
REM =========================================================
REM  OMTP Log Pusher — OPPO Factory CMMS
REM  Place this file on the factory PC next to omtp_log_pusher.py
REM  Edit the settings below before running.
REM =========================================================

REM ── SETTINGS ─────────────────────────────────────────────
set CMMS_API_URL=https://YOUR_CMMS_URL.replit.app
set CMMS_API_KEY=YOUR_MACHINE_API_KEY_HERE

REM Log root folder (where OMTP_LOG is stored)
set OMTP_LOG=D:\OMTP_LOG

REM Which production line number (check the CMMS → Production Lines page)
set LINE_ID=1

REM How often to read the CSV and push new rows (seconds)
set POLL_INTERVAL=30

REM ── RUN ──────────────────────────────────────────────────
echo Starting OMTP Log Pusher...
echo Log folder : %OMTP_LOG%
echo CMMS URL   : %CMMS_API_URL%
echo Line ID    : %LINE_ID%
echo Poll every : %POLL_INTERVAL% seconds
echo.
echo The model code is read automatically from the CMMS shift setup.
echo Make sure the team leader has entered the model code (e.g. CPH2523)
echo in the Production Capacity page - Shift Setup tab before starting.
echo.

python omtp_log_pusher.py ^
  --api-url %CMMS_API_URL% ^
  --api-key %CMMS_API_KEY% ^
  --log-root %OMTP_LOG% ^
  --line-id %LINE_ID% ^
  --interval %POLL_INTERVAL%

pause
