import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Role from '../models/Role';

// Load environment variables from the correct path
const envPath = path.resolve(__dirname, '../../.env');
console.log('Loading .env from:', envPath);
dotenv.config({ path: envPath });

async function addAnalyticsPermissions() {
  try {
    console.log('🔐 Adding analytics permissions to roles...\n');

    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    
    if (!mongoUri) {
      console.error('❌ MONGO_URI not found in .env file!');
      console.error('   Please check that your .env file exists and contains MONGO_URI');
      process.exit(1);
    }
    
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Define the analytics permissions to add
    const analyticsPermissions = [
      'view_analytics',
      'view_appointment_analytics',
      'view_capacity_analytics',
      'view_reminder_analytics',
      'view_followup_analytics'
    ];

    // Roles that should have analytics permissions
    const rolesToUpdate = ['owner', 'pharmacist', 'pharmacy_outlet'];

    for (const roleName of rolesToUpdate) {
      const role = await Role.findOne({ name: roleName });

      if (!role) {
        console.log(`⚠️  Role "${roleName}" not found, skipping...`);
        continue;
      }

      // Get current permissions
      const currentPermissions = role.permissions || [];
      
      // Add new permissions that don't already exist
      const permissionsToAdd = analyticsPermissions.filter(
        perm => !currentPermissions.includes(perm)
      );

      if (permissionsToAdd.length > 0) {
        role.permissions = [...currentPermissions, ...permissionsToAdd];
        await role.save();
        console.log(`✅ Updated "${roleName}" role:`);
        console.log(`   Added permissions:`, permissionsToAdd);
      } else {
        console.log(`✓ "${roleName}" role already has all analytics permissions`);
      }
    }

    console.log('\n✅ Analytics permissions migration completed!\n');

    // Verify the changes
    console.log('📋 Verification:');
    for (const roleName of rolesToUpdate) {
      const role = await Role.findOne({ name: roleName });
      if (role) {
        const analyticsPerms = role.permissions.filter(p => 
          p.includes('analytics') || p === 'view_analytics'
        );
        console.log(`   ${roleName}:`, analyticsPerms);
      }
    }

  } catch (error) {
    console.error('❌ Error adding analytics permissions:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run migration
addAnalyticsPermissions().then(() => process.exit(0));
