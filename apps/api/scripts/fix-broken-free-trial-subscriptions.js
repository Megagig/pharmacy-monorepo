#!/usr/bin/env node

/**
 * Script to fix broken free trial subscriptions that have undefined workplaceId
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function fixBrokenFreeTrialSubscriptions() {
  try {
    console.log('🔧 Fixing broken free trial subscriptions...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find free trial subscriptions with undefined workplaceId
    const brokenSubs = await db.collection('subscriptions').find({
      tier: 'free_trial',
      status: 'trial',
      $or: [
        { workplaceId: { $exists: false } },
        { workplaceId: null },
        { workplaceId: undefined }
      ]
    }).toArray();

    console.log(`Found ${brokenSubs.length} broken free trial subscriptions`);

    if (brokenSubs.length === 0) {
      console.log('✅ No broken subscriptions found');
      return;
    }

    // Try to find users who might be associated with these subscriptions
    // Look for users created around the same time as the subscriptions
    let fixedCount = 0;

    for (const sub of brokenSubs) {
      console.log(`\\n🔧 Processing subscription created at: ${sub.createdAt}`);
      
      // Look for users created within 5 minutes of this subscription
      const timeWindow = 5 * 60 * 1000; // 5 minutes in milliseconds
      const startTime = new Date(sub.createdAt.getTime() - timeWindow);
      const endTime = new Date(sub.createdAt.getTime() + timeWindow);

      const potentialUsers = await db.collection('users').find({
        createdAt: { $gte: startTime, $lte: endTime },
        workplaceId: { $exists: true, $ne: null },
        role: { $in: ['pharmacy_outlet', 'pharmacist'] }
      }).toArray();

      console.log(`   Found ${potentialUsers.length} potential users in time window`);

      if (potentialUsers.length === 1) {
        // Perfect match - one user created around the same time
        const user = potentialUsers[0];
        console.log(`   🎯 Matching user: ${user.email}`);

        // Update the subscription with the user's workplaceId
        await db.collection('subscriptions').updateOne(
          { _id: sub._id },
          { 
            $set: { 
              workplaceId: user.workplaceId,
              updatedAt: new Date()
            } 
          }
        );

        // Ensure the subscription has required features
        const requiredFeatures = ['ai_diagnostics', 'advancedReports', 'diagnostic_analytics'];
        const currentFeatures = sub.features || [];
        const missingFeatures = requiredFeatures.filter(f => !currentFeatures.includes(f));

        if (missingFeatures.length > 0) {
          await db.collection('subscriptions').updateOne(
            { _id: sub._id },
            { 
              $set: { 
                features: [...currentFeatures, ...missingFeatures],
                customFeatures: ['diagnostic_analytics'],
                updatedAt: new Date()
              } 
            }
          );
          console.log(`   ✅ Added missing features: ${missingFeatures.join(', ')}`);
        }

        // Ensure user has diagnostic_analytics feature
        const userFeatures = user.features || [];
        if (!userFeatures.includes('diagnostic_analytics')) {
          await db.collection('users').updateOne(
            { _id: user._id },
            { 
              $set: { 
                features: [...userFeatures, 'diagnostic_analytics'],
                updatedAt: new Date()
              } 
            }
          );
          console.log('   ✅ Added diagnostic_analytics to user features');
        }

        // Ensure user is in workplace members
        const workplace = await db.collection('workplaces').findOne({
          _id: user.workplaceId
        });

        if (workplace) {
          const currentMembers = workplace.members || [];
          const existingMembership = currentMembers.find(member => 
            member.userId?.toString() === user._id.toString()
          );

          if (!existingMembership) {
            const newMember = {
              userId: user._id,
              role: 'Owner',
              joinedAt: new Date(),
              status: 'active',
              permissions: [],
              createdAt: new Date(),
              updatedAt: new Date()
            };

            await db.collection('workplaces').updateOne(
              { _id: workplace._id },
              { 
                $push: { members: newMember },
                $set: { updatedAt: new Date() }
              }
            );
            console.log('   ✅ Added user to workplace members');
          }
        }

        console.log('   ✅ Fixed subscription and user configuration');
        fixedCount++;
      } else if (potentialUsers.length > 1) {
        console.log(`   ⚠️ Multiple potential users found, skipping for safety`);
        potentialUsers.forEach((u, i) => {
          console.log(`     ${i + 1}. ${u.email} (${u.role})`);
        });
      } else {
        console.log('   ❌ No matching users found in time window');
      }
    }

    console.log(`\\n📊 Summary:`);
    console.log(`   - Broken subscriptions found: ${brokenSubs.length}`);
    console.log(`   - Subscriptions fixed: ${fixedCount}`);

    if (fixedCount > 0) {
      console.log('\\n✅ BROKEN FREE TRIAL SUBSCRIPTIONS FIXED!');
      console.log('🔄 Users should refresh their browser to see the changes.');
    }

  } catch (error) {
    console.error('❌ Failed to fix broken subscriptions:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  fixBrokenFreeTrialSubscriptions()
    .then(() => {
      console.log('Broken subscription fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Broken subscription fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixBrokenFreeTrialSubscriptions };