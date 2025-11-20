import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { EngagementIntegrationService } from '../../services/EngagementIntegrationService';
import Appointment from '../../models/Appointment';
import FollowUpTask from '../../models/FollowUpTask';
import MTRFollowUp from '../../models/MTRFollowUp';
import MedicationTherapyReview from '../../models/MedicationTherapyReview';
import Visit from '../../models/Visit';
import ClinicalIntervention from '../../models/ClinicalIntervention';
import DiagnosticCase from '../../models/DiagnosticCase';
import LabResult from '../../modules/diagnostics/models/LabResult';
import Medication from '../../models/Medication';
import Patient from '../../models/Patient';
import User from '../../models/User';

describe('EngagementIntegrationService', () => {
  let mongoServer: MongoMemoryServer;
  let service: EngagementIntegrationService;
  let workplaceId: mongoose.Types.ObjectId;
  let patientId: mongoose.Types.ObjectId;
  let pharmacistId: mongoose.Types.ObjectId;

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
      Appointment.deleteMany({}),
      FollowUpTask.deleteMany({}),
      MTRFollowUp.deleteMany({}),
      MedicationTherapyReview.deleteMany({}),
      Visit.deleteMany({}),
      ClinicalIntervention.deleteMany({}),
      DiagnosticCase.deleteMany({}),
      LabResult.deleteMany({}),
      Medication.deleteMany({}),
      Patient.deleteMany({}),
    ]);

    service = new EngagementIntegrationService();
    workplaceId = new mongoose.Types.ObjectId();
    patientId = new mongoose.Types.ObjectId();
    pharmacistId = new mongoose.Types.ObjectId();
  });

  describe('createVisitFromAppointment', () => {
    it('should create a visit from a completed appointment', async () => {
      // Create a completed appointment (without populate to avoid User schema issue)
      const appointment = new Appointment({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTR Session',
        description: 'Medication therapy review',
        scheduledDate: new Date(),
        scheduledTime: '10:00',
        duration: 60,
        timezone: 'Africa/Lagos',
        status: 'completed',
        outcome: {
          status: 'successful',
          notes: 'Patient responded well to therapy',
          nextActions: ['Continue current medication', 'Schedule follow-up in 3 months'],
          visitCreated: false,
        },
        createdBy: pharmacistId,
      });
      await appointment.save();

      const result = await service.createVisitFromAppointment(appointment._id);

      expect(result).toBeDefined();
      expect(result.workplaceId).toEqual(workplaceId);
      expect(result.patientId).toEqual(patientId);
      expect(result.appointmentId).toEqual(appointment._id);
      expect(result.soap.subjective).toBe('Patient responded well to therapy');
      expect(result.soap.assessment).toBe('Goals achieved');
      expect(result.soap.plan).toBe('Continue current medication; Schedule follow-up in 3 months');

      // Check that appointment was updated
      const updatedAppointment = await Appointment.findById(appointment._id);
      expect(updatedAppointment?.outcome?.visitCreated).toBe(true);
      expect(updatedAppointment?.outcome?.visitId).toEqual(result._id);
    });

    it('should throw error if appointment not found', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      
      await expect(service.createVisitFromAppointment(nonExistentId))
        .rejects.toThrow('Appointment not found');
    });

    it('should throw error if appointment is not completed', async () => {
      const appointment = new Appointment({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTR Session',
        scheduledDate: new Date(),
        scheduledTime: '10:00',
        duration: 60,
        timezone: 'Africa/Lagos',
        status: 'scheduled',
        createdBy: pharmacistId,
      });
      await appointment.save();

      await expect(service.createVisitFromAppointment(appointment._id))
        .rejects.toThrow('Only completed appointments can create visits');
    });

    it('should throw error if visit already created', async () => {
      const appointment = new Appointment({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTR Session',
        scheduledDate: new Date(),
        scheduledTime: '10:00',
        duration: 60,
        timezone: 'Africa/Lagos',
        status: 'completed',
        outcome: {
          status: 'successful',
          notes: 'Test notes',
          nextActions: [],
          visitCreated: true,
        },
        createdBy: pharmacistId,
      });
      await appointment.save();

      await expect(service.createVisitFromAppointment(appointment._id))
        .rejects.toThrow('Visit already created for this appointment');
    });
  });

  describe('linkToMTRSession', () => {
    it('should link MTR follow-up to appointment', async () => {
      // Create MTR follow-up
      const mtrFollowUp = new MTRFollowUp({
        workplaceId,
        reviewId: new mongoose.Types.ObjectId(),
        patientId,
        type: 'appointment',
        priority: 'medium',
        description: 'MTR follow-up session',
        objectives: ['Review medication adherence'],
        scheduledDate: new Date(),
        assignedTo: pharmacistId,
        status: 'scheduled',
        createdBy: pharmacistId,
      });
      await mtrFollowUp.save();

      // Create appointment
      const appointment = new Appointment({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTR Session',
        scheduledDate: new Date(),
        scheduledTime: '10:00',
        duration: 60,
        timezone: 'Africa/Lagos',
        status: 'scheduled',
        createdBy: pharmacistId,
      });
      await appointment.save();

      const result = await service.linkMTRFollowUpToAppointment({
        mtrFollowUpId: mtrFollowUp._id,
        appointmentId: appointment._id,
      });

      expect(result.mtrFollowUp).toBeDefined();
      expect(result.appointment).toBeDefined();
      expect(result.appointment.relatedRecords.followUpTaskId).toEqual(mtrFollowUp._id);
    });

    it('should throw error if MTR follow-up not found', async () => {
      const appointment = new Appointment({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTR Session',
        scheduledDate: new Date(),
        scheduledTime: '10:00',
        duration: 60,
        timezone: 'Africa/Lagos',
        status: 'scheduled',
        createdBy: pharmacistId,
      });
      await appointment.save();

      const nonExistentId = new mongoose.Types.ObjectId();

      await expect(service.linkMTRFollowUpToAppointment({
        mtrFollowUpId: nonExistentId,
        appointmentId: appointment._id,
      })).rejects.toThrow('MTR follow-up not found');
    });
  });

  describe('createFollowUpFromIntervention', () => {
    it('should create follow-up task from clinical intervention', async () => {
      // Create clinical intervention
      const intervention = new ClinicalIntervention({
        workplaceId,
        patientId,
        identifiedBy: pharmacistId,
        interventionNumber: 'CI-202510-0001',
        category: 'drug_therapy_problem',
        priority: 'high',
        issueDescription: 'Drug interaction detected',
        strategies: [{
          type: 'dose_adjustment',
          description: 'Switch to alternative medication',
          rationale: 'To avoid drug interaction',
          expectedOutcome: 'Improved safety profile',
          implementedBy: pharmacistId,
          implementedAt: new Date(),
        }],
        followUp: {
          required: true,
          scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        },
        status: 'in_progress',
        createdBy: pharmacistId,
      });
      await intervention.save();

      const result = await service.createFollowUpFromIntervention({
        interventionId: intervention._id,
        patientId,
        assignedTo: pharmacistId,
        workplaceId,
        createdBy: pharmacistId,
      });

      expect(result.followUpTask).toBeDefined();
      expect(result.intervention).toBeDefined();
      expect(result.followUpTask.type).toBe('general_followup');
      expect(result.followUpTask.priority).toBe('urgent'); // High intervention priority maps to urgent follow-up
      expect(result.followUpTask.relatedRecords.clinicalInterventionId).toEqual(intervention._id);
      expect(result.followUpTask.trigger.type).toBe('system_rule');
      expect(result.followUpTask.trigger.sourceId).toEqual(intervention._id);
    });

    it('should return existing follow-up task if already exists', async () => {
      const intervention = new ClinicalIntervention({
        workplaceId,
        patientId,
        identifiedBy: pharmacistId,
        interventionNumber: 'CI-202510-0002',
        category: 'drug_therapy_problem',
        priority: 'high',
        issueDescription: 'Drug interaction detected',
        strategies: [{
          type: 'dose_adjustment',
          description: 'Adjust medication dose',
          rationale: 'To reduce interaction risk',
          expectedOutcome: 'Improved safety profile with reduced risk of adverse drug interactions',
          implementedBy: pharmacistId,
          implementedAt: new Date(),
        }],
        followUp: { required: true },
        status: 'in_progress',
        createdBy: pharmacistId,
      });
      await intervention.save();

      // Create existing follow-up task
      const existingTask = new FollowUpTask({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'general_followup',
        title: 'Existing task',
        description: 'Existing description',
        objectives: ['Test objective'],
        priority: 'medium',
        dueDate: new Date(),
        status: 'pending',
        trigger: {
          type: 'system_rule',
          triggerDate: new Date(),
        },
        relatedRecords: {
          clinicalInterventionId: intervention._id,
        },
        createdBy: pharmacistId,
      });
      await existingTask.save();

      const result = await service.createFollowUpFromIntervention({
        interventionId: intervention._id,
        patientId,
        assignedTo: pharmacistId,
        workplaceId,
        createdBy: pharmacistId,
      });

      expect(result.followUpTask._id).toEqual(existingTask._id);
    });

    it('should throw error if intervention does not require follow-up', async () => {
      const intervention = new ClinicalIntervention({
        workplaceId,
        patientId,
        identifiedBy: pharmacistId,
        interventionNumber: 'CI-202510-0003',
        category: 'drug_therapy_problem',
        priority: 'low',
        issueDescription: 'Minor issue',
        strategies: [{
          type: 'patient_counseling',
          description: 'Educate patient about medication',
          rationale: 'To improve understanding',
          expectedOutcome: 'Better medication adherence and improved patient understanding of therapy',
          implementedBy: pharmacistId,
          implementedAt: new Date(),
        }],
        outcomes: {
          patientResponse: 'improved',
          clinicalParameters: [],
        },
        followUp: { required: false },
        status: 'completed',
        createdBy: pharmacistId,
      });
      await intervention.save();

      await expect(service.createFollowUpFromIntervention({
        interventionId: intervention._id,
        patientId,
        assignedTo: pharmacistId,
        workplaceId,
        createdBy: pharmacistId,
      })).rejects.toThrow('Follow-up is not required for this intervention');
    });
  });

  describe('createFollowUpFromLabResult', () => {
    it('should create follow-up task from abnormal lab result', async () => {
      const labResult = new LabResult({
        workplaceId,
        patientId,
        testCode: 'GLU',
        testName: 'Glucose',
        testCategory: 'Chemistry',
        value: '250',
        numericValue: 250,
        unit: 'mg/dL',
        referenceRange: {
          low: 70,
          high: 100,
          unit: 'mg/dL',
        },
        interpretation: 'high',
        criticalValue: false,
        performedAt: new Date(),
        reportedAt: new Date(),
        recordedAt: new Date(),
        recordedBy: pharmacistId,
        source: 'manual',
        followUpRequired: true,
        reviewStatus: 'pending',
        createdBy: pharmacistId,
      });
      await labResult.save();

      const result = await service.createFollowUpFromLabResult({
        labResultId: labResult._id,
        patientId,
        assignedTo: pharmacistId,
        workplaceId,
        createdBy: pharmacistId,
      });

      expect(result.followUpTask).toBeDefined();
      expect(result.labResult).toBeDefined();
      expect(result.followUpTask.type).toBe('lab_result_review');
      expect(result.followUpTask.priority).toBe('high'); // High interpretation maps to high priority
      expect(result.followUpTask.relatedRecords.labResultId).toEqual(labResult._id);
      expect(result.followUpTask.trigger.type).toBe('lab_result');
      expect(result.followUpTask.trigger.sourceId).toEqual(labResult._id);
    });

    it('should create critical priority follow-up for critical lab values', async () => {
      const labResult = new LabResult({
        workplaceId,
        patientId,
        testCode: 'K',
        testName: 'Potassium',
        value: '6.5',
        numericValue: 6.5,
        unit: 'mEq/L',
        referenceRange: {
          low: 3.5,
          high: 5.0,
          unit: 'mEq/L',
        },
        interpretation: 'critical',
        criticalValue: true,
        performedAt: new Date(),
        reportedAt: new Date(),
        recordedAt: new Date(),
        recordedBy: pharmacistId,
        source: 'manual',
        followUpRequired: true,
        reviewStatus: 'pending',
        createdBy: pharmacistId,
      });
      await labResult.save();

      const result = await service.createFollowUpFromLabResult({
        labResultId: labResult._id,
        patientId,
        assignedTo: pharmacistId,
        workplaceId,
        createdBy: pharmacistId,
      });

      expect(result.followUpTask.priority).toBe('critical');
      expect(result.followUpTask.title).toContain('CRITICAL');
      
      // Due date should be within 2 hours for critical values
      const now = new Date();
      const dueDate = result.followUpTask.dueDate;
      const hoursDiff = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeLessThanOrEqual(2.1); // Allow small margin for test execution time
    });

    it('should return existing follow-up task if already exists', async () => {
      const labResult = new LabResult({
        workplaceId,
        patientId,
        testCode: 'GLU',
        testName: 'Glucose',
        value: '250',
        interpretation: 'high',
        referenceRange: {
          low: 70,
          high: 100,
          unit: 'mg/dL',
        },
        performedAt: new Date(),
        reportedAt: new Date(),
        recordedAt: new Date(),
        recordedBy: pharmacistId,
        source: 'manual',
        reviewStatus: 'pending',
        createdBy: pharmacistId,
      });
      await labResult.save();

      // Create existing follow-up task
      const existingTask = new FollowUpTask({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'lab_result_review',
        title: 'Existing lab follow-up',
        description: 'Existing description',
        objectives: ['Review result'],
        priority: 'high',
        dueDate: new Date(),
        status: 'pending',
        trigger: {
          type: 'lab_result',
          triggerDate: new Date(),
        },
        relatedRecords: {
          labResultId: labResult._id,
        },
        createdBy: pharmacistId,
      });
      await existingTask.save();

      const result = await service.createFollowUpFromLabResult({
        labResultId: labResult._id,
        patientId,
        assignedTo: pharmacistId,
        workplaceId,
        createdBy: pharmacistId,
      });

      expect(result.followUpTask._id).toEqual(existingTask._id);
    });
  });

  describe('createFollowUpFromMedicationStart', () => {
    it('should create follow-up task for high-risk medication', async () => {
      const medication = new Medication({
        patient: patientId,
        pharmacist: pharmacistId,
        drugName: 'Warfarin',
        genericName: 'warfarin sodium',
        strength: { value: 5, unit: 'mg' },
        dosageForm: 'tablet',
        instructions: {
          dosage: '5mg',
          frequency: 'once daily',
          duration: 'ongoing',
        },
        therapy: {
          indication: 'Atrial fibrillation',
          goalOfTherapy: 'Anticoagulation',
          monitoring: ['INR', 'PT'],
        },
        status: 'active',
      });
      await medication.save();

      const result = await service.createFollowUpFromMedicationStart({
        medicationId: medication._id,
        patientId,
        assignedTo: pharmacistId,
        workplaceId,
        createdBy: pharmacistId,
      });

      expect(result.followUpTask).toBeDefined();
      expect(result.medication).toBeDefined();
      expect(result.followUpTask.type).toBe('medication_start_followup');
      expect(result.followUpTask.priority).toBe('critical'); // Warfarin is critical priority
      expect(result.followUpTask.relatedRecords.medicationId).toEqual(medication._id);
      expect(result.followUpTask.trigger.type).toBe('medication_start');
      
      // Due date should be 7 days for warfarin
      const now = new Date();
      const dueDate = result.followUpTask.dueDate;
      const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(7);
    });

    it('should not create follow-up for non-high-risk medication', async () => {
      const medication = new Medication({
        patient: patientId,
        pharmacist: pharmacistId,
        drugName: 'Acetaminophen',
        genericName: 'acetaminophen',
        strength: { value: 500, unit: 'mg' },
        dosageForm: 'tablet',
        instructions: {
          dosage: '500mg',
          frequency: 'as needed',
          duration: '7 days',
        },
        status: 'active',
      });
      await medication.save();

      const result = await service.createFollowUpFromMedicationStart({
        medicationId: medication._id,
        patientId,
        assignedTo: pharmacistId,
        workplaceId,
        createdBy: pharmacistId,
      });

      expect(result.followUpTask).toBeNull();
      expect(result.medication).toBeDefined();
    });

    it('should create follow-up with appropriate priority for insulin', async () => {
      const medication = new Medication({
        patient: patientId,
        pharmacist: pharmacistId,
        drugName: 'Insulin Glargine',
        genericName: 'insulin glargine',
        strength: { value: 100, unit: 'units/mL' },
        dosageForm: 'injection',
        instructions: {
          dosage: '20 units',
          frequency: 'once daily at bedtime',
          duration: 'ongoing',
        },
        therapy: {
          indication: 'Type 2 Diabetes',
          goalOfTherapy: 'Glycemic control',
          monitoring: ['Blood glucose', 'HbA1c'],
        },
        status: 'active',
      });
      await medication.save();

      const result = await service.createFollowUpFromMedicationStart({
        medicationId: medication._id,
        patientId,
        assignedTo: pharmacistId,
        workplaceId,
        createdBy: pharmacistId,
      });

      expect(result.followUpTask.priority).toBe('critical');
      
      // Due date should be 3 days for insulin
      const now = new Date();
      const dueDate = result.followUpTask.dueDate;
      const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(3);
    });
  });

  describe('updatePatientEngagementMetrics', () => {
    it('should calculate patient engagement metrics correctly', async () => {
      // Create patient
      const patient = new Patient({
        workplaceId,
        mrn: 'PAT-001',
        firstName: 'John',
        lastName: 'Doe',
        dob: new Date('1980-01-01'),
        gender: 'male',
        phone: '+2348012345678',
        email: 'john.doe@example.com',
        createdBy: pharmacistId,
      });
      await patient.save();

      // Create appointments
      const completedAppointment = new Appointment({
        workplaceId,
        patientId: patient._id,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTR Session',
        scheduledDate: new Date(),
        scheduledTime: '10:00',
        duration: 60,
        timezone: 'Africa/Lagos',
        status: 'completed',
        completedAt: new Date(),
        outcome: {
          status: 'successful',
          notes: 'Session completed successfully',
          nextActions: [],
          visitCreated: false,
        },
        createdBy: pharmacistId,
      });
      await completedAppointment.save();

      const cancelledAppointment = new Appointment({
        workplaceId,
        patientId: patient._id,
        assignedTo: pharmacistId,
        type: 'health_check',
        title: 'Health Check',
        scheduledDate: new Date(),
        scheduledTime: '14:00',
        duration: 30,
        timezone: 'Africa/Lagos',
        status: 'cancelled',
        cancellationReason: 'Patient requested cancellation',
        createdBy: pharmacistId,
      });
      await cancelledAppointment.save();

      // Create follow-up tasks
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const completedTask = new FollowUpTask({
        workplaceId,
        patientId: patient._id,
        assignedTo: pharmacistId,
        type: 'general_followup',
        title: 'Follow-up task',
        description: 'Test follow-up',
        objectives: ['Test objective'],
        priority: 'medium',
        dueDate: oneDayAgo,
        status: 'completed',
        completedAt: oneDayAgo,
        completedBy: pharmacistId,
        outcome: {
          status: 'successful',
          notes: 'Task completed',
          nextActions: [],
          appointmentCreated: false,
        },
        trigger: {
          type: 'manual',
          triggerDate: twoDaysAgo,
        },
        createdBy: pharmacistId,
      });
      // Set createdAt manually to 2 days ago
      completedTask.createdAt = twoDaysAgo;
      await completedTask.save();

      const overdueTask = new FollowUpTask({
        workplaceId,
        patientId: patient._id,
        assignedTo: pharmacistId,
        type: 'medication_start_followup',
        title: 'Medication follow-up',
        description: 'Test medication follow-up',
        objectives: ['Monitor medication'],
        priority: 'high',
        dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        status: 'overdue',
        trigger: {
          type: 'medication_start',
          triggerDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        },
        createdBy: pharmacistId,
      });
      await overdueTask.save();

      const result = await service.updatePatientEngagementMetrics(patient._id, workplaceId);

      expect(result).toBeDefined();
      expect(result.totalAppointments).toBe(2);
      expect(result.completedAppointments).toBe(1);
      expect(result.cancelledAppointments).toBe(1);
      expect(result.noShowAppointments).toBe(0);
      expect(result.completionRate).toBe(50); // 1/2 * 100

      expect(result.totalFollowUps).toBe(2);
      expect(result.completedFollowUps).toBe(1);
      expect(result.overdueFollowUps).toBe(1);
      expect(result.followUpCompletionRate).toBe(50); // 1/2 * 100

      expect(result.averageResponseTime).toBe(1); // 1 day response time for completed task
      expect(result.lastEngagementDate).toBeDefined();
      expect(result.engagementScore).toBeGreaterThan(0);
      expect(result.engagementScore).toBeLessThanOrEqual(100);

      // Verify patient record was updated
      const updatedPatient = await Patient.findById(patient._id);
      expect(updatedPatient?.engagementMetrics).toBeDefined();
    });

    it('should handle patient with no appointments or follow-ups', async () => {
      const patient = new Patient({
        workplaceId,
        mrn: 'PAT-002',
        firstName: 'Jane',
        lastName: 'Smith',
        dob: new Date('1990-01-01'),
        gender: 'female',
        phone: '+2348012345679',
        email: 'jane.smith@example.com',
        createdBy: pharmacistId,
      });
      await patient.save();

      const result = await service.updatePatientEngagementMetrics(patient._id, workplaceId);

      expect(result.totalAppointments).toBe(0);
      expect(result.totalFollowUps).toBe(0);
      expect(result.completionRate).toBe(0);
      expect(result.followUpCompletionRate).toBe(0);
      expect(result.averageResponseTime).toBe(0);
      expect(result.engagementScore).toBe(0);
      expect(result.lastEngagementDate).toBeUndefined();
    });
  });

  describe('syncMTRFollowUp', () => {
    it('should sync appointment status to MTR follow-up', async () => {
      // Create MTR follow-up
      const mtrFollowUp = new MTRFollowUp({
        workplaceId,
        reviewId: new mongoose.Types.ObjectId(),
        patientId,
        type: 'appointment',
        priority: 'medium',
        description: 'MTR follow-up session',
        objectives: ['Review medication adherence'],
        scheduledDate: new Date(),
        assignedTo: pharmacistId,
        status: 'scheduled',
        createdBy: pharmacistId,
      });
      await mtrFollowUp.save();

      // Create appointment linked to MTR follow-up
      const appointment = new Appointment({
        workplaceId,
        patientId,
        assignedTo: pharmacistId,
        type: 'mtm_session',
        title: 'MTR Session',
        scheduledDate: new Date(),
        scheduledTime: '10:00',
        duration: 60,
        timezone: 'Africa/Lagos',
        status: 'completed',
        completedAt: new Date(),
        outcome: {
          status: 'successful',
          notes: 'Session completed successfully',
          nextActions: ['Continue current therapy'],
          visitCreated: false,
        },
        relatedRecords: {
          followUpTaskId: mtrFollowUp._id,
        },
        createdBy: pharmacistId,
      });
      await appointment.save();

      await service.syncMTRFollowUpStatus({
        sourceId: appointment._id,
        sourceType: 'appointment',
        newStatus: 'completed',
        updatedBy: pharmacistId,
      });

      // Check that MTR follow-up was updated
      const updatedMTRFollowUp = await MTRFollowUp.findById(mtrFollowUp._id);
      expect(updatedMTRFollowUp?.status).toBe('completed');
      expect(updatedMTRFollowUp?.outcome).toBeDefined();
      expect(updatedMTRFollowUp?.outcome?.status).toBe('successful');
      expect(updatedMTRFollowUp?.completedAt).toBeDefined();
    });
  });
});