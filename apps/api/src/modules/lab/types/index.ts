import mongoose from 'mongoose';

// Manual Lab Order Types
export interface CreateManualLabOrderRequest {
    patientId: string;
    tests: {
        name: string;
        code: string;
        loincCode?: string;
        specimenType: string;
        unit?: string;
        refRange?: string;
        category?: string;
    }[];
    indication: string;
    priority?: 'routine' | 'urgent' | 'stat';
    notes?: string;
    consentObtained: boolean;
}

export interface UpdateManualLabOrderStatusRequest {
    status: 'requested' | 'sample_collected' | 'result_awaited' | 'completed' | 'referred';
    notes?: string;
}

export interface ManualLabOrderResponse {
    orderId: string;
    patientId: string;
    workplaceId: string;
    locationId?: string;
    orderedBy: string;
    tests: {
        name: string;
        code: string;
        loincCode?: string;
        specimenType: string;
        unit?: string;
        refRange?: string;
        category?: string;
    }[];
    indication: string;
    requisitionFormUrl: string;
    barcodeData: string;
    status: 'requested' | 'sample_collected' | 'result_awaited' | 'completed' | 'referred';
    priority?: 'routine' | 'urgent' | 'stat';
    notes?: string;
    consentObtained: boolean;
    consentTimestamp: Date;
    consentObtainedBy: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    updatedBy?: string;
}

// Manual Lab Result Types
export interface AddManualLabResultsRequest {
    values: {
        testCode: string;
        testName: string;
        numericValue?: number;
        unit?: string;
        stringValue?: string;
        comment?: string;
    }[];
    interpretation?: {
        testCode: string;
        interpretation: 'low' | 'normal' | 'high' | 'critical';
        note?: string;
    }[];
}

export interface ManualLabResultResponse {
    orderId: string;
    enteredBy: string;
    enteredAt: Date;
    values: {
        testCode: string;
        testName: string;
        numericValue?: number;
        unit?: string;
        stringValue?: string;
        comment?: string;
        abnormalFlag?: boolean;
    }[];
    interpretation: {
        testCode: string;
        interpretation: 'low' | 'normal' | 'high' | 'critical';
        note?: string;
    }[];
    aiProcessed: boolean;
    aiProcessedAt?: Date;
    diagnosticResultId?: string;
    reviewedBy?: string;
    reviewedAt?: Date;
    reviewNotes?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Token Resolution Types
export interface TokenResolutionRequest {
    token: string;
}

export interface TokenResolutionResponse {
    success: boolean;
    order?: ManualLabOrderResponse;
    error?: string;
}

// PDF Generation Types
export interface RequisitionTemplateData {
    order: ManualLabOrderResponse;
    patient: {
        firstName: string;
        lastName: string;
        otherNames?: string;
        mrn: string;
        dob?: Date;
        age?: number;
        gender?: string;
        phone?: string;
        email?: string;
    };
    pharmacy: {
        name: string;
        address?: string;
        phone?: string;
        email?: string;
        logo?: string;
    };
    qrCodeData: string;
    barcodeData: string;
    generatedAt: Date;
}

export interface PDFGenerationResponse {
    pdfBuffer: Buffer;
    fileName: string;
    url: string;
    contentType: string;
}

// Service Response Types
export interface ServiceResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}

// Audit Event Types
export interface ManualLabAuditEvent {
    orderId: string;
    event: 'order_created' | 'pdf_generated' | 'status_updated' | 'results_entered' | 'ai_processed' | 'reviewed';
    userId: string;
    workplaceId: string;
    locationId?: string;
    metadata?: Record<string, any>;
    timestamp: Date;
}

// Test Catalog Types
export interface TestCatalogEntry {
    code: string;
    name: string;
    loincCode?: string;
    category: string;
    specimenType: string;
    unit?: string;
    refRange?: string;
    description?: string;
    estimatedCost?: number;
    turnaroundTime?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface TestCatalogSearchRequest {
    query?: string;
    category?: string;
    specimenType?: string;
    limit?: number;
    offset?: number;
}

export interface TestCatalogSearchResponse {
    tests: TestCatalogEntry[];
    total: number;
    limit: number;
    offset: number;
}

// AI Integration Types
export interface ManualLabAIRequest {
    orderId: string;
    patientData: {
        demographics: {
            age?: number;
            gender?: string;
            weight?: number;
        };
        medicalHistory?: string[];
        currentMedications?: {
            name: string;
            dosage: string;
            frequency: string;
        }[];
        allergies?: string[];
    };
    labResults: {
        testCode: string;
        testName: string;
        value: string;
        numericValue?: number;
        unit?: string;
        refRange?: string;
        interpretation: 'low' | 'normal' | 'high' | 'critical';
    }[];
    indication: string;
}

// Error Types
export class ManualLabError extends Error {
    constructor(
        message: string,
        public code: string,
        public statusCode: number = 400,
        public details?: any
    ) {
        super(message);
        this.name = 'ManualLabError';
    }
}

export class ValidationError extends ManualLabError {
    constructor(message: string, field?: string) {
        super(message, 'VALIDATION_ERROR', 400, { field });
    }
}

export class NotFoundError extends ManualLabError {
    constructor(resource: string, id?: string) {
        super(`${resource} not found${id ? `: ${id}` : ''}`, 'NOT_FOUND', 404);
    }
}

export class UnauthorizedError extends ManualLabError {
    constructor(message: string = 'Unauthorized access') {
        super(message, 'UNAUTHORIZED', 401);
    }
}

export class ConflictError extends ManualLabError {
    constructor(message: string) {
        super(message, 'CONFLICT', 409);
    }
}

export class ExternalServiceError extends ManualLabError {
    constructor(service: string, message: string) {
        super(`${service} service error: ${message}`, 'EXTERNAL_SERVICE_ERROR', 502);
    }
}

// Utility Types
export type ManualLabOrderStatus = 'requested' | 'sample_collected' | 'result_awaited' | 'completed' | 'referred';
export type ManualLabPriority = 'routine' | 'urgent' | 'stat';
export type ResultInterpretation = 'low' | 'normal' | 'high' | 'critical';

// Database Query Types
export interface ManualLabOrderQuery {
    workplaceId: mongoose.Types.ObjectId;
    patientId?: mongoose.Types.ObjectId;
    status?: ManualLabOrderStatus | ManualLabOrderStatus[];
    priority?: ManualLabPriority;
    orderedBy?: mongoose.Types.ObjectId;
    locationId?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface ManualLabResultQuery {
    orderId?: string;
    enteredBy?: mongoose.Types.ObjectId;
    aiProcessed?: boolean;
    hasAbnormalResults?: boolean;
    hasCriticalResults?: boolean;
    reviewStatus?: 'pending' | 'reviewed';
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// Configuration Types
export interface ManualLabConfig {
    pdfGeneration: {
        templatePath: string;
        outputPath: string;
        maxFileSize: number;
        retentionDays: number;
    };
    tokenSecurity: {
        algorithm: string;
        expirationDays: number;
        secretKey: string;
    };
    aiIntegration: {
        enabled: boolean;
        autoTrigger: boolean;
        timeoutMs: number;
        retryAttempts: number;
    };
    notifications: {
        enabled: boolean;
        criticalAlerts: boolean;
        emailTemplates: {
            orderCreated: string;
            resultsReady: string;
            criticalResult: string;
        };
    };
}