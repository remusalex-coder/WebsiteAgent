@echo off
REM factory-start.bat — launches the 24/7 WebsiteAgent factory watchdog.
REM Double-click to start it manually, OR drop a shortcut to THIS file into:
REM   C:\Users\40728\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup
REM so it starts automatically every time you log in.
REM
REM It runs hidden (minimized) and keeps the factory alive forever.

cd /d "%~dp0"
if not exist logs mkdir logs
if exist .factory.lock (
  echo [factory] WARNING: a lock file exists. If the factory is truly not running,
  echo           delete .factory.lock in the WebsiteAgent folder and try again.
)

start "" /min node run-factory.mjs
echo Factory started (minimized). Logs in logs\factory.log
timeout /t 3 >nul
