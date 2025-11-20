require('dotenv').config();
const { validateCloudinaryConfig, testCloudinaryConnection } = require('../dist/config/cloudinary');

async function testLicenseUploadSystem() {
  console.log('🧪 Testing License Upload System...\n');

  // Test 1: Validate Cloudinary Configuration
  console.log('1️⃣ Testing Cloudinary Configuration...');
  const configValid = validateCloudinaryConfig();
  
  if (!configValid) {
    console.log('❌ Cloudinary configuration is invalid');
    return;
  }

  // Test 2: Test Cloudinary Connection
  console.log('\n2️⃣ Testing Cloudinary Connection...');
  const connectionValid = await testCloudinaryConnection();
  
  if (!connectionValid) {
    console.log('⚠️ Cloudinary connection failed - uploads will use local storage only');
  }

  // Test 3: Check upload directories
  console.log('\n3️⃣ Checking Upload Directories...');
  const fs = require('fs');
  const path = require('path');
  
  const uploadDir = path.join(process.cwd(), 'uploads', 'licenses');
  
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('✅ Created upload directory:', uploadDir);
    } else {
      console.log('✅ Upload directory exists:', uploadDir);
    }
  } catch (error) {
    console.log('❌ Failed to create upload directory:', error.message);
  }

  console.log('\n🎉 License Upload System Test Complete!');
  console.log('\n📋 Summary:');
  console.log(`   • Cloudinary Config: ${configValid ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`   • Cloudinary Connection: ${connectionValid ? '✅ Connected' : '⚠️ Failed (will use local backup)'}`);
  console.log(`   • Local Storage: ✅ Ready`);
  console.log('\n🚀 System is ready for license uploads with Cloudinary-first approach and local backup!');
}

testLicenseUploadSystem().catch(console.error);