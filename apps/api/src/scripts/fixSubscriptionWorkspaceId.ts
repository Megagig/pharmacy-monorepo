/**
 * Migration Script: Fix Subscription workspaceId
 * 
 * This script fixes subscriptions that were created with userId instead of workspaceId.
 * It migrates the data to use the correct workspaceId field from the user's record.
 * 
 * Run with: npx ts-node src/scripts/fixSubscriptionWorkspaceId.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import models
import User from '../models/User';
import { Subscription } from '../models/Subscription';
import PricingPlan from '../models/PricingPlan';

async function fixSubscriptionWorkspaceIds() {
  try {
    console.log('🔧 Starting subscription workspaceId migration...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmadb';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find all subscriptions
    const subscriptions = await Subscription.find({}).lean();
    console.log(`📊 Found ${subscriptions.length} total subscriptions\n`);

    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const sub of subscriptions) {
      try {
        // Check if subscription has workspaceId
        if (sub.workspaceId) {
          console.log(`⏭️  Subscription ${sub._id} already has workspaceId, skipping`);
          skipped++;
          continue;
        }

        // Check if subscription has userId (old field)
        const userId = (sub as any).userId;
        if (!userId) {
          console.log(`⚠️  Subscription ${sub._id} has neither userId nor workspaceId, skipping`);
          skipped++;
          continue;
        }

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
          console.log(`❌ User ${userId} not found for subscription ${sub._id}`);
          errors++;
          continue;
        }

        if (!user.workplaceId) {
          console.log(`⚠️  User ${user.email} (${userId}) has no workplaceId, skipping subscription ${sub._id}`);
          skipped++;
          continue;
        }

        // Update the subscription with workspaceId
        await Subscription.updateOne(
          { _id: sub._id },
          {
            $set: { workspaceId: user.workplaceId },
            $unset: { userId: 1 }
          }
        );

        console.log(`✅ Fixed subscription ${sub._id}:`);
        console.log(`   User: ${user.email}`);
        console.log(`   Workspace: ${user.workplaceId}`);
        console.log(`   Tier: ${sub.tier}`);
        console.log(`   Status: ${sub.status}\n`);
        fixed++;

      } catch (error) {
        console.error(`❌ Error processing subscription ${sub._id}:`, error);
        errors++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📊 Total: ${subscriptions.length}\n`);

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
fixSubscriptionWorkspaceIds();
