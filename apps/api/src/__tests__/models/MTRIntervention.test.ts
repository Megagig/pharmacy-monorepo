import mongoose from 'mongoose';
import MTRIntervention, { IMTRIntervention } from '../../models/MTRIntervention';

describe('MTRIntervention Model', () => {
    let workplaceId: mongoose.Types.ObjectId;
    let reviewId: mongoose.Types.ObjectId;
    let patientId: mongoose.Types.ObjectId;
    let pharmacistId: mongoose.Types.ObjectId;

    beforeEach(() => {
        workplaceId = testUtils.createObjectId();
        reviewId = testUtils.createObjectId();
        patientId = testUtils.createObjectId();
        pharmacistId = testUtils.createObjectId();
    });

    describe('Model Creation', () => {
        it('should create a valid MTR intervention', async () => {
            const interventionData = {
                workplaceId,
                reviewId,
                patientId,
                pharmacistId,
                type: 'recommendation',
                category: 'medication_change',
                description: 'Recommend discontinuing aspirin due to bleeding risk',
                rationale: 'Patient has high bleeding risk with concurrent warfarin therapy',
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                documentation: 'Called Dr. Smith to discuss discontinuing aspirin. Agreed to stop medication.',
                createdBy: pharmacistId
            };

            const intervention = new MTRIntervention(interventionData);
            const savedIntervention = await intervention.save();

            expect(savedIntervention._id).toBeValidObjectId();
            expect(savedIntervention.workplaceId).toEqual(workplaceId);
            expect(savedIntervention.reviewId).toEqual(reviewId);
            expect(savedIntervention.patientId).toEqual(patientId);
            expect(savedIntervention.type).toBe('recommendation');
            expect(savedIntervention.category).toBe('medication_change');
            expect(savedIntervention.outcome).toBe('pending');
            expect(savedIntervention.priority).toBe('medium');
            expect(savedIntervention.urgency).toBe('routine');
        });

        it('should fail validation without required fields', async () => {
            const intervention = new MTRIntervention({});

            await expect(intervention.save()).rejects.toThrow();
        });

        it('should validate enum values', async () => {
            const interventionData = {
                workplaceId,
                reviewId,
                patientId,
                pharmacistId,
                type: 'invalid_type', // Invalid enum value
                category: 'medication_change',
                description: 'Test intervention',
                rationale: 'Test rationale',
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                documentation: 'Test documentation',
                createdBy: pharmacistId
            };

            const intervention = new MTRIntervention(interventionData);

            await expect(intervention.save()).rejects.toThrow();
        });

        it('should validate high priority interventions have detailed documentation', async () => {
            const interventionData = {
                workplaceId,
                reviewId,
                patientId,
                pharmacistId,
                type: 'recommendation',
                category: 'medication_change',
                description: 'Test intervention',
                rationale: 'Test rationale',
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                priority: 'high',
                documentation: 'This is a detailed documentation for high priority intervention that meets the minimum character requirement for proper validation and compliance with system requirements.',
                createdBy: pharmacistId
            };

            const intervention = new MTRIntervention(interventionData);

            await expect(intervention.save()).rejects.toThrow('High priority interventions require detailed documentation');
        });
    });

    describe('Virtual Properties', () => {
        let intervention: IMTRIntervention;

        beforeEach(async () => {
            const interventionData = {
                workplaceId,
                reviewId,
                patientId,
                pharmacistId,
                type: 'recommendation',
                category: 'medication_change',
                description: 'Recommend discontinuing aspirin',
                rationale: 'High bleeding risk',
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                documentation: 'Called prescriber to discuss medication change',
                performedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                createdBy: pharmacistId
            };

            intervention = new MTRIntervention(interventionData);
            await intervention.save();
        });

        it('should calculate days since intervention', () => {
            expect(intervention.daysSinceIntervention).toBeGreaterThanOrEqual(3);
            expect(intervention.daysSinceIntervention).toBeLessThanOrEqual(4);
        });

        it('should determine follow-up status', () => {
            // No follow-up required
            expect(intervention.followUpStatus).toBe('not_required');

            // Follow-up required but not completed
            intervention.followUpRequired = true;
            intervention.followUpDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
            expect(intervention.followUpStatus).toBe('pending');

            // Follow-up completed
            intervention.followUpCompleted = true;
            expect(intervention.followUpStatus).toBe('completed');

            // Follow-up overdue
            intervention.followUpCompleted = false;
            intervention.followUpDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
            expect(intervention.followUpStatus).toBe('overdue');
        });

        it('should determine intervention effectiveness', () => {
            intervention.outcome = 'accepted';
            expect(intervention.isEffective).toBe(true);

            intervention.outcome = 'modified';
            expect(intervention.isEffective).toBe(true);

            intervention.outcome = 'rejected';
            expect(intervention.isEffective).toBe(false);

            intervention.outcome = 'pending';
            expect(intervention.isEffective).toBe(false);
        });
    });

    describe('Instance Methods', () => {
        let intervention: IMTRIntervention;

        beforeEach(async () => {
            const interventionData = {
                workplaceId,
                reviewId,
                patientId,
                pharmacistId,
                type: 'recommendation',
                category: 'medication_change',
                description: 'Recommend discontinuing aspirin',
                rationale: 'High bleeding risk',
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                documentation: 'Called prescriber to discuss medication change',
                createdBy: pharmacistId
            };

            intervention = new MTRIntervention(interventionData);
            await intervention.save();
        });

        it('should determine if intervention is overdue', () => {
            // No follow-up required - not overdue
            expect(intervention.isOverdue()).toBe(false);

            // Follow-up required but not overdue
            intervention.followUpRequired = true;
            intervention.followUpDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
            expect(intervention.isOverdue()).toBe(false);

            // Follow-up overdue
            intervention.followUpDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
            expect(intervention.isOverdue()).toBe(true);

            // Follow-up completed - not overdue
            intervention.followUpCompleted = true;
            expect(intervention.isOverdue()).toBe(false);
        });

        it('should mark intervention as completed', () => {
            intervention.markCompleted('accepted', 'Prescriber agreed to discontinue aspirin');

            expect(intervention.outcome).toBe('accepted');
            expect(intervention.outcomeDetails).toBe('Prescriber agreed to discontinue aspirin');
        });

        it('should mark follow-up as completed for positive outcomes', () => {
            intervention.followUpRequired = true;
            intervention.markCompleted('accepted');

            expect(intervention.followUpCompleted).toBe(true);
        });

        it('should not mark follow-up as completed for negative outcomes', () => {
            intervention.followUpRequired = true;
            intervention.markCompleted('rejected');

            expect(intervention.followUpCompleted).toBe(false);
        });

        it('should determine if follow-up is required', () => {
            expect(intervention.requiresFollowUp()).toBe(false);

            intervention.followUpRequired = true;
            expect(intervention.requiresFollowUp()).toBe(true);

            intervention.followUpCompleted = true;
            expect(intervention.requiresFollowUp()).toBe(false);
        });
    });

    describe('Pre-save Middleware', () => {
        it('should auto-set follow-up date based on urgency', async () => {
            const interventionData = {
                workplaceId,
                reviewId,
                patientId,
                pharmacistId,
                type: 'recommendation',
                category: 'medication_change',
                description: 'Urgent intervention',
                rationale: 'Critical safety issue',
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                documentation: 'Urgent call to prescriber',
                urgency: 'immediate',
                followUpRequired: true,
                createdBy: pharmacistId
            };

            const intervention = new MTRIntervention(interventionData);
            await intervention.save();

            expect(intervention.followUpDate).toBeInstanceOf(Date);

            // Should be set to 1 day from now for immediate urgency
            const expectedDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const actualDate = intervention.followUpDate!;
            const timeDiff = Math.abs(actualDate.getTime() - expectedDate.getTime());
            expect(timeDiff).toBeLessThan(60 * 1000); // Within 1 minute
        });

        it('should clear follow-up date if not required', async () => {
            const interventionData = {
                workplaceId,
                reviewId,
                patientId,
                pharmacistId,
                type: 'recommendation',
                category: 'medication_change',
                description: 'Test intervention',
                rationale: 'Test rationale',
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                documentation: 'Test documentation',
                followUpRequired: false,
                followUpDate: new Date(), // This should be cleared
                createdBy: pharmacistId
            };

            const intervention = new MTRIntervention(interventionData);
            await intervention.save();

            expect(intervention.followUpDate).toBeUndefined();
            expect(intervention.followUpCompleted).toBe(false);
        });
    });

    describe('Static Methods', () => {
        beforeEach(async () => {
            // Create test data
            const interventionData1 = {
                workplaceId,
                reviewId,
                patientId,
                pharmacistId,
                type: 'recommendation',
                category: 'medication_change',
                description: 'First intervention',
                rationale: 'Safety concern',
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                documentation: 'Called prescriber to discuss high priority medication intervention and received confirmation of acceptance for the recommended changes to patient therapy plan.',
                outcome: 'accepted',
                priority: 'high',
                createdBy: pharmacistId
            };

            const interventionData2 = {
                workplaceId,
                reviewId: testUtils.createObjectId(),
                patientId: testUtils.createObjectId(),
                pharmacistId,
                type: 'counseling',
                category: 'patient_education',
                description: 'Patient education',
                rationale: 'Improve adherence',
                targetAudience: 'patient',
                communicationMethod: 'in_person',
                documentation: 'Counseled patient on medication use',
                outcome: 'pending',
                priority: 'medium',
                createdBy: pharmacistId
            };

            await MTRIntervention.create([interventionData1, interventionData2]);
        });

        it('should find interventions by review', async () => {
            const interventions = await (MTRIntervention as any).findByReview(reviewId, workplaceId);

            expect(interventions).toHaveLength(1);
            expect(interventions[0].reviewId).toEqual(reviewId);
        });

        it('should find interventions by patient', async () => {
            const interventions = await (MTRIntervention as any).findByPatient(patientId, workplaceId);

            expect(interventions).toHaveLength(1);
            expect(interventions[0].patientId).toEqual(patientId);
        });

        it('should find pending interventions', async () => {
            const pendingInterventions = await (MTRIntervention as any).findPending(workplaceId);

            expect(pendingInterventions).toHaveLength(1);
            expect(pendingInterventions[0].outcome).toBe('pending');
        });

        it('should find overdue follow-ups', async () => {
            // Update one intervention to have overdue follow-up
            await MTRIntervention.updateOne(
                { outcome: 'accepted' },
                {
                    followUpRequired: true,
                    followUpCompleted: false,
                    followUpDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
                }
            );

            const overdueFollowUps = await (MTRIntervention as any).findOverdueFollowUps(workplaceId);

            expect(overdueFollowUps).toHaveLength(1);
            expect(overdueFollowUps[0].followUpRequired).toBe(true);
            expect(overdueFollowUps[0].followUpCompleted).toBe(false);
        });

        it('should get intervention statistics', async () => {
            const stats = await (MTRIntervention as any).getStatistics(workplaceId);

            expect(stats.totalInterventions).toBe(2);
            expect(stats.acceptedInterventions).toBe(1);
            expect(stats.pendingInterventions).toBe(1);
            expect(stats.acceptanceRate).toBe(50);
        });
    });

    describe('Validation Rules', () => {
        it('should validate description length', async () => {
            const interventionData = {
                workplaceId,
                reviewId,
                patientId,
                pharmacistId,
                type: 'recommendation',
                category: 'medication_change',
                description: 'A'.repeat(1001), // Exceeds max length
                rationale: 'Test rationale',
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                documentation: 'Test documentation',
                createdBy: pharmacistId
            };

            const intervention = new MTRIntervention(interventionData);

            await expect(intervention.save()).rejects.toThrow();
        });

        it('should validate rationale length', async () => {
            const interventionData = {
                workplaceId,
                reviewId,
                patientId,
                pharmacistId,
                type: 'recommendation',
                category: 'medication_change',
                description: 'Test intervention',
                rationale: 'A'.repeat(1001), // Exceeds max length
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                documentation: 'Test documentation',
                createdBy: pharmacistId
            };

            const intervention = new MTRIntervention(interventionData);

            await expect(intervention.save()).rejects.toThrow();
        });

        it('should validate documentation length', async () => {
            const interventionData = {
                workplaceId,
                reviewId,
                patientId,
                pharmacistId,
                type: 'recommendation',
                category: 'medication_change',
                description: 'Test intervention',
                rationale: 'Test rationale',
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                documentation: 'A'.repeat(2001), // Exceeds max length
                createdBy: pharmacistId
            };

            const intervention = new MTRIntervention(interventionData);

            await expect(intervention.save()).rejects.toThrow();
        });

        it('should validate acceptance rate range', async () => {
            const interventionData = {
                workplaceId,
                reviewId,
                patientId,
                pharmacistId,
                type: 'recommendation',
                category: 'medication_change',
                description: 'Test intervention',
                rationale: 'Test rationale',
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                documentation: 'Test documentation',
                acceptanceRate: 150, // Invalid rate > 100
                createdBy: pharmacistId
            };

            const intervention = new MTRIntervention(interventionData);

            await expect(intervention.save()).rejects.toThrow();
        });
    });

    describe('Follow-up Date Validation', () => {
        it('should validate follow-up date is after intervention date', async () => {
            const performedAt = new Date();
            const followUpDate = new Date(performedAt.getTime() - 24 * 60 * 60 * 1000); // Before performed date

            const interventionData = {
                workplaceId,
                reviewId,
                patientId,
                pharmacistId,
                type: 'recommendation',
                category: 'medication_change',
                description: 'Test intervention',
                rationale: 'Test rationale',
                targetAudience: 'prescriber',
                communicationMethod: 'phone',
                documentation: 'Test documentation',
                performedAt,
                followUpRequired: true,
                followUpDate,
                createdBy: pharmacistId
            };

            const intervention = new MTRIntervention(interventionData);

            await expect(intervention.save()).rejects.toThrow('Follow-up date must be after intervention date');
        });
    });
});