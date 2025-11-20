import { body, param, query } from 'express-validator';

/**
 * Validation for generating AI diagnostic analysis
 */
export const validateDiagnosticAnalysis = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isMongoId()
    .withMessage('Valid patient ID is required'),

  body('symptoms')
    .isObject()
    .withMessage('Symptoms object is required'),

  body('symptoms.subjective')
    .notEmpty()
    .withMessage('Subjective symptoms are required')
    .isArray({ min: 1 })
    .withMessage('At least one subjective symptom is required')
    .custom((value) => {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.trim().length === 0)) {
        throw new Error('Subjective symptoms must be non-empty strings');
      }
      return true;
    }),

  body('symptoms.objective')
    .optional()
    .isArray()
    .withMessage('Objective symptoms must be an array')
    .custom((value) => {
      if (value && (!Array.isArray(value) || value.some(item => typeof item !== 'string'))) {
        throw new Error('Objective symptoms must be strings');
      }
      return true;
    }),

  body('symptoms.duration')
    .optional()
    .isString()
    .isLength({ min: 1, max: 100 })
    .withMessage('Duration must be between 1-100 characters'),

  body('symptoms.severity')
    .optional()
    .isIn(['mild', 'moderate', 'severe'])
    .withMessage('Severity must be mild, moderate, or severe'),

  body('symptoms.onset')
    .optional()
    .isIn(['acute', 'chronic', 'subacute'])
    .withMessage('Onset must be acute, chronic, or subacute'),

  body('labResults')
    .optional()
    .isArray()
    .withMessage('Lab results must be an array')
    .custom((value) => {
      if (value && Array.isArray(value)) {
        for (const lab of value) {
          if (!lab.testName || !lab.value || !lab.referenceRange || typeof lab.abnormal !== 'boolean') {
            throw new Error('Each lab result must have testName, value, referenceRange, and abnormal (boolean)');
          }
        }
      }
      return true;
    }),

  body('currentMedications')
    .optional()
    .isArray()
    .withMessage('Current medications must be an array')
    .custom((value) => {
      if (value && Array.isArray(value)) {
        for (const med of value) {
          if (!med.name || !med.dosage || !med.frequency) {
            throw new Error('Each medication must have name, dosage, and frequency');
          }
        }
      }
      return true;
    }),

  body('vitalSigns')
    .optional()
    .isObject()
    .withMessage('Vital signs must be an object'),

  body('vitalSigns.bloodPressure')
    .optional()
    .isString()
    .matches(/^\d{2,3}\/\d{2,3}$|^\d{2,3}$|^\d{2,3}\/\d{2,3}\s*mmHg$/)
    .withMessage('Blood pressure format is invalid'),

  body('vitalSigns.heartRate')
    .optional()
    .isInt({ min: 30, max: 250 })
    .withMessage('Heart rate must be between 30-250 bpm'),

  body('vitalSigns.temperature')
    .optional()
    .isFloat({ min: 30, max: 45 })
    .withMessage('Temperature must be between 30-45°C'),

  body('vitalSigns.respiratoryRate')
    .optional()
    .isInt({ min: 5, max: 100 })
    .withMessage('Respiratory rate must be between 5-100 breaths/min'),

  body('vitalSigns.oxygenSaturation')
    .optional()
    .isInt({ min: 50, max: 100 })
    .withMessage('Oxygen saturation must be between 50-100%'),

  body('patientConsent')
    .optional()
    .isObject()
    .withMessage('Patient consent must be an object'),

  body('patientConsent.provided')
    .optional()
    .isBoolean()
    .withMessage('Patient consent provided must be a boolean'),

  body('patientConsent.method')
    .optional()
    .isIn(['verbal', 'written', 'electronic'])
    .withMessage('Consent method must be verbal, written, or electronic')
];

/**
 * Validation for saving diagnostic decision
 */
export const validateDiagnosticDecision = [
  param('caseId')
    .isString()
    .isLength({ min: 10, max: 50 })
    .withMessage('Valid case ID is required'),

  body('accepted')
    .isBoolean()
    .withMessage('Accepted decision must be a boolean'),

  body('modifications')
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .withMessage('Modifications must be a string with max 2000 characters'),

  body('finalRecommendation')
    .isString()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Final recommendation is required (10-2000 characters)'),

  body('counselingPoints')
    .optional()
    .isArray()
    .withMessage('Counseling points must be an array')
    .custom((value) => {
      if (value && Array.isArray(value)) {
        for (const point of value) {
          if (typeof point !== 'string' || point.trim().length === 0) {
            throw new Error('Counseling points must be non-empty strings');
          }
        }
      }
      return true;
    }),

  body('followUpRequired')
    .optional()
    .isBoolean()
    .withMessage('Follow up required must be a boolean'),

  body('followUpDate')
    .optional()
    .isISO8601()
    .withMessage('Follow up date must be a valid date'),

  // Custom validation: if followUpRequired is true, followUpDate must be provided
  body().custom((value) => {
    if (value.followUpRequired === true && !value.followUpDate) {
      throw new Error('Follow up date is required when follow up is required');
    }
    return true;
  })
];

/**
 * Validation for getting diagnostic history
 */
export const validateDiagnosticHistory = [
  param('patientId')
    .isMongoId()
    .withMessage('Valid patient ID is required'),

  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1-100')
];

/**
 * Validation for getting specific diagnostic case
 */
export const validateGetDiagnosticCase = [
  param('caseId')
    .isString()
    .isLength({ min: 10, max: 50 })
    .withMessage('Valid case ID is required')
];

/**
 * Validation for drug interaction checking
 */
export const validateDrugInteractions = [
  body('medications')
    .isArray({ min: 2 })
    .withMessage('At least two medications are required for interaction checking')
    .custom((value) => {
      if (!Array.isArray(value)) {
        throw new Error('Medications must be an array');
      }

      for (const med of value) {
        if (!med.name || typeof med.name !== 'string' || med.name.trim().length === 0) {
          throw new Error('Each medication must have a valid name');
        }

        if (med.dosage && typeof med.dosage !== 'string') {
          throw new Error('Medication dosage must be a string');
        }

        if (med.frequency && typeof med.frequency !== 'string') {
          throw new Error('Medication frequency must be a string');
        }
      }

      return true;
    })
];

/**
 * Custom validation helper for medication format
 */
export const validateMedication = (medication: any) => {
  const errors = [];

  if (!medication.name || typeof medication.name !== 'string' || medication.name.trim().length === 0) {
    errors.push('Medication name is required');
  }

  if (!medication.dosage || typeof medication.dosage !== 'string' || medication.dosage.trim().length === 0) {
    errors.push('Medication dosage is required');
  }

  if (!medication.frequency || typeof medication.frequency !== 'string' || medication.frequency.trim().length === 0) {
    errors.push('Medication frequency is required');
  }

  if (medication.startDate && !Date.parse(medication.startDate)) {
    errors.push('Medication start date must be a valid date');
  }

  return errors;
};

/**
 * Custom validation helper for vital signs
 */
export const validateVitalSigns = (vitalSigns: any) => {
  const errors = [];

  if (vitalSigns.heartRate !== undefined) {
    const hr = Number(vitalSigns.heartRate);
    if (isNaN(hr) || hr < 30 || hr > 250) {
      errors.push('Heart rate must be between 30-250 bpm');
    }
  }

  if (vitalSigns.temperature !== undefined) {
    const temp = Number(vitalSigns.temperature);
    if (isNaN(temp) || temp < 30 || temp > 45) {
      errors.push('Temperature must be between 30-45°C');
    }
  }

  if (vitalSigns.respiratoryRate !== undefined) {
    const rr = Number(vitalSigns.respiratoryRate);
    if (isNaN(rr) || rr < 5 || rr > 100) {
      errors.push('Respiratory rate must be between 5-100 breaths/min');
    }
  }

  if (vitalSigns.oxygenSaturation !== undefined) {
    const spo2 = Number(vitalSigns.oxygenSaturation);
    if (isNaN(spo2) || spo2 < 50 || spo2 > 100) {
      errors.push('Oxygen saturation must be between 50-100%');
    }
  }

  if (vitalSigns.bloodPressure !== undefined) {
    const bpPattern = /^\d{2,3}\/\d{2,3}$|^\d{2,3}$|^\d{2,3}\/\d{2,3}\s*mmHg$/;
    if (!bpPattern.test(vitalSigns.bloodPressure)) {
      errors.push('Blood pressure format is invalid');
    }
  }

  return errors;
};

export default {
  validateDiagnosticAnalysis,
  validateDiagnosticDecision,
  validateDiagnosticHistory,
  validateGetDiagnosticCase,
  validateDrugInteractions,
  validateMedication,
  validateVitalSigns
};
/**

 * Validation for patient access validation
 */
export const validatePatientAccessRequest = [
  body('patientId')
    .notEmpty()
    .withMessage('Patient ID is required')
    .isMongoId()
    .withMessage('Valid patient ID is required'),
];