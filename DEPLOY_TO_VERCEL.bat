@echo off
echo.
echo ========================================
echo   Vercel Automated Deployment
echo ========================================
echo.

echo Installing Vercel CLI...
call npm install -g vercel
if errorlevel 1 goto error

echo.
echo Logging into Vercel...
echo (A browser window will open)
call npx vercel login
if errorlevel 1 goto error

echo.
echo Deploying to Vercel...
call npx vercel --prod
if errorlevel 1 goto error

echo.
echo ========================================
echo   Deployment Successful!
echo ========================================
echo.
echo Your site is now live!
echo.
goto end

:error
echo.
echo ========================================
echo   Deployment Failed
echo ========================================
echo.
echo Please try again or check the error messages above.
echo.

:end
pause
