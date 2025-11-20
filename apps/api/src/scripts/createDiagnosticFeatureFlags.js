/**
 * Script to create missing diagnostic feature flags
 * Run this to fix the diagnostic analytics access issue
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Define FeatureFlag schema directly since we can't import TypeScript modules
const FeatureFlagSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  description: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  allowedTiers: [{
    type: String,
    required: true,
  }],
  allowedRoles: [{
    type: String,
    required: true,
  }],
  customRules: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  targetingRules: {
    type: mongoose.Schema.Types.Mixed,
  },
  usageMetrics: {
    type: mongoose.Schema.Types.Mixed,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound indexes for efficient queries
FeatureFlagSchema.index({ key: 1, isActive: 1 });
FeatureFlagSchema.index({ 'metadata.category': 1, isActive: 1 });
FeatureFlagSchema.index({ allowedTiers: 1, isActive: 1 });

// Update the updatedAt field on save
FeatureFlagSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const FeatureFlag = mongoose.model('FeatureFlag', FeatureFlagSchema);

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care';
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    process.exit(1);
  }
};

// Feature flags to create
const featureFlags = [
  {
    name: 'Diagnostic Analytics',
    key: 'diagnostic_analytics',
    description: 'Access to diagnostic analytics and reporting features',
    isActive: true,
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: ['pharmacist', 'senior_pharmacist', 'pharmacy_manager', 'owner', 'pharmacy_outlet'],
    metadata: {
      category: 'diagnostics',
      priority: 'high',
      tags: ['analytics', 'reporting', 'diagnostics']
    }
  },
  {
    name: 'AI Diagnostics',
    key: 'ai_diagnostics',
    description: 'AI-powered diagnostic analysis and recommendations',
    isActive: true,
    allowedTiers: ['pro', 'enterprise'],
    allowedRoles: ['pharmacist', 'senior_pharmacist', 'pharmacy_manager', 'owner', 'pharmacy_outlet'],
    metadata: {
      category: 'diagnostics',
      priority: 'high',
      tags: ['ai', 'diagnostics', 'analysis']
    }
  },
  {
    name: 'Lab Integration',
    key: 'lab_integration',
    description: 'AI-powered lab result interpretation with therapy recommendations and medication management',
    isActive: true,
    allowedTiers: ['pro', 'pharmily', 'network', 'enterprise'],
    allowedRoles: ['pharmacist', 'pharmacy_team', 'pharmacy_outlet', 'intern_pharmacist', 'owner'],
    metadata: {
      category: 'diagnostics',
      priority: 'high',
      tags: ['lab', 'ai', 'therapy', 'medication-management', 'clinical-decision-support']
    }
  },
  {
    name: 'Drug Interactions',
    key: 'drug_interactions',
    description: 'Drug interaction checking and alerts',
    isActive: true,
    allowedTiers: ['basic', 'pro', 'enterprise'],
    allowedRoles: ['pharmacist', 'senior_pharmacist', 'pharmacy_manager', 'owner', 'pharmacy_outlet'],
    metadata: {
      category: 'safety',
      priority: 'critical',
      tags: ['drug-interactions', 'safety', 'alerts']
    }
  }
];

// Create feature flags
const createFeatureFlags = async () => {
  try {
    console.log('🚀 Creating diagnostic feature flags...');

    for (const flagData of featureFlags) {
      // Check if flag already exists
      const existingFlag = await FeatureFlag.findOne({ key: flagData.key });

      if (existingFlag) {
        console.log(`⚠️  Feature flag '${flagData.key}' already exists, updating...`);

        // Update existing flag to ensure it has correct configuration
        await FeatureFlag.findOneAndUpdate(
          { key: flagData.key },
          {
            ...flagData,
            updatedAt: new Date()
          },
          { new: true }
        );

        console.log(`✅ Updated feature flag: ${flagData.name}`);
      } else {
        // Create new flag
        const newFlag = new FeatureFlag({
          ...flagData,
          createdAt: new Date(),
          updatedAt: new Date()
        });

        await newFlag.save();
        console.log(`✅ Created feature flag: ${flagData.name}`);
      }
    }

    console.log('🎉 All diagnostic feature flags created/updated successfully!');

    // Verify the flags were created
    console.log('\n📋 Verifying created feature flags:');
    const createdFlags = await FeatureFlag.find({
      key: { $in: featureFlags.map(f => f.key) }
    }).select('name key isActive allowedTiers allowedRoles');

    createdFlags.forEach(flag => {
      console.log(`  ✓ ${flag.name} (${flag.key})`);
      console.log(`    - Active: ${flag.isActive}`);
      console.log(`    - Tiers: ${flag.allowedTiers.join(', ')}`);
      console.log(`    - Roles: ${flag.allowedRoles.join(', ')}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error creating feature flags:', error);
    throw error;
  }
};

// Main execution
const main = async () => {
  try {
    await connectDB();
    await createFeatureFlags();

    console.log('✅ Script completed successfully!');
    console.log('🔄 Please restart your backend server to apply changes.');

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📝 Database connection closed');
  }
};

// Run the script
if (require.main === module) {
  main();
}

module.exports = { createFeatureFlags };