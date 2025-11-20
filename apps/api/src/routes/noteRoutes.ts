import express from 'express';
import {
  getNotes,
  getNote,
  createNote,
  updateNote,
  deleteNote,
  getPatientNotes,
  searchNotes,
  getNotesWithFilters,
  bulkUpdateNotes,
  bulkDeleteNotes,
  uploadAttachment,
  deleteAttachment,
  downloadAttachment,
  getNoteStatistics,
} from '../controllers/noteController';
import { auth } from '../middlewares/auth';
import {
  loadWorkspaceContext,
  requireWorkspaceContext,
} from '../middlewares/workspaceContext';
import { uploadMiddleware } from '../services/fileUploadService';
import { auditMiddleware } from '../middlewares/auditLogging';
import clinicalNoteRBAC from '../middlewares/clinicalNoteRBAC';
import { clinicalNotesCacheMiddleware, searchCacheMiddleware } from '../middlewares/cacheMiddleware';

const router = express.Router();

// Debugging middleware (disabled in production for performance)
router.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`
========== NOTE ROUTE DEBUG ==========
Request URL: ${req.originalUrl}
Request method: ${req.method}
Request params: ${JSON.stringify(req.params)}
Note ID from params: ${req.params.id}
Path: ${req.path}
========== END DEBUG ==========
    `);
  }
  next();
});

// Apply authentication and workspace context to all routes
router.use(auth);
router.use(loadWorkspaceContext);
router.use(requireWorkspaceContext);
router.use(
  auditMiddleware({
    action: 'CLINICAL_NOTE_ROUTE_ACCESS',
    category: 'data_access',
  })
);

// Main CRUD routes
router
  .route('/')
  .get(
    clinicalNoteRBAC.canReadClinicalNote,
    clinicalNoteRBAC.enforceTenancyIsolation,
    auditMiddleware({ action: 'LIST_CLINICAL_NOTES', category: 'data_access' }),
    clinicalNotesCacheMiddleware,
    getNotes
  )
  .post(
    clinicalNoteRBAC.canCreateClinicalNote,
    clinicalNoteRBAC.validatePatientAccess,
    auditMiddleware({
      action: 'CREATE_CLINICAL_NOTE',
      category: 'data_access',
    }),
    createNote
  );

// Search and filtering routes
router.get(
  '/search',
  clinicalNoteRBAC.canReadClinicalNote,
  clinicalNoteRBAC.enforceTenancyIsolation,
  auditMiddleware({
    action: 'SEARCH_CLINICAL_NOTES',
    category: 'data_access',
    severity: 'medium',
  }),
  searchCacheMiddleware,
  searchNotes
);

router.get(
  '/filter',
  clinicalNoteRBAC.canReadClinicalNote,
  clinicalNoteRBAC.enforceTenancyIsolation,
  auditMiddleware({ action: 'FILTER_CLINICAL_NOTES', category: 'data_access' }),
  getNotesWithFilters
);

router.get(
  '/statistics',
  clinicalNoteRBAC.canReadClinicalNote,
  clinicalNoteRBAC.enforceTenancyIsolation,
  auditMiddleware({ action: 'VIEW_NOTE_STATISTICS', category: 'data_access' }),
  getNoteStatistics
);

// Bulk operations - require higher permissions
router.post(
  '/bulk/update',
  clinicalNoteRBAC.canUpdateClinicalNote,
  clinicalNoteRBAC.validateBulkNoteAccess,
  auditMiddleware({
    action: 'BULK_UPDATE_NOTES',
    category: 'data_access',
    severity: 'high',
  }),
  bulkUpdateNotes
);

router.post(
  '/bulk/delete',
  clinicalNoteRBAC.canDeleteClinicalNote,
  clinicalNoteRBAC.validateBulkNoteAccess,
  auditMiddleware({
    action: 'BULK_DELETE_NOTES',
    category: 'data_access',
    severity: 'critical',
  }),
  bulkDeleteNotes
);

// Patient-specific notes
router.get(
  '/patient/:patientId',
  clinicalNoteRBAC.canReadClinicalNote,
  clinicalNoteRBAC.validatePatientAccess,
  clinicalNoteRBAC.enforceTenancyIsolation,
  auditMiddleware({ action: 'VIEW_PATIENT_NOTES', category: 'data_access' }),
  getPatientNotes
);

// File attachment routes
router.post(
  '/:id/attachments',
  clinicalNoteRBAC.canUpdateClinicalNote,
  clinicalNoteRBAC.validateNoteAccess,
  clinicalNoteRBAC.canModifyNote,
  uploadMiddleware.array('files', 5),
  auditMiddleware({
    action: 'UPLOAD_NOTE_ATTACHMENT',
    category: 'data_access',
  }),
  uploadAttachment
);

router.delete(
  '/:id/attachments/:attachmentId',
  clinicalNoteRBAC.canUpdateClinicalNote,
  clinicalNoteRBAC.validateNoteAccess,
  clinicalNoteRBAC.canModifyNote,
  auditMiddleware({
    action: 'DELETE_NOTE_ATTACHMENT',
    category: 'data_access',
  }),
  deleteAttachment
);

router.get(
  '/:id/attachments/:attachmentId/download',
  clinicalNoteRBAC.canReadClinicalNote,
  clinicalNoteRBAC.validateNoteAccess,
  clinicalNoteRBAC.logNoteAccess,
  auditMiddleware({
    action: 'DOWNLOAD_NOTE_ATTACHMENT',
    category: 'data_access',
  }),
  downloadAttachment
);

// Individual note routes (must be last to avoid conflicts)
router
  .route('/:id')
  .get(
    clinicalNoteRBAC.canReadClinicalNote,
    clinicalNoteRBAC.validateNoteAccess,
    clinicalNoteRBAC.logNoteAccess,
    auditMiddleware({ action: 'VIEW_CLINICAL_NOTE', category: 'data_access' }),
    getNote
  )
  .put(
    clinicalNoteRBAC.canUpdateClinicalNote,
    clinicalNoteRBAC.validateNoteAccess,
    clinicalNoteRBAC.canModifyNote,
    auditMiddleware({
      action: 'UPDATE_CLINICAL_NOTE',
      category: 'data_access',
    }),
    updateNote
  )
  .delete(
    clinicalNoteRBAC.canDeleteClinicalNote,
    clinicalNoteRBAC.validateNoteAccess,
    clinicalNoteRBAC.canModifyNote,
    auditMiddleware({
      action: 'DELETE_CLINICAL_NOTE',
      category: 'data_access',
      severity: 'critical',
    }),
    deleteNote
  );

export default router;
