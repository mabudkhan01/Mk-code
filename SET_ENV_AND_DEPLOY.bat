@echo off
echo.
echo ========================================
echo   Setting Vercel Environment Variables
echo ========================================
echo.

echo Adding MONGO_URI...
echo mongodb+srv://abdulmabudkhan42_db_user:yjYPtIV4pVBYsmgp@cluster0.9iydi6h.mongodb.net/mkcode?retryWrites=true^&w=majority | npx vercel env add MONGO_URI production

echo.
echo Adding JWT_SECRET...
echo 00000 | npx vercel env add JWT_SECRET production

echo.
echo Adding SMTP_HOST...
echo smtp.gmail.com | npx vercel env add SMTP_HOST production

echo.
echo Adding SMTP_PORT...
echo 587 | npx vercel env add SMTP_PORT production

echo.
echo Adding SMTP_USER...
echo abdulmabudkhan42@gmail.com | npx vercel env add SMTP_USER production

echo.
echo Adding SMTP_PASS...
echo ydzl ilaa uqiz cebt | npx vercel env add SMTP_PASS production

echo.
echo Adding ADMIN_EMAIL...
echo abdulmabudkhan42@gmail.com | npx vercel env add ADMIN_EMAIL production

echo.
echo Adding NODE_ENV...
echo production | npx vercel env add NODE_ENV production

echo.
echo ========================================
echo   Environment Variables Set!
echo ========================================
echo.
echo Now redeploying...
call npx vercel --prod

echo.
echo ========================================
echo   Done! Your site should work now.
echo ========================================
echo.
pause
