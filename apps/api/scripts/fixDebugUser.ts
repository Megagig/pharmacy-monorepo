import mongoose from 'mongoose';
import User from '../src/models/User';
import SubscriptionPlan from '../src/models/SubscriptionPlan';
import Pharmacy from '../src/models/Pharmacy';
import dotenv from 'dotenv';

dotenv.config();

async function checkAndFixDebugUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to MongoDB');

    // Get the debug user
    const user = await User.findOne({ email: 'debug@test.com' }).populate(
      'currentPlanId'
    );
    console.log('Debug user before update:', {
      email: user?.email,
      role: user?.role,
      pharmacyId: user?.pharmacyId,
      currentPlanId: user?.currentPlanId,
      status: user?.status,
    });

    if (!user) {
      console.log('Debug user not found!');
      return;
    }

    // Check if user has a subscription plan
    if (!user.currentPlanId) {
      console.log('User has no subscription plan, assigning one...');

      const basicPlan =
        (await SubscriptionPlan.findOne({ name: 'Basic' })) ||
        (await SubscriptionPlan.findOne());

      if (basicPlan) {
        user.currentPlanId = basicPlan._id;
        await user.save();
        console.log('Assigned plan:', basicPlan.name);
      } else {
        console.log('No subscription plans found!');
      }
    }

    // Check if user has pharmacy
    if (!user.pharmacyId) {
      console.log('User has no pharmacy, checking for existing pharmacy...');

      const pharmacy = await Pharmacy.findOne({ ownerId: user._id });
      if (pharmacy) {
        user.pharmacyId = pharmacy._id;
        await user.save();
        console.log('Associated with existing pharmacy:', pharmacy.name);
      } else {
        // Create a test pharmacy
        const newPharmacy = new Pharmacy({
          name: 'Debug Test Pharmacy',
          ownerId: user._id,
          address: '123 Test Street, Lagos',
          state: 'Lagos',
          lga: 'Lagos Island',
          licenseNumber: 'PCN-TEST-123-2024',
          verificationStatus: 'verified',
        });

        await newPharmacy.save();
        user.pharmacyId = newPharmacy._id;
        await user.save();
        console.log('Created new pharmacy:', newPharmacy.name);
      }
    }

    console.log('Debug user after update:', {
      email: user.email,
      role: user.role,
      pharmacyId: user.pharmacyId,
      currentPlanId: user.currentPlanId,
      status: user.status,
    });

    console.log('Debug user setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAndFixDebugUser();
