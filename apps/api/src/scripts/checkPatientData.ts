#!/usr/bin/env ts-node
/**
 * Check patient data in the database
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Patient from '../models/Patient';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkPatientData() {
    try {
        console.log('🔍 Checking patient data in database...\n');

        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care-saas');
        console.log('✅ Connected to database\n');

        // Count total patients
        const totalPatients = await Patient.countDocuments({});
        console.log(`📊 Total patients in database: ${totalPatients}`);

        // Count active patients (not deleted)
        const activePatients = await Patient.countDocuments({ isDeleted: { $ne: true } });
        console.log(`📊 Active patients (not deleted): ${activePatients}`);

        // Count deleted patients
        const deletedPatients = await Patient.countDocuments({ isDeleted: true });
        console.log(`📊 Deleted patients: ${deletedPatients}`);

        if (totalPatients > 0) {
            console.log('\n📋 Sample patients:');
            const samplePatients = await Patient.find({}).limit(5).select('firstName lastName email workplaceId isDeleted createdAt');
            samplePatients.forEach((patient, index) => {
                console.log(`   ${index + 1}. ${patient.firstName} ${patient.lastName} (${patient.email}) - Workplace: ${patient.workplaceId} - Deleted: ${patient.isDeleted || false}`);
            });

            // Check patients by workplace
            console.log('\n📊 Patients by workplace:');
            const patientsByWorkplace = await Patient.aggregate([
                { $match: { isDeleted: { $ne: true } } },
                { $group: { _id: '$workplaceId', count: { $sum: 1 } } },
                { $sort: { count: -1 } }
            ]);

            patientsByWorkplace.forEach((group) => {
                console.log(`   Workplace ${group._id}: ${group.count} patients`);
            });
        } else {
            console.log('\n❌ No patients found in database!');
            console.log('   This explains why the patients page shows "No patients found"');
            console.log('   You may need to:');
            console.log('   1. Create some test patients');
            console.log('   2. Import patient data');
            console.log('   3. Check if patients were accidentally deleted');
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
checkPatientData();