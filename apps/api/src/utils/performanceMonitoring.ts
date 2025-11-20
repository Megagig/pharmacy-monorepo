/**
 * Performance Monitoring and Alerting System
 * Implements comprehensive performance tracking, alerting, and reporting
 */

import logger from './logger';
import { EventEmitter } from 'events';

// ===============================
// PERFORMANCE METRICS COLLECTION
// ===============================

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // seconds
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  channels: string[]; // email, slack, webhook
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'firing' | 'resolved';
  firedAt: Date;
  resolvedAt?: Date;
  message: string;
}

export class PerformanceCollector extends EventEmitter {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // Reduced from 10000 to save memory
  private alertRules: AlertRule[] = [];
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];

  constructor() {
    super();
    this.initializeDefaultRules();
    this.startMetricsCleanup();
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    name: string,
    value: number,
    unit: string = 'ms',
    tags: Record<string, string> = {},
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      id: this.generateId(),
      name,
      value,
      unit,
      timestamp: new Date(),
      tags,
      metadata,
    };

    this.metrics.push(metric);
    this.emit('metric', metric);

    // Check alert rules
    this.checkAlertRules(metric);

    // Cleanup old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Record database query performance
   */
  recordDatabaseQuery(
    operation: string,
    collection: string,
    duration: number,
    documentsExamined: number,
    documentsReturned: number,
    indexUsed: boolean
  ): void {
    this.recordMetric(
      'db_query_duration',
      duration,
      'ms',
      {
        operation,
        collection,
        index_used: indexUsed.toString(),
      },
      {
        documentsExamined,
        documentsReturned,
        efficiency: documentsReturned / Math.max(documentsExamined, 1),
      }
    );

    // Record efficiency metric
    const efficiency = documentsReturned / Math.max(documentsExamined, 1);
    this.recordMetric('db_query_efficiency', efficiency * 100, '%', {
      operation,
      collection,
    });
  }

  /**
   * Record API endpoint performance
   */
  recordApiEndpoint(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    requestSize?: number,
    responseSize?: number
  ): void {
    this.recordMetric(
      'api_request_duration',
      duration,
      'ms',
      {
        method,
        path,
        status_code: statusCode.toString(),
        status_class: Math.floor(statusCode / 100) + 'xx',
      },
      {
        requestSize,
        responseSize,
      }
    );

    // Record request rate
    this.recordMetric('api_request_rate', 1, 'count', {
      method,
      path,
      status_code: statusCode.toString(),
    });

    // Record error rate for non-2xx responses
    if (statusCode >= 400) {
      this.recordMetric('api_error_rate', 1, 'count', {
        method,
        path,
        status_code: statusCode.toString(),
      });
    }
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(): void {
    const memUsage = process.memoryUsage();

    this.recordMetric(
      'memory_heap_used',
      memUsage.heapUsed / 1024 / 1024,
      'MB'
    );
    this.recordMetric(
      'memory_heap_total',
      memUsage.heapTotal / 1024 / 1024,
      'MB'
    );
    this.recordMetric('memory_external', memUsage.external / 1024 / 1024, 'MB');
    this.recordMetric('memory_rss', memUsage.rss / 1024 / 1024, 'MB');

    // Calculate heap usage percentage
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    this.recordMetric('memory_heap_usage_percent', heapUsagePercent, '%');
  }

  /**
   * Record CPU usage
   */
  recordCpuUsage(): void {
    const cpuUsage = process.cpuUsage();

    this.recordMetric('cpu_user_time', cpuUsage.user / 1000, 'ms');
    this.recordMetric('cpu_system_time', cpuUsage.system / 1000, 'ms');
  }

  /**
   * Record intervention-specific metrics
   */
  recordInterventionMetrics(
    operation: string,
    workplaceId: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    this.recordMetric(
      'intervention_operation_duration',
      duration,
      'ms',
      {
        operation,
        workplace_id: workplaceId,
        success: success.toString(),
      },
      metadata
    );

    // Record success/failure rate
    this.recordMetric(
      'intervention_operation_success',
      success ? 1 : 0,
      'count',
      {
        operation,
        workplace_id: workplaceId,
      }
    );
  }

  /**
   * Get metrics by name and time range
   */
  getMetrics(
    name?: string,
    startTime?: Date,
    endTime?: Date,
    tags?: Record<string, string>
  ): PerformanceMetric[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter((m) => m.name === name);
    }

    if (startTime) {
      filtered = filtered.filter((m) => m.timestamp >= startTime);
    }

    if (endTime) {
      filtered = filtered.filter((m) => m.timestamp <= endTime);
    }

    if (tags) {
      filtered = filtered.filter((m) => {
        return Object.entries(tags).every(
          ([key, value]) => m.tags[key] === value
        );
      });
    }

    return filtered;
  }

  /**
   * Calculate aggregated statistics
   */
  getAggregatedStats(
    name: string,
    startTime?: Date,
    endTime?: Date,
    tags?: Record<string, string>
  ): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    const metrics = this.getMetrics(name, startTime, endTime, tags);

    if (metrics.length === 0) {
      return {
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const values = metrics.map((m) => m.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      count: values.length,
      sum,
      avg: sum / values.length,
      min: values[0] || 0,
      max: values[values.length - 1] || 0,
      p50: this.percentile(values, 50),
      p95: this.percentile(values, 95),
      p99: this.percentile(values, 99),
    };
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const alertRule: AlertRule = {
      id: this.generateId(),
      ...rule,
    };

    this.alertRules.push(alertRule);
    return alertRule.id;
  }

  /**
   * Check alert rules against new metric
   */
  private checkAlertRules(metric: PerformanceMetric): void {
    const applicableRules = this.alertRules.filter(
      (rule) => rule.enabled && rule.metric === metric.name
    );

    for (const rule of applicableRules) {
      const isTriggered = this.evaluateCondition(
        metric.value,
        rule.condition,
        rule.threshold
      );
      const alertKey = `${rule.id}_${JSON.stringify(metric.tags)}`;

      if (isTriggered) {
        if (!this.activeAlerts.has(alertKey)) {
          // Fire new alert
          const alert: Alert = {
            id: this.generateId(),
            ruleId: rule.id,
            ruleName: rule.name,
            metric: rule.metric,
            value: metric.value,
            threshold: rule.threshold,
            severity: rule.severity,
            status: 'firing',
            firedAt: new Date(),
            message: this.generateAlertMessage(rule, metric),
          };

          this.activeAlerts.set(alertKey, alert);
          this.alertHistory.push(alert);
          this.emit('alert', alert);

          logger.warn(`Alert fired: ${alert.message}`, {
            alertId: alert.id,
            ruleId: rule.id,
            metric: metric.name,
            value: metric.value,
            threshold: rule.threshold,
          });
        }
      } else {
        // Resolve alert if it was active
        const activeAlert = this.activeAlerts.get(alertKey);
        if (activeAlert && activeAlert.status === 'firing') {
          activeAlert.status = 'resolved';
          activeAlert.resolvedAt = new Date();
          this.activeAlerts.delete(alertKey);
          this.emit('alertResolved', activeAlert);

          logger.info(`Alert resolved: ${activeAlert.message}`, {
            alertId: activeAlert.id,
            duration:
              activeAlert.resolvedAt.getTime() - activeAlert.firedAt.getTime(),
          });
        }
      }
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    // API response time alerts
    this.addAlertRule({
      name: 'High API Response Time',
      metric: 'api_request_duration',
      condition: 'gt',
      threshold: 5000, // 5 seconds
      duration: 60,
      severity: 'high',
      enabled: true,
      channels: ['email', 'slack'],
    });

    // Database query performance
    this.addAlertRule({
      name: 'Slow Database Query',
      metric: 'db_query_duration',
      condition: 'gt',
      threshold: 10000, // 10 seconds
      duration: 30,
      severity: 'medium',
      enabled: true,
      channels: ['email'],
    });

    // Memory usage alerts
    this.addAlertRule({
      name: 'High Memory Usage',
      metric: 'memory_heap_usage_percent',
      condition: 'gt',
      threshold: 90, // Increased to 90% to reduce false alarms
      duration: 300, // 5 minutes
      severity: 'high',
      enabled: true,
      channels: ['email', 'slack'],
    });

    // Error rate alerts
    this.addAlertRule({
      name: 'High Error Rate',
      metric: 'api_error_rate',
      condition: 'gt',
      threshold: 10, // 10 errors per minute
      duration: 60,
      severity: 'critical',
      enabled: true,
      channels: ['email', 'slack', 'webhook'],
    });

    // Intervention operation performance
    this.addAlertRule({
      name: 'Slow Intervention Operation',
      metric: 'intervention_operation_duration',
      condition: 'gt',
      threshold: 3000, // 3 seconds
      duration: 120,
      severity: 'medium',
      enabled: true,
      channels: ['email'],
    });
  }

  /**
   * Start periodic system metrics collection
   */
  startSystemMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.recordMemoryUsage();
      this.recordCpuUsage();
    }, 30000);

    logger.info('System metrics collection started');
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(
    startTime: Date,
    endTime: Date
  ): {
    summary: Record<string, any>;
    apiPerformance: Record<string, any>;
    databasePerformance: Record<string, any>;
    systemMetrics: Record<string, any>;
    alerts: Alert[];
  } {
    const timeRange = { startTime, endTime };

    // API performance summary
    const apiStats = this.getAggregatedStats(
      'api_request_duration',
      startTime,
      endTime
    );
    const errorStats = this.getAggregatedStats(
      'api_error_rate',
      startTime,
      endTime
    );

    // Database performance summary
    const dbStats = this.getAggregatedStats(
      'db_query_duration',
      startTime,
      endTime
    );
    const dbEfficiencyStats = this.getAggregatedStats(
      'db_query_efficiency',
      startTime,
      endTime
    );

    // System metrics summary
    const memoryStats = this.getAggregatedStats(
      'memory_heap_usage_percent',
      startTime,
      endTime
    );
    const cpuStats = this.getAggregatedStats(
      'cpu_user_time',
      startTime,
      endTime
    );

    // Alerts in time range
    const alertsInRange = this.alertHistory.filter(
      (alert) => alert.firedAt >= startTime && alert.firedAt <= endTime
    );

    return {
      summary: {
        timeRange: {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          duration: endTime.getTime() - startTime.getTime(),
        },
        totalRequests: apiStats.count,
        averageResponseTime: Math.round(apiStats.avg),
        errorCount: errorStats.sum,
        alertCount: alertsInRange.length,
      },
      apiPerformance: {
        requestCount: apiStats.count,
        averageResponseTime: Math.round(apiStats.avg),
        p95ResponseTime: Math.round(apiStats.p95),
        p99ResponseTime: Math.round(apiStats.p99),
        errorRate: (errorStats.sum / Math.max(apiStats.count, 1)) * 100,
      },
      databasePerformance: {
        queryCount: dbStats.count,
        averageQueryTime: Math.round(dbStats.avg),
        p95QueryTime: Math.round(dbStats.p95),
        averageEfficiency: Math.round(dbEfficiencyStats.avg),
      },
      systemMetrics: {
        averageMemoryUsage: Math.round(memoryStats.avg),
        peakMemoryUsage: Math.round(memoryStats.max),
        averageCpuTime: Math.round(cpuStats.avg),
      },
      alerts: alertsInRange,
    };
  }

  /**
   * Utility methods
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;

    const index = (p / 100) * (values.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return values[lower] || 0;
    }

    return (
      (values[lower] || 0) * (upper - index) +
      (values[upper] || 0) * (index - lower)
    );
  }

  private evaluateCondition(
    value: number,
    condition: string,
    threshold: number
  ): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  private generateAlertMessage(
    rule: AlertRule,
    metric: PerformanceMetric
  ): string {
    return `${rule.name}: ${metric.name} is ${metric.value}${metric.unit}, threshold is ${rule.threshold}${metric.unit}`;
  }

  private startMetricsCleanup(): void {
    // Clean up old metrics every hour
    setInterval(() => {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      this.metrics = this.metrics.filter((m) => m.timestamp > cutoff);

      // Clean up old alert history
      this.alertHistory = this.alertHistory.filter((a) => a.firedAt > cutoff);

      logger.info('Cleaned up old performance metrics and alerts');
    }, 60 * 60 * 1000); // Every hour
  }
}

// ===============================
// MIDDLEWARE FOR AUTOMATIC TRACKING
// ===============================

export const createPerformanceMiddleware = (
  collector: PerformanceCollector
) => {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Track request size
    const requestSize = req.get('content-length') || 0;

    // Override res.end to capture response metrics
    const originalEnd = res.end;
    res.end = function (chunk: any, encoding: any) {
      const duration = Date.now() - startTime;
      const responseSize = res.get('content-length') || 0;

      collector.recordApiEndpoint(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
        duration,
        parseInt(requestSize),
        parseInt(responseSize)
      );

      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
};

// ===============================
// SINGLETON INSTANCE
// ===============================

export const performanceCollector = new PerformanceCollector();

// Don't start metrics collection immediately - let the server start it after DB connection
// performanceCollector.startSystemMetricsCollection();

export default performanceCollector;
