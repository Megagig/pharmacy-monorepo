import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ClinicalNote from '../models/ClinicalNote';
import Patient from '../models/Patient';
import Medication from '../models/Medication';
import { AuditService } from '../services/auditService';
import ConfidentialNoteService from '../services/confidentialNoteService';
import { EnhancedTenancyGuard } from '../utils/tenancyGuard';
import { upload, deleteFile, getFileUrl } from '../utils/uploadService';
import { auditOperations } from '../middlewares/auditLogging';
import { AuthRequest } from '../types/auth';
import { CursorPagination } from '../utils/cursorPagination';
import path from 'path';
import fs from 'fs';

export const getNotes = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Debug logging (disabled in production for performance)
    if (process.env.NODE_ENV === 'development') {
      console.log('=== GET NOTES DEBUG ===');
      console.log('User role:', req.user?.role);
      console.log('User workplaceId:', req.user?.workplaceId);
      console.log('Tenancy filter from middleware:', req.tenancyFilter);
    }

    const {
      cursor,
      page,
      limit = 20,
      sortField = 'createdAt',
      sortOrder = 'desc',
      type,
      priority,
      patientId,
      clinicianId,
      dateFrom,
      dateTo,
      isConfidential,
      useCursor = 'true',
    } = req.query;

    // Parse limit
    const parsedLimit = Math.min(50, Math.max(1, parseInt(limit as string) || 20));

    // Use tenancy filter from middleware
    const filters: any = { ...req.tenancyFilter };

    // Apply filters
    if (type) filters.type = type;
    if (priority) filters.priority = priority;
    if (patientId) filters.patient = patientId;
    if (clinicianId) filters.pharmacist = clinicianId;

    // Handle confidential notes based on user permissions
    if (isConfidential !== undefined) {
      const canAccessConfidential = ['Owner', 'Pharmacist'].includes(
        req.user?.workplaceRole || ''
      );

      if (isConfidential === 'true') {
        if (!canAccessConfidential) {
          res.status(403).json({
            success: false,
            message: 'Insufficient permissions to access confidential notes',
          });
          return;
        }
        filters.isConfidential = true;
      } else {
        filters.isConfidential = { $ne: true };
      }
    } else {
      // If no specific filter, exclude confidential notes for users without permission
      const canAccessConfidential = ['Owner', 'Pharmacist'].includes(
        req.user?.workplaceRole || ''
      );
      if (!canAccessConfidential) {
        filters.isConfidential = { $ne: true };
      }
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filters.createdAt = {};
      if (dateFrom) filters.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) filters.createdAt.$lte = new Date(dateTo as string);
    }

    console.log('Final filters for getNotes:', JSON.stringify(filters, null, 2));

    // Use cursor-based pagination by default, fall back to skip/limit for legacy support
    if (useCursor === 'true' && !page) {
      // Cursor-based pagination (recommended)
      const result = await CursorPagination.paginate(ClinicalNote, {
        limit: parsedLimit,
        cursor: cursor as string,
        sortField: sortField as string,
        sortOrder: sortOrder as 'asc' | 'desc',
        filters,
      });

      // Populate the results
      const populatedItems = await ClinicalNote.populate(result.items, [
        { path: 'patient', select: 'firstName lastName mrn' },
        { path: 'pharmacist', select: 'firstName lastName role' },
        { path: 'medications', select: 'name dosage' },
      ]);

      console.log('GetNotes cursor results count:', populatedItems.length);

      // Log audit trail for data access (non-blocking)
      try {
        await AuditService.createAuditLog({
          action: 'LIST_CLINICAL_NOTES',
          userId: req.user?.id || 'unknown',
          details: {
            filters: {
              type,
              priority,
              patientId,
              clinicianId,
              dateFrom,
              dateTo,
              isConfidential,
            },
            resultCount: populatedItems.length,
            cursor: cursor || null,
            limit: parsedLimit,
            confidentialNotesIncluded: filters.isConfidential === true,
            paginationType: 'cursor',
          },
          complianceCategory: 'data_access',
          riskLevel: filters.isConfidential === true ? 'high' : 'low',
        });
      } catch (auditError) {
        console.error('Failed to create audit log for list notes:', auditError);
      }

      // Create paginated response
      const response = CursorPagination.createPaginatedResponse(
        { ...result, items: populatedItems },
        `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`,
        { limit: parsedLimit, sortField, sortOrder, ...req.query }
      );

      res.json({
        success: true,
        message: `Found ${populatedItems.length} clinical notes`,
        notes: populatedItems,
        ...response,
        filters: {
          type,
          priority,
          patientId,
          clinicianId,
          dateFrom,
          dateTo,
          isConfidential,
        },
      });
    } else {
      // Legacy skip/limit pagination (for backward compatibility)
      const parsedPage = Math.max(1, parseInt(page as string) || 1);

      const notes = await ClinicalNote.find(filters)
        .limit(parsedLimit)
        .skip((parsedPage - 1) * parsedLimit)
        .populate('patient', 'firstName lastName mrn')
        .populate('pharmacist', 'firstName lastName role')
        .populate('medications', 'name dosage')
        .sort({ [sortField as string]: sortOrder === 'asc' ? 1 : -1 });

      const total = await ClinicalNote.countDocuments(filters);

      console.log('GetNotes legacy results count:', notes.length);
      console.log('Total documents matching query:', total);

      // Log audit trail for data access (non-blocking)
      try {
        await AuditService.createAuditLog({
          action: 'LIST_CLINICAL_NOTES',
          userId: req.user?.id || 'unknown',
          details: {
            filters: {
              type,
              priority,
              patientId,
              clinicianId,
              dateFrom,
              dateTo,
              isConfidential,
            },
            resultCount: notes.length,
            page: parsedPage,
            limit: parsedLimit,
            confidentialNotesIncluded: filters.isConfidential === true,
            paginationType: 'skip-limit',
          },
          complianceCategory: 'data_access',
          riskLevel: filters.isConfidential === true ? 'high' : 'low',
        });
      } catch (auditError) {
        console.error('Failed to create audit log for list notes:', auditError);
      }

      res.json({
        success: true,
        notes,
        totalPages: Math.ceil(total / parsedLimit),
        currentPage: parsedPage,
        total,
        filters: {
          type,
          priority,
          patientId,
          clinicianId,
          dateFrom,
          dateTo,
          isConfidential,
        },
      });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('=== END GET NOTES DEBUG ===');
    }
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const getNote = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    console.log(`GET Note controller running for ID: ${req.params.id}`);
    // Note should be loaded by middleware
    let note = req.clinicalNote;

    // If note wasn't loaded by middleware, try direct lookup as a fallback
    if (!note && req.params.id) {
      console.log(
        `Note not found in request, attempting direct lookup with ID: ${req.params.id}`
      );

      // Try a direct lookup with relaxed conditions for super admin
      const query: Record<string, any> = { deletedAt: { $exists: false } };

      // Only apply workplace filter for non-super admins
      if (req.user?.role !== 'super_admin' && req.user?.workplaceId) {
        query.workplaceId = req.user.workplaceId;
      }

      // Try multiple ID formats
      query.$or = [
        { _id: req.params.id },
        { customId: req.params.id },
        { legacyId: req.params.id },
      ];

      try {
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
          // Try direct ObjectId query first
          const foundNote = await ClinicalNote.findById(req.params.id);
          if (foundNote) {
            console.log(`Found note directly by ID: ${foundNote._id}`);
            req.clinicalNote = foundNote;
          }
        }

        // If still not found, try the OR query
        if (!req.clinicalNote) {
          const foundNote = await ClinicalNote.findOne(query);
          if (foundNote) {
            console.log(`Found note using OR query: ${foundNote._id}`);
            req.clinicalNote = foundNote;
          }
        }
      } catch (lookupErr) {
        console.error(`Error in direct note lookup: ${lookupErr}`);
      }
    }

    // Final check if we have a note
    if (!req.clinicalNote) {
      console.log(`Note still not found for ID: ${req.params.id}`);
      res.status(404).json({
        success: false,
        message: 'Clinical note not found',
      });
      return;
    }

    // Use the found note
    note = req.clinicalNote;

    // Populate additional fields if needed
    await note.populate([
      { path: 'patient', select: 'firstName lastName mrn dateOfBirth' },
      { path: 'pharmacist', select: 'firstName lastName role' },
      { path: 'medications', select: 'name dosage strength' },
    ]);

    // Log confidential note access if applicable (non-blocking)
    if (note.isConfidential) {
      try {
        await AuditService.createAuditLog({
          action: 'VIEW_CONFIDENTIAL_NOTE',
          userId: req.user?.id || 'unknown',
          resourceType: 'ClinicalNote',
          resourceId: note._id,
          patientId: note.patient?._id || note.patient || null,
          details: {
            noteTitle: note.title,
            noteType: note.type,
            confidentialityLevel: 'high',
            accessJustification: 'Clinical care review',
          },
          complianceCategory: 'data_access',
          riskLevel: 'critical',
        });
      } catch (auditError) {
        console.error('Failed to create confidential note audit log:', auditError);
        // Don't block the main functionality if audit logging fails
      }
    }

    res.json({
      success: true,
      note,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const createNote = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Validate required fields
    const { patient: patientId, type, title, content } = req.body;

    if (!patientId || !type || !title) {
      res.status(400).json({
        success: false,
        message:
          'Missing required fields: patient, type, and title are required',
      });
      return;
    }

    // Patient is already validated by middleware
    const patient = req.patient;
    let workplaceId = req.workspaceContext?.workspace?._id;

    // For super_admin, use the patient's workplaceId if workspace context is null
    if (!workplaceId && req.user?.role === 'super_admin' && patient) {
      workplaceId = patient.workplaceId;
    }

    // Validate confidential note creation permissions
    if (req.body.isConfidential) {
      const canCreateConfidential = ['Owner', 'Pharmacist'].includes(
        req.user?.workplaceRole || ''
      );
      if (!canCreateConfidential) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions to create confidential notes',
          requiredRoles: ['Owner', 'Pharmacist'],
        });
        return;
      }
    }

    const noteData = {
      ...req.body,
      patient: patientId,
      pharmacist: req.user?.id,
      workplaceId: workplaceId,
      createdBy: req.user?.id,
      lastModifiedBy: req.user?.id,
    };

    const note = await ClinicalNote.create(noteData);

    // Populate the created note
    const populatedNote = await ClinicalNote.findById(note._id)
      .populate('patient', 'firstName lastName mrn')
      .populate('pharmacist', 'firstName lastName role')
      .populate('medications', 'name dosage');

    // Log audit trail with enhanced details (non-blocking)
    try {
      await AuditService.createAuditLog({
      action: req.body.isConfidential
        ? 'CREATE_CONFIDENTIAL_NOTE'
        : 'CREATE_CLINICAL_NOTE',
      userId: req.user?.id || 'unknown',
      resourceType: 'ClinicalNote',
      resourceId: note._id,
      patientId: new mongoose.Types.ObjectId(patientId),
      newValues: {
        ...noteData,
        // Sanitize sensitive data in audit log
        content: req.body.isConfidential
          ? '[CONFIDENTIAL_CONTENT]'
          : noteData.content,
      },
      details: {
        noteType: type,
        title,
        priority: req.body.priority || 'medium',
        isConfidential: req.body.isConfidential || false,
        patientMrn: patient.mrn,
        attachmentCount: req.body.attachments?.length || 0,
      },
      complianceCategory: 'clinical_documentation',
      riskLevel: req.body.isConfidential ? 'critical' : 'medium',
    });
    } catch (auditError) {
      console.error('Failed to create note creation audit log:', auditError);
      // Don't block the main functionality if audit logging fails
    }

    res.status(201).json({
      success: true,
      note: populatedNote,
      message: 'Clinical note created successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateNote = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    console.log(`UPDATE Note controller running for ID: ${req.params.id}`);
    console.log(`User: ${req.user?.id}, Role: ${req.user?.role}`);
    console.log(`Workspace: ${req.user?.workplaceId || req.workspaceContext?.workspace?._id}`);

    const noteId = req.params.id;

    // Validate note ID
    if (!noteId || !mongoose.Types.ObjectId.isValid(noteId)) {
      console.log(`Invalid note ID: ${noteId}`);
      res.status(400).json({ message: 'Invalid note ID' });
      return;
    }

    // Try to find the note with the most permissive query first
    let note = await ClinicalNote.findById(noteId)
      .populate('patient', 'firstName lastName mrn')
      .populate('pharmacist', 'firstName lastName role')
      .populate('medications', 'name dosage');

    if (!note) {
      console.log(`Note not found with ID: ${noteId}`);
      res.status(404).json({ message: 'Clinical note not found' });
      return;
    }

    console.log(`Found note: ${note._id}, workplace: ${note.workplaceId}`);

    // Check workspace access (unless super admin)
    if (req.user?.role !== 'super_admin') {
      const userWorkplaceId = req.user?.workplaceId || req.workspaceContext?.workspace?._id;
      if (note.workplaceId?.toString() !== userWorkplaceId?.toString()) {
        console.log(`Workspace mismatch. Note: ${note.workplaceId}, User: ${userWorkplaceId}`);
        res.status(403).json({ message: 'Access denied to this note' });
        return;
      }
    }

    // Check modification permissions
    const canModify = req.user?.role === 'super_admin' ||
      req.user?.workplaceRole === 'Owner' ||
      (req.user?.workplaceRole === 'Pharmacist' && note.pharmacist.toString() === req.user._id.toString());

    if (!canModify) {
      console.log(`User cannot modify note. User role: ${req.user?.workplaceRole}, Note creator: ${note.pharmacist}`);
      res.status(403).json({ message: 'Insufficient permissions to modify this note' });
      return;
    }

    // Store old values for audit
    const oldValues = note.toObject();

    // Update the note
    const updateData = {
      ...req.body,
      lastModifiedBy: req.user?.id,
      updatedAt: new Date(),
    };

    // Use findByIdAndUpdate for simpler operation
    const updatedNote = await ClinicalNote.findByIdAndUpdate(
      noteId,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('patient', 'firstName lastName mrn')
      .populate('pharmacist', 'firstName lastName role')
      .populate('medications', 'name dosage');

    if (!updatedNote) {
      res
        .status(404)
        .json({ message: 'Clinical note not found or access denied' });
      return;
    }

    // Log audit trail (non-blocking)
    try {
      await AuditService.createAuditLog({
        action: 'UPDATE_CLINICAL_NOTE',
        userId: req.user?.id || 'unknown',
        resourceType: 'ClinicalNote',
        resourceId: updatedNote._id,
        details: {
          noteId: updatedNote._id,
          patientId: updatedNote.patient?._id || updatedNote.patient || null,
          noteType: updatedNote.type,
          title: updatedNote.title,
          priority: updatedNote.priority,
          isConfidential: updatedNote.isConfidential,
        },
        oldValues,
        newValues: updatedNote.toObject(),
        changedFields: Object.keys(req.body),
        complianceCategory: 'clinical_documentation',
        riskLevel: updatedNote.isConfidential ? 'high' : 'medium',
      });
    } catch (auditError) {
      console.error('Failed to create note update audit log:', auditError);
      // Don't block the main functionality if audit logging fails
    }

    res.json({ note: updatedNote });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteNote = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    console.log(`DELETE Note controller running for ID: ${req.params.id}`);

    // The note should already be loaded and validated by the middleware
    let note = req.clinicalNote;

    // If not found through middleware, try a more flexible search
    if (!note) {
      console.log(
        `Note not found in request for deletion, trying direct lookup`
      );

      // Try to find the note with more flexible matching
      const noteId = req.params.id;
      const query: Record<string, any> = { deletedAt: { $exists: false } };

      // Only filter by workplace for non-super admins
      if (req.user?.role !== 'super_admin') {
        query.workplaceId =
          req.user?.workplaceId || req.workspaceContext?.workspace?._id;
      }

      // Try multiple ID formats
      if (noteId && mongoose.Types.ObjectId.isValid(noteId)) {
        // First try direct ID lookup
        const foundNote = await ClinicalNote.findById(noteId);
        if (foundNote) {
          console.log(`Found note by direct ID for deletion: ${foundNote._id}`);
          note = foundNote;
        }
      }

      // If still not found, try more flexible query
      if (!note) {
        query.$or = [
          { _id: noteId },
          { customId: noteId },
          { legacyId: noteId },
        ];

        const foundNote = await ClinicalNote.findOne(query);
        if (foundNote) {
          console.log(
            `Found note using OR query for deletion: ${foundNote._id}`
          );
          note = foundNote;
        }
      }
    }

    // Final check if note exists
    if (!note) {
      console.log(`Note still not found for deletion, ID: ${req.params.id}`);
      res.status(404).json({ message: 'Clinical note not found' });
      return;
    }

    // Store note data for audit before deletion
    const noteData = note.toObject();

    // Implement soft deletion by adding deletedAt field
    const deletedNote = await ClinicalNote.findOneAndUpdate(
      {
        _id: note._id, // Use the already found note ID to ensure we update the correct document
      },
      {
        deletedAt: new Date(),
        deletedBy: req.user?.id,
        lastModifiedBy: req.user?.id,
      },
      { new: true }
    );

    if (!deletedNote) {
      res
        .status(404)
        .json({ message: 'Clinical note not found or access denied' });
      return;
    }

    // Delete associated attachments
    if (note.attachments && note.attachments.length > 0) {
      for (const attachment of note.attachments) {
        try {
          const filePath = path.join(
            process.cwd(),
            'uploads',
            attachment.fileName
          );
          if (fs.existsSync(filePath)) {
            await deleteFile(filePath);
          }
        } catch (fileError) {
          console.error('Error deleting attachment:', fileError);
        }
      }
    }

    // Log audit trail
    await AuditService.createAuditLog({
      action: 'DELETE_CLINICAL_NOTE',
      userId: req.user?.id || 'unknown',
      resourceType: 'ClinicalNote',
      resourceId: note._id,
      details: {
        noteId: note._id,
        patientId: note.patient,
        noteType: note.type,
        title: note.title,
        priority: note.priority,
        isConfidential: note.isConfidential,
        attachmentCount: note.attachments?.length || 0,
      },
      oldValues: noteData,
      complianceCategory: 'clinical_documentation',
      riskLevel: 'critical',
    });

    res.json({ message: 'Clinical note deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getPatientNotes = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    // Debug logging for troubleshooting (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('GET PATIENT NOTES - User:', req.user?.role, 'Patient:', req.params.patientId);
    }

    const { page = 1, limit = 10, type, priority } = req.query;

    // For super_admin, find patient without workplace restriction
    let patient;
    if (req.user?.role === 'super_admin') {
      patient = await Patient.findById(req.params.patientId);
    } else {
      // Verify patient exists and belongs to the same workplace
      patient = await Patient.findOne({
        _id: req.params.patientId,
        workplaceId: req.user?.workplaceId || req.workspace?._id,
      });
    }

    if (!patient) {
      res.status(404).json({ message: 'Patient not found or access denied' });
      return;
    }

    // Build query - for super_admin, use patient's workplaceId
    const workplaceId = req.user?.role === 'super_admin'
      ? patient.workplaceId
      : (req.user?.workplaceId || req.workspace?._id);

    const query: any = {
      patient: req.params.patientId,
      workplaceId: workplaceId,
      deletedAt: { $exists: false }, // Exclude soft-deleted notes
    };

    if (type) query.type = type;
    if (priority) query.priority = priority;

    const notes = await ClinicalNote.find(query)
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .populate('pharmacist', 'firstName lastName role')
      .populate('medications', 'name dosage')
      .sort({ createdAt: -1 });

    const total = await ClinicalNote.countDocuments(query);

    // Log audit trail for patient data access
    await AuditService.createAuditLog({
      action: 'PATIENT_DATA_ACCESSED',
      userId: req.user?.id || 'unknown',
      details: {
        patientId: req.params.patientId,
        accessType: 'clinical_notes',
        resultCount: notes.length,
        noteCount: notes.length,
        filters: { type, priority },
      },
      complianceCategory: 'patient_privacy',
      riskLevel: 'medium',
    });

    res.json({
      notes,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total,
      patient: patient ? {
        _id: patient._id,
        firstName: patient.firstName,
        lastName: patient.lastName,
        mrn: patient.mrn,
      } : null,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// Enhanced search functionality with full-text search
export const searchNotes = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    console.log('=== SEARCH NOTES DEBUG ===');
    console.log('User role:', req.user?.role);
    console.log('User workplaceId:', req.user?.workplaceId);
    console.log('Tenancy filter from middleware:', req.tenancyFilter);

    const {
      query: searchQuery,
      page = 1,
      limit = 10,
      type,
      priority,
      patientId,
      dateFrom,
      dateTo,
    } = req.query;

    console.log('Search query:', searchQuery);
    console.log('Search filters:', {
      page,
      limit,
      type,
      priority,
      patientId,
      dateFrom,
      dateTo,
    });

    if (!searchQuery) {
      res.status(400).json({ message: 'Search query is required' });
      return;
    }

    // Build base query with tenancy isolation from middleware
    const baseQuery: any = { ...req.tenancyFilter };

    // Add filters
    if (type) baseQuery.type = type;
    if (priority) baseQuery.priority = priority;
    if (patientId) baseQuery.patient = patientId;

    // Date range filter
    if (dateFrom || dateTo) {
      baseQuery.createdAt = {};
      if (dateFrom) baseQuery.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) baseQuery.createdAt.$lte = new Date(dateTo as string);
    }

    // Full-text search across multiple fields
    const searchRegex = new RegExp(searchQuery as string, 'i');
    console.log(
      'Search regex created:',
      searchRegex.source,
      'flags:',
      searchRegex.flags
    );

    const searchConditions = {
      $or: [
        { title: searchRegex },
        { 'content.subjective': searchRegex },
        { 'content.objective': searchRegex },
        { 'content.assessment': searchRegex },
        { 'content.plan': searchRegex },
        { recommendations: { $elemMatch: { $regex: searchRegex } } },
        { tags: { $elemMatch: { $regex: searchRegex } } },
      ],
    };

    const finalQuery = { ...baseQuery, ...searchConditions };

    console.log(
      'Final query for search:',
      JSON.stringify(
        finalQuery,
        (key, value) => {
          if (value instanceof RegExp) {
            return { $regex: value.source, $options: value.flags };
          }
          return value;
        },
        2
      )
    );
    const notes = await ClinicalNote.find(finalQuery)
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .populate('patient', 'firstName lastName mrn')
      .populate('pharmacist', 'firstName lastName role')
      .populate('medications', 'name dosage')
      .sort({ createdAt: -1 });

    const total = await ClinicalNote.countDocuments(finalQuery);

    console.log('Search results count:', notes.length);
    console.log('Total documents matching query:', total);
    console.log('=== END SEARCH NOTES DEBUG ===');

    // Log audit trail for search (non-blocking)
    try {
      await AuditService.createAuditLog({
        action: 'SEARCH_CLINICAL_NOTES',
        userId: req.user?.id || 'unknown',
        resourceType: 'ClinicalNote',
        resourceId: new mongoose.Types.ObjectId(),
        details: {
          searchQuery,
          filters: { type, priority, patientId, dateFrom, dateTo },
          resultCount: notes.length,
          page: Number(page),
          limit: Number(limit),
        },
        complianceCategory: 'data_access',
        riskLevel: 'medium',
      });
    } catch (auditError) {
      console.error('Failed to create audit log for search:', auditError);
      // Continue with the response even if audit logging fails
    }

    res.json({
      notes,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total,
      searchQuery,
      filters: { type, priority, patientId, dateFrom, dateTo },
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// Advanced filtering with multiple criteria
export const getNotesWithFilters = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      priority,
      patientId,
      clinicianId,
      dateFrom,
      dateTo,
      isConfidential,
      followUpRequired,
      tags,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build query with tenancy isolation
    const query: any = {
      workplaceId: req.user?.workplaceId || req.workspace?._id,
      deletedAt: { $exists: false },
    };

    // Apply all filters
    if (type) query.type = type;
    if (priority) query.priority = priority;
    if (patientId) query.patient = patientId;
    if (clinicianId) query.pharmacist = clinicianId;
    if (isConfidential !== undefined)
      query.isConfidential = isConfidential === 'true';
    if (followUpRequired !== undefined)
      query.followUpRequired = followUpRequired === 'true';

    // Tags filter (array contains any of the specified tags)
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      query.tags = { $in: tagArray };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
    }

    // Build sort object
    const sortObj: any = {};
    sortObj[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    const notes = await ClinicalNote.find(query)
      .limit(Number(limit) * 1)
      .skip((Number(page) - 1) * Number(limit))
      .populate('patient', 'firstName lastName mrn')
      .populate('pharmacist', 'firstName lastName role')
      .populate('medications', 'name dosage')
      .sort(sortObj);

    const total = await ClinicalNote.countDocuments(query);

    // Log audit trail - TODO: Implement audit logging
    /*
    const auditContext = AuditService.createAuditContext(req);
    await AuditService.logActivity(auditContext, {
      action: 'FILTER_CLINICAL_NOTES',
      resourceType: 'ClinicalNote',
      resourceId: new mongoose.Types.ObjectId(),
      details: {
        filters: {
          type,
          priority,
          patientId,
          clinicianId,
          dateFrom,
          dateTo,
          isConfidential,
          followUpRequired,
          tags,
        },
        resultCount: notes.length,
        sortBy,
        sortOrder,
      },
      complianceCategory: 'data_access',
      riskLevel: 'low',
    });
    */

    res.json({
      notes,
      totalPages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      total,
      appliedFilters: {
        type,
        priority,
        patientId,
        clinicianId,
        dateFrom,
        dateTo,
        isConfidential,
        followUpRequired,
        tags,
      },
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// Bulk update notes
export const bulkUpdateNotes = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { noteIds, updates } = req.body;

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Note IDs array is required',
      });
      return;
    }

    if (!updates || Object.keys(updates).length === 0) {
      res.status(400).json({
        success: false,
        message: 'Updates object is required',
      });
      return;
    }

    // Notes are already validated by middleware
    const existingNotes = req.clinicalNotes;
    const confidentialNoteService = ConfidentialNoteService.getInstance();

    if (!existingNotes) {
      res.status(400).json({
        success: false,
        message: 'Clinical notes not found',
      });
      return;
    }

    // Check for confidential note updates
    const confidentialNotes = existingNotes.filter(
      (note: any) => note.isConfidential
    );
    if (confidentialNotes.length > 0) {
      const canModifyConfidential = confidentialNotes.every((note: any) =>
        confidentialNoteService.canModifyConfidentialNote(req.user as any, note)
      );

      if (!canModifyConfidential) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions to modify some confidential notes',
          confidentialNoteCount: confidentialNotes.length,
        });
        return;
      }
    }

    // Validate confidential note updates if isConfidential is being changed
    if (updates.isConfidential === true) {
      if (!confidentialNoteService.canCreateConfidentialNotes(req.user as any)) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions to mark notes as confidential',
        });
        return;
      }
    }

    // Prepare update data
    const updateData = {
      ...updates,
      lastModifiedBy: req.user?.id,
      updatedAt: new Date(),
    };

    // Apply confidential security measures if needed
    if (updates.isConfidential) {
      Object.assign(
        updateData,
        confidentialNoteService.applyConfidentialSecurity(updateData)
      );
    }

    // Perform bulk update
    const result = await ClinicalNote.updateMany(
      {
        _id: { $in: noteIds },
        ...req.tenancyFilter,
      },
      updateData,
      { runValidators: true }
    );

    // Get updated notes for response
    const updatedNotes = await ClinicalNote.find({
      _id: { $in: noteIds },
    })
      .populate('patient', 'firstName lastName mrn')
      .populate('pharmacist', 'firstName lastName role');

    // Log bulk operation audit trail
    await auditOperations.bulkOperation(
      req,
      'UPDATE_NOTES',
      'ClinicalNote',
      noteIds,
      {
        updatedFields: Object.keys(updates),
        affectedCount: result.modifiedCount,
        confidentialNotesAffected: confidentialNotes.length,
        updates: confidentialNoteService.sanitizeForAudit(updates),
      }
    );

    // Log confidential note access if applicable
    if (confidentialNotes.length > 0) {
      for (const note of confidentialNotes) {
        await confidentialNoteService.logConfidentialAccess(
          req,
          note._id.toString(),
          'BULK_UPDATE',
          {
            noteTitle: note.title,
            noteType: note.type,
            bulkOperation: true,
          }
        );
      }
    }

    res.json({
      success: true,
      message: `Successfully updated ${result.modifiedCount} notes`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
      notes: updatedNotes,
      confidentialNotesAffected: confidentialNotes.length,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// Bulk delete notes (soft delete)
export const bulkDeleteNotes = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { noteIds } = req.body;

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Note IDs array is required',
      });
      return;
    }

    // Notes are already validated by middleware
    const existingNotes = req.clinicalNotes;
    const confidentialNoteService = ConfidentialNoteService.getInstance();

    if (!existingNotes) {
      res.status(400).json({
        success: false,
        message: 'Clinical notes not found',
      });
      return;
    }

    // Check for confidential note deletions
    const confidentialNotes = existingNotes.filter(
      (note: any) => note.isConfidential
    );
    if (confidentialNotes.length > 0) {
      const canDeleteConfidential = confidentialNotes.every((note: any) =>
        confidentialNoteService.canModifyConfidentialNote(req.user as any, note)
      );

      if (!canDeleteConfidential) {
        res.status(403).json({
          success: false,
          message: 'Insufficient permissions to delete some confidential notes',
          confidentialNoteCount: confidentialNotes.length,
        });
        return;
      }
    }

    // Store note details for audit before deletion
    const noteDetails = existingNotes.map((note: any) => ({
      id: note._id,
      title: note.title,
      type: note.type,
      patientId: note.patient,
      isConfidential: note.isConfidential,
      attachmentCount: note.attachments?.length || 0,
    }));

    // Perform bulk soft delete
    const result = await ClinicalNote.updateMany(
      {
        _id: { $in: noteIds },
        ...req.tenancyFilter,
      },
      {
        deletedAt: new Date(),
        deletedBy: req.user?.id,
        lastModifiedBy: req.user?.id,
      }
    );

    // Delete associated attachments for all notes
    for (const note of existingNotes) {
      if (note.attachments && note.attachments.length > 0) {
        for (const attachment of note.attachments) {
          try {
            const filePath = path.join(
              process.cwd(),
              'uploads',
              attachment.fileName
            );
            if (fs.existsSync(filePath)) {
              await deleteFile(filePath);
            }
          } catch (fileError) {
            console.error('Error deleting attachment:', fileError);
          }
        }
      }
    }

    // Log bulk deletion audit trail
    await auditOperations.bulkOperation(
      req,
      'DELETE_NOTES',
      'ClinicalNote',
      noteIds,
      {
        deletedCount: result.modifiedCount,
        confidentialNotesDeleted: confidentialNotes.length,
        noteDetails: noteDetails.map((detail) =>
          detail.isConfidential
            ? { ...detail, title: '[CONFIDENTIAL_NOTE]' }
            : detail
        ),
        totalAttachmentsDeleted: noteDetails.reduce(
          (sum, note) => sum + note.attachmentCount,
          0
        ),
      }
    );

    // Log confidential note deletions separately
    if (confidentialNotes.length > 0) {
      for (const note of confidentialNotes) {
        await confidentialNoteService.logConfidentialAccess(
          req,
          note._id.toString(),
          'BULK_DELETE',
          {
            noteTitle: note.title,
            noteType: note.type,
            bulkOperation: true,
            permanentDeletion: false, // Soft delete
          }
        );
      }
    }

    res.json({
      success: true,
      message: `Successfully deleted ${result.modifiedCount} notes`,
      deletedCount: result.modifiedCount,
      confidentialNotesDeleted: confidentialNotes.length,
      attachmentsDeleted: noteDetails.reduce(
        (sum, note) => sum + note.attachmentCount,
        0
      ),
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

// File upload for note attachments
export const uploadAttachment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const noteId = req.params.id;

    // Verify note exists and belongs to user's workplace
    const note = await ClinicalNote.findOne({
      _id: noteId,
      workplaceId: req.user?.workplaceId || req.workspace?._id,
      deletedAt: { $exists: false },
    });

    if (!note) {
      res
        .status(404)
        .json({ message: 'Clinical note not found or access denied' });
      return;
    }

    // Check if files were uploaded
    if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
      res.status(400).json({ message: 'No files uploaded' });
      return;
    }

    const uploadedFiles = Array.isArray(req.files) ? req.files : [req.files];
    const attachmentData: any[] = [];

    // Process each uploaded file
    for (const file of uploadedFiles) {
      if (file && 'filename' in file && typeof file.filename === 'string') {
        const attachment = {
          _id: new mongoose.Types.ObjectId(),
          fileName: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          url: getFileUrl(file.filename as string),
          uploadedAt: new Date(),
          uploadedBy: req.user?.id,
        };

        attachmentData.push(attachment);
      }
    }

    // Update note with new attachments
    const updatedNote = await ClinicalNote.findByIdAndUpdate(
      noteId,
      {
        $push: { attachments: { $each: attachmentData } },
        lastModifiedBy: req.user?.id,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    )
      .populate('patient', 'firstName lastName mrn')
      .populate('pharmacist', 'firstName lastName role');

    // Log audit trail - TODO: Implement audit logging
    /*
    const auditContext = AuditService.createAuditContext(req);
    await AuditService.logActivity(auditContext, {
      action: 'UPLOAD_NOTE_ATTACHMENT',
      resourceType: 'ClinicalNote',
      resourceId: note._id,
      patientId: note.patient,
      details: {
        noteTitle: note.title,
        attachmentCount: attachmentData.length,
        attachments: attachmentData.map((att) => ({
          fileName: att.fileName,
          originalName: att.originalName,
          size: att.size,
          mimeType: att.mimeType,
        })),
      },
      complianceCategory: 'clinical_documentation',
      riskLevel: 'medium',
    });
    */

    res.status(201).json({
      message: 'Files uploaded successfully',
      attachments: attachmentData,
      note: updatedNote,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// Delete attachment from note
export const deleteAttachment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id: noteId, attachmentId } = req.params;

    // Verify note exists and belongs to user's workplace
    const note = await ClinicalNote.findOne({
      _id: noteId,
      workplaceId: req.user?.workplaceId || req.workspace?._id,
      deletedAt: { $exists: false },
    });

    if (!note) {
      res
        .status(404)
        .json({ message: 'Clinical note not found or access denied' });
      return;
    }

    // Find the attachment
    const attachment = note.attachments?.find(
      (att) => att._id?.toString() === attachmentId
    );
    if (!attachment) {
      res.status(404).json({ message: 'Attachment not found' });
      return;
    }

    // Delete physical file
    try {
      const filePath = path.join(process.cwd(), 'uploads', attachment.fileName);
      if (fs.existsSync(filePath)) {
        await deleteFile(filePath);
      }
    } catch (fileError) {
      console.error('Error deleting physical file:', fileError);
    }

    // Remove attachment from note
    const updatedNote = await ClinicalNote.findByIdAndUpdate(
      noteId,
      {
        $pull: { attachments: { _id: attachmentId } },
        lastModifiedBy: req.user?.id,
        updatedAt: new Date(),
      },
      { new: true }
    )
      .populate('patient', 'firstName lastName mrn')
      .populate('pharmacist', 'firstName lastName role');

    // Log audit trail - TODO: Implement audit logging
    /*
    const auditContext = AuditService.createAuditContext(req);
    await AuditService.logActivity(auditContext, {
      action: 'DELETE_NOTE_ATTACHMENT',
      resourceType: 'ClinicalNote',
      resourceId: note._id,
      patientId: note.patient,
      details: {
        noteTitle: note.title,
        deletedAttachment: {
          fileName: attachment.fileName,
          originalName: attachment.originalName,
          size: attachment.size,
        },
      },
      complianceCategory: 'clinical_documentation',
      riskLevel: 'medium',
    });
    */

    res.json({
      message: 'Attachment deleted successfully',
      note: updatedNote,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// Download attachment
export const downloadAttachment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { id: noteId, attachmentId } = req.params;

    // Verify note exists and belongs to user's workplace
    const note = await ClinicalNote.findOne({
      _id: noteId,
      workplaceId: req.user?.workplaceId || req.workspace?._id,
      deletedAt: { $exists: false },
    });

    if (!note) {
      res
        .status(404)
        .json({ message: 'Clinical note not found or access denied' });
      return;
    }

    // Find the attachment
    const attachment = note.attachments?.find(
      (att) => att._id?.toString() === attachmentId
    );
    if (!attachment) {
      res.status(404).json({ message: 'Attachment not found' });
      return;
    }

    // Check if file exists
    const filePath = path.join(process.cwd(), 'uploads', attachment.fileName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ message: 'File not found on server' });
      return;
    }

    // Log audit trail for file access
    const auditContext = AuditService.createAuditContext(req);
    await AuditService.logActivity(auditContext, {
      action: 'DOWNLOAD_NOTE_ATTACHMENT',
      resourceType: 'ClinicalNote',
      resourceId: note._id,
      patientId: note.patient,
      details: {
        noteTitle: note.title,
        attachment: {
          fileName: attachment.fileName,
          originalName: attachment.originalName,
          size: attachment.size,
        },
      },
      complianceCategory: 'data_access',
      riskLevel: 'medium',
    });

    // Set appropriate headers and send file
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${attachment.originalName}"`
    );
    res.setHeader('Content-Type', attachment.mimeType);
    res.sendFile(filePath);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// Get note statistics for dashboard
export const getNoteStatistics = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const workplaceId = req.user?.workplaceId || req.workspace?._id;
    const { dateFrom, dateTo } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) dateFilter.createdAt.$lte = new Date(dateTo as string);
    }

    // Get statistics
    const stats = await ClinicalNote.aggregate([
      {
        $match: {
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          deletedAt: { $exists: false },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalNotes: { $sum: 1 },
          notesByType: {
            $push: '$type',
          },
          notesByPriority: {
            $push: '$priority',
          },
          confidentialNotes: {
            $sum: { $cond: ['$isConfidential', 1, 0] },
          },
          notesWithFollowUp: {
            $sum: { $cond: ['$followUpRequired', 1, 0] },
          },
          notesWithAttachments: {
            $sum: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ['$attachments', []] } }, 0] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalNotes: 0,
      notesByType: [],
      notesByPriority: [],
      confidentialNotes: 0,
      notesWithFollowUp: 0,
      notesWithAttachments: 0,
    };

    // Count by type
    const typeCount = result.notesByType.reduce((acc: any, type: string) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Count by priority
    const priorityCount = result.notesByPriority.reduce(
      (acc: any, priority: string) => {
        acc[priority] = (acc[priority] || 0) + 1;
        return acc;
      },
      {}
    );

    res.json({
      totalNotes: result.totalNotes,
      typeDistribution: typeCount,
      priorityDistribution: priorityCount,
      confidentialNotes: result.confidentialNotes,
      notesWithFollowUp: result.notesWithFollowUp,
      notesWithAttachments: result.notesWithAttachments,
      dateRange: { dateFrom, dateTo },
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};
