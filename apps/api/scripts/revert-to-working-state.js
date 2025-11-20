#!/usr/bin/env node

/**
 * Script to revert to the EXACT working state before the mass update
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function revertToWorkingState() {
  try {
    console.log('🔄 REVERTING TO EXACT WORKING STATE...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find the specific user
    const user = await db.collection('users').findOne({ 
      email: 'megagigsolution@gmail.com' 
    });
    
    if (!user) {
      console.error('❌ User not found!');
      process.exit(1);
    }

    console.log(`👤 Reverting user: ${user.email}`);

    // 1. REVERT USER TO EXACT WORKING STATE
    console.log('🔧 Step 1: Reverting user configuration...');
    await db.collection('users').updateOne(
      { _id: user._id },
      { 
        $set: { 
          features: ['diagnostic_analytics'], // Only the essential feature
          updatedAt: new Date(),
          lastPermissionRefresh: new Date()
        } 
      }
    );

    // 2. REVERT SUBSCRIPTION TO EXACT WORKING STATE  
    console.log('🔧 Step 2: Reverting subscription configuration...');
    const subscription = await db.collection('subscriptions').findOne({
      workplaceId: user.workplaceId,
      status: { $in: ['active', 'trial'] }
    });

    if (subscription) {
      // Set to the EXACT working features list
      const workingFeatures = [
        'reportsExport', 'careNoteExport', 'multiUserSupport', 'prioritySupport',
        'emailReminders', 'smsReminders', 'advancedReports', 'teamManagement',
        'basic_clinical_notes', 'basic_reports', 'team_management', 'patient_management',
        'medication_management', 'advanced_analytics', 'compliance_tracking',
        'clinical_decision_support', 'api_access', 'audit_logs', 'ai_diagnostics',
        'drug_information', 'user_management', 'patient_engagement_module',
        'appointment_scheduling', 'followup_task_management', 'smart_reminder_system',
        'engagement_analytics', 'schedule_management', 'diagnostic_analytics'
      ];

      await db.collection('subscriptions').updateOne(
        { _id: subscription._id },
        { 
          $set: { 
            features: workingFeatures,
            customFeatures: ['diagnostic_analytics'],
            updatedAt: new Date()
          } 
        }
      );
    }

    // 3. REVERT WORKPLACE TO EXACT WORKING STATE
    console.log('🔧 Step 3: Reverting workplace membership...');
    const workplace = await db.collection('workplaces').findOne({
      _id: user.workplaceId
    });

    if (workplace) {
      // Remove ALL members and add ONLY the specific user as Owner
      await db.collection('workplaces').updateOne(
        { _id: workplace._id },
        { 
          $set: { 
            members: [
              {
                userId: user._id,
                role: 'Owner',
                joinedAt: new Date(),
                status: 'active',
                permissions: [],
                createdAt: new Date(),
                updatedAt: new Date()
              }
            ],
            updatedAt: new Date()
          }
        }
      );
    }

    // 4. REVERT FEATURE FLAG TO EXACT WORKING STATE
    console.log('🔧 Step 4: Reverting feature flag...');
    await db.collection('featureflags').deleteMany({
      $or: [
        { name: 'diagnostic_analytics' },
        { key: 'diagnostic_analytics' }
      ]
    });

    // Create the EXACT working feature flag
    await db.collection('featureflags').insertOne({
      name: 'diagnostic_analytics',
      key: 'diagnostic_analytics',
      description: 'Access to diagnostic analytics and reporting features',
      isActive: true,
      allowedTiers: ['free', 'basic', 'pro', 'enterprise', 'free_trial'],
      allowedRoles: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // 5. REVERT PLAN TO EXACT WORKING STATE
    console.log('🔧 Step 5: Reverting plan configuration...');
    if (subscription) {
      const plan = await db.collection('pricingplans').findOne({
        _id: subscription.planId
      });

      if (plan) {
        // Ensure plan has the required features
        const currentFeatures = plan.features || [];
        const requiredFeatures = ['ai_diagnostics', 'advancedReports'];
        const missingFeatures = requiredFeatures.filter(f => !currentFeatures.includes(f));

        if (missingFeatures.length > 0) {
          await db.collection('pricingplans').updateOne(
            { _id: plan._id },
            { 
              $set: { 
                features: [...currentFeatures, ...missingFeatures],
                updatedAt: new Date()
              } 
            }
          );
        }

        // Ensure plan has the required permissions
        const currentPermissions = plan.permissions || [];
        const requiredPermissions = ['diagnostic:analytics', 'diagnostic:read', 'diagnostic:create'];
        const missingPermissions = requiredPermissions.filter(p => !currentPermissions.includes(p));

        if (missingPermissions.length > 0) {
          await db.collection('pricingplans').updateOne(
            { _id: plan._id },
            { 
              $set: { 
                permissions: [...currentPermissions, ...missingPermissions],
                updatedAt: new Date()
              } 
            }
          );
        }
      }
    }

    // 6. CLEAN UP ANY DUPLICATE MEMBERSHIPS FROM MASS UPDATE
    console.log('🔧 Step 6: Cleaning up duplicate memberships...');
    
    // Find all workplaces and clean up duplicate memberships
    const allWorkplaces = await db.collection('workplaces').find({}).toArray();
    
    for (const wp of allWorkplaces) {
      if (wp.members && wp.members.length > 0) {
        // Remove duplicates by userId
        const uniqueMembers = [];
        const seenUserIds = new Set();
        
        for (const member of wp.members) {
          const userIdStr = member.userId?.toString();
          if (userIdStr && !seenUserIds.has(userIdStr)) {
            seenUserIds.add(userIdStr);
            uniqueMembers.push(member);
          }
        }
        
        // Only update if there were duplicates
        if (uniqueMembers.length !== wp.members.length) {
          await db.collection('workplaces').updateOne(
            { _id: wp._id },
            { 
              $set: { 
                members: uniqueMembers,
                updatedAt: new Date()
              } 
            }
          );
        }
      }
    }

    // 7. VERIFY THE REVERT
    console.log('\\n🔍 Verifying revert...');
    
    const verifyUser = await db.collection('users').findOne({ _id: user._id });
    const verifySubscription = await db.collection('subscriptions').findOne({ _id: subscription._id });
    const verifyWorkplace = await db.collection('workplaces').findOne({ _id: workplace._id });
    const verifyFeatureFlag = await db.collection('featureflags').findOne({ key: 'diagnostic_analytics' });

    console.log('✅ Verification Results:');
    console.log(`   - User features: ${verifyUser.features?.join(', ') || 'none'}`);
    console.log(`   - Subscription features: ${verifySubscription.features?.length || 0} features`);
    console.log(`   - Workplace members: ${verifyWorkplace.members?.length || 0} members`);
    console.log(`   - Feature flag active: ${verifyFeatureFlag?.isActive || false}`);

    const userMembership = verifyWorkplace.members?.find(m => 
      m.userId?.toString() === user._id.toString()
    );
    console.log(`   - User workplace role: ${userMembership?.role || 'none'}`);

    console.log('\\n✅ REVERT TO WORKING STATE COMPLETED!');
    console.log('\\n🚨 CRITICAL: RESTART YOUR BACKEND SERVER NOW!');
    console.log('   1. Stop backend (Ctrl+C)');
    console.log('   2. Start backend (npm run dev)');
    console.log('   3. Hard refresh browser (Ctrl+F5)');
    console.log('\\n🎯 This should restore the exact working state from before.');

  } catch (error) {
    console.error('❌ Revert failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  revertToWorkingState()
    .then(() => {
      console.log('Revert completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Revert failed:', error);
      process.exit(1);
    });
}

module.exports = { revertToWorkingState };