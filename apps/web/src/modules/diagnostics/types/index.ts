// Frontend Types for Diagnostics Module

export interface DiagnosticRequest {
    _id: string;
    patientId: string;
    pharmacistId: string;
    workplaceId: string;
    locationId?: string;
    inputSnapshot: {
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
        labResultIds?: string[];
    };
    consentObtained: boolean;
    consentTimestamp: string;
    promptVersion: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    processedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface DiagnosticResult {
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

export interface LabOrder {
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

export interface LabResult {
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

export interface DrugInteraction {
    drug1: string;
    drug2: string;
    severity: 'minor' | 'moderate' | 'major';
    description: string;
    clinicalEffect: string;
    mechanism?: string;
    management?: string;
}

export interface AllergyAlert {
    drug: string;
    allergy: string;
    severity: 'mild' | 'moderate' | 'severe';
    reaction: string;
}

export interface Contraindication {
    drug: string;
    condition: string;
    reason: string;
    severity: 'warning' | 'contraindicated';
}

// Form types
export interface DiagnosticRequestForm {
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
    labResults?: string[];
    consent: boolean;
}

export interface LabOrderForm {
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

export interface LabResultForm {
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

// Store types
export interface DiagnosticFilters {
    search?: string;
    patientId?: string;
    status?: DiagnosticStatus;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface DiagnosticUIState {
    pollingActive: boolean;
    pollingInterval: NodeJS.Timeout | null;
    showCreateModal: boolean;
    showResultModal: boolean;
    activeStep: number;
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
}

export interface DiagnosticStore {
    // State
    requests: DiagnosticRequest[];
    results: DiagnosticResult[];
    selectedRequest: DiagnosticRequest | null;
    selectedResult: DiagnosticResult | null;
    filters: DiagnosticFilters;
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
    uiState: DiagnosticUIState;
    analytics: DiagnosticAnalytics | null;
    loading: {
        createRequest: boolean;
        fetchRequests: boolean;
        fetchResult: boolean;
        approveResult: boolean;
        fetchAnalytics: boolean;
        polling: boolean;
    };
    errors: {
        createRequest: string | null;
        fetchRequests: string | null;
        fetchResult: string | null;
        approveResult: string | null;
        fetchAnalytics: string | null;
        polling: string | null;
    };

    // CRUD Actions
    createRequest: (data: DiagnosticRequestForm) => Promise<DiagnosticRequest | null>;
    fetchRequests: (filters?: DiagnosticFilters) => Promise<void>;
    fetchResult: (requestId: string) => Promise<DiagnosticResult | null>;
    approveResult: (resultId: string) => Promise<boolean>;
    modifyResult: (resultId: string, modifications: string) => Promise<boolean>;
    rejectResult: (resultId: string, reason: string) => Promise<boolean>;
    cancelRequest: (requestId: string) => Promise<boolean>;

    // Polling Actions
    startPolling: (requestId: string, interval?: number) => void;
    stopPolling: () => void;
    pollResult: (requestId: string) => Promise<void>;

    // Filter and Search Actions
    setFilters: (filters: Partial<DiagnosticFilters>) => void;
    clearFilters: () => void;
    searchRequests: (searchTerm: string) => void;
    filterByPatient: (patientId: string) => void;
    filterByStatus: (status: DiagnosticStatus) => void;

    // Pagination Actions
    setPage: (page: number) => void;
    setLimit: (limit: number) => void;

    // Selection Actions
    selectRequest: (request: DiagnosticRequest | null) => void;
    selectResult: (result: DiagnosticResult | null) => void;

    // UI Actions
    setShowCreateModal: (show: boolean) => void;
    setShowResultModal: (show: boolean) => void;
    setActiveStep: (step: number) => void;

    // Analytics Actions
    fetchAnalytics: (params?: { dateFrom?: string; dateTo?: string; patientId?: string }) => Promise<void>;

    // Optimistic Updates
    addRequestToState: (request: DiagnosticRequest) => void;
    updateRequestInState: (id: string, updates: Partial<DiagnosticRequest>) => void;
    removeRequestFromState: (id: string) => void;
    addResultToState: (result: DiagnosticResult) => void;
    updateResultInState: (id: string, updates: Partial<DiagnosticResult>) => void;

    // Utility Actions
    clearErrors: () => void;
    setLoading: (key: string, loading: boolean) => void;
    setError: (key: string, error: string | null) => void;

    // Computed Values/Selectors
    getRequestsByPatient: (patientId: string) => DiagnosticRequest[];
    getResultsByRequest: (requestId: string) => DiagnosticResult[];
    getPendingRequests: () => DiagnosticRequest[];
    getCompletedRequests: () => DiagnosticRequest[];
    getFilteredRequests: () => DiagnosticRequest[];
}

// Lab Store Types
export interface LabFilters {
    search?: string;
    patientId?: string;
    status?: LabOrderStatus;
    testCode?: string;
    interpretation?: LabResultInterpretation;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
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

export interface LabTestCatalogItem {
    code: string;
    name: string;
    loincCode?: string;
    category: string;
    description?: string;
    referenceRange?: {
        low?: number;
        high?: number;
        text?: string;
        unit?: string;
    };
}

export interface LabStore {
    // State
    orders: LabOrder[];
    results: LabResult[];
    selectedOrder: LabOrder | null;
    selectedResult: LabResult | null;
    filters: {
        orders: LabFilters;
        results: LabFilters;
    };
    pagination: {
        orders: {
            page: number;
            limit: number;
            total: number;
            pages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
        results: {
            page: number;
            limit: number;
            total: number;
            pages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    };
    trends: { [key: string]: LabTrendData };
    testCatalog: LabTestCatalogItem[];
    criticalResults: LabResult[];
    abnormalResults: LabResult[];
    loading: {
        createOrder: boolean;
        fetchOrders: boolean;
        addResult: boolean;
        fetchResults: boolean;
        updateOrder: boolean;
        updateResult: boolean;
        fetchTrends: boolean;
        fetchCatalog: boolean;
        fetchCritical: boolean;
        fetchAbnormal: boolean;
        fhirImport: boolean;
        fhirExport: boolean;
    };
    errors: {
        createOrder: string | null;
        fetchOrders: string | null;
        addResult: string | null;
        fetchResults: string | null;
        updateOrder: string | null;
        updateResult: string | null;
        fetchTrends: string | null;
        fetchCatalog: string | null;
        fetchCritical: string | null;
        fetchAbnormal: string | null;
        fhirImport: string | null;
        fhirExport: string | null;
    };

    // CRUD Actions
    createOrder: (data: LabOrderForm) => Promise<LabOrder | null>;
    fetchOrders: (filters?: LabFilters) => Promise<void>;
    updateOrderStatus: (orderId: string, status: LabOrderStatus) => Promise<boolean>;
    cancelOrder: (orderId: string) => Promise<boolean>;
    addResult: (data: LabResultForm) => Promise<LabResult | null>;
    fetchResults: (filters?: LabFilters) => Promise<void>;
    updateResult: (resultId: string, data: Partial<LabResultForm>) => Promise<boolean>;
    deleteResult: (resultId: string) => Promise<boolean>;

    // Trend Analysis
    fetchTrends: (patientId: string, testCode: string, days?: number) => Promise<void>;
    getTrendData: (patientId: string, testCode: string) => LabTrendData | null;

    // Critical and Abnormal Results
    fetchCriticalResults: (workplaceId?: string) => Promise<void>;
    fetchAbnormalResults: (patientId: string, days?: number) => Promise<void>;

    // Test Catalog
    fetchTestCatalog: (search?: string) => Promise<void>;
    searchTestCatalog: (search: string) => LabTestCatalogItem[];

    // FHIR Integration
    importFHIR: (data: { fhirBundle: any; patientMapping: { fhirPatientId: string; internalPatientId: string } }) => Promise<boolean>;
    exportOrder: (orderId: string) => Promise<boolean>;

    // Filter and Search Actions
    setOrderFilters: (filters: Partial<LabFilters>) => void;
    setResultFilters: (filters: Partial<LabFilters>) => void;
    clearOrderFilters: () => void;
    clearResultFilters: () => void;
    searchOrders: (searchTerm: string) => void;
    searchResults: (searchTerm: string) => void;
    filterOrdersByPatient: (patientId: string) => void;
    filterResultsByPatient: (patientId: string) => void;
    filterOrdersByStatus: (status: LabOrderStatus) => void;
    filterResultsByInterpretation: (interpretation: LabResultInterpretation) => void;

    // Pagination Actions
    setOrderPage: (page: number) => void;
    setOrderLimit: (limit: number) => void;
    setResultPage: (page: number) => void;
    setResultLimit: (limit: number) => void;

    // Selection Actions
    selectOrder: (order: LabOrder | null) => void;
    selectResult: (result: LabResult | null) => void;

    // Optimistic Updates
    addOrderToState: (order: LabOrder) => void;
    updateOrderInState: (id: string, updates: Partial<LabOrder>) => void;
    removeOrderFromState: (id: string) => void;
    addResultToState: (result: LabResult) => void;
    updateResultInState: (id: string, updates: Partial<LabResult>) => void;
    removeResultFromState: (id: string) => void;

    // Utility Actions
    clearErrors: () => void;
    setLoading: (key: string, loading: boolean) => void;
    setError: (key: string, error: string | null) => void;

    // Computed Values/Selectors
    getOrdersByPatient: (patientId: string) => LabOrder[];
    getResultsByPatient: (patientId: string) => LabResult[];
    getResultsByOrder: (orderId: string) => LabResult[];
    getPendingOrders: () => LabOrder[];
    getCompletedOrders: () => LabOrder[];
    getCriticalResultsByPatient: (patientId: string) => LabResult[];
    getAbnormalResultsByPatient: (patientId: string) => LabResult[];
    getFilteredOrders: () => LabOrder[];
    getFilteredResults: () => LabResult[];
    getResultInterpretationSummary: (patientId: string) => {
        normal: number;
        abnormal: number;
        critical: number;
        total: number;
    };
}

// UI Component Props
export interface SymptomInputProps {
    value: DiagnosticRequestForm['symptoms'];
    onChange: (symptoms: DiagnosticRequestForm['symptoms']) => void;
    error?: string;
    disabled?: boolean;
}

export interface VitalSignsInputProps {
    value?: DiagnosticRequestForm['vitals'];
    onChange: (vitals: DiagnosticRequestForm['vitals']) => void;
    error?: string;
    disabled?: boolean;
}

export interface MedicationHistoryInputProps {
    value?: DiagnosticRequestForm['currentMedications'];
    onChange: (medications: DiagnosticRequestForm['currentMedications']) => void;
    error?: string;
    disabled?: boolean;
}

export interface AllergyInputProps {
    value?: string[];
    onChange: (allergies: string[]) => void;
    error?: string;
    disabled?: boolean;
}

export interface DiagnosticResultsPanelProps {
    result: DiagnosticResult;
    onApprove?: () => void;
    onModify?: (modifications: string) => void;
    onReject?: (reason: string) => void;
    loading?: boolean;
    error?: string;
}

export interface LabOrderFormProps {
    patientId: string;
    onSubmit: (data: LabOrderForm) => void;
    loading?: boolean;
    error?: string;
}

export interface LabResultEntryProps {
    orderId?: string;
    patientId: string;
    onSubmit: (data: LabResultForm) => void;
    loading?: boolean;
    error?: string;
}

export interface LabResultViewerProps {
    results: LabResult[];
    showTrends?: boolean;
    onResultClick?: (result: LabResult) => void;
}

// API Response types
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
    meta?: {
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
    };
}

export interface PaginatedResponse<T> extends ApiResponse<{ results: T[] }> {
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

// Query parameters
export interface DiagnosticHistoryParams {
    patientId?: string;
    page?: number;
    limit?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
}

export interface LabOrderParams {
    patientId?: string;
    status?: string;
    page?: number;
    limit?: number;
}

export interface LabResultParams {
    patientId?: string;
    testCode?: string;
    interpretation?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
}

// Utility types
export type DiagnosticStatus = DiagnosticRequest['status'];
export type LabOrderStatus = LabOrder['status'];
export type LabResultInterpretation = LabResult['interpretation'];
export type SeverityLevel = 'mild' | 'moderate' | 'severe';
export type PriorityLevel = 'stat' | 'urgent' | 'routine' | 'optional';
export type ReviewStatus = 'approved' | 'modified' | 'rejected';

// Error types
export interface DiagnosticError {
    code: string;
    message: string;
    field?: string;
    details?: any;
}

export interface ValidationError {
    field: string;
    message: string;
    code: string;
}

// Loading states
export interface LoadingStates {
    [key: string]: boolean;
}

export interface ErrorStates {
    [key: string]: string | null;
}