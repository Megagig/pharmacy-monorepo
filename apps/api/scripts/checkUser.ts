import connectDB from '../src/config/db';
import User from '../src/models/User';
import Subscription from '../src/models/Subscription';
import SubscriptionPlan from '../src/models/SubscriptionPlan';
import dotenv from 'dotenv';

// Load environment variables from the backend directory
dotenv.config();

async function checkUserData() {
  try {
    await connectDB();
    console.log('Connected to database');

    const user = await User.findOne({ email: 'megagigdev@gmail.com' });
    console.log('User found:', !!user);
    if (user) {
      console.log('User status:', user.status);
      console.log('User subscriptionTier:', user.subscriptionTier);
      console.log('User currentSubscriptionId:', user.currentSubscriptionId);
      console.log('User currentPlanId:', user.currentPlanId);
      console.log('User workplaceId:', user.workplaceId);
    }

    const subscription = await Subscription.findOne({ userId: user?._id });
    console.log('Subscription found:', !!subscription);
    if (subscription) {
      console.log('Subscription status:', subscription.status);
      console.log('Subscription planId:', subscription.planId);
      console.log('Subscription startDate:', subscription.startDate);
      console.log('Subscription endDate:', subscription.endDate);
      console.log('Subscription isExpired:', subscription.isExpired());
      console.log(
        'Subscription isInGracePeriod:',
        subscription.isInGracePeriod()
      );

      // Check if subscription is expired
      const now = new Date();
      console.log('Current date:', now);
      console.log(
        'Is subscription expired?',
        subscription.endDate ? subscription.endDate < now : 'No end date'
      );
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUserData();
