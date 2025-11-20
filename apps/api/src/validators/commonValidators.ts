import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Patient from '../models/Patient';

interface AuthRequest extends Request {
  user?: {
    _id: string;
    workplaceId: string;
    [key: string]: any;
  };
}

/**
 * Middleware to validate patient ID
 */
export const validatePatientId = async (
  req: AuthRequest,
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

    // Check if patient exists in database
    const patient = await Patient.findOne({
      _id: patientId,
      workplaceId: req.user?.workplaceId,
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found',
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

/**
 * Middleware to validate date range parameters
 */
export const validateDateRange = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { startDate, endDate } = req.query;

    // If dates aren't provided, skip validation
    if (!startDate && !endDate) {
      return next();
    }

    // Validate date formats if provided
    if (startDate && !isValidDateString(startDate.toString())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid startDate format. Please use YYYY-MM-DD',
      });
    }

    if (endDate && !isValidDateString(endDate.toString())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid endDate format. Please use YYYY-MM-DD',
      });
    }

    // Check that startDate is before endDate if both are provided
    if (startDate && endDate) {
      const start = new Date(startDate.toString());
      const end = new Date(endDate.toString());

      if (start > end) {
        return res.status(400).json({
          success: false,
          message: 'startDate must be before or equal to endDate',
        });
      }
    }

    next();
  } catch (error) {
    console.error('Error validating date range:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during validation',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

/**
 * Helper function to validate date string format (YYYY-MM-DD)
 */
function isValidDateString(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}
