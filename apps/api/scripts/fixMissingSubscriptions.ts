import mongoose from 'mongoose';
import User from '../src/models/User';
import Subscription from '../src/models/Subscription';
import SubscriptionPlan from '../src/models/SubscriptionPlan';
import connectDB from '../src/config/db';

// Load environment variables
import dotenv from 'dotenv';
import path from 'path';

// Load .env file from the backend directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function fixMissingSubscriptions() {
  try {
    // Connect to database
    await connectDB();
    console.log('Connected to database');

    // Find Free Trial plan
    const freeTrialPlan = await SubscriptionPlan.findOne({
      name: 'Free Trial',
      billingInterval: 'monthly',
    });

    if (!freeTrialPlan) {
      console.error('Free Trial plan not found. Please run seed script first.');
      process.exit(1);
    }

    console.log('Found Free Trial plan:', freeTrialPlan.name);

    // Find all users without active subscriptions
    const usersWithoutSubscriptions = await User.find({
      $or: [
        { currentSubscriptionId: { $exists: false } },
        { currentSubscriptionId: null },
      ],
      status: { $in: ['active', 'pending', 'license_pending'] },
    });

    console.log(
      `Found ${usersWithoutSubscriptions.length} users without subscriptions`
    );

    if (usersWithoutSubscriptions.length === 0) {
      console.log('No users need subscription fixes.');
      return;
    }

    // Create subscriptions for these users
    for (const user of usersWithoutSubscriptions) {
      console.log(`Creating subscription for user: ${user.email}`);

      // Check if user already has a subscription that's not referenced
      let existingSubscription = await Subscription.findOne({
        userId: user._id,
        status: { $in: ['active', 'trial', 'grace_period'] },
      });

      if (existingSubscription) {
        // Just link the existing subscription
        console.log(`  - Found existing subscription, linking to user`);
        await User.findByIdAndUpdate(user._id, {
          currentSubscriptionId: existingSubscription._id,
          subscriptionTier: existingSubscription.tier,
        });
      } else {
        // Create new trial subscription
        console.log(`  - Creating new trial subscription`);
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 14);

        const subscription = await Subscription.create({
          userId: user._id,
          planId: freeTrialPlan._id,
          tier: 'free_trial',
          status: 'trial',
          startDate: new Date(),
          endDate: trialEndDate,
          priceAtPurchase: 0,
          autoRenew: false,
        });

        // Update user to reference the subscription
        await User.findByIdAndUpdate(user._id, {
          currentSubscriptionId: subscription._id,
          subscriptionTier: 'free_trial',
          currentPlanId: freeTrialPlan._id,
        });

        console.log(`  - Created subscription ID: ${subscription._id}`);
      }
    }

    console.log('✅ Successfully fixed missing subscriptions for all users!');
  } catch (error) {
    console.error('❌ Error fixing subscriptions:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
fixMissingSubscriptions();
