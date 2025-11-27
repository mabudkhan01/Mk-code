@echo off
title MKcode - Unified Server
color 0A

echo.
echo ========================================
echo      MKcode IT Solutions
echo      Unified Server Launcher
echo ========================================
echo.
echo [1/3] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)
echo      Node.js found!

echo.
echo [2/3] Starting Backend Server (Port 5000)...
start "MKcode Backend" cmd /k "cd /d %~dp0 && node server.js"
timeout /t 3 /nobreak >nul

echo [3/3] Starting Frontend Server (Port 3000)...
start "MKcode Frontend" cmd /k "cd /d %~dp0 && npx http-server -p 3000 -c-1"
timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo      Servers are starting...
echo ========================================
echo.
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:3000
echo.
echo Opening website in 5 seconds...
timeout /t 5 /nobreak >nul

start http://localhost:3000/index.html

echo.
echo ========================================
echo      MKcode is now running!
echo ========================================
echo.
echo To stop servers: Close the terminal windows
echo or press Ctrl+C in each window
echo.
echo This window can be closed safely.
echo.
pause
