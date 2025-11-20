import { Router } from 'express';
import { 
  getPatientNotificationPreferences,
  updatePatientNotificationPreferences,
  getPatientOptOutStatus,
  updatePatientOptOutStatus
} from '../controllers/patientNotificationPreferencesController';
import { 
  validateNotificationPreferences,
  validateOptOutStatus,
  validatePatientId
} from '../validators/patientNotificationPreferencesValidators';
import { validateRequest } from '../middlewares/validation';
import { auth } from '../middlewares/auth';
import { requireDynamicPermission } from '../middlewares/rbac';

const router = Router();

// Apply authentication to all routes
router.use(auth);

// Patient notification preferences routes
router.get(
  '/:patientId/preferences',
  validatePatientId,
  validateRequest,
  requireDynamicPermission('patient:read'),
  getPatientNotificationPreferences
);

router.put(
  '/:patientId/preferences',
  validateNotificationPreferences,
  validateRequest,
  requireDynamicPermission('patient:update'),
  updatePatientNotificationPreferences
);

// Patient opt-out management routes
router.get(
  '/:patientId/opt-out',
  validatePatientId,
  validateRequest,
  requireDynamicPermission('patient:read'),
  getPatientOptOutStatus
);

router.put(
  '/:patientId/opt-out',
  validateOptOutStatus,
  validateRequest,
  requireDynamicPermission('patient:update'),
  updatePatientOptOutStatus
);

export default router;