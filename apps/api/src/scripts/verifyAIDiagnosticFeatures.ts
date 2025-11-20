/**
 * Script: Verify AI Diagnostic Feature Flags
 * 
 * This script checks and updates AI diagnostic feature flags to ensure they're
 * properly configured with the correct tiers.
 * 
 * Run with: npx ts-node src/scripts/verifyAIDiagnosticFeatures.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import models
import FeatureFlag from '../models/FeatureFlag';

const AI_DIAGNOSTIC_FEATURES = [
  {
    key: 'ai_diagnostics',
    name: 'AI Diagnostics',
    description: 'AI-powered diagnostic analysis and clinical decision support',
    allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'super_admin', 'owner'],
    customRules: {
      requiredLicense: true
    },
    metadata: {
      category: 'advanced',
      priority: 'high',
      tags: ['ai', 'diagnostics', 'clinical'],
    }
  },
  {
    key: 'clinical_decision_support',
    name: 'Clinical Decision Support',
    description: 'Clinical decision support system and diagnostic workflows',
    allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'super_admin', 'owner'],
    customRules: {
      requiredLicense: true
    },
    metadata: {
      category: 'advanced',
      priority: 'high',
      tags: ['clinical', 'decision-support', 'diagnostics'],
    }
  },
  {
    key: 'drug_information',
    name: 'Drug Information',
    description: 'Drug interaction checking, contraindications, and drug information lookup',
    allowedTiers: ['free_trial', 'basic', 'pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'intern_pharmacist', 'super_admin', 'owner'],
    customRules: {},
    metadata: {
      category: 'clinical',
      priority: 'high',
      tags: ['drug-information', 'interactions', 'clinical'],
    }
  }
];

async function verifyAIDiagnosticFeatures() {
  try {
    console.log('🔧 Starting AI Diagnostic Feature Flags verification...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmadb';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    for (const featureConfig of AI_DIAGNOSTIC_FEATURES) {
      console.log(`\n📋 Checking feature: ${featureConfig.name} (${featureConfig.key})`);

      // Find existing feature flag
      let featureFlag = await FeatureFlag.findOne({ key: featureConfig.key });

      if (featureFlag) {
        // Update existing feature flag
        console.log(`   ℹ️  Feature exists, updating...`);
        
        featureFlag.name = featureConfig.name;
        featureFlag.description = featureConfig.description;
        featureFlag.allowedTiers = featureConfig.allowedTiers;
        featureFlag.allowedRoles = featureConfig.allowedRoles;
        featureFlag.customRules = featureConfig.customRules;
        featureFlag.metadata = {
          ...featureFlag.metadata,
          ...featureConfig.metadata
        };
        featureFlag.isActive = true;

        await featureFlag.save();
        console.log(`   ✅ Updated feature flag`);
      } else {
        // Create new feature flag
        console.log(`   ℹ️  Feature doesn't exist, creating...`);
        
        featureFlag = new FeatureFlag({
          ...featureConfig,
          isActive: true
        });

        await featureFlag.save();
        console.log(`   ✅ Created feature flag`);
      }

      console.log(`   📊 Configuration:`);
      console.log(`      - Allowed Tiers: ${featureFlag.allowedTiers.join(', ')}`);
      console.log(`      - Allowed Roles: ${featureFlag.allowedRoles.join(', ')}`);
      console.log(`      - Active: ${featureFlag.isActive}`);
      console.log(`      - License Required: ${featureFlag.customRules?.requiredLicense || false}`);
    }

    console.log('\n\n✅ All AI Diagnostic features verified successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Total features checked: ${AI_DIAGNOSTIC_FEATURES.length}`);
    console.log(`   - All features are now active and properly configured\n`);

    // Close connection
    await mongoose.connection.close();
    console.log('✅ Verification completed!');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  }
}

// Run the verification
verifyAIDiagnosticFeatures();
