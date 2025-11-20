import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';
import Subscription from '../src/models/Subscription';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care';

async function testSubscriptionAPI(userEmail: string) {
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
    console.log(`Workplace ID: ${user.workplaceId}`);
    console.log(`Subscription Tier: ${user.subscriptionTier}`);

    // Simulate what the API does
    console.log('\n🔍 SIMULATING API CALL:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!user.workplaceId) {
      console.log('❌ No workplaceId found!');
      console.log('API would return: no_workspace');
    } else {
      console.log(`✅ User has workplaceId: ${user.workplaceId}`);
      console.log(`\nQuerying Subscription with:`);
      console.log(`  workspaceId: ${user.workplaceId}`);
      console.log(`  status: { $in: ['active', 'trial', 'grace_period'] }`);
      
      const subscription = await Subscription.findOne({
        workspaceId: user.workplaceId,
        status: { $in: ['active', 'trial', 'grace_period'] },
      });

      if (!subscription) {
        console.log('\n❌ No subscription found!');
        console.log('API would return: no_subscription');
      } else {
        console.log('\n✅ Subscription found!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`ID: ${subscription._id}`);
        console.log(`Status: ${subscription.status}`);
        console.log(`Tier: ${subscription.tier}`);
        console.log(`Workspace ID: ${subscription.workspaceId}`);
        console.log(`Start Date: ${subscription.startDate}`);
        console.log(`End Date: ${subscription.endDate}`);
        console.log(`Plan ID: ${subscription.planId}`);
        
        const now = new Date();
        const isTrialActive = subscription.status === 'trial' && 
          subscription.endDate && 
          now <= subscription.endDate;
        
        let daysRemaining = 0;
        if (isTrialActive && subscription.endDate) {
          const diffTime = subscription.endDate.getTime() - now.getTime();
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }
        
        console.log('\n📊 API RESPONSE DATA:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(JSON.stringify({
          success: true,
          data: {
            hasWorkspace: true,
            hasSubscription: true,
            status: subscription.status,
            tier: subscription.tier,
            accessLevel: 'full',
            isTrialActive,
            daysRemaining,
            endDate: subscription.endDate,
            planId: subscription.planId,
            features: subscription.features || [],
            limits: subscription.limits || {},
          }
        }, null, 2));
      }
    }

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
  console.log('Usage: npm run test-subscription-api <email>');
  process.exit(1);
}

testSubscriptionAPI(userEmail);
