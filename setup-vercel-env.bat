@echo off
echo ========================================
echo Vercel Deployment with Environment Setup
echo ========================================
echo.

echo Step 1: Installing Vercel CLI...
call npm install -g vercel

echo.
echo Step 2: Linking to your Vercel project...
call npx vercel link

echo.
echo Step 3: Setting environment variables...
echo.

REM MongoDB URI
echo Setting MONGO_URI...
echo mongodb+srv://abdulmabudkhan42_db_user:yjYPtIV4pVBYsmgp@cluster0.9iydi6h.mongodb.net/mkcode?retryWrites=true^&w=majority | npx vercel env add MONGO_URI production

REM JWT Secret
echo Setting JWT_SECRET...
echo 00000 | npx vercel env add JWT_SECRET production

REM SMTP Configuration
echo Setting SMTP_HOST...
echo smtp.gmail.com | npx vercel env add SMTP_HOST production

echo Setting SMTP_PORT...
echo 587 | npx vercel env add SMTP_PORT production

echo Setting SMTP_USER...
echo abdulmabudkhan42@gmail.com | npx vercel env add SMTP_USER production

echo Setting SMTP_PASS...
echo ydzl ilaa uqiz cebt | npx vercel env add SMTP_PASS production

echo Setting ADMIN_EMAIL...
echo abdulmabudkhan42@gmail.com | npx vercel env add ADMIN_EMAIL production

echo Setting NODE_ENV...
echo production | npx vercel env add NODE_ENV production

echo.
echo ========================================
echo Step 4: Deploying to production...
echo ========================================
call npx vercel --prod

echo.
echo ========================================
echo Deployment Complete!
echo ========================================
pause
