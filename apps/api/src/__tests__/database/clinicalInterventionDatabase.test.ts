import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ClinicalIntervention, { IClinicalIntervention } from '../../models/ClinicalIntervention';
import Patient from '../../models/Patient';
import User from '../../models/User';
import Workplace from '../../models/Workplace';

describe('Clinical Intervention Database Operations', () => {
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

        // Create test workplace
        await Workplace.create({
            _id: testWorkplaceId,
            name: 'Test Pharmacy',
            type: 'pharmacy',
            address: '123 Test St',
            phone: '+2348012345678',
            email: 'test@pharmacy.com',
            createdBy: testUserId
        });

        // Create test user
        await User.create({
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
        await Patient.create({
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

    describe('CRUD Operations', () => {
        it('should create intervention with all fields', async () => {
            const interventionData = {
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem' as const,
                priority: 'high' as const,
                issueDescription: 'Patient experiencing side effects from current medication regimen',
                identifiedBy: testUserId,
                createdBy: testUserId,
                strategies: [{
                    type: 'dose_adjustment' as const,
                    description: 'Reduce dose by 50%',
                    rationale: 'Patient experiencing side effects',
                    expectedOutcome: 'Reduced side effects while maintaining therapeutic efficacy',
                    priority: 'primary' as const
                }],
                assignments: [{
                    userId: testUserId,
                    role: 'pharmacist' as const,
                    task: 'Review medication regimen',
                    status: 'pending' as const,
                    assignedAt: new Date()
                }],
                estimatedDuration: 60,
                relatedDTPIds: [new mongoose.Types.ObjectId()]
            };

            const intervention = await ClinicalIntervention.create(interventionData);

            expect(intervention._id).toBeDefined();
            expect(intervention.interventionNumber).toBe('CI-202412-0001');
            expect(intervention.category).toBe('drug_therapy_problem');
            expect(intervention.priority).toBe('high');
            expect(intervention.strategies).toHaveLength(1);
            expect(intervention.assignments).toHaveLength(1);
            expect(intervention.estimatedDuration).toBe(60);
            expect(intervention.relatedDTPIds).toHaveLength(1);
            expect(intervention.createdAt).toBeDefined();
            expect(intervention.updatedAt).toBeDefined();
        });

        it('should read intervention with populated fields', async () => {
            const intervention = await ClinicalIntervention.create({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem',
                priority: 'high',
                issueDescription: 'Test intervention for reading with populated fields',
                identifiedBy: testUserId,
                createdBy: testUserId
            });

            const foundIntervention = await ClinicalIntervention.findById(intervention._id)
                .populate('patientId', 'firstName lastName mrn')
                .populate('identifiedBy', 'firstName lastName email')
                .populate('assignments.userId', 'firstName lastName');

            expect(foundIntervention).toBeDefined();
            expect(foundIntervention?.patientId).toBeDefined();
            expect(foundIntervention?.identifiedBy).toBeDefined();
        });

        it('should update intervention fields', async () => {
            const intervention = await ClinicalIntervention.create({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem',
                priority: 'medium',
                issueDescription: 'Original issue description that meets minimum length requirements',
                identifiedBy: testUserId,
                createdBy: testUserId
            });

            const updatedIntervention = await ClinicalIntervention.findByIdAndUpdate(
                intervention._id,
                {
                    priority: 'high',
                    issueDescription: 'Updated issue description with more detailed information',
                    implementationNotes: 'Added implementation notes',
                    updatedBy: testUserId
                },
                { new: true }
            );

            expect(updatedIntervention?.priority).toBe('high');
            expect(updatedIntervention?.issueDescription).toBe('Updated issue description with more detailed information');
            expect(updatedIntervention?.implementationNotes).toBe('Added implementation notes');
            expect(updatedIntervention?.updatedBy?.toString()).toBe(testUserId.toString());
        });

        it('should soft delete intervention', async () => {
            const intervention = await ClinicalIntervention.create({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem',
                priority: 'medium',
                issueDescription: 'Test intervention for soft delete operation',
                identifiedBy: testUserId,
                createdBy: testUserId
            });

            // Soft delete
            await ClinicalIntervention.findByIdAndUpdate(
                intervention._id,
                { isDeleted: true, updatedBy: testUserId }
            );

            // Should still exist in database
            const deletedIntervention = await ClinicalIntervention.findById(intervention._id);
            expect(deletedIntervention?.isDeleted).toBe(true);

            // Should not be found in normal queries with tenancy guard
            const activeInterventions = await ClinicalIntervention.find()
                .setOptions({ workplaceId: testWorkplaceId });
            expect(activeInterventions).toHaveLength(0);
        });
    });

    describe('Query Operations', () => {
        beforeEach(async () => {
            // Create test data for querying
            await ClinicalIntervention.create([
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0001',
                    category: 'drug_therapy_problem',
                    priority: 'high',
                    issueDescription: 'High priority drug therapy problem requiring immediate attention',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'in_progress',
                    identifiedDate: new Date('2024-12-01'),
                    startedAt: new Date('2024-12-01')
                },
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0002',
                    category: 'adverse_drug_reaction',
                    priority: 'critical',
                    issueDescription: 'Critical adverse drug reaction requiring emergency intervention',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'completed',
                    identifiedDate: new Date('2024-12-02'),
                    startedAt: new Date('2024-12-02'),
                    completedAt: new Date('2024-12-03')
                },
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0003',
                    category: 'medication_nonadherence',
                    priority: 'medium',
                    issueDescription: 'Medium priority medication adherence issue needing follow-up',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'planning',
                    identifiedDate: new Date('2024-12-03'),
                    startedAt: new Date('2024-12-03')
                }
            ]);
        });

        it('should find interventions by category', async () => {
            const interventions = await ClinicalIntervention.find({
                category: 'drug_therapy_problem'
            }).setOptions({ workplaceId: testWorkplaceId });

            expect(interventions).toHaveLength(1);
            expect(interventions[0]?.category).toBe('drug_therapy_problem');
        });

        it('should find interventions by priority', async () => {
            const interventions = await ClinicalIntervention.find({
                priority: 'critical'
            }).setOptions({ workplaceId: testWorkplaceId });

            expect(interventions).toHaveLength(1);
            expect(interventions[0]?.priority).toBe('critical');
        });

        it('should find interventions by status', async () => {
            const interventions = await ClinicalIntervention.find({
                status: 'completed'
            }).setOptions({ workplaceId: testWorkplaceId });

            expect(interventions).toHaveLength(1);
            expect(interventions[0]?.status).toBe('completed');
        });

        it('should find interventions by date range', async () => {
            const interventions = await ClinicalIntervention.find({
                identifiedDate: {
                    $gte: new Date('2024-12-02'),
                    $lte: new Date('2024-12-03')
                }
            }).setOptions({ workplaceId: testWorkplaceId });

            expect(interventions).toHaveLength(2);
        });

        it('should find interventions by patient', async () => {
            const interventions = await ClinicalIntervention.find({
                patientId: testPatientId
            }).setOptions({ workplaceId: testWorkplaceId });

            expect(interventions).toHaveLength(3);
            interventions.forEach(intervention => {
                expect(intervention.patientId.toString()).toBe(testPatientId.toString());
            });
        });

        it('should search interventions by text', async () => {
            const interventions = await ClinicalIntervention.find({
                $or: [
                    { interventionNumber: { $regex: 'CI-202412-0001', $options: 'i' } },
                    { issueDescription: { $regex: 'High priority', $options: 'i' } }
                ]
            }).setOptions({ workplaceId: testWorkplaceId });

            expect(interventions).toHaveLength(1);
            expect(interventions[0]?.interventionNumber).toBe('CI-202412-0001');
        });

        it('should sort interventions', async () => {
            const interventions = await ClinicalIntervention.find()
                .setOptions({ workplaceId: testWorkplaceId })
                .sort({ identifiedDate: -1 });

            expect(interventions).toHaveLength(3);
            expect(interventions[0]?.identifiedDate.getTime()).toBeGreaterThanOrEqual(
                interventions[1]?.identifiedDate.getTime() || 0
            );
            expect(interventions[1]?.identifiedDate.getTime()).toBeGreaterThanOrEqual(
                interventions[2]?.identifiedDate.getTime() || 0
            );
        });

        it('should paginate interventions', async () => {
            const page1 = await ClinicalIntervention.find()
                .setOptions({ workplaceId: testWorkplaceId })
                .sort({ identifiedDate: 1 })
                .limit(2)
                .skip(0);

            const page2 = await ClinicalIntervention.find()
                .setOptions({ workplaceId: testWorkplaceId })
                .sort({ identifiedDate: 1 })
                .limit(2)
                .skip(2);

            expect(page1).toHaveLength(2);
            expect(page2).toHaveLength(1);
            expect(page1[0]?._id.toString()).not.toBe(page2[0]?._id.toString());
        });

        it('should count interventions', async () => {
            const totalCount = await ClinicalIntervention.countDocuments()
                .setOptions({ workplaceId: testWorkplaceId });

            const activeCount = await ClinicalIntervention.countDocuments({
                status: { $in: ['identified', 'planning', 'in_progress', 'implemented'] }
            }).setOptions({ workplaceId: testWorkplaceId });

            const completedCount = await ClinicalIntervention.countDocuments({
                status: 'completed'
            }).setOptions({ workplaceId: testWorkplaceId });

            expect(totalCount).toBe(3);
            expect(activeCount).toBe(2);
            expect(completedCount).toBe(1);
        });
    });

    describe('Aggregation Operations', () => {
        beforeEach(async () => {
            // Create test data for aggregation
            await ClinicalIntervention.create([
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0001',
                    category: 'drug_therapy_problem',
                    priority: 'high',
                    issueDescription: 'Test intervention 1',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'completed',
                    outcomes: {
                        patientResponse: 'improved',
                        successMetrics: {
                            problemResolved: true,
                            medicationOptimized: true,
                            adherenceImproved: true,
                            costSavings: 500
                        }
                    }
                },
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0002',
                    category: 'drug_therapy_problem',
                    priority: 'medium',
                    issueDescription: 'Test intervention 2',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'completed',
                    outcomes: {
                        patientResponse: 'no_change',
                        successMetrics: {
                            problemResolved: false,
                            medicationOptimized: true,
                            adherenceImproved: false,
                            costSavings: 200
                        }
                    }
                },
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0003',
                    category: 'adverse_drug_reaction',
                    priority: 'critical',
                    issueDescription: 'Test intervention 3',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'in_progress'
                }
            ]);
        });

        it('should aggregate by category', async () => {
            const categoryStats = await ClinicalIntervention.aggregate([
                { $match: { workplaceId: testWorkplaceId, isDeleted: { $ne: true } } },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        avgPriority: {
                            $avg: {
                                $cond: [
                                    { $eq: ['$priority', 'critical'] }, 4,
                                    {
                                        $cond: [
                                            { $eq: ['$priority', 'high'] }, 3,
                                            {
                                                $cond: [
                                                    { $eq: ['$priority', 'medium'] }, 2, 1
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                },
                { $sort: { count: -1 } }
            ]);

            expect(categoryStats).toHaveLength(2);
            expect(categoryStats[0]?._id).toBe('drug_therapy_problem');
            expect(categoryStats[0]?.count).toBe(2);
            expect(categoryStats[1]?._id).toBe('adverse_drug_reaction');
            expect(categoryStats[1]?.count).toBe(1);
        });

        it('should aggregate by priority', async () => {
            const priorityStats = await ClinicalIntervention.aggregate([
                { $match: { workplaceId: testWorkplaceId, isDeleted: { $ne: true } } },
                {
                    $group: {
                        _id: '$priority',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ]);

            expect(priorityStats).toHaveLength(3);
            const priorities = priorityStats.map(stat => stat._id);
            expect(priorities).toContain('high');
            expect(priorities).toContain('medium');
            expect(priorities).toContain('critical');
        });

        it('should aggregate success metrics', async () => {
            const successStats = await ClinicalIntervention.aggregate([
                {
                    $match: {
                        workplaceId: testWorkplaceId,
                        isDeleted: { $ne: true },
                        status: 'completed',
                        'outcomes.successMetrics': { $exists: true }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalInterventions: { $sum: 1 },
                        problemsResolved: {
                            $sum: { $cond: ['$outcomes.successMetrics.problemResolved', 1, 0] }
                        },
                        medicationsOptimized: {
                            $sum: { $cond: ['$outcomes.successMetrics.medicationOptimized', 1, 0] }
                        },
                        totalCostSavings: { $sum: '$outcomes.successMetrics.costSavings' }
                    }
                }
            ]);

            expect(successStats).toHaveLength(1);
            expect(successStats[0]?.totalInterventions).toBe(2);
            expect(successStats[0]?.problemsResolved).toBe(1);
            expect(successStats[0]?.medicationsOptimized).toBe(2);
            expect(successStats[0]?.totalCostSavings).toBe(700);
        });

        it('should aggregate monthly trends', async () => {
            const monthlyTrends = await ClinicalIntervention.aggregate([
                { $match: { workplaceId: testWorkplaceId, isDeleted: { $ne: true } } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$identifiedDate' },
                            month: { $month: '$identifiedDate' }
                        },
                        total: { $sum: 1 },
                        completed: {
                            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                        }
                    }
                },
                {
                    $addFields: {
                        successRate: {
                            $cond: [
                                { $eq: ['$total', 0] },
                                0,
                                { $multiply: [{ $divide: ['$completed', '$total'] }, 100] }
                            ]
                        }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]);

            expect(monthlyTrends).toHaveLength(1);
            expect(monthlyTrends[0]?.total).toBe(3);
            expect(monthlyTrends[0]?.completed).toBe(2);
            expect(monthlyTrends[0]?.successRate).toBeCloseTo(66.67, 1);
        });
    });

    describe('Index Performance', () => {
        beforeEach(async () => {
            // Create multiple interventions for index testing
            const interventions = [];
            for (let i = 0; i < 100; i++) {
                interventions.push({
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: `CI-202412-${String(i + 1).padStart(4, '0')}`,
                    category: 'drug_therapy_problem',
                    priority: 'medium',
                    issueDescription: `Performance test intervention ${i + 1} with sufficient description length`,
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'identified',
                    identifiedDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
                });
            }
            await ClinicalIntervention.insertMany(interventions);
        });

        it('should use index for workplace queries', async () => {
            const startTime = Date.now();

            const interventions = await ClinicalIntervention.find()
                .setOptions({ workplaceId: testWorkplaceId })
                .limit(10);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(interventions).toHaveLength(10);
            expect(executionTime).toBeLessThan(100); // Should be very fast with index
        });

        it('should use index for patient queries', async () => {
            const startTime = Date.now();

            const interventions = await ClinicalIntervention.find({
                patientId: testPatientId
            }).setOptions({ workplaceId: testWorkplaceId });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(interventions).toHaveLength(100);
            expect(executionTime).toBeLessThan(200); // Should be fast with compound index
        });

        it('should use index for status queries', async () => {
            const startTime = Date.now();

            const interventions = await ClinicalIntervention.find({
                status: 'identified'
            }).setOptions({ workplaceId: testWorkplaceId });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(interventions).toHaveLength(100);
            expect(executionTime).toBeLessThan(200); // Should be fast with compound index
        });

        it('should use index for date range queries', async () => {
            const startTime = Date.now();

            const interventions = await ClinicalIntervention.find({
                identifiedDate: {
                    $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                    $lte: new Date()
                }
            }).setOptions({ workplaceId: testWorkplaceId });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(interventions.length).toBeGreaterThan(0);
            expect(executionTime).toBeLessThan(200); // Should be fast with index
        });
    });

    describe('Static Methods', () => {
        beforeEach(async () => {
            // Create test interventions for static method testing
            await ClinicalIntervention.create([
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0001',
                    category: 'drug_therapy_problem',
                    priority: 'high',
                    issueDescription: 'Active intervention 1',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'in_progress',
                    startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
                },
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0002',
                    category: 'adverse_drug_reaction',
                    priority: 'critical',
                    issueDescription: 'Overdue critical intervention',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'identified',
                    startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
                },
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0003',
                    category: 'medication_nonadherence',
                    priority: 'medium',
                    issueDescription: 'Completed intervention',
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'completed',
                    completedAt: new Date()
                }
            ]);
        });

        it('should find active interventions', async () => {
            const activeInterventions = await (ClinicalIntervention as any).findActive(testWorkplaceId);

            expect(activeInterventions).toHaveLength(2);
            activeInterventions.forEach((intervention: IClinicalIntervention) => {
                expect(['identified', 'planning', 'in_progress', 'implemented']).toContain(intervention.status);
            });
        });

        it('should find overdue interventions', async () => {
            const overdueInterventions = await (ClinicalIntervention as any).findOverdue(testWorkplaceId);

            expect(overdueInterventions.length).toBeGreaterThan(0);
            overdueInterventions.forEach((intervention: IClinicalIntervention) => {
                expect(['identified', 'planning', 'in_progress', 'implemented']).toContain(intervention.status);
            });
        });

        it('should find interventions by patient', async () => {
            const patientInterventions = await (ClinicalIntervention as any).findByPatient(
                testPatientId,
                testWorkplaceId
            );

            expect(patientInterventions).toHaveLength(3);
            patientInterventions.forEach((intervention: IClinicalIntervention) => {
                expect(intervention.patientId.toString()).toBe(testPatientId.toString());
            });
        });

        it('should generate next intervention number', async () => {
            const nextNumber = await (ClinicalIntervention as any).generateNextInterventionNumber(testWorkplaceId);

            expect(nextNumber).toMatch(/^CI-\d{6}-\d{4}$/);
            expect(nextNumber).toContain('0004'); // Should be next in sequence
        });

        it('should generate sequential intervention numbers', async () => {
            const number1 = await (ClinicalIntervention as any).generateNextInterventionNumber(testWorkplaceId);
            const number2 = await (ClinicalIntervention as any).generateNextInterventionNumber(testWorkplaceId);

            expect(number1).toMatch(/^CI-\d{6}-\d{4}$/);
            expect(number2).toMatch(/^CI-\d{6}-\d{4}$/);

            const seq1 = parseInt(number1.split('-')[2] || '0');
            const seq2 = parseInt(number2.split('-')[2] || '0');
            expect(seq2).toBe(seq1 + 1);
        });
    });

    describe('Tenancy and Security', () => {
        let otherWorkplaceId: mongoose.Types.ObjectId;

        beforeEach(async () => {
            otherWorkplaceId = new mongoose.Types.ObjectId();

            // Create interventions for different workplaces
            await ClinicalIntervention.create([
                {
                    workplaceId: testWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0001',
                    category: 'drug_therapy_problem',
                    priority: 'high',
                    issueDescription: 'Intervention for test workplace',
                    identifiedBy: testUserId,
                    createdBy: testUserId
                },
                {
                    workplaceId: otherWorkplaceId,
                    patientId: testPatientId,
                    interventionNumber: 'CI-202412-0002',
                    category: 'adverse_drug_reaction',
                    priority: 'critical',
                    issueDescription: 'Intervention for other workplace',
                    identifiedBy: testUserId,
                    createdBy: testUserId
                }
            ]);
        });

        it('should enforce tenancy filtering', async () => {
            const interventions = await ClinicalIntervention.find()
                .setOptions({ workplaceId: testWorkplaceId });

            expect(interventions).toHaveLength(1);
            expect(interventions[0]?.workplaceId.toString()).toBe(testWorkplaceId.toString());
        });

        it('should not return interventions from other workplaces', async () => {
            const interventions = await ClinicalIntervention.find()
                .setOptions({ workplaceId: otherWorkplaceId });

            expect(interventions).toHaveLength(1);
            expect(interventions[0]?.workplaceId.toString()).toBe(otherWorkplaceId.toString());
        });

        it('should filter soft-deleted interventions', async () => {
            // Soft delete one intervention
            await ClinicalIntervention.findOneAndUpdate(
                { workplaceId: testWorkplaceId },
                { isDeleted: true }
            );

            const interventions = await ClinicalIntervention.find()
                .setOptions({ workplaceId: testWorkplaceId });

            expect(interventions).toHaveLength(0); // Should not find soft-deleted intervention
        });

        it('should bypass tenancy guard when specified', async () => {
            const allInterventions = await ClinicalIntervention.find({}, {}, {
                bypassTenancyGuard: true
            });

            expect(allInterventions).toHaveLength(2); // Should find interventions from both workplaces
        });
    });

    describe('Data Validation', () => {
        it('should validate required fields', async () => {
            const invalidIntervention = new ClinicalIntervention({
                // Missing required fields
            });

            await expect(invalidIntervention.save()).rejects.toThrow();
        });

        it('should validate intervention number format', async () => {
            const invalidIntervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'INVALID-FORMAT',
                category: 'drug_therapy_problem',
                priority: 'high',
                issueDescription: 'Test intervention with invalid number format',
                identifiedBy: testUserId,
                createdBy: testUserId
            });

            await expect(invalidIntervention.save()).rejects.toThrow(/Invalid intervention number format/);
        });

        it('should validate issue description length', async () => {
            const invalidIntervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem',
                priority: 'high',
                issueDescription: 'Short', // Too short
                identifiedBy: testUserId,
                createdBy: testUserId
            });

            await expect(invalidIntervention.save()).rejects.toThrow(/Issue description must be at least 10 characters/);
        });

        it('should validate enum values', async () => {
            const invalidIntervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'invalid_category' as any,
                priority: 'high',
                issueDescription: 'Test intervention with invalid category',
                identifiedBy: testUserId,
                createdBy: testUserId
            });

            await expect(invalidIntervention.save()).rejects.toThrow();
        });

        it('should validate strategy fields', async () => {
            const invalidIntervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem',
                priority: 'high',
                issueDescription: 'Test intervention with invalid strategy',
                identifiedBy: testUserId,
                createdBy: testUserId,
                strategies: [{
                    type: 'dose_adjustment',
                    description: '', // Empty description
                    rationale: 'Valid rationale',
                    expectedOutcome: 'Valid expected outcome that meets minimum length requirements',
                    priority: 'primary'
                }]
            });

            await expect(invalidIntervention.save()).rejects.toThrow();
        });

        it('should validate assignment fields', async () => {
            const invalidIntervention = new ClinicalIntervention({
                workplaceId: testWorkplaceId,
                patientId: testPatientId,
                interventionNumber: 'CI-202412-0001',
                category: 'drug_therapy_problem',
                priority: 'high',
                issueDescription: 'Test intervention with invalid assignment',
                identifiedBy: testUserId,
                createdBy: testUserId,
                assignments: [{
                    userId: testUserId,
                    role: 'invalid_role' as any,
                    task: 'Valid task',
                    status: 'pending',
                    assignedAt: new Date()
                }]
            });

            await expect(invalidIntervention.save()).rejects.toThrow();
        });
    });
});