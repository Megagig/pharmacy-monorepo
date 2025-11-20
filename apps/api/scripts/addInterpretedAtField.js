/**
 * Script to add interpretedAt field to existing AI interpretations
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function addInterpretedAtField() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Access the collection directly
        const db = mongoose.connection.db;
        const collection = db.collection('labintegrations');

        // Find all documents with AI interpretation but no interpretedAt field
        const docs = await collection.find({
            'aiInterpretation': { $exists: true, $ne: null },
            'aiInterpretation.interpretedAt': { $exists: false }
        }).toArray();

        console.log(`\nFound ${docs.length} documents with AI interpretation but no interpretedAt field\n`);

        if (docs.length === 0) {
            console.log('No documents to update. Exiting...');
            process.exit(0);
        }

        let updated = 0;

        for (const doc of docs) {
            // Use updatedAt as the interpretedAt value (best approximation)
            const interpretedAt = doc.updatedAt || new Date();

            await collection.updateOne(
                { _id: doc._id },
                { 
                    $set: { 
                        'aiInterpretation.interpretedAt': interpretedAt
                    } 
                }
            );

            console.log(`✅ Updated document ${doc._id} - interpretedAt: ${interpretedAt}`);
            updated++;
        }

        console.log(`\n========================================`);
        console.log(`Summary:`);
        console.log(`  Total documents found: ${docs.length}`);
        console.log(`  Updated: ${updated}`);
        console.log(`========================================\n`);

        process.exit(0);
    } catch (error) {
        console.error('Error adding interpretedAt field:', error);
        process.exit(1);
    }
}

// Run the script
addInterpretedAtField();

