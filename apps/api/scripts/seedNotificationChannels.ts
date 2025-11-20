import mongoose from 'mongoose';
import dotenv from 'dotenv';
import NotificationChannel from '../src/models/NotificationChannel';

// Load environment variables
dotenv.config();

async function seedNotificationChannels() {
  try {
    console.log('🌱 Starting notification channels seeding...');
    
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmily';
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get a sample workplaceId (you'll need to replace this with an actual one)
    // For now, we'll create a generic ObjectId - you should update this with your actual workplaceId
    const sampleWorkplaceId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439011');
    const sampleUserId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439012');

    // Check if channels already exist
    const existingChannels = await NotificationChannel.find({});
    if (existingChannels.length > 0) {
      console.log(`⚠️  Found ${existingChannels.length} existing channels. Skipping seed.`);
      console.log('To re-seed, delete existing channels first.');
      await mongoose.disconnect();
      return;
    }

    // Default notification channels
    const defaultChannels = [
      {
        name: 'Primary Email',
        type: 'email',
        enabled: true,
        config: {
          provider: 'smtp',
          fromAddress: 'noreply@pharmacycopilot.com',
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
        },
        dailyLimit: 10000,
        monthlyLimit: 300000,
        workplaceId: sampleWorkplaceId,
        createdBy: sampleUserId,
      },
      {
        name: 'Primary SMS',
        type: 'sms',
        enabled: false,
        config: {
          provider: 'twilio',
          fromNumber: '+1234567890',
        },
        dailyLimit: 1000,
        monthlyLimit: 30000,
        workplaceId: sampleWorkplaceId,
        createdBy: sampleUserId,
      },
      {
        name: 'Push Notifications',
        type: 'push',
        enabled: true,
        config: {
          provider: 'firebase',
        },
        dailyLimit: 50000,
        monthlyLimit: 1500000,
        workplaceId: sampleWorkplaceId,
        createdBy: sampleUserId,
      },
      {
        name: 'WhatsApp Business',
        type: 'whatsapp',
        enabled: false,
        config: {
          provider: 'twilio',
          fromNumber: '+1234567890',
        },
        dailyLimit: 1000,
        monthlyLimit: 30000,
        workplaceId: sampleWorkplaceId,
        createdBy: sampleUserId,
      },
    ];

    // Insert channels
    const createdChannels = await NotificationChannel.insertMany(defaultChannels);
    console.log(`✅ Successfully created ${createdChannels.length} notification channels:`);
    
    createdChannels.forEach((channel) => {
      console.log(`   - ${channel.name} (${channel.type}) - ${channel.enabled ? 'Enabled' : 'Disabled'}`);
    });

    console.log('\n📝 Note: These channels use sample workplaceId and userId.');
    console.log('   Update them with actual IDs from your database if needed.');
    
    await mongoose.disconnect();
    console.log('\n✅ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding notification channels:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run the seed function
seedNotificationChannels();
