#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../src/models/User';
import Workplace from '../src/models/Workplace';
import Subscription from '../src/models/Subscription';
import { FeatureFlag } from '../src/models/FeatureFlag';

// Load environment variables
dotenv.config();

async function debugUser() {
  try {
    console.log('🔍 Debugging user: lovitax768@nrlord.com');

    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email: 'lovitax768@nrlord.com' });
    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log('👤 User found:', {
      id: user._id,
      email: user.email,
      role: user.role,
      workplaceId: user.workplaceId,
      status: user.status,
    });

    // Check if user has workspace
    if (user.workplaceId) {
      const workplace = await Workplace.findById(user.workplaceId);
      console.log('🏢 Workplace:', {
        id: workplace?._id,
        name: workplace?.name,
        ownerId: workplace?.ownerId,
        subscriptionStatus: workplace?.subscriptionStatus,
        trialEndDate: workplace?.trialEndDate,
      });

      // Check workspace subscription (without populate to avoid PricingPlan issue)
      const subscription = await Subscription.findOne({
        workspaceId: user.workplaceId,
        status: { $in: ['active', 'trial', 'past_due'] },
      });

      console.log('💳 Subscription:', {
        found: !!subscription,
        id: subscription?._id,
        status: subscription?.status,
        tier: subscription?.tier,
        trialEndDate: subscription?.trialEndDate,
        features: subscription?.features,
      });

      // Check feature flags
      const clinicalFeature = await FeatureFlag.findOne({
        key: 'clinical_decision_support',
        isActive: true,
      });

      const aiDiagnosticFeature = await FeatureFlag.findOne({
        key: 'ai_diagnostics',
        isActive: true,
      });

      console.log('🚩 Clinical Decision Support Feature Flag:', {
        found: !!clinicalFeature,
        allowedTiers: clinicalFeature?.allowedTiers,
        allowedRoles: clinicalFeature?.allowedRoles,
        isActive: clinicalFeature?.isActive,
      });

      console.log('🚩 AI Diagnostics Feature Flag:', {
        found: !!aiDiagnosticFeature,
        allowedTiers: aiDiagnosticFeature?.allowedTiers,
        allowedRoles: aiDiagnosticFeature?.allowedRoles,
        isActive: aiDiagnosticFeature?.isActive,
      });

      // Check if user should have access
      if (subscription && aiDiagnosticFeature) {
        const hasAccess = aiDiagnosticFeature.allowedTiers.includes(subscription.tier);
        console.log('🔐 AI Diagnostics Access Check:', {
          userTier: subscription.tier,
          featureAllowedTiers: aiDiagnosticFeature.allowedTiers,
          hasAccess: hasAccess,
        });
      }
    } else {
      console.log('❌ User has no workplace');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📡 Disconnected from MongoDB');
  }
}

// Run debug if this script is executed directly
if (require.main === module) {
  debugUser();
}

export default debugUser;