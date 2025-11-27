const fs = require('fs');
require('dotenv').config();

console.log('\n========================================');
console.log('VERCEL ENVIRONMENT VARIABLES');
console.log('========================================\n');

console.log('Copy and paste these into Vercel Dashboard:');
console.log('Go to: https://vercel.com → Your Project → Settings → Environment Variables\n');
console.log('Add each variable for "Production" environment:\n');

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

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

for (const [key, value] of Object.entries(envVars)) {
    if (!value || value === 'undefined') {
        console.log(`${key} = [NOT SET IN .env FILE]`);
    } else {
        console.log(`${key} = ${value}`);
    }
    console.log('');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('INSTRUCTIONS:');
console.log('1. Go to: https://vercel.com');
console.log('2. Select your project');
console.log('3. Go to Settings → Environment Variables');
console.log('4. For each variable above:');
console.log('   - Click "Add New"');
console.log('   - Paste the Name (left of =)');
console.log('   - Paste the Value (right of =)');
console.log('   - Select "Production"');
console.log('   - Click "Save"');
console.log('5. After adding all variables, redeploy your project\n');

console.log('========================================\n');
