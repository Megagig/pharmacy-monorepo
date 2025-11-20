import express, { Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { auth } from '../middlewares/auth';
import { chatService } from '../services/chat/ChatService';
import logger from '../utils/logger';

const router = express.Router();

/**
 * @route   POST /api/chat/prescription-discussions
 * @desc    Create a prescription discussion
 * @access  Private
 */
router.post(
  '/',
  auth,
  [
    body('prescriptionId').isMongoId().withMessage('Valid prescription ID is required'),
    body('patientId').isMongoId().withMessage('Valid patient ID is required'),
    body('doctorId').isMongoId().withMessage('Valid doctor ID is required'),
    body('prescriptionDetails').optional().isObject().withMessage('Prescription details must be an object'),
    body('prescriptionDetails.medicationName').optional().isString(),
    body('prescriptionDetails.rxNumber').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { prescriptionId, patientId, doctorId, prescriptionDetails } = req.body;
      const pharmacistId = (req as any).user.userId;
      const workplaceId = (req as any).user.workplaceId;

      const conversation = await chatService.createPrescriptionDiscussion(
        prescriptionId,
        patientId,
        doctorId,
        pharmacistId,
        workplaceId,
        prescriptionDetails
      );

      res.status(201).json({
        success: true,
        data: conversation,
        message: 'Prescription discussion created successfully',
      });
    } catch (error) {
      logger.error('Error creating prescription discussion', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to create prescription discussion',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   POST /api/chat/prescription-discussions/:id/update
 * @desc    Post prescription update to discussion
 * @access  Private
 */
router.post(
  '/:id/update',
  auth,
  [
    param('id').isMongoId().withMessage('Valid prescription ID is required'),
    body('field').isString().withMessage('Update field is required'),
    body('oldValue').optional().isString(),
    body('newValue').isString().withMessage('New value is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { id: prescriptionId } = req.params;
      const { field, oldValue, newValue } = req.body;
      const updatedBy = (req as any).user.userId;
      const workplaceId = (req as any).user.workplaceId;

      await chatService.postPrescriptionUpdate(prescriptionId, workplaceId, {
        field,
        oldValue,
        newValue,
        updatedBy,
      });

      res.json({
        success: true,
        message: 'Prescription update posted successfully',
      });
    } catch (error) {
      logger.error('Error posting prescription update', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to post prescription update',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   POST /api/chat/prescription-discussions/:conversationId/resolve
 * @desc    Resolve prescription discussion
 * @access  Private
 */
router.post(
  '/:conversationId/resolve',
  auth,
  [
    param('conversationId').isMongoId().withMessage('Valid conversation ID is required'),
    body('resolutionNote').optional().isString().withMessage('Resolution note must be a string'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { conversationId } = req.params;
      const { resolutionNote } = req.body;
      const userId = (req as any).user.userId;
      const workplaceId = (req as any).user.workplaceId;

      const conversation = await chatService.resolvePrescriptionDiscussion(
        conversationId,
        userId,
        workplaceId,
        resolutionNote
      );

      res.json({
        success: true,
        data: conversation,
        message: 'Prescription discussion resolved successfully',
      });
    } catch (error) {
      logger.error('Error resolving prescription discussion', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to resolve prescription discussion',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/prescription-discussions/prescription/:prescriptionId
 * @desc    Get prescription discussion by prescription ID
 * @access  Private
 */
router.get(
  '/prescription/:prescriptionId',
  auth,
  [param('prescriptionId').isMongoId().withMessage('Valid prescription ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const { prescriptionId } = req.params;
      const userId = (req as any).user.userId;
      const workplaceId = (req as any).user.workplaceId;

      // Get conversations filtered by prescription ID
      const conversations = await chatService.getConversations(userId, workplaceId, {
        type: 'prescription_discussion',
      });

      // Filter by prescription ID (since getConversations doesn't support this filter directly)
      const prescriptionConversation = conversations.find(
        (conv: any) => conv.prescriptionId?.toString() === prescriptionId
      );

      if (!prescriptionConversation) {
        return res.status(404).json({
          success: false,
          message: 'Prescription discussion not found',
        });
      }

      res.json({
        success: true,
        data: prescriptionConversation,
      });
    } catch (error) {
      logger.error('Error getting prescription discussion', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get prescription discussion',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
