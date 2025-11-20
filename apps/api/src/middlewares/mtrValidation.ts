import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';
import mongoose from 'mongoose';
import {
  MTRValidationError,
  MTRAuthorizationError,
  MTRBusinessLogicError,
} from '../utils/mtrErrors';
import logger from '../utils/logger';

// Extend Request interface to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    licenseStatus?: string;
  };
}

/**
 * MTR Validation Middleware
 * Handles comprehensive input validation for MTR operations
 * Requirements: 2.4, 4.4, 7.1, 8.4
 */

// Validation result handler
export const handleValidationErrors = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const validationErrors = errors.array().map((error: ValidationError) => ({
      field: error.type === 'field' ? error.path : 'unknown',
      message: error.msg,
      value: error.type === 'field' ? error.value : undefined,
      location: 'location' in error ? error.location : 'body',
    }));

    // Log validation failure for audit trail (Requirement 7.1)
    logger.warn('MTR validation failed', {
      userId: req.user?.id,
      endpoint: req.originalUrl,
      method: req.method,
      errors: validationErrors,
      timestamp: new Date().toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });

    const error = new MTRValidationError(
      'Validation failed for MTR operation',
      validationErrors
    );

    return next(error);
  }

  next();
};

// Medication history validation (Requirement 2.4)
export const validateMedicationHistory = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { medications } = req.body;

    if (!Array.isArray(medications)) {
      throw new MTRValidationError('Medications must be provided as an array');
    }

    // Validate each medication entry
    const validationErrors: any[] = [];

    medications.forEach((medication: any, index: number) => {
      // Required field validation
      const requiredFields = [
        'drugName',
        'strength',
        'dosageForm',
        'instructions',
        'category',
        'startDate',
        'indication',
      ];

      requiredFields.forEach((field) => {
        if (!medication[field]) {
          validationErrors.push({
            field: `medications[${index}].${field}`,
            message: `${field} is required`,
            value: medication[field],
          });
        }
      });

      // Strength validation
      if (medication.strength) {
        if (!medication.strength.value || !medication.strength.unit) {
          validationErrors.push({
            field: `medications[${index}].strength`,
            message: 'Strength must include both value and unit',
            value: medication.strength,
          });
        }

        if (
          typeof medication.strength.value !== 'number' ||
          medication.strength.value <= 0
        ) {
          validationErrors.push({
            field: `medications[${index}].strength.value`,
            message: 'Strength value must be a positive number',
            value: medication.strength.value,
          });
        }
      }

      // Instructions validation
      if (medication.instructions) {
        const requiredInstructions = ['dose', 'frequency', 'route'];
        requiredInstructions.forEach((field) => {
          if (!medication.instructions[field]) {
            validationErrors.push({
              field: `medications[${index}].instructions.${field}`,
              message: `${field} is required in instructions`,
              value: medication.instructions[field],
            });
          }
        });
      }

      // Date validation
      if (medication.startDate && !isValidDate(medication.startDate)) {
        validationErrors.push({
          field: `medications[${index}].startDate`,
          message: 'Start date must be a valid date',
          value: medication.startDate,
        });
      }

      if (medication.endDate && !isValidDate(medication.endDate)) {
        validationErrors.push({
          field: `medications[${index}].endDate`,
          message: 'End date must be a valid date',
          value: medication.endDate,
        });
      }

      // End date should be after start date
      if (medication.startDate && medication.endDate) {
        const startDate = new Date(medication.startDate);
        const endDate = new Date(medication.endDate);

        if (endDate <= startDate) {
          validationErrors.push({
            field: `medications[${index}].endDate`,
            message: 'End date must be after start date',
            value: medication.endDate,
          });
        }
      }

      // Category validation
      const validCategories = ['prescribed', 'otc', 'herbal', 'supplement'];
      if (
        medication.category &&
        !validCategories.includes(medication.category)
      ) {
        validationErrors.push({
          field: `medications[${index}].category`,
          message: `Category must be one of: ${validCategories.join(', ')}`,
          value: medication.category,
        });
      }

      // Adherence score validation
      if (medication.adherenceScore !== undefined) {
        if (
          typeof medication.adherenceScore !== 'number' ||
          medication.adherenceScore < 0 ||
          medication.adherenceScore > 100
        ) {
          validationErrors.push({
            field: `medications[${index}].adherenceScore`,
            message: 'Adherence score must be a number between 0 and 100',
            value: medication.adherenceScore,
          });
        }
      }
    });

    if (validationErrors.length > 0) {
      // Log validation failure (Requirement 7.1)
      logger.warn('Medication history validation failed', {
        userId: req.user?.id,
        patientId: req.params.patientId || req.body.patientId,
        errors: validationErrors,
        timestamp: new Date().toISOString(),
      });

      throw new MTRValidationError(
        'Medication history validation failed',
        validationErrors
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Therapy plan validation (Requirement 4.4)
export const validateTherapyPlan = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { plan } = req.body;

    if (!plan) {
      throw new MTRValidationError('Therapy plan is required');
    }

    const validationErrors: any[] = [];

    // Validate recommendations link to problems (Requirement 4.4)
    if (
      !plan.problems ||
      !Array.isArray(plan.problems) ||
      plan.problems.length === 0
    ) {
      validationErrors.push({
        field: 'plan.problems',
        message:
          'Therapy plan must be linked to at least one drug therapy problem',
        value: plan.problems,
      });
    }

    // Validate problem IDs are valid ObjectIds
    if (plan.problems && Array.isArray(plan.problems)) {
      plan.problems.forEach((problemId: string, index: number) => {
        if (!mongoose.Types.ObjectId.isValid(problemId)) {
          validationErrors.push({
            field: `plan.problems[${index}]`,
            message: 'Invalid problem ID format',
            value: problemId,
          });
        }
      });
    }

    // Validate recommendations
    if (
      !plan.recommendations ||
      !Array.isArray(plan.recommendations) ||
      plan.recommendations.length === 0
    ) {
      validationErrors.push({
        field: 'plan.recommendations',
        message: 'At least one recommendation is required',
        value: plan.recommendations,
      });
    }

    if (plan.recommendations && Array.isArray(plan.recommendations)) {
      plan.recommendations.forEach((recommendation: any, index: number) => {
        const requiredFields = [
          'type',
          'rationale',
          'priority',
          'expectedOutcome',
        ];

        requiredFields.forEach((field) => {
          if (!recommendation[field]) {
            validationErrors.push({
              field: `plan.recommendations[${index}].${field}`,
              message: `${field} is required for each recommendation`,
              value: recommendation[field],
            });
          }
        });

        // Validate recommendation type
        const validTypes = [
          'discontinue',
          'adjust_dose',
          'switch_therapy',
          'add_therapy',
          'monitor',
        ];
        if (recommendation.type && !validTypes.includes(recommendation.type)) {
          validationErrors.push({
            field: `plan.recommendations[${index}].type`,
            message: `Recommendation type must be one of: ${validTypes.join(
              ', '
            )}`,
            value: recommendation.type,
          });
        }

        // Validate priority
        const validPriorities = ['high', 'medium', 'low'];
        if (
          recommendation.priority &&
          !validPriorities.includes(recommendation.priority)
        ) {
          validationErrors.push({
            field: `plan.recommendations[${index}].priority`,
            message: `Priority must be one of: ${validPriorities.join(', ')}`,
            value: recommendation.priority,
          });
        }
      });
    }

    // Validate monitoring plan
    if (plan.monitoringPlan && Array.isArray(plan.monitoringPlan)) {
      plan.monitoringPlan.forEach((parameter: any, index: number) => {
        if (!parameter.parameter || !parameter.frequency) {
          validationErrors.push({
            field: `plan.monitoringPlan[${index}]`,
            message:
              'Monitoring parameters must include parameter and frequency',
            value: parameter,
          });
        }
      });
    }

    // Validate goals
    if (plan.goals && Array.isArray(plan.goals)) {
      plan.goals.forEach((goal: any, index: number) => {
        const requiredGoalFields = ['description', 'targetValue', 'timeframe'];

        requiredGoalFields.forEach((field) => {
          if (!goal[field]) {
            validationErrors.push({
              field: `plan.goals[${index}].${field}`,
              message: `${field} is required for each therapy goal`,
              value: goal[field],
            });
          }
        });
      });
    }

    if (validationErrors.length > 0) {
      // Log validation failure (Requirement 7.1)
      logger.warn('Therapy plan validation failed', {
        userId: req.user?.id,
        reviewId: req.params.id,
        errors: validationErrors,
        timestamp: new Date().toISOString(),
      });

      throw new MTRValidationError(
        'Therapy plan validation failed',
        validationErrors
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

// MTR session authorization validation (Requirement 8.4)
export const validateMTRAccess = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;

    if (!user) {
      // Log unauthorized access attempt (Requirement 7.1, 8.4)
      logger.warn('Unauthorized MTR access attempt', {
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
      });

      throw new MTRAuthorizationError('Authentication required for MTR access');
    }

    // Verify user has appropriate role (Requirement 8.1)
    // Updated to match the actual role hierarchy from auth middleware
    if (
      !user.role ||
      ![
        'pharmacist',
        'pharmacy_team',
        'pharmacy_outlet',
        'super_admin',
      ].includes(user.role)
    ) {
      // Log insufficient permissions (Requirement 7.1, 8.4)
      logger.warn('Insufficient permissions for MTR access', {
        userId: user.id,
        userRole: user.role,
        endpoint: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
      });

      // Update error message to include super_admin role
      throw new MTRAuthorizationError(
        'Authorized role required for MTR operations'
      );
    }

    // Check license status if available
    // Accept both 'active' and 'approved' license statuses, or exempt super_admin
    if (user.role !== 'super_admin') {
      // Only check license for non super_admin users
      if (
        user.licenseStatus &&
        !['active', 'approved'].includes(user.licenseStatus)
      ) {
        // Log inactive license access attempt (Requirement 7.1, 8.4)
        logger.warn('MTR access attempt with inactive license', {
          userId: user.id,
          licenseStatus: user.licenseStatus,
          endpoint: req.originalUrl,
          timestamp: new Date().toISOString(),
        });

        throw new MTRAuthorizationError(
          'Active or approved pharmacist license required for MTR operations'
        );
      }
    }

    // Log successful access for audit trail (Requirement 7.1)
    logger.info('MTR access granted', {
      userId: user.id,
      userRole: user.role,
      endpoint: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
    });

    next();
  } catch (error) {
    next(error);
  }
};

// Business logic validation for MTR operations
export const validateMTRBusinessLogic = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { method, originalUrl } = req;
    const validationErrors: Array<{
      field: string;
      message: string;
      value?: unknown;
    }> = [];

    // Validate step completion order
    if (originalUrl.includes('/step/') && method === 'PUT') {
      const stepName = req.params.stepName;
      const { completed, data } = req.body;

      if (completed && !data) {
        validationErrors.push({
          field: 'data',
          message: 'Step data is required when marking step as completed',
          value: data,
        });
      }

      // Validate step sequence
      const stepOrder = [
        'patientSelection',
        'medicationHistory',
        'therapyAssessment',
        'planDevelopment',
        'interventions',
        'followUp',
      ];
      const currentStepIndex = stepOrder.indexOf(stepName || '');

      if (currentStepIndex === -1) {
        validationErrors.push({
          field: 'stepName',
          message: 'Invalid step name',
          value: stepName,
        });
      }
    }

    // Validate intervention requirements
    if (originalUrl.includes('/interventions') && method === 'POST') {
      const { type, targetAudience, communicationMethod } = req.body;

      // Validate communication method matches target audience
      if (
        targetAudience === 'prescriber' &&
        !['written', 'phone', 'email', 'fax'].includes(communicationMethod)
      ) {
        validationErrors.push({
          field: 'communicationMethod',
          message:
            'Prescriber communications must use written, phone, email, or fax methods',
          value: communicationMethod,
        });
      }
    }

    if (validationErrors.length > 0) {
      throw new MTRBusinessLogicError(
        'MTR business logic validation failed',
        validationErrors
      );
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Utility functions
const isValidDate = (dateString: string): boolean => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

// Export validation middleware combinations
export const mtrValidationMiddleware = {
  // Core validation
  handleValidationErrors,
  validateMTRAccess,
  validateMTRBusinessLogic,

  // Specific validations
  validateMedicationHistory,
  validateTherapyPlan,
};
