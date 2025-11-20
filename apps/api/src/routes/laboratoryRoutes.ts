import express from 'express';
import { auth } from '../middlewares/auth';
import { authWithWorkspace } from '../middlewares/authWithWorkspace';
import { requirePermission, requireFeature } from '../middlewares/rbac';
import * as laboratoryController from '../controllers/laboratoryController';
import * as labTemplateController from '../controllers/labTemplateController';
import { upload } from '../middlewares/labUpload';

const router = express.Router();

// All routes require authentication and workspace context
router.use(auth);
router.use(authWithWorkspace);

// All routes require laboratory_findings feature access
router.use(requireFeature('laboratory_findings'));

// ===============================
// LAB RESULTS ROUTES
// ===============================

/**
 * @route   POST /api/laboratory/results
 * @desc    Create a new lab result
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Lab Technician, Owner, Super Admin
 */
router.post(
    '/results',
    requirePermission('lab_results:create'),
    laboratoryController.createLabResult
);

/**
 * @route   GET /api/laboratory/results
 * @desc    Get all lab results with filtering and pagination
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Intern Pharmacist, Lab Technician, Owner, Super Admin
 */
router.get(
    '/results',
    requirePermission('lab_results:read'),
    laboratoryController.getLabResults
);

/**
 * @route   GET /api/laboratory/results/statistics
 * @desc    Get lab results statistics (total, pending, critical, abnormal)
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/results/statistics',
    requirePermission('lab_results:read'),
    laboratoryController.getLabResultStatistics
);

/**
 * @route   GET /api/laboratory/results/critical
 * @desc    Get all critical lab results
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/results/critical',
    requirePermission('lab_results:read'),
    laboratoryController.getCriticalLabResults
);

/**
 * @route   GET /api/laboratory/results/pending
 * @desc    Get all pending lab results
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/results/pending',
    requirePermission('lab_results:read'),
    laboratoryController.getPendingLabResults
);

/**
 * @route   GET /api/laboratory/results/abnormal
 * @desc    Get all abnormal lab results
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/results/abnormal',
    requirePermission('lab_results:read'),
    laboratoryController.getAbnormalLabResults
);

/**
 * @route   GET /api/laboratory/results/patient/:patientId
 * @desc    Get all lab results for a specific patient
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Intern Pharmacist, Lab Technician, Owner, Super Admin
 */
router.get(
    '/results/patient/:patientId',
    requirePermission('lab_results:read'),
    laboratoryController.getPatientLabResults
);

/**
 * @route   GET /api/laboratory/results/patient/:patientId/trends
 * @desc    Get lab result trends for a patient (for graphs)
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/results/patient/:patientId/trends',
    requirePermission('lab_results:read'),
    laboratoryController.getPatientLabTrends
);

/**
 * @route   GET /api/laboratory/results/:id
 * @desc    Get a specific lab result by ID
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Intern Pharmacist, Lab Technician, Owner, Super Admin
 */
router.get(
    '/results/:id',
    requirePermission('lab_results:read'),
    laboratoryController.getLabResultById
);

/**
 * @route   PUT /api/laboratory/results/:id
 * @desc    Update a lab result
 * @access  Pharmacist, Lab Technician, Owner, Super Admin
 */
router.put(
    '/results/:id',
    requirePermission('lab_results:update'),
    laboratoryController.updateLabResult
);

/**
 * @route   DELETE /api/laboratory/results/:id
 * @desc    Delete a lab result (soft delete)
 * @access  Owner, Super Admin
 */
router.delete(
    '/results/:id',
    requirePermission('lab_results:delete'),
    laboratoryController.deleteLabResult
);

/**
 * @route   POST /api/laboratory/results/:id/signoff
 * @desc    Sign off a lab result
 * @access  Pharmacist, Owner, Super Admin
 */
router.post(
    '/results/:id/signoff',
    requirePermission('lab_results:signoff'),
    laboratoryController.signOffLabResult
);

/**
 * @route   POST /api/laboratory/results/:id/review
 * @desc    Add review to a lab result
 * @access  Pharmacist, Owner, Super Admin
 */
router.post(
    '/results/:id/review',
    requirePermission('lab_results:update'),
    laboratoryController.reviewLabResult
);

/**
 * @route   POST /api/laboratory/results/:id/mark-critical
 * @desc    Mark a lab result as critical
 * @access  Pharmacist, Owner, Super Admin
 */
router.post(
    '/results/:id/mark-critical',
    requirePermission('lab_results:update'),
    laboratoryController.markLabResultAsCritical
);

// ===============================
// FILE UPLOAD ROUTES
// ===============================

/**
 * @route   POST /api/laboratory/results/:id/attachments
 * @desc    Upload attachment (PDF/image) to a lab result
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Lab Technician, Owner, Super Admin
 */
router.post(
    '/results/:id/attachments',
    requirePermission('lab_results:upload'),
    upload.single('file'),
    laboratoryController.uploadLabResultAttachment
);

/**
 * @route   DELETE /api/laboratory/results/:id/attachments/:attachmentId
 * @desc    Remove attachment from a lab result
 * @access  Pharmacist, Owner, Super Admin
 */
router.delete(
    '/results/:id/attachments/:attachmentId',
    requirePermission('lab_results:update'),
    laboratoryController.removeLabResultAttachment
);

/**
 * @route   POST /api/laboratory/upload
 * @desc    Upload lab result document (PDF) and parse
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Lab Technician, Owner, Super Admin
 */
router.post(
    '/upload',
    requirePermission('lab_results:upload'),
    upload.single('file'),
    laboratoryController.uploadAndParseLabDocument
);

/**
 * @route   POST /api/laboratory/results/upload-and-process
 * @desc    Upload lab result files and process with AI/OCR
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Lab Technician, Owner, Super Admin
 */
router.post(
    '/results/upload-and-process',
    requirePermission('lab_results:create'),
    upload.array('files', 10), // Allow up to 10 files
    laboratoryController.uploadAndProcessLabResults
);

/**
 * @route   POST /api/laboratory/batch-upload
 * @desc    Batch upload lab results (CSV)
 * @access  Pharmacist, Owner, Super Admin
 */
router.post(
    '/batch-upload',
    requirePermission('lab_results:create'),
    upload.single('file'),
    laboratoryController.batchUploadLabResults
);

/**
 * @route   GET /api/laboratory/batch-upload/template
 * @desc    Download CSV template for batch upload
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/batch-upload/template',
    requirePermission('lab_results:read'),
    laboratoryController.downloadCSVTemplate
);

// ===============================
// LAB TEMPLATE ROUTES
// ===============================

/**
 * @route   GET /api/laboratory/templates
 * @desc    Get all lab test templates (system + workplace)
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Intern Pharmacist, Lab Technician, Owner, Super Admin
 */
router.get(
    '/templates',
    requirePermission('lab_templates:read'),
    labTemplateController.getLabTemplates
);

/**
 * @route   GET /api/laboratory/templates/system
 * @desc    Get system lab test templates
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Intern Pharmacist, Lab Technician, Owner, Super Admin
 */
router.get(
    '/templates/system',
    requirePermission('lab_templates:read'),
    labTemplateController.getSystemTemplates
);

/**
 * @route   GET /api/laboratory/templates/workplace
 * @desc    Get workplace-specific lab test templates
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.get(
    '/templates/workplace',
    requirePermission('lab_templates:read'),
    labTemplateController.getWorkplaceTemplates
);

/**
 * @route   GET /api/laboratory/templates/:id
 * @desc    Get a specific lab test template by ID
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Intern Pharmacist, Lab Technician, Owner, Super Admin
 */
router.get(
    '/templates/:id',
    requirePermission('lab_templates:read'),
    labTemplateController.getLabTemplateById
);

/**
 * @route   POST /api/laboratory/templates
 * @desc    Create a new lab test template
 * @access  Pharmacist, Owner, Super Admin
 */
router.post(
    '/templates',
    requirePermission('lab_templates:create'),
    labTemplateController.createLabTemplate
);

/**
 * @route   PUT /api/laboratory/templates/:id
 * @desc    Update a lab test template
 * @access  Pharmacist, Owner, Super Admin
 */
router.put(
    '/templates/:id',
    requirePermission('lab_templates:update'),
    labTemplateController.updateLabTemplate
);

/**
 * @route   DELETE /api/laboratory/templates/:id
 * @desc    Delete a lab test template (soft delete)
 * @access  Owner, Super Admin
 */
router.delete(
    '/templates/:id',
    requirePermission('lab_templates:delete'),
    labTemplateController.deleteLabTemplate
);

/**
 * @route   POST /api/laboratory/templates/:id/increment-usage
 * @desc    Increment usage count for a template
 * @access  Pharmacist, Pharmacy Team, Pharmacy Outlet, Owner, Super Admin
 */
router.post(
    '/templates/:id/increment-usage',
    requirePermission('lab_templates:read'),
    labTemplateController.incrementTemplateUsage
);

export default router;

