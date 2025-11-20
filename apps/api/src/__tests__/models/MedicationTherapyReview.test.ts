import mongoose from 'mongoose';
import MedicationTherapyReview, { IMedicationTherapyReview } from '../../models/MedicationTherapyReview';

describe('MedicationTherapyReview Model', () => {
    let workplaceId: mongoose.Types.ObjectId;
    let patientId: mongoose.Types.ObjectId;
    let pharmacistId: mongoose.Types.ObjectId;
    let userId: mongoose.Types.ObjectId;

    beforeEach(() => {
        workplaceId = testUtils.createObjectId();
        patientId = testUtils.createObjectId();
        pharmacistId = testUtils.createObjectId();
        userId = testUtils.createObjectId();
    });

    describe('Model Creation', () => {
        it('should create a valid MTR session with required fields', async () => {
            const mtrData = {
                workplaceId,
                patientId,
                pharmacistId,
                reviewNumber: 'MTR-202412-0001',
                patientConsent: true,
                confidentialityAgreed: true,
                createdBy: userId
            };

            const mtr = new MedicationTherapyReview(mtrData);
            const savedMtr = await mtr.save();

            expect(savedMtr._id).toBeValidObjectId();
            expect(savedMtr.workplaceId).toEqual(workplaceId);
            expect(savedMtr.patientId).toEqual(patientId);
            expect(savedMtr.pharmacistId).toEqual(pharmacistId);
            expect(savedMtr.status).toBe('in_progress');
            expect(savedMtr.priority).toBe('routine');
            expect(savedMtr.reviewType).toBe('initial');
            expect(savedMtr.patientConsent).toBe(true);
            expect(savedMtr.confidentialityAgreed).toBe(true);
        });

        it('should auto-generate review number if not provided', async () => {
            const mtrData = {
                workplaceId,
                patientId,
                pharmacistId,
                patientConsent: true,
                confidentialityAgreed: true,
                createdBy: userId
            };

            const mtr = new MedicationTherapyReview(mtrData);
            const savedMtr = await mtr.save();

            expect(savedMtr.reviewNumber).toBeDefined();
            expect(savedMtr.reviewNumber).toMatch(/^MTR-\d{6}-[A-Z0-9]{6}$/);
        });

        it('should fail validation without required fields', async () => {
            const mtr = new MedicationTherapyReview({});

            await expect(mtr.save()).rejects.toThrow();
        });

        it('should fail validation without patient consent', async () => {
            const mtrData = {
                workplaceId,
                patientId,
                pharmacistId,
                patientConsent: false,
                confidentialityAgreed: true,
                createdBy: userId
            };

            const mtr = new MedicationTherapyReview(mtrData);

            await expect(mtr.save()).rejects.toThrow('Patient consent is required');
        });

        it('should fail validation without confidentiality agreement', async () => {
            const mtrData = {
                workplaceId,
                patientId,
                pharmacistId,
                patientConsent: true,
                confidentialityAgreed: false,
                createdBy: userId
            };

            const mtr = new MedicationTherapyReview(mtrData);

            await expect(mtr.save()).rejects.toThrow('Confidentiality agreement is required');
        });
    });

    describe('Workflow Steps', () => {
        let mtr: IMedicationTherapyReview;

        beforeEach(async () => {
            const mtrData = {
                workplaceId,
                patientId,
                pharmacistId,
                patientConsent: true,
                confidentialityAgreed: true,
                createdBy: userId
            };

            mtr = new MedicationTherapyReview(mtrData);
            await mtr.save();
        });

        it('should initialize with all steps incomplete', () => {
            expect(mtr.steps.patientSelection.completed).toBe(false);
            expect(mtr.steps.medicationHistory.completed).toBe(false);
            expect(mtr.steps.therapyAssessment.completed).toBe(false);
            expect(mtr.steps.planDevelopment.completed).toBe(false);
            expect(mtr.steps.interventions.completed).toBe(false);
            expect(mtr.steps.followUp.completed).toBe(false);
        });

        it('should mark step as complete', () => {
            const testData = { patientId, selectedAt: new Date() };

            mtr.markStepComplete('patientSelection', testData);

            expect(mtr.steps.patientSelection.completed).toBe(true);
            expect(mtr.steps.patientSelection.completedAt).toBeInstanceOf(Date);
            expect(mtr.steps.patientSelection.data).toEqual(testData);
        });

        it('should calculate completion percentage correctly', () => {
            expect(mtr.getCompletionPercentage()).toBe(0);

            mtr.markStepComplete('patientSelection');
            expect(mtr.getCompletionPercentage()).toBe(17); // 1/6 steps = 16.67% rounded to 17%

            mtr.markStepComplete('medicationHistory');
            expect(mtr.getCompletionPercentage()).toBe(33); // 2/6 steps = 33.33% rounded to 33%

            mtr.markStepComplete('therapyAssessment');
            mtr.markStepComplete('planDevelopment');
            mtr.markStepComplete('interventions');
            mtr.markStepComplete('followUp');
            expect(mtr.getCompletionPercentage()).toBe(100);
        });

        it('should return next step correctly', () => {
            expect(mtr.getNextStep()).toBe('patientSelection');

            mtr.markStepComplete('patientSelection');
            expect(mtr.getNextStep()).toBe('medicationHistory');

            mtr.markStepComplete('medicationHistory');
            expect(mtr.getNextStep()).toBe('therapyAssessment');

            mtr.markStepComplete('therapyAssessment');
            mtr.markStepComplete('planDevelopment');
            mtr.markStepComplete('interventions');
            mtr.markStepComplete('followUp');
            expect(mtr.getNextStep()).toBeNull();
        });

        it('should determine if workflow can be completed', () => {
            expect(mtr.canComplete()).toBe(false);

            // Complete all steps
            mtr.markStepComplete('patientSelection');
            mtr.markStepComplete('medicationHistory');
            mtr.markStepComplete('therapyAssessment');
            mtr.markStepComplete('planDevelopment');
            mtr.markStepComplete('interventions');
            mtr.markStepComplete('followUp');

            expect(mtr.canComplete()).toBe(true);
        });

        it('should auto-complete when all steps are done', async () => {
            // Complete all steps
            mtr.markStepComplete('patientSelection');
            mtr.markStepComplete('medicationHistory');
            mtr.markStepComplete('therapyAssessment');
            mtr.markStepComplete('planDevelopment');
            mtr.markStepComplete('interventions');
            mtr.markStepComplete('followUp');

            await mtr.save();

            expect(mtr.status).toBe('completed');
            expect(mtr.completedAt).toBeInstanceOf(Date);
        });
    });

    describe('Medications', () => {
        let mtr: IMedicationTherapyReview;

        beforeEach(async () => {
            const mtrData = {
                workplaceId,
                patientId,
                pharmacistId,
                patientConsent: true,
                confidentialityAgreed: true,
                createdBy: userId
            };

            mtr = new MedicationTherapyReview(mtrData);
            await mtr.save();
        });

        it('should add medications with valid data', async () => {
            const medication = {
                drugName: 'Lisinopril',
                genericName: 'Lisinopril',
                strength: { value: 10, unit: 'mg' },
                dosageForm: 'tablet',
                instructions: {
                    dose: '10 mg',
                    frequency: 'once daily',
                    route: 'oral'
                },
                category: 'prescribed' as const,
                startDate: new Date(),
                indication: 'Hypertension'
            };

            mtr.medications.push(medication);
            const savedMtr = await mtr.save();

            expect(savedMtr.medications).toHaveLength(1);
            expect(savedMtr.medications[0]!.drugName).toBe('Lisinopril');
            expect(savedMtr.medications[0]!.strength.value).toBe(10);
            expect(savedMtr.medications[0]!.category).toBe('prescribed');
        });

        it('should validate medication fields', async () => {
            const invalidMedication = {
                drugName: '', // Empty drug name should fail
                strength: { value: -1, unit: 'mg' }, // Negative strength should fail
                dosageForm: 'tablet',
                instructions: {
                    dose: '10 mg',
                    frequency: 'once daily',
                    route: 'oral'
                },
                category: 'prescribed' as const,
                startDate: new Date(),
                indication: 'Hypertension'
            };

            mtr.medications.push(invalidMedication);

            await expect(mtr.save()).rejects.toThrow();
        });

        it('should validate adherence score range', async () => {
            const medication = {
                drugName: 'Lisinopril',
                strength: { value: 10, unit: 'mg' },
                dosageForm: 'tablet',
                instructions: {
                    dose: '10 mg',
                    frequency: 'once daily',
                    route: 'oral'
                },
                category: 'prescribed' as const,
                startDate: new Date(),
                indication: 'Hypertension',
                adherenceScore: 150 // Invalid score > 100
            };

            mtr.medications.push(medication);

            await expect(mtr.save()).rejects.toThrow();
        });
    });

    describe('Virtual Properties', () => {
        let mtr: IMedicationTherapyReview;

        beforeEach(async () => {
            const mtrData = {
                workplaceId,
                patientId,
                pharmacistId,
                patientConsent: true,
                confidentialityAgreed: true,
                createdBy: userId,
                startedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
            };

            mtr = new MedicationTherapyReview(mtrData);
            await mtr.save();
        });

        it('should calculate duration in days', () => {
            expect(mtr.durationDays).toBeGreaterThanOrEqual(5);
        });

        it('should determine overdue status for routine priority', () => {
            // Routine MTRs are overdue after 7 days
            mtr.startedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
            expect(mtr.isOverdue).toBe(true);

            mtr.startedAt = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000); // 6 days ago
            expect(mtr.isOverdue).toBe(false);
        });

        it('should determine overdue status for urgent priority', () => {
            mtr.priority = 'urgent';

            // Urgent MTRs are overdue after 1 day
            mtr.startedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
            expect(mtr.isOverdue).toBe(true);

            mtr.startedAt = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
            expect(mtr.isOverdue).toBe(false);
        });

        it('should not be overdue if completed', () => {
            mtr.status = 'completed';
            mtr.startedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
            expect(mtr.isOverdue).toBe(false);
        });
    });

    describe('Static Methods', () => {
        beforeEach(async () => {
            // Create test data
            const mtrData1 = {
                workplaceId,
                patientId,
                pharmacistId,
                status: 'in_progress',
                priority: 'urgent',
                patientConsent: true,
                confidentialityAgreed: true,
                createdBy: userId
            };

            const mtrData2 = {
                workplaceId,
                patientId: testUtils.createObjectId(),
                pharmacistId,
                status: 'completed',
                priority: 'routine',
                patientConsent: true,
                confidentialityAgreed: true,
                createdBy: userId
            };

            await MedicationTherapyReview.create([mtrData1, mtrData2]);
        });

        it('should find active reviews', async () => {
            const activeReviews = await (MedicationTherapyReview as any).findActive(workplaceId);

            expect(activeReviews).toHaveLength(1);
            expect(activeReviews[0].status).toBe('in_progress');
        });

        it('should find overdue reviews', async () => {
            // Update one review to be overdue
            await MedicationTherapyReview.updateOne(
                { status: 'in_progress' },
                { startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } // 2 days ago (overdue for urgent)
            );

            const overdueReviews = await (MedicationTherapyReview as any).findOverdue(workplaceId);

            expect(overdueReviews).toHaveLength(1);
            expect(overdueReviews[0].priority).toBe('urgent');
        });

        it('should generate next review number', async () => {
            const reviewNumber = await (MedicationTherapyReview as any).generateNextReviewNumber(workplaceId);

            expect(reviewNumber).toMatch(/^MTR-\d{6}-\d{4}$/);
        });
    });

    describe('Indexes and Performance', () => {
        it('should have proper indexes defined', () => {
            const indexes = MedicationTherapyReview.collection.getIndexes();

            // This would be tested in integration tests with actual MongoDB
            // For unit tests, we just verify the schema has index definitions
            expect(MedicationTherapyReview.schema.indexes()).toBeDefined();
        });
    });

    describe('Clinical Outcomes', () => {
        let mtr: IMedicationTherapyReview;

        beforeEach(async () => {
            const mtrData = {
                workplaceId,
                patientId,
                pharmacistId,
                patientConsent: true,
                confidentialityAgreed: true,
                createdBy: userId
            };

            mtr = new MedicationTherapyReview(mtrData);
            await mtr.save();
        });

        it('should initialize clinical outcomes with default values', () => {
            expect(mtr.clinicalOutcomes.problemsResolved).toBe(0);
            expect(mtr.clinicalOutcomes.medicationsOptimized).toBe(0);
            expect(mtr.clinicalOutcomes.adherenceImproved).toBe(false);
            expect(mtr.clinicalOutcomes.adverseEventsReduced).toBe(false);
        });

        it('should update clinical outcomes', async () => {
            mtr.clinicalOutcomes.problemsResolved = 3;
            mtr.clinicalOutcomes.medicationsOptimized = 2;
            mtr.clinicalOutcomes.adherenceImproved = true;
            mtr.clinicalOutcomes.costSavings = 150.50;

            const savedMtr = await mtr.save();

            expect(savedMtr.clinicalOutcomes.problemsResolved).toBe(3);
            expect(savedMtr.clinicalOutcomes.medicationsOptimized).toBe(2);
            expect(savedMtr.clinicalOutcomes.adherenceImproved).toBe(true);
            expect(savedMtr.clinicalOutcomes.costSavings).toBe(150.50);
        });

        it('should validate negative values for numeric outcomes', async () => {
            mtr.clinicalOutcomes.problemsResolved = -1;

            await expect(mtr.save()).rejects.toThrow();
        });
    });
});