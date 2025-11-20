#!/usr/bin/env ts-node

/**
 * Patient Engagement Rollout Monitoring Script
 * 
 * This script monitors the health of the patient engagement rollout and can:
 * - Check error rates and performance metrics
 * - Send alerts if issues are detected
 * - Generate automated reports
 * - Suggest rollback if critical issues are found
 * 
 * This script is designed to be run periodically (e.g., every hour) during rollout.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PatientEngagementRolloutService, { RolloutStatus } from '../services/PatientEngagementRolloutService';
import connectDB from '../config/db';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

interface MonitoringAlert {
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  metrics?: Record<string, any>;
  recommendedAction?: string;
}

interface MonitoringReport {
  timestamp: Date;
  rolloutStatus: RolloutStatus;
  healthScore: number; // 0-100
  alerts: MonitoringAlert[];
  recommendations: string[];
  shouldPause: boolean;
  pauseReason?: string;
}

/**
 * Calculate overall health score based on metrics
 */
function calculateHealthScore(status: RolloutStatus): number {
  let score = 100;

  // Deduct points for high error rate
  if (status.metrics.errorRate > 5) {
    score -= 30;
  } else if (status.metrics.errorRate > 2) {
    score -= 15;
  } else if (status.metrics.errorRate > 1) {
    score -= 5;
  }

  // Deduct points for low adoption rate
  if (status.metrics.adoptionRate < 30) {
    score -= 25;
  } else if (status.metrics.adoptionRate < 50) {
    score -= 15;
  } else if (status.metrics.adoptionRate < 70) {
    score -= 5;
  }

  // Deduct points for critical issues
  const criticalIssues = status.issues.filter(i => i.severity === 'critical' && !i.resolved);
  score -= criticalIssues.length * 20;

  // Deduct points for high severity issues
  const highIssues = status.issues.filter(i => i.severity === 'high' && !i.resolved);
  score -= highIssues.length * 10;

  // Bonus points for good performance
  if (status.metrics.adoptionRate > 80 && status.metrics.errorRate < 0.5) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Generate monitoring alerts based on current status
 */
function generateAlerts(status: RolloutStatus): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];
  const now = new Date();

  // Error rate alerts
  if (status.metrics.errorRate > 10) {
    alerts.push({
      severity: 'critical',
      title: 'Critical Error Rate',
      message: `Error rate is ${status.metrics.errorRate}%, which is critically high`,
      timestamp: now,
      metrics: { errorRate: status.metrics.errorRate },
      recommendedAction: 'Immediately pause rollout and investigate'
    });
  } else if (status.metrics.errorRate > 5) {
    alerts.push({
      severity: 'error',
      title: 'High Error Rate',
      message: `Error rate is ${status.metrics.errorRate}%, which exceeds acceptable threshold`,
      timestamp: now,
      metrics: { errorRate: status.metrics.errorRate },
      recommendedAction: 'Consider pausing rollout and investigating issues'
    });
  } else if (status.metrics.errorRate > 2) {
    alerts.push({
      severity: 'warning',
      title: 'Elevated Error Rate',
      message: `Error rate is ${status.metrics.errorRate}%, monitor closely`,
      timestamp: now,
      metrics: { errorRate: status.metrics.errorRate },
      recommendedAction: 'Monitor for 2-4 hours before proceeding'
    });
  }

  // Adoption rate alerts
  if (status.metrics.adoptionRate < 20 && status.currentPercentage > 25) {
    alerts.push({
      severity: 'error',
      title: 'Very Low Adoption Rate',
      message: `Adoption rate is only ${status.metrics.adoptionRate.toFixed(1)}% despite ${status.currentPercentage}% rollout`,
      timestamp: now,
      metrics: { adoptionRate: status.metrics.adoptionRate, rolloutPercentage: status.currentPercentage },
      recommendedAction: 'Investigate user experience issues and provide additional training'
    });
  } else if (status.metrics.adoptionRate < 40 && status.currentPercentage > 50) {
    alerts.push({
      severity: 'warning',
      title: 'Low Adoption Rate',
      message: `Adoption rate is ${status.metrics.adoptionRate.toFixed(1)}%, which is below expected levels`,
      timestamp: now,
      metrics: { adoptionRate: status.metrics.adoptionRate },
      recommendedAction: 'Consider user feedback collection and feature improvements'
    });
  }

  // Usage metrics alerts
  if (status.metrics.usageMetrics.dailyActiveUsers < status.metrics.activeUsers * 0.2) {
    alerts.push({
      severity: 'warning',
      title: 'Low Daily Usage',
      message: 'Daily active users are significantly lower than expected',
      timestamp: now,
      metrics: { 
        dailyActiveUsers: status.metrics.usageMetrics.dailyActiveUsers,
        expectedMinimum: Math.floor(status.metrics.activeUsers * 0.2)
      },
      recommendedAction: 'Investigate user engagement and feature discoverability'
    });
  }

  // Critical issues from system
  const unresolvedCritical = status.issues.filter(i => i.severity === 'critical' && !i.resolved);
  if (unresolvedCritical.length > 0) {
    alerts.push({
      severity: 'critical',
      title: 'Unresolved Critical Issues',
      message: `${unresolvedCritical.length} critical issues remain unresolved`,
      timestamp: now,
      metrics: { criticalIssueCount: unresolvedCritical.length },
      recommendedAction: 'Resolve critical issues before continuing rollout'
    });
  }

  // Positive alerts
  if (status.metrics.errorRate < 0.5 && status.metrics.adoptionRate > 80) {
    alerts.push({
      severity: 'info',
      title: 'Excellent Performance',
      message: `Rollout performing excellently with ${status.metrics.adoptionRate.toFixed(1)}% adoption and ${status.metrics.errorRate}% error rate`,
      timestamp: now,
      metrics: { adoptionRate: status.metrics.adoptionRate, errorRate: status.metrics.errorRate },
      recommendedAction: 'Consider accelerating rollout schedule'
    });
  }

  return alerts;
}

/**
 * Generate monitoring recommendations
 */
function generateRecommendations(status: RolloutStatus, alerts: MonitoringAlert[]): string[] {
  const recommendations: string[] = [];

  // Critical recommendations
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  if (criticalAlerts.length > 0) {
    recommendations.push('🚨 URGENT: Address critical issues immediately');
    recommendations.push('⏸️ Consider pausing rollout until issues are resolved');
  }

  // Error-based recommendations
  const errorAlerts = alerts.filter(a => a.severity === 'error');
  if (errorAlerts.length > 0) {
    recommendations.push('🔧 Investigate and resolve high-priority issues');
    recommendations.push('📊 Increase monitoring frequency to every 30 minutes');
  }

  // Performance recommendations
  if (status.metrics.errorRate > 2) {
    recommendations.push('🔍 Review application logs for error patterns');
    recommendations.push('📞 Contact affected workspaces for feedback');
  }

  if (status.metrics.adoptionRate < 50) {
    recommendations.push('📚 Provide additional user training and documentation');
    recommendations.push('💬 Collect user feedback to identify barriers');
  }

  // Positive recommendations
  if (status.metrics.errorRate < 1 && status.metrics.adoptionRate > 70) {
    recommendations.push('✅ Metrics are healthy - consider proceeding to next phase');
    recommendations.push('📈 Document successful practices for future rollouts');
  }

  // General recommendations
  if (status.currentPercentage > 0 && status.currentPercentage < 100) {
    recommendations.push('⏰ Continue monitoring for at least 24 hours before next phase');
    recommendations.push('📋 Prepare rollback plan in case issues arise');
  }

  return recommendations;
}

/**
 * Perform comprehensive monitoring check
 */
async function performMonitoringCheck(): Promise<MonitoringReport> {
  try {
    logger.info('Starting rollout monitoring check');

    // Get current rollout status
    const rolloutStatus = await PatientEngagementRolloutService.getRolloutStatus();

    // Calculate health score
    const healthScore = calculateHealthScore(rolloutStatus);

    // Generate alerts
    const alerts = generateAlerts(rolloutStatus);

    // Generate recommendations
    const recommendations = generateRecommendations(rolloutStatus, alerts);

    // Check if rollout should be paused
    const pauseCheck = await PatientEngagementRolloutService.shouldPauseRollout();

    const report: MonitoringReport = {
      timestamp: new Date(),
      rolloutStatus,
      healthScore,
      alerts,
      recommendations,
      shouldPause: pauseCheck.shouldPause,
      pauseReason: pauseCheck.reason
    };

    logger.info('Monitoring check completed', {
      healthScore,
      alertCount: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
      shouldPause: pauseCheck.shouldPause
    });

    return report;
  } catch (error) {
    logger.error('Error performing monitoring check:', error);
    throw error;
  }
}

/**
 * Display monitoring report
 */
function displayMonitoringReport(report: MonitoringReport): void {
  const status = report.rolloutStatus;
  
  console.log('\n🔍 Patient Engagement Rollout Monitoring Report');
  console.log('===============================================');
  console.log(`Timestamp: ${report.timestamp.toISOString()}`);
  console.log(`Health Score: ${report.healthScore}/100`);
  
  // Health score indicator
  let healthIndicator = '🔴';
  if (report.healthScore >= 80) healthIndicator = '🟢';
  else if (report.healthScore >= 60) healthIndicator = '🟡';
  else if (report.healthScore >= 40) healthIndicator = '🟠';
  
  console.log(`Health Status: ${healthIndicator} ${getHealthDescription(report.healthScore)}`);
  
  console.log('\n📊 Current Metrics:');
  console.log(`- Rollout Percentage: ${status.currentPercentage}%`);
  console.log(`- Enabled Workspaces: ${status.metrics.enabledWorkspaces}/${status.metrics.totalEligibleWorkspaces}`);
  console.log(`- Active Users: ${status.metrics.activeUsers}/${status.metrics.totalUsers}`);
  console.log(`- Adoption Rate: ${status.metrics.adoptionRate.toFixed(1)}%`);
  console.log(`- Error Rate: ${status.metrics.errorRate}%`);
  console.log(`- Daily Active Users: ${status.metrics.usageMetrics.dailyActiveUsers}`);

  // Display alerts
  if (report.alerts.length > 0) {
    console.log('\n🚨 Alerts:');
    report.alerts.forEach((alert, index) => {
      const icon = alert.severity === 'critical' ? '🔴' : 
                  alert.severity === 'error' ? '🟠' : 
                  alert.severity === 'warning' ? '🟡' : '🔵';
      console.log(`  ${icon} [${alert.severity.toUpperCase()}] ${alert.title}`);
      console.log(`     ${alert.message}`);
      if (alert.recommendedAction) {
        console.log(`     Action: ${alert.recommendedAction}`);
      }
    });
  } else {
    console.log('\n✅ No alerts - system is healthy');
  }

  // Display pause recommendation
  if (report.shouldPause) {
    console.log(`\n⚠️  PAUSE RECOMMENDATION`);
    console.log(`Reason: ${report.pauseReason}`);
    console.log(`Consider pausing the rollout until issues are resolved.`);
  }

  // Display recommendations
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => console.log(`  ${rec}`));
  }

  console.log('\n');
}

/**
 * Get health description based on score
 */
function getHealthDescription(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Fair';
  if (score >= 60) return 'Poor';
  if (score >= 40) return 'Critical';
  return 'Emergency';
}

/**
 * Send alerts (placeholder for actual alerting system)
 */
async function sendAlerts(alerts: MonitoringAlert[]): Promise<void> {
  try {
    const criticalAlerts = alerts.filter(a => a.severity === 'critical');
    const errorAlerts = alerts.filter(a => a.severity === 'error');

    if (criticalAlerts.length > 0) {
      logger.error('Critical alerts detected in rollout monitoring', {
        alertCount: criticalAlerts.length,
        alerts: criticalAlerts
      });
      
      // In production, this would send notifications via:
      // - Email to administrators
      // - Slack/Teams notifications
      // - SMS for critical issues
      // - PagerDuty/OpsGenie alerts
      console.log(`🚨 ${criticalAlerts.length} critical alerts would be sent to administrators`);
    }

    if (errorAlerts.length > 0) {
      logger.warn('Error alerts detected in rollout monitoring', {
        alertCount: errorAlerts.length,
        alerts: errorAlerts
      });
      
      console.log(`⚠️ ${errorAlerts.length} error alerts would be sent to monitoring team`);
    }
  } catch (error) {
    logger.error('Error sending alerts:', error);
  }
}

/**
 * Main monitoring function
 */
async function main(): Promise<void> {
  try {
    // Connect to database
    await connectDB();
    logger.info('Connected to database for monitoring');

    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'check';

    switch (command) {
      case 'check':
        const report = await performMonitoringCheck();
        displayMonitoringReport(report);
        
        // Send alerts if any critical/error alerts exist
        await sendAlerts(report.alerts);
        
        // Exit with error code if critical issues exist
        const criticalAlerts = report.alerts.filter(a => a.severity === 'critical');
        if (criticalAlerts.length > 0) {
          process.exit(1);
        }
        break;

      case 'health':
        const healthReport = await performMonitoringCheck();
        console.log(`Health Score: ${healthReport.healthScore}/100`);
        console.log(`Status: ${getHealthDescription(healthReport.healthScore)}`);
        break;

      case 'alerts':
        const alertReport = await performMonitoringCheck();
        if (alertReport.alerts.length === 0) {
          console.log('No alerts');
        } else {
          alertReport.alerts.forEach(alert => {
            console.log(`[${alert.severity.toUpperCase()}] ${alert.title}: ${alert.message}`);
          });
        }
        break;

      default:
        console.log('\n🔍 Patient Engagement Rollout Monitoring');
        console.log('========================================');
        console.log('Usage: npm run monitor-rollout [command]');
        console.log('\nCommands:');
        console.log('  check   - Perform full monitoring check (default)');
        console.log('  health  - Show health score only');
        console.log('  alerts  - Show alerts only');
        console.log('\nExamples:');
        console.log('  npm run monitor-rollout');
        console.log('  npm run monitor-rollout check');
        console.log('  npm run monitor-rollout health');
        console.log('  npm run monitor-rollout alerts\n');
        break;
    }

    process.exit(0);
  } catch (error) {
    logger.error('Monitoring failed:', error);
    console.error('\n❌ Monitoring Error:', error.message);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { 
  performMonitoringCheck, 
  displayMonitoringReport, 
  calculateHealthScore,
  generateAlerts,
  generateRecommendations
};