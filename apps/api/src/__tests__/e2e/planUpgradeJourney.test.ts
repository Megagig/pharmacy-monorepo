import request from 'supertest';
import app from '../../app';
import User from '../../models/User';
import Workplace from '../../models/Workplace';
import Subscription from '../../models/Subscription';
import SubscriptionPlan from '../../models/SubscriptionPlan';
import Patient from '../../models/Patient';
import { emailService } from '../../utils/emailService';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

// Mock email service
jest.mock('../../utils/emailService');
const mockEmailService = emailService as jest.Mocked<typeof emailService>;

describe('Plan Upgrade and Trial Expiration Journey E2E Tests', () => {
    let ownerUser: any;
    let workspace: any;
    let trialSubscription: any;
    let trialPlan: any;
    let basicPlan: any;
    let premiumPlan: any;
    let ownerAuthToken: string;

    beforeEach(async () => {
        // Create subscription plans
        trialPlan = await SubscriptionPlan.create({
            name: 'Trial Plan',
            code: 'trial',
            tier: 'free_trial',
            tierRank: 0,
            priceNGN: 0,
            billingInterval: 'monthly',
            features: ['patient_management', 'basic_reports'],
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

        basicPlan = await SubscriptionPlan.create({
            name: 'Basic Plan',
            code: 'basic',
            tier: 'basic',
            tierRank: 1,
            priceNGN: 15000,
            billingInterval: 'monthly',
            features: ['patient_management', 'basic_reports', 'team_management'],
            limits: {
                patients: 100,
                users: 3,
                locations: 1,
                storage: 1000,
                apiCalls: 1000
            },
            description: 'Basic plan for small pharmacies',
            isActive: true
        });

        premiumPlan = await SubscriptionPlan.create({
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

        // Create trial subscription (will be updated with workspaceId after workspace creation)
        trialSubscription = await Subscription.create({
            planId: trialPlan._id,
            workspaceId: new mongoose.Types.ObjectId(), // Temporary, will be updated
            tier: 'free_trial',
            status: 'active',
            startDate: new Date(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
            billingInterval: 'monthly',
            amount: 0,
            priceAtPurchase: 0,
            currency: 'NGN',
            isTrial: true,
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        });

        // Create workspace
        workspace = await Workplace.create({
            name: 'Upgrade Test Pharmacy',
            type: 'pharmacy',
            address: '123 Upgrade Street, Lagos, Nigeria',
            phone: '+234-800-123-4567',
            currentSubscriptionId: trialSubscription._id,
            teamMembers: []
        });

        // Create owner user
        ownerUser = await User.create({
            firstName: 'Upgrade',
            lastName: 'Owner',
            email: 'owner@upgradetest.com',
            password: 'securePassword123',
            role: 'pharmacist',
            workplaceRole: 'Owner',
            workplaceId: workspace._id,
            status: 'active',
            licenseNumber: 'PCN123456'
        });

        // Update workspace and subscription with owner
        workspace.ownerId = ownerUser._id;
        workspace.teamMembers = [ownerUser._id];
        await workspace.save();

        trialSubscription.workspaceId = workspace._id;
        await trialSubscription.save();

        // Generate auth token
        ownerAuthToken = jwt.sign(
            { userId: ownerUser._id, workplaceId: workspace._id },
            process.env.JWT_SECRET || 'test-secret',
            { expiresIn: '1h' }
        );

        // Mock email service
        mockEmailService.sendSubscriptionUpgrade.mockResolvedValue({ success: true, messageId: 'test-id' });
        mockEmailService.sendSubscriptionDowngrade.mockResolvedValue({ success: true, messageId: 'test-id' });
        mockEmailService.sendTrialExpiryWarning.mockResolvedValue({ provider: 'test', success: true, messageId: 'test-id' });
        mockEmailService.sendTrialExpired.mockResolvedValue({ success: true, messageId: 'test-id' });
    });

    describe('Trial to Paid Plan Upgrade Journey', () => {
        it('should complete full upgrade journey: trial usage → upgrade decision → payment → immediate access', async () => {
            // Step 1: User explores trial features and approaches limits
            // Add patients to approach trial limit
            const patients = [];
            for (let i = 1; i <= 8; i++) {
                const patientData = {
                    firstName: `Patient`,
                    lastName: `${i}`,
                    mrn: `MRN${i.toString().padStart(3, '0')}`,
                    dob: '1980-01-01',
                    phone: `+234-800-001-${i.toString().padStart(4, '0')}`
                };

                const patientResponse = await request(app)
                    .post('/api/patients')
                    .set('Authorization', `Bearer ${ownerAuthToken}`)
                    .send(patientData)
                    .expect(201);

                patients.push(patientResponse.body.patient);
            }

            // Step 2: Check usage and get upgrade recommendations
            const usageResponse = await request(app)
                .get('/api/subscriptions/usage')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .expect(200);

            expect(usageResponse.body.usage.patients.current).toBe(8);
            expect(usageResponse.body.usage.patients.percentage).toBe(80);
            expect(usageResponse.body.warnings).toContain('Approaching patient limit');

            const recommendationsResponse = await request(app)
                .get('/api/subscriptions/recommendations')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .expect(200);

            expect(recommendationsResponse.body.recommendedPlan).toBe('basic');
            expect(recommendationsResponse.body.reasons).toContain('Patient limit nearly reached');

            // Step 3: View available plans for upgrade
            const plansResponse = await request(app)
                .get('/api/subscriptions/plans')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .expect(200);

            const availablePlans = plansResponse.body.plans;
            expect(availablePlans).toHaveLength(3); // trial, basic, premium

            const premiumPlanOption = availablePlans.find((p: any) => p.code === 'premium');
            expect(premiumPlanOption.upgradeHighlights).toContain('500 patient limit');
            expect(premiumPlanOption.upgradeHighlights).toContain('Team management');

            // Step 4: Initiate upgrade to premium plan
            const upgradeData = {
                newPlanId: premiumPlan._id,
                paymentMethod: 'card',
                billingInterval: 'monthly',
                paymentDetails: {
                    cardToken: 'card_token_123',
                    billingAddress: {
                        street: '123 Upgrade Street',
                        city: 'Lagos',
                        state: 'Lagos',
                        country: 'Nigeria'
                    }
                }
            };

            const upgradeResponse = await request(app)
                .post('/api/subscriptions/upgrade')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .send(upgradeData)
                .expect(200);

            expect(upgradeResponse.body.success).toBe(true);
            expect(upgradeResponse.body.subscription.plan.code).toBe('premium');
            expect(upgradeResponse.body.subscription.status).toBe('active');
            expect(upgradeResponse.body.subscription.isTrial).toBe(false);

            const newSubscriptionId = upgradeResponse.body.subscription._id;

            // Step 5: Verify old trial subscription was cancelled
            const oldSubscription = await Subscription.findById(trialSubscription._id);
            expect(oldSubscription!.status).toBe('canceled');

            // Step 6: Verify workspace subscription reference updated
            const updatedWorkspace = await Workplace.findById(workspace._id);
            expect(updatedWorkspace!.currentSubscriptionId!.toString()).toBe(newSubscriptionId);

            // Step 7: Verify upgrade notification email sent
            expect(mockEmailService.sendSubscriptionUpgrade).toHaveBeenCalledWith(
                ownerUser.email,
                expect.objectContaining({
                    workspaceName: workspace.name,
                    oldPlan: 'Trial Plan',
                    newPlan: 'Premium Plan',
                    newFeatures: expect.arrayContaining(['inventory_management', 'advanced_reports']),
                    effectiveDate: expect.any(String)
                })
            );

            // Step 8: Test immediate access to new features
            const featuresResponse = await request(app)
                .get('/api/subscriptions/features')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .expect(200);

            expect(featuresResponse.body.features).toContain('inventory_management');
            expect(featuresResponse.body.features).toContain('advanced_reports');
            expect(featuresResponse.body.limits.patients).toBe(500);
            expect(featuresResponse.body.limits.users).toBe(5);

            // Step 9: Test new feature access - create inventory item
            const inventoryData = {
                name: 'Paracetamol 500mg',
                sku: 'PAR500',
                category: 'analgesic',
                quantity: 100,
                unitPrice: 50,
                expiryDate: '2025-12-31'
            };

            const inventoryResponse = await request(app)
                .post('/api/inventory')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .send(inventoryData)
                .expect(201);

            expect(inventoryResponse.body.item.name).toBe(inventoryData.name);

            // Step 10: Test increased limits - add more patients
            for (let i = 9; i <= 15; i++) {
                const patientData = {
                    firstName: `Patient`,
                    lastName: `${i}`,
                    mrn: `MRN${i.toString().padStart(3, '0')}`,
                    dob: '1980-01-01',
                    phone: `+234-800-001-${i.toString().padStart(4, '0')}`
                };

                await request(app)
                    .post('/api/patients')
                    .set('Authorization', `Bearer ${ownerAuthToken}`)
                    .send(patientData)
                    .expect(201);
            }

            // Verify new usage stats
            const newUsageResponse = await request(app)
                .get('/api/subscriptions/usage')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .expect(200);

            expect(newUsageResponse.body.usage.patients.current).toBe(15);
            expect(newUsageResponse.body.usage.patients.limit).toBe(500);
            expect(newUsageResponse.body.usage.patients.percentage).toBe(3);
        });

        it('should handle upgrade with team member invitation capability', async () => {
            // Upgrade to premium plan
            const upgradeData = {
                newPlanId: premiumPlan._id,
                paymentMethod: 'card',
                billingInterval: 'monthly'
            };

            await request(app)
                .post('/api/subscriptions/upgrade')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .send(upgradeData)
                .expect(200);

            // Test team management feature - invite team member
            const invitationData = {
                email: 'pharmacist@upgradetest.com',
                role: 'Pharmacist',
                firstName: 'Team',
                lastName: 'Member'
            };

            const inviteResponse = await request(app)
                .post('/api/invitations')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .send(invitationData)
                .expect(201);

            expect(inviteResponse.body.success).toBe(true);
            expect(inviteResponse.body.invitation.email).toBe(invitationData.email);

            // Accept invitation
            const acceptanceData = {
                token: inviteResponse.body.invitation.token,
                userData: {
                    firstName: 'Team',
                    lastName: 'Member',
                    password: 'teamPassword123',
                    licenseNumber: 'PCN789012'
                }
            };

            const acceptResponse = await request(app)
                .post('/api/invitations/accept')
                .send(acceptanceData)
                .expect(200);

            expect(acceptResponse.body.success).toBe(true);

            // Verify team member can access workspace
            const teamMemberToken = acceptResponse.body.token;
            const dashboardResponse = await request(app)
                .get('/api/dashboard')
                .set('Authorization', `Bearer ${teamMemberToken}`)
                .expect(200);

            expect(dashboardResponse.body.workspace.name).toBe(workspace.name);
            expect(dashboardResponse.body.user.workplaceRole).toBe('Pharmacist');
        });
    });

    describe('Trial Expiration and Paywall Mode Journey', () => {
        it('should handle trial expiration with grace period and paywall activation', async () => {
            // Step 1: Set trial to expire soon (3 days)
            const soonToExpire = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
            trialSubscription.trialEndsAt = soonToExpire;
            trialSubscription.endDate = soonToExpire;
            await trialSubscription.save();

            // Step 2: Check trial status and warnings
            const trialStatusResponse = await request(app)
                .get('/api/subscriptions/trial-status')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .expect(200);

            expect(trialStatusResponse.body.isTrial).toBe(true);
            expect(trialStatusResponse.body.daysRemaining).toBe(3);
            expect(trialStatusResponse.body.showUpgradePrompt).toBe(true);
            expect(trialStatusResponse.body.urgencyLevel).toBe('high');

            // Step 3: Simulate trial expiry warning email (would be sent by cron job)
            const warningEmailResponse = await request(app)
                .post('/api/admin/send-trial-warnings')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .expect(200);

            expect(warningEmailResponse.body.emailsSent).toBeGreaterThan(0);
            expect(mockEmailService.sendTrialExpiryWarning).toHaveBeenCalledWith(
                ownerUser.email,
                expect.objectContaining({
                    workspaceName: workspace.name,
                    daysRemaining: 3,
                    upgradeUrl: expect.any(String),
                    planRecommendations: expect.any(Array)
                })
            );

            // Step 4: Expire the trial
            trialSubscription.trialEndsAt = new Date(Date.now() - 24 * 60 * 60 * 1000); // Expired yesterday
            trialSubscription.status = 'trial_expired';
            await trialSubscription.save();

            // Step 5: Test paywall mode activation
            const expiredStatusResponse = await request(app)
                .get('/api/subscriptions/trial-status')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .expect(200);

            expect(expiredStatusResponse.body.isTrial).toBe(true);
            expect(expiredStatusResponse.body.isExpired).toBe(true);
            expect(expiredStatusResponse.body.paywallMode).toBe(true);
            expect(expiredStatusResponse.body.gracePeriodDays).toBe(7);

            // Step 6: Test limited access during paywall mode
            const dashboardResponse = await request(app)
                .get('/api/dashboard')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .expect(200);

            expect(dashboardResponse.body.paywallMode).toBe(true);
            expect(dashboardResponse.body.availableFeatures).toEqual(['basic_access', 'view_data']);
            expect(dashboardResponse.body.blockedFeatures).toContain('patient_management');

            // Step 7: Test blocked operations
            const blockedPatientResponse = await request(app)
                .post('/api/patients')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .send({
                    firstName: 'Blocked',
                    lastName: 'Patient',
                    mrn: 'MRN999'
                })
                .expect(402);

            expect(blockedPatientResponse.body.error).toBe('Trial expired - subscription required');
            expect(blockedPatientResponse.body.upgradeRequired).toBe(true);
            expect(blockedPatientResponse.body.upgradeUrl).toBeTruthy();

            // Step 8: Test read-only access to existing data
            const existingPatients = await Patient.create([
                {
                    firstName: 'Existing',
                    lastName: 'Patient',
                    mrn: 'MRN001',
                    dob: new Date('1980-01-01'),
                    workplaceId: workspace._id
                }
            ]);

            const readPatientResponse = await request(app)
                .get(`/api/patients/${existingPatients[0]!._id}`)
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .expect(200);

            expect(readPatientResponse.body.patient.firstName).toBe('Existing');
            expect(readPatientResponse.body.readOnly).toBe(true);

            // Step 9: Test upgrade from expired trial
            const upgradeFromExpiredData = {
                newPlanId: basicPlan._id,
                paymentMethod: 'card',
                billingInterval: 'monthly'
            };

            const upgradeFromExpiredResponse = await request(app)
                .post('/api/subscriptions/upgrade')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .send(upgradeFromExpiredData)
                .expect(200);

            expect(upgradeFromExpiredResponse.body.success).toBe(true);
            expect(upgradeFromExpiredResponse.body.subscription.status).toBe('active');
            expect(upgradeFromExpiredResponse.body.subscription.isTrial).toBe(false);

            // Step 10: Verify full access restored after upgrade
            const restoredAccessResponse = await request(app)
                .post('/api/patients')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .send({
                    firstName: 'Restored',
                    lastName: 'Patient',
                    mrn: 'MRN002',
                    dob: '1985-05-15'
                })
                .expect(201);

            expect(restoredAccessResponse.body.patient.firstName).toBe('Restored');
        });

        it('should handle grace period expiration and account suspension', async () => {
            // Set trial to expired beyond grace period
            const expiredBeyondGrace = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
            trialSubscription.trialEndsAt = expiredBeyondGrace;
            trialSubscription.status = 'suspended';
            await trialSubscription.save();

            // Test complete access denial
            const suspendedResponse = await request(app)
                .get('/api/dashboard')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .expect(403);

            expect(suspendedResponse.body.error).toBe('Account suspended - payment required');
            expect(suspendedResponse.body.suspensionReason).toBe('trial_expired');
            expect(suspendedResponse.body.reactivationRequired).toBe(true);

            // Test reactivation through upgrade
            const reactivationData = {
                newPlanId: basicPlan._id,
                paymentMethod: 'card',
                billingInterval: 'monthly'
            };

            const reactivationResponse = await request(app)
                .post('/api/subscriptions/reactivate')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .send(reactivationData)
                .expect(200);

            expect(reactivationResponse.body.success).toBe(true);
            expect(reactivationResponse.body.subscription.status).toBe('active');

            // Verify access restored
            const restoredDashboardResponse = await request(app)
                .get('/api/dashboard')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .expect(200);

            expect(restoredDashboardResponse.body.workspace.name).toBe(workspace.name);
            expect(restoredDashboardResponse.body.subscription.status).toBe('active');
        });
    });

    describe('Plan Downgrade Journey', () => {
        beforeEach(async () => {
            // Start with premium subscription
            const premiumSubscription = await Subscription.create({
                planId: premiumPlan._id,
                workspaceId: workspace._id,
                tier: 'pro',
                status: 'active',
                startDate: new Date(),
                endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                billingInterval: 'monthly',
                amount: premiumPlan.priceNGN,
                priceAtPurchase: premiumPlan.priceNGN,
                currency: 'NGN',
                isTrial: false
            });

            workspace.currentSubscriptionId = premiumSubscription._id;
            await workspace.save();

            // Cancel old trial subscription
            trialSubscription.status = 'cancelled';
            await trialSubscription.save();
        });

        it('should handle downgrade with usage validation and scheduling', async () => {
            // Add team members to exceed basic plan limits
            const teamMember = await User.create({
                firstName: 'Team',
                lastName: 'Member',
                email: 'team@upgradetest.com',
                password: 'password123',
                role: 'pharmacist',
                workplaceRole: 'Pharmacist',
                workplaceId: workspace._id,
                status: 'active',
                licenseNumber: 'PCN789012'
            });

            workspace.teamMembers.push(teamMember._id);
            await workspace.save();

            // Attempt immediate downgrade (should be blocked)
            const immediateDowngradeData = {
                newPlanId: basicPlan._id,
                effectiveDate: 'immediate'
            };

            const blockedDowngradeResponse = await request(app)
                .post('/api/subscriptions/downgrade')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .send(immediateDowngradeData)
                .expect(400);

            expect(blockedDowngradeResponse.body.success).toBe(false);
            expect(blockedDowngradeResponse.body.error).toBe('Cannot downgrade: current usage exceeds new plan limits');
            expect(blockedDowngradeResponse.body.violations).toContain('users');

            // Schedule downgrade for end of period
            const scheduledDowngradeData = {
                newPlanId: basicPlan._id,
                effectiveDate: 'end_of_period'
            };

            const scheduledDowngradeResponse = await request(app)
                .post('/api/subscriptions/downgrade')
                .set('Authorization', `Bearer ${ownerAuthToken}`)
                .send(scheduledDowngradeData)
                .expect(200);

            expect(scheduledDowngradeResponse.body.success).toBe(true);
            expect(scheduledDowngradeResponse.body.scheduledChange.type).toBe('downgrade');
            expect(scheduledDowngradeResponse.body.warnings).toContain(
                'Downgrade scheduled but current usage may exceed new plan limits'
            );

            // Verify downgrade notification
            expect(mockEmailService.sendSubscriptionDowngrade).toHaveBeenCalledWith(
                ownerUser.email,
                expect.objectContaining({
                    oldPlan: 'Premium Plan',
                    newPlan: 'Basic Plan',
                    effectiveDate: expect.any(String),
                    removedFeatures: expect.arrayContaining(['inventory_management', 'advanced_reports'])
                })
            );
        });
    });
});