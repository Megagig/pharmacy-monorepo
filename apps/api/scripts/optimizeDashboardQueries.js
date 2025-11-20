const mongoose = require('mongoose');
require('dotenv').config();

/**
 * Database optimization script for dashboard performance
 * This script creates indexes for improved query performance
 */

async function optimizeDashboardQueries() {
    console.log('🚀 Starting database optimization for dashboard queries...');

    try {
        // Get database connection
        const db = mongoose.connection.db;

        console.log('📊 Adding indexes for Patient collection...');
        // Patient collection indexes for dashboard queries
        await db.collection('patients').createIndex(
            { workplaceId: 1, isDeleted: 1, createdAt: -1 },
            { name: 'workplace_dashboard_patients' }
        );
        await db.collection('patients').createIndex(
            { workplaceId: 1, dateOfBirth: 1 },
            { name: 'workplace_patient_age' }
        );

        console.log('📝 Adding indexes for ClinicalNote collection...');
        // Clinical notes indexes for dashboard queries
        await db.collection('clinicalnotes').createIndex(
            { workplaceId: 1, createdAt: -1 },
            { name: 'workplace_dashboard_notes' }
        );
        await db.collection('clinicalnotes').createIndex(
            { workplaceId: 1, type: 1 },
            { name: 'workplace_notes_type' }
        );

        console.log('💊 Adding indexes for MedicationRecord collection...');
        // Medication records indexes for dashboard queries
        await db.collection('medicationrecords').createIndex(
            { workplaceId: 1, status: 1 },
            { name: 'workplace_medication_status' }
        );
        await db.collection('medicationrecords').createIndex(
            { workplaceId: 1, createdAt: -1 },
            { name: 'workplace_dashboard_medications' }
        );

        console.log('🏥 Adding indexes for MedicationTherapyReview collection...');
        // MTR indexes for dashboard queries with focus on performance
        await db.collection('medicationtherapyreviews').createIndex(
            { workplaceId: 1 },
            { name: 'workplace_mtr_basic' }
        );
        await db.collection('medicationtherapyreviews').createIndex(
            { workplaceId: 1, status: 1 },
            { name: 'workplace_mtr_status' }
        );
        await db.collection('medicationtherapyreviews').createIndex(
            { workplaceId: 1, createdAt: -1 },
            {
                name: 'workplace_mtr_recent',
                partialFilterExpression: {
                    createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }
            }
        );

        console.log('🏢 Adding indexes for Workplace collection...');
        // Workplace indexes for dashboard queries
        await db.collection('workplaces').createIndex(
            { _id: 1, isActive: 1 },
            { name: 'workplace_active' }
        );

        console.log('👤 Adding indexes for User collection...');
        // User indexes for dashboard queries
        await db.collection('users').createIndex(
            { workplaceId: 1, isActive: 1 },
            { name: 'workplace_users_active' }
        );

        console.log('✅ Database optimization completed successfully!');
        console.log('📈 Dashboard queries should now be significantly faster.');

    } catch (error) {
        console.error('❌ Error during database optimization:', error);
        throw error;
    }
}

/**
 * Check if indexes exist and show their status
 */
async function checkIndexes() {
    console.log('🔍 Checking existing indexes...');

    try {
        const db = mongoose.connection.db;

        const collections = ['patients', 'clinicalnotes', 'medicationrecords', 'medicationtherapyreviews', 'workplaces', 'users'];

        for (const collectionName of collections) {
            console.log(`\n📋 Indexes for ${collectionName}:`);
            const indexes = await db.collection(collectionName).listIndexes().toArray();
            indexes.forEach(index => {
                console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
            });
        }

    } catch (error) {
        console.error('❌ Error checking indexes:', error);
    }
}

/**
 * Remove old/unused indexes to clean up the database
 */
async function cleanupIndexes() {
    console.log('🧹 Cleaning up unused indexes...');

    try {
        const db = mongoose.connection.db;

        // Add any old index names that should be removed
        const indexesToRemove = [
            // Example: { collection: 'patients', index: 'old_index_name' }
        ];

        for (const { collection, index } of indexesToRemove) {
            try {
                await db.collection(collection).dropIndex(index);
                console.log(`✅ Removed index ${index} from ${collection}`);
            } catch (error) {
                if (error.code === 27) {
                    console.log(`ℹ️ Index ${index} does not exist in ${collection}`);
                } else {
                    console.error(`❌ Error removing index ${index}:`, error.message);
                }
            }
        }

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
    }
}

module.exports = {
    optimizeDashboardQueries,
    checkIndexes,
    cleanupIndexes
};

// Run if called directly
if (require.main === module) {
    // Connect to MongoDB
    mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacare', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    mongoose.connection.once('open', async () => {
        console.log('📦 Connected to MongoDB');

        try {
            await checkIndexes();
            await optimizeDashboardQueries();
            await checkIndexes();

            console.log('🎉 Database optimization complete!');
            process.exit(0);
        } catch (error) {
            console.error('💥 Optimization failed:', error);
            process.exit(1);
        }
    });

    mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    });
}