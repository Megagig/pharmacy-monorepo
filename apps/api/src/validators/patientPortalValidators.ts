import { body, param, query, ValidationChain } from 'express-validator';
import mongoose from 'mongoose';

// Helper function to validate ObjectId
const isValidObjectId = (value: string) => {
    return mongoose.Types.ObjectId.isValid(value);
};

// ===============================
// APPOINTMENT TYPES VALIDATION
// ===============================

// No validation needed for appointment types endpoint (public, no parameters)

// ===============================
// AVAILABLE SLOTS VALIDATION
// ===============================

export const availableSlotsQuerySchema: ValidationChain[] = [
    query('date')
        .optional()
        .isISO8601()
        .withMessage('Date must be in ISO 8601 format (YYYY-MM-DD)')
        .custom((value) => {
            const date = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (date < today) {
                throw new Error('Date cannot be in the past');
            }
            
            // Limit to 90 days in the future
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + 90);
            if (date > maxDate) {
                throw new Error('Date cannot be more than 90 days in the future');
            }
            
            return true;
        }),

    query('type')
        .optional()
        .isIn([
            'mtm_session',
            'chronic_disease_review',
            'new_medication_consultation',
            'vaccination',
            'health_check',
            'smoking_cessation',
            'general_followup'
        ])
        .withMessage('Invalid appointment type'),

    query('duration')
        .optional()
        .isInt({ min: 5, max: 120 })
        .withMessage('Duration must be between 5 and 120 minutes'),

    query('pharmacistId')
        .optional()
        .custom((value) => {
            if (!isValidObjectId(value)) {
                throw new Error('Invalid pharmacist ID');
            }
            return true;
        }),

    query('locationId')
        .optional()
        .isString()
        .isLength({ min: 1, max: 100 })
        .withMessage('Location ID must be between 1 and 100 characters'),
];

// ===============================
// BOOK APPOINTMENT VALIDATION
// ===============================

export const bookAppointmentSchema: ValidationChain[] = [
    body('patientId')
        .notEmpty()
        .withMessage('Patient ID is required')
        .custom((value) => {
            if (!isValidObjectId(value)) {
                throw new Error('Invalid patient ID');
            }
            return true;
        }),

    body('type')
        .notEmpty()
        .withMessage('Appointment type is required')
        .isIn([
            'mtm_session',
            'chronic_disease_review',
            'new_medication_consultation',
            'vaccination',
            'health_check',
            'smoking_cessation',
            'general_followup'
        ])
        .withMessage('Invalid appointment type'),

    body('scheduledDate')
        .notEmpty()
        .withMessage('Scheduled date is required')
        .isISO8601()
        .withMessage('Scheduled date must be in ISO 8601 format (YYYY-MM-DD)')
        .custom((value) => {
            const date = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (date < today) {
                throw new Error('Scheduled date cannot be in the past');
            }
            
            // Limit to 90 days in the future
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + 90);
            if (date > maxDate) {
                throw new Error('Scheduled date cannot be more than 90 days in the future');
            }
            
            return true;
        }),

    body('scheduledTime')
        .notEmpty()
        .withMessage('Scheduled time is required')
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('Scheduled time must be in HH:mm format (24-hour)'),

    body('duration')
        .optional()
        .isInt({ min: 5, max: 120 })
        .withMessage('Duration must be between 5 and 120 minutes')
        .default(30),

    body('assignedTo')
        .optional()
        .custom((value) => {
            if (value && !isValidObjectId(value)) {
                throw new Error('Invalid pharmacist ID');
            }
            return true;
        }),

    body('description')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('Description cannot exceed 500 characters')
        .trim(),

    body('patientNotes')
        .optional()
        .isString()
        .isLength({ max: 1000 })
        .withMessage('Patient notes cannot exceed 1000 characters')
        .trim(),

    body('patientPreferences')
        .optional()
        .isObject()
        .withMessage('Patient preferences must be an object'),

    body('patientPreferences.preferredChannel')
        .optional()
        .isIn(['email', 'sms', 'whatsapp', 'phone'])
        .withMessage('Invalid preferred communication channel'),

    body('patientPreferences.language')
        .optional()
        .isIn(['en', 'yo', 'ig', 'ha'])
        .withMessage('Invalid language preference'),

    body('patientPreferences.specialRequirements')
        .optional()
        .isString()
        .isLength({ max: 200 })
        .withMessage('Special requirements cannot exceed 200 characters')
        .trim(),

    body('locationId')
        .optional()
        .isString()
        .isLength({ min: 1, max: 100 })
        .withMessage('Location ID must be between 1 and 100 characters'),
];

// ===============================
// MY APPOINTMENTS VALIDATION
// ===============================

export const myAppointmentsQuerySchema: ValidationChain[] = [
    query('status')
        .optional()
        .isIn(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled'])
        .withMessage('Invalid appointment status'),

    query('type')
        .optional()
        .isIn([
            'mtm_session',
            'chronic_disease_review',
            'new_medication_consultation',
            'vaccination',
            'health_check',
            'smoking_cessation',
            'general_followup'
        ])
        .withMessage('Invalid appointment type'),

    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be in ISO 8601 format (YYYY-MM-DD)'),

    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be in ISO 8601 format (YYYY-MM-DD)')
        .custom((value, { req }) => {
            if (req.query.startDate && value) {
                const startDate = new Date(req.query.startDate as string);
                const endDate = new Date(value);
                
                if (endDate < startDate) {
                    throw new Error('End date cannot be before start date');
                }
                
                // Limit date range to 1 year
                const maxRange = new Date(startDate);
                maxRange.setFullYear(maxRange.getFullYear() + 1);
                if (endDate > maxRange) {
                    throw new Error('Date range cannot exceed 1 year');
                }
            }
            return true;
        }),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
        .default(20),

    query('cursor')
        .optional()
        .isString()
        .withMessage('Cursor must be a string'),

    query('includeCompleted')
        .optional()
        .isBoolean()
        .withMessage('Include completed must be a boolean')
        .default(true),

    query('includeCancelled')
        .optional()
        .isBoolean()
        .withMessage('Include cancelled must be a boolean')
        .default(false),
];

// ===============================
// RESCHEDULE APPOINTMENT VALIDATION
// ===============================

export const rescheduleAppointmentSchema: ValidationChain[] = [
    body('newDate')
        .notEmpty()
        .withMessage('New date is required')
        .isISO8601()
        .withMessage('New date must be in ISO 8601 format (YYYY-MM-DD)')
        .custom((value) => {
            const date = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (date < today) {
                throw new Error('New date cannot be in the past');
            }
            
            // Limit to 90 days in the future
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + 90);
            if (date > maxDate) {
                throw new Error('New date cannot be more than 90 days in the future');
            }
            
            return true;
        }),

    body('newTime')
        .notEmpty()
        .withMessage('New time is required')
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .withMessage('New time must be in HH:mm format (24-hour)'),

    body('reason')
        .optional()
        .isString()
        .isLength({ max: 200 })
        .withMessage('Reason cannot exceed 200 characters')
        .trim(),

    body('notifyPharmacist')
        .optional()
        .isBoolean()
        .withMessage('Notify pharmacist must be a boolean')
        .default(true),
];

// ===============================
// CANCEL APPOINTMENT VALIDATION
// ===============================

export const cancelAppointmentSchema: ValidationChain[] = [
    body('reason')
        .notEmpty()
        .withMessage('Cancellation reason is required')
        .isString()
        .isLength({ min: 5, max: 200 })
        .withMessage('Reason must be between 5 and 200 characters')
        .trim(),

    body('notifyPharmacist')
        .optional()
        .isBoolean()
        .withMessage('Notify pharmacist must be a boolean')
        .default(true),
];

// ===============================
// CONFIRM APPOINTMENT VALIDATION
// ===============================

export const confirmAppointmentSchema: ValidationChain[] = [
    body('confirmationToken')
        .optional()
        .isString()
        .isLength({ min: 10, max: 200 })
        .withMessage('Invalid confirmation token')
        .trim(),

    body('patientNotes')
        .optional()
        .isString()
        .isLength({ max: 500 })
        .withMessage('Patient notes cannot exceed 500 characters')
        .trim(),

    body('specialRequirements')
        .optional()
        .isString()
        .isLength({ max: 200 })
        .withMessage('Special requirements cannot exceed 200 characters')
        .trim(),
];

// ===============================
// COMMON PARAMETER VALIDATION
// ===============================

export const appointmentParamsSchema: ValidationChain[] = [
    param('id')
        .notEmpty()
        .withMessage('Appointment ID is required')
        .custom((value) => {
            if (!isValidObjectId(value)) {
                throw new Error('Invalid appointment ID');
            }
            return true;
        }),
];

// ===============================
// VALIDATION MIDDLEWARE EXPORT
// ===============================

// Re-export the validation middleware from appointmentValidators
export { validateRequest } from './appointmentValidators';