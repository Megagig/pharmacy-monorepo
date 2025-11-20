import mongoose from 'mongoose';
import { config } from 'dotenv';

import path from 'path';

// Load environment variables
config({ path: path.resolve(__dirname, '../.env') });

const dropOldIndexes = async (): Promise<void> => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI!);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');
        const patientsCollection = db.collection('patients');

        // --- Users Collection Index Cleanup ---
        console.log('\n--- Cleaning up indexes for "users" collection ---');
        const userIndexes = await usersCollection.indexes();
        console.log('Current "users" indexes:', userIndexes.map(idx => idx.name));

        const userIndexesToDrop = [
            'licenseNumber_1',
            'pharmacyName_1',
            'phoneNumber_1'
        ];

        for (const indexName of userIndexesToDrop) {
            try {
                await usersCollection.dropIndex(indexName);
                console.log(`✅ Dropped ${indexName} index from "users"`);
            } catch (error: any) {
                if (error.codeName === 'IndexNotFound' || error.code === 27) {
                    console.log(`ℹ️ ${indexName} index on "users" does not exist`);
                } else {
                    console.error(`❌ Error dropping ${indexName} index from "users":`, error.message);
                }
            }
        }
        const updatedUserIndexes = await usersCollection.indexes();
        console.log('Updated "users" indexes:', updatedUserIndexes.map(idx => idx.name));


        // --- Patients Collection Index Cleanup ---
        console.log('\n--- Cleaning up indexes for "patients" collection ---');
        const patientIndexes = await patientsCollection.indexes();
        console.log('Current "patients" indexes:', patientIndexes.map(idx => idx.name));

        const patientIndexesToDrop = [
            'pharmacyId_1_mrn_1'
        ];

        for (const indexName of patientIndexesToDrop) {
            try {
                await patientsCollection.dropIndex(indexName);
                console.log(`✅ Dropped ${indexName} index from "patients"`);
            } catch (error: any) {
                if (error.codeName === 'IndexNotFound' || error.code === 27) {
                    console.log(`ℹ️ ${indexName} index on "patients" does not exist`);
                } else {
                    console.error(`❌ Error dropping ${indexName} index from "patients":`, error.message);
                }
            }
        }
        const updatedPatientIndexes = await patientsCollection.indexes();
        console.log('Updated "patients" indexes:', updatedPatientIndexes.map(idx => idx.name));


        console.log('\n✅ Index cleanup completed successfully!');
    } catch (error) {
        console.error('❌ Error during index cleanup:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
};

// Run the cleanup function if this file is executed directly
if (require.main === module) {
    dropOldIndexes();
}

export default dropOldIndexes;