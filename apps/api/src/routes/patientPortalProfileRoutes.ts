import express from 'express';
import { body, validationResult } from 'express-validator';
import PatientUser from '../models/PatientUser';
import { patientPortalAuth } from '../middlewares/patientPortalAuth';
import { PatientSyncService } from '../services/patientSyncService';
import logger from '../utils/logger';

const router = express.Router();

/**
 * @route GET /api/patient-portal/profile
 * @desc Get patient profile information
 * @access Private (Patient)
 */
router.get('/', patientPortalAuth, async (req, res) => {
  try {
    const patientUser = await PatientUser.findById((req as any).patientUser.id)
      .populate('workplaceId', 'name type')
      .select('-passwordHash -refreshTokens -verificationToken -resetToken');

    if (!patientUser) {
      return res.status(404).json({
        success: false,
        message: 'Patient profile not found',
      });
    }

    // Get linked Patient record if it exists
    let patientRecord = null;
    if (patientUser.patientId) {
      try {
        patientRecord = await PatientSyncService.getPatientRecordForUser(patientUser._id.toString());
      } catch (error) {
        logger.warn('Error fetching linked patient record:', error);
      }
    }

    res.json({
      success: true,
      data: {
        profile: {
          id: patientUser._id,
          firstName: patientUser.firstName,
          lastName: patientUser.lastName,
          email: patientUser.email,
          phone: patientUser.phone,
          dateOfBirth: patientUser.dateOfBirth,
          status: patientUser.status,
          emailVerified: patientUser.emailVerified,
          phoneVerified: patientUser.phoneVerified,
          notificationPreferences: patientUser.notificationPreferences,
          language: patientUser.language,
          timezone: patientUser.timezone,
          avatar: patientUser.avatar,
          profileVisibility: patientUser.profileVisibility,
          dataSharing: patientUser.dataSharing,
          onboardingCompleted: patientUser.onboardingCompleted,
          workspaceId: (patientUser.workplaceId as any)?._id?.toString() || patientUser.workplaceId.toString(),
          workspaceName: (patientUser.workplaceId as any)?.name || 'Healthcare Workspace',
          lastLoginAt: patientUser.lastLoginAt,
          createdAt: patientUser.createdAt,
          updatedAt: patientUser.updatedAt,
        },
        linkedPatientRecord: patientRecord ? {
          id: patientRecord._id,
          mrn: patientRecord.mrn,
          hasLinkedRecord: true,
        } : {
          hasLinkedRecord: false,
        },
      },
      message: 'Profile retrieved successfully',
    });
  } catch (error) {
    logger.error('Get patient profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve profile',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

/**
 * @route PUT /api/patient-portal/profile
 * @desc Update patient profile information
 * @access Private (Patient)
 */
router.put(
  '/',
  patientPortalAuth,
  [
    body('firstName')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters')
      .trim(),
    body('lastName')
      .optional()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters')
      .trim(),
    body('phone')
      .optional()
      .isMobilePhone('any')
      .withMessage('Valid phone number is required'),
    body('dateOfBirth')
      .optional()
      .isISO8601()
      .withMessage('Valid date of birth is required'),
    body('language')
      .optional()
      .isIn(['en', 'yo', 'ig', 'ha'])
      .withMessage('Language must be one of: en, yo, ig, ha'),
    body('timezone')
      .optional()
      .isString()
      .withMessage('Timezone must be a valid string'),
    body('profileVisibility')
      .optional()
      .isIn(['private', 'limited', 'public'])
      .withMessage('Profile visibility must be private, limited, or public'),
    body('dataSharing')
      .optional()
      .isBoolean()
      .withMessage('Data sharing must be boolean'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const patientUserId = (req as any).patientUser.id;
      const updateData = req.body;

      // Remove fields that shouldn't be updated via this endpoint
      const allowedFields = [
        'firstName',
        'lastName', 
        'phone',
        'dateOfBirth',
        'language',
        'timezone',
        'avatar',
        'profileVisibility',
        'dataSharing',
      ];

      const filteredUpdateData: any = {};
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          filteredUpdateData[field] = updateData[field];
        }
      }

      // Convert dateOfBirth string to Date if provided
      if (filteredUpdateData.dateOfBirth) {
        filteredUpdateData.dateOfBirth = new Date(filteredUpdateData.dateOfBirth);
      }

      // Use PatientSyncService to handle the update and sync to Patient record
      await PatientSyncService.handlePatientUserProfileUpdate(patientUserId, filteredUpdateData);

      // Get updated profile
      const updatedPatientUser = await PatientUser.findById(patientUserId)
        .populate('workplaceId', 'name type')
        .select('-passwordHash -refreshTokens -verificationToken -resetToken');

      res.json({
        success: true,
        data: {
          profile: {
            id: updatedPatientUser!._id,
            firstName: updatedPatientUser!.firstName,
            lastName: updatedPatientUser!.lastName,
            email: updatedPatientUser!.email,
            phone: updatedPatientUser!.phone,
            dateOfBirth: updatedPatientUser!.dateOfBirth,
            status: updatedPatientUser!.status,
            emailVerified: updatedPatientUser!.emailVerified,
            phoneVerified: updatedPatientUser!.phoneVerified,
            notificationPreferences: updatedPatientUser!.notificationPreferences,
            language: updatedPatientUser!.language,
            timezone: updatedPatientUser!.timezone,
            avatar: updatedPatientUser!.avatar,
            profileVisibility: updatedPatientUser!.profileVisibility,
            dataSharing: updatedPatientUser!.dataSharing,
            onboardingCompleted: updatedPatientUser!.onboardingCompleted,
            workspaceId: (updatedPatientUser!.workplaceId as any)?._id?.toString() || updatedPatientUser!.workplaceId.toString(),
            workspaceName: (updatedPatientUser!.workplaceId as any)?.name || 'Healthcare Workspace',
            lastLoginAt: updatedPatientUser!.lastLoginAt,
            createdAt: updatedPatientUser!.createdAt,
            updatedAt: updatedPatientUser!.updatedAt,
          },
        },
        message: 'Profile updated successfully',
      });
    } catch (error) {
      logger.error('Update patient profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update profile',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }
);

/**
 * @route PUT /api/patient-portal/profile/notifications
 * @desc Update notification preferences
 * @access Private (Patient)
 */
router.put(
  '/notifications',
  patientPortalAuth,
  [
    body('email')
      .optional()
      .isBoolean()
      .withMessage('Email notification preference must be boolean'),
    body('sms')
      .optional()
      .isBoolean()
      .withMessage('SMS notification preference must be boolean'),
    body('push')
      .optional()
      .isBoolean()
      .withMessage('Push notification preference must be boolean'),
    body('whatsapp')
      .optional()
      .isBoolean()
      .withMessage('WhatsApp notification preference must be boolean'),
    body('appointmentReminders')
      .optional()
      .isBoolean()
      .withMessage('Appointment reminders preference must be boolean'),
    body('medicationReminders')
      .optional()
      .isBoolean()
      .withMessage('Medication reminders preference must be boolean'),
    body('healthTips')
      .optional()
      .isBoolean()
      .withMessage('Health tips preference must be boolean'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const patientUserId = (req as any).patientUser.id;
      const notificationPreferences = req.body;

      // Update notification preferences and sync to Patient record
      await PatientSyncService.handlePatientUserProfileUpdate(patientUserId, {
        notificationPreferences,
      });

      // Get updated preferences
      const updatedPatientUser = await PatientUser.findById(patientUserId)
        .select('notificationPreferences');

      res.json({
        success: true,
        data: {
          notificationPreferences: updatedPatientUser!.notificationPreferences,
        },
        message: 'Notification preferences updated successfully',
      });
    } catch (error) {
      logger.error('Update notification preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification preferences',
        error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
      });
    }
  }
);

/**
 * @route POST /api/patient-portal/profile/complete-onboarding
 * @desc Mark onboarding as completed
 * @access Private (Patient)
 */
router.post('/complete-onboarding', patientPortalAuth, async (req, res) => {
  try {
    const patientUserId = (req as any).patientUser.id;

    await PatientSyncService.handlePatientUserProfileUpdate(patientUserId, {
      onboardingCompleted: true,
    });

    res.json({
      success: true,
      message: 'Onboarding completed successfully',
    });
  } catch (error) {
    logger.error('Complete onboarding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete onboarding',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

/**
 * @route GET /api/patient-portal/profile/patient-record
 * @desc Get linked patient record information (read-only)
 * @access Private (Patient)
 */
router.get('/patient-record', patientPortalAuth, async (req, res) => {
  try {
    const patientUserId = (req as any).patientUser.id;
    
    const patientRecord = await PatientSyncService.getPatientRecordForUser(patientUserId);
    
    if (!patientRecord) {
      return res.status(404).json({
        success: false,
        message: 'No linked patient record found',
      });
    }

    // Return limited patient record information for patient portal
    res.json({
      success: true,
      data: {
        patientRecord: {
          id: patientRecord._id,
          mrn: patientRecord.mrn,
          firstName: patientRecord.firstName,
          lastName: patientRecord.lastName,
          email: patientRecord.email,
          phone: patientRecord.phone,
          dob: patientRecord.dob,
          age: patientRecord.getAge(),
          gender: patientRecord.gender,
          bloodGroup: patientRecord.bloodGroup,
          genotype: patientRecord.genotype,
          allergies: patientRecord.allergies,
          chronicConditions: patientRecord.chronicConditions,
          enhancedEmergencyContacts: patientRecord.enhancedEmergencyContacts,
          insuranceInfo: patientRecord.insuranceInfo,
          notificationPreferences: patientRecord.notificationPreferences,
          appointmentPreferences: patientRecord.appointmentPreferences,
          createdAt: patientRecord.createdAt,
          updatedAt: patientRecord.updatedAt,
        },
      },
      message: 'Patient record retrieved successfully',
    });
  } catch (error) {
    logger.error('Get patient record error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve patient record',
      error: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined,
    });
  }
});

export default router;