import request from 'supertest';
import app from '../../app';
import UserModel, { IUser } from '../../models/User';
import WorkplaceModel, { IWorkplace } from '../../models/Workplace';
import SubscriptionModel, { ISubscription } from '../../models/Subscription';
import SubscriptionPlanModel, { ISubscriptionPlan } from '../../models/SubscriptionPlan';
import { emailService } from '../../utils/emailService';
import jwt from 'jsonwebtoken';

// Mock email service
jest.mock('../../utils/emailService');
const mockEmailService = emailService as jest.Mocked<typeof emailService>;

describe('Subscription Workflow Integration Tests', () => {
    let ownerUser: any;
    let workspace: any;
    let basicPlan: any;
    let premiumPlan: any;
    let enterprisePlan: any;
    let currentSubscription: any;
    let authToken: string;

    beforeEach(async () => {
        // Create subscription plans
        basicPlan = await SubscriptionPlanModel.create({
            name: 'Basic Plan',
            code: 'basic',
            tier: 'basic',
            tierRank: 1,
            priceNGN: 15000,
            billingInterval: 'monthly',
            features: ['patient_management', 'basic_reports'],
            limits: {
                patients: 100,
                users: 2,
                locations: 1,
                storage: 1000,
                apiCalls: 1000
            },
            description: 'Basic plan for small pharmacies',
            isActive: true
        });

        premiumPlan = await SubscriptionPlanModel.create({
            name: 'Premium Plan',
            code: 'premium',
            tier: 'pro',
            tierRank: 2,
            priceNGN: 35000,
            billingInterval: 'monthly',
            features: ['patient_management', 'team_management', 'advanced_reports', 'inventory_management'],
            limits: {
                patients: 500,
                users: 5,
                locations: 3,
                storage: 5000,
                apiCalls: 5000
            },
            description: 'Premium plan for growing pharmacies',
            isActive: true,
            popularPlan: true
        });

        enterprisePlan = await SubscriptionPlanModel.create({
            name: 'Enterprise Plan',
            code: 'enterprise',
            tier: 'enterprise',
            tierRank: 3,
            priceNGN: 75000,
            billingInterval: 'monthly',
            features: ['*'], // All features
            limits: {
                patients: -1, // Unlimited
                users: -1,
                locations: -1,
                storage: -1,
                apiCalls: -1
            },
            description: 'Enterprise plan for large organizations',
            isActive: true
        });

        // Create current subscription
        currentSubscription = await SubscriptionModel.create({
            planId: basicPlan._id,
            status: 'active',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            billingInterval: 'monthly',
            amount: basicPlan.priceNGN,
            currency: 'NGN',
            paymentMethod: 'card',
            autoRenew: true
        });

        // Create workspace
        workspace = await WorkplaceModel.create({
            name: 'Test Pharmacy',
            type: 'pharmacy',
            address: '123 Test Street',
            phone: '+234-800-123-4567',
            subscriptionId: currentSubscription._id,
            teamMembers: []
        });

        // Create owner user
        ownerUser = await UserModel.create({
            firstName: 'John',
            lastName: 'Doe',
            email: 'owner@testpharmacy.com',
            passwordHash: 'securePassword123',
            role: 'pharmacist',
            workplaceRole: 'Owner',
            workplaceId: workspace._id,
            currentPlanId: basicPlan._id,
            status: 'active',
            licenseNumber: 'PCN123456'
        });

        // Update workspace and subscription with owner
        workspace.ownerId = ownerUser._id;
        workspace.teamMembers = [ownerUser._id];
        await workspace.save();

        currentSubscription.workspaceId = workspace._id;
        await currentSubscription.save();

        // Generate auth token
        authToken = jwt.sign(
            { userId: ownerUser._id, workplaceId: workspace._id },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );

        // Mock email service
        mockEmailService.sendSubscriptionStatusChange.mockResolvedValue({
            success: true,
            messageId: 'test-message-id'
        });
    });

    describe('Subscription Upgrade Workflow', () => {
        it('should upgrade from basic to premium plan successfully', async () => {
            // Step 1: Get current subscription details
            const currentResponse = await request(app)
                .get('/api/subscriptions/current')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(currentResponse.body.subscription.plan.code).toBe('basic');
            expect(currentResponse.body.subscription.status).toBe('active');

            // Step 2: Get available plans for upgrade
            const plansResponse = await request(app)
                .get('/api/subscriptions/plans')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const availablePlans = plansResponse.body.plans;
            expect(availablePlans).toHaveLength(3);

            const premiumPlanOption = availablePlans.find((p: any) => p.code === 'premium');
            expect(premiumPlanOption).toBeTruthy();

            // Step 3: Initiate upgrade
            const upgradeData = {
                newPlanId: premiumPlan._id,
                paymentMethod: 'card',
                billingInterval: 'monthly'
            };

            const upgradeResponse = await request(app)
                .post('/api/subscriptions/upgrade')
                .set('Authorization', `Bearer ${authToken}`)
                .send(upgradeData)
                .expect(200);

            expect(upgradeResponse.body.success).toBe(true);
            expect(upgradeResponse.body.subscription.plan.code).toBe('premium');
            expect(upgradeResponse.body.subscription.status).toBe('active');
            expect(upgradeResponse.body.prorationAmount).toBeDefined();

            // Step 4: Verify old subscription was cancelled
            const oldSubscription = await SubscriptionModel.findById(currentSubscription._id);
            expect(oldSubscription!.status).toBe('cancelled');
            expect(oldSubscription!.cancelledAt).toBeTruthy();

            // Step 5: Verify new subscription was created
            const newSubscription = await SubscriptionModel.findById(upgradeResponse.body.subscription._id);
            expect(newSubscription!.planId.toString()).toBe(premiumPlan._id.toString());
            expect(newSubscription!.status).toBe('active');
            expect(newSubscription!.amount).toBe(premiumPlan.priceNGN);

            // Step 6: Verify workspace subscription reference updated
            const updatedWorkspace = await WorkplaceModel.findById(workspace._id);
            expect(updatedWorkspace!.subscriptionId.toString()).toBe(newSubscription!._id.toString());

            // Step 7: Verify upgrade notification email sent
            expect(mockEmailService.sendSubscriptionStatusChange).toHaveBeenCalledWith(
                ownerUser.email,
                expect.objectContaining({
                    workspaceName: workspace.name,
                    changeType: 'upgrade',
                    oldPlan: 'Basic Plan',
                    newPlan: 'Premium Plan',
                    effectiveDate: expect.any(String),
                    newFeatures: expect.arrayContaining(['team_management', 'inventory_management'])
                })
            );

            // Step 8: Verify immediate feature access
            const featureCheckResponse = await request(app)
                .get('/api/subscriptions/features')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(featureCheckResponse.body.features).toContain('team_management');
            expect(featureCheckResponse.body.features).toContain('inventory_management');
            expect(featureCheckResponse.body.limits.users).toBe(5);
            expect(featureCheckResponse.body.limits.patients).toBe(500);
        });

        it('should handle upgrade with proration calculation', async () => {
            // Set current subscription to be halfway through billing period
            const halfwayDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000); // 15 days remaining
            currentSubscription.endDate = halfwayDate;
            await currentSubscription.save();

            const upgradeData = {
                newPlanId: premiumPlan._id,
                paymentMethod: 'card',
                billingInterval: 'monthly'
            };

            const upgradeResponse = await request(app)
                .post('/api/subscriptions/upgrade')
                .set('Authorization', `Bearer ${authToken}`)
                .send(upgradeData)
                .expect(200);

            // Verify proration calculation
            const priceDifference = premiumPlan.priceNGN - basicPlan.priceNGN; // 20000
            const daysRemaining = 15;
            const expectedProration = Math.round((priceDifference * daysRemaining) / 30);

            expect(upgradeResponse.body.prorationAmount).toBe(expectedProration);
            expect(upgradeResponse.body.prorationDetails).toMatchObject({
                daysRemaining: daysRemaining,
                priceDifference: priceDifference,
                prorationAmount: expectedProration
            });
        });
    });

    describe('Subscription Downgrade Workflow', () => {
        beforeEach(async () => {
            // Start with premium subscription
            currentSubscription.planId = premiumPlan._id;
            currentSubscription.amount = premiumPlan.priceNGN;
            await currentSubscription.save();
        });

        it('should downgrade from premium to basic plan successfully', async () => {
            const downgradeData = {
                newPlanId: basicPlan._id,
                effectiveDate: 'end_of_period' // Downgrade at end of current period
            };

            const downgradeResponse = await request(app)
                .post('/api/subscriptions/downgrade')
                .set('Authorization', `Bearer ${authToken}`)
                .send(downgradeData)
                .expect(200);

            expect(downgradeResponse.body.success).toBe(true);
            expect(downgradeResponse.body.effectiveDate).toBeTruthy();
            expect(downgradeResponse.body.currentSubscription.status).toBe('active');
            expect(downgradeResponse.body.scheduledChange).toMatchObject({
                type: 'downgrade',
                newPlanId: basicPlan._id.toString(),
                effectiveDate: expect.any(String)
            });

            // Verify current subscription still active until end of period
            const currentSub = await SubscriptionModel.findById(currentSubscription._id);
            expect(currentSub!.status).toBe('active');
            expect(currentSub!.scheduledPlanChange).toMatchObject({
                newPlanId: basicPlan._id,
                changeType: 'downgrade',
                effectiveDate: expect.any(Date)
            });

            // Verify downgrade notification email sent
            expect(mockEmailService.sendSubscriptionStatusChange).toHaveBeenCalledWith(
                ownerUser.email,
                expect.objectContaining({
                    workspaceName: workspace.name,
                    changeType: 'downgrade',
                    oldPlan: 'Premium Plan',
                    newPlan: 'Basic Plan',
                    effectiveDate: expect.any(String),
                    removedFeatures: expect.arrayContaining(['team_management', 'inventory_management'])
                })
            );
        });

        it('should prevent immediate downgrade if usage exceeds new plan limits', async () => {
            // Add users to exceed basic plan limit
            const user2 = await UserModel.create({
                firstName: 'User',
                lastName: 'Two',
                email: 'user2@testpharmacy.com',
                passwordHash: 'password123',
                role: 'pharmacist',
                workplaceRole: 'Pharmacist',
                workplaceId: workspace._id,
                currentPlanId: basicPlan._id,
                status: 'active'
            });

            const user3 = await UserModel.create({
                firstName: 'User',
                lastName: 'Three',
                email: 'user3@testpharmacy.com',
                passwordHash: 'password123',
                role: 'pharmacist',
                workplaceRole: 'Technician',
                workplaceId: workspace._id,
                currentPlanId: basicPlan._id,
                status: 'active'
            });

            workspace.teamMembers = [ownerUser._id, user2._id, user3._id]; // 3 users, basic plan allows 2
            await workspace.save();

            const downgradeData = {
                newPlanId: basicPlan._id,
                effectiveDate: 'immediate'
            };

            const downgradeResponse = await request(app)
                .post('/api/subscriptions/downgrade')
                .set('Authorization', `Bearer ${authToken}`)
                .send(downgradeData)
                .expect(400);

            expect(downgradeResponse.body.success).toBe(false);
            expect(downgradeResponse.body.error).toBe('Cannot downgrade: current usage exceeds new plan limits');
            expect(downgradeResponse.body.violations).toContain('users');
            expect(downgradeResponse.body.currentUsage.users).toBe(3);
            expect(downgradeResponse.body.newLimits.users).toBe(2);
        });

        it('should allow scheduled downgrade even with usage violations', async () => {
            // Add users to exceed basic plan limit
            const user2 = await UserModel.create({
                firstName: 'User',
                lastName: 'Two',
                email: 'user2@testpharmacy.com',
                passwordHash: 'password123',
                role: 'pharmacist',
                workplaceRole: 'Pharmacist',
                workplaceId: workspace._id,
                currentPlanId: basicPlan._id,
                status: 'active'
            });

            workspace.teamMembers = [ownerUser._id, user2._id]; // 2 users, at basic plan limit
            await workspace.save();

            const downgradeData = {
                newPlanId: basicPlan._id,
                effectiveDate: 'end_of_period'
            };

            const downgradeResponse = await request(app)
                .post('/api/subscriptions/downgrade')
                .set('Authorization', `Bearer ${authToken}`)
                .send(downgradeData)
                .expect(200);

            expect(downgradeResponse.body.success).toBe(true);
            expect(downgradeResponse.body.warnings).toContain(
                'Downgrade scheduled but current usage may exceed new plan limits'
            );
        });
    });

    describe('Trial to Paid Conversion', () => {
        beforeEach(async () => {
            // Create trial plan
            const trialPlan = await SubscriptionPlanModel.create({
                name: 'Trial Plan',
                code: 'trial',
                tier: 'free_trial',
                tierRank: 0,
                priceNGN: 0,
                billingInterval: 'monthly',
                features: ['patient_management'],
                limits: {
                    patients: 10,
                    users: 1,
                    locations: 1,
                    storage: 100,
                    apiCalls: 100
                },
                description: '14-day free trial',
                isActive: true,
                isTrial: true
            });

            // Update subscription to trial
            currentSubscription.planId = trialPlan._id;
            currentSubscription.amount = 0;
            currentSubscription.isTrial = true;
            currentSubscription.trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
            await currentSubscription.save();
        });

        it('should convert trial to paid subscription successfully', async () => {
            const conversionData = {
                newPlanId: premiumPlan._id,
                paymentMethod: 'card',
                billingInterval: 'monthly',
                paymentDetails: {
                    cardToken: 'card_token_123',
                    billingAddress: {
                        street: '123 Test Street',
                        city: 'Lagos',
                        state: 'Lagos',
                        country: 'Nigeria'
                    }
                }
            };

            const conversionResponse = await request(app)
                .post('/api/subscriptions/convert-trial')
                .set('Authorization', `Bearer ${authToken}`)
                .send(conversionData)
                .expect(200);

            expect(conversionResponse.body.success).toBe(true);
            expect(conversionResponse.body.subscription.plan.code).toBe('premium');
            expect(conversionResponse.body.subscription.isTrial).toBe(false);
            expect(conversionResponse.body.subscription.trialEndsAt).toBeNull();

            // Verify trial subscription was cancelled
            const oldSubscription = await SubscriptionModel.findById(currentSubscription._id);
            expect(oldSubscription!.status).toBe('cancelled');

            // Verify new paid subscription
            const newSubscription = await SubscriptionModel.findById(conversionResponse.body.subscription._id);
            expect(newSubscription!.isTrial).toBe(false);
            expect(newSubscription!.amount).toBe(premiumPlan.priceNGN);
            expect(newSubscription!.paymentMethod).toBe('card');
        });

        it('should handle trial expiration and paywall mode', async () => {
            // Set trial to expired
            currentSubscription.trialEndsAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // Expired yesterday
            currentSubscription.status = 'trial_expired';
            await currentSubscription.save();

            // Try to access premium features
            const featureResponse = await request(app)
                .get('/api/subscriptions/features')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(featureResponse.body.trialExpired).toBe(true);
            expect(featureResponse.body.paywallMode).toBe(true);
            expect(featureResponse.body.availableFeatures).toEqual(['basic_access']);

            // Try to create patient (should be blocked)
            const patientResponse = await request(app)
                .post('/api/patients')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    firstName: 'Test',
                    lastName: 'Patient',
                    mrn: 'MRN123'
                })
                .expect(402);

            expect(patientResponse.body.error).toBe('Trial expired - subscription required');
            expect(patientResponse.body.upgradeRequired).toBe(true);
        });
    });

    describe('Subscription Cancellation', () => {
        it('should cancel subscription at end of period', async () => {
            const cancellationData = {
                reason: 'switching_providers',
                feedback: 'Found a better solution for our needs',
                effectiveDate: 'end_of_period'
            };

            const cancellationResponse = await request(app)
                .post('/api/subscriptions/cancel')
                .set('Authorization', `Bearer ${authToken}`)
                .send(cancellationData)
                .expect(200);

            expect(cancellationResponse.body.success).toBe(true);
            expect(cancellationResponse.body.effectiveDate).toBeTruthy();
            expect(cancellationResponse.body.accessUntil).toBeTruthy();

            // Verify subscription marked for cancellation
            const subscription = await SubscriptionModel.findById(currentSubscription._id);
            expect(subscription!.status).toBe('active'); // Still active until end of period
            expect(subscription!.cancelledAt).toBeTruthy();
            expect(subscription!.cancellationReason).toBe('switching_providers');
            expect(subscription!.willCancelAt).toBeTruthy();

            // Verify cancellation email sent
            expect(mockEmailService.sendSubscriptionStatusChange).toHaveBeenCalledWith(
                ownerUser.email,
                expect.objectContaining({
                    workspaceName: workspace.name,
                    changeType: 'cancellation',
                    effectiveDate: expect.any(String),
                    accessUntil: expect.any(String)
                })
            );
        });

        it('should handle immediate cancellation', async () => {
            const cancellationData = {
                reason: 'no_longer_needed',
                effectiveDate: 'immediate'
            };

            const cancellationResponse = await request(app)
                .post('/api/subscriptions/cancel')
                .set('Authorization', `Bearer ${authToken}`)
                .send(cancellationData)
                .expect(200);

            expect(cancellationResponse.body.success).toBe(true);

            // Verify subscription immediately cancelled
            const subscription = await SubscriptionModel.findById(currentSubscription._id);
            expect(subscription!.status).toBe('cancelled');
            expect(subscription!.endDate.getTime()).toBeLessThanOrEqual(Date.now());
        });
    });

    describe('Billing and Payment', () => {
        it('should handle failed payment and retry logic', async () => {
            // Simulate failed payment
            const failedPaymentData = {
                subscriptionId: currentSubscription._id,
                paymentStatus: 'failed',
                errorCode: 'insufficient_funds',
                errorMessage: 'Insufficient funds in account'
            };

            const paymentResponse = await request(app)
                .post('/api/subscriptions/payment-webhook')
                .send(failedPaymentData)
                .expect(200);

            expect(paymentResponse.body.success).toBe(true);

            // Verify subscription status updated
            const subscription = await SubscriptionModel.findById(currentSubscription._id);
            expect(subscription!.status).toBe('payment_failed');
            expect(subscription!.paymentFailures).toBe(1);
            expect(subscription!.nextRetryDate).toBeTruthy();

            // Verify payment failure email sent
            expect(mockEmailService.sendPaymentFailedNotification).toHaveBeenCalledWith(
                ownerUser.email,
                expect.objectContaining({
                    workspaceName: workspace.name,
                    amount: basicPlan.priceNGN,
                    nextRetryDate: expect.any(String),
                    updatePaymentUrl: expect.any(String)
                })
            );
        });

        it('should suspend subscription after multiple payment failures', async () => {
            // Set subscription to have multiple failed payments
            currentSubscription.paymentFailures = 3;
            currentSubscription.status = 'payment_failed';
            await currentSubscription.save();

            // Simulate another failed payment
            const failedPaymentData = {
                subscriptionId: currentSubscription._id,
                paymentStatus: 'failed',
                errorCode: 'card_declined'
            };

            await request(app)
                .post('/api/subscriptions/payment-webhook')
                .send(failedPaymentData)
                .expect(200);

            // Verify subscription suspended
            const subscription = await SubscriptionModel.findById(currentSubscription._id);
            expect(subscription!.status).toBe('suspended');
            expect(subscription!.suspendedAt).toBeTruthy();

            // Verify suspension email sent
            expect(mockEmailService.sendSubscriptionSuspended).toHaveBeenCalledWith(
                ownerUser.email,
                expect.objectContaining({
                    workspaceName: workspace.name,
                    suspensionReason: 'payment_failure',
                    reactivationUrl: expect.any(String)
                })
            );
        });
    });
});