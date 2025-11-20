#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import WorkspaceSubscriptionService from '../src/services/workspaceSubscriptionService';

// Load environment variables
dotenv.config();

async function migrateToWorkspaceSubscriptions() {
  try {
    console.log('🚀 Starting migration to workspace-based subscriptions...');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Run migration
    await WorkspaceSubscriptionService.migrateUsersWithoutWorkspaces();

    console.log('🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateToWorkspaceSubscriptions();
}

export default migrateToWorkspaceSubscriptions;