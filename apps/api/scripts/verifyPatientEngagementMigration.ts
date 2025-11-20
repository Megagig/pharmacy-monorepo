/**
 * Verification Script: Patient Engagement Migration
 * 
 * This script verifies the integrity of the Patient Engagement migration by:
 * 1. Checking data consistency between old and new models
 * 2. Validating bidirectional relationships
 * 3. Verifying index creation and performance
 * 4. Generating detailed migration report
 * 
 * Run with: npx ts-node backend/scripts/verifyPatientEngagementMigration.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmacycopilot';

interface VerificationReport {
  timestamp: Date;
  environment: string;
  database: string;
  
  // Data counts
  totalMTRFollowUps: number;
  migratedMTRFollowUps: number;
  totalAppointments: number;
  migratedAppointments: number;
  totalPatients: number;
  patientsWithPreferences: number;
  totalVisits: number;
  visitsWithAppointmentId: number;
  
  // Data integrity checks
  bidirectionalLinksValid: boolean;
  dataConsistencyValid: boolean;
  indexesCreated: boolean;
  
  // Performance metrics
  queryPerformance: {
    appointmentsByWorkplace: number;
    appointmentsByPatient: number;
    appointmentsByDate: number;
    followUpsByStatus: number;
  };
  
  // Issues found
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    category: string;
    description: string;
    count?: number;
    examples?: any[];
  }>;
  
  // Recommendations
  recommendations: string[];
  
  // Overall status
  migrationStatus: 'success' | 'partial' | 'failed';
  readyForProduction: boolean;
}

async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB for verification');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    throw error;
  }
}

async function loadModels(): Promise<void> {
  // Import existing models
  require('../src/models/Patient');
  require('../src/models/Visit');
  require('../src/models/MTRFollowUp');
  
  // Import new models
  try {
    require('../src/models/Appointment');
    require('../src/models/FollowUpTask');
    require('../src/models/ReminderTemplate');
    require('../src/models/PharmacistSchedule');
  } catch (error) {
    console.warn('⚠️  Some new models not found. This may indicate incomplete migration.');
  }
}

/**
 * Get basic data counts
 */
async function getDataCounts(): Promise<Partial<VerificationReport>> {
  console.log('\n📊 Collecting data counts...');
  
  const MTRFollowUp = mongoose.model('MTRFollowUp');
  const Patient = mongoose.model('Patient');
  const Visit = mongoose.model('Visit');
  
  let Appointment;
  try {
    Appointment = mongoose.model('Appointment');
  } catch (error) {
    console.warn('⚠️  Appointment model not found');
  }
  
  const totalMTRFollowUps = await MTRFollowUp.countDocuments();
  const migratedMTRFollowUps = await MTRFollowUp.countDocuments({
    appointmentId: { $exists: true }
  });
  
  const totalPatients = await Patient.countDocuments();
  const patientsWithPreferences = await Patient.countDocuments({
    appointmentPreferences: { $exists: true }
  });
  
  const totalVisits = await Visit.countDocuments();
  const visitsWithAppointmentId = await Visit.countDocuments({
    appointmentId: { $exists: true }
  });
  
  let totalAppointments = 0;
  let migratedAppointments = 0;
  
  if (Appointment) {
    totalAppointments = await Appointment.countDocuments();
    migratedAppointments = await Appointment.countDocuments({
      'metadata.source': 'mtr_migration'
    });
  }
  
  console.log(`  - MTRFollowUps: ${totalMTRFollowUps} total, ${migratedMTRFollowUps} migrated`);
  console.log(`  - Appointments: ${totalAppointments} total, ${migratedAppointments} migrated`);
  console.log(`  - Patients: ${totalPatients} total, ${patientsWithPreferences} with preferences`);
  console.log(`  - Visits: ${totalVisits} total, ${visitsWithAppointmentId} with appointmentId`);
  
  return {
    totalMTRFollowUps,
    migratedMTRFollowUps,
    totalAppointments,
    migratedAppointments,
    totalPatients,
    patientsWithPreferences,
    totalVisits,
    visitsWithAppointmentId
  };
}

/**
 * Verify bidirectional links between MTRFollowUp and Appointment
 */
async function verifyBidirectionalLinks(): Promise<{ valid: boolean; issues: any[] }> {
  console.log('\n🔗 Verifying bidirectional links...');
  
  const MTRFollowUp = mongoose.model('MTRFollowUp');
  let Appointment;
  
  try {
    Appointment = mongoose.model('Appointment');
  } catch (error) {
    return { valid: false, issues: [{ description: 'Appointment model not found' }] };
  }
  
  const issues: any[] = [];
  
  // Check MTRFollowUp -> Appointment links
  const mtrFollowUpsWithAppointmentId = await MTRFollowUp.find({
    appointmentId: { $exists: true, $ne: null }
  }).select('_id appointmentId').limit(1000);
  
  console.log(`  Checking ${mtrFollowUpsWithAppointmentId.length} MTRFollowUp -> Appointment links...`);
  
  for (const mtrFollowUp of mtrFollowUpsWithAppointmentId) {
    const appointment = await Appointment.findById(mtrFollowUp.appointmentId);
    
    if (!appointment) {
      issues.push({
        type: 'broken_link',
        description: `MTRFollowUp ${mtrFollowUp._id} references non-existent Appointment ${mtrFollowUp.appointmentId}`,
        mtrFollowUpId: mtrFollowUp._id,
        appointmentId: mtrFollowUp.appointmentId
      });
    } else if (appointment.relatedRecords?.followUpTaskId?.toString() !== mtrFollowUp._id.toString()) {
      issues.push({
        type: 'missing_backlink',
        description: `Appointment ${appointment._id} does not reference back to MTRFollowUp ${mtrFollowUp._id}`,
        mtrFollowUpId: mtrFollowUp._id,
        appointmentId: appointment._id
      });
    }
  }
  
  // Check Appointment -> MTRFollowUp links
  const migratedAppointments = await Appointment.find({
    'metadata.source': 'mtr_migration',
    'relatedRecords.followUpTaskId': { $exists: true, $ne: null }
  }).select('_id relatedRecords.followUpTaskId').limit(1000);
  
  console.log(`  Checking ${migratedAppointments.length} Appointment -> MTRFollowUp links...`);
  
  for (const appointment of migratedAppointments) {
    const followUpTaskId = appointment.relatedRecords?.followUpTaskId;
    if (followUpTaskId) {
      const mtrFollowUp = await MTRFollowUp.findById(followUpTaskId);
      
      if (!mtrFollowUp) {
        issues.push({
          type: 'broken_backlink',
          description: `Appointment ${appointment._id} references non-existent MTRFollowUp ${followUpTaskId}`,
          appointmentId: appointment._id,
          mtrFollowUpId: followUpTaskId
        });
      } else if (mtrFollowUp.appointmentId?.toString() !== appointment._id.toString()) {
        issues.push({
          type: 'missing_link',
          description: `MTRFollowUp ${mtrFollowUp._id} does not reference back to Appointment ${appointment._id}`,
          appointmentId: appointment._id,
          mtrFollowUpId: mtrFollowUp._id
        });
      }
    }
  }
  
  const valid = issues.length === 0;
  console.log(`  Result: ${valid ? '✅ All links valid' : `❌ Found ${issues.length} link issues`}`);
  
  return { valid, issues };
}

/**
 * Verify data consistency between MTRFollowUp and Appointment
 */
async function verifyDataConsistency(): Promise<{ valid: boolean; issues: any[] }> {
  console.log('\n📋 Verifying data consistency...');
  
  const MTRFollowUp = mongoose.model('MTRFollowUp');
  let Appointment;
  
  try {
    Appointment = mongoose.model('Appointment');
  } catch (error) {
    return { valid: false, issues: [{ description: 'Appointment model not found' }] };
  }
  
  const issues: any[] = [];
  
  // Sample some MTRFollowUp records and verify their corresponding Appointments
  const sampleMTRFollowUps = await MTRFollowUp.find({
    appointmentId: { $exists: true, $ne: null }
  }).populate('appointmentId').limit(100);
  
  console.log(`  Checking data consistency for ${sampleMTRFollowUps.length} records...`);
  
  for (const mtrFollowUp of sampleMTRFollowUps) {
    const appointment = mtrFollowUp.appointmentId as any;
    
    if (appointment) {
      // Check patient ID consistency
      if (appointment.patientId.toString() !== mtrFollowUp.patientId.toString()) {
        issues.push({
          type: 'patient_mismatch',
          description: `Patient ID mismatch between MTRFollowUp ${mtrFollowUp._id} and Appointment ${appointment._id}`,
          mtrPatientId: mtrFollowUp.patientId,
          appointmentPatientId: appointment.patientId
        });
      }
      
      // Check workplace ID consistency
      if (appointment.workplaceId.toString() !== mtrFollowUp.workplaceId.toString()) {
        issues.push({
          type: 'workplace_mismatch',
          description: `Workplace ID mismatch between MTRFollowUp ${mtrFollowUp._id} and Appointment ${appointment._id}`,
          mtrWorkplaceId: mtrFollowUp.workplaceId,
          appointmentWorkplaceId: appointment.workplaceId
        });
      }
      
      // Check assigned pharmacist consistency
      if (appointment.assignedTo.toString() !== mtrFollowUp.assignedTo.toString()) {
        issues.push({
          type: 'assignee_mismatch',
          description: `Assigned pharmacist mismatch between MTRFollowUp ${mtrFollowUp._id} and Appointment ${appointment._id}`,
          mtrAssignedTo: mtrFollowUp.assignedTo,
          appointmentAssignedTo: appointment.assignedTo
        });
      }
      
      // Check duration consistency
      if (appointment.duration !== mtrFollowUp.estimatedDuration) {
        issues.push({
          type: 'duration_mismatch',
          description: `Duration mismatch between MTRFollowUp ${mtrFollowUp._id} (${mtrFollowUp.estimatedDuration}min) and Appointment ${appointment._id} (${appointment.duration}min)`,
          mtrDuration: mtrFollowUp.estimatedDuration,
          appointmentDuration: appointment.duration
        });
      }
      
      // Check date consistency (allowing for time extraction differences)
      const mtrDate = new Date(mtrFollowUp.scheduledDate);
      const appointmentDate = new Date(appointment.scheduledDate);
      
      if (mtrDate.toDateString() !== appointmentDate.toDateString()) {
        issues.push({
          type: 'date_mismatch',
          description: `Scheduled date mismatch between MTRFollowUp ${mtrFollowUp._id} and Appointment ${appointment._id}`,
          mtrDate: mtrFollowUp.scheduledDate,
          appointmentDate: appointment.scheduledDate
        });
      }
    }
  }
  
  const valid = issues.length === 0;
  console.log(`  Result: ${valid ? '✅ Data consistency valid' : `❌ Found ${issues.length} consistency issues`}`);
  
  return { valid, issues };
}

/**
 * Verify index creation and performance
 */
async function verifyIndexes(): Promise<{ created: boolean; performance: any; issues: any[] }> {
  console.log('\n📈 Verifying indexes and performance...');
  
  const issues: any[] = [];
  const performance: any = {};
  
  try {
    const Appointment = mongoose.model('Appointment');
    
    // Check if key indexes exist
    const indexes = await Appointment.collection.getIndexes();
    const indexNames = Object.keys(indexes);
    
    const requiredIndexes = [
      'workplaceId_1_scheduledDate_1_status_1',
      'workplaceId_1_patientId_1_scheduledDate_-1',
      'workplaceId_1_assignedTo_1_scheduledDate_1'
    ];
    
    let indexesCreated = true;
    for (const requiredIndex of requiredIndexes) {
      if (!indexNames.some(name => name.includes(requiredIndex.replace(/_/g, '_')))) {
        indexesCreated = false;
        issues.push({
          type: 'missing_index',
          description: `Required index not found: ${requiredIndex}`,
          index: requiredIndex
        });
      }
    }
    
    // Test query performance
    const testWorkplaceId = new mongoose.Types.ObjectId();
    const testPatientId = new mongoose.Types.ObjectId();
    const testDate = new Date();
    
    // Test appointment queries
    const start1 = Date.now();
    await Appointment.find({ 
      workplaceId: testWorkplaceId, 
      scheduledDate: { $gte: testDate } 
    }).limit(10).explain('executionStats');
    performance.appointmentsByWorkplace = Date.now() - start1;
    
    const start2 = Date.now();
    await Appointment.find({ 
      workplaceId: testWorkplaceId, 
      patientId: testPatientId 
    }).limit(10).explain('executionStats');
    performance.appointmentsByPatient = Date.now() - start2;
    
    const start3 = Date.now();
    await Appointment.find({ 
      scheduledDate: { 
        $gte: new Date(testDate.getTime() - 24 * 60 * 60 * 1000),
        $lte: new Date(testDate.getTime() + 24 * 60 * 60 * 1000)
      } 
    }).limit(10).explain('executionStats');
    performance.appointmentsByDate = Date.now() - start3;
    
    // Test follow-up queries if FollowUpTask model exists
    try {
      const FollowUpTask = mongoose.model('FollowUpTask');
      const start4 = Date.now();
      await FollowUpTask.find({ 
        workplaceId: testWorkplaceId, 
        status: 'pending' 
      }).limit(10).explain('executionStats');
      performance.followUpsByStatus = Date.now() - start4;
    } catch (error) {
      performance.followUpsByStatus = -1; // Model not found
    }
    
    console.log(`  Indexes created: ${indexesCreated ? '✅ Yes' : '❌ No'}`);
    console.log(`  Query performance (ms):`);
    console.log(`    - Appointments by workplace: ${performance.appointmentsByWorkplace}`);
    console.log(`    - Appointments by patient: ${performance.appointmentsByPatient}`);
    console.log(`    - Appointments by date: ${performance.appointmentsByDate}`);
    console.log(`    - Follow-ups by status: ${performance.followUpsByStatus >= 0 ? performance.followUpsByStatus : 'N/A'}`);
    
    return { created: indexesCreated, performance, issues };
    
  } catch (error: any) {
    issues.push({
      type: 'index_verification_error',
      description: `Failed to verify indexes: ${error.message}`,
      error: error.message
    });
    
    return { created: false, performance: {}, issues };
  }
}

/**
 * Generate recommendations based on findings
 */
function generateRecommendations(report: Partial<VerificationReport>): string[] {
  const recommendations: string[] = [];
  
  // Migration coverage recommendations
  if (report.totalMTRFollowUps && report.migratedMTRFollowUps) {
    const migrationRate = (report.migratedMTRFollowUps / report.totalMTRFollowUps) * 100;
    if (migrationRate < 100) {
      recommendations.push(`Complete migration of remaining ${report.totalMTRFollowUps - report.migratedMTRFollowUps} MTRFollowUp records`);
    }
  }
  
  // Patient preferences recommendations
  if (report.totalPatients && report.patientsWithPreferences) {
    const preferencesRate = (report.patientsWithPreferences / report.totalPatients) * 100;
    if (preferencesRate < 100) {
      recommendations.push(`Add appointment preferences to remaining ${report.totalPatients - report.patientsWithPreferences} patient records`);
    }
  }
  
  // Data integrity recommendations
  if (!report.bidirectionalLinksValid) {
    recommendations.push('Fix bidirectional link issues between MTRFollowUp and Appointment records');
  }
  
  if (!report.dataConsistencyValid) {
    recommendations.push('Resolve data consistency issues between migrated records');
  }
  
  // Performance recommendations
  if (!report.indexesCreated) {
    recommendations.push('Create missing database indexes for optimal query performance');
  }
  
  if (report.queryPerformance) {
    const slowQueries = Object.entries(report.queryPerformance).filter(([_, time]) => (time as number) > 100);
    if (slowQueries.length > 0) {
      recommendations.push('Optimize slow queries by reviewing index usage and query patterns');
    }
  }
  
  // General recommendations
  if (report.issues && report.issues.length > 0) {
    const errorCount = report.issues.filter(issue => issue.severity === 'error').length;
    if (errorCount > 0) {
      recommendations.push('Address all error-level issues before production deployment');
    }
    
    const warningCount = report.issues.filter(issue => issue.severity === 'warning').length;
    if (warningCount > 0) {
      recommendations.push('Review and address warning-level issues for optimal system performance');
    }
  }
  
  if (recommendations.length === 0) {
    recommendations.push('Migration verification completed successfully - system is ready for production');
  }
  
  return recommendations;
}

/**
 * Generate detailed verification report
 */
async function generateVerificationReport(): Promise<VerificationReport> {
  console.log('\n📋 Generating verification report...');
  
  const report: Partial<VerificationReport> = {
    timestamp: new Date(),
    environment: process.env.NODE_ENV || 'development',
    database: MONGODB_URI.split('/').pop() || 'unknown',
    issues: []
  };
  
  // Get data counts
  const dataCounts = await getDataCounts();
  Object.assign(report, dataCounts);
  
  // Verify bidirectional links
  const linkVerification = await verifyBidirectionalLinks();
  report.bidirectionalLinksValid = linkVerification.valid;
  
  if (!linkVerification.valid) {
    report.issues!.push(...linkVerification.issues.map(issue => ({
      severity: 'error' as const,
      category: 'data_integrity',
      description: issue.description,
      count: 1
    })));
  }
  
  // Verify data consistency
  const consistencyVerification = await verifyDataConsistency();
  report.dataConsistencyValid = consistencyVerification.valid;
  
  if (!consistencyVerification.valid) {
    report.issues!.push(...consistencyVerification.issues.map(issue => ({
      severity: 'warning' as const,
      category: 'data_consistency',
      description: issue.description,
      count: 1
    })));
  }
  
  // Verify indexes and performance
  const indexVerification = await verifyIndexes();
  report.indexesCreated = indexVerification.created;
  report.queryPerformance = indexVerification.performance;
  
  if (!indexVerification.created) {
    report.issues!.push(...indexVerification.issues.map(issue => ({
      severity: 'warning' as const,
      category: 'performance',
      description: issue.description,
      count: 1
    })));
  }
  
  // Determine migration status
  const errorCount = report.issues!.filter(issue => issue.severity === 'error').length;
  const warningCount = report.issues!.filter(issue => issue.severity === 'warning').length;
  
  if (errorCount > 0) {
    report.migrationStatus = 'failed';
    report.readyForProduction = false;
  } else if (warningCount > 0) {
    report.migrationStatus = 'partial';
    report.readyForProduction = false;
  } else {
    report.migrationStatus = 'success';
    report.readyForProduction = true;
  }
  
  // Generate recommendations
  report.recommendations = generateRecommendations(report);
  
  return report as VerificationReport;
}

/**
 * Save report to file
 */
async function saveReportToFile(report: VerificationReport): Promise<string> {
  const timestamp = report.timestamp.toISOString().replace(/[:.]/g, '-');
  const filename = `migration-verification-report-${timestamp}.json`;
  const filepath = path.join(__dirname, '../reports', filename);
  
  // Ensure reports directory exists
  const reportsDir = path.dirname(filepath);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  // Save report
  fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
  
  return filepath;
}

/**
 * Print report summary
 */
function printReportSummary(report: VerificationReport): void {
  console.log('\n===============================================');
  console.log('📊 Migration Verification Report');
  console.log('===============================================');
  
  console.log(`\nGeneral Information:`);
  console.log(`  - Timestamp: ${report.timestamp.toISOString()}`);
  console.log(`  - Environment: ${report.environment}`);
  console.log(`  - Database: ${report.database}`);
  
  console.log(`\nData Migration Summary:`);
  console.log(`  - MTRFollowUps: ${report.migratedMTRFollowUps}/${report.totalMTRFollowUps} migrated (${((report.migratedMTRFollowUps / report.totalMTRFollowUps) * 100).toFixed(1)}%)`);
  console.log(`  - Appointments: ${report.migratedAppointments} created from migration`);
  console.log(`  - Patients: ${report.patientsWithPreferences}/${report.totalPatients} with preferences (${((report.patientsWithPreferences / report.totalPatients) * 100).toFixed(1)}%)`);
  console.log(`  - Visits: ${report.visitsWithAppointmentId}/${report.totalVisits} with appointmentId (${((report.visitsWithAppointmentId / report.totalVisits) * 100).toFixed(1)}%)`);
  
  console.log(`\nData Integrity:`);
  console.log(`  - Bidirectional links: ${report.bidirectionalLinksValid ? '✅ Valid' : '❌ Issues found'}`);
  console.log(`  - Data consistency: ${report.dataConsistencyValid ? '✅ Valid' : '❌ Issues found'}`);
  console.log(`  - Indexes created: ${report.indexesCreated ? '✅ Yes' : '❌ No'}`);
  
  console.log(`\nQuery Performance (ms):`);
  console.log(`  - Appointments by workplace: ${report.queryPerformance.appointmentsByWorkplace}`);
  console.log(`  - Appointments by patient: ${report.queryPerformance.appointmentsByPatient}`);
  console.log(`  - Appointments by date: ${report.queryPerformance.appointmentsByDate}`);
  console.log(`  - Follow-ups by status: ${report.queryPerformance.followUpsByStatus >= 0 ? report.queryPerformance.followUpsByStatus : 'N/A'}`);
  
  if (report.issues.length > 0) {
    console.log(`\nIssues Found (${report.issues.length}):`);
    const errorIssues = report.issues.filter(issue => issue.severity === 'error');
    const warningIssues = report.issues.filter(issue => issue.severity === 'warning');
    
    if (errorIssues.length > 0) {
      console.log(`  ❌ Errors (${errorIssues.length}):`);
      errorIssues.forEach((issue, index) => {
        console.log(`    ${index + 1}. ${issue.description}`);
      });
    }
    
    if (warningIssues.length > 0) {
      console.log(`  ⚠️  Warnings (${warningIssues.length}):`);
      warningIssues.forEach((issue, index) => {
        console.log(`    ${index + 1}. ${issue.description}`);
      });
    }
  }
  
  console.log(`\nRecommendations (${report.recommendations.length}):`);
  report.recommendations.forEach((recommendation, index) => {
    console.log(`  ${index + 1}. ${recommendation}`);
  });
  
  console.log(`\n🎯 Migration Status: ${report.migrationStatus.toUpperCase()}`);
  console.log(`🚀 Ready for Production: ${report.readyForProduction ? '✅ YES' : '❌ NO'}`);
}

/**
 * Main verification function
 */
async function runVerification(): Promise<void> {
  try {
    console.log('🔍 Starting Patient Engagement Migration Verification');
    console.log('===================================================\n');
    
    await connectDatabase();
    await loadModels();
    
    // Generate verification report
    const report = await generateVerificationReport();
    
    // Save report to file
    const reportPath = await saveReportToFile(report);
    console.log(`\n💾 Report saved to: ${reportPath}`);
    
    // Print summary
    printReportSummary(report);
    
    console.log('\n✅ Verification completed successfully!');
    
  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  runVerification()
    .then(() => {
      console.log('\n✅ Verification script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verification script failed:', error);
      process.exit(1);
    });
}

export { 
  runVerification,
  generateVerificationReport,
  verifyBidirectionalLinks,
  verifyDataConsistency,
  verifyIndexes
};