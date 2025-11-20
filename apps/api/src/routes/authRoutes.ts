import express from 'express';
import {
  register,
  registerWithWorkplace,
  findWorkplaceByInviteCode,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  logoutAll,
  clearCookies,
  checkCookiesStatus,
  getMe,
  updateProfile,
  updateThemePreference,
} from '../controllers/authController';
import { auth } from '../middlewares/auth';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/register-with-workplace', registerWithWorkplace); // New multi-step registration
router.get('/workplace/invite/:inviteCode', findWorkplaceByInviteCode); // Find workplace by invite code
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);
router.post('/clear-cookies', clearCookies); // No auth required
router.get('/check-cookies', checkCookiesStatus); // No auth required - just checks if cookies exist

// Protected routes
router.post('/logout', logout);
router.post('/logout-all', logoutAll);
router.get('/me', auth, getMe);
router.put('/profile', auth, updateProfile);
router.patch('/theme', auth, updateThemePreference);

export default router;
