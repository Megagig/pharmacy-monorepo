#!/usr/bin/env ts-node
/**
 * Restore deleted patients
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Patient from '../models/Patient';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function restoreDeletedPatients() {
    try {
        console.log('🔧 Restoring deleted patients...\n');

        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care-saas');
        console.log('✅ Connected to database\n');

        // Find all deleted patients
        const deletedPatients = await Patient.find({ isDeleted: true });
        console.log(`📊 Found ${deletedPatients.length} deleted patients\n`);

        if (deletedPatients.length === 0) {
            console.log('✅ No deleted patients to restore');
            return;
        }

        // Show sample of deleted patients
        console.log('📋 Sample deleted patients:');
        deletedPatients.slice(0, 5).forEach((patient, index) => {
            console.log(`   ${index + 1}. ${patient.firstName} ${patient.lastName} (${patient.email}) - Workplace: ${patient.workplaceId}`);
        });

        console.log('\n❓ Do you want to restore all deleted patients? (This will set isDeleted to false)');
        console.log('   This action will make all patients visible again in the patients page.');
        
        // For automation, let's restore them
        console.log('\n🔄 Restoring all deleted patients...');

        // Update all deleted patients to set isDeleted to false
        const result = await Patient.updateMany(
            { isDeleted: true },
            { 
                $set: { isDeleted: false },
                $unset: { deletedAt: 1, deletedBy: 1 } // Remove deletion metadata if it exists
            }
        );

        console.log(`✅ Restored ${result.modifiedCount} patients`);

        // Verify the restoration
        const activePatients = await Patient.countDocuments({ isDeleted: { $ne: true } });
        const stillDeleted = await Patient.countDocuments({ isDeleted: true });

        console.log(`\n📊 After restoration:`);
        console.log(`   Active patients: ${activePatients}`);
        console.log(`   Still deleted: ${stillDeleted}`);

        if (activePatients > 0) {
            console.log('\n🎉 Patients have been restored! The patients page should now show data.');
        }

        // Disconnect
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// CLI execution
restoreDeletedPatients();