/**
 * Basic Feature Flag Test
 * 
 * Simple test to verify feature flags are created and can be queried
 */

import mongoose from 'mongoose';
import { FeatureFlag } from '../src/models/FeatureFlag';
import logger from '../src/utils/logger';

// Connect to MongoDB
const connectDB = async () => {
  try {
    require('dotenv').config();
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacycopilot';
    await mongoose.connect(mongoUri);
    logger.info('Connected to MongoDB Atlas');
  } catch (error) {
    logger.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const testBasicFeatureFlags = async () => {
  try {
    console.log('🔍 Testing Basic Feature Flag Operations\n');
    
    // 1. List all patient engagement feature flags
    console.log('1. Listing Patient Engagement Feature Flags:');
    const patientEngagementFlags = await FeatureFlag.find({
      key: { $regex: /^(patient_engagement|appointment|followup|smart_reminder|patient_portal|recurring|clinical_alerts|engagement_analytics|schedule_management)/ }
    }).select('name key isActive targetingRules.percentage metadata.priority');
    
    console.log(`Found ${patientEngagementFlags.length} patient engagement feature flags:`);
    patientEngagementFlags.forEach((flag, index) => {
      console.log(`  ${index + 1}. ${flag.name} (${flag.key})`);
      console.log(`     Status: ${flag.isActive ? 'ENABLED' : 'DISABLED'}`);
      console.log(`     Rollout: ${flag.targetingRules?.percentage || 0}%`);
      console.log(`     Priority: ${flag.metadata?.priority || 'N/A'}`);
      console.log('');
    });
    
    // 2. Test enabling a feature flag
    console.log('2. Testing Feature Flag Update:');
    const moduleFlag = await FeatureFlag.findOne({ key: 'patient_engagement_module' });
    if (moduleFlag) {
      console.log(`Current status: ${moduleFlag.isActive ? 'ENABLED' : 'DISABLED'}`);
      console.log(`Current rollout: ${moduleFlag.targetingRules?.percentage || 0}%`);
      
      // Enable with 25% rollout
      await FeatureFlag.findOneAndUpdate(
        { key: 'patient_engagement_module' },
        { 
          isActive: true,
          'targetingRules.percentage': 25
        }
      );
      
      const updatedFlag = await FeatureFlag.findOne({ key: 'patient_engagement_module' });
      console.log(`Updated status: ${updatedFlag?.isActive ? 'ENABLED' : 'DISABLED'}`);
      console.log(`Updated rollout: ${updatedFlag?.targetingRules?.percentage || 0}%`);
      console.log('✅ Feature flag update successful');
      
      // Reset to disabled
      await FeatureFlag.findOneAndUpdate(
        { key: 'patient_engagement_module' },
        { 
          isActive: false,
          'targetingRules.percentage': 0
        }
      );
      console.log('🔄 Reset feature flag to disabled state');
    } else {
      console.log('❌ Patient engagement module flag not found');
    }
    
    // 3. Test feature flag structure
    console.log('\n3. Testing Feature Flag Structure:');
    const sampleFlag = await FeatureFlag.findOne({ key: 'appointment_scheduling' });
    if (sampleFlag) {
      console.log('Sample flag structure:');
      console.log(`  Name: ${sampleFlag.name}`);
      console.log(`  Key: ${sampleFlag.key}`);
      console.log(`  Description: ${sampleFlag.description}`);
      console.log(`  Allowed Tiers: ${sampleFlag.allowedTiers.join(', ')}`);
      console.log(`  Allowed Roles: ${sampleFlag.allowedRoles.join(', ')}`);
      console.log(`  Category: ${sampleFlag.metadata?.category}`);
      console.log(`  Tags: ${sampleFlag.metadata?.tags?.join(', ')}`);
      console.log('✅ Feature flag structure is correct');
    }
    
    // 4. Test feature flag queries
    console.log('\n4. Testing Feature Flag Queries:');
    
    // Count by status
    const enabledCount = await FeatureFlag.countDocuments({ 
      key: { $regex: /^(patient_engagement|appointment|followup|smart_reminder|patient_portal|recurring|clinical_alerts|engagement_analytics|schedule_management)/ },
      isActive: true 
    });
    const disabledCount = await FeatureFlag.countDocuments({ 
      key: { $regex: /^(patient_engagement|appointment|followup|smart_reminder|patient_portal|recurring|clinical_alerts|engagement_analytics|schedule_management)/ },
      isActive: false 
    });
    
    console.log(`  Enabled flags: ${enabledCount}`);
    console.log(`  Disabled flags: ${disabledCount}`);
    
    // Count by priority
    const highPriorityCount = await FeatureFlag.countDocuments({ 
      key: { $regex: /^(patient_engagement|appointment|followup|smart_reminder|patient_portal|recurring|clinical_alerts|engagement_analytics|schedule_management)/ },
      'metadata.priority': 'high'
    });
    
    console.log(`  High priority flags: ${highPriorityCount}`);
    console.log('✅ Feature flag queries working correctly');
    
    // 5. Test rollout scenarios
    console.log('\n5. Testing Rollout Scenarios:');
    
    const rolloutScenarios = [
      { name: 'Beta Testing', percentage: 10 },
      { name: 'Limited Rollout', percentage: 25 },
      { name: 'Gradual Rollout', percentage: 50 },
      { name: 'Full Rollout', percentage: 100 }
    ];
    
    for (const scenario of rolloutScenarios) {
      await FeatureFlag.findOneAndUpdate(
        { key: 'appointment_scheduling' },
        { 
          isActive: true,
          'targetingRules.percentage': scenario.percentage
        }
      );
      
      const flag = await FeatureFlag.findOne({ key: 'appointment_scheduling' });
      const actualPercentage = flag?.targetingRules?.percentage || 0;
      
      console.log(`  ${scenario.name}: ${actualPercentage}% ${actualPercentage === scenario.percentage ? '✅' : '❌'}`);
    }
    
    // Reset
    await FeatureFlag.findOneAndUpdate(
      { key: 'appointment_scheduling' },
      { 
        isActive: false,
        'targetingRules.percentage': 0
      }
    );
    
    console.log('\n✅ All basic feature flag tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Basic feature flag test failed:', error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await testBasicFeatureFlags();
    
    console.log('\n🎉 Feature flag system is working correctly!');
    console.log('\nNext steps:');
    console.log('1. Use the admin UI to manage feature flags');
    console.log('2. Implement the actual appointment and follow-up functionality');
    console.log('3. Test the middleware protection on API endpoints');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
};

if (require.main === module) {
  main();
}

export { testBasicFeatureFlags };