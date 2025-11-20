/**
 * Script to trigger cache clear via the debug endpoint
 */

const http = require('http');

// Read cookies from file if available
const fs = require('fs');
const cookiePath = './cookies.txt';

let cookies = '';
if (fs.existsSync(cookiePath)) {
    cookies = fs.readFileSync(cookiePath, 'utf8').trim();
}

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/debug/clear-cache',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || 'accessToken=your-token-here'
    }
};

console.log('🔄 Clearing workspace cache...\n');

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const result = JSON.parse(data);
            if (result.success) {
                console.log('✅ Cache cleared successfully!');
                console.log('📝 Message:', result.message);
                console.log('👤 User ID:', result.userId);
                console.log('\n✨ Now refresh your browser and try accessing AI Diagnostics again!');
            } else {
                console.log('❌ Failed to clear cache:', result);
            }
        } catch (error) {
            console.log('Response:', data);
        }
    });
});

req.on('error', (error) => {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   1. Backend is running (npm run dev)');
    console.log('   2. You are logged in and have a valid session');
    console.log('   3. NODE_ENV=development in your .env file');
});

req.end();
