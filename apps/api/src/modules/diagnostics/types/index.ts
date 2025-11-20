// Diagnostics Module Type Definitions

export interface CreateDiagnosticRequestData {
    patientId: string;
    symptoms: {
        subjective: string[];
        objective: string[];
        duration: string;
        severity: 'mild' | 'moderate' | 'severe';
        onset: 'acute' | 'chronic' | 'subacute';
    };
    vitals?: {
        bloodPressure?: string;
        heartRate?: number;
        temperature?: number;
        bloodGlucose?: number;
        respiratoryRate?: number;
    };
    currentMedications?: Array<{
        name: string;
        dosage: string;
        frequency: string;
    }>;
    allergies?: string[];
    medicalHistory?: string[];
    labResults?: string[]; // Lab result IDs
    consent: boolean;
}

export interface DiagnosticRequestResponse {
    _id: string;
    patientId: string;
    pharmacistId: string;
    workplaceId: string;
    locationId?: string;
    inputSnapshot: CreateDiagnosticRequestData;
    consentObtained: boolean;
    consentTimestamp: string;
    promptVersion: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    processedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DiagnosticResultResponse {
    _id: string;
    requestId: string;
    diagnoses: Array<{
        condition: string;
        probability: number;
        reasoning: string;
        severity: 'low' | 'medium' | 'high';
        icdCode?: string;
        snomedCode?: string;
    }>;
    suggestedTests: Array<{
        testName: string;
        priority: 'urgent' | 'routine' | 'optional';
        reasoning: string;
        loincCode?: string;
    }>;
    medicationSuggestions: Array<{
        drugName: string;
        dosage: string;
        frequency: string;
        duration: string;
        reasoning: string;
        safetyNotes: string[];
        rxcui?: string;
    }>;
    redFlags: Array<{
        flag: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        action: string;
    }>;
    referralRecommendation?: {
        recommended: boolean;
        urgency: 'immediate' | 'within_24h' | 'routine';
        specialty: string;
        reason: string;
    };
    aiMetadata: {
        modelId: string;
        modelVersion: string;
        confidenceScore: number;
        processingTime: number;
        tokenUsage: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
        };
        requestId: string;
    };
    disclaimer: string;
    pharmacistReview?: {
        status: 'approved' | 'modified' | 'rejected';
        modifications?: string;
        rejectionReason?: string;
        reviewedBy: string;
        reviewedAt: string;
    };
    createdAt: string;
}

export interface CreateLabOrderData {
    patientId: string;
    tests: Array<{
        code: string;
        name: string;
        loincCode?: string;
        indication: string;
        priority: 'stat' | 'urgent' | 'routine';
    }>;
    expectedDate?: string;
}

export interface LabOrderResponse {
    _id: string;
    patientId: string;
    orderedBy: string;
    workplaceId: string;
    locationId?: string;
    tests: Array<{
        code: string;
        name: string;
        loincCode?: string;
        indication: string;
        priority: 'stat' | 'urgent' | 'routine';
    }>;
    status: 'ordered' | 'collected' | 'processing' | 'completed' | 'cancelled';
    orderDate: string;
    expectedDate?: string;
    externalOrderId?: string;
    fhirReference?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateLabResultData {
    patientId: string;
    orderId?: string;
    testCode: string;
    testName: string;
    value: string;
    unit?: string;
    referenceRange: {
        low?: number;
        high?: number;
        text?: string;
    };
    interpretation?: 'low' | 'normal' | 'high' | 'critical' | 'abnormal';
    flags?: string[];
    performedAt: string;
    loincCode?: string;
}

export interface LabResultResponse {
    _id: string;
    orderId?: string;
    patientId: string;
    workplaceId: string;
    testCode: string;
    testName: string;
    value: string;
    unit?: string;
    referenceRange: {
        low?: number;
        high?: number;
        text?: string;
    };
    interpretation: 'low' | 'normal' | 'high' | 'critical' | 'abnormal';
    flags: string[];
    source: 'manual' | 'fhir' | 'lis' | 'external';
    performedAt: string;
    recordedAt: string;
    recordedBy: string;
    externalResultId?: string;
    fhirReference?: string;
    loincCode?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DrugInteractionResponse {
    interactions: Array<{
        drug1: string;
        drug2: string;
        severity: 'minor' | 'moderate' | 'major';
        description: string;
        clinicalEffect: string;
        mechanism?: string;
        management?: string;
    }>;
    allergicReactions: Array<{
        drug: string;
        allergy: string;
        severity: 'mild' | 'moderate' | 'severe';
        reaction: string;
    }>;
    contraindications: Array<{
        drug: string;
        condition: string;
        reason: string;
        severity: 'warning' | 'contraindicated';
    }>;
}

export interface FHIRImportData {
    fhirBundle: any; // FHIR Bundle resource
    patientMapping: {
        fhirPatientId: string;
        internalPatientId: string;
    };
}

export interface ProcessingStatus {
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress?: number;
    message?: string;
    estimatedCompletion?: string;
}

export interface DiagnosticHistoryParams {
    patientId: string;
    page?: number;
    limit?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
}

export interface LabTrendData {
    testCode: string;
    testName: string;
    unit?: string;
    referenceRange: {
        low?: number;
        high?: number;
        text?: string;
    };
    results: Array<{
        value: string;
        numericValue?: number;
        interpretation: string;
        performedAt: string;
        flags: string[];
    }>;
    trend: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
    summary: {
        latestValue: string;
        latestInterpretation: string;
        changeFromPrevious?: number;
        abnormalCount: number;
        totalCount: number;
    };
}

export interface DiagnosticAnalytics {
    totalRequests: number;
    completedRequests: number;
    averageProcessingTime: number;
    averageConfidenceScore: number;
    topDiagnoses: Array<{
        condition: string;
        count: number;
        averageConfidence: number;
    }>;
    pharmacistReviewStats: {
        approvedCount: number;
        modifiedCount: number;
        rejectedCount: number;
        averageReviewTime: number;
    };
    aiModelPerformance: {
        modelId: string;
        modelVersion: string;
        totalRequests: number;
        averageConfidence: number;
        averageTokenUsage: number;
    };
}

// Error types
export interface DiagnosticError {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
}

// Validation schemas
export interface ValidationResult {
    isValid: boolean;
    errors: Array<{
        field: string;
        message: string;
        code: string;
    }>;
}

// External API types
export interface OpenRouterRequest {
    model: string;
    messages: Array<{
        role: 'system' | 'user' | 'assistant';
        content: string;
    }>;
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
}

export interface OpenRouterResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }>;
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface RxNormDrugInfo {
    rxcui: string;
    name: string;
    synonym?: string;
    tty?: string;
    language?: string;
}

export interface DrugInteractionInfo {
    minConceptItem: {
        rxcui: string;
        name: string;
        tty: string;
    };
    interactionTypeGroup: Array<{
        sourceDisclaimer: string;
        sourceName: string;
        interactionType: Array<{
            comment: string;
            minConceptItem: {
                rxcui: string;
                name: string;
                tty: string;
            };
            interactionPair: Array<{
                interactionConcept: Array<{
                    minConceptItem: {
                        rxcui: string;
                        name: string;
                        tty: string;
                    };
                    sourceConceptItem: {
                        id: string;
                        name: string;
                        url: string;
                    };
                }>;
                severity: string;
                description: string;
            }>;
        }>;
    }>;
}

export interface LoincMapping {
    code: string;
    display: string;
    system: string;
    version?: string;
}

// Audit and compliance types
export interface AuditLogEntry {
    action: string;
    resourceType: string;
    resourceId: string;
    userId: string;
    workplaceId: string;
    timestamp: string;
    details: any;
    ipAddress?: string;
    userAgent?: string;
}

export interface ComplianceReport {
    period: {
        start: string;
        end: string;
    };
    metrics: {
        totalDiagnosticRequests: number;
        consentCompliance: number;
        auditLogCompleteness: number;
        dataRetentionCompliance: number;
        accessControlViolations: number;
    };
    violations: Array<{
        type: string;
        description: string;
        severity: 'low' | 'medium' | 'high' | 'critical';
        timestamp: string;
        resolved: boolean;
    }>;
}