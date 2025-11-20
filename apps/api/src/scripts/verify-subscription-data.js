#!/usr/bin/env node
/**
 * Verify and Fix Subscription Data
 * 
 * This script checks for subscription issues where:
 * 1. User has a workplace but no subscription
 * 2. Subscription exists but planId is not populated
 * 3. Subscription status is incorrect
 */

const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User').default;
const Subscription = require('../models/Subscription').default;
const Workplace = require('../models/Workplace').default;
const SubscriptionPlan = require('../models/SubscriptionPlan').default;

async function verifySubscriptions() {
    try {
        console.log('🔍 Verifying subscription data...\n');

        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care-saas');
        console.log('✅ Connected to database\n');

        // 1. Find users with workplaces but no subscriptions
        const usersWithWorkplaces = await User.find({
            workplaceId: { $exists: true, $ne: null }
        }).select('_id email workplaceId role');

        console.log(`📊 Found ${usersWithWorkplaces.length} users with workplaces\n`);

        const issues = [];
        const fixes = [];

        for (const user of usersWithWorkplaces) {
            const subscription = await Subscription.findOne({
                workspaceId: user.workplaceId,
            }).populate('planId');

            if (!subscription) {
                issues.push({
                    type: 'NO_SUBSCRIPTION',
                    userId: user._id,
                    email: user.email,
                    workplaceId: user.workplaceId,
                });
                console.log(`❌ User ${user.email} has workplace but no subscription`);
            } else {
                // Check subscription status
                const validStatuses = ['active', 'trial', 'past_due'];
                if (!validStatuses.includes(subscription.status)) {
                    issues.push({
                        type: 'INVALID_STATUS',
                        userId: user._id,
                        email: user.email,
                        workplaceId: user.workplaceId,
                        subscriptionId: subscription._id,
                        status: subscription.status,
                    });
                    console.log(`⚠️  User ${user.email} has subscription with status: ${subscription.status}`);
                }

                // Check if planId is populated
                if (!subscription.planId) {
                    issues.push({
                        type: 'NO_PLAN_ID',
                        userId: user._id,
                        email: user.email,
                        workplaceId: user.workplaceId,
                        subscriptionId: subscription._id,
                    });
                    console.log(`❌ User ${user.email} has subscription but planId is not populated`);
                } else {
                    console.log(`✅ User ${user.email} - Subscription OK (${subscription.status}, ${subscription.tier})`);
                }
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   Total users with workplaces: ${usersWithWorkplaces.length}`);
        console.log(`   Issues found: ${issues.length}\n`);

        if (issues.length > 0) {
            console.log('🔧 Issues breakdown:');
            const noSubscription = issues.filter(i => i.type === 'NO_SUBSCRIPTION').length;
            const invalidStatus = issues.filter(i => i.type === 'INVALID_STATUS').length;
            const noPlanId = issues.filter(i => i.type === 'NO_PLAN_ID').length;

            console.log(`   - No subscription: ${noSubscription}`);
            console.log(`   - Invalid status: ${invalidStatus}`);
            console.log(`   - No planId: ${noPlanId}\n`);

            // Suggest fixes
            console.log('💡 Suggested fixes:\n');
            console.log('   1. For users without subscriptions:');
            console.log('      - Create trial subscriptions');
            console.log('   2. For invalid statuses:');
            console.log('      - Update to "active" if within valid period');
            console.log('   3. For missing planId:');
            console.log('      - Populate with appropriate plan based on tier\n');
        }

        // Disconnect
        await mongoose.connection.close();
        console.log('✅ Database connection closed');

        return { issues, fixes };

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

async function fixSubscriptions() {
    try {
        console.log('🔧 Attempting to fix subscription issues...\n');

        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care-saas');
        console.log('✅ Connected to database\n');

        // Get the Pro plan (default for fixes)
        const proPlan = await SubscriptionPlan.findOne({ tier: 'pro' });

        if (!proPlan) {
            console.error('❌ Pro plan not found. Please ensure subscription plans are seeded.');
            process.exit(1);
        }

        console.log(`✅ Found Pro plan: ${proPlan.name}\n`);

        // Find subscriptions with missing or invalid planId
        const subscriptionsWithIssues = await Subscription.find({
            $or: [
                { planId: null },
                { planId: { $exists: false } },
            ]
        });

        console.log(`📊 Found ${subscriptionsWithIssues.length} subscriptions with planId issues\n`);

        let fixed = 0;
        for (const subscription of subscriptionsWithIssues) {
            // Determine the correct plan based on tier
            let correctPlan = proPlan;

            if (subscription.tier) {
                const planForTier = await SubscriptionPlan.findOne({ tier: subscription.tier });
                if (planForTier) {
                    correctPlan = planForTier;
                }
            }

            // Update subscription with correct planId
            subscription.planId = correctPlan._id;
            await subscription.save();

            console.log(`✅ Fixed subscription ${subscription._id} - assigned ${correctPlan.name} plan`);
            fixed++;
        }

        console.log(`\n✅ Fixed ${fixed} subscriptions\n`);

        // Disconnect
        await mongoose.connection.close();
        console.log('✅ Database connection closed');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// CLI execution
const command = process.argv[2];

if (command === 'verify') {
    verifySubscriptions();
} else if (command === 'fix') {
    fixSubscriptions();
} else {
    console.log('Usage:');
    console.log('  node verify-subscription-data.js verify  - Check for subscription issues');
    console.log('  node verify-subscription-data.js fix     - Fix subscription issues');
}
