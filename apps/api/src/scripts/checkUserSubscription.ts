#!/usr/bin/env ts-node
/**
 * Check specific user's subscription details
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import User from '../models/User';
import Subscription from '../models/Subscription';
import Workplace from '../models/Workplace';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkUserSubscription(email: string) {
    try {
        console.log(`🔍 Checking subscription for: ${email}\n`);

        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care-saas');
        console.log('✅ Connected to database\n');

        // Find user
        const user = await User.findOne({ email });

        if (!user) {
            console.log(`❌ User not found: ${email}`);
            process.exit(1);
        }

        console.log('👤 User Details:');
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${user.status}`);
        console.log(`   WorkplaceId: ${user.workplaceId}`);
        console.log(`   CurrentPlanId: ${user.currentPlanId}\n`);

        // Find subscription
        if (user.workplaceId) {
            const subscription = await Subscription.findOne({
                workspaceId: user.workplaceId
            });

            if (subscription) {
                console.log('💳 Subscription Details:');
                console.log(`   ID: ${subscription._id}`);
                console.log(`   Status: ${subscription.status}`);
                console.log(`   Tier: ${subscription.tier}`);
                console.log(`   PlanId: ${subscription.planId}`);
                console.log(`   Start Date: ${subscription.startDate}`);
                console.log(`   End Date: ${subscription.endDate}`);
                console.log(`   Trial End Date: ${subscription.trialEndDate || subscription.trialEndsAt}`);
            } else {
                console.log('❌ No subscription found for this workplace');
            }

            // Check workplace details
            const workplace = await Workplace.findById(user.workplaceId);
            if (workplace) {
                console.log(`\n🏢 Workplace Details:`);
                console.log(`   Name: ${workplace.name}`);
                console.log(`   Type: ${workplace.type}`);
                console.log(`   Owner: ${workplace.ownerId}`);
            }
        } else {
            console.log('❌ User has no workplace');
        }

        // Disconnect
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// CLI execution
const email = process.argv[2] || 'megagigsolution@gmail.com';
checkUserSubscription(email);
