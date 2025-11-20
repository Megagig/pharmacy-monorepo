/**
 * Patient Engagement Alerting Service
 * Implements intelligent alerting rules for patient engagement operations
 * Requirements: 9.1, 9.2, 9.3
 */

import { EventEmitter } from 'events';
import logger, { patientEngagementLogger } from '../utils/logger';
import { patientEngagementMonitoring, EngagementAlert } from './PatientEngagementMonitoringService';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  module: 'appointment' | 'followup' | 'reminder' | 'schedule' | 'integration' | 'system';
  operation?: string;
  condition: AlertCondition;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownPeriod: number; // minutes
  channels: AlertChannel[];
  lastTriggered?: Date;
}

export interface AlertCondition {
  type: 'threshold' | 'rate' | 'pattern' | 'anomaly';
  metric: string;
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  value: number;
  timeWindow: number; // minutes
  minSamples?: number;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms' | 'dashboard';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AlertNotification {
  id: string;
  alertId: string;
  ruleId: string;
  channel: AlertChannel;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: Date;
  error?: string;
  retryCount: number;
}

export class PatientEngagementAlertingService extends EventEmitter {
  private alertRules: Map<string, AlertRule> = new Map();
  private alertHistory: EngagementAlert[] = [];
  private notifications: AlertNotification[] = [];
  private cooldownTracker: Map<string, Date> = new Map();

  constructor() {
    super();
    this.initializeDefaultRules();
    this.startRuleEvaluation();
    this.setupMonitoringListeners();
  }

  /**
   * Add a new alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = this.generateId();
    const alertRule: AlertRule = {
      id,
      ...rule,
    };

    this.alertRules.set(id, alertRule);
    
    patientEngagementLogger.business('alert_rule_added', {
      ruleId: id,
      ruleName: rule.name,
      module: rule.module,
      severity: rule.severity,
    });

    return id;
  }

  /**
   * Update an existing alert rule
   */
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(ruleId);
    if (!rule) return false;

    const updatedRule = { ...rule, ...updates };
    this.alertRules.set(ruleId, updatedRule);

    patientEngagementLogger.business('alert_rule_updated', {
      ruleId,
      ruleName: rule.name,
      updates: Object.keys(updates),
    });

    return true;
  }

  /**
   * Delete an alert rule
   */
  deleteAlertRule(ruleId: string): boolean {
    const rule = this.alertRules.get(ruleId);
    if (!rule) return false;

    this.alertRules.delete(ruleId);

    patientEngagementLogger.business('alert_rule_deleted', {
      ruleId,
      ruleName: rule.name,
    });

    return true;
  }

  /**
   * Enable/disable an alert rule
   */
  toggleAlertRule(ruleId: string, enabled: boolean): boolean {
    const rule = this.alertRules.get(ruleId);
    if (!rule) return false;

    rule.enabled = enabled;
    this.alertRules.set(ruleId, rule);

    patientEngagementLogger.business('alert_rule_toggled', {
      ruleId,
      ruleName: rule.name,
      enabled,
    });

    return true;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get alert rule by ID
   */
  getAlertRule(ruleId: string): AlertRule | undefined {
    return this.alertRules.get(ruleId);
  }

  /**
   * Evaluate all alert rules
   */
  async evaluateAlertRules(): Promise<void> {
    const enabledRules = Array.from(this.alertRules.values()).filter(rule => rule.enabled);

    for (const rule of enabledRules) {
      try {
        await this.evaluateRule(rule);
      } catch (error) {
        logger.error(`Failed to evaluate alert rule ${rule.id}:`, error);
      }
    }
  }

  /**
   * Send test alert for a rule
   */
  async sendTestAlert(ruleId: string): Promise<boolean> {
    const rule = this.alertRules.get(ruleId);
    if (!rule) return false;

    const testAlert: EngagementAlert = {
      id: this.generateId(),
      type: 'system',
      severity: 'low',
      module: rule.module,
      operation: rule.operation || 'test',
      message: `Test alert for rule: ${rule.name}`,
      details: {
        ruleId,
        test: true,
      },
      timestamp: new Date(),
      resolved: false,
    };

    await this.sendAlertNotifications(testAlert, rule);
    return true;
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(timeRange: { start: Date; end: Date }): {
    totalAlerts: number;
    alertsBySeverity: Record<string, number>;
    alertsByModule: Record<string, number>;
    alertsByRule: Record<string, number>;
    averageResolutionTime: number;
    topAlertRules: Array<{ ruleId: string; ruleName: string; count: number }>;
  } {
    const filteredAlerts = this.alertHistory.filter(
      alert => alert.timestamp >= timeRange.start && alert.timestamp <= timeRange.end
    );

    const alertsBySeverity: Record<string, number> = {};
    const alertsByModule: Record<string, number> = {};
    const alertsByRule: Record<string, number> = {};
    let totalResolutionTime = 0;
    let resolvedAlertsCount = 0;

    filteredAlerts.forEach(alert => {
      // Count by severity
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;

      // Count by module
      alertsByModule[alert.module] = (alertsByModule[alert.module] || 0) + 1;

      // Count by rule (if available)
      const ruleId = alert.details.ruleId;
      if (ruleId) {
        const rule = this.alertRules.get(ruleId);
        const ruleName = rule ? rule.name : 'Unknown Rule';
        alertsByRule[ruleName] = (alertsByRule[ruleName] || 0) + 1;
      }

      // Calculate resolution time
      if (alert.resolved && alert.resolvedAt) {
        totalResolutionTime += alert.resolvedAt.getTime() - alert.timestamp.getTime();
        resolvedAlertsCount++;
      }
    });

    // Top alert rules
    const topAlertRules = Object.entries(alertsByRule)
      .map(([ruleName, count]) => ({ ruleId: '', ruleName, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalAlerts: filteredAlerts.length,
      alertsBySeverity,
      alertsByModule,
      alertsByRule,
      averageResolutionTime: resolvedAlertsCount > 0 ? totalResolutionTime / resolvedAlertsCount : 0,
      topAlertRules,
    };
  }

  /**
   * Private methods
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    // Check cooldown period
    const lastTriggered = this.cooldownTracker.get(rule.id);
    if (lastTriggered) {
      const cooldownEnd = new Date(lastTriggered.getTime() + rule.cooldownPeriod * 60 * 1000);
      if (new Date() < cooldownEnd) {
        return; // Still in cooldown
      }
    }

    const isTriggered = await this.evaluateCondition(rule.condition, rule.module, rule.operation);

    if (isTriggered) {
      const alert = patientEngagementMonitoring.createAlert(
        'business',
        rule.severity,
        rule.module,
        rule.operation || 'unknown',
        `Alert rule triggered: ${rule.name}`,
        {
          ruleId: rule.id,
          ruleName: rule.name,
          condition: rule.condition,
        }
      );

      // Send notifications
      const alertObj: EngagementAlert = {
        id: alert,
        type: 'business',
        severity: rule.severity,
        module: rule.module,
        operation: rule.operation || 'unknown',
        message: `Alert rule triggered: ${rule.name}`,
        details: {
          ruleId: rule.id,
          ruleName: rule.name,
          condition: rule.condition,
        },
        timestamp: new Date(),
        resolved: false,
      };

      await this.sendAlertNotifications(alertObj, rule);

      // Update cooldown tracker
      this.cooldownTracker.set(rule.id, new Date());
      rule.lastTriggered = new Date();
    }
  }

  private async evaluateCondition(
    condition: AlertCondition,
    module: string,
    operation?: string
  ): Promise<boolean> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - condition.timeWindow * 60 * 1000);

    try {
      switch (condition.type) {
        case 'threshold':
          return await this.evaluateThresholdCondition(condition, module, operation, startTime, endTime);
        case 'rate':
          return await this.evaluateRateCondition(condition, module, operation, startTime, endTime);
        case 'pattern':
          return await this.evaluatePatternCondition(condition, module, operation, startTime, endTime);
        case 'anomaly':
          return await this.evaluateAnomalyCondition(condition, module, operation, startTime, endTime);
        default:
          return false;
      }
    } catch (error) {
      logger.error(`Failed to evaluate condition for ${module}.${operation}:`, error);
      return false;
    }
  }

  private async evaluateThresholdCondition(
    condition: AlertCondition,
    module: string,
    operation: string | undefined,
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    // Get metrics for the time window
    const dashboardData = await patientEngagementMonitoring.getDashboardData(startTime, endTime);
    
    let value: number;
    
    switch (condition.metric) {
      case 'error_rate':
        const moduleStats = (dashboardData.operationMetrics as any)[module];
        value = moduleStats ? moduleStats.errorRate : 0;
        break;
      case 'response_time':
        const responseStats = (dashboardData.operationMetrics as any)[module];
        value = responseStats ? responseStats.averageResponseTime : 0;
        break;
      case 'active_alerts':
        value = dashboardData.summary.activeAlerts;
        break;
      default:
        return false;
    }

    return this.compareValues(value, condition.operator, condition.value);
  }

  private async evaluateRateCondition(
    condition: AlertCondition,
    module: string,
    operation: string | undefined,
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    // Calculate rate of operations per minute
    const dashboardData = await patientEngagementMonitoring.getDashboardData(startTime, endTime);
    const moduleStats = (dashboardData.operationMetrics as any)[module];
    
    if (!moduleStats) return false;

    const timeWindowMinutes = condition.timeWindow;
    const operationsPerMinute = moduleStats.total / timeWindowMinutes;

    return this.compareValues(operationsPerMinute, condition.operator, condition.value);
  }

  private async evaluatePatternCondition(
    condition: AlertCondition,
    module: string,
    operation: string | undefined,
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    // Pattern detection (e.g., consecutive failures)
    // This is a simplified implementation
    const errorAnalysis = patientEngagementMonitoring.getErrorAnalysis(startTime, endTime);
    const recentErrors = errorAnalysis.recentErrors.slice(-5); // Last 5 errors

    if (condition.metric === 'consecutive_errors') {
      const consecutiveErrors = recentErrors.filter(error => 
        error.module === module && (!operation || error.operation === operation)
      ).length;

      return this.compareValues(consecutiveErrors, condition.operator, condition.value);
    }

    return false;
  }

  private async evaluateAnomalyCondition(
    condition: AlertCondition,
    module: string,
    operation: string | undefined,
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    // Anomaly detection (simplified - compare with historical average)
    const currentData = await patientEngagementMonitoring.getDashboardData(startTime, endTime);
    
    // Get historical data (same time window, but 24 hours ago)
    const historicalStart = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
    const historicalEnd = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    const historicalData = await patientEngagementMonitoring.getDashboardData(historicalStart, historicalEnd);

    const currentStats = (currentData.operationMetrics as any)[module];
    const historicalStats = (historicalData.operationMetrics as any)[module];

    if (!currentStats || !historicalStats) return false;

    let currentValue: number;
    let historicalValue: number;

    switch (condition.metric) {
      case 'response_time_anomaly':
        currentValue = currentStats.averageResponseTime;
        historicalValue = historicalStats.averageResponseTime;
        break;
      case 'error_rate_anomaly':
        currentValue = currentStats.errorRate;
        historicalValue = historicalStats.errorRate;
        break;
      default:
        return false;
    }

    // Check if current value deviates significantly from historical
    const deviationPercent = Math.abs((currentValue - historicalValue) / historicalValue) * 100;
    
    return this.compareValues(deviationPercent, condition.operator, condition.value);
  }

  private compareValues(actual: number, operator: string, expected: number): boolean {
    switch (operator) {
      case 'gt': return actual > expected;
      case 'gte': return actual >= expected;
      case 'lt': return actual < expected;
      case 'lte': return actual <= expected;
      case 'eq': return actual === expected;
      case 'ne': return actual !== expected;
      default: return false;
    }
  }

  private async sendAlertNotifications(alert: EngagementAlert, rule: AlertRule): Promise<void> {
    for (const channel of rule.channels) {
      if (!channel.enabled) continue;

      const notification: AlertNotification = {
        id: this.generateId(),
        alertId: alert.id,
        ruleId: rule.id,
        channel,
        status: 'pending',
        retryCount: 0,
      };

      try {
        await this.sendNotification(notification, alert, rule);
        notification.status = 'sent';
        notification.sentAt = new Date();
      } catch (error) {
        notification.status = 'failed';
        notification.error = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Failed to send alert notification:`, error);
      }

      this.notifications.push(notification);
    }
  }

  private async sendNotification(
    notification: AlertNotification,
    alert: EngagementAlert,
    rule: AlertRule
  ): Promise<void> {
    const { channel } = notification;

    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(alert, rule, channel.config);
        break;
      case 'slack':
        await this.sendSlackNotification(alert, rule, channel.config);
        break;
      case 'webhook':
        await this.sendWebhookNotification(alert, rule, channel.config);
        break;
      case 'sms':
        await this.sendSMSNotification(alert, rule, channel.config);
        break;
      case 'dashboard':
        // Dashboard notifications are handled by the monitoring service
        break;
      default:
        throw new Error(`Unsupported notification channel: ${channel.type}`);
    }
  }

  private async sendEmailNotification(alert: EngagementAlert, rule: AlertRule, config: any): Promise<void> {
    // Implementation would integrate with email service
    patientEngagementLogger.business('alert_email_sent', {
      alertId: alert.id,
      ruleId: rule.id,
      severity: alert.severity,
      recipient: config.recipient,
    });
  }

  private async sendSlackNotification(alert: EngagementAlert, rule: AlertRule, config: any): Promise<void> {
    // Implementation would integrate with Slack API
    patientEngagementLogger.business('alert_slack_sent', {
      alertId: alert.id,
      ruleId: rule.id,
      severity: alert.severity,
      channel: config.channel,
    });
  }

  private async sendWebhookNotification(alert: EngagementAlert, rule: AlertRule, config: any): Promise<void> {
    // Implementation would send HTTP POST to webhook URL
    patientEngagementLogger.business('alert_webhook_sent', {
      alertId: alert.id,
      ruleId: rule.id,
      severity: alert.severity,
      url: config.url,
    });
  }

  private async sendSMSNotification(alert: EngagementAlert, rule: AlertRule, config: any): Promise<void> {
    // Implementation would integrate with SMS service
    patientEngagementLogger.business('alert_sms_sent', {
      alertId: alert.id,
      ruleId: rule.id,
      severity: alert.severity,
      recipient: config.recipient,
    });
  }

  private initializeDefaultRules(): void {
    // High error rate alert
    this.addAlertRule({
      name: 'High Error Rate - Appointments',
      description: 'Triggers when appointment error rate exceeds 10%',
      module: 'appointment',
      condition: {
        type: 'threshold',
        metric: 'error_rate',
        operator: 'gt',
        value: 10,
        timeWindow: 15,
      },
      severity: 'high',
      enabled: true,
      cooldownPeriod: 30,
      channels: [
        { type: 'dashboard', config: {}, enabled: true },
        { type: 'email', config: { recipient: 'admin@pharmacy.com' }, enabled: false },
      ],
    });

    // Slow response time alert
    this.addAlertRule({
      name: 'Slow Response Time - Follow-ups',
      description: 'Triggers when follow-up operations take longer than 5 seconds on average',
      module: 'followup',
      condition: {
        type: 'threshold',
        metric: 'response_time',
        operator: 'gt',
        value: 5000,
        timeWindow: 10,
      },
      severity: 'medium',
      enabled: true,
      cooldownPeriod: 15,
      channels: [
        { type: 'dashboard', config: {}, enabled: true },
      ],
    });

    // Too many active alerts
    this.addAlertRule({
      name: 'Too Many Active Alerts',
      description: 'Triggers when there are more than 20 active alerts',
      module: 'system',
      condition: {
        type: 'threshold',
        metric: 'active_alerts',
        operator: 'gt',
        value: 20,
        timeWindow: 5,
      },
      severity: 'critical',
      enabled: true,
      cooldownPeriod: 60,
      channels: [
        { type: 'dashboard', config: {}, enabled: true },
        { type: 'email', config: { recipient: 'admin@pharmacy.com' }, enabled: false },
      ],
    });
  }

  private startRuleEvaluation(): void {
    // Evaluate rules every 2 minutes
    setInterval(async () => {
      try {
        await this.evaluateAlertRules();
      } catch (error) {
        logger.error('Failed to evaluate alert rules:', error);
      }
    }, 2 * 60 * 1000);
  }

  private setupMonitoringListeners(): void {
    // Listen to monitoring events
    patientEngagementMonitoring.on('metric', (metric) => {
      // Could trigger immediate rule evaluation for critical metrics
    });

    patientEngagementMonitoring.on('alert', (alert) => {
      this.alertHistory.push(alert);
      
      // Cleanup old alerts
      if (this.alertHistory.length > 1000) {
        this.alertHistory = this.alertHistory.slice(-1000);
      }
    });
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

// Singleton instance
export const patientEngagementAlerting = new PatientEngagementAlertingService();

export default patientEngagementAlerting;