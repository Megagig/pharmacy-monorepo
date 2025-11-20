/**
 * Queue Configuration
 * Centralized configuration for Bull job queues
 * Uses shared Redis connection to prevent "max clients reached" error
 */

import Redis from 'ioredis';
import { QueueOptions, JobOptions } from 'bull';
import logger from '../utils/logger';
import { getRedisClient } from './redis';

/**
 * Get Redis configuration for Bull queues
 * This creates the config object but doesn't create the client yet
 */
export const getRedisConfig = () => {
  if (!process.env.REDIS_URL) {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_QUEUE_DB || '1'),
      maxRetriesPerRequest: null, // Bull compatibility
      enableReadyCheck: false,
      lazyConnect: true,
      connectTimeout: 30000,
      commandTimeout: 10000,
      enableOfflineQueue: true, // Allow queuing during connection
      retryStrategy: (times: number) => {
        if (times > 50) {
          logger.error('Queue Redis: Max retry attempts (50) reached');
          return null;
        }
        const delay = Math.min(times * 500, 30000);
        return delay;
      },
    };
  }

  // Parse Redis URL to support username:password format (Upstash)
  const urlMatch = process.env.REDIS_URL.match(/rediss?:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);

  if (!urlMatch) {
    logger.warn('Invalid REDIS_URL format, using defaults');
    return {
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    };
  }

  const [, username, password, host, portStr] = urlMatch;
  const port = parseInt(portStr, 10);
  const useTLS = process.env.REDIS_URL.startsWith('rediss://');

  return {
    host,
    port,
    username,
    password,
    maxRetriesPerRequest: null, // Bull compatibility
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 30000,
    commandTimeout: 10000,
    enableOfflineQueue: true, // Allow queuing during connection
    retryStrategy: (times: number) => {
      if (times > 50) {
        logger.error('Queue Redis: Max retry attempts (50) reached');
        return null;
      }
      const delay = Math.min(times * 500, 30000);
      return delay;
    },
    // TLS configuration for Upstash and other secure Redis providers
    ...(useTLS && {
      tls: {
        rejectUnauthorized: true,
      },
    }),
  };
};

// Keep for backward compatibility but use lazy connection
export const redisConfig = getRedisConfig();

/**
 * Create Redis client for Bull using shared connection approach
 */
export const createRedisClient = async (): Promise<Redis | null> => {
  try {
    const sharedClient = await getRedisClient();
    if (sharedClient) {
      logger.info('✅ Queue: Using shared Redis connection');
      return sharedClient;
    }

    logger.warn('⚠️ Queue: Shared Redis not available, creating fallback client');
    const client = new Redis(redisConfig);

    client.on('error', (error) => {
      logger.error('❌ Queue Redis connection error:', error.message);
    });

    return client;
  } catch (error) {
    logger.error('❌ Queue: Failed to get Redis client:', error);
    return null;
  }
};

/**
 * Default queue options
 */
export const defaultQueueOptions: QueueOptions = {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Start with 2 seconds
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
  settings: {
    stalledInterval: 30000, // Check for stalled jobs every 30 seconds
    maxStalledCount: 2, // Max times a job can be recovered from stalled state
    lockDuration: 30000, // Lock duration for job processing
    lockRenewTime: 15000, // Renew lock every 15 seconds
  },
};

/**
 * Queue names
 */
export enum QueueName {
  APPOINTMENT_REMINDER = 'appointment-reminder',
  FOLLOW_UP_MONITOR = 'follow-up-monitor',
  MEDICATION_REMINDER = 'medication-reminder',
  ADHERENCE_CHECK = 'adherence-check',
  APPOINTMENT_STATUS = 'appointment-status',
}

/**
 * Job priorities
 */
export enum JobPriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4,
}

/**
 * Job options by priority
 */
export const getJobOptionsByPriority = (priority: JobPriority): JobOptions => {
  const baseOptions: JobOptions = {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  };

  switch (priority) {
    case JobPriority.CRITICAL:
      return {
        ...baseOptions,
        priority: 1,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      };
    case JobPriority.HIGH:
      return {
        ...baseOptions,
        priority: 2,
        attempts: 4,
      };
    case JobPriority.NORMAL:
      return {
        ...baseOptions,
        priority: 3,
      };
    case JobPriority.LOW:
      return {
        ...baseOptions,
        priority: 4,
        attempts: 2,
      };
    default:
      return baseOptions;
  }
};

/**
 * Queue-specific configurations
 */
export const queueConfigs: Record<QueueName, Partial<QueueOptions>> = {
  [QueueName.APPOINTMENT_REMINDER]: {
    defaultJobOptions: {
      attempts: 5, // Critical - retry more times
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    },
  },
  [QueueName.FOLLOW_UP_MONITOR]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    },
  },
  [QueueName.MEDICATION_REMINDER]: {
    defaultJobOptions: {
      attempts: 4,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  },
  [QueueName.ADHERENCE_CHECK]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 3000,
      },
    },
  },
  [QueueName.APPOINTMENT_STATUS]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  },
};

/**
 * Job data interfaces
 */
export interface AppointmentReminderJobData {
  appointmentId: string;
  patientId: string;
  workplaceId: string;
  reminderType: '24h' | '2h' | '15min';
  channels: ('email' | 'sms' | 'push' | 'whatsapp')[];
}

export interface FollowUpMonitorJobData {
  workplaceId: string;
  checkOverdue: boolean;
  escalateCritical: boolean;
}

export interface MedicationReminderJobData {
  patientId: string;
  medicationId: string;
  workplaceId: string;
  reminderType: 'refill' | 'adherence';
  daysUntilDue?: number;
}

export interface AdherenceCheckJobData {
  workplaceId: string;
  patientIds?: string[];
  conditionTypes?: string[];
}

export interface AppointmentStatusJobData {
  workplaceId: string;
  checkNoShows: boolean;
  autoUpdateStatus: boolean;
}
