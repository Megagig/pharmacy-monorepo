import mongoose from 'mongoose';
import User from '../src/models/User';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Fix User Statuses Script
 * 
 * This script ensures that user status and isActive fields are consistent:
 * - If status is 'active', isActive should be true
 * - If status is 'suspended', isActive should be false
 * - If status is 'pending', isActive should be false (until approved)
 */

async function fixUserStatuses() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('Connected to database');

    // Fix users with status 'active' but isActive false
    const fixedActive = await User.updateMany(
      { status: 'active', isActive: false },
      { $set: { isActive: true } }
    );
    console.log(`Fixed ${fixedActive.modifiedCount} active users with isActive=false`);

    // Fix users with status 'suspended' but isActive true
    const fixedSuspended = await User.updateMany(
      { status: 'suspended', isActive: true },
      { $set: { isActive: false } }
    );
    console.log(`Fixed ${fixedSuspended.modifiedCount} suspended users with isActive=true`);

    // Fix users with status 'pending' but isActive true
    const fixedPending = await User.updateMany(
      { status: 'pending', isActive: true },
      { $set: { isActive: false } }
    );
    console.log(`Fixed ${fixedPending.modifiedCount} pending users with isActive=true`);

    // Fix users with isActive false but no suspended status
    const fixedInconsistent = await User.updateMany(
      { 
        isActive: false, 
        status: { $nin: ['suspended', 'pending', 'license_rejected'] },
        suspendedAt: { $exists: false }
      },
      { $set: { isActive: true } }
    );
    console.log(`Fixed ${fixedInconsistent.modifiedCount} users with inconsistent isActive status`);

    // Report on current user statuses
    const statusCounts = await User.aggregate([
      {
        $group: {
          _id: { status: '$status', isActive: '$isActive' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.status': 1 } }
    ]);

    console.log('\nCurrent user status distribution:');
    statusCounts.forEach(item => {
      console.log(`  status: ${item._id.status}, isActive: ${item._id.isActive}, count: ${item.count}`);
    });

    console.log('\nUser status fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing user statuses:', error);
    process.exit(1);
  }
}

fixUserStatuses();
