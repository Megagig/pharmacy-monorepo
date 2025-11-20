#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User';
import { Workplace } from '../src/models/Workplace';
import { WorkspaceInvite } from '../src/models/WorkspaceInvite';
import SubscriptionPlan from '../src/models/SubscriptionPlan';
import Subscription from '../src/models/Subscription';
import WorkplaceService from '../src/services/WorkplaceService';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma_care';

interface TestResult {
    step: string;
    success: boolean;
    data?: any;
    error?: string;
}

async function simulateInviteCodeRegistration(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    let session: mongoose.ClientSession | undefined;

    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        session = await mongoose.startSession();

        // Step 1: Find the MEGAGIGSOLUTION workplace with invite code BN4QYW
        const workplace = await Workplace.findOne({ inviteCode: 'BN4QYW' });
        results.push({
            step: 'Find workplace by invite code BN4QYW',
            success: !!workplace,
            data: workplace ? {
                id: workplace._id,
                name: workplace.name,
                inviteCode: workplace.inviteCode,
                ownerId: workplace.ownerId,
                teamMembers: workplace.teamMembers.length
            } : null,
            error: workplace ? undefined : 'Workplace not found with invite code BN4QYW'
        });

        if (!workplace) {
            return results;
        }

        // Step 2: Get the Free Trial plan
        const freeTrialPlan = await SubscriptionPlan.findOne({
            name: 'Free Trial',
            billingInterval: 'monthly',
        });
        results.push({
            step: 'Find Free Trial plan',
            success: !!freeTrialPlan,
            data: freeTrialPlan ? { id: freeTrialPlan._id, name: freeTrialPlan.name } : null,
            error: freeTrialPlan ? undefined : 'Free Trial plan not found'
        });

        if (!freeTrialPlan) {
            return results;
        }

        // Step 3: Simulate creating a user with pending status (registerWithWorkplace flow)
        const testEmail = `test-invite-${Date.now()}@example.com`;
        const executeRegistration = async () => {
            // Create user first with pending status
            const userArray = await User.create(
                [
                    {
                        firstName: 'Test',
                        lastName: 'InviteUser',
                        email: testEmail,
                        passwordHash: 'hashedpassword123',
                        role: 'pharmacy_team',
                        currentPlanId: freeTrialPlan._id,
                        subscriptionTier: 'free_trial',
                        status: 'pending', // This should be pending for invite code users
                    },
                ],
                { session }
            );

            const createdUser = userArray[0];
            results.push({
                step: 'Create user with pending status',
                success: !!createdUser,
                data: createdUser ? {
                    id: createdUser._id,
                    email: createdUser.email,
                    status: createdUser.status,
                    workplaceId: createdUser.workplaceId,
                    workplaceRole: createdUser.workplaceRole
                } : null,
                error: createdUser ? undefined : 'Failed to create user'
            });

            if (!createdUser) {
                throw new Error('Failed to create user');
            }

            // Step 4: Use WorkplaceService.joinWorkplace to assign user to workplace
            const workplaceData = await WorkplaceService.joinWorkplace({
                userId: createdUser._id,
                inviteCode: 'BN4QYW',
                workplaceRole: 'Staff',
            }, session);

            results.push({
                step: 'Join workplace using WorkplaceService',
                success: !!workplaceData,
                data: workplaceData ? {
                    id: workplaceData._id,
                    name: workplaceData.name,
                    teamMembersCount: workplaceData.teamMembers.length
                } : null,
                error: workplaceData ? undefined : 'Failed to join workplace'
            });

            // Step 5: Check if user was updated correctly
            const updatedUser = await User.findById(createdUser._id);
            results.push({
                step: 'Verify user workplace assignment',
                success: !!updatedUser?.workplaceId,
                data: updatedUser ? {
                    id: updatedUser._id,
                    email: updatedUser.email,
                    status: updatedUser.status,
                    workplaceId: updatedUser.workplaceId,
                    workplaceRole: updatedUser.workplaceRole,
                    isAssignedToCorrectWorkplace: updatedUser.workplaceId?.toString() === workplace._id.toString()
                } : null,
                error: updatedUser?.workplaceId ? undefined : 'User not assigned to workplace'
            });

            // Step 6: Find the workplace's subscription to inherit
            const workplaceSubscription = await Subscription.findOne({
                workspaceId: workplaceData._id,
                status: { $in: ['active', 'trial', 'grace_period'] },
            });

            results.push({
                step: 'Find workplace subscription',
                success: !!workplaceSubscription,
                data: workplaceSubscription ? {
                    id: workplaceSubscription._id,
                    tier: workplaceSubscription.tier,
                    status: workplaceSubscription.status,
                    workspaceId: workplaceSubscription.workspaceId
                } : null,
                error: workplaceSubscription ? undefined : 'No active workplace subscription found'
            });

            if (workplaceSubscription) {
                // Step 7: Update user to reference the workplace subscription
                await User.findByIdAndUpdate(
                    createdUser._id,
                    {
                        currentSubscriptionId: workplaceSubscription._id,
                        subscriptionTier: workplaceSubscription.tier,
                    },
                    { session }
                );

                const finalUser = await User.findById(createdUser._id);
                results.push({
                    step: 'Update user subscription reference',
                    success: !!finalUser?.currentSubscriptionId,
                    data: finalUser ? {
                        id: finalUser._id,
                        email: finalUser.email,
                        status: finalUser.status,
                        workplaceId: finalUser.workplaceId,
                        workplaceRole: finalUser.workplaceRole,
                        subscriptionTier: finalUser.subscriptionTier,
                        currentSubscriptionId: finalUser.currentSubscriptionId
                    } : null,
                    error: finalUser?.currentSubscriptionId ? undefined : 'Failed to update user subscription'
                });
            }
        };

        // Try to use transactions, but fall back to non-transactional for test environments
        try {
            await session.withTransaction(executeRegistration);
        } catch (transactionError: any) {
            // If transaction fails (e.g., in test environment), try without transaction
            if (
                transactionError.code === 20 ||
                transactionError.codeName === 'IllegalOperation'
            ) {
                console.warn('Transactions not supported, falling back to non-transactional execution');
                await executeRegistration();
            } else {
                throw transactionError;
            }
        }

        return results;

    } catch (error: any) {
        results.push({
            step: 'Overall process',
            success: false,
            error: error.message
        });
        return results;
    } finally {
        if (session) {
            session.endSession();
        }
        await mongoose.disconnect();
    }
}

async function main() {
    console.log('🔍 Testing invite code registration flow...\n');

    const results = await simulateInviteCodeRegistration();

    console.log('📊 Test Results:');
    console.log('='.repeat(80));

    results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`${index + 1}. ${status} ${result.step}`);

        if (result.data) {
            console.log(`   Data:`, JSON.stringify(result.data, null, 2));
        }

        if (result.error) {
            console.log(`   Error: ${result.error}`);
        }

        console.log('');
    });

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    console.log('='.repeat(80));
    console.log(`📈 Summary: ${successCount}/${totalCount} steps successful`);

    if (successCount === totalCount) {
        console.log('🎉 All steps passed! Invite code registration flow works correctly.');
    } else {
        console.log('⚠️  Some steps failed. Review the errors above.');
    }
}

if (require.main === module) {
    main().catch(console.error);
}