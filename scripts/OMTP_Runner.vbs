' ─────────────────────────────────────────────────────────────────
'  OMTP_Runner.vbs — Invisible background launcher
'  Runs OMTP_Silent.bat with NO window, NO taskbar entry.
'  Called by Windows Task Scheduler at login.
'  Do NOT double-click this file to start — use OMTP_Setup.bat.
' ─────────────────────────────────────────────────────────────────

Dim shell, fso, dir, cmd

Set shell = CreateObject("WScript.Shell")
Set fso   = CreateObject("Scripting.FileSystemObject")

' Get the folder where this VBS file lives
dir = fso.GetParentFolderName(WScript.ScriptFullName)

' Build the command — run cmd.exe which runs the silent BAT
' Window style 0 = completely hidden, False = don't wait (fire and forget)
cmd = "cmd.exe /c """ & dir & "\OMTP_Silent.bat"""

shell.Run cmd, 0, False
