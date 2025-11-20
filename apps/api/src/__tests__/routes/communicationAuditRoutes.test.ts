import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import communicationAuditRoutes from '../../routes/communicationAuditRoutes';
import CommunicationAuditLog from '../../models/CommunicationAuditLog';
import User from '../../models/User';
import Workplace from '../../models/Workplace';

describe('Communication Audit Routes', () => {
    let app: express.Application;
    let mongoServer: MongoMemoryServer;
    let testWorkplace: any;
    let testUser: any;
    let authToken: string;

    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        const mongoUri = mongoServer.getUri();
        await mongoose.connect(mongoUri);

        app = express();
        app.use(express.json());
        app.use('/api/communication/audit', communicationAuditRoutes);

        // Generate test auth token
        const jwtSecret = process.env.JWT_SECRET || 'test-secret';
        authToken = jwt.sign({ userId: 'test-user-id' }, jwtSecret);
    });

    afterAll(async () => {
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    beforeEach(async () => {
        // Clear all collections
        await CommunicationAuditLog.deleteMany({});
        await User.deleteMany({});
        await Workplace.deleteMany({});

        // Create test workplace
        testWorkplace = await Workplace.create({
            name: 'Test Pharmacy',
            address: '123 Test St',
            phone: '555-0123',
            email: 'test@pharmacy.com',
            licenseNumber: 'TEST123',
            subscriptionPlan: 'professional',
        });

        // Create test user
        testUser = await User.create({
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@test.com',
            password: 'hashedpassword',
            role: 'pharmacist',
            workplaceId: testWorkplace._id,
        });

        // Update auth token with real user ID
        authToken = jwt.sign({ userId: testUser._id.toString() }, process.env.JWT_SECRET || 'test-secret');

        // Create test audit logs
        await CommunicationAuditLog.insertMany([
            {
                action: 'message_sent',
                userId: testUser._id,
                targetId: new mongoose.Types.ObjectId(),
                targetType: 'message',
                details: {
                    conversationId: new mongoose.Types.ObjectId(),
                    metadata: { messageType: 'text' },
                },
                workplaceId: testWorkplace._id,
                ipAddress: '192.168.1.1',
                userAgent: 'Test Agent',
                riskLevel: 'low',
                complianceCategory: 'communication_security',
                success: true,
                timestamp: new Date(),
            },
            {
                action: 'conversation_exported',
                userId: testUser._id,
                targetId: new mongoose.Types.ObjectId(),
                targetType: 'conversation',
                details: {
                    conversationId: new mongoose.Types.ObjectId(),
                    metadata: { exportFormat: 'csv' },
                },
                workplaceId: testWorkplace._id,
                ipAddress: '192.168.1.1',
                userAgent: 'Test Agent',
                riskLevel: 'critical',
                complianceCategory: 'data_access',
                success: true,
                timestamp: new Date(),
            },
        ]);
    });

    describe('GET /logs', () => {
        it('should get audit logs successfully', async () => {
            const response = await request(app)
                .get('/api/communication/audit/logs')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(2);
            expect(response.body.pagination).toBeDefined();
            expect(response.body.pagination.total).toBe(2);
        });

        it('should filter logs by action', async () => {
            const response = await request(app)
                .get('/api/communication/audit/logs?action=message_sent')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].action).toBe('message_sent');
        });

        it('should filter logs by risk level', async () => {
            const response = await request(app)
                .get('/api/communication/audit/logs?riskLevel=critical')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].riskLevel).toBe('critical');
        });

        it('should paginate results', async () => {
            const response = await request(app)
                .get('/api/communication/audit/logs?limit=1&offset=0')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.pagination.total).toBe(2);
            expect(response.body.pagination.pages).toBe(2);
        });

        it('should require authentication', async () => {
            await request(app)
                .get('/api/communication/audit/logs')
                .expect(401);
        });

        it('should validate query parameters', async () => {
            const response = await request(app)
                .get('/api/communication/audit/logs?riskLevel=invalid')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Validation errors');
        });
    });

    describe('GET /conversations/:conversationId/logs', () => {
        let conversationId: mongoose.Types.ObjectId;

        beforeEach(async () => {
            conversationId = new mongoose.Types.ObjectId();

            // Create audit log for specific conversation
            await CommunicationAuditLog.create({
                action: 'message_sent',
                userId: testUser._id,
                targetId: new mongoose.Types.ObjectId(),
                targetType: 'message',
                details: {
                    conversationId,
                    metadata: { messageType: 'text' },
                },
                workplaceId: testWorkplace._id,
                ipAddress: '192.168.1.1',
                userAgent: 'Test Agent',
                riskLevel: 'low',
                complianceCategory: 'communication_security',
                success: true,
            });
        });

        it('should get conversation audit logs successfully', async () => {
            const response = await request(app)
                .get(`/api/communication/audit/conversations/${conversationId}/logs`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].details.conversationId).toBe(conversationId.toString());
        });

        it('should validate conversation ID', async () => {
            await request(app)
                .get('/api/communication/audit/conversations/invalid-id/logs')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);
        });
    });

    describe('GET /high-risk', () => {
        it('should get high-risk activities successfully', async () => {
            const response = await request(app)
                .get('/api/communication/audit/high-risk')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveLength(1);
            expect(response.body.data[0].riskLevel).toBe('critical');
            expect(response.body.count).toBe(1);
        });

        it('should filter by date range', async () => {
            const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const endDate = new Date().toISOString();

            const response = await request(app)
                .get(`/api/communication/audit/high-risk?startDate=${startDate}&endDate=${endDate}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.dateRange).toBeDefined();
        });
    });

    describe('GET /compliance-report', () => {
        it('should generate compliance report successfully', async () => {
            const response = await request(app)
                .get('/api/communication/audit/compliance-report')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.generatedAt).toBeDefined();
        });
    });

    describe('GET /export', () => {
        it('should export audit logs as CSV', async () => {
            const response = await request(app)
                .get('/api/communication/audit/export?format=csv')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
            expect(response.headers['content-disposition']).toContain('attachment');
            expect(response.text).toContain('Timestamp,Action,User');
        });

        it('should export audit logs as JSON', async () => {
            const response = await request(app)
                .get('/api/communication/audit/export?format=json')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
            expect(response.headers['content-disposition']).toContain('attachment');

            const data = JSON.parse(response.text);
            expect(Array.isArray(data)).toBe(true);
        });

        it('should filter exported data', async () => {
            const response = await request(app)
                .get('/api/communication/audit/export?format=csv&action=message_sent')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.text).toContain('message_sent');
            expect(response.text).not.toContain('conversation_exported');
        });
    });

    describe('GET /users/:userId/activity', () => {
        it('should get user activity summary successfully', async () => {
            const response = await request(app)
                .get(`/api/communication/audit/users/${testUser._id}/activity`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.userId).toBe(testUser._id.toString());
        });

        it('should validate user ID', async () => {
            await request(app)
                .get('/api/communication/audit/users/invalid-id/activity')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);
        });
    });

    describe('GET /statistics', () => {
        it('should get audit statistics successfully', async () => {
            const response = await request(app)
                .get('/api/communication/audit/statistics')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.data.totalActivities).toBeDefined();
            expect(response.body.data.highRiskActivities).toBeDefined();
            expect(response.body.data.generatedAt).toBeDefined();
        });
    });

    describe('GET /search', () => {
        it('should search audit logs successfully', async () => {
            const response = await request(app)
                .get('/api/communication/audit/search?q=message')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeDefined();
            expect(response.body.searchQuery).toBe('message');
        });

        it('should reject short search queries', async () => {
            const response = await request(app)
                .get('/api/communication/audit/search?q=a')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Validation errors');
        });

        it('should require search query', async () => {
            await request(app)
                .get('/api/communication/audit/search')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);
        });
    });

    describe('GET /health', () => {
        it('should return health status', async () => {
            const response = await request(app)
                .get('/api/communication/audit/health')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body.status).toBe('OK');
            expect(response.body.module).toBe('communication-audit');
            expect(response.body.features).toBeDefined();
            expect(response.body.features.auditLogging).toBe(true);
        });
    });

    describe('Authorization', () => {
        let patientUser: any;
        let patientToken: string;

        beforeEach(async () => {
            // Create patient user (should not have access to audit logs)
            patientUser = await User.create({
                firstName: 'Jane',
                lastName: 'Patient',
                email: 'jane.patient@test.com',
                password: 'hashedpassword',
                role: 'patient',
                workplaceId: testWorkplace._id,
            });

            patientToken = jwt.sign(
                { userId: patientUser._id.toString() },
                process.env.JWT_SECRET || 'test-secret'
            );
        });

        it('should deny access to patients', async () => {
            await request(app)
                .get('/api/communication/audit/logs')
                .set('Authorization', `Bearer ${patientToken}`)
                .expect(403);
        });

        it('should allow access to pharmacists', async () => {
            await request(app)
                .get('/api/communication/audit/logs')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
        });
    });

    describe('Error Handling', () => {
        it('should handle database connection errors gracefully', async () => {
            // Temporarily close the database connection
            await mongoose.connection.close();

            const response = await request(app)
                .get('/api/communication/audit/logs')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Failed to retrieve audit logs');

            // Reconnect for cleanup
            await mongoose.connect(mongoServer.getUri());
        });

        it('should handle malformed request data', async () => {
            const response = await request(app)
                .get('/api/communication/audit/logs?limit=invalid')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toBe('Validation errors');
        });
    });
});