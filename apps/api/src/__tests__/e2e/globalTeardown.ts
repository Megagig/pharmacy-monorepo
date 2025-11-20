/**
 * Global Teardown for Patient Engagement E2E Tests
 * 
 * This file runs once after all E2E tests to clean up the test environment.
 */

import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalTeardown() {
  console.log('\n🧹 Cleaning up E2E test environment...');

  // Stop MongoDB Memory Server
  const mongoServer: MongoMemoryServer = (global as any).__MONGOSERVER__;
  
  if (mongoServer) {
    await mongoServer.stop();
    console.log('✅ MongoDB Memory Server stopped');
  }

  // Clear environment variables
  delete process.env.MONGODB_URI;
  delete process.env.JWT_SECRET;
  
  console.log('✅ E2E test environment cleaned up');
}