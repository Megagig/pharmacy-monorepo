#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FeatureFlag } from '../src/models/FeatureFlag';

// Load environment variables
dotenv.config();

async function enhanceFeatureFlagModel() {
  try {
    console.log('🚀 Enhancing FeatureFlag model with advanced functionality...');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get all existing feature flags
    const existingFlags = await FeatureFlag.find({});
    console.log(`📋 Found ${existingFlags.length} existing feature flags to enhance`);

    let enhancedCount = 0;
    let skippedCount = 0;

    for (const flag of existingFlags) {
      try {
        let needsUpdate = false;
        const updates: any = {};

        // 1. Ensure metadata has new fields with defaults
        if (!flag.metadata) {
          updates.metadata = {};
          needsUpdate = true;
        }

        if (flag.metadata?.displayOrder === undefined) {
          updates['metadata.displayOrder'] = 0;
          needsUpdate = true;
        }

        if (flag.metadata?.isMarketingFeature === undefined) {
          // Auto-detect marketing features based on category
          const isMarketing = ['core', 'analytics', 'ai'].includes(flag.metadata?.category || '');
          updates['metadata.isMarketingFeature'] = isMarketing;
          needsUpdate = true;
        }

        // 2. Initialize empty targeting rules if not present
        if (!flag.targetingRules) {
          updates.targetingRules = {
            pharmacies: [],
            userGroups: [],
            percentage: 100, // Default to 100% rollout for existing features
          };
          needsUpdate = true;
        }

        // 3. Initialize usage metrics if not present
        if (!flag.usageMetrics) {
          updates.usageMetrics = {
            totalUsers: 0,
            activeUsers: 0,
            usagePercentage: 0,
            lastUsed: new Date(),
            usageByPlan: [],
            usageByWorkspace: [],
          };
          needsUpdate = true;
        }

        // 4. Set display order based on priority and category
        if (flag.metadata?.displayOrder === 0 || flag.metadata?.displayOrder === undefined) {
          let displayOrder = 100; // Default
          
          // Prioritize by category
          switch (flag.metadata?.category) {
            case 'core':
              displayOrder = 10;
              break;
            case 'ai':
              displayOrder = 20;
              break;
            case 'clinical':
              displayOrder = 30;
              break;
            case 'analytics':
              displayOrder = 40;
              break;
            case 'management':
              displayOrder = 50;
              break;
            case 'integration':
              displayOrder = 60;
              break;
            default:
              displayOrder = 100;
          }

          // Adjust by priority
          switch (flag.metadata?.priority) {
            case 'critical':
              displayOrder -= 5;
              break;
            case 'high':
              displayOrder -= 3;
              break;
            case 'medium':
              displayOrder += 0;
              break;
            case 'low':
              displayOrder += 10;
              break;
          }

          updates['metadata.displayOrder'] = displayOrder;
          needsUpdate = true;
        }

        // 5. Add marketing descriptions for key features
        if (!flag.metadata?.marketingDescription && flag.metadata?.isMarketingFeature) {
          const marketingDescriptions: Record<string, string> = {
            'patient_management': 'Comprehensive patient record management with advanced search and filtering',
            'ai_diagnostics': 'AI-powered diagnostic analysis and clinical decision support',
            'clinical_decision_support': 'Evidence-based clinical recommendations and drug interaction alerts',
            'drug_information': 'Complete drug database with interaction checking and contraindications',
            'advanced_analytics': 'Detailed business intelligence dashboards and custom reports',
            'user_management': 'Team collaboration tools with role-based access control',
            'multi_location': 'Multi-site pharmacy management with centralized oversight',
            'api_access': 'REST API access for custom integrations and third-party connections',
          };

          if (marketingDescriptions[flag.key]) {
            updates['metadata.marketingDescription'] = marketingDescriptions[flag.key];
            needsUpdate = true;
          }
        }

        // Apply updates if needed
        if (needsUpdate) {
          await FeatureFlag.findByIdAndUpdate(flag._id, { $set: updates });
          console.log(`  ✅ Enhanced feature flag: ${flag.key}`);
          enhancedCount++;
        } else {
          console.log(`  ⏭️  Skipped feature flag: ${flag.key} (already enhanced)`);
          skippedCount++;
        }

      } catch (error) {
        console.error(`  ❌ Failed to enhance feature flag: ${flag.key}`, error);
      }
    }

    console.log('\n🎉 FeatureFlag model enhancement completed!');
    console.log(`   Enhanced: ${enhancedCount} feature flags`);
    console.log(`   Skipped: ${skippedCount} feature flags`);
    console.log(`   Total: ${existingFlags.length} feature flags processed`);

    // Verify the enhancements
    console.log('\n🔍 Verifying enhancements...');
    const enhancedFlags = await FeatureFlag.find({}).sort({ 'metadata.displayOrder': 1 });
    
    console.log('\n📊 Enhanced Feature Flags Summary:');
    enhancedFlags.forEach((flag, index) => {
      console.log(`${index + 1}. ${flag.name} (${flag.key})`);
      console.log(`   Category: ${flag.metadata?.category || 'N/A'}`);
      console.log(`   Display Order: ${flag.metadata?.displayOrder || 0}`);
      console.log(`   Marketing Feature: ${flag.metadata?.isMarketingFeature ? 'Yes' : 'No'}`);
      console.log(`   Targeting Percentage: ${flag.targetingRules?.percentage || 100}%`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Enhancement failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run enhancement if this script is executed directly
if (require.main === module) {
  enhanceFeatureFlagModel();
}

export default enhanceFeatureFlagModel;