import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import {
    createAppointmentSchema,
    updateAppointmentSchema,
    updateAppointmentStatusSchema,
    rescheduleAppointmentSchema,
    cancelAppointmentSchema,
    appointmentQuerySchema,
    availableSlotsQuerySchema,
    validateRequest
} from '../../validators/appointmentValidators';

describe('Appointment Validators', () => {
    describe('createAppointmentSchema', () => {
        it('should pass validation with valid appointment data', async () => {
            const req = {
                body: {
                    patientId: '507f1f77bcf86cd799439011',
                    type: 'mtm_session',
                    scheduledDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                    scheduledTime: '10:00',
                    duration: 30
                }
            } as Request;

            await Promise.all(createAppointmentSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(true);
        });

        it('should fail validation with missing required fields', async () => {
            const req = {
                body: {}
            } as Request;

            await Promise.all(createAppointmentSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ path: 'patientId' }),
                    expect.objectContaining({ path: 'type' }),
                    expect.objectContaining({ path: 'scheduledDate' }),
                    expect.objectContaining({ path: 'scheduledTime' }),
                    expect.objectContaining({ path: 'duration' })
                ])
            );
        });

        it('should fail validation with invalid appointment type', async () => {
            const req = {
                body: {
                    patientId: '507f1f77bcf86cd799439011',
                    type: 'invalid_type',
                    scheduledDate: new Date(Date.now() + 86400000).toISOString(),
                    scheduledTime: '10:00',
                    duration: 30
                }
            } as Request;

            await Promise.all(createAppointmentSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'type',
                        msg: 'Invalid appointment type'
                    })
                ])
            );
        });

        it('should fail validation with past date', async () => {
            const req = {
                body: {
                    patientId: '507f1f77bcf86cd799439011',
                    type: 'mtm_session',
                    scheduledDate: new Date(Date.now() - 86400000).toISOString(), // Yesterday
                    scheduledTime: '10:00',
                    duration: 30
                }
            } as Request;

            await Promise.all(createAppointmentSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'scheduledDate',
                        msg: 'Scheduled date cannot be in the past'
                    })
                ])
            );
        });

        it('should fail validation with invalid time format', async () => {
            const req = {
                body: {
                    patientId: '507f1f77bcf86cd799439011',
                    type: 'mtm_session',
                    scheduledDate: new Date(Date.now() + 86400000).toISOString(),
                    scheduledTime: '25:00', // Invalid hour
                    duration: 30
                }
            } as Request;

            await Promise.all(createAppointmentSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'scheduledTime',
                        msg: 'Scheduled time must be in HH:mm format'
                    })
                ])
            );
        });

        it('should fail validation with invalid duration', async () => {
            const req = {
                body: {
                    patientId: '507f1f77bcf86cd799439011',
                    type: 'mtm_session',
                    scheduledDate: new Date(Date.now() + 86400000).toISOString(),
                    scheduledTime: '10:00',
                    duration: 200 // Exceeds maximum
                }
            } as Request;

            await Promise.all(createAppointmentSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'duration',
                        msg: 'Duration must be between 5 and 120 minutes'
                    })
                ])
            );
        });

        it('should validate recurring appointment with pattern', async () => {
            const req = {
                body: {
                    patientId: '507f1f77bcf86cd799439011',
                    type: 'chronic_disease_review',
                    scheduledDate: new Date(Date.now() + 86400000).toISOString(),
                    scheduledTime: '10:00',
                    duration: 30,
                    isRecurring: true,
                    recurrencePattern: {
                        frequency: 'weekly',
                        interval: 1,
                        endAfterOccurrences: 10
                    }
                }
            } as Request;

            await Promise.all(createAppointmentSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(true);
        });

        it('should fail validation with invalid recurrence frequency', async () => {
            const req = {
                body: {
                    patientId: '507f1f77bcf86cd799439011',
                    type: 'chronic_disease_review',
                    scheduledDate: new Date(Date.now() + 86400000).toISOString(),
                    scheduledTime: '10:00',
                    duration: 30,
                    isRecurring: true,
                    recurrencePattern: {
                        frequency: 'invalid_frequency',
                        interval: 1
                    }
                }
            } as Request;

            await Promise.all(createAppointmentSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'recurrencePattern.frequency',
                        msg: 'Invalid recurrence frequency'
                    })
                ])
            );
        });
    });

    describe('updateAppointmentStatusSchema', () => {
        it('should pass validation with valid status update', async () => {
            const req = {
                body: {
                    status: 'completed',
                    outcome: {
                        status: 'successful',
                        notes: 'Patient counseled on medication adherence'
                    }
                }
            } as Request;

            await Promise.all(updateAppointmentStatusSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(true);
        });

        it('should fail validation when cancelling without reason', async () => {
            const req = {
                body: {
                    status: 'cancelled'
                }
            } as Request;

            await Promise.all(updateAppointmentStatusSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'reason',
                        msg: 'Cancellation reason is required'
                    })
                ])
            );
        });

        it('should fail validation when completing without outcome notes', async () => {
            const req = {
                body: {
                    status: 'completed',
                    outcome: {
                        status: 'successful'
                    }
                }
            } as Request;

            await Promise.all(updateAppointmentStatusSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'outcome.notes',
                        msg: 'Outcome notes are required for completed appointments'
                    })
                ])
            );
        });

        it('should fail validation with invalid status', async () => {
            const req = {
                body: {
                    status: 'invalid_status'
                }
            } as Request;

            await Promise.all(updateAppointmentStatusSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'status',
                        msg: 'Invalid appointment status'
                    })
                ])
            );
        });
    });

    describe('rescheduleAppointmentSchema', () => {
        it('should pass validation with valid reschedule data', async () => {
            const req = {
                body: {
                    newDate: new Date(Date.now() + 86400000).toISOString(),
                    newTime: '14:00',
                    reason: 'Patient requested different time',
                    notifyPatient: true
                }
            } as Request;

            await Promise.all(rescheduleAppointmentSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(true);
        });

        it('should fail validation with missing required fields', async () => {
            const req = {
                body: {}
            } as Request;

            await Promise.all(rescheduleAppointmentSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ path: 'newDate' }),
                    expect.objectContaining({ path: 'newTime' }),
                    expect.objectContaining({ path: 'reason' })
                ])
            );
        });

        it('should fail validation with past date', async () => {
            const req = {
                body: {
                    newDate: new Date(Date.now() - 86400000).toISOString(),
                    newTime: '14:00',
                    reason: 'Patient requested different time'
                }
            } as Request;

            await Promise.all(rescheduleAppointmentSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'newDate',
                        msg: 'New date cannot be in the past'
                    })
                ])
            );
        });
    });

    describe('cancelAppointmentSchema', () => {
        it('should pass validation with valid cancellation data', async () => {
            const req = {
                body: {
                    reason: 'Patient no longer needs service',
                    notifyPatient: true,
                    cancelType: 'this_only'
                }
            } as Request;

            await Promise.all(cancelAppointmentSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(true);
        });

        it('should fail validation without reason', async () => {
            const req = {
                body: {
                    notifyPatient: true
                }
            } as Request;

            await Promise.all(cancelAppointmentSchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'reason',
                        msg: 'Cancellation reason is required'
                    })
                ])
            );
        });
    });

    describe('appointmentQuerySchema', () => {
        it('should pass validation with valid query parameters', async () => {
            const req = {
                query: {
                    view: 'week',
                    date: new Date().toISOString(),
                    status: 'scheduled',
                    type: 'mtm_session',
                    page: '1',
                    limit: '20'
                }
            } as any;

            await Promise.all(appointmentQuerySchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(true);
        });

        it('should fail validation with invalid view', async () => {
            const req = {
                query: {
                    view: 'invalid_view'
                }
            } as any;

            await Promise.all(appointmentQuerySchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'view',
                        msg: 'View must be day, week, or month'
                    })
                ])
            );
        });

        it('should fail validation with invalid page number', async () => {
            const req = {
                query: {
                    page: '0'
                }
            } as any;

            await Promise.all(appointmentQuerySchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'page',
                        msg: 'Page must be a positive integer'
                    })
                ])
            );
        });
    });

    describe('availableSlotsQuerySchema', () => {
        it('should pass validation with valid query parameters', async () => {
            const req = {
                query: {
                    date: new Date().toISOString(),
                    duration: '30',
                    type: 'health_check'
                }
            } as any;

            await Promise.all(availableSlotsQuerySchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(true);
        });

        it('should fail validation without required date', async () => {
            const req = {
                query: {}
            } as any;

            await Promise.all(availableSlotsQuerySchema.map(validation => validation.run(req)));
            const errors = validationResult(req);

            expect(errors.isEmpty()).toBe(false);
            expect(errors.array()).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        path: 'date',
                        msg: 'Date is required'
                    })
                ])
            );
        });
    });
});
