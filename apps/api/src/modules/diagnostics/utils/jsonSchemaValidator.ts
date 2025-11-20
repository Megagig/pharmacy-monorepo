import Ajv, { JSONSchemaType } from 'ajv';
import addFormats from 'ajv-formats';

// Initialize AJV with formats
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// AI Response Schema for DiagnosticResult
interface AIResponseSchema {
    diagnoses: Array<{
        condition: string;
        probability: number;
        reasoning: string;
        severity: 'low' | 'medium' | 'high';
        icdCode?: string;
        snomedCode?: string;
    }>;
    suggestedTests?: Array<{
        testName: string;
        priority: 'urgent' | 'routine' | 'optional';
        reasoning: string;
        loincCode?: string;
    }>;
    medicationSuggestions?: Array<{
        drugName: string;
        dosage: string;
        frequency: string;
        duration: string;
        reasoning: string;
        safetyNotes: string[];
        rxcui?: string;
    }>;
    redFlags?: Array<{
        flag: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        action: string;
    }>;
    referralRecommendation?: {
        recommended: boolean;
        urgency?: 'immediate' | 'within_24h' | 'routine';
        specialty?: string;
        reason?: string;
    };
    confidenceScore: number;
    disclaimer?: string;
}

const aiResponseSchema = {
    type: 'object',
    properties: {
        diagnoses: {
            type: 'array',
            minItems: 1,
            items: {
                type: 'object',
                properties: {
                    condition: { type: 'string', minLength: 1 },
                    probability: { type: 'number', minimum: 0, maximum: 1 },
                    reasoning: { type: 'string', minLength: 1 },
                    severity: { type: 'string', enum: ['low', 'medium', 'high'] },
                    icdCode: { type: 'string', nullable: true },
                    snomedCode: { type: 'string', nullable: true }
                },
                required: ['condition', 'probability', 'reasoning', 'severity'],
                additionalProperties: false
            }
        },
        suggestedTests: {
            type: 'array',
            nullable: true,
            items: {
                type: 'object',
                properties: {
                    testName: { type: 'string', minLength: 1 },
                    priority: { type: 'string', enum: ['urgent', 'routine', 'optional'] },
                    reasoning: { type: 'string', minLength: 1 },
                    loincCode: { type: 'string', nullable: true }
                },
                required: ['testName', 'priority', 'reasoning'],
                additionalProperties: false
            }
        },
        medicationSuggestions: {
            type: 'array',
            nullable: true,
            items: {
                type: 'object',
                properties: {
                    drugName: { type: 'string', minLength: 1 },
                    dosage: { type: 'string', minLength: 1 },
                    frequency: { type: 'string', minLength: 1 },
                    duration: { type: 'string', minLength: 1 },
                    reasoning: { type: 'string', minLength: 1 },
                    safetyNotes: {
                        type: 'array',
                        items: { type: 'string' }
                    },
                    rxcui: { type: 'string', nullable: true }
                },
                required: ['drugName', 'dosage', 'frequency', 'duration', 'reasoning', 'safetyNotes'],
                additionalProperties: false
            }
        },
        redFlags: {
            type: 'array',
            nullable: true,
            items: {
                type: 'object',
                properties: {
                    flag: { type: 'string', minLength: 1 },
                    severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                    action: { type: 'string', minLength: 1 }
                },
                required: ['flag', 'severity', 'action'],
                additionalProperties: false
            }
        },
        referralRecommendation: {
            type: 'object',
            nullable: true,
            properties: {
                recommended: { type: 'boolean' },
                urgency: {
                    type: 'string',
                    enum: ['immediate', 'within_24h', 'routine'],
                    nullable: true
                },
                specialty: { type: 'string', nullable: true },
                reason: { type: 'string', nullable: true }
            },
            required: ['recommended'],
            additionalProperties: false,
            if: { properties: { recommended: { const: true } } },
            then: {
                required: ['recommended', 'urgency', 'specialty', 'reason']
            }
        },
        confidenceScore: { type: 'number', minimum: 0, maximum: 1 },
        disclaimer: { type: 'string', nullable: true }
    },
    required: ['diagnoses', 'confidenceScore'],
    additionalProperties: false
};

// FHIR Bundle Schema (simplified)
interface FHIRBundleSchema {
    resourceType: 'Bundle';
    type: string;
    entry?: Array<{
        resource: {
            resourceType: string;
            [key: string]: any;
        };
    }>;
}

const fhirBundleSchema: any = {
    type: 'object',
    properties: {
        resourceType: { type: 'string', const: 'Bundle' },
        type: { type: 'string' },
        entry: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    resource: {
                        type: 'object',
                        properties: {
                            resourceType: { type: 'string' }
                        },
                        required: ['resourceType'],
                        additionalProperties: true
                    }
                },
                required: ['resource'],
                additionalProperties: true
            }
        }
    },
    required: ['resourceType', 'type'],
    additionalProperties: true
};

// Drug Interaction Response Schema
interface DrugInteractionSchema {
    interactions: Array<{
        drug1: string;
        drug2: string;
        severity: 'minor' | 'moderate' | 'major';
        description: string;
        clinicalEffect: string;
        mechanism?: string;
        management?: string;
    }>;
    allergicReactions?: Array<{
        drug: string;
        allergy: string;
        severity: 'mild' | 'moderate' | 'severe';
        reaction: string;
    }>;
    contraindications?: Array<{
        drug: string;
        condition: string;
        reason: string;
        severity: 'warning' | 'contraindicated';
    }>;
}

const drugInteractionSchema = {
    type: 'object',
    properties: {
        interactions: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    drug1: { type: 'string', minLength: 1 },
                    drug2: { type: 'string', minLength: 1 },
                    severity: { type: 'string', enum: ['minor', 'moderate', 'major'] },
                    description: { type: 'string', minLength: 1 },
                    clinicalEffect: { type: 'string', minLength: 1 },
                    mechanism: { type: 'string', nullable: true },
                    management: { type: 'string', nullable: true }
                },
                required: ['drug1', 'drug2', 'severity', 'description', 'clinicalEffect'],
                additionalProperties: false
            }
        },
        allergicReactions: {
            type: 'array',
            nullable: true,
            items: {
                type: 'object',
                properties: {
                    drug: { type: 'string', minLength: 1 },
                    allergy: { type: 'string', minLength: 1 },
                    severity: { type: 'string', enum: ['mild', 'moderate', 'severe'] },
                    reaction: { type: 'string', minLength: 1 }
                },
                required: ['drug', 'allergy', 'severity', 'reaction'],
                additionalProperties: false
            }
        },
        contraindications: {
            type: 'array',
            nullable: true,
            items: {
                type: 'object',
                properties: {
                    drug: { type: 'string', minLength: 1 },
                    condition: { type: 'string', minLength: 1 },
                    reason: { type: 'string', minLength: 1 },
                    severity: { type: 'string', enum: ['warning', 'contraindicated'] }
                },
                required: ['drug', 'condition', 'reason', 'severity'],
                additionalProperties: false
            }
        }
    },
    required: ['interactions'],
    additionalProperties: false
};

// Compile validators
export const validateAIResponse = ajv.compile(aiResponseSchema);
export const validateFHIRBundle = ajv.compile(fhirBundleSchema);
export const validateDrugInteraction = ajv.compile(drugInteractionSchema);

// Validation helper functions
export const isValidAIResponse = (data: unknown): data is AIResponseSchema => {
    return validateAIResponse(data);
};

export const isValidFHIRBundle = (data: unknown): data is FHIRBundleSchema => {
    return validateFHIRBundle(data);
};

export const isValidDrugInteraction = (data: unknown): data is DrugInteractionSchema => {
    return validateDrugInteraction(data);
};

// Error formatting
export const formatSchemaErrors = (validator: any) => {
    if (!validator.errors) return [];

    return validator.errors.map((error: any) => ({
        field: error.instancePath || error.schemaPath,
        message: error.message,
        code: error.keyword,
        allowedValues: error.params?.allowedValues
    }));
};

// Sanitization functions
export const sanitizeAIResponse = (data: any): Partial<AIResponseSchema> => {
    const sanitized: Partial<AIResponseSchema> = {};

    if (Array.isArray(data.diagnoses)) {
        sanitized.diagnoses = data.diagnoses.map((d: any) => ({
            condition: String(d.condition || '').trim(),
            probability: Math.max(0, Math.min(1, Number(d.probability) || 0)),
            reasoning: String(d.reasoning || '').trim(),
            severity: ['low', 'medium', 'high'].includes(d.severity) ? d.severity : 'low',
            icdCode: d.icdCode ? String(d.icdCode).trim() : undefined,
            snomedCode: d.snomedCode ? String(d.snomedCode).trim() : undefined
        })).filter((d: any) => d.condition && d.reasoning);
    }

    if (Array.isArray(data.suggestedTests)) {
        sanitized.suggestedTests = data.suggestedTests.map((t: any) => ({
            testName: String(t.testName || '').trim(),
            priority: ['urgent', 'routine', 'optional'].includes(t.priority) ? t.priority : 'routine',
            reasoning: String(t.reasoning || '').trim(),
            loincCode: t.loincCode ? String(t.loincCode).trim() : undefined
        })).filter((t: any) => t.testName && t.reasoning);
    }

    if (Array.isArray(data.medicationSuggestions)) {
        sanitized.medicationSuggestions = data.medicationSuggestions.map((m: any) => ({
            drugName: String(m.drugName || '').trim(),
            dosage: String(m.dosage || '').trim(),
            frequency: String(m.frequency || '').trim(),
            duration: String(m.duration || '').trim(),
            reasoning: String(m.reasoning || '').trim(),
            safetyNotes: Array.isArray(m.safetyNotes)
                ? m.safetyNotes.map((n: any) => String(n).trim()).filter(Boolean)
                : [],
            rxcui: m.rxcui ? String(m.rxcui).trim() : undefined
        })).filter((m: any) => m.drugName && m.dosage && m.frequency && m.duration && m.reasoning);
    }

    if (Array.isArray(data.redFlags)) {
        sanitized.redFlags = data.redFlags.map((f: any) => ({
            flag: String(f.flag || '').trim(),
            severity: ['low', 'medium', 'high', 'critical'].includes(f.severity) ? f.severity : 'low',
            action: String(f.action || '').trim()
        })).filter((f: any) => f.flag && f.action);
    }

    if (data.referralRecommendation && typeof data.referralRecommendation === 'object') {
        const ref = data.referralRecommendation;
        sanitized.referralRecommendation = {
            recommended: Boolean(ref.recommended),
            urgency: ref.recommended && ['immediate', 'within_24h', 'routine'].includes(ref.urgency)
                ? ref.urgency : undefined,
            specialty: ref.recommended && ref.specialty ? String(ref.specialty).trim() : undefined,
            reason: ref.recommended && ref.reason ? String(ref.reason).trim() : undefined
        };
    }

    sanitized.confidenceScore = Math.max(0, Math.min(1, Number(data.confidenceScore) || 0));
    sanitized.disclaimer = data.disclaimer ? String(data.disclaimer).trim() : undefined;

    return sanitized;
};

export { AIResponseSchema, FHIRBundleSchema, DrugInteractionSchema };
