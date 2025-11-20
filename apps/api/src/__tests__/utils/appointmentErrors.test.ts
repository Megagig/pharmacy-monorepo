import {
    AppointmentError,
    ValidationError,
    ConflictError,
    AppointmentAuthorizationError,
    AppointmentBusinessLogicError,
    AppointmentNotFoundError,
    createValidationError,
    createConflictError,
    createAppointmentBusinessLogicError,
    isAppointmentError,
    isValidationError,
    isConflictError,
    getAppointmentErrorSeverity,
    getAppointmentErrorRecovery,
    AppointmentErrorSeverity
} from '../../utils/appointmentErrors';

describe('Appointment Errors', () => {
    describe('AppointmentError', () => {
        it('should create base appointment error with correct properties', () => {
            const error = new AppointmentError(
                'Test error message',
                400,
                'TestError',
                [{ field: 'test', message: 'Test detail' }]
            );

            expect(error.message).toBe('Test error message');
            expect(error.statusCode).toBe(400);
            expect(error.errorType).toBe('TestError');
            expect(error.details).toHaveLength(1);
            expect(error.isOperational).toBe(true);
            expect(error.timestamp).toBeInstanceOf(Date);
        });

        it('should have proper stack trace', () => {
            const error = new AppointmentError('Test error');
            expect(error.stack).toBeDefined();
            expect(error.stack).toContain('AppointmentError');
        });

        it('should serialize to JSON correctly', () => {
            const error = new AppointmentError(
                'Test error',
                400,
                'TestError',
                [{ field: 'test', message: 'Test detail' }]
            );

            const json = error.toJSON();
            expect(json.name).toBe('AppointmentError');
            expect(json.message).toBe('Test error');
            expect(json.statusCode).toBe(400);
            expect(json.errorType).toBe('TestError');
            expect(json.details).toHaveLength(1);
            expect(json.timestamp).toBeInstanceOf(Date);
        });
    });

    describe('ValidationError', () => {
        it('should create validation error with 400 status code', () => {
            const error = new ValidationError('Validation failed', [
                { field: 'email', message: 'Invalid email format' }
            ]);

            expect(error.statusCode).toBe(400);
            expect(error.errorType).toBe('ValidationError');
            expect(error.message).toBe('Validation failed');
            expect(error.details).toHaveLength(1);
        });

        it('should be identified by type guard', () => {
            const error = new ValidationError('Validation failed');
            expect(isValidationError(error)).toBe(true);
            expect(isAppointmentError(error)).toBe(true);
        });
    });

    describe('ConflictError', () => {
        it('should create conflict error with 409 status code', () => {
            const error = new ConflictError('Scheduling conflict', [
                { field: 'scheduledTime', message: 'Time slot already booked' }
            ]);

            expect(error.statusCode).toBe(409);
            expect(error.errorType).toBe('ConflictError');
            expect(error.message).toBe('Scheduling conflict');
        });

        it('should be identified by type guard', () => {
            const error = new ConflictError('Conflict');
            expect(isConflictError(error)).toBe(true);
            expect(isAppointmentError(error)).toBe(true);
        });
    });

    describe('AppointmentAuthorizationError', () => {
        it('should create authorization error with 403 status code', () => {
            const error = new AppointmentAuthorizationError('Access denied');

            expect(error.statusCode).toBe(403);
            expect(error.errorType).toBe('AppointmentAuthorizationError');
        });
    });

    describe('AppointmentBusinessLogicError', () => {
        it('should create business logic error with 422 status code', () => {
            const error = new AppointmentBusinessLogicError('Business rule violated');

            expect(error.statusCode).toBe(422);
            expect(error.errorType).toBe('AppointmentBusinessLogicError');
        });
    });

    describe('AppointmentNotFoundError', () => {
        it('should create not found error with resource details', () => {
            const error = new AppointmentNotFoundError(
                'Resource not found',
                'Appointment',
                '123'
            );

            expect(error.statusCode).toBe(404);
            expect(error.errorType).toBe('AppointmentNotFoundError');
            expect(error.details).toHaveLength(2);
            expect(error.details![0].field).toBe('resourceType');
            expect(error.details![1].field).toBe('resourceId');
        });
    });

    describe('Error Factory Functions', () => {
        it('should create validation error with factory', () => {
            const error = createValidationError('email', 'Invalid email', 'test@');

            expect(error).toBeInstanceOf(ValidationError);
            expect(error.details).toHaveLength(1);
            expect(error.details![0].field).toBe('email');
            expect(error.details![0].message).toBe('Invalid email');
            expect(error.details![0].value).toBe('test@');
        });

        it('should create conflict error with factory', () => {
            const error = createConflictError('Time slot conflict', [
                { field: 'time', message: 'Already booked' }
            ]);

            expect(error).toBeInstanceOf(ConflictError);
            expect(error.message).toContain('Time slot conflict');
        });

        it('should create business logic error with factory', () => {
            const error = createAppointmentBusinessLogicError(
                'Invalid duration',
                'DURATION_TOO_SHORT'
            );

            expect(error).toBeInstanceOf(AppointmentBusinessLogicError);
            expect(error.details).toHaveLength(1);
            expect(error.details![0].field).toBe('businessRule');
        });
    });

    describe('Error Severity', () => {
        it('should return CRITICAL for 500+ status codes', () => {
            const error = new AppointmentError('Server error', 500);
            const severity = getAppointmentErrorSeverity(error);
            expect(severity).toBe(AppointmentErrorSeverity.CRITICAL);
        });

        it('should return HIGH for authorization errors', () => {
            const error = new AppointmentAuthorizationError('Access denied');
            const severity = getAppointmentErrorSeverity(error);
            expect(severity).toBe(AppointmentErrorSeverity.HIGH);
        });

        it('should return MEDIUM for business logic errors', () => {
            const error = new AppointmentBusinessLogicError('Rule violated');
            const severity = getAppointmentErrorSeverity(error);
            expect(severity).toBe(AppointmentErrorSeverity.MEDIUM);
        });

        it('should return MEDIUM for conflict errors', () => {
            const error = new ConflictError('Scheduling conflict');
            const severity = getAppointmentErrorSeverity(error);
            expect(severity).toBe(AppointmentErrorSeverity.MEDIUM);
        });

        it('should return LOW for validation errors', () => {
            const error = new ValidationError('Validation failed');
            const severity = getAppointmentErrorSeverity(error);
            expect(severity).toBe(AppointmentErrorSeverity.LOW);
        });
    });

    describe('Error Recovery Suggestions', () => {
        it('should provide recovery suggestions for validation errors', () => {
            const error = new ValidationError('Validation failed');
            const suggestions = getAppointmentErrorRecovery(error);

            expect(suggestions).toBeInstanceOf(Array);
            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions).toContain('Check input data format and required fields');
        });

        it('should provide recovery suggestions for conflict errors', () => {
            const error = new ConflictError('Scheduling conflict');
            const suggestions = getAppointmentErrorRecovery(error);

            expect(suggestions).toContain('Choose a different time slot');
            expect(suggestions).toContain('Check pharmacist availability');
        });

        it('should provide recovery suggestions for authorization errors', () => {
            const error = new AppointmentAuthorizationError('Access denied');
            const suggestions = getAppointmentErrorRecovery(error);

            expect(suggestions).toContain('Verify your permissions');
        });

        it('should provide recovery suggestions for business logic errors', () => {
            const error = new AppointmentBusinessLogicError('Rule violated');
            const suggestions = getAppointmentErrorRecovery(error);

            expect(suggestions).toContain('Review appointment scheduling rules');
        });
    });

    describe('Type Guards', () => {
        it('should correctly identify appointment errors', () => {
            const appointmentError = new AppointmentError('Test');
            const validationError = new ValidationError('Test');
            const genericError = new Error('Test');

            expect(isAppointmentError(appointmentError)).toBe(true);
            expect(isAppointmentError(validationError)).toBe(true);
            expect(isAppointmentError(genericError)).toBe(false);
        });

        it('should correctly identify validation errors', () => {
            const validationError = new ValidationError('Test');
            const conflictError = new ConflictError('Test');

            expect(isValidationError(validationError)).toBe(true);
            expect(isValidationError(conflictError)).toBe(false);
        });

        it('should correctly identify conflict errors', () => {
            const conflictError = new ConflictError('Test');
            const validationError = new ValidationError('Test');

            expect(isConflictError(conflictError)).toBe(true);
            expect(isConflictError(validationError)).toBe(false);
        });
    });
});
