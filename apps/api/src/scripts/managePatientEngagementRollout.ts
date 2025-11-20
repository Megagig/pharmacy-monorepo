#!/usr/bin/env ts-node

/**
 * Patient Engagement Rollout Management Script
 * 
 * This script manages the gradual rollout of patient engagement features.
 * It can be used to:
 * - Update rollout percentages
 * - Monitor rollout metrics
 * - Generate rollout reports
 * - Pause/resume rollout based on conditions
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import PatientEngagementRolloutService from '../services/PatientEngagementRolloutService';
import connectDB from '../config/db';
import logger from '../utils/logger';

// Load environment variables
dotenv.config();

interface RolloutPhase {
  week: number;
  percentage: number;
  description: string;
  monitoringPeriod: number; // hours
  errorThreshold: number; // percentage
}

const ROLLOUT_PHASES: RolloutPhase[] = [
  {
    week: 1,
    percentage: 10,
    description: 'Initial rollout to 10% of workspaces for early feedback',
    monitoringPeriod: 48,
    errorThreshold: 2
  },
  {
    week: 2,
    percentage: 25,
    description: 'Expand to 25% of workspaces after initial validation',
    monitoringPeriod: 24,
    errorThreshold: 3
  },
  {
    week: 3,
    percentage: 50,
    description: 'Scale to 50% of workspaces with proven stability',
    monitoringPeriod: 12,
    errorThreshold: 5
  },
  {
    week: 4,
    percentage: 100,
    description: 'Complete rollout to all eligible workspaces',
    monitoringPeriod: 6,
    errorThreshold: 5
  }
];

/**
 * Execute a specific rollout phase
 */
async function executeRolloutPhase(
  phase: RolloutPhase,
  updatedBy: string = 'system'
): Promise<void> {
  try {
    logger.info(`Executing rollout phase ${phase.week}`, {
      targetPercentage: phase.percentage,
      description: phase.description
    });

    // Check if rollout should be paused
    const pauseCheck = await PatientEngagementRolloutService.shouldPauseRollout(
      phase.errorThreshold
    );

    if (pauseCheck.shouldPause) {
      logger.warn('Rollout paused due to conditions', {
        reason: pauseCheck.reason,
        errorRate: pauseCheck.errorRate
      });
      
      console.log(`\n⚠️  ROLLOUT PAUSED`);
      console.log(`Reason: ${pauseCheck.reason}`);
      console.log(`Current error rate: ${pauseCheck.errorRate}%`);
      console.log(`Please investigate and resolve issues before continuing.\n`);
      return;
    }

    // Update rollout percentage
    await PatientEngagementRolloutService.updateRolloutPercentage(
      phase.percentage,
      updatedBy,
      {
        phaseDescription: phase.description,
        monitoringPeriod: phase.monitoringPeriod,
        rollbackThreshold: phase.errorThreshold
      }
    );

    // Generate and display report
    const report = await PatientEngagementRolloutService.generateRolloutReport();
    
    console.log(`\n✅ Rollout Phase ${phase.week} Completed Successfully`);
    console.log(`Target: ${phase.percentage}% of workspaces`);
    console.log(`Description: ${phase.description}`);
    console.log(`\n📊 Current Metrics:`);
    console.log(`- Enabled Workspaces: ${report.summary.metrics.enabledWorkspaces}/${report.summary.metrics.totalEligibleWorkspaces}`);
    console.log(`- Active Users: ${report.summary.metrics.activeUsers}`);
    console.log(`- Adoption Rate: ${report.summary.metrics.adoptionRate.toFixed(1)}%`);
    console.log(`- Error Rate: ${report.summary.metrics.errorRate}%`);
    
    if (report.recommendations.length > 0) {
      console.log(`\n💡 Recommendations:`);
      report.recommendations.forEach(rec => console.log(`  ${rec}`));
    }

    console.log(`\n⏰ Monitor for ${phase.monitoringPeriod} hours before next phase`);
    console.log(`🚨 Pause if error rate exceeds ${phase.errorThreshold}%\n`);

    logger.info(`Rollout phase ${phase.week} completed successfully`, {
      targetPercentage: phase.percentage,
      enabledWorkspaces: report.summary.metrics.enabledWorkspaces,
      activeUsers: report.summary.metrics.activeUsers,
      adoptionRate: report.summary.metrics.adoptionRate,
      errorRate: report.summary.metrics.errorRate
    });

  } catch (error) {
    logger.error(`Error executing rollout phase ${phase.week}:`, error);
    throw error;
  }
}

/**
 * Display current rollout status
 */
async function displayRolloutStatus(): Promise<void> {
  try {
    const report = await PatientEngagementRolloutService.generateRolloutReport();
    const status = report.summary;

    console.log('\n📈 Patient Engagement Rollout Status');
    console.log('=====================================');
    console.log(`Current Phase: ${status.phase.toUpperCase()}`);
    console.log(`Rollout Percentage: ${status.currentPercentage}%`);
    console.log(`Last Updated: ${status.lastUpdated.toISOString()}`);
    
    console.log('\n📊 Metrics:');
    console.log(`- Total Eligible Workspaces: ${status.metrics.totalEligibleWorkspaces}`);
    console.log(`- Enabled Workspaces: ${status.metrics.enabledWorkspaces}`);
    console.log(`- Total Users: ${status.metrics.totalUsers}`);
    console.log(`- Active Users: ${status.metrics.activeUsers}`);
    console.log(`- Adoption Rate: ${status.metrics.adoptionRate.toFixed(1)}%`);
    console.log(`- Error Rate: ${status.metrics.errorRate}%`);
    
    console.log('\n📈 Usage Metrics:');
    console.log(`- Daily Active Users: ${status.metrics.usageMetrics.dailyActiveUsers}`);
    console.log(`- Weekly Active Users: ${status.metrics.usageMetrics.weeklyActiveUsers}`);
    console.log(`- Appointments Created: ${status.metrics.usageMetrics.appointmentsCreated}`);
    console.log(`- Follow-ups Completed: ${status.metrics.usageMetrics.followUpsCompleted}`);

    if (status.issues.length > 0) {
      console.log('\n🚨 Recent Issues:');
      status.issues.forEach(issue => {
        const icon = issue.severity === 'critical' ? '🔴' : 
                    issue.severity === 'high' ? '🟠' : 
                    issue.severity === 'medium' ? '🟡' : '🟢';
        const resolvedText = issue.resolved ? '✅ RESOLVED' : '⏳ OPEN';
        console.log(`  ${icon} [${issue.severity.toUpperCase()}] ${issue.message} (${resolvedText})`);
      });
    }

    if (report.enabledWorkspaces.length > 0) {
      console.log('\n🏥 Enabled Workspaces (Top 10):');
      report.enabledWorkspaces.slice(0, 10).forEach((workspace, index) => {
        console.log(`  ${index + 1}. ${workspace.workspaceName} (${workspace.subscriptionTier}) - ${workspace.userCount} users`);
      });
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  ${rec}`));
    }

    console.log('\n');
  } catch (error) {
    logger.error('Error displaying rollout status:', error);
    throw error;
  }
}

/**
 * Pause rollout (set to 0%)
 */
async function pauseRollout(reason: string, updatedBy: string = 'system'): Promise<void> {
  try {
    logger.info('Pausing rollout', { reason, updatedBy });

    await PatientEngagementRolloutService.updateRolloutPercentage(0, updatedBy, {
      phaseDescription: `Rollout paused: ${reason}`
    });

    console.log(`\n⏸️  Rollout Paused`);
    console.log(`Reason: ${reason}`);
    console.log(`All patient engagement features are now disabled for new workspaces.`);
    console.log(`Existing enabled workspaces will continue to have access.\n`);

    logger.info('Rollout paused successfully', { reason });
  } catch (error) {
    logger.error('Error pausing rollout:', error);
    throw error;
  }
}

/**
 * Resume rollout to a specific percentage
 */
async function resumeRollout(percentage: number, updatedBy: string = 'system'): Promise<void> {
  try {
    logger.info('Resuming rollout', { percentage, updatedBy });

    await PatientEngagementRolloutService.updateRolloutPercentage(percentage, updatedBy, {
      phaseDescription: `Rollout resumed at ${percentage}%`
    });

    console.log(`\n▶️  Rollout Resumed`);
    console.log(`Target: ${percentage}% of workspaces`);
    console.log(`Patient engagement features are now enabled for the target percentage.\n`);

    logger.info('Rollout resumed successfully', { percentage });
  } catch (error) {
    logger.error('Error resuming rollout:', error);
    throw error;
  }
}

/**
 * Main CLI interface
 */
async function main(): Promise<void> {
  try {
    // Connect to database
    await connectDB();
    logger.info('Connected to database');

    // Parse command line arguments
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'status':
        await displayRolloutStatus();
        break;

      case 'phase':
        const phaseNumber = parseInt(args[1]);
        const updatedBy = args[2] || 'system';
        
        if (!phaseNumber || phaseNumber < 1 || phaseNumber > 4) {
          console.error('Usage: npm run rollout phase <1-4> [updatedBy]');
          process.exit(1);
        }

        const phase = ROLLOUT_PHASES[phaseNumber - 1];
        await executeRolloutPhase(phase, updatedBy);
        break;

      case 'set':
        const percentage = parseInt(args[1]);
        const setUpdatedBy = args[2] || 'system';
        
        if (isNaN(percentage) || percentage < 0 || percentage > 100) {
          console.error('Usage: npm run rollout set <0-100> [updatedBy]');
          process.exit(1);
        }

        await PatientEngagementRolloutService.updateRolloutPercentage(percentage, setUpdatedBy);
        console.log(`\n✅ Rollout updated to ${percentage}%\n`);
        break;

      case 'pause':
        const reason = args[1] || 'Manual pause';
        const pauseUpdatedBy = args[2] || 'system';
        await pauseRollout(reason, pauseUpdatedBy);
        break;

      case 'resume':
        const resumePercentage = parseInt(args[1]);
        const resumeUpdatedBy = args[2] || 'system';
        
        if (isNaN(resumePercentage) || resumePercentage < 0 || resumePercentage > 100) {
          console.error('Usage: npm run rollout resume <0-100> [updatedBy]');
          process.exit(1);
        }

        await resumeRollout(resumePercentage, resumeUpdatedBy);
        break;

      case 'report':
        const report = await PatientEngagementRolloutService.generateRolloutReport();
        console.log('\n📋 Detailed Rollout Report');
        console.log('==========================');
        console.log(JSON.stringify(report, null, 2));
        break;

      default:
        console.log('\n🚀 Patient Engagement Rollout Management');
        console.log('========================================');
        console.log('Usage: npm run rollout <command> [options]');
        console.log('\nCommands:');
        console.log('  status                    - Show current rollout status');
        console.log('  phase <1-4> [updatedBy]  - Execute rollout phase (1=10%, 2=25%, 3=50%, 4=100%)');
        console.log('  set <0-100> [updatedBy]  - Set rollout to specific percentage');
        console.log('  pause [reason] [updatedBy] - Pause rollout (set to 0%)');
        console.log('  resume <0-100> [updatedBy] - Resume rollout at percentage');
        console.log('  report                   - Generate detailed rollout report');
        console.log('\nExamples:');
        console.log('  npm run rollout status');
        console.log('  npm run rollout phase 1 admin@pharmacy.com');
        console.log('  npm run rollout set 25 admin@pharmacy.com');
        console.log('  npm run rollout pause "High error rate" admin@pharmacy.com');
        console.log('  npm run rollout resume 15 admin@pharmacy.com\n');
        break;
    }

    process.exit(0);
  } catch (error) {
    logger.error('Rollout management failed:', error);
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script if called directly
if (require.main === module) {
  main();
}

export { 
  executeRolloutPhase, 
  displayRolloutStatus, 
  pauseRollout, 
  resumeRollout,
  ROLLOUT_PHASES 
};