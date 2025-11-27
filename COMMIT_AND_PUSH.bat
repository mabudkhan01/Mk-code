@echo off
echo.
echo ========================================
echo   Committing and Deploying to Vercel
echo ========================================
echo.

echo Checking git installation...
where git >nul 2>&1
if errorlevel 1 (
    echo Git is not installed or not in PATH
    echo Please use GitHub Desktop or install Git
    echo.
    echo Alternative: Manual deployment
    echo 1. Open GitHub Desktop
    echo 2. Commit your changes
    echo 3. Push to main branch
    echo 4. Vercel will auto-deploy
    pause
    exit /b 1
)

echo Adding files...
git add .

echo Committing changes...
git commit -m "Fix: Improve serverless function error handling and database connection"

echo Pushing to GitHub...
git push

echo.
echo ========================================
echo   Pushed! Vercel will auto-deploy
echo ========================================
echo.
echo Check deployment status at:
echo https://vercel.com/mkcodes-projects/mk-code
echo.
pause
