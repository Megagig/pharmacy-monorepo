import { Router } from 'express';
import { PatientProfileController } from '../controllers/patientProfileController';
import {
  patientPortalAuth,
} from '../middlewares/patientPortalAuth';
import {
  validatePatientPortalRequest,
  updatePatientProfileSchema,
  addAllergySchema,
  updateAllergySchema,
  addChronicConditionSchema,
  updateChronicConditionSchema,
  addEmergencyContactSchema,
  updateEmergencyContactSchema,
  updateInsuranceInfoSchema,
  logVitalsSchema,
  objectIdParamSchema,
  paginationQuerySchema,
} from '../middlewares/patientPortalValidation';

const router = Router();

// Apply common middleware to all routes
router.use(patientPortalAuth);
// router.use(requireActivePatient);
// router.use(requireLinkedPatient);

// Apply rate limiting (100 requests per 15 minutes per patient)
// router.use(patientRateLimit(100, 15 * 60 * 1000));

// ===============================
// PATIENT PROFILE ROUTES
// ===============================

/**
 * @route   GET /api/patient-portal/profile
 * @desc    Get patient profile
 * @access  Private (Patient)
 */
router.get(
  '/',
  // auditPatientAction('get_profile'),
  PatientProfileController.getProfile
);

/**
 * @route   PUT /api/patient-portal/profile
 * @desc    Update patient profile
 * @access  Private (Patient)
 */
router.put(
  '/',
  updatePatientProfileSchema,
  validatePatientPortalRequest,
  // auditPatientAction('update_profile'),
  PatientProfileController.updateProfile
);

// ===============================
// ALLERGY MANAGEMENT ROUTES
// ===============================

/**
 * @route   POST /api/patient-portal/profile/allergies
 * @desc    Add new allergy
 * @access  Private (Patient)
 */
router.post(
  '/allergies',
  addAllergySchema,
  validatePatientPortalRequest,
  // auditPatientAction('add_allergy'),
  PatientProfileController.addAllergy
);

/**
 * @route   PUT /api/patient-portal/profile/allergies/:allergyId
 * @desc    Update existing allergy
 * @access  Private (Patient)
 */
router.put(
  '/allergies/:allergyId',
  objectIdParamSchema('allergyId'),
  updateAllergySchema,
  validatePatientPortalRequest,
  // auditPatientAction('update_allergy'),
  PatientProfileController.updateAllergy
);

/**
 * @route   DELETE /api/patient-portal/profile/allergies/:allergyId
 * @desc    Remove allergy
 * @access  Private (Patient)
 */
router.delete(
  '/allergies/:allergyId',
  objectIdParamSchema('allergyId'),
  validatePatientPortalRequest,
  // auditPatientAction('remove_allergy'),
  PatientProfileController.removeAllergy
);

// ===============================
// CHRONIC CONDITION MANAGEMENT ROUTES
// ===============================

/**
 * @route   POST /api/patient-portal/profile/conditions
 * @desc    Add new chronic condition
 * @access  Private (Patient)
 */
router.post(
  '/conditions',
  addChronicConditionSchema,
  validatePatientPortalRequest,
  // auditPatientAction('add_chronic_condition'),
  PatientProfileController.addChronicCondition
);

/**
 * @route   PUT /api/patient-portal/profile/conditions/:conditionId
 * @desc    Update existing chronic condition
 * @access  Private (Patient)
 */
router.put(
  '/conditions/:conditionId',
  objectIdParamSchema('conditionId'),
  updateChronicConditionSchema,
  validatePatientPortalRequest,
  // auditPatientAction('update_chronic_condition'),
  PatientProfileController.updateChronicCondition
);

/**
 * @route   DELETE /api/patient-portal/profile/conditions/:conditionId
 * @desc    Remove chronic condition
 * @access  Private (Patient)
 */
router.delete(
  '/conditions/:conditionId',
  objectIdParamSchema('conditionId'),
  validatePatientPortalRequest,
  // auditPatientAction('remove_chronic_condition'),
  PatientProfileController.removeChronicCondition
);

// ===============================
// EMERGENCY CONTACT MANAGEMENT ROUTES
// ===============================

/**
 * @route   POST /api/patient-portal/profile/emergency-contacts
 * @desc    Add new emergency contact
 * @access  Private (Patient)
 */
router.post(
  '/emergency-contacts',
  addEmergencyContactSchema,
  validatePatientPortalRequest,
  // auditPatientAction('add_emergency_contact'),
  PatientProfileController.addEmergencyContact
);

/**
 * @route   PUT /api/patient-portal/profile/emergency-contacts/:contactId
 * @desc    Update existing emergency contact
 * @access  Private (Patient)
 */
router.put(
  '/emergency-contacts/:contactId',
  objectIdParamSchema('contactId'),
  updateEmergencyContactSchema,
  validatePatientPortalRequest,
  // auditPatientAction('update_emergency_contact'),
  PatientProfileController.updateEmergencyContact
);

/**
 * @route   DELETE /api/patient-portal/profile/emergency-contacts/:contactId
 * @desc    Remove emergency contact
 * @access  Private (Patient)
 */
router.delete(
  '/emergency-contacts/:contactId',
  objectIdParamSchema('contactId'),
  validatePatientPortalRequest,
  // auditPatientAction('remove_emergency_contact'),
  PatientProfileController.removeEmergencyContact
);

// ===============================
// INSURANCE INFORMATION ROUTES
// ===============================

/**
 * @route   PUT /api/patient-portal/profile/insurance
 * @desc    Update insurance information
 * @access  Private (Patient)
 */
router.put(
  '/insurance',
  updateInsuranceInfoSchema,
  validatePatientPortalRequest,
  // auditPatientAction('update_insurance_info'),
  PatientProfileController.updateInsuranceInfo
);

// ===============================
// VITALS MANAGEMENT ROUTES
// ===============================

/**
 * @route   POST /api/patient-portal/profile/vitals
 * @desc    Log patient vitals
 * @access  Private (Patient)
 */
router.post(
  '/vitals',
  logVitalsSchema,
  validatePatientPortalRequest,
  // Apply stricter rate limiting for vitals logging (10 entries per hour)
  // patientRateLimit(10, 60 * 60 * 1000),
  // auditPatientAction('log_vitals'),
  PatientProfileController.logVitals
);

/**
 * @route   GET /api/patient-portal/profile/vitals
 * @desc    Get vitals history
 * @access  Private (Patient)
 */
router.get(
  '/vitals',
  paginationQuerySchema,
  validatePatientPortalRequest,
  // auditPatientAction('get_vitals_history'),
  PatientProfileController.getVitalsHistory
);

/**
 * @route   GET /api/patient-portal/profile/vitals/latest
 * @desc    Get latest vitals
 * @access  Private (Patient)
 */
router.get(
  '/vitals/latest',
  // auditPatientAction('get_latest_vitals'),
  PatientProfileController.getLatestVitals
);

export default router;