#!/usr/bin/env ts-node
/**
 * Fix subscription planId references to use PricingPlan model
 * 
 * Ensures all subscriptions have valid planId references that match their tier
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Subscription from '../models/Subscription';
import PricingPlan from '../models/PricingPlan';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function fixSubscriptionPlanIds() {
    try {
        console.log('🔧 Fixing subscription planId references to use PricingPlan model...\n');

        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care-saas');
        console.log('✅ Connected to database\n');

        // Get all subscriptions
        const subscriptions = await Subscription.find({});
        console.log(`📊 Found ${subscriptions.length} subscriptions to check\n`);

        // Get all available pricing plans
        const plans = await PricingPlan.find({});
        const plansByTier = new Map();

        plans.forEach(plan => {
            const key = `${plan.tier}_${plan.billingPeriod}`;
            plansByTier.set(key, plan);
            
            // Also set a fallback without billing period
            if (!plansByTier.has(plan.tier)) {
                plansByTier.set(plan.tier, plan);
            }
        });

        console.log(`📋 Available pricing plans: ${plans.map(p => `${p.tier}-${p.billingPeriod} (${p.name})`).join(', ')}\n`);

        let fixed = 0;
        let skipped = 0;
        let errors = 0;

        for (const subscription of subscriptions) {
            try {
                console.log(`\n🔍 Checking subscription ${subscription._id} (tier: ${subscription.tier}, billing: ${subscription.billingInterval})`);

                // Check if planId is null or doesn't exist in PricingPlan
                let needsFix = false;
                let currentPlan = null;

                if (!subscription.planId) {
                    console.log(`❌ Subscription has no planId`);
                    needsFix = true;
                } else {
                    // Check if the planId exists in PricingPlan collection
                    currentPlan = await PricingPlan.findById(subscription.planId);
                    if (!currentPlan) {
                        console.log(`❌ Subscription has invalid planId reference (not found in PricingPlan)`);
                        needsFix = true;
                    } else {
                        console.log(`✅ Plan found: ${currentPlan.name} (${currentPlan.tier}-${currentPlan.billingPeriod})`);
                    }
                }

                if (needsFix) {
                    // Try to find matching plan by tier and billing interval
                    const billingPeriod = subscription.billingInterval || 'monthly';
                    const tierKey = `${subscription.tier}_${billingPeriod}`;
                    
                    let matchingPlan = plansByTier.get(tierKey) || plansByTier.get(subscription.tier);

                    if (matchingPlan) {
                        subscription.planId = matchingPlan._id as any;
                        await subscription.save();
                        console.log(`✅ Fixed: Assigned ${matchingPlan.name} (${matchingPlan.tier}-${matchingPlan.billingPeriod}) plan to subscription`);
                        fixed++;
                    } else {
                        console.log(`⚠️  No matching plan found for tier: ${subscription.tier}, billing: ${billingPeriod}`);
                        console.log(`Available tiers: ${Array.from(plansByTier.keys()).join(', ')}`);
                        errors++;
                    }
                } else if (currentPlan) {
                    // Verify tier and billing period match
                    const tierMatches = currentPlan.tier === subscription.tier;
                    const billingMatches = currentPlan.billingPeriod === subscription.billingInterval;

                    if (!tierMatches || !billingMatches) {
                        console.log(`⚠️  Mismatch - Plan: ${currentPlan.tier}-${currentPlan.billingPeriod}, Subscription: ${subscription.tier}-${subscription.billingInterval}`);

                        // Try to find correct plan
                        const billingPeriod = subscription.billingInterval || 'monthly';
                        const tierKey = `${subscription.tier}_${billingPeriod}`;
                        const correctPlan = plansByTier.get(tierKey) || plansByTier.get(subscription.tier);

                        if (correctPlan && correctPlan._id.toString() !== currentPlan._id.toString()) {
                            subscription.planId = correctPlan._id as any;
                            await subscription.save();
                            console.log(`✅ Fixed: Corrected plan to ${correctPlan.name} (${correctPlan.tier}-${correctPlan.billingPeriod})`);
                            fixed++;
                        } else {
                            console.log(`✅ Keeping current plan (close enough match)`);
                            skipped++;
                        }
                    } else {
                        console.log(`✅ Subscription OK - correct plan assigned`);
                        skipped++;
                    }
                } else {
                    skipped++;
                }
            } catch (error) {
                console.error(`❌ Error processing subscription ${subscription._id}:`, error);
                errors++;
            }
        }

        console.log(`\n📊 Summary:`);
        console.log(`   Total subscriptions: ${subscriptions.length}`);
        console.log(`   Fixed: ${fixed}`);
        console.log(`   Already OK: ${skipped}`);
        console.log(`   Errors: ${errors}\n`);

        if (fixed > 0) {
            console.log('🎉 Subscription planId references have been updated to use PricingPlan model!');
        }

        // Disconnect
        await mongoose.connection.close();
        console.log('✅ Database connection closed');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// CLI execution
fixSubscriptionPlanIds();