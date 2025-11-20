import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ValidationChain, validationResult } from 'express-validator';

/**
 * Middleware factory to validate request using express-validator
 * @param validations - Array of validation chains
 * @param location - Where to validate (body, query, params) - optional for backward compatibility
 * @returns Express middleware
 */
export const validateRequest = (
    validations: ValidationChain[],
    location?: 'body' | 'query' | 'params'
): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        // Run all validations
        await Promise.all(validations.map((validation) => validation.run(req)));

        // Check for validation errors
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
                        value: error.type === 'field' ? (error as any).value : undefined,
                        location: error.type === 'field' ? (error as any).location : undefined,
                    })),
                },
            });
            return;
        }

        next();
    };
};

export default validateRequest;
