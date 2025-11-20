import { body, param } from 'express-validator';

/**
 * Validation schemas for public appointment endpoints
 * Requirements: 2.1, 2.2, 6.3, 6.4
 */

/**
 * Validate appointment ID parameter
 */
export const appointmentParamsSchema = [
  param('id')
    .isMongoId()
    .withMessage('Invalid appointment ID format'),
];

/**
 * Validate public appointment confirmation request
 */
export const confirmAppointmentPublicSchema = [
  body('token')
    .notEmpty()
    .withMessage('Confirmation token is required')
    .isString()
    .withMessage('Confirmation token must be a string')
    .isLength({ min: 10, max: 500 })
    .withMessage('Invalid confirmation token format'),

  body('patientNotes')
    .optional()
    .isString()
    .withMessage('Patient notes must be a string')
    .isLength({ max: 1000 })
    .withMessage('Patient notes cannot exceed 1000 characters')
    .trim(),

  body('specialRequirements')
    .optional()
    .isString()
    .withMessage('Special requirements must be a string')
    .isLength({ max: 500 })
    .withMessage('Special requirements cannot exceed 500 characters')
    .trim(),
];

/**
 * Validate request for middleware
 */
export const validateRequest = (schema: any[], location: 'body' | 'params' | 'query' = 'body') => {
  return schema;
};