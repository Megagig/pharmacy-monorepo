import { Response } from 'express';
import { PatientAuthRequest } from '../middlewares/patientRBAC';
import mongoose from 'mongoose';

// Import models
import Patient from '../models/Patient';
import Condition from '../models/Condition';
import MedicationRecord from '../models/MedicationRecord';
import ClinicalAssessment from '../models/ClinicalAssessment';
import DrugTherapyProblem from '../models/DrugTherapyProblem';
import CarePlan from '../models/CarePlan';
import Visit from '../models/Visit';

// Import utilities
import {
  sendSuccess,
  sendError,
  respondWithPaginatedResults,
  asyncHandler,
  ensureResourceExists,
  checkTenantAccess,
  getRequestContext,
  createAuditLog,
  createDuplicateError,
  validateBusinessRules,
} from '../utils/responseHelpers';

/**
 * Patient Management Resources Controller
 * Handles conditions, medications, assessments, DTPs, care plans, visits
 */

// ===============================
// CONDITION OPERATIONS
// ===============================

export const createCondition = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const context = getRequestContext(req);

    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Check for duplicate condition
    const existingCondition = await Condition.findOne({
      patientId,
      name: req.body.name,
      isDeleted: false,
    });

    if (existingCondition) {
      throw createDuplicateError('Condition', 'name');
    }

    const condition = new Condition({
      ...req.body,
      patientId,
      workplaceId: patient!.workplaceId,
      createdBy: context.userId,
    });

    await condition.save();

    sendSuccess(res, { condition }, 'Condition added successfully', 201);
  }
);

export const getConditions = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const { page = 1, limit = 20, status } = req.query as any;
    const context = getRequestContext(req);

    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    const query: any = { patientId };
    if (status) query.status = status;

    const [conditions, total] = await Promise.all([
      Condition.find(query)
        .sort('-onsetDate -createdAt')
        .limit(limit)
        .skip((page - 1) * limit),
      Condition.countDocuments(query),
    ]);

    respondWithPaginatedResults(res, conditions, total, page, limit);
  }
);

export const updateCondition = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { conditionId } = req.params;
    const context = getRequestContext(req);

    const condition = await Condition.findById(conditionId);
    ensureResourceExists(condition, 'Condition', conditionId);
    checkTenantAccess(
      condition!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    Object.assign(condition!, req.body, { updatedBy: context.userId });
    await condition!.save();

    sendSuccess(res, { condition }, 'Condition updated successfully');
  }
);

export const deleteCondition = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { conditionId } = req.params;
    const context = getRequestContext(req);

    const condition = await Condition.findById(conditionId);
    ensureResourceExists(condition, 'Condition', conditionId);
    checkTenantAccess(
      condition!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    condition!.isDeleted = true;
    condition!.updatedBy = context.userId;
    await condition!.save();

    sendSuccess(res, null, 'Condition deleted successfully');
  }
);

// ===============================
// MEDICATION OPERATIONS
// ===============================

export const createMedication = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const context = getRequestContext(req);

    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Validate medication dates
    validateBusinessRules.validateMedicationDates(
      req.body.startDate,
      req.body.endDate
    );

    const medication = new MedicationRecord({
      ...req.body,
      patientId,
      workplaceId: patient!.workplaceId,
      createdBy: context.userId,
    });

    await medication.save();

    sendSuccess(res, { medication }, 'Medication added successfully', 201);
  }
);

export const getMedications = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const { page = 1, limit = 20, phase } = req.query as any;
    const context = getRequestContext(req);

    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    const query: any = { patientId };
    if (phase) query.phase = phase;

    const [medications, total] = await Promise.all([
      MedicationRecord.find(query)
        .sort({ phase: 1, startDate: -1 })
        .limit(limit)
        .skip((page - 1) * limit),
      MedicationRecord.countDocuments(query),
    ]);

    respondWithPaginatedResults(res, medications, total, page, limit);
  }
);

export const updateMedication = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { medId } = req.params;
    const context = getRequestContext(req);

    const medication = await MedicationRecord.findById(medId);
    ensureResourceExists(medication, 'Medication', medId);
    checkTenantAccess(
      medication!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    if (req.body.startDate || req.body.endDate) {
      validateBusinessRules.validateMedicationDates(
        req.body.startDate || medication!.startDate,
        req.body.endDate || medication!.endDate
      );
    }

    Object.assign(medication!, req.body, { updatedBy: context.userId });
    await medication!.save();

    sendSuccess(res, { medication }, 'Medication updated successfully');
  }
);

export const deleteMedication = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { medId } = req.params;
    const context = getRequestContext(req);

    const medication = await MedicationRecord.findById(medId);
    ensureResourceExists(medication, 'Medication', medId);
    checkTenantAccess(
      medication!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    medication!.isDeleted = true;
    medication!.updatedBy = context.userId;
    await medication!.save();

    sendSuccess(res, null, 'Medication deleted successfully');
  }
);

// ===============================
// CLINICAL ASSESSMENT OPERATIONS
// ===============================

export const createAssessment = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const context = getRequestContext(req);

    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Validate BP readings
    if (req.body.vitals?.bpSys && req.body.vitals?.bpDia) {
      validateBusinessRules.validateBloodPressure(
        req.body.vitals.bpSys,
        req.body.vitals.bpDia
      );
    }

    const assessment = new ClinicalAssessment({
      ...req.body,
      patientId,
      workplaceId: patient!.workplaceId,
      createdBy: context.userId,
    });

    await assessment.save();

    // Update patient's latest vitals if provided
    if (req.body.vitals) {
      patient!.latestVitals = {
        ...req.body.vitals,
        recordedAt: req.body.recordedAt || new Date(),
      };
      await patient!.save();
    }

    sendSuccess(
      res,
      { assessment },
      'Clinical assessment added successfully',
      201
    );
  }
);

export const getAssessments = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const { page = 1, limit = 20 } = req.query as any;
    const context = getRequestContext(req);

    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    const [assessments, total] = await Promise.all([
      ClinicalAssessment.find({ patientId })
        .sort('-recordedAt')
        .limit(limit)
        .skip((page - 1) * limit),
      ClinicalAssessment.countDocuments({ patientId }),
    ]);

    respondWithPaginatedResults(res, assessments, total, page, limit);
  }
);

export const updateAssessment = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { assessmentId } = req.params;
    const context = getRequestContext(req);

    const assessment = await ClinicalAssessment.findById(assessmentId);
    ensureResourceExists(assessment, 'Assessment', assessmentId);
    checkTenantAccess(
      assessment!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    if (req.body.vitals?.bpSys && req.body.vitals?.bpDia) {
      validateBusinessRules.validateBloodPressure(
        req.body.vitals.bpSys,
        req.body.vitals.bpDia
      );
    }

    Object.assign(assessment!, req.body, { updatedBy: context.userId });
    await assessment!.save();

    sendSuccess(res, { assessment }, 'Assessment updated successfully');
  }
);

// ===============================
// DTP OPERATIONS
// ===============================

export const createDTP = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const context = getRequestContext(req);

    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    const dtp = new DrugTherapyProblem({
      ...req.body,
      patientId,
      workplaceId: patient!.workplaceId,
      createdBy: context.userId,
    });

    await dtp.save();

    // Update patient's hasActiveDTP flag
    if (dtp.status === 'identified') {
      patient!.hasActiveDTP = true;
      await patient!.save();
    }

    sendSuccess(res, { dtp }, 'DTP added successfully', 201);
  }
);

export const getDTPs = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const { page = 1, limit = 20, status } = req.query as any;
    const context = getRequestContext(req);

    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    const query: any = { patientId };
    if (status) query.status = status;

    const [dtps, total] = await Promise.all([
      DrugTherapyProblem.find(query)
        .sort('-createdAt')
        .limit(limit)
        .skip((page - 1) * limit),
      DrugTherapyProblem.countDocuments(query),
    ]);

    respondWithPaginatedResults(res, dtps, total, page, limit);
  }
);

export const updateDTP = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { dtpId } = req.params;
    const context = getRequestContext(req);

    const dtp = await DrugTherapyProblem.findById(dtpId);
    ensureResourceExists(dtp, 'DTP', dtpId);
    checkTenantAccess(
      dtp!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    Object.assign(dtp!, req.body, { updatedBy: context.userId });
    await dtp!.save();

    // Update patient's hasActiveDTP flag
    if (req.body.status === 'resolved') {
      const unresolvedCount = await DrugTherapyProblem.countDocuments({
        patientId: dtp!.patientId,
        status: 'unresolved',
      });

      if (unresolvedCount === 0) {
        await Patient.findByIdAndUpdate(dtp!.patientId, {
          hasActiveDTP: false,
        });
      }
    }

    sendSuccess(res, { dtp }, 'DTP updated successfully');
  }
);

// ===============================
// CARE PLAN OPERATIONS
// ===============================

export const createCarePlan = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const context = getRequestContext(req);

    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    if (req.body.followUpDate) {
      validateBusinessRules.validateFollowUpDate(
        new Date(req.body.followUpDate)
      );
    }

    const carePlan = new CarePlan({
      ...req.body,
      patientId,
      workplaceId: patient!.workplaceId,
      createdBy: context.userId,
    });

    await carePlan.save();

    sendSuccess(res, { carePlan }, 'Care plan created successfully', 201);
  }
);

export const getCarePlans = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const { page = 1, limit = 10 } = req.query as any;
    const context = getRequestContext(req);

    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    const [carePlans, total] = await Promise.all([
      CarePlan.find({ patientId })
        .sort('-createdAt')
        .limit(limit)
        .skip((page - 1) * limit),
      CarePlan.countDocuments({ patientId }),
    ]);

    respondWithPaginatedResults(res, carePlans, total, page, limit);
  }
);

export const updateCarePlan = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { carePlanId } = req.params;
    const context = getRequestContext(req);

    const carePlan = await CarePlan.findById(carePlanId);
    ensureResourceExists(carePlan, 'CarePlan', carePlanId);
    checkTenantAccess(
      carePlan!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    if (req.body.followUpDate) {
      validateBusinessRules.validateFollowUpDate(
        new Date(req.body.followUpDate)
      );
    }

    Object.assign(carePlan!, req.body, { updatedBy: context.userId });
    await carePlan!.save();

    sendSuccess(res, { carePlan }, 'Care plan updated successfully');
  }
);

// ===============================
// VISIT OPERATIONS
// ===============================

export const createVisit = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const context = getRequestContext(req);

    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    const visit = new Visit({
      ...req.body,
      patientId,
      workplaceId: patient!.workplaceId,
      createdBy: context.userId,
    });

    await visit.save();

    sendSuccess(res, { visit }, 'Visit created successfully', 201);
  }
);

export const getVisits = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const { page = 1, limit = 10 } = req.query as any;
    const context = getRequestContext(req);

    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    const [visits, total] = await Promise.all([
      Visit.find({ patientId })
        .sort('-date')
        .limit(limit)
        .skip((page - 1) * limit),
      Visit.countDocuments({ patientId }),
    ]);

    respondWithPaginatedResults(res, visits, total, page, limit);
  }
);

export const getVisit = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { visitId } = req.params;
    const context = getRequestContext(req);

    const visit = await Visit.findById(visitId).populate(
      'patientId',
      'firstName lastName mrn'
    );
    ensureResourceExists(visit, 'Visit', visitId);
    checkTenantAccess(
      visit!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    sendSuccess(res, { visit }, 'Visit details retrieved successfully');
  }
);

export const updateVisit = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { visitId } = req.params;
    const context = getRequestContext(req);

    const visit = await Visit.findById(visitId);
    ensureResourceExists(visit, 'Visit', visitId);
    checkTenantAccess(
      visit!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    Object.assign(visit!, req.body, { updatedBy: context.userId });
    await visit!.save();

    sendSuccess(res, { visit }, 'Visit updated successfully');
  }
);

export const addVisitAttachment = asyncHandler(
  async (req: PatientAuthRequest, res: Response) => {
    const { visitId } = req.params;
    const context = getRequestContext(req);

    const visit = await Visit.findById(visitId);
    ensureResourceExists(visit, 'Visit', visitId);
    checkTenantAccess(
      visit!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    if (!visit!.attachments) visit!.attachments = [];
    if (visit!.attachments.length >= 10) {
      return sendError(
        res,
        'BAD_REQUEST',
        'Maximum 10 attachments allowed per visit',
        400
      );
    }

    visit!.attachments.push({
      ...req.body,
      uploadedAt: new Date(),
    });

    await visit!.save();

    sendSuccess(res, { visit }, 'Attachment added successfully');
  }
);
