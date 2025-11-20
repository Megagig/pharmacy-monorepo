import express from 'express';
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { auth } from '../middlewares/auth';
import {
  getEnhancedAdherenceAnalytics,
  getPrescriptionPatternAnalytics,
  getMedicationInteractionAnalytics,
  getMedicationCostAnalytics,
  getDashboardAnalytics,
  getPatientDemographicsAnalytics,
  getMedicationInventoryAnalytics,
} from '../controllers/medicationAnalyticsController';

// Local implementation of validatePatientId to avoid module resolution issues
// This mirrors the implementation in commonValidators.ts
const validatePatientId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { patientId } = req.params;

    // Allow 'system' as a special case for system-wide analytics
    if (patientId === 'system') {
      return next();
    }

    // Validate MongoDB ObjectID
    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid patient ID format',
      });
    }

    next();
  } catch (error) {
    console.error('Error validating patient ID:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during validation',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

// Enhanced analytics endpoints
router.get(
  '/adherence/:patientId',
  validatePatientId,
  getEnhancedAdherenceAnalytics
);
router.get(
  '/prescriptions/:patientId',
  validatePatientId,
  getPrescriptionPatternAnalytics
);
router.get(
  '/interactions/:patientId',
  validatePatientId,
  getMedicationInteractionAnalytics
);

// Cost analytics endpoint
router.get('/costs/:patientId', validatePatientId, getMedicationCostAnalytics);

// Dashboard analytics endpoint that combines all analytics
router.get('/dashboard/:patientId', validatePatientId, getDashboardAnalytics);

// Patient demographics analytics endpoint
router.get('/demographics/system', getPatientDemographicsAnalytics);

// Medication inventory analytics endpoint
router.get('/inventory/system', getMedicationInventoryAnalytics);

export default router;
