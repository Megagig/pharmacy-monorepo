// Enhanced TypeScript interfaces for Clinical Notes
// This file provides centralized type definitions for the clinical notes module

export interface Attachment {
    _id: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    uploadedAt: string;
    uploadedBy: string;
}

export interface LabResult {
    test: string;
    result: string;
    normalRange: string;
    date: string;
    status: 'normal' | 'abnormal' | 'critical';
}

export interface VitalSigns {
    bloodPressure?: {
        systolic?: number;
        diastolic?: number;
    };
    heartRate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    recordedAt?: string;
}

export interface PatientInfo {
    _id: string;
    firstName: string;
    lastName: string;
    mrn: string;
}

export interface PharmacistInfo {
    _id: string;
    firstName: string;
    lastName: string;
    role: string;
}

export interface ClinicalNote {
    _id: string;
    patient: PatientInfo;
    pharmacist: PharmacistInfo;
    workplaceId: string;
    locationId?: string;
    type: 'consultation' | 'medication_review' | 'follow_up' | 'adverse_event' | 'other';
    title: string;
    content: {
        subjective?: string;
        objective?: string;
        assessment?: string;
        plan?: string;
    };
    medications: string[];
    vitalSigns?: VitalSigns;
    laborResults: LabResult[];
    recommendations: string[];
    followUpRequired: boolean;
    followUpDate?: string;
    attachments: Attachment[];
    priority: 'low' | 'medium' | 'high';
    isConfidential: boolean;
    tags: string[];
    createdAt: string;
    updatedAt: string;
    createdBy: string;
    lastModifiedBy: string;
    deletedAt?: string;
    deletedBy?: string;
}

export interface ClinicalNoteFormData {
    patient: string; // patientId
    type: 'consultation' | 'medication_review' | 'follow_up' | 'adverse_event' | 'other';
    title: string;
    content: {
        subjective?: string;
        objective?: string;
        assessment?: string;
        plan?: string;
    };
    medications?: string[];
    vitalSigns?: VitalSigns;
    laborResults?: LabResult[];
    recommendations?: string[];
    followUpRequired?: boolean;
    followUpDate?: string;
    priority?: 'low' | 'medium' | 'high';
    isConfidential?: boolean;
    tags?: string[];
}

export interface ClinicalNoteFilters {
    search?: string;
    patientId?: string;
    type?: string;
    priority?: string;
    dateFrom?: string;
    dateTo?: string;
    tags?: string[];
    isConfidential?: boolean;
    followUpRequired?: boolean;
    sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'priority';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
}

export interface ClinicalNotesResponse {
    notes: ClinicalNote[];
    totalPages: number;
    currentPage: number;
    total: number;
    filters?: any;
}

export interface BulkUpdateData {
    noteIds: string[];
    updates: Partial<ClinicalNoteFormData>;
}

export interface NoteStatistics {
    totalNotes: number;
    typeDistribution: Record<string, number>;
    priorityDistribution: Record<string, number>;
    confidentialNotes: number;
    notesWithFollowUp: number;
    notesWithAttachments: number;
}

// Form validation types
export interface ValidationError {
    field: string;
    message: string;
}

export interface ValidationResult {
    isValid: boolean;
    errors: ValidationError[];
}

// UI State types
export interface ClinicalNoteUIState {
    selectedNotes: string[];
    isLoading: boolean;
    error: string | null;
    filters: ClinicalNoteFilters;
    searchQuery: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
}

// API Response types
export interface ApiError {
    message: string;
    code?: string;
    details?: any;
}

export interface ApiResponse<T> {
    data: T;
    message?: string;
    success: boolean;
}

// File upload types
export interface FileUploadProgress {
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'completed' | 'error';
    error?: string;
}

export interface FileUploadState {
    files: FileUploadProgress[];
    isUploading: boolean;
    totalProgress: number;
}

// Constants
export const NOTE_TYPES = [
    { value: 'consultation', label: 'Consultation' },
    { value: 'medication_review', label: 'Medication Review' },
    { value: 'follow_up', label: 'Follow-up' },
    { value: 'adverse_event', label: 'Adverse Event' },
    { value: 'other', label: 'Other' }
] as const;

export const NOTE_PRIORITIES = [
    { value: 'low', label: 'Low', color: '#4caf50' },
    { value: 'medium', label: 'Medium', color: '#ff9800' },
    { value: 'high', label: 'High', color: '#f44336' }
] as const;

export const LAB_RESULT_STATUSES = [
    { value: 'normal', label: 'Normal', color: '#4caf50' },
    { value: 'abnormal', label: 'Abnormal', color: '#ff9800' },
    { value: 'critical', label: 'Critical', color: '#f44336' }
] as const;

// Type guards
export const isValidNoteType = (type: string): type is ClinicalNote['type'] => {
    return ['consultation', 'medication_review', 'follow_up', 'adverse_event', 'other'].includes(type);
};

export const isValidPriority = (priority: string): priority is ClinicalNote['priority'] => {
    return ['low', 'medium', 'high'].includes(priority);
};

export const isValidLabStatus = (status: string): status is LabResult['status'] => {
    return ['normal', 'abnormal', 'critical'].includes(status);
};