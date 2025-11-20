#!/usr/bin/env node

/**
 * Script to check if there's actual diagnostic data in the database
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function checkDiagnosticData() {
  try {
    console.log('🔍 Checking diagnostic data in database...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find the user
    const user = await db.collection('users').findOne({ 
      email: 'megagigsolution@gmail.com' 
    });
    
    console.log(`👤 User: ${user.email}`);
    console.log(`🏢 Workplace: ${user.workplaceId}`);

    // Check DiagnosticRequest collection
    const diagnosticRequests = await db.collection('diagnosticrequests').find({
      workplaceId: user.workplaceId,
      isDeleted: { $ne: true }
    }).toArray();

    console.log(`\\n📊 DiagnosticRequest Collection:`);
    console.log(`   - Total records: ${diagnosticRequests.length}`);
    
    if (diagnosticRequests.length > 0) {
      const statusCounts = {};
      diagnosticRequests.forEach(req => {
        statusCounts[req.status] = (statusCounts[req.status] || 0) + 1;
      });
      
      console.log(`   - By status:`, statusCounts);
      console.log(`   - Sample record:`, {
        _id: diagnosticRequests[0]._id,
        status: diagnosticRequests[0].status,
        createdAt: diagnosticRequests[0].createdAt,
        patientId: diagnosticRequests[0].patientId
      });
    }

    // Check DiagnosticResult collection
    const diagnosticResults = await db.collection('diagnosticresults').find({
      workplaceId: user.workplaceId,
      isDeleted: { $ne: true }
    }).toArray();

    console.log(`\\n📊 DiagnosticResult Collection:`);
    console.log(`   - Total records: ${diagnosticResults.length}`);
    
    if (diagnosticResults.length > 0) {
      console.log(`   - Sample record:`, {
        _id: diagnosticResults[0]._id,
        requestId: diagnosticResults[0].requestId,
        confidenceScore: diagnosticResults[0].confidenceScore,
        createdAt: diagnosticResults[0].createdAt
      });
    }

    // Check legacy DiagnosticCase collection
    const diagnosticCases = await db.collection('diagnosticcases').find({
      workplaceId: user.workplaceId,
      isDeleted: { $ne: true }
    }).toArray();

    console.log(`\\n📊 DiagnosticCase Collection (Legacy):`);
    console.log(`   - Total records: ${diagnosticCases.length}`);
    
    if (diagnosticCases.length > 0) {
      const statusCounts = {};
      diagnosticCases.forEach(case_ => {
        statusCounts[case_.status] = (statusCounts[case_.status] || 0) + 1;
      });
      
      console.log(`   - By status:`, statusCounts);
      console.log(`   - Sample record:`, {
        _id: diagnosticCases[0]._id,
        status: diagnosticCases[0].status,
        createdAt: diagnosticCases[0].createdAt,
        patientId: diagnosticCases[0].patientId
      });
    }

    // Check DiagnosticHistory collection
    const diagnosticHistory = await db.collection('diagnostichistories').find({
      workplaceId: user.workplaceId,
      isDeleted: { $ne: true }
    }).toArray();

    console.log(`\\n📊 DiagnosticHistory Collection:`);
    console.log(`   - Total records: ${diagnosticHistory.length}`);

    // Summary
    const totalRecords = diagnosticRequests.length + diagnosticResults.length + diagnosticCases.length + diagnosticHistory.length;
    console.log(`\\n🎯 Summary:`);
    console.log(`   - Total diagnostic records: ${totalRecords}`);
    console.log(`   - DiagnosticRequests: ${diagnosticRequests.length}`);
    console.log(`   - DiagnosticResults: ${diagnosticResults.length}`);
    console.log(`   - DiagnosticCases (legacy): ${diagnosticCases.length}`);
    console.log(`   - DiagnosticHistory: ${diagnosticHistory.length}`);

    if (totalRecords === 0) {
      console.log(`\\n⚠️ No diagnostic data found for this workspace.`);
      console.log(`   This is why analytics shows all zeros.`);
      console.log(`   To see real data, create some diagnostic cases first.`);
    } else {
      console.log(`\\n✅ Diagnostic data exists! Analytics should show real numbers.`);
      console.log(`   If analytics still shows zeros, there might be a query issue.`);
    }

  } catch (error) {
    console.error('❌ Failed to check diagnostic data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  checkDiagnosticData()
    .then(() => {
      console.log('Diagnostic data check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Diagnostic data check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkDiagnosticData };