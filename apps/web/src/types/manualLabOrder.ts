/**
 * TypeScript interfaces for Manual Lab Order workflow
 * Matches backend models and API structures for type safety
 */

import { ObjectId, AuditFields, Patient } from './patientManagement';

// Lab Order Status
export type LabOrderStatus =
    | 'requested'
    | 'sample_collected'
    | 'result_awaited'
    | 'completed'
    | 'referred';

// Lab Order Priority
export type LabOrderPriority = 'routine' | 'urgent' | 'stat';

// Test Definition
export interface TestDefinition {
    name: string;
    code: string;
    loincCode?: string;
    specimenType: string;
    unit?: string;
    refRange?: string;
    category?: string;
}

// Manual Lab Order Interface
export interface ManualLabOrder extends AuditFields {
    _id: ObjectId;
    orderId: string; // LAB-YYYY-XXXX format
    patientId: ObjectId;
    workplaceId: ObjectId;
    locationId?: string;
    orderedBy: ObjectId;

    tests: TestDefinition[];
    indication: string;
    requisitionFormUrl: string;
    barcodeData: string;

    status: LabOrderStatus;
    priority?: LabOrderPriority;
    notes?: string;

    // Consent and compliance
    consentObtained: boolean;
    consentTimestamp: Date;
    consentObtainedBy: ObjectId;

    // Populated fields
    patient?: Patient;
}

// Lab Result Value
export interface LabResultValue {
    testCode: string;
    testName: string;
    numericValue?: number;
    unit?: string;
    stringValue?: string;
    comment?: string;
    abnormalFlag?: boolean;
}

// Lab Result Interpretation
export interface LabResultInterpretation {
    testCode: string;
    interpretation: 'low' | 'normal' | 'high' | 'critical';
    note?: string;
}

// Manual Lab Result Interface
export interface ManualLabResult extends AuditFields {
    _id: ObjectId;
    orderId: string;
    enteredBy: ObjectId;
    enteredAt: Date;

    values: LabResultValue[];
    interpretation: LabResultInterpretation[];

    // AI processing
    aiProcessed: boolean;
    aiProcessedAt?: Date;
    diagnosticResultId?: ObjectId;

    // Quality control
    reviewedBy?: ObjectId;
    reviewedAt?: Date;
    reviewNotes?: string;
}

// Test Catalog Interface
export interface TestCatalogItem {
    _id: ObjectId;
    name: string;
    code: string;
    loincCode?: string;
    specimenType: string;
    unit?: string;
    refRange?: string;
    category: string;
    description?: string;
    isActive: boolean;
}

// Form Data Interfaces
export interface CreateLabOrderData {
    patientId: ObjectId;
    tests: TestDefinition[];
    indication: string;
    priority?: LabOrderPriority;
    notes?: string;
    consentObtained: boolean;
}

export interface AddLabResultData {
    values: LabResultValue[];
    comment?: string;
}

// API Response Interfaces
export interface LabOrderResponse {
    success: boolean;
    data: {
        order: ManualLabOrder;
        pdfUrl?: string;
    };
    message?: string;
}

export interface LabResultResponse {
    success: boolean;
    data: {
        result: ManualLabResult;
        diagnosticResult?: any; // From AI interpretation
    };
    message?: string;
}

export interface TestCatalogResponse {
    success: boolean;
    data: {
        tests: TestCatalogItem[];
        total: number;
    };
    message?: string;
}

// Token Resolution Interface
export interface TokenResolutionResponse {
    success: boolean;
    data: {
        order: ManualLabOrder;
        canEnterResults: boolean;
    };
    message?: string;
}

// Search and Filter Interfaces
export interface TestCatalogSearchParams {
    q?: string; // Search query
    category?: string;
    specimenType?: string;
    page?: number;
    limit?: number;
}

export interface LabOrderSearchParams {
    patientId?: ObjectId;
    status?: LabOrderStatus;
    priority?: LabOrderPriority;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
}

// Form Validation Types
export interface LabOrderFormErrors {
    patient?: string;
    tests?: string;
    indication?: string;
    consent?: string;
}

export interface LabResultFormErrors {
    values?: { [testCode: string]: string };
    general?: string;
}

// Constants
export const LAB_ORDER_STATUSES: { value: LabOrderStatus; label: string; color: string }[] = [
    { value: 'requested', label: 'Requested', color: '#2196f3' },
    { value: 'sample_collected', label: 'Sample Collected', color: '#ff9800' },
    { value: 'result_awaited', label: 'Result Awaited', color: '#9c27b0' },
    { value: 'completed', label: 'Completed', color: '#4caf50' },
    { value: 'referred', label: 'Referred', color: '#f44336' },
];

export const LAB_ORDER_PRIORITIES: { value: LabOrderPriority; label: string; color: string }[] = [
    { value: 'routine', label: 'Routine', color: '#4caf50' },
    { value: 'urgent', label: 'Urgent', color: '#ff9800' },
    { value: 'stat', label: 'STAT', color: '#f44336' },
];

export const SPECIMEN_TYPES = [
    'Blood',
    'Urine',
    'Stool',
    'Sputum',
    'CSF',
    'Swab',
    'Tissue',
    'Other'
];

export const TEST_CATEGORIES = [
    'Hematology',
    'Chemistry',
    'Microbiology',
    'Immunology',
    'Pathology',
    'Radiology',
    'Other'
];