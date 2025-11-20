import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { auth } from '../middlewares/auth';
import { reminderService } from '../services/chat/ReminderService';
import logger from '../utils/logger';

const router = express.Router();

/**
 * @route   POST /api/chat/reminders
 * @desc    Create a new reminder
 * @access  Private
 */
router.post(
  '/',
  auth,
  [
    body('patientId').isMongoId().withMessage('Valid patient ID is required'),
    body('medicationId').optional().isMongoId().withMessage('Invalid medication ID'),
    body('medicationName').trim().notEmpty().withMessage('Medication name is required'),
    body('dosage').trim().notEmpty().withMessage('Dosage is required'),
    body('instructions').optional().trim().isLength({ max: 500 }),
    body('frequency')
      .isIn(['daily', 'twice_daily', 'three_times_daily', 'weekly', 'custom'])
      .withMessage('Invalid frequency'),
    body('times').isArray({ min: 1 }).withMessage('At least one time is required'),
    body('times.*').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Times must be in HH:MM format'),
    body('daysOfWeek').optional().isArray(),
    body('daysOfWeek.*').optional().isInt({ min: 0, max: 6 }),
    body('customSchedule').optional().trim(),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').optional().isISO8601().withMessage('Invalid end date'),
    body('missedDoseThreshold').optional().isInt({ min: 5, max: 240 }),
    body('notifyPharmacistOnMissed').optional().isBoolean(),
    body('pharmacistId').optional().isMongoId(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const createdBy = (req as any).user.userId;

      const reminder = await reminderService.createReminder({
        ...req.body,
        workplaceId,
        createdBy,
      });

      res.status(201).json({
        success: true,
        data: reminder,
        message: 'Reminder created successfully',
      });
    } catch (error) {
      logger.error('Error creating reminder', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to create reminder',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/reminders
 * @desc    Get reminders with filters
 * @access  Private
 */
router.get(
  '/',
  auth,
  [
    query('patientId').optional().isMongoId(),
    query('isActive').optional().isBoolean(),
    query('isPaused').optional().isBoolean(),
    query('medicationId').optional().isMongoId(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const { patientId, isActive, isPaused, medicationId, startDate, endDate } = req.query;

      const filters: any = {};
      if (patientId) filters.patientId = patientId;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (isPaused !== undefined) filters.isPaused = isPaused === 'true';
      if (medicationId) filters.medicationId = medicationId;
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);

      const reminders = await reminderService.getReminders(workplaceId, filters);

      res.json({
        success: true,
        data: reminders,
        count: reminders.length,
      });
    } catch (error) {
      logger.error('Error getting reminders', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get reminders',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   GET /api/chat/reminders/:id
 * @desc    Get reminder by ID
 * @access  Private
 */
router.get(
  '/:id',
  auth,
  [param('id').isMongoId().withMessage('Valid reminder ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const { id } = req.params;

      const reminder = await reminderService.getReminderById(id, workplaceId);

      if (!reminder) {
        return res.status(404).json({
          success: false,
          message: 'Reminder not found',
        });
      }

      res.json({
        success: true,
        data: reminder,
      });
    } catch (error) {
      logger.error('Error getting reminder', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to get reminder',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   PUT /api/chat/reminders/:id
 * @desc    Update reminder
 * @access  Private
 */
router.put(
  '/:id',
  auth,
  [
    param('id').isMongoId().withMessage('Valid reminder ID is required'),
    body('medicationName').optional().trim().notEmpty(),
    body('dosage').optional().trim().notEmpty(),
    body('instructions').optional().trim().isLength({ max: 500 }),
    body('frequency')
      .optional()
      .isIn(['daily', 'twice_daily', 'three_times_daily', 'weekly', 'custom']),
    body('times').optional().isArray({ min: 1 }),
    body('times.*').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
    body('daysOfWeek').optional().isArray(),
    body('daysOfWeek.*').optional().isInt({ min: 0, max: 6 }),
    body('customSchedule').optional().trim(),
    body('endDate').optional().isISO8601(),
    body('isActive').optional().isBoolean(),
    body('isPaused').optional().isBoolean(),
    body('missedDoseThreshold').optional().isInt({ min: 5, max: 240 }),
    body('notifyPharmacistOnMissed').optional().isBoolean(),
    body('pharmacistId').optional().isMongoId(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const { id } = req.params;

      const reminder = await reminderService.updateReminder(id, workplaceId, req.body);

      res.json({
        success: true,
        data: reminder,
        message: 'Reminder updated successfully',
      });
    } catch (error) {
      logger.error('Error updating reminder', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to update reminder',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   DELETE /api/chat/reminders/:id
 * @desc    Delete reminder
 * @access  Private
 */
router.delete(
  '/:id',
  auth,
  [param('id').isMongoId().withMessage('Valid reminder ID is required')],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const { id } = req.params;

      await reminderService.deleteReminder(id, workplaceId);

      res.json({
        success: true,
        message: 'Reminder deleted successfully',
      });
    } catch (error) {
      logger.error('Error deleting reminder', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to delete reminder',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * @route   POST /api/chat/reminders/:id/confirm
 * @desc    Confirm medication taken
 * @access  Private
 */
router.post(
  '/:id/confirm',
  auth,
  [
    param('id').isMongoId().withMessage('Valid reminder ID is required'),
    body('scheduledTime').isISO8601().withMessage('Valid scheduled time is required'),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
      }

      const workplaceId = (req as any).user.workplaceId;
      const { id } = req.params;
      const { scheduledTime } = req.body;

      const reminder = await reminderService.confirmMedication(
        id,
        new Date(scheduledTime),
        workplaceId
      );

      res.json({
        success: true,
        data: reminder,
        message: 'Medication confirmed successfully',
      });
    } catch (error) {
      logger.error('Error confirming medication', { error });
      res.status(500).json({
        success: false,
        message: 'Failed to confirm medication',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
