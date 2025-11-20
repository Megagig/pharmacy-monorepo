import { z } from 'zod';
import {
  NIGERIAN_STATES,
  BLOOD_GROUPS,
  GENOTYPES,
  MARITAL_STATUS,
  GENDERS,
  SEVERITY_LEVELS,
  DTP_TYPES,
} from '../utils/tenancyGuard';

/**
 * Patient Management Validation Schemas
 * Comprehensive Zod schemas for all Patient Management API endpoints
 */

// Common validation patterns
const phoneRegex = /^\+234[7-9]\d{9}$/; // Nigerian E.164 format
const snomedRegex = /^\d{6,18}$/; // SNOMED CT identifier
const mrnRegex = /^PHM-[A-Z]{3}-\d{5}$/; // MRN pattern
const mongoIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId');

// Query parameter schemas
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => Math.max(1, parseInt(val) || 1)),
  limit: z
    .string()
    .optional()
    .default('10')
    .transform((val) => Math.min(100, Math.max(1, parseInt(val) || 10))),
  sort: z.string().optional().default('-createdAt'),
});

export const searchSchema = z
  .object({
    q: z.string().optional(),
    search: z.string().optional(), // Alias for q
    name: z.string().optional(),
    mrn: z.string().optional(),
    phone: z.string().optional(),
    state: z.enum(NIGERIAN_STATES as [string, ...string[]]).optional(),
    bloodGroup: z.enum(BLOOD_GROUPS as [string, ...string[]]).optional(),
    genotype: z.enum(GENOTYPES as [string, ...string[]]).optional(),
  })
  .merge(paginationSchema)
  .transform((data) => ({
    ...data,
    // Use 'search' as alias for 'q' if provided
    q: data.q || data.search,
  }));

// ===============================
// PATIENT SCHEMAS
// ===============================

export const createPatientSchema = z.object({
  // Demographics (required)
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(50, 'First name cannot exceed 50 characters')
    .trim(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(50, 'Last name cannot exceed 50 characters')
    .trim(),

  // Demographics (optional)
  otherNames: z.string().max(100).trim().optional(),
  dob: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  age: z.number().int().min(0).max(150).optional(),
  gender: z.enum(GENDERS as [string, ...string[]]).optional(),
  phone: z
    .string()
    .regex(phoneRegex, 'Phone must be in +234 format')
    .or(z.literal(''))
    .optional(),
  email: z.string().email('Invalid email format').or(z.literal('')).optional(),
  address: z.string().max(200).trim().optional(),
  state: z.enum(NIGERIAN_STATES as [string, ...string[]]).optional(),
  lga: z.string().max(100).trim().optional(),
  maritalStatus: z.enum(MARITAL_STATUS as [string, ...string[]]).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS as [string, ...string[]]).optional(),
  genotype: z.enum(GENOTYPES as [string, ...string[]]).optional(),
  weightKg: z.number().positive().max(1000).optional(),

  // Clinical data (optional initial data)
  allergies: z
    .array(
      z.object({
        substance: z.string().min(1).max(100).trim(),
        reaction: z.string().max(200).trim().optional(),
        severity: z.enum(SEVERITY_LEVELS as [string, ...string[]]).optional(),
        notedAt: z
          .string()
          .datetime()
          .optional()
          .transform((val) => (val ? new Date(val) : undefined)),
      })
    )
    .optional(),

  conditions: z
    .array(
      z.object({
        name: z.string().min(1).max(100).trim(),
        snomedId: z.string().regex(snomedRegex).optional(),
        onsetDate: z
          .string()
          .datetime()
          .optional()
          .transform((val) => (val ? new Date(val) : undefined)),
        status: z.enum(['active', 'resolved', 'remission']).optional(),
        notes: z.string().max(500).trim().optional(),
      })
    )
    .optional(),

  medications: z
    .array(
      z.object({
        phase: z.enum(['past', 'current']),
        medicationName: z.string().min(1).max(100).trim(),
        purposeIndication: z.string().max(200).trim().optional(),
        dose: z.string().max(50).trim().optional(),
        frequency: z.string().max(50).trim().optional(),
        route: z.string().max(20).trim().optional(),
        duration: z.string().max(50).trim().optional(),
        startDate: z
          .string()
          .datetime()
          .optional()
          .transform((val) => (val ? new Date(val) : undefined)),
        endDate: z
          .string()
          .datetime()
          .optional()
          .transform((val) => (val ? new Date(val) : undefined)),
        adherence: z.enum(['good', 'poor', 'unknown']).optional(),
        notes: z.string().max(500).trim().optional(),
      })
    )
    .optional(),

  assessment: z
    .object({
      vitals: z
        .object({
          bpSys: z.number().int().min(50).max(300).optional(),
          bpDia: z.number().int().min(30).max(200).optional(),
          rr: z.number().int().min(8).max(60).optional(),
          tempC: z.number().min(30).max(45).optional(),
          heartSounds: z.string().max(200).trim().optional(),
          pallor: z.enum(['none', 'mild', 'moderate', 'severe']).optional(),
          dehydration: z
            .enum(['none', 'mild', 'moderate', 'severe'])
            .optional(),
        })
        .optional(),
      labs: z
        .object({
          pcv: z.number().min(10).max(60).optional(),
          mcs: z.string().max(500).trim().optional(),
          eucr: z.string().max(500).trim().optional(),
          fbc: z.string().max(500).trim().optional(),
          fbs: z.number().min(30).max(600).optional(),
          hba1c: z.number().min(3.0).max(20.0).optional(),
          misc: z
            .record(z.string(), z.union([z.string(), z.number()]))
            .optional(),
        })
        .optional(),
      recordedAt: z
        .string()
        .datetime()
        .optional()
        .transform((val) => (val ? new Date(val) : new Date())),
    })
    .optional(),

  dtps: z
    .array(
      z.object({
        type: z.enum(DTP_TYPES as [string, ...string[]]),
        description: z.string().max(1000).trim().optional(),
        status: z.enum(['unresolved', 'resolved']).default('unresolved'),
      })
    )
    .optional(),

  carePlan: z
    .object({
      goals: z.array(z.string().min(5).max(200).trim()).min(1).max(10),
      objectives: z.array(z.string().min(5).max(300).trim()).min(1).max(15),
      followUpDate: z
        .string()
        .datetime()
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
      planQuality: z.enum(['adequate', 'needsReview']).default('adequate'),
      dtpSummary: z.enum(['resolved', 'unresolved']).optional(),
      notes: z.string().max(1000).trim().optional(),
    })
    .optional(),
});

export const updatePatientSchema = createPatientSchema.partial();

export const patientParamsSchema = z.object({
  id: mongoIdSchema,
});

// ===============================
// ALLERGY SCHEMAS
// ===============================

export const createAllergySchema = z.object({
  substance: z.string().min(1, 'Substance is required').max(100).trim(),
  reaction: z.string().max(200).trim().optional(),
  severity: z.enum(SEVERITY_LEVELS as [string, ...string[]]).optional(),
  notedAt: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : new Date())),
});

export const updateAllergySchema = createAllergySchema.partial();

export const allergyParamsSchema = z.object({
  id: mongoIdSchema,
  allergyId: mongoIdSchema,
});

// ===============================
// CONDITION SCHEMAS
// ===============================

export const createConditionSchema = z.object({
  name: z.string().min(1, 'Condition name is required').max(100).trim(),
  snomedId: z
    .string()
    .regex(snomedRegex, 'Invalid SNOMED CT identifier')
    .optional(),
  onsetDate: z
    .string()
    .datetime()
    .optional(),
  status: z.enum(['active', 'resolved', 'remission']).default('active'),
  notes: z.string().max(500).trim().optional(),
});

export const updateConditionSchema = createConditionSchema.partial();

export const conditionParamsSchema = z.object({
  id: mongoIdSchema,
  conditionId: mongoIdSchema,
});

export const conditionIdSchema = z.object({
  conditionId: mongoIdSchema,
});

// ===============================
// MEDICATION SCHEMAS
// ===============================

export const createMedicationSchema = z.object({
  phase: z.enum(['past', 'current']),
  medicationName: z
    .string()
    .min(1, 'Medication name is required')
    .max(100)
    .trim(),
  purposeIndication: z.string().max(200).trim().optional(),
  dose: z.string().max(50).trim().optional(),
  frequency: z.string().max(50).trim().optional(),
  route: z.string().max(20).trim().optional(),
  duration: z.string().max(50).trim().optional(),
  startDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  endDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  adherence: z.enum(['good', 'poor', 'unknown']).default('unknown'),
  notes: z.string().max(500).trim().optional(),
});

export const updateMedicationSchema = createMedicationSchema.partial();

export const medicationParamsSchema = z.object({
  id: mongoIdSchema,
  medId: mongoIdSchema,
});

export const medicationQuerySchema = z
  .object({
    phase: z.enum(['past', 'current']).optional(),
  })
  .merge(paginationSchema);

// ===============================
// CLINICAL ASSESSMENT SCHEMAS
// ===============================

export const createAssessmentSchema = z
  .object({
    vitals: z
      .object({
        bpSys: z.number().int().min(50).max(300).optional(),
        bpDia: z.number().int().min(30).max(200).optional(),
        rr: z.number().int().min(8).max(60).optional(),
        tempC: z.number().min(30).max(45).optional(),
        heartSounds: z.string().max(200).trim().optional(),
        pallor: z.enum(['none', 'mild', 'moderate', 'severe']).optional(),
        dehydration: z.enum(['none', 'mild', 'moderate', 'severe']).optional(),
      })
      .optional(),
    labs: z
      .object({
        pcv: z.number().min(10).max(60).optional(),
        mcs: z.string().max(500).trim().optional(),
        eucr: z.string().max(500).trim().optional(),
        fbc: z.string().max(500).trim().optional(),
        fbs: z.number().min(30).max(600).optional(),
        hba1c: z.number().min(3.0).max(20.0).optional(),
        misc: z
          .record(z.string(), z.union([z.string(), z.number()]))
          .optional(),
      })
      .optional(),
    visitId: mongoIdSchema.optional(),
    recordedAt: z
      .string()
      .datetime()
      .optional()
      .transform((val) => (val ? new Date(val) : new Date())),
  })
  .refine((data) => data.vitals || data.labs, {
    message: 'Either vitals or labs must be provided',
  });

export const updateAssessmentSchema = createAssessmentSchema.partial();

export const assessmentParamsSchema = z.object({
  id: mongoIdSchema,
  assessmentId: mongoIdSchema,
});

// ===============================
// DTP SCHEMAS
// ===============================

export const createDTPSchema = z.object({
  type: z.enum(DTP_TYPES as [string, ...string[]]),
  description: z.string().max(1000).trim().optional(),
  visitId: mongoIdSchema.optional(),
  status: z.enum(['unresolved', 'resolved']).default('unresolved'),
});

export const updateDTPSchema = createDTPSchema.partial();

export const dtpParamsSchema = z.object({
  id: mongoIdSchema,
  dtpId: mongoIdSchema,
});

export const dtpQuerySchema = z
  .object({
    status: z.enum(['unresolved', 'resolved']).optional(),
  })
  .merge(paginationSchema);

// ===============================
// CARE PLAN SCHEMAS
// ===============================

export const createCarePlanSchema = z.object({
  goals: z
    .array(
      z
        .string()
        .min(5, 'Each goal must be at least 5 characters')
        .max(200)
        .trim()
    )
    .min(1, 'At least one goal is required')
    .max(10, 'Maximum 10 goals allowed'),
  objectives: z
    .array(
      z
        .string()
        .min(5, 'Each objective must be at least 5 characters')
        .max(300)
        .trim()
    )
    .min(1, 'At least one objective is required')
    .max(15, 'Maximum 15 objectives allowed'),
  visitId: mongoIdSchema.optional(),
  followUpDate: z
    .string()
    .datetime()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  planQuality: z.enum(['adequate', 'needsReview']).default('adequate'),
  dtpSummary: z.enum(['resolved', 'unresolved']).optional(),
  notes: z.string().max(1000).trim().optional(),
});

export const updateCarePlanSchema = createCarePlanSchema.partial();

export const carePlanParamsSchema = z.object({
  id: mongoIdSchema,
  carePlanId: mongoIdSchema,
});

// ===============================
// VISIT SCHEMAS
// ===============================

export const createVisitSchema = z.object({
  date: z
    .string()
    .datetime()
    .default(() => new Date().toISOString())
    .transform((val) => new Date(val)),
  soap: z
    .object({
      subjective: z.string().max(2000).trim().optional(),
      objective: z.string().max(2000).trim().optional(),
      assessment: z.string().max(2000).trim().optional(),
      plan: z.string().max(2000).trim().optional(),
    })
    .refine(
      (soap) =>
        soap.subjective || soap.objective || soap.assessment || soap.plan,
      {
        message: 'At least one SOAP section must have content',
      }
    ),
  attachments: z
    .array(
      z.object({
        kind: z.enum(['lab', 'image', 'audio', 'other']),
        url: z.string().url('Invalid URL format'),
        fileName: z.string().max(255).optional(),
        fileSize: z
          .number()
          .int()
          .min(0)
          .max(100 * 1024 * 1024)
          .optional(), // 100MB max
        mimeType: z.string().max(100).optional(),
      })
    )
    .max(10, 'Maximum 10 attachments allowed')
    .optional(),
});

export const updateVisitSchema = createVisitSchema.partial();

export const visitParamsSchema = z.object({
  id: mongoIdSchema,
  visitId: mongoIdSchema.optional(),
});

export const attachmentSchema = z.object({
  kind: z.enum(['lab', 'image', 'audio', 'other']),
  url: z.string().url('Invalid URL format'),
  fileName: z.string().max(255).optional(),
  fileSize: z
    .number()
    .int()
    .min(0)
    .max(100 * 1024 * 1024)
    .optional(),
  mimeType: z.string().max(100).optional(),
});

// ===============================
// VALIDATION MIDDLEWARE
// ===============================

import { Request, Response, NextFunction } from 'express';

type ValidationTarget = 'body' | 'params' | 'query';

export const validateRequest = (
  schema: z.ZodSchema,
  target: ValidationTarget = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const data = req[target];
      const validated = schema.parse(data);
      req[target] = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        res.status(422).json({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors,
        });
      } else {
        res.status(400).json({
          message: 'Invalid request data',
          code: 'BAD_REQUEST',
        });
      }
    }
  };
};
