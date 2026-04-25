@echo off
REM Root-level shim: forwards to the canonical launcher in
REM scripts\windows\LAUNCH.bat. Lets you double-click LAUNCH.bat from
REM the repo root in File Explorer without having to navigate three
REM folders deep. Edit scripts\windows\LAUNCH.bat for behaviour changes.
call "%~dp0scripts\windows\LAUNCH.bat" %*
