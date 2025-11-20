const Redis = require('ioredis');

console.log('🔌 Testing VPS Redis connection...');

const redis = new Redis({
    host: '46.202.141.1',
    port: 6379,
    password: 'overcomer',
    retryStrategy: (times) => {
        if (times > 3) {
            console.error('❌ Max retries reached');
            return null;
        }
        return Math.min(times * 100, 2000);
    }
});

redis.on('connect', () => {
    console.log('✅ VPS Redis connected!');
});

redis.on('ready', async () => {
    console.log('✅ VPS Redis ready!');

    try {
        // Test PING
        const pong = await redis.ping();
        console.log('✅ PING response:', pong);

        // Test SET/GET
        await redis.set('test-key', 'Hello from VPS Redis!');
        const value = await redis.get('test-key');
        console.log('✅ GET test-key:', value);

        // Check connection info
        const info = await redis.info('server');
        const version = info.match(/redis_version:([^\r\n]+)/);
        if (version) {
            console.log('✅ Redis version:', version[1]);
        }

        // Get connection count
        const clients = await redis.client('list');
        const clientCount = clients.split('\n').filter(line => line.trim()).length;
        console.log('✅ Current connections:', clientCount);

        console.log('\n🎉 VPS Redis is fully functional!');
        console.log('✅ You can now use Bull queues without connection limits');

        await redis.quit();
        process.exit(0);
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
});

redis.on('error', (err) => {
    console.error('❌ Redis error:', err.message);
    if (err.message.includes('ECONNREFUSED')) {
        console.error('💡 Make sure Redis is running on your VPS (46.202.141.1:6379)');
    }
    if (err.message.includes('NOAUTH') || err.message.includes('invalid password')) {
        console.error('💡 Password might be incorrect');
    }
    process.exit(1);
});

setTimeout(() => {
    console.error('❌ Connection timeout after 10 seconds');
    process.exit(1);
}, 10000);
