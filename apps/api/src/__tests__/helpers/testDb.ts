/**
 * Test Database Helper
 * Provides utilities for setting up and tearing down test database
 */

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer: MongoMemoryServer;

/**
 * Connect to in-memory MongoDB instance for testing
 */
export const connectTestDB = async (): Promise<void> => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    await mongoose.connect(mongoUri);
  } catch (error) {
    console.error('Error connecting to test database:', error);
    throw error;
  }
};

/**
 * Disconnect from test database and stop MongoDB instance
 */
export const disconnectTestDB = async (): Promise<void> => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    if (mongoServer) {
      await mongoServer.stop();
    }
  } catch (error) {
    console.error('Error disconnecting from test database:', error);
    throw error;
  }
};

/**
 * Clear all collections in the test database
 */
export const clearTestDB = async (): Promise<void> => {
  try {
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  } catch (error) {
    console.error('Error clearing test database:', error);
    throw error;
  }
};