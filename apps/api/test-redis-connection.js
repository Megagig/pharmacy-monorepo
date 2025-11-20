/**
 * Quick Redis Connection Test Script
 * Run this before starting the server to verify Redis connectivity
 */

const Redis = require('ioredis');
require('dotenv').config();

async function testRedisConnection() {
  console.log('🔍 Testing Redis Connection...\n');

  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.error('❌ REDIS_URL not found in environment variables');
    console.log('   Please add REDIS_URL to your .env file');
    process.exit(1);
  }

  console.log(`📡 Connecting to: ${redisUrl.replace(/:[^:@]+@/, ':****@')}`);

  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    connectTimeout: 10000,
    lazyConnect: true,
  });

  try {
    // Test connection
    console.log('⏳ Attempting to connect...');
    await redis.connect();
    console.log('✅ Connected successfully!\n');

    // Test PING
    console.log('⏳ Testing PING...');
    const pong = await redis.ping();
    console.log(`✅ PING response: ${pong}\n`);

    // Test SET
    console.log('⏳ Testing SET...');
    await redis.set('test:connection', 'success', 'EX', 60);
    console.log('✅ SET successful\n');

    // Test GET
    console.log('⏳ Testing GET...');
    const value = await redis.get('test:connection');
    console.log(`✅ GET successful: ${value}\n`);

    // Test DEL
    console.log('⏳ Testing DEL...');
    await redis.del('test:connection');
    console.log('✅ DEL successful\n');

    // Get Redis info
    console.log('⏳ Getting Redis info...');
    const info = await redis.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
    const mode = info.match(/redis_mode:([^\r\n]+)/)?.[1];
    console.log(`✅ Redis Version: ${version}`);
    console.log(`✅ Redis Mode: ${mode}\n`);

    // Test pub/sub (for presence tracking)
    console.log('⏳ Testing Pub/Sub...');
    const subscriber = redis.duplicate();
    await subscriber.subscribe('test:channel');
    
    subscriber.on('message', (channel, message) => {
      console.log(`✅ Pub/Sub working! Received: ${message}\n`);
      subscriber.disconnect();
    });

    await redis.publish('test:channel', 'Hello from test!');
    
    // Wait a bit for pub/sub
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('🎉 All Redis tests passed!\n');
    console.log('✅ Your Redis server is ready for:');
    console.log('   - Caching');
    console.log('   - Background jobs (Bull queues)');
    console.log('   - Presence tracking (pub/sub)');
    console.log('   - Real-time features\n');

    await redis.disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Redis connection test failed!\n');
    console.error('Error:', error.message);
    console.error('\nPossible issues:');
    console.error('1. Redis server is not running on your VPS');
    console.error('2. Firewall blocking port 6379');
    console.error('3. Incorrect password in REDIS_URL');
    console.error('4. Network connectivity issues\n');
    console.error('Troubleshooting:');
    console.error('- Check Redis is running: sudo systemctl status redis');
    console.error('- Check firewall: sudo ufw status');
    console.error('- Test manually: redis-cli -h HOST -p 6379 -a PASSWORD ping\n');
    
    await redis.disconnect();
    process.exit(1);
  }
}

testRedisConnection();
