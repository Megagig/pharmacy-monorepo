import { body, query, ValidationChain } from 'express-validator';
import { validateObjectId } from '../utils/validation';

export const appointmentAnalyticsValidators = {
  /**
   * Validation for GET /appointments/analytics
   */
  getAppointmentAnalytics: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    
    query('pharmacistId')
      .optional()
      .custom(validateObjectId)
      .withMessage('Pharmacist ID must be a valid ObjectId'),
    
    query('locationId')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Location ID must be a string between 1 and 100 characters'),
    
    query('appointmentType')
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
    
    query('groupBy')
      .optional()
      .isIn(['day', 'week', 'month', 'pharmacist', 'type', 'location'])
      .withMessage('Invalid groupBy parameter'),
    
    query('includeDetails')
      .optional()
      .isBoolean()
      .withMessage('includeDetails must be a boolean')
      .toBoolean()
  ] as ValidationChain[],

  /**
   * Validation for GET /follow-ups/analytics
   */
  getFollowUpAnalytics: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    
    query('pharmacistId')
      .optional()
      .custom(validateObjectId)
      .withMessage('Pharmacist ID must be a valid ObjectId'),
    
    query('taskType')
      .optional()
      .isIn([
        'medication_start_followup',
        'lab_result_review',
        'hospital_discharge_followup',
        'medication_change_followup',
        'chronic_disease_monitoring',
        'adherence_check',
        'refill_reminder',
        'preventive_care',
        'general_followup'
      ])
      .withMessage('Invalid task type'),
    
    query('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent', 'critical'])
      .withMessage('Invalid priority level'),
    
    query('status')
      .optional()
      .isIn(['pending', 'in_progress', 'completed', 'cancelled', 'overdue', 'converted_to_appointment'])
      .withMessage('Invalid status'),
    
    query('triggerType')
      .optional()
      .isIn([
        'manual',
        'medication_start',
        'lab_result',
        'hospital_discharge',
        'medication_change',
        'scheduled_monitoring',
        'missed_appointment',
        'system_rule'
      ])
      .withMessage('Invalid trigger type'),
    
    query('includeEscalations')
      .optional()
      .isBoolean()
      .withMessage('includeEscalations must be a boolean')
      .toBoolean()
  ] as ValidationChain[],

  /**
   * Validation for GET /reminders/analytics
   */
  getReminderAnalytics: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    
    query('channel')
      .optional()
      .isIn(['email', 'sms', 'push', 'whatsapp'])
      .withMessage('Invalid reminder channel'),
    
    query('templateId')
      .optional()
      .custom(validateObjectId)
      .withMessage('Template ID must be a valid ObjectId'),
    
    query('appointmentType')
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
    
    query('deliveryStatus')
      .optional()
      .isIn(['pending', 'sent', 'delivered', 'failed'])
      .withMessage('Invalid delivery status'),
    
    query('includeTemplatePerformance')
      .optional()
      .isBoolean()
      .withMessage('includeTemplatePerformance must be a boolean')
      .toBoolean()
  ] as ValidationChain[],

  /**
   * Validation for GET /schedules/capacity
   */
  getCapacityAnalytics: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date'),
    
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date'),
    
    query('pharmacistId')
      .optional()
      .custom(validateObjectId)
      .withMessage('Pharmacist ID must be a valid ObjectId'),
    
    query('locationId')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Location ID must be a string between 1 and 100 characters'),
    
    query('includeTimeOff')
      .optional()
      .isBoolean()
      .withMessage('includeTimeOff must be a boolean')
      .toBoolean(),
    
    query('includeRecommendations')
      .optional()
      .isBoolean()
      .withMessage('includeRecommendations must be a boolean')
      .toBoolean(),
    
    query('granularity')
      .optional()
      .isIn(['hour', 'day', 'week'])
      .withMessage('Invalid granularity. Must be hour, day, or week')
  ] as ValidationChain[],

  /**
   * Validation for POST /appointments/analytics/export
   */
  exportAnalytics: [
    body('format')
      .isIn(['pdf', 'excel', 'csv'])
      .withMessage('Export format must be pdf, excel, or csv'),
    
    body('reportType')
      .optional()
      .isIn(['appointments', 'follow-ups', 'reminders', 'capacity', 'comprehensive'])
      .withMessage('Invalid report type'),
    
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date')
      .toDate(),
    
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
      .toDate()
      .custom((endDate, { req }) => {
        if (req.body.startDate && endDate <= new Date(req.body.startDate)) {
          throw new Error('End date must be after start date');
        }
        return true;
      }),
    
    body('filters')
      .optional()
      .isObject()
      .withMessage('Filters must be an object'),
    
    body('filters.pharmacistId')
      .optional()
      .custom(validateObjectId)
      .withMessage('Pharmacist ID must be a valid ObjectId'),
    
    body('filters.locationId')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 100 })
      .withMessage('Location ID must be a string between 1 and 100 characters'),
    
    body('filters.appointmentType')
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
    
    body('includeCharts')
      .optional()
      .isBoolean()
      .withMessage('includeCharts must be a boolean')
      .toBoolean(),
    
    body('includeRawData')
      .optional()
      .isBoolean()
      .withMessage('includeRawData must be a boolean')
      .toBoolean(),
    
    body('emailTo')
      .optional()
      .isEmail()
      .withMessage('Invalid email address')
      .normalizeEmail(),
    
    body('title')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    
    body('description')
      .optional()
      .isString()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description cannot exceed 1000 characters')
  ] as ValidationChain[],

  /**
   * Common validation for date range queries
   */
  dateRangeValidation: [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date')
      .toDate()
      .custom((startDate) => {
        const maxPastDate = new Date();
        maxPastDate.setFullYear(maxPastDate.getFullYear() - 2); // Max 2 years ago
        
        if (startDate < maxPastDate) {
          throw new Error('Start date cannot be more than 2 years ago');
        }
        
        if (startDate > new Date()) {
          throw new Error('Start date cannot be in the future');
        }
        
        return true;
      }),
    
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
      .toDate()
      .custom((endDate, { req }) => {
        if (endDate > new Date()) {
          throw new Error('End date cannot be in the future');
        }
        
        if (req.query.startDate) {
          const startDate = new Date(req.query.startDate as string);
          const diffMs = endDate.getTime() - startDate.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          
          if (diffDays > 365) {
            throw new Error('Date range cannot exceed 365 days');
          }
          
          if (endDate <= startDate) {
            throw new Error('End date must be after start date');
          }
        }
        
        return true;
      })
  ] as ValidationChain[],

  /**
   * Validation for aggregation parameters
   */
  aggregationValidation: [
    query('groupBy')
      .optional()
      .isIn(['hour', 'day', 'week', 'month', 'pharmacist', 'type', 'location', 'status'])
      .withMessage('Invalid groupBy parameter'),
    
    query('sortBy')
      .optional()
      .isIn(['date', 'count', 'rate', 'duration', 'name'])
      .withMessage('Invalid sortBy parameter'),
    
    query('sortOrder')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be asc or desc'),
    
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('Limit must be between 1 and 1000')
      .toInt(),
    
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be a non-negative integer')
      .toInt()
  ] as ValidationChain[]
};