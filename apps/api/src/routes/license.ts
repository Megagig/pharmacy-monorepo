import express from 'express';
import { auth, requireLicense } from '../middlewares/auth';
import { licenseController, upload } from '../controllers/licenseController';

const router = express.Router();

// All license routes require authentication
router.use(auth);

// License upload and management
router.post('/upload', upload.single('licenseDocument'), licenseController.uploadLicense);
router.get('/status', licenseController.getLicenseStatus);
router.delete('/document', licenseController.deleteLicenseDocument);
router.post('/validate-number', licenseController.validateLicenseNumber);

// License document download (for user and admins)
router.get('/document/:userId', licenseController.downloadLicenseDocument);

// Admin-only routes
router.post('/bulk-process', licenseController.bulkProcessLicenses);

export default router;