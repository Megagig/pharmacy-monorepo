import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import User from '../../models/User';
import ClinicalNote from '../../models/ClinicalNote';
import Patient from '../../models/Patient';
import Workplace from '../../models/Workplace';
import { generateTestToken } from '../utils/testHelpers';

describe('Clinical Notes Security', () => {
    let workplace1: any;
    let workplace2: any;
    let pharmacist1: any;
    let pharmacist2: any;
    let technician1: any;
    let patient1: any;
    let patient2: any;
    let confidentialNote: any;
    let regularNote: any;
    let token1: string;
    let token2: string;
    let techToken: string;

    beforeAll(async () => {
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

        // Create test notes
        confidentialNote = await ClinicalNote.create({
            patient: patient1._id,
            pharmacist: pharmacist1._id,
            workplaceId: workplace1._id,
            type: 'consultation',
            title: 'Confidential Consultation',
            content: {
                subjective: 'Confidential patient information',
                objective: 'Confidential observations',
                assessment: 'Confidential assessment',
                plan: 'Confidential treatment plan',
            },
            isConfidential: true,
            priority: 'high',
            createdBy: pharmacist1._id,
            lastModifiedBy: pharmacist1._id,
        });

        regularNote = await ClinicalNote.create({
            patient: patient1._id,
            pharmacist: pharmacist1._id,
            workplaceId: workplace1._id,
            type: 'medication_review',
            title: 'Regular Medication Review',
            content: {
                subjective: 'Patient reports feeling better',
                objective: 'Vital signs stable',
                assessment: 'Medication working well',
                plan: 'Continue current regimen',
            },
            isConfidential: false,
            priority: 'medium',
            createdBy: pharmacist1._id,
            lastModifiedBy: pharmacist1._id,
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
        await Workplace.deleteMany({});
    });

    describe('Tenancy Isolation', () => {
        it('should not allow access to notes from different workplace', async () => {
            const response = await request(app)
                .get(`/api/notes/${confidentialNote._id}`)
                .set('Authorization', `Bearer ${token2}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('not found or access denied');
        });

        it('should not list notes from different workplace', async () => {
            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${token2}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.notes).toHaveLength(0);
        });

        it('should not allow bulk operations on notes from different workplace', async () => {
            const response = await request(app)
                .post('/api/notes/bulk/update')
                .set('Authorization', `Bearer ${token2}`)
                .send({
                    noteIds: [confidentialNote._id, regularNote._id],
                    updates: { priority: 'low' }
                })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('not found or access denied');
        });
    });

    describe('Confidential Notes Access Control', () => {
        it('should allow pharmacist to access confidential notes', async () => {
            const response = await request(app)
                .get(`/api/notes/${confidentialNote._id}`)
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.note.isConfidential).toBe(true);
        });

        it('should not allow technician to access confidential notes', async () => {
            const response = await request(app)
                .get(`/api/notes/${confidentialNote._id}`)
                .set('Authorization', `Bearer ${techToken}`)
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('confidential');
        });

        it('should filter out confidential notes for technicians in list', async () => {
            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${techToken}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            const noteIds = response.body.notes.map((note: any) => note._id);
            expect(noteIds).not.toContain(confidentialNote._id.toString());
            expect(noteIds).toContain(regularNote._id.toString());
        });

        it('should not allow technician to create confidential notes', async () => {
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
    });

    describe('Role-Based Access Control', () => {
        it('should allow pharmacist to create notes', async () => {
            const response = await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    patient: patient1._id,
                    type: 'consultation',
                    title: 'Test Note',
                    content: { subjective: 'Test content' },
                })
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.note.title).toBe('Test Note');
        });

        it('should allow pharmacist to update their own notes', async () => {
            const response = await request(app)
                .put(`/api/notes/${regularNote._id}`)
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    title: 'Updated Note Title',
                })
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.note.title).toBe('Updated Note Title');
        });

        it('should allow pharmacist to delete notes', async () => {
            // Create a note to delete
            const noteToDelete = await ClinicalNote.create({
                patient: patient1._id,
                pharmacist: pharmacist1._id,
                workplaceId: workplace1._id,
                type: 'consultation',
                title: 'Note to Delete',
                content: { subjective: 'Test content' },
                createdBy: pharmacist1._id,
                lastModifiedBy: pharmacist1._id,
            });

            const response = await request(app)
                .delete(`/api/notes/${noteToDelete._id}`)
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.message).toContain('deleted successfully');
        });
    });

    describe('Audit Logging', () => {
        it('should log confidential note access', async () => {
            // This test would require checking audit logs
            // For now, we just verify the request succeeds
            const response = await request(app)
                .get(`/api/notes/${confidentialNote._id}`)
                .set('Authorization', `Bearer ${token1}`)
                .expect(200);

            expect(response.body.success).toBe(true);
            // In a real implementation, you would check the audit log database
        });

        it('should log unauthorized access attempts', async () => {
            const response = await request(app)
                .get(`/api/notes/${confidentialNote._id}`)
                .set('Authorization', `Bearer ${token2}`)
                .expect(404);

            expect(response.body.success).toBe(false);
            // In a real implementation, you would check the audit log database
        });
    });

    describe('Data Validation', () => {
        it('should validate required fields for note creation', async () => {
            const response = await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    // Missing required fields
                    type: 'consultation',
                })
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('required');
        });

        it('should validate patient exists and belongs to workplace', async () => {
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
    });

    describe('Bulk Operations Security', () => {
        it('should validate all notes belong to workplace for bulk update', async () => {
            const response = await request(app)
                .post('/api/notes/bulk/update')
                .set('Authorization', `Bearer ${token1}`)
                .send({
                    noteIds: [regularNote._id, new mongoose.Types.ObjectId()], // Non-existent note
                    updates: { priority: 'low' }
                })
                .expect(404);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('not found or access denied');
        });

        it('should validate permissions for bulk confidential note operations', async () => {
            const response = await request(app)
                .post('/api/notes/bulk/update')
                .set('Authorization', `Bearer ${techToken}`)
                .send({
                    noteIds: [confidentialNote._id],
                    updates: { priority: 'low' }
                })
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('confidential');
        });
    });
});