/**
 * Test Script: Verify Subscription Access Fix
 * 
 * This script tests that subscriptions are properly linked to workspaces
 * and that feature access works correctly.
 * 
 * Run with: npx ts-node src/scripts/testSubscriptionAccess.ts <user-email>
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import models
import User from '../models/User';
import { Subscription } from '../models/Subscription';
import FeatureFlag from '../models/FeatureFlag';
import PricingPlan from '../models/PricingPlan';

async function testSubscriptionAccess(userEmail: string) {
  try {
    console.log('🔧 Testing subscription access...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmadb';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Find user
    console.log(`📧 Looking for user: ${userEmail}`);
    const user = await User.findOne({ email: userEmail });
    
    if (!user) {
      console.log(`❌ User not found: ${userEmail}`);
      process.exit(1);
    }

    console.log(`✅ User found: ${user.firstName} ${user.lastName}`);
    console.log(`   ID: ${user._id}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   License Status: ${user.licenseStatus}`);
    console.log(`   Workplace ID: ${user.workplaceId || 'NONE'}\n`);

    if (!user.workplaceId) {
      console.log(`⚠️  WARNING: User has no workplaceId!`);
      console.log(`   Users must be assigned to a workplace to have subscriptions.\n`);
    }

    // Find subscription
    console.log(`🔍 Looking for subscription...`);
    const subscription = await Subscription.findOne({
      workspaceId: user.workplaceId,
      status: { $in: ['active', 'trial', 'past_due'] }
    });

    if (!subscription) {
      console.log(`❌ No active subscription found for this user's workplace`);
      console.log(`   This user will not have access to premium features.\n`);
      
      // Check if there's a subscription with old userId field
      const oldSubscription = await (Subscription as any).findOne({
        userId: user._id
      });
      
      if (oldSubscription) {
        console.log(`⚠️  FOUND OLD SUBSCRIPTION WITH userId FIELD!`);
        console.log(`   This subscription needs to be migrated.`);
        console.log(`   Run: npx ts-node src/scripts/fixSubscriptionWorkspaceId.ts\n`);
      }
    } else {
      console.log(`✅ Subscription found!`);
      console.log(`   ID: ${subscription._id}`);
      console.log(`   Tier: ${subscription.tier}`);
      console.log(`   Status: ${subscription.status}`);
      console.log(`   Start Date: ${subscription.startDate}`);
      console.log(`   End Date: ${subscription.endDate}`);
      console.log(`   Auto Renew: ${subscription.autoRenew}\n`);

      // Check AI diagnostic feature access
      console.log(`🔍 Checking AI Diagnostic feature access...`);
      
      const aiDiagnosticsFlag = await FeatureFlag.findOne({ 
        key: 'ai_diagnostics',
        isActive: true 
      });

      if (!aiDiagnosticsFlag) {
        console.log(`❌ AI Diagnostics feature flag not found or not active`);
        console.log(`   Run: npx ts-node src/scripts/verifyAIDiagnosticFeatures.ts\n`);
      } else {
        console.log(`✅ AI Diagnostics feature flag found`);
        console.log(`   Allowed Tiers: ${aiDiagnosticsFlag.allowedTiers.join(', ')}`);
        console.log(`   Allowed Roles: ${aiDiagnosticsFlag.allowedRoles.join(', ')}`);
        
        // Check tier access
        const hasTierAccess = aiDiagnosticsFlag.allowedTiers.includes(subscription.tier);
        console.log(`   User's Tier: ${subscription.tier}`);
        console.log(`   Has Tier Access: ${hasTierAccess ? '✅ YES' : '❌ NO'}`);
        
        // Check role access
        const hasRoleAccess = aiDiagnosticsFlag.allowedRoles.length === 0 || 
                             aiDiagnosticsFlag.allowedRoles.includes(user.role);
        console.log(`   User's Role: ${user.role}`);
        console.log(`   Has Role Access: ${hasRoleAccess ? '✅ YES' : '❌ NO'}`);
        
        // Check license requirement
        const requiresLicense = aiDiagnosticsFlag.customRules?.requiredLicense || false;
        const hasLicense = user.licenseStatus === 'approved';
        console.log(`   Requires License: ${requiresLicense ? 'YES' : 'NO'}`);
        console.log(`   Has Approved License: ${hasLicense ? '✅ YES' : '❌ NO'}`);
        
        // Final verdict
        const hasAccess = hasTierAccess && hasRoleAccess && (!requiresLicense || hasLicense);
        console.log(`\n   🎯 FINAL VERDICT: ${hasAccess ? '✅ ACCESS GRANTED' : '❌ ACCESS DENIED'}`);
        
        if (!hasAccess) {
          console.log(`\n   ⚠️  Reasons for denial:`);
          if (!hasTierAccess) console.log(`      - User's tier (${subscription.tier}) not in allowed tiers`);
          if (!hasRoleAccess) console.log(`      - User's role (${user.role}) not in allowed roles`);
          if (requiresLicense && !hasLicense) console.log(`      - License required but user's license status is: ${user.licenseStatus}`);
        }
      }
    }

    console.log('\n✅ Test completed!');

    // Close connection
    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Get user email from command line
const userEmail = process.argv[2];

if (!userEmail) {
  console.error('❌ Please provide a user email');
  console.error('Usage: npx ts-node src/scripts/testSubscriptionAccess.ts <user-email>');
  process.exit(1);
}

// Run the test
testSubscriptionAccess(userEmail);
