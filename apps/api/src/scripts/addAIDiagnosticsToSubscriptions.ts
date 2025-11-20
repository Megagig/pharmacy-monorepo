/**
 * Fix Script: Add AI Diagnostics to Subscription Features
 * 
 * This script adds 'ai_diagnostics' and 'clinical_decision_support' 
 * to the features array of all active subscriptions.
 * 
 * Run with: npx ts-node src/scripts/addAIDiagnosticsToSubscriptions.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import models
import { Subscription } from '../models/Subscription';

async function addAIDiagnosticsToSubscriptions() {
  try {
    console.log('🔧 Adding AI Diagnostics features to subscriptions...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmadb';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get all active subscriptions
    const subscriptions = await Subscription.find({
      status: { $in: ['active', 'trial', 'past_due'] }
    });

    console.log(`📋 Found ${subscriptions.length} active subscriptions\n`);

    const featuresToAdd = ['ai_diagnostics', 'clinical_decision_support', 'drug_information'];
    let updated = 0;
    let skipped = 0;

    for (const subscription of subscriptions) {
      // Skip subscriptions with missing required fields
      if (!subscription.tier || !subscription.priceAtPurchase) {
        console.log(`⏭️  Skipping invalid subscription ${subscription._id} (missing tier or price)\n`);
        skipped++;
        continue;
      }
      
      let needsUpdate = false;
      const currentFeatures = subscription.features || [];
      
      console.log(`🔍 Checking subscription ${subscription._id}`);
      console.log(`   Tier: ${subscription.tier}`);
      console.log(`   Status: ${subscription.status}`);
      console.log(`   Current features: ${currentFeatures.length > 0 ? currentFeatures.join(', ') : 'NONE'}`);
      
      // Check which features are missing
      const missingFeatures: string[] = [];
      for (const feature of featuresToAdd) {
        if (!currentFeatures.includes(feature)) {
          missingFeatures.push(feature);
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        // Add missing features using updateOne to bypass validation
        await Subscription.updateOne(
          { _id: subscription._id },
          { $addToSet: { features: { $each: missingFeatures } } }
        );
        console.log(`   ✅ Added features: ${missingFeatures.join(', ')}\n`);
        updated++;
      } else {
        console.log(`   ⏭️  Already has all AI features\n`);
        skipped++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 FIX SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Subscriptions updated: ${updated}`);
    console.log(`   Subscriptions skipped: ${skipped}`);
    console.log(`   Total subscriptions: ${subscriptions.length}`);
    console.log('='.repeat(60) + '\n');

    // Verify the fix
    console.log('🔍 Verifying fix...\n');
    
    const subscriptionsWithAI = await Subscription.countDocuments({
      status: { $in: ['active', 'trial', 'past_due'] },
      features: 'ai_diagnostics'
    });
    
    const totalActive = await Subscription.countDocuments({
      status: { $in: ['active', 'trial', 'past_due'] }
    });
    
    console.log(`   Active subscriptions with AI diagnostics: ${subscriptionsWithAI}/${totalActive}`);
    
    if (subscriptionsWithAI === totalActive) {
      console.log('   ✅ All active subscriptions have AI diagnostics!\n');
    } else {
      console.log('   ⚠️  Some subscriptions still missing AI diagnostics\n');
    }

    console.log('✅ Fix completed! Please restart your backend server.\n');

    // Close connection
    await mongoose.connection.close();

  } catch (error) {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

// Run the fix
addAIDiagnosticsToSubscriptions();
