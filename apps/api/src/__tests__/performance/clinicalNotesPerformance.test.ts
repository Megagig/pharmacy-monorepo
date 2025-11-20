import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import User from '../../models/User';
import Patient from '../../models/Patient';
import ClinicalNote from '../../models/ClinicalNote';
import Workplace from '../../models/Workplace';
import { generateAccessToken } from '../../utils/token';

describe('Clinical Notes Performance Tests', () => {
    let authToken: string;
    let userId: mongoose.Types.ObjectId;
    let workplaceId: mongoose.Types.ObjectId;
    let patientIds: mongoose.Types.ObjectId[] = [];
    let noteIds: mongoose.Types.ObjectId[] = [];

    beforeAll(async () => {
        // Create test workplace
        const workplace = new Workplace({
            name: 'Test Pharmacy',
            type: 'pharmacy',
            address: {
                street: '123 Test St',
                city: 'Test City',
                state: 'TS',
                zipCode: '12345',
                country: 'Test Country',
            },
        });
        await workplace.save();
        workplaceId = workplace._id;

        // Create test user
        const user = new User({
            firstName: 'Test',
            lastName: 'Pharmacist',
            email: 'test@example.com',
            password: 'password123',
            role: 'pharmacist',
            workplaceId,
            isEmailVerified: true,
        });
        await user.save();
        userId = user._id;

        authToken = generateAccessToken(user._id.toString());

        // Create test patients
        const patients = [];
        for (let i = 0; i < 100; i++) {
            patients.push({
                firstName: `Patient${i}`,
                lastName: `Test${i}`,
                email: `patient${i}@example.com`,
                phone: `+234801234${i.toString().padStart(4, '0')}`,
                dob: new Date('1990-01-01'),
                gender: i % 2 === 0 ? 'male' : 'female',
                mrn: `MRN${i.toString().padStart(6, '0')}`,
                workplaceId,
                createdBy: userId,
            });
        }

        const createdPatients = await Patient.insertMany(patients);
        patientIds = createdPatients.map(p => p._id);

        // Create test clinical notes
        const notes = [];
        for (let i = 0; i < 1000; i++) {
            const patientIndex = i % patientIds.length;
            notes.push({
                patient: patientIds[patientIndex],
                pharmacist: userId,
                workplaceId,
                title: `Clinical Note ${i}`,
                type: ['consultation', 'medication_review', 'follow_up'][i % 3],
                priority: ['low', 'medium', 'high'][i % 3],
                content: {
                    subjective: `Subjective content for note ${i}`,
                    objective: `Objective content for note ${i}`,
                    assessment: `Assessment content for note ${i}`,
                    plan: `Plan content for note ${i}`,
                },
                isConfidential: i % 10 === 0,
                followUpRequired: i % 5 === 0,
                followUpDate: i % 5 === 0 ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined,
                tags: [`tag${i % 5}`, `category${i % 3}`],
                recommendations: [`Recommendation ${i}`],
                createdBy: userId,
                lastModifiedBy: userId,
            });
        }

        const createdNotes = await ClinicalNote.insertMany(notes);
        noteIds = createdNotes.map(n => n._id);
    });

    afterAll(async () => {
        // Clean up test data
        await ClinicalNote.deleteMany({ _id: { $in: noteIds } });
        await Patient.deleteMany({ _id: { $in: patientIds } });
        await User.findByIdAndDelete(userId);
        await Workplace.findByIdAndDelete(workplaceId);
    });

    describe('GET /api/notes - List Performance', () => {
        it('should handle large dataset pagination efficiently', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    page: 1,
                    limit: 50,
                })
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
            expect(response.body.notes).toHaveLength(50);
            expect(response.body.total).toBe(1000);
            expect(response.body.totalPages).toBe(20);
        });

        it('should handle deep pagination efficiently', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    page: 15,
                    limit: 20,
                })
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(1500); // Should respond within 1.5 seconds even for deep pagination
            expect(response.body.notes).toHaveLength(20);
            expect(response.body.currentPage).toBe(15);
        });

        it('should handle sorting efficiently', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    sortBy: 'title',
                    sortOrder: 'asc',
                    limit: 100,
                })
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(1200); // Should handle sorting within 1.2 seconds
            expect(response.body.notes).toHaveLength(100);

            // Verify sorting
            const titles = response.body.notes.map((note: any) => note.title);
            const sortedTitles = [...titles].sort();
            expect(titles).toEqual(sortedTitles);
        });

        it('should handle filtering efficiently', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    type: 'consultation',
                    priority: 'high',
                    limit: 50,
                })
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(800); // Should handle filtering within 800ms
            expect(response.body.notes.every((note: any) =>
                note.type === 'consultation' && note.priority === 'high'
            )).toBe(true);
        });
    });

    describe('GET /api/notes/search - Search Performance', () => {
        it('should handle text search efficiently', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get('/api/notes/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    q: 'Clinical Note',
                    limit: 50,
                })
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(2000); // Text search should complete within 2 seconds
            expect(response.body.notes.length).toBeGreaterThan(0);
            expect(response.body.notes.every((note: any) =>
                note.title.includes('Clinical Note')
            )).toBe(true);
        });

        it('should handle complex search queries efficiently', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .get('/api/notes/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    q: 'Subjective content',
                    type: 'consultation',
                    priority: 'medium',
                    limit: 25,
                })
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(2500); // Complex search should complete within 2.5 seconds
            expect(response.body.notes.length).toBeGreaterThan(0);
        });

        it('should handle search with date range efficiently', async () => {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

            const startTime = Date.now();

            const response = await request(app)
                .get('/api/notes/search')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    q: 'Note',
                    dateFrom: yesterday,
                    dateTo: tomorrow,
                    limit: 100,
                })
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(1800); // Date range search should complete within 1.8 seconds
            expect(response.body.notes.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/notes/patient/:patientId - Patient Notes Performance', () => {
        it('should retrieve patient notes efficiently', async () => {
            const patientId = patientIds[0];
            const startTime = Date.now();

            const response = await request(app)
                .get(`/api/notes/patient/${patientId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(500); // Patient-specific queries should be very fast
            expect(response.body.notes.every((note: any) =>
                note.patient._id === patientId?.toString()
            )).toBe(true);
        });

        it('should handle patient notes with filtering efficiently', async () => {
            const patientId = patientIds[0];
            const startTime = Date.now();

            const response = await request(app)
                .get(`/api/notes/patient/${patientId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    type: 'consultation',
                    sortBy: 'createdAt',
                    sortOrder: 'desc',
                })
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(600); // Filtered patient queries should still be fast
            expect(response.body.notes.every((note: any) =>
                note.patient._id === patientId?.toString() && note.type === 'consultation'
            )).toBe(true);
        });
    });

    describe('POST /api/notes - Create Performance', () => {
        it('should create notes efficiently', async () => {
            const noteData = {
                patient: patientIds[0],
                title: 'Performance Test Note',
                type: 'consultation',
                priority: 'medium',
                content: {
                    subjective: 'Test subjective content',
                    objective: 'Test objective content',
                    assessment: 'Test assessment content',
                    plan: 'Test plan content',
                },
                isConfidential: false,
                followUpRequired: false,
                tags: ['performance', 'test'],
                recommendations: ['Test recommendation'],
            };

            const startTime = Date.now();

            const response = await request(app)
                .post('/api/notes')
                .set('Authorization', `Bearer ${authToken}`)
                .send(noteData)
                .expect(201);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(500); // Note creation should be fast
            expect(response.body.note.title).toBe(noteData.title);

            // Clean up
            await ClinicalNote.findByIdAndDelete(response.body.note._id);
        });

        it('should handle bulk note creation efficiently', async () => {
            const bulkNotes = Array.from({ length: 10 }, (_, i) => ({
                patient: patientIds[i % 5],
                title: `Bulk Test Note ${i}`,
                type: 'consultation',
                priority: 'low',
                content: {
                    subjective: `Bulk test subjective ${i}`,
                    objective: `Bulk test objective ${i}`,
                    assessment: `Bulk test assessment ${i}`,
                    plan: `Bulk test plan ${i}`,
                },
                isConfidential: false,
                followUpRequired: false,
                tags: ['bulk', 'test'],
                recommendations: [`Bulk recommendation ${i}`],
            }));

            const startTime = Date.now();

            // Create notes sequentially to test individual performance
            const createdNotes = [];
            for (const noteData of bulkNotes) {
                const response = await request(app)
                    .post('/api/notes')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send(noteData)
                    .expect(201);

                createdNotes.push(response.body.note._id);
            }

            const endTime = Date.now();
            const responseTime = endTime - startTime;
            const averageTime = responseTime / bulkNotes.length;

            expect(averageTime).toBeLessThan(300); // Average creation time should be under 300ms
            expect(createdNotes).toHaveLength(10);

            // Clean up
            await ClinicalNote.deleteMany({ _id: { $in: createdNotes } });
        });
    });

    describe('PUT /api/notes/:id - Update Performance', () => {
        it('should update notes efficiently', async () => {
            const noteId = noteIds[0];
            const updateData = {
                title: 'Updated Performance Test Note',
                content: {
                    subjective: 'Updated subjective content',
                    objective: 'Updated objective content',
                    assessment: 'Updated assessment content',
                    plan: 'Updated plan content',
                },
                priority: 'high',
            };

            const startTime = Date.now();

            const response = await request(app)
                .put(`/api/notes/${noteId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(400); // Note updates should be fast
            expect(response.body.note.title).toBe(updateData.title);
            expect(response.body.note.priority).toBe(updateData.priority);
        });
    });

    describe('Bulk Operations Performance', () => {
        it('should handle bulk updates efficiently', async () => {
            const noteIdsToUpdate = noteIds.slice(0, 50);
            const updateData = {
                noteIds: noteIdsToUpdate,
                updates: {
                    priority: 'high',
                    tags: ['bulk-updated'],
                },
            };

            const startTime = Date.now();

            const response = await request(app)
                .put('/api/notes/bulk')
                .set('Authorization', `Bearer ${authToken}`)
                .send(updateData)
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(2000); // Bulk update of 50 notes should complete within 2 seconds
            expect(response.body.updatedCount).toBe(50);
        });

        it('should handle bulk deletes efficiently', async () => {
            // Create some notes specifically for deletion testing
            const notesToDelete = [];
            for (let i = 0; i < 20; i++) {
                const note = new ClinicalNote({
                    patient: patientIds[0],
                    pharmacist: userId,
                    workplaceId,
                    title: `Delete Test Note ${i}`,
                    type: 'consultation',
                    priority: 'low',
                    content: {
                        subjective: 'Test content',
                        objective: 'Test content',
                        assessment: 'Test content',
                        plan: 'Test content',
                    },
                    createdBy: userId,
                    lastModifiedBy: userId,
                });
                await note.save();
                notesToDelete.push(note._id);
            }

            const startTime = Date.now();

            const response = await request(app)
                .delete('/api/notes/bulk')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ noteIds: notesToDelete })
                .expect(200);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(1500); // Bulk delete of 20 notes should complete within 1.5 seconds
            expect(response.body.deletedCount).toBe(20);

            // Verify notes are deleted
            const remainingNotes = await ClinicalNote.find({ _id: { $in: notesToDelete } });
            expect(remainingNotes).toHaveLength(0);
        });
    });

    describe('Database Query Optimization', () => {
        it('should use indexes effectively for common queries', async () => {
            // Test that queries use proper indexes by checking execution stats
            const explain: any = await ClinicalNote.find({
                workplaceId,
                type: 'consultation',
            }).explain('executionStats');

            // Should use index scan, not collection scan
            expect(explain.executionStats.executionSuccess).toBe(true);
            expect(explain.executionStats.totalDocsExamined).toBeLessThanOrEqual(
                explain.executionStats.totalDocsReturned * 2
            ); // Should not examine too many more docs than returned
        });

        it('should handle complex aggregation queries efficiently', async () => {
            const startTime = Date.now();

            // Complex aggregation for statistics
            const stats = await ClinicalNote.aggregate([
                { $match: { workplaceId } },
                {
                    $group: {
                        _id: {
                            type: '$type',
                            priority: '$priority',
                        },
                        count: { $sum: 1 },
                        avgFollowUpRequired: { $avg: { $cond: ['$followUpRequired', 1, 0] } },
                    },
                },
                { $sort: { count: -1 } },
            ]);

            const endTime = Date.now();
            const responseTime = endTime - startTime;

            expect(responseTime).toBeLessThan(1000); // Aggregation should complete within 1 second
            expect(stats.length).toBeGreaterThan(0);
        });
    });

    describe('Memory Usage and Resource Management', () => {
        it('should handle large result sets without memory issues', async () => {
            const initialMemory = process.memoryUsage();

            // Request a large dataset
            const response = await request(app)
                .get('/api/notes')
                .set('Authorization', `Bearer ${authToken}`)
                .query({
                    limit: 500, // Large page size
                })
                .expect(200);

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

            expect(response.body.notes).toHaveLength(500);
            expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Should not increase memory by more than 50MB
        });

        it('should properly clean up resources after requests', async () => {
            const initialMemory = process.memoryUsage();

            // Make multiple requests
            for (let i = 0; i < 10; i++) {
                await request(app)
                    .get('/api/notes')
                    .set('Authorization', `Bearer ${authToken}`)
                    .query({ limit: 50 })
                    .expect(200);
            }

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            const finalMemory = process.memoryUsage();
            const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

            // Memory should not continuously increase
            expect(memoryIncrease).toBeLessThan(20 * 1024 * 1024); // Should not increase by more than 20MB
        });
    });
});