import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';
import Subscription from '../src/models/Subscription';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care';

async function debugSubscription(userEmail: string) {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');

    // Find user
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.error('❌ User not found!');
      process.exit(1);
    }

    console.log('👤 USER INFO:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Email: ${user.email}`);
    console.log(`ID: ${user._id}`);
    console.log(`Subscription Tier: ${user.subscriptionTier}`);
    console.log(`Current Subscription ID: ${user.currentSubscriptionId}`);
    console.log(`Workplace ID: ${user.workplaceId}`);
    console.log(`Current Plan ID: ${user.currentPlanId}`);

    // Find all subscriptions for this workspace
    console.log('\n📋 ALL SUBSCRIPTIONS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const allSubscriptions = await Subscription.find({}).sort({ createdAt: -1 }).limit(10);
    
    if (allSubscriptions.length === 0) {
      console.log('❌ No subscriptions found in database at all!');
    } else {
      console.log(`Found ${allSubscriptions.length} total subscriptions (showing last 10):`);
      allSubscriptions.forEach((sub, i) => {
        console.log(`\n${i + 1}. Subscription:`);
        console.log(`   ID: ${sub._id}`);
        console.log(`   Status: ${sub.status}`);
        console.log(`   Tier: ${sub.tier}`);
        console.log(`   Workspace ID: ${sub.workspaceId}`);
        console.log(`   Start Date: ${sub.startDate}`);
        console.log(`   End Date: ${sub.endDate}`);
        console.log(`   Created: ${sub.createdAt}`);
      });
    }

    // Find subscriptions by workspaceId
    if (user.workplaceId) {
      console.log('\n🏢 SUBSCRIPTIONS BY WORKSPACE ID:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      const workspaceSubscriptions = await Subscription.find({ 
        workspaceId: user.workplaceId 
      }).sort({ createdAt: -1 });
      
      if (workspaceSubscriptions.length === 0) {
        console.log('❌ No subscriptions found by workspaceId');
        console.log(`   Looking for workspaceId: ${user.workplaceId}`);
      } else {
        workspaceSubscriptions.forEach((sub, i) => {
          console.log(`\n${i + 1}. Subscription:`);
          console.log(`   ID: ${sub._id}`);
          console.log(`   Status: ${sub.status}`);
          console.log(`   Tier: ${sub.tier}`);
          console.log(`   Workspace ID: ${sub.workspaceId}`);
        });
      }
    } else {
      console.log('\n⚠️  User has no workplaceId!');
    }

    // Check what the API would return
    console.log('\n🔍 API RESPONSE SIMULATION:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!user.workplaceId) {
      console.log('Status: no_workspace');
      console.log('Reason: User has no workplaceId');
    } else {
      const activeSubscription = await Subscription.findOne({
        workspaceId: user.workplaceId,
        status: { $in: ['active', 'trial', 'grace_period'] },
      });

      if (!activeSubscription) {
        console.log('Status: no_subscription');
        console.log('Reason: No active subscription found for workspaceId');
      } else {
        console.log('Status: active');
        console.log(`Tier: ${activeSubscription.tier}`);
        console.log('✅ Subscription should be working!');
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

const userEmail = process.argv[2];

if (!userEmail) {
  console.error('❌ Please provide user email');
  console.log('Usage: npm run debug-subscription <email>');
  process.exit(1);
}

debugSubscription(userEmail);
