#!/usr/bin/env node

/**
 * Debug Upstash Redis URL Parsing
 * This script helps debug the URL parsing issue
 */

const Redis = require('ioredis');

// Your Upstash Redis URL
const UPSTASH_URL = process.env.REDIS_URL || 'rediss://default:AUurAAIncDIzMWUwMTFiZDNjZmU0ODNiOWZjYmYxYTEzNjJkMzZiNHAyMTkzNzE@boss-octopus-19371.upstash.io:6379';

console.log('🔍 Debugging Upstash Redis URL Parsing\n');
console.log('='.repeat(60));

console.log('\n📋 Original URL:');
console.log(UPSTASH_URL.replace(/:[^:@]+@/, ':***@'));

// Parse URL manually
const urlMatch = UPSTASH_URL.match(/rediss?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);

if (urlMatch) {
    const [, username, password, host, port] = urlMatch;
    console.log('\n✅ URL Parsing Result:');
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${password.substring(0, 5)}...${password.substring(password.length - 5)}`);
    console.log(`   Host: ${host}`);
    console.log(`   Port: ${port}`);
} else {
    console.log('\n❌ Failed to parse URL');
}

// Test with ioredis URL parsing (direct URL)
console.log('\n\n🧪 Test 1: Using URL directly (ioredis auto-parse)');
console.log('='.repeat(60));

const client1 = new Redis(UPSTASH_URL, {
    maxRetriesPerRequest: null,
    connectTimeout: 5000,
    tls: {
        rejectUnauthorized: true,
    },
});

client1.on('error', (err) => {
    console.log(`❌ Error: ${err.message}`);
});

client1.on('ready', async () => {
    console.log('✅ Connected successfully with URL parsing!');
    try {
        const pong = await client1.ping();
        console.log(`✅ PING: ${pong}`);
        await client1.quit();
    } catch (err) {
        console.log(`❌ Command error: ${err.message}`);
        client1.disconnect();
    }
});

// Wait a bit then try manual parsing
setTimeout(async () => {
    console.log('\n\n🧪 Test 2: Using manual parsing');
    console.log('='.repeat(60));

    const urlMatch2 = UPSTASH_URL.match(/rediss?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);

    if (urlMatch2) {
        const [, username, password, host, port] = urlMatch2;

        const client2 = new Redis({
            host,
            port: parseInt(port),
            username,
            password,
            maxRetriesPerRequest: null,
            connectTimeout: 5000,
            tls: {
                rejectUnauthorized: true,
            },
        });

        client2.on('error', (err) => {
            console.log(`❌ Error: ${err.message}`);
        });

        client2.on('ready', async () => {
            console.log('✅ Connected successfully with manual parsing!');
            try {
                const pong = await client2.ping();
                console.log(`✅ PING: ${pong}`);

                // Test operations
                await client2.set('test:key', 'test:value', 'EX', 10);
                const value = await client2.get('test:key');
                console.log(`✅ SET/GET: ${value}`);

                await client2.quit();
                console.log('\n✅ All tests passed!');
                process.exit(0);
            } catch (err) {
                console.log(`❌ Command error: ${err.message}`);
                client2.disconnect();
                process.exit(1);
            }
        });
    }
}, 3000);

// Timeout
setTimeout(() => {
    console.log('\n⏱️  Test timeout - check your connection');
    process.exit(1);
}, 10000);
