const { execSync } = require('child_process');
const fs = require('fs');
require('dotenv').config();

console.log('========================================');
console.log('Vercel Environment Variables Setup');
console.log('========================================\n');

// Environment variables to set
const envVars = {
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
    FRONTEND_URL: process.env.FRONTEND_URL || 'https://your-site.vercel.app',
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL || process.env.SMTP_USER,
    NODE_ENV: 'production'
};

function runCommand(command) {
    try {
        return execSync(command, { stdio: 'inherit' });
    } catch (error) {
        console.error(`Error running command: ${command}`);
        return null;
    }
}

async function setup() {
    // Check if Vercel CLI is installed
    console.log('Checking Vercel CLI...');
    try {
        execSync('npx vercel --version', { stdio: 'pipe' });
        console.log('✓ Vercel CLI found\n');
    } catch {
        console.log('Installing Vercel CLI...');
        runCommand('npm install -g vercel');
    }

    // Link project
    console.log('Linking to Vercel project...');
    runCommand('npx vercel link');

    // Set environment variables
    console.log('\nSetting environment variables...');
    for (const [key, value] of Object.entries(envVars)) {
        if (!value) {
            console.log(`⚠ Skipping ${key} (not set in .env)`);
            continue;
        }
        
        console.log(`Setting ${key}...`);
        
        // Create temp file with the value
        const tempFile = `.temp_${key}`;
        fs.writeFileSync(tempFile, value);
        
        try {
            execSync(`npx vercel env add ${key} production < ${tempFile}`, { stdio: 'inherit' });
            console.log(`✓ ${key} set`);
        } catch (error) {
            console.log(`✗ Failed to set ${key}`);
        } finally {
            // Clean up temp file
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }
        }
    }

    console.log('\n========================================');
    console.log('Deploying to Vercel...');
    console.log('========================================\n');
    
    runCommand('npx vercel --prod');

    console.log('\n========================================');
    console.log('✓ Deployment Complete!');
    console.log('========================================');
}

setup().catch(console.error);
