@echo off
REM Root-level shim: forwards to the canonical launcher in
REM scripts\windows\DEMO.bat. Lets you double-click DEMO.bat from
REM the repo root in File Explorer without having to navigate three
REM folders deep. Edit scripts\windows\DEMO.bat for behaviour changes.
call "%~dp0scripts\windows\DEMO.bat" %*
