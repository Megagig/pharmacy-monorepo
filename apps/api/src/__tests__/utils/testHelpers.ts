import jwt from 'jsonwebtoken';
import { IUser } from '../../models/User';

/**
 * Test helper utilities for clinical notes security testing
 */

/**
 * Generate a test JWT token for a user
 */
export function generateTestToken(user: IUser): string {
    const payload = {
        userId: user._id,
        email: user.email,
        role: user.role,
        workplaceId: user.workplaceId,
        workplaceRole: user.workplaceRole,
    };

    return jwt.sign(payload, process.env.JWT_SECRET || 'test-secret', {
        expiresIn: '1h',
    });
}

/**
 * Create test user data
 */
export function createTestUserData(overrides: Partial<any> = {}) {
    return {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        passwordHash: 'hashedpassword',
        role: 'pharmacist',
        workplaceRole: 'Pharmacist',
        status: 'active',
        licenseStatus: 'approved',
        ...overrides,
    };
}

/**
 * Create test patient data
 */
export function createTestPatientData(workplaceId: string, overrides: Partial<any> = {}) {
    return {
        firstName: 'Test',
        lastName: 'Patient',
        mrn: 'TEST001',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        phone: '1234567890',
        workplaceId,
        ...overrides,
    };
}

/**
 * Create test clinical note data
 */
export function createTestNoteData(
    patientId: string,
    pharmacistId: string,
    workplaceId: string,
    overrides: Partial<any> = {}
) {
    return {
        patient: patientId,
        pharmacist: pharmacistId,
        workplaceId,
        type: 'consultation',
        title: 'Test Clinical Note',
        content: {
            subjective: 'Test subjective content',
            objective: 'Test objective content',
            assessment: 'Test assessment content',
            plan: 'Test plan content',
        },
        priority: 'medium',
        isConfidential: false,
        createdBy: pharmacistId,
        lastModifiedBy: pharmacistId,
        ...overrides,
    };
}

/**
 * Create test workplace data
 */
export function createTestWorkplaceData(overrides: Partial<any> = {}) {
    return {
        name: 'Test Pharmacy',
        address: 'Test Address',
        phone: '1234567890',
        email: 'test@pharmacy.com',
        ...overrides,
    };
}

/**
 * Create test MTR session data
 */
export function createTestMTRSessionData(
    patientId: string,
    pharmacistId: string,
    workplaceId: string,
    overrides: Partial<any> = {}
) {
    return {
        workplaceId,
        patientId,
        pharmacistId,
        reviewNumber: `MTR-${Date.now()}`,
        reviewType: 'comprehensive',
        status: 'completed',
        startedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        completedAt: new Date(),
        medications: [],
        createdBy: pharmacistId,
        ...overrides,
    };
}

/**
 * Wait for a specified amount of time (for async operations)
 */
export function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random string for unique test data
 */
export function generateRandomString(length: number = 8): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Clean up test data
 */
export async function cleanupTestData(models: any[]) {
    for (const model of models) {
        try {
            await model.deleteMany({});
        } catch (error) {
            console.warn(`Failed to cleanup ${model.modelName}:`, error);
        }
    }
}

export default {
    generateTestToken,
    createTestUserData,
    createTestPatientData,
    createTestNoteData,
    createTestWorkplaceData,
    wait,
    generateRandomString,
    cleanupTestData,
};