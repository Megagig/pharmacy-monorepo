#!/usr/bin/env node

/**
 * Test Upstash Redis Connection
 * This script tests the connection to Upstash Redis with TLS
 */

const Redis = require('ioredis');

// Your Upstash Redis URL
const UPSTASH_URL = process.env.REDIS_URL || 'rediss://default:AUurAAIncDIzMWUwMTFiZDNjZmU0ODNiOWZjYmYxYTEzNjJkMzZiNHAyMTkzNzE@boss-octopus-19371.upstash.io:6379';

console.log('🧪 Upstash Redis Connection Test\n');
console.log('='.repeat(60));

async function testUpstashConnection() {
    console.log(`\n📡 Testing Upstash Redis Connection...`);
    console.log(`URL: ${UPSTASH_URL.replace(/:[^:@]+@/, ':***@')}\n`);

    // Detect TLS
    const useTLS = UPSTASH_URL.startsWith('rediss://');

    // Parse URL
    const urlMatch = UPSTASH_URL.match(/rediss?:\/\/:?([^@]*)@([^:]+):(\d+)/);

    if (!urlMatch) {
        console.log('❌ Invalid URL format\n');
        return false;
    }

    const [, password, host, portStr] = urlMatch;
    const port = parseInt(portStr, 10);

    console.log(`🔐 Protocol: ${useTLS ? 'rediss:// (TLS)' : 'redis://'}`);
    console.log(`🏠 Host: ${host}`);
    console.log(`🔌 Port: ${port}`);
    console.log(`🔑 Password: ${password.substring(0, 5)}...${password.substring(password.length - 5)}\n`);

    const client = new Redis({
        host,
        port,
        password: password || undefined,
        maxRetriesPerRequest: null,
        lazyConnect: false,
        connectTimeout: 10000,
        commandTimeout: 5000,
        enableOfflineQueue: true,

        // TLS configuration for Upstash
        ...(useTLS && {
            tls: {
                rejectUnauthorized: true, // Verify SSL certificate
            },
        }),

        retryStrategy: (times) => {
            if (times > 3) {
                console.log(`❌ Max retry attempts (3) reached`);
                return null;
            }
            console.log(`🔄 Retry attempt ${times}...`);
            return Math.min(times * 500, 2000);
        },
    });

    return new Promise((resolve) => {
        let resolved = false;

        const timeout = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                console.log('❌ Connection timeout (10 seconds)\n');
                client.disconnect();
                resolve(false);
            }
        }, 10000);

        client.on('connect', () => {
            console.log('✅ Connected to Upstash Redis');
        });

        client.on('ready', async () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);

                try {
                    console.log('✅ Redis ready to accept commands');

                    // Test ping
                    const pong = await client.ping();
                    console.log(`✅ PING test: ${pong}`);

                    // Test set/get
                    await client.set('test:upstash:connection', 'success', 'EX', 10);
                    const value = await client.get('test:upstash:connection');
                    console.log(`✅ SET/GET test: ${value}`);

                    // Test delete
                    await client.del('test:upstash:connection');
                    console.log(`✅ DEL test: success`);

                    // Get server info
                    const info = await client.info('server');
                    const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
                    console.log(`✅ Redis version: ${version}`);

                    // Test cache operations
                    console.log('\n📦 Testing cache operations...');

                    // Set with expiration
                    await client.setex('test:cache:key1', 60, JSON.stringify({ data: 'test' }));
                    const cached = await client.get('test:cache:key1');
                    console.log(`✅ Cache SET/GET: ${cached ? 'success' : 'failed'}`);

                    // Test TTL
                    const ttl = await client.ttl('test:cache:key1');
                    console.log(`✅ Cache TTL: ${ttl} seconds`);

                    // Cleanup
                    await client.del('test:cache:key1');

                    console.log(`\n✅ Upstash Redis Connection - SUCCESS!\n`);
                    console.log('='.repeat(60));
                    console.log('\n🎉 Your Upstash Redis is working perfectly!');
                    console.log('\n📋 Next Steps:');
                    console.log('   1. Add this URL to backend/.env:');
                    console.log(`      REDIS_URL="${UPSTASH_URL}"`);
                    console.log('   2. Add the same URL to Render environment variables');
                    console.log('   3. Deploy and verify\n');

                    await client.quit();
                    resolve(true);
                } catch (error) {
                    console.log(`❌ Error during tests: ${error.message}\n`);
                    client.disconnect();
                    resolve(false);
                }
            }
        });

        client.on('error', (err) => {
            if (!resolved) {
                console.log(`❌ Connection error: ${err.message}`);

                if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
                    console.log('   → DNS resolution failed - hostname not found');
                } else if (err.message.includes('ETIMEDOUT')) {
                    console.log('   → Connection timeout - host unreachable');
                } else if (err.message.includes('ECONNREFUSED')) {
                    console.log('   → Connection refused - wrong port or firewall');
                } else if (err.message.includes('WRONGPASS') || err.message.includes('NOAUTH')) {
                    console.log('   → Authentication failed - wrong password');
                } else if (err.message.includes('certificate')) {
                    console.log('   → TLS certificate error - check SSL configuration');
                }
            }
        });

        client.on('close', () => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                console.log('❌ Connection closed unexpectedly\n');
                resolve(false);
            }
        });
    });
}

async function main() {
    const result = await testUpstashConnection();

    if (!result) {
        console.log('='.repeat(60));
        console.log('\n❌ Connection test failed!');
        console.log('\n🔍 Troubleshooting:');
        console.log('   1. Verify the REDIS_URL is correct');
        console.log('   2. Check Upstash dashboard for connection details');
        console.log('   3. Ensure your IP is not blocked');
        console.log('   4. Verify TLS is properly configured\n');
        process.exit(1);
    }

    process.exit(0);
}

main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
