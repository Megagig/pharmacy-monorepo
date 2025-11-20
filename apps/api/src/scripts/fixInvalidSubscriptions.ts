/**
 * Fix Script: Invalid Subscriptions
 * 
 * This script fixes subscriptions that are missing required fields like tier and priceAtPurchase.
 * 
 * Run with: npx ts-node src/scripts/fixInvalidSubscriptions.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Import models
import { Subscription } from '../models/Subscription';
import SubscriptionPlan from '../models/SubscriptionPlan';

async function fixInvalidSubscriptions() {
  try {
    console.log('🔧 Fixing invalid subscriptions...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmadb';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get all subscriptions
    const subscriptions = await Subscription.find({});
    console.log(`📋 Found ${subscriptions.length} subscriptions\n`);

    let fixed = 0;
    let skipped = 0;

    for (const subscription of subscriptions) {
      const subDoc = subscription.toObject() as any;
      
      // Check if subscription is missing tier or priceAtPurchase
      if (!subscription.tier || !subscription.priceAtPurchase) {
        console.log(`❌ Subscription ${subscription._id} is invalid`);
        console.log(`   Tier: ${subscription.tier || 'MISSING'}`);
        console.log(`   Price: ${subscription.priceAtPurchase || 'MISSING'}`);
        console.log(`   Status: ${subscription.status}`);
        console.log(`   PlanId: ${subscription.planId}`);
        
        // Try to get tier and price from plan
        if (subscription.planId) {
          const plan = await SubscriptionPlan.findById(subscription.planId);
          
          if (plan) {
            console.log(`   Found plan: ${plan.name} (${plan.tier})`);
            
            // Update using updateOne to bypass validation
            const updateData: any = {};
            
            if (!subscription.tier) {
              updateData.tier = plan.tier;
            }
            
            if (!subscription.priceAtPurchase) {
              updateData.priceAtPurchase = plan.priceNGN;
            }
            
            // Also add AI features
            updateData.$addToSet = {
              features: {
                $each: ['ai_diagnostics', 'clinical_decision_support', 'drug_information']
              }
            };
            
            await Subscription.updateOne(
              { _id: subscription._id },
              updateData
            );
            
            console.log(`   ✅ Fixed: tier=${plan.tier}, price=${plan.priceNGN}\n`);
            fixed++;
          } else {
            console.log(`   ⚠️  Plan not found: ${subscription.planId}\n`);
            skipped++;
          }
        } else {
          console.log(`   ⚠️  No planId to get tier/price from\n`);
          skipped++;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 FIX SUMMARY');
    console.log('='.repeat(60));
    console.log(`   Subscriptions fixed: ${fixed}`);
    console.log(`   Subscriptions skipped: ${skipped}`);
    console.log(`   Total subscriptions: ${subscriptions.length}`);
    console.log('='.repeat(60) + '\n');

    // Verify the fix
    console.log('🔍 Verifying fix...\n');
    
    const invalidSubscriptions = await Subscription.countDocuments({
      $or: [
        { tier: { $exists: false } },
        { tier: null },
        { priceAtPurchase: { $exists: false } },
        { priceAtPurchase: null }
      ]
    });
    
    console.log(`   Invalid subscriptions remaining: ${invalidSubscriptions}`);
    
    if (invalidSubscriptions === 0) {
      console.log('   ✅ All subscriptions are now valid!\n');
    } else {
      console.log('   ⚠️  Some subscriptions still invalid\n');
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
fixInvalidSubscriptions();
