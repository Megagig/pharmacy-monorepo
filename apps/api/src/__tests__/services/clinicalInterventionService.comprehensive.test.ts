import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ClinicalInterventionService, {
    CreateInterventionDTO,
    UpdateInterventionDTO,
    InterventionFilters
} from '../../services/clinicalInterventionService';
import ClinicalIntervention, { IClinicalIntervention } from '../../models/ClinicalIntervention';
import Patient from '../../models/Patient';
import User from '../../models/User';
import Workplace from '../../models/Workplace';

describe('ClinicalInterventionService - Comprehensive Tests', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplaceId: mongoose.Types.ObjectId;
    let testUserId: mongoose.Types.ObjectId;
    let testPatientId: mongoose.Types.ObjectId;
    let testPatient: any;
    let testUser: any;
    let testWorkplace: any;

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

        // Create test workplace
        testWorkplace = await Workplace.create({
            _id: testWorkplaceId,
            name: 'Test Pharmacy',
            type: 'pharmacy',
            address: '123 Test St',
            phone: '+2348012345678',
            email: 'test@pharmacy.com',
            createdBy: testUserId
        });

        // Create test user
        testUser = await User.create({
            _id: testUserId,
            firstName: 'Test',
            lastName: 'Pharmacist',
            email: 'pharmacist@test.com',
            password: 'hashedpassword',
            role: 'pharmacist',
            workplaceId: testWorkplaceId,
            isEmailVerified: true,
            createdBy: testUserId
        });

        // Create test patient
        testPatient = await Patient.create({
            _id: testPatientId,
            workplaceId: testWorkplaceId,
            firstName: 'John',
            lastName: 'Doe',
            mrn: 'MRN123456',
            dob: new Date('1980-01-01'),
            phone: '+2348012345678',
            email: 'john.doe@email.com',
            createdBy: testUserId
        });
    });

    afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear interventions before each test
        await ClinicalIntervention.deleteMany({});
    });

    describe('createIntervention', () => {
        const validInterventionData: CreateInterventionDTO = {
            patientId: testPatientId,
            category: 'drug_therapy_problem',
            priority: 'high',
            issueDescription: 'Patient experiencing side effects from current medication regimen that requires immediate attention',
            identifiedBy: testUserId,
            workplaceId: testWorkplaceId,
            estimatedDuration: 60
        };

        it('should create intervention with valid data', async () => {
            const intervention = await ClinicalInterventionService.createIntervention(validInterventionData);

            expect(intervention).toBeDefined();
            expect(intervention._id).toBeDefined();
            expect(intervention.interventionNumber).toMatch(/^CI-\d{6}-\d{4}$/);
            expect(intervention.category).toBe('drug_therapy_problem');
            expect(intervention.priority).toBe('high');
            expect(intervention.status).toBe('identified');
            expect(intervention.patientId.toString()).toBe(testPatientId.toString());
            expect(intervention.identifiedBy.toString()).toBe(testUserId.toString());
            expect(intervention.workplaceId.toString()).toBe(testWorkplaceId.toString());
            expect(intervention.estimatedDuration).toBe(60);
        });

        it('should create intervention with strategies', async () => {
            const dataWithStrategies = {
                ...validInterventionData,
                strategies: [{
                    type: 'dose_adjustment' as const,
                    description: 'Reduce dose by 50% to minimize side effects',
                    rationale: 'Patient experiencing dose-related adverse effects',
                    expectedOutcome: 'Reduction in side effects while maintaining therapeutic efficacy',
                    priority: 'primary' as const
                }]
            };

            const intervention = await ClinicalInterventionService.createIntervention(dataWithStrategies);

            expect(intervention.strategies).toHaveLength(1);
            expect(intervention.strategies[0]?.type).toBe('dose_adjustment');
            expect(intervention.status).toBe('planning'); // Auto-advanced due to strategy
        });

        it('should throw error for non-existent patient', async () => {
            const invalidData = {
                ...validInterventionData,
                patientId: new mongoose.Types.ObjectId()
            };

            await expect(ClinicalInterventionService.createIntervention(invalidData))
                .rejects.toThrow('Patient not found');
        });

        it('should throw error for non-existent user', async () => {
            const invalidData = {
                ...validInterventionData,
                identifiedBy: new mongoose.Types.ObjectId()
            };

            await expect(ClinicalInterventionService.createIntervention(invalidData))
                .rejects.toThrow('User not found');
        });

        it('should generate unique intervention numbers', async () => {
            const intervention1 = await ClinicalInterventionService.createIntervention(validInterventionData);
            const intervention2 = await ClinicalInterventionService.createIntervention(validInterventionData);

            expect(intervention1.interventionNumber).not.toBe(intervention2.interventionNumber);
            expect(intervention1.interventionNumber).toMatch(/^CI-\d{6}-\d{4}$/);
            expect(intervention2.interventionNumber).toMatch(/^CI-\d{6}-\d{4}$/);
        });

        it('should handle related MTR and DTP IDs', async () => {
            const relatedMTRId = new mongoose.Types.ObjectId();
            const relatedDTPIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];

            const dataWithRelations = {
                ...validInterventionData,
                relatedMTRId,
                relatedDTPIds
            };

            const intervention = await ClinicalInterventionService.createIntervention(dataWithRelations);

            expect(intervention.relatedMTRId?.toString()).toBe(relatedMTRId.toString());
            expect(intervention.relatedDTPIds).toHaveLength(2);
            expect(intervention.relatedDTPIds[0]?.toString()).toBe(relatedDTPIds[0]?.toString());
        });
    });

    describe('updateIntervention', () => {
        let testIntervention: IClinicalIntervention;

        beforeEach(async () => {
            testIntervention = await ClinicalIntervention.create({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem',
                priority: 'medium',
                issueDescription: 'Initial issue description that meets minimum length requirements',
                identifiedBy: testUserId,
                createdBy: testUserId,
                status: 'identified'
            });
        });

        it('should update intervention with valid data', async () => {
            const updates: UpdateInterventionDTO = {
                priority: 'high',
                issueDescription: 'Updated issue description with more detailed information about the problem',
                implementationNotes: 'Added implementation notes for tracking progress'
            };

            const updatedIntervention = await ClinicalInterventionService.updateIntervention(
                testIntervention._id.toString(),
                updates,
                testUserId,
                testWorkplaceId
            );

            expect(updatedIntervention.priority).toBe('high');
            expect(updatedIntervention.issueDescription).toBe(updates.issueDescription);
            expect(updatedIntervention.implementationNotes).toBe(updates.implementationNotes);
            expect(updatedIntervention.updatedBy?.toString()).toBe(testUserId.toString());
        });

        it('should validate status transitions', async () => {
            // Valid transition: identified -> planning
            await expect(ClinicalInterventionService.updateIntervention(
                testIntervention._id.toString(),
                { status: 'planning' },
                testUserId,
                testWorkplaceId
            )).resolves.toBeDefined();

            // Invalid transition: identified -> completed
            await expect(ClinicalInterventionService.updateIntervention(
                testIntervention._id.toString(),
                { status: 'completed' },
                testUserId,
                testWorkplaceId
            )).rejects.toThrow('Invalid status transition');
        });

        it('should handle completion status with outcomes', async () => {
            // First add strategy and set to implemented
            testIntervention.strategies.push({
                type: 'dose_adjustment',
                description: 'Reduce dose',
                rationale: 'Side effects',
                expectedOutcome: 'Reduced side effects while maintaining therapeutic efficacy',
                priority: 'primary'
            });
            testIntervention.status = 'implemented';
            await testIntervention.save();

            const updates: UpdateInterventionDTO = {
                status: 'completed',
                outcomes: {
                    patientResponse: 'improved',
                    clinicalParameters: [{
                        parameter: 'Blood Pressure',
                        beforeValue: '160/90',
                        afterValue: '130/80',
                        unit: 'mmHg',
                        improvementPercentage: 20
                    }],
                    successMetrics: {
                        problemResolved: true,
                        medicationOptimized: true,
                        adherenceImproved: false,
                        qualityOfLifeImproved: true
                    }
                }
            };

            const updatedIntervention = await ClinicalInterventionService.updateIntervention(
                testIntervention._id.toString(),
                updates,
                testUserId,
                testWorkplaceId
            );

            expect(updatedIntervention.status).toBe('completed');
            expect(updatedIntervention.completedAt).toBeDefined();
            expect(updatedIntervention.outcomes?.patientResponse).toBe('improved');
        });

        it('should throw error for non-existent intervention', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();

            await expect(ClinicalInterventionService.updateIntervention(
                nonExistentId,
                { priority: 'high' },
                testUserId,
                testWorkplaceId
            )).rejects.toThrow('Clinical intervention not found');
        });

        it('should enforce tenancy', async () => {
            const otherWorkplaceId = new mongoose.Types.ObjectId();

            await expect(ClinicalInterventionService.updateIntervention(
                testIntervention._id.toString(),
                { priority: 'high' },
                testUserId,
                otherWorkplaceId
            )).rejects.toThrow('Clinical intervention not found');
        });
    });

    describe('getInterventions', () => {
        beforeEach(async () => {
            // Create test interventions
            await ClinicalIntervention.create([
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0001',
                    category: 'drug_therapy_problem',
                    priority: 'high',
                    issueDescription: 'Test issue 1 that meets minimum length requirements for validation',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'in_progress',
                    identifiedDate: new Date('2024-12-01')
                },
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0002',
                    category: 'adverse_drug_reaction',
                    priority: 'critical',
                    issueDescription: 'Test issue 2 that meets minimum length requirements for validation',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'completed',
                    identifiedDate: new Date('2024-12-02')
                },
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0003',
                    category: 'medication_nonadherence',
                    priority: 'medium',
                    issueDescription: 'Test issue 3 that meets minimum length requirements for validation',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'planning',
                    identifiedDate: new Date('2024-12-03')
                }
            ]);
        });

        it('should get all interventions with pagination', async () => {
            const filters: InterventionFilters = {
                workplaceId: testWorkplaceId,
                page: 1,
                limit: 10
            };

            const result = await ClinicalInterventionService.getInterventions(filters);

            expect(result.data).toHaveLength(3);
            expect(result.pagination.total).toBe(3);
            expect(result.pagination.page).toBe(1);
            expect(result.pagination.limit).toBe(10);
            expect(result.pagination.pages).toBe(1);
            expect(result.pagination.hasNext).toBe(false);
            expect(result.pagination.hasPrev).toBe(false);
        });

        it('should filter by category', async () => {
            const filters: InterventionFilters = {
                workplaceId: testWorkplaceId,
                category: 'drug_therapy_problem'
            };

            const result = await ClinicalInterventionService.getInterventions(filters);

            expect(result.data).toHaveLength(1);
            expect(result.data[0]?.category).toBe('drug_therapy_problem');
        });

        it('should filter by priority', async () => {
            const filters: InterventionFilters = {
                workplaceId: testWorkplaceId,
                priority: 'critical'
            };

            const result = await ClinicalInterventionService.getInterventions(filters);

            expect(result.data).toHaveLength(1);
            expect(result.data[0]?.priority).toBe('critical');
        });

        it('should filter by status', async () => {
            const filters: InterventionFilters = {
                workplaceId: testWorkplaceId,
                status: 'completed'
            };

            const result = await ClinicalInterventionService.getInterventions(filters);

            expect(result.data).toHaveLength(1);
            expect(result.data[0]?.status).toBe('completed');
        });

        it('should filter by patient', async () => {
            const filters: InterventionFilters = {
                workplaceId: testWorkplaceId,
                patientId: testPatientId
            };

            const result = await ClinicalInterventionService.getInterventions(filters);

            expect(result.data).toHaveLength(3);
            result.data.forEach(intervention => {
                expect(intervention.patientId.toString()).toBe(testPatientId.toString());
            });
        });

        it('should filter by date range', async () => {
            const filters: InterventionFilters = {
                workplaceId: testWorkplaceId,
                dateFrom: new Date('2024-12-02'),
                dateTo: new Date('2024-12-03')
            };

            const result = await ClinicalInterventionService.getInterventions(filters);

            expect(result.data).toHaveLength(2);
        });

        it('should search by text', async () => {
            const filters: InterventionFilters = {
                workplaceId: testWorkplaceId,
                search: 'CI-202412-0001'
            };

            const result = await ClinicalInterventionService.getInterventions(filters);

            expect(result.data).toHaveLength(1);
            expect(result.data[0]?.interventionNumber).toBe('CI-202412-0001');
        });

        it('should sort results', async () => {
            const filters: InterventionFilters = {
                workplaceId: testWorkplaceId,
                sortBy: 'priority',
                sortOrder: 'asc'
            };

            const result = await ClinicalInterventionService.getInterventions(filters);

            expect(result.data).toHaveLength(3);
            // Should be sorted by priority: critical, high, medium
            expect(result.data[0]?.priority).toBe('critical');
            expect(result.data[1]?.priority).toBe('high');
            expect(result.data[2]?.priority).toBe('medium');
        });

        it('should handle pagination correctly', async () => {
            const filters: InterventionFilters = {
                workplaceId: testWorkplaceId,
                page: 2,
                limit: 2
            };

            const result = await ClinicalInterventionService.getInterventions(filters);

            expect(result.data).toHaveLength(1); // Only 1 item on page 2
            expect(result.pagination.page).toBe(2);
            expect(result.pagination.limit).toBe(2);
            expect(result.pagination.total).toBe(3);
            expect(result.pagination.pages).toBe(2);
            expect(result.pagination.hasNext).toBe(false);
            expect(result.pagination.hasPrev).toBe(true);
        });

        it('should enforce tenancy', async () => {
            const otherWorkplaceId = new mongoose.Types.ObjectId();
            const filters: InterventionFilters = {
                workplaceId: otherWorkplaceId
            };

            const result = await ClinicalInterventionService.getInterventions(filters);

            expect(result.data).toHaveLength(0);
        });
    });

    describe('getInterventionById', () => {
        let testIntervention: IClinicalIntervention;

        beforeEach(async () => {
            testIntervention = await ClinicalIntervention.create({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem',
                priority: 'high',
                issueDescription: 'Test issue that meets minimum length requirements for validation',
                identifiedBy: testUserId,
                createdBy: testUserId,
                strategies: [{
                    type: 'dose_adjustment',
                    description: 'Reduce dose by 50%',
                    rationale: 'Patient experiencing side effects',
                    expectedOutcome: 'Reduced side effects while maintaining therapeutic efficacy',
                    priority: 'primary'
                }],
                assignments: [{
                    userId: testUserId,
                    role: 'pharmacist',
                    task: 'Review medication regimen',
                    status: 'pending',
                    assignedAt: new Date()
                }]
            });
        });

        it('should get intervention with populated fields', async () => {
            const intervention = await ClinicalInterventionService.getInterventionById(
                testIntervention._id.toString(),
                testWorkplaceId
            );

            expect(intervention).toBeDefined();
            expect(intervention._id.toString()).toBe(testIntervention._id.toString());
            expect(intervention.interventionNumber).toBe('CI-202412-0001');
            expect(intervention.strategies).toHaveLength(1);
            expect(intervention.assignments).toHaveLength(1);
        });

        it('should throw error for non-existent intervention', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();

            await expect(ClinicalInterventionService.getInterventionById(
                nonExistentId,
                testWorkplaceId
            )).rejects.toThrow('Clinical intervention not found');
        });

        it('should enforce tenancy', async () => {
            const otherWorkplaceId = new mongoose.Types.ObjectId();

            await expect(ClinicalInterventionService.getInterventionById(
                testIntervention._id.toString(),
                otherWorkplaceId
            )).rejects.toThrow('Clinical intervention not found');
        });
    });

    describe('deleteIntervention', () => {
        let testIntervention: IClinicalIntervention;

        beforeEach(async () => {
            testIntervention = await ClinicalIntervention.create({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem',
                priority: 'high',
                issueDescription: 'Test issue that meets minimum length requirements for validation',
                identifiedBy: testUserId,
                createdBy: testUserId,
                status: 'planning'
            });
        });

        it('should soft delete intervention', async () => {
            const result = await ClinicalInterventionService.deleteIntervention(
                testIntervention._id.toString(),
                testUserId,
                testWorkplaceId
            );

            expect(result).toBe(true);

            // Verify soft delete
            const deletedIntervention = await ClinicalIntervention.findById(testIntervention._id);
            expect(deletedIntervention?.isDeleted).toBe(true);
            expect(deletedIntervention?.updatedBy?.toString()).toBe(testUserId.toString());
        });

        it('should not delete completed interventions', async () => {
            testIntervention.status = 'completed';
            await testIntervention.save();

            await expect(ClinicalInterventionService.deleteIntervention(
                testIntervention._id.toString(),
                testUserId,
                testWorkplaceId
            )).rejects.toThrow('Cannot delete completed interventions');
        });

        it('should throw error for non-existent intervention', async () => {
            const nonExistentId = new mongoose.Types.ObjectId().toString();

            await expect(ClinicalInterventionService.deleteIntervention(
                nonExistentId,
                testUserId,
                testWorkplaceId
            )).rejects.toThrow('Clinical intervention not found');
        });
    });

    describe('checkDuplicateInterventions', () => {
        beforeEach(async () => {
            // Create existing intervention
            await ClinicalIntervention.create({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem',
                priority: 'high',
                issueDescription: 'Existing intervention that meets minimum length requirements',
                identifiedBy: testUserId,
                createdBy: testUserId,
                status: 'in_progress',
                identifiedDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
            });
        });

        it('should find duplicate interventions in same category', async () => {
            const duplicates = await ClinicalInterventionService.checkDuplicateInterventions(
                testPatientId,
                'drug_therapy_problem',
                testWorkplaceId
            );

            expect(duplicates).toHaveLength(1);
            expect(duplicates[0]?.category).toBe('drug_therapy_problem');
        });

        it('should not find duplicates in different categories', async () => {
            const duplicates = await ClinicalInterventionService.checkDuplicateInterventions(
                testPatientId,
                'adverse_drug_reaction',
                testWorkplaceId
            );

            expect(duplicates).toHaveLength(0);
        });

        it('should exclude specific intervention ID', async () => {
            const existingIntervention = await ClinicalIntervention.findOne({
                category: 'drug_therapy_problem'
            });

            const duplicates = await ClinicalInterventionService.checkDuplicateInterventions(
                testPatientId,
                'drug_therapy_problem',
                testWorkplaceId,
                existingIntervention?._id.toString()
            );

            expect(duplicates).toHaveLength(0);
        });

        it('should only find interventions within 30 days', async () => {
            // Create old intervention (40 days ago)
            await ClinicalIntervention.create({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202411-0001',
                category: 'drug_therapy_problem',
                priority: 'high',
                issueDescription: 'Old intervention that meets minimum length requirements',
                identifiedBy: testUserId,
                createdBy: testUserId,
                status: 'in_progress',
                identifiedDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000)
            });

            const duplicates = await ClinicalInterventionService.checkDuplicateInterventions(
                testPatientId,
                'drug_therapy_problem',
                testWorkplaceId
            );

            // Should only find the recent one (5 days ago), not the old one (40 days ago)
            expect(duplicates).toHaveLength(1);
        });
    });

    describe('getPatientInterventionSummary', () => {
        beforeEach(async () => {
            // Create test interventions for patient
            await ClinicalIntervention.create([
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0001',
                    category: 'drug_therapy_problem',
                    priority: 'high',
                    issueDescription: 'Test issue 1 that meets minimum length requirements',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'completed',
                    outcomes: {
                        patientResponse: 'improved',
                        clinicalParameters: [],
                        successMetrics: {
                            problemResolved: true,
                            medicationOptimized: true,
                            adherenceImproved: false
                        }
                    }
                },
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0002',
                    category: 'adverse_drug_reaction',
                    priority: 'critical',
                    issueDescription: 'Test issue 2 that meets minimum length requirements',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'in_progress'
                },
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0003',
                    category: 'drug_therapy_problem',
                    priority: 'medium',
                    issueDescription: 'Test issue 3 that meets minimum length requirements',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'completed',
                    outcomes: {
                        patientResponse: 'no_change',
                        clinicalParameters: [],
                        successMetrics: {
                            problemResolved: false,
                            medicationOptimized: true,
                            adherenceImproved: false
                        }
                    }
                }
            ]);
        });

        it('should return comprehensive patient intervention summary', async () => {
            const summary = await ClinicalInterventionService.getPatientInterventionSummary(
                testPatientId,
                testWorkplaceId
            );

            expect(summary.totalInterventions).toBe(3);
            expect(summary.activeInterventions).toBe(1); // in_progress
            expect(summary.completedInterventions).toBe(2);
            expect(summary.successfulInterventions).toBe(1); // Only one with problemResolved: true
            expect(summary.categoryBreakdown['drug_therapy_problem']).toBe(2);
            expect(summary.categoryBreakdown['adverse_drug_reaction']).toBe(1);
            expect(summary.recentInterventions).toHaveLength(3);
        });

        it('should return empty summary for patient with no interventions', async () => {
            const otherPatientId = new mongoose.Types.ObjectId();

            const summary = await ClinicalInterventionService.getPatientInterventionSummary(
                otherPatientId,
                testWorkplaceId
            );

            expect(summary.totalInterventions).toBe(0);
            expect(summary.activeInterventions).toBe(0);
            expect(summary.completedInterventions).toBe(0);
            expect(summary.successfulInterventions).toBe(0);
            expect(Object.keys(summary.categoryBreakdown)).toHaveLength(0);
            expect(summary.recentInterventions).toHaveLength(0);
        });
    });

    describe('searchPatientsWithInterventions', () => {
        let otherPatientId: mongoose.Types.ObjectId;

        beforeEach(async () => {
            // Create another patient
            const otherPatient = await Patient.create({
                workplaceId: testWorkplaceId,
                firstName: 'Jane',
                lastName: 'Smith',
                mrn: 'MRN789012',
                dob: new Date('1975-05-15'),
                phone: '+2348087654321',
                email: 'jane.smith@email.com',
                createdBy: testUserId
            });
            otherPatientId = otherPatient._id;

            // Create interventions for both patients
            await ClinicalIntervention.create([
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0001',
                    category: 'drug_therapy_problem',
                    priority: 'high',
                    issueDescription: 'Test issue for John Doe',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'completed'
                },
                {
                    workplaceId: testWorkplaceId,
                    patientId: otherPatientId,
                    interventionNumber: 'CI-202412-0002',
                    category: 'adverse_drug_reaction',
                    priority: 'critical',
                    issueDescription: 'Test issue for Jane Smith',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'in_progress'
                }
            ]);
        });

        it('should search patients by first name', async () => {
            const results = await ClinicalInterventionService.searchPatientsWithInterventions(
                'John',
                testWorkplaceId
            );

            expect(results).toHaveLength(1);
            expect(results[0]?.firstName).toBe('John');
            expect(results[0]?.interventionCount).toBe(1);
            expect(results[0]?.activeInterventionCount).toBe(0);
        });

        it('should search patients by last name', async () => {
            const results = await ClinicalInterventionService.searchPatientsWithInterventions(
                'Smith',
                testWorkplaceId
            );

            expect(results).toHaveLength(1);
            expect(results[0]?.lastName).toBe('Smith');
            expect(results[0]?.interventionCount).toBe(1);
            expect(results[0]?.activeInterventionCount).toBe(1);
        });

        it('should search patients by MRN', async () => {
            const results = await ClinicalInterventionService.searchPatientsWithInterventions(
                'MRN123456',
                testWorkplaceId
            );

            expect(results).toHaveLength(1);
            expect(results[0]?.mrn).toBe('MRN123456');
        });

        it('should include intervention counts and last intervention date', async () => {
            const results = await ClinicalInterventionService.searchPatientsWithInterventions(
                'Jane',
                testWorkplaceId
            );

            expect(results).toHaveLength(1);
            expect(results[0]?.interventionCount).toBe(1);
            expect(results[0]?.activeInterventionCount).toBe(1);
            expect(results[0]?.lastInterventionDate).toBeDefined();
        });

        it('should calculate patient age', async () => {
            const results = await ClinicalInterventionService.searchPatientsWithInterventions(
                'John',
                testWorkplaceId
            );

            expect(results).toHaveLength(1);
            expect(results[0]?.age).toBeGreaterThan(40); // Born in 1980
        });

        it('should limit results', async () => {
            const results = await ClinicalInterventionService.searchPatientsWithInterventions(
                '', // Empty search to get all
                testWorkplaceId,
                1 // Limit to 1
            );

            expect(results).toHaveLength(1);
        });
    });

    describe('generateInterventionNumber', () => {
        it('should generate intervention number in correct format', async () => {
            const interventionNumber = await ClinicalInterventionService.generateInterventionNumber(testWorkplaceId);

            expect(interventionNumber).toMatch(/^CI-\d{6}-\d{4}$/);
        });

        it('should generate sequential numbers for same workplace', async () => {
            const number1 = await ClinicalInterventionService.generateInterventionNumber(testWorkplaceId);
            const number2 = await ClinicalInterventionService.generateInterventionNumber(testWorkplaceId);

            expect(number1).toMatch(/^CI-\d{6}-\d{4}$/);
            expect(number2).toMatch(/^CI-\d{6}-\d{4}$/);
            expect(number1).not.toBe(number2);

            // Extract sequence numbers
            const seq1 = parseInt(number1.split('-')[2] || '0');
            const seq2 = parseInt(number2.split('-')[2] || '0');
            expect(seq2).toBe(seq1 + 1);
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection errors gracefully', async () => {
            // Temporarily close connection
            await mongoose.disconnect();

            await expect(ClinicalInterventionService.generateInterventionNumber(testWorkplaceId))
                .rejects.toThrow();

            // Reconnect for cleanup
            await mongoose.connect(mongoServer.getUri());
        });

        it('should handle invalid ObjectId formats', async () => {
            const invalidId = 'invalid-object-id';

            await expect(ClinicalInterventionService.getInterventionById(
                invalidId,
                testWorkplaceId
            )).rejects.toThrow();
        });
    });

    describe('Performance Tests', () => {
        beforeEach(async () => {
            // Create multiple interventions for performance testing
            const interventions = [];
            for (let i = 0; i < 100; i++) {
                interventions.push({
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: `CI-202412-${String(i + 1).padStart(4, '0')}`,
                    category: 'drug_therapy_problem',
                    priority: 'medium',
                    issueDescription: `Test issue ${i + 1} that meets minimum length requirements for validation`,
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'identified'
                });
            }
            await ClinicalIntervention.insertMany(interventions);
        });

        it('should handle large result sets efficiently', async () => {
            const startTime = Date.now();

            const filters: InterventionFilters = {
                workplaceId: testWorkplaceId,
                limit: 50
            };

            const result = await ClinicalInterventionService.getInterventions(filters);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(result.data).toHaveLength(50);
            expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
        });

        it('should handle complex filtering efficiently', async () => {
            const startTime = Date.now();

            const filters: InterventionFilters = {
                workplaceId: testWorkplaceId,
                category: 'drug_therapy_problem',
                priority: 'medium',
                status: 'identified',
                search: 'Test issue',
                sortBy: 'identifiedDate',
                sortOrder: 'desc'
            };

            const result = await ClinicalInterventionService.getInterventions(filters);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(result.data.length).toBeGreaterThan(0);
            expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
        });
    });
});