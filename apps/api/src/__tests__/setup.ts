import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';
import { Application } from 'express';
import { beforeAll, afterAll, afterEach, expect } from '@jest/globals';

export function createTestApp(): Application {
    return app;
}

let mongoServer: MongoMemoryServer;

// Setup before all tests
beforeAll(async () => {
    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();

    // Connect to the in-memory database
    await mongoose.connect(mongoUri);
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
});

// Cleanup after all tests
afterAll(async () => {
    // Close database connection
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();

    // Stop the in-memory MongoDB instance
    await mongoServer.stop();
});

// Global test utilities
global.testUtils = {
    createObjectId: () => new mongoose.Types.ObjectId(),

    createMockUser: () => ({
        _id: new mongoose.Types.ObjectId(),
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        role: 'pharmacist'
    }),

    createMockWorkplace: () => ({
        _id: new mongoose.Types.ObjectId(),
        name: 'Test Pharmacy',
        type: 'pharmacy'
    }),

    createMockPatient: () => ({
        _id: new mongoose.Types.ObjectId(),
        firstName: 'John',
        lastName: 'Doe',
        mrn: 'MRN123456',
        dob: new Date('1980-01-01'),
        phone: '+2348012345678'
    })
};

// Extend Jest matchers
expect.extend({
    toBeValidObjectId(received) {
        const pass = mongoose.Types.ObjectId.isValid(received);
        if (pass) {
            return {
                message: () => `expected ${received} not to be a valid ObjectId`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${received} to be a valid ObjectId`,
                pass: false,
            };
        }
    },
});

// Type declarations for global utilities
declare global {
    namespace jest {
        interface Matchers<R> {
            toBeValidObjectId(): R;
        }
    }

    var testUtils: {
        createObjectId: () => mongoose.Types.ObjectId;
        createMockUser: () => any;
        createMockWorkplace: () => any;
        createMockPatient: () => any;
    };
}