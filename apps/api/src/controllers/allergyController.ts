import { Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import Allergy from '../models/Allergy';
import Patient from '../models/Patient';
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
  createPaginationMeta,
} from '../utils/responseHelpers';

/**
 * Allergy Management Controller
 * CRUD operations for patient allergies
 * Routes: POST/GET/PATCH/DELETE /api/patients/:id/allergies
 */

/**
 * POST /api/patients/:id/allergies
 * Add new allergy to patient
 */
export const createAllergy = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const context = getRequestContext(req);
    const allergyData = req.body;

    // Verify patient exists and user has access
    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Check for duplicate allergy
    const existingAllergy = await Allergy.findOne({
      patientId,
      substance: allergyData.substance,
      isDeleted: false,
    });

    if (existingAllergy) {
      throw createDuplicateError('Allergy', 'substance');
    }

    // Create allergy
    const allergy = new Allergy({
      ...allergyData,
      patientId,
      workplaceId: patient!.workplaceId,
      createdBy: context.userId,
      isDeleted: false,
    });

    await allergy.save();

    // Audit log
    console.log(
      'Allergy created:',
      createAuditLog(
        'CREATE_ALLERGY',
        'Allergy',
        allergy._id.toString(),
        context,
        { patientId, substance: allergy.substance, severity: allergy.severity }
      )
    );

    sendSuccess(res, { allergy }, 'Allergy added successfully', 201);
  }
);

/**
 * GET /api/patients/:id/allergies
 * Get all allergies for a patient
 */
export const getAllergies = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const { page = 1, limit = 20, severity } = req.query as any;
    const context = getRequestContext(req);

    // Verify patient exists and user has access
    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Build query
    const query: any = { patientId };
    if (severity) {
      query.severity = severity;
    }

    // Get allergies with pagination
    const [allergies, total] = await Promise.all([
      Allergy.find(query)
        .sort('-notedAt -createdAt')
        .limit(limit)
        .skip((page - 1) * limit)
        .populate('createdBy', 'firstName lastName')
        .populate('updatedBy', 'firstName lastName'),
      Allergy.countDocuments(query),
    ]);

    // Group by severity for summary
    const summary = {
      total,
      bySeverity: {
        severe: allergies.filter((a) => a.severity === 'severe').length,
        moderate: allergies.filter((a) => a.severity === 'moderate').length,
        mild: allergies.filter((a) => a.severity === 'mild').length,
      },
      criticalAllergies: allergies
        .filter((a) => a.severity === 'severe')
        .map((a) => a.substance),
    };

    const meta = createPaginationMeta(total, page, limit);

    sendSuccess(
      res,
      {
        results: allergies,
        summary,
      },
      `Found ${total} allergies for patient`,
      200,
      meta
    );
  }
);

/**
 * GET /api/allergies/:allergyId
 * Get specific allergy details
 */
export const getAllergy = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { allergyId } = req.params;
    const context = getRequestContext(req);

    // Find allergy
    const allergy = await Allergy.findById(allergyId)
      .populate('patientId', 'firstName lastName mrn')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName');

    ensureResourceExists(allergy, 'Allergy', allergyId);
    checkTenantAccess(
      allergy!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    sendSuccess(res, { allergy }, 'Allergy details retrieved successfully');
  }
);

/**
 * PATCH /api/allergies/:allergyId
 * Update allergy information
 */
export const updateAllergy = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { allergyId } = req.params;
    const context = getRequestContext(req);
    const updates = req.body;

    // Find allergy
    const allergy = await Allergy.findById(allergyId);
    ensureResourceExists(allergy, 'Allergy', allergyId);
    checkTenantAccess(
      allergy!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // If updating substance, check for duplicates
    if (updates.substance && updates.substance !== allergy!.substance) {
      const existingAllergy = await Allergy.findOne({
        patientId: allergy!.patientId,
        substance: updates.substance,
        isDeleted: false,
        _id: { $ne: allergyId },
      });

      if (existingAllergy) {
        throw createDuplicateError('Allergy', 'substance');
      }
    }

    // Update allergy
    const originalData = allergy!.toObject();
    Object.assign(allergy!, updates, {
      updatedBy: context.userId,
      updatedAt: new Date(),
    });

    await allergy!.save();

    // Audit log
    console.log(
      'Allergy updated:',
      createAuditLog(
        'UPDATE_ALLERGY',
        'Allergy',
        allergy!._id.toString(),
        context,
        { original: originalData, updates }
      )
    );

    sendSuccess(res, { allergy }, 'Allergy updated successfully');
  }
);

/**
 * DELETE /api/allergies/:allergyId
 * Delete allergy (soft delete)
 */
export const deleteAllergy = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { allergyId } = req.params;
    const context = getRequestContext(req);

    // Find allergy
    const allergy = await Allergy.findById(allergyId);
    ensureResourceExists(allergy, 'Allergy', allergyId);
    checkTenantAccess(
      allergy!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Soft delete
    allergy!.isDeleted = true;
    allergy!.updatedBy = context.userId;
    await allergy!.save();

    // Audit log
    console.log(
      'Allergy deleted:',
      createAuditLog(
        'DELETE_ALLERGY',
        'Allergy',
        allergy!._id.toString(),
        context,
        { substance: allergy!.substance, patientId: allergy!.patientId }
      )
    );

    sendSuccess(res, null, 'Allergy deleted successfully');
  }
);

/**
 * GET /api/patients/:id/allergies/critical
 * Get critical allergies for patient (severity: severe)
 */
export const getCriticalAllergies = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { id: patientId } = req.params;
    const context = getRequestContext(req);

    // Verify patient exists and user has access
    const patient = await Patient.findById(patientId);
    ensureResourceExists(patient, 'Patient', patientId);
    checkTenantAccess(
      patient!.workplaceId.toString(),
      context.workplaceId,
      context.isAdmin
    );

    // Get severe allergies
    const criticalAllergies = await Allergy.find({
      patientId,
      severity: 'severe',
      isDeleted: false,
    }).sort('-notedAt');

    const summary = {
      total: criticalAllergies.length,
      substances: criticalAllergies.map((a) => a.substance),
      hasLifeThreatening: criticalAllergies.some(
        (a) =>
          a.reaction?.toLowerCase().includes('anaphylaxis') ||
          a.reaction?.toLowerCase().includes('anaphylactic')
      ),
    };

    sendSuccess(
      res,
      {
        allergies: criticalAllergies,
        summary,
      },
      `Found ${criticalAllergies.length} critical allergies`
    );
  }
);

/**
 * GET /api/allergies/search
 * Search allergies by substance across all patients (for pharmacy)
 */
export const searchAllergies = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const { substance, limit = 10 } = req.query as any;
    const context = getRequestContext(req);

    if (!substance) {
      return sendError(
        res,
        'BAD_REQUEST',
        'Substance parameter is required',
        400
      );
    }

    const searchRegex = new RegExp(substance, 'i');
    const query: any = {
      substance: searchRegex,
    };

    // Tenant filtering
    if (!context.isAdmin) {
      query.workplaceId = context.workplaceId;
    }

    const allergies = await Allergy.find(query)
      .populate('patientId', 'firstName lastName mrn')
      .sort('substance')
      .limit(Math.min(parseInt(limit), 50));

    // Group by substance
    const groupedResults = allergies.reduce((acc: any, allergy) => {
      const substance = allergy.substance.toLowerCase();
      if (!acc[substance]) {
        acc[substance] = {
          substance: allergy.substance,
          patients: [],
          severityCounts: { mild: 0, moderate: 0, severe: 0 },
        };
      }

      acc[substance].patients.push({
        patientId: allergy.patientId._id,
        patientName: `${(allergy.patientId as any).firstName} ${
          (allergy.patientId as any).lastName
        }`,
        mrn: (allergy.patientId as any).mrn,
        severity: allergy.severity,
        reaction: allergy.reaction,
      });

      acc[substance].severityCounts[allergy.severity || 'mild']++;

      return acc;
    }, {});

    sendSuccess(
      res,
      {
        results: Object.values(groupedResults),
        total: Object.keys(groupedResults).length,
        searchTerm: substance,
      },
      `Found ${allergies.length} allergies matching "${substance}"`
    );
  }
);
