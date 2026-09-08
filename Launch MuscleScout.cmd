@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS, then reopen MuscleScout.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm install
  if errorlevel 1 exit /b 1
)
call npm run setup
if errorlevel 1 exit /b 1
call npm run dev
pause
