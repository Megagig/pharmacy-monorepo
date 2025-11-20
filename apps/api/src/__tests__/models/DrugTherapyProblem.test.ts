import mongoose from 'mongoose';
import DrugTherapyProblem, { IDrugTherapyProblem } from '../../models/DrugTherapyProblem';

describe('DrugTherapyProblem Model', () => {
    let workplaceId: mongoose.Types.ObjectId;
    let patientId: mongoose.Types.ObjectId;
    let reviewId: mongoose.Types.ObjectId;
    let identifiedBy: mongoose.Types.ObjectId;

    beforeEach(() => {
        workplaceId = testUtils.createObjectId();
        patientId = testUtils.createObjectId();
        reviewId = testUtils.createObjectId();
        identifiedBy = testUtils.createObjectId();
    });

    describe('Model Creation', () => {
        it('should create a valid drug therapy problem', async () => {
            const dtpData = {
                workplaceId,
                patientId,
                reviewId,
                category: 'safety',
                type: 'interaction',
                severity: 'major',
                description: 'Drug interaction between warfarin and aspirin',
                clinicalSignificance: 'Increased bleeding risk due to additive anticoagulant effects',
                affectedMedications: ['Warfarin', 'Aspirin'],
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy
            };

            const dtp = new DrugTherapyProblem(dtpData);
            const savedDtp = await dtp.save();

            expect(savedDtp._id).toBeValidObjectId();
            expect(savedDtp.workplaceId).toEqual(workplaceId);
            expect(savedDtp.patientId).toEqual(patientId);
            expect(savedDtp.reviewId).toEqual(reviewId);
            expect(savedDtp.category).toBe('safety');
            expect(savedDtp.type).toBe('interaction');
            expect(savedDtp.severity).toBe('major');
            expect(savedDtp.status).toBe('identified');
            expect(savedDtp.evidenceLevel).toBe('definite');
        });

        it('should fail validation without required fields', async () => {
            const dtp = new DrugTherapyProblem({});

            await expect(dtp.save()).rejects.toThrow();
        });

        it('should validate enum values', async () => {
            const dtpData = {
                workplaceId,
                patientId,
                reviewId,
                category: 'invalid_category', // Invalid enum value
                type: 'interaction',
                severity: 'major',
                description: 'Test problem',
                clinicalSignificance: 'Test significance',
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy
            };

            const dtp = new DrugTherapyProblem(dtpData);

            await expect(dtp.save()).rejects.toThrow();
        });

        it('should validate description length for critical severity', async () => {
            const dtpData = {
                workplaceId,
                patientId,
                reviewId,
                category: 'safety',
                type: 'interaction',
                severity: 'critical',
                description: 'Short', // Too short for critical severity
                clinicalSignificance: 'Test significance',
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy
            };

            const dtp = new DrugTherapyProblem(dtpData);

            await expect(dtp.save()).rejects.toThrow('critical severity DTPs require detailed description');
        });

        it('should validate clinical significance for high evidence levels', async () => {
            const dtpData = {
                workplaceId,
                patientId,
                reviewId,
                category: 'safety',
                type: 'interaction',
                severity: 'major',
                description: 'Drug interaction between warfarin and aspirin causing bleeding risk',
                clinicalSignificance: 'Short', // Too short for definite evidence level
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy
            };

            const dtp = new DrugTherapyProblem(dtpData);

            await expect(dtp.save()).rejects.toThrow('DTPs with definite evidence level require clinical significance explanation');
        });
    });

    describe('Virtual Properties', () => {
        let dtp: IDrugTherapyProblem;

        beforeEach(async () => {
            const dtpData = {
                workplaceId,
                patientId,
                reviewId,
                category: 'safety',
                type: 'interaction',
                severity: 'major',
                description: 'Drug interaction between warfarin and aspirin',
                clinicalSignificance: 'Increased bleeding risk due to additive anticoagulant effects',
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy
            };

            dtp = new DrugTherapyProblem(dtpData);
            await dtp.save();
        });

        it('should calculate priority based on severity and evidence level', () => {
            // Critical severity should always be high priority
            dtp.severity = 'critical';
            expect(dtp.priority).toBe('high');

            // Major severity with definite evidence should be high priority
            dtp.severity = 'major';
            dtp.evidenceLevel = 'definite';
            expect(dtp.priority).toBe('high');

            // Major severity with probable evidence should be high priority
            dtp.evidenceLevel = 'probable';
            expect(dtp.priority).toBe('high');

            // Major severity with possible evidence should be medium priority
            dtp.evidenceLevel = 'possible';
            expect(dtp.priority).toBe('medium');

            // Moderate severity with definite evidence should be medium priority
            dtp.severity = 'moderate';
            dtp.evidenceLevel = 'definite';
            expect(dtp.priority).toBe('medium');

            // Minor severity should be low priority
            dtp.severity = 'minor';
            expect(dtp.priority).toBe('low');
        });

        it('should provide human-readable type display', () => {
            dtp.type = 'interaction';
            expect(dtp.typeDisplay).toBe('Drug Interaction');

            dtp.type = 'doseTooHigh';
            expect(dtp.typeDisplay).toBe('Dose Too High');

            dtp.type = 'unnecessaryMedication' as any;
            expect(dtp.typeDisplay).toBe('unnecessaryMedication'); // Fallback for unknown types
        });

        it('should calculate resolution duration', async () => {
            // Initially no resolution
            expect(dtp.resolutionDurationDays).toBeNull();

            // Add resolution
            dtp.resolution = {
                action: 'Discontinued aspirin',
                outcome: 'Bleeding risk reduced',
                resolvedAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days later
                resolvedBy: identifiedBy
            };

            expect(dtp.resolutionDurationDays).toBeGreaterThanOrEqual(3);
            expect(dtp.resolutionDurationDays).toBeLessThanOrEqual(4);
        });
    });

    describe('Instance Methods', () => {
        let dtp: IDrugTherapyProblem;

        beforeEach(async () => {
            const dtpData = {
                workplaceId,
                patientId,
                reviewId,
                category: 'safety',
                type: 'interaction',
                severity: 'major',
                description: 'Drug interaction between warfarin and aspirin',
                clinicalSignificance: 'Increased bleeding risk due to additive anticoagulant effects',
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy
            };

            dtp = new DrugTherapyProblem(dtpData);
            await dtp.save();
        });

        it('should resolve problem correctly', () => {
            const resolvedBy = testUtils.createObjectId();

            dtp.resolve('Discontinued aspirin', 'Bleeding risk eliminated', resolvedBy);

            expect(dtp.status).toBe('resolved');
            expect(dtp.resolution?.action).toBe('Discontinued aspirin');
            expect(dtp.resolution?.outcome).toBe('Bleeding risk eliminated');
            expect(dtp.resolution?.resolvedBy).toEqual(resolvedBy);
            expect(dtp.resolution?.resolvedAt).toBeInstanceOf(Date);
            expect(dtp.updatedBy).toEqual(resolvedBy);
        });

        it('should reopen problem correctly', () => {
            const reopenedBy = testUtils.createObjectId();

            // First resolve the problem
            dtp.resolve('Test action', 'Test outcome');
            expect(dtp.status).toBe('resolved');

            // Then reopen it
            dtp.reopen(reopenedBy);

            expect(dtp.status).toBe('identified');
            expect(dtp.resolution?.resolvedAt).toBeUndefined();
            expect(dtp.updatedBy).toEqual(reopenedBy);
        });

        it('should identify high severity problems', () => {
            dtp.severity = 'critical';
            expect(dtp.isHighSeverity()).toBe(true);

            dtp.severity = 'major';
            expect(dtp.isHighSeverity()).toBe(true);

            dtp.severity = 'moderate';
            expect(dtp.isHighSeverity()).toBe(false);

            dtp.severity = 'minor';
            expect(dtp.isHighSeverity()).toBe(false);
        });

        it('should identify critical problems', () => {
            dtp.severity = 'critical';
            expect(dtp.isCritical()).toBe(true);

            dtp.severity = 'major';
            expect(dtp.isCritical()).toBe(false);
        });

        it('should determine overdue status', () => {
            // Critical problems are overdue after 1 day
            dtp.severity = 'critical';
            dtp.identifiedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
            expect(dtp.isOverdue()).toBe(true);

            dtp.identifiedAt = new Date(Date.now() - 12 * 60 * 60 * 1000); // 12 hours ago
            expect(dtp.isOverdue()).toBe(false);

            // Major problems are overdue after 3 days
            dtp.severity = 'major';
            dtp.identifiedAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000); // 4 days ago
            expect(dtp.isOverdue()).toBe(true);

            // Resolved problems are never overdue
            dtp.status = 'resolved';
            expect(dtp.isOverdue()).toBe(false);
        });
    });

    describe('Pre-save Middleware', () => {
        it('should auto-set resolution details when status changes to resolved', async () => {
            const dtpData = {
                workplaceId,
                patientId,
                reviewId,
                category: 'safety',
                type: 'interaction',
                severity: 'major',
                description: 'Drug interaction between warfarin and aspirin',
                clinicalSignificance: 'Increased bleeding risk due to additive anticoagulant effects',
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy
            };

            const dtp = new DrugTherapyProblem(dtpData);
            await dtp.save();

            // Change status to resolved without setting resolution
            dtp.status = 'resolved';
            await dtp.save();

            expect(dtp.resolution).toBeDefined();
            if (dtp.resolution) {
                expect(dtp.resolution.action).toBe('Status updated to resolved');
                expect(dtp.resolution.outcome).toBe('Problem resolved');
                expect(dtp.resolution.resolvedAt).toBeInstanceOf(Date);
            }
        });

        it('should clear resolution details when status changes from resolved', async () => {
            const dtpData = {
                workplaceId,
                patientId,
                reviewId,
                category: 'safety',
                type: 'interaction',
                severity: 'major',
                description: 'Drug interaction between warfarin and aspirin',
                clinicalSignificance: 'Increased bleeding risk due to additive anticoagulant effects',
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy,
                status: 'resolved',
                resolution: {
                    action: 'Test action',
                    outcome: 'Test outcome',
                    resolvedAt: new Date()
                }
            };

            const dtp = new DrugTherapyProblem(dtpData);
            await dtp.save();

            // Change status from resolved
            dtp.status = 'identified';
            await dtp.save();

            expect(dtp.resolution?.resolvedAt).toBeUndefined();
        });
    });

    describe('Static Methods', () => {
        beforeEach(async () => {
            // Create test data
            const dtpData1 = {
                workplaceId,
                patientId,
                reviewId,
                category: 'safety',
                type: 'interaction',
                severity: 'critical',
                description: 'Critical drug interaction',
                clinicalSignificance: 'High risk of adverse events',
                evidenceLevel: 'definite',
                status: 'identified',
                identifiedBy,
                createdBy: identifiedBy
            };

            const dtpData2 = {
                workplaceId,
                patientId: testUtils.createObjectId(),
                reviewId: testUtils.createObjectId(),
                category: 'effectiveness',
                type: 'doseTooLow',
                severity: 'moderate',
                description: 'Subtherapeutic dose',
                clinicalSignificance: 'May not achieve therapeutic goals',
                evidenceLevel: 'probable',
                status: 'resolved',
                identifiedBy,
                createdBy: identifiedBy
            };

            await DrugTherapyProblem.create([dtpData1, dtpData2]);
        });

        it('should find problems by patient', async () => {
            const problems = await (DrugTherapyProblem as any).findByPatient(patientId, undefined, workplaceId);

            expect(problems).toHaveLength(1);
            expect(problems[0].patientId).toEqual(patientId);
        });

        it('should find problems by type', async () => {
            const problems = await (DrugTherapyProblem as any).findByType('interaction', undefined, workplaceId);

            expect(problems).toHaveLength(1);
            expect(problems[0].type).toBe('interaction');
        });

        it('should find active problems', async () => {
            const activeProblems = await (DrugTherapyProblem as any).findActive(workplaceId);

            expect(activeProblems).toHaveLength(1);
            expect(activeProblems[0].status).toBe('identified');
        });

        it('should find problems by review', async () => {
            const problems = await (DrugTherapyProblem as any).findByReview(reviewId, workplaceId);

            expect(problems).toHaveLength(1);
            expect(problems[0].reviewId).toEqual(reviewId);
        });

        it('should get statistics', async () => {
            const stats = await (DrugTherapyProblem as any).getStatistics(workplaceId);

            expect(stats.totalDTPs).toBe(2);
            expect(stats.resolvedDTPs).toBe(1);
            expect(stats.resolutionRate).toBe(50);
        });
    });

    describe('Validation Rules', () => {
        it('should validate affected medications array', async () => {
            const dtpData = {
                workplaceId,
                patientId,
                reviewId,
                category: 'safety',
                type: 'interaction',
                severity: 'major',
                description: 'Drug interaction between warfarin and aspirin',
                clinicalSignificance: 'Increased bleeding risk due to additive anticoagulant effects',
                affectedMedications: ['A'.repeat(201)], // Exceeds max length
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy
            };

            const dtp = new DrugTherapyProblem(dtpData);

            await expect(dtp.save()).rejects.toThrow();
        });

        it('should validate risk factors array', async () => {
            const dtpData = {
                workplaceId,
                patientId,
                reviewId,
                category: 'safety',
                type: 'interaction',
                severity: 'major',
                description: 'Drug interaction between warfarin and aspirin',
                clinicalSignificance: 'Increased bleeding risk due to additive anticoagulant effects',
                riskFactors: ['A'.repeat(201)], // Exceeds max length
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy
            };

            const dtp = new DrugTherapyProblem(dtpData);

            await expect(dtp.save()).rejects.toThrow();
        });

        it('should validate description length limits', async () => {
            const dtpData = {
                workplaceId,
                patientId,
                reviewId,
                category: 'safety',
                type: 'interaction',
                severity: 'major',
                description: 'A'.repeat(1001), // Exceeds max length
                clinicalSignificance: 'Increased bleeding risk due to additive anticoagulant effects',
                evidenceLevel: 'definite',
                identifiedBy,
                createdBy: identifiedBy
            };

            const dtp = new DrugTherapyProblem(dtpData);

            await expect(dtp.save()).rejects.toThrow();
        });
    });
});