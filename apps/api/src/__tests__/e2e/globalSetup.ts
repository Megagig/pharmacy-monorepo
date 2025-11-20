/**
 * Global Setup for Patient Engagement E2E Tests
 * 
 * This file runs once before all E2E tests to set up the test environment.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import Redis from 'ioredis';

export default async function globalSetup() {
  console.log('🔧 Setting up E2E test environment...');

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-e2e-tests';
  process.env.REDIS_URL = 'redis://localhost:6379/15'; // Use test database
  
  // Start MongoDB Memory Server
  const mongoServer = await MongoMemoryServer.create({
    instance: {
      dbName: 'patient-engagement-e2e-test',
      port: 27018, // Use different port for E2E tests
    },
  });
  
  const mongoUri = mongoServer.getUri();
  process.env.MONGODB_URI = mongoUri;
  
  // Store server instance for cleanup
  (global as any).__MONGOSERVER__ = mongoServer;
  
  console.log(`📦 MongoDB Memory Server started: ${mongoUri}`);

  // Test Redis connection
  try {
    const redis = new Redis(process.env.REDIS_URL);
    await redis.ping();
    await redis.disconnect();
    console.log('✅ Redis connection verified');
  } catch (error) {
    console.warn('⚠️  Redis not available, some tests may be skipped');
  }

  // Initialize test database with required indexes
  try {
    await mongoose.connect(mongoUri);
    
    // Create collections and indexes that would normally be created by the application
    const collections = [
      'users',
      'patients', 
      'appointments',
      'followuptasks',
      'pharmacistschedules',
      'remindertemplates',
      'workplaces',
      'visits',
      'medicationtherapyreviews',
      'clinicalinterventions',
      'diagnosticcases',
      'notifications'
    ];

    for (const collectionName of collections) {
      await mongoose.connection.db.createCollection(collectionName);
    }

    // Create essential indexes
    await mongoose.connection.db.collection('appointments').createIndex({ 
      workplaceId: 1, 
      scheduledDate: 1, 
      status: 1 
    });
    
    await mongoose.connection.db.collection('followuptasks').createIndex({ 
      workplaceId: 1, 
      status: 1, 
      dueDate: 1 
    });
    
    await mongoose.connection.db.collection('patients').createIndex({ 
      workplaceId: 1, 
      mrn: 1 
    });

    await mongoose.disconnect();
    console.log('✅ Test database initialized with indexes');
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error);
    throw error;
  }

  console.log('🚀 E2E test environment ready!\n');
}