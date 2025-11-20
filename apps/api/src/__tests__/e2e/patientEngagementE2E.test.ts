/**
 * End-to-End Tests for Patient Engagement & Follow-up Management
 * 
 * This test suite covers complete user workflows from start to finish:
 * - Complete appointment lifecycle (create → confirm → complete → visit)
 * - Follow-up workflow (create → escalate → convert → complete)
 * - Recurring appointment series
 * - Patient portal booking flow
 * - Reminder delivery and confirmation
 * - Integration with existing modules
 * 
 * Requirements: All requirements from Patient Engagement & Follow-up Management spec
 */

import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../../app';
import User from '../../models/User';
import Patient from '../../models/Patient';
import Appointment from '../../models/Appointment';
import FollowUpTask from '../../models/FollowUpTask';
import PharmacistSchedule from '../../models/PharmacistSchedule';
import ReminderTemplate from '../../models/ReminderTemplate';
import Workplace from '../../models/Workplace';
import Visit from '../../models/Visit';
import MedicationTherapyReview from '../../models/MedicationTherapyReview';
import ClinicalIntervention from '../../models/ClinicalIntervention';
import DiagnosticCase from '../../models/DiagnosticCase';
import Notification from '../../models/Notification';
import { generateTestToken, createTestUserData, createTestPatientData } from '../utils/testHelpers';
import jwt from 'jsonwebtoken';

describe('Patient Engagement & Follow-up Management E2E Tests', () => {
  let mongoServer: MongoMemoryServer;
  let workplaceId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let pharmacistToken: string;
  let patientToken: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear all collections
    await Promise.all([
      User.deleteMany({}),
      Patient.deleteMany({}),
      Appointment.deleteMany({}),
      FollowUpTask.deleteMany({}),
      PharmacistSchedule.deleteMany({}),
      ReminderTemplate.deleteMany({}),
      Workplace.deleteMany({}),
      Visit.deleteMany({}),
      MedicationTherapyReview.deleteMany({}),
      ClinicalIntervention.deleteMany({}),
      DiagnosticCase.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    workplaceId = new mongoose.Types.ObjectId();

    // Create workplace
    await Workplace.create({
      _id: workplaceId,
      name: 'Test Pharmacy',
      type: 'pharmacy',
      address: '123 Test Street, Lagos, Nigeria',
      phone: '+234-800-123-4567',
      email: 'test@pharmacy.com',
      isActive: true,
    });

    // Create pharmacist
    const pharmacist = new User({
      ...createTestUserData({
        email: 'pharmacist@test.com',
        role: 'pharmacist',
        workplaceRole: 'Pharmacist',
      }),
      workplaceId,
      _id: new mongoose.Types.ObjectId(),
    });
    await pharmacist.save();
    pharmacistId = pharmacist._id;
    pharmacistToken = generateTestToken(pharmacist);

    // Create patient
    const patient = new Patient({
      ...createTestPatientData(workplaceId.toString(), {
        email: 'patient@test.com',
        mrn: 'E2E001',
        phone: '+234-800-001-0001',
      }),
      _id: new mongoose.Types.ObjectId(),
      createdBy: pharmacistId,
      appointmentPreferences: {
        preferredDays: [1, 2, 3, 4, 5], // Monday to Friday
        preferredTimeSlots: [{ start: '09:00', end: '17:00' }],
        reminderPreferences: {
          email: true,
          sms: true,
          push: false,
          whatsapp: false,
        },
        language: 'en',
        timezone: 'Africa/Lagos',
      },
    });
    await patient.save();
    patientId = patient._id;

    // Create patient token for portal access
    patientToken = jwt.sign(
      { 
        userId: patientId, 
        workplaceId, 
        type: 'patient',
        email: patient.email 
      },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create pharmacist schedule
    await PharmacistSchedule.create({
      workplaceId,
      pharmacistId,
      workingHours: [
        {
          dayOfWeek: 1, // Monday
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' }],
        },
        {
          dayOfWeek: 2, // Tuesday
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' }],
        },
        {
          dayOfWeek: 3, // Wednesday
          isWorkingDay: true,
          shifts: [{ startTime: '09:00', endTime: '17:00', breakStart: '12:00', breakEnd: '13:00' }],
        },
      ],
      appointmentPreferences: {
        maxAppointmentsPerDay: 20,
        appointmentTypes: ['mtm_session', 'health_check', 'chronic_disease_review'],
        defaultDuration: 30,
        bufferBetweenAppointments: 5,
      },
      isActive: true,
      effectiveFrom: new Date(),
      createdBy: pharmacistId,
    });

    // Create reminder templates
    await ReminderTemplate.create({
      workplaceId,
      name: '24h Appointment Reminder',
      type: 'appointment',
      category: 'pre_appointment',
      channels: ['email', 'sms'],
      timing: {
        unit: 'hours',
        value: 24,
        relativeTo: 'before_appointment',
      },
      messageTemplates: {
        email: {
          subject: 'Appointment Reminder - {{appointmentDate}}',
          body: 'Dear {{patientName}}, you have an appointment tomorrow at {{appointmentTime}}.',
        },
        sms: {
          message: 'Reminder: Appointment at {{pharmacyName}} on {{appointmentDate}} at {{appointmentTime}}',
        },
      },
      isActive: true,
      isDefault: true,
      createdBy: pharmacistId,
    });
  });

  describe('Complete Appointment Lifecycle E2E', () => {
    it('should complete full appointment lifecycle: create → confirm → complete → visit', async () => {
      // Step 1: Pharmacist creates appointment
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const appointmentDate = tomorrow.toISOString().split('T')[0];

      const appointmentData = {
        patientId: patientId.toString(),
        type: 'mtm_session',
        title: 'Medication Therapy Management Session',
        description: 'Comprehensive medication review and counseling',
        scheduledDate: appointmentDate,
        scheduledTime: '10:00',
        duration: 60,
        assignedTo: pharmacistId.toString(),
        patientPreferences: {
          preferredChannel: 'email',
          language: 'en',
          specialRequirements: 'Patient prefers morning appointments',
        },
      };

      const createResponse = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(appointmentData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.success).toBe(true);
      
      const appointmentId = createResponse.body.data.appointment._id;
      expect(createResponse.body.data.appointment.status).toBe('scheduled');
      expect(createResponse.body.data.reminders).toHaveLength(3); // 24h, 2h, 15min

      // Step 2: Patient confirms appointment via portal
      const confirmResponse = await request(app)
        .post(`/api/patient-portal/appointments/${appointmentId}/confirm`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          patientNotes: 'Looking forward to reviewing my medications',
          specialRequirements: 'Please have my medication list ready',
        });

      expect(confirmResponse.status).toBe(200);
      expect(confirmResponse.body.data.confirmationStatus).toBe('confirmed');
      expect(confirmResponse.body.data.confirmedAt).toBeTruthy();

      // Step 3: Pharmacist marks appointment as in progress
      const inProgressResponse = await request(app)
        .patch(`/api/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({ status: 'in_progress' });

      expect(inProgressResponse.status).toBe(200);
      expect(inProgressResponse.body.data.status).toBe('in_progress');

      // Step 4: Pharmacist completes appointment
      const completionData = {
        status: 'completed',
        outcome: {
          status: 'successful',
          notes: 'Patient education provided on medication adherence. Identified potential drug interaction.',
          nextActions: [
            'Schedule follow-up in 2 weeks',
            'Monitor blood pressure',
            'Adjust medication timing',
          ],
          visitCreated: true,
        },
      };

      const completeResponse = await request(app)
        .patch(`/api/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(completionData);

      expect(completeResponse.status).toBe(200);
      expect(completeResponse.body.data.status).toBe('completed');
      expect(completeResponse.body.data.completedAt).toBeTruthy();
      expect(completeResponse.body.data.outcome).toBeDefined();

      // Step 5: Verify visit was created from appointment
      if (completionData.outcome.visitCreated) {
        const visitResponse = await request(app)
          .post('/api/visits')
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send({
            patientId: patientId.toString(),
            appointmentId: appointmentId,
            visitType: 'mtm_session',
            chiefComplaint: 'Medication review and counseling',
            assessment: 'Patient education provided on medication adherence',
            plan: 'Follow-up in 2 weeks, monitor blood pressure',
            notes: completionData.outcome.notes,
          });

        expect(visitResponse.status).toBe(201);
        expect(visitResponse.body.data.appointmentId).toBe(appointmentId);

        // Verify appointment is linked to visit
        const updatedAppointment = await Appointment.findById(appointmentId);
        expect(updatedAppointment!.outcome!.visitId).toBeTruthy();
      }

      // Step 6: Verify appointment timeline and audit trail
      const timelineResponse = await request(app)
        .get(`/api/appointments/${appointmentId}/timeline`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(timelineResponse.status).toBe(200);
      expect(timelineResponse.body.data.timeline).toContainEqual(
        expect.objectContaining({
          action: 'created',
          timestamp: expect.any(String),
          userId: pharmacistId.toString(),
        })
      );
      expect(timelineResponse.body.data.timeline).toContainEqual(
        expect.objectContaining({
          action: 'confirmed',
          timestamp: expect.any(String),
        })
      );
      expect(timelineResponse.body.data.timeline).toContainEqual(
        expect.objectContaining({
          action: 'completed',
          timestamp: expect.any(String),
          userId: pharmacistId.toString(),
        })
      );
    });
  });

  describe('Follow-up Workflow E2E', () => {
    it('should complete follow-up workflow: create → escalate → convert → complete', async () => {
      // Step 1: System automatically creates follow-up from clinical intervention
      const intervention = new ClinicalIntervention({
        workplaceId,
        patientId,
        pharmacistId,
        type: 'drug_therapy_problem',
        title: 'Potential Drug Interaction',
        description: 'Patient taking warfarin and aspirin - bleeding risk',
        priority: 'high',
        status: 'identified',
        createdBy: pharmacistId,
      });
      await intervention.save();

      const followUpData = {
        patientId: patientId.toString(),
        type: 'clinical_intervention_followup',
        title: 'Follow-up on Drug Interaction',
        description: 'Monitor patient for bleeding signs and adjust medications',
        priority: 'high',
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
        assignedTo: pharmacistId.toString(),
        trigger: {
          type: 'clinical_intervention',
          sourceId: intervention._id.toString(),
          sourceType: 'ClinicalIntervention',
          triggerDate: new Date().toISOString(),
          triggerDetails: {
            interventionType: intervention.type,
            priority: intervention.priority,
          },
        },
        relatedRecords: {
          clinicalInterventionId: intervention._id.toString(),
        },
      };

      const createFollowUpResponse = await request(app)
        .post('/api/follow-ups')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(followUpData);

      expect(createFollowUpResponse.status).toBe(201);
      const followUpId = createFollowUpResponse.body.data._id;

      // Step 2: Follow-up becomes overdue and gets escalated
      // Simulate overdue by updating due date to past
      await FollowUpTask.findByIdAndUpdate(followUpId, {
        dueDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        status: 'overdue',
      });

      const escalateResponse = await request(app)
        .post(`/api/follow-ups/${followUpId}/escalate`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          newPriority: 'critical',
          reason: 'Patient safety concern - bleeding risk requires immediate attention',
        });

      expect(escalateResponse.status).toBe(200);
      expect(escalateResponse.body.data.priority).toBe('critical');
      expect(escalateResponse.body.data.escalationHistory).toHaveLength(1);

      // Step 3: Convert follow-up to appointment
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      const appointmentDate = dayAfterTomorrow.toISOString().split('T')[0];

      const convertResponse = await request(app)
        .post(`/api/follow-ups/${followUpId}/convert-to-appointment`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          scheduledDate: appointmentDate,
          scheduledTime: '14:00',
          duration: 45,
          type: 'clinical_consultation',
          description: 'Urgent consultation for drug interaction management',
        });

      expect(convertResponse.status).toBe(201);
      expect(convertResponse.body.data.appointment).toBeDefined();
      expect(convertResponse.body.data.task.status).toBe('converted_to_appointment');
      
      const appointmentId = convertResponse.body.data.appointment._id;

      // Step 4: Complete the converted appointment
      const completeAppointmentResponse = await request(app)
        .patch(`/api/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          status: 'completed',
          outcome: {
            status: 'successful',
            notes: 'Medication regimen adjusted. Warfarin dose reduced, aspirin discontinued.',
            nextActions: [
              'INR monitoring in 1 week',
              'Follow-up call in 3 days',
              'Patient education on bleeding signs',
            ],
          },
        });

      expect(completeAppointmentResponse.status).toBe(200);

      // Step 5: Complete the original follow-up task
      const completeFollowUpResponse = await request(app)
        .post(`/api/follow-ups/${followUpId}/complete`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          outcome: {
            status: 'successful',
            notes: 'Drug interaction resolved through appointment. Medications adjusted.',
            nextActions: ['Monitor INR', 'Patient education completed'],
            appointmentCreated: true,
            appointmentId: appointmentId,
          },
        });

      expect(completeFollowUpResponse.status).toBe(200);
      expect(completeFollowUpResponse.body.data.status).toBe('completed');
      expect(completeFollowUpResponse.body.data.outcome.appointmentId).toBe(appointmentId);

      // Step 6: Verify intervention status updated
      const updatedIntervention = await ClinicalIntervention.findById(intervention._id);
      expect(updatedIntervention!.status).toBe('resolved');

      // Step 7: Verify complete audit trail
      const followUpTimelineResponse = await request(app)
        .get(`/api/follow-ups/${followUpId}/timeline`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(followUpTimelineResponse.status).toBe(200);
      const timeline = followUpTimelineResponse.body.data.timeline;
      
      expect(timeline).toContainEqual(
        expect.objectContaining({ action: 'created' })
      );
      expect(timeline).toContainEqual(
        expect.objectContaining({ action: 'escalated', newPriority: 'critical' })
      );
      expect(timeline).toContainEqual(
        expect.objectContaining({ action: 'converted_to_appointment' })
      );
      expect(timeline).toContainEqual(
        expect.objectContaining({ action: 'completed' })
      );
    });
  });

  describe('Recurring Appointment Series E2E', () => {
    it('should manage recurring appointment series lifecycle', async () => {
      // Step 1: Create recurring appointment series
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 7); // Start next week
      const appointmentDate = startDate.toISOString().split('T')[0];

      const recurringData = {
        patientId: patientId.toString(),
        type: 'chronic_disease_review',
        title: 'Monthly Diabetes Review',
        description: 'Regular monitoring for diabetes management',
        scheduledDate: appointmentDate,
        scheduledTime: '11:00',
        duration: 45,
        assignedTo: pharmacistId.toString(),
        isRecurring: true,
        recurrencePattern: {
          frequency: 'monthly',
          interval: 1,
          endAfterOccurrences: 6, // 6 months
          dayOfMonth: startDate.getDate(),
        },
      };

      const createSeriesResponse = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(recurringData);

      expect(createSeriesResponse.status).toBe(201);
      expect(createSeriesResponse.body.data.appointment.isRecurring).toBe(true);
      expect(createSeriesResponse.body.data.seriesInfo.totalInstances).toBe(6);
      
      const seriesId = createSeriesResponse.body.data.appointment.recurringSeriesId;

      // Step 2: Verify all instances were created
      const seriesResponse = await request(app)
        .get(`/api/appointments/series/${seriesId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(seriesResponse.status).toBe(200);
      expect(seriesResponse.body.data.appointments).toHaveLength(6);

      // Step 3: Modify single instance (exception)
      const secondInstance = seriesResponse.body.data.appointments[1];
      const modifyResponse = await request(app)
        .put(`/api/appointments/${secondInstance._id}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          scheduledTime: '14:00',
          duration: 60,
          updateType: 'this_only',
          reason: 'Patient requested different time for this appointment',
        });

      expect(modifyResponse.status).toBe(200);
      expect(modifyResponse.body.data.appointment.isRecurringException).toBe(true);
      expect(modifyResponse.body.data.appointment.scheduledTime).toBe('14:00');

      // Step 4: Update all future instances
      const thirdInstance = seriesResponse.body.data.appointments[2];
      const updateFutureResponse = await request(app)
        .put(`/api/appointments/${thirdInstance._id}`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          assignedTo: pharmacistId.toString(), // Different pharmacist
          updateType: 'this_and_future',
          reason: 'Pharmacist schedule change',
        });

      expect(updateFutureResponse.status).toBe(200);
      expect(updateFutureResponse.body.data.affectedAppointments).toBeGreaterThan(1);

      // Step 5: Cancel remaining series
      const cancelSeriesResponse = await request(app)
        .post(`/api/appointments/series/${seriesId}/cancel`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          cancelType: 'remaining_instances',
          reason: 'Patient moved to different pharmacy',
          notifyPatient: true,
        });

      expect(cancelSeriesResponse.status).toBe(200);
      expect(cancelSeriesResponse.body.data.cancelledCount).toBeGreaterThan(0);

      // Step 6: Verify series status
      const finalSeriesResponse = await request(app)
        .get(`/api/appointments/series/${seriesId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(finalSeriesResponse.status).toBe(200);
      const finalAppointments = finalSeriesResponse.body.data.appointments;
      
      // Some should be cancelled, some might be completed/past
      const cancelledCount = finalAppointments.filter((apt: any) => apt.status === 'cancelled').length;
      expect(cancelledCount).toBeGreaterThan(0);
    });
  }); 
 describe('Patient Portal Booking Flow E2E', () => {
    it('should complete patient portal booking flow from discovery to confirmation', async () => {
      // Step 1: Patient discovers available appointment types (public endpoint)
      const typesResponse = await request(app)
        .get('/api/patient-portal/appointment-types')
        .query({ workplaceId: workplaceId.toString() });

      expect(typesResponse.status).toBe(200);
      expect(typesResponse.body.data).toBeInstanceOf(Array);
      expect(typesResponse.body.data.length).toBeGreaterThan(0);

      const availableType = typesResponse.body.data.find((type: any) => 
        type.type === 'health_check' && type.isAvailable
      );
      expect(availableType).toBeTruthy();

      // Step 2: Patient checks available slots
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const slotsResponse = await request(app)
        .get('/api/patient-portal/available-slots')
        .query({
          workplaceId: workplaceId.toString(),
          date: dateStr,
          type: 'health_check',
          duration: 30,
        });

      expect(slotsResponse.status).toBe(200);
      expect(slotsResponse.body.data.slots).toBeInstanceOf(Array);
      expect(slotsResponse.body.data.pharmacists).toBeInstanceOf(Array);

      const availableSlot = slotsResponse.body.data.slots.find((slot: any) => slot.available);
      expect(availableSlot).toBeTruthy();

      // Step 3: Patient books appointment
      const bookingData = {
        patientId: patientId.toString(),
        type: 'health_check',
        scheduledDate: dateStr,
        scheduledTime: availableSlot.time,
        duration: 30,
        assignedTo: availableSlot.pharmacistId,
        description: 'General health check and medication review',
        patientNotes: 'I have questions about my blood pressure medication',
        patientPreferences: {
          preferredChannel: 'email',
          language: 'en',
          specialRequirements: 'Please have my medication history ready',
        },
      };

      const bookingResponse = await request(app)
        .post('/api/patient-portal/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send(bookingData);

      expect(bookingResponse.status).toBe(201);
      expect(bookingResponse.body.data.appointment).toBeDefined();
      expect(bookingResponse.body.data.confirmationNumber).toBeTruthy();
      expect(bookingResponse.body.data.reminders).toHaveLength(3);

      const appointmentId = bookingResponse.body.data.appointment._id;

      // Step 4: Patient receives confirmation email (simulated)
      const confirmationDetails = await request(app)
        .get(`/api/patient-portal/appointments/${appointmentId}/confirmation`)
        .set('Authorization', `Bearer ${patientToken}`);

      expect(confirmationDetails.status).toBe(200);
      expect(confirmationDetails.body.data).toMatchObject({
        appointmentDetails: expect.objectContaining({
          type: 'health_check',
          scheduledDate: dateStr,
          scheduledTime: availableSlot.time,
        }),
        pharmacyDetails: expect.objectContaining({
          name: 'Test Pharmacy',
          address: '123 Test Street, Lagos, Nigeria',
          phone: '+234-800-123-4567',
        }),
        preparationInstructions: expect.any(Array),
      });

      // Step 5: Patient views their appointments
      const myAppointmentsResponse = await request(app)
        .get('/api/patient-portal/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .query({ status: 'scheduled' });

      expect(myAppointmentsResponse.status).toBe(200);
      expect(myAppointmentsResponse.body.data.appointments).toHaveLength(1);
      expect(myAppointmentsResponse.body.data.appointments[0]._id).toBe(appointmentId);

      // Step 6: Patient reschedules appointment
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
      const newDateStr = dayAfterTomorrow.toISOString().split('T')[0];

      const rescheduleResponse = await request(app)
        .post(`/api/patient-portal/appointments/${appointmentId}/reschedule`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          newDate: newDateStr,
          newTime: '15:00',
          reason: 'Work schedule conflict',
          notifyPharmacist: true,
        });

      expect(rescheduleResponse.status).toBe(200);
      expect(rescheduleResponse.body.data.scheduledDate).toBe(newDateStr);
      expect(rescheduleResponse.body.data.scheduledTime).toBe('15:00');
      expect(rescheduleResponse.body.data.rescheduledFrom).toBeTruthy();

      // Step 7: Patient confirms final appointment
      const finalConfirmResponse = await request(app)
        .post(`/api/patient-portal/appointments/${appointmentId}/confirm`)
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          patientNotes: 'Looking forward to the appointment. Will bring medication list.',
          specialRequirements: 'Please review my blood pressure readings',
        });

      expect(finalConfirmResponse.status).toBe(200);
      expect(finalConfirmResponse.body.data.confirmationStatus).toBe('confirmed');
      expect(finalConfirmResponse.body.data.confirmedAt).toBeTruthy();

      // Step 8: Verify pharmacist can see patient's booking and notes
      const pharmacistViewResponse = await request(app)
        .get(`/api/appointments/${appointmentId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(pharmacistViewResponse.status).toBe(200);
      expect(pharmacistViewResponse.body.data.appointment.metadata.source).toBe('patient_portal');
      expect(pharmacistViewResponse.body.data.appointment.patientPreferences).toBeDefined();
      expect(pharmacistViewResponse.body.data.patient.email).toBe('patient@test.com');
    });

    it('should handle booking conflicts and slot reservations', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // Patient 1 starts booking process
      const slotsResponse = await request(app)
        .get('/api/patient-portal/available-slots')
        .query({
          workplaceId: workplaceId.toString(),
          date: dateStr,
          type: 'health_check',
          duration: 30,
        });

      const availableSlot = slotsResponse.body.data.slots.find((slot: any) => slot.available);

      // Patient 1 reserves slot (10-minute hold)
      const reserveResponse = await request(app)
        .post('/api/patient-portal/slots/reserve')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          workplaceId: workplaceId.toString(),
          date: dateStr,
          time: availableSlot.time,
          pharmacistId: availableSlot.pharmacistId,
          duration: 30,
        });

      expect(reserveResponse.status).toBe(200);
      expect(reserveResponse.body.data.reservationToken).toBeTruthy();
      expect(reserveResponse.body.data.expiresAt).toBeTruthy();

      // Create second patient
      const patient2 = new Patient({
        ...createTestPatientData(workplaceId.toString(), {
          email: 'patient2@test.com',
          mrn: 'E2E002',
          phone: '+234-800-002-0002',
        }),
        createdBy: pharmacistId,
      });
      await patient2.save();

      const patient2Token = jwt.sign(
        { 
          userId: patient2._id, 
          workplaceId, 
          type: 'patient',
          email: patient2.email 
        },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      // Patient 2 tries to book the same slot (should fail)
      const conflictBookingResponse = await request(app)
        .post('/api/patient-portal/appointments')
        .set('Authorization', `Bearer ${patient2Token}`)
        .send({
          patientId: patient2._id.toString(),
          type: 'health_check',
          scheduledDate: dateStr,
          scheduledTime: availableSlot.time,
          duration: 30,
          assignedTo: availableSlot.pharmacistId,
        });

      expect(conflictBookingResponse.status).toBe(400);
      expect(conflictBookingResponse.body.message).toContain('no longer available');

      // Patient 1 completes booking with reservation token
      const successfulBookingResponse = await request(app)
        .post('/api/patient-portal/appointments')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({
          patientId: patientId.toString(),
          type: 'health_check',
          scheduledDate: dateStr,
          scheduledTime: availableSlot.time,
          duration: 30,
          assignedTo: availableSlot.pharmacistId,
          reservationToken: reserveResponse.body.data.reservationToken,
        });

      expect(successfulBookingResponse.status).toBe(201);
    });
  });

  describe('Reminder Delivery and Confirmation E2E', () => {
    it('should handle complete reminder workflow with multi-channel delivery', async () => {
      // Step 1: Create appointment with reminders
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const appointmentDate = tomorrow.toISOString().split('T')[0];

      const appointmentData = {
        patientId: patientId.toString(),
        type: 'mtm_session',
        scheduledDate: appointmentDate,
        scheduledTime: '10:00',
        duration: 30,
        assignedTo: pharmacistId.toString(),
      };

      const createResponse = await request(app)
        .post('/api/appointments')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send(appointmentData);

      const appointmentId = createResponse.body.data.appointment._id;

      // Step 2: Verify reminders were scheduled
      const remindersResponse = await request(app)
        .get(`/api/appointments/${appointmentId}/reminders`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(remindersResponse.status).toBe(200);
      expect(remindersResponse.body.data.reminders).toHaveLength(3);

      const reminders = remindersResponse.body.data.reminders;
      expect(reminders).toContainEqual(
        expect.objectContaining({
          type: 'email',
          scheduledFor: expect.any(String),
          sent: false,
        })
      );

      // Step 3: Simulate reminder processing (24h before)
      const processRemindersResponse = await request(app)
        .post('/api/reminders/process-pending')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          appointmentId: appointmentId,
          reminderType: '24h_before',
        });

      expect(processRemindersResponse.status).toBe(200);
      expect(processRemindersResponse.body.data.processed).toBeGreaterThan(0);

      // Step 4: Check reminder delivery status
      const deliveryStatusResponse = await request(app)
        .get(`/api/appointments/${appointmentId}/reminders/status`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(deliveryStatusResponse.status).toBe(200);
      expect(deliveryStatusResponse.body.data.deliveryStats).toBeDefined();

      // Step 5: Patient confirms via reminder link (simulate)
      const confirmationToken = jwt.sign(
        { appointmentId, patientId, action: 'confirm' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      const confirmViaReminderResponse = await request(app)
        .post(`/api/appointments/${appointmentId}/confirm`)
        .send({ confirmationToken });

      expect(confirmViaReminderResponse.status).toBe(200);
      expect(confirmViaReminderResponse.body.data.confirmationStatus).toBe('confirmed');

      // Step 6: Patient requests reschedule via reminder link
      const rescheduleToken = jwt.sign(
        { appointmentId, patientId, action: 'reschedule' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      const rescheduleViaReminderResponse = await request(app)
        .post(`/api/appointments/${appointmentId}/reschedule-request`)
        .send({
          rescheduleToken,
          preferredDates: [
            { date: appointmentDate, time: '14:00' },
            { date: appointmentDate, time: '15:00' },
          ],
          reason: 'Work meeting conflict',
        });

      expect(rescheduleViaReminderResponse.status).toBe(200);
      expect(rescheduleViaReminderResponse.body.data.rescheduleRequestId).toBeTruthy();

      // Step 7: Pharmacist processes reschedule request
      const rescheduleRequestId = rescheduleViaReminderResponse.body.data.rescheduleRequestId;
      
      const processRescheduleResponse = await request(app)
        .post(`/api/appointments/reschedule-requests/${rescheduleRequestId}/approve`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          newDate: appointmentDate,
          newTime: '14:00',
          notifyPatient: true,
        });

      expect(processRescheduleResponse.status).toBe(200);
      expect(processRescheduleResponse.body.data.appointment.scheduledTime).toBe('14:00');

      // Step 8: Verify reminder effectiveness analytics
      const effectivenessResponse = await request(app)
        .get('/api/reminders/effectiveness')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .query({
          startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        });

      expect(effectivenessResponse.status).toBe(200);
      expect(effectivenessResponse.body.data.summary).toMatchObject({
        totalSent: expect.any(Number),
        totalDelivered: expect.any(Number),
        responseRate: expect.any(Number),
      });
    });
  });

  describe('Integration with Existing Modules E2E', () => {
    it('should integrate with MTR module for complete workflow', async () => {
      // Step 1: Create MTR session
      const mtrSession = new MedicationTherapyReview({
        workplaceId,
        patientId,
        pharmacistId,
        reviewNumber: 'MTR-E2E-001',
        reviewType: 'comprehensive',
        status: 'in_progress',
        startedAt: new Date(),
        medications: [
          {
            name: 'Lisinopril',
            dosage: '10mg',
            frequency: 'once daily',
            indication: 'Hypertension',
            adherence: 'good',
          },
        ],
        createdBy: pharmacistId,
      });
      await mtrSession.save();

      // Step 2: Complete MTR and create follow-up appointment
      const completeMTRResponse = await request(app)
        .patch(`/api/mtr/${mtrSession._id}/complete`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          recommendations: [
            'Continue current medication',
            'Monitor blood pressure weekly',
            'Schedule follow-up in 3 months',
          ],
          createFollowUpAppointment: true,
          followUpDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          followUpTime: '11:00',
        });

      expect(completeMTRResponse.status).toBe(200);
      expect(completeMTRResponse.body.data.followUpAppointment).toBeDefined();

      const followUpAppointmentId = completeMTRResponse.body.data.followUpAppointment._id;

      // Step 3: Verify appointment is linked to MTR
      const appointmentResponse = await request(app)
        .get(`/api/appointments/${followUpAppointmentId}`)
        .set('Authorization', `Bearer ${pharmacistToken}`);

      expect(appointmentResponse.status).toBe(200);
      expect(appointmentResponse.body.data.appointment.type).toBe('mtr_followup');
      expect(appointmentResponse.body.data.appointment.relatedRecords.mtrSessionId).toBe(mtrSession._id.toString());

      // Step 4: Complete follow-up appointment and create visit
      const completeFollowUpResponse = await request(app)
        .patch(`/api/appointments/${followUpAppointmentId}/status`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          status: 'completed',
          outcome: {
            status: 'successful',
            notes: 'Patient adherence excellent. Blood pressure well controlled.',
            nextActions: ['Continue current regimen', 'Next review in 6 months'],
            visitCreated: true,
          },
        });

      expect(completeFollowUpResponse.status).toBe(200);

      // Step 5: Create visit from appointment
      const visitResponse = await request(app)
        .post('/api/visits')
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          patientId: patientId.toString(),
          appointmentId: followUpAppointmentId,
          visitType: 'mtr_followup',
          chiefComplaint: 'MTR follow-up visit',
          assessment: 'Patient adherence excellent. Blood pressure well controlled.',
          plan: 'Continue current regimen. Next review in 6 months.',
          relatedMTRId: mtrSession._id.toString(),
        });

      expect(visitResponse.status).toBe(201);
      expect(visitResponse.body.data.appointmentId).toBe(followUpAppointmentId);
      expect(visitResponse.body.data.relatedMTRId).toBe(mtrSession._id.toString());
    });

    it('should integrate with Clinical Intervention module', async () => {
      // Step 1: Create clinical intervention
      const intervention = new ClinicalIntervention({
        workplaceId,
        patientId,
        pharmacistId,
        type: 'adverse_drug_reaction',
        title: 'Suspected ACE Inhibitor Cough',
        description: 'Patient reports persistent dry cough since starting lisinopril',
        priority: 'medium',
        status: 'identified',
        recommendations: [
          'Discontinue lisinopril',
          'Start ARB alternative',
          'Monitor symptoms',
        ],
        createdBy: pharmacistId,
      });
      await intervention.save();

      // Step 2: Create follow-up task from intervention
      const createFollowUpResponse = await request(app)
        .post(`/api/engagement-integration/intervention/${intervention._id}/create-followup`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          patientId: patientId.toString(),
          assignedTo: pharmacistId.toString(),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          priority: 'medium',
        });

      expect(createFollowUpResponse.status).toBe(201);
      expect(createFollowUpResponse.body.data.followUpTask.type).toBe('intervention_followup');

      const followUpId = createFollowUpResponse.body.data.followUpTask._id;

      // Step 3: Complete follow-up and resolve intervention
      const completeFollowUpResponse = await request(app)
        .post(`/api/follow-ups/${followUpId}/complete`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          outcome: {
            status: 'successful',
            notes: 'Cough resolved after switching to losartan. Patient tolerating well.',
            nextActions: ['Monitor blood pressure', 'Follow-up in 2 weeks'],
          },
          resolveIntervention: true,
        });

      expect(completeFollowUpResponse.status).toBe(200);

      // Step 4: Verify intervention status updated
      const updatedIntervention = await ClinicalIntervention.findById(intervention._id);
      expect(updatedIntervention!.status).toBe('resolved');
      expect(updatedIntervention!.resolvedAt).toBeTruthy();
    });

    it('should integrate with Diagnostic module', async () => {
      // Step 1: Create diagnostic case
      const diagnosticCase = new DiagnosticCase({
        workplaceId,
        patientId,
        pharmacistId,
        caseNumber: 'DIAG-E2E-001',
        chiefComplaint: 'Chest pain and shortness of breath',
        symptoms: ['chest pain', 'dyspnea', 'fatigue'],
        vitalSigns: {
          bloodPressure: '150/95',
          heartRate: 88,
          temperature: 98.6,
          respiratoryRate: 18,
        },
        aiAnalysis: {
          confidence: 0.85,
          suggestedDiagnosis: 'Hypertensive crisis',
          recommendations: [
            'Immediate blood pressure management',
            'Cardiology referral',
            'Medication review',
          ],
        },
        status: 'pending_review',
        createdBy: pharmacistId,
      });
      await diagnosticCase.save();

      // Step 2: Create follow-up from diagnostic case
      const createFollowUpResponse = await request(app)
        .post(`/api/engagement-integration/diagnostic/${diagnosticCase._id}/create-followup`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          patientId: patientId.toString(),
          assignedTo: pharmacistId.toString(),
          priority: 'high', // Based on AI confidence and urgency
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Next day
        });

      expect(createFollowUpResponse.status).toBe(201);
      expect(createFollowUpResponse.body.data.followUpTask.type).toBe('diagnostic_followup');
      expect(createFollowUpResponse.body.data.followUpTask.priority).toBe('high');

      const followUpId = createFollowUpResponse.body.data.followUpTask._id;

      // Step 3: Convert to urgent appointment
      const convertResponse = await request(app)
        .post(`/api/follow-ups/${followUpId}/convert-to-appointment`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          scheduledDate: new Date().toISOString().split('T')[0], // Today
          scheduledTime: '16:00',
          duration: 60,
          type: 'urgent_consultation',
          description: 'Urgent consultation for diagnostic case review',
        });

      expect(convertResponse.status).toBe(201);

      const appointmentId = convertResponse.body.data.appointment._id;

      // Step 4: Complete appointment and update diagnostic case
      const completeResponse = await request(app)
        .patch(`/api/appointments/${appointmentId}/status`)
        .set('Authorization', `Bearer ${pharmacistToken}`)
        .send({
          status: 'completed',
          outcome: {
            status: 'successful',
            notes: 'Patient referred to cardiology. Blood pressure medication adjusted.',
            nextActions: [
              'Cardiology appointment scheduled',
              'Blood pressure monitoring',
              'Medication adherence counseling',
            ],
          },
          updateDiagnosticCase: true,
        });

      expect(completeResponse.status).toBe(200);

      // Step 5: Verify diagnostic case updated
      const updatedCase = await DiagnosticCase.findById(diagnosticCase._id);
      expect(updatedCase!.status).toBe('reviewed');
      expect(updatedCase!.pharmacistReview).toBeTruthy();
    });
  });

  describe('Performance and Stress Testing E2E', () => {
    it('should handle concurrent appointment bookings efficiently', async () => {
      // Create multiple patients
      const patients = [];
      for (let i = 0; i < 10; i++) {
        const patient = new Patient({
          ...createTestPatientData(workplaceId.toString(), {
            email: `patient${i}@test.com`,
            mrn: `PERF${i.toString().padStart(3, '0')}`,
            phone: `+234-800-${i.toString().padStart(3, '0')}-0001`,
          }),
          createdBy: pharmacistId,
        });
        await patient.save();
        patients.push(patient);
      }

      // Simulate concurrent booking attempts
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const bookingPromises = patients.map((patient, index) => {
        const patientToken = jwt.sign(
          { 
            userId: patient._id, 
            workplaceId, 
            type: 'patient',
            email: patient.email 
          },
          process.env.JWT_SECRET || 'test-secret',
          { expiresIn: '1h' }
        );

        return request(app)
          .post('/api/patient-portal/appointments')
          .set('Authorization', `Bearer ${patientToken}`)
          .send({
            patientId: patient._id.toString(),
            type: 'health_check',
            scheduledDate: dateStr,
            scheduledTime: `${9 + index}:00`, // Different times
            duration: 30,
            assignedTo: pharmacistId.toString(),
          });
      });

      const startTime = Date.now();
      const results = await Promise.allSettled(bookingPromises);
      const endTime = Date.now();

      // Most bookings should succeed
      const successfulBookings = results.filter(
        result => result.status === 'fulfilled' && result.value.status === 201
      );
      expect(successfulBookings.length).toBeGreaterThan(7); // At least 70% success rate

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });

    it('should handle bulk follow-up processing efficiently', async () => {
      // Create multiple follow-up tasks
      const followUps = [];
      for (let i = 0; i < 50; i++) {
        const followUp = new FollowUpTask({
          workplaceId,
          patientId,
          title: `Bulk Follow-up ${i + 1}`,
          description: `Automated follow-up task ${i + 1}`,
          type: 'medication_adherence',
          priority: 'medium',
          status: 'pending',
          dueDate: new Date(Date.now() + (i + 1) * 24 * 60 * 60 * 1000),
          assignedTo: pharmacistId,
          createdBy: pharmacistId,
          trigger: {
            type: 'system_rule',
            triggerDate: new Date(),
          },
        });
        await followUp.save();
        followUps.push(followUp);
      }

      // Process bulk completion
      const completionPromises = followUps.slice(0, 25).map(followUp =>
        request(app)
          .post(`/api/follow-ups/${followUp._id}/complete`)
          .set('Authorization', `Bearer ${pharmacistToken}`)
          .send({
            outcome: {
              status: 'successful',
              notes: 'Bulk processing completed',
              nextActions: ['Continue monitoring'],
            },
          })
      );

      const startTime = Date.now();
      const results = await Promise.all(completionPromises);
      const endTime = Date.now();

      // All completions should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
    });
  });
});