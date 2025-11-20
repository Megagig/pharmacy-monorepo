#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import setupFeatureFlags from './setupFeatureFlags';
import migrateToWorkspaceSubscriptions from './migrateToWorkspaceSubscriptions';

// Load environment variables
dotenv.config();

async function setupWorkspaceSubscriptionSystem() {
  try {
    console.log('🚀 Setting up unified workspace subscription system...');
    console.log('This will:');
    console.log('1. Setup feature flags for all tiers');
    console.log('2. Migrate existing users to workspace-based subscriptions');
    console.log('3. Create trial subscriptions for all workspaces');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Step 1: Setup feature flags
    console.log('\n📋 Step 1: Setting up feature flags...');
    await setupFeatureFlags();

    // Step 2: Migrate users to workspace subscriptions
    console.log('\n👥 Step 2: Migrating users to workspace subscriptions...');
    await migrateToWorkspaceSubscriptions();

    console.log('\n🎉 Workspace subscription system setup completed successfully!');
    console.log('\n✅ Summary:');
    console.log('- Feature flags created/updated for all tiers');
    console.log('- Users without workspaces migrated to personal workspaces');
    console.log('- Trial subscriptions created for all workspaces');
    console.log('- System now uses unified workspace-based subscriptions');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run setup if this script is executed directly
if (require.main === module) {
  setupWorkspaceSubscriptionSystem();
}

export default setupWorkspaceSubscriptionSystem;