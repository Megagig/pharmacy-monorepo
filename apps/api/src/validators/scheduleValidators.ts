import { z } from 'zod';

/**
 * Pharmacist Schedule Management Validation Schemas
 * Comprehensive Zod schemas for all Schedule Management API endpoints
 */

// Common validation patterns
const mongoIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId');

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // HH:mm format

// Time-off types enum
export const TIME_OFF_TYPES = [
  'vacation',
  'sick_leave',
  'personal',
  'training',
  'other',
] as const;

// Time-off status enum
export const TIME_OFF_STATUS = [
  'pending',
  'approved',
  'rejected',
] as const;

// ===============================
// SCHEDULE SCHEMAS
// ===============================

export const workingHoursSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isWorkingDay: z.boolean(),
  shifts: z.array(
    z.object({
      startTime: z.string().regex(timeRegex, 'Time must be in HH:mm format'),
      endTime: z.string().regex(timeRegex, 'Time must be in HH:mm format'),
      breakStart: z.string().regex(timeRegex, 'Time must be in HH:mm format').optional(),
      breakEnd: z.string().regex(timeRegex, 'Time must be in HH:mm format').optional(),
    })
  ),
});

export const updateScheduleSchema = z.object({
  workingHours: z.array(workingHoursSchema).optional(),
  appointmentPreferences: z
    .object({
      maxAppointmentsPerDay: z.number().int().min(1).max(50).optional(),
      maxConcurrentAppointments: z.number().int().min(1).max(10).optional(),
      appointmentTypes: z
        .array(
          z.enum([
            'mtm_session',
            'chronic_disease_review',
            'new_medication_consultation',
            'vaccination',
            'health_check',
            'smoking_cessation',
            'general_followup',
          ])
        )
        .optional(),
      defaultDuration: z.number().int().min(5).max(120).optional(),
      bufferBetweenAppointments: z.number().int().min(0).max(60).optional(),
    })
    .optional(),
  locationId: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});

export const createTimeOffSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().min(1).max(500).trim(),
  type: z.enum(TIME_OFF_TYPES),
});

export const updateTimeOffSchema = z.object({
  status: z.enum(TIME_OFF_STATUS),
  reason: z.string().max(500).trim().optional(),
});

export const scheduleParamsSchema = z.object({
  pharmacistId: mongoIdSchema,
});

export const timeOffParamsSchema = z.object({
  pharmacistId: mongoIdSchema,
  timeOffId: mongoIdSchema,
});

export const capacityQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  pharmacistId: mongoIdSchema.optional(),
  locationId: z.string().optional(),
});

/**
 * Validation middleware factory
 */
export const validateRequest = (schema: z.ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: any, res: any, next: any) => {
    try {
      const data = source === 'body' ? req.body : source === 'query' ? req.query : req.params;
      const validated = schema.parse(data);
      
      // Replace the original data with validated data
      if (source === 'body') req.body = validated;
      else if (source === 'query') req.query = validated;
      else req.params = validated;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        });
      }
      next(error);
    }
  };
};
