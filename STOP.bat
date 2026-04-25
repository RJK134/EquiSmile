@echo off
REM Root-level shim: forwards to scripts\windows\DEMO-STOP.bat.
REM Stops the demo stack started by DEMO.bat (Postgres + n8n).
call "%~dp0scripts\windows\DEMO-STOP.bat" %*
