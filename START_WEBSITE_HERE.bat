@echo off
echo.
echo ============================================
echo    MKcode Website Launcher
echo ============================================
echo.
echo IMPORTANT: This file starts your ENTIRE website!
echo.
echo What will happen:
echo   1. Backend server starts (port 5000)
echo   2. Frontend server starts (port 3000)  
echo   3. Browser opens automatically
echo   4. Your website will be ready!
echo.
echo Please wait 10 seconds...
echo.
echo Starting Backend Server...
start "MKcode Backend" cmd /k "cd /d %~dp0 && node server.js"
timeout /t 3 /nobreak >nul

echo Starting Frontend Server...
start "MKcode Frontend" cmd /k "cd /d %~dp0 && npx http-server -p 3000 -c-1"
timeout /t 5 /nobreak >nul

echo Opening Browser...
start http://localhost:3000/index.html

echo.
echo ============================================
echo    ✅ MKcode Website is Now Running!
echo ============================================
echo.
echo Your website: http://localhost:3000/index.html
echo Backend API:  http://localhost:5000/api
echo.
echo To STOP the servers:
echo   - Close the Backend and Frontend windows
echo   - Or press Ctrl+C in each window
echo.
echo Keep this window open to see status messages.
echo.
pause
