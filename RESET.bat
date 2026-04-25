@echo off
REM Root-level shim: forwards to the canonical reset launcher in
REM scripts\windows\RESET.bat. Hard-resets the demo (drops the
REM Postgres volume + reseeds). Use this when the app shows
REM "Internal Server Error" after a big update.
call "%~dp0scripts\windows\RESET.bat" %*
