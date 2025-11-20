#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { User } from '../src/models/User';
import { Workplace } from '../src/models/Workplace';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma_care';
const API_BASE_URL = 'http://localhost:5000/api';

interface TestResult {
    step: string;
    success: boolean;
    data?: any;
    error?: string;
}

async function testRealInviteCodeRegistration(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const testEmail = `real-test-${Date.now()}@example.com`;

    try {
        // Connect to MongoDB to verify data
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB for verification');

        // Step 1: Verify the MEGAGIGSOLUTION workplace exists with invite code BN4QYW
        const workplace = await Workplace.findOne({ inviteCode: 'BN4QYW' });
        results.push({
            step: 'Verify MEGAGIGSOLUTION workplace exists',
            success: !!workplace,
            data: workplace ? {
                id: workplace._id,
                name: workplace.name,
                inviteCode: workplace.inviteCode,
                teamMembersCount: workplace.teamMembers.length
            } : null,
            error: workplace ? undefined : 'MEGAGIGSOLUTION workplace not found'
        });

        if (!workplace) {
            return results;
        }

        const initialTeamCount = workplace.teamMembers.length;

        // Step 2: Make real API call to register with invite code using registerWithWorkplace endpoint
        const registrationData = {
            firstName: 'RealTest',
            lastName: 'User',
            email: testEmail,
            password: 'TestPassword123!',
            phone: '+1234567890',
            workplaceFlow: 'join',
            inviteCode: 'BN4QYW',
            workplaceRole: 'Staff'
        };

        console.log('📝 Attempting registration with data:', {
            ...registrationData,
            password: '[HIDDEN]'
        });

        const registrationResponse = await fetch(`${API_BASE_URL}/auth/register-with-workplace`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(registrationData),
        });

        const registrationResult = await registrationResponse.json();

        results.push({
            step: 'API registration with invite code',
            success: registrationResponse.ok,
            data: registrationResponse.ok ? {
                status: registrationResponse.status,
                message: registrationResult.message,
                workplaceFlow: registrationResult.data?.workplaceFlow
            } : null,
            error: registrationResponse.ok ? undefined : `${registrationResponse.status}: ${registrationResult.message || registrationResult.error}`
        });

        if (!registrationResponse.ok) {
            console.error('Registration failed:', registrationResult);
            return results;
        }

        // Wait a moment for database operations to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Step 3: Verify user was created in database
        const createdUser = await User.findOne({ email: testEmail });
        results.push({
            step: 'Verify user created in database',
            success: !!createdUser,
            data: createdUser ? {
                id: createdUser._id,
                email: createdUser.email,
                status: createdUser.status,
                workplaceId: createdUser.workplaceId,
                workplaceRole: createdUser.workplaceRole,
                subscriptionTier: createdUser.subscriptionTier
            } : null,
            error: createdUser ? undefined : 'User not found in database'
        });

        // Step 4: Verify user status is pending (requires approval)
        if (createdUser) {
            results.push({
                step: 'Verify user status is pending',
                success: createdUser.status === 'pending',
                data: { status: createdUser.status },
                error: createdUser.status === 'pending' ? undefined : `Expected 'pending', got '${createdUser.status}'`
            });

            // Step 5: Verify user is assigned to correct workplace
            const isAssignedToCorrectWorkplace = createdUser.workplaceId?.toString() === workplace._id.toString();
            results.push({
                step: 'Verify user assigned to MEGAGIGSOLUTION workplace',
                success: isAssignedToCorrectWorkplace,
                data: {
                    userWorkplaceId: createdUser.workplaceId,
                    expectedWorkplaceId: workplace._id,
                    isMatch: isAssignedToCorrectWorkplace
                },
                error: isAssignedToCorrectWorkplace ? undefined : 'User not assigned to correct workplace'
            });

            // Step 6: Verify user has correct workplace role
            results.push({
                step: 'Verify user has Staff workplace role',
                success: createdUser.workplaceRole === 'Staff',
                data: { workplaceRole: createdUser.workplaceRole },
                error: createdUser.workplaceRole === 'Staff' ? undefined : `Expected 'Staff', got '${createdUser.workplaceRole}'`
            });

            // Step 7: Verify user inherits workplace subscription
            results.push({
                step: 'Verify user has subscription',
                success: !!createdUser.currentSubscriptionId,
                data: {
                    subscriptionId: createdUser.currentSubscriptionId,
                    subscriptionTier: createdUser.subscriptionTier
                },
                error: createdUser.currentSubscriptionId ? undefined : 'User has no subscription assigned'
            });
        }

        // Step 8: Verify workplace team members increased
        const updatedWorkplace = await Workplace.findById(workplace._id);
        const teamIncreased = updatedWorkplace && updatedWorkplace.teamMembers.length === initialTeamCount + 1;
        results.push({
            step: 'Verify workplace team members increased',
            success: !!teamIncreased,
            data: {
                initialCount: initialTeamCount,
                currentCount: updatedWorkplace?.teamMembers.length,
                userAddedToTeam: teamIncreased
            },
            error: teamIncreased ? undefined : 'User not added to workplace team members'
        });

        // Step 9: Test that user CANNOT login (should be pending approval)
        console.log('🔐 Testing login attempt...');
        const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: testEmail,
                password: 'TestPassword123!'
            }),
        });

        const loginResult = await loginResponse.json();
        const loginShouldFail = !loginResponse.ok && (
            loginResult.message?.includes('pending') ||
            loginResult.message?.includes('approval') ||
            loginResult.message?.includes('verify')
        );

        results.push({
            step: 'Verify user cannot login (pending approval)',
            success: loginShouldFail,
            data: {
                loginStatus: loginResponse.status,
                loginMessage: loginResult.message,
                shouldRequireApproval: true
            },
            error: loginShouldFail ? undefined : 'User was able to login without approval'
        });

        return results;

    } catch (error: any) {
        results.push({
            step: 'Overall test execution',
            success: false,
            error: error.message
        });
        return results;
    } finally {
        await mongoose.disconnect();
    }
}

async function main() {
    console.log('🧪 Testing Real Invite Code Registration Flow...\n');
    console.log('This test will:');
    console.log('1. Call the actual API endpoint /api/auth/register-with-workplace');
    console.log('2. Verify user is assigned to MEGAGIGSOLUTION workspace');
    console.log('3. Verify user status remains "pending" requiring approval');
    console.log('4. Verify user cannot login until approved\n');

    const results = await testRealInviteCodeRegistration();

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
    console.log(`📈 Summary: ${successCount}/${totalCount} tests passed`);

    if (successCount === totalCount) {
        console.log('🎉 ALL TESTS PASSED! Invite code registration flow is working correctly.');
        console.log('✅ Users with invite codes are properly assigned to workspaces');
        console.log('✅ Users require approval before they can login');
        console.log('✅ Multi-step registration handles invite codes correctly');
    } else {
        console.log('⚠️  Some tests failed. The invite code flow may still have issues.');
    }
}

if (require.main === module) {
    main().catch(console.error);
}