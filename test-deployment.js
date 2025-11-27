const https = require('https');

const SITE_URL = 'https://mk-code-mvm2y7sv3-mkcodes-projects.vercel.app';

function testEndpoint(path, description) {
    return new Promise((resolve) => {
        console.log(`\nTesting: ${description}`);
        console.log(`URL: ${SITE_URL}${path}`);
        
        https.get(SITE_URL + path, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`✓ SUCCESS (${res.statusCode})`);
                    try {
                        const json = JSON.parse(data);
                        console.log('Response:', JSON.stringify(json, null, 2).substring(0, 200));
                    } catch {
                        console.log('Response:', data.substring(0, 200));
                    }
                } else if (res.statusCode >= 400 && res.statusCode < 500) {
                    console.log(`⚠ CLIENT ERROR (${res.statusCode})`);
                    console.log('Response:', data.substring(0, 200));
                } else if (res.statusCode >= 500) {
                    console.log(`✗ SERVER ERROR (${res.statusCode})`);
                    console.log('Response:', data.substring(0, 500));
                } else {
                    console.log(`→ REDIRECT or OTHER (${res.statusCode})`);
                }
                resolve(res.statusCode);
            });
        }).on('error', (err) => {
            console.log(`✗ REQUEST FAILED: ${err.message}`);
            resolve(null);
        });
    });
}

async function runTests() {
    console.log('========================================');
    console.log('   Testing Vercel Deployment');
    console.log('========================================');
    console.log(`Site: ${SITE_URL}\n`);
    
    const tests = [
        ['/', 'Homepage (Static File)'],
        ['/index.html', 'Index HTML'],
        ['/api/health', 'API Health Check'],
        ['/api/users/count', 'API Users Count'],
        ['/login.html', 'Login Page'],
    ];
    
    const results = [];
    
    for (const [path, description] of tests) {
        const status = await testEndpoint(path, description);
        results.push({ path, description, status });
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait between requests
    }
    
    console.log('\n========================================');
    console.log('   Test Summary');
    console.log('========================================\n');
    
    results.forEach(({ path, description, status }) => {
        const icon = status === 200 ? '✓' : status >= 500 ? '✗' : '⚠';
        console.log(`${icon} ${description.padEnd(30)} ${status || 'FAILED'}`);
    });
    
    const allOk = results.every(r => r.status === 200);
    
    console.log('\n========================================');
    if (allOk) {
        console.log('✓ All tests passed!');
    } else {
        console.log('⚠ Some tests failed - check logs above');
    }
    console.log('========================================\n');
}

runTests().catch(console.error);
