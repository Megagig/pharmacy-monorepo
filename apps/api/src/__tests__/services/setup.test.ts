/**
 * Minimal test setup for service tests
 * Avoids importing app.ts to prevent uuid module issues
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

// Mock uuid before any imports
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

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
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }

  // Stop the in-memory MongoDB instance
  if (mongoServer) {
    await mongoServer.stop();
  }
});
