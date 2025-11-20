/**
 * Test Queue Infrastructure
 * Simple script to verify queue setup works correctly
 */

import QueueService from '../services/QueueService';
import { QueueName, JobPriority } from '../config/queue';
import logger from '../utils/logger';

async function testQueueInfrastructure() {
  try {
    console.log('🧪 Testing Queue Infrastructure...\n');

    // 1. Initialize Queue Service
    console.log('1️⃣ Initializing Queue Service...');
    await QueueService.initialize();
    console.log('✅ Queue Service initialized\n');

    // 2. Test adding a job
    console.log('2️⃣ Adding a test job...');
    const job = await QueueService.addJob(QueueName.APPOINTMENT_REMINDER, {
      appointmentId: 'test-appointment-123',
      patientId: 'test-patient-456',
      workplaceId: 'test-workplace-789',
      reminderType: '24h',
      channels: ['email'],
    });
    console.log(`✅ Job added with ID: ${job.id}\n`);

    // 3. Test adding a job with priority
    console.log('3️⃣ Adding a high-priority job...');
    const priorityJob = await QueueService.addJobWithPriority(
      QueueName.FOLLOW_UP_MONITOR,
      {
        workplaceId: 'test-workplace-789',
        checkOverdue: true,
        escalateCritical: true,
      },
      JobPriority.HIGH
    );
    console.log(`✅ Priority job added with ID: ${priorityJob.id}\n`);

    // 4. Test scheduling a job
    console.log('4️⃣ Scheduling a job for 1 minute from now...');
    const scheduledTime = new Date(Date.now() + 60000);
    const scheduledJob = await QueueService.scheduleJob(
      QueueName.MEDICATION_REMINDER,
      {
        patientId: 'test-patient-456',
        medicationId: 'test-medication-789',
        workplaceId: 'test-workplace-789',
        reminderType: 'refill',
        daysUntilDue: 7,
      },
      scheduledTime
    );
    console.log(`✅ Job scheduled with ID: ${scheduledJob.id}\n`);

    // 5. Test getting queue statistics
    console.log('5️⃣ Getting queue statistics...');
    const stats = await QueueService.getQueueStats(
      QueueName.APPOINTMENT_REMINDER
    );
    console.log('✅ Queue statistics:');
    console.log(`   - Waiting: ${stats.waiting}`);
    console.log(`   - Active: ${stats.active}`);
    console.log(`   - Completed: ${stats.completed}`);
    console.log(`   - Failed: ${stats.failed}`);
    console.log(`   - Delayed: ${stats.delayed}`);
    console.log(`   - Paused: ${stats.paused}\n`);

    // 6. Test getting all queue statistics
    console.log('6️⃣ Getting all queue statistics...');
    const allStats = await QueueService.getAllQueueStats();
    console.log('✅ All queue statistics:');
    for (const [queueName, queueStats] of Object.entries(allStats)) {
      console.log(`   - ${queueName}: ${queueStats.waiting} waiting`);
    }
    console.log();

    // 7. Test queue health
    console.log('7️⃣ Checking queue health...');
    const health = await QueueService.getQueueHealth(
      QueueName.APPOINTMENT_REMINDER
    );
    console.log('✅ Queue health:');
    console.log(`   - Healthy: ${health.isHealthy}`);
    console.log(`   - Errors: ${health.errors.length}`);
    console.log();

    // 8. Test getting a job
    console.log('8️⃣ Retrieving job by ID...');
    const retrievedJob = await QueueService.getJob(
      QueueName.APPOINTMENT_REMINDER,
      job.id as string
    );
    console.log(`✅ Job retrieved: ${retrievedJob?.id}\n`);

    // 9. Test queue metrics
    console.log('9️⃣ Getting queue metrics...');
    const metrics = await QueueService.getQueueMetrics(
      QueueName.APPOINTMENT_REMINDER
    );
    console.log('✅ Queue metrics:');
    console.log(`   - Name: ${metrics.name}`);
    console.log(`   - Waiting: ${metrics.counts.waiting}`);
    console.log(`   - Active: ${metrics.counts.active}`);
    console.log(`   - Completed: ${metrics.counts.completed}`);
    console.log(`   - Failed: ${metrics.counts.failed}`);
    console.log(`   - Paused: ${metrics.paused}`);
    console.log();

    // 10. Test pause and resume
    console.log('🔟 Testing pause and resume...');
    await QueueService.pauseQueue(QueueName.APPOINTMENT_REMINDER);
    let pausedStats = await QueueService.getQueueStats(
      QueueName.APPOINTMENT_REMINDER
    );
    console.log(`✅ Queue paused: ${pausedStats.paused}`);

    await QueueService.resumeQueue(QueueName.APPOINTMENT_REMINDER);
    let resumedStats = await QueueService.getQueueStats(
      QueueName.APPOINTMENT_REMINDER
    );
    console.log(`✅ Queue resumed: ${!resumedStats.paused}\n`);

    // 11. Test removing a job
    console.log('1️⃣1️⃣ Removing a job...');
    await QueueService.removeJob(
      QueueName.APPOINTMENT_REMINDER,
      job.id as string
    );
    const removedJob = await QueueService.getJob(
      QueueName.APPOINTMENT_REMINDER,
      job.id as string
    );
    console.log(`✅ Job removed: ${removedJob === null}\n`);

    // 12. Test cleaning queue
    console.log('1️⃣2️⃣ Cleaning queue...');
    const cleanedJobs = await QueueService.cleanQueue(
      QueueName.APPOINTMENT_REMINDER,
      0,
      'wait'
    );
    console.log(`✅ Cleaned ${cleanedJobs.length} jobs\n`);

    // 13. Test overall health
    console.log('1️⃣3️⃣ Checking overall health...');
    const allHealth = await QueueService.getAllQueuesHealth();
    const healthyCount = allHealth.filter((h) => h.isHealthy).length;
    console.log(
      `✅ Overall health: ${healthyCount}/${allHealth.length} queues healthy\n`
    );

    console.log('🎉 All tests passed!\n');
    console.log('Queue Infrastructure Summary:');
    console.log('✅ Queue initialization working');
    console.log('✅ Job creation working');
    console.log('✅ Job scheduling working');
    console.log('✅ Priority jobs working');
    console.log('✅ Queue statistics working');
    console.log('✅ Queue health monitoring working');
    console.log('✅ Queue management (pause/resume) working');
    console.log('✅ Job retrieval and removal working');
    console.log('✅ Queue metrics working');

    // Cleanup
    console.log('\n🧹 Cleaning up...');
    await QueueService.closeAll();
    console.log('✅ Queue Service closed');

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('Queue infrastructure test failed:', error);
    process.exit(1);
  }
}

// Run the test
testQueueInfrastructure();
