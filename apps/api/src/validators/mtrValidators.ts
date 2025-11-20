import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';

// Helper function to validate ObjectId
const isValidObjectId = (value: string) => {
    return mongoose.Types.ObjectId.isValid(value);
};

// ===============================
// MTR SESSION VALIDATION
// ===============================

export const createMTRSessionSchema = [
    body('patientId')
        .notEmpty()
        .withMessage('Patient ID is required')
        .custom(isValidObjectId)
        .withMessage('Invalid patient ID format'),

    body('priority')
        .optional()
        .isIn(['routine', 'urgent', 'high_risk'])
        .withMessage('Priority must be routine, urgent, or high_risk'),

    body('reviewType')
        .optional()
        .isIn(['initial', 'follow_up', 'annual', 'targeted'])
        .withMessage('Review type must be initial, follow_up, annual, or targeted'),

    body('referralSource')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Referral source cannot exceed 100 characters'),

    body('reviewReason')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Review reason cannot exceed 500 characters'),

    body('patientConsent')
        .optional()
        .isBoolean()
        .withMessage('Patient consent must be a boolean'),

    body('confidentialityAgreed')
        .optional()
        .isBoolean()
        .withMessage('Confidentiality agreement must be a boolean'),
];

export const updateMTRSessionSchema = [
    body('status')
        .optional()
        .isIn(['in_progress', 'completed', 'cancelled', 'on_hold'])
        .withMessage('Status must be in_progress, completed, cancelled, or on_hold'),

    body('priority')
        .optional()
        .isIn(['routine', 'urgent', 'high_risk'])
        .withMessage('Priority must be routine, urgent, or high_risk'),

    body('reviewType')
        .optional()
        .isIn(['initial', 'follow_up', 'annual', 'targeted'])
        .withMessage('Review type must be initial, follow_up, annual, or targeted'),

    body('referralSource')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Referral source cannot exceed 100 characters'),

    body('reviewReason')
        .optional()
        .isLength({ max: 500 })
        .withMessage('Review reason cannot exceed 500 characters'),

    body('nextReviewDate')
        .optional()
        .isISO8601()
        .withMessage('Next review date must be a valid date'),

    body('estimatedDuration')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Estimated duration must be a positive number'),
];

// ===============================
// STEP VALIDATION
// ===============================

export const updateStepSchema = [
    param('stepName')
        .isIn(['patientSelection', 'medicationHistory', 'therapyAssessment', 'planDevelopment', 'interventions', 'followUp'])
        .withMessage('Invalid step name'),

    body('completed')
        .isBoolean()
        .withMessage('Completed must be a boolean'),

    body('data')
        .optional()
        .isObject()
        .withMessage('Data must be an object'),
];

// ===============================
// MEDICATION VALIDATION
// ===============================

export const medicationSchema = [
    body('medications')
        .isArray()
        .withMessage('Medications must be an array'),

    body('medications.*.drugName')
        .notEmpty()
        .withMessage('Drug name is required')
        .isLength({ max: 200 })
        .withMessage('Drug name cannot exceed 200 characters'),

    body('medications.*.genericName')
        .optional()
        .isLength({ max: 200 })
        .withMessage('Generic name cannot exceed 200 characters'),

    body('medications.*.strength.value')
        .isFloat({ min: 0 })
        .withMessage('Strength value must be a positive number'),

    body('medications.*.strength.unit')
        .notEmpty()
        .withMessage('Strength unit is required')
        .isLength({ max: 20 })
        .withMessage('Strength unit cannot exceed 20 characters'),

    body('medications.*.dosageForm')
        .notEmpty()
        .withMessage('Dosage form is required')
        .isLength({ max: 50 })
        .withMessage('Dosage form cannot exceed 50 characters'),

    body('medications.*.instructions.dose')
        .notEmpty()
        .withMessage('Dose is required')
        .isLength({ max: 100 })
        .withMessage('Dose cannot exceed 100 characters'),

    body('medications.*.instructions.frequency')
        .notEmpty()
        .withMessage('Frequency is required')
        .isLength({ max: 100 })
        .withMessage('Frequency cannot exceed 100 characters'),

    body('medications.*.instructions.route')
        .notEmpty()
        .withMessage('Route is required')
        .isLength({ max: 50 })
        .withMessage('Route cannot exceed 50 characters'),

    body('medications.*.category')
        .isIn(['prescribed', 'otc', 'herbal', 'supplement'])
        .withMessage('Category must be prescribed, otc, herbal, or supplement'),

    body('medications.*.startDate')
        .isISO8601()
        .withMessage('Start date must be a valid date'),

    body('medications.*.endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid date'),

    body('medications.*.indication')
        .notEmpty()
        .withMessage('Indication is required')
        .isLength({ max: 200 })
        .withMessage('Indication cannot exceed 200 characters'),

    body('medications.*.adherenceScore')
        .optional()
        .isFloat({ min: 0, max: 100 })
        .withMessage('Adherence score must be between 0 and 100'),
];

// ===============================
// PROBLEM VALIDATION
// ===============================

export const createProblemSchema = [
    body('category')
        .isIn(['indication', 'effectiveness', 'safety', 'adherence'])
        .withMessage('Category must be indication, effectiveness, safety, or adherence'),

    body('type')
        .isIn(['unnecessary', 'wrongDrug', 'doseTooLow', 'doseTooHigh', 'adverseReaction', 'inappropriateAdherence', 'needsAdditional', 'interaction', 'duplication', 'contraindication', 'monitoring'])
        .withMessage('Invalid problem type'),

    body('severity')
        .isIn(['critical', 'major', 'moderate', 'minor'])
        .withMessage('Severity must be critical, major, moderate, or minor'),

    body('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Description must be between 10 and 1000 characters'),

    body('clinicalSignificance')
        .notEmpty()
        .withMessage('Clinical significance is required')
        .isLength({ min: 10, max: 1000 })
        .withMessage('Clinical significance must be between 10 and 1000 characters'),

    body('evidenceLevel')
        .isIn(['definite', 'probable', 'possible', 'unlikely'])
        .withMessage('Evidence level must be definite, probable, possible, or unlikely'),

    body('affectedMedications')
        .optional()
        .isArray()
        .withMessage('Affected medications must be an array'),

    body('relatedConditions')
        .optional()
        .isArray()
        .withMessage('Related conditions must be an array'),

    body('riskFactors')
        .optional()
        .isArray()
        .withMessage('Risk factors must be an array'),
];

export const updateProblemSchema = [
    body('status')
        .optional()
        .isIn(['identified', 'addressed', 'monitoring', 'resolved', 'not_applicable'])
        .withMessage('Status must be identified, addressed, monitoring, resolved, or not_applicable'),

    body('resolution.action')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Resolution action cannot exceed 1000 characters'),

    body('resolution.outcome')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Resolution outcome cannot exceed 1000 characters'),

    ...createProblemSchema.filter(rule => !rule.toString().includes('notEmpty')), // Allow optional updates
];

// ===============================
// INTERVENTION VALIDATION
// ===============================

export const createInterventionSchema = [
    body('type')
        .isIn(['recommendation', 'counseling', 'monitoring', 'communication', 'education'])
        .withMessage('Type must be recommendation, counseling, monitoring, communication, or education'),

    body('category')
        .isIn(['medication_change', 'adherence_support', 'monitoring_plan', 'patient_education'])
        .withMessage('Category must be medication_change, adherence_support, monitoring_plan, or patient_education'),

    body('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ max: 1000 })
        .withMessage('Description cannot exceed 1000 characters'),

    body('rationale')
        .notEmpty()
        .withMessage('Rationale is required')
        .isLength({ max: 1000 })
        .withMessage('Rationale cannot exceed 1000 characters'),

    body('targetAudience')
        .isIn(['patient', 'prescriber', 'caregiver', 'healthcare_team'])
        .withMessage('Target audience must be patient, prescriber, caregiver, or healthcare_team'),

    body('communicationMethod')
        .isIn(['verbal', 'written', 'phone', 'email', 'fax', 'in_person'])
        .withMessage('Communication method must be verbal, written, phone, email, fax, or in_person'),

    body('documentation')
        .notEmpty()
        .withMessage('Documentation is required')
        .isLength({ max: 2000 })
        .withMessage('Documentation cannot exceed 2000 characters'),

    body('priority')
        .optional()
        .isIn(['high', 'medium', 'low'])
        .withMessage('Priority must be high, medium, or low'),

    body('urgency')
        .optional()
        .isIn(['immediate', 'within_24h', 'within_week', 'routine'])
        .withMessage('Urgency must be immediate, within_24h, within_week, or routine'),

    body('followUpRequired')
        .optional()
        .isBoolean()
        .withMessage('Follow-up required must be a boolean'),

    body('followUpDate')
        .optional()
        .isISO8601()
        .withMessage('Follow-up date must be a valid date'),
];

export const updateInterventionSchema = [
    body('outcome')
        .optional()
        .isIn(['accepted', 'rejected', 'modified', 'pending', 'not_applicable'])
        .withMessage('Outcome must be accepted, rejected, modified, pending, or not_applicable'),

    body('outcomeDetails')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Outcome details cannot exceed 1000 characters'),

    body('followUpCompleted')
        .optional()
        .isBoolean()
        .withMessage('Follow-up completed must be a boolean'),

    ...createInterventionSchema.filter(rule => !rule.toString().includes('notEmpty')), // Allow optional updates
];

// ===============================
// FOLLOW-UP VALIDATION
// ===============================

export const createFollowUpSchema = [
    body('type')
        .isIn(['phone_call', 'appointment', 'lab_review', 'adherence_check', 'outcome_assessment'])
        .withMessage('Type must be phone_call, appointment, lab_review, adherence_check, or outcome_assessment'),

    body('description')
        .notEmpty()
        .withMessage('Description is required')
        .isLength({ max: 1000 })
        .withMessage('Description cannot exceed 1000 characters'),

    body('scheduledDate')
        .isISO8601()
        .withMessage('Scheduled date must be a valid date')
        .custom((value) => {
            const scheduledDate = new Date(value);
            const now = new Date();
            if (scheduledDate < now) {
                throw new Error('Scheduled date cannot be in the past');
            }
            return true;
        }),

    body('estimatedDuration')
        .optional()
        .isInt({ min: 5, max: 480 })
        .withMessage('Estimated duration must be between 5 and 480 minutes'),

    body('priority')
        .optional()
        .isIn(['high', 'medium', 'low'])
        .withMessage('Priority must be high, medium, or low'),

    body('objectives')
        .optional()
        .isArray()
        .withMessage('Objectives must be an array'),

    body('assignedTo')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid assigned to user ID format'),
];

export const updateFollowUpSchema = [
    body('status')
        .optional()
        .isIn(['scheduled', 'in_progress', 'completed', 'missed', 'rescheduled', 'cancelled'])
        .withMessage('Status must be scheduled, in_progress, completed, missed, rescheduled, or cancelled'),

    body('scheduledDate')
        .optional()
        .isISO8601()
        .withMessage('Scheduled date must be a valid date'),

    body('outcome.status')
        .optional()
        .isIn(['successful', 'partially_successful', 'unsuccessful'])
        .withMessage('Outcome status must be successful, partially_successful, or unsuccessful'),

    body('outcome.notes')
        .optional()
        .isLength({ max: 2000 })
        .withMessage('Outcome notes cannot exceed 2000 characters'),

    body('outcome.nextFollowUpDate')
        .optional()
        .isISO8601()
        .withMessage('Next follow-up date must be a valid date'),

    ...createFollowUpSchema.filter(rule => !rule.toString().includes('notEmpty')), // Allow optional updates
];

// ===============================
// PARAMETER VALIDATION
// ===============================

export const mtrParamsSchema = [
    param('id')
        .custom(isValidObjectId)
        .withMessage('Invalid MTR session ID format'),
];

export const problemParamsSchema = [
    param('id')
        .custom(isValidObjectId)
        .withMessage('Invalid MTR session ID format'),
    param('problemId')
        .custom(isValidObjectId)
        .withMessage('Invalid problem ID format'),
];

export const interventionParamsSchema = [
    param('id')
        .custom(isValidObjectId)
        .withMessage('Invalid MTR session ID format'),
    param('interventionId')
        .custom(isValidObjectId)
        .withMessage('Invalid intervention ID format'),
];

export const followUpParamsSchema = [
    param('id')
        .custom(isValidObjectId)
        .withMessage('Invalid MTR session ID format'),
    param('followupId')
        .custom(isValidObjectId)
        .withMessage('Invalid follow-up ID format'),
];

export const patientParamsSchema = [
    param('patientId')
        .custom(isValidObjectId)
        .withMessage('Invalid patient ID format'),
];

// ===============================
// QUERY VALIDATION
// ===============================

export const mtrQuerySchema = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),

    query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('Limit must be between 1 and 50'),

    query('status')
        .optional()
        .isIn(['in_progress', 'completed', 'cancelled', 'on_hold'])
        .withMessage('Status must be in_progress, completed, cancelled, or on_hold'),

    query('priority')
        .optional()
        .isIn(['routine', 'urgent', 'high_risk'])
        .withMessage('Priority must be routine, urgent, or high_risk'),

    query('reviewType')
        .optional()
        .isIn(['initial', 'follow_up', 'annual', 'targeted'])
        .withMessage('Review type must be initial, follow_up, annual, or targeted'),

    query('pharmacistId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid pharmacist ID format'),

    query('patientId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid patient ID format'),
];

export const reportsQuerySchema = [
    query('startDate')
        .optional()
        .isISO8601()
        .withMessage('Start date must be a valid date'),

    query('endDate')
        .optional()
        .isISO8601()
        .withMessage('End date must be a valid date'),

    query('pharmacistId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid pharmacist ID format'),

    query('sessionId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid session ID format'),

    query('userId')
        .optional()
        .custom(isValidObjectId)
        .withMessage('Invalid user ID format'),
];

// ===============================
// DRUG INTERACTION VALIDATION
// ===============================

export const drugInteractionSchema = [
    body('medications')
        .isArray({ min: 1 })
        .withMessage('Medications array is required and must not be empty'),

    body('medications.*.drugName')
        .notEmpty()
        .withMessage('Drug name is required for each medication'),

    body('medications.*.genericName')
        .optional()
        .isString()
        .withMessage('Generic name must be a string'),
];

// Validation middleware wrapper
export const validateRequest = (validations: any[], location: 'body' | 'params' | 'query' = 'body') => {
    return validations;
};