import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';
import DiagnosticCase, { IDiagnosticCase } from '../models/DiagnosticCase';
import DiagnosticHistory, { IDiagnosticHistory } from '../models/DiagnosticHistory';
import Patient from '../models/Patient';
import openRouterService, {
  DiagnosticInput,
} from '../services/openRouterService';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';
import { createAuditLog } from '../utils/responseHelpers';
import { cleanAIAnalysis, validateAIAnalysis, generateAnalysisSummary } from '../utils/aiAnalysisHelpers';
import healthRecordsNotificationService from '../services/healthRecordsNotificationService';
// Note: Drug interaction service integration will be added later

/**
 * Generate AI diagnostic analysis
 */
export const generateDiagnosticAnalysis = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Log incoming request data for debugging
    logger.info('Diagnostic analysis request received:', {
      body: req.body,
      userId: req.user?._id,
      contentType: req.headers['content-type']
    });

    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.error('Diagnostic validation failed:', {
        errors: errors.array(),
        body: req.body,
        userId
      });
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
      return;
    }

    const {
      patientId,
      symptoms,
      labResults,
      currentMedications,
      vitalSigns,
      patientConsent,
      appointmentId, // Optional: Link to appointment if created during consultation
    } = req.body;

    // Verify workplaceId exists
    if (!workplaceId) {
      res.status(400).json({
        success: false,
        message: 'User workplace is required for diagnostic analysis',
      });
      return;
    }

    // Validate patient consent
    if (!patientConsent?.provided) {
      res.status(400).json({
        success: false,
        message: 'Patient consent is required for AI diagnostic analysis',
      });
      return;
    }

    // Check if user is super admin
    const isSuperAdmin = req.user!.role === 'super_admin';

    // Check if patient exists at all (for debugging)
    const patientExists = await Patient.findById(patientId);
    logger.info('Patient existence check for diagnostic analysis', {
      patientId,
      exists: !!patientExists,
      patientWorkplaceId: patientExists?.workplaceId,
      userWorkplaceId: workplaceId,
      isDeleted: patientExists?.isDeleted,
      isSuperAdmin,
    });

    // Verify patient exists and belongs to the workplace (or super admin bypass)
    let patient;
    if (isSuperAdmin) {
      // Super admin can access patients from any workplace
      patient = await Patient.findOne({
        _id: patientId,
        isDeleted: false,
      });

      if (patient && patient.workplaceId.toString() !== workplaceId.toString()) {
        logger.info('Super admin cross-workplace patient access', {
          patientId,
          userId,
          userWorkplaceId: workplaceId,
          patientWorkplaceId: patient.workplaceId,
          patientName: `${patient.firstName} ${patient.lastName}`,
          action: 'AI_DIAGNOSTIC_ANALYSIS',
        });
      }
    } else {
      // Regular users can only access patients from their workplace
      patient = await Patient.findOne({
        _id: patientId,
        workplaceId: workplaceId,
        isDeleted: false,
      });
    }

    if (!patient) {
      // Provide detailed error information for debugging
      let debugInfo = '';
      if (patientExists) {
        if (patientExists.isDeleted) {
          debugInfo = 'Patient is marked as deleted';
        } else if (!isSuperAdmin && patientExists.workplaceId.toString() !== workplaceId.toString()) {
          debugInfo = `Patient belongs to different workplace (${patientExists.workplaceId})`;
        } else {
          debugInfo = 'Unknown access restriction';
        }
      } else {
        debugInfo = 'Patient does not exist in database';
      }

      logger.warn('Patient access denied for diagnostic analysis', {
        patientId,
        userId,
        workplaceId,
        debugInfo,
        isSuperAdmin,
      });

      res.status(404).json({
        success: false,
        message: 'Patient not found or access denied',
        debug: process.env.NODE_ENV === 'development' ? debugInfo : undefined,
      });
      return;
    }

    // Prepare diagnostic input
    const diagnosticInput: DiagnosticInput = {
      symptoms,
      labResults,
      currentMedications,
      vitalSigns,
      patientAge: patient.age,
      patientGender: patient.gender,
      allergies:
        (patient as any).allergies?.map((allergy: any) => allergy.allergen) ||
        [],
      medicalHistory:
        (patient as any).conditions?.map((condition: any) => condition.name) ||
        [],
    };

    logger.info('Starting AI diagnostic analysis', {
      patientId,
      pharmacistId: userId,
      workplaceId,
      symptomsCount: symptoms.subjective.length + symptoms.objective.length,
    });

    // Generate AI analysis with tracking context
    const aiResult = await openRouterService.generateDiagnosticAnalysis(
      diagnosticInput,
      {
        workspaceId: workplaceId.toString(),
        userId: userId.toString(),
        feature: 'ai_diagnostics',
        patientId: patientId,
        caseId: undefined, // Will be set after case creation
      }
    );

    // Clean AI analysis data to handle null/undefined values
    const cleanedAnalysis = cleanAIAnalysis({
      ...aiResult.analysis,
      processingTime: aiResult.processingTime,
    });

    // Validate the cleaned analysis
    const validation = validateAIAnalysis(cleanedAnalysis);
    if (!validation.isValid) {
      logger.warn('AI analysis validation failed', {
        errors: validation.errors,
        patientId,
        pharmacistId: userId,
      });
      // Continue with cleaned data but log the issues
    }

    // Check for drug interactions if medications are provided
    const drugInteractions: any[] = [];
    if (currentMedications && currentMedications.length > 1) {
      try {
        // This would integrate with your existing drug interaction service
        // drugInteractions = await drugInteractionService.checkInteractions(currentMedications);
      } catch (error) {
        logger.warn('Drug interaction check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Create diagnostic case record
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    const caseId = `DX-${timestamp}-${random}`.toUpperCase();

    const diagnosticCase = new DiagnosticCase({
      caseId,
      patientId,
      pharmacistId: userId,
      workplaceId,
      appointmentId: appointmentId || undefined, // Link to appointment if provided
      symptoms,
      labResults,
      currentMedications,
      vitalSigns,
      aiAnalysis: cleanedAnalysis,
      drugInteractions,
      patientConsent: {
        provided: patientConsent.provided,
        consentDate: new Date(),
        consentMethod: patientConsent.method || 'electronic',
      },
      aiRequestData: {
        model: aiResult.modelUsed,
        promptTokens: aiResult.usage.prompt_tokens,
        completionTokens: aiResult.usage.completion_tokens,
        totalTokens: aiResult.usage.total_tokens,
        requestId: aiResult.requestId,
        processingTime: aiResult.processingTime,
        costEstimate: aiResult.costEstimate,
      },
      pharmacistDecision: {
        accepted: false,
        modifications: '',
        finalRecommendation: '',
        counselingPoints: [],
        followUpRequired: false,
      },
      status: 'pending_review', // AI analysis done, awaiting pharmacist review
    });

    await diagnosticCase.save();

    // Send notification to patient if lab results are present
    if (labResults && labResults.length > 0) {
      const patient = await Patient.findById(patientId);
      const patientUserId = (patient as any)?.userId;
      if (patientUserId) {
        const testName = labResults.map(r => r.testName).join(', ') || 'Lab Tests';
        await healthRecordsNotificationService.notifyLabResultAvailable(
          new mongoose.Types.ObjectId(patientUserId.toString()),
          new mongoose.Types.ObjectId(workplaceId.toString()),
          new mongoose.Types.ObjectId(diagnosticCase._id.toString()),
          testName
        ).catch(error => {
          logger.error('Failed to send lab result notification:', error);
          // Don't fail the request if notification fails
        });
        logger.info('Lab result notification sent', {
          patientUserId,
          diagnosticCaseId: diagnosticCase._id,
          testName,
        });
      }
    }

    // Create diagnostic history entry for persistent storage
    const diagnosticHistory = new DiagnosticHistory({
      patientId,
      caseId: diagnosticCase.caseId,
      diagnosticCaseId: diagnosticCase._id,
      pharmacistId: userId,
      workplaceId,
      analysisSnapshot: cleanedAnalysis,
      clinicalContext: {
        symptoms,
        vitalSigns,
        currentMedications,
        labResults,
      },
      notes: [],
      followUp: {
        required: false,
        completed: false,
      },
      exports: [],
      auditTrail: {
        viewedBy: [userId],
        lastViewed: new Date(),
        modifiedBy: [userId],
        lastModified: new Date(),
        accessLog: [
          {
            userId,
            action: 'view',
            timestamp: new Date(),
            ipAddress: req.ip,
          },
        ],
      },
      status: 'active',
    });

    // Generate referral document if recommended
    if (cleanedAnalysis.referralRecommendation?.recommended) {
      diagnosticHistory.referral = {
        generated: true,
        generatedAt: new Date(),
        specialty: cleanedAnalysis.referralRecommendation.specialty || 'general_medicine',
        urgency: cleanedAnalysis.referralRecommendation.urgency || 'routine',
        status: 'pending',
      };
    }

    await diagnosticHistory.save();

    // Create audit log
    const auditContext = {
      userId,
      userRole: req.user!.role,
      workplaceId: workplaceId.toString(),
      isAdmin: (req as any).isAdmin || false,
      isSuperAdmin: req.user!.role === 'super_admin',
      canManage: (req as any).canManage || false,
      timestamp: new Date().toISOString(),
    };

    createAuditLog(
      'AI_DIAGNOSTIC_ANALYSIS',
      'DiagnosticCase',
      diagnosticCase._id.toString(),
      auditContext
    );

    logger.info('AI diagnostic analysis completed', {
      caseId: diagnosticCase.caseId,
      processingTime: aiResult.processingTime,
      confidenceScore: cleanedAnalysis.confidenceScore,
      summary: generateAnalysisSummary(cleanedAnalysis),
    });

    res.status(200).json({
      success: true,
      data: {
        caseId: diagnosticCase.caseId,
        analysis: cleanedAnalysis,
        drugInteractions,
        processingTime: aiResult.processingTime,
        tokensUsed: aiResult.usage.total_tokens,
        modelUsed: aiResult.modelUsed,
        costEstimate: aiResult.costEstimate,
      },
    });
  } catch (error) {
    logger.error('AI diagnostic analysis failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      patientId: req.body.patientId,
      pharmacistId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'AI diagnostic analysis failed',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Save pharmacist decision on diagnostic case
 */
export const saveDiagnosticDecision = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
      return;
    }

    const { caseId } = req.params;
    const {
      accepted,
      modifications,
      finalRecommendation,
      counselingPoints,
      followUpRequired,
      followUpDate,
    } = req.body;
    const userId = req.user!._id;

    // Find and verify ownership of diagnostic case
    const diagnosticCase = await DiagnosticCase.findOne({
      caseId,
      pharmacistId: userId,
    });

    if (!diagnosticCase) {
      res.status(404).json({
        success: false,
        message: 'Diagnostic case not found or access denied',
      });
      return;
    }

    // Update pharmacist decision
    diagnosticCase.pharmacistDecision = {
      accepted,
      modifications: modifications || '',
      finalRecommendation,
      counselingPoints: counselingPoints || [],
      followUpRequired: followUpRequired || false,
      followUpDate:
        followUpRequired && followUpDate ? new Date(followUpDate) : undefined,
    };

    diagnosticCase.status = 'completed';
    diagnosticCase.completedAt = new Date();

    await diagnosticCase.save();

    // Create audit log
    const auditContext = {
      userId,
      userRole: req.user!.role,
      workplaceId: diagnosticCase.workplaceId.toString(),
      isAdmin: (req as any).isAdmin || false,
      isSuperAdmin: req.user!.role === 'super_admin',
      canManage: (req as any).canManage || false,
      timestamp: new Date().toISOString(),
    };

    createAuditLog(
      'DIAGNOSTIC_DECISION_SAVED',
      'DiagnosticCase',
      diagnosticCase._id.toString(),
      auditContext
    );

    res.status(200).json({
      success: true,
      data: {
        caseId: diagnosticCase.caseId,
        status: diagnosticCase.status,
        completedAt: diagnosticCase.completedAt,
      },
    });
  } catch (error) {
    logger.error('Failed to save diagnostic decision', {
      error: error instanceof Error ? error.message : 'Unknown error',
      caseId: req.params.caseId,
      pharmacistId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to save diagnostic decision',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Get diagnostic case history for a patient
 */
export const getDiagnosticHistory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    // Check if user is super admin
    const isSuperAdmin = req.user!.role === 'super_admin';

    // Verify patient access (super admin bypass)
    let patient;
    if (isSuperAdmin) {
      patient = await Patient.findById(patientId);
      if (patient && patient.workplaceId.toString() !== workplaceId.toString()) {
        logger.info('Super admin cross-workplace patient access', {
          patientId,
          userId,
          userWorkplaceId: workplaceId,
          patientWorkplaceId: patient.workplaceId,
          patientName: `${patient.firstName} ${patient.lastName}`,
          action: 'VIEW_DIAGNOSTIC_HISTORY',
        });
      }
    } else {
      patient = await Patient.findOne({
        _id: patientId,
        workplaceId: workplaceId,
      });
    }

    if (!patient) {
      res.status(404).json({
        success: false,
        message: 'Patient not found or access denied',
      });
      return;
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Build query filter (super admin can see cases from any workplace)
    const caseFilter: any = { patientId };
    if (!isSuperAdmin) {
      caseFilter.workplaceId = workplaceId;
    }

    const diagnosticCases = await DiagnosticCase.find(caseFilter)
      .populate('pharmacistId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .select('-aiRequestData -pharmacistDecision.modifications'); // Exclude sensitive data

    const total = await DiagnosticCase.countDocuments(caseFilter);

    res.status(200).json({
      success: true,
      data: {
        cases: diagnosticCases,
        pagination: {
          current: Number(page),
          total: Math.ceil(total / Number(limit)),
          count: diagnosticCases.length,
          totalCases: total,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get diagnostic history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      patientId: req.params.patientId,
      pharmacistId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get diagnostic history',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Get a specific diagnostic case
 */
export const getDiagnosticCase = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { caseId } = req.params;
    const workplaceId = req.user!.workplaceId;
    const userId = req.user!._id;
    const isSuperAdmin = req.user!.role === 'super_admin';

    // Build query filter (super admin can see cases from any workplace)
    const caseFilter: any = { caseId };
    if (!isSuperAdmin) {
      caseFilter.workplaceId = workplaceId;
    }

    const diagnosticCase = await DiagnosticCase.findOne(caseFilter)
      .populate('patientId', 'firstName lastName age gender')
      .populate('pharmacistId', 'firstName lastName');

    if (!diagnosticCase) {
      res.status(404).json({
        success: false,
        message: 'Diagnostic case not found or access denied',
      });
      return;
    }

    // Log super admin cross-workplace access
    if (isSuperAdmin && diagnosticCase.workplaceId.toString() !== workplaceId.toString()) {
      logger.info('Super admin cross-workplace case access', {
        caseId,
        userId,
        userWorkplaceId: workplaceId,
        caseWorkplaceId: diagnosticCase.workplaceId,
        patientId: diagnosticCase.patientId,
        action: 'VIEW_DIAGNOSTIC_CASE',
      });
    }

    res.status(200).json({
      success: true,
      data: diagnosticCase,
    });
  } catch (error) {
    logger.error('Failed to get diagnostic case', {
      error: error instanceof Error ? error.message : 'Unknown error',
      caseId: req.params.caseId,
      pharmacistId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get diagnostic case',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Check drug interactions
 */
export const checkDrugInteractions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
      return;
    }

    const { medications } = req.body;

    if (!medications || medications.length < 2) {
      res.status(400).json({
        success: false,
        message:
          'At least two medications are required for interaction checking',
      });
      return;
    }

    // This would integrate with your existing drug interaction service
    // For now, return a placeholder response
    const interactions: any[] = [];
    // const interactions = await drugInteractionService.checkInteractions(medications);

    res.status(200).json({
      success: true,
      data: {
        interactions,
        medicationsChecked: medications.length,
        interactionsFound: interactions.length,
      },
    });
  } catch (error) {
    logger.error('Drug interaction check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      pharmacistId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Drug interaction check failed',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Test OpenRouter connection
 */
export const testAIConnection = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Only super admins can test the connection
    if (req.user!.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Super admin required.',
      });
      return;
    }

    const isConnected = await openRouterService.testConnection();

    res.status(200).json({
      success: true,
      data: {
        connected: isConnected,
        service: 'OpenRouter API',
        models: {
          primary: 'deepseek/deepseek-chat-v3.1',
          fallback: 'deepseek/deepseek-chat-v3.1',
          critical: 'google/gemma-2-9b-it'
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('AI connection test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      pharmacistId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'AI connection test failed',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Get AI usage statistics (Super Admin only)
 */
export const getAIUsageStats = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Only super admins can view usage statistics
    if (req.user!.role !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Super admin required.',
      });
      return;
    }

    const usageStats = await openRouterService.getUsageStats();

    if (!usageStats) {
      res.status(200).json({
        success: true,
        data: {
          message: 'No usage data available yet',
          currentMonth: new Date().toISOString().slice(0, 7),
          budgetLimit: parseFloat(process.env.OPENROUTER_MONTHLY_BUDGET || '15'),
        },
      });
      return;
    }

    const budgetLimit = parseFloat(process.env.OPENROUTER_MONTHLY_BUDGET || '15');
    const budgetUsedPercent = (usageStats.totalCost / budgetLimit) * 100;

    res.status(200).json({
      success: true,
      data: {
        ...usageStats,
        budgetLimit,
        budgetUsedPercent: Math.round(budgetUsedPercent * 100) / 100,
        budgetRemaining: Math.max(0, budgetLimit - usageStats.totalCost),
        canUsePaidModels: usageStats.totalCost < budgetLimit,
      },
    });
  } catch (error) {
    logger.error('Failed to get AI usage statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      pharmacistId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get usage statistics',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Debug endpoint to check database counts (development only)
 */
export const debugDatabaseCounts = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    if (process.env.NODE_ENV !== 'development') {
      res.status(404).json({
        success: false,
        message: 'Endpoint not available in production',
      });
      return;
    }

    const workplaceId = req.user!.workplaceId;

    const diagnosticCasesCount = await DiagnosticCase.countDocuments({ workplaceId });
    const diagnosticHistoryCount = await DiagnosticHistory.countDocuments({ workplaceId });
    const activeHistoryCount = await DiagnosticHistory.countDocuments({
      workplaceId,
      status: 'active'
    });

    // Get sample records
    const sampleCase = await DiagnosticCase.findOne({ workplaceId }).select('caseId status createdAt');
    const sampleHistory = await DiagnosticHistory.findOne({ workplaceId }).select('caseId status createdAt');

    res.status(200).json({
      success: true,
      data: {
        counts: {
          diagnosticCases: diagnosticCasesCount,
          diagnosticHistory: diagnosticHistoryCount,
          activeHistory: activeHistoryCount,
        },
        samples: {
          case: sampleCase,
          history: sampleHistory,
        },
        workplaceId: workplaceId.toString(),
      },
    });
  } catch (error) {
    logger.error('Debug database counts failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Debug failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Save notes for a diagnostic case
 */
export const saveDiagnosticNotes = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { notes } = req.body;
    const userId = req.user!.id;
    const workplaceId = req.user!.workplaceId;

    // Validate input
    if (!notes || typeof notes !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Notes are required and must be a string',
      });
      return;
    }

    // Find and verify ownership of diagnostic case
    const diagnosticCase = await DiagnosticCase.findOne({
      caseId,
      workplaceId,
    });

    if (!diagnosticCase) {
      res.status(404).json({
        success: false,
        message: 'Diagnostic case not found or access denied',
      });
      return;
    }

    // Update notes in pharmacist decision
    if (!diagnosticCase.pharmacistDecision) {
      diagnosticCase.pharmacistDecision = {
        accepted: false,
        modifications: '',
        finalRecommendation: '',
        counselingPoints: [],
        followUpRequired: false,
      };
    }

    (diagnosticCase.pharmacistDecision as any).notes = notes;
    (diagnosticCase.pharmacistDecision as any).reviewedAt = new Date();
    (diagnosticCase.pharmacistDecision as any).reviewedBy = userId;

    await diagnosticCase.save();

    // Create audit log
    const auditContext = {
      userId,
      userRole: req.user!.role,
      workplaceId: workplaceId.toString(),
      isAdmin: (req as any).isAdmin || false,
      isSuperAdmin: req.user!.role === 'super_admin',
      canManage: (req as any).canManage || false,
      timestamp: new Date().toISOString(),
    };

    createAuditLog(
      'DIAGNOSTIC_NOTES_SAVED',
      'DiagnosticCase',
      diagnosticCase._id.toString(),
      auditContext
    );

    res.status(200).json({
      success: true,
      message: 'Notes saved successfully',
      data: {
        caseId: diagnosticCase.caseId,
        notes,
        reviewedAt: (diagnosticCase.pharmacistDecision as any).reviewedAt,
      },
    });
  } catch (error) {
    logger.error('Failed to save diagnostic notes', {
      error: error instanceof Error ? error.message : 'Unknown error',
      caseId: req.params.caseId,
      userId: req.user?.id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to save notes',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Get comprehensive diagnostic history for a patient
 */
export const getPatientDiagnosticHistory = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.params;
    const { page = 1, limit = 10, includeArchived = false } = req.query;
    const workplaceId = req.user!.workplaceId;
    const userId = req.user!._id;

    // Verify patient access
    const patient = await Patient.findOne({
      _id: patientId,
      workplaceId: workplaceId,
    });

    if (!patient) {
      res.status(404).json({
        success: false,
        message: 'Patient not found or access denied',
      });
      return;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const statusFilter = includeArchived === 'true'
      ? { status: { $in: ['active', 'archived'] } }
      : { status: 'active' };

    const history = await DiagnosticHistory.find({
      patientId,
      workplaceId,
      ...statusFilter,
    })
      .populate('pharmacistId', 'firstName lastName')
      .populate('notes.addedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await DiagnosticHistory.countDocuments({
      patientId,
      workplaceId,
      ...statusFilter,
    });

    // Update audit trail for viewing
    await DiagnosticHistory.updateMany(
      { patientId, workplaceId, ...statusFilter },
      {
        $addToSet: { 'auditTrail.viewedBy': userId },
        $set: { 'auditTrail.lastViewed': new Date() },
        $push: {
          'auditTrail.accessLog': {
            userId,
            action: 'view',
            timestamp: new Date(),
            ipAddress: req.ip,
          },
        },
      }
    );

    res.status(200).json({
      success: true,
      data: {
        history,
        pagination: {
          current: Number(page),
          total: Math.ceil(total / Number(limit)),
          count: history.length,
          totalRecords: total,
        },
        patient: {
          id: patient._id,
          name: `${patient.firstName} ${patient.lastName}`,
          age: patient.age,
          gender: patient.gender,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get patient diagnostic history', {
      error: error instanceof Error ? error.message : 'Unknown error',
      patientId: req.params.patientId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get diagnostic history',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Add notes to diagnostic history
 */
export const addDiagnosticHistoryNote = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { historyId } = req.params;
    const { content, type = 'general' } = req.body;
    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    if (!content || typeof content !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Note content is required',
      });
      return;
    }

    const history = await DiagnosticHistory.findOne({
      _id: historyId,
      workplaceId,
      status: 'active',
    });

    if (!history) {
      res.status(404).json({
        success: false,
        message: 'Diagnostic history not found or access denied',
      });
      return;
    }

    // Add note
    history.notes.push({
      content,
      addedBy: userId,
      addedAt: new Date(),
      type,
    } as any);

    // Update audit trail
    history.auditTrail.modifiedBy.push(userId);
    history.auditTrail.lastModified = new Date();
    history.auditTrail.accessLog.push({
      userId,
      action: 'edit',
      timestamp: new Date(),
      ipAddress: req.ip,
    } as any);

    await history.save();

    const lastNote = history.notes[history.notes.length - 1] as any;

    res.status(200).json({
      success: true,
      message: 'Note added successfully',
      data: {
        noteId: lastNote._id?.toString() || 'generated',
        addedAt: lastNote.addedAt,
      },
    });
  } catch (error) {
    logger.error('Failed to add diagnostic history note', {
      error: error instanceof Error ? error.message : 'Unknown error',
      historyId: req.params.historyId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to add note',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Get diagnostic analytics
 */
export const getDiagnosticAnalytics = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  console.log('🔧 getDiagnosticAnalytics called for user:', req.user?.email);
  try {
    const { dateFrom, dateTo, patientId } = req.query;
    const workplaceId = req.user!.workplaceId;

    // Build date filter
    const dateFilter: any = {};
    if (dateFrom) {
      dateFilter.$gte = new Date(dateFrom as string);
    }
    if (dateTo) {
      dateFilter.$lte = new Date(dateTo as string);
    }

    const matchFilter: any = {
      workplaceId,
    };

    if (Object.keys(dateFilter).length > 0) {
      matchFilter.createdAt = dateFilter;
    }

    if (patientId) {
      matchFilter.patientId = new mongoose.Types.ObjectId(patientId as string);
    }

    // First try DiagnosticHistory, then fallback to DiagnosticCase
    let analytics: any[] = [];
    let topDiagnoses: any[] = [];
    let completionTrends: any[] = [];

    // Check DiagnosticHistory first
    const historyCount = await DiagnosticHistory.countDocuments({
      ...matchFilter,
      status: 'active',
    });

    if (historyCount > 0) {
      // Use DiagnosticHistory data
      const historyMatchFilter = { ...matchFilter, status: 'active' };

      analytics = await DiagnosticHistory.aggregate([
        { $match: historyMatchFilter },
        {
          $group: {
            _id: null,
            totalCases: { $sum: 1 },
            averageConfidence: { $avg: '$analysisSnapshot.confidenceScore' },
            averageProcessingTime: { $avg: '$analysisSnapshot.processingTime' },
            completedCases: {
              $sum: {
                $cond: [{ $eq: ['$followUp.completed', true] }, 1, 0],
              },
            },
            pendingFollowUps: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$followUp.required', true] },
                      { $eq: ['$followUp.completed', false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            referralsGenerated: {
              $sum: {
                $cond: [{ $eq: ['$referral.generated', true] }, 1, 0],
              },
            },
          },
        },
      ]);

      topDiagnoses = await DiagnosticHistory.aggregate([
        { $match: historyMatchFilter },
        { $unwind: '$analysisSnapshot.differentialDiagnoses' },
        {
          $group: {
            _id: '$analysisSnapshot.differentialDiagnoses.condition',
            count: { $sum: 1 },
            averageConfidence: {
              $avg: '$analysisSnapshot.differentialDiagnoses.probability',
            },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            condition: '$_id',
            count: 1,
            averageConfidence: { $round: ['$averageConfidence', 2] },
            _id: 0,
          },
        },
      ]);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      completionTrends = await DiagnosticHistory.aggregate([
        {
          $match: {
            ...historyMatchFilter,
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            casesCreated: { $sum: 1 },
            casesCompleted: {
              $sum: {
                $cond: [{ $eq: ['$followUp.completed', true] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    } else {
      // Fallback to DiagnosticCase data
      logger.info('No DiagnosticHistory records found, using DiagnosticCase data for analytics');

      analytics = await DiagnosticCase.aggregate([
        { $match: matchFilter },
        {
          $group: {
            _id: null,
            totalCases: { $sum: 1 },
            averageConfidence: { $avg: '$aiAnalysis.confidenceScore' },
            averageProcessingTime: { $avg: '$aiRequestData.processingTime' },
            completedCases: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
              },
            },
            pendingFollowUps: {
              $sum: {
                $cond: [
                  { $eq: ['$pharmacistDecision.followUpRequired', true] },
                  1,
                  0,
                ],
              },
            },
            referralsGenerated: {
              $sum: {
                $cond: [
                  { $eq: ['$aiAnalysis.referralRecommendation.recommended', true] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);

      topDiagnoses = await DiagnosticCase.aggregate([
        { $match: matchFilter },
        { $unwind: '$aiAnalysis.differentialDiagnoses' },
        {
          $group: {
            _id: '$aiAnalysis.differentialDiagnoses.condition',
            count: { $sum: 1 },
            averageConfidence: {
              $avg: '$aiAnalysis.differentialDiagnoses.probability',
            },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            condition: '$_id',
            count: 1,
            averageConfidence: { $round: ['$averageConfidence', 2] },
            _id: 0,
          },
        },
      ]);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      completionTrends = await DiagnosticCase.aggregate([
        {
          $match: {
            ...matchFilter,
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            casesCreated: { $sum: 1 },
            casesCompleted: {
              $sum: {
                $cond: [{ $eq: ['$status', 'completed'] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    }

    const result = {
      summary: analytics[0] || {
        totalCases: 0,
        averageConfidence: 0,
        averageProcessingTime: 0,
        completedCases: 0,
        pendingFollowUps: 0,
        referralsGenerated: 0,
      },
      topDiagnoses: topDiagnoses || [],
      completionTrends: completionTrends || [],
      dateRange: {
        from: dateFrom || null,
        to: dateTo || null,
      },
    };

    logger.info('Diagnostic analytics generated', {
      historyRecords: historyCount,
      totalCases: result.summary.totalCases,
      topDiagnosesCount: result.topDiagnoses.length,
      trendsCount: result.completionTrends.length,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to get diagnostic analytics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get analytics',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Get all diagnostic cases (for "View All" functionality)
 */
export const getAllDiagnosticCases = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  console.log('🔧 getAllDiagnosticCases called for user:', req.user?.email);
  try {
    const {
      page = 1,
      limit = 20,
      status,
      patientId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;
    const workplaceId = req.user!.workplaceId;

    const skip = (Number(page) - 1) * Number(limit);

    // Build filter
    const filter: any = { workplaceId };

    if (status) {
      filter.status = status;
    }

    if (patientId) {
      filter.patientId = patientId;
    }

    // Build search filter
    let searchFilter = {};
    if (search) {
      searchFilter = {
        $or: [
          { caseId: { $regex: search, $options: 'i' } },
          { 'symptoms.subjective': { $regex: search, $options: 'i' } },
          { 'symptoms.objective': { $regex: search, $options: 'i' } },
        ],
      };
    }

    const finalFilter = { ...filter, ...searchFilter };

    // Build sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    const cases = await DiagnosticCase.find(finalFilter)
      .populate('patientId', 'firstName lastName age gender')
      .populate('pharmacistId', 'firstName lastName')
      .sort(sort)
      .skip(skip)
      .limit(Number(limit))
      .select('-aiRequestData'); // Exclude sensitive data

    const total = await DiagnosticCase.countDocuments(finalFilter);

    res.status(200).json({
      success: true,
      data: {
        cases,
        pagination: {
          current: Number(page),
          total: Math.ceil(total / Number(limit)),
          count: cases.length,
          totalCases: total,
        },
        filters: {
          status,
          patientId,
          search,
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get all diagnostic cases', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get diagnostic cases',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Get referrals data
 */
export const getDiagnosticReferrals = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  console.log('🔧 getDiagnosticReferrals called for user:', req.user?.email);
  try {
    const { page = 1, limit = 20, status, specialty } = req.query;
    const workplaceId = req.user!.workplaceId;

    const skip = (Number(page) - 1) * Number(limit);

    // Build filter for DiagnosticCase with referrals
    const filter: any = {
      workplaceId,
      status: 'referred',
      'referral.generated': true,
    };

    if (status) {
      filter['referral.status'] = status;
    }

    if (specialty) {
      filter['referral.sentTo.specialty'] = { $regex: specialty, $options: 'i' };
    }

    const referrals = await DiagnosticCase.find(filter)
      .populate('patientId', 'firstName lastName age gender')
      .populate('pharmacistId', 'firstName lastName')
      .sort({ 'referral.generatedAt': -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await DiagnosticCase.countDocuments(filter);

    // Get referral statistics
    const stats = await DiagnosticCase.aggregate([
      { $match: { workplaceId, status: 'referred', 'referral.generated': true } },
      {
        $group: {
          _id: '$referral.status',
          count: { $sum: 1 },
        },
      },
    ]);

    const referralStats = {
      pending: 0,
      sent: 0,
      acknowledged: 0,
      completed: 0,
    };

    stats.forEach((stat) => {
      if (stat._id in referralStats) {
        referralStats[stat._id as keyof typeof referralStats] = stat.count;
      }
    });

    res.status(200).json({
      success: true,
      data: {
        referrals,
        pagination: {
          current: Number(page),
          total: Math.ceil(total / Number(limit)),
          count: referrals.length,
          totalReferrals: total,
        },
        statistics: referralStats,
        filters: {
          status,
          specialty,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get diagnostic referrals', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get referrals',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};



/**
 * Export diagnostic history as PDF
 */
export const exportDiagnosticHistoryPDF = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { historyId } = req.params;
    const { purpose = 'patient_record' } = req.query;
    const workplaceId = req.user!.workplaceId;
    const userId = req.user!._id;

    const history = await DiagnosticHistory.findOne({
      _id: historyId,
      workplaceId,
      status: 'active',
    })
      .populate('patientId', 'firstName lastName age gender dateOfBirth')
      .populate('pharmacistId', 'firstName lastName');

    if (!history) {
      res.status(404).json({
        success: false,
        message: 'Diagnostic history not found or access denied',
      });
      return;
    }

    // Update audit trail for export
    history.auditTrail.accessLog.push({
      userId,
      action: 'export',
      timestamp: new Date(),
      ipAddress: req.ip,
    } as any);

    history.exports.push({
      exportedBy: userId,
      exportedAt: new Date(),
      format: 'pdf',
      purpose: purpose as string,
    } as any);

    await history.save();

    // For now, return a placeholder response
    // In a real implementation, you would generate a PDF using a library like puppeteer or pdfkit
    res.status(200).json({
      success: true,
      message: 'PDF export functionality will be implemented with a PDF generation library',
      data: {
        historyId,
        purpose,
        exportedAt: new Date(),
        // In real implementation: downloadUrl: 'generated-pdf-url'
      },
    });
  } catch (error) {
    logger.error('Failed to export diagnostic history as PDF', {
      error: error instanceof Error ? error.message : 'Unknown error',
      historyId: req.params.historyId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to export PDF',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Generate referral document
 */
export const generateReferralDocument = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { historyId } = req.params;
    const workplaceId = req.user!.workplaceId;
    const userId = req.user!._id;

    const history = await DiagnosticHistory.findOne({
      _id: historyId,
      workplaceId,
      status: 'active',
    })
      .populate('patientId', 'firstName lastName age gender dateOfBirth')
      .populate('pharmacistId', 'firstName lastName');

    if (!history) {
      res.status(404).json({
        success: false,
        message: 'Diagnostic history not found or access denied',
      });
      return;
    }

    if (!history.analysisSnapshot.referralRecommendation?.recommended) {
      res.status(400).json({
        success: false,
        message: 'No referral recommendation found for this case',
      });
      return;
    }

    // Update referral status
    if (!history.referral) {
      history.referral = {
        generated: true,
        generatedAt: new Date(),
        specialty: history.analysisSnapshot.referralRecommendation.specialty,
        urgency: history.analysisSnapshot.referralRecommendation.urgency,
        status: 'pending',
      } as any;
    }

    // Generate referral ID
    const referralId = `REF-${Date.now().toString(36).toUpperCase()}`;

    // Update audit trail
    history.auditTrail.accessLog.push({
      userId,
      action: 'referral_generated',
      timestamp: new Date(),
      ipAddress: req.ip,
    } as any);

    await history.save();

    res.status(200).json({
      success: true,
      message: 'Referral document generated successfully',
      data: {
        referralId,
        documentUrl: `/api/diagnostics/referrals/${referralId}/document`, // Placeholder URL
      },
    });
  } catch (error) {
    logger.error('Failed to generate referral document', {
      error: error instanceof Error ? error.message : 'Unknown error',
      historyId: req.params.historyId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to generate referral document',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Compare diagnostic histories
 */
export const compareDiagnosticHistories = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { historyId1, historyId2 } = req.body;
    const workplaceId = req.user!.workplaceId;

    if (!historyId1 || !historyId2) {
      res.status(400).json({
        success: false,
        message: 'Two history IDs are required for comparison',
      });
      return;
    }

    const [history1, history2] = await Promise.all([
      DiagnosticHistory.findOne({
        _id: historyId1,
        workplaceId,
        status: 'active',
      }),
      DiagnosticHistory.findOne({
        _id: historyId2,
        workplaceId,
        status: 'active',
      }),
    ]);

    if (!history1 || !history2) {
      res.status(404).json({
        success: false,
        message: 'One or both diagnostic histories not found',
      });
      return;
    }

    // Ensure both histories belong to the same patient
    if (history1.patientId.toString() !== history2.patientId.toString()) {
      res.status(400).json({
        success: false,
        message: 'Cannot compare histories from different patients',
      });
      return;
    }

    // Perform comparison
    const comparison = {
      diagnosisChanges: [] as string[],
      confidenceChange: history2.analysisSnapshot.confidenceScore - history1.analysisSnapshot.confidenceScore,
      newSymptoms: [] as string[],
      resolvedSymptoms: [] as string[],
      medicationChanges: [] as string[],
      improvementScore: 0,
    };

    // Compare diagnoses
    const oldDiagnoses = history1.analysisSnapshot.differentialDiagnoses.map(d => d.condition);
    const newDiagnoses = history2.analysisSnapshot.differentialDiagnoses.map(d => d.condition);

    comparison.diagnosisChanges = [
      ...newDiagnoses.filter(d => !oldDiagnoses.includes(d)).map(d => `Added: ${d}`),
      ...oldDiagnoses.filter(d => !newDiagnoses.includes(d)).map(d => `Removed: ${d}`),
    ];

    // Compare symptoms
    const oldSymptoms = [...history1.clinicalContext.symptoms.subjective, ...history1.clinicalContext.symptoms.objective];
    const newSymptoms = [...history2.clinicalContext.symptoms.subjective, ...history2.clinicalContext.symptoms.objective];

    comparison.newSymptoms = newSymptoms.filter(s => !oldSymptoms.includes(s));
    comparison.resolvedSymptoms = oldSymptoms.filter(s => !newSymptoms.includes(s));

    // Compare medications
    const oldMeds = history1.clinicalContext.currentMedications?.map(m => m.name) || [];
    const newMeds = history2.clinicalContext.currentMedications?.map(m => m.name) || [];

    comparison.medicationChanges = [
      ...newMeds.filter(m => !oldMeds.includes(m)).map(m => `Added: ${m}`),
      ...oldMeds.filter(m => !newMeds.includes(m)).map(m => `Discontinued: ${m}`),
    ];

    // Calculate improvement score (simplified)
    comparison.improvementScore = Math.round(
      (comparison.confidenceChange * 0.4) +
      (comparison.resolvedSymptoms.length * 10) -
      (comparison.newSymptoms.length * 5)
    );

    // Generate recommendations
    const recommendations = [];
    if (comparison.confidenceChange > 10) {
      recommendations.push('Diagnostic confidence has improved significantly');
    }
    if (comparison.resolvedSymptoms.length > 0) {
      recommendations.push('Patient shows symptom improvement');
    }
    if (comparison.newSymptoms.length > 0) {
      recommendations.push('Monitor new symptoms closely');
    }
    if (comparison.medicationChanges.length > 0) {
      recommendations.push('Review medication changes and their effects');
    }

    res.status(200).json({
      success: true,
      data: {
        comparison,
        recommendations,
      },
    });
  } catch (error) {
    logger.error('Failed to compare diagnostic histories', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to compare histories',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};
/**
 
* Mark case for follow-up
 */
export const markCaseForFollowUp = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { followUpDate, reason, notes } = req.body;
    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    if (!followUpDate || !reason) {
      res.status(400).json({
        success: false,
        message: 'Follow-up date and reason are required',
      });
      return;
    }

    const diagnosticCase = await DiagnosticCase.findOne({
      caseId,
      workplaceId,
      status: 'pending_review',
    });

    if (!diagnosticCase) {
      res.status(404).json({
        success: false,
        message: 'Case not found or not available for review',
      });
      return;
    }

    // Update case status and follow-up details
    diagnosticCase.status = 'follow_up';
    diagnosticCase.followUp = {
      scheduledDate: new Date(followUpDate),
      reason,
      completed: false,
    };

    // Update pharmacist decision
    diagnosticCase.pharmacistDecision.notes = notes || '';
    diagnosticCase.pharmacistDecision.reviewedAt = new Date();
    diagnosticCase.pharmacistDecision.reviewedBy = userId;

    await diagnosticCase.save();

    logger.info('Case marked for follow-up', {
      caseId,
      followUpDate,
      reason,
      userId,
    });

    res.status(200).json({
      success: true,
      message: 'Case marked for follow-up successfully',
      data: {
        caseId: diagnosticCase.caseId,
        status: diagnosticCase.status,
        followUpDate: diagnosticCase.followUp?.scheduledDate,
      },
    });
  } catch (error) {
    logger.error('Failed to mark case for follow-up', {
      error: error instanceof Error ? error.message : 'Unknown error',
      caseId: req.params.caseId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to mark case for follow-up',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Mark case as completed
 */
export const markCaseAsCompleted = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { notes, finalRecommendation, counselingPoints } = req.body;
    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    const diagnosticCase = await DiagnosticCase.findOne({
      caseId,
      workplaceId,
      status: { $in: ['pending_review', 'follow_up', 'referred'] },
    });

    if (!diagnosticCase) {
      res.status(404).json({
        success: false,
        message: 'Case not found or not available for completion',
      });
      return;
    }

    // Update case status
    diagnosticCase.status = 'completed';
    diagnosticCase.completedAt = new Date();

    // Update pharmacist decision
    diagnosticCase.pharmacistDecision.accepted = true;
    diagnosticCase.pharmacistDecision.notes = notes || '';
    diagnosticCase.pharmacistDecision.finalRecommendation = finalRecommendation || '';
    diagnosticCase.pharmacistDecision.counselingPoints = counselingPoints || [];
    diagnosticCase.pharmacistDecision.reviewedAt = new Date();
    diagnosticCase.pharmacistDecision.reviewedBy = userId;

    // If it was a follow-up case, mark follow-up as completed
    if (diagnosticCase.followUp) {
      diagnosticCase.followUp.completed = true;
      diagnosticCase.followUp.completedDate = new Date();
    }

    await diagnosticCase.save();

    logger.info('Case marked as completed', {
      caseId,
      userId,
      previousStatus: diagnosticCase.status,
    });

    res.status(200).json({
      success: true,
      message: 'Case marked as completed successfully',
      data: {
        caseId: diagnosticCase.caseId,
        status: diagnosticCase.status,
        completedAt: diagnosticCase.completedAt,
      },
    });
  } catch (error) {
    logger.error('Failed to mark case as completed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      caseId: req.params.caseId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to mark case as completed',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Generate referral document for a case
 */
export const generateCaseReferralDocument = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { notes, physicianInfo } = req.body;
    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    const diagnosticCase = await DiagnosticCase.findOne({
      caseId,
      workplaceId,
      status: 'pending_review',
    })
      .populate('patientId', 'firstName lastName age gender dateOfBirth')
      .populate('pharmacistId', 'firstName lastName credentials');

    if (!diagnosticCase) {
      res.status(404).json({
        success: false,
        message: 'Case not found or not available for referral',
      });
      return;
    }

    // Generate referral document content
    const patient = diagnosticCase.patientId as any;
    const pharmacist = diagnosticCase.pharmacistId as any;

    const referralContent = `
MEDICAL REFERRAL DOCUMENT

Patient Information:
- Name: ${patient.firstName} ${patient.lastName}
- Age: ${patient.age}
- Gender: ${patient.gender}
- Date of Birth: ${patient.dateOfBirth ? new Date(patient.dateOfBirth).toLocaleDateString() : 'N/A'}

Referring Pharmacist:
- Name: ${pharmacist.firstName} ${pharmacist.lastName}
- Credentials: ${pharmacist.credentials || 'PharmD'}

Clinical Presentation:
Subjective Symptoms: ${diagnosticCase.symptoms.subjective.join(', ')}
Objective Findings: ${diagnosticCase.symptoms.objective.join(', ')}
Duration: ${diagnosticCase.symptoms.duration}
Severity: ${diagnosticCase.symptoms.severity}
Onset: ${diagnosticCase.symptoms.onset}

AI Analysis Summary:
Primary Differential Diagnoses:
${diagnosticCase.aiAnalysis.differentialDiagnoses.slice(0, 3).map((dx, index) =>
      `${index + 1}. ${dx.condition} (${Math.round(dx.probability)}% probability)
     Reasoning: ${dx.reasoning}`
    ).join('\n')}

Recommended Tests:
${diagnosticCase.aiAnalysis.recommendedTests.map((test, index) =>
      `${index + 1}. ${test.testName} (${test.priority})
     Reasoning: ${test.reasoning}`
    ).join('\n')}

Red Flags Identified:
${diagnosticCase.aiAnalysis.redFlags.length > 0
        ? diagnosticCase.aiAnalysis.redFlags.map((flag, index) =>
          `${index + 1}. ${flag.flag} (${flag.severity})
         Action: ${flag.action}`
        ).join('\n')
        : 'None identified'
      }

Pharmacist Notes:
${notes || 'No additional notes provided'}

Referral Specialty: ${physicianInfo?.specialty || 'General Medicine'}
Urgency: ${diagnosticCase.aiAnalysis.referralRecommendation?.urgency || 'Routine'}

AI Confidence Score: ${Math.round(diagnosticCase.aiAnalysis.confidenceScore)}%

Date: ${new Date().toLocaleDateString()}
Time: ${new Date().toLocaleTimeString()}

This referral was generated with AI assistance and reviewed by a licensed pharmacist.
    `.trim();

    // Update case status and referral info
    diagnosticCase.status = 'referred';
    diagnosticCase.referral = {
      generated: true,
      generatedAt: new Date(),
      document: {
        content: referralContent,
        template: 'standard_referral',
        lastModified: new Date(),
        modifiedBy: userId,
      },
      status: 'pending',
      sentTo: physicianInfo,
    };

    // Update pharmacist decision
    diagnosticCase.pharmacistDecision.notes = notes || '';
    diagnosticCase.pharmacistDecision.reviewedAt = new Date();
    diagnosticCase.pharmacistDecision.reviewedBy = userId;

    await diagnosticCase.save();

    logger.info('Referral document generated', {
      caseId,
      userId,
      documentLength: referralContent.length,
    });

    res.status(200).json({
      success: true,
      message: 'Referral document generated successfully',
      data: {
        caseId: diagnosticCase.caseId,
        status: diagnosticCase.status,
        referralDocument: {
          content: referralContent,
          template: 'standard_referral',
          generatedAt: diagnosticCase.referral?.generatedAt,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to generate referral document', {
      error: error instanceof Error ? error.message : 'Unknown error',
      caseId: req.params.caseId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to generate referral document',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Update referral document
 */
export const updateReferralDocument = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { content } = req.body;
    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    logger.info('Update referral document request', {
      caseId,
      userId,
      workplaceId,
      contentLength: content?.length || 0,
      hasContent: !!content,
    });

    if (!content) {
      logger.warn('Update referral document failed: no content provided', { caseId, userId });
      res.status(400).json({
        success: false,
        message: 'Referral document content is required',
      });
      return;
    }

    const diagnosticCase = await DiagnosticCase.findOne({
      caseId,
      workplaceId,
      status: 'referred',
      'referral.generated': true,
    });

    logger.info('Diagnostic case lookup result', {
      caseId,
      found: !!diagnosticCase,
      hasReferral: !!diagnosticCase?.referral,
      referralStatus: diagnosticCase?.referral?.status,
      referralGenerated: diagnosticCase?.referral?.generated,
      hasDocument: !!diagnosticCase?.referral?.document,
    });

    if (!diagnosticCase || !diagnosticCase.referral) {
      logger.warn('Update referral document failed: case not found or no referral', {
        caseId,
        userId,
        found: !!diagnosticCase,
        hasReferral: !!diagnosticCase?.referral,
      });
      res.status(404).json({
        success: false,
        message: 'Referral document not found or case not in referred status',
      });
      return;
    }

    // Update referral document - handle case where document doesn't exist yet
    if (!diagnosticCase.referral.document) {
      diagnosticCase.referral.document = {
        content,
        template: 'default',
        lastModified: new Date(),
        modifiedBy: userId,
      };
    } else {
      diagnosticCase.referral.document = {
        ...diagnosticCase.referral.document,
        content,
        lastModified: new Date(),
        modifiedBy: userId,
      };
    }

    await diagnosticCase.save();

    logger.info('Referral document updated', {
      caseId,
      userId,
      contentLength: content.length,
    });

    res.status(200).json({
      success: true,
      message: 'Referral document updated successfully',
      data: {
        caseId: diagnosticCase.caseId,
        lastModified: diagnosticCase.referral.document?.lastModified,
      },
    });
  } catch (error) {
    logger.error('Failed to update referral document', {
      error: error instanceof Error ? error.message : 'Unknown error',
      caseId: req.params.caseId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to update referral document',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Get follow-up cases
 */
export const getFollowUpCases = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { page = 1, limit = 10, overdue = false } = req.query;
    const workplaceId = req.user!.workplaceId;
    const skip = (Number(page) - 1) * Number(limit);

    let matchFilter: any = {
      workplaceId,
      status: 'follow_up',
      'followUp.completed': false,
    };

    // Filter for overdue cases if requested
    if (overdue === 'true') {
      matchFilter['followUp.scheduledDate'] = { $lt: new Date() };
    }

    const followUpCases = await DiagnosticCase.find(matchFilter)
      .populate('patientId', 'firstName lastName age gender')
      .populate('pharmacistId', 'firstName lastName')
      .sort({ 'followUp.scheduledDate': 1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await DiagnosticCase.countDocuments(matchFilter);

    res.status(200).json({
      success: true,
      data: {
        cases: followUpCases,
        pagination: {
          current: Number(page),
          total: Math.ceil(total / Number(limit)),
          count: followUpCases.length,
          totalCases: total,
        },
      },
    });
  } catch (error) {
    logger.error('Failed to get follow-up cases', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get follow-up cases',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Download referral document
 */
export const downloadReferralDocument = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { format = 'pdf' } = req.query;
    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    const diagnosticCase = await DiagnosticCase.findOne({
      caseId,
      workplaceId,
      status: 'referred',
      'referral.generated': true,
    })
      .populate('patientId', 'firstName lastName age gender dateOfBirth')
      .populate('pharmacistId', 'firstName lastName credentials');

    if (!diagnosticCase || !diagnosticCase.referral?.document) {
      res.status(404).json({
        success: false,
        message: 'Referral document not found',
      });
      return;
    }

    const patient = diagnosticCase.patientId as any;
    const pharmacist = diagnosticCase.pharmacistId as any;
    const referralContent = diagnosticCase.referral.document.content;

    // For now, we'll return the content as JSON for the frontend to handle
    // In production, you would generate actual PDF/Word files here
    const filename = format === 'pdf' ? `referral-${caseId}.pdf` :
      format === 'docx' ? `referral-${caseId}.docx` :
        `referral-${caseId}.txt`;

    res.status(200).json({
      success: true,
      data: {
        content: referralContent,
        format: format,
        filename: filename,
      },
    });

    logger.info('Referral document downloaded', {
      caseId,
      format,
      userId,
    });
  } catch (error) {
    logger.error('Failed to download referral document', {
      error: error instanceof Error ? error.message : 'Unknown error',
      caseId: req.params.caseId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to download referral document',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Send referral electronically
 */
export const sendReferralElectronically = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { caseId } = req.params;
    const { physicianName, physicianEmail, specialty, institution, notes } = req.body;
    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    if (!physicianName || !physicianEmail) {
      res.status(400).json({
        success: false,
        message: 'Physician name and email are required',
      });
      return;
    }

    const diagnosticCase = await DiagnosticCase.findOne({
      caseId,
      workplaceId,
      status: 'referred',
      'referral.generated': true,
    });

    if (!diagnosticCase || !diagnosticCase.referral) {
      res.status(404).json({
        success: false,
        message: 'Referral not found',
      });
      return;
    }

    // Generate tracking ID
    const trackingId = `REF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Update referral with physician info and mark as sent
    diagnosticCase.referral.status = 'sent';
    diagnosticCase.referral.sentAt = new Date();
    diagnosticCase.referral.sentTo = {
      physicianName,
      physicianEmail,
      specialty: specialty || 'General Medicine',
      institution: institution || '',
    };
    diagnosticCase.referral.trackingId = trackingId;

    await diagnosticCase.save();

    // In a real implementation, you would send the email here
    // await emailService.sendReferral({
    //   to: physicianEmail,
    //   subject: `Medical Referral - ${patient.firstName} ${patient.lastName}`,
    //   content: diagnosticCase.referral.document.content,
    //   trackingId
    // });

    logger.info('Referral sent electronically', {
      caseId,
      physicianEmail,
      trackingId,
      userId,
    });

    res.status(200).json({
      success: true,
      message: 'Referral sent successfully',
      data: {
        caseId,
        trackingId,
        sentTo: diagnosticCase.referral.sentTo,
        sentAt: diagnosticCase.referral.sentAt,
      },
    });
  } catch (error) {
    logger.error('Failed to send referral', {
      error: error instanceof Error ? error.message : 'Unknown error',
      caseId: req.params.caseId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to send referral',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};

/**
 * Delete referral
 */
export const deleteReferral = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { caseId } = req.params;
    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    const diagnosticCase = await DiagnosticCase.findOne({
      caseId,
      workplaceId,
      status: 'referred',
    });

    if (!diagnosticCase) {
      res.status(404).json({
        success: false,
        message: 'Referral not found',
      });
      return;
    }

    // Reset case status back to pending_review and remove referral
    diagnosticCase.status = 'pending_review';
    diagnosticCase.referral = undefined;

    await diagnosticCase.save();

    logger.info('Referral deleted', {
      caseId,
      userId,
    });

    res.status(200).json({
      success: true,
      message: 'Referral deleted successfully',
      data: {
        caseId,
        newStatus: diagnosticCase.status,
      },
    });
  } catch (error) {
    logger.error('Failed to delete referral', {
      error: error instanceof Error ? error.message : 'Unknown error',
      caseId: req.params.caseId,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to delete referral',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};
/**
 * Va
lidate patient access for diagnostics
 */
export const validatePatientAccess = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { patientId } = req.body;
    const userId = req.user!._id;
    const workplaceId = req.user!.workplaceId;

    logger.info('Validating patient access', {
      patientId,
      userId,
      workplaceId,
    });

    // Validate patient ID format
    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
      res.status(400).json({
        success: false,
        message: 'Valid patient ID is required',
      });
      return;
    }

    // Verify workplaceId exists
    if (!workplaceId) {
      res.status(400).json({
        success: false,
        message: 'User workplace is required for patient access',
      });
      return;
    }

    // Check if patient exists at all (for debugging)
    const patientExists = await Patient.findById(patientId);
    logger.info('Patient existence check', {
      patientId,
      exists: !!patientExists,
      patientWorkplaceId: patientExists?.workplaceId,
      userWorkplaceId: workplaceId,
    });

    // Check if user is super admin
    const isSuperAdmin = req.user!.role === 'super_admin';

    // Verify patient exists and belongs to the workplace (or super admin bypass)
    let patient;
    if (isSuperAdmin) {
      // Super admin can access patients from any workplace
      patient = await Patient.findOne({
        _id: patientId,
        isDeleted: false,
      });

      if (patient && patient.workplaceId.toString() !== workplaceId.toString()) {
        logger.info('Super admin cross-workplace patient access', {
          patientId,
          userId,
          userWorkplaceId: workplaceId,
          patientWorkplaceId: patient.workplaceId,
          patientName: `${patient.firstName} ${patient.lastName}`,
          action: 'VALIDATE_PATIENT_ACCESS',
        });
      }
    } else {
      // Regular users can only access patients from their workplace
      patient = await Patient.findOne({
        _id: patientId,
        workplaceId: workplaceId,
        isDeleted: false,
      });
    }

    if (!patient) {
      // Provide detailed error information for debugging
      let debugInfo = '';
      if (patientExists) {
        if (patientExists.isDeleted) {
          debugInfo = 'Patient is marked as deleted';
        } else if (!isSuperAdmin && patientExists.workplaceId.toString() !== workplaceId.toString()) {
          debugInfo = `Patient belongs to different workplace (${patientExists.workplaceId})`;
        } else {
          debugInfo = 'Unknown access restriction';
        }
      } else {
        debugInfo = 'Patient does not exist in database';
      }

      logger.warn('Patient access denied', {
        patientId,
        userId,
        workplaceId,
        debugInfo,
        isSuperAdmin,
      });

      res.status(404).json({
        success: false,
        message: 'Patient not found or access denied',
        debug: process.env.NODE_ENV === 'development' ? debugInfo : undefined,
      });
      return;
    }

    // Patient access validated successfully
    res.status(200).json({
      success: true,
      message: 'Patient access validated',
      data: {
        patientId: patient._id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        workplaceId: patient.workplaceId,
        hasAccess: true,
      },
    });

  } catch (error) {
    logger.error('Failed to validate patient access', {
      error: error instanceof Error ? error.message : 'Unknown error',
      patientId: req.body.patientId,
      userId: req.user?._id,
      workplaceId: req.user?.workplaceId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to validate patient access',
      error:
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Internal server error',
    });
  }
};