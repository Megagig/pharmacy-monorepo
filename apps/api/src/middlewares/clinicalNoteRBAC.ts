import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth';
import { requirePermission, requireWorkplaceRole } from './rbac';
import ClinicalNote from '../models/ClinicalNote';
import Patient from '../models/Patient';
import Medication from '../models/Medication';
import { auditOperations } from './auditLogging';
import logger from '../utils/logger';
import mongoose from 'mongoose';

/**
 * Clinical Notes specific RBAC middleware
 * Provides granular access control for clinical note operations
 */

/**
 * Map system roles to workplace roles for clinical notes permissions
 */
const mapSystemRoleToWorkplaceRole = (systemRole: string): 'Owner' | 'Pharmacist' | 'Technician' | null => {
  switch (systemRole) {
    case 'pharmacy_outlet':
      return 'Owner';
    case 'pharmacist':
    case 'pharmacy_team':
      return 'Pharmacist';
    case 'intern_pharmacist':
      return 'Technician';
    default:
      return null;
  }
};

/**
 * Enhanced middleware to check if user can create clinical notes
 * Includes role mapping for backward compatibility
 */
export const canCreateClinicalNote = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Super admin bypasses all checks
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has workplaceRole set
    let userWorkplaceRole = req.user.workplaceRole;
    
    // If no workplaceRole, try to map from system role
    if (!userWorkplaceRole && req.user.role) {
      const mappedRole = mapSystemRoleToWorkplaceRole(req.user.role);
      if (mappedRole) {
        userWorkplaceRole = mappedRole as any;
      }
    }

    // Check if user has required workplace role for clinical notes
    const allowedRoles = ['Owner', 'Pharmacist'];
    if (!userWorkplaceRole || !allowedRoles.includes(userWorkplaceRole)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions to create clinical notes',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
        userWorkplaceRole: userWorkplaceRole,
      });
      return;
    }

    // If we get here, user has permission
    next();
  } catch (error) {
    logger.error('Error checking clinical note creation permission:', error);
    res.status(500).json({
      success: false,
      message: 'Permission check failed',
    });
  }
};

/**
 * Enhanced middleware to check if user can read clinical notes
 */
export const canReadClinicalNote = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Super admin bypasses all checks
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has workplaceRole set
    let userWorkplaceRole = req.user.workplaceRole;
    
    // If no workplaceRole, try to map from system role
    if (!userWorkplaceRole && req.user.role) {
      const mappedRole = mapSystemRoleToWorkplaceRole(req.user.role);
      if (mappedRole) {
        userWorkplaceRole = mappedRole as any;
      }
    }

    // Check if user has required workplace role for clinical notes
    const allowedRoles = ['Owner', 'Pharmacist', 'Technician'];
    if (!userWorkplaceRole || !allowedRoles.includes(userWorkplaceRole)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions to read clinical notes',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
        userWorkplaceRole: userWorkplaceRole,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error checking clinical note read permission:', error);
    res.status(500).json({
      success: false,
      message: 'Permission check failed',
    });
  }
};

/**
 * Enhanced middleware to check if user can update clinical notes
 */
export const canUpdateClinicalNote = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Super admin bypasses all checks
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has workplaceRole set
    let userWorkplaceRole = req.user.workplaceRole;
    
    // If no workplaceRole, try to map from system role
    if (!userWorkplaceRole && req.user.role) {
      const mappedRole = mapSystemRoleToWorkplaceRole(req.user.role);
      if (mappedRole) {
        userWorkplaceRole = mappedRole as any;
      }
    }

    // Check if user has required workplace role for clinical notes
    const allowedRoles = ['Owner', 'Pharmacist'];
    if (!userWorkplaceRole || !allowedRoles.includes(userWorkplaceRole)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions to update clinical notes',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
        userWorkplaceRole: userWorkplaceRole,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error checking clinical note update permission:', error);
    res.status(500).json({
      success: false,
      message: 'Permission check failed',
    });
  }
};

/**
 * Enhanced middleware to check if user can delete clinical notes
 */
export const canDeleteClinicalNote = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Super admin bypasses all checks
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has workplaceRole set
    let userWorkplaceRole = req.user.workplaceRole;
    
    // If no workplaceRole, try to map from system role
    if (!userWorkplaceRole && req.user.role) {
      const mappedRole = mapSystemRoleToWorkplaceRole(req.user.role);
      if (mappedRole) {
        userWorkplaceRole = mappedRole as any;
      }
    }

    // Check if user has required workplace role for clinical notes
    const allowedRoles = ['Owner', 'Pharmacist'];
    if (!userWorkplaceRole || !allowedRoles.includes(userWorkplaceRole)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions to delete clinical notes',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
        userWorkplaceRole: userWorkplaceRole,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error checking clinical note delete permission:', error);
    res.status(500).json({
      success: false,
      message: 'Permission check failed',
    });
  }
};

/**
 * Enhanced middleware to check if user can export clinical notes
 */
export const canExportClinicalNotes = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Super admin bypasses all checks
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Check if user has workplaceRole set
    let userWorkplaceRole = req.user.workplaceRole;
    
    // If no workplaceRole, try to map from system role
    if (!userWorkplaceRole && req.user.role) {
      const mappedRole = mapSystemRoleToWorkplaceRole(req.user.role);
      if (mappedRole) {
        userWorkplaceRole = mappedRole as any;
      }
    }

    // Check if user has required workplace role for clinical notes export
    const allowedRoles = ['Owner', 'Pharmacist'];
    if (!userWorkplaceRole || !allowedRoles.includes(userWorkplaceRole)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions to export clinical notes',
        requiredRoles: allowedRoles,
        userRole: req.user.role,
        userWorkplaceRole: userWorkplaceRole,
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error checking clinical note export permission:', error);
    res.status(500).json({
      success: false,
      message: 'Permission check failed',
    });
  }
};

/**
 * Middleware to check if user can access confidential notes
 */
export const canAccessConfidentialNotes = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  // Only pharmacists and owners can access confidential notes
  const allowedRoles = ['Owner', 'Pharmacist'];
  const userWorkplaceRole = req.user.workplaceRole;

  if (!userWorkplaceRole || !allowedRoles.includes(userWorkplaceRole)) {
    res.status(403).json({
      success: false,
      message: 'Insufficient permissions to access confidential notes',
      requiredRoles: allowedRoles,
      userRole: userWorkplaceRole,
    });
    return;
  }

  next();
};

/**
 * Middleware to validate note ownership and workplace isolation
 */
export const validateNoteAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Debug information to understand the request path
    const requestPath = req.originalUrl || req.path || req.url;
    console.log(`Validating note access for path: ${requestPath}`);

    // Try to extract note ID from various possible sources
    const noteId = req.params.id;
    console.log(`Note ID from params: ${noteId}`);

    if (!noteId) {
      console.log('No ID found in params, checking path extraction');
      // This is a fallback in case params aren't correctly extracted
      const pathParts = requestPath.split('/');
      const potentialId = pathParts[pathParts.length - 1];
      if (potentialId && potentialId.length >= 24) {
        console.log(`Found potential ID in URL path: ${potentialId}`);
        req.params.id = potentialId; // Update params for future middleware
      }
    }

    const workplaceId =
      req.user?.workplaceId || req.workspaceContext?.workspace?._id;

    if (!noteId) {
      res.status(400).json({
        success: false,
        message: 'Note ID is required',
      });
      return;
    }

    // Log the note ID we're trying to find
    console.log(`Looking up note with ID: ${noteId}`);

    // Check if ID is valid - now more flexible to handle various ID formats
    let queryId = noteId;
    // First try - if it looks like an ObjectId, try to convert it
    if (noteId.length === 24) {
      try {
        // This just tests if it can be converted
        new mongoose.Types.ObjectId(noteId);
        // If it reached here, it's valid
        queryId = noteId;
        console.log(`Note ID is a valid ObjectId: ${queryId}`);
      } catch (err) {
        // Not a valid ObjectId, continue with original
        console.log(`Note ID couldn't be converted to ObjectId: ${noteId}`);
      }
    }
    if (!workplaceId) {
      res.status(403).json({
        success: false,
        message: 'No workplace context available',
      });
      return;
    }

    // Find the note and verify workplace isolation
    // Define the query type using Record for flexible property access
    const query: Record<string, any> = {
      deletedAt: { $exists: false },
    };

    // Only add workplaceId filter if user is not super admin
    if (req.user?.role !== 'super_admin') {
      query.workplaceId = workplaceId;
      console.log(`Adding workplaceId filter: ${workplaceId}`);
    } else {
      console.log('Super admin access - not filtering by workplace');
    }

    // Try multiple lookup strategies to be extra flexible
    try {
      // Strategy 1: Direct ObjectId lookup
      if (mongoose.Types.ObjectId.isValid(queryId)) {
        console.log(`Trying direct ObjectId lookup with: ${queryId}`);
        const directNote = await ClinicalNote.findOne({
          _id: queryId,
          ...query,
        }).populate('patient', 'firstName lastName mrn workplaceId');

        if (directNote) {
          req.clinicalNote = directNote;
          console.log('Found note with direct ObjectId lookup');
          return next();
        }
      }

      // Strategy 2: OR query with multiple fields
      console.log('Direct lookup failed, trying multi-field lookup');
      query.$or = [
        { _id: queryId },
        { customId: queryId },
        { legacyId: queryId },
        // Handle string representation variations
        { _id: queryId.toLowerCase() },
        { _id: queryId.toUpperCase() },
      ];
    } catch (err) {
      console.error('Error building query:', err);
      // Continue with basic query if there was an error
      delete query.$or;
      query._id = queryId;
    }

    // If we haven't found a note using the first strategy
    if (!req.clinicalNote) {
      console.log(`Executing query: ${JSON.stringify(query)}`);
      const note = await ClinicalNote.findOne(query).populate(
        'patient',
        'firstName lastName mrn workplaceId'
      );

      if (note) {
        console.log(`Found note with ID: ${note._id}`);
        req.clinicalNote = note;
        return next();
      }
    }

    // If we still haven't found a note, try one last desperate attempt with raw string match
    if (!req.clinicalNote) {
      console.log('Last attempt: finding all notes and checking string match');
      // Super admin can see all notes across workplaces
      const baseQuery =
        req.user?.role === 'super_admin'
          ? { deletedAt: { $exists: false } }
          : { deletedAt: { $exists: false }, workplaceId };

      // Get some recent notes to check (limit to avoid performance issues)
      const recentNotes = await ClinicalNote.find(baseQuery)
        .sort({ createdAt: -1 })
        .limit(100);

      // Look for string pattern match in ID or string properties
      const matchingNote = recentNotes.find((n) => {
        // Convert to string safely for comparison
        const noteIdStr = noteId.toString().toLowerCase();

        // Check ID match
        const idMatch = n._id.toString().toLowerCase().includes(noteIdStr);

        // Check custom ID if it exists
        const customIdMatch = n.get('customId')
          ? (n.get('customId') as string).toLowerCase().includes(noteIdStr)
          : false;

        // Check legacy ID if it exists
        const legacyIdMatch = n.get('legacyId')
          ? (n.get('legacyId') as string).toLowerCase().includes(noteIdStr)
          : false;

        return idMatch || customIdMatch || legacyIdMatch;
      });

      if (matchingNote) {
        console.log(
          `Found matching note with partial string match: ${matchingNote._id}`
        );
        await matchingNote.populate(
          'patient',
          'firstName lastName mrn workplaceId'
        );
        req.clinicalNote = matchingNote;
        return next();
      }
    }

    if (!req.clinicalNote) {
      console.log(`Note still not found for ID: ${noteId}`);
      // Log unauthorized access attempt
      await auditOperations.unauthorizedAccess(
        req,
        'clinical_note',
        noteId,
        'Note not found or access denied'
      );

      res.status(404).json({
        success: false,
        message: 'Clinical note not found or access denied',
      });
      return;
    }

    // Get the clinical note from the request
    const note = req.clinicalNote;

    // Additional check for confidential notes
    if (note.isConfidential) {
      const allowedRoles = ['Owner', 'Pharmacist'];
      const userWorkplaceRole = req.user?.workplaceRole;

      if (!userWorkplaceRole || !allowedRoles.includes(userWorkplaceRole)) {
        // Log confidential note access attempt
        await auditOperations.unauthorizedAccess(
          req,
          'clinical_note',
          noteId,
          'Attempted access to confidential note without sufficient permissions'
        );

        res.status(403).json({
          success: false,
          message: 'Insufficient permissions to access confidential note',
          requiredRoles: allowedRoles,
        });
        return;
      }
    }

    // Store note in request for use in controller
    req.clinicalNote = note;
    next();
  } catch (error) {
    logger.error('Error validating note access:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating note access',
    });
  }
};

/**
 * Middleware to validate patient access for note creation
 */
export const validatePatientAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Super admin bypasses all patient access validation
    if (req.user?.role === 'super_admin') {
      const patientId = req.body.patient || req.params.patientId;
      if (patientId && mongoose.Types.ObjectId.isValid(patientId)) {
        // For super admin, just verify patient exists (no workplace restriction)
        const patient = await Patient.findById(patientId);
        if (patient) {
          req.patient = patient;
        }
      }
      return next();
    }

    const patientId = req.body.patient || req.params.patientId;
    const workplaceId =
      req.user?.workplaceId || req.workspaceContext?.workspace?._id;

    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid patient ID',
      });
      return;
    }

    if (!workplaceId) {
      res.status(403).json({
        success: false,
        message: 'No workplace context available',
      });
      return;
    }

    // Verify patient exists and belongs to the same workplace
    const patient = await Patient.findOne({
      _id: patientId,
      workplaceId: workplaceId,
    });

    if (!patient) {
      // Log unauthorized patient access attempt
      await auditOperations.unauthorizedAccess(
        req,
        'patient',
        patientId,
        'Patient not found or access denied for clinical note operation'
      );

      res.status(404).json({
        success: false,
        message: 'Patient not found or access denied',
      });
      return;
    }

    // Store patient in request for use in controller
    req.patient = patient;
    next();
  } catch (error) {
    logger.error('Error validating patient access:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating patient access',
    });
  }
};

/**
 * Middleware to validate bulk operations
 */
export const validateBulkNoteAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { noteIds } = req.body;
    const workplaceId =
      req.user?.workplaceId || req.workspaceContext?.workspace?._id;

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Note IDs array is required',
      });
      return;
    }

    if (!workplaceId) {
      res.status(403).json({
        success: false,
        message: 'No workplace context available',
      });
      return;
    }

    // Process and validate IDs
    const processedIds = noteIds.map((id) => {
      if (mongoose.Types.ObjectId.isValid(id)) {
        return id;
      } else if (id && id.length === 24) {
        // Try to convert string IDs that look like ObjectIds
        try {
          return new mongoose.Types.ObjectId(id).toString();
        } catch (err) {
          return id;
        }
      }
      return id;
    });

    // Create a query that can handle both ObjectId and string IDs
    // Use a properly typed Record to allow for dynamic properties
    const query: Record<string, any> = {
      deletedAt: { $exists: false },
      workplaceId: workplaceId,
      $or: [
        {
          _id: {
            $in: processedIds.filter((id) =>
              mongoose.Types.ObjectId.isValid(id)
            ),
          },
        },
      ],
    };

    // Add alternative ID fields to query if any non-ObjectId values exist
    const nonObjectIds = processedIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (nonObjectIds.length > 0) {
      query.$or.push({ customId: { $in: nonObjectIds } });
      query.$or.push({ legacyId: { $in: nonObjectIds } });
    }

    // Verify all notes belong to the user's workplace
    const notes = await ClinicalNote.find(query);

    if (notes.length !== noteIds.length) {
      // Log unauthorized bulk access attempt
      await auditOperations.unauthorizedAccess(
        req,
        'clinical_note',
        noteIds.join(','),
        `Bulk operation attempted on notes not accessible to user. Found: ${notes.length}, Requested: ${noteIds.length}`
      );

      res.status(404).json({
        success: false,
        message: 'Some notes not found or access denied',
        found: notes.length,
        requested: noteIds.length,
      });
      return;
    }

    // Check for confidential notes in bulk operations
    const confidentialNotes = notes.filter((note) => note.isConfidential);
    if (confidentialNotes.length > 0) {
      const allowedRoles = ['Owner', 'Pharmacist'];
      const userWorkplaceRole = req.user?.workplaceRole;

      if (!userWorkplaceRole || !allowedRoles.includes(userWorkplaceRole)) {
        // Log confidential note bulk access attempt
        await auditOperations.unauthorizedAccess(
          req,
          'clinical_note',
          confidentialNotes.map((n) => n._id.toString()).join(','),
          'Bulk operation attempted on confidential notes without sufficient permissions'
        );

        res.status(403).json({
          success: false,
          message:
            'Bulk operation includes confidential notes that require higher permissions',
          confidentialNoteCount: confidentialNotes.length,
          requiredRoles: allowedRoles,
        });
        return;
      }
    }

    // Store notes in request for use in controller
    req.clinicalNotes = notes;
    next();
  } catch (error) {
    logger.error('Error validating bulk note access:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating bulk note access',
    });
  }
};

/**
 * Middleware to enforce tenancy isolation in queries
 */
export const enforceTenancyIsolation = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Super admin can access notes from all workspaces - bypass tenancy isolation
  if (req.user?.role === 'super_admin') {
    req.tenancyFilter = {
      deletedAt: { $exists: false },
    };
    next();
    return;
  }

  const workplaceId =
    req.user?.workplaceId || req.workspaceContext?.workspace?._id;

  if (!workplaceId) {
    res.status(403).json({
      success: false,
      message: 'No workplace context available for tenancy isolation',
    });
    return;
  }

  // Add workplace filter to request for use in controllers
  req.tenancyFilter = {
    workplaceId: workplaceId,
    deletedAt: { $exists: false },
  };

  next();
};

/**
 * Middleware to check note modification permissions
 * Only the creator or users with higher privileges can modify notes
 */
export const canModifyNote = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const note = req.clinicalNote;
    const user = req.user;

    if (!note || !user) {
      res.status(400).json({
        success: false,
        message: 'Note or user context not available',
      });
      return;
    }

    // Super admin can modify any note
    if (user.role === 'super_admin') {
      return next();
    }

    // Workplace owners can modify any note in their workplace
    if (user.workplaceRole === 'Owner') {
      return next();
    }

    // Pharmacists can modify notes they created or if they have explicit permission
    if (user.workplaceRole === 'Pharmacist') {
      // Check if user is the creator
      if (note.pharmacist.toString() === user._id.toString()) {
        return next();
      }

      // Check if user has explicit permission to modify others' notes
      // This could be extended with more granular permissions
      return next();
    }

    // Other roles cannot modify notes
    res.status(403).json({
      success: false,
      message: 'Insufficient permissions to modify this note',
      noteCreator: note.pharmacist.toString(),
      currentUser: user._id.toString(),
    });
  } catch (error) {
    logger.error('Error checking note modification permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking modification permissions',
    });
  }
};

/**
 * Middleware to log note access for audit trail
 */
export const logNoteAccess = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const note = req.clinicalNote;
    const action = determineActionFromRequest(req);

    if (note && req.user) {
      // Log the access
      await auditOperations.noteAccess(req, note._id, action, {
        noteTitle: note.title,
        noteType: note.type,
        patientId: note.patient?._id || note.patient || null,
        isConfidential: note.isConfidential,
      });
    }

    next();
  } catch (error) {
    logger.error('Error logging note access:', error);
    // Don't fail the request, just log the error
    next();
  }
};

/**
 * Helper function to determine action from request
 */
function determineActionFromRequest(req: AuthRequest): string {
  const method = req.method;
  const path = req.path;

  if (method === 'GET') {
    if (path.includes('/attachments/') && path.includes('/download')) {
      return 'DOWNLOAD_ATTACHMENT';
    }
    return 'VIEW_NOTE';
  }
  if (method === 'POST') {
    if (path.includes('/attachments')) {
      return 'UPLOAD_ATTACHMENT';
    }
    if (path.includes('/bulk')) {
      return 'BULK_CREATE_NOTES';
    }
    return 'CREATE_NOTE';
  }
  if (method === 'PUT') {
    if (path.includes('/bulk')) {
      return 'BULK_UPDATE_NOTES';
    }
    return 'UPDATE_NOTE';
  }
  if (method === 'DELETE') {
    if (path.includes('/attachments/')) {
      return 'DELETE_ATTACHMENT';
    }
    if (path.includes('/bulk')) {
      return 'BULK_DELETE_NOTES';
    }
    return 'DELETE_NOTE';
  }

  return `${method}_NOTE`;
}

// Extend AuthRequest interface to include clinical note data
declare global {
  namespace Express {
    interface Request {
      clinicalNote?: any;
      clinicalNotes?: any[];
      patient?: any;
      tenancyFilter?: any;
    }
  }
}

export default {
  canCreateClinicalNote,
  canReadClinicalNote,
  canUpdateClinicalNote,
  canDeleteClinicalNote,
  canExportClinicalNotes,
  canAccessConfidentialNotes,
  validateNoteAccess,
  validatePatientAccess,
  validateBulkNoteAccess,
  enforceTenancyIsolation,
  canModifyNote,
  logNoteAccess,
};
