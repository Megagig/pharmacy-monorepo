import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { jest } from '@jest/globals';


import * as openRouterService from '../../../services/openRouterService';
import * as rxnormService from '../../../services/rxnormService';
import * as openfdaService from '../../../services/openfdaService';

jest.mock('../../../services/openRouterService');
jest.mock('../../../services/rxnormService');
jest.mock('../../../services/openfdaService');

// Extend Jest timeout for integration tests
jest.setTimeout(30000);

// Global test database instance
let mongoServer: MongoMemoryServer;

// Setup before all tests
beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create({
        instance: {
            dbName: 'diagnostic-test-db',
        },
    });

    const mongoUri = mongoServer.getUri();

    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    } as any);

    // Set up test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-diagnostics';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.RXNORM_API_KEY = 'test-rxnorm-key';
    process.env.OPENFDA_API_KEY = 'test-openfda-key';
    process.env.REDIS_URL = 'redis://localhost:6379/1'; // Test Redis DB
});

// Cleanup after each test
afterEach(async () => {
    // Clear all collections
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        const collection = collections[key];
        if (collection) {
            await collection.deleteMany({});
        }
    }

    // Clear any mocks
    jest.clearAllMocks();
});

// Cleanup after all tests
afterAll(async () => {
    // Close database connection
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();

    // Stop the in-memory MongoDB instance
    await mongoServer.stop();
});

declare global {
    namespace NodeJS {
        interface Global {
            testUtils: {
                createObjectId: () => mongoose.Types.ObjectId;
                waitFor: (ms: number) => Promise<void>;
                mockExternalAPI: (service: string, response: any) => void;
                createTestWorkplace: () => any;
                createTestUser: (workplaceId: mongoose.Types.ObjectId) => any;
                createTestPatient: (workplaceId: mongoose.Types.ObjectId, createdBy: mongoose.Types.ObjectId) => any;
                createTestDiagnosticRequest: (patientId: mongoose.Types.ObjectId, pharmacistId: mongoose.Types.ObjectId, workplaceId: mongoose.Types.ObjectId) => any;
            };
        }
    }
}

// Global test utilities
(global as any).testUtils = {
    // Create test ObjectId
    createObjectId: () => new mongoose.Types.ObjectId(),

    // Wait for async operations
    waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

    // Mock external API responses
    mockExternalAPI: (service: string, mockFn: jest.Mock) => {
        switch (service) {
            case 'openrouter':
                (openRouterService as any).generateDiagnosticAnalysis = mockFn;
                break;
            case 'rxnorm':
                (rxnormService as any).searchDrug = mockFn;
                (rxnormService as any).getDrugInteractions = mockFn;
                break;
            case 'openfda':
                (openfdaService as any).getAdverseEvents = mockFn;
                (openfdaService as any).getDrugLabeling = mockFn;
                break;
        }
    },

    // Create test data factories
    createTestWorkplace: () => ({
        name: 'Test Pharmacy',
        address: '123 Test St',
        phone: '555-0123',
        email: 'test@pharmacy.com',
        licenseNumber: 'TEST123',
        subscriptionPlan: 'professional',
        isActive: true,
    }),

    createTestUser: (workplaceId: mongoose.Types.ObjectId) => ({
        email: 'test.pharmacist@test.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'Pharmacist',
        role: 'pharmacist',
        workplaceId,
        isActive: true,
        isEmailVerified: true,
    }),

    createTestPatient: (workplaceId: mongoose.Types.ObjectId, createdBy: mongoose.Types.ObjectId) => ({
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1980-01-01'),
        gender: 'male',
        phone: '555-0123',
        email: 'john.doe@test.com',
        workplaceId,
        createdBy,
    }),

    createTestDiagnosticRequest: (patientId: mongoose.Types.ObjectId, pharmacistId: mongoose.Types.ObjectId, workplaceId: mongoose.Types.ObjectId) => ({
        patientId,
        pharmacistId,
        workplaceId,
        inputSnapshot: {
            symptoms: {
                subjective: ['headache', 'nausea'],
                objective: ['elevated blood pressure'],
                duration: '2 days',
                severity: 'moderate',
                onset: 'acute',
            },
            vitals: {
                bloodPressure: '150/90',
                heartRate: 85,
                temperature: 98.6,
            },
            currentMedications: [
                {
                    name: 'Lisinopril',
                    dosage: '10mg',
                    frequency: 'daily',
                },
            ],
            allergies: ['penicillin'],
        },
        clinicalContext: {
            chiefComplaint: 'Headache and high blood pressure',
            presentingSymptoms: ['headache', 'nausea'],
            relevantHistory: 'History of hypertension',
        },
        consentObtained: true,
        consentTimestamp: new Date(),
        status: 'pending',
        priority: 'medium',
        createdBy: pharmacistId,
        updatedBy: pharmacistId,
    }),
};

// Console override for cleaner test output
const originalConsole = console;
global.console = {
    ...originalConsole,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: originalConsole.error, // Keep errors visible
};

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

export { };