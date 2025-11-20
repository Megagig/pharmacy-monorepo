import mongoose from 'mongoose';
import { config } from 'dotenv';
import User from '../src/models/User';
import Workplace from '../src/models/Workplace';
import SubscriptionPlan from '../src/models/SubscriptionPlan';
import Subscription from '../src/models/Subscription';

config();

async function testWorkplaceCreation() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/PharmacyCopilot-test'
    );
    console.log('Connected to MongoDB');

    // Clean up test data
    await User.deleteMany({ email: 'test@workplace.com' });
    await Workplace.deleteMany({ name: 'Test Workplace' });

    // Get free trial plan
    const freeTrialPlan = await SubscriptionPlan.findOne({
      name: 'Free Trial',
      billingInterval: 'monthly',
    });

    if (!freeTrialPlan) {
      console.error('Free Trial plan not found. Please run the seeder script.');
      process.exit(1);
    }

    console.log('Found Free Trial plan:', freeTrialPlan.name);

    // Create a test workplace
    const testWorkplace = await Workplace.create({
      name: 'Test Workplace',
      type: 'Community',
      licenseNumber: 'TEST-12345',
      email: 'workplace@test.com',
      address: '123 Test Street',
      state: 'Lagos',
      ownerId: new mongoose.Types.ObjectId(),
    });

    console.log('Created test workplace:', testWorkplace.name);
    console.log('Invite code:', testWorkplace.inviteCode);

    // Create a test user
    const testUser = await User.create({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@workplace.com',
      passwordHash: 'hashedpassword123',
      workplaceId: testWorkplace._id,
      workplaceRole: 'Owner',
      currentPlanId: freeTrialPlan._id,
      subscriptionTier: 'free_trial',
    });

    console.log('Created test user:', testUser.firstName, testUser.lastName);
    console.log('User workplace ID:', testUser.workplaceId);
    console.log('User workplace role:', testUser.workplaceRole);

    // Test finding workplace by invite code
    const foundWorkplace = await Workplace.findOne({
      inviteCode: testWorkplace.inviteCode,
    });
    console.log('Found workplace by invite code:', foundWorkplace?.name);

    console.log('\n✅ All tests passed! Workplace model is working correctly.');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testWorkplaceCreation();
