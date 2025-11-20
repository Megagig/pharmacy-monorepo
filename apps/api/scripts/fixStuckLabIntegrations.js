/**
 * Script to fix stuck lab integration cases
 * This script will:
 * 1. Find all lab integrations stuck in 'processing' status
 * 2. Check if they have been processing for more than 5 minutes
 * 3. Mark them as 'failed' with appropriate error message
 * 4. Optionally retry AI interpretation for them
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

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function fixStuckLabIntegrations() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find all lab integrations stuck in processing
        const stuckCases = await LabIntegration.find({
            $or: [
                { aiProcessingStatus: 'processing' },
                { status: 'pending_interpretation', aiProcessingStatus: { $ne: 'completed' } }
            ]
        }).sort({ createdAt: -1 });

        console.log(`\nFound ${stuckCases.length} potentially stuck cases`);

        if (stuckCases.length === 0) {
            console.log('No stuck cases found. Exiting...');
            process.exit(0);
        }

        let fixedCount = 0;
        let skippedCount = 0;

        for (const labIntegration of stuckCases) {
            const processingTime = Date.now() - new Date(labIntegration.updatedAt).getTime();
            const isStuck = processingTime > PROCESSING_TIMEOUT_MS;

            console.log(`\n---`);
            console.log(`Case ID: ${labIntegration._id}`);
            console.log(`Patient ID: ${labIntegration.patientId}`);
            console.log(`Status: ${labIntegration.status}`);
            console.log(`AI Processing Status: ${labIntegration.aiProcessingStatus}`);
            console.log(`Created: ${labIntegration.createdAt}`);
            console.log(`Updated: ${labIntegration.updatedAt}`);
            console.log(`Processing Time: ${Math.round(processingTime / 1000)}s`);

            if (isStuck) {
                console.log(`⚠️  STUCK - Marking as failed...`);

                labIntegration.aiProcessingStatus = 'failed';
                labIntegration.aiProcessingError = 'AI interpretation timed out. Please retry manually.';
                labIntegration.status = 'draft'; // Reset to draft so user can retry

                await labIntegration.save();
                fixedCount++;

                console.log(`✅ Fixed - Status updated to 'failed', case reset to 'draft'`);
            } else {
                console.log(`⏳ Still processing (< 5 minutes) - Skipping...`);
                skippedCount++;
            }
        }

        console.log(`\n========================================`);
        console.log(`Summary:`);
        console.log(`  Total cases found: ${stuckCases.length}`);
        console.log(`  Fixed: ${fixedCount}`);
        console.log(`  Skipped (still processing): ${skippedCount}`);
        console.log(`========================================\n`);

        process.exit(0);
    } catch (error) {
        console.error('Error fixing stuck lab integrations:', error);
        process.exit(1);
    }
}

// Run the script
fixStuckLabIntegrations();

