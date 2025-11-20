/**
 * Script to regenerate therapy recommendations from existing AI interpretations
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function regenerateTherapyRecommendations() {
    try {
        const caseId = process.argv[2];

        if (!caseId) {
            console.log('Usage: node regenerateTherapyRecommendations.js <caseId>');
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

        if (!doc.aiInterpretation) {
            console.log(`\n❌ No AI interpretation found for case: ${caseId}`);
            process.exit(1);
        }

        console.log(`\n========================================`);
        console.log(`Regenerating Therapy Recommendations`);
        console.log(`========================================`);

        const therapeuticImplications = doc.aiInterpretation.therapeuticImplications || [];
        console.log(`\nFound ${therapeuticImplications.length} therapeutic implications`);

        const recommendations = [];

        for (const implication of therapeuticImplications) {
            // Parse the therapeutic implication string
            // Format: "Medication Dose Frequency - Reasoning"
            const parts = implication.split(' - ');
            const medicationInfo = parts[0]?.trim() || '';
            const rationale = parts[1]?.trim() || implication;

            // Extract medication name (first word/phrase before dose)
            const medicationParts = medicationInfo.split(' ');
            const medicationName = medicationParts[0] || 'Medication';

            // Determine priority based on clinical significance
            let priority = 'medium';
            if (doc.aiInterpretation.clinicalSignificance === 'critical') {
                priority = 'critical';
            } else if (doc.aiInterpretation.clinicalSignificance === 'significant') {
                priority = 'high';
            }

            const recommendation = {
                medicationName,
                action: 'start',
                recommendedDose: medicationInfo.replace(medicationName, '').trim(),
                rationale,
                priority,
                evidenceLevel: 'moderate'
            };

            recommendations.push(recommendation);

            console.log(`\n✅ Created recommendation:`);
            console.log(`   Medication: ${medicationName}`);
            console.log(`   Action: ${recommendation.action}`);
            console.log(`   Dose: ${recommendation.recommendedDose}`);
            console.log(`   Rationale: ${rationale}`);
            console.log(`   Priority: ${priority}`);
        }

        // Update the document
        await collection.updateOne(
            { _id: doc._id },
            {
                $set: {
                    therapyRecommendations: recommendations,
                    recommendationSource: 'ai_generated'
                }
            }
        );

        console.log(`\n========================================`);
        console.log(`Summary:`);
        console.log(`  Therapeutic Implications: ${therapeuticImplications.length}`);
        console.log(`  Therapy Recommendations Created: ${recommendations.length}`);
        console.log(`========================================\n`);

        process.exit(0);
    } catch (error) {
        console.error('Error regenerating therapy recommendations:', error);
        process.exit(1);
    }
}

// Run the script
regenerateTherapyRecommendations();

