import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/**
 * Middleware to handle express-validator validation results
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array().map(error => ({
          field: error.type === 'field' ? (error as any).path : error.type,
          message: error.msg,
          value: error.type === 'field' ? (error as any).value : undefined
        }))
      }
    });
    return;
  }
  
  next();
};