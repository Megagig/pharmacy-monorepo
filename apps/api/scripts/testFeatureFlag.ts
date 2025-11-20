#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { FeatureFlag } from '../src/models/FeatureFlag';

// Load environment variables
dotenv.config();

async function testFeatureFlag() {
  try {
    console.log('🔍 Testing AI Diagnostics feature flag...');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check the ai_diagnostics feature flag
    const aiDiagnosticFeature = await FeatureFlag.findOne({
      key: 'ai_diagnostics',
    });

    console.log('🚩 AI Diagnostics Feature Flag from Database:', {
      found: !!aiDiagnosticFeature,
      key: aiDiagnosticFeature?.key,
      name: aiDiagnosticFeature?.name,
      allowedTiers: aiDiagnosticFeature?.allowedTiers,
      allowedRoles: aiDiagnosticFeature?.allowedRoles,
      isActive: aiDiagnosticFeature?.isActive,
      updatedAt: aiDiagnosticFeature?.updatedAt,
    });

    // Test if 'basic' tier is included
    if (aiDiagnosticFeature) {
      const hasBasicAccess = aiDiagnosticFeature.allowedTiers.includes('basic');
      console.log('🔐 Basic tier access check:', {
        hasBasicAccess: hasBasicAccess,
        allowedTiers: aiDiagnosticFeature.allowedTiers,
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  testFeatureFlag();
}

export default testFeatureFlag;