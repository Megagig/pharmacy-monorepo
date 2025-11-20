#!/usr/bin/env node

/**
 * Script to check why dashboard and analytics are showing zeros
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://megagigdev:9svFmZ3VCP5ONzfU@cluster0.vf50xoc.mongodb.net/PharmaCare?retryWrites=true&w=majority&appName=Cluster0';

async function checkWorkspaceDataIssue() {
  try {
    console.log('🔍 Checking why dashboard and analytics show zeros...');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;

    // Check the main user (megagigsolution@gmail.com)
    const mainUser = await db.collection('users').findOne({ 
      email: 'megagigsolution@gmail.com' 
    });
    
    if (mainUser) {
      console.log(`\\n👤 Main User: ${mainUser.email}`);
      console.log(`   - Role: ${mainUser.role}`);
      console.log(`   - Workplace ID: ${mainUser.workplaceId}`);

      // Check diagnostic data for this workspace
      const diagnosticRequests = await db.collection('diagnosticrequests').find({
        workplaceId: mainUser.workplaceId,
        isDeleted: { $ne: true }
      }).toArray();

      console.log(`\\n📊 Diagnostic Data for Main User's Workspace:`);
      console.log(`   - DiagnosticRequests: ${diagnosticRequests.length}`);
      
      if (diagnosticRequests.length > 0) {
        const statusCounts = {};
        diagnosticRequests.forEach(req => {
          statusCounts[req.status] = (statusCounts[req.status] || 0) + 1;
        });
        console.log(`   - Status breakdown:`, statusCounts);
        console.log(`   - Sample record workspace: ${diagnosticRequests[0].workplaceId}`);
        console.log(`   - User's workspace: ${mainUser.workplaceId}`);
        console.log(`   - Workspace match: ${diagnosticRequests[0].workplaceId?.toString() === mainUser.workplaceId?.toString() ? '✅' : '❌'}`);
      }

      // Check DiagnosticResults
      const diagnosticResults = await db.collection('diagnosticresults').find({
        workplaceId: mainUser.workplaceId,
        isDeleted: { $ne: true }
      }).toArray();

      console.log(`   - DiagnosticResults: ${diagnosticResults.length}`);
    }

    // Check all workspaces that have diagnostic data
    console.log(`\\n🏢 All Workspaces with Diagnostic Data:`);
    
    const workspacesWithData = await db.collection('diagnosticrequests').aggregate([
      {
        $match: {
          isDeleted: { $ne: true }
        }
      },
      {
        $group: {
          _id: '$workplaceId',
          count: { $sum: 1 },
          statuses: { $push: '$status' }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();

    workspacesWithData.forEach((workspace, index) => {
      console.log(`   ${index + 1}. Workspace ${workspace._id}: ${workspace.count} records`);
      
      const statusCounts = {};
      workspace.statuses.forEach(status => {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      console.log(`      Status breakdown:`, statusCounts);
    });

    // Check if there are any workspace ID mismatches
    console.log(`\\n🔍 Checking for workspace ID issues...`);
    
    const allUsers = await db.collection('users').find({
      workplaceId: { $exists: true, $ne: null },
      isDeleted: { $ne: true }
    }).toArray();

    console.log(`Found ${allUsers.length} users with workplaces`);

    // Check if any users have diagnostic data in different workspaces
    for (const user of allUsers.slice(0, 5)) { // Check first 5 users
      const userDiagnosticData = await db.collection('diagnosticrequests').countDocuments({
        workplaceId: user.workplaceId,
        isDeleted: { $ne: true }
      });

      if (userDiagnosticData > 0) {
        console.log(`   ${user.email}: ${userDiagnosticData} diagnostic records in workspace ${user.workplaceId}`);
      }
    }

  } catch (error) {
    console.error('❌ Failed to check workspace data:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\\nDisconnected from MongoDB');
  }
}

// Run the script
if (require.main === module) {
  checkWorkspaceDataIssue()
    .then(() => {
      console.log('Workspace data check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Workspace data check failed:', error);
      process.exit(1);
    });
}

module.exports = { checkWorkspaceDataIssue };