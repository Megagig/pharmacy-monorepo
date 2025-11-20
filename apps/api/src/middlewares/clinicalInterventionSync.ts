import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import ClinicalIntervention, { IClinicalIntervention } from '../models/ClinicalIntervention';
import { engagementIntegrationService } from '../services/EngagementIntegrationService';
import logger from '../utils/logger';

/**
 * Middleware to handle clinical intervention events and create follow-up tasks
 */
export const clinicalInterventionSyncMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Only process POST and PUT requests
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    // Only process clinical intervention routes
    if (!req.path.includes('/clinical-interventions')) {
      return next();
    }

    // Store original response data for post-processing
    const originalSend = res.send;
    let responseData: any;

    res.send = function (data: any) {
      responseData = data;
      return originalSend.call(this, data);
    };

    // Continue with the request
    res.on('finish', async () => {
      try {
        // Only process successful responses
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return;
        }

        // Parse response data
        let parsedData;
        try {
          parsedData = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        } catch (error) {
          logger.warn('Failed to parse response data for intervention sync', { error: error.message });
          return;
        }

        // Extract intervention data
        const intervention = parsedData?.data?.intervention || parsedData?.data;
        if (!intervention || !intervention._id) {
          return;
        }

        // Check if this is a new intervention or an update that requires follow-up
        const shouldCreateFollowUp = await checkIfFollowUpRequired(intervention, req.method);
        
        if (shouldCreateFollowUp) {
          await createFollowUpForIntervention(intervention, req);
        }
      } catch (error) {
        // Log error but don't fail the response
        logger.error('Error in clinical intervention sync middleware', {
          error: error.message,
          path: req.path,
          method: req.method,
        });
      }
    });

    next();
  } catch (error) {
    logger.error('Error in clinical intervention sync middleware setup', {
      error: error.message,
      path: req.path,
    });
    next();
  }
};

/**
 * Check if follow-up is required for the intervention
 */
async function checkIfFollowUpRequired(
  interventionData: any,
  method: string
): Promise<boolean> {
  try {
    // For new interventions (POST), check if follow-up is required
    if (method === 'POST') {
      return interventionData.followUp?.required === true;
    }

    // For updates (PUT/PATCH), check if follow-up requirement changed
    if (method === 'PUT' || method === 'PATCH') {
      const currentIntervention = await ClinicalIntervention.findById(interventionData._id);
      if (!currentIntervention) {
        return false;
      }

      // Check if follow-up was just enabled
      const wasFollowUpRequired = currentIntervention.followUp?.required === true;
      const isFollowUpRequired = interventionData.followUp?.required === true;

      return !wasFollowUpRequired && isFollowUpRequired;
    }

    return false;
  } catch (error) {
    logger.error('Error checking if follow-up is required', {
      error: error.message,
      interventionId: interventionData._id,
    });
    return false;
  }
}

/**
 * Create follow-up task for intervention
 */
async function createFollowUpForIntervention(
  interventionData: any,
  req: Request
): Promise<void> {
  try {
    logger.info('Creating follow-up task for intervention', {
      interventionId: interventionData._id,
      interventionNumber: interventionData.interventionNumber,
    });

    // Get user context from request
    const userId = (req as any).user?.id;
    const workplaceId = (req as any).user?.workplaceId;

    if (!userId || !workplaceId) {
      logger.warn('Missing user context for follow-up creation', {
        interventionId: interventionData._id,
      });
      return;
    }

    // Determine who should be assigned the follow-up
    // Priority: 1. Assigned team member, 2. Identified by user, 3. Current user
    let assignedTo = userId;
    
    if (interventionData.assignments && interventionData.assignments.length > 0) {
      // Find a pharmacist assignment
      const pharmacistAssignment = interventionData.assignments.find(
        (assignment: any) => assignment.role === 'pharmacist' && assignment.status !== 'cancelled'
      );
      if (pharmacistAssignment) {
        assignedTo = pharmacistAssignment.userId;
      }
    } else if (interventionData.identifiedBy) {
      assignedTo = interventionData.identifiedBy;
    }

    // Create follow-up task
    await engagementIntegrationService.createFollowUpFromIntervention({
      interventionId: new mongoose.Types.ObjectId(interventionData._id),
      patientId: new mongoose.Types.ObjectId(interventionData.patientId),
      assignedTo: new mongoose.Types.ObjectId(assignedTo),
      workplaceId: new mongoose.Types.ObjectId(workplaceId),
      locationId: (req as any).user?.locationId,
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    logger.info('Follow-up task created successfully for intervention', {
      interventionId: interventionData._id,
      assignedTo,
    });
  } catch (error) {
    logger.error('Error creating follow-up task for intervention', {
      error: error.message,
      interventionId: interventionData._id,
    });
    // Don't throw error to avoid breaking the main request
  }
}

/**
 * Middleware to handle follow-up task completion and update intervention
 */
export const followUpCompletionSyncMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Only process follow-up completion requests
    if (req.method !== 'POST' || !req.path.includes('/follow-ups') || !req.path.includes('/complete')) {
      return next();
    }

    // Store original response data for post-processing
    const originalSend = res.send;
    let responseData: any;

    res.send = function (data: any) {
      responseData = data;
      return originalSend.call(this, data);
    };

    // Continue with the request
    res.on('finish', async () => {
      try {
        // Only process successful responses
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return;
        }

        // Parse response data
        let parsedData;
        try {
          parsedData = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
        } catch (error) {
          logger.warn('Failed to parse response data for follow-up completion sync', { error: error.message });
          return;
        }

        // Extract follow-up task data
        const followUpTask = parsedData?.data?.task || parsedData?.data;
        if (!followUpTask || !followUpTask._id) {
          return;
        }

        // Check if this follow-up is linked to a clinical intervention
        if (followUpTask.relatedRecords?.clinicalInterventionId) {
          const userId = (req as any).user?.id;
          if (userId) {
            await engagementIntegrationService.updateInterventionFromFollowUp(
              new mongoose.Types.ObjectId(followUpTask._id),
              new mongoose.Types.ObjectId(userId)
            );
          }
        }
      } catch (error) {
        // Log error but don't fail the response
        logger.error('Error in follow-up completion sync middleware', {
          error: error.message,
          path: req.path,
        });
      }
    });

    next();
  } catch (error) {
    logger.error('Error in follow-up completion sync middleware setup', {
      error: error.message,
      path: req.path,
    });
    next();
  }
};

export default {
  clinicalInterventionSyncMiddleware,
  followUpCompletionSyncMiddleware,
};