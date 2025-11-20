/**
 * Migration script to fix isActive field for patient users
 * Sets isActive = true for all patients with status = 'active'
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

import PatientUser from '../src/models/PatientUser';
import logger from '../src/utils/logger';

async function fixPatientIsActive() {
    try {
        // Connect to MongoDB Atlas
        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri) {
            throw new Error('MONGODB_URI environment variable is not set');
        }

        console.log('🔄 Connecting to MongoDB Atlas...');
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB Atlas successfully\n');
        logger.info('Connected to MongoDB');

        // Find all active patients with isActive = false
        const result = await PatientUser.updateMany(
            {
                status: 'active',
                isActive: false,
                isDeleted: false,
            },
            {
                $set: { isActive: true },
            }
        );

        logger.info('Fixed isActive field for patient users', {
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount,
        });

        console.log(`✅ Successfully updated ${result.modifiedCount} patient users`);
        console.log(`   Total matched: ${result.matchedCount}`);

        // Also fix any pending patients that might have isActive = false
        const pendingResult = await PatientUser.updateMany(
            {
                status: 'pending',
                isActive: false,
                isDeleted: false,
            },
            {
                $set: { isActive: true },
            }
        );

        logger.info('Fixed isActive field for pending patient users', {
            matchedCount: pendingResult.matchedCount,
            modifiedCount: pendingResult.modifiedCount,
        });

        console.log(`✅ Also updated ${pendingResult.modifiedCount} pending patient users`);

        // Verify the fix
        const activePatients = await PatientUser.countDocuments({
            status: 'active',
            isActive: true,
            isDeleted: false,
        });

        const suspendedPatients = await PatientUser.countDocuments({
            status: 'suspended',
            isDeleted: false,
        });

        console.log('\n📊 Patient User Status Summary:');
        console.log(`   Active patients (isActive=true): ${activePatients}`);
        console.log(`   Suspended patients: ${suspendedPatients}`);

    } catch (error: any) {
        logger.error('Error fixing patient isActive field', {
            error: error.message,
            stack: error.stack,
        });
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
    }
}

// Run the migration
fixPatientIsActive()
    .then(() => {
        console.log('\n✅ Migration completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    });
