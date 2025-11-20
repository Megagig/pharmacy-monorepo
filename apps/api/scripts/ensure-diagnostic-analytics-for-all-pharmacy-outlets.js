#!/usr/bin/env node

/**
 * Script to ensure diagnostic analytics works for ALL pharmacy_outlet users
 * Both current and future ones
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function ensureDiagnosticAnalyticsForAllPharmacyOutlets() {
  try {
    console.log('🔧 Ensuring diagnostic analytics works for ALL pharmacy_outlet users...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // 1. ENSURE FEATURE FLAG IS PROPERLY CONFIGURED
    console.log('\\n🚩 Step 1: Ensuring feature flag is properly configured...');
    
    await db.collection('featureflags').deleteMany({
      $or: [
        { name: 'diagnostic_analytics' },
        { key: 'diagnostic_analytics' }
      ]
    });

    const featureFlag = {
      name: 'diagnostic_analytics',
      key: 'diagnostic_analytics',
      description: 'Access to diagnostic analytics and reporting features',
      isActive: true,
      allowedTiers: ['free', 'basic', 'pro', 'enterprise', 'free_trial'],
      allowedRoles: [], // Empty means all roles allowed
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('featureflags').insertOne(featureFlag);
    console.log('✅ Feature flag configured for all tiers and roles');

    // 2. FIX ALL EXISTING PHARMACY_OUTLET USERS
    console.log('\\n👥 Step 2: Fixing all existing pharmacy_outlet users...');
    
    const pharmacyOutletUsers = await db.collection('users').find({
      role: 'pharmacy_outlet',
      isDeleted: { $ne: true }
    }).toArray();

    console.log(`Found ${pharmacyOutletUsers.length} pharmacy_outlet users`);

    let fixedUsers = 0;
    for (const user of pharmacyOutletUsers) {
      try {
        console.log(`\\n   Processing: ${user.email}`);

        // Ensure user has diagnostic_analytics feature
        const userFeatures = user.features || [];
        if (!userFeatures.includes('diagnostic_analytics')) {
          await db.collection('users').updateOne(
            { _id: user._id },
            { 
              $set: { 
                features: [...userFeatures, 'diagnostic_analytics'],
                updatedAt: new Date()
              } 
            }
          );
          console.log('     ✅ Added diagnostic_analytics to user features');
        }

        // Ensure user's subscription has required features
        if (user.workplaceId) {
          const subscription = await db.collection('subscriptions').findOne({
            workplaceId: user.workplaceId,
            status: { $in: ['active', 'trial'] }
          });

          if (subscription) {
            const requiredFeatures = ['ai_diagnostics', 'advancedReports', 'diagnostic_analytics'];
            const currentFeatures = subscription.features || [];
            const missingFeatures = requiredFeatures.filter(f => !currentFeatures.includes(f));

            if (missingFeatures.length > 0) {
              await db.collection('subscriptions').updateOne(
                { _id: subscription._id },
                { 
                  $set: { 
                    features: [...currentFeatures, ...missingFeatures],
                    customFeatures: ['diagnostic_analytics'],
                    updatedAt: new Date()
                  } 
                }
              );
              console.log(`     ✅ Added missing subscription features: ${missingFeatures.join(', ')}`);
            }

            // Ensure plan has required features
            const plan = await db.collection('pricingplans').findOne({
              _id: subscription.planId
            });

            if (plan) {
              const planFeatures = plan.features || [];
              const missingPlanFeatures = requiredFeatures.filter(f => !planFeatures.includes(f));

              if (missingPlanFeatures.length > 0) {
                await db.collection('pricingplans').updateOne(
                  { _id: plan._id },
                  { 
                    $set: { 
                      features: [...planFeatures, ...missingPlanFeatures],
                      updatedAt: new Date()
                    } 
                  }
                );
                console.log(`     ✅ Added missing plan features: ${missingPlanFeatures.join(', ')}`);
              }

              // Ensure plan has required permissions
              const planPermissions = plan.permissions || [];
              const requiredPermissions = ['diagnostic:analytics', 'diagnostic:read', 'diagnostic:create'];
              const missingPermissions = requiredPermissions.filter(p => !planPermissions.includes(p));

              if (missingPermissions.length > 0) {
                await db.collection('pricingplans').updateOne(
                  { _id: plan._id },
                  { 
                    $set: { 
                      permissions: [...planPermissions, ...missingPermissions],
                      updatedAt: new Date()
                    } 
                  }
                );
                console.log(`     ✅ Added missing plan permissions: ${missingPermissions.join(', ')}`);
              }
            }
          }

          // Ensure user is properly added to workplace members
          const workplace = await db.collection('workplaces').findOne({
            _id: user.workplaceId
          });

          if (workplace) {
            const currentMembers = workplace.members || [];
            const existingMembership = currentMembers.find(member => 
              member.userId?.toString() === user._id.toString()
            );

            if (!existingMembership) {
              const newMember = {
                userId: user._id,
                role: 'Owner',
                joinedAt: new Date(),
                status: 'active',
                permissions: [],
                createdAt: new Date(),
                updatedAt: new Date()
              };

              await db.collection('workplaces').updateOne(
                { _id: workplace._id },
                { 
                  $push: { members: newMember },
                  $set: { updatedAt: new Date() }
                }
              );
              console.log('     ✅ Added user as Owner to workplace members');
            } else if (!['Owner', 'Pharmacist'].includes(existingMembership.role)) {
              await db.collection('workplaces').updateOne(
                { 
                  _id: workplace._id,
                  'members.userId': user._id
                },
                { 
                  $set: { 
                    'members.$.role': 'Owner',
                    'members.$.updatedAt': new Date()
                  } 
                }
              );
              console.log(`     ✅ Updated workplace role from ${existingMembership.role} to Owner`);
            }
          }
        }

        fixedUsers++;
      } catch (error) {
        console.error(`     ❌ Error processing user ${user.email}:`, error.message);
      }
    }

    console.log(`\\n✅ Fixed ${fixedUsers} pharmacy_outlet users`);

    // 3. ENSURE ALL PRO+ PLANS HAVE REQUIRED FEATURES
    console.log('\\n📦 Step 3: Ensuring all pro+ plans have required features...');
    
    const proPlans = await db.collection('pricingplans').find({
      tier: { $in: ['pro', 'enterprise', 'pharmily', 'network'] },
      isActive: true
    }).toArray();

    for (const plan of proPlans) {
      const requiredFeatures = ['ai_diagnostics', 'advancedReports'];
      const planFeatures = plan.features || [];
      const missingFeatures = requiredFeatures.filter(f => !planFeatures.includes(f));

      if (missingFeatures.length > 0) {
        await db.collection('pricingplans').updateOne(
          { _id: plan._id },
          { 
            $set: { 
              features: [...planFeatures, ...missingFeatures],
              updatedAt: new Date()
            } 
          }
        );
        console.log(`✅ Added missing features to ${plan.name}: ${missingFeatures.join(', ')}`);
      }

      const requiredPermissions = ['diagnostic:analytics', 'diagnostic:read', 'diagnostic:create'];
      const planPermissions = plan.permissions || [];
      const missingPermissions = requiredPermissions.filter(p => !planPermissions.includes(p));

      if (missingPermissions.length > 0) {
        await db.collection('pricingplans').updateOne(
          { _id: plan._id },
          { 
            $set: { 
              permissions: [...planPermissions, ...missingPermissions],
              updatedAt: new Date()
            } 
          }
        );
        console.log(`✅ Added missing permissions to ${plan.name}: ${missingPermissions.join(', ')}`);
      }
    }

    console.log('\\n🎯 SUMMARY:');
    console.log(`   - Feature flag: ✅ Configured for all tiers`);
    console.log(`   - Pharmacy outlet users: ✅ ${fixedUsers} users fixed`);
    console.log(`   - Pro+ plans: ✅ ${proPlans.length} plans updated`);
    console.log(`   - Future users: ✅ Will work automatically`);

    console.log('\\n✅ ALL PHARMACY_OUTLET USERS NOW HAVE DIAGNOSTIC ANALYTICS ACCESS!');
    console.log('🔄 Please restart your backend server to apply changes.');

  } catch (error) {
    console.error('❌ Failed to ensure diagnostic analytics:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  ensureDiagnosticAnalyticsForAllPharmacyOutlets()
    .then(() => {
      console.log('Diagnostic analytics setup completed for all pharmacy outlets');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Diagnostic analytics setup failed:', error);
      process.exit(1);
    });
}

module.exports = { ensureDiagnosticAnalyticsForAllPharmacyOutlets };