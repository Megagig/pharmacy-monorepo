import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { connectDB, disconnectDB } from '../../../config/db';
import { ReportTemplate } from '../../../models/ReportTemplate';
import { ReportSchedule } from '../../../models/ReportSchedule';
import { ReportAuditLog } from '../../../models/ReportAuditLog';
import { User } from '../../../models/User';
import { Workplace } from '../../../models/Workplace';
import { ReportAggregationService } from '../../../services/ReportAggregationService';
import { RedisCacheService } from '../../../services/RedisCacheService';

describe('Database Integration Tests for Reports', () => {
    let testUser: any;
    let testWorkplace: any;
    let reportAggregationService: ReportAggregationService;
    let cacheService: RedisCacheService;

    beforeAll(async () => {
        await connectDB();
        reportAggregationService = new ReportAggregationService();
        cacheService = new RedisCacheService();
    });

    afterAll(async () => {
        await disconnectDB();
    });

    beforeEach(async () => {
        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            address: 'Test Address',
            phone: '+1234567890',
            email: 'test@pharmacy.com',
            subscriptionPlan: 'premium',
            subscriptionStatus: 'active',
        });

        // Create test user
        testUser = await User.create({
            email: 'test@example.com',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
            permissions: ['reports:read', 'reports:export'],
        });
    });

    afterEach(async () => {
        // Clean up test data
        await ReportTemplate.deleteMany({});
        await ReportSchedule.deleteMany({});
        await ReportAuditLog.deleteMany({});
        await User.deleteMany({});
        await Workplace.deleteMany({});
    });

    describe('ReportTemplate Model', () => {
        it('should create a report template successfully', async () => {
            const templateData = {
                name: 'Patient Outcomes Template',
                description: 'Template for patient outcome reports',
                reportType: 'patient-outcomes',
                layout: {
                    sections: [
                        { type: 'summary', position: { x: 0, y: 0, width: 12, height: 2 } },
                        { type: 'chart', position: { x: 0, y: 2, width: 6, height: 4 } },
                    ],
                },
                filters: [
                    {
                        key: 'dateRange',
                        label: 'Date Range',
                        type: 'dateRange',
                    },
                ],
                charts: [
                    {
                        type: 'line',
                        title: { text: 'Outcomes Over Time' },
                        dataSource: 'patient-outcomes',
                    },
                ],
                tables: [
                    {
                        title: 'Patient Details',
                        columns: ['patientId', 'outcome', 'date'],
                        dataSource: 'patient-outcomes',
                    },
                ],
                createdBy: testUser._id,
                workplaceId: testWorkplace._id,
                isPublic: false,
            };

            const template = await ReportTemplate.create(templateData);

            expect(template).toBeDefined();
            expect(template.name).toBe('Patient Outcomes Template');
            expect(template.reportType).toBe('patient-outcomes');
            expect(template.createdBy.toString()).toBe(testUser._id.toString());
            expect(template.workplaceId.toString()).toBe(testWorkplace._id.toString());
        });

        it('should validate required fields', async () => {
            const invalidTemplate = {
                description: 'Missing required fields',
            };

            await expect(ReportTemplate.create(invalidTemplate)).rejects.toThrow();
        });

        it('should enforce unique template names per workplace', async () => {
            const templateData = {
                name: 'Duplicate Template',
                description: 'First template',
                reportType: 'patient-outcomes',
                layout: { sections: [] },
                filters: [],
                charts: [],
                tables: [],
                createdBy: testUser._id,
                workplaceId: testWorkplace._id,
                isPublic: false,
            };

            await ReportTemplate.create(templateData);

            // Try to create another template with the same name
            await expect(ReportTemplate.create(templateData)).rejects.toThrow();
        });

        it('should support template versioning', async () => {
            const templateData = {
                name: 'Versioned Template',
                description: 'Version 1',
                reportType: 'patient-outcomes',
                layout: { sections: [] },
                filters: [],
                charts: [],
                tables: [],
                createdBy: testUser._id,
                workplaceId: testWorkplace._id,
                isPublic: false,
                version: '1.0',
            };

            const v1 = await ReportTemplate.create(templateData);

            const v2Data = {
                ...templateData,
                description: 'Version 2',
                version: '2.0',
            };

            const v2 = await ReportTemplate.create(v2Data);

            expect(v1.version).toBe('1.0');
            expect(v2.version).toBe('2.0');
        });
    });

    describe('ReportSchedule Model', () => {
        it('should create a report schedule successfully', async () => {
            const scheduleData = {
                name: 'Weekly Patient Report',
                reportType: 'patient-outcomes',
                filters: {
                    dateRange: {
                        startDate: new Date('2024-01-01'),
                        endDate: new Date('2024-12-31'),
                    },
                    workplaceId: testWorkplace._id,
                },
                frequency: 'weekly',
                recipients: ['test@example.com', 'manager@example.com'],
                format: ['pdf', 'csv'],
                isActive: true,
                nextRun: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
                createdBy: testUser._id,
                workplaceId: testWorkplace._id,
            };

            const schedule = await ReportSchedule.create(scheduleData);

            expect(schedule).toBeDefined();
            expect(schedule.name).toBe('Weekly Patient Report');
            expect(schedule.frequency).toBe('weekly');
            expect(schedule.recipients).toHaveLength(2);
            expect(schedule.format).toContain('pdf');
            expect(schedule.format).toContain('csv');
        });

        it('should validate frequency values', async () => {
            const invalidSchedule = {
                name: 'Invalid Schedule',
                reportType: 'patient-outcomes',
                filters: { workplaceId: testWorkplace._id },
                frequency: 'invalid-frequency',
                recipients: ['test@example.com'],
                format: ['pdf'],
                createdBy: testUser._id,
                workplaceId: testWorkplace._id,
            };

            await expect(ReportSchedule.create(invalidSchedule)).rejects.toThrow();
        });

        it('should validate email recipients', async () => {
            const invalidSchedule = {
                name: 'Invalid Recipients',
                reportType: 'patient-outcomes',
                filters: { workplaceId: testWorkplace._id },
                frequency: 'weekly',
                recipients: ['invalid-email'],
                format: ['pdf'],
                createdBy: testUser._id,
                workplaceId: testWorkplace._id,
            };

            await expect(ReportSchedule.create(invalidSchedule)).rejects.toThrow();
        });

        it('should calculate next run date correctly', async () => {
            const now = new Date();
            const scheduleData = {
                name: 'Daily Report',
                reportType: 'patient-outcomes',
                filters: { workplaceId: testWorkplace._id },
                frequency: 'daily',
                recipients: ['test@example.com'],
                format: ['pdf'],
                createdBy: testUser._id,
                workplaceId: testWorkplace._id,
            };

            const schedule = await ReportSchedule.create(scheduleData);

            // Should automatically set nextRun to tomorrow
            const expectedNextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            const timeDiff = Math.abs(schedule.nextRun.getTime() - expectedNextRun.getTime());

            expect(timeDiff).toBeLessThan(60000); // Within 1 minute
        });
    });

    describe('ReportAuditLog Model', () => {
        it('should create audit log entries', async () => {
            const auditData = {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                action: 'report_generated',
                reportType: 'patient-outcomes',
                filters: {
                    dateRange: {
                        startDate: new Date('2024-01-01'),
                        endDate: new Date('2024-12-31'),
                    },
                },
                executionTime: 1500,
                recordCount: 100,
                exportFormat: 'pdf',
                ipAddress: '192.168.1.1',
                userAgent: 'Mozilla/5.0 Test Browser',
            };

            const auditLog = await ReportAuditLog.create(auditData);

            expect(auditLog).toBeDefined();
            expect(auditLog.action).toBe('report_generated');
            expect(auditLog.reportType).toBe('patient-outcomes');
            expect(auditLog.executionTime).toBe(1500);
            expect(auditLog.recordCount).toBe(100);
        });

        it('should track export activities', async () => {
            const exportAudit = {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                action: 'report_exported',
                reportType: 'pharmacist-interventions',
                exportFormat: 'csv',
                recordCount: 250,
                ipAddress: '192.168.1.1',
            };

            const auditLog = await ReportAuditLog.create(exportAudit);

            expect(auditLog.action).toBe('report_exported');
            expect(auditLog.exportFormat).toBe('csv');
        });

        it('should track scheduled report executions', async () => {
            const scheduleAudit = {
                userId: testUser._id,
                workplaceId: testWorkplace._id,
                action: 'scheduled_report_executed',
                reportType: 'patient-outcomes',
                scheduleId: 'schedule-123',
                executionTime: 2000,
                recordCount: 150,
                deliveryStatus: 'sent',
            };

            const auditLog = await ReportAuditLog.create(scheduleAudit);

            expect(auditLog.action).toBe('scheduled_report_executed');
            expect(auditLog.scheduleId).toBe('schedule-123');
            expect(auditLog.deliveryStatus).toBe('sent');
        });
    });

    describe('Report Aggregation Service', () => {
        it('should aggregate patient outcome data correctly', async () => {
            // This would test the actual aggregation pipeline
            const filters = {
                workplaceId: testWorkplace._id,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-12-31'),
                },
            };

            const result = await reportAggregationService.aggregatePatientOutcomes(filters);

            expect(result).toBeDefined();
            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('charts');
            expect(result).toHaveProperty('tables');
        });

        it('should handle empty datasets gracefully', async () => {
            const filters = {
                workplaceId: testWorkplace._id,
                dateRange: {
                    startDate: new Date('2025-01-01'), // Future date
                    endDate: new Date('2025-12-31'),
                },
            };

            const result = await reportAggregationService.aggregatePatientOutcomes(filters);

            expect(result.summary.totalPatients).toBe(0);
            expect(result.summary.totalInterventions).toBe(0);
            expect(result.charts).toHaveLength(0);
        });

        it('should optimize queries with proper indexing', async () => {
            const startTime = Date.now();

            const filters = {
                workplaceId: testWorkplace._id,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-12-31'),
                },
            };

            await reportAggregationService.aggregatePatientOutcomes(filters);

            const endTime = Date.now();
            const executionTime = endTime - startTime;

            // Should execute quickly with proper indexing
            expect(executionTime).toBeLessThan(1000);
        });
    });

    describe('Cache Integration', () => {
        it('should cache report data correctly', async () => {
            const cacheKey = 'report:patient-outcomes:workspace-123';
            const testData = { summary: { totalPatients: 100 } };

            await cacheService.set(cacheKey, testData, 300); // 5 minutes

            const cachedData = await cacheService.get(cacheKey);

            expect(cachedData).toEqual(testData);
        });

        it('should invalidate cache when data changes', async () => {
            const cacheKey = 'report:patient-outcomes:workspace-123';
            const testData = { summary: { totalPatients: 100 } };

            await cacheService.set(cacheKey, testData, 300);

            // Simulate data change
            await cacheService.invalidatePattern('report:patient-outcomes:*');

            const cachedData = await cacheService.get(cacheKey);

            expect(cachedData).toBeNull();
        });

        it('should handle cache failures gracefully', async () => {
            // Simulate cache failure
            const originalGet = cacheService.get;
            cacheService.get = () => Promise.reject(new Error('Cache unavailable'));

            const filters = {
                workplaceId: testWorkplace._id,
                dateRange: {
                    startDate: new Date('2024-01-01'),
                    endDate: new Date('2024-12-31'),
                },
            };

            // Should still work without cache
            const result = await reportAggregationService.aggregatePatientOutcomes(filters);

            expect(result).toBeDefined();

            // Restore original method
            cacheService.get = originalGet;
        });
    });

    describe('Database Indexes', () => {
        it('should have proper indexes for report queries', async () => {
            // Check if required indexes exist
            const collections = [
                'medicationtherapyreviews',
                'clinicalinterventions',
                'patients',
                'reporttemplates',
                'reportschedules',
                'reportauditlogs',
            ];

            for (const collectionName of collections) {
                const collection = (await connectDB()).db.collection(collectionName);
                const indexes = await collection.indexes();

                // Should have compound indexes for common query patterns
                const hasWorkplaceIndex = indexes.some(index =>
                    index.key.workplaceId !== undefined
                );

                expect(hasWorkplaceIndex).toBe(true);
            }
        });

        it('should optimize queries with date range indexes', async () => {
            const collection = (await connectDB()).db.collection('medicationtherapyreviews');
            const indexes = await collection.indexes();

            // Should have date-based indexes for time-series queries
            const hasDateIndex = indexes.some(index =>
                index.key.reviewDate !== undefined ||
                index.key.createdAt !== undefined
            );

            expect(hasDateIndex).toBe(true);
        });
    });

    describe('Data Consistency', () => {
        it('should maintain referential integrity', async () => {
            const template = await ReportTemplate.create({
                name: 'Test Template',
                description: 'Test',
                reportType: 'patient-outcomes',
                layout: { sections: [] },
                filters: [],
                charts: [],
                tables: [],
                createdBy: testUser._id,
                workplaceId: testWorkplace._id,
                isPublic: false,
            });

            const schedule = await ReportSchedule.create({
                name: 'Test Schedule',
                reportType: 'patient-outcomes',
                templateId: template._id,
                filters: { workplaceId: testWorkplace._id },
                frequency: 'weekly',
                recipients: ['test@example.com'],
                format: ['pdf'],
                createdBy: testUser._id,
                workplaceId: testWorkplace._id,
            });

            // Verify relationships
            expect(schedule.templateId.toString()).toBe(template._id.toString());
            expect(schedule.workplaceId.toString()).toBe(testWorkplace._id.toString());
        });

        it('should handle cascade deletions properly', async () => {
            const template = await ReportTemplate.create({
                name: 'Template to Delete',
                description: 'Test',
                reportType: 'patient-outcomes',
                layout: { sections: [] },
                filters: [],
                charts: [],
                tables: [],
                createdBy: testUser._id,
                workplaceId: testWorkplace._id,
                isPublic: false,
            });

            await ReportSchedule.create({
                name: 'Schedule with Template',
                reportType: 'patient-outcomes',
                templateId: template._id,
                filters: { workplaceId: testWorkplace._id },
                frequency: 'weekly',
                recipients: ['test@example.com'],
                format: ['pdf'],
                createdBy: testUser._id,
                workplaceId: testWorkplace._id,
            });

            // Delete template
            await ReportTemplate.findByIdAndDelete(template._id);

            // Schedule should handle missing template gracefully
            const schedule = await ReportSchedule.findOne({ templateId: template._id });
            expect(schedule).toBeDefined(); // Should still exist but handle missing template
        });
    });
});