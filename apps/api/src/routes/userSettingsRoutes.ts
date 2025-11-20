import express from 'express';
import {
    getUserProfile,
    updateUserProfile,
    uploadAvatar,
    getUserPreferences,
    updateUserPreferences,
    getSecuritySettings,
    updateSecuritySettings,
    changePassword,
    enable2FA,
    verify2FA,
    disable2FA,
} from '../controllers/userSettingsController';
import { auth } from '../middlewares/auth';
import { upload } from '../utils/fileUpload';

const router = express.Router();

// All routes require authentication
router.use(auth);

// Profile routes
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.post('/profile/avatar', upload.single('avatar'), uploadAvatar);

// Preferences routes
router.get('/preferences', getUserPreferences);
router.put('/preferences', updateUserPreferences);

// Security routes
router.get('/security', getSecuritySettings);
router.put('/security', updateSecuritySettings);
router.post('/security/change-password', changePassword);

// 2FA routes
router.post('/security/2fa/enable', enable2FA);
router.post('/security/2fa/verify', verify2FA);
router.post('/security/2fa/disable', disable2FA);

export default router;
