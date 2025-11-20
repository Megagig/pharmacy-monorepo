import mongoose from 'mongoose';
import User from '../src/models/User';
import SubscriptionPlan from '../src/models/SubscriptionPlan';
import dotenv from 'dotenv';

dotenv.config();

async function checkUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    const users = await User.find({}).select('email role status');
    console.log('Existing users:', users);

    if (users.length === 0) {
      console.log('No users found. Creating test user...');

      const testUser = new User({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@test.com',
        passwordHash: 'password123', // Will be hashed by pre-save hook
        role: 'pharmacist',
        status: 'active',
        emailVerified: true,
      });

      await testUser.save();
      console.log('Test user created:', testUser.email);
    }

    // Also create a known test user for debugging
    const existingTestUser = await User.findOne({ email: 'debug@test.com' });
    if (!existingTestUser) {
      console.log('Creating debug user...');

      // Get a subscription plan for the user
      const basicPlan = await SubscriptionPlan.findOne({ name: 'Basic' });
      if (!basicPlan) {
        throw new Error(
          'Basic subscription plan not found. Run seedSubscriptionPlans.ts first.'
        );
      }

      const debugUser = new User({
        firstName: 'Debug',
        lastName: 'User',
        email: 'debug@test.com',
        passwordHash: 'debug123',
        role: 'pharmacist',
        status: 'active',
        emailVerified: true,
        currentPlanId: basicPlan._id,
      });

      await debugUser.save();
      console.log('Debug user created: debug@test.com / debug123');
    } else {
      console.log('Debug user already exists: debug@test.com / debug123');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsers();
