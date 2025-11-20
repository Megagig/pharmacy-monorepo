#!/usr/bin/env node

/**
 * Database migration script to add missing indexes for engagement integration
 * This fixes the performance issues with AI diagnostics
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function addEngagementIndexes() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;

        // Add indexes to FollowUpTask collection
        console.log('Adding indexes to followuptasks collection...');

        const followUpTaskIndexes = [
            { 'relatedRecords.diagnosticCaseId': 1 },
            { 'relatedRecords.clinicalInterventionId': 1 },
            { 'relatedRecords.mtrSessionId': 1 },
            { 'relatedRecords.appointmentId': 1 },
            { 'relatedRecords.medicationId': 1 }
        ];

        for (const index of followUpTaskIndexes) {
            try {
                await db.collection('followuptasks').createIndex(index);
                console.log(`✓ Created index on followuptasks:`, index);
            } catch (error) {
                if (error.code === 85) {
                    console.log(`- Index already exists on followuptasks:`, index);
                } else {
                    console.error(`✗ Failed to create index on followuptasks:`, index, error.message);
                }
            }
        }

        // Add indexes to Appointment collection
        console.log('Adding indexes to appointments collection...');

        const appointmentIndexes = [
            { 'relatedRecords.diagnosticCaseId': 1 },
            { 'relatedRecords.mtrSessionId': 1 },
            { 'relatedRecords.clinicalInterventionId': 1 },
            { 'relatedRecords.followUpTaskId': 1 },
            { 'relatedRecords.visitId': 1 }
        ];

        for (const index of appointmentIndexes) {
            try {
                await db.collection('appointments').createIndex(index);
                console.log(`✓ Created index on appointments:`, index);
            } catch (error) {
                if (error.code === 85) {
                    console.log(`- Index already exists on appointments:`, index);
                } else {
                    console.error(`✗ Failed to create index on appointments:`, index, error.message);
                }
            }
        }

        console.log('\n✅ Index migration completed successfully!');
        console.log('This should significantly improve AI diagnostics performance.');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the migration
if (require.main === module) {
    addEngagementIndexes()
        .then(() => {
            console.log('Migration completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { addEngagementIndexes };