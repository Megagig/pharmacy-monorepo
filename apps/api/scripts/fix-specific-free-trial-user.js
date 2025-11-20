#!/usr/bin/env node

/**
 * Script to fix the specific free trial user who is currently getting 402 errors
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function fixSpecificFreeTrialUser() {
  try {
    console.log('🔧 Fixing specific free trial user with 402 errors...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find all free trial subscriptions that might be missing features
    const freeTrialSubs = await db.collection('subscriptions').find({
      tier: 'free_trial',
      status: 'trial'
    }).toArray();

    console.log(`Found ${freeTrialSubs.length} free trial subscriptions`);

    const requiredFeatures = ['ai_diagnostics', 'advancedReports', 'diagnostic_analytics'];
    let fixedCount = 0;

    for (const subscription of freeTrialSubs) {
      const currentFeatures = subscription.features || [];
      const missingFeatures = requiredFeatures.filter(f => !currentFeatures.includes(f));

      if (missingFeatures.length > 0) {
        // Find the user for this subscription
        const user = await db.collection('users').findOne({
          workplaceId: subscription.workplaceId
        });

        console.log(`\\n🔧 Fixing subscription for: ${user?.email || 'Unknown user'}`);
        console.log(`   Missing features: ${missingFeatures.join(', ')}`);

        // Update the subscription with missing features
        await db.collection('subscriptions').updateOne(
          { _id: subscription._id },
          { 
            $set: { 
              features: [...currentFeatures, ...missingFeatures],
              customFeatures: ['diagnostic_analytics'],
              updatedAt: new Date()
            } 
          }
        );

        // Also ensure the user has the diagnostic_analytics feature
        if (user) {
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
          }

          // Ensure user is in workplace members with correct role
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
              console.log('   ✅ Added user to workplace members as Owner');
            }
          }
        }

        console.log('   ✅ Fixed subscription features');
        fixedCount++;
      } else {
        const user = await db.collection('users').findOne({
          workplaceId: subscription.workplaceId
        });
        console.log(`✅ ${user?.email || 'Unknown user'} already has all required features`);
      }
    }

    console.log(`\\n📊 Summary:`);
    console.log(`   - Free trial subscriptions checked: ${freeTrialSubs.length}`);
    console.log(`   - Subscriptions fixed: ${fixedCount}`);

    if (fixedCount > 0) {
      console.log('\\n✅ FREE TRIAL USERS FIXED!');
      console.log('🔄 Users should refresh their browser to see the changes.');
    } else {
      console.log('\\n✅ All free trial users already have correct features.');
    }

  } catch (error) {
    console.error('❌ Failed to fix free trial user:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  fixSpecificFreeTrialUser()
    .then(() => {
      console.log('Free trial user fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Free trial user fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixSpecificFreeTrialUser };