/**
 * Common types used across the pharmacy application
 * Shared by all platforms (web, mobile, desktop)
 */

export type ObjectId = string;

export interface AuditFields {
    createdBy?: ObjectId;
    updatedBy?: ObjectId;
    createdAt: string;
    updatedAt: string;
    isDeleted?: boolean;
}

// API Response Types
export interface ApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
    meta?: {
        total?: number;
        page?: number;
        limit?: number;
        totalPages?: number;
        hasNext?: boolean;
        hasPrev?: boolean;
    };
    timestamp: string;
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

export type ResourceResponse<T> = PaginatedResponse<T> | { results: T[] };

// Pagination Types
export interface Pagination {
    page: number;
    limit: number;
}

export interface PaginationResponse {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

// Error Types
export interface ValidationError {
    field: string;
    message: string;
    code?: string;
}

export interface ApiError {
    code: string;
    message: string;
    details?: ValidationError[] | unknown;
    statusCode?: number;
}

// Nigerian Healthcare Specific Types
export type NigerianState =
    | 'Abia'
    | 'Adamawa'
    | 'Akwa Ibom'
    | 'Anambra'
    | 'Bauchi'
    | 'Bayelsa'
    | 'Benue'
    | 'Borno'
    | 'Cross River'
    | 'Delta'
    | 'Ebonyi'
    | 'Edo'
    | 'Ekiti'
    | 'Enugu'
    | 'FCT'
    | 'Gombe'
    | 'Imo'
    | 'Jigawa'
    | 'Kaduna'
    | 'Kano'
    | 'Katsina'
    | 'Kebbi'
    | 'Kogi'
    | 'Kwara'
    | 'Lagos'
    | 'Nasarawa'
    | 'Niger'
    | 'Ogun'
    | 'Ondo'
    | 'Osun'
    | 'Oyo'
    | 'Plateau'
    | 'Rivers'
    | 'Sokoto'
    | 'Taraba'
    | 'Yobe'
    | 'Zamfara';

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type Genotype = 'AA' | 'AS' | 'SS' | 'AC' | 'SC' | 'CC';
export type Gender = 'male' | 'female' | 'other';
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';
export type SeverityLevel = 'mild' | 'moderate' | 'severe';
