#!/usr/bin/env node

/**
 * Script to check diagnostic data for super admin and fix visibility issues
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function checkSuperAdminDiagnosticData() {
  try {
    console.log('🔍 Checking super admin diagnostic data...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Find the super admin user
    const superAdmin = await db.collection('users').findOne({ 
      email: 'megagigdev@gmail.com' 
    });
    
    if (!superAdmin) {
      console.log('❌ Super admin user not found');
      return;
    }

    console.log('👤 Super Admin User:', {
      email: superAdmin.email,
      role: superAdmin.role,
      workplaceId: superAdmin.workplaceId,
      isAdmin: superAdmin.isAdmin
    });

    // Check diagnostic data for this user's workplace
    const diagnosticRequestsForWorkplace = await db.collection('diagnosticrequests').find({
      workplaceId: superAdmin.workplaceId,
      isDeleted: { $ne: true }
    }).toArray();

    console.log(`\n📊 Diagnostic Requests for Super Admin workplace (${superAdmin.workplaceId}):`, diagnosticRequestsForWorkplace.length);

    // Check all diagnostic data across all workplaces
    const allDiagnosticRequests = await db.collection('diagnosticrequests').find({
      isDeleted: { $ne: true }
    }).toArray();

    console.log('📊 Total Diagnostic Requests across all workplaces:', allDiagnosticRequests.length);

    // Group by workplace
    const byWorkplace = {};
    allDiagnosticRequests.forEach(req => {
      const wpId = req.workplaceId.toString();
      byWorkplace[wpId] = (byWorkplace[wpId] || 0) + 1;
    });

    console.log('\n📊 Diagnostic Requests by workplace:');
    Object.entries(byWorkplace).forEach(([wpId, count]) => {
      console.log(`   - ${wpId}: ${count} requests`);
    });

    // Check if there are requests in other workplaces that super admin should see
    const otherWorkplaceRequests = allDiagnosticRequests.filter(req => 
      req.workplaceId.toString() !== superAdmin.workplaceId.toString()
    );

    console.log(`\n📊 Requests in other workplaces: ${otherWorkplaceRequests.length}`);

    if (otherWorkplaceRequests.length > 0) {
      console.log('\n🔧 Super admin should be able to see all diagnostic data across workplaces.');
      console.log('   The issue is likely in the diagnostic controller queries that filter by workplaceId.');
      console.log('   Super admins should bypass workplace filtering.');
    }

    // Check diagnostic results
    const allDiagnosticResults = await db.collection('diagnosticresults').find({
      isDeleted: { $ne: true }
    }).toArray();

    console.log(`\n📊 Total Diagnostic Results: ${allDiagnosticResults.length}`);

    // Group results by workplace
    const resultsByWorkplace = {};
    allDiagnosticResults.forEach(result => {
      const wpId = result.workplaceId.toString();
      resultsByWorkplace[wpId] = (resultsByWorkplace[wpId] || 0) + 1;
    });

    console.log('\n📊 Diagnostic Results by workplace:');
    Object.entries(resultsByWorkplace).forEach(([wpId, count]) => {
      console.log(`   - ${wpId}: ${count} results`);
    });

    console.log('\n🎯 Summary:');
    console.log(`   - Super admin workplace has ${diagnosticRequestsForWorkplace.length} requests`);
    console.log(`   - Other workplaces have ${otherWorkplaceRequests.length} requests`);
    console.log(`   - Total requests: ${allDiagnosticRequests.length}`);
    console.log(`   - Total results: ${allDiagnosticResults.length}`);

    if (diagnosticRequestsForWorkplace.length === 0 && otherWorkplaceRequests.length > 0) {
      console.log('\n⚠️ ISSUE IDENTIFIED:');
      console.log('   Super admin has no diagnostic data in their workplace,');
      console.log('   but there is data in other workplaces that they should be able to see.');
      console.log('   The diagnostic controllers need to be updated to allow super admins');
      console.log('   to see data across all workplaces.');
    }

  } catch (error) {
    console.error('❌ Failed to check super admin diagnostic data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  checkSuperAdminDiagnosticData()
    .then(() => {
      console.log('Super admin diagnostic data check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Super admin diagnostic data check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkSuperAdminDiagnosticData };