#!/usr/bin/env node

/**
 * Emergency script to fix specific user's access immediately
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function emergencyFixUser() {
  try {
    console.log('🚨 EMERGENCY FIX: Restoring user access...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find the user
    const user = await db.collection('users').findOne({ 
      email: 'megagigsolution@gmail.com' 
    });
    
    if (!user) {
      console.error('❌ User not found!');
      process.exit(1);
    }

    console.log(`👤 User: ${user.email}`);

    // 1. Ensure user has all required features
    const requiredUserFeatures = ['diagnostic_analytics', 'ai_diagnostics', 'advancedReports'];
    const currentUserFeatures = user.features || [];
    const missingUserFeatures = requiredUserFeatures.filter(f => !currentUserFeatures.includes(f));

    if (missingUserFeatures.length > 0) {
      console.log(`🔧 Adding missing user features: ${missingUserFeatures.join(', ')}`);
      await db.collection('users').updateOne(
        { _id: user._id },
        { 
          $set: { 
            features: [...currentUserFeatures, ...missingUserFeatures],
            updatedAt: new Date()
          } 
        }
      );
    }

    // 2. Ensure subscription has all required features
    const subscription = await db.collection('subscriptions').findOne({
      workplaceId: user.workplaceId,
      status: { $in: ['active', 'trial'] }
    });

    if (subscription) {
      const requiredSubFeatures = [
        'diagnostic_analytics', 'ai_diagnostics', 'advancedReports',
        'reportsExport', 'careNoteExport', 'multiUserSupport', 'prioritySupport',
        'emailReminders', 'smsReminders', 'teamManagement', 'basic_clinical_notes',
        'basic_reports', 'team_management', 'patient_management', 'medication_management',
        'advanced_analytics', 'compliance_tracking', 'clinical_decision_support',
        'api_access', 'audit_logs', 'drug_information', 'user_management',
        'patient_engagement_module', 'appointment_scheduling', 'followup_task_management',
        'smart_reminder_system', 'engagement_analytics', 'schedule_management'
      ];

      const currentSubFeatures = subscription.features || [];
      const missingSubFeatures = requiredSubFeatures.filter(f => !currentSubFeatures.includes(f));

      if (missingSubFeatures.length > 0) {
        console.log(`🔧 Adding missing subscription features: ${missingSubFeatures.length} features`);
        await db.collection('subscriptions').updateOne(
          { _id: subscription._id },
          { 
            $set: { 
              features: [...currentSubFeatures, ...missingSubFeatures],
              customFeatures: ['diagnostic_analytics'],
              updatedAt: new Date()
            } 
          }
        );
      }
    }

    // 3. Ensure workplace membership is correct
    const workplace = await db.collection('workplaces').findOne({
      _id: user.workplaceId
    });

    if (workplace) {
      const currentMembers = workplace.members || [];
      const existingMembership = currentMembers.find(member => 
        member.userId?.toString() === user._id.toString()
      );

      if (!existingMembership) {
        console.log('🔧 Adding user as Owner to workplace');
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
      } else if (existingMembership.role !== 'Owner') {
        console.log(`🔧 Updating workplace role from ${existingMembership.role} to Owner`);
        await db.collection('workplaces').updateOne(
          { 
            _id: workplace._id,
            'members.userId': user._id
          },
          { 
            $set: { 
              'members.$.role': 'Owner',
              'members.$.updatedAt': new Date()
            } 
          }
        );
      }
    }

    // 4. Ensure feature flag exists and is correct
    const featureFlag = await db.collection('featureflags').findOne({
      key: 'diagnostic_analytics'
    });

    if (!featureFlag) {
      console.log('🔧 Creating diagnostic_analytics feature flag');
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
    } else if (!featureFlag.isActive) {
      console.log('🔧 Activating diagnostic_analytics feature flag');
      await db.collection('featureflags').updateOne(
        { _id: featureFlag._id },
        { 
          $set: { 
            isActive: true,
            allowedTiers: ['free', 'basic', 'pro', 'enterprise', 'free_trial'],
            updatedAt: new Date()
          } 
        }
      );
    }

    // 5. Ensure plan has required features
    if (subscription) {
      const plan = await db.collection('pricingplans').findOne({
        _id: subscription.planId
      });

      if (plan) {
        const planFeatures = plan.features || [];
        const requiredPlanFeatures = ['ai_diagnostics', 'advancedReports'];
        const missingPlanFeatures = requiredPlanFeatures.filter(f => !planFeatures.includes(f));

        if (missingPlanFeatures.length > 0) {
          console.log(`🔧 Adding missing plan features: ${missingPlanFeatures.join(', ')}`);
          await db.collection('pricingplans').updateOne(
            { _id: plan._id },
            { 
              $set: { 
                features: [...planFeatures, ...missingPlanFeatures],
                updatedAt: new Date()
              } 
            }
          );
        }

        const planPermissions = plan.permissions || [];
        const requiredPermissions = ['diagnostic:analytics', 'diagnostic:read', 'diagnostic:create'];
        const missingPermissions = requiredPermissions.filter(p => !planPermissions.includes(p));

        if (missingPermissions.length > 0) {
          console.log(`🔧 Adding missing plan permissions: ${missingPermissions.join(', ')}`);
          await db.collection('pricingplans').updateOne(
            { _id: plan._id },
            { 
              $set: { 
                permissions: [...planPermissions, ...missingPermissions],
                updatedAt: new Date()
              } 
            }
          );
        }
      }
    }

    console.log('\\n✅ EMERGENCY FIX COMPLETED!');
    console.log('🔄 Please restart your backend server now:');
    console.log('   1. Stop backend (Ctrl+C)');
    console.log('   2. Start backend (npm run dev)');
    console.log('   3. Hard refresh browser (Ctrl+F5)');

  } catch (error) {
    console.error('❌ Emergency fix failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  emergencyFixUser()
    .then(() => {
      console.log('Emergency fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Emergency fix failed:', error);
      process.exit(1);
    });
}

module.exports = { emergencyFixUser };