#!/usr/bin/env pwsh

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Vercel Auto-Deploy with Environment Setup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "✓ Node.js $nodeVersion found`n" -ForegroundColor Green
} catch {
    Write-Host "✗ Node.js is not installed. Please install Node.js first." -ForegroundColor Red
    exit 1
}

# Install Vercel CLI globally
Write-Host "Installing Vercel CLI..." -ForegroundColor Yellow
npm install -g vercel

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Step 1: Login to Vercel" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
Write-Host "A browser window will open. Please login to Vercel.`n" -ForegroundColor Yellow

npx vercel login

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Step 2: Link Project" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

npx vercel link

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Step 3: Pull Project Info" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

npx vercel pull

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Step 4: Setting Environment Variables" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Function to set environment variable
function Set-VercelEnv {
    param (
        [string]$Name,
        [string]$Value
    )
    
    if ([string]::IsNullOrWhiteSpace($Value)) {
        Write-Host "⚠ Skipping $Name (empty value)" -ForegroundColor Yellow
        return
    }
    
    Write-Host "Setting $Name..." -ForegroundColor Cyan
    
    try {
        # Use echo to pipe value to vercel env add
        $Value | npx vercel env add $Name production 2>&1 | Out-Null
        Write-Host "✓ $Name set successfully" -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed to set $Name (might already exist)" -ForegroundColor Yellow
    }
}

# Read .env file
$envFile = Get-Content .env -ErrorAction SilentlyContinue
$envVars = @{}

foreach ($line in $envFile) {
    if ($line -match '^([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
    }
}

# Set each environment variable
Set-VercelEnv "MONGO_URI" $envVars["MONGO_URI"]
Set-VercelEnv "JWT_SECRET" $envVars["JWT_SECRET"]
Set-VercelEnv "SMTP_HOST" $envVars["SMTP_HOST"]
Set-VercelEnv "SMTP_PORT" $envVars["SMTP_PORT"]
Set-VercelEnv "SMTP_USER" $envVars["SMTP_USER"]
Set-VercelEnv "SMTP_PASS" $envVars["SMTP_PASS"]
Set-VercelEnv "ADMIN_EMAIL" $envVars["ADMIN_EMAIL"]
Set-VercelEnv "NODE_ENV" "production"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Step 5: Deploying to Production" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

npx vercel --prod

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "Your site is now live! Check the URL above." -ForegroundColor Green
Write-Host ""
