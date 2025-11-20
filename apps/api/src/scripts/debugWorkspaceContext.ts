/**
 * Debug Script: Workspace Context Loading
 * 
 * This script debugs why workspace context is not loading properly
 * and shows the actual data flow.
 * 
 * Run with: npx ts-node src/scripts/debugWorkspaceContext.ts <user-email>
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

async function debugWorkspaceContext(userEmail: string) {
  try {
    console.log('🔍 Debugging workspace context loading...\n');

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

    console.log(`✅ User found:`);
    console.log(`   ID: ${user._id}`);
    console.log(`   Name: ${user.firstName} ${user.lastName}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Workplace ID: ${user.workplaceId || 'NONE'}\n`);

    // Check how workspaceContext middleware would load the workspace
    console.log('🔍 Checking workspace loading methods:\n');

    // Method 1: Current middleware approach (ownerId or teamMembers)
    console.log('Method 1: Workplace.findOne({ $or: [{ ownerId }, { teamMembers }] })');
    const workplaceMethod1 = await Workplace.findOne({
      $or: [
        { ownerId: user._id },
        { teamMembers: user._id }
      ]
    });
    console.log(`   Result: ${workplaceMethod1 ? `✅ Found (${workplaceMethod1._id})` : '❌ Not found'}\n`);

    // Method 2: Using user's workplaceId field
    console.log('Method 2: Workplace.findById(user.workplaceId)');
    let workplaceMethod2 = null;
    if (user.workplaceId) {
      workplaceMethod2 = await Workplace.findById(user.workplaceId);
      console.log(`   Result: ${workplaceMethod2 ? `✅ Found (${workplaceMethod2._id})` : '❌ Not found'}\n`);
    } else {
      console.log(`   Result: ❌ User has no workplaceId\n`);
    }

    // Determine which workplace to use
    const workplace = workplaceMethod2 || workplaceMethod1;

    if (!workplace) {
      console.log('❌ No workplace found using either method!');
      console.log('\n⚠️  ISSUE: User needs to be assigned to a workplace\n');
      process.exit(1);
    }

    console.log(`✅ Using workplace: ${workplace._id}`);
    console.log(`   Name: ${workplace.name}`);
    console.log(`   Owner ID: ${workplace.ownerId}`);
    console.log(`   Current Plan ID: ${workplace.currentPlanId || 'NONE'}\n`);

    // Check subscription
    console.log('🔍 Looking for subscription...');
    console.log(`   Query: Subscription.findOne({ workspaceId: ${workplace._id}, status: { $in: ['trial', 'active', 'past_due', 'expired'] } })`);
    
    const subscription = await Subscription.findOne({
      workspaceId: workplace._id,
      status: { $in: ['trial', 'active', 'past_due', 'expired'] }
    }).populate('planId');

    if (!subscription) {
      console.log(`   Result: ❌ No subscription found\n`);
      
      // Check for old subscriptions with userId
      console.log('🔍 Checking for old subscriptions with userId field...');
      const oldSubscription = await (Subscription as any).findOne({
        userId: user._id
      });
      
      if (oldSubscription) {
        console.log(`   ⚠️  FOUND OLD SUBSCRIPTION!`);
        console.log(`      ID: ${oldSubscription._id}`);
        console.log(`      Has userId field: YES`);
        console.log(`      Has workspaceId field: ${oldSubscription.workspaceId ? 'YES' : 'NO'}`);
        console.log(`\n   🔧 FIX NEEDED: Run fixSubscriptionWorkspaceId.ts script\n`);
      } else {
        console.log(`   Result: ❌ No old subscriptions found either\n`);
      }
      
      process.exit(1);
    }

    console.log(`   Result: ✅ Subscription found`);
    console.log(`      ID: ${subscription._id}`);
    console.log(`      Tier: ${subscription.tier}`);
    console.log(`      Status: ${subscription.status}`);
    console.log(`      Start Date: ${subscription.startDate}`);
    console.log(`      End Date: ${subscription.endDate}\n`);

    // Check plan
    let plan = null;
    if (subscription.planId) {
      plan = subscription.planId as any;
      console.log(`✅ Plan found from subscription:`);
      console.log(`   ID: ${plan._id}`);
      console.log(`   Name: ${plan.name}`);
      console.log(`   Tier: ${plan.tier}\n`);
    } else if (workplace.currentPlanId) {
      plan = await SubscriptionPlan.findById(workplace.currentPlanId);
      console.log(`✅ Plan found from workplace:`);
      console.log(`   ID: ${plan?._id}`);
      console.log(`   Name: ${plan?.name}`);
      console.log(`   Tier: ${plan?.tier}\n`);
    }

    // Build permissions array
    console.log('🔍 Building permissions array...');
    const permissions: string[] = [];
    if (plan?.features) {
      Object.entries(plan.features).forEach(([key, value]) => {
        if (value === true) {
          permissions.push(key);
        }
      });
    }
    console.log(`   Permissions: ${permissions.length > 0 ? permissions.join(', ') : 'NONE'}\n`);

    // Check subscription status
    const isSubscriptionActive = ['trial', 'active'].includes(subscription.status);
    console.log(`📊 Subscription Status:`);
    console.log(`   Is Active: ${isSubscriptionActive ? '✅ YES' : '❌ NO'}`);
    console.log(`   Status: ${subscription.status}\n`);

    // Summary
    console.log('📋 SUMMARY:');
    console.log(`   ✅ User found: ${user.email}`);
    console.log(`   ${workplace ? '✅' : '❌'} Workplace found: ${workplace?._id}`);
    console.log(`   ${subscription ? '✅' : '❌'} Subscription found: ${subscription?._id}`);
    console.log(`   ${plan ? '✅' : '❌'} Plan found: ${plan?._id}`);
    console.log(`   ${isSubscriptionActive ? '✅' : '❌'} Subscription active: ${isSubscriptionActive}`);
    console.log(`   ${permissions.length > 0 ? '✅' : '❌'} Permissions: ${permissions.length} features\n`);

    if (workplace && subscription && plan && isSubscriptionActive && permissions.length > 0) {
      console.log('✅ Workspace context should load correctly!\n');
    } else {
      console.log('❌ Workspace context has issues!\n');
      
      if (!workplace) {
        console.log('   🔧 FIX: User needs to be assigned to a workplace');
      }
      if (!subscription) {
        console.log('   🔧 FIX: Workspace needs an active subscription');
      }
      if (!plan) {
        console.log('   🔧 FIX: Subscription needs a valid plan');
      }
      if (!isSubscriptionActive) {
        console.log('   🔧 FIX: Subscription status needs to be "active" or "trial"');
      }
      if (permissions.length === 0) {
        console.log('   🔧 FIX: Plan needs to have features enabled');
      }
      console.log('');
    }

    // Close connection
    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }
}

// Get user email from command line
const userEmail = process.argv[2];

if (!userEmail) {
  console.error('❌ Please provide a user email');
  console.error('Usage: npx ts-node src/scripts/debugWorkspaceContext.ts <user-email>');
  process.exit(1);
}

// Run the debug
debugWorkspaceContext(userEmail);
