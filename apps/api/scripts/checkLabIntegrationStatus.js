/**
 * Script to check the status of a specific lab integration case
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkLabIntegrationStatus() {
    try {
        const caseId = process.argv[2];
        
        if (!caseId) {
            console.log('Usage: node checkLabIntegrationStatus.js <caseId>');
            console.log('Example: node checkLabIntegrationStatus.js 6915044bfb6c3cc36d4eb1fc');
            process.exit(1);
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Access the collection directly
        const db = mongoose.connection.db;
        const collection = db.collection('labintegrations');

        // Find the document
        const doc = await collection.findOne({ _id: new mongoose.Types.ObjectId(caseId) });

        if (!doc) {
            console.log(`\n❌ Lab integration case not found: ${caseId}`);
            process.exit(1);
        }

        console.log(`\n========================================`);
        console.log(`Lab Integration Case: ${caseId}`);
        console.log(`========================================`);
        console.log(`Status: ${doc.status}`);
        console.log(`AI Processing Status: ${doc.aiProcessingStatus}`);
        console.log(`AI Processing Error: ${doc.aiProcessingError || 'None'}`);
        console.log(`Created: ${doc.createdAt}`);
        console.log(`Updated: ${doc.updatedAt}`);
        console.log(`\nAI Interpretation:`);
        if (doc.aiInterpretation) {
            console.log(`  - Exists: Yes`);
            console.log(`  - Clinical Significance: ${doc.aiInterpretation.clinicalSignificance}`);
            console.log(`  - Confidence: ${doc.aiInterpretation.confidence}`);
            console.log(`  - Red Flags: ${doc.aiInterpretation.redFlags?.length || 0}`);
            if (doc.aiInterpretation.redFlags && doc.aiInterpretation.redFlags.length > 0) {
                console.log(`  - Red Flags Data:`);
                doc.aiInterpretation.redFlags.forEach((rf, i) => {
                    console.log(`    ${i + 1}. ${JSON.stringify(rf)}`);
                });
            }
        } else {
            console.log(`  - Exists: No`);
        }
        console.log(`\nTherapy Recommendations: ${doc.therapyRecommendations?.length || 0}`);
        console.log(`Safety Checks: ${doc.safetyChecks?.length || 0}`);
        console.log(`Critical Safety Issues: ${doc.criticalSafetyIssues}`);
        console.log(`========================================\n`);

        process.exit(0);
    } catch (error) {
        console.error('Error checking lab integration status:', error);
        process.exit(1);
    }
}

// Run the script
checkLabIntegrationStatus();

