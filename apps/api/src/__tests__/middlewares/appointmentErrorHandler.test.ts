import { Request, Response, NextFunction } from 'express';
import {
    appointmentErrorHandler,
    asyncHandler,
    appointmentNotFoundHandler
} from '../../middlewares/appointmentErrorHandler';
import {
    ValidationError,
    ConflictError,
    AppointmentAuthorizationError,
    AppointmentNotFoundError
} from '../../utils/appointmentErrors';

describe('Appointment Error Handler Middleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockRequest = {
            originalUrl: '/api/appointments',
            method: 'POST',
            body: {},
            headers: {}
        };

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            headersSent: false
        };

        mockNext = jest.fn();
    });

    describe('appointmentErrorHandler', () => {
        it('should handle ValidationError correctly', () => {
            const error = new ValidationError('Validation failed', [
                { field: 'email', message: 'Invalid email format' }
            ]);

            appointmentErrorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Validation failed',
                    code: 'ValidationError',
                    details: expect.arrayContaining([
                        expect.objectContaining({
                            field: 'email',
                            message: 'Invalid email format'
                        })
                    ])
                })
            );
        });

        it('should handle ConflictError correctly', () => {
            const error = new ConflictError('Scheduling conflict', [
                { field: 'scheduledTime', message: 'Time slot already booked' }
            ]);

            appointmentErrorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(409);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Scheduling conflict',
                    code: 'ConflictError'
                })
            );
        });

        it('should handle AppointmentAuthorizationError correctly', () => {
            const error = new AppointmentAuthorizationError('Access denied');

            appointmentErrorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Access denied',
                    code: 'AppointmentAuthorizationError'
                })
            );
        });

        it('should handle AppointmentNotFoundError correctly', () => {
            const error = new AppointmentNotFoundError(
                'Appointment not found',
                'Appointment',
                '123'
            );

            appointmentErrorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(404);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Appointment not found',
                    code: 'AppointmentNotFoundError'
                })
            );
        });

        it('should handle Mongoose ValidationError', () => {
            const error: any = {
                name: 'ValidationError',
                message: 'Validation failed',
                errors: {
                    email: {
                        message: 'Email is required',
                        value: '',
                        kind: 'required'
                    }
                }
            };

            appointmentErrorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Database validation failed',
                    code: 'ValidationError'
                })
            );
        });

        it('should handle Mongoose CastError', () => {
            const error: any = {
                name: 'CastError',
                message: 'Cast to ObjectId failed',
                path: 'appointmentId',
                value: 'invalid-id'
            };

            appointmentErrorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Invalid ID format',
                    code: 'ValidationError'
                })
            );
        });

        it('should handle MongoDB duplicate key error', () => {
            const error: any = {
                code: 11000,
                message: 'Duplicate key error',
                keyPattern: { email: 1 }
            };

            appointmentErrorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(409);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Duplicate record',
                    code: 'ConflictError'
                })
            );
        });

        it('should handle JWT errors', () => {
            const error: any = {
                name: 'JsonWebTokenError',
                message: 'Invalid token'
            };

            appointmentErrorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(401);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Authentication failed',
                    code: 'AppointmentAuthenticationError'
                })
            );
        });

        it('should handle generic errors', () => {
            const error = new Error('Unexpected error');

            appointmentErrorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.status).toHaveBeenCalledWith(500);
            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    code: 'INTERNAL_SERVER_ERROR'
                })
            );
        });

        it('should delegate to next if headers already sent', () => {
            mockResponse.headersSent = true;
            const error = new Error('Test error');

            appointmentErrorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalledWith(error);
            expect(mockResponse.status).not.toHaveBeenCalled();
        });

        it('should include stack trace in development mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const error = new ValidationError('Test error');

            appointmentErrorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    stack: expect.any(String)
                })
            );

            process.env.NODE_ENV = originalEnv;
        });

        it('should include recovery suggestions for appointment errors', () => {
            const error = new ValidationError('Validation failed');

            appointmentErrorHandler(
                error,
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockResponse.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    recovery: expect.arrayContaining([
                        expect.any(String)
                    ])
                })
            );
        });
    });

    describe('asyncHandler', () => {
        it('should handle successful async operations', async () => {
            const asyncFn = jest.fn().mockResolvedValue('success');
            const wrappedFn = asyncHandler(asyncFn);

            await wrappedFn(mockRequest as Request, mockResponse as Response, mockNext);

            expect(asyncFn).toHaveBeenCalled();
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should catch and forward async errors', async () => {
            const error = new Error('Async error');
            const asyncFn = jest.fn().mockRejectedValue(error);
            const wrappedFn = asyncHandler(asyncFn);

            await wrappedFn(mockRequest as Request, mockResponse as Response, mockNext);

            expect(asyncFn).toHaveBeenCalled();
            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });

    describe('appointmentNotFoundHandler', () => {
        it('should create not found error for unmatched routes', () => {
            mockRequest.method = 'GET';
            mockRequest.originalUrl = '/api/appointments/invalid-route';

            appointmentNotFoundHandler(
                mockRequest as Request,
                mockResponse as Response,
                mockNext
            );

            expect(mockNext).toHaveBeenCalledWith(
                expect.objectContaining({
                    statusCode: 404,
                    errorType: 'AppointmentNotFoundError',
                    message: expect.stringContaining('Route not found')
                })
            );
        });
    });
});
