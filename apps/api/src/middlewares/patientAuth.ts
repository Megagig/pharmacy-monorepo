import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    _id: string;
    workplaceId: string;
    role: string;
  };
}

// Export PatientAuthRequest for use in controllers
export interface PatientAuthRequest extends Request {
  patientUser?: {
    _id: string;
    workplaceId: string;
    patientId?: string;
    firstName: string;
    lastName: string;
    email: string;
    status: string;
  };
}

/**
 * Middleware to validate patient access to their own data
 * Allows:
 * - Patients to access their own data only
 * - Admins to access any patient data
 * - Pharmacists to access patient data in their workspace
 */
export const validatePatientAccess = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { patientId } = req.params;
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!user.workplaceId) {
      res.status(401).json({ error: 'Workspace not found' });
      return;
    }

    // Admin can access any patient data in their workspace
    if (user.role === 'admin') {
      next();
      return;
    }

    // Pharmacists can access patient data in their workspace
    if (user.role === 'pharmacist') {
      next();
      return;
    }

    // Patients can only access their own data
    if (user.role === 'patient') {
      if (user._id !== patientId) {
        res.status(403).json({
          error: 'Access denied',
          message: 'Patients can only access their own data'
        });
        return;
      }
      next();
      return;
    }

    // Default deny for any other roles
    res.status(403).json({
      error: 'Access denied',
      message: 'Insufficient permissions'
    });
  } catch (error) {
    logger.error('Error in validatePatientAccess middleware:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate patient access'
    });
  }
};

/**
 * Middleware to validate pharmacist access to their own ratings
 * Allows:
 * - Pharmacists to access their own ratings only
 * - Admins to access any pharmacist ratings
 */
export const validatePharmacistAccess = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const { pharmacistId } = req.params;
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!user.workplaceId) {
      res.status(401).json({ error: 'Workspace not found' });
      return;
    }

    // Admin can access any pharmacist data in their workspace
    if (user.role === 'admin') {
      next();
      return;
    }

    // Pharmacists can only access their own ratings
    if (user.role === 'pharmacist') {
      if (user._id !== pharmacistId) {
        res.status(403).json({
          error: 'Access denied',
          message: 'Pharmacists can only access their own ratings'
        });
        return;
      }
      next();
      return;
    }

    // Default deny for any other roles
    res.status(403).json({
      error: 'Access denied',
      message: 'Insufficient permissions'
    });
  } catch (error) {
    logger.error('Error in validatePharmacistAccess middleware:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate pharmacist access'
    });
  }
};

/**
 * Middleware to ensure only admins can access certain endpoints
 */
export const requireAdminAccess = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (user.role !== 'admin') {
      res.status(403).json({
        error: 'Access denied',
        message: 'Admin access required'
      });
      return;
    }

    next();
  } catch (error) {
    logger.error('Error in requireAdminAccess middleware:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate admin access'
    });
  }
};

/**
 * Export patientAuth middleware (alias for patientPortalAuth)
 */
export { patientPortalAuth as patientAuth } from './patientPortalAuth';