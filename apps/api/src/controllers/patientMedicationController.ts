import { Request, Response, NextFunction } from 'express';
import { PatientMedicationService } from '../services/PatientMedicationService';
import { MedicationAlertService } from '../services/MedicationAlertService';
import { validationResult } from 'express-validator';

// Extend Request interface to include patient user information
interface PatientAuthRequest extends Request {
  patientUser?: {
    _id: string;
    patientId: string;
    workplaceId: string;
    email: string;
    status: string;
  };
}

export class PatientMedicationController {
  /**
   * Get current active medications for the authenticated patient
   * GET /api/patient-portal/medications/current
   */
  static async getCurrentMedications(
    req: PatientAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.patientUser) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { patientId, workplaceId } = req.patientUser;

      const medications = await PatientMedicationService.getCurrentMedications(
        patientId,
        workplaceId
      );

      res.status(200).json({
        success: true,
        data: {
          medications,
          count: medications.length
        },
        message: 'Current medications retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting current medications:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('access denied')) {
          res.status(404).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve current medications'
      });
    }
  }

  /**
   * Get medication history for the authenticated patient
   * GET /api/patient-portal/medications/history
   */
  static async getMedicationHistory(
    req: PatientAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.patientUser) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { patientId, workplaceId } = req.patientUser;
      const limit = parseInt(req.query.limit as string) || 50;
      const page = parseInt(req.query.page as string) || 1;
      const skip = (page - 1) * limit;

      const medications = await PatientMedicationService.getMedicationHistory(
        patientId,
        workplaceId,
        limit
      );

      res.status(200).json({
        success: true,
        data: {
          medications,
          pagination: {
            page,
            limit,
            total: medications.length,
            hasMore: medications.length === limit
          }
        },
        message: 'Medication history retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting medication history:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('access denied')) {
          res.status(404).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve medication history'
      });
    }
  }

  /**
   * Get detailed information about a specific medication
   * GET /api/patient-portal/medications/:medicationId
   */
  static async getMedicationDetails(
    req: PatientAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.patientUser) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { patientId, workplaceId } = req.patientUser;
      const { medicationId } = req.params;

      if (!medicationId) {
        res.status(400).json({
          success: false,
          message: 'Medication ID is required'
        });
        return;
      }

      const medication = await PatientMedicationService.getMedicationDetails(
        patientId,
        medicationId,
        workplaceId
      );

      res.status(200).json({
        success: true,
        data: { medication },
        message: 'Medication details retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting medication details:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('access denied')) {
          res.status(404).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve medication details'
      });
    }
  }

  /**
   * Get adherence data for the authenticated patient
   * GET /api/patient-portal/medications/adherence
   */
  static async getAdherenceData(
    req: PatientAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.patientUser) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { patientId, workplaceId } = req.patientUser;

      const adherenceData = await PatientMedicationService.getAdherenceData(
        patientId,
        workplaceId
      );

      if (!adherenceData) {
        res.status(200).json({
          success: true,
          data: {
            adherenceData: null,
            message: 'No adherence tracking data available'
          },
          message: 'Adherence data retrieved successfully'
        });
        return;
      }

      // Generate adherence report
      const adherenceReport = adherenceData.generateAdherenceReport();

      res.status(200).json({
        success: true,
        data: {
          adherenceData: adherenceReport,
          riskLevel: adherenceData.assessAdherenceRisk(),
          activeAlerts: adherenceData.activeAlerts,
          criticalAlerts: adherenceData.criticalAlerts
        },
        message: 'Adherence data retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting adherence data:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('access denied')) {
          res.status(404).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve adherence data'
      });
    }
  }

  /**
   * Update adherence score for a medication
   * PUT /api/patient-portal/medications/:medicationId/adherence
   */
  static async updateAdherenceScore(
    req: PatientAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      if (!req.patientUser) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { patientId, workplaceId } = req.patientUser;
      const { medicationId } = req.params;
      const { adherenceScore } = req.body;

      if (!medicationId) {
        res.status(400).json({
          success: false,
          message: 'Medication ID is required'
        });
        return;
      }

      if (typeof adherenceScore !== 'number' || adherenceScore < 0 || adherenceScore > 100) {
        res.status(400).json({
          success: false,
          message: 'Adherence score must be a number between 0 and 100'
        });
        return;
      }

      await PatientMedicationService.updateAdherenceScore(
        patientId,
        medicationId,
        adherenceScore,
        workplaceId
      );

      res.status(200).json({
        success: true,
        message: 'Adherence score updated successfully'
      });
    } catch (error) {
      console.error('Error updating adherence score:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update adherence score'
      });
    }
  }

  /**
   * Request a medication refill
   * POST /api/patient-portal/medications/refill-requests
   */
  static async requestRefill(
    req: PatientAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      if (!req.patientUser) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { patientId, workplaceId, _id: patientUserId } = req.patientUser;
      const { medicationId, requestedQuantity, urgency, patientNotes, estimatedPickupDate } = req.body;

      // Validate required fields
      if (!medicationId || !requestedQuantity) {
        res.status(400).json({
          success: false,
          message: 'Medication ID and requested quantity are required'
        });
        return;
      }

      // Check refill eligibility first
      const eligibility = await PatientMedicationService.checkRefillEligibility(
        patientId,
        medicationId,
        workplaceId
      );

      if (!eligibility.isEligible) {
        res.status(400).json({
          success: false,
          message: eligibility.reason || 'Refill request not eligible',
          data: {
            refillsRemaining: eligibility.refillsRemaining,
            nextEligibleDate: eligibility.nextEligibleDate
          }
        });
        return;
      }

      const refillRequestData = {
        medicationId,
        requestedQuantity: parseInt(requestedQuantity),
        urgency: urgency || 'routine',
        patientNotes,
        estimatedPickupDate: estimatedPickupDate ? new Date(estimatedPickupDate) : undefined
      };

      const refillTask = await PatientMedicationService.requestRefill(
        patientId,
        workplaceId,
        refillRequestData,
        patientUserId
      );

      res.status(201).json({
        success: true,
        data: {
          refillRequest: {
            id: refillTask._id,
            status: refillTask.status,
            priority: refillTask.priority,
            dueDate: refillTask.dueDate,
            medicationName: refillTask.metadata?.refillRequest?.medicationName,
            requestedQuantity: refillTask.metadata?.refillRequest?.requestedQuantity,
            urgency: refillTask.metadata?.refillRequest?.urgency,
            createdAt: refillTask.createdAt
          }
        },
        message: 'Refill request submitted successfully'
      });
    } catch (error) {
      console.error('Error requesting refill:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('not active')) {
          res.status(404).json({
            success: false,
            message: error.message
          });
          return;
        }
        
        if (error.message.includes('No refills remaining') || 
            error.message.includes('already pending')) {
          res.status(400).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to submit refill request'
      });
    }
  }

  /**
   * Get refill requests for the authenticated patient
   * GET /api/patient-portal/medications/refill-requests
   */
  static async getRefillRequests(
    req: PatientAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.patientUser) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { patientId, workplaceId } = req.patientUser;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;

      const refillRequests = await PatientMedicationService.getRefillRequests(
        patientId,
        workplaceId,
        limit
      );

      // Filter by status if provided
      let filteredRequests = refillRequests;
      if (status) {
        filteredRequests = refillRequests.filter(request => request.status === status);
      }

      // Format response data
      const formattedRequests = filteredRequests.map(request => ({
        id: request._id,
        status: request.status,
        priority: request.priority,
        dueDate: request.dueDate,
        createdAt: request.createdAt,
        completedAt: request.completedAt,
        pharmacist: request.assignedTo,
        medication: {
          id: request.metadata?.refillRequest?.medicationId,
          name: request.metadata?.refillRequest?.medicationName,
          requestedQuantity: request.metadata?.refillRequest?.requestedQuantity,
          approvedQuantity: request.metadata?.refillRequest?.approvedQuantity,
          urgency: request.metadata?.refillRequest?.urgency
        },
        notes: {
          patient: request.metadata?.refillRequest?.patientNotes,
          pharmacist: request.metadata?.refillRequest?.pharmacistNotes
        },
        outcome: request.outcome,
        denialReason: request.metadata?.refillRequest?.denialReason
      }));

      res.status(200).json({
        success: true,
        data: {
          refillRequests: formattedRequests,
          count: formattedRequests.length,
          summary: {
            pending: filteredRequests.filter(r => r.status === 'pending').length,
            inProgress: filteredRequests.filter(r => r.status === 'in_progress').length,
            completed: filteredRequests.filter(r => r.status === 'completed').length,
            cancelled: filteredRequests.filter(r => r.status === 'cancelled').length
          }
        },
        message: 'Refill requests retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting refill requests:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('access denied')) {
          res.status(404).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve refill requests'
      });
    }
  }

  /**
   * Cancel a refill request
   * DELETE /api/patient-portal/medications/refill-requests/:requestId
   */
  static async cancelRefillRequest(
    req: PatientAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.patientUser) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { patientId, workplaceId } = req.patientUser;
      const { requestId } = req.params;

      if (!requestId) {
        res.status(400).json({
          success: false,
          message: 'Request ID is required'
        });
        return;
      }

      await PatientMedicationService.cancelRefillRequest(
        patientId,
        requestId,
        workplaceId
      );

      res.status(200).json({
        success: true,
        message: 'Refill request cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling refill request:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('cannot be cancelled')) {
          res.status(404).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to cancel refill request'
      });
    }
  }

  /**
   * Check refill eligibility for a medication
   * GET /api/patient-portal/medications/:medicationId/refill-eligibility
   */
  static async checkRefillEligibility(
    req: PatientAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.patientUser) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { patientId, workplaceId } = req.patientUser;
      const { medicationId } = req.params;

      if (!medicationId) {
        res.status(400).json({
          success: false,
          message: 'Medication ID is required'
        });
        return;
      }

      const eligibility = await PatientMedicationService.checkRefillEligibility(
        patientId,
        medicationId,
        workplaceId
      );

      res.status(200).json({
        success: true,
        data: { eligibility },
        message: 'Refill eligibility checked successfully'
      });
    } catch (error) {
      console.error('Error checking refill eligibility:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('access denied')) {
          res.status(404).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to check refill eligibility'
      });
    }
  }

  /**
   * Set medication reminders
   * POST /api/patient-portal/medications/:medicationId/reminders
   */
  static async setMedicationReminders(
    req: PatientAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
        return;
      }

      if (!req.patientUser) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { patientId, workplaceId } = req.patientUser;
      const { medicationId } = req.params;
      const { reminderTimes, isActive } = req.body;

      if (!medicationId) {
        res.status(400).json({
          success: false,
          message: 'Medication ID is required'
        });
        return;
      }

      if (!Array.isArray(reminderTimes)) {
        res.status(400).json({
          success: false,
          message: 'Reminder times must be an array'
        });
        return;
      }

      // Validate time format (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      for (const time of reminderTimes) {
        if (!timeRegex.test(time)) {
          res.status(400).json({
            success: false,
            message: `Invalid time format: ${time}. Use HH:MM format (e.g., 08:00)`
          });
          return;
        }
      }

      await PatientMedicationService.setMedicationReminders(
        patientId,
        medicationId,
        { reminderTimes, isActive: Boolean(isActive) },
        workplaceId
      );

      res.status(200).json({
        success: true,
        message: 'Medication reminders set successfully'
      });
    } catch (error) {
      console.error('Error setting medication reminders:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          res.status(404).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to set medication reminders'
      });
    }
  }

  /**
   * Get medication reminders
   * GET /api/patient-portal/medications/reminders
   */
  static async getMedicationReminders(
    req: PatientAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.patientUser) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { patientId, workplaceId } = req.patientUser;

      const reminders = await PatientMedicationService.getMedicationReminders(
        patientId,
        workplaceId
      );

      res.status(200).json({
        success: true,
        data: {
          reminders,
          count: reminders.length,
          activeCount: reminders.filter(r => r.isActive).length
        },
        message: 'Medication reminders retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting medication reminders:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('not found') || error.message.includes('access denied')) {
          res.status(404).json({
            success: false,
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        success: false,
        message: 'Failed to retrieve medication reminders'
      });
    }
  }

  /**
   * Get medication alerts for the authenticated patient
   * GET /api/patient-portal/medications/alerts
   */
  static async getMedicationAlerts(
    req: PatientAuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.patientUser) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const { patientId, workplaceId } = req.patientUser;
      const severity = req.query.severity as string;

      const alerts = await MedicationAlertService.getPatientMedicationAlerts(
        patientId,
        workplaceId
      );

      // Filter by severity if provided
      let filteredAlerts = alerts;
      if (severity) {
        filteredAlerts = alerts.filter(alert => alert.severity === severity);
      }

      res.status(200).json({
        success: true,
        data: {
          alerts: filteredAlerts,
          count: filteredAlerts.length,
          summary: {
            critical: alerts.filter(a => a.severity === 'critical').length,
            high: alerts.filter(a => a.severity === 'high').length,
            medium: alerts.filter(a => a.severity === 'medium').length,
            low: alerts.filter(a => a.severity === 'low').length
          }
        },
        message: 'Medication alerts retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting medication alerts:', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve medication alerts'
      });
    }
  }
}