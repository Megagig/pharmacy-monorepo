/**
 * Script to repair corrupted criticalSafetyIssues field
 * This script will:
 * 1. Find all lab integrations with corrupted criticalSafetyIssues field
 * 2. Convert array values to boolean
 * 3. Fix the data type mismatch
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function repairCorruptedData() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Access the collection directly to bypass schema validation
        const db = mongoose.connection.db;
        const collection = db.collection('labintegrations');

        // Find all documents
        const allDocs = await collection.find({}).toArray();
        console.log(`\nFound ${allDocs.length} total lab integration documents`);

        let fixedCount = 0;
        let alreadyCorrectCount = 0;
        let errorCount = 0;

        for (const doc of allDocs) {
            try {
                const criticalSafetyIssues = doc.criticalSafetyIssues;
                
                // Check if the field is corrupted (array instead of boolean)
                if (Array.isArray(criticalSafetyIssues)) {
                    console.log(`\n---`);
                    console.log(`Document ID: ${doc._id}`);
                    console.log(`Current value: ${JSON.stringify(criticalSafetyIssues)} (type: Array)`);
                    
                    // Convert array to boolean
                    // If array contains 'true' or true, set to true
                    // If array contains 'false' or false, or is empty, set to false
                    let booleanValue = false;
                    if (criticalSafetyIssues.length > 0) {
                        const firstValue = criticalSafetyIssues[0];
                        if (firstValue === true || firstValue === 'true') {
                            booleanValue = true;
                        }
                    }
                    
                    // Update the document
                    await collection.updateOne(
                        { _id: doc._id },
                        { $set: { criticalSafetyIssues: booleanValue } }
                    );
                    
                    console.log(`✅ Fixed - New value: ${booleanValue} (type: Boolean)`);
                    fixedCount++;
                } else if (typeof criticalSafetyIssues === 'boolean') {
                    alreadyCorrectCount++;
                } else if (criticalSafetyIssues === undefined || criticalSafetyIssues === null) {
                    // Set default value
                    await collection.updateOne(
                        { _id: doc._id },
                        { $set: { criticalSafetyIssues: false } }
                    );
                    console.log(`\n---`);
                    console.log(`Document ID: ${doc._id}`);
                    console.log(`✅ Set default value: false`);
                    fixedCount++;
                } else {
                    console.log(`\n---`);
                    console.log(`Document ID: ${doc._id}`);
                    console.log(`⚠️  Unexpected type: ${typeof criticalSafetyIssues}, value: ${criticalSafetyIssues}`);
                    // Try to convert to boolean
                    const booleanValue = Boolean(criticalSafetyIssues);
                    await collection.updateOne(
                        { _id: doc._id },
                        { $set: { criticalSafetyIssues: booleanValue } }
                    );
                    console.log(`✅ Converted to: ${booleanValue}`);
                    fixedCount++;
                }
            } catch (error) {
                console.error(`❌ Error processing document ${doc._id}:`, error.message);
                errorCount++;
            }
        }

        console.log(`\n========================================`);
        console.log(`Summary:`);
        console.log(`  Total documents: ${allDocs.length}`);
        console.log(`  Already correct: ${alreadyCorrectCount}`);
        console.log(`  Fixed: ${fixedCount}`);
        console.log(`  Errors: ${errorCount}`);
        console.log(`========================================\n`);

        // Verify the fix
        console.log('Verifying fix...');
        const stillCorrupted = await collection.find({
            criticalSafetyIssues: { $type: 'array' }
        }).toArray();

        if (stillCorrupted.length > 0) {
            console.log(`⚠️  Warning: ${stillCorrupted.length} documents still have array type`);
            stillCorrupted.forEach(doc => {
                console.log(`  - ${doc._id}: ${JSON.stringify(doc.criticalSafetyIssues)}`);
            });
        } else {
            console.log('✅ All documents verified - no arrays found!');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error repairing corrupted data:', error);
        process.exit(1);
    }
}

// Run the script
repairCorruptedData();

