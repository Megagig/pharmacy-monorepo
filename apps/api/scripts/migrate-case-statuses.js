// Migration script to update diagnostic case statuses
// Run this once to fix existing cases that are stuck in "draft" status

const mongoose = require('mongoose');
require('dotenv').config();

async function migrateCaseStatuses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharma-care');
    console.log('Connected to MongoDB');

    // Get the DiagnosticCase collection
    const DiagnosticCase = mongoose.connection.collection('diagnostic_cases');

    // Find all cases that are "draft" but have AI analysis completed
    const draftCasesWithAnalysis = await DiagnosticCase.find({
      status: 'draft',
      'aiAnalysis.confidenceScore': { $exists: true, $ne: null }
    }).toArray();

    console.log(`Found ${draftCasesWithAnalysis.length} draft cases with completed AI analysis`);

    if (draftCasesWithAnalysis.length > 0) {
      // Update these cases to "pending_review"
      const result = await DiagnosticCase.updateMany(
        {
          status: 'draft',
          'aiAnalysis.confidenceScore': { $exists: true, $ne: null }
        },
        {
          $set: { status: 'pending_review' }
        }
      );

      console.log(`Updated ${result.modifiedCount} cases from "draft" to "pending_review"`);
    }

    // Also check for any cases that might need the new follow_up status structure
    const followUpCases = await DiagnosticCase.find({
      status: 'follow_up',
      followUp: { $exists: false }
    }).toArray();

    if (followUpCases.length > 0) {
      console.log(`Found ${followUpCases.length} follow_up cases without followUp structure`);
      // These would need manual review as we don't have the original follow-up data
    }

    // Show summary of current statuses
    const statusCounts = await DiagnosticCase.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();

    console.log('\nCurrent status distribution:');
    statusCounts.forEach(status => {
      console.log(`  ${status._id}: ${status.count} cases`);
    });

    await mongoose.disconnect();
    console.log('\nMigration completed successfully!');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateCaseStatuses();