const Redis = require('ioredis');

console.log('🧪 Testing VPS Redis external accessibility...\n');

const redis = new Redis({
  host: '46.202.141.1',
  port: 6379,
  password: 'overcomer',
  connectTimeout: 5000,
  lazyConnect: true
});

redis.on('error', (err) => {
  console.error('❌ Connection Error:', err.message);
  process.exit(1);
});

redis.connect()
  .then(() => redis.ping())
  .then((result) => {
    console.log('✅ SUCCESS! VPS Redis is externally accessible');
    console.log('✅ PING response:', result);
    console.log('\n🎉 Render will be able to connect to your VPS Redis!');
    console.log('📝 Make sure you updated REDIS_URL on Render dashboard\n');
    redis.disconnect();
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ FAILED! VPS Redis is NOT accessible from external networks');
    console.error('❌ Error:', err.message);
    console.log('\n🔧 You need to configure your VPS firewall:');
    console.log('   1. SSH to your VPS');
    console.log('   2. Run: sudo ufw allow 6379/tcp');
    console.log('   3. Check Redis config: bind 0.0.0.0 ::');
    console.log('   4. Restart Redis: sudo systemctl restart redis-server\n');
    redis.disconnect();
    process.exit(1);
  });
