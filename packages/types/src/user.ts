/**
 * User and Authentication Types
 */

import type { ObjectId } from './common';

export interface User {
    _id: ObjectId;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    workplaceId: ObjectId;
    workplaceRole?: string;
    permissions: string[];
    status?:
    | 'pending'
    | 'active'
    | 'suspended'
    | 'license_pending'
    | 'license_rejected';
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterData {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    pharmacyName?: string;
}

export interface AuthResponse {
    user: User;
    token: string;
}
