import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../app';
import { connectTestDB, disconnectTestDB, clearTestDB } from '../helpers/testDb';
import Appointment from '../../models/Appointment';
import FollowUpTask from '../../models/FollowUpTask';
import PharmacistSchedule from '../../models/PharmacistSchedule';
import { User } from '../../models/User';
import { Workplace } from '../../models/Workplace';
import { generateToken } from '../../utils/token';
import { addDays, subDays, format } from 'date-fns';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { it } from 'zod/v4/locales';
import { describe } from 'node:test';
import { afterEach } from 'node:test';
import { beforeEach } from 'node:test';
import { describe } from 'node:test';

describe('Appointment Analytics Routes', () => {
  let authToken: string;
  let testUser: any;
  let testWorkplace: any;
  let testPharmacist: any;
  let testPatient: any;

  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    // Create test workplace
    testWorkplace = await Workplace.create({
      name: 'Test Pharmacy',
      address: '123 Test St',
      phone: '+1234567890',
      email: 'test@pharmacy.com',
      licenseNumber: 'TEST123',
      isActive: true
    });

    // Create test user (pharmacist)
    testUser = await User.create({
      firstName: 'Test',
      lastName: 'Pharmacist',
      email: 'pharmacist@test.com',
      password: 'password123',
      role: 'pharmacist',
      workplaceId: testWorkplace._id,
      isActive: true,
      permissions: [
        'view_appointment_analytics',
        'view_followup_analytics',
        'view_reminder_analytics',
        'view_capacity_analytics',
        'export_analytics'
      ]
    });

    // Create another pharmacist for testing
    testPharmacist = await User.create({
      firstName: 'Another',
      lastName: 'Pharmacist',
      email: 'pharmacist2@test.com',
      password: 'password123',
      role: 'pharmacist',
      workplaceId: testWorkplace._id,
      isActive: true
    });

    // Create test patient
    testPatient = {
      _id: new mongoose.Types.ObjectId(),
      firstName: 'Test',
      lastName: 'Patient',
      email: 'patient@test.com'
    };

    authToken = generateToken(testUser._id, testWorkplace._id);

    // Create test data
    await createTestAppointments();
    await createTestFollowUpTasks();
    await createTestPharmacistSchedule();
  });

  afterEach(async () => {
    await clearTestDB();
  });

  async function createTestAppointments() {
    const appointments = [
      {
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'mtm_session',
        title: 'MTM Session',
        scheduledDate: new Date(),
        scheduledTime: '10:00',
        duration: 30,
        status: 'completed',
        createdBy: testUser._id
      },
      {
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'health_check',
        title: 'Health Check',
        scheduledDate: subDays(new Date(), 1),
        scheduledTime: '14:00',
        duration: 45,
        status: 'completed',
        createdBy: testUser._id
      },
      {
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        assignedTo: testPharmacist._id,
        type: 'vaccination',
        title: 'Vaccination',
        scheduledDate: subDays(new Date(), 2),
        scheduledTime: '09:00',
        duration: 15,
        status: 'cancelled',
        cancellationReason: 'Patient rescheduled',
        createdBy: testUser._id
      },
      {
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'chronic_disease_review',
        title: 'Diabetes Review',
        scheduledDate: addDays(new Date(), 1),
        scheduledTime: '11:00',
        duration: 60,
        status: 'scheduled',
        reminders: [
          {
            type: 'email',
            scheduledFor: addDays(new Date(), 1),
            sent: false,
            deliveryStatus: 'pending'
          }
        ],
        createdBy: testUser._id
      }
    ];

    await Appointment.insertMany(appointments);
  }

  async function createTestFollowUpTasks() {
    const tasks = [
      {
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'medication_start_followup',
        title: 'New Medication Follow-up',
        description: 'Follow up on new diabetes medication',
        objectives: ['Check for side effects', 'Assess effectiveness'],
        priority: 'high',
        dueDate: addDays(new Date(), 3),
        status: 'pending',
        trigger: {
          type: 'medication_start',
          triggerDate: new Date()
        },
        createdBy: testUser._id
      },
      {
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        assignedTo: testPharmacist._id,
        type: 'adherence_check',
        title: 'Adherence Check',
        description: 'Check medication adherence',
        objectives: ['Review medication taking patterns'],
        priority: 'medium',
        dueDate: subDays(new Date(), 1),
        status: 'overdue',
        trigger: {
          type: 'scheduled_monitoring',
          triggerDate: subDays(new Date(), 7)
        },
        createdBy: testUser._id
      },
      {
        workplaceId: testWorkplace._id,
        patientId: testPatient._id,
        assignedTo: testUser._id,
        type: 'lab_result_review',
        title: 'Lab Results Review',
        description: 'Review recent lab results',
        objectives: ['Analyze results', 'Adjust therapy if needed'],
        priority: 'urgent',
        dueDate: subDays(new Date(), 2),
        status: 'completed',
        completedAt: subDays(new Date(), 1),
        completedBy: testUser._id,
        outcome: {
          status: 'successful',
          notes: 'Results reviewed, therapy adjusted',
          nextActions: ['Schedule follow-up in 3 months'],
          appointmentCreated: false
        },
        trigger: {
          type: 'lab_result',
          triggerDate: subDays(new Date(), 3)
        },
        createdBy: testUser._id
      }
    ];

    await FollowUpTask.insertMany(tasks);
  }

  async function createTestPharmacistSchedule() {
    const schedule = {
      workplaceId: testWorkplace._id,
      pharmacistId: testUser._id,
      workingHours: [
        {
          dayOfWeek: 1, // Monday
          isWorkingDay: true,
          shifts: [
            {
              startTime: '09:00',
              endTime: '17:00',
              breakStart: '12:00',
              breakEnd: '13:00'
            }
          ]
        },
        {
          dayOfWeek: 2, // Tuesday
          isWorkingDay: true,
          shifts: [
            {
              startTime: '09:00',
              endTime: '17:00'
            }
          ]
        }
      ],
      appointmentPreferences: {
        appointmentTypes: ['mtm_session', 'health_check', 'chronic_disease_review'],
        defaultDuration: 30,
        maxAppointmentsPerDay: 16
      },
      capacityStats: {
        totalSlotsAvailable: 16,
        slotsBooked: 8,
        utilizationRate: 50,
        lastCalculatedAt: new Date()
      },
      isActive: true,
      effectiveFrom: subDays(new Date(), 30),
      createdBy: testUser._id
    };

    await PharmacistSchedule.create(schedule);
  }

  describe('GET /api/appointments/analytics', () => {
    it('should return appointment analytics successfully', async () => {
      const response = await request(app)
        .get('/api/appointments/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('byType');
      expect(response.body.data).toHaveProperty('byStatus');
      expect(response.body.data).toHaveProperty('trends');
      expect(response.body.data).toHaveProperty('peakTimes');
      expect(response.body.data).toHaveProperty('pharmacistPerformance');

      // Check summary structure
      expect(response.body.data.summary).toHaveProperty('totalAppointments');
      expect(response.body.data.summary).toHaveProperty('completionRate');
      expect(response.body.data.summary).toHaveProperty('noShowRate');
      expect(response.body.data.summary).toHaveProperty('cancellationRate');

      // Verify data accuracy
      expect(response.body.data.summary.totalAppointments).toBeGreaterThan(0);
    });

    it('should filter by date range', async () => {
      const startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const endDate = format(new Date(), 'yyyy-MM-dd');

      const response = await request(app)
        .get(`/api/appointments/analytics?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalAppointments).toBeGreaterThan(0);
    });

    it('should filter by pharmacist', async () => {
      const response = await request(app)
        .get(`/api/appointments/analytics?pharmacistId=${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary.totalAppointments).toBeGreaterThan(0);
    });

    it('should filter by appointment type', async () => {
      const response = await request(app)
        .get('/api/appointments/analytics?appointmentType=mtm_session')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.byType).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'mtm_session'
          })
        ])
      );
    });

    it('should return 400 for invalid date range', async () => {
      const response = await request(app)
        .get('/api/appointments/analytics?startDate=invalid-date')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/appointments/analytics')
        .expect(401);
    });

    it('should return 403 without proper permissions', async () => {
      // Create user without analytics permissions
      const limitedUser = await User.create({
        firstName: 'Limited',
        lastName: 'User',
        email: 'limited@test.com',
        password: 'password123',
        role: 'staff',
        workplaceId: testWorkplace._id,
        isActive: true,
        permissions: ['view_appointments'] // Missing analytics permission
      });

      const limitedToken = generateToken(limitedUser._id, testWorkplace._id);

      await request(app)
        .get('/api/appointments/analytics')
        .set('Authorization', `Bearer ${limitedToken}`)
        .expect(403);
    });
  });

  describe('GET /api/follow-ups/analytics', () => {
    it('should return follow-up analytics successfully', async () => {
      const response = await request(app)
        .get('/api/follow-ups/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('byType');
      expect(response.body.data).toHaveProperty('byPriority');
      expect(response.body.data).toHaveProperty('byTrigger');
      expect(response.body.data).toHaveProperty('trends');
      expect(response.body.data).toHaveProperty('escalationMetrics');

      // Check summary structure
      expect(response.body.data.summary).toHaveProperty('totalTasks');
      expect(response.body.data.summary).toHaveProperty('completionRate');
      expect(response.body.data.summary).toHaveProperty('averageTimeToCompletion');
      expect(response.body.data.summary).toHaveProperty('overdueCount');

      // Verify data accuracy
      expect(response.body.data.summary.totalTasks).toBeGreaterThan(0);
      expect(response.body.data.summary.overdueCount).toBeGreaterThan(0);
    });

    it('should filter by task type', async () => {
      const response = await request(app)
        .get('/api/follow-ups/analytics?taskType=medication_start_followup')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.byType).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'medication_start_followup'
          })
        ])
      );
    });

    it('should filter by priority', async () => {
      const response = await request(app)
        .get('/api/follow-ups/analytics?priority=high')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.byPriority).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            priority: 'high'
          })
        ])
      );
    });
  });

  describe('GET /api/reminders/analytics', () => {
    it('should return reminder analytics successfully', async () => {
      const response = await request(app)
        .get('/api/reminders/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('byChannel');
      expect(response.body.data).toHaveProperty('byTiming');
      expect(response.body.data).toHaveProperty('templatePerformance');
      expect(response.body.data).toHaveProperty('trends');

      // Check summary structure
      expect(response.body.data.summary).toHaveProperty('totalReminders');
      expect(response.body.data.summary).toHaveProperty('deliverySuccessRate');
    });

    it('should filter by channel', async () => {
      const response = await request(app)
        .get('/api/reminders/analytics?channel=email')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/schedules/capacity', () => {
    it('should return capacity analytics successfully', async () => {
      const response = await request(app)
        .get('/api/schedules/capacity')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('overall');
      expect(response.body.data).toHaveProperty('byPharmacist');
      expect(response.body.data).toHaveProperty('byDay');
      expect(response.body.data).toHaveProperty('byHour');
      expect(response.body.data).toHaveProperty('recommendations');

      // Check overall structure
      expect(response.body.data.overall).toHaveProperty('totalSlots');
      expect(response.body.data.overall).toHaveProperty('bookedSlots');
      expect(response.body.data.overall).toHaveProperty('utilizationRate');
      expect(response.body.data.overall).toHaveProperty('availableSlots');
    });

    it('should filter by pharmacist', async () => {
      const response = await request(app)
        .get(`/api/schedules/capacity?pharmacistId=${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.byPharmacist).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            pharmacistId: testUser._id.toString()
          })
        ])
      );
    });
  });

  describe('POST /api/appointments/analytics/export', () => {
    it('should export analytics as PDF', async () => {
      const response = await request(app)
        .post('/api/appointments/analytics/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'pdf',
          reportType: 'appointments'
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should export analytics as Excel', async () => {
      const response = await request(app)
        .post('/api/appointments/analytics/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'excel',
          reportType: 'appointments'
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('should return 400 for invalid export format', async () => {
      const response = await request(app)
        .post('/api/appointments/analytics/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'invalid'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should respect rate limiting for exports', async () => {
      // Make multiple export requests quickly
      const promises = Array.from({ length: 12 }, () =>
        request(app)
          .post('/api/appointments/analytics/export')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ format: 'pdf' })
      );

      const responses = await Promise.allSettled(promises);
      
      // Some requests should be rate limited (429)
      const rateLimitedResponses = responses.filter(
        (result) => result.status === 'fulfilled' && result.value.status === 429
      );
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Mock a database error
      jest.spyOn(Appointment, 'find').mockImplementationOnce(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/api/appointments/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Failed to retrieve appointment analytics');
    });

    it('should handle invalid ObjectId parameters', async () => {
      const response = await request(app)
        .get('/api/appointments/analytics?pharmacistId=invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle date range validation', async () => {
      const startDate = format(new Date(), 'yyyy-MM-dd');
      const endDate = format(subDays(new Date(), 1), 'yyyy-MM-dd'); // End before start

      const response = await request(app)
        .get(`/api/appointments/analytics?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should complete analytics request within reasonable time', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/api/appointments/analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle large date ranges efficiently', async () => {
      const startDate = format(subDays(new Date(), 365), 'yyyy-MM-dd'); // 1 year ago
      const endDate = format(new Date(), 'yyyy-MM-dd');

      const startTime = Date.now();
      
      await request(app)
        .get(`/api/appointments/analytics?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds even for large ranges
    });
  });
});