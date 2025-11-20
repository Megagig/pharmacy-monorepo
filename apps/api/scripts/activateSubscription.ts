import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';
import Payment from '../src/models/Payment';
import Subscription from '../src/models/Subscription';
import PricingPlan from '../src/models/PricingPlan';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care';

async function activateSubscription(userEmail: string) {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Find the user
    console.log(`\nLooking for user: ${userEmail}`);
    const user = await User.findOne({ email: userEmail });

    if (!user) {
      console.error('❌ User not found!');
      process.exit(1);
    }

    console.log('✅ User found:', {
      id: user._id,
      email: user.email,
      currentTier: user.subscriptionTier,
    });

    // 2. Find the most recent payment (any status)
    console.log('\nLooking for payment record...');
    const allPayments = await Payment.find({
      userId: user._id,
    }).sort({ createdAt: -1 }).limit(5);

    console.log(`Found ${allPayments.length} payment(s) for this user:`);
    allPayments.forEach((p, i) => {
      console.log(`  ${i + 1}. Status: ${p.status}, Amount: ${p.amount}, Reference: ${p.paymentReference}, Date: ${p.createdAt}`);
    });

    const payment = allPayments.find(p => p.status === 'completed') || allPayments[0];

    if (!payment) {
      console.error('❌ No payment found for this user!');
      process.exit(1);
    }

    if (payment.status !== 'completed') {
      console.log(`\n⚠️  Payment status is "${payment.status}", not "completed"`);
      console.log('This might be why the subscription wasn\'t activated automatically.');

      const answer = await new Promise<string>((resolve) => {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        readline.question('Do you want to use this payment anyway? (yes/no): ', (ans: string) => {
          readline.close();
          resolve(ans.toLowerCase());
        });
      });

      if (answer !== 'yes') {
        console.log('Cancelled.');
        process.exit(0);
      }

      // Update payment status to completed
      payment.status = 'completed';
      payment.completedAt = new Date();
      await payment.save();
      console.log('✅ Updated payment status to completed');
    }

    console.log('✅ Payment found:', {
      id: payment._id,
      reference: payment.paymentReference,
      amount: payment.amount,
      planId: payment.planId,
    });

    // 3. Find the plan
    console.log('\nLooking for plan...');
    const plan = await PricingPlan.findById(payment.planId);

    if (!plan) {
      console.error('❌ Plan not found!');
      process.exit(1);
    }

    console.log('✅ Plan found:', {
      id: plan._id,
      name: plan.name,
      tier: plan.tier,
      price: plan.price,
    });

    // 4. Check if subscription already exists (using workspaceId, not userId)
    const existingSubscription = await Subscription.findOne({
      workspaceId: user.workplaceId,
      status: 'active',
    });

    if (existingSubscription) {
      console.log('\n⚠️  Active subscription already exists:', {
        id: existingSubscription._id,
        tier: existingSubscription.tier,
        endDate: existingSubscription.endDate,
      });

      const answer = await new Promise<string>((resolve) => {
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        readline.question('Do you want to replace it? (yes/no): ', (ans: string) => {
          readline.close();
          resolve(ans.toLowerCase());
        });
      });

      if (answer !== 'yes') {
        console.log('Cancelled.');
        process.exit(0);
      }

      // Cancel existing subscription
      existingSubscription.status = 'canceled';
      await existingSubscription.save();
      console.log('✅ Canceled existing subscription');
    }

    // 5. Calculate subscription period
    const startDate = new Date();
    const endDate = new Date();
    const billingInterval = payment.metadata?.billingInterval || plan.billingPeriod || 'monthly';

    if (billingInterval === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // 6. Create new subscription
    console.log('\nCreating new subscription...');

    // Get user's workspaceId (note: User model uses 'workplaceId' with 'e')
    const workspaceId = user.workplaceId;

    if (!workspaceId) {
      console.error('❌ User does not have a workplaceId!');
      console.log('The user needs to create or join a workplace first.');
      process.exit(1);
    }

    console.log('✅ Using workspaceId:', workspaceId);

    const subscription = new Subscription({
      workspaceId: workspaceId, // Subscription model uses workspaceId, not userId
      planId: payment.planId,
      tier: plan.tier,
      status: 'active',
      startDate: startDate,
      endDate: endDate,
      priceAtPurchase: plan.price,
      autoRenew: true,
      paymentReference: payment.paymentReference,
      features: plan.features || [],
    });

    await subscription.save();
    console.log('✅ Subscription created:', {
      id: subscription._id,
      tier: subscription.tier,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
    });

    // 7. Update user
    console.log('\nUpdating user...');
    user.subscriptionTier = plan.tier as any;
    user.currentSubscriptionId = subscription._id;
    if (payment.planId) {
      user.currentPlanId = payment.planId;
    }
    await user.save();

    console.log('✅ User updated:', {
      subscriptionTier: user.subscriptionTier,
      currentSubscriptionId: user.currentSubscriptionId,
    });

    // 8. Verify
    console.log('\n✅ SUBSCRIPTION ACTIVATED SUCCESSFULLY!');
    console.log('\nFinal Status:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`User: ${user.email}`);
    console.log(`Tier: ${user.subscriptionTier}`);
    console.log(`Plan: ${plan.name}`);
    console.log(`Status: active`);
    console.log(`Valid Until: ${endDate.toLocaleDateString()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✨ User should now have access to all features!');

    await mongoose.connection.close();
    console.log('\nDatabase connection closed');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Get email from command line argument
const userEmail = process.argv[2];

if (!userEmail) {
  console.error('❌ Please provide user email as argument');
  console.log('\nUsage: npm run activate-subscription <user-email>');
  console.log('Example: npm run activate-subscription megagigsolution@example.com');
  process.exit(1);
}

activateSubscription(userEmail);
