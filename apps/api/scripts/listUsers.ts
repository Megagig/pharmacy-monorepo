import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care';

async function listUsers() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    const users = await User.find({}).select('email name subscriptionTier workplaceId createdAt').limit(20);

    if (users.length === 0) {
      console.log('❌ No users found in database!');
    } else {
      console.log(`Found ${users.length} users:\n`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      users.forEach((user, i) => {
        console.log(`${i + 1}. ${user.email}`);
        console.log(`   Name: ${user.name || 'N/A'}`);
        console.log(`   Tier: ${user.subscriptionTier || 'free'}`);
        console.log(`   Workplace ID: ${user.workplaceId || 'None'}`);
        console.log(`   Created: ${user.createdAt}`);
        console.log('');
      });
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('\nTo activate a subscription, run:');
      console.log('npm run activate-subscription <email>');
    }

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

listUsers();
