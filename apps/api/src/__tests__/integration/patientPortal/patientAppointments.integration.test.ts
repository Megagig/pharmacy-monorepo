import request from 'supertest';
import { Express } from 'express';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../../app';
import User from '../../../models/User';
import PatientUser from '../../../models/PatientUser';
import Patient from '../../../models/Patient';
import Workplace from '../../../models/Workplace';
import Appointment from '../../../models/Appointment';
import PharmacistSchedule from '../../../models/PharmacistSchedule';
import { generateToken } from '../../../utils/token';

describe('Patient Appointments Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  let testApp: Express;
  let testWorkplace: any;
  let testPatient: any;
  let testPatientUser: any;
  let testPharmacist: any;
  let testAppointment: any;
  let testSchedule: any;
  let patientToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    testApp = app;
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Create test workplace
    testWorkplace = await Workplace.create({
      name: 'Test Pharmacy',
      email: 'admin@testpharmacy.com',
      phone: '+2348012345678',
      address: '123 Test Street, Lagos, Nigeria',
      state: 'Lagos',
      lga: 'Lagos Island',
      licenseNumber: 'PCN-TEST-001',
      isActive: true,
      subscriptionStatus: 'active'
    });

    // Create test pharmacist
    testPharmacist = await User.create({
      firstName: 'Dr. Jane',
      lastName: 'Pharmacist',
      email: 'pharmacist@testpharmacy.com',
      password: 'password123',
      role: 'pharmacist',
      workplaceId: testWorkplace._id,
      isEmailVerified: true,
      status: 'active'
    });

    // Create test patient
    testPatient = await Patient.create({
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male',
      phone: '+2348087654321',
      email: 'john.doe@example.com',
      address: '456 Patient Street, Lagos, Nigeria',
      state: 'Lagos',
      lga: 'Ikeja',
      workplaceId: testWorkplace._id
    });

    // Create test patient user
    testPatientUser = await PatientUser.create({
      email: 'john.doe@example.com',
      password: 'password123',
      patientId: testPatient._id,
      workplaceId: testWorkplace._id,
      status: 'active',
      isEmailVerified: true,
      notificationPreferences: {
        email: true,
        sms: true,
        push: true,
        appointmentReminders: true,
        medicationReminders: true,
        refillReminders: true
      }
    });

    // Create pharmacist schedule
    testSchedule = await PharmacistSchedule.create({
      pharmacistId: testPharmacist._id,
      workplaceId: testWorkplace._id,
      dayOfWeek: 1, // Monday
      startTime: '09:00',
      endTime: '17:00',
      isAvailable: true,
      appointmentDuration: 30,
      maxAppointments: 16,
      breakTimes: [
        { startTime: '12:00', endTime: '13:00', reason: 'Lunch break' }
      ]
    });

    // Create test appointment
    const appointmentDate = new Date();
    appointmentDate.setDate(appointmentDate.getDate() + 7); // Next week
    appointmentDate.setHours(10, 0, 0, 0); // 10:00 AM

    testAppointment = await Appointment.create({
      patientId: testPatient._id,
      pharmacistId: testPharmacist._id,
      workplaceId: testWorkplace._id,
      appointmentDate: appointmentDate,
      startTime: '10:00',
      endTime: '10:30',
      type: 'consultation',
      status: 'scheduled',
      reason: 'Medication review',
      notes: 'Patient wants to discuss side effects',
      isVirtual: false,
      createdBy: testPatientUser._id
    });

    // Generate patient token
    patientToken = generateToken(testPatientUser._id);
  });

  afterEach(async () => {
    await User.deleteMany({});
    await PatientUser.deleteMany({});
    await Patient.deleteMany({});
    await Workplace.deleteMany({});
    await Appointment.deleteMany({});
    await PharmacistSchedule.deleteMany({});
  });

  describe('Appointment Booking', () => {
    describe('GET /api/patient-portal/appointments/available-slots', () => {
      it('should return available appointment slots', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        const response = await request(testApp)
          .get(`/api/patient-portal/appointments/available-slots?date=${dateStr}&pharmacistId=${testPharmacist._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(Array.isArray(response.body.data.slots)).toBe(true);
      });

      it('should filter out unavailable slots', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        // Create an appointment to block a slot
        await Appointment.create({
          patientId: testPatient._id,
          pharmacistId: testPharmacist._id,
          workplaceId: testWorkplace._id,
          appointmentDate: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          status: 'scheduled',
          reason: 'Blocked slot',
          createdBy: testPatientUser._id
        });

        const response = await request(testApp)
          .get(`/api/patient-portal/appointments/available-slots?date=${dateStr}&pharmacistId=${testPharmacist._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        // The 10:00 slot should not be available
        const slots = response.body.data.slots;
        const blockedSlot = slots.find((slot: any) => slot.startTime === '10:00');
        expect(blockedSlot?.available).toBe(false);
      });

      it('should require authentication', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dateStr = tomorrow.toISOString().split('T')[0];

        await request(testApp)
          .get(`/api/patient-portal/appointments/available-slots?date=${dateStr}&pharmacistId=${testPharmacist._id}`)
          .expect(401);
      });

      it('should validate date parameter', async () => {
        const response = await request(testApp)
          .get(`/api/patient-portal/appointments/available-slots?date=invalid-date&pharmacistId=${testPharmacist._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('date');
      });

      it('should not allow booking in the past', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];

        const response = await request(testApp)
          .get(`/api/patient-portal/appointments/available-slots?date=${dateStr}&pharmacistId=${testPharmacist._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('past');
      });
    });

    describe('POST /api/patient-portal/appointments/book', () => {
      it('should book an appointment successfully', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const appointmentData = {
          pharmacistId: testPharmacist._id,
          appointmentDate: tomorrow.toISOString().split('T')[0],
          startTime: '14:00',
          type: 'consultation',
          reason: 'Medication consultation',
          notes: 'Need to discuss new prescription',
          isVirtual: false
        };

        const response = await request(testApp)
          .post('/api/patient-portal/appointments/book')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(appointmentData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('scheduled');
        expect(response.body.data.reason).toBe('Medication consultation');
        expect(response.body.data.patientId).toBe(testPatient._id.toString());
        expect(response.body.data.pharmacistId).toBe(testPharmacist._id.toString());
      });

      it('should validate appointment data', async () => {
        const invalidData = {
          pharmacistId: 'invalid-id',
          appointmentDate: 'invalid-date',
          startTime: '25:00', // Invalid time
          type: 'invalid-type'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/appointments/book')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('validation');
      });

      it('should prevent double booking', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const appointmentData = {
          pharmacistId: testPharmacist._id,
          appointmentDate: tomorrow.toISOString().split('T')[0],
          startTime: '14:00',
          type: 'consultation',
          reason: 'First appointment'
        };

        // Book first appointment
        await request(testApp)
          .post('/api/patient-portal/appointments/book')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(appointmentData)
          .expect(201);

        // Try to book same slot again
        const response = await request(testApp)
          .post('/api/patient-portal/appointments/book')
          .set('Cookie', `patientToken=${patientToken}`)
          .send({ ...appointmentData, reason: 'Second appointment' })
          .expect(409);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not available');
      });

      it('should prevent booking outside business hours', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const appointmentData = {
          pharmacistId: testPharmacist._id,
          appointmentDate: tomorrow.toISOString().split('T')[0],
          startTime: '18:00', // After business hours (17:00)
          type: 'consultation',
          reason: 'After hours appointment'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/appointments/book')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(appointmentData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('business hours');
      });

      it('should prevent booking during break times', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const appointmentData = {
          pharmacistId: testPharmacist._id,
          appointmentDate: tomorrow.toISOString().split('T')[0],
          startTime: '12:30', // During lunch break (12:00-13:00)
          type: 'consultation',
          reason: 'Break time appointment'
        };

        const response = await request(testApp)
          .post('/api/patient-portal/appointments/book')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(appointmentData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('not available');
      });

      it('should handle virtual appointments', async () => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const appointmentData = {
          pharmacistId: testPharmacist._id,
          appointmentDate: tomorrow.toISOString().split('T')[0],
          startTime: '15:00',
          type: 'consultation',
          reason: 'Virtual consultation',
          isVirtual: true
        };

        const response = await request(testApp)
          .post('/api/patient-portal/appointments/book')
          .set('Cookie', `patientToken=${patientToken}`)
          .send(appointmentData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.isVirtual).toBe(true);
        expect(response.body.data.meetingLink).toBeDefined();
      });
    });
  });

  describe('Appointment Management', () => {
    describe('GET /api/patient-portal/appointments', () => {
      it('should return patient appointments', async () => {
        const response = await request(testApp)
          .get('/api/patient-portal/appointments')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].reason).toBe('Medication review');
        expect(response.body.data[0].status).toBe('scheduled');
      });

      it('should filter appointments by status', async () => {
        // Create completed appointment
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 7);
        
        await Appointment.create({
          patientId: testPatient._id,
          pharmacistId: testPharmacist._id,
          workplaceId: testWorkplace._id,
          appointmentDate: pastDate,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          status: 'completed',
          reason: 'Past appointment',
          createdBy: testPatientUser._id
        });

        const response = await request(testApp)
          .get('/api/patient-portal/appointments?status=scheduled')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].status).toBe('scheduled');
      });

      it('should filter appointments by date range', async () => {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() + 5);
        const toDate = new Date();
        toDate.setDate(toDate.getDate() + 10);

        const response = await request(testApp)
          .get(`/api/patient-portal/appointments?fromDate=${fromDate.toISOString().split('T')[0]}&toDate=${toDate.toISOString().split('T')[0]}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(1);
      });

      it('should paginate results', async () => {
        // Create additional appointments
        for (let i = 1; i <= 5; i++) {
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + i + 7);
          
          await Appointment.create({
            patientId: testPatient._id,
            pharmacistId: testPharmacist._id,
            workplaceId: testWorkplace._id,
            appointmentDate: futureDate,
            startTime: '10:00',
            endTime: '10:30',
            type: 'consultation',
            status: 'scheduled',
            reason: `Appointment ${i}`,
            createdBy: testPatientUser._id
          });
        }

        const response = await request(testApp)
          .get('/api/patient-portal/appointments?limit=3&page=1')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data).toHaveLength(3);
        expect(response.body.pagination.totalPages).toBeGreaterThan(1);
      });

      it('should sort appointments by date (upcoming first)', async () => {
        // Create appointment for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        await Appointment.create({
          patientId: testPatient._id,
          pharmacistId: testPharmacist._id,
          workplaceId: testWorkplace._id,
          appointmentDate: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          status: 'scheduled',
          reason: 'Tomorrow appointment',
          createdBy: testPatientUser._id
        });

        const response = await request(testApp)
          .get('/api/patient-portal/appointments')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.data).toHaveLength(2);
        // Tomorrow's appointment should come first
        expect(response.body.data[0].reason).toBe('Tomorrow appointment');
        expect(response.body.data[1].reason).toBe('Medication review');
      });
    });

    describe('GET /api/patient-portal/appointments/:appointmentId', () => {
      it('should return appointment details', async () => {
        const response = await request(testApp)
          .get(`/api/patient-portal/appointments/${testAppointment._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.reason).toBe('Medication review');
        expect(response.body.data.pharmacist).toBeDefined();
        expect(response.body.data.pharmacist.firstName).toBe('Dr. Jane');
      });

      it('should return 404 for non-existent appointment', async () => {
        const nonExistentId = new mongoose.Types.ObjectId();
        
        await request(testApp)
          .get(`/api/patient-portal/appointments/${nonExistentId}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(404);
      });

      it('should not allow access to other patients appointments', async () => {
        // Create another patient and appointment
        const otherPatient = await Patient.create({
          firstName: 'Other',
          lastName: 'Patient',
          dateOfBirth: new Date('1985-01-01'),
          gender: 'female',
          phone: '+2348087654999',
          email: 'other@example.com',
          workplaceId: testWorkplace._id
        });

        const otherPatientUser = await PatientUser.create({
          email: 'other@example.com',
          password: 'password123',
          patientId: otherPatient._id,
          workplaceId: testWorkplace._id,
          status: 'active',
          isEmailVerified: true
        });

        const otherAppointment = await Appointment.create({
          patientId: otherPatient._id,
          pharmacistId: testPharmacist._id,
          workplaceId: testWorkplace._id,
          appointmentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          startTime: '11:00',
          endTime: '11:30',
          type: 'consultation',
          status: 'scheduled',
          reason: 'Other patient appointment',
          createdBy: otherPatientUser._id
        });

        // Try to access other patient's appointment
        await request(testApp)
          .get(`/api/patient-portal/appointments/${otherAppointment._id}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(404);
      });
    });

    describe('PUT /api/patient-portal/appointments/:appointmentId/reschedule', () => {
      it('should reschedule appointment successfully', async () => {
        const newDate = new Date();
        newDate.setDate(newDate.getDate() + 14); // Two weeks from now
        
        const rescheduleData = {
          appointmentDate: newDate.toISOString().split('T')[0],
          startTime: '15:00',
          reason: 'Schedule conflict'
        };

        const response = await request(testApp)
          .put(`/api/patient-portal/appointments/${testAppointment._id}/reschedule`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(rescheduleData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.startTime).toBe('15:00');
        expect(response.body.data.status).toBe('rescheduled');
      });

      it('should validate reschedule data', async () => {
        const invalidData = {
          appointmentDate: 'invalid-date',
          startTime: '25:00'
        };

        const response = await request(testApp)
          .put(`/api/patient-portal/appointments/${testAppointment._id}/reschedule`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(invalidData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('validation');
      });

      it('should not allow rescheduling past appointments', async () => {
        // Create past appointment
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);
        
        const pastAppointment = await Appointment.create({
          patientId: testPatient._id,
          pharmacistId: testPharmacist._id,
          workplaceId: testWorkplace._id,
          appointmentDate: pastDate,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          status: 'completed',
          reason: 'Past appointment',
          createdBy: testPatientUser._id
        });

        const rescheduleData = {
          appointmentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          startTime: '15:00'
        };

        const response = await request(testApp)
          .put(`/api/patient-portal/appointments/${pastAppointment._id}/reschedule`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(rescheduleData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('cannot reschedule');
      });

      it('should not allow rescheduling within 24 hours', async () => {
        // Create appointment for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const tomorrowAppointment = await Appointment.create({
          patientId: testPatient._id,
          pharmacistId: testPharmacist._id,
          workplaceId: testWorkplace._id,
          appointmentDate: tomorrow,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          status: 'scheduled',
          reason: 'Tomorrow appointment',
          createdBy: testPatientUser._id
        });

        const rescheduleData = {
          appointmentDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          startTime: '15:00'
        };

        const response = await request(testApp)
          .put(`/api/patient-portal/appointments/${tomorrowAppointment._id}/reschedule`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(rescheduleData)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('24 hours');
      });
    });

    describe('DELETE /api/patient-portal/appointments/:appointmentId/cancel', () => {
      it('should cancel appointment successfully', async () => {
        const cancelData = {
          reason: 'Personal emergency'
        };

        const response = await request(testApp)
          .delete(`/api/patient-portal/appointments/${testAppointment._id}/cancel`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send(cancelData)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('cancelled');
        expect(response.body.data.cancellationReason).toBe('Personal emergency');
      });

      it('should not allow cancelling within 2 hours', async () => {
        // Create appointment for in 1 hour
        const soonDate = new Date();
        soonDate.setHours(soonDate.getHours() + 1);
        
        const soonAppointment = await Appointment.create({
          patientId: testPatient._id,
          pharmacistId: testPharmacist._id,
          workplaceId: testWorkplace._id,
          appointmentDate: soonDate,
          startTime: soonDate.toTimeString().slice(0, 5),
          endTime: new Date(soonDate.getTime() + 30 * 60000).toTimeString().slice(0, 5),
          type: 'consultation',
          status: 'scheduled',
          reason: 'Soon appointment',
          createdBy: testPatientUser._id
        });

        const response = await request(testApp)
          .delete(`/api/patient-portal/appointments/${soonAppointment._id}/cancel`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send({ reason: 'Too late to cancel' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('2 hours');
      });

      it('should not allow cancelling already cancelled appointments', async () => {
        // Cancel the appointment first
        await Appointment.findByIdAndUpdate(testAppointment._id, {
          status: 'cancelled',
          cancellationReason: 'Already cancelled'
        });

        const response = await request(testApp)
          .delete(`/api/patient-portal/appointments/${testAppointment._id}/cancel`)
          .set('Cookie', `patientToken=${patientToken}`)
          .send({ reason: 'Double cancel' })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('already cancelled');
      });
    });
  });

  describe('Appointment History', () => {
    describe('GET /api/patient-portal/appointments/history', () => {
      it('should return appointment history', async () => {
        // Create past appointments
        const pastDate1 = new Date();
        pastDate1.setDate(pastDate1.getDate() - 30);
        
        const pastDate2 = new Date();
        pastDate2.setDate(pastDate2.getDate() - 60);

        await Appointment.create({
          patientId: testPatient._id,
          pharmacistId: testPharmacist._id,
          workplaceId: testWorkplace._id,
          appointmentDate: pastDate1,
          startTime: '10:00',
          endTime: '10:30',
          type: 'consultation',
          status: 'completed',
          reason: 'Past appointment 1',
          createdBy: testPatientUser._id
        });

        await Appointment.create({
          patientId: testPatient._id,
          pharmacistId: testPharmacist._id,
          workplaceId: testWorkplace._id,
          appointmentDate: pastDate2,
          startTime: '14:00',
          endTime: '14:30',
          type: 'follow-up',
          status: 'completed',
          reason: 'Past appointment 2',
          createdBy: testPatientUser._id
        });

        const response = await request(testApp)
          .get('/api/patient-portal/appointments/history')
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(2);
        
        // Should be sorted by date (most recent first)
        expect(response.body.data[0].reason).toBe('Past appointment 1');
        expect(response.body.data[1].reason).toBe('Past appointment 2');
      });

      it('should filter history by date range', async () => {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 45);
        const toDate = new Date();
        toDate.setDate(toDate.getDate() - 15);

        const response = await request(testApp)
          .get(`/api/patient-portal/appointments/history?fromDate=${fromDate.toISOString().split('T')[0]}&toDate=${toDate.toISOString().split('T')[0]}`)
          .set('Cookie', `patientToken=${patientToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should apply rate limiting to appointment booking', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const appointmentData = {
        pharmacistId: testPharmacist._id,
        appointmentDate: tomorrow.toISOString().split('T')[0],
        startTime: '14:00',
        type: 'consultation',
        reason: 'Rate limit test'
      };

      // Make multiple booking requests quickly
      const requests = Array(10).fill(null).map((_, i) => 
        request(testApp)
          .post('/api/patient-portal/appointments/book')
          .set('Cookie', `patientToken=${patientToken}`)
          .send({ ...appointmentData, startTime: `${14 + i}:00` })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should sanitize input data', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const maliciousData = {
        pharmacistId: testPharmacist._id,
        appointmentDate: tomorrow.toISOString().split('T')[0],
        startTime: '14:00',
        type: 'consultation',
        reason: '<script>alert("xss")</script>Clean reason',
        notes: 'Clean notes<img src=x onerror=alert(1)>'
      };

      const response = await request(testApp)
        .post('/api/patient-portal/appointments/book')
        .set('Cookie', `patientToken=${patientToken}`)
        .send(maliciousData)
        .expect(201);

      expect(response.body.data.reason).not.toContain('<script>');
      expect(response.body.data.notes).not.toContain('<img');
    });

    it('should validate workspace context', async () => {
      // Create pharmacist in different workplace
      const differentWorkplace = await Workplace.create({
        name: 'Different Pharmacy',
        email: 'admin@different.com',
        phone: '+2348012345679',
        address: '789 Different Street, Lagos, Nigeria',
        state: 'Lagos',
        lga: 'Ikeja',
        licenseNumber: 'PCN-DIFF-001',
        isActive: true,
        subscriptionStatus: 'active'
      });

      const differentPharmacist = await User.create({
        firstName: 'Different',
        lastName: 'Pharmacist',
        email: 'different@pharmacy.com',
        password: 'password123',
        role: 'pharmacist',
        workplaceId: differentWorkplace._id,
        isEmailVerified: true,
        status: 'active'
      });

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const appointmentData = {
        pharmacistId: differentPharmacist._id, // Different workplace
        appointmentDate: tomorrow.toISOString().split('T')[0],
        startTime: '14:00',
        type: 'consultation',
        reason: 'Cross-workplace booking'
      };

      const response = await request(testApp)
        .post('/api/patient-portal/appointments/book')
        .set('Cookie', `patientToken=${patientToken}`)
        .send(appointmentData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('workplace');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid appointment IDs', async () => {
      const invalidId = 'invalid-object-id';
      
      await request(testApp)
        .get(`/api/patient-portal/appointments/${invalidId}`)
        .set('Cookie', `patientToken=${patientToken}`)
        .expect(400);
    });

    it('should handle missing required fields', async () => {
      const response = await request(testApp)
        .post('/api/patient-portal/appointments/book')
        .set('Cookie', `patientToken=${patientToken}`)
        .send({}) // Missing required fields
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('validation');
    });

    it('should handle pharmacist not found', async () => {
      const nonExistentPharmacistId = new mongoose.Types.ObjectId();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const appointmentData = {
        pharmacistId: nonExistentPharmacistId,
        appointmentDate: tomorrow.toISOString().split('T')[0],
        startTime: '14:00',
        type: 'consultation',
        reason: 'Non-existent pharmacist'
      };

      const response = await request(testApp)
        .post('/api/patient-portal/appointments/book')
        .set('Cookie', `patientToken=${patientToken}`)
        .send(appointmentData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('pharmacist not found');
    });
  });
});