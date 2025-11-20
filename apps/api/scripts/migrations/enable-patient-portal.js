/**
 * Migration Script: Enable Patient Portal for Existing Workspaces
 * 
 * This script adds patient portal settings to existing workspaces
 * Run this after deploying the new Workplace model changes
 * 
 * Usage:
 *   node backend/scripts/migrations/enable-patient-portal.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Workplace } from '../../src/models/Workplace';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacare';

async function runMigration() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log('\n🔄 Starting migration: Enable Patient Portal for Workspaces');

        // Count workspaces that need migration
        const totalWorkspaces = await Workplace.countDocuments({});
        const verifiedWorkspaces = await Workplace.countDocuments({
            verificationStatus: 'verified'
        });

        console.log(`\n📊 Statistics:`);
        console.log(`   Total workspaces: ${totalWorkspaces}`);
        console.log(`   Verified workspaces: ${verifiedWorkspaces}`);

        // Update verified workspaces that don't have patient portal settings
        const result = await Workplace.updateMany(
            {
                verificationStatus: 'verified',
                $or: [
                    { patientPortalEnabled: { $exists: false } },
                    { patientPortalSettings: { $exists: false } }
                ]
            },
            {
                $set: {
                    patientPortalEnabled: true,
                    patientPortalSettings: {
                        allowSelfRegistration: true,
                        requireEmailVerification: true,
                        requireAdminApproval: true,
                        operatingHours: 'Monday-Friday: 8:00 AM - 5:00 PM',
                        services: [
                            'Prescription Management',
                            'Appointment Booking',
                            'Health Records Access',
                            'Medication Reminders',
                            'Lab Results',
                            'Secure Messaging'
                        ]
                    }
                }
            }
        );

        console.log(`\n✅ Migration completed successfully!`);
        console.log(`   Workspaces updated: ${result.modifiedCount}`);
        console.log(`   Workspaces matched: ${result.matchedCount}`);

        // Show sample of updated workspaces
        if (result.modifiedCount > 0) {
            console.log('\n📋 Sample of updated workspaces:');
            const samples = await Workplace.find({
                patientPortalEnabled: true
            })
                .select('name type email patientPortalEnabled patientPortalSettings')
                .limit(5);

            samples.forEach((workspace, index) => {
                console.log(`\n   ${index + 1}. ${workspace.name}`);
                console.log(`      Type: ${workspace.type}`);
                console.log(`      Email: ${workspace.email}`);
                console.log(`      Patient Portal Enabled: ${workspace.patientPortalEnabled}`);
                console.log(`      Services: ${workspace.patientPortalSettings?.services?.slice(0, 3).join(', ')}...`);
            });
        }

        // Create indexes if they don't exist
        console.log('\n🔄 Creating/updating indexes...');
        await Workplace.collection.createIndex({ patientPortalEnabled: 1 });
        await Workplace.collection.createIndex({ state: 1, lga: 1 });
        await Workplace.collection.createIndex({ patientPortalEnabled: 1, verificationStatus: 1 });
        console.log('✅ Indexes created successfully');

        console.log('\n🎉 Migration completed successfully!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
        process.exit(0);
    }
}

// Run migration if called directly
if (require.main === module) {
    runMigration();
}

export default runMigration;
