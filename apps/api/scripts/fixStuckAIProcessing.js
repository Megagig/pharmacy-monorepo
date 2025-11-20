/**
 * Script to fix lab integrations stuck in 'processing' status
 * This script will:
 * 1. Find all lab integrations with aiProcessingStatus = 'processing'
 * 2. Reset them to 'pending' so they can be retried
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function fixStuckAIProcessing() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Access the collection directly
        const db = mongoose.connection.db;
        const collection = db.collection('labintegrations');

        // Find all documents stuck in processing
        const stuckDocs = await collection.find({
            aiProcessingStatus: 'processing'
        }).toArray();

        console.log(`\nFound ${stuckDocs.length} lab integrations stuck in 'processing' status`);

        if (stuckDocs.length === 0) {
            console.log('No stuck documents found. Exiting...');
            process.exit(0);
        }

        let fixedCount = 0;

        for (const doc of stuckDocs) {
            console.log(`\n---`);
            console.log(`Document ID: ${doc._id}`);
            console.log(`Status: ${doc.status}`);
            console.log(`AI Processing Status: ${doc.aiProcessingStatus}`);
            console.log(`Created: ${doc.createdAt}`);
            
            // Calculate how long it's been processing
            const processingTime = Date.now() - new Date(doc.updatedAt).getTime();
            const processingMinutes = Math.floor(processingTime / 1000 / 60);
            console.log(`Processing time: ${processingMinutes} minutes`);
            
            // Reset to failed status with error message
            await collection.updateOne(
                { _id: doc._id },
                { 
                    $set: { 
                        aiProcessingStatus: 'failed',
                        aiProcessingError: 'AI interpretation failed due to validation error. Please retry.',
                        status: 'draft'
                    }
                }
            );
            
            console.log(`✅ Reset to 'draft' status with 'failed' AI processing status`);
            fixedCount++;
        }

        console.log(`\n========================================`);
        console.log(`Summary:`);
        console.log(`  Total stuck documents: ${stuckDocs.length}`);
        console.log(`  Fixed: ${fixedCount}`);
        console.log(`========================================\n`);

        process.exit(0);
    } catch (error) {
        console.error('Error fixing stuck AI processing:', error);
        process.exit(1);
    }
}

// Run the script
fixStuckAIProcessing();

