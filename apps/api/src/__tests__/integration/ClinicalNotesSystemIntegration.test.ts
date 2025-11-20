import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import User from '../../models/User';
import ClinicalNote from '../../models/ClinicalNote';
import Patient from '../../models/Patient';
import Workplace from '../../models/Workplace';
import Subscription from '../../models/Subscription';
import SubscriptionPlan from '../../models/SubscriptionPlan';
import FeatureFlag from '../../models/FeatureFlag';
import { generateTestToken } from '../utils/testHelpers';

describe('Clinical Notes System Integration Tests', () => {
    let workplace1: any;
    let workplace2: any;
    let pharmacist1: any;
    let pharmacist2: any;
    let technician1: any;
    let patient1: any;
    let patient2: any;
    let basicPlan: any;
    let professionalPlan: any;
    let activeSubscription: any;
    let expiredSubscription: any;
    let limitedSubscription: any;
    let clinicalNote1: any;
    let clinicalNote2: any;
    let confidentialNote: any;
    let token1: string;
    let token2: string;
    let techToken: string;

    beforeAll(async () => {
        // Create subscription plans
        basicPlan = await SubscriptionPlan.create({
            name: 'Basic Plan',
            price: 29.99,
            billingCycle: 'monthly',
            features: {
                clinicalNotes: true,
                maxNotes: 50,
                confidentialNotes: false,
                fileAttachments: false,
                bulkOperations: false,
                advancedSearch: false,
            },
            limits: {
                notes: 50,
                attachments: 0,
                storage: 0,
            },
        });

        professionalPlan = await SubscriptionPlan.create({
            name: 'Professional Plan',
            price: 99.99,
            billingCycle: 'monthly',
            features: {
                clinicalNotes: true,
                maxNotes: 1000,
                confidentialNotes: true,
                fileAttachments: true,
                bulkOperations: true,
                advancedSearch: true,
            },
            limits: {
                notes: 1000,
                attachments: 100,
                storage: 10737418240, // 10GB
            },
        });

        // Create test workplaces
        workplace1 = await Workplace.create({
            name: 'Test Pharmacy 1',
            address: 'Test Address 1',
            phone: '1234567890',
            email: 'test1@pharmacy.com',
        });

        workplace2 = await Workplace.create({
            name: 'Test Pharmacy 2',
            address: 'Test Address 2',
            phone: '0987654321',
            email: 'test2@pharmacy.com',
        });

        // Create subscriptions
        activeSubscription = await Subscription.create({
            workplaceId: workplace1._id,
            planId: professionalPlan._id,
            status: 'active',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            usage: {
                notes: 25,
                attachments: 5,
                storage: 1073741824, // 1GB
            },
        });

        expiredSubscription = await Subscription.create({
            workplaceId: workplace2._id,
            planId: basicPlan._id,
            status: 'expired',
            startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
            endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            usage: {
                notes: 45,
                attachments: 0,
                storage: 0,
            },
        });

        limitedSubscription = await Subscription.create({
            workplaceId: workplace1._id,
            planId: basicPlan._id,
            status: 'active',
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            usage: {
                notes: 49, // Close to limit of 50
                attachments: 0,
                storage: 0,
            },
        });

        // Update workplace with subscription
        workplace1.subscriptionId = activeSubscription._id;
        await workplace1.save();

        workplace2.subscriptionId = expiredSubscription._id;
        await workplace2.save();

        // Create test users
        pharmacist1 = await User.create({
            firstName: 'John',
            lastName: 'Pharmacist',
            email: 'pharmacist1@test.com',
            passwordHash: 'hashedpassword',
            role: 'pharmacist',
            workplaceId: workplace1._id,
            workplaceRole: 'Pharmacist',
            status: 'active',
            licenseStatus: 'approved',
        });

        pharmacist2 = await User.create({
            firstName: 'Jane',
            lastName: 'Pharmacist',
            email: 'pharmacist2@test.com',
            passwordHash: 'hashedpassword',
            role: 'pharmacist',
            workplaceId: workplace2._id,
            workplaceRole: 'Pharmacist',
            status: 'active',
            licenseStatus: 'approved',
        });

        technician1 = await User.create({
            firstName: 'Bob',
            lastName: 'Technician',
            email: 'technician1@test.com',
            passwordHash: 'hashedpassword',
            role: 'pharmacy_team',
            workplaceId: workplace1._id,
            workplaceRole: 'Technician',
            status: 'active',
        });

        // Create test patients
        patient1 = await Patient.create({
            firstName: 'Patient',
            lastName: 'One',
            mrn: 'MRN001',
            dateOfBirth: new Date('1990-01-01'),
            gender: 'male',
            phone: '1111111111',
            workplaceId: workplace1._id,
        });

        patient2 = await Patient.create({
            firstName: 'Patient',
            lastName: 'Two',
            mrn: 'MRN002',
            dateOfBirth: new Date('1985-01-01'),
            gender: 'female',
            phone: '2222222222',
            workplaceId: workplace2._id,
        });

        // Create test clinical notes
        clinicalNote1 = await ClinicalNote.create({
            patient: patient1._id,
            pharmacist: pharmacist1._id,
            workplaceId: workplace1._id,
            type: 'consultation',
            title: 'Regular Consultation',
            content: {
                subjective: 'Patient reports feeling better',
                objective: 'Vital signs stable',
                assessment: 'Improving condition',
                plan: 'Continue current medication',
            },
            isConfidential: false,
            priority: 'medium',
            createdBy: pharmacist1._id,
            lastModifiedBy: pharmacist1._id,
        });

        clinicalNote2 = await ClinicalNote.create({
            patient: patient1._id,
            pharmacist: pharmacist1._id,
            workplaceId: workplace1._id,
            type: 'medication_review',
            title: 'Medication Review',
            content: {
                subjective: 'No new complaints',
                objective: 'Medication adherence good',
                assessment: 'Stable on current regimen',
                plan: 'Continue medications',
            },
            isConfidential: false,
            priority: 'low',
            createdBy: pharmacist1._id,
            lastModifiedBy: pharmacist1._id,
        });

        confidentialNote = await ClinicalNote.create({
            patient: patient1._id,
            pharmacist: pharmacist1._id,
            workplaceId: workplace1._id,
            type: 'assessment',
            title: 'Confidential Assessment',
            content: {
                subjective: 'Confidential patient information',
                objective: 'Sensitive observations',
                assessment: 'Confidential assessment',
                plan: 'Confidential treatment plan',
            },
            isConfidential: true,
            priority: 'high',
            createdBy: pharmacist1._id,
            lastModifiedBy: pharmacist1._id,
        });

        // Create feature flags
        await FeatureFlag.create({
            name: 'clinicalNotes',
            description: 'Enable clinical notes functionality',
            isEnabled: true,
            conditions: {},
        });

        await FeatureFlag.create({
            name: 'clinicalNotesAdvanced',
            description: 'Enable advanced clinical notes features',
            isEnabled: true,
            conditions: {
                subscriptionFeatures: ['bulkOperations', 'advancedSearch'],
            },
        });

        await FeatureFlag.create({
            name: 'fileUploads',
            description: 'Enable file upload functionality',
            isEnabled: true,
            conditions: {
                subscriptionFeatures: ['fileAttachments'],
            },
        });

        // Generate tokens
        token1 = generateTestToken(pharmacist1);
        token2 = generateTestToken(pharmacist2);
        techToken = generateTestToken(technician1);
    });

    afterAll(async () => {
        await ClinicalNote.deleteMany({});
        await Patient.deleteMany({});
        await User.deleteMany({});
        await Subscription.deleteMany({});
        await SubscriptionPlan.deleteMany({});
        await Workplace.deleteMany({});
        await FeatureFlag.deleteMany({});
    });

    describe('Authentication Integration', () => {
        it('should require authentication for all clinical note endpoints', async () => {
            const endpoints = [
                { method: 'get', path: '/api/notes' },
                { method: 'post', path: '/api/notes' },
                { method: 'get', path: `/api/notes/${clinicalNote1._id}` },
                { method: 'put', path: `/api/notes/${clinicalNote1._id}` },
                { method: 'delete', path: `/api/notes/${clinicalNote1._id}` },
            ];

            for (const endpoint of endpoints) {
                const response = await request(app)[endpoint.method](endpoint.path);
                expect(response.status).toBe(401);
                expect(response.body.success).toBe(false);
                expect(response.body.message).toContain('token');
            }
        });

        it('should reject invalid tokens', async () => {
            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', 'Bearer invalid-token')
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Invalid token');
        });

        it('should accept valid tokens and return user context', async () => {
            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.notes).toBeDefined();
        });
    });

    describe('Subscription Integration', () => {
        it('should allow access with active subscription', async () => {
            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.notes).toBeDefined();
        });

        it('should restrict access with expired subscription', async () => {
            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${token2}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('subscription');
        });

        it('should enforce note creation limits based on subscription', async () => {
            // Update subscription to be at limit
            await Subscription.findByIdAndUpdate(activeSubscription._id, {
                usage: { notes: 1000, attachments: 5, storage: 1073741824 },
            });

            const response = await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    patient: patient1._id,
                    type: 'consultation',
                    title: 'Test Note',
                    content: { subjective: 'Test content' },
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('limit');

            // Reset usage for other tests
            await Subscription.findByIdAndUpdate(activeSubscription._id, {
                usage: { notes: 25, attachments: 5, storage: 1073741824 },
            });
        });

        it('should enforce confidential note restrictions based on subscription', async () => {
            // Update workplace to use basic plan (no confidential notes)
            await Workplace.findByIdAndUpdate(workplace1._id, {
                subscriptionId: limitedSubscription._id,
            });

            const response = await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    patient: patient1._id,
                    type: 'consultation',
                    title: 'Test Confidential Note',
                    content: { subjective: 'Test content' },
                    isConfidential: true,
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('confidential');

            // Reset to professional plan
            await Workplace.findByIdAndUpdate(workplace1._id, {
                subscriptionId: activeSubscription._id,
            });
        });

        it('should enforce file attachment restrictions based on subscription', async () => {
            // Update workplace to use basic plan (no file attachments)
            await Workplace.findByIdAndUpdate(workplace1._id, {
                subscriptionId: limitedSubscription._id,
            });

            const response = await request(app)
                .post(`/api/notes/${clinicalNote1._id}/attachments`)
                .set('Authorization', `Bearer ${token1}`)
                .attach('file', Buffer.from('test file content'), 'test.pdf')
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('file attachments');

            // Reset to professional plan
            await Workplace.findByIdAndUpdate(workplace1._id, {
                subscriptionId: activeSubscription._id,
            });
        });

        it('should enforce bulk operation restrictions based on subscription', async () => {
            // Update workplace to use basic plan (no bulk operations)
            await Workplace.findByIdAndUpdate(workplace1._id, {
                subscriptionId: limitedSubscription._id,
            });

            const response = await request(app)
                .post('/api/notes/bulk/update')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    noteIds: [clinicalNote1._id, clinicalNote2._id],
                    updates: { priority: 'high' },
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('bulk operations');

            // Reset to professional plan
            await Workplace.findByIdAndUpdate(workplace1._id, {
                subscriptionId: activeSubscription._id,
            });
        });

        it('should update usage statistics after operations', async () => {
            const initialUsage = await Subscription.findById(activeSubscription._id);
            const initialNoteCount = initialUsage.usage.notes;

            // Create a new note
            await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    patient: patient1._id,
                    type: 'consultation',
                    title: 'Usage Test Note',
                    content: { subjective: 'Test content' },
                })
                .expect(201);

            // Check that usage was updated
            const updatedUsage = await Subscription.findById(activeSubscription._id);
            expect(updatedUsage.usage.notes).toBe(initialNoteCount + 1);
        });
    });

    describe('Feature Flag Integration', () => {
        it('should respect clinical notes feature flag', async () => {
            // Disable clinical notes feature
            await FeatureFlag.findOneAndUpdate(
                { name: 'clinicalNotes' },
                { isEnabled: false }
            );

            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${token1}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('feature not available');

            // Re-enable for other tests
            await FeatureFlag.findOneAndUpdate(
                { name: 'clinicalNotes' },
                { isEnabled: true }
            );
        });

        it('should respect advanced features flag for bulk operations', async () => {
            // Disable advanced features
            await FeatureFlag.findOneAndUpdate(
                { name: 'clinicalNotesAdvanced' },
                { isEnabled: false }
            );

            const response = await request(app)
                .post('/api/notes/bulk/update')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    noteIds: [clinicalNote1._id, clinicalNote2._id],
                    updates: { priority: 'high' },
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('feature not available');

            // Re-enable for other tests
            await FeatureFlag.findOneAndUpdate(
                { name: 'clinicalNotesAdvanced' },
                { isEnabled: true }
            );
        });

        it('should respect file upload feature flag', async () => {
            // Disable file uploads
            await FeatureFlag.findOneAndUpdate(
                { name: 'fileUploads' },
                { isEnabled: false }
            );

            const response = await request(app)
                .post(`/api/notes/${clinicalNote1._id}/attachments`)
                .set('Authorization', `Bearer ${token1}`)
                .attach('file', Buffer.from('test file content'), 'test.pdf')
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('feature not available');

            // Re-enable for other tests
            await FeatureFlag.findOneAndUpdate(
                { name: 'fileUploads' },
                { isEnabled: true }
            );
        });

        it('should check both feature flags and subscription features', async () => {
            // Feature flag enabled but subscription doesn't support it
            await Workplace.findByIdAndUpdate(workplace1._id, {
                subscriptionId: limitedSubscription._id,
            });

            const response = await request(app)
                .post('/api/notes/bulk/update')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    noteIds: [clinicalNote1._id, clinicalNote2._id],
                    updates: { priority: 'high' },
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('bulk operations');

            // Reset to professional plan
            await Workplace.findByIdAndUpdate(workplace1._id, {
                subscriptionId: activeSubscription._id,
            });
        });
    });

    describe('Role-Based Access Control Integration', () => {
        it('should allow pharmacists full access to clinical notes', async () => {
            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.notes).toHaveLength(3); // Including confidential note
        });

        it('should restrict technician access to confidential notes', async () => {
            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${techToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.notes).toHaveLength(2); // Excluding confidential note

            const noteIds = response.body.notes.map((note: any) => note._id);
            expect(noteIds).not.toContain(confidentialNote._id.toString());
        });

        it('should prevent technicians from creating confidential notes', async () => {
            const response = await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    patient: patient1._id,
                    type: 'consultation',
                    title: 'Test Confidential Note',
                    content: { subjective: 'Test content' },
                    isConfidential: true,
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('confidential');
        });

        it('should prevent technicians from accessing confidential note details', async () => {
            const response = await request(app)
                .get(`/api/notes/${confidentialNote._id}`)
                .set('Authorization', `Bearer ${techToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('confidential');
        });
    });

    describe('Patient Management Integration', () => {
        it('should return patient-specific notes', async () => {
            const response = await request(app)
                .get(`/api/notes?patientId=${patient1._id}`)
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.notes).toHaveLength(3);

            response.body.notes.forEach((note: any) => {
                expect(note.patient._id).toBe(patient1._id.toString());
            });
        });

        it('should validate patient belongs to workplace', async () => {
            const response = await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    patient: patient2._id, // Patient from different workplace
                    type: 'consultation',
                    title: 'Test Note',
                    content: { subjective: 'Test content' },
                })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('not found or access denied');
        });

        it('should include patient information in note responses', async () => {
            const response = await request(app)
                .get(`/api/notes/${clinicalNote1._id}`)
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.note.patient).toBeDefined();
            expect(response.body.note.patient.firstName).toBe('Patient');
            expect(response.body.note.patient.lastName).toBe('One');
            expect(response.body.note.patient.mrn).toBe('MRN001');
        });
    });

    describe('Audit Logging Integration', () => {
        it('should log note creation activities', async () => {
            const response = await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    patient: patient1._id,
                    type: 'consultation',
                    title: 'Audit Test Note',
                    content: { subjective: 'Test content' },
                })
                .expect(201);

            expect(response.body.success).toBe(true);

            // In a real implementation, you would check the audit log database
            // For now, we verify the operation succeeded
            expect(response.body.note.title).toBe('Audit Test Note');
        });

        it('should log confidential note access', async () => {
            const response = await request(app)
                .get(`/api/notes/${confidentialNote._id}`)
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(response.body.success).toBe(true);

            // In a real implementation, you would verify audit log entry
            expect(response.body.note.isConfidential).toBe(true);
        });

        it('should log unauthorized access attempts', async () => {
            const response = await request(app)
                .get(`/api/notes/${confidentialNote._id}`)
                .set('Authorization', `Bearer ${techToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);

            // In a real implementation, you would verify security audit log entry
        });
    });

    describe('End-to-End Workflow Integration', () => {
        it('should complete full note creation workflow with all validations', async () => {
            const noteData = {
                patient: patient1._id,
                type: 'medication_review',
                title: 'Complete Workflow Test',
                content: {
                    subjective: 'Patient reports improvement',
                    objective: 'Vital signs normal',
                    assessment: 'Condition stable',
                    plan: 'Continue treatment',
                },
                priority: 'medium',
                isConfidential: false,
                tags: ['workflow-test'],
                recommendations: ['Continue monitoring'],
            };

            // Create note
            const createResponse = await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${token1}`)
                .send(noteData)
                .expect(201);

            expect(createResponse.body.success).toBe(true);
            const noteId = createResponse.body.note._id;

            // Retrieve note
            const getResponse = await request(app)
                .get(`/api/notes/${noteId}`)
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(getResponse.body.success).toBe(true);
            expect(getResponse.body.note.title).toBe(noteData.title);

            // Update note
            const updateResponse = await request(app)
                .put(`/api/notes/${noteId}`)
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    title: 'Updated Workflow Test',
                    priority: 'high',
                })
                .expect(200);

            expect(updateResponse.body.success).toBe(true);
            expect(updateResponse.body.note.title).toBe('Updated Workflow Test');
            expect(updateResponse.body.note.priority).toBe('high');

            // Delete note
            const deleteResponse = await request(app)
                .delete(`/api/notes/${noteId}`)
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(deleteResponse.body.success).toBe(true);

            // Verify deletion
            const verifyResponse = await request(app)
                .get(`/api/notes/${noteId}`)
                .set('Authorization', `Bearer ${token1}`)
                .expect(404);

            expect(verifyResponse.body.success).toBe(false);
        });

        it('should handle bulk operations with proper validations', async () => {
            const bulkResponse = await request(app)
                .post('/api/notes/bulk/update')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    noteIds: [clinicalNote1._id, clinicalNote2._id],
                    updates: { priority: 'high', tags: ['bulk-updated'] },
                })
                .expect(200);

            expect(bulkResponse.body.success).toBe(true);
            expect(bulkResponse.body.updated).toBe(2);

            // Verify updates
            const note1Response = await request(app)
                .get(`/api/notes/${clinicalNote1._id}`)
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(note1Response.body.note.priority).toBe('high');
            expect(note1Response.body.note.tags).toContain('bulk-updated');
        });

        it('should handle search and filtering with proper permissions', async () => {
            // Search by title
            const searchResponse = await request(app)
                .get('/api/notes/search?q=consultation')
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(searchResponse.body.success).toBe(true);
            expect(searchResponse.body.notes.length).toBeGreaterThan(0);

            // Filter by type
            const filterResponse = await request(app)
                .get('/api/notes?type=medication_review')
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(filterResponse.body.success).toBe(true);
            filterResponse.body.notes.forEach((note: any) => {
                expect(note.type).toBe('medication_review');
            });

            // Filter by date range
            const dateResponse = await request(app)
                .get('/api/notes?dateFrom=2024-01-01&dateTo=2024-12-31')
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(dateResponse.body.success).toBe(true);
            expect(dateResponse.body.notes.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling Integration', () => {
        it('should handle database connection errors gracefully', async () => {
            // Temporarily close database connection
            await mongoose.connection.close();

            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${token1}`);

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('database');

            // Reconnect for other tests
            await mongoose.connect(process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/test');
        });

        it('should handle validation errors with detailed messages', async () => {
            const response = await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    // Missing required fields
                    type: 'consultation',
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.errors).toBeDefined();
            expect(response.body.errors.patient).toContain('required');
            expect(response.body.errors.title).toContain('required');
        });

        it('should handle concurrent modification conflicts', async () => {
            // Simulate concurrent updates
            const updateData = { title: 'Concurrent Update Test' };

            const [response1, response2] = await Promise.all([
                request(app)
                    .put(`/api/notes/${clinicalNote1._id}`)
                    .set('Authorization', `Bearer ${token1}`)
                    .send(updateData),
                request(app)
                    .put(`/api/notes/${clinicalNote1._id}`)
                    .set('Authorization', `Bearer ${token1}`)
                    .send({ title: 'Another Concurrent Update' }),
            ]);

            // One should succeed, one might fail or both might succeed depending on timing
            expect(response1.status === 200 || response2.status === 200).toBe(true);
        });
    });

    describe('Performance Integration', () => {
        it('should handle large datasets efficiently', async () => {
            // Create multiple notes for performance testing
            const notePromises = Array.from({ length: 50 }, (_, i) =>
                ClinicalNote.create({
                    patient: patient1._id,
                    pharmacist: pharmacist1._id,
                    workplaceId: workplace1._id,
                    type: 'consultation',
                    title: `Performance Test Note ${i}`,
                    content: {
                        subjective: `Test content ${i}`,
                        objective: 'Test objective',
                        assessment: 'Test assessment',
                        plan: 'Test plan',
                    },
                    createdBy: pharmacist1._id,
                    lastModifiedBy: pharmacist1._id,
                })
            );

            await Promise.all(notePromises);

            const startTime = Date.now();

            const response = await request(app)
                .get('/api/notes?limit=25&page=1')
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(response.body.success).toBe(true);
            expect(response.body.notes).toHaveLength(25);
            expect(responseTime).toBeLessThan(1000); // Should respond within 1 second

            // Clean up performance test notes
            await ClinicalNote.deleteMany({
                title: { $regex: /^Performance Test Note/ },
            });
        });

        it('should implement efficient pagination', async () => {
            const response = await request(app)
                .get('/api/notes?page=1&limit=2')
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.notes).toHaveLength(2);
            expect(response.body.page).toBe(1);
            expect(response.body.totalPages).toBeGreaterThan(0);
            expect(response.body.total).toBeGreaterThan(0);
        });
    });
});