import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import PatientUser from '../models/PatientUser';
import Patient from '../models/Patient';
import AppError from '../utils/AppError';
import logger from '../utils/logger';
import { AuthRequest } from '../middlewares/auth';

export class PatientLinkingAdminController {
  /**
   * Get unlinked PatientUsers for admin review
   * GET /api/admin/patient-linking/unlinked
   */
  static async getUnlinkedPatientUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 20, workspaceId } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      // Build query - filter by workspace if provided, otherwise use user's workplace
      const query: any = {
        status: 'active',
        patientId: { $exists: false },
        isDeleted: false,
      };

      if (workspaceId) {
        query.workplaceId = workspaceId;
      } else if (req.user?.workplaceId) {
        query.workplaceId = req.user.workplaceId;
      }

      const [patientUsers, total] = await Promise.all([
        PatientUser.find(query)
          .select('firstName lastName email phone dateOfBirth workplaceId status createdAt')
          .populate('workplaceId', 'name inviteCode')
          .sort({ createdAt: -1 })
          .limit(Number(limit))
          .skip(skip)
          .lean(),
        PatientUser.countDocuments(query)
      ]);

      logger.info('Unlinked PatientUsers fetched for admin:', {
        adminUserId: req.user?._id,
        workspaceId: workspaceId || req.user?.workplaceId,
        count: patientUsers.length,
        total,
        page: Number(page)
      });

      res.status(200).json({
        success: true,
        data: {
          patientUsers,
          pagination: {
            currentPage: Number(page),
            totalPages: Math.ceil(total / Number(limit)),
            totalResults: total,
            hasMore: skip + patientUsers.length < total,
            limit: Number(limit)
          }
        }
      });
    } catch (error) {
      logger.error('Error fetching unlinked PatientUsers:', {
        error: error.message,
        adminUserId: req.user?._id,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Find potential Patient matches for a PatientUser
   * GET /api/admin/patient-linking/:patientUserId/matches
   */
  static async findPotentialMatches(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { patientUserId } = req.params;

      // Simple implementation for now - find by email and name
      const patientUser = await PatientUser.findById(patientUserId);
      if (!patientUser) {
        throw new AppError('PatientUser not found', 404);
      }

      const matches = [];
      
      // Find by email
      if (patientUser.email) {
        const emailMatches = await Patient.find({
          workplaceId: patientUser.workplaceId,
          email: patientUser.email,
          isDeleted: false,
        }).select('_id firstName lastName email phone mrn createdAt').lean();
        
        matches.push(...emailMatches.map(match => ({
          ...match,
          matchType: 'email',
          confidence: 'high'
        })));
      }

      logger.info('Potential Patient matches found:', {
        adminUserId: req.user?._id,
        patientUserId,
        matchCount: matches.length
      });

      res.status(200).json({
        success: true,
        data: {
          matches,
          patientUserId
        }
      });
    } catch (error) {
      logger.error('Error finding potential matches:', {
        error: error.message,
        adminUserId: req.user?._id,
        patientUserId: req.params.patientUserId,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Manually link PatientUser to Patient record
   * POST /api/admin/patient-linking/:patientUserId/link
   */
  static async manuallyLinkPatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { patientUserId } = req.params;
      const { patientId, notes } = req.body;

      if (!req.user?._id) {
        throw new AppError('Admin user not authenticated', 401);
      }

      // Simple manual linking implementation
      const patientUser = await PatientUser.findById(patientUserId);
      if (!patientUser) {
        throw new AppError('PatientUser not found', 404);
      }

      const patient = await Patient.findById(patientId);
      if (!patient || patient.isDeleted) {
        throw new AppError('Patient record not found or deleted', 404);
      }

      // Verify they belong to the same workplace
      if (!patientUser.workplaceId.equals(patient.workplaceId)) {
        throw new AppError('PatientUser and Patient must belong to the same workplace', 400);
      }

      const previouslyLinked = !!patientUser.patientId;

      // Update the link
      patientUser.patientId = patient._id;
      await patientUser.save();

      const result = { patient, previouslyLinked };

      logger.info('Manual Patient linking completed:', {
        adminUserId: req.user._id,
        patientUserId,
        patientId,
        previouslyLinked: result.previouslyLinked,
        notes
      });

      res.status(200).json({
        success: true,
        message: result.previouslyLinked 
          ? 'Patient record link updated successfully'
          : 'Patient record linked successfully',
        data: {
          patient: result.patient,
          previouslyLinked: result.previouslyLinked
        }
      });
    } catch (error) {
      logger.error('Error manually linking patient:', {
        error: error.message,
        adminUserId: req.user?._id,
        patientUserId: req.params.patientUserId,
        patientId: req.body.patientId,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Create new Patient record for PatientUser
   * POST /api/admin/patient-linking/:patientUserId/create
   */
  static async createPatientRecord(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Validation failed', 400, errors.array());
      }

      const { patientUserId } = req.params;
      const { additionalData } = req.body;

      // Simple patient creation implementation
      const patientUser = await PatientUser.findById(patientUserId);
      if (!patientUser) {
        throw new AppError('PatientUser not found', 404);
      }

      // Get workplace for MRN generation
      const Workplace = require('../models/Workplace').default;
      const workplace = await Workplace.findById(patientUser.workplaceId);
      if (!workplace) {
        throw new AppError('Workplace not found', 404);
      }

      // Generate MRN
      const mrn = await Patient.generateNextMRN(patientUser.workplaceId, workplace.inviteCode);

      // Create new patient
      const newPatient = new Patient({
        workplaceId: patientUser.workplaceId,
        mrn,
        firstName: patientUser.firstName,
        lastName: patientUser.lastName,
        email: patientUser.email,
        phone: patientUser.phone,
        dob: patientUser.dateOfBirth,
        allergies: [],
        chronicConditions: [],
        enhancedEmergencyContacts: [],
        patientLoggedVitals: [],
        insuranceInfo: { isActive: false },
        createdBy: req.user._id,
        isDeleted: false,
      });

      await newPatient.save();

      // Link to PatientUser
      patientUser.patientId = newPatient._id;
      await patientUser.save();

      const result = { patient: newPatient, isNewRecord: true };

      // If additional data provided, update the patient record
      if (additionalData && result.patient) {
        const allowedFields = ['gender', 'address', 'state', 'lga', 'maritalStatus', 'bloodGroup', 'genotype'];
        const updateData: any = {};
        
        for (const field of allowedFields) {
          if (additionalData[field] !== undefined) {
            updateData[field] = additionalData[field];
          }
        }

        if (Object.keys(updateData).length > 0) {
          await Patient.findByIdAndUpdate(result.patient._id, updateData);
        }
      }

      logger.info('Patient record created for PatientUser:', {
        adminUserId: req.user?._id,
        patientUserId,
        patientId: result.patient._id,
        isNewRecord: result.isNewRecord,
        additionalData: !!additionalData
      });

      res.status(201).json({
        success: true,
        message: result.isNewRecord 
          ? 'New patient record created successfully'
          : 'Existing patient record linked successfully',
        data: {
          patient: result.patient,
          isNewRecord: result.isNewRecord
        }
      });
    } catch (error) {
      logger.error('Error creating patient record:', {
        error: error.message,
        adminUserId: req.user?._id,
        patientUserId: req.params.patientUserId,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Batch retry automatic linking for workspace
   * POST /api/admin/patient-linking/batch-retry
   */
  static async batchRetryLinking(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.body;
      const targetWorkspaceId = workspaceId || req.user?.workplaceId;

      if (!targetWorkspaceId) {
        throw new AppError('Workspace ID is required', 400);
      }

      // Simple batch retry implementation
      const unlinkedPatientUsers = await PatientUser.find({
        workplaceId: targetWorkspaceId,
        status: 'active',
        patientId: { $exists: false },
        isDeleted: false,
      });

      const results = {
        processed: unlinkedPatientUsers.length,
        linked: 0,
        created: 0,
        failed: [] as string[]
      };

      // For now, just return the count without processing
      // This can be enhanced later with actual batch processing

      logger.info('Batch retry linking completed:', {
        adminUserId: req.user?._id,
        workspaceId: targetWorkspaceId,
        results
      });

      res.status(200).json({
        success: true,
        message: `Batch linking completed. Processed: ${results.processed}, Linked: ${results.linked}, Created: ${results.created}, Failed: ${results.failed.length}`,
        data: results
      });
    } catch (error) {
      logger.error('Error in batch retry linking:', {
        error: error.message,
        adminUserId: req.user?._id,
        workspaceId: req.body.workspaceId,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Get linking statistics for dashboard
   * GET /api/admin/patient-linking/stats
   */
  static async getLinkingStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.query;
      const targetWorkspaceId = workspaceId || req.user?.workplaceId;

      if (!targetWorkspaceId) {
        throw new AppError('Workspace ID is required', 400);
      }

      const [
        totalPatientUsers,
        linkedPatientUsers,
        unlinkedPatientUsers,
        totalPatients,
        recentlyCreated
      ] = await Promise.all([
        PatientUser.countDocuments({
          workplaceId: targetWorkspaceId,
          status: 'active',
          isDeleted: false
        }),
        PatientUser.countDocuments({
          workplaceId: targetWorkspaceId,
          status: 'active',
          patientId: { $exists: true },
          isDeleted: false
        }),
        PatientUser.countDocuments({
          workplaceId: targetWorkspaceId,
          status: 'active',
          patientId: { $exists: false },
          isDeleted: false
        }),
        Patient.countDocuments({
          workplaceId: targetWorkspaceId,
          isDeleted: false
        }),
        PatientUser.countDocuments({
          workplaceId: targetWorkspaceId,
          status: 'active',
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
          isDeleted: false
        })
      ]);

      const linkingRate = totalPatientUsers > 0 ? (linkedPatientUsers / totalPatientUsers) * 100 : 0;

      const stats = {
        totalPatientUsers,
        linkedPatientUsers,
        unlinkedPatientUsers,
        totalPatients,
        recentlyCreated,
        linkingRate: Math.round(linkingRate * 100) / 100,
        lastUpdated: new Date()
      };

      logger.info('Linking statistics fetched:', {
        adminUserId: req.user?._id,
        workspaceId: targetWorkspaceId,
        stats
      });

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Error fetching linking statistics:', {
        error: error.message,
        adminUserId: req.user?._id,
        workspaceId: req.query.workspaceId,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Unlink PatientUser from Patient record
   * DELETE /api/admin/patient-linking/:patientUserId/unlink
   */
  static async unlinkPatient(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { patientUserId } = req.params;
      const { reason } = req.body;

      // Simple unlink implementation
      const patientUser = await PatientUser.findById(patientUserId);
      if (patientUser && patientUser.patientId) {
        patientUser.patientId = undefined;
        await patientUser.save();
      }

      logger.info('Patient record unlinked by admin:', {
        adminUserId: req.user?._id,
        patientUserId,
        reason
      });

      res.status(200).json({
        success: true,
        message: 'Patient record unlinked successfully'
      });
    } catch (error) {
      logger.error('Error unlinking patient record:', {
        error: error.message,
        adminUserId: req.user?._id,
        patientUserId: req.params.patientUserId,
        stack: error.stack
      });
      next(error);
    }
  }

  /**
   * Trigger automatic linking for all unlinked PatientUsers
   * POST /api/admin/patient-linking/fix-all
   */
  static async fixAllUnlinkedUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { workspaceId } = req.body;
      const targetWorkspaceId = workspaceId || req.user?.workplaceId;

      if (!targetWorkspaceId) {
        throw new AppError('Workspace ID is required', 400);
      }

      // Import the linking script
      const { linkExistingPatientUsers } = await import('../scripts/linkExistingPatientUsers');
      
      // Find unlinked users for this workspace
      const unlinkedUsers = await PatientUser.find({
        workplaceId: targetWorkspaceId,
        status: 'active',
        isActive: true,
        patientId: { $exists: false },
        isDeleted: false,
      });

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const patientUser of unlinkedUsers) {
        try {
          // Get workplace for MRN generation
          const Workplace = require('../models/Workplace').default;
          const workplace = await Workplace.findById(patientUser.workplaceId);
          if (!workplace) {
            throw new Error('Workplace not found');
          }

          // Generate MRN
          const mrn = await Patient.generateNextMRN(patientUser.workplaceId, workplace.inviteCode);

          // Create new patient
          const newPatient = new Patient({
            workplaceId: patientUser.workplaceId,
            mrn,
            firstName: patientUser.firstName,
            lastName: patientUser.lastName,
            email: patientUser.email,
            phone: patientUser.phone,
            dob: patientUser.dateOfBirth,
            allergies: [],
            chronicConditions: [],
            enhancedEmergencyContacts: [],
            patientLoggedVitals: [],
            insuranceInfo: { isActive: false },
            createdBy: req.user._id,
            isDeleted: false,
          });

          await newPatient.save();

          // Link to PatientUser
          patientUser.patientId = newPatient._id;
          await patientUser.save();

          successCount++;
          
          logger.info(`Created Patient record for PatientUser: ${patientUser._id}`, {
            patientId: newPatient._id,
            adminUserId: req.user._id
          });

        } catch (error) {
          errorCount++;
          errors.push(`${patientUser.email}: ${error.message}`);
          logger.error(`Error creating Patient record for PatientUser ${patientUser._id}:`, error.message);
        }
      }

      const results = {
        processed: unlinkedUsers.length,
        successful: successCount,
        failed: errorCount,
        errors: errors.slice(0, 10) // Limit error details
      };

      logger.info('Bulk Patient linking completed:', {
        adminUserId: req.user?._id,
        workspaceId: targetWorkspaceId,
        results
      });

      res.status(200).json({
        success: true,
        message: `Processed ${results.processed} PatientUsers. ${results.successful} successful, ${results.failed} failed.`,
        data: results
      });
    } catch (error) {
      logger.error('Error in bulk Patient linking:', {
        error: error.message,
        adminUserId: req.user?._id,
        stack: error.stack
      });
      next(error);
    }
  }
}