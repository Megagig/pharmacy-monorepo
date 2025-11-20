/**
 * Patient Engagement Monitoring Service
 * Comprehensive monitoring and observability for patient engagement operations
 * Requirements: 9.1, 9.2, 9.3
 */

import { EventEmitter } from 'events';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import { performanceCollector, PerformanceMetric } from '../utils/performanceMonitoring';

export interface EngagementMetric {
  id: string;
  operation: string;
  module: 'appointment' | 'followup' | 'reminder' | 'schedule' | 'integration';
  workplaceId: string;
  userId?: string;
  patientId?: string;
  duration: number;
  success: boolean;
  errorType?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface EngagementAlert {
  id: string;
  type: 'performance' | 'error' | 'business' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  module: string;
  operation: string;
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details: Record<string, any>;
  timestamp: Date;
}

export interface MonitoringDashboardData {
  summary: {
    totalOperations: number;
    successRate: number;
    averageResponseTime: number;
    activeAlerts: number;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  };
  operationMetrics: {
    appointments: OperationStats;
    followUps: OperationStats;
    reminders: OperationStats;
    schedules: OperationStats;
  };
  performanceMetrics: {
    responseTimeP95: number;
    errorRate: number;
    throughput: number;
  };
  alerts: EngagementAlert[];
  healthChecks: HealthCheckResult[];
}

export interface OperationStats {
  total: number;
  successful: number;
  failed: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
}

export class PatientEngagementMonitoringService extends EventEmitter {
  private metrics: EngagementMetric[] = [];
  private alerts: EngagementAlert[] = [];
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private maxMetrics = 10000;
  private maxAlerts = 1000;

  constructor() {
    super();
    this.initializeHealthChecks();
    this.startPeriodicHealthChecks();
    this.startMetricsCleanup();
  }

  /**
   * Record an engagement operation metric
   */
  recordOperation(
    operation: string,
    module: EngagementMetric['module'],
    workplaceId: string,
    duration: number,
    success: boolean,
    options: {
      userId?: string;
      patientId?: string;
      errorType?: string;
      errorMessage?: string;
      metadata?: Record<string, any>;
    } = {}
  ): void {
    const metric: EngagementMetric = {
      id: this.generateId(),
      operation,
      module,
      workplaceId,
      userId: options.userId,
      patientId: options.patientId,
      duration,
      success,
      errorType: options.errorType,
      errorMessage: options.errorMessage,
      metadata: options.metadata,
      timestamp: new Date(),
    };

    this.metrics.push(metric);
    this.emit('metric', metric);

    // Record in performance collector for global monitoring
    performanceCollector.recordMetric(
      `engagement_${module}_${operation}`,
      duration,
      'ms',
      {
        module,
        operation,
        workplace_id: workplaceId,
        success: success.toString(),
      },
      {
        userId: options.userId,
        patientId: options.patientId,
        errorType: options.errorType,
      }
    );

    // Check for performance issues
    this.checkPerformanceThresholds(metric);

    // Log structured operation
    this.logOperation(metric);

    // Cleanup old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Create an alert
   */
  createAlert(
    type: EngagementAlert['type'],
    severity: EngagementAlert['severity'],
    module: string,
    operation: string,
    message: string,
    details: Record<string, any> = {}
  ): string {
    const alert: EngagementAlert = {
      id: this.generateId(),
      type,
      severity,
      module,
      operation,
      message,
      details,
      timestamp: new Date(),
      resolved: false,
    };

    this.alerts.push(alert);
    this.emit('alert', alert);

    // Log alert
    const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    logger[logLevel](`Patient Engagement Alert: ${message}`, {
      alertId: alert.id,
      type,
      severity,
      module,
      operation,
      details,
    });

    // Cleanup old alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(-this.maxAlerts);
    }

    return alert.id;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      this.emit('alertResolved', alert);

      logger.info(`Patient Engagement Alert resolved: ${alert.message}`, {
        alertId,
        duration: alert.resolvedAt.getTime() - alert.timestamp.getTime(),
      });

      return true;
    }
    return false;
  }

  /**
   * Perform health check for a service
   */
  async performHealthCheck(serviceName: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let status: HealthCheckResult['status'] = 'healthy';
    const details: Record<string, any> = {};

    try {
      switch (serviceName) {
        case 'appointment_service':
          await this.checkAppointmentService(details);
          break;
        case 'followup_service':
          await this.checkFollowUpService(details);
          break;
        case 'reminder_service':
          await this.checkReminderService(details);
          break;
        case 'database':
          await this.checkDatabase(details);
          break;
        case 'queue_service':
          await this.checkQueueService(details);
          break;
        default:
          throw new Error(`Unknown service: ${serviceName}`);
      }
    } catch (error) {
      status = 'unhealthy';
      details.error = error instanceof Error ? error.message : 'Unknown error';
    }

    const responseTime = Date.now() - startTime;

    // Determine status based on response time
    if (status === 'healthy' && responseTime > 5000) {
      status = 'degraded';
      details.warning = 'High response time';
    }

    const result: HealthCheckResult = {
      service: serviceName,
      status,
      responseTime,
      details,
      timestamp: new Date(),
    };

    this.healthChecks.set(serviceName, result);
    this.emit('healthCheck', result);

    return result;
  }

  /**
   * Get monitoring dashboard data
   */
  async getDashboardData(
    startTime?: Date,
    endTime?: Date,
    workplaceId?: string
  ): Promise<MonitoringDashboardData> {
    const now = new Date();
    const start = startTime || new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
    const end = endTime || now;

    // Filter metrics by time range and workplace
    let filteredMetrics = this.metrics.filter(
      m => m.timestamp >= start && m.timestamp <= end
    );

    if (workplaceId) {
      filteredMetrics = filteredMetrics.filter(m => m.workplaceId === workplaceId);
    }

    // Calculate summary statistics
    const totalOperations = filteredMetrics.length;
    const successfulOperations = filteredMetrics.filter(m => m.success).length;
    const successRate = totalOperations > 0 ? (successfulOperations / totalOperations) * 100 : 100;
    const averageResponseTime = totalOperations > 0 
      ? filteredMetrics.reduce((sum, m) => sum + m.duration, 0) / totalOperations 
      : 0;

    // Get active alerts
    const activeAlerts = this.alerts.filter(a => !a.resolved);

    // Determine overall health status
    const healthStatuses = Array.from(this.healthChecks.values()).map(h => h.status);
    let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (healthStatuses.includes('unhealthy')) {
      healthStatus = 'unhealthy';
    } else if (healthStatuses.includes('degraded')) {
      healthStatus = 'degraded';
    }

    // Calculate operation-specific metrics
    const operationMetrics = {
      appointments: this.calculateOperationStats(filteredMetrics, 'appointment'),
      followUps: this.calculateOperationStats(filteredMetrics, 'followup'),
      reminders: this.calculateOperationStats(filteredMetrics, 'reminder'),
      schedules: this.calculateOperationStats(filteredMetrics, 'schedule'),
    };

    // Calculate performance metrics
    const durations = filteredMetrics.map(m => m.duration).sort((a, b) => a - b);
    const responseTimeP95 = durations.length > 0 
      ? durations[Math.floor(durations.length * 0.95)] || 0 
      : 0;
    const errorRate = totalOperations > 0 
      ? ((totalOperations - successfulOperations) / totalOperations) * 100 
      : 0;
    const timeRangeHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const throughput = timeRangeHours > 0 ? totalOperations / timeRangeHours : 0;

    return {
      summary: {
        totalOperations,
        successRate: Math.round(successRate * 100) / 100,
        averageResponseTime: Math.round(averageResponseTime),
        activeAlerts: activeAlerts.length,
        healthStatus,
      },
      operationMetrics,
      performanceMetrics: {
        responseTimeP95: Math.round(responseTimeP95),
        errorRate: Math.round(errorRate * 100) / 100,
        throughput: Math.round(throughput * 100) / 100,
      },
      alerts: activeAlerts.slice(-20), // Last 20 active alerts
      healthChecks: Array.from(this.healthChecks.values()),
    };
  }

  /**
   * Get operation metrics for a specific time range
   */
  getOperationMetrics(
    operation: string,
    module: EngagementMetric['module'],
    startTime: Date,
    endTime: Date,
    workplaceId?: string
  ): OperationStats {
    let filteredMetrics = this.metrics.filter(
      m => m.operation === operation &&
           m.module === module &&
           m.timestamp >= startTime &&
           m.timestamp <= endTime
    );

    if (workplaceId) {
      filteredMetrics = filteredMetrics.filter(m => m.workplaceId === workplaceId);
    }

    return this.calculateOperationStats(filteredMetrics, module);
  }

  /**
   * Get error analysis
   */
  getErrorAnalysis(
    startTime: Date,
    endTime: Date,
    workplaceId?: string
  ): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByModule: Record<string, number>;
    errorsByOperation: Record<string, number>;
    recentErrors: EngagementMetric[];
  } {
    let errorMetrics = this.metrics.filter(
      m => !m.success && m.timestamp >= startTime && m.timestamp <= endTime
    );

    if (workplaceId) {
      errorMetrics = errorMetrics.filter(m => m.workplaceId === workplaceId);
    }

    const errorsByType: Record<string, number> = {};
    const errorsByModule: Record<string, number> = {};
    const errorsByOperation: Record<string, number> = {};

    errorMetrics.forEach(metric => {
      if (metric.errorType) {
        errorsByType[metric.errorType] = (errorsByType[metric.errorType] || 0) + 1;
      }
      errorsByModule[metric.module] = (errorsByModule[metric.module] || 0) + 1;
      errorsByOperation[metric.operation] = (errorsByOperation[metric.operation] || 0) + 1;
    });

    return {
      totalErrors: errorMetrics.length,
      errorsByType,
      errorsByModule,
      errorsByOperation,
      recentErrors: errorMetrics.slice(-50), // Last 50 errors
    };
  }

  /**
   * Private helper methods
   */
  private calculateOperationStats(
    metrics: EngagementMetric[],
    module: EngagementMetric['module']
  ): OperationStats {
    const moduleMetrics = metrics.filter(m => m.module === module);
    const total = moduleMetrics.length;
    const successful = moduleMetrics.filter(m => m.success).length;
    const failed = total - successful;

    if (total === 0) {
      return {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        errorRate: 0,
      };
    }

    const durations = moduleMetrics.map(m => m.duration).sort((a, b) => a - b);
    const averageResponseTime = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const p95ResponseTime = durations[Math.floor(durations.length * 0.95)] || 0;
    const errorRate = (failed / total) * 100;

    return {
      total,
      successful,
      failed,
      averageResponseTime: Math.round(averageResponseTime),
      p95ResponseTime: Math.round(p95ResponseTime),
      errorRate: Math.round(errorRate * 100) / 100,
    };
  }

  private checkPerformanceThresholds(metric: EngagementMetric): void {
    // Define performance thresholds by operation type
    const thresholds: Record<string, number> = {
      'appointment_create': 3000,
      'appointment_update': 2000,
      'appointment_get': 1000,
      'followup_create': 2000,
      'followup_complete': 1500,
      'reminder_send': 5000,
      'schedule_check': 1000,
    };

    const key = `${metric.module}_${metric.operation}`;
    const threshold = thresholds[key] || 5000; // Default 5 seconds

    if (metric.duration > threshold) {
      this.createAlert(
        'performance',
        metric.duration > threshold * 2 ? 'high' : 'medium',
        metric.module,
        metric.operation,
        `Slow ${metric.operation} operation: ${metric.duration}ms (threshold: ${threshold}ms)`,
        {
          duration: metric.duration,
          threshold,
          workplaceId: metric.workplaceId,
          patientId: metric.patientId,
        }
      );
    }

    // Check for error patterns
    if (!metric.success && metric.errorType) {
      this.createAlert(
        'error',
        'medium',
        metric.module,
        metric.operation,
        `Operation failed: ${metric.errorMessage || metric.errorType}`,
        {
          errorType: metric.errorType,
          errorMessage: metric.errorMessage,
          workplaceId: metric.workplaceId,
          patientId: metric.patientId,
        }
      );
    }
  }

  private logOperation(metric: EngagementMetric): void {
    const logData = {
      operationId: metric.id,
      operation: metric.operation,
      module: metric.module,
      workplaceId: metric.workplaceId,
      userId: metric.userId,
      patientId: metric.patientId,
      duration: metric.duration,
      success: metric.success,
      errorType: metric.errorType,
      metadata: metric.metadata,
    };

    if (metric.success) {
      logger.info(`Patient Engagement Operation: ${metric.module}.${metric.operation}`, logData);
    } else {
      logger.error(`Patient Engagement Operation Failed: ${metric.module}.${metric.operation}`, {
        ...logData,
        errorMessage: metric.errorMessage,
      });
    }
  }

  private async checkAppointmentService(details: Record<string, any>): Promise<void> {
    const Appointment = (await import('../models/Appointment')).default;
    
    // Check if we can query appointments
    const count = await Appointment.countDocuments({ isDeleted: false });
    details.appointmentCount = count;
    
    // Check recent appointment creation rate
    const recentCount = await Appointment.countDocuments({
      isDeleted: false,
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }, // Last hour
    });
    details.recentAppointments = recentCount;
  }

  private async checkFollowUpService(details: Record<string, any>): Promise<void> {
    const FollowUpTask = (await import('../models/FollowUpTask')).default;
    
    // Check if we can query follow-up tasks
    const count = await FollowUpTask.countDocuments({ isDeleted: false });
    details.followUpTaskCount = count;
    
    // Check overdue tasks
    const overdueCount = await FollowUpTask.countDocuments({
      isDeleted: false,
      status: { $in: ['pending', 'in_progress'] },
      dueDate: { $lt: new Date() },
    });
    details.overdueTaskCount = overdueCount;
    
    if (overdueCount > 100) {
      throw new Error(`Too many overdue tasks: ${overdueCount}`);
    }
  }

  private async checkReminderService(details: Record<string, any>): Promise<void> {
    // Check if reminder queue is accessible
    try {
      const { QueueService } = await import('./QueueService');
      const { QueueName } = await import('../config/queue');
      const queueService = QueueService.getInstance();
      const queueStats = await queueService.getQueueStats(QueueName.APPOINTMENT_REMINDER);
      details.reminderQueueStats = queueStats;
      
      if (queueStats.failed > 50) {
        throw new Error(`Too many failed reminder jobs: ${queueStats.failed}`);
      }
    } catch (error) {
      details.queueError = error instanceof Error ? error.message : 'Unknown queue error';
    }
  }

  private async checkDatabase(details: Record<string, any>): Promise<void> {
    // Check MongoDB connection
    const state = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    details.connectionState = states[state] || 'unknown';
    
    if (state !== 1) { // 1 = connected
      throw new Error(`Database not connected: ${details.connectionState}`);
    }
    
    // Check database performance
    const startTime = Date.now();
    await mongoose.connection.db.admin().ping();
    details.pingTime = Date.now() - startTime;
    
    if (details.pingTime > 1000) {
      throw new Error(`Database ping too slow: ${details.pingTime}ms`);
    }
  }

  private async checkQueueService(details: Record<string, any>): Promise<void> {
    try {
      const { QueueService } = await import('./QueueService');
      const { QueueName } = await import('../config/queue');
      const queueService = QueueService.getInstance();
      
      // Check health of all queues
      const queueNames = Object.values(QueueName);
      const healthChecks = await Promise.all(
        queueNames.map(async (queueName) => {
          try {
            return await queueService.getQueueHealth(queueName);
          } catch (error) {
            return {
              name: queueName,
              isHealthy: false,
              stats: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: false },
              errors: [error instanceof Error ? error.message : 'Unknown error'],
            };
          }
        })
      );
      
      const unhealthyQueues = healthChecks.filter(check => !check.isHealthy);
      details.queueHealthChecks = healthChecks;
      details.unhealthyQueues = unhealthyQueues.length;
      
      if (unhealthyQueues.length > 0) {
        throw new Error(`${unhealthyQueues.length} queues are unhealthy: ${unhealthyQueues.map(q => q.name).join(', ')}`);
      }
    } catch (error) {
      details.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  private initializeHealthChecks(): void {
    // Initialize health check results
    const services = [
      'appointment_service',
      'followup_service',
      'reminder_service',
      'database',
      'queue_service',
    ];

    services.forEach(service => {
      this.healthChecks.set(service, {
        service,
        status: 'healthy',
        responseTime: 0,
        details: {},
        timestamp: new Date(),
      });
    });
  }

  private startPeriodicHealthChecks(): void {
    // Perform health checks every 5 minutes
    setInterval(async () => {
      const services = Array.from(this.healthChecks.keys());
      
      for (const service of services) {
        try {
          await this.performHealthCheck(service);
        } catch (error) {
          logger.error(`Health check failed for ${service}:`, error);
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  private startMetricsCleanup(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
      this.alerts = this.alerts.filter(a => a.timestamp > cutoff);
      
      logger.info('Cleaned up old patient engagement metrics and alerts', {
        metricsRemaining: this.metrics.length,
        alertsRemaining: this.alerts.length,
      });
    }, 60 * 60 * 1000); // Every hour
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

// Singleton instance
export const patientEngagementMonitoring = new PatientEngagementMonitoringService();

export default patientEngagementMonitoring;