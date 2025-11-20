import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import ClinicalIntervention from '../../models/ClinicalIntervention';
import ClinicalInterventionService from '../../services/clinicalInterventionService';
import Patient from '../../models/Patient';
import User from '../../models/User';
import Workplace from '../../models/Workplace';

describe('Clinical Intervention Performance Tests', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplaceId: mongoose.Types.ObjectId;
    let testUserId: mongoose.Types.ObjectId;
    let testPatientIds: mongoose.Types.ObjectId[];

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
        testPatientIds = [];

        // Create test workplace
        await Workplace.create({
            _id: testWorkplaceId,
            name: 'Performance Test Pharmacy',
            type: 'pharmacy',
            address: '123 Performance St',
            phone: '+2348012345678',
            email: 'performance@pharmacy.com',
            createdBy: testUserId
        });

        // Create test user
        await User.create({
            _id: testUserId,
            firstName: 'Performance',
            lastName: 'Tester',
            email: 'performance@test.com',
            password: 'hashedpassword',
            role: 'pharmacist',
            workplaceId: testWorkplaceId,
            isEmailVerified: true,
            createdBy: testUserId
        });

        // Create multiple test patients
        const patients = [];
        for (let i = 0; i < 50; i++) {
            const patientId = new mongoose.Types.ObjectId();
            testPatientIds.push(patientId);
            patients.push({
                _id: patientId,
                workplaceId: testWorkplaceId,
                firstName: `Patient${i}`,
                lastName: `Test${i}`,
                mrn: `MRN${String(i).padStart(6, '0')}`,
                dob: new Date(1980 + (i % 40), (i % 12), (i % 28) + 1),
                phone: `+234801234${String(i).padStart(4, '0')}`,
                email: `patient${i}@test.com`,
                createdBy: testUserId
            });
        }
        await Patient.insertMany(patients);
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

    describe('Large Dataset Performance', () => {
        beforeEach(async () => {
            // Create large dataset for performance testing
            const interventions = [];
            const categories = ['drug_therapy_problem', 'adverse_drug_reaction', 'medication_nonadherence', 'drug_interaction', 'dosing_issue'];
            const priorities = ['low', 'medium', 'high', 'critical'];
            const statuses = ['identified', 'planning', 'in_progress', 'implemented', 'completed'];

            for (let i = 0; i < 1000; i++) {
                interventions.push({
                    workplaceId: testWorkplaceId,
                    patientId: testPatientIds[i % testPatientIds.length],
                    interventionNumber: `CI-202412-${String(i + 1).padStart(4, '0')}`,
                    category: categories[i % categories.length],
                    priority: priorities[i % priorities.length],
                    issueDescription: `Performance test intervention ${i + 1} with sufficient description length for validation requirements`,
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: statuses[i % statuses.length],
                    identifiedDate: new Date(Date.now() - (i * 60 * 60 * 1000)), // Spread over time
                    startedAt: new Date(Date.now() - (i * 60 * 60 * 1000)),
                    completedAt: i % 5 === 4 ? new Date(Date.now() - ((i - 1) * 60 * 60 * 1000)) : undefined
                });
            }

            console.log('Creating 1000 test interventions...');
            const startTime = Date.now();
            await ClinicalIntervention.insertMany(interventions);
            const endTime = Date.now();
            console.log(`Created 1000 interventions in ${endTime - startTime}ms`);
        });

        it('should handle large result set queries efficiently', async () => {
            const startTime = Date.now();

            const result = await ClinicalInterventionService.getInterventions({
                workplaceId: testWorkplaceId,
                page: 1,
                limit: 100
            });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(result.data).toHaveLength(100);
            expect(result.pagination.total).toBe(1000);
            expect(executionTime).toBeLessThan(1000); // Should complete within 1 second

            console.log(`Large result set query completed in ${executionTime}ms`);
        });

        it('should handle complex filtering efficiently', async () => {
            const startTime = Date.now();

            const result = await ClinicalInterventionService.getInterventions({
                workplaceId: testWorkplaceId,
                category: 'drug_therapy_problem',
                priority: 'high',
                status: 'completed',
                dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                dateTo: new Date(),
                sortBy: 'identifiedDate',
                sortOrder: 'desc',
                page: 1,
                limit: 50
            });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(result.data.length).toBeGreaterThan(0);
            expect(executionTime).toBeLessThan(1000); // Should complete within 1 second

            console.log(`Complex filtering query completed in ${executionTime}ms`);
        });

        it('should handle text search efficiently', async () => {
            const startTime = Date.now();

            const result = await ClinicalInterventionService.getInterventions({
                workplaceId: testWorkplaceId,
                search: 'Performance test',
                page: 1,
                limit: 50
            });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(result.data.length).toBeGreaterThan(0);
            expect(executionTime).toBeLessThan(2000); // Text search may be slower

            console.log(`Text search query completed in ${executionTime}ms`);
        });

        it('should handle aggregation queries efficiently', async () => {
            const startTime = Date.now();

            const categoryStats = await ClinicalIntervention.aggregate([
                { $match: { workplaceId: testWorkplaceId, isDeleted: { $ne: true } } },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        completedCount: {
                            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                        }
                    }
                },
                {
                    $addFields: {
                        completionRate: {
                            $cond: [
                                { $eq: ['$count', 0] },
                                0,
                                { $multiply: [{ $divide: ['$completedCount', '$count'] }, 100] }
                            ]
                        }
                    }
                },
                { $sort: { count: -1 } }
            ]);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(categoryStats.length).toBeGreaterThan(0);
            expect(executionTime).toBeLessThan(1000); // Should complete within 1 second

            console.log(`Aggregation query completed in ${executionTime}ms`);
        });

        it('should handle patient-specific queries efficiently', async () => {
            const testPatientId = testPatientIds[0];
            const startTime = Date.now();

            const summary = await ClinicalInterventionService.getPatientInterventionSummary(
                testPatientId,
                testWorkplaceId
            );

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(summary.totalInterventions).toBeGreaterThan(0);
            expect(executionTime).toBeLessThan(500); // Should be very fast with patient index

            console.log(`Patient summary query completed in ${executionTime}ms`);
        });

        it('should handle concurrent queries efficiently', async () => {
            const startTime = Date.now();

            // Simulate concurrent queries
            const queries = [];
            for (let i = 0; i < 10; i++) {
                queries.push(
                    ClinicalInterventionService.getInterventions({
                        workplaceId: testWorkplaceId,
                        page: i + 1,
                        limit: 10
                    })
                );
            }

            const results = await Promise.all(queries);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(results).toHaveLength(10);
            results.forEach(result => {
                expect(result.data).toHaveLength(10);
            });
            expect(executionTime).toBeLessThan(2000); // Should handle concurrent queries efficiently

            console.log(`10 concurrent queries completed in ${executionTime}ms`);
        });
    });

    describe('Index Utilization', () => {
        beforeEach(async () => {
            // Create test data for index testing
            const interventions = [];
            for (let i = 0; i < 500; i++) {
                interventions.push({
                    workplaceId: testWorkplaceId,
                    patientId: testPatientIds[i % testPatientIds.length],
                    interventionNumber: `CI-202412-${String(i + 1).padStart(4, '0')}`,
                    category: 'drug_therapy_problem',
                    priority: 'medium',
                    issueDescription: `Index test intervention ${i + 1} with sufficient description length`,
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'identified',
                    identifiedDate: new Date(Date.now() - (i * 60 * 60 * 1000))
                });
            }
            await ClinicalIntervention.insertMany(interventions);
        });

        it('should use compound index for workplace + patient queries', async () => {
            const testPatientId = testPatientIds[0];
            const startTime = Date.now();

            const interventions = await ClinicalIntervention.find({
                patientId: testPatientId
            }).setOptions({ workplaceId: testWorkplaceId });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(interventions.length).toBeGreaterThan(0);
            expect(executionTime).toBeLessThan(50); // Should be very fast with compound index

            console.log(`Compound index query completed in ${executionTime}ms`);
        });

        it('should use compound index for workplace + status queries', async () => {
            const startTime = Date.now();

            const interventions = await ClinicalIntervention.find({
                status: 'identified'
            }).setOptions({ workplaceId: testWorkplaceId });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(interventions).toHaveLength(500);
            expect(executionTime).toBeLessThan(100); // Should be fast with compound index

            console.log(`Status index query completed in ${executionTime}ms`);
        });

        it('should use index for date range queries', async () => {
            const startTime = Date.now();

            const interventions = await ClinicalIntervention.find({
                identifiedDate: {
                    $gte: new Date(Date.now() - 100 * 60 * 60 * 1000),
                    $lte: new Date()
                }
            }).setOptions({ workplaceId: testWorkplaceId });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(interventions.length).toBeGreaterThan(0);
            expect(executionTime).toBeLessThan(100); // Should be fast with date index

            console.log(`Date range index query completed in ${executionTime}ms`);
        });

        it('should use index for intervention number queries', async () => {
            const startTime = Date.now();

            const intervention = await ClinicalIntervention.findOne({
                interventionNumber: 'CI-202412-0001'
            }).setOptions({ workplaceId: testWorkplaceId });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(intervention).toBeDefined();
            expect(executionTime).toBeLessThan(20); // Should be very fast with unique index

            console.log(`Intervention number index query completed in ${executionTime}ms`);
        });
    });

    describe('Memory Usage', () => {
        it('should handle large result sets without excessive memory usage', async () => {
            // Create large dataset
            const interventions = [];
            for (let i = 0; i < 2000; i++) {
                interventions.push({
                    workplaceId: testWorkplaceId,
                    patientId: testPatientIds[i % testPatientIds.length],
                    interventionNumber: `CI-202412-${String(i + 1).padStart(4, '0')}`,
                    category: 'drug_therapy_problem',
                    priority: 'medium',
                    issueDescription: `Memory test intervention ${i + 1} with sufficient description length for validation`,
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'identified'
                });
            }
            await ClinicalIntervention.insertMany(interventions);

            const initialMemory = process.memoryUsage().heapUsed;

            // Query with pagination to avoid loading all data at once
            const result = await ClinicalInterventionService.getInterventions({
                workplaceId: testWorkplaceId,
                page: 1,
                limit: 100
            });

            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;

            expect(result.data).toHaveLength(100);
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Should not increase by more than 50MB

            console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
        });

        it('should handle streaming large datasets efficiently', async () => {
            // Create large dataset
            const interventions = [];
            for (let i = 0; i < 1000; i++) {
                interventions.push({
                    workplaceId: testWorkplaceId,
                    patientId: testPatientIds[i % testPatientIds.length],
                    interventionNumber: `CI-202412-${String(i + 1).padStart(4, '0')}`,
                    category: 'drug_therapy_problem',
                    priority: 'medium',
                    issueDescription: `Streaming test intervention ${i + 1} with sufficient description length`,
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'identified'
                });
            }
            await ClinicalIntervention.insertMany(interventions);

            const initialMemory = process.memoryUsage().heapUsed;
            let processedCount = 0;

            // Use cursor for streaming
            const cursor = ClinicalIntervention.find()
                .setOptions({ workplaceId: testWorkplaceId })
                .cursor();

            const startTime = Date.now();

            for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
                processedCount++;
                // Simulate processing
                expect(doc._id).toBeDefined();
            }

            const endTime = Date.now();
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            const executionTime = endTime - startTime;

            expect(processedCount).toBe(1000);
            expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Should not increase by more than 20MB
            expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds

            console.log(`Streamed ${processedCount} documents in ${executionTime}ms with ${Math.round(memoryIncrease / 1024 / 1024)}MB memory increase`);
        });
    });

    describe('Bulk Operations Performance', () => {
        it('should handle bulk inserts efficiently', async () => {
            const interventions = [];
            for (let i = 0; i < 1000; i++) {
                interventions.push({
                    workplaceId: testWorkplaceId,
                    patientId: testPatientIds[i % testPatientIds.length],
                    interventionNumber: `CI-202412-${String(i + 1).padStart(4, '0')}`,
                    category: 'drug_therapy_problem',
                    priority: 'medium',
                    issueDescription: `Bulk insert test intervention ${i + 1} with sufficient description length`,
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'identified'
                });
            }

            const startTime = Date.now();
            await ClinicalIntervention.insertMany(interventions);
            const endTime = Date.now();
            const executionTime = endTime - startTime;

            const count = await ClinicalIntervention.countDocuments()
                .setOptions({ workplaceId: testWorkplaceId });

            expect(count).toBe(1000);
            expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds

            console.log(`Bulk inserted 1000 interventions in ${executionTime}ms`);
        });

        it('should handle bulk updates efficiently', async () => {
            // Create test data
            const interventions = [];
            for (let i = 0; i < 500; i++) {
                interventions.push({
                    workplaceId: testWorkplaceId,
                    patientId: testPatientIds[i % testPatientIds.length],
                    interventionNumber: `CI-202412-${String(i + 1).padStart(4, '0')}`,
                    category: 'drug_therapy_problem',
                    priority: 'medium',
                    issueDescription: `Bulk update test intervention ${i + 1} with sufficient description length`,
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'identified'
                });
            }
            await ClinicalIntervention.insertMany(interventions);

            const startTime = Date.now();

            // Bulk update status
            const result = await ClinicalIntervention.updateMany(
                { status: 'identified' },
                {
                    $set: {
                        status: 'planning',
                        updatedBy: testUserId,
                        updatedAt: new Date()
                    }
                },
                { workplaceId: testWorkplaceId }
            );

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(result.modifiedCount).toBe(500);
            expect(executionTime).toBeLessThan(1000); // Should complete within 1 second

            console.log(`Bulk updated 500 interventions in ${executionTime}ms`);
        });

        it('should handle bulk deletes efficiently', async () => {
            // Create test data
            const interventions = [];
            for (let i = 0; i < 300; i++) {
                interventions.push({
                    workplaceId: testWorkplaceId,
                    patientId: testPatientIds[i % testPatientIds.length],
                    interventionNumber: `CI-202412-${String(i + 1).padStart(4, '0')}`,
                    category: 'drug_therapy_problem',
                    priority: 'low',
                    issueDescription: `Bulk delete test intervention ${i + 1} with sufficient description length`,
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'cancelled'
                });
            }
            await ClinicalIntervention.insertMany(interventions);

            const startTime = Date.now();

            // Bulk soft delete cancelled interventions
            const result = await ClinicalIntervention.updateMany(
                { status: 'cancelled' },
                {
                    $set: {
                        isDeleted: true,
                        updatedBy: testUserId,
                        updatedAt: new Date()
                    }
                },
                { workplaceId: testWorkplaceId }
            );

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(result.modifiedCount).toBe(300);
            expect(executionTime).toBeLessThan(500); // Should complete within 500ms

            console.log(`Bulk soft deleted 300 interventions in ${executionTime}ms`);
        });
    });

    describe('Service Layer Performance', () => {
        beforeEach(async () => {
            // Create test data for service layer testing
            const interventions = [];
            for (let i = 0; i < 200; i++) {
                interventions.push({
                    workplaceId: testWorkplaceId,
                    patientId: testPatientIds[i % testPatientIds.length],
                    interventionNumber: `CI-202412-${String(i + 1).padStart(4, '0')}`,
                    category: 'drug_therapy_problem',
                    priority: 'medium',
                    issueDescription: `Service layer test intervention ${i + 1} with sufficient description length`,
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'identified'
                });
            }
            await ClinicalIntervention.insertMany(interventions);
        });

        it('should handle service layer queries efficiently', async () => {
            const startTime = Date.now();

            const result = await ClinicalInterventionService.getInterventions({
                workplaceId: testWorkplaceId,
                category: 'drug_therapy_problem',
                page: 1,
                limit: 50
            });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(result.data).toHaveLength(50);
            expect(result.pagination.total).toBe(200);
            expect(executionTime).toBeLessThan(500); // Should complete within 500ms

            console.log(`Service layer query completed in ${executionTime}ms`);
        });

        it('should handle patient summary efficiently', async () => {
            const testPatientId = testPatientIds[0];
            const startTime = Date.now();

            const summary = await ClinicalInterventionService.getPatientInterventionSummary(
                testPatientId,
                testWorkplaceId
            );

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(summary.totalInterventions).toBeGreaterThan(0);
            expect(executionTime).toBeLessThan(200); // Should complete within 200ms

            console.log(`Patient summary completed in ${executionTime}ms`);
        });

        it('should handle duplicate checking efficiently', async () => {
            const testPatientId = testPatientIds[0];
            const startTime = Date.now();

            const duplicates = await ClinicalInterventionService.checkDuplicateInterventions(
                testPatientId,
                'drug_therapy_problem',
                testWorkplaceId
            );

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(Array.isArray(duplicates)).toBe(true);
            expect(executionTime).toBeLessThan(100); // Should complete within 100ms

            console.log(`Duplicate check completed in ${executionTime}ms`);
        });

        it('should handle patient search efficiently', async () => {
            const startTime = Date.now();

            const results = await ClinicalInterventionService.searchPatientsWithInterventions(
                'Patient',
                testWorkplaceId,
                10
            );

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(results.length).toBeGreaterThan(0);
            expect(executionTime).toBeLessThan(300); // Should complete within 300ms

            console.log(`Patient search completed in ${executionTime}ms`);
        });
    });

    describe('Stress Testing', () => {
        it('should handle high concurrent load', async () => {
            // Create base data
            const interventions = [];
            for (let i = 0; i < 100; i++) {
                interventions.push({
                    workplaceId: testWorkplaceId,
                    patientId: testPatientIds[i % testPatientIds.length],
                    interventionNumber: `CI-202412-${String(i + 1).padStart(4, '0')}`,
                    category: 'drug_therapy_problem',
                    priority: 'medium',
                    issueDescription: `Stress test intervention ${i + 1} with sufficient description length`,
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'identified'
                });
            }
            await ClinicalIntervention.insertMany(interventions);

            const startTime = Date.now();

            // Simulate high concurrent load
            const promises = [];
            for (let i = 0; i < 50; i++) {
                promises.push(
                    ClinicalInterventionService.getInterventions({
                        workplaceId: testWorkplaceId,
                        page: (i % 5) + 1,
                        limit: 10
                    })
                );
            }

            const results = await Promise.all(promises);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(results).toHaveLength(50);
            results.forEach(result => {
                expect(result.data.length).toBeGreaterThan(0);
            });
            expect(executionTime).toBeLessThan(5000); // Should handle load within 5 seconds

            console.log(`Handled 50 concurrent requests in ${executionTime}ms`);
        });

        it('should maintain performance under memory pressure', async () => {
            // Create large dataset to simulate memory pressure
            const largeInterventions = [];
            for (let i = 0; i < 3000; i++) {
                largeInterventions.push({
                    workplaceId: testWorkplaceId,
                    patientId: testPatientIds[i % testPatientIds.length],
                    interventionNumber: `CI-202412-${String(i + 1).padStart(4, '0')}`,
                    category: 'drug_therapy_problem',
                    priority: 'medium',
                    issueDescription: `Memory pressure test intervention ${i + 1} with very long description that contains lots of text to simulate larger document sizes and memory usage patterns in real world scenarios`,
                    identifiedBy: testUserId,
                    createdBy: testUserId,
                    status: 'identified',
                    strategies: [{
                        type: 'dose_adjustment',
                        description: 'Detailed strategy description with lots of text',
                        rationale: 'Comprehensive rationale explaining the clinical reasoning behind this intervention strategy',
                        expectedOutcome: 'Expected outcome with detailed explanation of what we hope to achieve with this intervention',
                        priority: 'primary'
                    }],
                    implementationNotes: 'Detailed implementation notes with comprehensive information about how this intervention should be carried out'
                });
            }

            console.log('Creating large dataset for memory pressure test...');
            await ClinicalIntervention.insertMany(largeInterventions);

            const startTime = Date.now();

            // Perform queries under memory pressure
            const result = await ClinicalInterventionService.getInterventions({
                workplaceId: testWorkplaceId,
                page: 1,
                limit: 100
            });

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            expect(result.data).toHaveLength(100);
            expect(executionTime).toBeLessThan(2000); // Should maintain performance under pressure

            console.log(`Query under memory pressure completed in ${executionTime}ms`);
        });
    });
});