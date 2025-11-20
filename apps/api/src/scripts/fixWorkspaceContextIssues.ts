/**
 * Comprehensive Fix Script: Workspace Context Issues
 * 
 * This script fixes all issues related to workspace context loading:
 * 1. Ensures users have workplaceId set
 * 2. Ensures subscriptions use workspaceId (not userId)
 * 3. Verifies AI diagnostic features are enabled
 * 4. Tests the complete permission flow
 * 
 * Run with: npx ts-node src/scripts/fixWorkspaceContextIssues.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import models
import User from '../models/User';
import Workplace from '../models/Workplace';
import { Subscription } from '../models/Subscription';
import SubscriptionPlan from '../models/SubscriptionPlan';
import FeatureFlag from '../models/FeatureFlag';

async function fixWorkspaceContextIssues() {
  try {
    console.log('🔧 Starting comprehensive workspace context fix...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmadb';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    let issuesFixed = 0;

    // ========================================
    // STEP 1: Fix users without workplaceId
    // ========================================
    console.log('📋 STEP 1: Fixing users without workplaceId...\n');

    const usersWithoutWorkplace = await User.find({
      workplaceId: { $exists: false }
    });

    console.log(`   Found ${usersWithoutWorkplace.length} users without workplaceId`);

    for (const user of usersWithoutWorkplace) {
      // Try to find their workplace
      const workplace = await Workplace.findOne({
        $or: [
          { ownerId: user._id },
          { teamMembers: user._id }
        ]
      });

      if (workplace) {
        user.workplaceId = workplace._id;
        await user.save();
        console.log(`   ✅ Fixed user ${user.email} -> workplace ${workplace._id}`);
        issuesFixed++;
      } else {
        console.log(`   ⚠️  User ${user.email} has no workplace (needs manual assignment)`);
      }
    }

    console.log('');

    // ========================================
    // STEP 2: Fix subscriptions with userId instead of workspaceId
    // ========================================
    console.log('📋 STEP 2: Fixing subscriptions with userId field...\n');

    const allSubscriptions = await Subscription.find({});
    let subscriptionsFixed = 0;

    for (const subscription of allSubscriptions) {
      const subDoc = subscription.toObject() as any;
      
      // Check if subscription has userId field (old schema)
      if (subDoc.userId && !subscription.workspaceId) {
        console.log(`   Found subscription ${subscription._id} with userId: ${subDoc.userId}`);
        
        // Find the user
        const user = await User.findById(subDoc.userId);
        
        if (user && user.workplaceId) {
          subscription.workspaceId = user.workplaceId;
          await subscription.save();
          console.log(`   ✅ Fixed subscription ${subscription._id} -> workspaceId ${user.workplaceId}`);
          subscriptionsFixed++;
          issuesFixed++;
        } else if (user) {
          console.log(`   ⚠️  User ${user.email} has no workplaceId (fix user first)`);
        } else {
          console.log(`   ⚠️  User ${subDoc.userId} not found`);
        }
      }
    }

    console.log(`   Fixed ${subscriptionsFixed} subscriptions\n`);

    // ========================================
    // STEP 3: Verify AI Diagnostic Features
    // ========================================
    console.log('📋 STEP 3: Verifying AI Diagnostic features...\n');

    const aiFeatures = [
      {
        key: 'ai_diagnostics',
        name: 'AI Diagnostics',
        description: 'AI-powered diagnostic analysis and clinical decision support',
        allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'super_admin', 'owner'],
      },
      {
        key: 'clinical_decision_support',
        name: 'Clinical Decision Support',
        description: 'Clinical decision support system and diagnostic workflows',
        allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
        allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'super_admin', 'owner'],
      }
    ];

    for (const featureConfig of aiFeatures) {
      let feature = await FeatureFlag.findOne({ key: featureConfig.key });
      
      if (!feature) {
        feature = new FeatureFlag({
          ...featureConfig,
          isActive: true,
          metadata: {
            category: 'advanced',
            priority: 'high',
            tags: ['ai', 'diagnostics', 'clinical'],
          }
        });
        await feature.save();
        console.log(`   ✅ Created feature: ${featureConfig.name}`);
        issuesFixed++;
      } else {
        // Update to ensure it's active and has correct tiers
        feature.isActive = true;
        feature.allowedTiers = featureConfig.allowedTiers;
        feature.allowedRoles = featureConfig.allowedRoles;
        await feature.save();
        console.log(`   ✅ Updated feature: ${featureConfig.name}`);
      }
    }

    console.log('');

    // ========================================
    // STEP 4: Verify Subscription Plans have AI features
    // ========================================
    console.log('📋 STEP 4: Verifying subscription plans have AI features...\n');

    const plans = await SubscriptionPlan.find({
      tier: { $in: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'] }
    });

    for (const plan of plans) {
      let updated = false;
      
      // Ensure plan has ai_diagnostics feature
      if (!plan.features) {
        plan.features = {} as any;
      }
      
      const features = plan.features as any;
      
      if (!features.ai_diagnostics) {
        features.ai_diagnostics = true;
        updated = true;
      }
      
      if (!features.clinical_decision_support) {
        features.clinical_decision_support = true;
        updated = true;
      }
      
      if (updated) {
        await plan.save();
        console.log(`   ✅ Updated plan: ${plan.name} (${plan.tier})`);
        issuesFixed++;
      }
    }

    console.log('');

    // ========================================
    // STEP 5: Test workspace context for all users with subscriptions
    // ========================================
    console.log('📋 STEP 5: Testing workspace context loading...\n');

    const activeSubscriptions = await Subscription.find({
      status: { $in: ['active', 'trial'] }
    });

    console.log(`   Testing ${activeSubscriptions.length} active subscriptions...\n`);

    for (const subscription of activeSubscriptions) {
      if (!subscription.workspaceId) {
        console.log(`   ❌ Subscription ${subscription._id} has no workspaceId!`);
        continue;
      }

      // Find users in this workspace
      const users = await User.find({ workplaceId: subscription.workspaceId });
      
      if (users.length === 0) {
        console.log(`   ⚠️  Subscription ${subscription._id} has no users in workspace ${subscription.workspaceId}`);
        continue;
      }

      // Test first user
      const user = users[0];
      const workplace = await Workplace.findById(user.workplaceId);
      
      if (!workplace) {
        console.log(`   ❌ User ${user.email} has invalid workplaceId: ${user.workplaceId}`);
        continue;
      }

      // Check if subscription is properly linked
      const testSub = await Subscription.findOne({
        workspaceId: workplace._id,
        status: { $in: ['trial', 'active'] }
      });

      if (!testSub) {
        console.log(`   ❌ Workspace ${workplace._id} has no active subscription`);
        continue;
      }

      // Get plan details
      let plan = null;
      if (testSub.planId) {
        plan = await SubscriptionPlan.findById(testSub.planId);
      }
      
      const permissions: string[] = [];
      
      if (plan?.features) {
        Object.entries(plan.features).forEach(([key, value]) => {
          if (value === true) {
            permissions.push(key);
          }
        });
      }

      const hasAIDiagnostics = permissions.includes('ai_diagnostics');
      
      console.log(`   ${hasAIDiagnostics ? '✅' : '❌'} User: ${user.email}`);
      console.log(`      Workplace: ${workplace.name} (${workplace._id})`);
      console.log(`      Subscription: ${testSub.tier} (${testSub.status})`);
      console.log(`      Plan: ${plan?.name}`);
      console.log(`      AI Diagnostics: ${hasAIDiagnostics ? 'ENABLED' : 'DISABLED'}`);
      console.log(`      Permissions: ${permissions.length} features\n`);
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('📊 FIX SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Total issues fixed: ${issuesFixed}`);
    console.log(`   ✅ Users with workplaceId: ${(await User.countDocuments({ workplaceId: { $exists: true } }))}`);
    console.log(`   ✅ Subscriptions with workspaceId: ${(await Subscription.countDocuments({ workspaceId: { $exists: true } }))}`);
    console.log(`   ✅ Active AI feature flags: ${(await FeatureFlag.countDocuments({ key: { $in: ['ai_diagnostics', 'clinical_decision_support'] }, isActive: true }))}`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ Fix completed! Please restart your backend server.\n');

    // Close connection
    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

// Run the fix
fixWorkspaceContextIssues();
