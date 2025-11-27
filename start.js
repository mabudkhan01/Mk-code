#!/usr/bin/env node

/**
 * MKcode Unified Server Launcher
 * Starts both backend and frontend servers
 */

const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const isWindows = os.platform() === 'win32';

console.log('\n========================================');
console.log('     MKcode IT Solutions');
console.log('     Unified Server Launcher');
console.log('========================================\n');

// Check if http-server is installed
const checkHttpServer = spawn('npx', ['http-server', '--version'], { shell: true });
checkHttpServer.on('close', (code) => {
    if (code !== 0) {
        console.log('[INFO] http-server not found, installing...');
    }
});

let backendProcess, frontendProcess;

// Start Backend Server
console.log('[1/2] Starting Backend Server (Port 5000)...');
backendProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    shell: true,
    stdio: 'inherit'
});

backendProcess.on('error', (err) => {
    console.error('Failed to start backend server:', err);
    process.exit(1);
});

// Wait 3 seconds before starting frontend
setTimeout(() => {
    console.log('[2/2] Starting Frontend Server (Port 3000)...');
    frontendProcess = spawn('npx', ['http-server', '-p', '3000', '-c-1'], {
        cwd: __dirname,
        shell: true,
        stdio: 'inherit'
    });

    frontendProcess.on('error', (err) => {
        console.error('Failed to start frontend server:', err);
        process.exit(1);
    });

    // Wait 3 more seconds then open browser
    setTimeout(() => {
        console.log('\n========================================');
        console.log('     Servers are running!');
        console.log('========================================');
        console.log('\nBackend:  http://localhost:5000');
        console.log('Frontend: http://localhost:3000\n');
        console.log('Opening website...\n');

        const openCommand = isWindows ? 'start' : (os.platform() === 'darwin' ? 'open' : 'xdg-open');
        spawn(openCommand, ['http://localhost:3000/index.html'], { shell: true });

        console.log('Press Ctrl+C to stop all servers\n');
    }, 3000);
}, 3000);

// Handle cleanup on exit
process.on('SIGINT', () => {
    console.log('\n\nShutting down servers...');
    if (backendProcess) backendProcess.kill();
    if (frontendProcess) frontendProcess.kill();
    process.exit(0);
});

process.on('exit', () => {
    if (backendProcess) backendProcess.kill();
    if (frontendProcess) frontendProcess.kill();
});
