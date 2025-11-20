/**
 * Load Testing Suite for Manual Lab Order Workflow
 * Tests concurrent user scenarios and performance under load
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../../app';
import { ManualLabOrder } from '../models/ManualLabOrder';
import { TestCatalog } from '../models/TestCatalog';
import { Workplace } from '../../../models/Workplace';
import { User } from '../../../models/User';
import { Patient } from '../../../models/Patient';

describe('Manual Lab Module - Load Testing', () => {
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testUser: any;
    let testPatient: any;
    let authToken: string;
    let testCatalogItems: any[];

    beforeAll(async () => {
        // Start MongoDB Memory Server
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Load Test Pharmacy',
            address: '123 Test Street',
            phone: '+1234567890',
            email: 'loadtest@pharmacy.com',
            licenseNumber: 'LT123456',
            isActive: true
        });

        // Create test user (pharmacist)
        testUser = await User.create({
            firstName: 'Load',
            lastName: 'Tester',
            email: 'loadtester@pharmacy.com',
            password: 'hashedpassword123',
            role: 'pharmacist',
            workplace: testWorkplace._id,
            isActive: true
        });

        // Create test patient
        testPatient = await Patient.create({
            firstName: 'Load',
            lastName: 'Patient',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'male',
            phone: '+1234567890',
            email: 'loadpatient@test.com',
            address: {
                street: '456 Patient Ave',
                city: 'Test City',
                state: 'TS',
                zipCode: '12345',
                country: 'Test Country'
            },
            workplace: testWorkplace._id
        });

        // Generate auth token
        authToken = jwt.sign(
            {
                userId: testUser._id,
                role: testUser.role,
                workplaceId: testWorkplace._id
            },
            process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-minimum-32-characters-long',
            { expiresIn: '1h' }
        );

        // Create test catalog items
        testCatalogItems = await TestCatalog.create([
            {
                code: 'CBC',
                name: 'Complete Blood Count',
                category: 'Hematology',
                specimenType: 'Blood',
                units: 'cells/μL',
                referenceRange: '4000-11000',
                cost: 25.00,
                isActive: true,
                workplace: testWorkplace._id
            },
            {
                code: 'BMP',
                name: 'Basic Metabolic Panel',
                category: 'Chemistry',
                specimenType: 'Blood',
                units: 'mg/dL',
                referenceRange: 'Various',
                cost: 35.00,
                isActive: true,
                workplace: testWorkplace._id
            }
        ]);
    });

    afterAll(async () => {
        await mongoose.connection.dropDatabase();
        await mongoose.connection.close();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clean up orders between tests
        await ManualLabOrder.deleteMany({});
    });

    describe('Concurrent Order Creation Load Test', () => {
        it('should handle 50 concurrent order creations without errors', async () => {
            const concurrentRequests = 50;
            const orderPromises: Promise<any>[] = [];

            // Create 50 concurrent order creation requests
            for (let i = 0; i < concurrentRequests; i++) {
                const orderData = {
                    patientId: testPatient._id,
                    tests: [testCatalogItems[0]._id],
                    indication: `Load test indication ${i}`,
                    priority: 'routine',
                    consentConfirmed: true
                };

                const promise = request(app)
                    .post('/api/manual-lab/orders')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(orderData)
                    .expect(201);

                orderPromises.push(promise);
            }

            // Wait for all requests to complete
            const startTime = Date.now();
            const responses = await Promise.all(orderPromises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Verify all orders were created successfully
            expect(responses).toHaveLength(concurrentRequests);
            responses.forEach(response => {
                expect(response.body.success).toBe(true);
                expect(response.body.data.orderId).toMatch(/^LAB-\d{4}-\d{4}$/);
            });

            // Verify performance (should complete within 30 seconds)
            expect(totalTime).toBeLessThan(30000);

            // Verify all orders exist in database
            const orderCount = await ManualLabOrder.countDocuments({});
            expect(orderCount).toBe(concurrentRequests);

            console.log(`✓ Created ${concurrentRequests} orders in ${totalTime}ms (avg: ${totalTime / concurrentRequests}ms per order)`);
        }, 60000);

        it('should handle concurrent PDF generation requests', async () => {
            // First create an order
            const orderData = {
                patientId: testPatient._id,
                tests: [testCatalogItems[0]._id],
                indication: 'PDF load test',
                priority: 'routine',
                consentConfirmed: true
            };

            const orderResponse = await request(app)
                .post('/api/manual-lab/orders')
                .set('Authorization', `Bearer ${authToken}`)
                .send(orderData)
                .expect(201);

            const orderId = orderResponse.body.data.orderId;

            // Create 20 concurrent PDF generation requests
            const concurrentPdfRequests = 20;
            const pdfPromises: Promise<any>[] = [];

            for (let i = 0; i < concurrentPdfRequests; i++) {
                const promise = request(app)
                    .get(`/api/manual-lab/orders/${orderId}/pdf`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .expect(200);

                pdfPromises.push(promise);
            }

            const startTime = Date.now();
            const responses = await Promise.all(pdfPromises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Verify all PDFs were generated successfully
            expect(responses).toHaveLength(concurrentPdfRequests);
            responses.forEach(response => {
                expect(response.headers['content-type']).toBe('application/pdf');
                expect(response.body.length).toBeGreaterThan(0);
            });

            // Performance check (should complete within 15 seconds)
            expect(totalTime).toBeLessThan(15000);

            console.log(`✓ Generated ${concurrentPdfRequests} PDFs in ${totalTime}ms (avg: ${totalTime / concurrentPdfRequests}ms per PDF)`);
        }, 30000);
    });

    describe('High Volume Data Processing', () => {
        it('should handle bulk order creation and processing', async () => {
            const bulkOrderCount = 100;
            const batchSize = 10;
            const batches = Math.ceil(bulkOrderCount / batchSize);

            let totalProcessingTime = 0;
            let successfulOrders = 0;

            for (let batch = 0; batch < batches; batch++) {
                const batchPromises: Promise<any>[] = [];
                const batchStartTime = Date.now();

                // Create batch of orders
                for (let i = 0; i < batchSize && (batch * batchSize + i) < bulkOrderCount; i++) {
                    const orderIndex = batch * batchSize + i;
                    const orderData = {
                        patientId: testPatient._id,
                        tests: [testCatalogItems[orderIndex % testCatalogItems.length]._id],
                        indication: `Bulk test order ${orderIndex}`,
                        priority: orderIndex % 3 === 0 ? 'urgent' : 'routine',
                        consentConfirmed: true
                    };

                    const promise = request(app)
                        .post('/api/manual-lab/orders')
                        .set('Authorization', `Bearer ${authToken}`)
                        .send(orderData);

                    batchPromises.push(promise);
                }

                const batchResponses = await Promise.all(batchPromises);
                const batchEndTime = Date.now();
                const batchTime = batchEndTime - batchStartTime;
                totalProcessingTime += batchTime;

                // Count successful orders in this batch
                batchResponses.forEach(response => {
                    if (response.status === 201) {
                        successfulOrders++;
                    }
                });

                console.log(`✓ Batch ${batch + 1}/${batches}: ${batchResponses.length} orders in ${batchTime}ms`);
            }

            // Verify results
            expect(successfulOrders).toBe(bulkOrderCount);

            const finalOrderCount = await ManualLabOrder.countDocuments({});
            expect(finalOrderCount).toBe(bulkOrderCount);

            const avgTimePerOrder = totalProcessingTime / bulkOrderCount;
            expect(avgTimePerOrder).toBeLessThan(1000); // Less than 1 second per order on average

            console.log(`✓ Processed ${bulkOrderCount} orders in ${totalProcessingTime}ms (avg: ${avgTimePerOrder}ms per order)`);
        }, 120000);

        it('should maintain performance with large result datasets', async () => {
            // Create multiple orders with results
            const orderCount = 50;
            const orders: any[] = [];

            // Create orders
            for (let i = 0; i < orderCount; i++) {
                const orderData = {
                    patientId: testPatient._id,
                    tests: [testCatalogItems[0]._id, testCatalogItems[1]._id],
                    indication: `Performance test order ${i}`,
                    priority: 'routine',
                    consentConfirmed: true
                };

                const response = await request(app)
                    .post('/api/manual-lab/orders')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(orderData)
                    .expect(201);

                orders.push(response.body.data);
            }

            // Add results to all orders
            const resultPromises: Promise<any>[] = [];
            const startTime = Date.now();

            orders.forEach(order => {
                const resultData = {
                    results: [
                        {
                            testId: testCatalogItems[0]._id,
                            value: '8500',
                            units: 'cells/μL',
                            interpretation: 'normal'
                        },
                        {
                            testId: testCatalogItems[1]._id,
                            value: '95',
                            units: 'mg/dL',
                            interpretation: 'normal'
                        }
                    ]
                };

                const promise = request(app)
                    .post(`/api/manual-lab/orders/${order.orderId}/results`)
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(resultData);

                resultPromises.push(promise);
            });

            const responses = await Promise.all(resultPromises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Verify all results were added successfully
            responses.forEach(response => {
                expect(response.status).toBe(200);
            });

            // Performance check
            const avgTimePerResult = totalTime / orderCount;
            expect(avgTimePerResult).toBeLessThan(2000); // Less than 2 seconds per result entry

            console.log(`✓ Added results to ${orderCount} orders in ${totalTime}ms (avg: ${avgTimePerResult}ms per result)`);
        }, 90000);
    });

    describe('Memory and Resource Management', () => {
        it('should not have memory leaks during extended operations', async () => {
            const initialMemory = process.memoryUsage();
            const operationCount = 200;

            // Perform many operations
            for (let i = 0; i < operationCount; i++) {
                const orderData = {
                    patientId: testPatient._id,
                    tests: [testCatalogItems[0]._id],
                    indication: `Memory test ${i}`,
                    priority: 'routine',
                    consentConfirmed: true
                };

                await request(app)
                    .post('/api/manual-lab/orders')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(orderData)
                    .expect(201);

                // Periodically force garbage collection if available
                if (i % 50 === 0 && global.gc) {
                    global.gc();
                }
            }

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
            const memoryIncreasePerOp = memoryIncrease / operationCount;

            // Memory increase should be reasonable (less than 1MB per operation)
            expect(memoryIncreasePerOp).toBeLessThan(1024 * 1024);

            console.log(`✓ Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB for ${operationCount} operations`);
            console.log(`✓ Average per operation: ${Math.round(memoryIncreasePerOp / 1024)}KB`);
        }, 60000);

        it('should handle database connection pooling efficiently', async () => {
            const concurrentConnections = 30;
            const operationsPerConnection = 5;

            const connectionPromises: Promise<any>[] = [];

            for (let i = 0; i < concurrentConnections; i++) {
                const promise = (async () => {
                    const operations: Promise<any>[] = [];

                    for (let j = 0; j < operationsPerConnection; j++) {
                        const orderData = {
                            patientId: testPatient._id,
                            tests: [testCatalogItems[0]._id],
                            indication: `Connection test ${i}-${j}`,
                            priority: 'routine',
                            consentConfirmed: true
                        };

                        const operation = request(app)
                            .post('/api/manual-lab/orders')
                            .set('Authorization', `Bearer ${authToken}`)
                            .send(orderData);

                        operations.push(operation);
                    }

                    return Promise.all(operations);
                })();

                connectionPromises.push(promise);
            }

            const startTime = Date.now();
            const results = await Promise.all(connectionPromises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Verify all operations completed successfully
            let totalOperations = 0;
            results.forEach(connectionResults => {
                connectionResults.forEach((response: any) => {
                    expect(response.status).toBe(201);
                    totalOperations++;
                });
            });

            expect(totalOperations).toBe(concurrentConnections * operationsPerConnection);

            // Performance should be reasonable
            const avgTimePerOperation = totalTime / totalOperations;
            expect(avgTimePerOperation).toBeLessThan(1000);

            console.log(`✓ ${totalOperations} operations across ${concurrentConnections} connections in ${totalTime}ms`);
            console.log(`✓ Average: ${avgTimePerOperation}ms per operation`);
        }, 45000);
    });

    describe('Error Handling Under Load', () => {
        it('should gracefully handle validation errors in bulk operations', async () => {
            const requestCount = 50;
            const promises: Promise<any>[] = [];

            // Mix of valid and invalid requests
            for (let i = 0; i < requestCount; i++) {
                const isValid = i % 3 !== 0; // 2/3 valid, 1/3 invalid

                const orderData = isValid ? {
                    patientId: testPatient._id,
                    tests: [testCatalogItems[0]._id],
                    indication: `Validation test ${i}`,
                    priority: 'routine',
                    consentConfirmed: true
                } : {
                    // Invalid data - missing required fields
                    patientId: testPatient._id,
                    tests: [],
                    indication: '',
                    priority: 'invalid_priority',
                    consentConfirmed: false
                };

                const promise = request(app)
                    .post('/api/manual-lab/orders')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(orderData);

                promises.push(promise);
            }

            const responses = await Promise.all(promises);

            let successCount = 0;
            let errorCount = 0;

            responses.forEach((response, index) => {
                const shouldBeValid = index % 3 !== 0;

                if (shouldBeValid) {
                    expect(response.status).toBe(201);
                    successCount++;
                } else {
                    expect(response.status).toBe(400);
                    errorCount++;
                }
            });

            console.log(`✓ Handled ${successCount} valid and ${errorCount} invalid requests successfully`);
        }, 30000);

        it('should maintain system stability during concurrent error scenarios', async () => {
            const errorScenarios = [
                // Invalid patient ID
                () => ({
                    patientId: new mongoose.Types.ObjectId(),
                    tests: [testCatalogItems[0]._id],
                    indication: 'Invalid patient test',
                    priority: 'routine',
                    consentConfirmed: true
                }),
                // Invalid test ID
                () => ({
                    patientId: testPatient._id,
                    tests: [new mongoose.Types.ObjectId()],
                    indication: 'Invalid test ID',
                    priority: 'routine',
                    consentConfirmed: true
                }),
                // Missing required fields
                () => ({
                    patientId: testPatient._id,
                    tests: [],
                    indication: '',
                    priority: 'routine',
                    consentConfirmed: false
                })
            ];

            const requestsPerScenario = 10;
            const allPromises: Promise<any>[] = [];

            errorScenarios.forEach((scenarioGenerator, scenarioIndex) => {
                for (let i = 0; i < requestsPerScenario; i++) {
                    const promise = request(app)
                        .post('/api/manual-lab/orders')
                        .set('Authorization', `Bearer ${authToken}`)
                        .send(scenarioGenerator());

                    allPromises.push(promise);
                }
            });

            const startTime = Date.now();
            const responses = await Promise.all(allPromises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // All should return appropriate error responses
            responses.forEach(response => {
                expect([400, 404]).toContain(response.status);
                expect(response.body.success).toBe(false);
            });

            // System should remain responsive
            expect(totalTime).toBeLessThan(20000);

            console.log(`✓ Handled ${responses.length} error scenarios in ${totalTime}ms`);
        }, 30000);
    });
});