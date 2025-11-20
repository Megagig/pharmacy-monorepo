#!/usr/bin/env ts-node

/**
 * Post-Launch Monitoring Script
 * 
 * Comprehensive monitoring script for the Patient Engagement & Follow-up Management module.
 * Tracks system health, user adoption, performance metrics, and generates reports.
 * 
 * Usage:
 *   npm run post-launch:monitor [command] [options]
 * 
 * Commands:
 *   health      - Check system health
 *   metrics     - Show success metrics
 *   feedback    - Show user feedback summary
 *   report      - Generate comprehensive report
 *   alerts      - Check for system alerts
 *   phase2      - Plan Phase 2 enhancements
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PostLaunchMonitoringService from '../services/PostLaunchMonitoringService';
import PatientEngagementRolloutService from '../services/PatientEngagementRolloutService';
import connectDB from '../config/db';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

interface MonitoringOptions {
  format?: 'text' | 'json';
  verbose?: boolean;
  output?: string;
  email?: string;
}

/**
 * Display system health metrics
 */
async function displaySystemHealth(options: MonitoringOptions = {}): Promise<void> {
  try {
    console.log('\n🏥 System Health Check');
    console.log('====================');

    const metrics = await PostLaunchMonitoringService.getSystemHealthMetrics();

    if (options.format === 'json') {
      console.log(JSON.stringify(metrics, null, 2));
      return;
    }

    // Health status with emoji
    const healthEmoji = {
      'healthy': '🟢',
      'warning': '🟡',
      'critical': '🟠',
      'emergency': '🔴'
    };

    console.log(`Overall Health: ${healthEmoji[metrics.overallHealth]} ${metrics.overallHealth.toUpperCase()}`);
    console.log(`Health Score: ${metrics.healthScore}/100`);
    console.log(`Timestamp: ${metrics.timestamp.toISOString()}`);

    console.log('\n📊 Performance Metrics:');
    console.log(`  API Response Time: ${metrics.performance.apiResponseTime.toFixed(1)}ms`);
    console.log(`  Database Response: ${metrics.performance.databaseResponseTime.toFixed(1)}ms`);
    console.log(`  Memory Usage: ${metrics.performance.memoryUsage.toFixed(1)}%`);
    console.log(`  CPU Usage: ${metrics.performance.cpuUsage.toFixed(1)}%`);
    console.log(`  Disk Usage: ${metrics.performance.diskUsage.toFixed(1)}%`);
    console.log(`  Error Rate: ${metrics.performance.errorRate}%`);

    console.log('\n👥 Adoption Metrics:');
    console.log(`  Active Workspaces: ${metrics.adoption.totalActiveWorkspaces}`);
    console.log(`  Daily Active Users: ${metrics.adoption.dailyActiveUsers}`);
    console.log(`  Weekly Active Users: ${metrics.adoption.weeklyActiveUsers}`);
    console.log(`  Appointments Today: ${metrics.adoption.appointmentsCreatedToday}`);
    console.log(`  Follow-ups Today: ${metrics.adoption.followUpsCompletedToday}`);
    console.log(`  Reminders Today: ${metrics.adoption.remindersDeliveredToday}`);
    console.log(`  Patient Portal Usage: ${metrics.adoption.patientPortalUsage}`);

    console.log('\n⭐ Quality Metrics:');
    console.log(`  Appointment Completion: ${metrics.quality.appointmentCompletionRate.toFixed(1)}%`);
    console.log(`  Follow-up Completion: ${metrics.quality.followUpCompletionRate.toFixed(1)}%`);
    console.log(`  Reminder Success Rate: ${metrics.quality.reminderDeliverySuccessRate.toFixed(1)}%`);
    console.log(`  No-Show Rate: ${metrics.quality.noShowRate.toFixed(1)}%`);
    console.log(`  User Satisfaction: ${metrics.quality.userSatisfactionScore.toFixed(1)}/5.0`);

    console.log('\n🔧 System Stability:');
    console.log(`  Uptime: ${metrics.stability.uptime.toFixed(1)} hours`);
    console.log(`  Crash Count: ${metrics.stability.crashCount}`);
    console.log(`  Critical Errors: ${metrics.stability.criticalErrorCount}`);
    console.log(`  Warnings: ${metrics.stability.warningCount}`);
    if (metrics.stability.lastIncidentDate) {
      console.log(`  Last Incident: ${metrics.stability.lastIncidentDate.toISOString()}`);
    }

    console.log('\n');
  } catch (error) {
    logger.error('Error displaying system health:', error);
    console.error('❌ Failed to get system health metrics');
    process.exit(1);
  }
}

/**
 * Display success metrics and KPIs
 */
async function displaySuccessMetrics(options: MonitoringOptions = {}): Promise<void> {
  try {
    console.log('\n📈 Success Metrics & KPIs');
    console.log('========================');

    const metrics = await PostLaunchMonitoringService.getSuccessMetrics();

    if (options.format === 'json') {
      console.log(JSON.stringify(metrics, null, 2));
      return;
    }

    console.log('\n🎯 Business Metrics:');
    console.log(`  Patient Engagement Increase: ${metrics.patientEngagementIncrease}%`);
    console.log(`  Appointment Scheduling Adoption: ${metrics.appointmentSchedulingAdoption}%`);
    console.log(`  Follow-up Completion Improvement: ${metrics.followUpCompletionImprovement}%`);
    console.log(`  Medication Adherence Improvement: ${metrics.medicationAdherenceImprovement}%`);

    console.log('\n⚡ Operational Metrics:');
    console.log(`  Pharmacist Efficiency Gain: ${metrics.pharmacistEfficiencyGain}%`);
    console.log(`  Manual Tracking Reduction: ${metrics.manualTrackingReduction}%`);
    console.log(`  Patient Satisfaction Increase: ${metrics.patientSatisfactionIncrease}%`);

    console.log('\n🔧 Technical Metrics:');
    console.log(`  System Reliability: ${metrics.systemReliability}%`);
    console.log(`  Performance Improvement: ${metrics.performanceImprovement}%`);
    console.log(`  Error Reduction: ${metrics.errorReduction}%`);

    console.log('\n💰 ROI Metrics:');
    console.log(`  Time Saved: ${metrics.timesSaved} hours/week`);
    console.log(`  Cost Reduction: $${metrics.costReduction.toLocaleString()}/month`);
    console.log(`  Revenue Increase: $${metrics.revenueIncrease.toLocaleString()}/month`);

    // Calculate ROI
    const monthlySavings = (metrics.timesSaved * 4 * 25) + metrics.costReduction; // Assume $25/hour
    const roi = ((monthlySavings + metrics.revenueIncrease) / 50000) * 100; // Assume $50k implementation cost
    console.log(`  Estimated ROI: ${roi.toFixed(1)}% annually`);

    console.log('\n');
  } catch (error) {
    logger.error('Error displaying success metrics:', error);
    console.error('❌ Failed to get success metrics');
    process.exit(1);
  }
}

/**
 * Display user feedback summary
 */
async function displayFeedbackSummary(options: MonitoringOptions = {}): Promise<void> {
  try {
    console.log('\n💬 User Feedback Summary');
    console.log('=======================');

    const feedback = await PostLaunchMonitoringService.getUserFeedbackSummary();

    if (options.format === 'json') {
      console.log(JSON.stringify(feedback, null, 2));
      return;
    }

    console.log(`Total Feedback Items: ${feedback.total}`);

    console.log('\n📊 By Category:');
    Object.entries(feedback.byCategory).forEach(([category, count]) => {
      const percentage = ((count / feedback.total) * 100).toFixed(1);
      console.log(`  ${category.replace('_', ' ')}: ${count} (${percentage}%)`);
    });

    console.log('\n🚨 By Severity:');
    Object.entries(feedback.bySeverity).forEach(([severity, count]) => {
      const emoji = severity === 'critical' ? '🔴' : severity === 'high' ? '🟠' : severity === 'medium' ? '🟡' : '🟢';
      const percentage = ((count / feedback.total) * 100).toFixed(1);
      console.log(`  ${emoji} ${severity}: ${count} (${percentage}%)`);
    });

    console.log('\n📋 By Status:');
    Object.entries(feedback.byStatus).forEach(([status, count]) => {
      const percentage = ((count / feedback.total) * 100).toFixed(1);
      console.log(`  ${status.replace('_', ' ')}: ${count} (${percentage}%)`);
    });

    console.log('\n🎯 By Feature Area:');
    Object.entries(feedback.byFeatureArea).forEach(([area, count]) => {
      const percentage = ((count / feedback.total) * 100).toFixed(1);
      console.log(`  ${area.replace('_', ' ')}: ${count} (${percentage}%)`);
    });

    console.log('\n⭐ Average Ratings:');
    console.log(`  Satisfaction: ${feedback.averageRatings.satisfaction.toFixed(1)}/5.0`);
    console.log(`  Usability: ${feedback.averageRatings.usability.toFixed(1)}/5.0`);
    console.log(`  Performance: ${feedback.averageRatings.performance.toFixed(1)}/5.0`);

    console.log('\n📈 Trends:');
    console.log(`  This Week: ${feedback.trends.thisWeek} items`);
    console.log(`  Last Week: ${feedback.trends.lastWeek} items`);
    const trendEmoji = feedback.trends.change < 0 ? '📉' : '📈';
    console.log(`  Change: ${trendEmoji} ${feedback.trends.change.toFixed(1)}%`);

    console.log('\n');
  } catch (error) {
    logger.error('Error displaying feedback summary:', error);
    console.error('❌ Failed to get feedback summary');
    process.exit(1);
  }
}

/**
 * Generate and display comprehensive report
 */
async function generateReport(options: MonitoringOptions = {}): Promise<void> {
  try {
    console.log('\n📋 Comprehensive Monitoring Report');
    console.log('=================================');

    const report = await PostLaunchMonitoringService.generateMonitoringReport();

    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(`Report Date: ${report.summary.reportDate.toISOString()}`);
    console.log(`Overall Status: ${report.summary.overallStatus}`);

    if (report.summary.keyHighlights.length > 0) {
      console.log('\n✨ Key Highlights:');
      report.summary.keyHighlights.forEach(highlight => {
        console.log(`  ✅ ${highlight}`);
      });
    }

    if (report.summary.criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      report.summary.criticalIssues.forEach(issue => {
        console.log(`  ❌ ${issue}`);
      });
    }

    if (report.summary.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.summary.recommendations.forEach(rec => {
        console.log(`  📌 ${rec}`);
      });
    }

    console.log('\n📊 Quick Stats:');
    console.log(`  Health Score: ${report.metrics.healthScore}/100`);
    console.log(`  Active Workspaces: ${report.rollout.metrics.enabledWorkspaces}/${report.rollout.metrics.totalEligibleWorkspaces}`);
    console.log(`  Rollout Progress: ${report.rollout.currentPercentage}%`);
    console.log(`  User Satisfaction: ${report.feedback.averageRatings.satisfaction.toFixed(1)}/5.0`);
    console.log(`  Error Rate: ${report.metrics.performance.errorRate}%`);

    if (options.verbose) {
      console.log('\n--- Detailed Metrics ---');
      await displaySystemHealth({ format: options.format });
      await displaySuccessMetrics({ format: options.format });
      await displayFeedbackSummary({ format: options.format });
    }

    console.log('\n');
  } catch (error) {
    logger.error('Error generating report:', error);
    console.error('❌ Failed to generate monitoring report');
    process.exit(1);
  }
}

/**
 * Check and display system alerts
 */
async function checkAlerts(options: MonitoringOptions = {}): Promise<void> {
  try {
    console.log('\n🚨 System Alerts Check');
    console.log('=====================');

    const alertsResult = await PostLaunchMonitoringService.checkSystemAlerts();

    if (options.format === 'json') {
      console.log(JSON.stringify(alertsResult, null, 2));
      return;
    }

    if (!alertsResult.hasAlerts) {
      console.log('✅ No alerts - system is healthy');
      console.log('');
      return;
    }

    console.log(`Found ${alertsResult.alerts.length} alerts:\n`);

    alertsResult.alerts.forEach((alert, index) => {
      const severityEmoji = {
        'critical': '🔴',
        'error': '🟠',
        'warning': '🟡',
        'info': '🔵'
      };

      console.log(`${index + 1}. ${severityEmoji[alert.severity]} [${alert.severity.toUpperCase()}] ${alert.title}`);
      console.log(`   ${alert.message}`);
      console.log(`   Time: ${alert.timestamp.toISOString()}`);
      
      if (alert.actionRequired) {
        console.log(`   Action: ${alert.actionRequired}`);
      }
      console.log('');
    });

    // Exit with error code if critical alerts exist
    const criticalAlerts = alertsResult.alerts.filter(a => a.severity === 'critical');
    if (criticalAlerts.length > 0) {
      console.log(`⚠️  ${criticalAlerts.length} critical alerts require immediate attention!`);
      process.exit(1);
    }
  } catch (error) {
    logger.error('Error checking alerts:', error);
    console.error('❌ Failed to check system alerts');
    process.exit(1);
  }
}

/**
 * Display Phase 2 enhancement plan
 */
async function displayPhase2Plan(options: MonitoringOptions = {}): Promise<void> {
  try {
    console.log('\n🚀 Phase 2 Enhancement Plan');
    console.log('===========================');

    const plan = await PostLaunchMonitoringService.planPhase2Enhancements();

    if (options.format === 'json') {
      console.log(JSON.stringify(plan, null, 2));
      return;
    }

    console.log('\n🎯 Prioritized Features:');
    plan.prioritizedFeatures.forEach((feature, index) => {
      const priorityEmoji = feature.priority === 'high' ? '🔴' : feature.priority === 'medium' ? '🟡' : '🟢';
      const effortEmoji = feature.effort === 'large' ? '🔴' : feature.effort === 'medium' ? '🟡' : '🟢';
      const impactEmoji = feature.impact === 'high' ? '🔴' : feature.impact === 'medium' ? '🟡' : '🟢';

      console.log(`\n${index + 1}. ${feature.feature}`);
      console.log(`   Priority: ${priorityEmoji} ${feature.priority} | Effort: ${effortEmoji} ${feature.effort} | Impact: ${impactEmoji} ${feature.impact}`);
      console.log(`   Description: ${feature.description}`);
      console.log(`   User Requests: ${feature.userRequests}`);
      console.log(`   Business Value: ${feature.businessValue}`);
    });

    console.log('\n⚡ Performance Improvements:');
    plan.performanceImprovements.forEach((improvement, index) => {
      console.log(`  ${index + 1}. ${improvement}`);
    });

    console.log('\n🎨 User Experience Enhancements:');
    plan.userExperienceEnhancements.forEach((enhancement, index) => {
      console.log(`  ${index + 1}. ${enhancement}`);
    });

    console.log('\n🔗 Integration Opportunities:');
    plan.integrationOpportunities.forEach((opportunity, index) => {
      console.log(`  ${index + 1}. ${opportunity}`);
    });

    console.log('\n');
  } catch (error) {
    logger.error('Error displaying Phase 2 plan:', error);
    console.error('❌ Failed to get Phase 2 enhancement plan');
    process.exit(1);
  }
}

/**
 * Save report to file
 */
async function saveReport(data: any, filename: string): Promise<void> {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const reportsDir = path.join(process.cwd(), 'reports');
    
    // Create reports directory if it doesn't exist
    try {
      await fs.access(reportsDir);
    } catch {
      await fs.mkdir(reportsDir, { recursive: true });
    }
    
    const filepath = path.join(reportsDir, filename);
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    
    console.log(`📄 Report saved to: ${filepath}`);
  } catch (error) {
    logger.error('Error saving report:', error);
    console.error('❌ Failed to save report to file');
  }
}

/**
 * Send report via email (placeholder)
 */
async function emailReport(data: any, email: string): Promise<void> {
  try {
    // In production, this would integrate with the notification service
    console.log(`📧 Report would be sent to: ${email}`);
    console.log('   (Email integration not implemented in this demo)');
  } catch (error) {
    logger.error('Error sending email report:', error);
    console.error('❌ Failed to send email report');
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  try {
    // Connect to database
    await connectDB();
    logger.info('Connected to database for post-launch monitoring');

    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'health';
    
    // Parse options
    const options: MonitoringOptions = {};
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--json') options.format = 'json';
      if (arg === '--verbose') options.verbose = true;
      if (arg === '--output') options.output = args[++i];
      if (arg === '--email') options.email = args[++i];
    }

    switch (command) {
      case 'health':
        await displaySystemHealth(options);
        break;

      case 'metrics':
        await displaySuccessMetrics(options);
        break;

      case 'feedback':
        await displayFeedbackSummary(options);
        break;

      case 'report':
        await generateReport(options);
        if (options.output) {
          const report = await PostLaunchMonitoringService.generateMonitoringReport();
          await saveReport(report, options.output);
        }
        if (options.email) {
          const report = await PostLaunchMonitoringService.generateMonitoringReport();
          await emailReport(report, options.email);
        }
        break;

      case 'alerts':
        await checkAlerts(options);
        break;

      case 'phase2':
        await displayPhase2Plan(options);
        break;

      default:
        console.log('\n🔍 Post-Launch Monitoring Tool');
        console.log('==============================');
        console.log('Usage: npm run post-launch:monitor [command] [options]');
        console.log('\nCommands:');
        console.log('  health      Check system health metrics');
        console.log('  metrics     Show success metrics and KPIs');
        console.log('  feedback    Show user feedback summary');
        console.log('  report      Generate comprehensive report');
        console.log('  alerts      Check for system alerts');
        console.log('  phase2      Show Phase 2 enhancement plan');
        console.log('\nOptions:');
        console.log('  --json      Output in JSON format');
        console.log('  --verbose   Show detailed information');
        console.log('  --output    Save report to file (report command only)');
        console.log('  --email     Email report (report command only)');
        console.log('\nExamples:');
        console.log('  npm run post-launch:monitor health');
        console.log('  npm run post-launch:monitor report --verbose');
        console.log('  npm run post-launch:monitor alerts --json');
        console.log('  npm run post-launch:monitor report --output daily-report.json');
        console.log('  npm run post-launch:monitor report --email admin@pharmacy.com\n');
        break;
    }

    process.exit(0);
  } catch (error) {
    logger.error('Post-launch monitoring failed:', error);
    console.error('\n❌ Monitoring Error:', error.message);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { 
  displaySystemHealth,
  displaySuccessMetrics,
  displayFeedbackSummary,
  generateReport,
  checkAlerts,
  displayPhase2Plan
};