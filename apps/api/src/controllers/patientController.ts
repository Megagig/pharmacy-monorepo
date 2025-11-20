import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middlewares/auth';

// Import models
import Patient from '../models/Patient';
import Allergy from '../models/Allergy';
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
  respondWithPatient,
  respondWithPaginatedResults,
  asyncHandler,
  ensureResourceExists,
  checkTenantAccess,
  getRequestContext,
  validateBusinessRules,
  createAuditLog,
  createPaginationMeta,
} from '../utils/responseHelpers';
import { CursorPagination } from '../utils/cursorPagination';

/**
 * Patient Management Controller
 * Comprehensive CRUD operations for Patient Management module
 */

// ===============================
// PATIENT OPERATIONS
// ===============================

/**
 * GET /api/patients
 * List patients with search, filtering, and pagination
 */
export const getPatients = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const {
      cursor,
      limit = 20,
      sortField = 'createdAt',
      sortOrder = 'desc',
      q,
      name,
      mrn,
      phone,
      state,
      bloodGroup,
      genotype,
      // Legacy support for page-based pagination
      page,
      useCursor = 'true',
    } = req.query as any;
    const context = getRequestContext(req);

    // Debug logging for super admin access
    console.log('🔍 GET /api/patients - Request Context:', {
      userId: context.userId,
      userRole: context.userRole,
      workplaceId: context.workplaceId,
      isAdmin: context.isAdmin,
      isSuperAdmin: context.isSuperAdmin,
      requestUser: {
        id: req.user?._id,
        email: req.user?.email,
        role: req.user?.role,
      }
    });

    // Parse limit
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit as string) || 20));

    // Build filters
    const filters: any = {};

    // Always filter out deleted patients
    filters.isDeleted = { $ne: true };

    // Tenant filtering
    if (!context.isAdmin) {
      filters.workplaceId = context.workplaceId;
      console.log('🔒 Applying workspace filter:', context.workplaceId);
    } else {
      console.log('🔓 Super admin access - NO workspace filter applied');
    }

    // Search functionality
    if (q) {
      const searchRegex = new RegExp(q, 'i');
      filters.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { otherNames: searchRegex },
        { mrn: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
      ];
    }

    // Specific filters
    if (name) {
      const nameRegex = new RegExp(name, 'i');
      filters.$or = [
        { firstName: nameRegex },
        { lastName: nameRegex },
        { otherNames: nameRegex },
      ];
    }

    if (mrn) filters.mrn = new RegExp(mrn, 'i');
    if (phone) filters.phone = new RegExp(phone.replace('+', '\\+'), 'i');
    if (state) filters.state = state;
    if (bloodGroup) filters.bloodGroup = bloodGroup;
    if (genotype) filters.genotype = genotype;

    // Use cursor-based pagination by default, fall back to skip/limit for legacy support
    if (useCursor === 'true' && !page) {
      // Cursor-based pagination (recommended)
      console.log('📄 Using cursor-based pagination with filters:', JSON.stringify(filters));

      const result = await CursorPagination.paginate(Patient, {
        limit: parsedLimit,
        cursor,
        sortField,
        sortOrder: sortOrder as 'asc' | 'desc',
        filters,
      });

      console.log('📊 Cursor Query Results:', {
        patientsFound: result.items.length,
        totalCount: result.totalCount,
        hasNextPage: result.pageInfo.hasNextPage
      });

      // Create paginated response
      const response = CursorPagination.createPaginatedResponse(
        result,
        `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`,
        { limit: parsedLimit, sortField, sortOrder, ...req.query }
      );

      return sendSuccess(
        res,
        { results: response.data },
        `Found ${response.data.length} patients`,
        200,
        {
          total: response.pagination.totalCount,
          limit: parsedLimit,
          hasNext: response.pagination.pageInfo.hasNextPage,
          nextCursor: response.pagination.cursors.next,
        }
      );
    } else {
      // Legacy skip/limit pagination (for backward compatibility)
      const parsedPage = Math.max(1, parseInt(page as string) || 1);

      const [patients, total] = await Promise.all([
        Patient.find(filters)
          .sort({ [sortField]: sortOrder === 'asc' ? 1 : -1 })
          .limit(parsedLimit)
          .skip((parsedPage - 1) * parsedLimit)
          .select('-__v')
          .lean(),
        Patient.countDocuments(filters),
      ]);

      console.log('📊 Query Results:', {
        filters: JSON.stringify(filters),
        patientsFound: patients.length,
        totalCount: total,
        page: parsedPage,
        limit: parsedLimit
      });

      respondWithPaginatedResults(
        res,
        patients,
        total,
        parsedPage,
        parsedLimit,
        `Found ${total} patients`
      );
    }
  }
);

/**
 * GET /api/patients/:id - Get patient details
 */
export const getPatient = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const context = getRequestContext(req);

    // Find patient with full details
    const patient = await Patient.findById(id)
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    ensureResourceExists(patient, 'Patient', id);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Create clean patient object with computed properties
    const responseData = {
      patient: {
        ...patient!.toObject(),
        age: patient!.getAge(),
        displayName: patient!.getDisplayName(),
      },
    };

    sendSuccess(res, responseData, 'Patient details retrieved successfully');
  }
);

/**
 * POST /api/patients
 * Create new patient with optional related data
 */
export const createPatient = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const context = getRequestContext(req);
    const {
      allergies,
      conditions,
      medications,
      assessment,
      dtps,
      carePlan,
      ...patientData
    } = req.body;

    // Validate business rules
    validateBusinessRules.validatePatientAge(patientData.dob, patientData.age);

    // Start transaction for atomic operations
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Generate MRN
      const workplaceCode = 'GEN'; // TODO: Get from workplace settings
      const mrn = await (Patient as any).generateNextMRN(context.workplaceId, workplaceCode);

      // Create patient
      const patient = new Patient({
        ...patientData,
        mrn,
        workplaceId: context.workplaceId,
        createdBy: context.userId,
        isDeleted: false,
      });

      await patient.save({ session });

      // Create related data if provided
      const relatedData: any = {};

      // Create allergies
      if (allergies?.length) {
        const allergyDocs = allergies.map((allergy: any) => ({
          ...allergy,
          patientId: patient._id,
          workplaceId: context.workplaceId,
          createdBy: context.userId,
        }));
        relatedData.allergies = await Allergy.insertMany(allergyDocs, {
          session,
        });
      }

      // Create conditions
      if (conditions?.length) {
        const conditionDocs = conditions.map((condition: any) => ({
          ...condition,
          patientId: patient._id,
          workplaceId: context.workplaceId,
          createdBy: context.userId,
        }));
        relatedData.conditions = await Condition.insertMany(conditionDocs, {
          session,
        });
      }

      // Create medications
      if (medications?.length) {
        const medicationDocs = medications.map((medication: any) => ({
          ...medication,
          patientId: patient._id,
          workplaceId: context.workplaceId,
          createdBy: context.userId,
        }));
        relatedData.medications = await MedicationRecord.insertMany(
          medicationDocs,
          { session }
        );
      }

      // Create clinical assessment
      if (assessment?.vitals || assessment?.labs) {
        const assessmentDoc = new ClinicalAssessment({
          ...assessment,
          patientId: patient._id,
          workplaceId: context.workplaceId,
          createdBy: context.userId,
        });
        await assessmentDoc.save({ session });
        relatedData.assessment = assessmentDoc;

        // Update patient's latest vitals
        if (assessment.vitals) {
          patient.latestVitals = {
            ...assessment.vitals,
            recordedAt: assessment.recordedAt || new Date(),
          };
          await patient.save({ session });
        }
      }

      // Create DTPs
      if (dtps?.length) {
        const dtpDocs = dtps.map((dtp: any) => ({
          ...dtp,
          patientId: patient._id,
          workplaceId: context.workplaceId,
          createdBy: context.userId,
        }));
        const createdDTPs = await DrugTherapyProblem.insertMany(dtpDocs, {
          session,
        });
        relatedData.dtps = createdDTPs;

        // Update patient's hasActiveDTP flag
        const hasUnresolvedDTPs = createdDTPs.some(
          (dtp: any) => dtp.status === 'unresolved'
        );
        if (hasUnresolvedDTPs) {
          patient.hasActiveDTP = true;
          await patient.save({ session });
        }
      }

      // Create care plan
      if (carePlan) {
        const carePlanDoc = new CarePlan({
          ...carePlan,
          patientId: patient._id,
          workplaceId: context.workplaceId,
          createdBy: context.userId,
        });
        await carePlanDoc.save({ session });
        relatedData.carePlan = carePlanDoc;
      }

      await session.commitTransaction();

      // Audit log
      console.log(
        'Patient created:',
        createAuditLog(
          'CREATE_PATIENT',
          'Patient',
          patient._id.toString(),
          context,
          { mrn: patient.mrn, name: patient.getDisplayName() }
        )
      );

      sendSuccess(
        res,
        {
          patient: {
            ...patient.toObject(),
            age: patient.getAge(),
            displayName: patient.getDisplayName(),
          },
          related: relatedData,
        },
        'Patient created successfully',
        201
      );
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
);

export const updatePatient = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const context = getRequestContext(req);
    const updates = req.body;

    // Find patient
    const patient = await Patient.findById(id);
    ensureResourceExists(patient, 'Patient', id);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Validate age/DOB consistency if both are provided
    if (updates.dob || updates.age) {
      validateBusinessRules.validatePatientAge(
        updates.dob || patient!.dob,
        updates.age || patient!.age
      );
    }

    // Update patient
    Object.assign(patient!, updates, {
      updatedBy: context.userId,
      updatedAt: new Date(),
    });

    await patient!.save();

    // Audit log
    console.log(
      'Patient updated:',
      createAuditLog(
        'UPDATE_PATIENT',
        'Patient',
        patient!._id.toString(),
        context,
        { updates }
      )
    );

    respondWithPatient(res, patient!, 'Patient updated successfully');
  }
);

export const deletePatient = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const context = getRequestContext(req);

    // Find patient
    const patient = await Patient.findById(id);
    ensureResourceExists(patient, 'Patient', id);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Soft delete
    patient!.isDeleted = true;
    patient!.updatedBy = context.userId;
    await patient!.save();

    // Audit log
    console.log(
      'Patient deleted:',
      createAuditLog(
        'DELETE_PATIENT',
        'Patient',
        patient!._id.toString(),
        context,
        { mrn: patient!.mrn, name: patient!.getDisplayName() }
      )
    );

    sendSuccess(res, null, 'Patient deleted successfully');
  }
);

/**
 * GET /api/patients/search
 * Advanced patient search with multiple criteria
 */
export const searchPatients = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { q, limit = 10 } = req.query as any;
    const context = getRequestContext(req);

    if (!q) {
      return sendError(res, 'BAD_REQUEST', 'Search query is required', 400);
    }

    const searchRegex = new RegExp(q, 'i');
    const query: any = {
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { otherNames: searchRegex },
        { mrn: searchRegex },
        { phone: searchRegex },
      ],
    };

    // Tenant filtering
    if (!context.isAdmin) {
      query.workplaceId = context.workplaceId;
    }

    const patients = await Patient.find(query)
      .select(
        '_id firstName lastName otherNames mrn phone dob bloodGroup latestVitals'
      )
      .limit(Math.min(parseInt(limit), 50))
      .sort('lastName firstName')
      .lean();

    // Debug what we get from the database
    console.log('🔍 Backend - Raw patients from DB:', patients.map(p => ({
      _id: p._id,
      hasId: !!p._id,
      idType: typeof p._id,
      firstName: p.firstName,
      mrn: p.mrn,
    })));

    // Add computed fields and ensure _id is properly included
    const enrichedPatients = patients.map((patient) => {
      // Debug logging to see what we're getting from the database
      console.log('🔍 Backend - Raw patient from DB:', {
        _id: patient._id,
        id: patient.id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        mrn: patient.mrn,
        keys: Object.keys(patient),
      });

      const enrichedPatient = {
        _id: patient._id?.toString() || patient._id || patient.id, // Ensure _id is included and converted to string
        firstName: patient.firstName,
        lastName: patient.lastName,
        otherNames: patient.otherNames,
        mrn: patient.mrn,
        phone: patient.phone,
        dob: patient.dob,
        bloodGroup: patient.bloodGroup,
        latestVitals: patient.latestVitals,
        displayName: `${patient.firstName} ${patient.lastName}`,
        age: patient.dob
          ? Math.floor(
            (Date.now() - patient.dob.getTime()) /
            (1000 * 60 * 60 * 24 * 365.25)
          )
          : null,
      };

      // Final check to ensure _id is present
      if (!enrichedPatient._id) {
        console.error('❌ Backend - Patient missing _id after enrichment:', patient);
        // Use mrn as fallback ID if _id is still missing
        enrichedPatient._id = patient.mrn;
      }

      return enrichedPatient;
    });

    // Debug the final response
    console.log('🔍 Backend - Enriched patients being sent:', enrichedPatients.map(p => ({
      _id: p._id,
      firstName: p.firstName,
      lastName: p.lastName,
      mrn: p.mrn,
    })));

    sendSuccess(
      res,
      {
        patients: enrichedPatients,
        total: enrichedPatients.length,
        query: q,
      },
      `Found ${enrichedPatients.length} patients`
    );
  }
);

/**
 * GET /api/patients/:id/summary
 * Get patient summary for dashboard/overview
 */
export const getPatientSummary = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const context = getRequestContext(req);

    // Find patient
    const patient = await Patient.findById(id);
    ensureResourceExists(patient, 'Patient', id);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Get counts for patient's related records
    const [allergyCount, conditionCount, medicationCount, visitCount, interventionCount, activeInterventionCount] =
      await Promise.all([
        Allergy.countDocuments({ patientId: id, isDeleted: false }),
        Condition.countDocuments({ patientId: id, isDeleted: false }),
        MedicationRecord.countDocuments({
          patientId: id,
          isDeleted: false,
          phase: 'current',
        }),
        Visit.countDocuments({ patientId: id, isDeleted: false }),
        patient!.getInterventionCount(),
        patient!.getActiveInterventionCount(),
      ]);

    const summary = {
      patient: {
        id: patient!._id,
        name: `${patient!.firstName} ${patient!.lastName}`,
        mrn: patient!.mrn,
        age: patient!.dob
          ? Math.floor(
            (Date.now() - patient!.dob.getTime()) /
            (1000 * 60 * 60 * 24 * 365.25)
          )
          : null,
        latestVitals: patient!.latestVitals,
      },
      counts: {
        allergies: allergyCount,
        conditions: conditionCount,
        currentMedications: medicationCount,
        visits: visitCount,
        interventions: interventionCount,
        activeInterventions: activeInterventionCount,
        hasActiveDTP: patient!.hasActiveDTP,
        hasActiveInterventions: patient!.hasActiveInterventions,
      },
    };

    sendSuccess(res, summary, 'Patient summary retrieved successfully');
  }
);

/**
 * GET /api/patients/:id/interventions
 * Get patient intervention history
 */
export const getPatientInterventions = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { page = 1, limit = 10, status, category } = req.query as any;
    const context = getRequestContext(req);

    // Find patient
    const patient = await Patient.findById(id);
    ensureResourceExists(patient, 'Patient', id);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Parse pagination parameters
    const parsedPage = Math.max(1, parseInt(page as string) || 1);
    const parsedLimit = Math.min(
      50,
      Math.max(1, parseInt(limit as string) || 10)
    );

    // Build query for interventions
    const query: any = {
      patientId: id,
      isDeleted: false,
    };

    if (status) {
      query.status = status;
    }

    if (category) {
      query.category = category;
    }

    // Import ClinicalIntervention model
    const ClinicalIntervention = mongoose.model('ClinicalIntervention');

    // Get interventions with pagination
    const [interventions, total] = await Promise.all([
      ClinicalIntervention.find(query)
        .populate('identifiedBy', 'firstName lastName')
        .populate('assignments.userId', 'firstName lastName role')
        .sort({ identifiedDate: -1 })
        .limit(parsedLimit)
        .skip((parsedPage - 1) * parsedLimit)
        .lean(),
      ClinicalIntervention.countDocuments(query),
    ]);

    respondWithPaginatedResults(
      res,
      interventions,
      total,
      parsedPage,
      parsedLimit,
      `Found ${total} interventions for patient`
    );
  }
);

/**
 * GET /api/patients/search-with-interventions
 * Search patients with intervention context
 */
export const searchPatientsWithInterventions = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { q, limit = 10 } = req.query as any;
    const context = getRequestContext(req);

    if (!q) {
      return sendError(res, 'BAD_REQUEST', 'Search query is required', 400);
    }

    // Import ClinicalInterventionService
    const ClinicalInterventionService = require('../services/clinicalInterventionService').default;

    const patients = await ClinicalInterventionService.searchPatientsWithInterventions(
      q,
      context.workplaceId,
      Math.min(parseInt(limit), 50)
    );

    sendSuccess(
      res,
      {
        patients,
        total: patients.length,
        query: q,
      },
      `Found ${patients.length} patients with intervention context`
    );
  }
);

/**
 * GET /api/patients/:id/diagnostic-history
 * Get patient diagnostic history
 */
export const getPatientDiagnosticHistory = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { page = 1, limit = 10, includeArchived = false } = req.query;
    const context = getRequestContext(req);

    // Find patient
    const patient = await Patient.findById(id);
    ensureResourceExists(patient, 'Patient', id);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Import DiagnosticHistory model
    const DiagnosticHistory = mongoose.model('DiagnosticHistory');

    const skip = (Number(page) - 1) * Number(limit);
    const statusFilter = includeArchived === 'true'
      ? { status: { $in: ['active', 'archived'] } }
      : { status: 'active' };

    const history = await DiagnosticHistory.find({
      patientId: patient._id,
      workplaceId: context.workplaceId,
      ...statusFilter,
    })
      .populate('pharmacistId', 'firstName lastName')
      .populate('notes.addedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await DiagnosticHistory.countDocuments({
      patientId: patient._id,
      workplaceId: context.workplaceId,
      ...statusFilter,
    });

    // Create audit log
    createAuditLog(
      'VIEW_PATIENT_DIAGNOSTIC_HISTORY',
      'Patient',
      patient._id.toString(),
      context
    );

    sendSuccess(res, {
      history,
      pagination: {
        current: Number(page),
        total: Math.ceil(total / Number(limit)),
        count: history.length,
        totalRecords: total,
      },
      patient: {
        id: patient._id,
        name: patient.getDisplayName(),
        age: patient.getAge(),
        gender: patient.gender,
      },
    });
  }
);

/**
 * GET /api/patients/:id/diagnostic-summary
 * Get patient diagnostic summary for dashboard
 */
export const getPatientDiagnosticSummary = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const context = getRequestContext(req);

    // Find patient
    const patient = await Patient.findById(id);
    ensureResourceExists(patient, 'Patient', id);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Get diagnostic history count and latest entry
    const diagnosticHistoryCount = await patient.getDiagnosticHistoryCount();
    const latestDiagnosticHistory = await patient.getLatestDiagnosticHistory();

    // Import DiagnosticHistory model for additional queries
    const DiagnosticHistory = mongoose.model('DiagnosticHistory');

    // Get pending follow-ups
    const pendingFollowUps = await DiagnosticHistory.countDocuments({
      patientId: patient._id,
      workplaceId: context.workplaceId,
      status: 'active',
      'followUp.required': true,
      'followUp.completed': false,
    });

    // Get referrals count
    const referralsCount = await DiagnosticHistory.countDocuments({
      patientId: patient._id,
      workplaceId: context.workplaceId,
      status: 'active',
      'referral.generated': true,
    });

    sendSuccess(res, {
      patient: {
        id: patient._id,
        name: patient.getDisplayName(),
        age: patient.getAge(),
        gender: patient.gender,
      },
      diagnosticSummary: {
        totalCases: diagnosticHistoryCount,
        pendingFollowUps,
        referralsGenerated: referralsCount,
        latestCase: latestDiagnosticHistory ? {
          id: latestDiagnosticHistory._id,
          caseId: latestDiagnosticHistory.caseId,
          createdAt: latestDiagnosticHistory.createdAt,
          pharmacist: latestDiagnosticHistory.pharmacistId,
          confidenceScore: latestDiagnosticHistory.analysisSnapshot?.confidenceScore,
        } : null,
      },
    });
  }
);