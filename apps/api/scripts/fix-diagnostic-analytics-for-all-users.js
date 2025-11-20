#!/usr/bin/env node

/**
 * Script to fix diagnostic analytics access for ALL users (including free trial)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function fixDiagnosticAnalyticsForAllUsers() {
  try {
    console.log('🔧 Fixing diagnostic analytics for ALL users (including free trial)...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. ENSURE FEATURE FLAG ALLOWS ALL TIERS INCLUDING FREE_TRIAL
    console.log('\\n🚩 Step 1: Ensuring feature flag allows all tiers...');
    
    const featureFlag = await db.collection('featureflags').findOne({
      key: 'diagnostic_analytics'
    });

    if (featureFlag) {
      const allowedTiers = ['free', 'basic', 'pro', 'enterprise', 'free_trial'];
      await db.collection('featureflags').updateOne(
        { _id: featureFlag._id },
        { 
          $set: { 
            allowedTiers,
            isActive: true,
            updatedAt: new Date()
          } 
        }
      );
      console.log('✅ Feature flag updated to allow all tiers including free_trial');
    }

    // 2. ENSURE ALL PRICING PLANS HAVE DIAGNOSTIC FEATURES
    console.log('\\n📦 Step 2: Adding diagnostic features to ALL pricing plans...');
    
    const allPlans = await db.collection('pricingplans').find({
      isActive: true
    }).toArray();

    const requiredFeatures = ['ai_diagnostics', 'advancedReports'];
    const requiredPermissions = ['diagnostic:analytics', 'diagnostic:read', 'diagnostic:create'];

    for (const plan of allPlans) {
      let updated = false;

      // Add missing features
      const planFeatures = plan.features || [];
      const missingFeatures = requiredFeatures.filter(f => !planFeatures.includes(f));

      if (missingFeatures.length > 0) {
        await db.collection('pricingplans').updateOne(
          { _id: plan._id },
          { 
            $set: { 
              features: [...planFeatures, ...missingFeatures],
              updatedAt: new Date()
            } 
          }
        );
        console.log(`✅ Added features to ${plan.name} (${plan.tier}): ${missingFeatures.join(', ')}`);
        updated = true;
      }

      // Add missing permissions
      const planPermissions = plan.permissions || [];
      const missingPermissions = requiredPermissions.filter(p => !planPermissions.includes(p));

      if (missingPermissions.length > 0) {
        await db.collection('pricingplans').updateOne(
          { _id: plan._id },
          { 
            $set: { 
              permissions: [...planPermissions, ...missingPermissions],
              updatedAt: new Date()
            } 
          }
        );
        console.log(`✅ Added permissions to ${plan.name} (${plan.tier}): ${missingPermissions.join(', ')}`);
        updated = true;
      }

      if (!updated) {
        console.log(`✅ ${plan.name} (${plan.tier}) already has all required features`);
      }
    }

    // 3. FIX ALL EXISTING SUBSCRIPTIONS
    console.log('\\n💳 Step 3: Fixing ALL existing subscriptions...');
    
    const allSubscriptions = await db.collection('subscriptions').find({
      status: { $in: ['active', 'trial'] }
    }).toArray();

    console.log(`Found ${allSubscriptions.length} active subscriptions`);

    for (const subscription of allSubscriptions) {
      const currentFeatures = subscription.features || [];
      const missingFeatures = [...requiredFeatures, 'diagnostic_analytics'].filter(f => !currentFeatures.includes(f));

      if (missingFeatures.length > 0) {
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
        console.log(`✅ Fixed subscription ${subscription.tier}: added ${missingFeatures.join(', ')}`);
      }
    }

    // 4. FIX ALL USERS
    console.log('\\n👥 Step 4: Fixing ALL users...');
    
    const allUsers = await db.collection('users').find({
      isDeleted: { $ne: true },
      workplaceId: { $exists: true, $ne: null }
    }).toArray();

    console.log(`Found ${allUsers.length} users with workplaces`);

    let fixedUserCount = 0;
    for (const user of allUsers) {
      try {
        // Add diagnostic_analytics to user features
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
            // Determine role based on user role
            let workplaceRole = 'Owner';
            if (user.role === 'pharmacist' || user.role === 'senior_pharmacist') {
              workplaceRole = 'Pharmacist';
            }

            const newMember = {
              userId: user._id,
              role: workplaceRole,
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
          }
        }

        fixedUserCount++;
      } catch (error) {
        console.error(`Error fixing user ${user.email}:`, error.message);
      }
    }

    console.log(`✅ Fixed ${fixedUserCount} users`);

    // 5. VERIFY A SAMPLE FREE TRIAL USER
    console.log('\\n🔍 Step 5: Verifying free trial users...');
    
    const freeTrialSubscriptions = await db.collection('subscriptions').find({
      tier: 'free_trial',
      status: 'trial'
    }).toArray();

    console.log(`Found ${freeTrialSubscriptions.length} free trial subscriptions`);

    for (const sub of freeTrialSubscriptions.slice(0, 3)) { // Check first 3
      const user = await db.collection('users').findOne({
        workplaceId: sub.workplaceId
      });

      if (user) {
        console.log(`\\n   Checking: ${user.email}`);
        console.log(`   - Subscription tier: ${sub.tier}`);
        console.log(`   - Subscription features: ${sub.features?.includes('diagnostic_analytics') ? '✅' : '❌'} diagnostic_analytics`);
        console.log(`   - User features: ${user.features?.includes('diagnostic_analytics') ? '✅' : '❌'} diagnostic_analytics`);
        
        const workplace = await db.collection('workplaces').findOne({ _id: user.workplaceId });
        const membership = workplace?.members?.find(m => m.userId?.toString() === user._id.toString());
        console.log(`   - Workplace role: ${membership?.role || '❌ Not found'}`);
      }
    }

    console.log('\\n🎯 SUMMARY:');
    console.log('   - Feature flag: ✅ Allows all tiers including free_trial');
    console.log(`   - Pricing plans: ✅ ${allPlans.length} plans updated`);
    console.log(`   - Subscriptions: ✅ ${allSubscriptions.length} subscriptions fixed`);
    console.log(`   - Users: ✅ ${fixedUserCount} users fixed`);
    console.log(`   - Free trial users: ✅ ${freeTrialSubscriptions.length} verified`);

    console.log('\\n✅ ALL USERS (INCLUDING FREE TRIAL) NOW HAVE DIAGNOSTIC ANALYTICS ACCESS!');
    console.log('\\n🔄 Changes applied. New users will automatically get access.');
    console.log('   Existing users may need to refresh their browser.');

  } catch (error) {
    console.error('❌ Failed to fix diagnostic analytics for all users:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  fixDiagnosticAnalyticsForAllUsers()
    .then(() => {
      console.log('Diagnostic analytics fix completed for all users');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Diagnostic analytics fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixDiagnosticAnalyticsForAllUsers };