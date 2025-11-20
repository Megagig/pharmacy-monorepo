#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma_care';

async function checkLatestTestUser() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const user = await User.findOne({
            email: { $regex: /test-invite.*@example\.com/ }
        }).sort({ createdAt: -1 });

        if (user) {
            console.log('Latest test user:');
            console.log({
                id: user._id,
                email: user.email,
                status: user.status,
                workplaceId: user.workplaceId,
                workplaceRole: user.workplaceRole,
                createdAt: user.createdAt,
                currentPlanId: user.currentPlanId,
                currentSubscriptionId: user.currentSubscriptionId
            });
        } else {
            console.log('No test users found');
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

if (require.main === module) {
    checkLatestTestUser();
}