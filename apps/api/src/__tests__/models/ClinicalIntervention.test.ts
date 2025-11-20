import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ClinicalIntervention, { IClinicalIntervention } from '../../models/ClinicalIntervention';

describe('ClinicalIntervention Model', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplaceId: mongoose.Types.ObjectId;
    let testUserId: mongoose.Types.ObjectId;
    let testPatientId: mongoose.Types.ObjectId;

    beforeAll(async () => {
        // Disconnect existing connection if any
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }

        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create test data
        testWorkplaceId = new mongoose.Types.ObjectId();
        testUserId = new mongoose.Types.ObjectId();
        testPatientId = new mongoose.Types.ObjectId();
    });

    afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        await mongoServer.stop();
    });

    beforeEach(async () => {
        await ClinicalIntervention.deleteMany({});
    });

    describe('Schema Validation', () => {
        it('should create a valid clinical intervention', async () => {
            const interventionData = {
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Patient experiencing side effects from current medication regimen',
                identifiedBy: testUserId,
                createdBy: testUserId,
            };

            const intervention = new ClinicalIntervention(interventionData);
            const savedIntervention = await intervention.save();

            expect(savedIntervention._id).toBeDefined();
            expect(savedIntervention.workplaceId).toEqual(testWorkplaceId);
            expect(savedIntervention.patientId).toEqual(testPatientId);
            expect(savedIntervention.category).toBe('drug_therapy_problem');
            expect(savedIntervention.priority).toBe('high');
            expect(savedIntervention.status).toBe('identified'); // default status
            expect(savedIntervention.isDeleted).toBe(false); // audit field default
        });

        it('should require mandatory fields', async () => {
            const intervention = new ClinicalIntervention({});

            await expect(intervention.save()).rejects.toThrow();
        });

        it('should validate intervention number format', async () => {
            const interventionData = {
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'INVALID-FORMAT',
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Test issue description that meets minimum length requirement',
                identifiedBy: testUserId,
                createdBy: testUserId,
            };

            const intervention = new ClinicalIntervention(interventionData);
            await expect(intervention.save()).rejects.toThrow(/Invalid intervention number format/);
        });

        it('should validate issue description length', async () => {
            const interventionData = {
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Short', // Less than 10 characters
                identifiedBy: testUserId,
                createdBy: testUserId,
            };

            const intervention = new ClinicalIntervention(interventionData);
            await expect(intervention.save()).rejects.toThrow(/Issue description must be at least 10 characters/);
        });

        it('should validate category enum values', async () => {
            const interventionData = {
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'invalid_category' as any,
                priority: 'high' as const,
                issueDescription: 'Valid issue description that meets minimum length requirement',
                identifiedBy: testUserId,
                createdBy: testUserId,
            };

            const intervention = new ClinicalIntervention(interventionData);
            await expect(intervention.save()).rejects.toThrow();
        });

        it('should validate priority enum values', async () => {
            const interventionData = {
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem' as const,
                priority: 'invalid_priority' as any,
                issueDescription: 'Valid issue description that meets minimum length requirement',
                identifiedBy: testUserId,
                createdBy: testUserId,
            };

            const intervention = new ClinicalIntervention(interventionData);
            await expect(intervention.save()).rejects.toThrow();
        });
    });

    describe('Strategy Management', () => {
        let intervention: IClinicalIntervention;

        beforeEach(async () => {
            intervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Patient experiencing side effects from current medication regimen',
                identifiedBy: testUserId,
                createdBy: testUserId,
            });
            await intervention.save();
        });

        it('should add strategy and update status', async () => {
            const strategy = {
                type: 'dose_adjustment' as const,
                description: 'Reduce dose by 50%',
                rationale: 'Patient experiencing dose-related side effects',
                expectedOutcome: 'Reduction in side effects while maintaining therapeutic effect',
                priority: 'primary' as const,
            };

            intervention.addStrategy(strategy);
            await intervention.save();

            expect(intervention.strategies).toHaveLength(1);
            expect(intervention.strategies[0]?.type).toBe('dose_adjustment');
            expect(intervention.status).toBe('planning'); // Auto-advanced from 'identified'
        });

        it('should validate strategy fields', async () => {
            const invalidStrategy = {
                type: 'dose_adjustment' as const,
                description: '', // Empty description
                rationale: 'Valid rationale',
                expectedOutcome: 'Valid expected outcome that meets minimum length',
                priority: 'primary' as const,
            };

            intervention.strategies.push(invalidStrategy);
            await expect(intervention.save()).rejects.toThrow();
        });

        it('should validate expected outcome minimum length', async () => {
            const strategy = {
                type: 'dose_adjustment' as const,
                description: 'Valid description',
                rationale: 'Valid rationale',
                expectedOutcome: 'Short', // Less than 20 characters
                priority: 'primary' as const,
            };

            intervention.strategies.push(strategy);
            await expect(intervention.save()).rejects.toThrow(/Expected outcome must be at least 20 characters/);
        });
    });

    describe('Team Assignment Management', () => {
        let intervention: IClinicalIntervention;

        beforeEach(async () => {
            intervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Patient experiencing side effects from current medication regimen',
                identifiedBy: testUserId,
                createdBy: testUserId,
                status: 'planning',
            });
            await intervention.save();
        });

        it('should assign team member and update status', async () => {
            const assignment = {
                userId: testUserId,
                role: 'pharmacist' as const,
                task: 'Review medication regimen and recommend dose adjustment',
                status: 'pending' as const,
                assignedAt: new Date(),
            };

            intervention.assignTeamMember(assignment);
            await intervention.save();

            expect(intervention.assignments).toHaveLength(1);
            expect(intervention.assignments[0]?.role).toBe('pharmacist');
            expect(intervention.status).toBe('in_progress'); // Auto-advanced from 'planning'
        });

        it('should validate assignment role enum', async () => {
            const invalidAssignment = {
                userId: testUserId,
                role: 'invalid_role' as any,
                task: 'Valid task description',
                status: 'pending' as const,
                assignedAt: new Date(),
            };

            intervention.assignments.push(invalidAssignment);
            await expect(intervention.save()).rejects.toThrow();
        });
    });

    describe('Outcome Recording', () => {
        let intervention: IClinicalIntervention;

        beforeEach(async () => {
            intervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Patient experiencing side effects from current medication regimen',
                identifiedBy: testUserId,
                createdBy: testUserId,
                status: 'in_progress',
            });
            await intervention.save();
        });

        it('should record outcome and update status', async () => {
            const outcome = {
                patientResponse: 'improved' as const,
                clinicalParameters: [
                    {
                        parameter: 'Blood Pressure',
                        beforeValue: '160/90',
                        afterValue: '130/80',
                        unit: 'mmHg',
                        improvementPercentage: 20,
                    },
                ],
                successMetrics: {
                    problemResolved: true,
                    medicationOptimized: true,
                    adherenceImproved: false,
                    qualityOfLifeImproved: true,
                },
            };

            intervention.recordOutcome(outcome);
            await intervention.save();

            expect(intervention.outcomes?.patientResponse).toBe('improved');
            expect(intervention.outcomes?.clinicalParameters).toHaveLength(1);
            expect(intervention.status).toBe('implemented'); // Auto-advanced from 'in_progress'
        });

        it('should validate clinical parameter values', async () => {
            const outcome = {
                patientResponse: 'improved' as const,
                clinicalParameters: [
                    {
                        parameter: '', // Empty parameter name
                        beforeValue: '160/90',
                        afterValue: '130/80',
                        unit: 'mmHg',
                    },
                ],
                successMetrics: {
                    problemResolved: true,
                    medicationOptimized: true,
                    adherenceImproved: false,
                },
            };

            intervention.outcomes = outcome;
            await expect(intervention.save()).rejects.toThrow();
        });
    });

    describe('Virtual Properties', () => {
        let intervention: IClinicalIntervention;

        beforeEach(async () => {
            intervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Patient experiencing side effects from current medication regimen',
                identifiedBy: testUserId,
                createdBy: testUserId,
                startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            });
            await intervention.save();
        });

        it('should calculate duration in days', () => {
            expect(intervention.durationDays).toBeGreaterThanOrEqual(2);
        });

        it('should determine overdue status based on priority', () => {
            // High priority intervention started 2 days ago should be overdue (threshold: 1 day)
            expect(intervention.isOverdue).toBe(true);
        });

        it('should not be overdue if completed', async () => {
            intervention.status = 'completed';
            intervention.completedAt = new Date();
            await intervention.save();

            expect(intervention.isOverdue).toBe(false);
        });
    });

    describe('Instance Methods', () => {
        let intervention: IClinicalIntervention;

        beforeEach(async () => {
            intervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Patient experiencing side effects from current medication regimen',
                identifiedBy: testUserId,
                createdBy: testUserId,
            });
            await intervention.save();
        });

        it('should calculate completion percentage', () => {
            expect(intervention.getCompletionPercentage()).toBe(20); // 'identified' = step 1 of 5

            intervention.status = 'in_progress';
            expect(intervention.getCompletionPercentage()).toBe(60); // 'in_progress' = step 3 of 5

            intervention.status = 'completed';
            expect(intervention.getCompletionPercentage()).toBe(100); // 'completed' = step 5 of 5
        });

        it('should get next step', () => {
            expect(intervention.getNextStep()).toBe('planning');

            intervention.status = 'planning';
            expect(intervention.getNextStep()).toBe('in_progress');

            intervention.status = 'completed';
            expect(intervention.getNextStep()).toBeNull();
        });

        it('should determine if can complete', () => {
            expect(intervention.canComplete()).toBe(false); // No strategies or outcomes

            // Add strategy
            intervention.strategies.push({
                type: 'dose_adjustment',
                description: 'Reduce dose',
                rationale: 'Side effects',
                expectedOutcome: 'Reduced side effects while maintaining efficacy',
                priority: 'primary',
            });

            // Set status to implemented
            intervention.status = 'implemented';

            // Add outcome
            intervention.outcomes = {
                patientResponse: 'improved',
                clinicalParameters: [],
                successMetrics: {
                    problemResolved: true,
                    medicationOptimized: true,
                    adherenceImproved: false,
                },
            };

            expect(intervention.canComplete()).toBe(true);
        });

        it('should generate intervention number', () => {
            const interventionNumber = intervention.generateInterventionNumber();
            expect(interventionNumber).toMatch(/^CI-\d{6}-\d{4}$/);
        });
    });

    describe('Static Methods', () => {
        beforeEach(async () => {
            // Create test interventions
            await ClinicalIntervention.create([
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0001',
                    category: 'drug_therapy_problem' as const,
                    priority: 'high' as const,
                    issueDescription: 'Test issue 1 that meets minimum length requirement',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'in_progress',
                },
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0002',
                    category: 'adverse_drug_reaction' as const,
                    priority: 'critical' as const,
                    issueDescription: 'Test issue 2 that meets minimum length requirement',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'completed',
                    completedAt: new Date(),
                },
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0003',
                    category: 'medication_nonadherence' as const,
                    priority: 'low' as const,
                    issueDescription: 'Test issue 3 that meets minimum length requirement',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'planning',
                    startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
                },
            ]);
        });

        it('should find active interventions', async () => {
            const activeInterventions = await (ClinicalIntervention as any).findActive(testWorkplaceId);
            expect(activeInterventions).toHaveLength(2); // in_progress and planning
        });

        it('should find overdue interventions', async () => {
            const overdueInterventions = await (ClinicalIntervention as any).findOverdue(testWorkplaceId);
            expect(overdueInterventions.length).toBeGreaterThan(0);
        });

        it('should find interventions by patient', async () => {
            const patientInterventions = await (ClinicalIntervention as any).findByPatient(
                testPatientId,
                testWorkplaceId
            );
            expect(patientInterventions).toHaveLength(3);
        });

        it('should generate next intervention number', async () => {
            const nextNumber = await (ClinicalIntervention as any).generateNextInterventionNumber(testWorkplaceId);
            expect(nextNumber).toMatch(/^CI-\d{6}-\d{4}$/);
            expect(nextNumber).toContain('0004'); // Should be next in sequence
        });
    });

    describe('Pre-save Middleware', () => {
        it('should auto-generate intervention number', async () => {
            const intervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Test issue that meets minimum length requirement',
                identifiedBy: testUserId,
                createdBy: testUserId,
            });

            await intervention.save();
            expect(intervention.interventionNumber).toMatch(/^CI-\d{6}-\d{4}$/);
        });

        it('should require strategies for non-identified status', async () => {
            const intervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Test issue that meets minimum length requirement',
                identifiedBy: testUserId,
                createdBy: testUserId,
                status: 'planning', // Non-identified status
            });

            await expect(intervention.save()).rejects.toThrow(/At least one intervention strategy is required/);
        });

        it('should require outcome for implemented status', async () => {
            const intervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Test issue that meets minimum length requirement',
                identifiedBy: testUserId,
                createdBy: testUserId,
                status: 'implemented',
                strategies: [
                    {
                        type: 'dose_adjustment',
                        description: 'Reduce dose',
                        rationale: 'Side effects',
                        expectedOutcome: 'Reduced side effects while maintaining therapeutic efficacy',
                        priority: 'primary',
                    },
                ],
            });

            await expect(intervention.save()).rejects.toThrow(/Patient response outcome is required/);
        });

        it('should auto-set completedAt when status changes to completed', async () => {
            const intervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Test issue that meets minimum length requirement',
                identifiedBy: testUserId,
                createdBy: testUserId,
                status: 'completed',
                strategies: [
                    {
                        type: 'dose_adjustment',
                        description: 'Reduce dose',
                        rationale: 'Side effects',
                        expectedOutcome: 'Reduced side effects while maintaining therapeutic efficacy',
                        priority: 'primary',
                    },
                ],
                outcomes: {
                    patientResponse: 'improved',
                    clinicalParameters: [],
                    successMetrics: {
                        problemResolved: true,
                        medicationOptimized: true,
                        adherenceImproved: false,
                    },
                },
            });

            await intervention.save();
            expect(intervention.completedAt).toBeDefined();
            expect(intervention.actualDuration).toBeDefined();
        });
    });

    describe('Tenancy Guard Integration', () => {
        it('should apply tenancy filtering', async () => {
            const otherWorkplaceId = new mongoose.Types.ObjectId();

            // Create interventions for different workplaces
            await ClinicalIntervention.create([
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0001',
                    category: 'drug_therapy_problem' as const,
                    priority: 'high' as const,
                    issueDescription: 'Test issue 1 that meets minimum length requirement',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                },
                {
                    workplaceId: otherWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0002',
                    category: 'adverse_drug_reaction' as const,
                    priority: 'critical' as const,
                    issueDescription: 'Test issue 2 that meets minimum length requirement',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                },
            ]);

            // Query with tenancy context
            const interventions = await ClinicalIntervention.find().setOptions({
                workplaceId: testWorkplaceId,
            });

            expect(interventions).toHaveLength(1);
            expect(interventions[0]?.workplaceId.toString()).toBe(testWorkplaceId.toString());
        });

        it('should apply soft delete filtering', async () => {
            const intervention = await ClinicalIntervention.create({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Test issue that meets minimum length requirement',
                identifiedBy: testUserId,
                createdBy: testUserId,
            });

            // Soft delete
            intervention.isDeleted = true;
            await intervention.save();

            // Should not find soft-deleted intervention
            const interventions = await ClinicalIntervention.find().setOptions({
                workplaceId: testWorkplaceId,
            });

            expect(interventions).toHaveLength(0);
        });
    });
});