# Job Queue Infrastructure

This directory contains the job queue infrastructure for the Patient Engagement & Follow-up Management module.

## Overview

The queue infrastructure is built on Bull (backed by Redis) and provides:
- **Reliable job processing** with automatic retries and exponential backoff
- **Job scheduling** for future execution
- **Recurring jobs** using cron expressions
- **Priority queues** for critical tasks
- **Monitoring dashboard** for queue health and metrics
- **Graceful failure handling** with comprehensive logging

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Queue Service                            │
│  - Manages all job queues                                   │
│  - Provides unified API for job operations                  │
│  - Handles queue lifecycle                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Bull Queues                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Appointment      │  │ Follow-up        │                │
│  │ Reminder Queue   │  │ Monitor Queue    │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Medication       │  │ Adherence        │                │
│  │ Reminder Queue   │  │ Check Queue      │                │
│  └──────────────────┘  └──────────────────┘                │
│  ┌──────────────────┐                                       │
│  │ Appointment      │                                       │
│  │ Status Queue     │                                       │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     Redis                                    │
│  - Job storage                                              │
│  - Queue state management                                   │
│  - Job locking                                              │
└─────────────────────────────────────────────────────────────┘
```

## Queue Types

### 1. Appointment Reminder Queue
**Purpose**: Send appointment reminders to patients

**Job Data**:
```typescript
{
  appointmentId: string;
  patientId: string;
  workplaceId: string;
  reminderType: '24h' | '2h' | '15min';
  channels: ('email' | 'sms' | 'push' | 'whatsapp')[];
}
```

**Configuration**:
- Attempts: 5 (critical)
- Backoff: Exponential starting at 1 second
- Priority: High

### 2. Follow-up Monitor Queue
**Purpose**: Monitor and escalate overdue follow-up tasks

**Job Data**:
```typescript
{
  workplaceId: string;
  checkOverdue: boolean;
  escalateCritical: boolean;
}
```

**Configuration**:
- Attempts: 3
- Backoff: Exponential starting at 5 seconds
- Recurring: Hourly

### 3. Medication Reminder Queue
**Purpose**: Send medication refill and adherence reminders

**Job Data**:
```typescript
{
  patientId: string;
  medicationId: string;
  workplaceId: string;
  reminderType: 'refill' | 'adherence';
  daysUntilDue?: number;
}
```

**Configuration**:
- Attempts: 4
- Backoff: Exponential starting at 2 seconds
- Priority: Normal

### 4. Adherence Check Queue
**Purpose**: Check medication adherence for chronic disease patients

**Job Data**:
```typescript
{
  workplaceId: string;
  patientIds?: string[];
  conditionTypes?: string[];
}
```

**Configuration**:
- Attempts: 3
- Backoff: Exponential starting at 3 seconds
- Recurring: Weekly

### 5. Appointment Status Queue
**Purpose**: Monitor and update appointment statuses

**Job Data**:
```typescript
{
  workplaceId: string;
  checkNoShows: boolean;
  autoUpdateStatus: boolean;
}
```

**Configuration**:
- Attempts: 3
- Backoff: Exponential starting at 2 seconds
- Recurring: Every 15 minutes

## Usage

### Adding a Job

```typescript
import QueueService from '../services/QueueService';
import { QueueName } from '../config/queue';

// Add a simple job
const job = await QueueService.addJob(
  QueueName.APPOINTMENT_REMINDER,
  {
    appointmentId: 'appointment-123',
    patientId: 'patient-456',
    workplaceId: 'workplace-789',
    reminderType: '24h',
    channels: ['email', 'sms'],
  }
);

// Add a job with priority
const urgentJob = await QueueService.addJobWithPriority(
  QueueName.FOLLOW_UP_MONITOR,
  {
    workplaceId: 'workplace-789',
    checkOverdue: true,
    escalateCritical: true,
  },
  JobPriority.CRITICAL
);

// Schedule a job for future execution
const scheduledJob = await QueueService.scheduleJob(
  QueueName.APPOINTMENT_REMINDER,
  jobData,
  new Date('2025-10-26T10:00:00Z')
);

// Schedule a recurring job
const recurringJob = await QueueService.scheduleRecurringJob(
  QueueName.FOLLOW_UP_MONITOR,
  jobData,
  '0 * * * *' // Every hour
);
```

### Processing Jobs

Job processors will be implemented in Phase 2 (Task 10-15). Each queue will have a dedicated processor that:
1. Receives job data
2. Performs the required operation
3. Reports progress
4. Handles errors with retries

### Monitoring Queues

```typescript
// Get queue statistics
const stats = await QueueService.getQueueStats(QueueName.APPOINTMENT_REMINDER);
console.log(stats);
// {
//   waiting: 10,
//   active: 2,
//   completed: 150,
//   failed: 3,
//   delayed: 5,
//   paused: false
// }

// Get queue health
const health = await QueueService.getQueueHealth(QueueName.APPOINTMENT_REMINDER);
console.log(health);
// {
//   name: 'appointment-reminder',
//   isHealthy: true,
//   stats: { ... },
//   errors: []
// }

// Get detailed metrics
const metrics = await QueueService.getQueueMetrics(QueueName.APPOINTMENT_REMINDER);
```

### Queue Management

```typescript
// Pause a queue
await QueueService.pauseQueue(QueueName.APPOINTMENT_REMINDER);

// Resume a queue
await QueueService.resumeQueue(QueueName.APPOINTMENT_REMINDER);

// Clean old jobs
await QueueService.cleanQueue(
  QueueName.APPOINTMENT_REMINDER,
  24 * 3600, // Grace period in seconds
  'completed' // Status to clean
);

// Empty a queue (remove all jobs)
await QueueService.emptyQueue(QueueName.APPOINTMENT_REMINDER);
```

## Monitoring Dashboard

The queue monitoring dashboard is available at `/api/queue-monitoring/dashboard` (admin only).

### Endpoints

- `GET /api/queue-monitoring/dashboard` - Get complete dashboard
- `GET /api/queue-monitoring/stats` - Get all queue statistics
- `GET /api/queue-monitoring/health` - Get health status for all queues
- `GET /api/queue-monitoring/:queueName/stats` - Get stats for specific queue
- `GET /api/queue-monitoring/:queueName/metrics` - Get detailed metrics
- `GET /api/queue-monitoring/:queueName/health` - Get health status
- `POST /api/queue-monitoring/:queueName/pause` - Pause a queue
- `POST /api/queue-monitoring/:queueName/resume` - Resume a queue
- `POST /api/queue-monitoring/:queueName/clean` - Clean old jobs
- `POST /api/queue-monitoring/:queueName/empty` - Empty a queue
- `GET /api/queue-monitoring/:queueName/jobs/:jobId` - Get job details
- `POST /api/queue-monitoring/:queueName/jobs/:jobId/retry` - Retry a failed job
- `DELETE /api/queue-monitoring/:queueName/jobs/:jobId` - Remove a job

## Error Handling

### Retry Logic

All jobs are configured with exponential backoff retry logic:

1. **First attempt fails** → Wait 2 seconds → Retry
2. **Second attempt fails** → Wait 4 seconds → Retry
3. **Third attempt fails** → Wait 8 seconds → Retry
4. **Final attempt fails** → Job marked as failed

Critical jobs (like appointment reminders) have more retry attempts.

### Failure Logging

All job failures are logged with:
- Job ID and data
- Error message and stack trace
- Number of attempts made
- Timestamp

Failed jobs are kept for 7 days for debugging.

### Alerting

When a queue becomes unhealthy (high failure rate, too many active jobs, or paused), alerts are logged and can be integrated with external monitoring systems.

## Configuration

### Environment Variables

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password
REDIS_QUEUE_DB=1  # Separate DB for queues

# Queue Configuration
QUEUE_RETRY_ATTEMPTS=3
QUEUE_RETRY_DELAY=2000  # milliseconds
QUEUE_STALLED_INTERVAL=30000  # milliseconds
QUEUE_LOCK_DURATION=30000  # milliseconds
```

### Queue Options

Queue options can be customized in `backend/src/config/queue.ts`:

```typescript
export const queueConfigs: Record<QueueName, Partial<QueueOptions>> = {
  [QueueName.APPOINTMENT_REMINDER]: {
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  },
  // ... other queues
};
```

## Testing

### Unit Tests

```bash
npm test -- QueueService.test.ts
```

### Integration Tests

```bash
npm test -- queueMonitoring.test.ts
```

### Manual Testing

```bash
# Start Redis
redis-server

# Start the backend
npm run dev

# Test queue endpoints
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/queue-monitoring/dashboard
```

## Performance Considerations

### Redis Connection Pooling

The queue service uses a single Redis connection per queue, with connection pooling handled by ioredis.

### Job Cleanup

- Completed jobs are kept for 24 hours
- Failed jobs are kept for 7 days
- Old jobs are automatically cleaned up

### Memory Management

- Jobs are processed one at a time per queue
- Large job data should be stored in the database with only IDs in the queue
- Job results are not stored in Redis (only success/failure status)

## Best Practices

1. **Keep job data small** - Store large data in the database, pass only IDs
2. **Make jobs idempotent** - Jobs may be retried, ensure they can run multiple times safely
3. **Use appropriate priorities** - Reserve CRITICAL priority for truly critical jobs
4. **Monitor queue health** - Set up alerts for unhealthy queues
5. **Clean up old jobs** - Regularly clean completed and failed jobs
6. **Test retry logic** - Ensure jobs handle retries correctly
7. **Log important events** - Log job start, completion, and failures

## Troubleshooting

### Queue is not processing jobs

1. Check Redis connection: `redis-cli ping`
2. Check queue is not paused: `GET /api/queue-monitoring/:queueName/stats`
3. Check for stalled jobs: Look at queue metrics
4. Restart the queue service

### High failure rate

1. Check error logs for common failure reasons
2. Review job data for invalid values
3. Check external service availability (email, SMS, etc.)
4. Increase retry attempts if failures are transient

### Memory issues

1. Clean old jobs: `POST /api/queue-monitoring/:queueName/clean`
2. Reduce job data size
3. Increase Redis memory limit
4. Monitor Redis memory usage

## Future Enhancements

- [ ] Bull Board UI for visual queue monitoring
- [ ] Prometheus metrics export
- [ ] Job priority queues with weighted processing
- [ ] Dead letter queue for permanently failed jobs
- [ ] Job result storage and retrieval
- [ ] Queue rate limiting
- [ ] Job dependencies and workflows
- [ ] Multi-tenant queue isolation

## References

- [Bull Documentation](https://github.com/OptimalBits/bull)
- [Redis Documentation](https://redis.io/documentation)
- [ioredis Documentation](https://github.com/luin/ioredis)
