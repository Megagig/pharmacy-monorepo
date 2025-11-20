#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FeatureFlag } from '../src/models/FeatureFlag';

// Load environment variables
dotenv.config();

const FEATURE_FLAGS = [
  {
    key: 'patient_management',
    name: 'Patient Management',
    description: 'Create, view, and manage patient records',
    allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner'],
    isActive: true,
    metadata: {
      category: 'core',
      priority: 'high',
      tags: ['patients', 'records'],
    },
  },
  {
    key: 'clinical_decision_support',
    name: 'Clinical Decision Support',
    description: 'AI-powered diagnostic analysis and clinical recommendations',
    allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner'],
    isActive: true,
    customRules: {
      requiredLicense: true,
    },
    metadata: {
      category: 'ai',
      priority: 'high',
      tags: ['ai', 'diagnostics', 'clinical'],
    },
  },
  {
    key: 'drug_information',
    name: 'Drug Information',
    description: 'Comprehensive drug database and interaction checking',
    allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner', 'intern_pharmacist'],
    isActive: true,
    metadata: {
      category: 'clinical',
      priority: 'high',
      tags: ['drugs', 'interactions', 'database'],
    },
  },
  {
    key: 'ai_diagnostics',
    name: 'AI Diagnostics',
    description: 'Advanced AI-powered diagnostic capabilities',
    allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner'],
    isActive: true,
    customRules: {
      requiredLicense: true,
    },
    metadata: {
      category: 'ai',
      priority: 'critical',
      tags: ['ai', 'diagnostics', 'advanced'],
    },
  },
  {
    key: 'advanced_analytics',
    name: 'Advanced Analytics',
    description: 'Detailed analytics and reporting capabilities',
    allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'owner'],
    isActive: true,
    metadata: {
      category: 'analytics',
      priority: 'medium',
      tags: ['analytics', 'reports', 'insights'],
    },
  },
  {
    key: 'user_management',
    name: 'User Management',
    description: 'Manage team members and user permissions',
    allowedTiers: ['basic', 'pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['owner', 'pharmacy_outlet'],
    isActive: true,
    metadata: {
      category: 'management',
      priority: 'medium',
      tags: ['users', 'team', 'permissions'],
    },
  },
  {
    key: 'multi_location',
    name: 'Multi-Location Management',
    description: 'Manage multiple pharmacy locations',
    allowedTiers: ['pharmily', 'network', 'enterprise'],
    allowedRoles: ['owner', 'pharmacy_outlet'],
    isActive: true,
    metadata: {
      category: 'management',
      priority: 'medium',
      tags: ['locations', 'multi-site', 'management'],
    },
  },
  {
    key: 'api_access',
    name: 'API Access',
    description: 'Access to REST API for integrations',
    allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['owner', 'pharmacy_outlet'],
    isActive: true,
    metadata: {
      category: 'integration',
      priority: 'low',
      tags: ['api', 'integration', 'development'],
    },
  },
];

async function setupFeatureFlags() {
  try {
    console.log('🚀 Setting up feature flags...');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create or update feature flags
    for (const flagData of FEATURE_FLAGS) {
      try {
        const existingFlag = await FeatureFlag.findOne({ key: flagData.key });

        if (existingFlag) {
          // Update existing flag
          await FeatureFlag.findByIdAndUpdate(existingFlag._id, {
            ...flagData,
            // Don't set updatedBy for system updates
          });
          console.log(`✅ Updated feature flag: ${flagData.key}`);
        } else {
          // Create new flag
          const newFlag = new FeatureFlag({
            ...flagData,
            // Don't set createdBy and updatedBy for system-created flags
          });
          await newFlag.save();
          console.log(`✅ Created feature flag: ${flagData.key}`);
        }
      } catch (error) {
        console.error(`❌ Failed to process feature flag: ${flagData.key}`, error);
      }
    }

    console.log('🎉 Feature flags setup completed!');

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
  setupFeatureFlags();
}

export default setupFeatureFlags;