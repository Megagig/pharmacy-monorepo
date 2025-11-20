/**
 * Script to check detailed AI interpretation data
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkAIInterpretationDetails() {
    try {
        const caseId = process.argv[2];
        
        if (!caseId) {
            console.log('Usage: node checkAIInterpretationDetails.js <caseId>');
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
        console.log(`AI Interpretation Details`);
        console.log(`========================================`);
        
        if (doc.aiInterpretation) {
            console.log(`\nInterpretation Text:`);
            console.log(doc.aiInterpretation.interpretation);
            
            console.log(`\nClinical Significance: ${doc.aiInterpretation.clinicalSignificance}`);
            console.log(`Confidence: ${doc.aiInterpretation.confidence}%`);
            
            console.log(`\nDifferential Diagnosis (${doc.aiInterpretation.differentialDiagnosis?.length || 0}):`);
            doc.aiInterpretation.differentialDiagnosis?.forEach((d, i) => {
                console.log(`  ${i + 1}. ${d}`);
            });
            
            console.log(`\nTherapeutic Implications (${doc.aiInterpretation.therapeuticImplications?.length || 0}):`);
            doc.aiInterpretation.therapeuticImplications?.forEach((t, i) => {
                console.log(`  ${i + 1}. ${t}`);
            });
            
            console.log(`\nMonitoring Recommendations (${doc.aiInterpretation.monitoringRecommendations?.length || 0}):`);
            doc.aiInterpretation.monitoringRecommendations?.forEach((m, i) => {
                console.log(`  ${i + 1}. ${m}`);
            });
            
            console.log(`\nRed Flags (${doc.aiInterpretation.redFlags?.length || 0}):`);
            doc.aiInterpretation.redFlags?.forEach((r, i) => {
                console.log(`  ${i + 1}. ${r.flag} (${r.severity})`);
                console.log(`      Action: ${r.action}`);
            });
        } else {
            console.log('No AI interpretation found');
        }
        
        console.log(`\n========================================`);
        console.log(`Therapy Recommendations: ${doc.therapyRecommendations?.length || 0}`);
        console.log(`Safety Checks: ${doc.safetyChecks?.length || 0}`);
        console.log(`========================================\n`);

        process.exit(0);
    } catch (error) {
        console.error('Error checking AI interpretation:', error);
        process.exit(1);
    }
}

// Run the script
checkAIInterpretationDetails();

