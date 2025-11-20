/**
 * Schedule Management Routes
 * 
 * Routes for managing pharmacist schedules and availability
 */

import express from 'express';
import { body, query } from 'express-validator';
import { auth } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validation';
import scheduleController from '../controllers/scheduleController';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * @route   GET /api/schedules/test
 * @desc    Test authentication
 * @access  Private (All authenticated users)
 */
router.get(
  '/test',
  (req: any, res: any) => {
    res.json({
      success: true,
      user: {
        id: req.user?._id,
        email: req.user?.email,
        workplaceId: req.user?.workplaceId
      }
    });
  }
);

/**
 * @route   GET /api/schedules/my-schedule
 * @desc    Get current user's schedule
 * @access  Private (All authenticated users)
 */
router.get(
  '/my-schedule',
  scheduleController.getMySchedule
);

/**
 * @route   POST /api/schedules/my-schedule
 * @desc    Create or update current user's schedule
 * @access  Private (All authenticated users)
 */
router.post(
  '/my-schedule',
  scheduleController.createOrUpdateMySchedule
);

/**
 * @route   GET /api/schedules/pharmacists
 * @desc    Get all pharmacist schedules (for admin/managers)
 * @access  Private (All authenticated users)
 */
router.get(
  '/pharmacists',
  [
    query('date')
      .optional()
      .isISO8601()
      .withMessage('Date must be in ISO format'),
  ],
  validateRequest,
  scheduleController.getPharmacistSchedules
);

/**
 * @route   GET /api/schedules/availability/:pharmacistId
 * @desc    Get pharmacist availability for a specific date range
 * @access  Private (All authenticated users)
 */
router.get(
  '/availability/:pharmacistId',
  [
    query('startDate')
      .isISO8601()
      .withMessage('Start date is required and must be in ISO format'),
    query('endDate')
      .isISO8601()
      .withMessage('End date is required and must be in ISO format'),
  ],
  validateRequest,
  scheduleController.getPharmacistAvailability
);

/**
 * @route   POST /api/schedules/time-off
 * @desc    Request time off
 * @access  Private (All authenticated users)
 */
router.post(
  '/time-off',
  [
    body('startDate')
      .isISO8601()
      .withMessage('Start date is required and must be in ISO format'),
    body('endDate')
      .isISO8601()
      .withMessage('End date is required and must be in ISO format'),
    body('reason')
      .notEmpty()
      .withMessage('Reason is required'),
    body('type')
      .isIn(['vacation', 'sick_leave', 'personal', 'training', 'other'])
      .withMessage('Valid time off type is required'),
  ],
  validateRequest,
  scheduleController.requestTimeOff
);

/**
 * @route   GET /api/schedules/pharmacist/:pharmacistId
 * @desc    Get a specific pharmacist's schedule with appointments
 * @access  Private (All authenticated users)
 */
router.get(
  '/pharmacist/:pharmacistId',
  scheduleController.getPharmacistSchedule
);

export default router;