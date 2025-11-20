/**
 * Script to delete duplicate draft lab integration cases
 * This script will:
 * 1. Find all draft lab integrations for the same patient
 * 2. Keep only the most recent one
 * 3. Delete all older duplicates
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Define LabIntegration schema directly
const labIntegrationSchema = new mongoose.Schema({
    workplaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workplace', required: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    pharmacistId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    labResultIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabResult' }],
    source: { type: String, enum: ['manual_entry', 'pdf_upload', 'image_upload', 'fhir_import', 'lis_integration'], required: true },
    sourceMetadata: mongoose.Schema.Types.Mixed,
    aiInterpretation: mongoose.Schema.Types.Mixed,
    aiProcessingStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'skipped'], default: 'pending' },
    aiProcessingError: String,
    therapyRecommendations: [mongoose.Schema.Types.Mixed],
    safetyChecks: [mongoose.Schema.Types.Mixed],
    pharmacistReview: mongoose.Schema.Types.Mixed,
    medicationAdjustments: [mongoose.Schema.Types.Mixed],
    status: { type: String, enum: ['draft', 'pending_interpretation', 'pending_review', 'pending_approval', 'approved', 'implemented', 'completed', 'cancelled'], default: 'draft' },
    urgency: { type: String, enum: ['stat', 'urgent', 'routine'], default: 'routine' },
    indication: String,
    clinicalQuestion: String,
    targetRange: String,
    patientConsent: mongoose.Schema.Types.Mixed,
    criticalSafetyIssues: { type: Boolean, default: false },
    safetyCheckStatus: String,
    recommendationSource: String,
}, { timestamps: true });

// Clear any existing model to avoid conflicts
delete mongoose.models.LabIntegration;
delete mongoose.connection.models.LabIntegration;

const LabIntegration = mongoose.model('LabIntegration', labIntegrationSchema);

async function deleteDuplicateDrafts() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find all draft cases
        const draftCases = await LabIntegration.find({
            status: 'draft'
        }).sort({ patientId: 1, createdAt: -1 }); // Sort by patient, newest first

        console.log(`\nFound ${draftCases.length} draft cases`);

        if (draftCases.length === 0) {
            console.log('No draft cases found. Exiting...');
            process.exit(0);
        }

        // Group by patient ID
        const casesByPatient = {};
        for (const labCase of draftCases) {
            const patientId = labCase.patientId.toString();
            if (!casesByPatient[patientId]) {
                casesByPatient[patientId] = [];
            }
            casesByPatient[patientId].push(labCase);
        }

        console.log(`\nFound cases for ${Object.keys(casesByPatient).length} unique patients`);

        let totalDeleted = 0;
        let totalKept = 0;

        // Process each patient's cases
        for (const [patientId, cases] of Object.entries(casesByPatient)) {
            if (cases.length > 1) {
                console.log(`\n---`);
                console.log(`Patient ID: ${patientId}`);
                console.log(`Total draft cases: ${cases.length}`);
                
                // Keep the most recent one (first in sorted array)
                const keepCase = cases[0];
                const deleteCases = cases.slice(1);
                
                console.log(`Keeping: ${keepCase._id} (Created: ${keepCase.createdAt})`);
                console.log(`Deleting ${deleteCases.length} older cases:`);
                
                for (const deleteCase of deleteCases) {
                    console.log(`  - ${deleteCase._id} (Created: ${deleteCase.createdAt})`);
                    await LabIntegration.deleteOne({ _id: deleteCase._id });
                    totalDeleted++;
                }
                
                totalKept++;
            } else {
                // Only one case for this patient, keep it
                console.log(`\nPatient ${patientId}: Only 1 draft case, keeping it`);
                totalKept++;
            }
        }

        console.log(`\n========================================`);
        console.log(`Summary:`);
        console.log(`  Total draft cases found: ${draftCases.length}`);
        console.log(`  Cases kept: ${totalKept}`);
        console.log(`  Cases deleted: ${totalDeleted}`);
        console.log(`========================================\n`);

        process.exit(0);
    } catch (error) {
        console.error('Error deleting duplicate drafts:', error);
        process.exit(1);
    }
}

// Run the script
deleteDuplicateDrafts();

