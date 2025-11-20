import { IUser } from '../models/User';
import ClinicalNote from '../models/ClinicalNote';
import Medication from '../models/Medication';
import { auditOperations } from '../middlewares/auditLogging';
import { AuthRequest } from '../types/auth';
import logger from '../utils/logger';
import mongoose from 'mongoose';

/**
 * Service for handling confidential clinical notes
 * Provides additional privacy controls and access logging
 */
class ConfidentialNoteService {
  private static instance: ConfidentialNoteService;

  private constructor() {}

  public static getInstance(): ConfidentialNoteService {
    if (!ConfidentialNoteService.instance) {
      ConfidentialNoteService.instance = new ConfidentialNoteService();
    }
    return ConfidentialNoteService.instance;
  }

  /**
   * Check if user can access confidential notes
   */
  public canAccessConfidentialNotes(user: IUser): boolean {
    // Only owners and pharmacists can access confidential notes
    const allowedRoles = ['Owner', 'Pharmacist'];
    return allowedRoles.includes(user.workplaceRole || '');
  }

  /**
   * Check if user can create confidential notes
   */
  public canCreateConfidentialNotes(user: IUser): boolean {
    // Only owners and pharmacists can create confidential notes
    const allowedRoles = ['Owner', 'Pharmacist'];
    return allowedRoles.includes(user.workplaceRole || '');
  }

  /**
   * Check if user can modify a specific confidential note
   */
  public canModifyConfidentialNote(user: IUser, note: any): boolean {
    // Super admin can modify any note
    if (user.role === 'super_admin') {
      return true;
    }

    // Workplace owners can modify any confidential note in their workplace
    if (user.workplaceRole === 'Owner') {
      return true;
    }

    // Pharmacists can only modify confidential notes they created
    if (user.workplaceRole === 'Pharmacist') {
      return note.pharmacist.toString() === user._id.toString();
    }

    return false;
  }

  /**
   * Apply confidential note filters to query
   */
  public applyConfidentialFilters(
    query: any,
    user: IUser,
    includeConfidential?: boolean
  ): any {
    const canAccess = this.canAccessConfidentialNotes(user);

    if (includeConfidential === true) {
      // User explicitly wants confidential notes
      if (!canAccess) {
        throw new Error(
          'Insufficient permissions to access confidential notes'
        );
      }
      query.isConfidential = true;
    } else if (includeConfidential === false) {
      // User explicitly excludes confidential notes
      query.isConfidential = { $ne: true };
    } else {
      // No specific filter - apply based on permissions
      if (!canAccess) {
        query.isConfidential = { $ne: true };
      }
      // If user can access, include all notes (no filter)
    }

    return query;
  }

  /**
   * Log confidential note access
   */
  public async logConfidentialAccess(
    req: AuthRequest,
    noteId: string,
    action: string,
    details?: any
  ): Promise<void> {
    try {
      await auditOperations.confidentialDataAccess(
        req,
        'ClinicalNote',
        noteId,
        action,
        {
          ...details,
          confidentialityReason:
            'Clinical documentation contains sensitive patient information',
          accessLevel: 'confidential',
          dataClassification: 'restricted',
        }
      );
    } catch (error) {
      logger.error('Failed to log confidential note access:', error);
    }
  }

  /**
   * Sanitize confidential note data for audit logs
   */
  public sanitizeForAudit(noteData: any): any {
    if (!noteData.isConfidential) {
      return noteData;
    }

    return {
      ...noteData,
      content: {
        subjective: '[CONFIDENTIAL_CONTENT]',
        objective: '[CONFIDENTIAL_CONTENT]',
        assessment: '[CONFIDENTIAL_CONTENT]',
        plan: '[CONFIDENTIAL_CONTENT]',
      },
      recommendations: ['[CONFIDENTIAL_RECOMMENDATIONS]'],
      // Keep non-sensitive metadata
      type: noteData.type,
      priority: noteData.priority,
      isConfidential: noteData.isConfidential,
      createdAt: noteData.createdAt,
      updatedAt: noteData.updatedAt,
    };
  }

  /**
   * Get confidential notes statistics for a workplace
   */
  public async getConfidentialNotesStats(
    workplaceId: string,
    user: IUser
  ): Promise<any> {
    if (!this.canAccessConfidentialNotes(user)) {
      throw new Error(
        'Insufficient permissions to view confidential notes statistics'
      );
    }

    const stats = await ClinicalNote.aggregate([
      {
        $match: {
          workplaceId: new mongoose.Types.ObjectId(workplaceId),
          isConfidential: true,
          deletedAt: { $exists: false },
        },
      },
      {
        $group: {
          _id: null,
          totalConfidentialNotes: { $sum: 1 },
          notesByType: { $push: '$type' },
          notesByPriority: { $push: '$priority' },
          uniquePatients: { $addToSet: '$patient' },
          uniquePharmacists: { $addToSet: '$pharmacist' },
          recentNotes: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    '$createdAt',
                    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalConfidentialNotes: 0,
      notesByType: [],
      notesByPriority: [],
      uniquePatients: [],
      uniquePharmacists: [],
      recentNotes: 0,
    };

    // Count by type and priority
    const typeCount = result.notesByType.reduce((acc: any, type: string) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const priorityCount = result.notesByPriority.reduce(
      (acc: any, priority: string) => {
        acc[priority] = (acc[priority] || 0) + 1;
        return acc;
      },
      {}
    );

    return {
      totalConfidentialNotes: result.totalConfidentialNotes,
      typeDistribution: typeCount,
      priorityDistribution: priorityCount,
      uniquePatientCount: result.uniquePatients.length,
      uniquePharmacistCount: result.uniquePharmacists.length,
      recentNotesCount: result.recentNotes,
    };
  }

  /**
   * Validate confidential note creation data
   */
  public validateConfidentialNoteData(
    noteData: any,
    user: IUser
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if user can create confidential notes
    if (!this.canCreateConfidentialNotes(user)) {
      errors.push('Insufficient permissions to create confidential notes');
    }

    // Validate required fields for confidential notes
    if (!noteData.title || noteData.title.trim().length === 0) {
      errors.push('Title is required for confidential notes');
    }

    if (!noteData.content || Object.keys(noteData.content).length === 0) {
      errors.push('Content is required for confidential notes');
    }

    // Validate confidentiality justification
    if (!noteData.confidentialityReason) {
      errors.push('Confidentiality reason is required for confidential notes');
    }

    // Validate priority for confidential notes (should be medium or high)
    if (noteData.priority && !['medium', 'high'].includes(noteData.priority)) {
      errors.push('Confidential notes must have medium or high priority');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Apply additional security measures for confidential notes
   */
  public applyConfidentialSecurity(noteData: any): any {
    if (!noteData.isConfidential) {
      return noteData;
    }

    return {
      ...noteData,
      // Ensure minimum security settings
      priority: noteData.priority || 'medium',
      followUpRequired: noteData.followUpRequired !== false, // Default to true for confidential notes
      // Add confidentiality metadata
      confidentialityLevel: 'high',
      accessRestrictions: {
        requiresJustification: true,
        auditAllAccess: true,
        restrictedRoles: ['Owner', 'Pharmacist'],
      },
    };
  }

  /**
   * Check if note access requires additional justification
   */
  public requiresAccessJustification(
    note: any,
    user: IUser,
    action: string
  ): boolean {
    if (!note.isConfidential) {
      return false;
    }

    // Always require justification for confidential note access
    // except for the creator viewing their own notes
    if (
      action === 'VIEW' &&
      note.pharmacist.toString() === user._id.toString()
    ) {
      return false;
    }

    return true;
  }

  /**
   * Generate access justification prompt
   */
  public getAccessJustificationPrompt(note: any, action: string): string {
    const actionText = action.toLowerCase();
    return (
      `Please provide justification for ${actionText} this confidential clinical note. ` +
      `This access will be logged for compliance and audit purposes.`
    );
  }
}

export default ConfidentialNoteService;
